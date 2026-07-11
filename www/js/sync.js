/*
 * Sync — website auth + live peer sync.
 *
 * Learning data stays on each device. While PCs are online with the same
 * username, /api/presence shares the richest copy in RAM only — never disk.
 */

const AUTH_KEY = "kritx.auth.v1";

const Sync = {
  baseUrl: "",

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

  async listUsers() {
    const data = await this.request("/api/users", { auth: false });
    return data.users || [];
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
    return data;
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
    return data;
  },

  async logout() {
    try {
      await this.request("/api/logout", { method: "POST" });
    } catch (e) {
      /* ignore */
    }
    this.setAuth(null);
  },

  /** Announce this PC's local JSON; get the winning copy among online peers. */
  async presence(profile) {
    return this.request("/api/presence", {
      method: "POST",
      body: { profile },
    });
  },

  async presenceStatus() {
    return this.request("/api/presence");
  },

  async ping() {
    try {
      await this.listUsers();
      return true;
    } catch (e) {
      return false;
    }
  },
};
