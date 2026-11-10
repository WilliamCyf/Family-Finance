/* ============================================================
   Family Finance — books.js
   The family's money kept like a well-run company keeps its
   books — but in plain words. Pure functions (no screen code,
   so they run in the Node tests too):
   • position      what you own and what you owe today
                   (accountants: the statement of financial position)
   • netSeries     the same, month after month
   • statement     money in, money out, what was kept
                   (accountants: the income statement)
   • months        the last n months side by side (cash flow)
   • ratios        savings rate, emergency fund, debt, …
   • health        one 0–100 "money health" score, built from habits
                   and safety — never from how rich someone is
   • spending      this month against last month and your usual
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const C = () => FF.calc, L = () => FF.ledger, D = () => FF.data;

  /* which shelf an account's money sits on:
       liquid   — money you can spend this week (cash, bank, e-wallet, savings)
       invest   — money that is put to work (brokerage, crypto wallet, and every holding)
       longterm — money that is locked away or slow to sell (EPF, anything else)
     An account whose balance is below zero is money you owe: a loan is long-term debt,
     everything else (a credit card, an overdrawn account) is short-term debt. */
  const SHELF = { cash: 'liquid', bank: 'liquid', ewallet: 'liquid', savings: 'liquid', credit: 'liquid', broker: 'invest', crypto: 'invest', retire: 'longterm', loan: 'longterm', other: 'longterm' };
  const shelfOf = (acc, value) => (value < -0.005 ? (acc && acc.kind === 'loan' ? 'debtLong' : 'debtShort') : SHELF[(acc && acc.kind) || 'other'] || 'longterm');

  /* the same order calc.js walks records in, so both always agree to the cent */
  const TX_ORDER = { opening: 0, adjust: 0, deposit: 1, income: 1, transfer: 2, sell: 2, buy: 3, dividend: 4, withdraw: 5, expense: 5 };
  const sorted = (txns) => (txns || []).slice().sort((a, b) => a.day - b.day || (TX_ORDER[a.type] - TX_ORDER[b.type]) || ((a.ts || 0) - (b.ts || 0)));

  /* One walk over the records gives every account's money and the holdings' value on each of
     the days asked for (days must be ascending). Walking once matters on a phone: asking
     calc.summary() for 12 month-ends × 6 accounts would sort and re-read every record ~150 times. */
  function snapshots(pf, base, days, opt) {
    const txs = sorted(pf.txns);
    const flows = [];
    // opt.sinceStart (trend lines): a starting balance is money that was already there before
    // the app was — counting it from the very beginning keeps the line from jumping up on the
    // day an account was first written down
    const early = !!(opt && opt.sinceStart);
    txs.forEach((t) => C().flows(t).forEach((f) => { if (early && t.start && !f.lock) f.day = -Infinity; flows.push(f); }));
    flows.sort((a, b) => a.day - b.day);
    const books = {}, qty = {};
    let ti = 0, fi = 0;
    return days.map((d) => {
      while (ti < txs.length && txs[ti].day <= d) {
        const t = txs[ti++];
        if (t.type === 'buy') qty[t.sym] = (qty[t.sym] || 0) + t.q;
        else if (t.type === 'sell') qty[t.sym] = Math.max(0, (qty[t.sym] || 0) - t.q);
      }
      while (fi < flows.length && flows[fi].day <= d) {
        const f = flows[fi++];
        const b = books[f.acct] || (books[f.acct] = { locked: 0, byCur: {} });
        if (f.lock) b.locked += f.amt * D().fx(f.cur, base, f.day);
        else b.byCur[f.cur] = (b.byCur[f.cur] || 0) + f.amt;
      }
      let hv = 0;
      const held = {};
      Object.keys(qty).forEach((s) => {
        const a = D().asset(s);
        if (!a || !(qty[s] > 0)) return;
        const v = qty[s] * D().price(s, d) * D().fx(a.c, base, d);
        hv += v; held[s] = v;
      });
      const acct = {};
      Object.keys(books).forEach((id) => {
        const b = books[id];
        let v = b.locked;
        Object.keys(b.byCur).forEach((c) => { v += b.byCur[c] * D().fx(c, base, d); });
        acct[id] = v;
      });
      return { day: d, hv, held, acct };
    });
  }
  function shelve(pf, snap) {
    const byId = {};
    (pf.accounts || []).forEach((a) => { byId[a.id] = a; });
    const out = { day: snap.day, liquid: 0, invest: snap.hv, longterm: 0, debtShort: 0, debtLong: 0, lines: [] };
    const ids = (pf.accounts || []).map((a) => a.id);
    Object.keys(snap.acct).forEach((id) => { if (!byId[id]) ids.push(id); }); // money left on an account that no longer exists still counts
    ids.forEach((id) => {
      const acc = byId[id] || null, v = snap.acct[id] || 0;
      const shelf = shelfOf(acc, v);
      if (shelf === 'debtShort' || shelf === 'debtLong') out[shelf] += -v; else out[shelf] += v;
      out.lines.push({ id, acc, kind: (acc && acc.kind) || 'other', shelf, value: v });
    });
    out.assets = out.liquid + out.invest + out.longterm;
    out.debts = out.debtShort + out.debtLong;
    out.net = out.assets - out.debts;
    return out;
  }

  /* ---------- what you own and what you owe ---------- */
  function position(pf, base, day) {
    day = day == null ? FF.today() : day;
    const snap = snapshots(pf, base, [day])[0];
    const p = shelve(pf, snap);
    p.holdings = Object.keys(snap.held).map((sym) => ({ sym, a: D().asset(sym), value: snap.held[sym] })).sort((x, y) => y.value - x.value);
    return p;
  }
  /* the last n month-ends (the newest one is "today") */
  function monthEnds(n, day) {
    day = day == null ? FF.today() : day;
    const p = FF.ymd(day), out = [];
    for (let k = n - 1; k >= 1; k--) { const q = FF.addMonths(p.y, p.m, -k); out.push(FF.monthEnd(q.y, q.m)); }
    out.push(day);
    return out;
  }
  /* net worth over time: [{ day, assets, debts, net }] */
  function netSeries(pf, base, days, opt) {
    return snapshots(pf, base, days, opt).map((s) => { const p = shelve(pf, s); return { day: s.day, assets: p.assets, debts: p.debts, net: p.net, liquid: p.liquid, invest: p.invest, longterm: p.longterm }; });
  }
  /* evenly spaced days for a small trend line (always ends today) */
  function spread(from, to, n) {
    const out = [];
    if (to <= from) return [to];
    const step = Math.max(1, Math.round((to - from) / Math.max(1, n - 1)));
    for (let d = to; d >= from && out.length < n; d -= step) out.unshift(d);
    return out;
  }
  /* the first day any everyday money was written down (income, spending, a balance, a transfer) */
  function firstEveryday(pf) {
    let m = Infinity;
    (pf.txns || []).forEach((t) => { if ((t.type === 'expense' || t.type === 'income' || t.type === 'adjust' || t.type === 'transfer') && t.day < m) m = t.day; });
    return m === Infinity ? null : m;
  }

  /* ---------- money in, money out, what was kept (from … to, both included) ---------- */
  function statement(pf, base, from, to) {
    const inc = {}, exp = {};
    let income = 0, expense = 0, n = 0, dividends = 0, fees = 0;
    (pf.txns || []).forEach((t) => {
      if (t.day < from || t.day > to) return;
      const rx = D().fx(t.cur, base, t.day);
      if (t.type === 'income') { const c = L().CAT[t.cat] && L().CAT[t.cat].kind === 'income' ? t.cat : 'otherIn'; inc[c] = (inc[c] || 0) + t.amt * rx; income += t.amt * rx; n++; }
      else if (t.type === 'expense') { const c = L().CAT[t.cat] && L().CAT[t.cat].kind === 'expense' ? t.cat : 'other'; exp[c] = (exp[c] || 0) + t.amt * rx; expense += t.amt * rx; n++; }
      else if (t.type === 'dividend') dividends += t.amt * rx;
      else if (t.type === 'buy' || t.type === 'sell') fees += (t.fee || 0) * rx;
    });
    // gains you actually took (sold for more than you paid): the change in "realised" over the period
    const p0 = C().positions(pf, from - 1, base), p1 = C().positions(pf, to, base);
    let realized = 0;
    Object.keys(p1).forEach((s) => { realized += p1[s].realizedB - (p0[s] ? p0[s].realizedB : 0); });
    const list = (map, total) => Object.keys(map).map((c) => ({ cat: L().catOf(c), amt: map[c], pct: total > 0 ? map[c] / total : 0 })).sort((a, b) => b.amt - a.amt);
    const net = income - expense;
    return {
      from, to, n, income, expense, net, rate: income > 0 ? net / income : null,
      incomeBy: list(inc, income), expenseBy: list(exp, expense),
      dividends, realized, fees
    };
  }

  /* ---------- the last n months side by side (one walk over the records) ---------- */
  function months(pf, base, n, day) {
    day = day == null ? FF.today() : day;
    const p = FF.ymd(day), list = [], idx = {};
    for (let k = n - 1; k >= 0; k--) {
      const q = FF.addMonths(p.y, p.m, -k);
      const o = { y: q.y, m: q.m, income: 0, expense: 0, n: 0 };
      idx[q.y * 12 + q.m] = o; list.push(o);
    }
    (pf.txns || []).forEach((t) => {
      if ((t.type !== 'expense' && t.type !== 'income') || t.day > day) return;
      const q = FF.ymd(t.day), o = idx[q.y * 12 + q.m];
      if (!o) return;
      const v = t.amt * D().fx(t.cur, base, t.day);
      if (t.type === 'income') o.income += v; else o.expense += v;
      o.n++;
    });
    list.forEach((o) => { o.net = o.income - o.expense; o.rate = o.income > 0 ? o.net / o.income : null; });
    return list;
  }

  /* ---------- your usual month, from the last 90 days ----------
     With less than two weeks of records there is no "usual" yet (null): one grocery run is
     not a spending habit, and a score built on it would only mislead. */
  function usual(pf, base, day) {
    day = day == null ? FF.today() : day;
    const from = day - 89;
    let income = 0, expense = 0, first = Infinity, n = 0;
    (pf.txns || []).forEach((t) => {
      if (t.type !== 'expense' && t.type !== 'income') return;
      if (t.day <= day && t.day < first) first = t.day;
      if (t.day < from || t.day > day) return;
      const v = t.amt * D().fx(t.cur, base, t.day);
      if (t.type === 'income') income += v; else expense += v;
      n++;
    });
    const span = first === Infinity ? 0 : Math.min(90, day - first + 1);
    const k = span >= 14 ? 30.44 / span : null;
    return { span, n, income, expense, monthlyIncome: k == null ? null : income * k, monthlyExpense: k == null ? null : expense * k };
  }

  /* ---------- the numbers a financial planner looks at ---------- */
  function ratios(pos, u) {
    const mExp = u && u.monthlyExpense, inc = u && u.income, exp = u && u.expense;
    return {
      // of every 100 that came in, how many were kept (needs about a month of records)
      savings: u && u.span >= 28 && inc > 0 ? (inc - exp) / inc : null,
      // how many months the family could live on money it can reach quickly
      buffer: mExp > 0 ? pos.liquid / mExp : null,
      // of everything owned, how much is really the bank's
      debt: pos.assets > 0.005 ? pos.debts / pos.assets : (pos.debts > 0.005 ? 1 : null),
      // of everything owned, how much is truly yours
      solvency: pos.assets > 0.005 ? pos.net / pos.assets : null,
      // how much of your net worth is put to work
      invested: pos.net > 0.005 ? pos.invest / pos.net : null
    };
  }

  /* ---------- money health: 0–100 ----------
     Six pillars, each scored 0–100 on a gentle curve and weighted. A pillar with nothing to go
     on is left out (and says what would fill it in) instead of counting as zero — so a brand-new
     family isn't told it is failing. Nothing here rewards being rich: a student keeping a fifth
     of a small allowance scores higher than a millionaire spending more than comes in. */
  const curve = (v, pts) => { // straight lines between [value, score] points
    if (v <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (v <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]); }
    }
    return pts[pts.length - 1][1];
  };
  const WEIGHT = { save: 30, buffer: 25, debt: 15, budget: 10, invest: 10, habit: 10 };
  const PILLARS = ['save', 'buffer', 'debt', 'budget', 'invest', 'habit'];
  function health(m, base, day) {
    day = day == null ? FF.today() : day;
    const pf = m.pf;
    base = base || pf.base;
    const pos = position(pf, base, day), u = usual(pf, base, day), r = ratios(pos, u);
    const pillars = {};
    // 1 · keeping some of what comes in
    pillars.save = r.savings == null ? { has: false } : { has: true, value: r.savings, score: curve(r.savings, [[0, 0], [0.1, 50], [0.2, 80], [0.3, 100]]) };
    // 2 · a cushion for a rainy day (3 months is solid, 6 is excellent)
    pillars.buffer = r.buffer == null ? { has: false } : { has: true, value: r.buffer, score: curve(r.buffer, [[0, 0], [1, 35], [3, 75], [6, 100]]) };
    // 3 · owing little compared with what you own
    pillars.debt = r.debt == null ? { has: false } : { has: true, value: r.debt, score: curve(r.debt, [[0, 100], [0.3, 70], [0.5, 45], [1, 0]]) };
    // 4 · budgets that hold
    const bs = (m.budgets || []).map((b) => L().budgetProgress(b, pf, day));
    pillars.budget = !bs.length ? { has: false } : { has: true, value: bs.filter((p) => p.status === 'ok' || p.status === 'close').length / bs.length, n: bs.length, score: FF.sum(bs, (p) => (p.status === 'over' ? 0 : p.status === 'risk' ? 50 : 100)) / bs.length };
    // 5 · investing, and not all in one basket (a broad fund already is many baskets)
    const inv = C().summary(L().investView(pf), base, day);
    if (!inv.holdings.length) pillars.invest = { has: false };
    else {
      let hhi = 0; // the sum of squared weights: 1 = everything in one holding
      inv.holdings.forEach((h) => { const w = h.weight; hhi += h.a.sec === 'broad' ? (w * w) / 12 : w * w; });
      const eff = hhi > 0 ? 1 / hhi : 0; // "how many equal-sized holdings is this like?"
      const spreadScore = curve(eff, [[1, 25], [3, 60], [6, 85], [10, 100]]);
      const shareScore = r.invested == null ? 50 : curve(r.invested, [[0, 30], [0.1, 70], [0.25, 100]]);
      pillars.invest = { has: true, value: eff, share: r.invested, score: 0.6 * spreadScore + 0.4 * shareScore };
    }
    // 6 · the habit itself: days with something written down in the last 30
    const seen = {};
    (pf.txns || []).forEach((t) => { if (t.day > day - 30 && t.day <= day && t.type !== 'opening') seen[t.day] = 1; });
    const days = Object.keys(seen).length;
    pillars.habit = !(pf.txns || []).length ? { has: false } : { has: true, value: days, score: curve(days, [[0, 0], [4, 45], [8, 75], [12, 100]]) };

    let wsum = 0, total = 0, known = 0;
    PILLARS.forEach((k) => {
      const p = pillars[k];
      p.k = k; p.weight = WEIGHT[k];
      if (!p.has) return;
      p.score = Math.round(FF.clamp(p.score, 0, 100));
      p.level = p.score >= 75 ? 'good' : p.score >= 45 ? 'ok' : 'low';
      wsum += p.weight; total += p.weight * p.score; known++;
    });
    // a score needs the two pillars about everyday money, or it would be built on almost nothing
    const enough = known >= 3 && (pillars.save.has || pillars.buffer.has);
    const score = enough ? Math.round(total / wsum) : null;
    const grade = score == null ? null : score >= 90 ? 'excellent' : score >= 75 ? 'great' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'start';
    // what to work on first: the weakest pillar that carries the most weight
    const todo = PILLARS.map((k) => pillars[k]).filter((p) => p.has && p.score < 75).sort((a, b) => (b.weight * (100 - b.score)) - (a.weight * (100 - a.score)))[0] || null;
    return { score, grade, pillars: PILLARS.map((k) => pillars[k]), by: pillars, focus: todo ? todo.k : null, pos, usual: u, ratios: r };
  }

  /* ---------- this month's spending, against last month and your usual ---------- */
  function spending(pf, base, day) {
    day = day == null ? FF.today() : day;
    const p = FF.ymd(day), from = FF.monthStart(p.y, p.m), dim = FF.daysInMonth(p.y, p.m);
    const prev = FF.addMonths(p.y, p.m, -1), prevFrom = FF.monthStart(prev.y, prev.m), prevTo = FF.monthEnd(prev.y, prev.m);
    const sameDay = FF.fromYMD(prev.y, prev.m, Math.min(p.d, FF.daysInMonth(prev.y, prev.m)));
    const back3 = FF.addMonths(p.y, p.m, -3), from3 = FF.monthStart(back3.y, back3.m);
    const cur = {}, last = {}, three = {}, cal = {}, shops = {}, wd = [0, 0, 0, 0, 0, 0, 0], wdN = [0, 0, 0, 0, 0, 0, 0];
    let spent = 0, prevSame = 0, prevFull = 0, sum3 = 0, firstDay = Infinity;
    const monthsSeen = {};
    const big = [];
    (pf.txns || []).forEach((t) => {
      if (t.type !== 'expense' || t.day > day) return;
      if (t.day < firstDay) firstDay = t.day;
      const v = t.amt * D().fx(t.cur, base, t.day);
      const c = L().CAT[t.cat] && L().CAT[t.cat].kind === 'expense' ? t.cat : 'other';
      if (t.day >= from) {
        spent += v; cur[c] = (cur[c] || 0) + v; cal[t.day] = (cal[t.day] || 0) + v; big.push({ tx: t, amt: v });
        const name = (t.note || '').trim();
        if (name) { const k = name.toLowerCase(); const s = shops[k] || (shops[k] = { name, n: 0, amt: 0, cat: c }); s.n++; s.amt += v; }
      } else if (t.day >= prevFrom && t.day <= prevTo) {
        prevFull += v; last[c] = (last[c] || 0) + v;
        if (t.day <= sameDay) prevSame += v;
      }
      if (t.day >= from3 && t.day < from) { sum3 += v; three[c] = (three[c] || 0) + v; const q = FF.ymd(t.day); monthsSeen[q.y * 12 + q.m] = 1; }
      if (t.day > day - 56) wd[(FF.ymd(t.day).wd + 6) % 7] += v; // Monday first
    });
    for (let d = Math.max(day - 55, firstDay === Infinity ? day : firstDay); d <= day; d++) wdN[(FF.ymd(d).wd + 6) % 7]++;
    const nMonths = Math.max(1, Object.keys(monthsSeen).length);
    const hasPast = Object.keys(monthsSeen).length > 0;
    const ids = {};
    Object.keys(cur).concat(Object.keys(last), Object.keys(three)).forEach((c) => { ids[c] = 1; });
    const cats = Object.keys(ids).map((c) => ({ cat: L().catOf(c), amt: cur[c] || 0, prev: last[c] || 0, avg3: hasPast ? (three[c] || 0) / nMonths : null, pct: spent > 0 ? (cur[c] || 0) / spent : 0 })).sort((a, b) => b.amt - a.amt || b.prev - a.prev);
    let quiet = 0;
    for (let d = Math.max(from, firstDay === Infinity ? from : Math.min(firstDay, day + 1)); d <= day; d++) if (!cal[d]) quiet++;
    return {
      y: p.y, m: p.m, from, day, dim, dom: p.d,
      spent, prevSame, prevFull, avg3: hasPast ? sum3 / nMonths : null,
      // "at this pace the month ends at…" — only once a week has passed (rent on the 1st isn't a pace)
      projected: p.d >= 7 ? (spent / p.d) * dim : null,
      perDay: spent / p.d,
      cats, cal, quietDays: quiet,
      biggest: big.sort((a, b) => b.amt - a.amt).slice(0, 3),
      shops: Object.keys(shops).map((k) => shops[k]).sort((a, b) => b.amt - a.amt).slice(0, 5),
      weekdays: wd.map((v, i) => (wdN[i] ? v / wdN[i] : 0))
    };
  }
  /* spending that stands out: a category well above its usual month (and worth mentioning) */
  function unusual(sp) {
    if (!sp || sp.avg3 == null) return null;
    const share = sp.dom / sp.dim; // how much of the month has gone by
    const hits = sp.cats.filter((c) => c.avg3 != null && c.avg3 > 0 && c.amt > c.avg3 * 1.4 && c.amt - c.avg3 > Math.max(20, sp.avg3 * 0.03) && share >= 0.3)
      .sort((a, b) => (b.amt - b.avg3) - (a.amt - a.avg3));
    return hits[0] || null;
  }

  /* ---------- several people's books as one (the whole family) ----------
     parts: [{ pf }] — each already limited to what the viewer may see. Town Hall assets belong
     to everyone, so they are added once, as long-term money. */
  function familyPosition(parts, hall, base, day) {
    day = day == null ? FF.today() : day;
    const out = { day, liquid: 0, invest: 0, longterm: 0, debtShort: 0, debtLong: 0, hall: 0, who: [] };
    parts.forEach((x) => {
      const p = position(x.pf, base, day);
      ['liquid', 'invest', 'longterm', 'debtShort', 'debtLong'].forEach((k) => { out[k] += p[k]; });
      out.who.push({ id: x.id, name: x.name, net: p.net, assets: p.assets, debts: p.debts });
    });
    out.hall = hall ? L().hallTotal(hall, base, day) : 0;
    out.longterm += out.hall;
    out.assets = out.liquid + out.invest + out.longterm;
    out.debts = out.debtShort + out.debtLong;
    out.net = out.assets - out.debts;
    return out;
  }

  FF.books = { SHELF, shelfOf, snapshots, position, monthEnds, netSeries, spread, firstEveryday, statement, months, usual, ratios, curve, health, WEIGHT, PILLARS, spending, unusual, familyPosition };
})(typeof window !== 'undefined' ? window : this);
