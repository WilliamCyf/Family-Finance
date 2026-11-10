/* Family Finance — tests for the new engines: books.js (what you own and owe, statements,
   ratios, the money-health score, spending insights), recur.js (bills and pay days) and
   plan.js (planner maths, yearly return, market comparison).
   Run: node tests/run_engine.js tests/test_books.js */
(function () {
  'use strict';
  const FF = this.FF;
  let passed = 0, failed = 0;
  const ok = (cond, msg) => { if (cond) passed++; else { failed++; print('  ✗ ' + msg); } };
  const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= (eps == null ? 0.01 : eps), msg + ' (' + a + ' vs ' + b + ')');
  const C = FF.calc, S = FF.store, B = FF.books, R = FF.recur, P = FF.plan, L = FF.ledger;
  FF.todayOverride = FF.fromYMD(2026, 11, 10);
  const T = FF.today();
  const fresh = () => { S.init({ memory: true }); S.createAccount({ name: 'Test', avatar: { kind: 'illus' } }); S.createFamily('Test Family'); return S.me(); };
  const acct = (name, kind, cur, start) => S.addAccount({ name, kind, cur: cur || 'MYR' }, start).id;
  const spend = (day, amt, cat, a, note) => S.addTxn({ type: 'expense', day, amt, cur: 'MYR', acct: a, cat, note: note || '' }).tx;
  const earn = (day, amt, cat, a, note) => S.addTxn({ type: 'income', day, amt, cur: 'MYR', acct: a, cat: cat || 'salary', note: note || '' }).tx;

  /* ================= the books always agree with the rest of the app ================= */
  print('books: what you own and what you owe');
  ['en', 'zh', 'th'].forEach((lang) => {
    S.init({ memory: true });
    S.seedDemo(lang);
    S.family().members.forEach((id) => {
      const m = S.member(id), base = m.pf.base;
      const pos = B.position(m.pf, base), sum = C.summary(m.pf, base);
      near(pos.net, sum.value, 0.01, lang + ' ' + m.name + ': net worth equals "your money today"');
      near(pos.assets - pos.debts, pos.net, 1e-6, lang + ' ' + m.name + ': assets − debts = net worth');
      near(pos.invest, sum.holdingsValue + FF.sum(pos.lines.filter((l) => l.shelf === 'invest'), (l) => l.value), 0.01, lang + ' ' + m.name + ': investments = holdings + money in investment accounts');
      near(FF.sum(pos.holdings, (h) => h.value), sum.holdingsValue, 0.01, lang + ' ' + m.name + ': holdings add up');
      // the trend ends where today is, and every point matches the slow, exact way
      const days = B.monthEnds(6);
      const ser = B.netSeries(m.pf, base, days);
      ok(ser.length === 6 && ser[5].day === T, lang + ' ' + m.name + ': six month-ends, the last one today');
      ser.forEach((p) => near(p.net, C.valueAt(m.pf, base, p.day).value, 0.01, lang + ' ' + m.name + ': net worth on ' + FF.iso(p.day)));
      const h = B.health(m, base);
      ok(h.score == null || (h.score >= 0 && h.score <= 100), lang + ' ' + m.name + ': health score in range');
    });
    const me = S.me(), h = B.health(me, me.pf.base);
    ok(h.score != null && h.pillars.length === 6, lang + ': the demo person has a health score with six pillars');
    print('  ' + lang + ' ' + me.name + ': health ' + h.score + ' (' + h.grade + ') · ' + h.pillars.map((p) => p.k + ' ' + (p.has ? p.score : '–')).join(' · '));
  });

  let m = fresh();
  const cash = m.pf.accounts[0].id;
  const bank = acct('Bank', 'bank', 'MYR', 10000);
  const card = acct('Card', 'credit', 'MYR', -1500);
  const home = acct('Home loan', 'loan', 'MYR', -200000);
  const epf = acct('EPF', 'retire', 'MYR', 50000);
  const broker = acct('Broker', 'broker', 'USD', 0);
  S.adjustBalance(cash, 300);
  const px = FF.data.price('VOO', T - 30);
  S.addTxn({ type: 'buy', day: T - 30, sym: 'VOO', q: 4, p: px, fee: 0, cur: 'USD', acct: broker });
  m = S.me();
  let pos = B.position(m.pf, 'MYR');
  near(pos.liquid, 10300, 0.01, 'liquid = cash + bank');
  near(pos.debtShort, 1500, 0.01, 'a credit card you owe on is short-term debt');
  near(pos.debtLong, 200000, 0.01, 'a loan is long-term debt');
  near(pos.longterm, 50000, 0.01, 'EPF is long-term money');
  near(pos.invest, 4 * FF.data.price('VOO', T) * FF.data.fx('USD', 'MYR', T), 0.01, 'investments at today’s price and rate');
  near(pos.net, C.summary(m.pf, 'MYR').value, 0.01, 'net worth matches Home');
  ok(pos.net < 0, 'owing more than you own gives a negative net worth (no crash)');
  ok(pos.lines.find((l) => l.id === card).shelf === 'debtShort' && pos.lines.find((l) => l.id === home).shelf === 'debtLong', 'each account on its shelf');
  // a card that was overpaid is simply money you have
  S.adjustBalance(card, 40);
  ok(B.position(S.me().pf, 'MYR').lines.find((l) => l.id === card).shelf === 'liquid', 'an overpaid card counts as money you have');
  S.adjustBalance(card, -1500);
  // money on an account that no longer exists is still counted
  const ghost = JSON.parse(JSON.stringify(S.me().pf));
  ghost.accounts = ghost.accounts.filter((a) => a.id !== epf);
  near(B.position(ghost, 'MYR').net, pos.net, 0.01, 'records of a missing account still count');

  /* ================= statement, months, ratios ================= */
  print('books: money in, money out');
  m = fresh();
  const w = acct('Bank', 'bank', 'MYR', 5000);
  const d0 = FF.fromYMD(2026, 10, 1);
  earn(FF.fromYMD(2026, 10, 25), 5000, 'salary', w);
  earn(FF.fromYMD(2026, 10, 28), 200, 'interest', w);
  spend(FF.fromYMD(2026, 10, 1), 1500, 'housing', w, 'Rent');
  spend(FF.fromYMD(2026, 10, 5), 400, 'food', w);
  spend(FF.fromYMD(2026, 10, 9), 200, 'food', w);
  spend(FF.fromYMD(2026, 11, 3), 99, 'fun', w);
  let st = B.statement(S.me().pf, 'MYR', d0, FF.fromYMD(2026, 10, 31));
  near(st.income, 5200, 0.001, 'October income');
  near(st.expense, 2100, 0.001, 'October spending');
  near(st.net, 3100, 0.001, 'October kept');
  near(st.rate, 3100 / 5200, 1e-9, 'savings rate = kept ÷ income');
  ok(st.expenseBy[0].cat.id === 'housing' && st.expenseBy[1].cat.id === 'food' && st.incomeBy[0].cat.id === 'salary', 'categories, biggest first');
  near(st.expenseBy[1].amt, 600, 0.001, 'food adds up');
  near(FF.sum(st.expenseBy, (x) => x.pct), 1, 1e-9, 'spending shares sum to 100%');
  const ms = B.months(S.me().pf, 'MYR', 3);
  ok(ms.length === 3 && ms[2].m === 11 && ms[1].m === 10 && ms[0].m === 9, 'three months, oldest first');
  near(ms[1].income, 5200, 0.001, 'months: October income'); near(ms[1].expense, 2100, 0.001, 'months: October spending');
  near(ms[2].expense, 99, 0.001, 'months: November so far');
  ok(ms[0].n === 0 && ms[0].rate === null, 'a month with nothing in it has no savings rate');
  // a record in a category this version doesn't know still counts (as "other")
  S.addTxn({ type: 'expense', day: FF.fromYMD(2026, 10, 12), amt: 50, cur: 'MYR', acct: w, cat: 'made_up' });
  st = B.statement(S.me().pf, 'MYR', d0, FF.fromYMD(2026, 10, 31));
  near(st.expense, 2150, 0.001, 'unknown categories are not lost');
  ok(st.expenseBy.some((x) => x.cat.id === 'other' && Math.abs(x.amt - 50) < 0.001), '…they show as Other');

  /* ================= the usual month, and too little to tell ================= */
  m = fresh();
  const b1 = acct('Bank', 'bank', 'MYR', 3000);
  spend(T - 3, 120, 'groceries', b1);
  let u = B.usual(S.me().pf, 'MYR');
  ok(u.monthlyExpense === null && u.span === 4, 'four days of records are not a habit yet');
  let h = B.health(S.me(), 'MYR');
  ok(h.score === null && h.grade === null, 'too little to go on: no score (rather than a wrong one)');
  ok(h.pillars.every((p) => p.k && p.weight > 0), 'pillars are still listed, to say what is missing');

  /* ================= money health ================= */
  print('books: money health');
  function family(scale) {
    const me = fresh();
    const bk = acct('Bank', 'bank', 'MYR', 9000 * scale);
    for (let k = 3; k >= 0; k--) {
      const q = FF.addMonths(2026, 11, -k);
      const pay = FF.fromYMD(q.y, q.m, 1);
      if (pay > T) continue;
      earn(pay, 5000 * scale, 'salary', bk);
      spend(pay + 1, 1500 * scale, 'housing', bk, 'Rent');
      [3, 6, 9].forEach((d) => { if (pay + d <= T) spend(pay + d, 500 * scale, 'groceries', bk); });
    }
    return me;
  }
  family(1);
  S.addBudget({ amt: 9500, cats: [] });
  const good = B.health(S.me(), 'MYR');
  ok(good.score >= 70, 'a family keeping ~40% with a cushion scores well (' + good.score + ')');
  ok(good.by.save.has && good.by.save.value > 0.3, 'savings rate is measured');
  ok(good.by.buffer.has && good.by.buffer.value > 3, 'months of cushion are measured (' + good.by.buffer.value.toFixed(1) + ')');
  ok(good.by.debt.has && good.by.debt.score === 100, 'no debt: full marks there');
  ok(good.by.budget.has && good.by.budget.score === 100, 'the budget is holding');
  ok(!good.by.invest.has, 'no investments: that pillar is left out, not marked down');
  ok(good.grade === 'great' || good.grade === 'excellent' || good.grade === 'good', 'a grade in words');
  // the score is about habits, not about being rich: 100× the money, the same score
  family(100);
  S.addBudget({ amt: 950000, cats: [] });
  const rich = B.health(S.me(), 'MYR');
  ok(rich.score === good.score, 'a hundred times the money gives the same score (' + rich.score + ' vs ' + good.score + ')');
  // spending more than comes in, with nothing set aside and a big debt
  let me2 = fresh();
  const bk2 = acct('Bank', 'bank', 'MYR', 200);
  acct('Card', 'credit', 'MYR', -9000);
  for (let k = 0; k < 3; k++) { earn(T - 10 - 30 * k, 3000, 'salary', bk2); spend(T - 8 - 30 * k, 3300, 'shopping', bk2); }
  const poor = B.health(S.me(), 'MYR');
  ok(poor.score != null && poor.score < 35, 'overspending with no cushion and a big debt scores low (' + poor.score + ')');
  ok(poor.focus === 'save' || poor.focus === 'buffer', 'and says where to start (' + poor.focus + ')');
  ok(poor.by.save.score === 0 && poor.by.debt.score === 0, 'nothing kept, more owed than owned');
  // every pillar's curve stays inside 0…100 and rises (or falls) steadily
  let prev = -1, mono = true;
  for (let v = -0.5; v <= 1; v += 0.05) { const s = B.curve(v, [[0, 0], [0.1, 50], [0.2, 80], [0.3, 100]]); if (s < prev - 1e-9 || s < 0 || s > 100) mono = false; prev = s; }
  ok(mono, 'the savings curve only ever goes up, from 0 to 100');
  near(B.curve(0.15, [[0, 0], [0.1, 50], [0.2, 80], [0.3, 100]]), 65, 1e-9, 'half-way between two points is half-way between their scores');
  // not all in one basket: one stock vs a broad fund vs many
  const spreadOf = (buys) => {
    fresh();
    const br = acct('Broker', 'broker', 'USD', 0), bk = acct('Bank', 'bank', 'MYR', 5000);
    earn(T - 40, 4000, 'salary', bk); spend(T - 35, 2000, 'housing', bk); spend(T - 20, 500, 'food', bk);
    buys.forEach((s) => S.addTxn({ type: 'buy', day: T - 60, sym: s, q: 1000 / FF.data.price(s, T - 60), p: FF.data.price(s, T - 60), fee: 0, cur: 'USD', acct: br }));
    return B.health(S.me(), 'MYR').by.invest;
  };
  const one = spreadOf(['NVDA']), fund = spreadOf(['VOO']), many = spreadOf(['NVDA', 'KO', 'JPM', 'XOM', 'JNJ', 'PG']);
  ok(one.has && fund.has && many.has, 'investing pillar appears once something is held');
  ok(fund.score > one.score && many.score > one.score, 'one stock scores below a broad fund or six different companies (' + [one.score, fund.score, many.score].join(' / ') + ')');

  /* ================= spending insights ================= */
  print('books: spending insights');
  m = fresh();
  const b3 = acct('Bank', 'bank', 'MYR', 20000);
  const day = (mo, d) => FF.fromYMD(2026, mo, d);
  [8, 9, 10].forEach((mo) => { spend(day(mo, 2), 1500, 'housing', b3, 'Rent'); spend(day(mo, 8), 300, 'groceries', b3, 'Jaya Grocer'); spend(day(mo, 20), 300, 'groceries', b3, 'Jaya Grocer'); spend(day(mo, 15), 100, 'fun', b3, 'Cinema'); });
  spend(day(11, 2), 1500, 'housing', b3, 'Rent');
  spend(day(11, 4), 320, 'groceries', b3, 'Jaya Grocer');
  spend(day(11, 6), 60, 'groceries', b3, 'jaya grocer');
  spend(day(11, 7), 700, 'fun', b3, 'Concert');
  let sp = B.spending(S.me().pf, 'MYR');
  near(sp.spent, 2580, 0.001, 'this month so far');
  near(sp.prevSame, 1800, 0.001, 'last month by the same date (rent + the first shop)');
  near(sp.prevFull, 2200, 0.001, 'all of last month');
  near(sp.avg3, 2200, 0.001, 'the usual month (average of the last three)');
  near(sp.projected, 2580 / 10 * 30, 0.001, 'at this pace the month ends at…');
  ok(sp.cats[0].cat.id === 'housing' && sp.cats[1].cat.id === 'fun', 'categories, biggest first');
  near(sp.cats.find((c) => c.cat.id === 'fun').avg3, 100, 0.001, 'usual fun spending');
  ok(sp.biggest[0].tx.note === 'Rent' && sp.biggest[1].tx.note === 'Concert', 'the biggest records of the month');
  const shop = sp.shops.find((x) => x.name === 'Jaya Grocer');
  ok(shop && shop.n === 2 && Math.abs(shop.amt - 380) < 0.001, 'the same shop typed in capitals or not counts once');
  ok(sp.quietDays === 6, 'days this month with nothing spent (' + sp.quietDays + ')');
  near(FF.sum(Object.keys(sp.cal), (k) => sp.cal[k]), sp.spent, 0.001, 'the calendar adds up to the month');
  const odd = B.unusual(sp);
  ok(odd && odd.cat.id === 'fun', 'the concert makes "fun" stand out against a usual RM 100');
  spend(day(11, 9), 5, 'transport', b3);
  ok(B.unusual(B.spending(S.me().pf, 'MYR')).cat.id === 'fun', 'a small first-ever taxi ride is not "unusual"');
  // a first month: nothing to compare with, and no invented numbers
  m = fresh();
  const b4 = acct('Bank', 'bank', 'MYR', 500);
  spend(T - 1, 30, 'food', b4);
  sp = B.spending(S.me().pf, 'MYR');
  ok(sp.avg3 === null && B.unusual(sp) === null && sp.prevFull === 0, 'a first month has no "usual" to compare with');
  ok(sp.cats.length === 1 && sp.cats[0].avg3 === null, '…and its categories say so');

  /* ================= bills and pay days ================= */
  print('recur: when things come round');
  const jan31 = FF.fromYMD(2026, 1, 31);
  const rule = { id: 'r1', type: 'expense', name: 'Rent', amt: 1500, cur: 'MYR', cat: 'housing', acct: 'x', every: 'month', day0: jan31 };
  ok(FF.iso(R.nth(rule, 1)) === '2026-02-28' && FF.iso(R.nth(rule, 2)) === '2026-03-31' && FF.iso(R.nth(rule, 3)) === '2026-04-30', 'the 31st falls on the last day of shorter months and comes back');
  ok(FF.iso(R.nth({ every: 'month', day0: FF.fromYMD(2024, 1, 29) }, 1)) === '2024-02-29', 'a leap year is handled');
  ok(FF.iso(R.nth({ every: 'year', day0: FF.fromYMD(2024, 2, 29) }, 1)) === '2025-02-28', 'yearly from 29 Feb');
  ok(FF.iso(R.nth({ every: 'quarter', day0: jan31 }, 1)) === '2026-04-30', 'every three months');
  ok(R.nth({ every: 'week', day0: 100 }, 3) === 121 && R.nth({ every: '2week', day0: 100 }, 2) === 128, 'weekly and fortnightly');
  // indexAfter agrees with a plain count, for every kind of rule and many days
  let agree = true;
  ['week', '2week', 'month', 'quarter', 'year'].forEach((ev) => {
    const r = { every: ev, day0: jan31 };
    for (let d = jan31 - 40; d < jan31 + 900; d += 7) { let k = 0; while (R.nth(r, k) <= d) k++; if (R.indexAfter(r, d) !== k) agree = false; }
  });
  ok(agree, 'the next due day is found correctly from any day');
  let dd = R.due(rule, jan31 - 1, FF.fromYMD(2026, 6, 30));
  ok(dd.length === 6 && dd[0] === jan31, 'six due days from 31 Jan to 30 Jun');
  ok(R.due(Object.assign({}, rule, { end: FF.fromYMD(2026, 3, 31) }), jan31 - 1, FF.fromYMD(2026, 12, 31)).length === 3, 'a rule with an end date stops there');
  ok(R.open(rule, T).length === 10, 'ten months not dealt with yet (Jan–Oct) (' + R.open(rule, T).length + ')');
  ok(R.open(Object.assign({}, rule, { last: FF.fromYMD(2026, 9, 30) }), T).length === 1, 'after September was dealt with, only October is open');
  ok(R.open(Object.assign({}, rule, { off: true }), T).length === 0, 'a paused rule asks for nothing');
  ok(R.open({ id: 'old', every: 'week', day0: T - 7 * 300, amt: 1 }, T).length === 24, 'a rule dated years back cannot flood the records');
  ok(FF.iso(R.nextOpen(Object.assign({}, rule, { last: FF.fromYMD(2026, 10, 31) }), T)) === '2026-11-30', 'the next time it comes round');
  near(R.monthly({ amt: 10, every: 'week' }), 43.3333, 0.001, 'weekly RM 10 is RM 43.33 a month');
  near(R.yearly({ amt: 54.9, every: 'month' }), 658.8, 0.001, 'a subscription over a year');
  near(R.monthly({ amt: 1200, every: 'year' }), 100, 1e-9, 'yearly insurance per month');
  const tx = R.record(rule, jan31);
  ok(tx.ref === 'bill:r1:2026-01-31' && tx.rc === 'r1' && tx.cat === 'housing' && tx.note === 'Rent' && tx.amt === 1500, 'the record a rule writes carries its reference');
  m = fresh();
  const rb = acct('Bank', 'bank', 'MYR', 9000), rw = acct('Wallet', 'ewallet', 'MYR', 0);
  ok(R.valid(Object.assign({}, rule, { acct: rb }), S.me().pf) && !R.valid(rule, S.me().pf), 'a rule needs an account that exists');
  ok(!R.valid(Object.assign({}, rule, { acct: rb, cat: 'salary' }), S.me().pf), 'spending cannot use an income category');
  ok(R.valid({ type: 'transfer', amt: 100, every: 'week', day0: T, acct: rb, to: rw }, S.me().pf) && !R.valid({ type: 'transfer', amt: 100, every: 'week', day0: T, acct: rb, to: rb }, S.me().pf), 'a transfer needs two different accounts');

  print('recur: spotting repeats');
  [150, 120, 90, 60, 30, 0].forEach((ago, i) => spend(T - ago - 2, 54.9, 'fun', rb, i % 2 ? 'netflix' : 'Netflix'));
  [91, 61, 30, 1].forEach((ago) => spend(T - ago, 1500 + (ago % 7), 'housing', rb));           // rent without a note, a few ringgit apart
  [100, 70, 40, 10].forEach((ago) => earn(T - ago, 5200, 'salary', rb, 'Salary'));
  for (let k = 0; k < 40; k++) spend(T - k * 2, 9 + (k % 5), 'food', rb, 'Lunch');             // every other day: a habit, not a bill
  [80, 50, 20].forEach((ago, i) => spend(T - ago, [40, 400, 90][i], 'shopping', rb, 'Shopee')); // monthly-ish but wildly different amounts
  [200, 170, 140].forEach((ago) => spend(T - ago, 30, 'health', rb, 'Gym'));                    // stopped months ago
  let found = R.detect(S.me().pf, [], T);
  const names = found.map((x) => x.rule.type + ':' + x.rule.cat + ':' + x.rule.name.toLowerCase());
  ok(names.indexOf('expense:fun:netflix') !== -1, 'finds the subscription');
  ok(names.indexOf('expense:housing:') !== -1, 'finds the rent, even with no note and slightly different amounts');
  ok(names.indexOf('income:salary:salary') !== -1, 'finds pay day');
  ok(!names.some((n) => /lunch|shopee|gym/.test(n)), 'daily lunches, uneven shopping and a gym that stopped are left alone (' + names.join(', ') + ')');
  const nf = found.find((x) => x.rule.name.toLowerCase() === 'netflix');
  ok(nf.rule.every === 'month' && nf.n === 6 && nf.next > T, 'monthly, seen six times, next one ahead');
  ok(R.detect(S.me().pf, [{ type: 'expense', cat: 'fun', name: 'Netflix' }], T).every((x) => x.rule.name.toLowerCase() !== 'netflix'), 'what is already a bill is not suggested again');

  print('recur: the next 30 days');
  const rules = [
    { id: 'a', type: 'expense', amt: 1500, cur: 'MYR', every: 'month', day0: T + 5, cat: 'housing', acct: rb },
    { id: 'b', type: 'expense', amt: 55, cur: 'MYR', every: 'month', day0: T + 12, cat: 'fun', acct: rb },
    { id: 'c', type: 'income', amt: 5200, cur: 'MYR', every: 'month', day0: T + 15, cat: 'salary', acct: rb },
    { id: 'd', type: 'transfer', amt: 300, cur: 'MYR', every: 'week', day0: T + 1, acct: rb, to: rw },
    { id: 'e', type: 'expense', amt: 9999, cur: 'MYR', every: 'month', day0: T + 2, cat: 'other', acct: rb, off: true }
  ];
  const fc = R.forecast(rules, 2000, 'MYR', T, 30);
  near(fc.low.bal, 2000 - 1500 - 55, 0.001, 'the lowest point is just before pay day');
  ok(fc.low.day === T + 12, '…on the day of the last bill before it');
  near(fc.end, 2000 - 1555 + 5200, 0.001, 'where it stands after 30 days');
  near(fc.out, 1555, 0.001, 'bills in the window'); near(fc.in, 5200, 0.001, 'income in the window');
  ok(fc.pts[0].day === T && fc.pts[fc.pts.length - 1].day === T + 30, 'the line runs from today to day 30');
  const up = R.upcoming(rules, T, T + 30, T);
  ok(up.length === 3 + 5 && up[0].rule.id === 'd', 'upcoming: three bills / pay days and five weekly transfers, soonest first (' + up.length + ')');
  const tot = R.totals(rules, 'MYR');
  near(tot.out, 1555, 0.001, 'fixed costs a month (paused rules and transfers left out)'); near(tot.in, 5200, 0.001, 'regular income a month');
  // a bill that is overdue shows as late, once
  const late = R.upcoming([{ id: 'l', type: 'expense', amt: 80, cur: 'MYR', every: 'month', day0: T - 3, cat: 'bills', acct: rb }], T, T + 30, T);
  ok(late.length === 2 && late[0].late && late[0].day === T - 3 && !late[1].late, 'an overdue bill is listed once, marked late, before the next one');

  /* ================= planner maths ================= */
  print('plan: growth, loans, enough');
  let g = P.grow({ start: 0, monthly: 1000, rate: 0.06, years: 10 });
  near(g.value, 163879.35, 0.01, 'RM 1,000 a month at 6% for 10 years');
  near(g.paid, 120000, 1e-6, 'of which you paid in 120,000');
  near(g.growth, 43879.35, 0.01, 'and growth did the rest');
  ok(g.series.length === 11 && g.series[10].year === 10, 'one point a year for the chart');
  g = P.grow({ start: 10000, monthly: 0, rate: 0.12, years: 1 });
  near(g.value, 10000 * Math.pow(1.01, 12), 0.01, 'a lump sum compounding monthly');
  near(P.grow({ start: 5000, monthly: 200, rate: 0, years: 5 }).value, 17000, 1e-6, 'at 0% it is just what you put in');
  ok(P.grow({ start: 0, monthly: 500, rate: 0.05, years: 20, raise: 0.03 }).value > P.grow({ start: 0, monthly: 500, rate: 0.05, years: 20 }).value, 'raising the saving each year ends higher');
  near(P.grow({ start: 0, monthly: 100, rate: 0.06, years: 2.5 }).paid, 3000, 1e-6, 'half years count their six months');
  // "needed" is the inverse of "grow"
  const need = P.needed({ target: 100000, start: 5000, rate: 0.05, years: 8 });
  near(P.grow({ start: 5000, monthly: need, rate: 0.05, years: 8 }).value, 100000, 0.01, 'the monthly saving that reaches the target really reaches it (' + need.toFixed(2) + ')');
  ok(P.needed({ target: 1000, start: 5000, rate: 0.05, years: 3 }) === 0, 'already there: nothing more needed');
  near(P.needed({ target: 12000, start: 0, rate: 0, years: 1 }), 1000, 1e-9, 'at 0%: the gap divided by the months');
  near(P.payment(300000, 0.04, 360), 1432.25, 0.01, 'RM 300,000 over 30 years at 4%: 1,432.25 a month');
  const ln = P.loan({ amount: 300000, rate: 0.04, years: 30, extra: 300 });
  near(ln.interest, 1432.2459 * 360 - 300000, 2, 'interest over the whole loan');
  ok(ln.months === 360, 'paid off in exactly 360 payments');
  ok(ln.extra.months < 360 && ln.extra.saved > 50000 && ln.extra.sooner === 360 - ln.extra.months, 'RM 300 extra a month ends it years sooner and saves a lot (' + ln.extra.months + ' months, ' + Math.round(ln.extra.saved) + ' saved)');
  near(P.loan({ amount: 12000, rate: 0, years: 1 }).payment, 1000, 1e-9, 'an interest-free loan is simply divided up');
  ok(P.loan({ amount: 12000, rate: 0, years: 1 }).interest === 0, '…with no interest');
  near(ln.series[ln.series.length - 1].bal, 0, 0.01, 'the balance ends at zero');
  const fr = P.freedom({ spend: 4000, start: 100000, monthly: 2000, rate: 0.04, take: 0.04 });
  near(fr.target, 1200000, 1e-6, 'RM 4,000 a month needs a pot of 1.2 million at 4%');
  ok(fr.years > 20 && fr.years < 30, 'reached in ' + (fr.years || 0).toFixed(1) + ' years');
  ok(P.freedom({ spend: 4000, start: 0, monthly: 0, rate: 0.04 }).months === null, 'saving nothing never gets there (and does not loop forever)');
  near(P.freedom({ spend: 1000, start: 400000, monthly: 0, rate: 0.03 }).months, 0, 0, 'already enough');

  print('plan: yearly return and the market');
  near(P.xirr([{ day: 0, amt: -1000 }, { day: 365, amt: 1100 }]), 0.10, 1e-6, '1,000 → 1,100 in a year is 10%');
  near(P.xirr([{ day: 0, amt: -1000 }, { day: 730, amt: 1210 }]), 0.10, 1e-6, '1,000 → 1,210 in two years is 10% a year');
  near(P.xirr([{ day: 0, amt: -1000 }, { day: 365, amt: 900 }]), -0.10, 1e-6, 'a loss works too');
  // 1,000 in, another 1,000 half a year later, 2,200 at the end → rate r with 1000(1+r) + 1000(1+r)^0.5 = 2200
  const r2x = P.xirr([{ day: 0, amt: -1000 }, { day: 182.5, amt: -1000 }, { day: 365, amt: 2200 }]);
  near(1000 * (1 + r2x) + 1000 * Math.pow(1 + r2x, 0.5), 2200, 0.001, 'two deposits balance at the rate found (' + (r2x * 100).toFixed(2) + '%)');
  ok(P.xirr([{ day: 0, amt: -1000 }]) === null && P.xirr([{ day: 0, amt: 500 }, { day: 9, amt: 600 }]) === null && P.xirr([]) === null, 'nothing to solve: no answer rather than a wrong one');
  m = fresh();
  const br = acct('Broker', 'broker', 'USD', 0);
  const pA = FF.data.price('VOO', T - 365), pB = FF.data.price('VOO', T - 180);
  S.addTxn({ type: 'buy', day: T - 365, sym: 'VOO', q: 10, p: pA, fee: 0, cur: 'USD', acct: br });
  S.addTxn({ type: 'buy', day: T - 180, sym: 'VOO', q: 5, p: pB, fee: 0, cur: 'USD', acct: br });
  const inv = L.investView(S.me().pf);
  const yr = P.yearly(inv, 'USD', T - 365, T);
  const valueNow = 15 * FF.data.price('VOO', T);
  near(P.xirr([{ day: T - 365, amt: -10 * pA }, { day: T - 180, amt: -5 * pB }, { day: T, amt: valueNow }]), yr.rate, 1e-6, 'a portfolio’s yearly return counts each purchase from its own day');
  // against the market: buying only the market fund is exactly level with the market
  const vs = P.versus(inv, 'USD', 'VOO', T - 400, T, 40); // from before the first purchase: both purchases are "money put in"
  near(vs.mine, vs.market, 0.01, 'holding only the S&P 500 fund is level with the S&P 500');
  near(vs.diff, 0, 0.01, 'difference: nothing');
  near(vs.put, 10 * pA + 5 * pB, 0.01, 'money put in over the period');
  ok(vs.series.length >= 30 && vs.series.every((p) => Math.abs(p.mine - p.market) < 0.02), 'level all the way along the chart');
  S.addTxn({ type: 'buy', day: T - 300, sym: 'NVDA', q: 20, p: FF.data.price('NVDA', T - 300), fee: 0, cur: 'USD', acct: br });
  const vs2 = P.versus(L.investView(S.me().pf), 'USD', 'VOO', T - 400, T, 40);
  near(vs2.mine - vs2.market, vs2.mineGain - vs2.marketGain, 0.01, 'ahead or behind by the difference in gains');
  ok(P.versus(inv, 'USD', 'NOPE', T - 365, T) === null, 'an unknown fund gives no comparison');
  const rk = P.risk(L.investView(S.me().pf), 'USD', T - 365, T);
  ok(rk && rk.swing > 0 && rk.swing < 2 && rk.dip <= 0 && rk.dip > -1 && rk.best.r >= rk.worst.r, 'bumpiness: a yearly swing, a worst dip, a best and a worst day (' + (rk.swing * 100).toFixed(1) + '% / ' + (rk.dip * 100).toFixed(1) + '%)');
  ok(P.risk(L.investView(S.me().pf), 'USD', T - 5, T) === null, 'a week is too short to judge');
  // adding money is not a gain: a big deposit must not show up as a great day
  S.addTxn({ type: 'buy', day: T - 100, sym: 'VOO', q: 200, p: FF.data.price('VOO', T - 100), fee: 0, cur: 'USD', acct: br });
  const rk2 = P.risk(L.investView(S.me().pf), 'USD', T - 365, T);
  ok(rk2.best.r < 0.25, 'a large purchase is not mistaken for a +1000% day (' + (rk2.best.r * 100).toFixed(1) + '%)');
  const dc = P.dca('VOO', 500, 24, 'USD', T);
  near(dc.paid, 12000, 1e-6, '24 months × 500');
  near(dc.value, dc.units * FF.data.price('VOO', T), 0.01, 'worth its units at today’s price');
  near(dc.avgCost, dc.paid / dc.units, 1e-9, 'average price paid');
  ok(dc.series.length === 25 && dc.series[24].day === T, 'a point per month and today');
  ok(P.dca('NOPE', 500, 24, 'USD', T) === null && P.dca('VOO', 0, 24, 'USD', T) === null, 'nothing to simulate');

  print('plan: savings goals');
  let gl = P.goal({ target: 5000, cur: 'MYR', due: T + 300, puts: [{ day: T - 60, amt: 500 }, { day: T - 30, amt: 500 }, { day: T - 1, amt: 250 }] }, null, T);
  near(gl.saved, 1250, 1e-9, 'what was set aside'); near(gl.pct, 0.25, 1e-9, 'a quarter of the way'); near(gl.left, 3750, 1e-9, 'still to go');
  near(gl.perMonth, 3750 / 10, 1e-9, 'per month to make the date (10 months left)');
  ok(gl.pace > 0 && gl.eta > T && gl.onTrack === (gl.eta <= T + 300), 'a finish date at the pace so far');
  gl = P.goal({ target: 1000, cur: 'MYR', puts: [{ day: T - 5, amt: 1000 }] }, null, T);
  ok(gl.done && gl.pct === 1 && gl.left === 0, 'reached');
  gl = P.goal({ target: 1000, cur: 'MYR', puts: [{ day: T - 5, amt: 400 }, { day: T - 2, amt: -600 }] }, null, T);
  ok(gl.saved === 0 && gl.pct === 0, 'taking out more than was put in never goes below zero');
  m = fresh();
  const sv = acct('Japan trip', 'savings', 'MYR', 1800);
  gl = P.goal({ target: 6000, cur: 'MYR', acct: sv, puts: [] }, S.me().pf, T);
  ok(gl.linked && Math.abs(gl.saved - 1800) < 0.001 && Math.abs(gl.pct - 0.3) < 1e-9, 'a goal tied to an account follows its balance');
  gl = P.goal({ target: 6000, cur: 'MYR', acct: 'gone', puts: [{ day: T, amt: 50 }] }, S.me().pf, T);
  ok(!gl.linked && gl.saved === 50, 'if that account is deleted, the goal falls back to what was set aside by hand');
  ok(P.goal({ target: 0, cur: 'MYR', puts: [] }, null, T).pct === 0, 'a goal with no target is simply empty');

  /* ================= bills, goals and backups in the store ================= */
  print('store: bills write themselves — once');
  const at = (d) => { FF.todayOverride = d; };
  m = fresh();
  const sb = acct('Bank', 'bank', 'MYR', 5000), sw = acct('Wallet', 'ewallet', 'MYR', 0);
  let bill = S.addBill({ type: 'expense', name: 'Rent', amt: 1500, cur: 'MYR', cat: 'housing', acct: sb, every: 'month', day0: FF.fromYMD(2026, 10, 1), auto: true });
  ok(bill.last === T - 1 && bill.id && S.extras().bills.length === 1, 'a rule dated in the past only looks ahead from today');
  ok(S.runBills().length === 0 && S.me().pf.txns.filter((x) => x.rc).length === 0, 'nothing is back-filled');
  at(FF.fromYMD(2026, 12, 1));
  let wrote = S.runBills();
  ok(wrote.length === 1 && wrote[0].day === FF.fromYMD(2026, 12, 1) && wrote[0].ref === 'bill:' + bill.id + ':2026-12-01' && wrote[0].note === 'Rent', 'on its day the record is written');
  near(L.accountCash(S.me().pf, S.me().pf.accounts.find((a) => a.id === sb)), 3500, 0.001, 'and the money leaves the account');
  ok(S.runBills().length === 0, 'looking again writes nothing more');
  // the phone was left closed for three months: every month is there, each once
  at(FF.fromYMD(2027, 3, 15));
  wrote = S.runBills();
  ok(wrote.length === 3 && wrote.map((x) => FF.iso(x.day)).join() === '2027-01-01,2027-02-01,2027-03-01', 'three months away: three records, on their own days');
  const refs = S.me().pf.txns.filter((x) => x.rc).map((x) => x.ref);
  ok(refs.length === 4 && refs.filter((r, i) => refs.indexOf(r) === i).length === 4, 'four records in all, no reference twice');
  // a second copy of the app that hasn't noticed yet (same records, the rule's memory behind)
  S.extras().bills[0].last = FF.fromYMD(2026, 12, 31);
  ok(S.runBills().length === 0 && S.me().pf.txns.filter((x) => x.rc).length === 4, 'a copy that lost its place still never writes a record twice');
  ok(S.extras().bills[0].last === FF.fromYMD(2027, 3, 1), '…and catches up');
  // deleting what a rule wrote does not bring it back
  const gone = S.me().pf.txns.find((x) => x.ref === refs[3]);
  S.deleteTxn(gone.id);
  ok(S.runBills().length === 0 && S.me().pf.txns.filter((x) => x.rc).length === 3, 'a record you delete stays deleted');
  // pausing, and a rule whose account is gone
  S.updateBill(bill.id, { off: true });
  at(FF.fromYMD(2027, 4, 2));
  ok(S.runBills().length === 0, 'a paused rule writes nothing');
  S.updateBill(bill.id, { off: false, acct: 'nope' });
  ok(S.runBills().length === 0 && S.extras().bills[0].last < FF.fromYMD(2027, 4, 1), 'a rule without its account waits (nothing lost, nothing written)');
  S.updateBill(bill.id, { acct: sb });
  ok(S.runBills().length === 1, 'fixed: it writes what was waiting');
  // changing the date starts counting from the new date, never backwards
  const moved = S.updateBill(bill.id, { day0: FF.fromYMD(2027, 1, 20) });
  ok(moved.last === FF.today() - 1 && FF.iso(R.nextOpen(moved, FF.today())) === '2027-04-20', 'a new date never reaches back before today');
  const delB = S.deleteBill(bill.id);
  ok(S.extras().bills.length === 0 && delB.id === bill.id, 'deleted');
  S.restoreBill(delB);
  ok(S.extras().bills.length === 1 && S.extras().bills[0].last === moved.last, 'Undo puts it back as it was');
  S.deleteBill(bill.id);

  print('store: bills that ask first');
  at(T);
  const ask = S.addBill({ type: 'expense', name: 'TNB', amt: 120, cur: 'MYR', cat: 'bills', acct: sb, every: 'month', day0: T + 3, auto: false });
  const pay = S.addBill({ type: 'income', name: 'Salary', amt: 5200, cur: 'MYR', cat: 'salary', acct: sb, every: 'month', day0: T + 5 });
  const move = S.addBill({ type: 'transfer', amt: 200, cur: 'MYR', acct: sb, to: sw, every: 'week', day0: T + 1 });
  ok(ask.auto === false && pay.auto === true && move.type === 'transfer' && move.to === sw && !('cat' in move), 'rules keep their shape');
  at(T + 10);
  wrote = S.runBills();
  ok(wrote.length === 3 && wrote.filter((x) => x.type === 'transfer').length === 2 && wrote.some((x) => x.type === 'income' && x.amt === 5200), 'pay day and two weekly transfers wrote themselves; the electricity bill waits');
  ok(R.open(S.extras().bills.find((b) => b.id === ask.id), FF.today()).length === 1, 'one bill is waiting to be confirmed');
  const before = S.me().pf.txns.length;
  const paid = S.payBill(ask.id, { amt: 133.4 });
  ok(paid && paid.tx.amt === 133.4 && paid.tx.day === T + 3 && paid.tx.cat === 'bills' && S.me().pf.txns.length === before + 1, 'confirmed with the real amount, on its due day');
  ok(R.open(S.extras().bills.find((b) => b.id === ask.id), FF.today()).length === 0, 'nothing waiting any more');
  // paid early: the record is dated today, and that due day is done
  const early = S.payBill(ask.id);
  ok(early && early.tx.day === FF.today() && early.due > FF.today(), 'paying the next one early dates it today');
  ok(FF.iso(R.nextOpen(S.extras().bills.find((b) => b.id === ask.id), FF.today())) === FF.iso(R.nth(ask, 2)), 'and the one after that is next');
  const skipped = S.skipBill(ask.id);
  ok(skipped === R.nth(ask, 2) && S.me().pf.txns.filter((x) => x.rc === ask.id).length === 2, 'skipping moves on without a record');
  ok(S.payBill('nope') === null && S.skipBill('nope') === null, 'an unknown rule is ignored');
  // odd input is tidied, never trusted
  const odd2 = S.addBill({ type: 'weird', name: '  ' + 'x'.repeat(80), amt: '-45.678', cur: 'MYR', cat: 'food', acct: sb, every: 'fortnightly-ish', day0: T + 2.4 });
  ok(odd2.type === 'expense' && odd2.name.length === 40 && odd2.amt === 45.68 && odd2.every === 'month' && odd2.day0 === T + 2, 'a rule is tidied when saved');

  print('store: savings goals');
  at(T);
  m = fresh();
  let sg = S.addSaving({ name: 'Japan trip', emo: '🗾', target: 8000, due: T + 240, start: 1000 });
  ok(sg.cur === 'MYR' && sg.puts.length === 1 && P.goal(sg, S.me().pf).saved === 1000, 'a goal can start with something already saved');
  let put = S.putSaving(sg.id, 1000);
  ok(put.reached === 1 && Math.abs(put.after.pct - 0.25) < 1e-9, 'a quarter of the way: cheered');
  put = S.putSaving(sg.id, 100);
  ok(put.reached === 0, 'no second cheer for the same quarter');
  put = S.putSaving(sg.id, -500);
  put = S.putSaving(sg.id, 500);
  ok(put.reached === 0, 'dipping below a milestone and back is not cheered again');
  put = S.putSaving(sg.id, 6000);
  ok(put.reached === 4 && put.after.done, 'reaching the target is the big one');
  ok(S.putSaving(sg.id, 0) === null && S.putSaving('nope', 5) === null && S.putSaving(sg.id, 'abc') === null, 'nothing to add: nothing happens');
  sg = S.updateSaving(sg.id, { name: 'Tokyo', target: 10000 });
  ok(sg.name === 'Tokyo' && sg.target === 10000 && sg.puts.length === 6 && sg.cheered === 4, 'renaming keeps what was saved');
  const delG = S.deleteSaving(sg.id);
  ok(S.extras().goals.length === 0, 'goal deleted');
  S.restoreSaving(delG);
  ok(S.extras().goals.length === 1 && S.extras().goals[0].puts.length === 6, 'and brought back whole');
  ok(S.toggleWatch('TSLA') === true && S.extras().watch.join() === 'TSLA' && S.toggleWatch('TSLA') === false && S.extras().watch.length === 0, 'the watchlist switches on and off');
  S.dismissNudge('tip-a');
  ok(S.nudgeOff('tip-a') && !S.nudgeOff('tip-b'), 'a closed tip stays closed');
  at(T + 20);
  ok(!S.nudgeOff('tip-a') && S.nudgeOff('tip-a', 30), '…for as long as asked, then it may return');
  at(T);

  print('store: a backup you can keep');
  m = fresh();
  const kb = acct('Bank', 'bank', 'MYR', 2500);
  spend(T - 3, 42.5, 'food', kb, 'Lunch');
  S.addBudget({ amt: 900, cats: ['food'] });
  S.addBill({ type: 'expense', name: 'Gym', amt: 99, cur: 'MYR', cat: 'health', acct: kb, every: 'month', day0: T + 9 });
  S.addSaving({ name: 'Bike', target: 1200, start: 300 });
  const file = JSON.parse(JSON.stringify(S.backup()));
  const info = S.readBackup(file);
  ok(info && info.records === 2 && info.accounts === 2 && info.budgets === 1 && info.bills === 1 && info.goals === 1, 'a backup says what is inside');
  const snap = S.snapshot();
  spend(T - 1, 999, 'shopping', kb);
  S.deleteBudget(S.me().budgets[0].id);
  S.deleteBill(S.extras().bills[0].id);
  ok(S.restoreBackup(file) === true, 'restored');
  ok(S.me().pf.txns.length === 2 && S.me().budgets.length === 1 && S.extras().bills.length === 1 && S.extras().goals[0].name === 'Bike', 'everything is as it was in the file');
  near(C.summary(S.me().pf, 'MYR').value, 2457.5, 0.001, 'to the cent');
  S.restore(snap);
  ok(S.me().pf.txns.length === 2, 'and Undo still works afterwards');
  ok(S.readBackup(null) === null && S.readBackup({ app: 'other', pf: { txns: [], accounts: [] } }) === null && S.readBackup({ app: 'family-finance', pf: { txns: [{ id: 5 }], accounts: [{ id: 'a', cur: 'MYR' }] } }) === null && S.readBackup({ app: 'family-finance', pf: { txns: [], accounts: [] } }) === null, 'anything that is not a backup is refused');
  const n0 = S.me().pf.txns.length;
  ok(S.restoreBackup({ app: 'family-finance', pf: 'junk' }) === false && S.me().pf.txns.length === n0, 'a bad file changes nothing');
  // a backup from someone who held a stock this copy has never heard of
  const exotic = JSON.parse(JSON.stringify(file));
  exotic.pf.txns.push({ id: 'tz', type: 'buy', day: T - 5, sym: 'ZZZZ9', q: 1, p: 10, cur: 'USD', acct: kb });
  ok(S.restoreBackup(exotic) && !S.me().pf.txns.some((x) => x.sym === 'ZZZZ9') && isFinite(C.summary(S.me().pf, 'MYR').value), 'a holding nobody can price is left out rather than breaking the totals');

  print('\n' + passed + ' passed, ' + failed + ' failed');
}).call(this);
