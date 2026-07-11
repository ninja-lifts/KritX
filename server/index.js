/**
 * kritX server
 *
 * Serves the website + auth + per-user profile.json (sync bridge between PCs).
 * Each PC also keeps the same data in a linked folder:
 *   kritx-data/<username>/profile.json
 * Absolute paths can differ; the username folder name is what matches.
 *
 * Run:  npm start
 * Open: http://localhost:5050
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const ROOT = path.join(__dirname, "..");
const WWW = path.join(ROOT, "www");
const DATA = path.join(ROOT, "data");
const USERS_DIR = path.join(DATA, "users");
const SESSIONS_FILE = path.join(DATA, "sessions.json");
const PORT = process.env.PORT || 5050;
const PEER_TTL_MS = 45000;

fs.mkdirSync(USERS_DIR, { recursive: true });

/** username -> Map(peerId -> { profile, score, updatedAt, lastSeen, name }) */
const liveRooms = new Map();
/** peerId -> { users: [{username,name}], lastSeen } — live username transfer between online PCs */
const liveDirectory = new Map();
/** usernames deleted while peers are online — suppressed until TTL */
const accountTombstones = new Map(); // username -> expiresAt
const TOMBSTONE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function safeUsername(u) {
  const s = String(u || "")
    .trim()
    .toLowerCase();
  if (!s || s.length < 2 || s.length > 32) return null;
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(s)) return null;
  if (s.includes("..")) return null;
  return s;
}

function userDir(username) {
  return path.join(USERS_DIR, username);
}
function metaPath(username) {
  return path.join(userDir(username), "meta.json");
}
function profilePath(username) {
  return path.join(userDir(username), "profile.json");
}

function readUserProfile(username) {
  return readJson(profilePath(username), null);
}

function writeUserProfile(username, profile) {
  fs.mkdirSync(userDir(username), { recursive: true });
  writeJson(profilePath(username), profile);
}

function profileScore(p) {
  if (!p || typeof p !== "object") return 0;
  let score = (p.tasks || []).length * 10 + (p.skills || []).length * 20;
  for (const t of p.tasks || []) {
    score += (t.dailyLogs || []).length * 2;
    for (const l of t.dailyLogs || []) score += Math.min(5, (l.minutes || 0) / 30);
  }
  return score;
}

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, s, 64).toString("hex");
  return { salt: s, hash };
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(check, "hex"), Buffer.from(hash, "hex"));
  } catch (e) {
    return false;
  }
}

function loadSessions() {
  return readJson(SESSIONS_FILE, {});
}
function saveSessions(sessions) {
  writeJson(SESSIONS_FILE, sessions);
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString("hex");
  const sessions = loadSessions();
  const now = Date.now();
  for (const [t, s] of Object.entries(sessions)) {
    if (s.expires < now) delete sessions[t];
  }
  sessions[token] = {
    username,
    expires: now + 1000 * 60 * 60 * 24 * 30,
  };
  saveSessions(sessions);
  return token;
}

function sessionUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const sessions = loadSessions();
  const s = sessions[token];
  if (!s || s.expires < Date.now()) {
    if (s) {
      delete sessions[token];
      saveSessions(sessions);
    }
    return null;
  }
  return { username: s.username, token };
}

function pruneTombstones() {
  const now = Date.now();
  for (const [u, expires] of accountTombstones) {
    if (expires < now) accountTombstones.delete(u);
  }
}

function addTombstone(username) {
  const u = safeUsername(username);
  if (!u) return;
  accountTombstones.set(u, Date.now() + TOMBSTONE_TTL_MS);
}

function isTombstoned(username) {
  pruneTombstones();
  return accountTombstones.has(String(username || "").toLowerCase());
}

function activeTombstones() {
  pruneTombstones();
  return Array.from(accountTombstones.keys());
}

function pruneDirectory() {
  const now = Date.now();
  for (const [id, entry] of liveDirectory) {
    if (now - entry.lastSeen > PEER_TTL_MS) liveDirectory.delete(id);
  }
}

