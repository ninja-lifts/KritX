/*
 * Store — Codex lives in linked PC folder kritx-data/<username>/profile.json
 * Absolute paths may differ per PC; the username folder name is what matches.
 * Sync bridge: server data/users/<username>/profile.json keeps both PCs updated.
 * Browser does not store Codex.
 */

const STORAGE_KEY = "codex.profile.v1"; // legacy — cleared, not written
const LOCAL_USER_PREFIX = "kritx.user.";
const LOCAL_USERS_INDEX = "kritx.localUsers.v1";

const DEFAULT_PROFILE = () => ({
  version: 1,
  name: "",
  createdAt: new Date().toISOString(),
  theme: "midnight",
  onboarded: false,
  settings: {},
  tasks: [],
  skills: [],
  updatedAt: null,
});

function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

function todayStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

const Store = {
  profile: null,
  activeUser: null,

  _userKey(username) {
    return LOCAL_USER_PREFIX + (username || "").toLowerCase();
  },

  _migrateProfile(profile) {
    const d = DEFAULT_PROFILE();
    for (const k of Object.keys(d)) {
      if (profile[k] === undefined) profile[k] = d[k];
    }
    for (const t of profile.tasks || []) {
      if (!Array.isArray(t.weekdays)) t.weekdays = [];
      if (!Array.isArray(t.dailyLogs)) {
        t.dailyLogs = (t.sessions || []).map((s) => ({
          id: uid(),
          date: s.date,
          minutes: s.minutes || 0,
          note: s.note || "",
          sources: [],
        }));
      }
      if (!t.streak) t.streak = { count: 0, lastDate: null };
      if (t.evolvesFrom === undefined) t.evolvesFrom = null;
      t.loggedHours = this._sumHours(t);
      delete t.sessions;
      delete t.subtasks;
      delete t.sources;
      delete t.recurring;
    }
    return profile;
  },

  _readLocalJson(username) {
    // Legacy read only — used once during migrate-to-folder, then keys are wiped
    if (!username) return null;
    try {
      const raw = localStorage.getItem(this._userKey(username));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  _writeLocalJson(_username, _profile) {
    // No-op: Codex is not stored in the browser anymore
    return null;
  },

  /** Wipe all browser-cached Codex so the PC folder is the only copy. */
  purgeBrowserCodex() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LOCAL_USERS_INDEX);
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith(LOCAL_USER_PREFIX) || k.startsWith("kritx.autobackup.v1."))
        ) {
          keys.push(k);
        }
      }
      for (const k of keys) localStorage.removeItem(k);
    } catch (e) {
      /* ignore */
    }
  },

  folderLinked() {
    return typeof LocalFolder !== "undefined" && LocalFolder.status().linked;
  },

  _rememberLocalUser(username, name, profile) {
    // Username hints for login list still come from Sync.knownUsers / server — not Codex storage
  },

  listLocalUsers() {
    // Codex is folder-only — login list does not invent users from browser storage
    return [];
  },

  _isEmpty(p) {
    if (!p || typeof p !== "object") return true;
    return !(p.tasks || []).length && !(p.skills || []).length;
  },

  /* Pull older saves into the per-user JSON key (one-time migration). */
  _legacyCandidates(username) {
    const out = [];
    const backupKey = `kritx.autobackup.v1.${(username || "").toLowerCase()}`;
    try {
      const backupRaw = localStorage.getItem(backupKey);
      if (backupRaw) {
        const backup = JSON.parse(backupRaw);
        if (backup && backup.profile) out.push(backup.profile);
      }
    } catch (e) {
      /* ignore */
    }
    try {
      const sessionRaw = localStorage.getItem(STORAGE_KEY);
      if (sessionRaw) out.push(JSON.parse(sessionRaw));
    } catch (e) {
      /* ignore */
    }
    return out;
  },

  _profileScore(p) {
    if (!p || typeof p !== "object") return 0;
    const tasks = (p.tasks || []).length;
    const skills = (p.skills || []).length;
    const updated = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
    return tasks * 10000 + skills * 5000 + updated;
  },

  _pickBestProfile(candidates) {
    let best = null;
    let bestScore = -1;
    for (const p of candidates) {
      if (!p || typeof p !== "object") continue;
      const score = this._profileScore(p);
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    return best;
  },

  load() {
    // No browser Codex — empty memory until folder is linked and loaded
    if (!this.profile) this.profile = DEFAULT_PROFILE();
    this.profile = this._migrateProfile(this.profile);
    this.purgeBrowserCodex();
    return this.profile;
  },

  /* Legacy mailbox reconcile — folder-only now; ignore remote server profiles. */
  reconcile(username, _remoteProfile, displayName) {
    this.loadForUser(username, displayName);
    return {
      source: "folder",
      pushed: false,
      pulled: false,
      localScore: this._profileScore(this.profile),
      remoteScore: 0,
    };
  },

  loadForUser(username, displayName) {
    this.activeUser = (username || "").toLowerCase();
    // Memory shell only — real data comes from folder via syncWithLocalFolder / ensureFolderReady
    this.profile = DEFAULT_PROFILE();
    if (displayName) this.profile.name = displayName;
    this.profile.onboarded = true;
    this.profile.updatedAt = nowIso();
    return this.profile;
  },

  getLocalSaveInfo(username) {
    return null;
  },

  clearUserData(username) {
    // Browser Codex keys only (folder files left on disk for the user to delete)
    if (!username) return;
    const u = username.toLowerCase();
    try {
      localStorage.removeItem(this._userKey(u));
      localStorage.removeItem(`kritx.autobackup.v1.${u}`);
    } catch (e) {
      /* ignore */
    }
  },

  peekLocalProfile(username) {
    return null;
  },

  save() {
    if (!this.profile) return;
    this.profile.updatedAt = nowIso();
    if (!this.activeUser && typeof Sync !== "undefined" && Sync.username()) {
      this.activeUser = Sync.username().toLowerCase();
    }
    if (!this.folderLinked()) {
      this._pendingSave = true;
      if (typeof toast === "function") {
        toast("Link your PC data folder to save — Profile → Link PC data folder");
      }
      return;
    }
    this._pendingSave = false;
    this._scheduleFolderWrite();
  },

  _folderTimer: null,
  _pendingSave: false,
  _scheduleFolderWrite() {
    if (!this.folderLinked()) return;
    const u = this.activeUser;
    if (!u || !this.profile) return;
    clearTimeout(this._folderTimer);
    this._folderTimer = setTimeout(() => {
      LocalFolder.writeProfile(u, this.profile)
        .then(() => this._pushServerBridge())
        .catch((e) => {
          if (typeof toast === "function") {
            toast(e.message || "Could not write to PC folder");
          }
        });
    }, 300);
  },

  _bridgeTimer: null,
  _pushServerBridge() {
    if (typeof Sync === "undefined" || !Sync.token() || !this.profile) return;
    if (this._isEmpty(this.profile)) return;
    clearTimeout(this._bridgeTimer);
    this._bridgeTimer = setTimeout(() => {
      Sync.putProfile(this.profile).catch(() => {});
    }, 500);
  },

  async writeToLinkedFolder() {
    if (!this.folderLinked()) return false;
    const u =
      this.activeUser ||
      (typeof Sync !== "undefined" && Sync.username()
        ? Sync.username().toLowerCase()
        : null);
    if (!u || !this.profile) return false;
    await LocalFolder.writeProfile(u, this.profile);
    this._pendingSave = false;
    this._pushServerBridge();
    return true;
  },

  _pickWinner(a, b) {
    const scoreA = this._profileScore(a);
    const scoreB = this._profileScore(b);
    const timeA = a && a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b && b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    const emptyA = this._isEmpty(a);
    const emptyB = this._isEmpty(b);
    if (emptyA && !emptyB) return b;
    if (emptyB && !emptyA) return a;
    if (emptyA && emptyB) return a || b || null;
    if (scoreB > scoreA) return b;
    if (scoreA > scoreB) return a;
    return timeB > timeA ? b : a;
  },

  /** One-time: move leftover browser Codex into the folder, then purge browser keys. */
  async migrateBrowserCacheIntoFolder(username) {
    const u = (username || this.activeUser || "").toLowerCase();
    if (!u || !this.folderLinked()) return;
    let legacy = this._readLocalJson(u);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session && !this._isEmpty(session)) {
          if (!legacy || this._profileScore(session) > this._profileScore(legacy)) {
            legacy = session;
          }
        }
      }
    } catch (e) {
      /* ignore */
    }
    const folder = await LocalFolder.readProfile(u);
    let winner = this._pickWinner(folder, legacy);
    if (winner && !this._isEmpty(winner)) {
      await LocalFolder.writeProfile(u, this._migrateProfile(winner));
      this.profile = this._migrateProfile(winner);
      this.profile.onboarded = true;
    }
    this.purgeBrowserCodex();
  },

  /**
   * Merge PC folder + server bridge (same username; paths can differ).
   * Writes winner back to folder and server so every PC stays live.
   */
  async syncWithLocalFolder() {
    if (!this.folderLinked()) {
      return { synced: false, reason: "not-linked" };
    }
    const u =
      this.activeUser ||
      (typeof Sync !== "undefined" && Sync.username()
        ? Sync.username().toLowerCase()
        : null);
    if (!u) return { synced: false, reason: "no-user" };
    if (!this.profile) this.loadForUser(u);

    let folderProfile = null;
    try {
      folderProfile = await LocalFolder.readProfile(u);
    } catch (e) {
      return { synced: false, reason: e.message || "read-failed" };
    }

    let serverProfile = null;
    if (typeof Sync !== "undefined" && Sync.token() && Sync.getProfile) {
      try {
        const data = await Sync.getProfile();
        serverProfile = data.profile || null;
      } catch (e) {
        /* offline — folder only */
      }
    }

    let winner = this._pickWinner(this.profile, folderProfile);
    winner = this._pickWinner(winner, serverProfile);
    if (!winner) {
      winner = this.profile || DEFAULT_PROFILE();
    }

    const before = this._profileScore(this.profile);
    this.profile = this._migrateProfile({ ...winner });
    this.profile.onboarded = true;
    if (!this.profile.updatedAt) this.profile.updatedAt = nowIso();

    await LocalFolder.writeProfile(u, this.profile);
    if (typeof Sync !== "undefined" && Sync.token() && !this._isEmpty(this.profile)) {
      try {
        const res = await Sync.putProfile(this.profile);
        if (res && res.profile) {
          this.profile = this._migrateProfile(res.profile);
          await LocalFolder.writeProfile(u, this.profile);
        }
      } catch (e) {
        /* ignore */
      }
    }

    const after = this._profileScore(this.profile);
    return {
      synced: true,
      source: "folder+bridge",
      pulled: after > before || Boolean(folderProfile || serverProfile),
      pushed: true,
    };
  },

  async ensureFolderReady(username, displayName) {
    this.loadForUser(username, displayName);
    if (!this.folderLinked()) {
      if (typeof LocalFolder !== "undefined") {
        await LocalFolder.restore();
      }
    }
    if (!this.folderLinked()) {
      return { ok: false, reason: "not-linked" };
    }
    await this.migrateBrowserCacheIntoFolder(username);
    await this.syncWithLocalFolder();
    return { ok: true, profile: this.profile };
  },

  _peerTimer: null,
  _schedulePeerSync() {},

  lastPeerSync: null,

  /** Fetch/update: PC folder + server bridge for the same username. */
  async syncWithPeers() {
    const r = await this.syncWithLocalFolder();
    const sync = {
      source: r.source || "folder",
      pushed: Boolean(r.pushed),
      pulled: Boolean(r.pulled),
      peers: 1,
      youAreWinner: true,
      folder: true,
    };
    this.lastPeerSync = { ...sync, at: nowIso() };
    return { profile: this.profile, sync: r.synced ? sync : null };
  },

  async pushToCloud() {
    return this.syncWithPeers();
  },

  async pullFromCloud() {
    return this.syncWithPeers();
  },

  applyRemoteProfile(remote) {
    if (!remote || typeof remote !== "object") return;
    this.profile = this._migrateProfile({ ...remote });
    this.profile.onboarded = true;
    this._scheduleFolderWrite();
  },

  async syncAfterAuth(username, displayName) {
    const ready = await this.ensureFolderReady(username, displayName);
    if (!ready.ok) {
      return {
        source: "folder",
        pushed: false,
        pulled: false,
        peers: 0,
        needsFolder: true,
      };
    }
    return {
      source: "folder",
      pushed: false,
      pulled: true,
      peers: 1,
      needsFolder: false,
    };
  },

  clearLocal() {
    this.profile = DEFAULT_PROFILE();
    this.activeUser = null;
    this.purgeBrowserCodex();
  },

  _sumHours(task) {
    const mins = (task.dailyLogs || []).reduce((a, l) => a + (l.minutes || 0), 0);
    return Math.round((mins / 60) * 100) / 100;
  },

  _todayLog(task, create) {
    const today = todayStr();
    let log = task.dailyLogs.find((l) => l.date === today);
    if (!log && create) {
      log = { id: uid(), date: today, minutes: 0, note: "", sources: [] };
      task.dailyLogs.push(log);
    }
    return log;
  },

  _bumpStreak(task) {
    const today = todayStr();
    if (task.streak.lastDate === today) return;
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const y = yd.toISOString().slice(0, 10);
    task.streak.count = task.streak.lastDate === y ? task.streak.count + 1 : 1;
    task.streak.lastDate = today;
  },

  // ---------- profile ----------

  setName(name) {
    this.profile.name = (name || "").trim();
    this.profile.onboarded = true;
    this.save();
  },

  setTheme(theme) {
    this.profile.theme = theme;
    this.save();
  },

  getSetting(key, fallback) {
    if (!this.profile.settings) this.profile.settings = {};
    const v = this.profile.settings[key];
    return v === undefined ? fallback : v;
  },

  setSetting(key, value) {
    if (!this.profile.settings) this.profile.settings = {};
    this.profile.settings[key] = value;
    this.save();
  },

  // ---------- tasks ----------

  addTask(data) {
    const start = todayStr();
    let due = null;
    if (data.goalDays && Number(data.goalDays) > 0) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + Number(data.goalDays));
      due = d.toISOString().slice(0, 10);
    }
    const weekdays = (data.weekdays || []).map(Number).filter((n) => n >= 0 && n <= 6);
    const task = {
      id: uid(),
      title: (data.title || "").trim(),
      category: (data.category || "General").trim(),
      tags: data.tags || [],
      difficulty: Number(data.difficulty) || 3,
      priority: data.priority || "medium",
      goalDays: Number(data.goalDays) || 0,
      goalHours: Number(data.goalHours) || 0,
      weekdays, // 0=Sun … 6=Sat. Empty = any day.
      dueDate: due,
      createdAt: start,
      loggedHours: 0,
      dailyLogs: [], // [{ id, date, minutes, note, sources:[{type,title,url}] }]
      streak: { count: 0, lastDate: null },
      status: "active",
      pauseReason: "",
      notes: (data.notes || "").trim(),
      evolvesFrom: data.evolvesFrom || null, // Codex skill id this continues from
    };
    this.profile.tasks.unshift(task);
    this.save();
    return task;
  },

  // Unique sources gathered from a task's daily study logs
  gatherSources(task) {
    const gathered = [];
    const seen = new Set();
    for (const l of task.dailyLogs || []) {
      for (const s of l.sources || []) {
        const key = (s.title || "") + "|" + (s.url || "");
        if (key !== "|" && !seen.has(key)) {
          seen.add(key);
          gathered.push(s);
        }
      }
    }
    return gathered;
  },

  // Match a path skill name against Codex / active tasks (loose)
  matchPathSkill(skillName) {
    const needle = (skillName || "").toLowerCase().replace(/[^a-z0-9+#.]/g, " ").replace(/\s+/g, " ").trim();
    const words = needle.split(" ").filter((w) => w.length > 2);
    const score = (title) => {
      const hay = (title || "").toLowerCase();
      if (hay === needle || hay.includes(needle) || needle.includes(hay)) return 10;
      let hits = 0;
      for (const w of words) if (hay.includes(w)) hits++;
      return hits >= Math.min(2, words.length) ? hits : 0;
    };
    let bestSkill = null;
    let bestSkillScore = 0;
    for (const s of this.profile.skills) {
      const sc = score(s.name);
      if (sc > bestSkillScore) {
        bestSkillScore = sc;
        bestSkill = s;
      }
    }
    let bestTask = null;
    let bestTaskScore = 0;
    for (const t of this.profile.tasks) {
      if (t.status === "completed") continue;
      const sc = score(t.title);
      if (sc > bestTaskScore) {
        bestTaskScore = sc;
        bestTask = t;
      }
    }
    if (bestSkill && bestSkillScore >= bestTaskScore && bestSkillScore > 0)
      return { status: "done", skill: bestSkill, task: null };
    if (bestTask && bestTaskScore > 0)
      return { status: "active", skill: null, task: bestTask };
    return { status: "todo", skill: null, task: null };
  },

  pathProgress(field) {
    if (!field || !field.path) return { done: 0, active: 0, total: 0, steps: [] };
    const steps = field.path.map((p) => {
      const m = this.matchPathSkill(p.skill);
      return { ...p, ...m };
    });
    return {
      done: steps.filter((s) => s.status === "done").length,
      active: steps.filter((s) => s.status === "active").length,
      total: steps.length,
      steps,
    };
  },

  // Suggest next skill on a field path after a completed Codex entry
  nextPathSkill(skill) {
    const fields = typeof Market !== "undefined" ? Market.fields() : [];
    for (const f of fields) {
      for (let i = 0; i < f.path.length; i++) {
        const m = this.matchPathSkill(f.path[i].skill);
        if (m.status === "done" && m.skill && m.skill.id === skill.id) {
          for (let j = i + 1; j < f.path.length; j++) {
            const nxt = this.matchPathSkill(f.path[j].skill);
            if (nxt.status === "todo") {
              return {
                field: f,
                skill: f.path[j].skill,
                category: f.path[j].category,
                why: f.path[j].why,
              };
            }
          }
        }
      }
    }
    return null;
  },

  getTask(id) {
    return this.profile.tasks.find((t) => t.id === id);
  },

  updateTask(id, patch) {
    const t = this.getTask(id);
    if (!t) return null;
    if (patch.title !== undefined) t.title = String(patch.title).trim();
    if (patch.category !== undefined) t.category = String(patch.category).trim() || "General";
    if (patch.tags !== undefined) t.tags = patch.tags;
    if (patch.difficulty !== undefined) t.difficulty = Number(patch.difficulty) || 3;
    if (patch.priority !== undefined) t.priority = patch.priority || "medium";
    if (patch.goalDays !== undefined) {
      t.goalDays = Number(patch.goalDays) || 0;
      if (t.goalDays > 0 && t.createdAt) {
        const d = new Date(t.createdAt + "T00:00:00");
        d.setDate(d.getDate() + t.goalDays);
        t.dueDate = d.toISOString().slice(0, 10);
      } else if (!t.goalDays) {
        t.dueDate = patch.dueDate !== undefined ? patch.dueDate : t.dueDate;
      }
    }
    if (patch.goalHours !== undefined) t.goalHours = Number(patch.goalHours) || 0;
    if (patch.weekdays !== undefined)
      t.weekdays = (patch.weekdays || []).map(Number).filter((n) => n >= 0 && n <= 6);
    if (patch.dueDate !== undefined) t.dueDate = patch.dueDate;
    if (patch.notes !== undefined) t.notes = String(patch.notes).trim();
    if (patch.status !== undefined) t.status = patch.status;
    this.save();
    return t;
  },

  updateDailyLog(taskId, logId, patch = {}) {
    const t = this.getTask(taskId);
    if (!t) return null;
    const log = (t.dailyLogs || []).find((l) => l.id === logId);
    if (!log) return null;
    if (patch.sources !== undefined) log.sources = patch.sources;
    if (patch.minutes !== undefined) log.minutes = Math.max(0, Math.round(Number(patch.minutes) || 0));
    if (patch.note !== undefined) log.note = String(patch.note).trim();
    t.loggedHours = this._sumHours(t);
    this.save();
    return log;
  },

  deleteTask(id) {
    this.profile.tasks = this.profile.tasks.filter((t) => t.id !== id);
    this.save();
  },

  // Log time into today's study entry (used by the timer + manual log).
  logSession(id, minutes, note) {
    const t = this.getTask(id);
    if (!t) return null;
    const mins = Math.round(Number(minutes) || 0);
    if (mins <= 0) return t;
    const log = this._todayLog(t, true);
    log.minutes += mins;
    if (note) log.note = log.note ? log.note + " · " + note.trim() : note.trim();
    t.loggedHours = this._sumHours(t);
    this._bumpStreak(t);
    this.save();
    return t;
  },

  /* "Start today" — record where you're studying from today (a list of
     sources), plus optional minutes and a note. Merges into today's entry. */
  addDailyStudy(id, { sources = [], minutes = 0, note = "" } = {}) {
    const t = this.getTask(id);
    if (!t) return null;
    const log = this._todayLog(t, true);
    for (const s of sources) {
      const clean = {
        type: (s.type || "").trim(),
        title: (s.title || "").trim(),
        url: (s.url || "").trim(),
      };
      if (!clean.title && !clean.url && !clean.type) continue;
      const dupe = log.sources.some(
        (x) => x.title === clean.title && x.url === clean.url
      );
      if (!dupe) log.sources.push(clean);
    }
    const mins = Math.round(Number(minutes) || 0);
    if (mins > 0) log.minutes += mins;
    if (note && note.trim())
      log.note = log.note ? log.note + " · " + note.trim() : note.trim();
    t.loggedHours = this._sumHours(t);
    this._bumpStreak(t);
    this.save();
    return t;
  },

  // Unique resources used anywhere before, so they can be reused quickly.
  allResources() {
    const seen = new Map();
    for (const t of this.profile.tasks) {
      for (const l of t.dailyLogs || []) {
        for (const s of l.sources || []) {
          const key = (s.title || "") + "|" + (s.url || "");
          if (key !== "|" && !seen.has(key)) seen.set(key, s);
        }
      }
    }
    return Array.from(seen.values());
  },

  // Is today a scheduled day for this task? (empty weekdays = any day)
  isScheduledToday(task) {
    if (!task.weekdays || !task.weekdays.length) return true;
    return task.weekdays.includes(new Date().getDay());
  },

  studiedToday(task) {
    const log = (task.dailyLogs || []).find((l) => l.date === todayStr());
    return !!log && (log.minutes > 0 || (log.sources && log.sources.length > 0));
  },

  pauseTask(id, reason) {
    const t = this.getTask(id);
    if (!t) return;
    t.status = t.status === "paused" ? "active" : "paused";
    t.pauseReason = t.status === "paused" ? (reason || "").trim() : "";
    this.save();
  },

  completeTask(id, data) {
    const t = this.getTask(id);
    if (!t) return null;
    t.status = "completed";
    t.completedAt = todayStr();

    const gathered =
      data.sources && data.sources.length ? data.sources : this.gatherSources(t);

    // how many calendar days from start to finish
    let actualDays = 0;
    if (t.createdAt && t.completedAt) {
      const a = new Date(t.createdAt + "T00:00:00");
      const b = new Date(t.completedAt + "T00:00:00");
      actualDays = Math.max(1, Math.round((b - a) / 86400000) + 1);
    }
    const studyDays = (t.dailyLogs || []).filter(
      (l) => (l.minutes || 0) > 0 || (l.sources && l.sources.length)
    ).length;

    const hoursSpent =
      data.hoursSpent !== undefined && data.hoursSpent !== ""
        ? Number(data.hoursSpent)
        : t.loggedHours;

    const entryNumber = this.profile.skills.length + 1;
    const skill = {
      id: uid(),
      entryNumber,
      taskId: t.id,
      name: (data.name || t.title).trim(),
      category: t.category,
      tags: t.tags || [],
      sources: gathered,
      hoursSpent,
      goalDays: t.goalDays,
      goalHours: t.goalHours,
      completedAt: t.completedAt,
      mastery: Number(data.mastery) || 3,
      reflection: (data.reflection || "").trim(),
      whatDifferently: (data.whatDifferently || "").trim(),
      revisits: [],
      evolvesFrom: data.evolvesFrom || t.evolvesFrom || null,
      plannedVsActual: {
        goalDays: t.goalDays || 0,
        goalHours: t.goalHours || 0,
        actualDays,
        actualHours: hoursSpent,
        studyDays,
        weekdays: t.weekdays || [],
      },
    };
    this.profile.skills.push(skill);
    this.save();
    return skill;
  },

  // ---------- skills / codex ----------

  getSkill(id) {
    return this.profile.skills.find((s) => s.id === id);
  },

  addRevisit(id, note, mastery) {
    const s = this.getSkill(id);
    if (!s) return;
    s.revisits.push({
      date: todayStr(),
      note: (note || "").trim(),
      mastery: Number(mastery) || s.mastery,
    });
    if (mastery) s.mastery = Number(mastery);
    this.save();
  },

  deleteSkill(id) {
    this.profile.skills = this.profile.skills.filter((s) => s.id !== id);
    this.save();
  },

  // ---------- backup ----------

  exportJson() {
    return JSON.stringify(this.profile, null, 2);
  },

  importJson(text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || !Array.isArray(data.tasks)) {
      throw new Error("That doesn't look like a Codex backup file.");
    }
    if (!this.folderLinked()) {
      throw new Error("Link your PC data folder first, then import into it.");
    }
    this.profile = this._migrateProfile(data);
    this.profile.onboarded = true;
    this.profile.updatedAt = nowIso();
    this.save();
  },

  wipe() {
    const username =
      this.activeUser ||
      (typeof Sync !== "undefined" && Sync.username()
        ? Sync.username().toLowerCase()
        : null);
    if (username) this.clearUserData(username);
    this.profile = DEFAULT_PROFILE();
    this.activeUser = null;
    this.purgeBrowserCodex();
  },

  /** Full wipe of in-memory Codex + legacy browser keys (folder files stay). */
  eraseAccountLocal(username) {
    const u = (username || "").toLowerCase();
    if (u) this.clearUserData(u);
    this.profile = DEFAULT_PROFILE();
    this.activeUser = null;
    this.purgeBrowserCodex();
  },

  // ---------- derived stats ----------

  activityByDay() {
    // returns { 'YYYY-MM-DD': totalMinutes }
    const map = {};
    for (const t of this.profile.tasks) {
      for (const l of t.dailyLogs || []) {
        map[l.date] = (map[l.date] || 0) + (l.minutes || 0);
      }
    }
    return map;
  },

  totalHours() {
    let mins = 0;
    for (const t of this.profile.tasks) {
      for (const l of t.dailyLogs || []) mins += l.minutes || 0;
    }
    return Math.round((mins / 60) * 10) / 10;
  },

  currentStreak() {
    const days = this.activityByDay();
    let streak = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // allow today to be empty without breaking streak
    if (!days[d.toISOString().slice(0, 10)]) {
      d.setDate(d.getDate() - 1);
    }
    while (days[d.toISOString().slice(0, 10)]) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  },

  hoursByCategory() {
    const map = {};
    for (const t of this.profile.tasks) {
      const mins = (t.dailyLogs || []).reduce((a, l) => a + (l.minutes || 0), 0);
      if (mins) map[t.category] = (map[t.category] || 0) + mins / 60;
    }
    return map;
  },

  hoursLastNWeeks(n) {
    // returns array of {label, hours} for the last n weeks (oldest first)
    const weeks = [];
    for (let i = n - 1; i >= 0; i--) {
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      let mins = 0;
      for (const t of this.profile.tasks) {
        for (const l of t.dailyLogs || []) {
          const sd = new Date(l.date + "T00:00:00");
          if (sd >= start && sd <= end) mins += l.minutes || 0;
        }
      }
      weeks.push({
        label: i === 0 ? "This wk" : `-${i}w`,
        hours: Math.round((mins / 60) * 10) / 10,
      });
    }
    return weeks;
  },
};
