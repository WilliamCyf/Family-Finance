/* FamFi — how often prices are fetched (market.js), with a fake clock and fake price servers.
   FamFi is for checking in, not for watching tickers: prices update about once an hour while
   the app is open, on opening / coming back if older than 15 minutes, within 5 minutes for a
   stock you're looking at, and on demand ("Update" or pulling down — at most once a minute).
   US stock prices can't move while the market is shut: once the closing prices are in, nights,
   weekends and holidays make no stock calls until the next opening bell. A failing source backs
   off (30 s, 2 min, 10 min, then hourly) and nothing is fetched while offline.
   Run: node FamFi/tests/test_market_pace.js        (V=1 to see every check) */
'use strict';
process.env.TZ = 'Asia/Kuala_Lumpur'; // the family's phones (FamFi's "today" is the local day)
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = ['js/core.js', 'js/data.js', 'js/calc.js', 'js/ledger.js', 'js/play.js', 'js/lucky.js', 'js/grid.js', 'js/store.js', 'js/market.js'];
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; if (process.env.V) console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const MIN = 60 * 1000;
const Z = (iso) => Date.parse(iso);

/* ---------- a fake US market (October 2026: New York = UTC−4, session 13:30–20:00 UTC) ---------- */
let clock = Z('2026-10-06T15:00:00Z');      // Tuesday 11:00 am New York (11 pm in Malaysia)
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...a) { super(...(a.length ? a : [clock])); }
  static now() { return clock; }
}
let holiday = false;                          // a weekday with no trading
let priceBump = 0;                            // make the market move
const down = {};                              // host → true: the service is unreachable
let online = true;
function lastTrade() {
  // during a trading session: now; otherwise the most recent 20:00 UTC close on a weekday
  const d = new RealDate(clock), wd = d.getUTCDay(), mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (!holiday && wd >= 1 && wd <= 5 && mins >= 13 * 60 + 30 && mins < 20 * 60) return clock;
  const c = new RealDate(clock); c.setUTCHours(20, 0, 0, 0);
  if (c.getTime() > clock || holiday) c.setUTCDate(c.getUTCDate() - 1);
  while (c.getUTCDay() === 0 || c.getUTCDay() === 6) c.setUTCDate(c.getUTCDate() - 1);
  return c.getTime();
}
const calls = { quote: 0, crypto: 0, cryptoHist: 0, fx: 0, other: 0 };
let cryptoTries = 0;
function fakeFetch(url) {
  const host = url.split('/')[2];
  if (host === 'api.coingecko.com') cryptoTries++;
  if (!online || down[host]) return Promise.reject(new TypeError('Load failed'));
  let body;
  if (url.includes('finnhub.io/api/v1/quote')) { calls.quote++; body = { c: 100 + priceBump, pc: 99, t: Math.floor(lastTrade() / 1000) }; }
  else if (url.includes('coingecko.com/api/v3/simple/price')) {
    calls.crypto++;
    const ids = decodeURIComponent(url.split('ids=')[1] || '').split(',');
    body = {}; ids.forEach((id) => { body[id] = { usd: 60000 + priceBump, usd_24h_change: 1, last_updated_at: Math.floor(clock / 1000) }; });
  } else if (url.includes('coingecko.com/api/v3/coins/')) { calls.cryptoHist++; body = { prices: [[clock - 86400000, 59000], [clock, 60000]] }; }
  else if (url.includes('frankfurter') || url.includes('er-api')) {
    calls.fx++;
    body = url.includes('..') ? { rates: { '2026-10-01': { USD: 0.21, SGD: 0.29, THB: 7.6 }, '2026-10-02': { USD: 0.21, SGD: 0.29, THB: 7.6 } } } : { rates: { USD: 0.21, SGD: 0.29, THB: 7.6 }, date: '2026-10-06' };
  } else { calls.other++; body = {}; }
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}
function storage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
const ctx = {
  console, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, Promise, Intl, Math, JSON,
  Date: FakeDate, fetch: fakeFetch, AbortController, localStorage: storage(),
  navigator: { get onLine() { return online; } },
  document: { hidden: false, addEventListener: () => {} },
  addEventListener: () => {}, FF_CONFIG: { finnhubKey: 'test', twelveDataKey: '' }
};
ctx.window = ctx;
vm.createContext(ctx);
FILES.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const { FF } = ctx;
const S = FF.store, M = FF.market;
S.init({ memory: true });
S.seedDemo('en');
const events = { market: 0, status: 0 };
FF.on('market', () => events.market++);
FF.on('market-status', () => events.status++);
const snap = () => Object.assign({}, calls);
const diff = (a) => { const o = {}; Object.keys(calls).forEach((k) => { o[k] = calls[k] - a[k]; }); return o; };
const stocksHeld = () => { const set = {}; Object.keys(S.state.members).forEach((id) => S.state.members[id].pf.txns.forEach((t) => { const a = t.sym && FF.data.asset(t.sym); if (a && a.t !== 'crypto') set[t.sym] = 1; })); return Object.keys(set).length; };
/* the 5-minute check, from now until `end` */
async function ticks(end) { end = typeof end === 'string' ? Z(end) : end; while (clock + 5 * MIN <= end) { clock += 5 * MIN; await M.refresh(); } }

