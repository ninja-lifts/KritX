/*
 * Live — real-time market signals.
 *
 * The curated dataset gives structure (domains, learning paths, pay ranges).
 * This module layers LIVE, constantly-changing market data on top of it, pulled
 * from public sources that update in real time and work directly from the app
 * (CORS-friendly, no key needed):
 *
 *   • Hacker News (Algolia)  → hiring/discussion volume in the last 30 days vs
 *                              the prior 30 days = real momentum / trend.
 *   • GitHub Search          → number of open-source repos = how much is being
 *                              built with a skill right now (popularity).
 *   • Stack Overflow         → question volume = developer interest/activity.
 *
 * Optional (real jobs + real salaries, needs a free key set in Profile):
 *   • Adzuna                 → live open-job count and median salary for your
 *                              country.
 *
 * Everything is cached on-device so the app stays fast and works offline; when
 * offline it falls back to the last live snapshot, then the curated data.
 */

const Live = {
  KEY: "kritx.live.v2",
  TTL: 1000 * 60 * 60 * 12, // 12h freshness
  cache: null,

  _queue: [],
  _running: false,

  load() {
    try {
      this.cache = JSON.parse(localStorage.getItem(this.KEY)) || {};
    } catch (e) {
      this.cache = {};
    }
  },
  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.cache));
    } catch (e) {}
  },

  adzunaCfg() {
    const s = (Store.profile && Store.profile.settings) || {};
    return {
      id: (s.adzunaId || "").trim(),
      key: (s.adzunaKey || "").trim(),
      country: (s.adzunaCountry || "gb").trim().toLowerCase(),
    };
  },
  hasAdzuna() {
    const c = this.adzunaCfg();
    return !!(c.id && c.key);
  },

  fresh(q) {
    if (!this.cache) this.load();
    const c = this.cache[q];
    return c && Date.now() - c.ts < this.TTL ? c : null;
  },
  cached(q) {
    if (!this.cache) this.load();
    return this.cache[q] || null;
  },

  // throttled fetch queue (protects rate limits, esp. GitHub search: 10/min)
  _enq(fn, gap) {
    return new Promise((resolve) => {
      this._queue.push({ fn, gap: gap || 250, resolve });
      this._pump();
    });
  },
  async _pump() {
    if (this._running) return;
    this._running = true;
    while (this._queue.length) {
      const job = this._queue.shift();
      let out = null;
      try {
        out = await job.fn();
      } catch (e) {
        out = null;
      }
      job.resolve(out);
      await new Promise((r) => setTimeout(r, job.gap));
    }
    this._running = false;
  },

  async _json(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("bad status");
    return r.json();
  },

  _hnUrl(query, from, to) {
    let nf = `created_at_i>${from}`;
    if (to) nf += `,created_at_i<${to}`;
    return `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
      query
    )}&tags=comment&numericFilters=${nf}&hitsPerPage=0`;
  },

  _score(r) {
    const gh = Math.log10((r.repos || 0) + 1); // ~0–6
    const hn = Math.log10((r.hiringNow || 0) + 1); // ~0–3
    const so = Math.log10((r.soQuestions || 0) + 1); // ~0–6
    let idx = (gh / 6) * 40 + (hn / 2.6) * 30 + (so / 6) * 30;
    idx = Math.max(0, Math.min(100, Math.round(idx)));
    r.demandIndex = idx;

    let trend = "stable";
    if (r.hiringPrev > 0 && r.hiringNow != null) {
      const ratio = r.hiringNow / r.hiringPrev;
      r.momentum = Math.round((ratio - 1) * 100);
      if (ratio >= 1.4) trend = "rising";
      if (ratio >= 2.1) trend = "hot";
      if (ratio <= 0.7) trend = "cooling";
    }
    if (idx >= 75 && (trend === "stable" || trend === "rising")) trend = "hot";
    r.trend = trend;
    r.demandLabel =
      idx >= 75 ? "Very high" : idx >= 55 ? "High" : idx >= 35 ? "Moderate" : "Emerging";
    return r;
  },

  /* Lightweight, list-friendly signal: HN momentum only (cheap + generous).
     Returns { trend, hiringNow, momentum, live } or cached/null. */
  async trend(query, { force = false } = {}) {
    if (!force) {
      const f = this.fresh(query);
      if (f && f.trend) return f;
    }
    const now = Math.floor(Date.now() / 1000);
    const d30 = now - 30 * 86400;
    const d60 = now - 60 * 86400;
    const base = this.cached(query) || { query };
    const r = { ...base, query, ts: Date.now() };

    const a = await this._enq(() => this._json(this._hnUrl(query, d30)), 200);
    if (a) {
      r.hiringNow = a.nbHits;
      r.live = true;
    }
    const b = await this._enq(() => this._json(this._hnUrl(query, d60, d30)), 200);
    if (b) r.hiringPrev = b.nbHits;

    this._score(r);
    if (r.live) {
      this.cache[query] = r;
      this.save();
    }
    return r;
  },

  /* Full, detail-page signal: GitHub + HN momentum + Stack Overflow, and
     optionally real jobs + salary from Adzuna. */
  async full(query, { force = false, salary = true } = {}) {
    if (!force) {
      const f = this.fresh(query);
      if (f && f.demandIndex != null && (!salary || f.salaryChecked || !this.hasAdzuna()))
        return f;
    }
    const now = Math.floor(Date.now() / 1000);
    const d30 = now - 30 * 86400;
    const d60 = now - 60 * 86400;
    const r = { query, ts: Date.now(), live: false };

    // GitHub repos (throttle hard — search API is 10/min unauth)
    const g = await this._enq(
      () =>
        this._json(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(
            query
          )}&per_page=1`
        ),
      1200
    );
    if (g && typeof g.total_count === "number") {
      r.repos = g.total_count;
      r.live = true;
    }

    // HN momentum
    const a = await this._enq(() => this._json(this._hnUrl(query, d30)), 200);
    if (a) {
      r.hiringNow = a.nbHits;
      r.live = true;
    }
    const b = await this._enq(() => this._json(this._hnUrl(query, d60, d30)), 200);
    if (b) r.hiringPrev = b.nbHits;

    // Stack Overflow interest
    const s = await this._enq(
      () =>
        this._json(
          `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=activity&q=${encodeURIComponent(
            query
          )}&site=stackoverflow&filter=total`
        ),
      200
    );
    if (s && typeof s.total === "number") {
      r.soQuestions = s.total;
      r.live = true;
    }

    // Adzuna real jobs + salary (optional)
    if (salary && this.hasAdzuna()) {
      const c = this.adzunaCfg();
      r.salaryChecked = true;
      r.adzunaCountry = c.country;
      const sr = await this._enq(
        () =>
          this._json(
            `https://api.adzuna.com/v1/api/jobs/${c.country}/search/1?app_id=${encodeURIComponent(
              c.id
            )}&app_key=${encodeURIComponent(c.key)}&what=${encodeURIComponent(
              query
            )}&results_per_page=1&content-type=application/json`
          ),
        300
      );
      if (sr && typeof sr.count === "number") {
        r.jobs = sr.count;
        r.live = true;
      }
      const hist = await this._enq(
        () =>
          this._json(
            `https://api.adzuna.com/v1/api/jobs/${c.country}/histogram?app_id=${encodeURIComponent(
              c.id
            )}&app_key=${encodeURIComponent(c.key)}&what=${encodeURIComponent(query)}`
          ),
        300
      );
      if (hist && hist.histogram) {
        r.salaryMedian = this._median(hist.histogram);
      }
    }

    this._score(r);
    if (r.live) {
      this.cache[query] = r;
      this.save();
    }
    return r;
  },

  _median(hist) {
    // hist = { "20000": count, "30000": count, ... } → weighted median lower-bound
    const bins = Object.keys(hist)
      .map((k) => [Number(k), hist[k]])
      .filter(([k, v]) => !isNaN(k) && v > 0)
      .sort((a, b) => a[0] - b[0]);
    const total = bins.reduce((a, [, v]) => a + v, 0);
    if (!total) return null;
    let acc = 0;
    for (const [k, v] of bins) {
      acc += v;
      if (acc >= total / 2) return k;
    }
    return bins.length ? bins[bins.length - 1][0] : null;
  },
};

const CURRENCY = {
  gb: "£", us: "$", in: "₹", au: "A$", ca: "C$", de: "€", fr: "€", nl: "€",
  it: "€", es: "€", sg: "S$", za: "R", br: "R$", pl: "zł", nz: "NZ$", at: "€",
};

function liveCurrency(country) {
  return CURRENCY[(country || "gb").toLowerCase()] || "";
}

function fmtBig(n) {
  if (n == null) return "—";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}
