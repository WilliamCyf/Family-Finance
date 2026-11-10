/* ============================================================
   FamFi — market.js
   Live market data. Every source is optional and works straight
   from the browser (no server):
   • US stocks & ETFs — Finnhub (free key), real-time US quotes.
   • US stocks & ETFs, past prices — Twelve Data (free key). Daily
     closes, fetched once a day per stock (charts, period returns).
   • Crypto — CoinGecko (no key), only for coins the family holds.
   • Exchange rates — European Central Bank via Frankfurter (no key,
     every working day, with history); ExchangeRate-API as a fallback.

   How often (FamFi is for checking in, not for watching tickers):
   prices update once an hour while the app is open; opening the app
   or coming back to it updates anything older than 15 minutes; a
   stock you're looking at or trading is kept within 5 minutes; and
   "Update" (or pulling down) on Home gets fresh prices on demand.
   US stock prices can't move while the market is shut, so once the
   closing prices are in, nights, weekends and holidays make no stock
   calls at all until the next opening bell. A source that fails is
   retried after 30 s, 2 min, 10 min, then hourly (and not at all
   while the phone is offline). Fewer updates means the phone's radio,
   processor and screen redraws rest.
   Keys live in js/config.js. Everything is cached on the device, so
   the app opens instantly and works offline. If a source is missing
   or unreachable, FamFi falls back to demo prices and says so.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const D = FF.data;
  const KEY = 'famfi.market.v1';
  const HIST_DAYS = 2100;                       // calendar days of FX history (covers every demo purchase)
  const TD_BARS = 1500;                         // trading days of stock history ≈ 6 years
  const MIN = 60 * 1000, HOUR = 60 * MIN;
  const PRICE_MS = HOUR;          // stock + crypto prices while the app is open
  const RESUME_MS = 15 * MIN;     // opening the app / coming back to it
  const FOCUS_MS = 5 * MIN;       // a stock you're looking at or trading
  const FOCUS_FOR = 10 * MIN;     // …for this long after you looked at it
  const TICK_MS = 5 * MIN;        // how often to check whether anything is due
  const MANUAL_GAP = MIN;         // "Update" at most once a minute (free API limits)
  const FX_MS = 12 * HOUR, CRYPTO_HIST_MS = 12 * HOUR;
  // Finnhub free: 60 calls/min. Twelve Data free: 8 credits/min, 800/day (1 credit per stock).
  const MAX_QUOTES_PER_RUN = 20, TD_BATCH = 8, TD_GAP_MS = 62 * 1000;

  let cache = { v: 1, fx: null, sym: {} };
  const status = { fx: null, crypto: null, quotes: null, history: null };   // {ok, at, err, …}
  const focusSet = {};             // sym → when it was last looked at
  const focused = (s) => Date.now() - (focusSet[s] || 0) < FOCUS_FOR;
  let started = false, focusTimer = null, manualAt = 0, fetched = 0;

  const ls = {
    get(k) { try { return root.localStorage ? root.localStorage.getItem(k) : null; } catch (e) { return null; } },
    set(k, v) { try { if (root.localStorage) root.localStorage.setItem(k, v); } catch (e) { /* full or blocked */ } }
  };
  /* API keys: js/config.js, or (for testing) localStorage "famfi.keys" */
  function keys() {
    let o = {};
    try { o = JSON.parse(ls.get('famfi.keys') || '{}') || {}; } catch (e) { o = {}; }
    const c = Object.assign({}, root.FF_CONFIG || {}, o);
    return { fh: String(c.finnhubKey || '').trim(), td: String(c.twelveDataKey || '').trim() };
  }

  /* ---------------- storage ---------------- */
  function load() {
    try { const c = JSON.parse(ls.get(KEY)); if (c && c.v === 1) cache = c; } catch (e) { /* first run */ }
    apply();
  }
  /* The cache holds years of daily prices: writing it is real work for a phone (turning it into
     text, then onto storage). Fresh quotes every 15–30 s are kept in memory and written at most
     once a minute, or when the app goes to the background; new history is written at once. */
  let saveT = null;
  function saveSoon() { if (!saveT) saveT = setTimeout(() => { saveT = null; save(); }, 60000); }
  if (root.document) root.document.addEventListener('visibilitychange', () => { if (root.document.hidden && saveT) { clearTimeout(saveT); saveT = null; save(); } });
  function save() {
    if (saveT) { clearTimeout(saveT); saveT = null; }
    try { root.localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {
      Object.keys(cache.sym).forEach((s) => { if (cache.sym[s].h) cache.sym[s].h = cache.sym[s].h.slice(-400); });
      ls.set(KEY, JSON.stringify(cache));
    }
  }
  /* [[day, close], …] → dense, forward-filled array */
  function dense(h) {
    if (!h || !h.length) return { d0: null, c: null };
    const d0 = h[0][0], d1 = h[h.length - 1][0];
    const c = new Array(d1 - d0 + 1);
    let k = 0, last = h[0][1];
    for (let d = d0; d <= d1; d++) {
      while (k < h.length && h[k][0] <= d) { last = h[k][1]; k++; }
      c[d - d0] = last;
    }
    return { d0, c };
  }
  function apply() {
    if (cache.fx && cache.fx.rates) D.setFX(cache.fx.rates, { src: cache.fx.src, date: cache.fx.date, at: cache.fx.at });
    if (cache.fxh && cache.fxh.s) D.setFXHistory(cache.fxh.s);
    Object.keys(cache.sym).forEach((sym) => {
      const e = cache.sym[sym];
      if (!e || !(e.p > 0) || !D.asset(sym)) return;
      const dd = dense(e.h);
      const isStock = D.asset(sym).t !== 'crypto';
      D.setLive(sym, { d0: dd.d0, c: dd.c, p: e.p, pc: e.pc, t: e.t, open: isStock ? liveNow(e, Date.now()) : true, delayed: 0, src: e.src, quoted: !!e.qAt });
    });
  }
  function entry(sym) { return cache.sym[sym] || (cache.sym[sym] = {}); }
  /* returns true only if the price actually moved (an unchanged price doesn't rebuild any screen) */
  function setQuote(sym, p, pc, tMs, src) {
    if (!(p > 0)) return false;
    const e = entry(sym);
    const npc = pc > 0 ? pc : (e.pc || p);
    const moved = e.p !== p || e.pc !== npc || !e.qAt;
    Object.assign(e, { p, pc: npc, t: tMs || Date.now(), src, qAt: Date.now() });
    fetched++;
    return moved;
  }
  function setHistory(sym, h, src) {
    if (!h || !h.length) return false;
    const e = entry(sym);
    e.h = h; e.hDay = FF.today(); e.hSrc = src;
    if (!e.qAt) { // no live quote yet: use the latest close until one arrives
      const n = h.length;
      e.p = h[n - 1][1]; e.pc = n > 1 ? h[n - 2][1] : e.p;
      e.t = (h[n - 1][0] + 1) * FF.DAY_MS - 4 * 3600 * 1000; e.src = src;
    }
    return true;
  }

  /* ---------------- parsers (pure; covered by tests/test_calc.js) ---------------- */
  // Finnhub /quote → {c: current, pc: previous close, t: unix secs}; unknown symbols return zeros
  function parseFinnhubQuote(j) {
    if (!j || !(j.c > 0)) return null;
    return { p: j.c, pc: j.pc > 0 ? j.pc : j.c, t: j.t ? j.t * 1000 : Date.now() };
  }
  // Twelve Data /time_series (one symbol → the series; several → {SYM: series})
  function parseTwelveData(j, symbols) {
    const out = {};
    const one = (s) => {
      if (!s || s.status !== 'ok' || !Array.isArray(s.values)) return null;
      return s.values.map((v) => [FF.fromISO(v.datetime), Math.round(parseFloat(v.close) * 10000) / 10000]).filter((x) => x[0] != null && x[1] > 0).sort((a, b) => a[0] - b[0]);
    };
    if (symbols.length === 1) { const h = one(j); if (h) out[symbols[0]] = h; }
    else symbols.forEach((s) => { const h = one(j && j[s]); if (h) out[s] = h; });
    return out;
  }
  /* "Live" needs both: inside the regular session by the clock AND a trade in the last 20 min
     (so market holidays and half-days show "Market closed" instead of a stale "Live") */
  /* "open": market hours now, and the price is from a trade in the last 3 hours (prices update
     about hourly; a weekday holiday has no trade today, so it shows as closed) */
  const liveNow = (e, now) => usMarketOpen(new Date(now)) && !!e.qAt && now - (e.t || 0) < 3 * HOUR;
  /* NYSE / Nasdaq regular session: Mon–Fri 9:30–16:00 New York time */
  /* minutes since 9:30 am New York on a weekday session (−1 when the market is closed) */
  function sessionMins(now) {
    try {
      const parts = {};
      new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false })
        .formatToParts(now).forEach((p) => { parts[p.type] = p.value; });
      if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return -1;
      const mins = (parseInt(parts.hour, 10) % 24) * 60 + parseInt(parts.minute, 10);
      return mins >= 570 && mins < 960 ? mins - 570 : -1;
    } catch (e) { return -1; }
  }
  const usMarketOpen = (now) => sessionMins(now) >= 0;
  /* when today's session opened (ms), or 0 if the market is closed */
  function sessionStart(nowMs) { const m = sessionMins(new Date(nowMs)); return m < 0 ? 0 : nowMs - m * MIN - (nowMs % MIN); }
  /* A US stock price that can't have moved since we fetched it:
     · the market is shut now, and we fetched it while shut, at least 15 min after its last
       trade (the closing price had settled) — nights, weekends: no calls until the opening bell;
     · or the market is "open" but we fetched it 30+ min after the bell and its last trade is
       still from before the bell — a weekday holiday (or a halted stock): wait for tomorrow. */
  function isFinal(e, now, opened) {
    const q = e.qAt || 0, tr = e.t || 0;
    if (!q) return false;
    if (!opened) return sessionMins(new Date(q)) < 0 && q - tr >= 15 * MIN;
    return q >= opened + 30 * MIN && tr < opened;
  }

  /* ---------------- fetching ---------------- */
  async function getJSON(url, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), ms || 12000) : null;
    try {
      const r = await fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
      const j = await r.json().catch(() => null);
      if (!r.ok) { const err = new Error((j && (j.error || j.message)) || 'HTTP ' + r.status); err.status = r.status; throw err; }
      return j;
    } finally { if (tm) clearTimeout(tm); }
  }
  /* one fetch at a time per source across all tabs/iframes on this device */
  function claim(name, ms) {
    const k = 'famfi.market.lock.' + name, now = Date.now();
    if (now - (+ls.get(k) || 0) < ms) return false;
    ls.set(k, String(now));
    return true;
  }

  /* a source that fails waits 30 s, 2 min, 10 min, then an hour before the next try (a Wi-Fi
     blip is fixed in seconds; a service that's down isn't asked again on every check) */
  const BACKOFF = [30 * 1000, 2 * MIN, 10 * MIN, HOUR];
  const fails = {};   // source → { n, until }
  let retryT = null;
  const waiting = (src) => !!fails[src] && Date.now() < fails[src].until;
  function failed(src) {
    const f = fails[src] || (fails[src] = { n: 0, until: 0 });
    f.until = Date.now() + BACKOFF[Math.min(f.n, BACKOFF.length - 1)];
    f.n++;
    // come back when the earliest wait is over (the 5-minute check would be too late for a blip)
    const next = Math.min.apply(null, Object.keys(fails).map((k) => fails[k].until));
    clearTimeout(retryT);
    retryT = setTimeout(() => { if (!root.document || !root.document.hidden) refresh(); }, Math.max(1000, next - Date.now() + 50));
  }
  const worked = (src) => { delete fails[src]; };
  const offline = () => root.navigator && root.navigator.onLine === false;

  async function refreshFX(force) {
    // (ECB rates change once per working day: every 12 hours is plenty)
    const want = D.DISPLAY_CURRENCIES.filter((c) => c !== 'MYR');
    if (!force && cache.fx && Date.now() - cache.fx.at < FX_MS) {
      const had = cache.fxh && cache.fxh.day;
      if (had !== FF.today()) await refreshFXHistory(want);
      return !!(cache.fxh && cache.fxh.day !== had);
    }
    if (waiting('fx') && !force) return false;
    if (!claim('fx', 15000) && !force) return false;
    try {
      const j = await getJSON('https://api.frankfurter.dev/v1/latest?from=MYR&to=' + want.join(','));
      cache.fx = { rates: j.rates, src: 'ecb', date: j.date, at: Date.now() };
    } catch (e) {
      try {
        const j = await getJSON('https://open.er-api.com/v6/latest/MYR');
        const rates = {};
        want.forEach((c) => { rates[c] = j.rates[c]; });
        cache.fx = { rates, src: 'erapi', date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10), at: Date.now() };
      } catch (e2) { status.fx = { ok: false, err: String(e2), at: Date.now() }; failed('fx'); return false; }
    }
    worked('fx');
    status.fx = { ok: true, at: Date.now(), src: cache.fx.src };
    D.setFX(cache.fx.rates, { src: cache.fx.src, date: cache.fx.date, at: cache.fx.at });
    await refreshFXHistory(want);
    return true;
  }
  async function refreshFXHistory(want) {
    if (cache.fxh && cache.fxh.day === FF.today()) return;
    if (waiting('fxh')) return; // it failed or came back empty: wait (30 s → 1 h), not on every check
    try {
      const j = await getJSON('https://api.frankfurter.dev/v1/' + FF.iso(FF.today() - HIST_DAYS) + '..?from=MYR&to=' + want.join(','), 20000);
      const s = Object.keys(j.rates || {}).sort().map((iso) => [FF.fromISO(iso), j.rates[iso]]);
      if (s.length) { cache.fxh = { day: FF.today(), s }; D.setFXHistory(s); worked('fxh'); } else failed('fxh');
    } catch (e) { failed('fxh'); /* keep converting at today's rate until it arrives */ }
  }

  /* coins anyone in the family holds (or has held), plus one being looked at */
  function wantedCoins() {
    const out = {}, st = FF.store && FF.store.state;
    if (st && st.members) Object.keys(st.members).forEach((id) => (st.members[id].pf.txns || []).forEach((t) => { const a = t.sym && D.asset(t.sym); if (a && a.cg) out[t.sym] = 1; }));
    Object.keys(focusSet).forEach((s) => { const a = D.asset(s); if (a && a.cg && focused(s)) out[s] = 1; });
    return D.ASSETS.filter((a) => a.cg && out[a.s]);
  }
  async function refreshCrypto(force, maxAge) {
    const coins = wantedCoins();
    if (!coins.length) return false;
    const age = (a) => Date.now() - ((cache.sym[a.s] || {}).qAt || 0);
    const fresh = coins.every((a) => age(a) < (focused(a.s) ? Math.min(maxAge, FOCUS_MS) : maxAge));
    if (!force && fresh) return false;
    if (waiting('crypto') && !force) return false;
    if (!claim('crypto', 20000) && !force) return false;
    try {
      const j = await getJSON('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true&ids=' + coins.map((a) => a.cg).join(','));
      let moved = false;
      for (const a of coins) {
        const q = j[a.cg];
        if (!q) continue;
        if (setQuote(a.s, q.usd, q.usd_24h_change != null ? q.usd / (1 + q.usd_24h_change / 100) : 0, q.last_updated_at ? q.last_updated_at * 1000 : 0, 'coingecko')) moved = true;
        const e = cache.sym[a.s];
        if (!e.h || Date.now() - (e.hAt || 0) > CRYPTO_HIST_MS) {
          try {
            const m = await getJSON('https://api.coingecko.com/api/v3/coins/' + a.cg + '/market_chart?vs_currency=usd&days=365&interval=daily');
            e.h = (m.prices || []).map((p) => [Math.floor(p[0] / FF.DAY_MS), Math.round(p[1] * 100) / 100]);
            e.hAt = Date.now(); moved = true;
          } catch (e3) { /* rate-limited: keep the old history */ }
        }
      }
      status.crypto = { ok: true, at: Date.now() };
      worked('crypto');
      return moved;
    } catch (e) { status.crypto = { ok: false, err: String(e), at: Date.now() }; failed('crypto'); return false; }
  }

  /* which stocks matter right now: mine first, then the rest of the family, then anything being looked at */
  function wanted() {
    const mine = {}, family = {};
    const st = FF.store && FF.store.state;
    if (st && st.members) Object.keys(st.members).forEach((id) => (st.members[id].pf.txns || []).forEach((t) => {
      const a = t.sym && D.asset(t.sym);
      if (!a || a.t === 'crypto') return;
      (id === st.meId ? mine : family)[t.sym] = 1;
    }));
    Object.keys(focusSet).forEach((s) => { const a = D.asset(s); if (a && a.t !== 'crypto' && focused(s)) mine[s] = 1; });
    Object.keys(mine).forEach((s) => { delete family[s]; });
    return { mine: Object.keys(mine), family: Object.keys(family) };
  }

  /* live quotes — Finnhub */
  async function refreshQuotes(force, maxAge) {
    const k = keys().fh;
    if (!k) { status.quotes = { ok: false, noKey: true, at: Date.now() }; return false; }
    if (status.quotes && status.quotes.badKey && !force) return false;
    const w = wanted(), now = Date.now(), opened = sessionStart(now);
    const due = (s) => {
      const e = cache.sym[s] || {}, q = e.qAt || 0;
      if (q && isFinal(e, now, opened)) return false;  // can't have moved: market shut (or a holiday) since we fetched
      if (force) return true;
      // older than allowed — or fetched before today's opening bell (first prices of the day come at once)
      return now - q > (focused(s) ? Math.min(maxAge, FOCUS_MS) : maxAge) || (opened && q < opened);
    };
    const list = w.mine.filter(due).concat(w.family.filter(due)).slice(0, MAX_QUOTES_PER_RUN);
    if (!list.length) return false;
    if (waiting('quotes') && !force) return false;
    if (!claim('quotes', 10000) && !force) return false;
    let ok = 0, bad = 0;
    let changed = false;
    for (let i = 0; i < list.length; i += 5) { // a few at a time, well under 60 calls/min
      const res = await Promise.allSettled(list.slice(i, i + 5).map((s) => getJSON('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(s) + '&token=' + encodeURIComponent(k))));
      res.forEach((r, n) => {
        const sym = list[i + n];
        if (r.status !== 'fulfilled') bad++;
        if (r.status === 'fulfilled') { ok++; const q = parseFinnhubQuote(r.value); if (q && setQuote(sym, q.p, q.pc, q.t, 'finnhub')) changed = true; }
        else if (r.reason && (r.reason.status === 401 || r.reason.status === 403)) {
          status.quotes = { ok: false, badKey: true, err: String(r.reason.message), at: Date.now() };
          if (root.console) console.warn('FamFi: Finnhub rejected the key in js/config.js —', r.reason.message);
        }
      });
      if (status.quotes && status.quotes.badKey) return changed;
    }
    if (!ok && bad) { failed('quotes'); status.quotes = { ok: false, err: 'unreachable', at: Date.now() }; return changed; }
    worked('quotes');
    status.quotes = { ok: true, at: Date.now() };
    return changed;
  }

  /* ---------------- dividends, worked out from real prices ----------------
     The free data plans don't include dividend lists, but Twelve Data gives prices both as
     traded and adjusted for dividends: the adjustment steps down by exactly one dividend on
     each ex-dividend day (adjusted = close × P / (P + dividend), P = the close before), so
     dividend = P × (1 / step − 1) — it matches declared dividends to the cent. One-off glitches are
     smoothed against the dividends either side; real special dividends (big jumps) stay. */
  function inferDividends(raw, adj) {
    const A = {};
    (adj || []).forEach((p) => { A[p[0]] = p[1]; });
    const ev = [];
    let prev = null;
    (raw || []).forEach((p) => {
      const a = A[p[0]];
      if (!(a > 0) || !(p[1] > 0)) return;
      const r = a / p[1];
      if (prev) { const f = prev.r / r; if (f > 0.8 && f < 0.99995) ev.push({ ex: p[0], dps: prev.c * (1 / f - 1) }); } // splits are far below 0.8
      prev = { r, c: p[1] };
    });
    return ev.map((e, i) => {
      // up to two dividends either side; only when they agree with each other is one corrected
      const nb = ev.slice(Math.max(0, i - 2), i).concat(ev.slice(i + 1, i + 3)).map((x) => x.dps).sort((x, y) => x - y);
      let dps = e.dps;
      if (nb.length >= 2) {
        const med = nb.length % 2 ? nb[(nb.length - 1) / 2] : (nb[nb.length / 2 - 1] + nb[nb.length / 2]) / 2;
        const agree = nb.every((v) => Math.abs(v - med) / med < 0.06);
        const off = Math.abs(dps - med) / med;
        if (agree && off > 0.08 && off < 0.6) dps = med;
      }
      return { ex: e.ex, dps: Math.round(dps * 10000) / 10000 };
    });
  }
  const DIV_EVERY = 3; // days between dividend checks per stock
  /* stocks and ETFs I hold (or held) — dividends are worked out only for these */
  function myDividendSyms() {
    const st = FF.store && FF.store.state, m = st && st.members && st.members[st.meId];
    const out = {};
    if (m && m.pf) m.pf.txns.forEach((t) => { const a = t.sym && D.asset(t.sym); if (a && a.t !== 'crypto' && (t.type === 'buy' || t.type === 'sell')) out[t.sym] = 1; });
    return Object.keys(out);
  }
  async function refreshDividends(k) {
    const due = myDividendSyms().filter((s) => { const e = cache.sym[s]; return e && e.h && e.hSrc === 'twelvedata' && (!e.dDay || FF.today() - e.dDay >= DIV_EVERY); });
    if (!due.length) return false;
    const batch = due.slice(0, TD_BATCH);
    const j = await getJSON('https://api.twelvedata.com/time_series?interval=1day&adjust=all&outputsize=520&symbol=' + encodeURIComponent(batch.join(',')) + '&apikey=' + encodeURIComponent(k), 30000);
    if (j && j.status === 'error') { const err = new Error(j.message || 'error'); err.status = j.code; throw err; }
    const got = parseTwelveData(j, batch);
    batch.forEach((s) => { const e = entry(s); if (got[s]) { e.divs = inferDividends(e.h, got[s]).map((x) => [x.ex, x.dps]); e.dDay = FF.today(); } });
    status.dividends = { ok: true, at: Date.now(), left: due.length - batch.length };
    if (due.length > batch.length) setTimeout(() => refresh(), TD_GAP_MS + 500);
    return true;
  }
  /* { SYM: [{ ex, dps }] } for ledger.dividendPlan */
  function dividends() {
    const out = {};
    Object.keys(cache.sym).forEach((s) => { const e = cache.sym[s]; if (e && e.divs && e.divs.length) out[s] = e.divs.map((d) => ({ ex: d[0], dps: d[1] })); });
    return out;
  }

  /* daily history — Twelve Data (one batch of ≤8 stocks per minute) */
  async function refreshHistory(force) {
    const k = keys().td;
    if (!k) { status.history = { ok: false, noKey: true, at: Date.now() }; return false; }
    if (status.history && status.history.badKey && !force) return false;
    const w = wanted();
    const need = w.mine.concat(w.family).filter((s) => { const e = cache.sym[s]; return !e || !e.h || e.hDay !== FF.today() || e.hSrc !== 'twelvedata'; });
    if (!need.length) {
      // history is up to date: use this minute's allowance for dividends instead
      if (!claim('history', TD_GAP_MS) && !force) return false;
      try { return await refreshDividends(k); } catch (e) { if (e.status === 429) setTimeout(() => refresh(), TD_GAP_MS + 500); return false; }
    }
    if (waiting('history') && !force) return false;
    if (!claim('history', TD_GAP_MS) && !force) return false;
    const batch = need.slice(0, TD_BATCH);
    try {
      const j = await getJSON('https://api.twelvedata.com/time_series?interval=1day&outputsize=' + TD_BARS + '&symbol=' + encodeURIComponent(batch.join(',')) + '&apikey=' + encodeURIComponent(k), 30000);
      if (j && j.status === 'error') { const err = new Error(j.message || 'error'); err.status = j.code; throw err; }
      const got = parseTwelveData(j, batch);
      let changed = false;
      Object.keys(got).forEach((s) => { if (setHistory(s, got[s], 'twelvedata')) changed = true; });
      status.history = { ok: true, at: Date.now(), left: need.length - batch.length };
      worked('history');
      if (need.length > batch.length) setTimeout(() => refresh(), TD_GAP_MS + 500); // next batch next minute
      return changed;
    } catch (e) {
      status.history = { ok: false, badKey: e.status === 401 || e.status === 403, err: String(e.message || e), at: Date.now() };
      if (status.history.badKey && root.console) console.warn('FamFi: Twelve Data rejected the key in js/config.js —', e.message);
      if (e.status === 429) setTimeout(() => refresh(), TD_GAP_MS + 500);
      else if (!status.history.badKey) failed('history');
      return false;
    }
  }

  /* ---------------- any other US stock or ETF (Finnhub symbol lookup) ----------------
     The built-in list covers popular names; search reaches every US-listed stock and ETF.
     Picking one turns it into an asset (name, type, sector, market, today's price) that is
     then saved with the portfolio that uses it, so every family phone knows it too. */
  const SECTOR_RULES = [
    [/semicon|chip|memory|technolog|software|internet|electronic|computer|cyber|cloud|innovation|robot|nasdaq|\bai\b/i, 'tech'],
    [/telecom|communication/i, 'telecom'], [/treasury|bond|t-bill/i, 'bonds'], [/gold|silver|precious/i, 'gold'],
    [/bitcoin|ether|crypto/i, 'crypto'], [/real estate|reit/i, 'property'], [/oil|gas|energy|coal|uranium/i, 'energy'],
    [/utilit/i, 'utilities'], [/bank|financ|insur|capital market|payment/i, 'banks'], [/pharma|biotech|health|medical|life science/i, 'health'],
    [/airline|logistic|road|rail|marine|transport|aerospace|defense|machinery|freight|industrial/i, 'transport'],
    [/media|retail|consumer|hotel|restaurant|leisure|auto|food|beverage|apparel|textile|tobacco|household|entertainment|gaming/i, 'consumer']
  ];
  const sectorFor = (text, fallback) => { const r = SECTOR_RULES.find((x) => x[0].test(text || '')); return r ? r[1] : fallback; };
  const marketFor = (ex) => (/nasdaq/i.test(ex || '') ? 'NASDAQ' : /arca/i.test(ex || '') ? 'NYSE Arca' : /american|mkt/i.test(ex || '') ? 'NYSE American' : /new york/i.test(ex || '') ? 'NYSE' : 'US');
  function tidyName(n) {
    let s = String(n || '').trim();
    if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|[\s(&/-])([a-z])/g, (m, a, c) => a + c.toUpperCase()).replace(/\b(Etf|Us|Usa|S&p|Ai|Spdr|Msci)\b/g, (w) => w.toUpperCase());
    s = s.replace(/[-\s]+cl(ass)?\s+[a-z]$/i, '').replace(/,?\s+(inc\.?|corp\.?|corporation|ltd\.?|plc|co\.?|n\.?v\.?|s\.?a\.?)$/i, '').trim();
    return s || String(n || '');
  }
  const lookups = {};
  /* → [{ s, n, t }] — US stocks and ETFs matching a ticker or name */
  async function searchUS(q) {
    const k = keys().fh;
    q = String(q || '').trim();
    if (!k || q.length < 2) return [];
    const key = q.toLowerCase();
    if (lookups[key]) return lookups[key];
    const j = await getJSON('https://finnhub.io/api/v1/search?q=' + encodeURIComponent(q) + '&exchange=US&token=' + encodeURIComponent(k));
    // real matches only: the ticker starts with it, or a word of the name does ("tsm" isn't Hun-tsm-an)
    const word = new RegExp('(^|[^a-z0-9])' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const out = ((j && j.result) || [])
      .filter((r) => /^[A-Z]{1,5}(\.[A-Z])?$/.test(r.symbol || '') && /common stock|etp|adr|reit/i.test(r.type || ''))
      .filter((r) => r.symbol.toLowerCase().indexOf(key) === 0 || word.test(String(r.description || '').toLowerCase()))
      .slice(0, 10).map((r) => ({ s: r.symbol, n: tidyName(r.description), t: /etp/i.test(r.type) ? 'etf' : 'stock' }));
    lookups[key] = out;
    return out;
  }
  /* look one up properly (profile + today's price) and add it to the catalogue */
  async function addUS(sym, hint) {
    hint = hint || {};
    if (D.asset(sym)) return D.asset(sym);
    const k = keys().fh;
    if (!k) { const e = new Error('no-key'); e.code = 'no-key'; throw e; }
    const etf = hint.t === 'etf';
    const [prof, quote] = await Promise.all([
      etf ? Promise.resolve({}) : getJSON('https://finnhub.io/api/v1/stock/profile2?symbol=' + encodeURIComponent(sym) + '&token=' + encodeURIComponent(k)).catch(() => ({})),
      getJSON('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(sym) + '&token=' + encodeURIComponent(k))
    ]);
    const q = parseFinnhubQuote(quote);
    if (!q) { const e = new Error('no-price'); e.code = 'no-price'; throw e; }
    const name = tidyName((prof && prof.name) || hint.n || sym);
    const a = D.addAsset({ s: sym, n: name, t: etf ? 'etf' : 'stock', sec: etf ? sectorFor(name, 'broad') : sectorFor((prof && prof.finnhubIndustry) + ' ' + name, 'other'), x: marketFor(prof && prof.exchange), c: 'USD', p: q.p });
    setQuote(sym, q.p, q.pc, q.t, 'finnhub');
    save(); apply();
    focus(sym); // past prices follow (Twelve Data)
    FF.emit('market', summary());
    return a;
  }

  /* opts.maxAge: how old a price may be before it's fetched again (default: an hour) */
  async function refresh(force, opts) {
    if (offline()) { FF.emit('market-status', summary()); return summary(); } // no radio wake-ups for nothing
    const maxAge = (opts && opts.maxAge) || PRICE_MS;
    const f0 = fetched;
    const results = await Promise.all([refreshFX(force), refreshCrypto(force, maxAge), refreshQuotes(force, maxAge), refreshHistory(force)]);
    if (results.some(Boolean)) { if (results[0] || results[3]) save(); else saveSoon(); apply(); FF.emit('market', summary()); }
    else { if (fetched !== f0) { saveSoon(); apply(); } FF.emit('market-status', summary()); } // same prices: just the "updated" time
    return summary();
  }
  /* "Update" on Home: fresh prices now (at most once a minute — the free APIs have limits) */
  async function update() {
    if (offline()) return { ok: false, offline: true, summary: summary() };
    if (Date.now() - manualAt < MANUAL_GAP) return { ok: true, recent: true, summary: summary() };
    manualAt = Date.now();
    Object.keys(fails).forEach((k) => { fails[k].until = 0; }); // you asked: try everything now
    const now = Date.now(), opened = sessionStart(now), w = wanted();
    const syms = w.mine.concat(w.family).filter((x) => cache.sym[x] && cache.sym[x].qAt);
    const final = !opened && syms.length > 0 && syms.every((x) => isFinal(cache.sym[x], now, opened));
    const s = await refresh(false, { maxAge: 30 * 1000 });
    return { ok: !(status.quotes && status.quotes.ok === false && !status.quotes.noKey), final, summary: s };
  }
  /* a screen is showing this stock: get its live price and history soon */
  function focus(sym) {
    const a = D.asset(sym);
    if (!a) return;
    const was = focused(sym);
    focusSet[sym] = Date.now();
    if (was) return;
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => refresh(), 300);
  }

  /* ---------------- status for the UI ---------------- */
  function summary() {
    const syms = Object.keys(D.LIVE);
    const stockSyms = syms.filter((s) => D.asset(s) && D.asset(s).t !== 'crypto');
    const quoted = stockSyms.filter((s) => (cache.sym[s] || {}).qAt);
    const latest = (quoted.length ? quoted : stockSyms.length ? stockSyms : syms).reduce((m, s) => Math.max(m, D.LIVE[s].t || 0), 0);
    const k = keys();
    return {
      fxLive: D.fxInfo.live, fxSrc: D.fxInfo.src, fxDate: D.fxInfo.date,
      stocksLive: quoted.length > 0, stocksHistory: stockSyms.some((s) => D.LIVE[s].c),
      cryptoLive: syms.some((s) => D.asset(s) && D.asset(s).t === 'crypto'),
      anyOpen: quoted.some((s) => liveNow(cache.sym[s], Date.now())),
      online: typeof navigator === 'undefined' || navigator.onLine !== false,
      keys: { finnhub: !!k.fh, twelveData: !!k.td },
      latest, status
    };
  }
  function ready(ms) {
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(summary()); } };
      refresh(false, { maxAge: RESUME_MS }).then(fin, fin);
      setTimeout(fin, ms || 2500);
    });
  }
  function start() {
    if (started) return;
    started = true;
    refresh(false, { maxAge: RESUME_MS });
    setInterval(() => { if (!document.hidden) refresh(); }, TICK_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false, { maxAge: RESUME_MS }); });
    root.addEventListener('online', () => refresh(false, { maxAge: RESUME_MS }));
    root.addEventListener('storage', (e) => { if (e.key === KEY) { load(); FF.emit('market', summary()); } });
  }

  FF.market = { load, start, refresh, update, ready, isFinal, sessionStart, summary, focus, status, keys, usMarketOpen, liveNow, parseFinnhubQuote, parseTwelveData, searchUS, addUS, tidyName, sectorFor, marketFor, applyCached: () => apply(), inferDividends, dividends, get cache() { return cache; } };
})(typeof window !== 'undefined' ? window : this);
