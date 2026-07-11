/* ============================================================
   Codex — app shell, routing, and all views.
   Pure client-side. No server. Data lives on-device via Store.
   ============================================================ */

// ---------- tiny helpers ----------

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function $(sel, root = document) {
  return root.querySelector(sel);
}
function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function toast(msg) {
  const root = $("#toastRoot");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 2200);
}

function initials(name) {
  const n = (name || "").trim();
  if (!n) return "★";
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}

function fmtHours(h) {
  return (Math.round(h * 10) / 10).toString();
}

function daysLeft(due) {
  if (!due) return null;
  const d = new Date(due + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

function dueLabel(due) {
  const left = daysLeft(due);
  if (left === null) return "No deadline";
  if (left > 1) return `${left} days left`;
  if (left === 1) return "1 day left";
  if (left === 0) return "Due today";
  return `${Math.abs(left)}d overdue`;
}

const PRIORITY = {
  high: { label: "High", cls: "pri-high" },
  medium: { label: "Medium", cls: "pri-med" },
  low: { label: "Low", cls: "pri-low" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SOURCE_TYPES = [
  "Book",
  "GitHub",
  "Article / Link",
  "Video / Course",
  "Person / Mentor",
  "Other",
];

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function syncToast(result) {
  if (!result) return;
  if (result.pulled) toast("Downloaded latest from server → saved locally ☁");
  else if (result.pushed) toast("Uploaded this PC's data to the transfer mailbox ☁");
}

function relTime(iso) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return "just now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return fmtDate(iso.slice(0, 10));
}

function difDots(n) {
  return "●".repeat(n) + "○".repeat(5 - n);
}

function weekdayShort(list) {
  if (!list || !list.length) return "any day";
  return list
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS[d])
    .join(" ");
}

// ---------- modal ----------

function openModal(innerHtml, { wide = false } = {}) {
  const root = $("#modalRoot");
  const back = document.createElement("div");
  back.className = "modal-backdrop show";
  back.innerHTML = `<div class="modal ${wide ? "modal-wide" : ""}">${innerHtml}</div>`;
  root.appendChild(back);
  const close = () => back.remove();
  back.addEventListener("click", (e) => {
    if (e.target === back) close();
  });
  return { el: back, close };
}

// ---------- router ----------

const routes = {
  home: renderHome,
  tasks: renderTasks,
  codex: renderCodex,
  market: renderMarket,
  profile: renderProfile,
};

function navigate(route) {
  if (route === "new") {
    openNewTaskModal();
    return;
  }
  location.hash = "#/" + route;
}

function currentRoute() {
  const h = location.hash.replace(/^#\//, "");
  return h || "home";
}

function router() {
  const raw = currentRoute();
  const [name, param] = raw.split("/");
  const view = $("#view");
  view.scrollTop = 0;
  window.scrollTo(0, 0);

  // stop any running task timer when leaving a task detail
  if (Timer.interval) {
    clearInterval(Timer.interval);
    Timer.running = false;
  }

  // page enter animation
  view.classList.remove("view-enter");
  void view.offsetWidth;
  view.classList.add("view-enter");

  // active nav (mobile tabs + desktop sidebar)
  $all(".tab, .nav-link").forEach((t) =>
    t.classList.toggle("active", t.dataset.route === name)
  );

  if (name === "task" && param) return renderTaskDetail(param);
  if (name === "skill" && param) return renderSkillDetail(param);
  if (name === "field" && param) return renderFieldDetail(param);
  if (name === "market" && param) return renderMarketDetail(param);

  const fn = routes[name] || renderHome;
  fn();
  setTopbar(name);
}

function setTopbar(name, override) {
  const titles = {
    home: ["YOUR LEARNING OS", greeting()],
    tasks: ["IN PROGRESS", "Tasks"],
    codex: ["YOUR RECORD", "The Codex"],
    market: ["IS IT WORTH IT?", "Skill Value"],
    profile: ["ACCOUNT", "Profile"],
  };
  const [eyebrow, title] = override || titles[name] || ["KRITX", "kritX"];
  $("#topEyebrow").textContent = eyebrow;
  $("#topTitle").textContent = title;
  $("#topAction").innerHTML = `<button class="avatar" id="avatarBtn">${esc(
    initials(Store.profile.name)
  )}</button>`;
  $("#avatarBtn").addEventListener("click", () => navigate("profile"));

  // keep sidebar user in sync
  const sideName = document.getElementById("sideName");
  if (sideName) sideName.textContent = Store.profile.name || "You";
  const sideAvatar = document.getElementById("sideAvatar");
  if (sideAvatar) sideAvatar.textContent = initials(Store.profile.name);
  $all(".side-user").forEach((b) =>
    b.classList.toggle("active", name === "profile")
  );
}

function greeting() {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const nm = Store.profile.name ? ", " + Store.profile.name.split(/\s+/)[0] : "";
  return part + nm;
}

// ============================================================
//  HOME / DASHBOARD
// ============================================================

function renderHome() {
  const p = Store.profile;
  const active = p.tasks.filter((t) => t.status === "active");
  const paused = p.tasks.filter((t) => t.status === "paused");
  const totalHours = Store.totalHours();
  const streak = Store.currentStreak();

  const view = $("#view");
  view.innerHTML = `
    <div class="stat-grid">
      ${statCard(streak, "day streak", streak > 0 ? "🔥" : "·")}
      ${statCard(active.length, "active tasks", "▤")}
      ${statCard(p.skills.length, "codex entries", "📖")}
      ${statCard(fmtHours(totalHours), "hours invested", "⏱")}
    </div>

    ${motivationBanner()}

    <div class="dash-cols">
      <div class="dash-col">
        <div class="section-head">
          <p class="section-label">In progress</p>
          ${active.length ? `<button class="link-btn" data-go="tasks">See all</button>` : ""}
        </div>
        <div class="card-list" id="homeActive">
          ${
            active.length
              ? active.slice(0, 4).map(taskCard).join("")
              : emptyBox("Nothing in progress yet.", "Start your first task", "new")
          }
        </div>
        ${
          paused.length
            ? `<div class="section-head"><p class="section-label">Paused</p></div>
               <div class="card-list">${paused.map(taskCard).join("")}</div>`
            : ""
        }
      </div>

      <div class="dash-col">
        <div class="panel">
          <div class="section-head"><p class="section-label">Activity — last 12 weeks</p></div>
          ${heatmap()}
        </div>
        <div class="panel">
          <div class="section-head"><p class="section-label">Hours per week</p></div>
          ${weeklyChart()}
        </div>
      </div>
    </div>
  `;

  bindTaskCards(view);
  $all("[data-go]", view).forEach((b) =>
    b.addEventListener("click", () => navigate(b.dataset.go))
  );
  $all("[data-empty-action]", view).forEach((b) =>
    b.addEventListener("click", () => navigate(b.dataset.emptyAction))
  );
}

function statCard(num, label, icon) {
  return `
    <div class="stat-card">
      <div class="stat-ico">${icon}</div>
      <div class="stat-num">${num}</div>
      <div class="stat-label">${label}</div>
    </div>`;
}

function motivationBanner() {
  const p = Store.profile;
  const active = p.tasks.filter((t) => t.status === "active");
  if (!active.length) {
    return `<div class="banner banner-quiet">Every skill you finish becomes a permanent entry you can revisit — and money you could make. Add a task to begin.</div>`;
  }
  // find the highest-value active task by market lookup
  let top = null;
  let topScore = -1;
  for (const t of active) {
    const m = Market.lookup({ title: t.title, category: t.category, tags: t.tags });
    const score = { hot: 3, rising: 2, volatile: 2, stable: 1, cooling: 0 }[m.trend] || 0;
    if (score > topScore) {
      topScore = score;
      top = { t, m };
    }
  }
  if (!top) return "";
  const meta = Market.trendMeta(top.m.trend);
  return `
    <div class="banner">
      <div class="banner-tag" style="color:${meta.color}">${meta.icon} ${meta.label} skill</div>
      <p class="banner-text">Keep going on <b>${esc(top.t.title)}</b> — ${esc(
        top.m.name
      )} is in <b>${esc(top.m.demand)}</b> demand right now (mid-level ${esc(
        top.m.salary.mid
      )}).</p>
      <button class="link-btn" data-market-title="${esc(top.t.title)}" data-market-cat="${esc(
        top.t.category
      )}">Why this is worth it →</button>
    </div>`;
}

function heatmap() {
  const days = Store.activityByDay();
  const cells = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 83); // 12 weeks
  // align to Sunday
  start.setDate(start.getDate() - start.getDay());
  for (let i = 0; i < 84; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const mins = days[key] || 0;
    let lvl = 0;
    if (mins > 0) lvl = 1;
    if (mins >= 60) lvl = 2;
    if (mins >= 120) lvl = 3;
    if (mins >= 240) lvl = 4;
    cells.push(
      `<div class="hm-cell hm-${lvl}" title="${key}: ${Math.round(mins)} min"></div>`
    );
  }
  return `<div class="heatmap">${cells.join("")}</div>`;
}

function weeklyChart() {
  const weeks = Store.hoursLastNWeeks(8);
  const max = Math.max(1, ...weeks.map((w) => w.hours));
  return `
    <div class="bars">
      ${weeks
        .map(
          (w) => `
        <div class="bar-col">
          <div class="bar-track"><div class="bar-fill" style="height:${
            (w.hours / max) * 100
          }%"></div></div>
          <div class="bar-val">${w.hours || ""}</div>
          <div class="bar-lbl">${w.label}</div>
        </div>`
        )
        .join("")}
    </div>`;
}

// ============================================================
//  TASKS
// ============================================================

function renderTasks() {
  const p = Store.profile;
  const active = p.tasks.filter((t) => t.status === "active");
  const paused = p.tasks.filter((t) => t.status === "paused");
  const done = p.tasks.filter((t) => t.status === "completed");
  const view = $("#view");

  if (!p.tasks.length) {
    view.innerHTML = emptyBox(
      "No tasks yet. Turn something you want to learn into a task with a real goal.",
      "+ New task",
      "new"
    );
    $("[data-empty-action]", view).addEventListener("click", () => navigate("new"));
    return;
  }

  view.innerHTML = `
    <button class="btn btn-primary btn-block" id="newTaskTop">+ New task</button>
    ${section("Active", active, taskCard)}
    ${section("Paused", paused, taskCard)}
    ${
      done.length
        ? `<p class="section-label" style="margin-top:20px">Completed (${done.length})</p>
           <div class="card-list">${done.map(doneTaskCard).join("")}</div>`
        : ""
    }
  `;
  $("#newTaskTop").addEventListener("click", () => navigate("new"));
  bindTaskCards(view);
}

function section(label, items, cardFn) {
  if (!items.length) return "";
  return `<p class="section-label" style="margin-top:18px">${label} (${items.length})</p>
    <div class="card-list">${items.map(cardFn).join("")}</div>`;
}

function taskCard(t) {
  const pct =
    t.goalHours > 0 ? Math.min(100, Math.round((t.loggedHours / t.goalHours) * 100)) : 0;
  const pri = PRIORITY[t.priority] || PRIORITY.medium;
  const studied = Store.studiedToday(t);
  const scheduled = Store.isScheduledToday(t);
  const showStart = t.status === "active";
  const evo = t.evolvesFrom ? Store.getSkill(t.evolvesFrom) : null;
  return `
    <div class="task-card interactive" data-open="${t.id}">
      <div class="task-head">
        <div class="chip-row">
          <span class="chip">${esc(t.category)}</span>
          <span class="chip ${pri.cls}">${pri.label}</span>
          ${t.weekdays.length ? `<span class="chip chip-habit">🔁 ${
            t.weekdays.length
          }×/wk${t.streak.count ? " · " + t.streak.count + "d" : ""}</span>` : ""}
          ${t.status === "paused" ? `<span class="chip chip-paused">⏸ paused</span>` : ""}
          ${evo ? `<span class="chip chip-evo">↑ from №${String(evo.entryNumber).padStart(3, "0")}</span>` : ""}
        </div>
        <span class="diff">${difDots(t.difficulty)}</span>
      </div>
      <h3 class="task-title">${esc(t.title)}</h3>
      <div class="task-meta">${
        t.dueDate ? `🎯 by ${fmtDate(t.dueDate)} · ${dueLabel(t.dueDate)}` : "No deadline"
      } · ${fmtHours(t.loggedHours)}h / ${t.goalHours || "?"}h</div>
      <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
      ${
        showStart
          ? `<div class="card-foot">
        ${
          studied
            ? `<span class="studied-tag">✓ studied today</span>`
            : scheduled
            ? `<span class="sched-tag">● today's a study day</span>`
            : `<span class="muted small">not scheduled today</span>`
        }
        <button class="btn btn-teal btn-sm" data-start="${t.id}">${
              studied ? "Edit today" : "Save today"
            }</button>
      </div>`
          : ""
      }
    </div>`;
}

function doneTaskCard(t) {
  return `
    <div class="task-card done">
      <div class="chip-row"><span class="chip">${esc(t.category)}</span></div>
      <h3 class="task-title">${esc(t.title)}</h3>
      <div class="task-meta">✓ Completed ${esc(t.completedAt)} · ${fmtHours(
    t.loggedHours
  )}h logged</div>
    </div>`;
}

function bindTaskCards(root) {
  $all("[data-open]", root).forEach((c) =>
    c.addEventListener("click", () => (location.hash = "#/task/" + c.dataset.open))
  );
  $all("[data-start]", root).forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      openDailyModal(b.dataset.start);
    })
  );
  $all("[data-market-title]", root).forEach((b) =>
    b.addEventListener("click", () =>
      openWorthModal({ title: b.dataset.marketTitle, category: b.dataset.marketCat })
    )
  );
}

