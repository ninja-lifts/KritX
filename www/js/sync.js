/*
 * Sync — website auth + live peer sync + live username directory.
 *
 * Learning data stays on each device (never saved on server disk).
 * Usernames are shared while PCs are online (RAM directory) + seed file.
 * If the host wiped logins, loginOrReclaim recreates the account automatically.
 */

const AUTH_KEY = "kritx.auth.v1";
const PEER_ID_KEY = "kritx.peerId.v1";
const KNOWN_USERS_KEY = "kritx.knownUsers.v1";

const Sync = {
  baseUrl: "",

  peerId() {
    let id = localStorage.getItem(PEER_ID_KEY);
    if (!id) {
      id =
        "p_" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 10);
      localStorage.setItem(PEER_ID_KEY, id);
    }
    return id;
  },

  getAuth() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY)) || null;
    } catch (e) {
      return null;
    }
  },

  setAuth(auth) {
    if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else localStorage.removeItem(AUTH_KEY);
  },

  token() {
    const a = this.getAuth();
    return a && a.token ? a.token : null;
  },

  username() {
    const a = this.getAuth();
    return a && a.username ? a.username : null;
  },

  async request(path, { method = "GET", body, auth = true } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth && this.token()) headers.Authorization = "Bearer " + this.token();
    const res = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) {
      const err = new Error(data.error || "Request failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  knownUsers() {
    try {
      return JSON.parse(localStorage.getItem(KNOWN_USERS_KEY) || "[]");
    } catch (e) {
      return [];
    }
  },

  rememberUser(username, name) {
    const u = String(username || "")
      .trim()
      .toLowerCase();
    if (!u) return;
    try {
      const list = this.knownUsers();
      const map = new Map(list.map((x) => [x.username, x]));
      map.set(u, {
        username: u,
        name: name || u,
        seenAt: new Date().toISOString(),
      });
      localStorage.setItem(KNOWN_USERS_KEY, JSON.stringify(Array.from(map.values())));
    } catch (e) {
      /* ignore */
    }
  },

  collectLocalUsernames() {
    const map = new Map();
    for (const u of this.knownUsers()) {
      if (u && u.username) map.set(u.username, { username: u.username, name: u.name || u.username });
    }
    if (typeof Store !== "undefined" && Store.listLocalUsers) {
      for (const u of Store.listLocalUsers()) {
        map.set(u.username, {
          username: u.username,
          name: u.name || u.username,
        });
      }
    }
    if (this.username()) {
      const a = this.getAuth();
      map.set(this.username(), {
        username: this.username(),
        name: (a && a.name) || this.username(),
      });
    }
    return Array.from(map.values());
  },

  /**
   * One live transfer pulse — same path for usernames + Codex.
   * Server keeps both in RAM only while PCs are online.
   */
  async heartbeat({ profile } = {}) {
    const data = await this.request("/api/heartbeat", {
      method: "POST",
      auth: Boolean(this.token()),
      body: {
        peerId: this.peerId(),
        users: this.collectLocalUsernames(),
        profile: profile || undefined,
      },
    });
    if (data.users) {
      for (const u of data.users) this.rememberUser(u.username, u.name);
    }
    return data;
  },

  async announceDirectory() {
    try {
      const data = await this.heartbeat();
      return data.users || [];
    } catch (e) {
      return [];
    }
  },

  async listUsers() {
    let users = [];
    try {
      users = await this.announceDirectory();
    } catch (e) {
      users = [];
    }
    if (!users.length) {
      try {
        const data = await this.request("/api/users", { auth: false });
        users = data.users || [];
      } catch (e) {
        users = [];
      }
    }
    try {
      const seedRes = await fetch(this.baseUrl + "/seed-users.json");
      if (seedRes.ok) {
        const seed = await seedRes.json();
        const map = new Map(users.map((u) => [u.username, u]));
        for (const u of seed || []) {
          if (!u || !u.username) continue;
          const username = String(u.username).toLowerCase();
          if (!map.has(username)) {
            map.set(username, {
              username,
              name: u.name || username,
              registered: false,
              seed: true,
            });
          }
        }
        users = Array.from(map.values());
      }
    } catch (e) {
      /* ignore */
    }
    for (const u of users) this.rememberUser(u.username, u.name);
    return users;
  },

  async presence(profile) {
    const data = await this.heartbeat({ profile });
    const p = data.presence || {};
    return {
      ok: true,
      peers: p.peers || 1,
      youAreWinner: Boolean(p.youAreWinner),
      winner: p.winner,
      winnerScore: p.winnerScore || 0,
      users: data.users || [],
      storesLearningData: false,
    };
  },

  async presenceStatus() {
    return this.presence(null);
  },

  async register({ username, password, name }) {
    const data = await this.request("/api/register", {
      method: "POST",
      auth: false,
      body: { username, password, name },
    });
    this.setAuth({
      token: data.token,
      username: data.username,
      name: data.name,
    });
    this.rememberUser(data.username, data.name);
    await this.announceDirectory();
    return { ...data, reclaimed: false };
  },

  async login({ username, password }) {
    const data = await this.request("/api/login", {
      method: "POST",
      auth: false,
      body: { username, password },
    });
    this.setAuth({
      token: data.token,
      username: data.username,
      name: data.name,
    });
    this.rememberUser(data.username, data.name);
    await this.announceDirectory();
    return { ...data, reclaimed: false };
  },

  /**
   * Login normally. If the host wiped accounts, recreate the same username
   * with the same password automatically (local Codex stays on this PC).
   */
  async loginOrReclaim({ username, password, name }) {
    try {
      return await this.login({ username, password });
    } catch (e) {
      if (e.status !== 401 && e.status !== 400) throw e;
      try {
        const data = await this.register({
          username,
          password,
          name: name || username,
        });
        return { ...data, reclaimed: true };
      } catch (e2) {
        // Race: someone else just reclaimed — try login again
        if (/taken|already/i.test(e2.message || "")) {
          return await this.login({ username, password });
        }
        throw e;
      }
    }
  },

  async logout() {
    try {
      await this.request("/api/logout", { method: "POST" });
    } catch (e) {
      /* ignore */
    }
    this.setAuth(null);
  },

  async ping() {
    try {
      await this.request("/api/users", { auth: false });
      return true;
    } catch (e) {
      return false;
    }
  },
};
