/* ============================================================
   FamFi — calc.js
   Pure portfolio maths. Everything a beginner sees ("You're up
   RM 1,240 this year") is derived here from the transaction log.
   Key rule:  gain = value − money you put in.
   Stock records never move the money in your accounts: a buy is
   money you put into investing, a sale or a dividend is money
   that came back out — so editing a price only ever changes your
   gain, never your cash or your total.
   Currency: money you put in is converted at the rate on the day
   you put it in; holdings and cash at the rate on the day being
   valued — so a ringgit investor sees the real effect of USD/MYR.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const D = FF.data;
  const r2 = FF.round2;

  let atTodaysRate = false;
  const rate = (from, to, day) => (atTodaysRate ? D.fx(from, to) : D.fx(from, to, day));

  const TX_ORDER = { opening: 0, adjust: 0, deposit: 1, income: 1, transfer: 2, sell: 2, buy: 3, dividend: 4, withdraw: 5, expense: 5 };
  const sorted = (txns) => txns.slice().sort((a, b) => a.day - b.day || (TX_ORDER[a.type] - TX_ORDER[b.type]) || ((a.ts || 0) - (b.ts || 0)));

  /* stock records leave your cash alone: what you paid counts as money put in (and a sale or
     a dividend as money taken back out), so the cash side always nets to zero */
  const kept = (t, amt, lock) => [{ day: t.day, amt, cur: t.cur, acct: t.acct, contrib: true, lock }, { day: t.day, amt: -amt, cur: t.cur, acct: t.acct, lock }];
  /* cash movements caused by one transaction (in the txn currency) */
  function flows(t) {
    const lock = !!t.setup;
    switch (t.type) {
      case 'buy': return kept(t, r2(t.q * t.p + (t.fee || 0)), lock);
      case 'sell': return kept(t, -r2(t.q * t.p - (t.fee || 0)), lock);
      case 'dividend': return kept(t, -r2(t.amt), lock);
      case 'deposit': return [{ day: t.day, amt: r2(t.amt), cur: t.cur, acct: t.acct, contrib: true, lock }];
      case 'withdraw': return [{ day: t.day, amt: -r2(t.amt), cur: t.cur, acct: t.acct, contrib: true, lock }];
      // "Finish Setup" from older versions: its locked parts only gave back the cash that past
      // buys used to take, so just the parts that set leftover cash to 0 still count
      case 'opening': return (t.parts || []).filter((p) => p.lock === false).map((p) => ({ day: p.day, amt: r2(p.amt), cur: p.cur, acct: p.acct, contrib: true, lock: false }));
      // everyday money (ledger.js): spending and income are money leaving / arriving from outside,
      // a balance update is the same, and a transfer only moves money between your own accounts
      case 'expense': return t.acct ? [{ day: t.day, amt: -r2(t.amt), cur: t.cur, acct: t.acct, contrib: true, lock }] : [];
      case 'income': return t.acct ? [{ day: t.day, amt: r2(t.amt), cur: t.cur, acct: t.acct, contrib: true, lock }] : [];
      case 'adjust': return t.acct ? [{ day: t.day, amt: r2(t.amt), cur: t.cur, acct: t.acct, contrib: true, lock }] : [];
      case 'transfer': return [{ day: t.day, amt: -r2(t.amt), cur: t.cur, acct: t.acct, lock }, { day: t.day, amt: r2(t.toAmt != null ? t.toAmt : t.amt), cur: t.toCur || t.cur, acct: t.to, lock }];
      default: return [];
    }
  }
  /* running cash in base currency: locked flows keep their own day's value, the rest is
     held per currency and valued at the viewing day's rate */
  function cashBook() {
    return { locked: 0, byCur: {}, contrib: 0,
      add(f, base) {
        if (f.lock) this.locked += f.amt * rate(f.cur, base, f.day);
        else this.byCur[f.cur] = (this.byCur[f.cur] || 0) + f.amt;
        if (f.contrib) this.contrib += f.amt * rate(f.cur, base, f.day);
      },
      value(base, day) { let v = this.locked; Object.keys(this.byCur).forEach((c) => { v += this.byCur[c] * rate(c, base, day); }); return v; }
    };
  }
  const allFlows = (pf) => {
    const out = [];
    pf.txns.forEach((t) => flows(t).forEach((f) => out.push(f)));
    return out.sort((a, b) => a.day - b.day);
  };

  function firstDay(pf) {
    let m = Infinity;
    pf.txns.forEach((t) => {
      if (t.type === 'opening') (t.parts || []).forEach((p) => { m = Math.min(m, p.day); });
      else m = Math.min(m, t.day);
    });
    return m === Infinity ? FF.today() : m;
  }

  /* positions at the end of `day` (avg-cost method). With `base`, also tracks what was
     paid in the base currency at each purchase day's exchange rate (costB) */
  function positions(pf, day, base) {
    const pos = {};
    sorted(pf.txns).forEach((t) => {
      if (t.day > day || !t.sym) return;
      const p = pos[t.sym] || (pos[t.sym] = { sym: t.sym, qty: 0, cost: 0, costB: 0, realized: 0, realizedB: 0, divs: 0, divsB: 0, fees: 0, feesB: 0, first: t.day });
      const rx = base ? rate(t.cur, base, t.day) : 1;
      if (t.type === 'buy') { const c = t.q * t.p + (t.fee || 0); p.qty += t.q; p.cost += c; p.costB += c * rx; p.fees += t.fee || 0; p.feesB += (t.fee || 0) * rx; }
      else if (t.type === 'sell') {
        const q = Math.min(t.q, p.qty);
        const share = p.qty > 0 ? q / p.qty : 0;
        const part = p.cost * share, partB = p.costB * share;
        p.realized += q * t.p - (t.fee || 0) - part;
        p.realizedB += (q * t.p - (t.fee || 0)) * rx - partB;
        p.cost -= part; p.costB -= partB; p.qty -= q; p.fees += t.fee || 0; p.feesB += (t.fee || 0) * rx;
        if (p.qty < 1e-9) { p.qty = 0; p.cost = 0; p.costB = 0; }
      } else if (t.type === 'dividend') { p.divs += t.amt; p.divsB += t.amt * rx; }
    });
    return pos;
  }
  const qtyOn = (pf, sym, day) => { const p = positions(pf, day)[sym]; return p ? p.qty : 0; };

  function cashOn(pf, base, day) {
    const book = cashBook();
    pf.txns.forEach((t) => flows(t).forEach((f) => { if (f.day <= day) book.add(f, base); }));
    return { cash: book.value(base, day), contrib: book.contrib };
  }

  /* cash per account (in each account's own currency) */
  function cashByAccount(pf, day) {
    const out = {};
    const accCur = {};
    (pf.accounts || []).forEach((a) => { out[a.id] = 0; accCur[a.id] = a.cur; });
    pf.txns.forEach((t) => flows(t).forEach((f) => {
      if (day != null && f.day > day) return;
      const cur = accCur[f.acct] || f.cur;
      out[f.acct] = (out[f.acct] || 0) + f.amt * rate(f.cur, cur, f.day);
    }));
    return out;
  }

  /* cash per account valued in `base` the same way as the Home screen (an account can
     hold several currencies — e.g. ringgit added to a US brokerage) */
  function cashByAccountIn(pf, base, day) {
    day = day == null ? FF.today() : day;
    const books = {};
    (pf.accounts || []).forEach((a) => { books[a.id] = cashBook(); });
    pf.txns.forEach((t) => flows(t).forEach((f) => { if (f.day <= day) (books[f.acct] || (books[f.acct] = cashBook())).add(f, base); }));
    const out = {};
    Object.keys(books).forEach((id) => { out[id] = books[id].value(base, day); });
    return out;
  }

  /* ---------- the main "how am I doing" snapshot ---------- */
  function summary(pf, base, day) {
    day = day == null ? FF.today() : day;
    const pos = positions(pf, day, base);
    const prev = positions(pf, day - 1);
    const cc = cashOn(pf, base, day);
    let hv = 0, invested = 0, realized = 0, divs = 0, fees = 0, change = 0, prevHv = 0;
    const holdings = [];
    Object.keys(pos).forEach((sym) => {
      const p = pos[sym];
      const a = D.asset(sym);
      if (!a) return;
      const rx = rate(a.c, base, day);
      realized += p.realizedB; divs += p.divsB; fees += p.feesB;
      if (p.qty <= 0) return;
      const px = D.price(sym, day), ppx = D.prevPrice(sym, day);
      const value = p.qty * px * rx;
      const cost = p.costB;
      const pq = prev[sym] ? prev[sym].qty : 0;
      const dayCh = pq * (px - ppx) * rx;
      hv += value; invested += cost; change += dayCh; prevHv += pq * ppx * rx;
      holdings.push({ sym, a, qty: p.qty, px, value, cost, gain: value - cost, gainPct: cost > 0 ? value / cost - 1 : 0, dayCh, dayPct: D.dayChangePct(sym, day), divs: p.divsB, avg: p.qty ? p.cost / p.qty : 0 });
    });
    holdings.sort((x, y) => y.value - x.value);
    holdings.forEach((h) => { h.weight = hv > 0 ? h.value / hv : 0; });
    const value = hv + cc.cash;
    const gain = value - cc.contrib;
    const denom = cc.contrib > 1 ? cc.contrib : invested;
    return {
      day, value, holdingsValue: hv, cash: cc.cash, contrib: cc.contrib, invested,
      gain, gainPct: denom > 1 ? gain / denom : 0,
      unrealized: hv - invested, realized, dividends: divs, fees,
      todayChange: change, todayPct: prevHv > 0 ? change / prevHv : 0,
      holdings, count: holdings.length
    };
  }

  /* ---------- value history (one walk over the log) ---------- */
  function history(pf, base, from, to, maxPoints) {
    const txs = sorted(pf.txns);
    const fl = allFlows(pf);
    const start = Math.min(from, txs.length ? firstDay(pf) : from);
    const qty = {};
    let ti = 0, fi = 0;
    const book = cashBook();
    const step = Math.max(1, Math.ceil((to - from) / (maxPoints || 160)));
    const pts = [];
    for (let d = start; d <= to; d++) {
      while (ti < txs.length && txs[ti].day <= d) {
        const t = txs[ti++];
        if (t.type === 'buy') qty[t.sym] = (qty[t.sym] || 0) + t.q;
        else if (t.type === 'sell') qty[t.sym] = Math.max(0, (qty[t.sym] || 0) - t.q);
      }
      while (fi < fl.length && fl[fi].day <= d) book.add(fl[fi++], base);
      if (d >= from && ((d - from) % step === 0 || d === to)) {
        let hv = 0;
        Object.keys(qty).forEach((s) => { if (qty[s] > 0 && D.asset(s)) hv += qty[s] * D.price(s, d) * rate(D.asset(s).c, base, d); });
        pts.push({ day: d, value: hv + book.value(base, d), contrib: book.contrib, hv });
      }
    }
    return pts;
  }

  function valueAt(pf, base, day) {
    const pos = positions(pf, day);
    let hv = 0;
    Object.keys(pos).forEach((s) => { if (pos[s].qty > 0 && D.asset(s)) hv += pos[s].qty * D.price(s, day) * rate(D.asset(s).c, base, day); });
    const cc = cashOn(pf, base, day);
    return { value: hv + cc.cash, contrib: cc.contrib, hv };
  }

  /* ---------- "How much have I made?" ---------- */
  function periodStart(period, day) {
    const p = FF.ymd(day);
    switch (period) {
      case '1m': return day - 30;
      case '3m': return day - 91;
      case 'ytd': return FF.fromYMD(p.y, 1, 1) - 1;
      case '1y': return day - 365;
      default: return -Infinity;
    }
  }
  function returnFor(pf, base, period, day) {
    const r = returnCore(pf, base, period, day);
    atTodaysRate = true;
    let flat;
    try { flat = returnCore(pf, base, period, day); } finally { atTodaysRate = false; }
    r.fxEffect = r.gain - flat.gain;                       // what the currency move added or took away
    r.priceGrowth = r.gain - r.dividends + r.fees - r.fxEffect;
    return r;
  }
  function returnCore(pf, base, period, day) {
    day = day == null ? FF.today() : day;
    const first = firstDay(pf);
    let from = periodStart(period, day);
    const allTime = from < first;
    if (allTime) from = first - 1;
    const v0 = valueAt(pf, base, from), v1 = valueAt(pf, base, day);
    const gain = (v1.value - v0.value) - (v1.contrib - v0.contrib);
    let dividends = 0, fees = 0, weighted = 0;
    const span = Math.max(1, day - from);
    pf.txns.forEach((t) => {
      if (t.type === 'dividend' && t.day > from && t.day <= day) dividends += t.amt * rate(t.cur, base, t.day);
      if ((t.type === 'buy' || t.type === 'sell') && t.day > from && t.day <= day) fees += (t.fee || 0) * rate(t.cur, base, t.day);
      flows(t).forEach((f) => { if (f.contrib && f.day > from && f.day <= day) weighted += f.amt * rate(f.cur, base, f.day) * ((day - f.day) / span); });
    });
    let denom = v0.value + weighted;
    const s = summary(pf, base, day);
    if (denom < Math.max(1, s.invested * 0.05)) denom = s.invested; // almost nothing put in during the period
    // per-holding contribution to the gain
    const p0 = positions(pf, from), p1 = positions(pf, day);
    const syms = {};
    Object.keys(p0).concat(Object.keys(p1)).forEach((k) => { syms[k] = 1; });
    const parts = Object.keys(syms).filter((sym) => D.asset(sym)).map((sym) => {
      const a = D.asset(sym);
      const q0 = p0[sym] ? p0[sym].qty : 0, q1 = p1[sym] ? p1[sym].qty : 0;
      let net = 0, dv = 0;
      pf.txns.forEach((t) => {
        if (t.sym !== sym || t.day <= from || t.day > day) return;
        const rx = rate(t.cur, base, t.day);
        if (t.type === 'buy') net += (t.q * t.p + (t.fee || 0)) * rx;
        if (t.type === 'sell') net -= (t.q * t.p - (t.fee || 0)) * rx;
        if (t.type === 'dividend') dv += t.amt * rx;
      });
      const g = q1 * D.price(sym, day) * rate(a.c, base, day) - q0 * D.price(sym, from) * rate(a.c, base, from) - net + dv;
      return { sym, a, gain: g };
    }).filter((x) => Math.abs(x.gain) >= 0.005).sort((x, y) => y.gain - x.gain);
    return {
      period, from, to: day, allTime, startValue: v0.value, endValue: v1.value,
      moneyIn: v1.contrib - v0.contrib, gain, pct: denom > 1 ? gain / denom : 0,
      dividends, fees, priceGrowth: gain - dividends + fees, fxEffect: 0, parts
    };
  }

  /* ---------- "Where is my money?" ---------- */
  function allocation(pf, base, by, day) {
    const s = summary(pf, base, day);
    const map = {};
    s.holdings.forEach((h) => {
      const key = by === 'sector' ? h.a.sec : by === 'currency' ? h.a.c : h.a.t;
      map[key] = (map[key] || 0) + h.value;
    });
    if (s.cash > 0.005) {
      if (by === 'currency') {
        const byAcc = cashByAccount(pf);
        (pf.accounts || []).forEach((acc) => { const v = (byAcc[acc.id] || 0) * D.fx(acc.cur, base); if (v > 0.005) map[acc.cur] = (map[acc.cur] || 0) + v; });
      } else map.cash = (map.cash || 0) + s.cash;
    }
    const total = FF.sum(Object.keys(map).map((k) => map[k]));
    const slices = Object.keys(map).map((k) => ({ key: k, value: map[k], pct: total > 0 ? map[k] / total : 0 })).sort((a, b) => b.value - a.value);
    return { total, slices, negativeCash: s.cash < -0.005, summary: s };
  }

  /* gentle "too much in one place" nudge */
  function concentration(pf, base, day) {
    const s = summary(pf, base, day);
    if (!s.holdings.length || s.holdingsValue <= 0) return null;
    const top = s.holdings[0];
    if (top.weight > 0.3 && top.a.sec !== 'broad') return { kind: 'holding', sym: top.sym, a: top.a, pct: top.weight };
    const sec = {};
    s.holdings.forEach((h) => { if (h.a.sec !== 'broad') sec[h.a.sec] = (sec[h.a.sec] || 0) + h.weight; });
    const topSec = Object.keys(sec).sort((a, b) => sec[b] - sec[a])[0];
    if (topSec && sec[topSec] > 0.5) return { kind: 'sector', key: topSec, pct: sec[topSec] };
    if ((sec.crypto || 0) > 0.25) return { kind: 'crypto', pct: sec.crypto };
    return null;
  }

  /* ---------- dividends ---------- */
  function projected(pf, base, from, to) {
    const out = [];
    const syms = {};
    pf.txns.forEach((t) => { if (t.sym && (t.type === 'buy' || t.type === 'sell')) syms[t.sym] = 1; });
    Object.keys(syms).forEach((sym) => {
      const a = D.asset(sym);
      if (!a || !a.dv) return;
      D.payDays(sym, from, to).forEach((d) => {
        const q = qtyOn(pf, sym, d - D.EX_GAP);
        if (q <= 0) return;
        const amt = r2(q * D.dps(sym));
        out.push({ day: d, sym, a, q, amt, cur: a.c, base: amt * D.fx(a.c, base), ref: sym + '@' + FF.iso(d) });
      });
    });
    return out.sort((x, y) => x.day - y.day);
  }
  const isLogged = (pf, p) => pf.txns.some((t) => t.type === 'dividend' && t.sym === p.sym && (t.ref === p.ref || Math.abs(t.day - p.day) <= 7));
  function harvestable(pf, base, day) {
    day = day == null ? FF.today() : day;
    return projected(pf, base, day - 31, day).filter((p) => !isLogged(pf, p));
  }
  function received(pf, base, from, to) {
    return pf.txns.filter((t) => t.type === 'dividend' && t.day >= from && t.day <= to)
      .filter((t) => D.asset(t.sym))
      .map((t) => ({ day: t.day, sym: t.sym, a: D.asset(t.sym), amt: t.amt, cur: t.cur, base: t.amt * rate(t.cur, base, t.day), tx: t }))
      .sort((x, y) => x.day - y.day);
  }
  /* everything for one month of the calendar */
  function dividendMonth(pf, base, y, m, day) {
    day = day == null ? FF.today() : day;
    const from = FF.monthStart(y, m), to = FF.monthEnd(y, m);
    const items = received(pf, base, from, to).map((x) => Object.assign(x, { status: 'received' }));
    const ready = harvestable(pf, base, day);
    projected(pf, base, from, to).forEach((p) => {
      if (isLogged(pf, p)) return;
      if (p.day > day) items.push(Object.assign(p, { status: 'upcoming' }));
      else if (ready.some((r) => r.ref === p.ref)) items.push(Object.assign(p, { status: 'ready' }));
    });
    items.sort((a, b) => a.day - b.day);
    return { items, total: FF.sum(items, (x) => x.base) };
  }
  function dividendYear(pf, base, year, day) {
    day = day == null ? FF.today() : day;
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const mo = dividendMonth(pf, base, year, m, day);
      months.push({ m, received: FF.sum(mo.items.filter((x) => x.status === 'received'), (x) => x.base), expected: FF.sum(mo.items.filter((x) => x.status !== 'received'), (x) => x.base) });
    }
    const total = FF.sum(months, (x) => x.received + x.expected);
    return { months, total, perMonth: total / 12, received: FF.sum(months, (x) => x.received) };
  }

  /* ---------- budget ---------- */
  function budgetMonth(b, y, m, day) {
    day = day == null ? FF.today() : day;
    const from = FF.monthStart(y, m), to = FF.monthEnd(y, m);
    const spends = (b.spends || []).filter((s) => s.day >= from && s.day <= to);
    const spent = FF.sum(spends, (s) => s.amt);
    const cats = (b.cats || []).map((c) => {
      const cs = FF.sum(spends.filter((s) => s.cat === c.id), (s) => s.amt);
      const pct = c.limit > 0 ? cs / c.limit : 0;
      return { cat: c, spent: cs, left: c.limit - cs, pct, status: pct > 1 ? 'over' : pct >= 0.8 ? 'close' : 'ok' };
    });
    const isCurrent = day >= from && day <= to;
    const daysLeft = isCurrent ? to - day + 1 : day < from ? to - from + 1 : 0;
    const left = (b.income || 0) - spent;
    return { from, to, income: b.income || 0, spent, left, cats, spends, daysLeft, perDay: daysLeft > 0 ? Math.max(0, left) / daysLeft : 0, limits: FF.sum(b.cats || [], (c) => c.limit) };
  }
  function stayedOnBudget(b, y, m) {
    const mo = budgetMonth(b, y, m, FF.monthEnd(y, m) + 1);
    return mo.spends.length > 0 && mo.spent <= mo.income && mo.cats.every((c) => c.status !== 'over');
  }

  /* ---------- gamification helpers ---------- */
  // house levels by everything you have, in ringgit: cottage → 50k → 100k → 300k → 500k → the 1 million mansion
  const LEVELS = [0, 50000, 100000, 300000, 500000, 1000000];
  function level(netWorthMYR) {
    let l = 1;
    LEVELS.forEach((t, i) => { if (netWorthMYR >= t) l = i + 1; });
    return l;
  }
  const nextLevelAt = (l) => (l < LEVELS.length ? LEVELS[l] : null);

  /* weeks in a row with at least one log (Mon-based weeks) */
  function weekStreak(days, day) {
    day = day == null ? FF.today() : day;
    const weeks = {};
    days.forEach((d) => { weeks[FF.weekOf(d)] = 1; });
    let w = FF.weekOf(day);
    if (!weeks[w]) w -= 1; // this week isn't over yet
    let n = 0;
    while (weeks[w]) { n++; w--; }
    const recent = [];
    const cur = FF.weekOf(day);
    for (let k = 7; k >= 0; k--) recent.push(!!weeks[cur - k]);
    return { weeks: n, recent, thisWeek: !!weeks[cur] };
  }

  FF.calc = {
    flows, firstDay, positions, qtyOn, cashOn, cashByAccount, cashByAccountIn, summary, history, valueAt, periodStart, returnFor,
    allocation, concentration, projected, harvestable, received, dividendMonth, dividendYear, isLogged,
    budgetMonth, stayedOnBudget, LEVELS, level, nextLevelAt, weekStreak
  };
})(typeof window !== 'undefined' ? window : this);