// ---------- task detail ----------

function renderTaskDetail(id) {
  const t = Store.getTask(id);
  const view = $("#view");
  if (!t) {
    view.innerHTML = emptyBox("That task no longer exists.", "Back to tasks", "tasks");
    $("[data-empty-action]", view).addEventListener("click", () => navigate("tasks"));
    setTopbar("tasks");
    return;
  }
  setTopbar("tasks", ["TASK", t.title]);

  const pct =
    t.goalHours > 0 ? Math.min(100, Math.round((t.loggedHours / t.goalHours) * 100)) : 0;
  const m = Market.lookup({ title: t.title, category: t.category, tags: t.tags });
  const meta = Market.trendMeta(m.trend);
  const pri = PRIORITY[t.priority] || PRIORITY.medium;
  const studied = Store.studiedToday(t);
  const scheduled = Store.isScheduledToday(t);
  const evo = t.evolvesFrom ? Store.getSkill(t.evolvesFrom) : null;

  view.innerHTML = `
    <button class="back-btn" data-back>← Tasks</button>

    <div class="detail-head reveal">
      <div class="detail-head-top">
        <div class="chip-row">
          <span class="chip">${esc(t.category)}</span>
          <span class="chip ${pri.cls}">${pri.label}</span>
          <span class="chip">${difDots(t.difficulty)} difficulty</span>
        </div>
        <button class="btn btn-ghost btn-sm" id="editTaskBtn" type="button">✎ Edit task</button>
      </div>
      <h2 class="detail-title">${esc(t.title)}</h2>
      ${(t.tags || []).length ? `<div class="tag-row">${t.tags
        .map((x) => `<span class="tag">#${esc(x)}</span>`)
        .join("")}</div>` : ""}
      ${
        evo
          ? `<div class="evo-note">↑ Continues from <a href="#/skill/${evo.id}">№${String(
              evo.entryNumber
            ).padStart(3, "0")} · ${esc(evo.name)}</a></div>`
          : ""
      }
      <div class="detail-meta">${
        t.dueDate
          ? `🎯 Finish by <b>${esc(fmtDate(t.dueDate))}</b> (${dueLabel(t.dueDate)})`
          : "No deadline set"
      } · goal ${t.goalHours || "?"}h · 🔁 ${esc(weekdayShort(t.weekdays))}</div>
      <div class="progress big"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="detail-meta">${fmtHours(t.loggedHours)}h done (${pct}%)</div>
    </div>

    ${
      t.status === "active"
        ? `<button class="btn btn-primary btn-block start-today-big" id="startTodayBtn">${
            studied ? "📝 Edit today's work" : "📝 Save today's work"
          }</button>
           <p class="start-hint">${
             studied
               ? "You've logged study for today. Nice."
               : scheduled
               ? "Today is a scheduled study day — log where you're learning from."
               : "Not a scheduled day, but you can still study and log it."
           }</p>`
        : ""
    }

    <!-- timeline calendar -->
    <div class="section-head"><p class="section-label">Timeline</p></div>
    ${taskCalendar(t)}

    <!-- timer -->
    <div class="section-head"><p class="section-label">Focus timer</p></div>
    <div class="timer-card">
      <div class="timer-display" id="timerDisplay">00:00</div>
      <div class="timer-actions">
        <button class="btn btn-teal" id="timerToggle">▶ Start</button>
        <button class="btn btn-ghost" id="timerLog">Log time</button>
        <button class="btn btn-ghost" id="manualLog">+ Manual</button>
      </div>
      <p class="timer-hint">Start the timer while you work — hours log themselves into today.</p>
    </div>

    <!-- worth it -->
    <div class="worth-card" data-worth>
      <div class="worth-top">
        <span class="worth-badge" style="background:${meta.color}22;color:${meta.color}">${
    meta.icon
  } ${meta.label}</span>
        <span class="worth-demand">${esc(m.demand)} demand</span>
      </div>
      <p class="worth-money">💰 Mid-level: <b>${esc(m.salary.mid)}</b> · Freelance ${esc(
    m.freelance
  )}</p>
      <p class="worth-why">${esc(m.why)}</p>
      <button class="link-btn">See full money potential →</button>
    </div>

    <!-- daily study log -->
    <div class="section-head">
      <p class="section-label">Daily study log</p>
      ${
        t.status === "active"
          ? `<button class="link-btn" type="button" id="logTodayBtn">+ Log today</button>`
          : ""
      }
    </div>
    <div class="card-list" id="dailyLogList">
      ${
        t.dailyLogs && t.dailyLogs.length
          ? [...t.dailyLogs]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((l) => dailyLogRow(l, t.id))
              .join("")
          : `<p class="muted">Nothing logged yet. Tap <b>Save today's work</b> below to record what you studied.</p>`
      }
    </div>

    <div class="task-dock" id="taskDock">
      ${
        t.status === "active"
          ? `<button class="btn btn-teal" type="button" id="dockSave">📝 Save today's work</button>`
          : ""
      }
      <button class="btn btn-primary" type="button" id="dockComplete">📖 Complete → Codex</button>
      <button class="btn btn-ghost" type="button" id="dockEdit">✎ Edit</button>
    </div>

    <div class="detail-footer">
      <button class="btn btn-primary btn-block" id="completeBtn">✓ Complete & add to Codex</button>
      <div class="footer-row">
        <button class="btn btn-ghost" id="pauseBtn">${
          t.status === "paused" ? "Resume" : "⏸ Pause"
        }</button>
        <button class="btn btn-danger-ghost" id="deleteBtn">Delete</button>
      </div>
    </div>
  `;

  $("[data-back]", view).addEventListener("click", () => navigate("tasks"));
  $("[data-worth]", view).addEventListener("click", () =>
    openWorthModal({ title: t.title, category: t.category, tags: t.tags })
  );

  const startBtn = $("#startTodayBtn");
  if (startBtn) startBtn.addEventListener("click", () => openDailyModal(t.id));

  $("#editTaskBtn").addEventListener("click", () => openEditTaskModal(t.id));
  $("#dockEdit").addEventListener("click", () => openEditTaskModal(t.id));
  const dockSave = $("#dockSave");
  if (dockSave) dockSave.addEventListener("click", () => openDailyModal(t.id));
  const logTodayBtn = $("#logTodayBtn");
  if (logTodayBtn) logTodayBtn.addEventListener("click", () => openDailyModal(t.id));
  $("#dockComplete").addEventListener("click", () => openCompleteModal(t.id));

  $all("[data-edit-log]", view).forEach((row) =>
    row.addEventListener("click", () =>
      openDailyModal(t.id, row.dataset.editLog)
    )
  );

  // timer
  setupTimer(t.id);

  $("#completeBtn").addEventListener("click", () => openCompleteModal(t.id));
  $("#pauseBtn").addEventListener("click", () => {
    if (t.status !== "paused") {
      openPauseModal(t.id);
    } else {
      Store.pauseTask(t.id);
      renderTaskDetail(id);
    }
  });
  $("#deleteBtn").addEventListener("click", () => {
    openConfirm("Delete this task?", "This can't be undone.", () => {
      Store.deleteTask(t.id);
      navigate("tasks");
    });
  });
}

function dailyLogRow(l, taskId) {
  const srcs =
    l.sources && l.sources.length
      ? `<div class="log-sources">${l.sources
          .map((s) => {
            const label = [s.type, s.title].filter(Boolean).join(" · ") || "Source";
            return s.url
              ? `<a class="log-src" href="${esc(s.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">📖 ${esc(
                  label
                )} ↗</a>`
              : `<span class="log-src">📖 ${esc(label)}</span>`;
          })
          .join("")}</div>`
      : "";
  const today = todayStr();
  const isToday = l.date === today;
  return `<button type="button" class="session-row log-row${isToday ? " log-today" : ""}" data-edit-log="${esc(
    l.id
  )}" title="Tap to edit">
    <div class="log-head"><b>${esc(fmtDate(l.date))}</b>${
    l.minutes ? ` · ${fmtHours(l.minutes / 60)}h` : ""
  }${isToday ? ` <span class="studied-tag">today</span>` : ""}<span class="log-edit-hint">✎ edit</span></div>
    ${srcs || `<div class="muted small">No sources — tap to add</div>`}
    ${l.note ? `<div class="muted small">${esc(l.note)}</div>` : ""}
  </button>`;
}

function taskCalendar(t) {
  const start = new Date(t.createdAt + "T00:00:00");
  const end = t.dueDate
    ? new Date(t.dueDate + "T00:00:00")
    : new Date(start.getTime() + 13 * 86400000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);

  const activity = {};
  (t.dailyLogs || []).forEach((l) => (activity[l.date] = l.minutes || 0));

  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  let cells = "";
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const inRange = d >= start && d <= end;
    const cls = ["cal-cell"];
    if (!inRange) cls.push("cal-out");
    if (inRange && t.weekdays.length && t.weekdays.includes(d.getDay()))
      cls.push("cal-sched");
    if (activity[key] > 0) cls.push("cal-done");
    if (key === todayKey) cls.push("cal-today");
    if (t.dueDate && key === t.dueDate) cls.push("cal-due");
    cells += `<div class="${cls.join(" ")}">${d.getDate()}</div>`;
  }
  const hdr = ["S", "M", "T", "W", "T", "F", "S"]
    .map((x) => `<div class="cal-h">${x}</div>`)
    .join("");
  return `
    <div class="calendar">${hdr}${cells}</div>
    <div class="cal-legend">
      <span><i class="lg lg-sched"></i>study day</span>
      <span><i class="lg lg-done"></i>studied</span>
      <span><i class="lg lg-due"></i>deadline</span>
      <span><i class="lg lg-today"></i>today</span>
    </div>`;
}

// ---------- timer ----------

const Timer = { taskId: null, running: false, seconds: 0, interval: null };

function setupTimer(taskId) {
  Timer.taskId = taskId;
  Timer.running = false;
  Timer.seconds = 0;
  clearInterval(Timer.interval);
  updateTimerDisplay();

  $("#timerToggle").addEventListener("click", () => {
    Timer.running = !Timer.running;
    $("#timerToggle").textContent = Timer.running ? "⏸ Pause" : "▶ Start";
    if (Timer.running) {
      Timer.interval = setInterval(() => {
        Timer.seconds++;
        updateTimerDisplay();
      }, 1000);
    } else {
      clearInterval(Timer.interval);
    }
  });

  $("#timerLog").addEventListener("click", () => {
    if (Timer.seconds < 1) {
      toast("Timer hasn't run yet.");
      return;
    }
    const mins = Math.max(1, Math.round(Timer.seconds / 60));
    Store.logSession(taskId, mins, "Timed session");
    toast(`Logged ${mins} min`);
    renderTaskDetail(taskId);
  });

  $("#manualLog").addEventListener("click", () => openLogModal(taskId));
}

function updateTimerDisplay() {
  const el = $("#timerDisplay");
  if (!el) return;
  const m = Math.floor(Timer.seconds / 60);
  const s = Timer.seconds % 60;
  el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ============================================================
//  CODEX (completed skills)
// ============================================================

function renderCodex() {
  const p = Store.profile;
  const view = $("#view");
  if (!p.skills.length) {
    view.innerHTML = emptyBox(
      "Your Codex is empty. Complete a task and it becomes a permanent, dated entry here — with where the knowledge came from.",
      "Go to tasks",
      "tasks"
    );
    $("[data-empty-action]", view).addEventListener("click", () => navigate("tasks"));
    return;
  }
  const sorted = [...p.skills].sort((a, b) => b.entryNumber - a.entryNumber);
  view.innerHTML = `
    <div class="codex-intro">A permanent record of everything you've learned — ${p.skills.length} ${
    p.skills.length === 1 ? "entry" : "entries"
  }, ${fmtHours(Store.totalHours())} hours.</div>
    <div class="card-list">
      ${sorted.map(codexCard).join("")}
    </div>`;
  $all("[data-skill]", view).forEach((c) =>
    c.addEventListener("click", () => (location.hash = "#/skill/" + c.dataset.skill))
  );
  $all("[data-continue]", view).forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const skill = Store.getSkill(b.dataset.continue);
      if (skill) openContinueFromCodex(skill);
    })
  );
}

function codexCard(s) {
  return `
    <div class="entry-card interactive" data-skill="${s.id}">
      <p class="entry-eyebrow">ENTRY №${String(s.entryNumber).padStart(3, "0")} · ${esc(
    s.completedAt
  )}</p>
      <h3 class="entry-title">${esc(s.name)}</h3>
      <div class="entry-meta">
        <span class="chip">${esc(s.category)}</span>
        <span>${fmtHours(s.hoursSpent)}h</span>
        <span>${"★".repeat(s.mastery)}${"☆".repeat(5 - s.mastery)}</span>
      </div>
      ${
        s.revisits.length
          ? `<div class="entry-revisits">↻ revisited ${s.revisits.length}×</div>`
          : ""
      }
      <div class="entry-card-actions">
        <button class="btn btn-teal btn-sm" data-continue="${s.id}">↗ Continue</button>
      </div>
    </div>`;
}

function renderSkillDetail(id) {
  const s = Store.getSkill(id);
  const view = $("#view");
  if (!s) {
    view.innerHTML = emptyBox("That entry no longer exists.", "Back to Codex", "codex");
    $("[data-empty-action]", view).addEventListener("click", () => navigate("codex"));
    setTopbar("codex");
    return;
  }
  setTopbar("codex", ["ENTRY №" + String(s.entryNumber).padStart(3, "0"), s.name]);
  const m = Market.lookup({ title: s.name, category: s.category, tags: s.tags });
  const meta = Market.trendMeta(m.trend);
  const evo = s.evolvesFrom ? Store.getSkill(s.evolvesFrom) : null;
  const next = Store.nextPathSkill(s);
  const pva = s.plannedVsActual;

  view.innerHTML = `
    <button class="back-btn" data-back>← Codex</button>
    <div class="detail-head reveal">
      <p class="entry-eyebrow">ENTRY №${String(s.entryNumber).padStart(3, "0")} · ${esc(
    s.completedAt
  )}</p>
      <h2 class="detail-title">${esc(s.name)}</h2>
      <div class="chip-row">
        <span class="chip">${esc(s.category)}</span>
        <span class="chip">${fmtHours(s.hoursSpent)}h invested</span>
        <span class="chip">${"★".repeat(s.mastery)}${"☆".repeat(
    5 - s.mastery
  )} mastery</span>
      </div>
      ${evo ? `<div class="evo-note">↑ Evolved from <b>${esc(evo.name)}</b> (№${
    evo.entryNumber
  })</div>` : ""}
    </div>

    <button class="btn btn-primary btn-block continue-btn" id="continueBtn">↗ Continue learning</button>
    ${
      next
        ? `<p class="continue-hint">Next on <b>${esc(next.field.name)}</b> path: ${esc(
            next.skill
          )}</p>`
        : `<p class="continue-hint">Start an advanced version of this skill as a new task.</p>`
    }

    ${
      pva
        ? `<div class="section-head"><p class="section-label">Planned vs actual</p></div>
           <div class="pva-grid">
             <div class="pva-cell"><div class="pva-lbl">Days</div><div class="pva-val">${
               pva.goalDays || "—"
             } → <b>${pva.actualDays || "—"}</b></div></div>
             <div class="pva-cell"><div class="pva-lbl">Hours</div><div class="pva-val">${
               pva.goalHours || "—"
             } → <b>${fmtHours(pva.actualHours || 0)}</b></div></div>
             <div class="pva-cell"><div class="pva-lbl">Study days</div><div class="pva-val"><b>${
               pva.studyDays || 0
             }</b></div></div>
           </div>`
        : ""
    }

    ${
      s.sources && s.sources.length
        ? `<div class="section-head"><p class="section-label">Where it came from</p></div>
           <div class="card-list">${s.sources.map(sourceRow).join("")}</div>`
        : ""
    }

    ${
      s.reflection
        ? `<div class="section-head"><p class="section-label">Reflection</p></div><div class="note-box">${esc(
            s.reflection
          )}</div>`
        : ""
    }
    ${
      s.whatDifferently
        ? `<div class="section-head"><p class="section-label">What I'd do differently</p></div><div class="note-box">${esc(
            s.whatDifferently
          )}</div>`
        : ""
    }

    <div class="worth-card" data-worth>
      <div class="worth-top">
        <span class="worth-badge" style="background:${meta.color}22;color:${meta.color}">${
    meta.icon
  } ${meta.label}</span>
        <span class="worth-demand">${esc(m.demand)} demand</span>
      </div>
      <p class="worth-money">💰 This skill is worth <b>${esc(m.salary.mid)}</b> mid-level</p>
      <button class="link-btn">See money potential →</button>
    </div>

    <div class="section-head"><p class="section-label">Revisit log (${
      s.revisits.length
    })</p></div>
    <div class="card-list">
      ${
        s.revisits.length
          ? [...s.revisits]
              .reverse()
              .map(
                (r) =>
                  `<div class="session-row"><b>${esc(r.date)}</b> ${
                    r.mastery ? "· " + "★".repeat(r.mastery) : ""
                  } ${r.note ? "— " + esc(r.note) : ""}</div>`
              )
              .join("")
          : `<p class="muted">Not revisited yet. Come back when you brush up on this.</p>`
      }
    </div>

    <div class="detail-footer">
      <button class="btn btn-primary btn-block" id="revisitBtn">↻ Log a revisit</button>
      <div class="footer-row">
        <button class="btn btn-ghost" id="cardBtn">Export skill card</button>
        <button class="btn btn-danger-ghost" id="delSkillBtn">Delete entry</button>
      </div>
    </div>
  `;

  $("[data-back]", view).addEventListener("click", () => navigate("codex"));
  $("[data-worth]", view).addEventListener("click", () =>
    openWorthModal({ title: s.name, category: s.category, tags: s.tags })
  );
  $("#continueBtn").addEventListener("click", () => openContinueFromCodex(s));
  $("#revisitBtn").addEventListener("click", () => openRevisitModal(s.id));
  $("#cardBtn").addEventListener("click", () => exportSkillCard(s));
  $("#delSkillBtn").addEventListener("click", () =>
    openConfirm("Delete this entry?", "This removes it from your Codex permanently.", () => {
      Store.deleteSkill(s.id);
      navigate("codex");
    })
  );
}

function sourceRow(src) {
  const parts = [src.type, src.title].filter(Boolean).join(" — ");
  return `<div class="source-row">
    <div>${esc(parts) || "Source"}</div>
    ${src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">open ↗</a>` : ""}
    ${src.note ? `<div class="muted small">${esc(src.note)}</div>` : ""}
  </div>`;
}

// ============================================================
//  MARKET / WORTH IT  (+ live real-time signals)
// ============================================================

// Turn a skill/field label into a good live-search query.
function liveQuery(label) {
  let q = (label || "").toLowerCase();
  q = q.replace(/\(.*?\)/g, " ");
  q = q.replace(/\b(fundamentals|basics|advanced|intro|introduction|concepts|the)\b/g, " ");
  q = q.split(/[\/,&]| or /)[0];
  q = q.replace(/[^a-z0-9+.# ]/g, " ").replace(/\s+/g, " ").trim();
  return q || (label || "").trim();
}

function liveBadgeHtml(sig) {
  if (!sig || !sig.live || !sig.trend) return "";
  const meta = Market.trendMeta(sig.trend);
  const mom =
    sig.momentum != null && Math.abs(sig.momentum) >= 10
      ? ` ${sig.momentum > 0 ? "+" : ""}${sig.momentum}%`
      : "";
  return `<span class="live-badge" style="color:${meta.color}"><i class="live-dot"></i>LIVE ${meta.icon} ${meta.label}${mom}</span>`;
}

// Fill any [data-live] slots asynchronously (cache-first, then refresh).
function enhanceLive(root) {
  $all("[data-live]", root).forEach((el) => {
    const q = el.dataset.live;
    if (!q) return;
    const c = Live.cached(q);
    if (c && c.trend) el.innerHTML = liveBadgeHtml(c);
    Live.trend(q).then((sig) => {
      if (el.isConnected) el.innerHTML = liveBadgeHtml(sig);
    });
  });
}

function renderMarket() {
  const view = $("#view");
  const list = Market.all();
  const fields = Market.fields();
  const st = Market.status();
  view.innerHTML = `
    <p class="market-intro">Pick a field you're interested in to see the real <b>opportunities</b> inside it and a step-by-step <b>path of skills</b> to learn — then add any of them to your tasks in one tap.</p>

    <div class="section-head"><p class="section-label">Explore by field</p></div>
    <div class="field-grid">
      ${fields
        .map((f) => {
          const meta = Market.trendMeta(f.trend);
          const prog = Store.pathProgress(f);
          return `<button class="field-card interactive" data-field="${esc(f.id)}">
            <span class="field-ico">${f.icon}</span>
            <span class="field-name">${esc(f.name)}</span>
            <span class="field-trend" style="color:${meta.color}">${meta.icon} ${
            meta.label
          }</span>
            ${
              prog.done || prog.active
                ? `<span class="field-prog">${prog.done}/${prog.total} path · ${Math.round(
                    (prog.done / prog.total) * 100
                  )}%</span>`
                : ""
            }
            <span class="live-slot" data-live="${esc(liveQuery(f.name))}"></span>
          </button>`;
        })
        .join("")}
    </div>

    <div class="section-head"><p class="section-label">Or browse skills by pay</p></div>
    <div class="search-wrap">
      <input type="text" id="marketSearch" placeholder="Search a skill… (e.g. AI, design, editing)">
    </div>
    <div class="card-list" id="marketList">
      ${list.map((m, i) => marketRow(m, i)).join("")}
    </div>

    <p class="market-source">${
      st.source === "online"
        ? "🟢 Market data updated live"
        : st.source === "cached"
        ? "🟡 Showing last synced market data"
        : "⚪ Offline market data (bundled)"
    }${st.updated ? " · " + fmtDate(st.updated.slice(0, 10)) : ""}</p>
  `;

  $all("[data-field]", view).forEach((c) =>
    c.addEventListener("click", () => (location.hash = "#/field/" + c.dataset.field))
  );

  const render = (items) => {
    $("#marketList").innerHTML = items.length
      ? items.map((m) => marketRow(m, Market.all().indexOf(m))).join("")
      : `<p class="muted">No matches. Try another word.</p>`;
    bindMarketRows(view);
    enhanceLive($("#marketList"));
  };
  bindMarketRows(view);
  enhanceLive(view);
  $("#marketSearch").addEventListener("input", (e) =>
    render(Market.search(e.target.value))
  );
}

function renderFieldDetail(id) {
  const f = Market.field(id);
  const view = $("#view");
  if (!f) {
    navigate("market");
    return;
  }
  const meta = Market.trendMeta(f.trend);
  const prog = Store.pathProgress(f);
  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
  setTopbar("market", [f.icon + " FIELD", f.name]);
  view.innerHTML = `
    <button class="back-btn" data-back>← Skill Value</button>
    <div class="detail-head reveal">
      <span class="worth-badge big" style="background:${meta.color}22;color:${meta.color}">${
    meta.icon
  } ${meta.label} field</span>
      <span class="live-slot" data-live="${esc(liveQuery(f.name))}"></span>
      <h2 class="detail-title">${f.icon} ${esc(f.name)}</h2>
    </div>

    <div class="why-box">${esc(f.blurb)}</div>

    <div class="path-progress-card">
      <div class="pp-top">
        <div>
          <div class="pp-title">Your path progress</div>
          <div class="pp-sub">${prog.done} done · ${prog.active} in progress · ${
    prog.total - prog.done - prog.active
  } remaining</div>
        </div>
        <div class="pp-pct">${pct}%</div>
      </div>
      <div class="progress big"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="pp-dots">
        ${prog.steps
          .map(
            (s) =>
              `<span class="pp-dot ${s.status}" title="${esc(s.skill)}"></span>`
          )
          .join("")}
      </div>
    </div>

    <div class="section-head"><p class="section-label">Opportunities in this field</p></div>
    <div class="card-list">
      ${f.opportunities
        .map(
          (o) => `<div class="opp-card">
        <div class="opp-top"><span class="opp-role">${esc(o.role)}</span><span class="opp-pay">${esc(
            o.pay
          )}</span></div>
        <div class="opp-note">${esc(o.note)}</div>
      </div>`
        )
        .join("")}
    </div>

    <div class="section-head"><p class="section-label">Skills to learn — your path</p></div>
    <p class="muted small" style="margin:-4px 0 12px">Matched against your Codex & active tasks. Tap <b>+ Add</b> for anything still open.</p>
    <div class="path-list">
      ${prog.steps
        .map(
          (s, i) => `<div class="path-step ${s.status}">
        <div class="path-num ${s.status}">${
          s.status === "done" ? "✓" : s.status === "active" ? "●" : i + 1
        }</div>
        <div class="path-body">
          <div class="path-skill">${esc(s.skill)}
            <span class="path-status-chip ${s.status}">${
              s.status === "done"
                ? "In Codex" + (s.skill ? ` №${String(s.skill.entryNumber).padStart(3, "0")}` : "")
                : s.status === "active"
                ? "In progress"
                : "Not started"
            }</span>
            <span class="live-slot" data-live="${esc(liveQuery(s.skill))}"></span>
          </div>
          <div class="path-why">${esc(s.why)}</div>
        </div>
        ${
          s.status === "todo"
            ? `<button class="btn btn-teal btn-sm path-add" data-skill="${esc(
                s.skill
              )}" data-cat="${esc(s.category)}">+ Add</button>`
            : s.status === "done" && s.skill
            ? `<button class="btn btn-ghost btn-sm" data-open-skill="${s.skill.id}">View</button>`
            : s.status === "active" && s.task
            ? `<button class="btn btn-ghost btn-sm" data-open-task="${s.task.id}">Open</button>`
            : ""
        }
      </div>`
        )
        .join("")}
    </div>

    <button class="btn btn-primary btn-block" id="addAllBtn" style="margin-top:16px">+ Add remaining as tasks</button>
    <div class="disclaimer">Opportunities & pay are illustrative estimates for direction, refreshed from an online source when available.</div>
  `;

  $("[data-back]", view).addEventListener("click", () => navigate("market"));
  enhanceLive(view);
  $all(".path-add", view).forEach((b) =>
    b.addEventListener("click", () =>
      openNewTaskModal({ title: b.dataset.skill, category: b.dataset.cat })
    )
  );
  $all("[data-open-skill]", view).forEach((b) =>
    b.addEventListener("click", () => (location.hash = "#/skill/" + b.dataset.openSkill))
  );
  $all("[data-open-task]", view).forEach((b) =>
    b.addEventListener("click", () => (location.hash = "#/task/" + b.dataset.openTask))
  );
  $("#addAllBtn").addEventListener("click", () => {
    const remaining = prog.steps.filter((s) => s.status === "todo");
    if (!remaining.length) {
      toast("You've already covered this path");
      return;
    }
    openConfirm(
      `Add ${remaining.length} remaining skills?`,
      `Creates tasks for the steps you haven't started yet in "${f.name}".`,
      () => {
        remaining.forEach((s) =>
          Store.addTask({ title: s.skill, category: s.category, weekdays: [] })
        );
        toast(`Added ${remaining.length} tasks`);
        navigate("tasks");
      }
    );
  });
}

