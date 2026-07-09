/**
 * kritX sync server
 *
 * Serves the app (www/) and a small API for multi-user accounts.
 * Passwords are stored as scrypt hashes only — never returned to clients.
 * Each user's learning data lives in data/users/<username>/profile.json
 * and syncs to every device that logs in with that username + password.
 *
 * Run:  npm run serve
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

fs.mkdirSync(USERS_DIR, { recursive: true });

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
  // prune expired
  const now = Date.now();
  for (const [t, s] of Object.entries(sessions)) {
    if (s.expires < now) delete sessions[t];
  }
  sessions[token] = {
    username,
    expires: now + 1000 * 60 * 60 * 24 * 30, // 30 days
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

function defaultProfile(name) {
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

  // Public: list usernames only (no passwords, no hashes)
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
    const profile = body.profile && typeof body.profile === "object"
      ? { ...body.profile, name: name || body.profile.name || username, onboarded: true }
      : defaultProfile(name || username);
    profile.updatedAt = new Date().toISOString();
    writeJson(profilePath(username), profile);
    const token = createSession(username);
    send(res, 200, {
      ok: true,
      token,
      username,
      name: name || username,
      profile,
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
    const profile = readJson(profilePath(username), defaultProfile(meta.name));
    const token = createSession(username);
    send(res, 200, {
      ok: true,
      token,
      username,
      name: meta.name || username,
      profile,
    });
    return;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const sess = sessionUser(req);
    if (sess) {
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
    const profile = readJson(profilePath(sess.username), defaultProfile(sess.username));
    send(res, 200, {
      username: sess.username,
      name: (meta && meta.name) || sess.username,
      profile,
    });
    return;
  }

  if (pathname === "/api/profile" && req.method === "GET") {
    const sess = sessionUser(req);
    if (!sess) {
      send(res, 401, { error: "Not logged in." });
      return;
    }
    const profile = readJson(profilePath(sess.username), defaultProfile(sess.username));
    send(res, 200, { profile });
    return;
  }

  if (pathname === "/api/profile" && req.method === "PUT") {
    const sess = sessionUser(req);
    if (!sess) {
      send(res, 401, { error: "Not logged in." });
      return;
    }
    const body = await readBody(req);
    if (!body.profile || typeof body.profile !== "object") {
      send(res, 400, { error: "Missing profile." });
      return;
    }
    // Never accept password fields into profile
    const profile = { ...body.profile };
    delete profile.password;
    delete profile.passwordHash;
    profile.onboarded = true;
    profile.updatedAt = new Date().toISOString();
    writeJson(profilePath(sess.username), profile);
    // keep display name in meta in sync
    const meta = readJson(metaPath(sess.username), null);
    if (meta && profile.name) {
      meta.name = profile.name;
      writeJson(metaPath(sess.username), meta);
    }
    send(res, 200, { ok: true, profile });
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  kritX running → http://localhost:${PORT}`);
  console.log(`  On your LAN  → http://<this-pc-ip>:${PORT}`);
  console.log(`  Users & data → ${USERS_DIR}\n`);
});
