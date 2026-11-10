/* ============================================================
   Family Finance — recur.js
   Bills, subscriptions and pay days: records that come round
   again. Pure functions (run in the Node tests):
   • the calendar maths — when is a rule due, what is still open
   • what a rule costs per month, per year
   • the record a rule writes on its day (with a reference, so two
     phones opening on the same morning never write it twice)
   • spotting repeats in what was already written down
     ("you pay Netflix every month — make it a bill?")
   • a 30-day look ahead: the lowest point before the next pay day

   A rule:
     { id, type: 'expense' | 'income' | 'transfer', name, amt, cur, cat, acct, to,
       every: 'week' | '2week' | 'month' | 'quarter' | 'year',
       day0: the first due day, end: the last possible day (optional),
       auto: write the record by itself on the day (else: ask "paid?"),
       last: the latest due day already dealt with (written, confirmed or skipped),
       off: paused, ts }
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const L = () => FF.ledger, D = () => FF.data;
  const r2 = FF.round2;

  const EVERY = ['week', '2week', 'month', 'quarter', 'year'];
  const STEP = { week: { d: 7 }, '2week': { d: 14 }, month: { m: 1 }, quarter: { m: 3 }, year: { m: 12 } };
  const stepOf = (rule) => STEP[rule.every] || STEP.month;

  /* the k-th due day (k = 0 is the first). Monthly rules keep their day of the month; a rule on
     the 31st falls on the last day of shorter months (28 Feb, 30 Apr …) and returns to the 31st. */
  function nth(rule, k) {
    const s = stepOf(rule);
    if (s.d) return rule.day0 + k * s.d;
    const p = FF.ymd(rule.day0), q = FF.addMonths(p.y, p.m, k * s.m);
    return FF.fromYMD(q.y, q.m, Math.min(p.d, FF.daysInMonth(q.y, q.m)));
  }
  /* the smallest k whose due day is after `day` */
  function indexAfter(rule, day) {
    if (day < rule.day0) return 0;
    const s = stepOf(rule);
    if (s.d) return Math.floor((day - rule.day0) / s.d) + 1;
    const a = FF.ymd(rule.day0), b = FF.ymd(day);
    let k = Math.max(0, Math.floor(((b.y - a.y) * 12 + (b.m - a.m)) / s.m) - 1);
    while (nth(rule, k) <= day) k++;
    return k;
  }
  const alive = (rule, d) => rule.end == null || d <= rule.end;
  /* due days with after < day ≤ upto (at most `cap` of them) */
  function due(rule, after, upto, cap) {
    const out = [];
    if (!rule || rule.day0 == null) return out;
    cap = cap || 60;
    for (let k = indexAfter(rule, after); out.length < cap; k++) {
      const d = nth(rule, k);
      if (d > upto || !alive(rule, d)) break;
      out.push(d);
    }
    return out;
  }
  const next = (rule, after) => { const d = nth(rule, indexAfter(rule, after)); return alive(rule, d) ? d : null; };
  const handledUpTo = (rule) => (rule.last != null ? rule.last : rule.day0 - 1);
  /* due days that nobody has dealt with yet (most recent 24 at most: a rule dated years back
     must not flood the records) */
  function open(rule, today) {
    if (!rule || rule.off) return [];
    const all = due(rule, handledUpTo(rule), today, 400);
    return all.slice(-24);
  }
  /* the next time it comes round (after everything already dealt with, and never in the past
     for a rule that writes itself) */
  function nextOpen(rule, today) {
    if (!rule || rule.off) return null;
    const o = open(rule, today);
    return o.length ? o[0] : next(rule, Math.max(handledUpTo(rule), today));
  }

  /* what it comes to per month (a weekly RM 10 is RM 43.33 a month: 52 weeks ÷ 12) */
  const PER_MONTH = { week: 52 / 12, '2week': 26 / 12, month: 1, quarter: 1 / 3, year: 1 / 12 };
  const monthly = (rule) => rule.amt * (PER_MONTH[rule.every] || 1);
  const yearly = (rule) => monthly(rule) * 12;
  function totals(rules, base) {
    let out = 0, inc = 0;
    (rules || []).forEach((r) => {
      if (r.off) return;
      const v = monthly(r) * D().fx(r.cur, base);
      if (r.type === 'expense') out += v; else if (r.type === 'income') inc += v;
    });
    return { out, in: inc, net: inc - out };
  }

  /* everything coming up between two days, soonest first: [{ rule, day, late }] */
  function upcoming(rules, from, to, today) {
    const out = [];
    (rules || []).forEach((r) => {
      if (r.off) return;
      const seen = {};
      open(r, today == null ? from : today).forEach((d) => { if (d <= to) { seen[d] = 1; out.push({ rule: r, day: d, late: d < (today == null ? from : today) }); } });
      due(r, Math.max(from - 1, handledUpTo(r)), to).forEach((d) => { if (!seen[d]) out.push({ rule: r, day: d, late: false }); });
    });
    return out.sort((a, b) => a.day - b.day || (b.rule.amt - a.rule.amt));
  }

  /* the record a rule writes for one of its days. `ref` is the same on every phone, which is
     how a second phone (or a second look) knows it is already there. */
  const refOf = (rule, day) => 'bill:' + rule.id + ':' + FF.iso(day);
  function record(rule, day) {
    const tx = { type: rule.type, day, amt: r2(+rule.amt), cur: rule.cur, acct: rule.acct, ref: refOf(rule, day), rc: rule.id };
    if (rule.type === 'transfer') { tx.to = rule.to; if (rule.toAmt != null) { tx.toAmt = r2(+rule.toAmt); tx.toCur = rule.toCur; } }
    else tx.cat = rule.cat;
    if (rule.name) tx.note = String(rule.name).slice(0, 60);
    return tx;
  }
  /* can this rule still write a record? (its account may have been deleted since) */
  function valid(rule, pf) {
    if (!rule || !(+rule.amt > 0) || EVERY.indexOf(rule.every) === -1 || rule.day0 == null) return false;
    const has = (id) => (pf.accounts || []).some((a) => a.id === id);
    if (!has(rule.acct)) return false;
    if (rule.type === 'transfer') return has(rule.to) && rule.to !== rule.acct;
    const c = L().CAT[rule.cat];
    return !!c && c.kind === rule.type;
  }

  /* ---------- spotting repeats ----------
     Three or more records of the same thing (same category and note; rent and utility bills
     also without a note), evenly spaced and of similar size, the last one recent → a suggestion. */
  const GAPS = [['week', 6, 8], ['2week', 12, 16], ['month', 26, 35], ['quarter', 84, 98]];
  const NO_NOTE_OK = { housing: 1, bills: 1, insurance: 1, education: 1, salary: 1, rental: 1 };
  const median = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
  function detect(pf, rules, today) {
    today = today == null ? FF.today() : today;
    const groups = {};
    (pf.txns || []).forEach((t) => {
      if ((t.type !== 'expense' && t.type !== 'income') || t.rc || t.day > today || t.day < today - 220 || !t.acct) return;
      const c = L().CAT[t.cat];
      if (!c || c.kind !== t.type) return;
      const note = (t.note || '').trim();
      if (!note && !NO_NOTE_OK[t.cat]) return;
      const k = t.type + '|' + t.cat + '|' + note.toLowerCase();
      (groups[k] = groups[k] || []).push(t);
    });
    const taken = (rules || []).map((r) => r.type + '|' + r.cat + '|' + String(r.name || '').trim().toLowerCase());
    const out = [];
    Object.keys(groups).forEach((k) => {
      const g = groups[k].sort((a, b) => a.day - b.day);
      if (g.length < 3 || taken.indexOf(k) !== -1) return;
      const gaps = [];
      for (let i = 1; i < g.length; i++) gaps.push(g[i].day - g[i - 1].day);
      const mg = median(gaps);
      const kind = GAPS.find((x) => mg >= x[1] && mg <= x[2]);
      if (!kind) return;
      if (gaps.filter((x) => x >= kind[1] - 3 && x <= kind[2] + 3).length < Math.ceil(gaps.length * 0.75)) return; // mostly regular
      const amts = g.map((t) => t.amt), ma = median(amts);
      if (!(ma > 0) || (Math.max.apply(null, amts) - Math.min.apply(null, amts)) / ma > 0.4) return;               // similar size
      const lastTx = g[g.length - 1];
      if (today - lastTx.day > mg * 1.6) return;                                                                 // still going
      const rule = { type: lastTx.type, name: (lastTx.note || '').trim(), amt: r2(lastTx.amt), cur: lastTx.cur, cat: lastTx.cat, acct: lastTx.acct, every: kind[0], day0: lastTx.day, last: lastTx.day };
      out.push({ rule, n: g.length, next: next(rule, lastTx.day), key: k });
    });
    return out.sort((a, b) => monthly(b.rule) * D().fx(b.rule.cur, pf.base) - monthly(a.rule) * D().fx(a.rule.cur, pf.base)).slice(0, 4);
  }

  /* ---------- the next few weeks ----------
     Start from the money you can reach today and apply every bill and pay day on its date:
     the line shows the lowest point (usually the day before pay day), so a tight week is seen
     before it arrives. Transfers between your own accounts don't change the total. */
  function forecast(rules, liquidNow, base, today, days) {
    today = today == null ? FF.today() : today;
    days = days || 30;
    const items = upcoming(rules, today, today + days, today).filter((x) => x.rule.type !== 'transfer');
    let bal = liquidNow, low = { day: today, bal }, out = 0, inc = 0;
    const pts = [{ day: today, bal }];
    items.forEach((x) => {
      const v = x.rule.amt * D().fx(x.rule.cur, base) * (x.rule.type === 'income' ? 1 : -1);
      if (v > 0) inc += v; else out -= v;
      bal += v;
      const d = Math.max(today, x.day);
      if (pts[pts.length - 1].day === d) pts[pts.length - 1].bal = bal; else pts.push({ day: d, bal });
      if (bal < low.bal) low = { day: d, bal };
    });
    if (pts[pts.length - 1].day !== today + days) pts.push({ day: today + days, bal });
    return { pts, low, end: bal, out, in: inc, items };
  }

  FF.recur = { EVERY, nth, indexAfter, due, next, open, nextOpen, handledUpTo, monthly, yearly, totals, upcoming, refOf, record, valid, detect, forecast };
})(typeof window !== 'undefined' ? window : this);