function marketRow(m, i) {
  const meta = Market.trendMeta(m.trend);
  return `
    <div class="market-card" data-market="${i}">
      <div class="market-top">
        <h3 class="market-name">${esc(m.name)}</h3>
        <span class="worth-badge" style="background:${meta.color}22;color:${meta.color}">${
    meta.icon
  } ${meta.label}</span>
      </div>
      <div class="market-meta"><span class="chip">${esc(m.category)}</span> · ${esc(
    m.demand
  )} demand <span class="live-slot" data-live="${esc(liveQuery(m.name))}"></span></div>
      <p class="market-money">💰 ${esc(m.salary.mid)} <span class="muted">mid · ${esc(
    m.freelance
  )} freelance</span></p>
    </div>`;
}

function bindMarketRows(root) {
  $all("[data-market]", root).forEach((c) =>
    c.addEventListener("click", () => (location.hash = "#/market/" + c.dataset.market))
  );
}

function renderMarketDetail(index) {
  const m = Market.all()[Number(index)];
  const view = $("#view");
  if (!m) {
    navigate("market");
    return;
  }
  setTopbar("market", ["SKILL VALUE", m.name]);
  const meta = Market.trendMeta(m.trend);
  view.innerHTML = `
    <button class="back-btn" data-back>← Skill Value</button>
    <div class="detail-head">
      <span class="worth-badge big" style="background:${meta.color}22;color:${meta.color}">${
    meta.icon
  } ${meta.label} · ${esc(m.demand)} demand</span>
      <h2 class="detail-title">${esc(m.name)}</h2>
      <span class="chip">${esc(m.category)}</span>
    </div>

    <div class="why-box">${esc(m.why)}</div>

    <div class="section-head">
      <p class="section-label">📡 Live market signals</p>
      <button class="link-btn" id="liveRefresh">Refresh</button>
    </div>
    <div class="live-panel" id="livePanel">${livePanelHtml(null)}</div>

    <div class="section-head"><p class="section-label">What it pays (curated estimate)</p></div>
    <div class="salary-grid">
      <div class="salary-cell"><div class="salary-lbl">Entry</div><div class="salary-val">${esc(
        m.salary.entry
      )}</div></div>
      <div class="salary-cell"><div class="salary-lbl">Mid</div><div class="salary-val hi">${esc(
        m.salary.mid
      )}</div></div>
      <div class="salary-cell"><div class="salary-lbl">Senior</div><div class="salary-val">${esc(
        m.salary.senior
      )}</div></div>
    </div>
    <div class="salary-extra">
      <span>🌍 ${esc(m.salaryInr)}</span>
      <span>💻 Freelance: ${esc(m.freelance)}</span>
    </div>

    <div class="section-head"><p class="section-label">Ways to make money from it</p></div>
    <div class="monetize-list">
      ${m.monetize.map((x) => `<div class="monetize-row">→ ${esc(x)}</div>`).join("")}
    </div>

    <div class="disclaimer">Figures are rough, motivational estimates for direction — not financial advice. Real pay varies by country, company, and level.</div>

    <button class="btn btn-primary btn-block" id="turnIntoTask">+ Turn this into a task</button>
  `;
  $("[data-back]", view).addEventListener("click", () => navigate("market"));
  $("#turnIntoTask").addEventListener("click", () =>
    openNewTaskModal({ title: m.name, category: m.category })
  );

  // load live market signals
  const q = liveQuery(m.name);
  const panel = $("#livePanel");
  const loadLive = (force) => {
    const cachedSig = Live.cached(q);
    if (cachedSig) panel.innerHTML = livePanelHtml(cachedSig);
    else panel.innerHTML = livePanelHtml(null);
    Live.full(q, { force }).then((sig) => {
      if (panel.isConnected) panel.innerHTML = livePanelHtml(sig);
    });
  };
  loadLive(false);
  $("#liveRefresh").addEventListener("click", () => {
    panel.innerHTML = livePanelHtml(null);
    loadLive(true);
  });
  panel.addEventListener("click", (e) => {
    if (e.target && e.target.id === "liveAdzunaHint") navigate("profile");
  });
}

