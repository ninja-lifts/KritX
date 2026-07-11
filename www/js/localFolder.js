/**
 * LocalFolder — store Codex on YOUR PC in a folder you choose.
 *
 * Chrome / Edge: File System Access API (pick folder → Allow → read/write).
 * Nothing is written to the kritX server disk — only this folder + browser cache.
 * Put the folder in OneDrive/Google Drive to share the same files across PCs,
 * or use live peer sync while both browsers are open.
 */

const LocalFolder = {
  DB_NAME: "kritx.localFolder.v1",
  STORE: "handles",
  _dirHandle: null,
  _userDirHandle: null,
  _label: null,

  supported() {
    return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
  },

  async _idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.STORE)) db.createObjectStore(this.STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async _idbGet(key) {
    const db = await this._idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, "readonly");
      const r = tx.objectStore(this.STORE).get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  },

  async _idbSet(key, value) {
    const db = await this._idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, "readwrite");
      tx.objectStore(this.STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async _idbDel(key) {
    const db = await this._idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, "readwrite");
      tx.objectStore(this.STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async _ensurePermission(handle, mode = "readwrite") {
    if (!handle) return false;
    const opts = { mode };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if ((await handle.requestPermission(opts)) === "granted") return true;
    return false;
  },

  status() {
    return {
      supported: this.supported(),
      linked: Boolean(this._dirHandle),
      label: this._label || null,
    };
  },

  /** Restore previously linked folder (may need a user gesture to re-grant). */
  async restore() {
    if (!this.supported()) return { ok: false, reason: "unsupported" };
    try {
      const saved = await this._idbGet("root");
      if (!saved || !saved.handle) return { ok: false, reason: "none" };
      const ok = await this._ensurePermission(saved.handle, "readwrite");
      if (!ok) return { ok: false, reason: "permission", handle: saved.handle };
      this._dirHandle = saved.handle;
      this._label = saved.label || "Linked folder";
      this._userDirHandle = null;
      return { ok: true, label: this._label };
    } catch (e) {
      return { ok: false, reason: e.message || "restore failed" };
    }
  },

  /**
   * Ask user to pick (or create) a parent folder on this PC.
   * We create/use kritx-data inside it for all accounts on this browser.
   */
  async pickAndLink() {
    if (!this.supported()) {
      throw new Error(
        "This browser can't link a PC folder. Use Chrome or Edge, or Export/Import a .json backup."
      );
    }
    const root = await window.showDirectoryPicker({
      id: "kritx-data",
      mode: "readwrite",
      startIn: "documents",
    });
    const ok = await this._ensurePermission(root, "readwrite");
    if (!ok) throw new Error("Permission denied — allow folder access to store your Codex.");

    // Ensure a clear top-level folder name the user can find later
    const dataDir = await root.getDirectoryHandle("kritx-data", { create: true });
    try {
      const readme = await dataDir.getFileHandle("README.txt", { create: true });
      const w = await readme.createWritable();
      await w.write(
        "kritX data folder\n\n" +
          "Each subfolder is one username (tasks, Codex, skills).\n" +
          "Copy this whole kritx-data folder to another PC (or put it in OneDrive/Google Drive)\n" +
          "and link it there to sync. The kritX server does NOT store this learning data.\n"
      );
      await w.close();
    } catch (e) {
      /* readme optional */
    }

    this._dirHandle = dataDir;
    this._userDirHandle = null;
    this._label = "kritx-data (inside the folder you chose)";
    await this._idbSet("root", { handle: dataDir, label: this._label, at: Date.now() });
    return { ok: true, label: this._label };
  },

  async unlink() {
    this._dirHandle = null;
    this._userDirHandle = null;
    this._label = null;
    await this._idbDel("root");
  },

  async _userDir(username, create = true) {
    if (!this._dirHandle) return null;
    const u = String(username || "")
      .trim()
      .toLowerCase();
    if (!u) return null;
    if (!(await this._ensurePermission(this._dirHandle, "readwrite"))) {
      throw new Error("Folder permission lost — link your data folder again in Settings.");
    }
    this._userDirHandle = await this._dirHandle.getDirectoryHandle(u, { create });
    return this._userDirHandle;
  },

  async readProfile(username) {
    try {
      const dir = await this._userDir(username, false);
      if (!dir) return null;
      const fileHandle = await dir.getFileHandle("profile.json");
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      return data && typeof data === "object" ? data : null;
    } catch (e) {
      return null;
    }
  },

  async writeProfile(username, profile) {
    if (!this._dirHandle) return false;
    const dir = await this._userDir(username, true);
    if (!dir) return false;
    const fileHandle = await dir.getFileHandle("profile.json", { create: true });
    const w = await fileHandle.createWritable();
    await w.write(JSON.stringify(profile, null, 2));
    await w.close();
    return true;
  },

  async listUsernames() {
    if (!this._dirHandle) return [];
    if (!(await this._ensurePermission(this._dirHandle, "readwrite"))) return [];
    const names = [];
    for await (const [name, handle] of this._dirHandle.entries()) {
      if (handle.kind === "directory" && name && !name.startsWith(".")) {
        names.push(name.toLowerCase());
      }
    }
    return names.sort();
  },

  /** Path hint shown in UI (browsers don't expose full OS path). */
  pathHint(username) {
    const u = (username || "").toLowerCase() || "<username>";
    return `…/kritx-data/${u}/profile.json`;
  },
};