function announceDirectory(peerId, users) {
  const clean = [];
  const seen = new Set();
  for (const u of users || []) {
    const username = safeUsername(u && u.username);
    if (!username || seen.has(username)) continue;
    if (isTombstoned(username)) continue;
    seen.add(username);
    clean.push({
      username,
      name: String((u && u.name) || username).trim() || username,
    });
  }
  liveDirectory.set(peerId, { users: clean, lastSeen: Date.now() });
  pruneDirectory();
  return clean.length;
}

function liveAnnouncedUsers() {
  pruneDirectory();
  const map = new Map();
  for (const entry of liveDirectory.values()) {
    for (const u of entry.users || []) {
      map.set(u.username, {
        username: u.username,
        name: u.name || u.username,
        createdAt: null,
        registered: false,
        live: true,
        seed: false,
      });
    }
  }
  return map;
}

function listUsers() {
  const map = new Map();

  // 1) Seed file (always in the repo — survives Render wipes)
  const seed = readJson(path.join(WWW, "seed-users.json"), []);
  for (const u of seed) {
    if (!u || !u.username) continue;
    const username = String(u.username).toLowerCase();
    if (isTombstoned(username)) continue;
    map.set(username, {
      username,
      name: u.name || username,
      createdAt: null,
      registered: false,
      seed: true,
      live: false,
    });
  }

  // 2) Usernames announced by any PC that is currently open (RAM only)
  for (const [username, u] of liveAnnouncedUsers()) {
    if (isTombstoned(username)) continue;
    const prev = map.get(username) || {};
    map.set(username, {
      ...prev,
      ...u,
      name: u.name || prev.name || username,
      seed: Boolean(prev.seed),
      live: true,
    });
  }

  // 3) Real logins still on disk (until free host wipes them)
  if (fs.existsSync(USERS_DIR)) {
    for (const d of fs.readdirSync(USERS_DIR, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const meta = readJson(metaPath(d.name), null);
      if (!meta) continue;
      if (isTombstoned(meta.username)) continue;
      map.set(meta.username, {
        username: meta.username,
        name: meta.name || meta.username,
        createdAt: meta.createdAt || null,
        registered: true,
        seed: false,
        live: Boolean(map.get(meta.username) && map.get(meta.username).live),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.registered !== b.registered) return a.registered ? -1 : 1;
    return a.username.localeCompare(b.username);
  });
}

function emptyProfile(name) {
  return {
    version: 1,
    name: name || "",
    createdAt: new Date().toISOString(),
    theme: "midnight",
    onboarded: true,
    settings: {},
    tasks: [],
    skills: [],
    updatedAt: new Date().toISOString(),
  };
}

function profileScore(p) {
  if (!p || typeof p !== "object") return 0;
  const tasks = (p.tasks || []).length;
  const skills = (p.skills || []).length;
  const updated = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
  return tasks * 10000 + skills * 5000 + updated;
}

function isEmptyProfile(p) {
  if (!p || typeof p !== "object") return true;
  return !(p.tasks || []).length && !(p.skills || []).length;
}

function pruneRoom(username) {
  const room = liveRooms.get(username);
  if (!room) return;
  const now = Date.now();
  for (const [id, peer] of room) {
    if (now - peer.lastSeen > PEER_TTL_MS) room.delete(id);
  }
  if (room.size === 0) liveRooms.delete(username);
}

function pickWinner(username) {
  pruneRoom(username);
  const room = liveRooms.get(username);
  if (!room || room.size === 0) return null;
  let best = null;
  let bestScore = -1;
  for (const peer of room.values()) {
    // Never let an empty Codex beat a real one
    if (best && !isEmptyProfile(best.profile) && isEmptyProfile(peer.profile)) {
      continue;
    }
    if ((!best || isEmptyProfile(best.profile)) && !isEmptyProfile(peer.profile)) {
      best = peer;
      bestScore = profileScore(peer.profile);
      continue;
    }
    const s = profileScore(peer.profile);
    if (s > bestScore) {
      best = peer;
      bestScore = s;
    } else if (s === bestScore && best) {
      const a = new Date(peer.updatedAt || 0).getTime();
      const b = new Date(best.updatedAt || 0).getTime();
      if (a > b) best = peer;
    }
  }
  return best;
}

function announcePresence(username, peerId, profile) {
  if (!liveRooms.has(username)) liveRooms.set(username, new Map());
  const room = liveRooms.get(username);
  const clean = profile && typeof profile === "object" ? { ...profile } : emptyProfile();
  delete clean.password;
  delete clean.passwordHash;
  room.set(peerId, {
    profile: clean,
    score: profileScore(clean),
    updatedAt: clean.updatedAt || new Date().toISOString(),
    lastSeen: Date.now(),
    name: clean.name || username,
  });
  const winner = pickWinner(username);
  const peers = liveRooms.get(username) ? liveRooms.get(username).size : 0;
  return {
    peers,
    youAreWinner: winner && winner === room.get(peerId),
    winner: winner ? winner.profile : clean,
    winnerScore: winner ? winner.score : profileScore(clean),
  };
}

function leavePresence(username, peerId) {
  const room = liveRooms.get(username);
  if (!room) return;
  room.delete(peerId);
  if (room.size === 0) liveRooms.delete(username);
}

function deleteUserAccount(username) {
  const u = safeUsername(username);
  if (!u) return false;
  const dir = userDir(u);
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to remove user dir", u, e);
      return false;
    }
  }
  // Drop all sessions for this user
  const sessions = loadSessions();
  let changed = false;
  for (const [token, s] of Object.entries(sessions)) {
    if (s.username === u) {
      delete sessions[token];
      changed = true;
    }
  }
  if (changed) saveSessions(sessions);
  // Drop live presence + directory mentions
  liveRooms.delete(u);
  for (const [peerId, entry] of liveDirectory) {
    entry.users = (entry.users || []).filter((x) => x.username !== u);
    if (!entry.users.length) liveDirectory.delete(peerId);
  }
  addTombstone(u);
  return true;
}

