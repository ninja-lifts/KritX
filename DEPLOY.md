# Put kritX on the web (no install — just a link)

Goal: **one public URL** (e.g. `https://kritx.onrender.com`) that anyone opens in Chrome on phone or laptop → **pick username → enter password** → same Codex everywhere.

No `npm install` on user devices. Only **you** deploy the server once.

---

## Recommended: Render.com (easiest with GitHub)

### Step 1 — Push code to GitHub

From your project folder:

```powershell
git add .
git commit -m "Add cloud deploy config for public website"
git push origin main
```

Repo: https://github.com/ninja-lifts/KritX

### Step 2 — Create Render account

1. Go to [render.com](https://render.com) → Sign up (free).
2. Connect your **GitHub** account.

### Step 3 — Deploy from repo

1. Dashboard → **New +** → **Blueprint** (or **Web Service**).
2. If using Blueprint: select repo `ninja-lifts/KritX` — Render reads `render.yaml` automatically.
3. If manual Web Service:
   - **Repository:** `ninja-lifts/KritX`
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Plan:** **Starter** ($7/mo) — needed for **persistent disk** (user data survives restarts)
4. Under **Disks** → Add disk:
   - **Name:** `kritx-data`
   - **Mount path:** `/opt/render/project/src/data`
   - **Size:** 1 GB
5. Click **Create Web Service**.

Wait ~3–5 minutes. Render gives you a URL like:

`https://kritx-xxxx.onrender.com`

### Step 4 — Use from any device

1. Open that URL in Chrome (phone, laptop, tablet).
2. **Create account** — username + private password.
3. **Bookmark the link** on each device.
4. On another device: open same URL → tap your username → password → **same tasks & Codex**.

Profile page shows: **Signed in as @yourusername — synced**.

---

## What users see

| Public | Private |
|--------|---------|
| Username list on login | Password (only you know) |
| Display name | Tasks, Codex, study logs |

Passwords are stored as **hashes** on the server — never shown to other users.

---

## Cost note (Render)

| Plan | Good for |
|------|----------|
| **Free** | Testing only — data may reset on redeploy; app sleeps after 15 min idle |
| **Starter + disk** (~$7/mo) | Real use — data persists, faster wake |

For a personal/friends kritX, Starter + 1GB disk is enough.

---

## Custom domain (optional)

Render → your service → **Settings** → **Custom Domains** → add e.g. `kritx.yourdomain.com`.

---

## Update the live site

```powershell
git add .
git commit -m "Your change"
git push origin main
```

Render auto-redeploys. User data in `data/` disk is **not** wiped by code updates.

---

## Local test (before deploy)

```powershell
npm install
npm start
```

Open http://localhost:5050 — same login/sync as production.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Can't reach server" on login | Wait for Render deploy to finish; check URL is `https://` |
| Users gone after redeploy | Add **persistent disk** on Starter plan |
| Slow first load | Free tier cold start; upgrade or wait ~30s |
| Want completely free host | Data won't persist reliably — use Starter disk |

---

## Your link workflow (summary)

```
You deploy once on Render
        ↓
https://kritx-xxxx.onrender.com
        ↓
Phone / Laptop / Work PC — same URL
        ↓
Login: username + password
        ↓
Codex syncs automatically
```