function livePanelHtml(sig) {
  if (!sig) {
    return `<div class="live-loading"><span class="spinner"></span> Fetching real-time market data…</div>`;
  }
  if (!sig.live) {
    return `<div class="muted small">Couldn't reach live sources right now (offline?). The curated estimates below still apply.</div>`;
  }
  const meta = Market.trendMeta(sig.trend);
  const idx = sig.demandIndex || 0;
  const when = sig.ts ? timeAgo(sig.ts) : "";
  const cells = [];

  cells.push(
    metricCell("Live trend", `${meta.icon} ${meta.label}`, meta.color)
  );
  if (sig.momentum != null)
    cells.push(
      metricCell(
        "Hiring momentum",
        `${sig.momentum > 0 ? "+" : ""}${sig.momentum}%`,
        sig.momentum >= 0 ? "var(--teal)" : "var(--danger)",
        "vs last month"
      )
    );
  if (sig.hiringNow != null)
    cells.push(metricCell("Hiring buzz (30d)", fmtBig(sig.hiringNow), "", "HN mentions"));
  if (sig.repos != null)
    cells.push(metricCell("Projects built", fmtBig(sig.repos), "", "GitHub repos"));
  if (sig.soQuestions != null)
    cells.push(metricCell("Dev activity", fmtBig(sig.soQuestions), "", "Stack Overflow Qs"));
  if (sig.jobs != null)
    cells.push(
      metricCell("Open jobs", fmtBig(sig.jobs), "var(--gold)", "Adzuna " + (sig.adzunaCountry || "").toUpperCase())
    );
  if (sig.salaryMedian != null)
    cells.push(
      metricCell(
        "Median salary",
        liveCurrency(sig.adzunaCountry) + fmtBig(sig.salaryMedian),
        "var(--gold)",
        "real listings"
      )
    );

  return `
    <div class="demand-head">
      <div>
        <div class="demand-idx" style="color:${meta.color}">${idx}<span>/100</span></div>
        <div class="demand-lbl">Live demand index · ${esc(sig.demandLabel || "")}</div>
      </div>
      <span class="live-badge" style="color:${meta.color}"><i class="live-dot"></i>LIVE</span>
    </div>
    <div class="demand-bar"><div class="demand-fill" style="width:${idx}%;background:${meta.color}"></div></div>
    <div class="metric-grid">${cells.join("")}</div>
    <div class="live-foot">
      Real-time from GitHub · Hacker News · Stack Overflow${
        sig.jobs != null || sig.salaryMedian != null ? " · Adzuna" : ""
      }${when ? " · updated " + when : ""}
      ${
        !Live.hasAdzuna()
          ? `<br><button class="link-btn" id="liveAdzunaHint">＋ Add a free Adzuna key for real jobs & salaries →</button>`
          : ""
      }
    </div>`;
}