(async () => {
  const N = Math.min(20, stocksHeld());
  console.log('demo family: ' + stocksHeld() + ' stocks held');

  /* 1. opening the app during the session: everything once */
  let b = snap();
  await M.refresh(false, { maxAge: 15 * MIN });
  let d = diff(b);
  ok(d.quote === N && d.crypto === 1 && d.fx >= 1, 'opening the app fetches every price once (' + JSON.stringify(d) + ')');

  /* 2. the 5-minute checks find nothing due within the hour (exchange rates included) */
  b = snap(); await ticks('2026-10-06T15:55:00Z'); d = diff(b);
  ok(d.quote === 0 && d.crypto === 0 && d.fx === 0, 'nothing is fetched again within the hour (' + JSON.stringify(d) + ')');
  b = snap(); await ticks('2026-10-06T16:05:00Z'); d = diff(b);
  ok(d.quote === N && d.crypto === 1, 'after an hour, prices are fetched again');

  /* 3. the rest of the session (about 4 hours): about once an hour */
  b = snap(); await ticks('2026-10-06T19:55:00Z'); d = diff(b);
  ok(d.quote >= N * 3 && d.quote <= N * 4, 'rest of the session (3 h 50 min): ' + (d.quote / N).toFixed(1) + ' rounds of ' + N + ' stocks (before: ~460 rounds)');

  /* 4. after the close: the closing prices once, then nothing all night */
  b = snap(); await ticks('2026-10-06T21:05:00Z'); d = diff(b);
  ok(d.quote === N, 'after the close the closing prices are fetched once (' + d.quote + ')');
  b = snap(); await ticks('2026-10-07T13:25:00Z'); d = diff(b);
  ok(d.quote === 0, 'all night (16 h of checks): no stock calls — prices can\'t move (' + d.quote + ')');
  ok(d.crypto >= 14 && d.crypto <= 17, 'crypto (trades 24/7) still about hourly overnight (' + d.crypto + ')');
  let r = await M.update();
  ok(r.final === true, '"Update" while the market is shut knows the closing prices are already in');

  /* 5. the opening bell: the first prices of the day at once, then hourly */
  b = snap(); await ticks('2026-10-07T13:35:00Z'); d = diff(b);
  ok(d.quote === N, 'at the opening bell the first prices of the day are fetched at once (' + d.quote + ')');
  b = snap(); await ticks('2026-10-07T14:25:00Z'); d = diff(b);
  ok(d.quote === 0, '…and then it is back to the hourly pace');

  /* 6. coming back to the app: anything older than 15 minutes */
  clock = Z('2026-10-07T14:55:00Z'); b = snap(); await M.refresh(false, { maxAge: 15 * MIN }); d = diff(b);
  ok(d.quote === N, 'coming back after 20+ min fetches fresh prices');
  clock += 5 * MIN; b = snap(); await M.refresh(false, { maxAge: 15 * MIN }); d = diff(b);
  ok(d.quote === 0 && d.crypto === 0, 'coming back again 5 min later fetches nothing');

  /* 7. looking at one stock: it alone is kept within 5 minutes, for 10 minutes */
  const sym = Object.keys(S.me().pf.txns.reduce((o, t) => { if (t.sym && FF.data.asset(t.sym).t !== 'crypto') o[t.sym] = 1; return o; }, {}))[0];
  M.focus(sym);
  clock += 6 * MIN; b = snap(); await M.refresh(); d = diff(b);
  ok(d.quote === 1, 'the stock you are looking at is refreshed after 5 min, nothing else (' + sym + ')');
  clock += 20 * MIN; b = snap(); await M.refresh(); d = diff(b);
  ok(d.quote <= 1, '10 minutes after looking, it is back to the hourly pace');

  /* 8. same prices → no screen rebuild; new prices → one */
  clock += 61 * MIN; await M.refresh(); // (crosses midnight in Malaysia: the new day's exchange-rate history comes in — one real update)
  clock += 61 * MIN; let e0 = Object.assign({}, events); await M.refresh();
  ok(events.market === e0.market && events.status === e0.status + 1, 'unchanged prices: no screen rebuild, only the status line');
  priceBump = 1.5; clock += 61 * MIN; e0 = Object.assign({}, events); await M.refresh();
  ok(events.market === e0.market + 1, 'prices that moved: one screen update');

  /* 9. "Update": now, and at most once a minute */
  clock += 3 * MIN; b = snap(); r = await M.update(); d = diff(b);
  ok(r.ok && !r.recent && !r.final && d.quote === N, '"Update" during the session fetches every price now');
  b = snap(); r = await M.update(); d = diff(b);
  ok(r.recent && d.quote === 0, 'a second "Update" within a minute is skipped (free API limits)');

  /* 10. a weekend: Friday's closing prices, then nothing until Monday's bell */
  clock = Z('2026-10-09T21:00:00Z'); await M.refresh(); // Friday 5 pm New York
  b = snap(); await ticks('2026-10-12T13:25:00Z'); d = diff(b);
  ok(d.quote === 0, 'a whole weekend (60 h of checks): no stock calls (' + d.quote + ')');
  b = snap(); await ticks('2026-10-12T13:35:00Z'); d = diff(b);
  ok(d.quote === N, 'Monday\'s opening bell: fresh prices at once');

  /* 11. a weekday holiday: the bell rings but nothing trades — then quiet until tomorrow */
  holiday = true;
  clock = Z('2026-10-13T13:20:00Z'); await M.refresh();
  b = snap(); await ticks('2026-10-13T19:55:00Z'); d = diff(b);
  ok(d.quote <= N * 2, 'a weekday holiday: ' + (d.quote / N).toFixed(0) + ' round(s), then no more stock calls that day');
  b = snap(); await ticks('2026-10-14T00:00:00Z'); holiday = false; await ticks('2026-10-14T13:25:00Z'); d = diff(b);
  ok(d.quote <= N, 'the night after a holiday: at most one round of closing prices (' + (d.quote / N).toFixed(0) + ')');
  b = snap(); await ticks('2026-10-14T13:35:00Z'); d = diff(b);
  ok(d.quote === N, 'the next trading day starts normally at the bell');

  /* 12. a service that's down backs off (30 s, 2 min, 10 min, then hourly) and recovers */
  clock = Z('2026-10-14T15:00:00Z'); await M.refresh();
  down['api.coingecko.com'] = true;
  clock += 61 * MIN; cryptoTries = 0; await M.refresh(); // first failure
  await ticks(clock + 3 * 60 * MIN);
  ok(cryptoTries >= 4 && cryptoTries <= 6 && M.status.crypto.ok === false, 'over 3 hours a down service is tried ' + cryptoTries + ' times (30 s → 2 min → 10 min → hourly; without back-off: 37)');
  delete down['api.coingecko.com'];
  clock += 61 * MIN; b = snap(); await M.refresh(); d = diff(b);
  ok(d.crypto === 1 && M.status.crypto.ok, 'when it\'s back, prices come in again');
  down['finnhub.io'] = true;
  clock += 61 * MIN; b = snap(); await M.refresh(); clock += 5 * MIN; await M.refresh(); d = diff(b);
  ok(M.status.quotes.ok === false, 'stock prices unreachable: status says so (and backs off)');
  delete down['finnhub.io'];
  clock += 5 * MIN; b = snap(); await M.refresh(); d = diff(b);
  ok(d.quote === N, 'stock prices come back at the next try after the wait');

  /* 13. offline: no network at all; "Update" says so */
  online = false;
  clock += 61 * MIN; b = snap(); await M.refresh(); await M.refresh(false, { maxAge: 15 * MIN }); d = diff(b);
  ok(d.quote === 0 && d.crypto === 0 && d.fx === 0, 'offline: nothing is attempted');
  r = await M.update();
  ok(r.offline === true, '"Update" while offline says so');
  online = true;

  /* 14. nobody holds crypto → CoinGecko is never called */
  Object.keys(S.state.members).forEach((id) => { const pf = S.state.members[id].pf; pf.txns = pf.txns.filter((t) => !(t.sym && FF.data.asset(t.sym).cg)); });
  clock += 120 * MIN; b = snap(); await M.refresh(); d = diff(b);
  ok(d.crypto === 0 && d.cryptoHist === 0, 'no crypto in the family: CoinGecko is never called');

  /* 15. "open" on the status line: market hours and a trade in the last 3 hours */
  ok(M.liveNow({ qAt: Z('2026-10-06T14:10:00Z'), t: Z('2026-10-06T14:10:00Z') }, Z('2026-10-06T15:00:00Z')) === true, 'a 50-minute-old price during market hours shows "Market open"');
  ok(M.liveNow({ qAt: Z('2026-10-06T15:00:00Z'), t: Z('2026-10-05T20:00:00Z') }, Z('2026-10-06T15:00:00Z')) === false, 'a weekday holiday (last trade yesterday) shows "Markets closed"');
  ok(M.liveNow({ qAt: Z('2026-10-06T19:50:00Z'), t: Z('2026-10-06T19:50:00Z') }, Z('2026-10-06T21:30:00Z')) === false, 'after the close it shows "Markets closed"');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