function send(res, status, data, headers = {}) {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    ...headers,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }

  if (pathname === "/api/health" && req.method === "GET") {
    let online = 0;
    for (const room of liveRooms.values()) online += room.size;
    send(res, 200, {
      ok: true,
      service: "kritX",
      users: listUsers().length,
      onlinePeers: online,
      storesLearningData: true,
    });
    return;
  }

  if (pathname === "/api/users" && req.method === "GET") {
    const users = listUsers();
    send(res, 200, {
      users,
      count: users.length,
      note: "Usernames from seed + online PCs + registered logins. Passwords never included. Learning data never stored.",
    });
    return;
  }

  // Unified live transfer: usernames + Codex (RAM only — same idea as user directory)
  if (pathname === "/api/heartbeat" && req.method === "POST") {
    const body = await readBody(req);
    const sess = sessionUser(req);
    const peerId =
      (sess && sess.token) ||
      String(body.peerId || "")
        .trim()
        .slice(0, 80) ||
      crypto.randomBytes(8).toString("hex");

    announceDirectory(peerId, body.users || []);

    // Propagate local deletes only for accounts already gone from disk
    // (DELETE /api/account is the primary tombstone path; this helps offline wipes).
    // Never tombstone an active registered login from a client-supplied list.
    if (Array.isArray(body.forgotten)) {
      for (const u of body.forgotten) {
        const name = safeUsername(u);
        if (!name) continue;
        if (!fs.existsSync(metaPath(name))) addTombstone(name);
      }
    }

    let presence = null;
    if (sess && body.profile && typeof body.profile === "object") {
      presence = announcePresence(sess.username, sess.token, body.profile);
    } else if (sess) {
      pruneRoom(sess.username);
      const winner = pickWinner(sess.username);
      const room = liveRooms.get(sess.username);
      presence = {
        peers: room ? room.size : 0,
        youAreWinner: false,
        winner: winner ? winner.profile : null,
        winnerScore: winner ? winner.score : 0,
      };
    }

    send(res, 200, {
      ok: true,
      peerId,
      users: listUsers(),
      presence,
      tombstones: activeTombstones(),
      storesLearningData: false,
      note: "Usernames + Codex move live between online PCs only. Nothing saved to disk.",
    });
    return;
  }

  // Live username directory — RAM only, shared while PCs are open
  if (pathname === "/api/directory" && req.method === "POST") {
    const body = await readBody(req);
    const sess = sessionUser(req);
    const peerId =
      (sess && sess.token) ||
      String(body.peerId || "")
        .trim()
        .slice(0, 80) ||
      crypto.randomBytes(8).toString("hex");
    const n = announceDirectory(peerId, body.users || []);
    send(res, 200, {
      ok: true,
      peerId,
      announced: n,
      users: listUsers(),
      storesLearningData: false,
    });
    return;
  }

  if (pathname === "/api/register" && req.method === "POST") {
    const body = await readBody(req);
    const username = safeUsername(body.username);
    const password = String(body.password || "");
    const name = String(body.name || body.username || "").trim();
    if (!username) {
      send(res, 400, {
        error: "Username must be 2–32 chars: letters, numbers, . _ -",
      });
      return;
    }
    if (password.length < 4) {
      send(res, 400, { error: "Password must be at least 4 characters." });
      return;
    }
    if (fs.existsSync(metaPath(username))) {
      send(res, 400, { error: "That username is already taken." });
      return;
    }
    // Explicit create clears delete tombstone
    accountTombstones.delete(username);
    const { salt, hash } = hashPassword(password);
    fs.mkdirSync(userDir(username), { recursive: true });
    writeJson(metaPath(username), {
      username,
      name: name || username,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    });
    const token = createSession(username);
    send(res, 200, {
      ok: true,
      token,
      username,
      name: name || username,
      profile: readUserProfile(username),
    });
    return;
  }

  if (pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const username = safeUsername(body.username);
    const password = String(body.password || "");
    if (!username || !password) {
      send(res, 400, { error: "Enter username and password." });
      return;
    }
    const meta = readJson(metaPath(username), null);
    if (!meta || !verifyPassword(password, meta.salt, meta.passwordHash)) {
      send(res, 401, { error: "Incorrect username or password." });
      return;
    }
    const token = createSession(username);
    send(res, 200, {
      ok: true,
      token,
      username,
      name: meta.name || username,
      profile: readUserProfile(username),
    });
    return;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const sess = sessionUser(req);
    if (sess) {
      leavePresence(sess.username, sess.token);
      const sessions = loadSessions();
      delete sessions[sess.token];
      saveSessions(sessions);
    }
    send(res, 200, { ok: true });
    return;
  }

  // Permanently delete this login account (meta + sessions). Learning data is local-only.
  if (pathname === "/api/account" && req.method === "DELETE") {
    const sess = sessionUser(req);
    if (!sess) {
      send(res, 401, { error: "Not logged in." });
      return;
    }
    const username = sess.username;
    leavePresence(username, sess.token);
    const ok = deleteUserAccount(username);
    if (!ok) {
      send(res, 500, { error: "Could not delete account." });
      return;
    }
    send(res, 200, { ok: true, deleted: username });
    return;
  }

  if (pathname === "/api/me" && req.method === "GET") {
    const sess = sessionUser(req);
    if (!sess) {
      send(res, 401, { error: "Not logged in." });
      return;
    }
    const meta = readJson(metaPath(sess.username), null);
    send(res, 200, {
      username: sess.username,
      name: (meta && meta.name) || sess.username,
      profile: null,
    });
    return;
  }

  // Live peer sync — RAM only, never written to disk
  if (pathname === "/api/presence" && req.method === "POST") {
    const sess = sessionUser(req);
    if (!sess) {
      send(res, 401, { error: "Not logged in." });
      return;
    }
    const body = await readBody(req);
    if (!body.profile || typeof body.profile !== "object") {
      send(res, 400, { error: "Missing local profile." });
      return;
    }
    const result = announcePresence(sess.username, sess.token, body.profile);
    send(res, 200, {
      ok: true,
      peers: result.peers,
      youAreWinner: result.youAreWinner,
      winner: result.winner,
      winnerScore: result.winnerScore,
      storesLearningData: false,
    });
    return;
  }

  if (pathname === "/api/presence" && req.method === "GET") {
    const sess = sessionUser(req);
    if (!sess) {
      send(res, 401, { error: "Not logged in." });
      return;
    }
    pruneRoom(sess.username);
    const winner = pickWinner(sess.username);
    const room = liveRooms.get(sess.username);
    send(res, 200, {
      peers: room ? room.size : 0,
      winner: winner ? winner.profile : null,
      storesLearningData: false,
    });
    return;
  }

  // Per-user Codex sync bridge (same username on every PC; paths may differ)
  if (pathname === "/api/profile" && req.method === "GET") {
    const sess = sessionUser(req);
    if (!sess) {
      send(res, 401, { error: "Sign in first." });
      return;
    }
    const profile = readUserProfile(sess.username);
    send(res, 200, {
      ok: true,
      username: sess.username,
      profile,
      storesLearningData: true,
      note: "Sync bridge for kritx-data/<username>/profile.json on each PC.",
    });
    return;
  }

  if (pathname === "/api/profile" && req.method === "PUT") {
    const sess = sessionUser(req);
    if (!sess) {
      send(res, 401, { error: "Sign in first." });
      return;
    }
    const body = await readBody(req);
    const incoming = body.profile;
    if (!incoming || typeof incoming !== "object") {
      send(res, 400, { error: "Missing profile." });
      return;
    }
    const existing = readUserProfile(sess.username);
    const inScore = profileScore(incoming);
    const exScore = profileScore(existing);
    const inTime = incoming.updatedAt ? new Date(incoming.updatedAt).getTime() : 0;
    const exTime = existing && existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;

    const emptyIn =
      !(incoming.tasks || []).length && !(incoming.skills || []).length;
    const emptyEx =
      !existing ||
      (!(existing.tasks || []).length && !(existing.skills || []).length);

    let winner = incoming;
    let saved = true;
    if (!emptyEx && emptyIn) {
      winner = existing;
      saved = false;
    } else if (
      existing &&
      (exScore > inScore || (exScore === inScore && exTime > inTime))
    ) {
      winner = existing;
      saved = false;
    } else {
      if (!incoming.updatedAt) incoming.updatedAt = new Date().toISOString();
      writeUserProfile(sess.username, incoming);
      winner = incoming;
    }

    send(res, 200, {
      ok: true,
      saved,
      profile: winner,
      score: profileScore(winner),
      storesLearningData: true,
    });
    return;
  }

  send(res, 404, { error: "Not found" });
}

function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (p === "/") p = "/index.html";
  const filePath = path.join(WWW, p);
  if (!filePath.startsWith(WWW)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const u = new URL(req.url || "/", `http://${host}`);
    if (u.pathname.startsWith("/api/")) {
      await handleApi(req, res, u.pathname);
      return;
    }
    serveStatic(req, res, u.pathname);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "Server error." });
  }
});

// Drop stale peers / directory entries so RAM never keeps offline data
setInterval(() => {
  for (const username of [...liveRooms.keys()]) pruneRoom(username);
  pruneDirectory();
  pruneTombstones();
}, 15000);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  kritX running → http://localhost:${PORT}`);
  console.log(`  User folders  → ${USERS_DIR}/<username>/profile.json (sync bridge)`);
  console.log(`  PC folders    → kritx-data/<username>/ (linked per browser)\n`);
});