function metricCell(label, value, color, sub) {
  return `<div class="metric">
    <div class="metric-val"${color ? ` style="color:${color}"` : ""}>${esc(value)}</div>
    <div class="metric-lbl">${esc(label)}</div>
    ${sub ? `<div class="metric-sub">${esc(sub)}</div>` : ""}
  </div>`;
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function openWorthModal({ title, category, tags }) {
  const m = Market.lookup({ title, category, tags });
  const meta = Market.trendMeta(m.trend);
  const idx = Market.all().indexOf(
    Market.all().find((x) => x.name === m.name)
  );
  const { close } = openModal(`
    <div class="worth-top" style="margin-bottom:10px">
      <span class="worth-badge" style="background:${meta.color}22;color:${meta.color}">${
    meta.icon
  } ${meta.label}</span>
      <span class="worth-demand">${esc(m.demand)} demand</span>
    </div>
    <h2 class="modal-title">${esc(m.name)}</h2>
    <div class="why-box">${esc(m.why)}</div>
    <div class="salary-grid" style="margin-top:14px">
      <div class="salary-cell"><div class="salary-lbl">Entry</div><div class="salary-val">${esc(
        m.salary.entry
      )}</div></div>
      <div class="salary-cell"><div class="salary-lbl">Mid</div><div class="salary-val hi">${esc(
        m.salary.mid
      )}</div></div>
      <div class="salary-cell"><div class="salary-lbl">Senior</div><div class="salary-val">${esc(
        m.salary.senior
      )}</div></div>
    </div>
    <p class="salary-extra" style="margin-top:10px"><span>💻 ${esc(
      m.freelance
    )} freelance</span></p>
    <div class="monetize-list" style="margin-top:12px">
      ${m.monetize.map((x) => `<div class="monetize-row">→ ${esc(x)}</div>`).join("")}
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>Close</button>
      ${
        idx >= 0
          ? `<button class="btn btn-teal" data-full>Full page →</button>`
          : ""
      }
    </div>
  `);
  $("[data-close]").addEventListener("click", close);
  const full = $("[data-full]");
  if (full)
    full.addEventListener("click", () => {
      close();
      location.hash = "#/market/" + idx;
    });
}

// ============================================================
//  PROFILE
// ============================================================

function learnerRank(skills, hours) {
  const tiers = [
    { min: 0, name: "Newcomer" },
    { min: 1, name: "Getting Started" },
    { min: 3, name: "Building Momentum" },
    { min: 6, name: "Skilled Learner" },
    { min: 11, name: "Prolific" },
    { min: 20, name: "Master Builder" },
  ];
  let idx = 0;
  for (let i = 0; i < tiers.length; i++) if (skills >= tiers[i].min) idx = i;
  const cur = tiers[idx];
  const next = tiers[idx + 1];
  const pct = next
    ? Math.min(100, Math.round(((skills - cur.min) / (next.min - cur.min)) * 100))
    : 100;
  return {
    level: idx + 1,
    name: cur.name,
    next: next ? next.name : null,
    toNext: next ? next.min - skills : 0,
    pct,
  };
}

function topValueSkill() {
  const skills = Store.profile.skills;
  if (!skills.length) return null;
  let best = null;
  let bestScore = -1;
  const rank = { hot: 3, rising: 2, volatile: 2, stable: 1, cooling: 0 };
  for (const s of skills) {
    const m = Market.lookup({ title: s.name, category: s.category, tags: s.tags });
    const score = (rank[m.trend] || 0) * 10 + (s.hoursSpent || 0);
    if (score > bestScore) {
      bestScore = score;
      best = { s, m };
    }
  }
  return best;
}

function renderProfile() {
  const p = Store.profile;
  const view = $("#view");
  const hours = Store.totalHours();
  const rank = learnerRank(p.skills.length, hours);
  const top = topValueSkill();
  const backupInfo = Sync.username() ? Store.getLocalSaveInfo(Sync.username()) : null;
  const autoBackupLine = backupInfo
    ? `${backupInfo.tasks} tasks · ${backupInfo.skills} skills · local ${relTime(backupInfo.savedAt)}`
    : "local JSON on this device";

  view.innerHTML = `
    <div class="profile-hero">
      <div class="hero-glow"></div>
      <div class="avatar-xl">${esc(initials(p.name))}</div>
      <h2 class="hero-name">${esc(p.name || "You")}</h2>
      <div class="hero-rank">◆ Lv ${rank.level} · ${esc(rank.name)}</div>
      <p class="hero-since">${
        Sync.username()
          ? `@${esc(Sync.username())} · data lives on this device`
          : "Learning since " + esc((p.createdAt || "").slice(0, 10))
      }</p>
      <div class="hero-progress">
        <div class="hero-progress-fill" style="width:${rank.pct}%"></div>
      </div>
      <p class="hero-next">${
        rank.next
          ? `${rank.toNext} more skill${rank.toNext === 1 ? "" : "s"} to <b>${esc(
              rank.next
            )}</b>`
          : "Top rank reached 🏆"
      }</p>
    </div>

    <div class="sync-banner ${Sync.token() ? "ok" : ""}">
      ${
        Sync.token()
          ? `🟢 <b>@${esc(Sync.username())}</b> — tasks & Codex are <b>local</b> on this PC. The website only transfers the latest copy between devices${
              autoBackupLine ? ` · ${autoBackupLine}` : ""
            }.`
          : `⚪ Not signed in — log in to open your local save and transfer mailbox.`
      }
    </div>

    <div class="stat-grid">
      ${statCard(p.skills.length, "skills earned", "📖")}
      ${statCard(fmtHours(hours), "total hours", "⏱")}
      ${statCard(Store.currentStreak(), "day streak", "🔥")}
      ${statCard(
        p.tasks.filter((t) => t.status === "active").length,
        "in progress",
        "▤"
      )}
    </div>

    ${
      top
        ? `<div class="highlight-card" data-view-skill="${top.s.id}">
        <div class="hl-label">💎 Your most valuable skill</div>
        <div class="hl-name">${esc(top.s.name)}</div>
        <div class="hl-meta">${Market.trendMeta(top.m.trend).icon} ${esc(
            top.m.demand
          )} demand · worth ${esc(top.m.salary.mid)} mid-level</div>
      </div>`
        : ""
    }

    ${categoryBreakdown()}

    <div class="section-head"><p class="section-label">Display name</p></div>
    <div class="add-sub">
      <input type="text" id="editName" value="${esc(p.name)}" placeholder="Your name">
      <button class="btn btn-ghost btn-sm" id="saveName">Save</button>
    </div>

    <div class="section-head"><p class="section-label">📡 Live market data (optional)</p></div>
    <div class="settings-note">
      Skill Value is already live from GitHub, Hacker News & Stack Overflow.
      Add a <b>free</b> Adzuna API key to also pull <b>real open-job counts and median
      salaries</b> for your country. Get one at
      <a href="https://developer.adzuna.com" target="_blank" rel="noopener">developer.adzuna.com</a>.
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="field"><label>Adzuna App ID</label><input type="text" id="adzId" value="${esc(
        Store.getSetting("adzunaId", "")
      )}" placeholder="app_id"></div>
      <div class="field"><label>Adzuna App Key</label><input type="password" id="adzKey" value="${esc(
        Store.getSetting("adzunaKey", "")
      )}" placeholder="app_key"></div>
    </div>
    <div class="field"><label>Country</label>
      <select id="adzCountry">
        ${["gb", "us", "in", "au", "ca", "de", "fr", "nl", "sg", "za", "br", "nz", "pl", "at", "es", "it"]
          .map(
            (c) =>
              `<option value="${c}" ${
                Store.getSetting("adzunaCountry", "gb") === c ? "selected" : ""
              }>${c.toUpperCase()}</option>`
          )
          .join("")}
      </select>
    </div>
    <button class="btn btn-ghost btn-block" id="saveAdz">Save market keys</button>

    <div class="section-head"><p class="section-label">Account & backup</p></div>
    <div class="settings-card">
      <button class="settings-row" id="syncNowBtn">
        <span class="sr-ico">☁</span>
        <span class="sr-body"><span class="sr-title">Transfer sync now</span><span class="sr-sub">Upload this PC or download if another PC is newer</span></span>
        <span class="sr-arrow">›</span>
      </button>
      <button class="settings-row" id="exportBtn">
        <span class="sr-ico">⬇</span>
        <span class="sr-body"><span class="sr-title">Export backup</span><span class="sr-sub">Save a .json file copy</span></span>
        <span class="sr-arrow">›</span>
      </button>
      <button class="settings-row" id="importBtn">
        <span class="sr-ico">⬆</span>
        <span class="sr-body"><span class="sr-title">Import backup</span><span class="sr-sub">Load a .json file into this account</span></span>
        <span class="sr-arrow">›</span>
      </button>
      <input type="file" id="importFile" accept="application/json" hidden>
      <button class="settings-row" id="logoutBtn">
        <span class="sr-ico">↩</span>
        <span class="sr-body"><span class="sr-title">Log out</span><span class="sr-sub">Sign out on this device only</span></span>
        <span class="sr-arrow">›</span>
      </button>
      <button class="settings-row danger" id="wipeBtn">
        <span class="sr-ico">🗑</span>
        <span class="sr-body"><span class="sr-title">Erase cloud + local data</span><span class="sr-sub">Wipes this account's learning data</span></span>
        <span class="sr-arrow">›</span>
      </button>
    </div>
    <p class="muted small" style="margin-top:10px">Your learning data stays in this browser as local JSON. The link/server is only for opening the site and moving the newest copy to your other devices. After a free-host redeploy, re-create the same username on this PC once — local data uploads again.</p>
    <p class="app-footer">kritX · your personal learning OS</p>
  `;

  const hl = $("[data-view-skill]", view);
  if (hl)
    hl.addEventListener("click", () => (location.hash = "#/skill/" + hl.dataset.viewSkill));

  $("#saveName").addEventListener("click", () => {
    Store.setName($("#editName").value);
    toast("Saved");
    setTopbar("profile");
  });
  $("#saveAdz").addEventListener("click", () => {
    Store.setSetting("adzunaId", $("#adzId").value.trim());
    Store.setSetting("adzunaKey", $("#adzKey").value.trim());
    Store.setSetting("adzunaCountry", $("#adzCountry").value);
    Live.cache = {};
    Live.save();
    toast("Market keys saved");
  });
  $("#syncNowBtn").addEventListener("click", async () => {
    try {
      const { sync } = await Store.pullFromCloud();
      if (sync) syncToast(sync);
      else toast("Synced ✓");
      renderProfile();
    } catch (e) {
      toast(e.message || "Sync failed");
    }
  });
  $("#exportBtn").addEventListener("click", exportBackup);
  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async (e) => {
    await importBackup(e);
    try {
      await Store.pushToCloud();
      toast("Imported & uploaded to server ✓");
    } catch (err) {
      toast("Imported locally ✓");
    }
    router();
  });
  $("#logoutBtn").addEventListener("click", () =>
    openConfirm(
      "Log out?",
      "You'll need your password again. Your local tasks & Codex stay on this device.",
      async () => {
      await Sync.logout();
      Store.clearLocal();
      location.hash = "#/home";
      location.reload();
    })
  );
  $("#wipeBtn").addEventListener("click", () =>
    openConfirm(
      "Erase everything?",
      "This deletes your local JSON on this device and clears the transfer mailbox. Your login username can stay — you can start fresh.",
      async () => {
        Store.wipe();
        try {
          await Store.pushToCloud();
        } catch (e) {}
        location.hash = "#/home";
        router();
        toast("Local data erased");
      }
    )
  );
}

