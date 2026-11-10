/* ============================================================
   Family Finance — plan.js
   The maths behind the planner tools and the investment
   analysis. Pure functions (run in the Node tests):
   • grow      money growing with regular savings (compound growth)
   • needed    how much to put aside each month to reach a target
   • loan      a loan paid off month by month, and what paying a
               little extra saves
   • freedom   when savings could cover the family's spending
   • xirr      "your yearly return", counting every deposit on its day
   • yearly    the same for a portfolio over a period
   • versus    the same money put into a market fund instead
   • risk      how bumpy the ride was (ups and downs, the worst dip)
   • dca       a fixed amount invested every month in one asset
   Rates are yearly, as a fraction (0.07 = 7%).
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const C = () => FF.calc, D = () => FF.data;

  /* ---------- compound growth ----------
     Each month the money earns one twelfth of the yearly rate, then the month's saving is
     added. `raise` lifts the monthly saving once a year (a pay rise).
       value after one month = value × (1 + rate ÷ 12) + saving                              */
  function grow(o) {
    const start = Math.max(0, +o.start || 0), years = FF.clamp(+o.years || 0, 0, 80), r = (+o.rate || 0) / 12, raise = +o.raise || 0;
    let pay = Math.max(0, +o.monthly || 0), value = start, paid = start;
    const series = [{ year: 0, value, paid }];
    for (let y = 1; y <= Math.ceil(years); y++) {
      const monthsThisYear = y <= years ? 12 : Math.round((years - (y - 1)) * 12);
      for (let k = 0; k < monthsThisYear; k++) { value = value * (1 + r) + pay; paid += pay; }
      series.push({ year: Math.min(y, years), value, paid });
      pay *= 1 + raise;
    }
    return { value, paid, growth: value - paid, series };
  }
  /* the monthly saving that reaches `target` in `years` (0 when what you have already gets there) */
  function needed(o) {
    const target = +o.target || 0, start = Math.max(0, +o.start || 0), n = Math.round((+o.years || 0) * 12), r = (+o.rate || 0) / 12;
    if (n <= 0) return Math.max(0, target - start);
    const grown = start * Math.pow(1 + r, n);
    if (grown >= target) return 0;
    // the savings alone must grow to (target − grown):  saving × ((1 + r)^n − 1) ÷ r
    return r === 0 ? (target - start) / n : (target - grown) * r / (Math.pow(1 + r, n) - 1);
  }

  /* ---------- a loan, month by month ----------
                         amount × monthly rate
       payment  =  ─────────────────────────────────
                    1 − (1 + monthly rate)^(−months)                                          */
  function payment(amount, rate, months) {
    const r = rate / 12;
    if (months <= 0) return amount;
    return r === 0 ? amount / months : (amount * r) / (1 - Math.pow(1 + r, -months));
  }
  function payoff(amount, rate, pay, cap) {
    const r = rate / 12;
    let bal = amount, interest = 0, n = 0;
    const series = [{ year: 0, bal }];
    cap = cap || 1200;
    while (bal > 0.005 && n < cap) {
      const i = bal * r;
      if (pay <= i + 1e-9) return { months: Infinity, interest: Infinity, series, never: true }; // the payment doesn't even cover the interest
      interest += i;
      bal = Math.max(0, bal + i - pay);
      n++;
      if (n % 12 === 0 || bal <= 0.005) series.push({ year: n / 12, bal });
    }
    return { months: n, interest, series };
  }
  function loan(o) {
    const amount = Math.max(0, +o.amount || 0), rate = Math.max(0, +o.rate || 0), months = Math.max(1, Math.round((+o.years || 0) * 12)), extra = Math.max(0, +o.extra || 0);
    const pay = payment(amount, rate, months);
    const base = payoff(amount, rate, pay, months + 2);
    const out = { payment: pay, months: base.months, interest: base.interest, total: amount + base.interest, series: base.series };
    if (extra > 0) {
      const fast = payoff(amount, rate, pay + extra);
      out.extra = { payment: pay + extra, months: fast.months, interest: fast.interest, saved: base.interest - fast.interest, sooner: base.months - fast.months, series: fast.series };
    }
    return out;
  }

  /* ---------- "enough" ----------
     The pot that could pay the family's yearly spending for good: yearly spending ÷ the share
     taken out each year (4% is the usual rule of thumb). Rates here are after inflation, so
     every amount is in today's money.
                       yearly spending
       the pot  =  ──────────────────────
                    share taken out a year                                                   */
  function freedom(o) {
    const spend = Math.max(0, +o.spend || 0) * 12, take = FF.clamp(+o.take || 0.04, 0.01, 0.2), r = (+o.rate || 0) / 12, save = Math.max(0, +o.monthly || 0);
    const target = spend / take;
    let value = Math.max(0, +o.start || 0), n = 0;
    const series = [{ year: 0, value }];
    while (value < target && n < 1200) {
      value = value * (1 + r) + save;
      n++;
      if (n % 12 === 0) series.push({ year: n / 12, value });
    }
    const reached = value >= target;
    if (reached && n % 12 !== 0) series.push({ year: n / 12, value });
    return { target, months: reached ? n : null, years: reached ? n / 12 : null, series, progress: target > 0 ? FF.clamp((+o.start || 0) / target, 0, 1) : 0 };
  }

  /* ---------- a yearly return that counts every deposit on its own day ----------
     flows: [{ day, amt }] — money put in is negative, money taken out (and what it is worth at
     the end) positive. The answer is the one yearly rate at which all of them balance out
     (finance: the internal rate of return, XIRR in a spreadsheet). Found by halving a range,
     which can't run away the way faster methods sometimes do. */
  function xirr(flows) {
    const f = (flows || []).filter((x) => x && isFinite(x.amt) && Math.abs(x.amt) > 1e-9);
    if (f.length < 2 || !f.some((x) => x.amt < 0) || !f.some((x) => x.amt > 0)) return null;
    const d0 = Math.min.apply(null, f.map((x) => x.day));
    const npv = (rate) => FF.sum(f, (x) => x.amt / Math.pow(1 + rate, (x.day - d0) / 365));
    let lo = -0.999, hi = 10, flo = npv(lo), fhi = npv(hi);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2, fm = npv(mid);
      if (Math.abs(fm) < 1e-7) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }
  /* the money that went in and came out of a set of records between two days, in `base` */
  function deposits(pf, base, from, to) {
    const out = [];
    (pf.txns || []).forEach((t) => C().flows(t).forEach((f) => { if (f.contrib && f.day > from && f.day <= to) out.push({ day: f.day, amt: f.amt * D().fx(f.cur, base, f.day) }); }));
    return out.sort((a, b) => a.day - b.day);
  }
  /* a portfolio's yearly return over a period (null when it can't be worked out, e.g. nothing
     was invested). Periods under a year are still shown as a yearly pace by the caller's choice. */
  function yearly(pf, base, from, to) {
    to = to == null ? FF.today() : to;
    const first = C().firstDay(pf);
    if (from < first) from = first - 1;
    const v0 = C().valueAt(pf, base, from).value, v1 = C().valueAt(pf, base, to).value;
    const flows = [];
    if (v0 > 0.005) flows.push({ day: from, amt: -v0 });
    deposits(pf, base, from, to).forEach((x) => flows.push({ day: x.day, amt: -x.amt }));
    flows.push({ day: to, amt: v1 });
    return { rate: xirr(flows), from, to, days: to - from };
  }

  /* ---------- "what if the same money had gone into the market instead?" ----------
     Every deposit buys units of the market fund on its own day, every withdrawal sells them:
     the two results can be compared fairly, whatever the timing of the money. */
  function versus(pf, base, sym, from, to, points) {
    to = to == null ? FF.today() : to;
    const a = D().asset(sym);
    if (!a) return null;
    const first = C().firstDay(pf);
    if (from < first) from = first - 1;
    const px = (d) => D().price(sym, d) * D().fx(a.c, base, d);
    const v0 = C().valueAt(pf, base, from);
    const deps = deposits(pf, base, from, to);
    let units = v0.value > 0.005 ? v0.value / px(from) : 0, di = 0;
    const mine = C().history(pf, base, from, to, points || 60);
    const series = mine.map((p) => {
      while (di < deps.length && deps[di].day <= p.day) { units += deps[di].amt / px(deps[di].day); di++; }
      return { day: p.day, mine: p.value, market: Math.max(0, units) * px(p.day) };
    });
    while (di < deps.length) { units += deps[di].amt / px(deps[di].day); di++; }
    const put = FF.sum(deps, (x) => x.amt);
    const v1 = C().valueAt(pf, base, to).value, m1 = Math.max(0, units) * px(to);
    return { sym, a, from, to, put, start: v0.value, mine: v1, market: m1, mineGain: v1 - v0.value - put, marketGain: m1 - v0.value - put, diff: v1 - m1, series };
  }

  /* ---------- how bumpy was the ride? ----------
     From the daily values, with deposits taken out (adding money is not a gain):
       day's return = (today's value − money added today) ÷ yesterday's value − 1
     swing: how much a typical year moves up or down (finance: volatility, yearly).
     dip:   the biggest fall from a high point to a later low (finance: maximum drawdown). */
  function risk(pf, base, from, to) {
    to = to == null ? FF.today() : to;
    const first = C().firstDay(pf);
    if (from < first) from = first;
    if (to - from < 20) return null;
    const pts = C().history(pf, base, from, to, to - from + 1); // every day
    const rets = [];
    let idx = 1, peak = 1, dip = 0, best = null, worst = null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (!(a.value > 1)) continue;
      const r = (b.value - (b.contrib - a.contrib)) / a.value - 1;
      if (!isFinite(r)) continue;
      const wd = FF.ymd(b.day).wd;
      if (wd !== 0 && wd !== 6) rets.push(r); // markets are shut at weekends: those zeros would flatter the number
      idx *= 1 + r;
      if (idx > peak) peak = idx;
      dip = Math.min(dip, idx / peak - 1);
      if (!best || r > best.r) best = { day: b.day, r };
      if (!worst || r < worst.r) worst = { day: b.day, r };
    }
    if (rets.length < 15) return null;
    const mean = FF.sum(rets) / rets.length;
    const sd = Math.sqrt(FF.sum(rets, (r) => (r - mean) * (r - mean)) / (rets.length - 1));
    return { swing: sd * Math.sqrt(252), dip, best, worst, total: idx - 1, days: rets.length };
  }

  /* ---------- a fixed amount every month into one asset (dollar-cost averaging) ---------- */
  function dca(sym, monthly, monthsBack, base, today) {
    today = today == null ? FF.today() : today;
    const a = D().asset(sym);
    if (!a || !(monthly > 0) || !(monthsBack > 0)) return null;
    const px = (d) => D().price(sym, d) * D().fx(a.c, base, d);
    let units = 0, paid = 0;
    const series = [];
    for (let k = monthsBack; k >= 1; k--) {
      const d = today - Math.round(k * 30.4375);
      const p = px(d);
      if (!(p > 0)) continue;
      units += monthly / p; paid += monthly;
      series.push({ day: d, value: units * p, contrib: paid });
    }
    const value = units * px(today);
    series.push({ day: today, value, contrib: paid });
    return { sym, a, units, paid, value, gain: value - paid, pct: paid > 0 ? value / paid - 1 : 0, avgCost: units > 0 ? paid / units : 0, series };
  }

  /* ---------- a savings goal ----------
     goal: { target, cur, due, acct, puts: [{ day, amt }] } — money set aside by hand, or the
     balance of the account the goal is tied to. */
  function goal(g, pf, today) {
    today = today == null ? FF.today() : today;
    let saved = 0;
    const acc = g.acct && pf ? (pf.accounts || []).find((x) => x.id === g.acct) : null;
    if (acc) saved = Math.max(0, FF.ledger.accountValue(pf, acc, today) * D().fx(acc.cur, g.cur));
    else saved = FF.sum(g.puts || [], (p) => +p.amt || 0);
    saved = Math.max(0, saved);
    const target = Math.max(0, +g.target || 0), left = Math.max(0, target - saved), pct = target > 0 ? FF.clamp(saved / target, 0, 1) : 0;
    const out = { saved, target, left, pct, done: target > 0 && saved >= target - 0.005, linked: !!acc };
    if (g.due != null && !out.done) {
      out.daysLeft = g.due - today;
      const monthsLeft = Math.max(1, Math.ceil(out.daysLeft / 30.4375));
      out.perMonth = out.daysLeft > 0 ? left / monthsLeft : left;
      out.late = out.daysLeft < 0;
    }
    // the pace so far (hand-set goals only): what was set aside in the last 90 days
    if (!acc && (g.puts || []).length) {
      const recent = FF.sum((g.puts || []).filter((p) => p.day > today - 90), (p) => +p.amt || 0);
      const firstPut = Math.min.apply(null, (g.puts || []).map((p) => p.day));
      const span = FF.clamp(today - firstPut + 1, 14, 90);
      const pace = recent > 0 ? recent / span * 30.4375 : 0;
      out.pace = pace;
      if (pace > 0 && !out.done) out.eta = today + Math.ceil(left / pace * 30.4375);
      if (out.eta != null && g.due != null) out.onTrack = out.eta <= g.due;
    }
    return out;
  }

  FF.plan = { grow, needed, payment, loan, freedom, xirr, deposits, yearly, versus, risk, dca, goal };
})(typeof window !== 'undefined' ? window : this);
