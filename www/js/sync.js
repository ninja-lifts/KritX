/*
 * Sync — website auth + live peer sync + live username directory.
 *
 * Learning data stays on each device (never saved on server disk).
 * Usernames are shared while PCs are online (RAM directory) + seed file.
 * Explicit Delete account → forgotten tombstone (no auto-reclaim).
 * Host wipe (account missing, not forgotten) → loginOrReclaim can restore.
 */

const AUTH_KEY = "kritx.auth.v1";
const PEER_ID_KEY = "kritx.peerId.v1";
const KNOWN_USERS_KEY = "kritx.knownUsers.v1";
const FORGOTTEN_KEY = "kritx.forgottenUsers.v1";
const AUTH_EVENT_KEY = "kritx.authEvent.v1";

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

  /** Notify other tabs on this browser (logout / delete). */
  broadcastAuthEvent(type, username) {
    try {
      localStorage.setItem(
        AUTH_EVENT_KEY,
        JSON.stringify({ type, username: username || null, at: Date.now() })
      );
    } catch (e) {
      /* ignore */
    }
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

  forgottenUsers() {
    try {
      return JSON.parse(localStorage.getItem(FORGOTTEN_KEY) || "[]");
    } catch (e) {
      return [];
    }
  },

  isForgotten(username) {
    const u = String(username || "")
      .trim()
      .toLowerCase();
    return this.forgottenUsers().includes(u);
  },

  /** Remember a username for the login list — never undoes an explicit delete. */
  rememberUser(username, name) {
    const u = String(username || "")
      .trim()
      .toLowerCase();
    if (!u || this.isForgotten(u)) return;
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

  forgetUser(username) {
    const u = String(username || "")
      .trim()
      .toLowerCase();
    if (!u) return;
    try {
      const forgotten = new Set(this.forgottenUsers());
      forgotten.add(u);
      localStorage.setItem(FORGOTTEN_KEY, JSON.stringify(Array.from(forgotten)));
      const known = this.knownUsers().filter((x) => x.username !== u);
      localStorage.setItem(KNOWN_USERS_KEY, JSON.stringify(known));
    } catch (e) {
      /* ignore */
    }
  },

  unforgetUser(username) {
    const u = String(username || "")
      .trim()
      .toLowerCase();
    try {
      const next = this.forgottenUsers().filter((x) => x !== u);
      localStorage.setItem(FORGOTTEN_KEY, JSON.stringify(next));
    } catch (e) {
      /* ignore */
    }
  },

  filterForgotten(users) {
    const forgotten = new Set(this.forgottenUsers());
    return (users || []).filter((u) => u && u.username && !forgotten.has(u.username));
  },

  async deleteAccount() {
    const username = this.username();
    let data = { ok: false };
    try {
      data = await this.request("/api/account", {
        method: "DELETE",
        body: { tombstone: true },
      });
    } finally {
      this.setAuth(null);
      if (username) this.forgetUser(username);
      this.broadcastAuthEvent("deleted", username);
    }
    return data;
  },

  collectLocalUsernames() {
    const forgotten = new Set(this.forgottenUsers());
    const map = new Map();
    for (const u of this.knownUsers()) {
      if (u && u.username && !forgotten.has(u.username)) {
        map.set(u.username, { username: u.username, name: u.name || u.username });
      }
    }
    if (typeof Store !== "undefined" && Store.listLocalUsers) {
      for (const u of Store.listLocalUsers()) {
        if (forgotten.has(u.username)) continue;
        map.set(u.username, {
          username: u.username,
          name: u.name || u.username,
        });
      }
    }
    if (this.username() && !forgotten.has(this.username())) {
      const a = this.getAuth();
      map.set(this.username(), {
        username: this.username(),
        name: (a && a.name) || this.username(),
      });
    }
    return Array.from(map.values());
  },

  async heartbeat({ profile } = {}) {
    const me = this.username();
    const data = await this.request("/api/heartbeat", {
      method: "POST",
      auth: Boolean(this.token()),
      body: {
        peerId: this.peerId(),
        users: this.collectLocalUsernames(),
        profile: profile || undefined,
        forgotten: this.forgottenUsers(),
      },
    });
    // Apply peer delete tombstones from other devices
    let kicked = false;
    if (Array.isArray(data.tombstones)) {
      const tombs = new Set(
        data.tombstones.map((u) => String(u || "").toLowerCase()).filter(Boolean)
      );
      for (const u of tombs) {
        this.forgetUser(u);
        if (typeof Store !== "undefined" && Store.eraseAccountLocal) {
          Store.eraseAccountLocal(u);
        }
      }
      if (me && tombs.has(String(me).toLowerCase())) kicked = true;
    }
    if (data.users) {
      for (const u of this.filterForgotten(data.users)) {
        this.rememberUser(u.username, u.name);
      }
    }
    if (kicked) {
      this.setAuth(null);
      this.broadcastAuthEvent("deleted", me);
      if (typeof location !== "undefined") {
        location.hash = "#/home";
        location.reload();
      }
    }
    return data;
  },

  async announceDirectory() {
    try {
      const data = await this.heartbeat();
      return this.filterForgotten(data.users || []);
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
          if (this.isForgotten(username)) continue;
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
    users = this.filterForgotten(users);
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
      users: this.filterForgotten(data.users || []),
      storesLearningData: false,
    };
  },

  async presenceStatus() {
    return this.presence(null);
  },

  async register({ username, password, name }) {
    const u = String(username || "")
      .trim()
      .toLowerCase();
    const data = await this.request("/api/register", {
      method: "POST",
      auth: false,
      body: { username, password, name },
    });
    // Only clear delete flag after Create account succeeds
    this.unforgetUser(u);
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
    const u = String(username || "")
      .trim()
      .toLowerCase();
    const data = await this.request("/api/login", {
      method: "POST",
      auth: false,
      body: { username, password },
    });
    // Never unforget here — deleted accounts stay deleted until Create account
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
   * Login normally. Auto-reclaim only if host wiped the login AND this
   * browser did not explicitly delete the account.
   */
  async loginOrReclaim({ username, password, name }) {
    const u = String(username || "")
      .trim()
      .toLowerCase();
    // Check BEFORE any auth attempt — login must not undo Delete account
    if (this.isForgotten(u)) {
      const err = new Error(
        "This account was deleted on this device. Use Create account if you want it back."
      );
      err.status = 403;
      throw err;
    }
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
        if (/taken|already/i.test(e2.message || "")) {
          return await this.login({ username, password });
        }
        throw e;
      }
    }
  },

  async logout() {
    const username = this.username();
    try {
      await this.request("/api/logout", { method: "POST" });
    } catch (e) {
      /* ignore */
    }
    this.setAuth(null);
    this.broadcastAuthEvent("logout", username);
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
