# kritX — your personal learning OS

Turn what you learn into a growing, revisitable body of skills — with progress
you can see, and a reason to keep going (including how much money each skill can
make you). **Everything is saved on your device, like a game save** — no server,
no account, no internet required.

This version is built to become a **real installable Android app (.apk)**, not a
web page that only runs while a computer is on.

> The completed-skills record inside the app is still called **the Codex** — that's
> a feature name; the product itself is **kritX**.

---

## What's inside

**Tasks**
- Categories, tags, priority, and a 1–5 difficulty rating
- **Timeline**: set how many days to finish and it computes a target date, shown
  on a **calendar** with your scheduled days, studied days, and the deadline
- Pick **which weekdays** you'll work on each task
- Total-hours goal with a live progress bar
- **Start today** → log *where you're studying from today* as a list of sources
  (book / GitHub / video / link…), and **reuse resources** you've used before —
  no need to fix sources up front; you add them day by day
- A built-in **timer** — start it while you work and hours log into today
- Day-streak tracking, and **pause** a task with a reason ("got busy at work")

**The Codex** (your permanent record)
- Every completed task becomes a numbered, dated entry
- Keeps the **sources** the knowledge came from (book, GitHub, course, mentor…)
- A **mastery/confidence** score, a reflection, and "what I'd do differently"
- A **revisit log** — reopen an entry anytime and jot a dated note
- Link a skill as an **evolution** of an earlier one (React basics → React advanced)
- **Export a skill card** to share

**Is it worth it? (money + motivation) — now with live data**
- **Explore by field** — 16 domains (Cybersecurity, AI, Web, Data, Data
  Engineering, Cloud, Mobile, Design, Marketing, Game Dev, Content, Web3, AR/VR,
  Robotics/IoT, FinTech/Quant, Writing) with **opportunities** (roles + pay) and a
  step-by-step **learning path** of skills to build
  (e.g. Cybersecurity → Networking → Linux → Python → Pentesting → Cloud security)
- **Add any skill to your tasks in one tap** — or add a whole learning path at once
- **Real-time market signals (live):** every skill/field shows a live **demand
  index** and **trend** computed on the spot from constantly-updating public
  sources — **Hacker News hiring momentum (last 30 days vs the prior 30)**,
  **GitHub repo counts**, and **Stack Overflow activity**. A pulsing "LIVE" badge
  shows it's real-time, with a refresh button and "updated Xm ago".
- **Real jobs & salaries (optional):** add a free **Adzuna** API key in Profile to
  also see **live open-job counts and median salary** for your country.
- Everything is cached on-device and falls back to a curated snapshot when offline.
- Your dashboard highlights your most valuable in-progress skill to keep you motivated

**Dashboard & profile**
- Day streak, hours invested, GitHub-style **activity heatmap**
- Hours-per-week bar chart and hours-by-category breakdown
- One-tap **backup export / import** so you can move your Codex to any device

---

## Preview it on your computer first (optional)

You need [Node.js](https://nodejs.org) installed.

```
npm install
npm run serve
```

Open **http://localhost:5050**.

### Accounts & sync (multi-laptop)

kritX now has **usernames + private passwords**:

1. **Create an account** — pick a username (visible on the login list) and a password **only you know**.
2. On **any other PC**, run the same server (or open the same hosted URL), pick your username from the list, enter your password → your tasks & Codex load.
3. Every change auto-syncs to the server after a short delay (and every minute while the app is open). Profile → **Sync now** forces a push.

**Passwords** are stored as secure hashes (`scrypt`) on the server — never returned in the user list and never shown to other users. Only **usernames** (and display names) appear on the login screen.

**Important:** The sync database lives in the `data/` folder on the machine that runs `npm run serve`. For two laptops to share data:

- **Option A (same Wi‑Fi):** Run `npm run serve` on one PC, open `http://THAT-PC-IP:5050` from the other.
- **Option B (anywhere):** Host the app on a VPS / cloud (Railway, Render, a home always-on PC with port forward) and open that URL from every laptop. Keep the `data/` folder backed up.

Do **not** commit `data/` to GitHub (it's gitignored) — that folder holds password hashes and private learning data.

---

## Get the installable .apk (recommended: automatic cloud build)

You don't need to install Android Studio or the huge Android SDK. A GitHub
Action builds the `.apk` for you in the cloud.

1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Create a new **empty** repository (e.g. `codex`).
3. From inside this folder, push the code up:

   ```
   git init
   git add .
   git commit -m "Codex learning OS"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/codex.git
   git push -u origin main
   ```

4. On GitHub, open the **Actions** tab. The **Build Android APK** workflow runs
   automatically (or click it → **Run workflow**).
5. When it finishes (green check), open the run and download the
   **`Codex-app-apk`** artifact. Inside is `app-debug.apk`.
6. Copy that `.apk` to your Android phone and open it. You may need to allow
   "install from unknown sources". Done — it's now an installed app that saves
   your data on the device.

> The build uses a *debug* signature, which is perfect for installing on your own
> phone. For the Google Play Store you'd later switch to a signed *release* build.

---

## Build the .apk locally instead (only if you already have the Android SDK)

Requires the Android SDK + `ANDROID_HOME` set, and JDK 17.

```
npm install
npx cap add android
npm run apk:debug
```

The file lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## How your data is stored

All tasks and Codex entries live in your device's local storage as one JSON
document (the app's "save file"). It survives closing the app and restarting the
phone. Use **Profile → Export backup** to save it to a file, and **Import** to
restore it on a new device.

---

## Where the "live" market data comes from

The Skill Value module blends two layers:

1. **Live signals (real-time, automatic, no setup):** pulled straight from the app
   on each view and cached for 12h —
   - **Hacker News (Algolia API)** — hiring/discussion volume in the last 30 days
     vs the prior 30 = real momentum → the live trend (🔥/📈/➡️/❄️).
   - **GitHub Search API** — number of repos = how much is being built right now.
   - **Stack Overflow (Stack Exchange API)** — question volume = developer activity.
   These are combined into a 0–100 **live demand index**.
2. **Real jobs & salaries (optional):** set a free **Adzuna** app id/key + country
   in **Profile → Live market data**. Then each skill also shows live open-job
   counts and median salary from real listings. Get a key at
   [developer.adzuna.com](https://developer.adzuna.com).

When there's no internet, it falls back to the last cached snapshot, then the
curated dataset — so it always shows something useful.

## Updating the curated market data (online, patchable)

The curated structure (domains, learning paths, pay estimates) ships bundled and
also refreshes from one file: **`www/market-data.json`**.

- **To edit it:** change `www/market-data.json` (add fields, tweak pay, add
  learning-path skills) and rebuild — the app uses it automatically.
- **To update it live without rebuilding:** host that JSON somewhere public
  (e.g. commit it to your repo and use its GitHub *raw* URL), then set
  `MARKET_REMOTE_URL` near the top of `www/js/market.js` to that URL, e.g.
  `https://raw.githubusercontent.com/YOUR-USERNAME/kritx/main/www/market-data.json`.
  Now every time you edit the hosted file, installed apps pick up the change on
  next launch (and fall back to the cached/bundled copy when offline). The Worth
  tab shows 🟢 live / 🟡 cached / ⚪ offline so you always know the source.

## Roadmap ideas (not yet built)

Calendar auto-scheduling ("40 hours over 20 days → daily blocks") with ICS
export, a visual skill **constellation** map, spaced-repetition reminders when a
skill's mastery is fading, and live source metadata (GitHub repo info, book cover
by ISBN). Ask for any of these next.