function categoryBreakdown() {
  const cats = Store.hoursByCategory();
  const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "";
  const max = Math.max(...entries.map((e) => e[1]));
  return `
    <div class="section-head"><p class="section-label">Hours by category</p></div>
    <div class="cat-list">
      ${entries
        .map(
          ([c, h]) => `
        <div class="cat-row">
          <div class="cat-name">${esc(c)}</div>
          <div class="cat-bar"><div class="cat-fill" style="width:${
            (h / max) * 100
          }%"></div></div>
          <div class="cat-val">${fmtHours(h)}h</div>
        </div>`
        )
        .join("")}
    </div>`;
}

// ============================================================
//  MODALS: new task, log, complete, pause, revisit, confirm
// ============================================================

function openNewTaskModal(prefill = {}) {
  const evolvesFrom = prefill.evolvesFrom || null;
  const evoSkill = evolvesFrom ? Store.getSkill(evolvesFrom) : null;
  const { close } = openModal(
    `
    <h2 class="modal-title">${evoSkill ? "Continue learning" : "New task"}</h2>
    <p class="modal-sub">${
      evoSkill
        ? `Building on <b>ENTRY №${String(evoSkill.entryNumber).padStart(3, "0")}</b> · ${esc(
            evoSkill.name
          )}. This new task will link as an evolution.`
        : "What are you learning, by when, and on which days? You'll add where you're studying from each day as you go."
    }</p>
    ${
      evoSkill
        ? `<div class="evo-banner">↑ Evolves from №${String(evoSkill.entryNumber).padStart(
            3,
            "0"
          )} · ${esc(evoSkill.name)}</div>`
        : ""
    }
    <div class="err" id="ntErr"></div>
    <div class="field"><label>Title</label>
      <input type="text" id="nt-title" placeholder="e.g. Learn React hooks" value="${esc(
        prefill.title || ""
      )}"></div>
    <div class="field"><label>Category</label>
      <input type="text" id="nt-cat" placeholder="Coding, Design, Fitness…" value="${esc(
        prefill.category || ""
      )}"></div>
    <div class="field"><label>Tags (optional)</label>
      <input type="text" id="nt-tags" placeholder="react, frontend" value="${esc(
        (prefill.tags || []).join(", ")
      )}"></div>
    <div class="grid2">
      <div class="field"><label>Timeline — days to finish</label><input type="number" id="nt-days" min="1" placeholder="14" value="${
        prefill.goalDays || ""
      }"></div>
      <div class="field"><label>Total hours goal</label><input type="number" id="nt-hours" min="0" step="0.5" placeholder="10" value="${
        prefill.goalHours || ""
      }"></div>
    </div>
    <p class="due-preview" id="nt-due">Pick a number of days to see the target date.</p>
    <div class="field">
      <label>Which weekdays will you work on this?</label>
      <div class="wd-picker" id="nt-wd">
        ${WEEKDAYS.map(
          (d, i) => `<button type="button" class="wd" data-wd="${i}">${d}</button>`
        ).join("")}
      </div>
      <p class="muted small" style="margin-top:6px">Leave all off to work any day.</p>
    </div>
    <div class="grid2">
      <div class="field"><label>Priority</label>
        <select id="nt-pri"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select>
      </div>
      <div class="field"><label>Difficulty</label>
        <select id="nt-diff"><option value="1">1 · easy</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5 · hard</option></select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="nt-save">${
        evoSkill ? "Start next chapter" : "Create task"
      }</button>
    </div>
  `,
    { wide: true }
  );

  $("[data-close]").addEventListener("click", close);

  // weekday toggles
  $all("#nt-wd .wd").forEach((b) =>
    b.addEventListener("click", () => b.classList.toggle("sel"))
  );

  // live target-date preview
  const daysInput = $("#nt-days");
  const duePrev = $("#nt-due");
  const updateDue = () => {
    const n = Number(daysInput.value);
    if (n > 0) {
      const d = new Date();
      d.setDate(d.getDate() + n);
      duePrev.textContent = `🎯 Target: finish by ${d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })}`;
      duePrev.classList.add("show");
    } else {
      duePrev.textContent = "Pick a number of days to see the target date.";
      duePrev.classList.remove("show");
    }
  };
  daysInput.addEventListener("input", updateDue);
  if (prefill.goalDays) updateDue();

  $("#nt-save").addEventListener("click", () => {
    const title = $("#nt-title").value.trim();
    if (!title) {
      showErr("ntErr", "Give the task a title.");
      return;
    }
    const weekdays = $all("#nt-wd .wd.sel").map((b) => Number(b.dataset.wd));
    const task = Store.addTask({
      title,
      category: $("#nt-cat").value.trim() || "General",
      tags: $("#nt-tags")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      goalDays: $("#nt-days").value,
      goalHours: $("#nt-hours").value,
      weekdays,
      priority: $("#nt-pri").value,
      difficulty: $("#nt-diff").value,
      evolvesFrom: evolvesFrom || null,
    });
    close();
    toast(evoSkill ? "Next chapter started ↗" : "Task created — start today?");
    location.hash = "#/task/" + task.id;
    router();
    openDailyModal(task.id);
  });
}

