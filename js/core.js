/* ============================================================
   FamFi — core.js
   Namespace, tiny utilities, day-number dates, seeded random,
   and a minimal event bus. No DOM here (runs in jsc tests too).
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};

  /* ---------- dates as integer "day numbers" (days since 1970-01-01) ---------- */
  const DAY_MS = 86400000;
  const dayOfDate = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
  const fromYMD = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
  const ymd = (n) => { const d = new Date(n * DAY_MS); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay() }; };
  const today = () => (FF.todayOverride != null ? FF.todayOverride : dayOfDate(new Date()));
  // a local Date at noon for Intl formatting (avoids TZ edge flips)
  const dayToDate = (n) => { const p = ymd(n); return new Date(p.y, p.m - 1, p.d, 12); };
  const iso = (n) => { const p = ymd(n); return p.y + '-' + String(p.m).padStart(2, '0') + '-' + String(p.d).padStart(2, '0'); };
  const fromISO = (s) => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || '').trim()); return m ? fromYMD(+m[1], +m[2], +m[3]) : null; };
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthStart = (y, m) => fromYMD(y, m, 1);
  const monthEnd = (y, m) => fromYMD(y, m, daysInMonth(y, m));
  const addMonths = (y, m, k) => { const t = (y * 12 + (m - 1)) + k; return { y: Math.floor(t / 12), m: (t % 12 + 12) % 12 + 1 }; };
  // Monday-based week index (for streaks)
  const weekOf = (n) => Math.floor((n + 3) / 7); // 1970-01-01 was a Thursday

  /* ---------- numbers ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
  const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  const isZero = (v) => Math.abs(v) < 0.005;

  /* ---------- seeded randomness ---------- */
  function hash(str) {
    let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return h1 >>> 0;
  }
  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { // Box–Muller
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  let idCounter = 0;
  const uid = (p) => (p || 'id') + '_' + Date.now().toString(36) + (idCounter++).toString(36) + Math.floor(Math.random() * 1e6).toString(36);

  /* ---------- strings ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  /* ---------- event bus ---------- */
  const handlers = {};
  const on = (evt, fn) => { (handlers[evt] = handlers[evt] || []).push(fn); return () => off(evt, fn); };
  const off = (evt, fn) => { handlers[evt] = (handlers[evt] || []).filter((f) => f !== fn); };
  const emit = (evt, data) => { (handlers[evt] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); };

  Object.assign(FF, {
    DAY_MS, dayOfDate, fromYMD, ymd, today, dayToDate, iso, fromISO, daysInMonth, monthStart, monthEnd, addMonths, weekOf,
    clamp, lerp, round2, sum, isZero, hash, rng, gauss, uid, esc, on, off, emit
  });
})(typeof window !== 'undefined' ? window : this);
