/**
 * kritX server
 *
 * Serves the website + auth. Learning data is NEVER saved to disk.
 * Online PCs for the same username share via an in-memory presence room:
 * whichever peer has the richest/newest profile wins and is echoed to
 * all other PCs that are currently online. When everyone disconnects,
 * that RAM copy is gone.
 *
 * Disk only stores: password hashes (meta.json) + login sessions.
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

/** Delete leftover profile.json from older versions (learning data must not live on disk). */
function scrubSavedProfiles() {
  try {
    if (!fs.existsSync(USERS_DIR)) return;
    for (const name of fs.readdirSync(USERS_DIR)) {
      const p = path.join(USERS_DIR, name, "profile.json");
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (e) {
          /* ignore */
        }
      }
    }
  } catch (e) {
    /* ignore */
  }
}
scrubSavedProfiles();

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

function listUsers() {
  if (!fs.existsSync(USERS_DIR)) return [];
  return fs
    .readdirSync(USERS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const meta = readJson(metaPath(d.name), null);
      if (!meta) return null;
      return {
        username: meta.username,
        name: meta.name || meta.username,
        createdAt: meta.createdAt || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.username.localeCompare(b.username));
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

function send(res, status, data, headers = {}) {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
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
      storesLearningData: false,
    });
    return;
  }

  if (pathname === "/api/users" && req.method === "GET") {
    send(res, 200, { users: listUsers() });
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
    const { salt, hash } = hashPassword(password);
    fs.mkdirSync(userDir(username), { recursive: true });
    writeJson(metaPath(username), {
      username,
      name: name || username,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    });
    // Never save learning data — client keeps local JSON
    const token = createSession(username);
    send(res, 200, {
      ok: true,
      token,
      username,
      name: name || username,
      profile: null,
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
      profile: null,
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

  // Old mailbox endpoints — disabled (no disk learning data)
  if (pathname === "/api/profile") {
    send(res, 410, {
      error: "Server does not store learning data. Use live peer sync (/api/presence).",
      storesLearningData: false,
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

// Drop stale peers periodically so RAM never keeps offline data
setInterval(() => {
  for (const username of [...liveRooms.keys()]) pruneRoom(username);
}, 15000);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  kritX running → http://localhost:${PORT}`);
  console.log(`  Learning data → NEVER saved on server (live peer sync only)`);
  console.log(`  Auth only    → ${USERS_DIR}\n`);
});