function openEditTaskModal(taskId) {
  const t = Store.getTask(taskId);
  if (!t) return;
  const { close } = openModal(
    `
    <h2 class="modal-title">Edit task</h2>
    <p class="modal-sub">Change the goal, schedule, or details. Your daily study logs are kept.</p>
    <div class="err" id="etErr"></div>
    <div class="field"><label>Title</label>
      <input type="text" id="et-title" value="${esc(t.title)}"></div>
    <div class="field"><label>Category</label>
      <input type="text" id="et-cat" value="${esc(t.category)}"></div>
    <div class="field"><label>Tags (optional)</label>
      <input type="text" id="et-tags" value="${esc((t.tags || []).join(", "))}"></div>
    <div class="grid2">
      <div class="field"><label>Timeline — days to finish</label>
        <input type="number" id="et-days" min="1" value="${t.goalDays || ""}"></div>
      <div class="field"><label>Total hours goal</label>
        <input type="number" id="et-hours" min="0" step="0.5" value="${t.goalHours || ""}"></div>
    </div>
    <p class="due-preview ${t.dueDate ? "show" : ""}" id="et-due">${
      t.dueDate
        ? `🎯 Target: finish by ${fmtDate(t.dueDate)}`
        : "Pick days to see the target date."
    }</p>
    <div class="field">
      <label>Which weekdays will you work on this?</label>
      <div class="wd-picker" id="et-wd">
        ${WEEKDAYS.map(
          (d, i) =>
            `<button type="button" class="wd${
              (t.weekdays || []).includes(i) ? " sel" : ""
            }" data-wd="${i}">${d}</button>`
        ).join("")}
      </div>
    </div>
    <div class="grid2">
      <div class="field"><label>Priority</label>
        <select id="et-pri">
          <option value="low" ${t.priority === "low" ? "selected" : ""}>Low</option>
          <option value="medium" ${t.priority === "medium" ? "selected" : ""}>Medium</option>
          <option value="high" ${t.priority === "high" ? "selected" : ""}>High</option>
        </select>
      </div>
      <div class="field"><label>Difficulty</label>
        <select id="et-diff">
          ${[1, 2, 3, 4, 5]
            .map(
              (n) =>
                `<option value="${n}" ${
                  Number(t.difficulty) === n ? "selected" : ""
                }>${n}${n === 1 ? " · easy" : n === 5 ? " · hard" : ""}</option>`
            )
            .join("")}
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="et-save">Save changes</button>
    </div>
  `,
    { wide: true }
  );

  $("[data-close]").addEventListener("click", close);
  $all("#et-wd .wd").forEach((b) =>
    b.addEventListener("click", () => b.classList.toggle("sel"))
  );

  const daysInput = $("#et-days");
  const duePrev = $("#et-due");
  const updateDue = () => {
    const n = Number(daysInput.value);
    if (n > 0 && t.createdAt) {
      const d = new Date(t.createdAt + "T00:00:00");
      d.setDate(d.getDate() + n);
      duePrev.textContent = `🎯 Target: finish by ${d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })}`;
      duePrev.classList.add("show");
    } else {
      duePrev.textContent = "Pick days to see the target date.";
      duePrev.classList.remove("show");
    }
  };
  daysInput.addEventListener("input", updateDue);

  $("#et-save").addEventListener("click", () => {
    const title = $("#et-title").value.trim();
    if (!title) {
      showErr("etErr", "Give the task a title.");
      return;
    }
    const weekdays = $all("#et-wd .wd.sel").map((b) => Number(b.dataset.wd));
    Store.updateTask(taskId, {
      title,
      category: $("#et-cat").value.trim() || "General",
      tags: $("#et-tags")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      goalDays: $("#et-days").value,
      goalHours: $("#et-hours").value,
      weekdays,
      priority: $("#et-pri").value,
      difficulty: $("#et-diff").value,
    });
    close();
    toast("Task updated ✓");
    renderTaskDetail(taskId);
  });
}

function openContinueFromCodex(skill) {
  const next = Store.nextPathSkill(skill);
  const { close } = openModal(`
    <h2 class="modal-title">Continue from Codex</h2>
    <p class="modal-sub">ENTRY №${String(skill.entryNumber).padStart(3, "0")} · ${esc(
    skill.name
  )}</p>
    <div class="continue-options">
      <button class="continue-opt" id="cont-advanced">
        <span class="co-ico">↗</span>
        <span class="co-body">
          <span class="co-title">Advanced version</span>
          <span class="co-sub">${esc(skill.name)} — advanced</span>
        </span>
      </button>
      ${
        next
          ? `<button class="continue-opt" id="cont-path">
        <span class="co-ico">${next.field.icon || "◆"}</span>
        <span class="co-body">
          <span class="co-title">Next on ${esc(next.field.name)} path</span>
          <span class="co-sub">${esc(next.skill)}</span>
        </span>
      </button>`
          : ""
      }
      <button class="continue-opt" id="cont-custom">
        <span class="co-ico">✎</span>
        <span class="co-body">
          <span class="co-title">Custom next step</span>
          <span class="co-sub">Pick your own title — still linked to this entry</span>
        </span>
      </button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>Cancel</button>
    </div>
  `);
  $("[data-close]").addEventListener("click", close);
  $("#cont-advanced").addEventListener("click", () => {
    close();
    openNewTaskModal({
      title: skill.name + " — advanced",
      category: skill.category,
      tags: skill.tags || [],
      evolvesFrom: skill.id,
      goalDays: 14,
      goalHours: 10,
    });
  });
  const pathBtn = $("#cont-path");
  if (pathBtn)
    pathBtn.addEventListener("click", () => {
      close();
      openNewTaskModal({
        title: next.skill,
        category: next.category || skill.category,
        evolvesFrom: skill.id,
        goalDays: 14,
        goalHours: 10,
      });
    });
  $("#cont-custom").addEventListener("click", () => {
    close();
    openNewTaskModal({
      title: "",
      category: skill.category,
      tags: skill.tags || [],
      evolvesFrom: skill.id,
    });
  });
}

// ---------- daily study ("Start today") ----------

function sourceRowHtml(prefill = {}) {
  return `
    <div class="res-row">
      <select class="res-type">
        <option value="">Type</option>
        ${SOURCE_TYPES.map(
          (t) => `<option ${prefill.type === t ? "selected" : ""}>${t}</option>`
        ).join("")}
      </select>
      <input type="text" class="res-title" placeholder="Title (e.g. Eloquent JS)" value="${esc(
        prefill.title || ""
      )}">
      <input type="text" class="res-url" placeholder="Link (optional)" value="${esc(
        prefill.url || ""
      )}">
      <button type="button" class="res-del" title="Remove">✕</button>
    </div>`;
}

function openDailyModal(taskId, logId = null) {
  const t = Store.getTask(taskId);
  if (!t) return;
  const existing = logId
    ? (t.dailyLogs || []).find((l) => l.id === logId)
    : (t.dailyLogs || []).find((l) => l.date === todayStr());
  const editing = Boolean(existing);
  const prev = Store.allResources();
  const { close } = openModal(
    `
    <h2 class="modal-title">${editing ? "Edit study log" : "Today's study"}</h2>
    <p class="modal-sub">${esc(t.title)} — ${
      editing
        ? `update what you studied on ${fmtDate(existing.date)}`
        : "where are you learning from today?"
    }</p>

    ${
      prev.length
        ? `<p class="section-label" style="margin:0 0 8px">Reuse a previous resource</p>
           <div class="reuse-chips" id="reuseChips">
             ${prev
               .map(
                 (s, i) =>
                   `<button type="button" class="reuse-chip" data-reuse="${i}">📖 ${esc(
                     [s.type, s.title].filter(Boolean).join(" · ") || s.url
                   )}</button>`
               )
               .join("")}
           </div>`
        : ""
    }

    <p class="section-label" style="margin:14px 0 8px">Sources for ${editing ? "this day" : "today"}</p>
    <div id="resList">${
      existing && existing.sources && existing.sources.length
        ? existing.sources.map((s) => sourceRowHtml(s)).join("")
        : sourceRowHtml()
    }</div>
    <button type="button" class="btn btn-ghost btn-sm" id="addRes">＋ Add another source</button>

    <div class="grid2" style="margin-top:16px">
      <div class="field"><label>Minutes (optional)</label><input type="number" id="dl-min" min="0" placeholder="e.g. 45" value="${
        existing && existing.minutes ? existing.minutes : ""
      }"></div>
      <div class="field"><label>Note (optional)</label><input type="text" id="dl-note" placeholder="What did you cover?" value="${esc(
        (existing && existing.note) || ""
      )}"></div>
    </div>

    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="dl-save">${
        editing ? "Save changes" : "Save today's work"
      }</button>
    </div>
  `,
    { wide: true }
  );

  const list = $("#resList");
  const bindDel = () =>
    $all(".res-del", list).forEach((b) =>
      b.addEventListener("click", () => {
        if ($all(".res-row", list).length > 1) b.closest(".res-row").remove();
        else {
          const row = b.closest(".res-row");
          $(".res-type", row).value = "";
          $(".res-title", row).value = "";
          $(".res-url", row).value = "";
        }
      })
    );
  bindDel();

  $("#addRes").addEventListener("click", () => {
    list.insertAdjacentHTML("beforeend", sourceRowHtml());
    bindDel();
  });

  const reuse = $("#reuseChips");
  if (reuse)
    $all(".reuse-chip", reuse).forEach((c) =>
      c.addEventListener("click", () => {
        const s = prev[Number(c.dataset.reuse)];
        // fill the first empty row, else add a new one
        let target = $all(".res-row", list).find(
          (r) => !$(".res-title", r).value && !$(".res-url", r).value
        );
        if (!target) {
          list.insertAdjacentHTML("beforeend", sourceRowHtml(s));
          bindDel();
          return;
        }
        $(".res-type", target).value = s.type || "";
        $(".res-title", target).value = s.title || "";
        $(".res-url", target).value = s.url || "";
      })
    );

  $("[data-close]").addEventListener("click", close);
  $("#dl-save").addEventListener("click", () => {
    const sources = $all(".res-row", list)
      .map((r) => ({
        type: $(".res-type", r).value,
        title: $(".res-title", r).value.trim(),
        url: $(".res-url", r).value.trim(),
      }))
      .filter((s) => s.type || s.title || s.url);
    const minutes = $("#dl-min").value;
    const note = $("#dl-note").value;
    if (!sources.length && !Number(minutes) && !note.trim()) {
      toast("Add a source, minutes, or a note first.");
      return;
    }
    if (editing && existing) {
      Store.updateDailyLog(taskId, existing.id, { sources, minutes, note });
    } else {
      Store.addDailyStudy(taskId, { sources, minutes, note });
    }
    close();
    toast(editing ? "Study log updated ✓" : "Today's work saved ✓");
    if (currentRoute().startsWith("task/")) renderTaskDetail(taskId);
    else router();
  });
}

function openLogModal(taskId) {
  const { close } = openModal(`
    <h2 class="modal-title">Log time</h2>
    <div class="err" id="logErr"></div>
    <div class="field"><label>Minutes spent</label><input type="number" id="log-min" min="1" placeholder="e.g. 45"></div>
    <div class="field"><label>Note (optional)</label><textarea id="log-note" placeholder="What did you cover?"></textarea></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="log-save">Log it</button>
    </div>
  `);
  $("[data-close]").addEventListener("click", close);
  $("#log-save").addEventListener("click", () => {
    const min = Number($("#log-min").value);
    if (!min || min <= 0) {
      showErr("logErr", "Enter minutes greater than 0.");
      return;
    }
    Store.logSession(taskId, min, $("#log-note").value);
    close();
    toast(`Logged ${min} min`);
    renderTaskDetail(taskId);
  });
}

function openCompleteModal(taskId) {
  const t = Store.getTask(taskId);
  if (!t) return;
  const priorSkills = Store.profile.skills;
  const entryNum = priorSkills.length + 1;
  const sources = Store.gatherSources(t);
  const studyDays = (t.dailyLogs || []).filter(
    (l) => (l.minutes || 0) > 0 || (l.sources && l.sources.length)
  ).length;
  let actualDays = 0;
  if (t.createdAt) {
    const a = new Date(t.createdAt + "T00:00:00");
    const b = new Date();
    b.setHours(0, 0, 0, 0);
    actualDays = Math.max(1, Math.round((b - a) / 86400000) + 1);
  }
  const evoParent = t.evolvesFrom ? Store.getSkill(t.evolvesFrom) : null;

  const { close } = openModal(
    `
    <h2 class="modal-title">Complete & add to Codex</h2>
    <p class="modal-sub">You're about to earn a permanent entry.</p>

    <div class="preview-card" id="cpPreview">
      <p class="entry-eyebrow">ENTRY №${String(entryNum).padStart(3, "0")} · preview</p>
      <h3 class="preview-title" id="cpPreviewTitle">${esc(t.title)}</h3>
      <div class="preview-meta">
        <span class="chip">${esc(t.category)}</span>
        <span id="cpPreviewHours">${fmtHours(t.loggedHours)}h</span>
        <span id="cpPreviewStars">★★★☆☆</span>
      </div>
      <div class="pva-grid compact">
        <div class="pva-cell"><div class="pva-lbl">Days</div><div class="pva-val">${
          t.goalDays || "—"
        } → <b>${actualDays}</b></div></div>
        <div class="pva-cell"><div class="pva-lbl">Hours</div><div class="pva-val">${
          t.goalHours || "—"
        } → <b>${fmtHours(t.loggedHours)}</b></div></div>
        <div class="pva-cell"><div class="pva-lbl">Study days</div><div class="pva-val"><b>${studyDays}</b></div></div>
      </div>
      ${
        sources.length
          ? `<div class="preview-sources">${sources
              .slice(0, 4)
              .map((s) => {
                const label = [s.type, s.title].filter(Boolean).join(" · ") || "Source";
                return `<span class="preview-src">📖 ${esc(label)}</span>`;
              })
              .join("")}${
              sources.length > 4
                ? `<span class="preview-src muted">+${sources.length - 4} more</span>`
                : ""
            }</div>`
          : `<p class="muted small">No sources logged yet — they'll still be empty on the entry.</p>`
      }
      ${
        evoParent
          ? `<div class="evo-note">↑ Evolves from №${String(evoParent.entryNumber).padStart(
              3,
              "0"
            )} · ${esc(evoParent.name)}</div>`
          : ""
      }
    </div>

    <div class="field"><label>Skill name</label><input type="text" id="cp-name" value="${esc(
      t.title
    )}"></div>
    <div class="field"><label>Mastery — how confident are you?</label>
      <select id="cp-mastery"><option value="1">★ Just started</option><option value="2">★★ Basic</option><option value="3" selected>★★★ Comfortable</option><option value="4">★★★★ Strong</option><option value="5">★★★★★ Mastered</option></select></div>
    <div class="field"><label>Actual hours spent</label><input type="number" id="cp-hours" step="0.25" value="${
      t.loggedHours || ""
    }"></div>
    <div class="field"><label>Reflection — what stuck?</label><textarea id="cp-refl" placeholder="Key takeaways…"></textarea></div>
    <div class="field"><label>What you'd do differently</label><textarea id="cp-diff" placeholder="Next time I'd…"></textarea></div>
    ${
      priorSkills.length
        ? `<div class="field"><label>Evolves from (optional)</label>
      <select id="cp-evo"><option value="">— standalone skill —</option>${priorSkills
        .map(
          (s) =>
            `<option value="${s.id}" ${
              t.evolvesFrom === s.id ? "selected" : ""
            }>№${s.entryNumber} · ${esc(s.name)}</option>`
        )
        .join("")}</select></div>`
        : ""
    }
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="cp-save">Earn ENTRY №${String(entryNum).padStart(
        3,
        "0"
      )}</button>
    </div>
  `,
    { wide: true }
  );
  $("[data-close]").addEventListener("click", close);

  const syncPreview = () => {
    const name = $("#cp-name").value.trim() || t.title;
    const hours = $("#cp-hours").value || t.loggedHours;
    const mastery = Number($("#cp-mastery").value) || 3;
    $("#cpPreviewTitle").textContent = name;
    $("#cpPreviewHours").textContent = fmtHours(Number(hours) || 0) + "h";
    $("#cpPreviewStars").textContent = "★".repeat(mastery) + "☆".repeat(5 - mastery);
  };
  $("#cp-name").addEventListener("input", syncPreview);
  $("#cp-hours").addEventListener("input", syncPreview);
  $("#cp-mastery").addEventListener("change", syncPreview);

  $("#cp-save").addEventListener("click", () => {
    const skill = Store.completeTask(taskId, {
      name: $("#cp-name").value,
      mastery: $("#cp-mastery").value,
      hoursSpent: $("#cp-hours").value,
      reflection: $("#cp-refl").value,
      whatDifferently: $("#cp-diff").value,
      evolvesFrom: $("#cp-evo") ? $("#cp-evo").value : t.evolvesFrom || null,
    });
    close();
    toast(`ENTRY №${String(skill.entryNumber).padStart(3, "0")} earned 📖`);
    location.hash = "#/skill/" + skill.id;
    router();
  });
}

function openPauseModal(taskId) {
  const { close } = openModal(`
    <h2 class="modal-title">Pause this task</h2>
    <p class="modal-sub">Why are you pausing? (useful context for later)</p>
    <div class="field"><textarea id="pause-reason" placeholder="e.g. Got busy at work"></textarea></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="pause-save">Pause</button>
    </div>
  `);
  $("[data-close]").addEventListener("click", close);
  $("#pause-save").addEventListener("click", () => {
    Store.pauseTask(taskId, $("#pause-reason").value);
    close();
    renderTaskDetail(taskId);
  });
}

function openRevisitModal(skillId) {
  const { close } = openModal(`
    <h2 class="modal-title">Log a revisit</h2>
    <p class="modal-sub">Came back to brush up? Note it — this builds a journal over time.</p>
    <div class="field"><label>Mastery now</label>
      <select id="rv-mastery"><option value="1">★ Faded</option><option value="2">★★</option><option value="3" selected>★★★</option><option value="4">★★★★</option><option value="5">★★★★★ Sharp</option></select></div>
    <div class="field"><label>Note</label><textarea id="rv-note" placeholder="What did you re-learn?"></textarea></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="rv-save">Save revisit</button>
    </div>
  `);
  $("[data-close]").addEventListener("click", close);
  $("#rv-save").addEventListener("click", () => {
    Store.addRevisit(skillId, $("#rv-note").value, $("#rv-mastery").value);
    close();
    toast("Revisit logged");
    renderSkillDetail(skillId);
  });
}

function openConfirm(title, body, onYes) {
  const { close } = openModal(`
    <h2 class="modal-title">${esc(title)}</h2>
    <p class="modal-sub">${esc(body)}</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-danger" id="cf-yes">Yes, do it</button>
    </div>
  `);
  $("[data-close]").addEventListener("click", close);
  $("#cf-yes").addEventListener("click", () => {
    close();
    onYes();
  });
}

// ---------- backup / export ----------

function download(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportBackup() {
  const stamp = new Date().toISOString().slice(0, 10);
  download(`kritx-backup-${stamp}.json`, Store.exportJson());
  toast("Backup downloaded");
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importJson(reader.result);
        toast("Backup restored");
        router();
        resolve();
      } catch (err) {
        toast(err.message || "Could not read that file.");
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function exportSkillCard(s) {
  const m = Market.lookup({ title: s.name, category: s.category, tags: s.tags });
  const card = `
CODEX · SKILL CARD
==================
№${String(s.entryNumber).padStart(3, "0")}  ${s.name}
Category : ${s.category}
Completed: ${s.completedAt}
Invested : ${fmtHours(s.hoursSpent)} hours
Mastery  : ${"★".repeat(s.mastery)}${"☆".repeat(5 - s.mastery)}
${s.sources && s.sources.length ? "Sources  : " + s.sources.map((x) => [x.type, x.title].filter(Boolean).join(" ")).join("; ") : ""}
${s.reflection ? "\nReflection:\n" + s.reflection : ""}
${s.revisits.length ? "\nRevisited " + s.revisits.length + " time(s)" : ""}

Market value (${m.trend}): ${m.salary.mid} mid-level
==================
Earned in kritX — your personal learning OS`;
  download(`skill-card-${s.name.replace(/\s+/g, "-").toLowerCase()}.txt`, card, "text/plain");
  toast("Skill card exported");
}

// ---------- shared UI bits ----------

function emptyBox(text, actionLabel, route) {
  return `<div class="empty">
    <p>${esc(text)}</p>
    ${
      actionLabel
        ? `<button class="btn btn-teal" data-empty-action="${route}">${esc(
            actionLabel
          )}</button>`
        : ""
    }
  </div>`;
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add("show");
}

// ============================================================
//  AUTH + BOOT
// ============================================================

function showAuthError(msg) {
  const el = $("#authError");
  if (!msg) {
    el.classList.remove("show");
    el.textContent = "";
    return;
  }
  el.textContent = msg;
  el.classList.add("show");
}

function setAuthMode(mode) {
  const login = mode === "login";
  $("#authLogin").hidden = !login;
  $("#authRegister").hidden = login;
  $("#authTitle").textContent = login ? "Welcome back" : "Create your account";
  $("#authSub").textContent = login
    ? "Open the website · data stays on this device · server only transfers between PCs."
    : "Create a username + password. Your Codex is saved locally; the server is just a mailbox.";
  showAuthError("");
}

async function refreshUserList() {
  const list = $("#userList");
  const localUsers = Store.listLocalUsers();
  let serverUsers = [];
  try {
    serverUsers = await Sync.listUsers();
    $("#authOffline").hidden = true;
  } catch (e) {
    $("#authOffline").hidden = false;
  }

  const byName = new Map();
  for (const u of serverUsers) {
    byName.set(u.username, {
      username: u.username,
      name: u.name || u.username,
      onServer: true,
      local: false,
    });
  }
  for (const u of localUsers) {
    const prev = byName.get(u.username) || {};
    byName.set(u.username, {
      username: u.username,
      name: u.name || prev.name || u.username,
      onServer: Boolean(prev.onServer),
      local: true,
      tasks: u.tasks || 0,
      skills: u.skills || 0,
    });
  }

  const users = Array.from(byName.values()).sort((a, b) =>
    a.username.localeCompare(b.username)
  );

  if (!users.length) {
    list.innerHTML = `<p class="muted small">No accounts yet — create one below. After a host redeploy, create the same username again on this PC to restore local data.</p>`;
    return;
  }

  list.innerHTML = users
    .map((u) => {
      const badge = u.local
        ? u.onServer
          ? "local + transfer"
          : "local only · re-create account if login fails"
        : "on server";
      const meta =
        u.local && (u.tasks || u.skills)
          ? ` · ${u.tasks || 0} tasks`
          : "";
      return `<button type="button" class="user-chip" data-user="${esc(u.username)}">
        <span class="user-chip-av">${esc(initials(u.name || u.username))}</span>
        <span class="user-chip-body">
          <span class="user-chip-name">@${esc(u.username)}</span>
          <span class="user-chip-meta">${esc(badge)}${esc(meta)}</span>
        </span>
      </button>`;
    })
    .join("");

  $all(".user-chip", list).forEach((b) =>
    b.addEventListener("click", () => {
      $("#login-user").value = b.dataset.user;
      $("#login-pass").focus();
    })
  );
}

function showLoginScreen() {
  $("#onboard").hidden = false;
  $("#app").hidden = true;
  setAuthMode("login");
  refreshUserList();

  $("#showRegister").onclick = () => setAuthMode("register");
  $("#showLogin").onclick = () => {
    setAuthMode("login");
    refreshUserList();
  };

  $("#loginBtn").onclick = async () => {
    showAuthError("");
    const username = $("#login-user").value.trim();
    const password = $("#login-pass").value;
    if (!username || !password) {
      showAuthError("Enter your username and password.");
      return;
    }
    $("#loginBtn").disabled = true;
    try {
      const data = await Sync.login({ username, password });
      const sync = await Store.syncAfterAuth(
        data.username,
        data.name || data.username,
        data.profile
      );
      syncToast(sync);
      if (!sync.pulled && !sync.pushed) {
        toast("Welcome back, " + (data.name || data.username));
      }
      startApp();
    } catch (e) {
      const local = Store.peekLocalProfile(username);
      if (local && !Store._isEmpty(local)) {
        showAuthError(
          (e.message || "Login failed.") +
            " Tip: if the host redeployed, Create account with the same username — your local Codex will upload again."
        );
      } else {
        showAuthError(e.message || "Login failed.");
      }
    } finally {
      $("#loginBtn").disabled = false;
    }
  };

  $("#registerBtn").onclick = async () => {
    showAuthError("");
    const username = $("#reg-user").value.trim();
    const name = $("#reg-name").value.trim() || username;
    const password = $("#reg-pass").value;
    const password2 = $("#reg-pass2").value;
    if (!username || !password) {
      showAuthError("Choose a username and password.");
      return;
    }
    if (password !== password2) {
      showAuthError("Passwords don't match.");
      return;
    }
    if (password.length < 4) {
      showAuthError("Password must be at least 4 characters.");
      return;
    }
    $("#registerBtn").disabled = true;
    try {
      // Prefer existing local JSON for this username (survives host redeploys)
      const existing = Store.peekLocalProfile(username);
      const profile = existing
        ? { ...existing, name: name || existing.name || username, onboarded: true }
        : {
            version: 1,
            name,
            createdAt: new Date().toISOString(),
            theme: "midnight",
            onboarded: true,
            settings: {},
            tasks: [],
            skills: [],
            updatedAt: new Date().toISOString(),
          };
      const data = await Sync.register({ username, password, name, profile });
      const sync = await Store.syncAfterAuth(data.username, name, data.profile);
      syncToast(sync);
      if (existing && !Store._isEmpty(existing)) {
        toast("Account ready · local Codex restored & transferred ☁");
      } else if (!sync.pulled && !sync.pushed) {
        toast("Account created · you're signed in");
      }
      startApp();
    } catch (e) {
      showAuthError(e.message || "Could not create account.");
    } finally {
      $("#registerBtn").disabled = false;
    }
  };

  $("#login-pass").onkeydown = (e) => {
    if (e.key === "Enter") $("#loginBtn").click();
  };
  $("#reg-pass2").onkeydown = (e) => {
    if (e.key === "Enter") $("#registerBtn").click();
  };
}

function startApp() {
  $("#onboard").hidden = true;
  $("#app").hidden = false;

  $all("[data-route]").forEach((t) =>
    t.addEventListener("click", () => navigate(t.dataset.route))
  );

  window.addEventListener("hashchange", router);
  if (!location.hash) location.hash = "#/home";
  router();

  Market.init(() => {
    const r = currentRoute();
    if (r.startsWith("market") || r.startsWith("field")) router();
  });

  // Sync local ↔ server every 5 min while app is open
  if (Sync.token()) {
    setInterval(() => {
      Store.pullFromCloud().catch(() => {});
    }, 5 * 60 * 1000);
  }
}

async function boot() {
  Store.load();

  if (Sync.token()) {
    try {
      await Sync.request("/api/me");
      const remote = await Sync.pullProfile();
      const username = Sync.username();
      const sync = await Store.syncAfterAuth(username, null, remote);
      startApp();
      syncToast(sync);
      return;
    } catch (e) {
      Sync.setAuth(null);
    }
  }

  showLoginScreen();
}

document.addEventListener("DOMContentLoaded", boot);
