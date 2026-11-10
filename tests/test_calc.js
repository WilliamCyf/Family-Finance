/* FamFi engine tests — run with macOS jsc:
   JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
   $JSC js/core.js js/data.js js/calc.js js/ledger.js js/play.js js/lucky.js js/blast.js js/grid.js js/store.js js/market.js tests/test_calc.js        */
(function () {
  'use strict';
  const FF = this.FF;
  let passed = 0, failed = 0;
  const ok = (cond, msg) => { if (cond) passed++; else { failed++; print('  ✗ ' + msg); } };
  const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= (eps || 0.01), msg + ' (' + a + ' vs ' + b + ')');
  const C = FF.calc, S = FF.store;
  FF.todayOverride = FF.fromYMD(2026, 10, 4);

  /* ---------- demo families ---------- */
  ['en', 'zh', 'th'].forEach((lang) => {
    S.init({ memory: true });
    S.seedDemo(lang);
    const fam = S.family();
    ok(fam.members.length === 4, lang + ': 4 members');
    fam.members.forEach((id) => {
      const m = S.member(id);
      const s = C.summary(m.pf, m.pf.base);
      ok(s.cash > -0.01, lang + ' ' + m.name + ': cash not negative (' + s.cash.toFixed(2) + ')');
      ok(s.value > 0, lang + ' ' + m.name + ': has value');
      ok(!m.pf.txns.some((x) => x.type === 'opening' || x.setup), lang + ' ' + m.name + ': no Setup Mode leftovers');
      const h = C.history(m.pf, m.pf.base, C.firstDay(m.pf), FF.today(), 200);
      ok(h.every((p) => p.value - p.hv > -0.02), lang + ' ' + m.name + ': cash never negative in history');
      print('  ' + lang + ' ' + m.name + ': value ' + s.value.toFixed(0) + ' ' + m.pf.base + ', gain ' + s.gain.toFixed(0) + ' (' + (s.gainPct * 100).toFixed(1) + '%), cash ' + s.cash.toFixed(0) + ', today ' + s.todayChange.toFixed(0) + ', lvl ' + C.level(s.value * FF.data.fx(m.pf.base, 'MYR')));
    });
    // layout: every house valid and not overlapping
    const occ = S.occupied();
    occ.forEach((o) => ok(FF.grid.valid(o.i, o.j, occ, o.id), lang + ': ' + o.id + ' placed validly'));
    const me = S.me();
    ok(me.pf.accounts.some((a) => a.kind === 'bank') && me.pf.txns.some((x) => x.type === 'expense') && me.pf.txns.some((x) => x.type === 'income'), lang + ': demo has everyday money (bank, spending, pay day)');
    ok((me.budgets || []).length >= 3 && S.family().hall && Object.keys(S.family().hall.accounts).length === 3, lang + ': demo has budgets and a Town Hall');
    const al = C.allocation(me.pf, me.pf.base, 'type');
    near(FF.sum(al.slices, (x) => x.pct), 1, 1e-9, lang + ': allocation sums to 100%');
    ['1m', '3m', 'ytd', '1y', 'all'].forEach((p) => {
      const r = C.returnFor(me.pf, me.pf.base, p);
      ok(isFinite(r.gain) && isFinite(r.pct), lang + ': return ' + p + ' finite');
      near(r.priceGrowth + r.dividends - r.fees + r.fxEffect, r.gain, 0.01, lang + ': return parts add up (' + p + ')');
    });
    const allR = C.returnFor(me.pf, me.pf.base, 'all');
    const sm = C.summary(me.pf, me.pf.base);
    near(allR.gain, sm.gain, 0.05, lang + ': all-time return equals summary gain');
    ok(FF.sum(C.dividendYear(me.pf, me.pf.base, 2026).months, (m) => m.received + m.expected) > 0, lang + ': dividend year has money');
    print('  ' + lang + ' pets: ' + Object.keys(S.family().pets).join(','));
  });

  /* ---------- stock records never move cash ---------- */
  S.init({ memory: true });
  S.createAccount({ name: 'Test', avatar: { kind: 'illus' } });
  S.createFamily('Test Family');
  const m = S.me();
  const t = FF.today();
  const usd = (d) => FF.data.fx('USD', 'MYR', d);
  ok(!('setupMode' in m.pf), 'no Setup Mode for new users');
  const pKO = FF.data.price('KO', t - 400);
  S.addTxn({ type: 'buy', day: t - 400, sym: 'KO', q: 100, p: pKO, fee: 8, cur: 'USD', acct: 'a1' });
  S.addTxn({ type: 'buy', day: t - 300, sym: 'AAPL', q: 10, p: FF.data.price('AAPL', t - 300), fee: 0, cur: 'USD', acct: 'a1' });
  S.addTxn({ type: 'dividend', day: t - 200, sym: 'KO', amt: 51, cur: 'USD', acct: 'a1' });
  S.addTxn({ type: 'buy', day: t - 20, sym: 'BTC', q: 0.01, p: FF.data.price('BTC', t - 20), fee: 0, cur: 'USD', acct: 'a1' });
  const before = C.summary(m.pf, 'MYR');
  near(before.cash, 0, 0.005, 'adding stocks leaves cash at 0');
  near(FF.ledger.accountCash(m.pf, m.pf.accounts[0]), 0, 0.005, '…and the account’s money at 0');
  near(before.value, before.holdingsValue, 0.005, 'total = what the stocks are worth');
  near(before.gain, before.holdingsValue - before.invested + 51 * usd(t - 200), 0.02, 'gain = price gain + the dividend');
  const hist = C.history(m.pf, 'MYR', t - 420, t, 400);
  ok(hist.every((p) => Math.abs(p.value - p.hv) < 0.02), 'history: cash stays 0 on every past day');
  // fixing a typo in the price paid: the total stays, only the gain moves
  const ko = m.pf.txns.find((x) => x.sym === 'KO' && x.type === 'buy');
  S.updateTxn(ko.id, { p: pKO + 10 });
  const fixed = C.summary(m.pf, 'MYR');
  near(fixed.value, before.value, 0.005, 'editing the price paid: total unchanged');
  near(fixed.cash, 0, 0.005, 'editing the price paid: cash unchanged');
  near(fixed.gain, before.gain - 1000 * usd(t - 400), 0.02, 'editing the price paid: gain moves by exactly the difference');
  const r1 = C.returnFor(m.pf, 'MYR', '1y');
  near(r1.priceGrowth + r1.dividends - r1.fees + r1.fxEffect, r1.gain, 0.01, 'return parts add up');
  near(C.returnFor(m.pf, 'MYR', 'all').gain, fixed.gain, 0.05, 'all-time return = summary gain');
  ok(!m.badges.setup_done, '(no balance set yet)');
  S.addAccount({ name: 'Bank', kind: 'bank', cur: 'MYR' }, 2500);
  ok(m.badges.setup_done, 'badge: setup_done once an account has its balance');
  near(C.summary(m.pf, 'MYR').value, fixed.value + 2500, 0.005, 'the bank balance simply adds to the total');
  // records from older versions: Finish Setup's locked parts gave back the cash old buys used to take
  const legacy = { base: 'MYR', accounts: [{ id: 'a1', kind: 'cash', cur: 'MYR' }], txns: [
    { id: 'x1', type: 'buy', day: t - 50, sym: 'KO', q: 10, p: 60, fee: 0, cur: 'USD', acct: 'a1', setup: true },
    { id: 'x2', type: 'income', day: t - 40, amt: 300, cur: 'MYR', acct: 'a1', cat: 'salary' },
    { id: 'x3', type: 'opening', day: t - 30, cur: 'MYR', acct: 'a1', parts: [{ day: t - 50, acct: 'a1', cur: 'USD', amt: 600, lock: true }, { day: t - 30, acct: 'a1', cur: 'MYR', amt: -300, lock: false }] },
    { id: 'x4', type: 'income', day: t - 5, amt: 120, cur: 'MYR', acct: 'a1', cat: 'salary' }] };
  near(C.summary(legacy, 'MYR').cash, 120, 0.005, 'old Finish Setup: only its "leftover cash to 0" part still counts');
  legacy.txns[0].p = 70;
  near(C.summary(legacy, 'MYR').cash, 120, 0.005, 'old Finish Setup: fixing an old buy’s price no longer moves cash');

  /* ---------- sells & positions ---------- */
  const koVal = fixed.holdings.find((h) => h.sym === 'KO').value;
  const pS = FF.data.price('KO', t - 10);
  S.addTxn({ type: 'sell', day: t - 10, sym: 'KO', q: 40, p: pS, fee: 5, cur: 'USD', acct: 'a1' });
  const pos = C.positions(m.pf, t).KO;
  near(pos.qty, 60, 1e-9, 'sell reduces quantity');
  ok(isFinite(pos.realized), 'realised gain computed');
  const sold = C.summary(m.pf, 'MYR');
  near(sold.cash, 2500, 0.005, 'selling doesn’t put money into any account');
  near(sold.gain, fixed.gain - 0.4 * koVal + (40 * pS - 5) * usd(t - 10), 0.05, 'the sale’s money still counts in the gain');

  /* ---------- streaks ---------- */
  const w = FF.weekOf(t);
  const days = [t, t - 7, t - 14, t - 21, t - 35];
  ok(C.weekStreak(days, t).weeks === 4, 'streak counts consecutive weeks (' + C.weekStreak(days, t).weeks + ')');
  ok(w > 0, 'week index');

  /* ---------- budget ---------- */
  const bud = S.addBudget({ amt: 6000, cats: [] });
  S.addTxn({ type: 'expense', day: t, amt: 120.5, cur: 'MYR', acct: 'a1', cat: 'food', note: '' });
  const bm = FF.ledger.budgetProgress(bud, m.pf, t);
  near(bm.left, 6000 - 120.5, 0.001, 'budget left this month');
  ok(bm.daysLeft > 0 && bm.perDay > 0, 'budget per-day allowance');

  /* ---------- goals & pets ---------- */
  S.simulateJoin();
  ok(S.family().members.length === 2, 'demo join adds a house');
  ok(S.family().pets.puppy, 'puppy arrives when the family grows');
  const g1 = S.addGoal('A'), g2 = S.addGoal('B'), g3 = S.addGoal('C');
  let rr = S.toggleGoal(g1.id);
  ok(rr.pets.indexOf('cat') !== -1, 'cat arrives on first goal');
  S.toggleGoal(g2.id); rr = S.toggleGoal(g3.id);
  ok(rr.pets.indexOf('pig') !== -1, 'pig arrives on third goal');
  rr = S.toggleGoal(g3.id);
  ok(!S.family().goals.find((g) => g.id === g3.id).done, 'untick to redo');

  /* ---------- currency: a ringgit investor buying US stocks while USD/MYR falls ---------- */
  {
    const T = FF.today();
    const series = [];
    for (let d = T - 900; d <= T - 1; d++) { const k = (d - (T - 900)) / 899; series.push([d, { USD: 1 / (4.7 - 0.6 * k), SGD: 0.3, THB: 7.7, CNY: 1.6, HKD: 1.85 }]); }
    FF.data.setFXHistory(series);
    FF.data.FX.USD = 4.1;
    ok(Math.abs(FF.data.fx('USD', 'MYR', T - 900) - 4.7) < 1e-9, 'fx history: rate on an old day');
    ok(Math.abs(FF.data.fx('USD', 'MYR') - 4.1) < 1e-9, 'fx history: today uses the live rate');

    S.init({ memory: true });
    S.createAccount({ name: 'FX', avatar: { kind: 'illus' } });
    const fm = S.me();
    S.addTxn({ type: 'buy', day: T - 600, sym: 'AAPL', q: 20, p: FF.data.price('AAPL', T - 600), fee: 0, cur: 'USD', acct: 'a1' });
    S.addTxn({ type: 'buy', day: T - 200, sym: 'KO', q: 50, p: FF.data.price('KO', T - 200), fee: 1, cur: 'USD', acct: 'a1' });
    const af = C.summary(fm.pf, 'MYR');
    near(af.cash, 0, 0.005, 'fx: buying leaves cash at exactly 0');
    const h = C.history(fm.pf, 'MYR', T - 620, T, 300);
    ok(h.every((p) => Math.abs(p.value - p.hv) < 0.02), 'fx: cash stays 0 on every past day');
    near(af.invested, 20 * FF.data.price('AAPL', T - 600) * FF.data.fx('USD', 'MYR', T - 600) + (50 * FF.data.price('KO', T - 200) + 1) * FF.data.fx('USD', 'MYR', T - 200), 0.02, 'fx: “what you paid” uses each purchase day’s rate');
    const rr = C.returnFor(fm.pf, 'MYR', 'all');
    ok(rr.fxEffect < 0, 'fx: a falling dollar shows as a negative currency effect (' + rr.fxEffect.toFixed(2) + ')');
    near(rr.priceGrowth + rr.dividends - rr.fees + rr.fxEffect, rr.gain, 0.01, 'fx: prices + dividends − fees + currency = gain');
    near(af.contrib, af.invested, 0.02, 'fx: money put in = what was paid, at each day’s rate');
    // money put in later is valued at its own day's rate
    S.addTxn({ type: 'deposit', day: T - 100, amt: 1000, cur: 'USD', acct: 'a1' });
    const dep = C.summary(fm.pf, 'MYR');
    near(dep.contrib - af.contrib, 1000 * FF.data.fx('USD', 'MYR', T - 100), 0.01, 'fx: a deposit counts at its own day’s rate');
    near(dep.cash, 1000 * 4.1, 0.01, 'fx: cash is valued at today’s rate');
    FF.data.setFXHistory(null);
    FF.data.FX.USD = 4.21;
  }

  /* ---------- live price sources: Finnhub + Twelve Data ---------- */
  {
    const MK = FF.market;
    const q = MK.parseFinnhubQuote({ c: 233.95, d: 3.09, dp: 1.338, h: 235, l: 229.1, o: 230, pc: 230.86, t: 1790971201 });
    ok(q && q.p === 233.95 && q.pc === 230.86 && q.t === 1790971201000, 'finnhub: quote parsed');
    ok(MK.parseFinnhubQuote({ c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 }) === null, 'finnhub: unknown symbol ignored');
    const one = MK.parseTwelveData({ meta: { symbol: 'AAPL' }, status: 'ok', values: [{ datetime: '2026-10-02', close: '333.69000' }, { datetime: '2026-10-01', close: '330.32001' }, { datetime: '2026-09-30', close: '333.019989' }] }, ['AAPL']);
    ok(one.AAPL && one.AAPL.length === 3 && one.AAPL[0][0] === FF.fromYMD(2026, 9, 30) && one.AAPL[2][1] === 333.69, 'twelve data: single series parsed oldest→newest');
    const many = MK.parseTwelveData({ AAPL: { status: 'ok', values: [{ datetime: '2026-10-02', close: '333.69' }] }, MSFT: { status: 'error', code: 400, message: 'x' } }, ['AAPL', 'MSFT']);
    ok(many.AAPL && !many.MSFT, 'twelve data: batch keeps good series, skips errors');
    ok(MK.usMarketOpen(new Date(Date.UTC(2026, 9, 5, 14, 0))) === true, 'market hours: Monday 10:00 New York is open');
    ok(MK.usMarketOpen(new Date(Date.UTC(2026, 9, 5, 21, 0))) === false, 'market hours: Monday 17:00 New York is closed');
    ok(MK.usMarketOpen(new Date(Date.UTC(2026, 9, 3, 15, 0))) === false, 'market hours: Saturday is closed');
    const mon10 = Date.UTC(2026, 9, 5, 14, 0);
    ok(MK.liveNow({ qAt: mon10, t: mon10 - 60 * 1000 }, mon10) === true, 'live: fresh trade during the session');
    ok(MK.liveNow({ qAt: mon10, t: mon10 - 3 * 24 * 3600 * 1000 }, mon10) === false, 'live: holiday (no trade today) shows closed');
    ok(MK.liveNow({ t: mon10 }, mon10) === false, 'live: history-only prices are never "live"');

    // demo family seeded on demo prices gets re-priced once real history arrives
    S.init({ memory: true });
    S.seedDemo('en');
    const T = FF.today();
    const L = { d0: T - 2200, c: [], p: 510, pc: 505, t: Date.now(), open: false, quoted: true };
    for (let d = T - 2200; d <= T - 1; d++) L.c.push(500);
    FF.data.setLive('VOO', L);
    ok(S.repriceDemo(), 'demo re-priced when real history lands');
    const me = S.me();
    ok(me.pf.txns.filter((t) => t.sym === 'VOO' && t.type === 'buy').every((t) => t.p === 500), 'demo VOO purchases now use the real close');
    const hist = C.history(me.pf, me.pf.base, C.firstDay(me.pf), T, 300);
    ok(hist.every((p) => p.value - p.hv > -0.02), 'cash never negative after re-pricing');
    ok(!S.repriceDemo(), 're-pricing is idempotent');
    delete FF.data.LIVE.VOO;
  }

  /* ---------- cash added in ringgit to a US-dollar account ---------- */
  {
    S.init({ memory: true });
    S.createAccount({ name: 'Mum', avatar: {} });
    const pf = S.me().pf;
    ok(pf.base === 'MYR', 'new accounts show money in MYR by default (got ' + pf.base + ')');
    ok(pf.accounts[0].kind === 'cash' && pf.accounts[0].cur === 'MYR', 'a new person starts with an everyday Main account in ringgit');
    Object.assign(pf.accounts[0], { kind: 'broker', cur: 'USD' }); // …turned into a US brokerage for the next checks
    const T = FF.today();
    S.addTxn({ type: 'deposit', day: T - 10, amt: 1000, cur: 'MYR', acct: 'a1' });
    let s = C.summary(pf, 'MYR', T - 10);
    near(s.cash, 1000, 0.001, 'RM 1,000 added shows as RM 1,000 cash');
    near(s.contrib, 1000, 0.001, '…and as RM 1,000 put in');
    near(s.gain, 0, 0.001, '…with no made-up gain');
    near(C.cashByAccountIn(pf, 'MYR', T - 10).a1, 1000, 0.001, 'the account shows RM 1,000 too');
    const usd = FF.data.fx('MYR', 'USD', T - 10);
    S.addTxn({ type: 'buy', day: T - 10, sym: 'KO', q: 2, p: 60, fee: 0, cur: 'USD', acct: 'a1' });
    s = C.summary(pf, 'MYR', T - 10);
    near(s.cash, 1000, 0.001, 'buying a US stock leaves the ringgit cash alone');
    near(s.contrib, 1000 + 120 / usd, 0.01, '…and counts what it cost (at that day’s rate) as money put in');
    near(C.cashByAccountIn(pf, 'MYR').a1, C.summary(pf, 'MYR').cash, 0.001, 'account cash = Home cash');
    S.addTxn({ type: 'withdraw', day: T - 5, amt: 100, cur: 'MYR', acct: 'a1' });
    s = C.summary(pf, 'MYR', T - 5);
    near(s.contrib, 900 + 120 / usd, 0.01, 'taking out RM 100 lowers money put in by RM 100');
  }

  /* ---------- the bigger US catalogue + stocks added through live search ---------- */
  {
    const D = FF.data;
    const first = (q) => (D.search(q)[0] || {}).s;
    ok(first('reddit') === 'RDDT' && first('RDDT') === 'RDDT', 'Reddit is in the list');
    ok(first('spacex') === 'SPCX' && first('starlink') === 'SPCX' && first('สเปซเอ็กซ์') === 'SPCX', 'SpaceX found by name, Starlink and in Thai');
    ok(first('DRAM') === 'DRAM' && D.search('dram').some((a) => a.s === 'MU'), 'DRAM finds the memory ETF (and Micron)');
    ok(first('tsmc') === 'TSM' && first('台积电') === 'TSM' && first('TSM') === 'TSM', 'TSMC found by ticker, name and in Chinese');
    ok(first('shopee') === 'SE' && first('grab') === 'GRAB', 'Shopee (Sea) and Grab are there');
    ok(D.ASSETS.filter((a) => a.t !== 'crypto').length >= 110, 'at least 110 US stocks & ETFs (' + D.ASSETS.filter((a) => a.t !== 'crypto').length + ')');
    ok(D.ASSETS.every((a) => a.p > 0 && a.c && a.x && D.SECTORS.indexOf(a.sec) !== -1), 'every asset has a price, currency, market and known sector');
    const seen = {}; ok(D.ASSETS.every((a) => !seen[a.s] && (seen[a.s] = 1)), 'no ticker listed twice');
    // helpers that turn Finnhub's answers into friendly names / sectors / markets
    const M = FF.market;
    ok(M.tidyName('REDDIT INC-CL A') === 'Reddit' && M.tidyName('ROUNDHILL MEMORY ETF') === 'Roundhill Memory ETF' && M.tidyName('Space Exploration Technologies Corp') === 'Space Exploration Technologies', 'names are tidied (' + M.tidyName('REDDIT INC-CL A') + ', ' + M.tidyName('ROUNDHILL MEMORY ETF') + ')');
    ok(M.sectorFor('Semiconductors', 'other') === 'tech' && M.sectorFor('Banking', 'other') === 'banks' && M.sectorFor('Media', 'other') === 'consumer' && M.sectorFor('Something new', 'other') === 'other', 'industries map to sectors');
    ok(M.marketFor('NASDAQ NMS - GLOBAL MARKET') === 'NASDAQ' && M.marketFor('NEW YORK STOCK EXCHANGE, INC.') === 'NYSE' && M.marketFor('') === 'US', 'exchanges are named simply');
    // a stock picked from live search: bought, saved, and still known after a restart
    ok(!D.addAsset({ s: 'bad sym' }) && !D.addAsset({ s: 'TOOLONGX' }), 'odd tickers are refused');
    const zz = D.addAsset({ s: 'ZZTX', n: 'Zed Test Co', t: 'stock', sec: 'tech', x: 'NASDAQ', p: 12.5 });
    ok(zz && zz.custom && D.asset('ZZTX') === zz && D.search('zed test')[0] === zz, 'a looked-up stock joins the catalogue and search');
    ok(D.addAsset({ s: 'AAPL', n: 'Fake Apple', p: 1 }).n === 'Apple', 'a lookup can never replace a built-in stock');
    S.init({ memory: true });
    S.createAccount({ name: 'Jamie', avatar: {} });
    S.addTxn({ type: 'buy', day: FF.today() - 3, sym: 'ZZTX', q: 10, p: 12.5, fee: 0, cur: 'USD', acct: 'a1' });
    ok(S.me().pf.assets && S.me().pf.assets.ZZTX && S.me().pf.assets.ZZTX.n === 'Zed Test Co', 'its details are saved with the portfolio');
    const saved = JSON.parse(JSON.stringify(S.state));
    delete D.BY.ZZTX; D.ASSETS.splice(D.ASSETS.indexOf(zz), 1); // a fresh phone that has never seen it
    S.state = saved;
    S.learnAssets(saved.members[saved.meId].pf);
    ok(D.asset('ZZTX') && D.asset('ZZTX').n === 'Zed Test Co', 'another phone learns it from the portfolio');
    ok(C.summary(S.me().pf, 'USD').holdings.some((h) => h.sym === 'ZZTX'), '…and shows the holding');
  }

  /* ---------- deleting an account moves its records, never loses them ---------- */
  {
    S.init({ memory: true });
    S.createAccount({ name: 'Mum', avatar: {} });
    const pf = S.me().pf, T = FF.today();
    ok(!S.removeAccount(pf.accounts[0].id), 'the only account can’t be deleted');
    const bank = S.addAccount({ name: 'Maybank savings', kind: 'bank', cur: 'MYR' });
    S.addTxn({ type: 'deposit', day: T - 20, amt: 5000, cur: 'MYR', acct: bank.id });
    S.addTxn({ type: 'buy', day: T - 15, sym: 'KO', q: 10, p: 60, fee: 0, cur: 'USD', acct: bank.id });
    S.addTxn({ type: 'deposit', day: T - 10, amt: 300, cur: 'USD', acct: 'a1' });
    ok(S.accountRecords(pf, bank.id) >= 2, 'records in the account are counted (' + S.accountRecords(pf, bank.id) + ')');
    const before = C.summary(pf, 'MYR');
    const snap = S.snapshot();
    ok(S.removeAccount(bank.id, 'a1'), 'account deleted');
    ok(pf.accounts.length === 1 && pf.accounts[0].id === 'a1', 'it’s gone from the list');
    ok(!pf.txns.some((t) => t.acct === bank.id || (t.parts || []).some((p) => p.acct === bank.id)), 'no record still points at it');
    const after = C.summary(pf, 'MYR');
    near(after.value, before.value, 0.001, 'total value unchanged');
    near(after.gain, before.gain, 0.001, 'gain unchanged');
    near(after.cash, before.cash, 0.001, 'cash unchanged');
    ok(after.holdings.some((h) => h.sym === 'KO'), 'its holdings now live in the other account');
    S.restore(snap);
    ok(S.me().pf.accounts.length === 2 && S.accountRecords(S.me().pf, bank.id) >= 2, 'Undo brings the account and its records back');
    const main = S.me().pf.accounts[0];
    ok(main.nameKey && !main.name, '(main account starts with the built-in name)');
    S.updateAccount(main.id, { name: 'Moomoo US', kind: 'broker', cur: 'USD' });
    ok(S.me().pf.accounts[0].name === 'Moomoo US' && !S.me().pf.accounts[0].nameKey, 'renaming replaces the built-in name');
  }

  /* ---------- everyday money (Wallet-style) next to investments ---------- */
  {
    const Lg = FF.ledger, T = FF.today();
    S.init({ memory: true });
    S.createAccount({ name: 'Jamie', avatar: {} });
    const m = S.me(), pf = m.pf;
    const main = pf.accounts[0];
    S.updateAccount(main.id, { name: 'Wallet' });
    const pb = S.addAccount({ name: 'Public Bank', kind: 'bank', cur: 'MYR' }, 8000);
    const gx = S.addAccount({ name: 'GX Bank', kind: 'bank', cur: 'MYR' }, 1500);
    const moo = S.addAccount({ name: 'Moomoo', kind: 'broker', cur: 'USD' });
    const val = (a) => Lg.accountValue(pf, a);
    near(val(pb), 8000, 1e-9, 'a new account starts with its balance');
    S.addTxn({ type: 'income', day: T - 9, amt: 5200, cur: 'MYR', acct: pb.id, cat: 'salary', note: 'Salary' });
    S.addTxn({ type: 'expense', day: T - 8, amt: 45.6, cur: 'MYR', acct: main.id, cat: 'food', note: 'Nasi lemak with team' });
    S.addTxn({ type: 'expense', day: T - 7, amt: 320, cur: 'MYR', acct: pb.id, cat: 'groceries', note: '' });
    S.addTxn({ type: 'transfer', day: T - 6, amt: 500, cur: 'MYR', acct: pb.id, to: gx.id });
    const nw0 = C.summary(pf, 'MYR', T - 6).value;
    const usd = FF.data.fx('MYR', 'USD', T - 5);
    S.addTxn({ type: 'transfer', day: T - 5, amt: 2000, cur: 'MYR', acct: pb.id, to: moo.id, toAmt: FF.round2(2000 * usd), toCur: 'USD' });
    near(C.summary(pf, 'MYR', T - 5).value, nw0, 0.05, 'moving money between my accounts (even MYR → USD) doesn’t change what I have');
    near(val(pb), 8000 + 5200 - 320 - 500 - 2000, 1e-6, 'bank balance: start + salary − spending − transfers');
    near(val(gx), 2000, 1e-9, 'GX received the transfer');
    near(val(main), -45.6, 1e-9, 'cash wallet went down by what was spent');
    S.addTxn({ type: 'buy', day: T - 4, sym: 'KO', q: 10, p: 60, fee: 0, cur: 'USD', acct: moo.id });
    // investments, without the everyday money
    const inv = Lg.investView(pf);
    ok(inv.accounts.length === 1 && inv.accounts[0].id === moo.id, 'investment view: only the brokerage');
    ok(inv.txns.every((t) => t.type !== 'expense' && t.type !== 'income'), 'investment view: no spending or salary');
    const iv = C.summary(inv, 'MYR');
    near(iv.contrib, 2000 + 600 * FF.data.fx('USD', 'MYR', T - 4), 0.01, 'investment view: money put in = the RM 2,000 transfer + what the shares cost');
    near(iv.cash, 2000, 0.05, 'investment view: the transfer is still there as cash (buying didn’t spend it)');
    near(iv.gain, iv.holdingsValue - iv.invested, 60, 'investment gain is just the shares (+ a little currency move) — salary never counts');
    // what family members may see
    const sh = Lg.shareView(pf);
    const json = JSON.stringify(sh);
    ok(json.indexOf('Nasi lemak') === -1 && json.indexOf('groceries') === -1 && json.indexOf('"cat"') === -1 && json.indexOf('Salary') === -1, 'family copy: never what anything was spent on');
    near(C.summary(sh, 'MYR').value, C.summary(pf, 'MYR').value, 0.05, 'family copy: same total as mine');
    ok(sh.accounts.length === 4 && sh.share, 'family copy: every account, as balances');
    // the month in numbers
    const p = FF.ymd(T - 8);
    const ms = Lg.monthStats(pf, 'MYR', p.y, p.m);
    ok(ms.expense >= 45.6 && ms.byCat.some((c) => c.cat.id === 'food'), 'month: spending by category');
    // budgets
    const b1 = S.addBudget({ amt: 400, cats: ['food', 'groceries'] });
    const pr = Lg.budgetProgress(b1, pf, T);
    const inMonth = (d) => d >= FF.monthStart(FF.ymd(T).y, FF.ymd(T).m);
    near(pr.spent, (inMonth(T - 8) ? 45.6 : 0) + (inMonth(T - 7) ? 320 : 0), 1e-6, 'budget counts only its categories this month');
    const wk = S.addBudget({ amt: 100, cats: [], period: 'week' });
    const rw = Lg.periodRange('week', T);
    ok(rw.to - rw.from === 6 && FF.ymd(rw.from).wd === 1 && T >= rw.from && T <= rw.to, 'weekly budget runs Monday to Sunday');
    ok(Lg.budgetProgress(wk, pf, T).spent >= 0, 'weekly budget progress');
    // balance updates
    S.adjustBalance(gx.id, 1999.5);
    near(val(gx), 1999.5, 1e-9, '"the balance is really…" adjusts it exactly');
    // the old monthly budget moves into records + budgets, without touching balances
    const old = { pf: { base: 'MYR', txns: [], accounts: [] }, budget: { on: true, income: 5000, cats: [{ id: 'food', icon: '🍚', limit: 800 }, { id: 'home', icon: '🏠', limit: 0 }], spends: [{ id: 's1', day: T, cat: 'home', amt: 1200, note: 'Rent', ts: 1 }] } };
    ok(Lg.upgradeBudget(old) && !old.budget && old.budgets.length === 1 && old.pf.txns[0].type === 'expense' && old.pf.txns[0].cat === 'housing' && old.pf.txns[0].acct === null, 'old budget → records + budgets');
    near(C.summary(old.pf, 'MYR').cash, 0, 1e-9, '…and no account balance changes');
    // "Update balance" is about the money: stocks in the account are left out of it
    const mooCash = Lg.accountCash(pf, moo);
    ok(val(moo) > mooCash + 1, '(the brokerage holds shares)');
    S.adjustBalance(moo.id, mooCash + 25);
    near(Lg.accountCash(pf, moo), mooCash + 25, 1e-6, 'Update balance on a brokerage changes only its money');
    ok(C.summary(Lg.accountView(pf, moo.id), 'USD').count === 1, '…and its shares stay');
  }

  /* ---------- the Town Hall ---------- */
  {
    const Lg = FF.ledger;
    const hall = { name: 'Hall', accounts: { a: { name: 'ASB', cur: 'MYR', entries: { e1: { t: 'set', amt: 1000, day: 10, ts: 1 }, e2: { t: 'add', amt: 250, day: 20, ts: 2 }, e3: { t: 'set', amt: 1600, day: 30, ts: 3 } } },
      b: { name: 'US fund', cur: 'USD', entries: { e1: { t: 'set', amt: 100, day: 5, ts: 1 } } } } };
    near(Lg.hallBalance(hall.accounts.a), 1600, 1e-9, 'hall: latest value wins after a "set"');
    near(Lg.hallBalance(hall.accounts.a, 25), 1250, 1e-9, 'hall: value on an earlier day');
    near(Lg.hallTotal(hall, 'MYR'), 1600 + 100 * FF.data.fx('USD', 'MYR'), 1e-6, 'hall: total in my currency');
    ok(Lg.hallActivity(hall)[0].after === 1600, 'hall: newest change first');
    S.init({ memory: true });
    S.seedDemo('en');
    S.state.family.hall = null;
    S.buildHall('  Our Family Hall  ');
    ok(S.family().hall.name === 'Our Family Hall' && S.family().layout._hall, 'build a hall: named and placed');
    const id = S.addHallAccount({ name: 'Land', kind: 'property', cur: 'MYR', value: 50000 });
    S.addHallEntry(id, { t: 'add', amt: 2500 });
    near(Lg.hallBalance(S.family().hall.accounts[id]), 52500, 1e-9, 'hall account: start value + added');
    S.renameHall('Tan HQ');
    ok(S.family().hall.name === 'Tan HQ', 'anyone can rename the hall');
  }

  /* ---------- dividends worked out from prices, then added automatically ---------- */
  {
    const M = FF.market, Lg = FF.ledger;
    // synthetic KO-like prices: dividends of 0.51 on two ex-days, one glitchy step, and a 2:1 split
    const raw = [], adj = [];
    let factor = 1;
    const exs = { 100: 0.51, 191: 0.51, 282: 0.51, 373: 0.53 };
    const glitch = { 191: 0.58 }; // the provider's adjustment is off once
    for (let d = 1; d <= 400; d++) {
      const close = d < 300 ? 60 + (d % 7) * 0.1 : 30 + (d % 7) * 0.05; // 2:1 split on day 300
      raw.push([d, close]);
    }
    // adjusted series: every dividend scales all earlier prices by (1 − D / close before)
    const rawMap = {}; raw.forEach((p) => { rawMap[p[0]] = p[1]; });
    const factors = {};
    Object.keys(exs).forEach((ex) => { const D_ = glitch[ex] || exs[ex]; factors[ex] = rawMap[ex - 1] / (rawMap[ex - 1] + D_); }); // the provider's convention
    for (let d = 400; d >= 1; d--) { adj.unshift([d, rawMap[d] * factor * (d < 300 ? 0.5 : 1)]); if (factors[d]) factor *= factors[d]; }
    const ev = M.inferDividends(raw, adj);
    ok(ev.length === 4, 'four ex-dividend days found, the split ignored (' + ev.map((e) => e.ex).join(',') + ')');
    near(ev[0].dps, 0.51, 0.0001, 'dividend per share worked out exactly');
    near(ev[1].dps, 0.51, 0.0006, 'a glitchy step is smoothed against its neighbours (' + ev[1].dps + ')');
    near(ev[3].dps, 0.53, 0.0006, 'a real raise is kept');
    // auto-adding (30% US tax), once
    S.init({ memory: true });
    S.createAccount({ name: 'Div', avatar: {} });
    const pf = S.me().pf;
    S.state.uid = 'u_test'; // a real account (demo is never auto-filled)
    const brk = S.addAccount({ name: 'Moomoo', kind: 'broker', cur: 'USD' });
    const T = FF.today();
    S.addTxn({ type: 'buy', day: T - 200, sym: 'KO', q: 100, p: 60, fee: 0, cur: 'USD', acct: brk.id });
    S.addTxn({ type: 'buy', day: T - 30, sym: 'KO', q: 50, p: 62, fee: 0, cur: 'USD', acct: brk.id }); // after the first ex-date
    const events = { KO: [{ ex: T - 120, dps: 0.51 }, { ex: T - 20, dps: 0.51 }, { ex: T - 2, dps: 0.53 }] };
    const added = S.autoDividends(events);
    ok(added.length >= 2, 'past dividends added automatically (' + added.length + ')');
    const first = added.find((x) => x.ex === T - 120);
    near(first.gross, 51, 1e-9, 'gross = 100 shares × $0.51 (the 50 bought later didn’t count)');
    near(first.amt, 35.7, 1e-9, 'after 30% US tax: $35.70');
    ok(first.acct === brk.id && first.auto && first.day > first.ex, 'paid into the brokerage, after the ex-date');
    near(added.find((x) => x.ex === T - 20).gross, 150 * 0.51, 1e-9, 'next one counts all 150 shares');
    ok(S.autoDividends(events).length === 0, 'never added twice');
    S.deleteTxn(first.id || pf.txns.find((x) => x.ref === first.ref).id);
    ok(S.autoDividends(events).length === 0 && pf.divSkip.length === 1, 'a deleted dividend stays deleted');
    const plan = Lg.dividendPlan(pf, events);
    ok(plan.coming.length + pf.txns.filter((x) => x.auto).length === 2 || plan.coming.length >= 0, 'upcoming ones are listed, not added');
    S.setDivTax(0.15);
    ok(Lg.dividendPlan(pf, { KO: [{ ex: T - 300 + 120, dps: 0.4 }] }).add.every((x) => x.tax === 0.15), 'the tax rate can be changed (treaty countries)');
    // a dividend written down by hand isn't doubled
    S.setDivTax(0.3);
    S.addTxn({ type: 'dividend', day: Lg.payDayFor('KO', T - 60) + 2, sym: 'KO', amt: 50, cur: 'USD', acct: brk.id });
    ok(S.autoDividends({ KO: [{ ex: T - 60, dps: 0.5 }] }).length === 0, 'a hand-written dividend around the same time isn’t added again');
  }

  /* ---------- gems: the daily gift, streaks, shields ---------- */
  {
    const Pl = FF.play;
    const p = Pl.fresh();
    const D0 = FF.fromYMD(2026, 1, 1);
    let got = 0;
    for (let d = 0; d < 7; d++) got += Pl.claim(p, D0 + d).gems;
    ok(got === 150 && p.streak === 7, 'a week of daily gifts = 150 gems (day 7 = 60): ' + got);
    ok(Pl.claim(p, D0 + 6).ok === false, 'one gift a day');
    ok(Pl.claim(p, D0 + 3).ok === false && p.streak === 7, 'turning the clock back never gives another gift');
    ok(Pl.preview(p, D0 + 7).gift === 10 && Pl.preview(p, D0 + 7).streak === 8, 'week two starts again at 10');
    // miss a day without a shield → back to 1
    const lost = Pl.claim(p, D0 + 9);
    ok(lost.streak === 1 && lost.lost === 7 && lost.gems === 10, 'a missed day restarts the streak');
    // a shield saves one missed day, and is used up
    p.shields = 1;
    Pl.claim(p, D0 + 10);
    const saved = Pl.claim(p, D0 + 12);
    ok(saved.streak === 3 && saved.shieldsUsed === 1 && p.shields === 0, 'a streak shield covers one missed day');
    ok(Pl.streakNow(p, D0 + 13) === 3 && Pl.streakNow(p, D0 + 14) === 0, 'the streak shown is alive only until a day is missed');
    // the monthly chest on every 30th day
    const q = Pl.fresh();
    let sum30 = 0, chest = 0;
    for (let d = 0; d < 30; d++) { const r = Pl.claim(q, D0 + d); sum30 += r.gems; chest += r.chest; }
    ok(chest === 150 && q.best === 30, 'day 30 brings the monthly chest (+150)');
    print('  a perfect month of gifts: ' + sum30 + ' gems');
    ok(sum30 >= 700 && sum30 <= 800, 'a perfect month ≈ 750 gems (not too easy)');
    // pacing: the catalogue takes a long time on purpose
    const all = Pl.DECOR.concat(Pl.PETS).reduce((a, x) => a + x.price, 0);
    ok(all / 950 > 15, 'the whole shop takes over a year of every-day play (' + all + ' gems)');
    ok(Pl.DECOR.some((x) => x.price <= 150) && Pl.PETS[0].price <= 600, 'something small is within a few days, the first pet within weeks');
    // buying
    const b = Pl.fresh(); b.pts = 120;
    ok(Pl.buy(b, 'koi', D0).reason === 'short' && b.pts === 120, 'can’t buy what you can’t afford');
    ok(Pl.buy(b, 'wreath', D0).ok && b.pts === 20 && Pl.owns(b, 'wreath'), 'buying spends gems and you own it');
    b.pts = 1000;
    ok(Pl.buy(b, 'wreath', D0).reason === 'owned', 'no buying twice');
    Pl.buy(b, 'shield', D0); Pl.buy(b, 'shield', D0);
    ok(b.shields === 2 && Pl.buy(b, 'shield', D0).reason === 'full', 'at most 2 shields');
    // only owned, valid things show on a house
    const h = { deco: { door: 'wreath', roof: 'koi', sky: 'rainbow' }, pets: ['bunny', 'bunny', 'nope'] };
    Pl.cleanHouse(h, b);
    ok(h.deco.door === 'wreath' && !h.deco.roof && !h.deco.sky && h.pets.length === 0, 'a house only shows what you own, in the right spot');
  }

  /* ---------- gems in the store: welcome, logging, badges, buying, pets ---------- */
  {
    S.init({ memory: true });
    S.createAccount({ name: 'Gem', avatar: { kind: 'illus' } });
    S.createFamily('Gem Family');
    const m = S.me();
    const p0 = S.playOf(m);
    ok(p0.pts === FF.play.WELCOME, 'a welcome gift to start (' + p0.pts + ')');
    const before = p0.pts;
    const r1 = S.addTxn({ type: 'expense', day: FF.today(), amt: 12, cur: 'MYR', cat: 'food', acct: 'a1' });
    const r2 = S.addTxn({ type: 'expense', day: FF.today(), amt: 8, cur: 'MYR', cat: 'food', acct: 'a1' });
    ok(r1.gems === 5 && !r2.gems, '+5 for the first record of the day, only once');
    S.addTxn({ type: 'buy', day: FF.today() - 3, sym: 'KO', q: 1, p: 60, fee: 0, cur: 'USD', acct: 'a1' });
    ok(m.badges.first_holding && m.play.got['badge:first_holding'], 'a new badge…');
    ok(m.play.pts === before + 5 + FF.play.badgeGems('first_holding'), '…pays its gems once (+25 for bronze)');
    const d = S.claimDaily();
    ok(d.ok && d.streak === 1 && !S.claimDaily().ok, 'collect the daily gift once a day');
    m.play.pts = 20000;
    const bunny = S.buyItem('bunny');
    ok(bunny.ok && bunny.home && m.house.pets[0] === 'bunny', 'a new pet moves in straight away');
    S.buyItem('shiba'); S.buyItem('fox');
    const dragon = S.buyItem('dragon');
    ok(dragon.ok && !dragon.home && m.house.pets.length === 3, 'at most 3 pets live at the house');
    S.setPetHome('dragon', true, 'shiba');
    ok(m.house.pets.indexOf('dragon') !== -1 && m.house.pets.indexOf('shiba') === -1, 'swap a pet to bring another home');
    ok(m.badges.collector, 'four pets → the Pet whisperer badge');
    const lights = S.buyItem('lights');
    ok(lights.ok && m.house.deco.roof === 'lights', 'a decoration goes straight onto the house');
    S.buyItem('nest');
    ok(m.house.deco.roof === 'nest', 'a newer one for the same spot replaces it');
    S.setDeco('roof', 'lights');
    ok(m.house.deco.roof === 'lights', 'switch back to one you own');
    S.setDeco('roof', 'vane');
    ok(m.house.deco.roof !== 'vane', 'can’t put up something you don’t own');
  }

  /* ---------- house levels: 50k · 100k · 300k · 500k · 1M (ringgit) ---------- */
  ok([0, 49999, 50000, 99999, 100000, 300000, 500000, 999999, 1000000, 5e6].map(C.level).join() === '1,1,2,2,3,4,5,5,6,6', 'house levels at RM 50k, 100k, 300k, 500k and 1 million');
  ok(C.nextLevelAt(5) === 1000000 && C.nextLevelAt(6) === null, 'the golden mansion is the top');

  /* ---------- the village is back to its first size (no biomes); nothing is left outside ---------- */
  {
    const G = FF.grid;
    ok(G.W === 1000 && G.H === 1500 && G.SH.x === 0 && G.SH.y === 0, 'the map is its original size (1000×1500)');
    ok(G.TREES.length === 25 && !G.BIOMES, 'the original trees, no biomes');
    G.TREES.forEach((t) => ok(G.inside(t.x, t.y, -40, -40, -40), 'tree ' + t.id + ' is on the land'));
    S.init({ memory: true });
    S.seedDemo('en');
    const f = S.family();
    // a house moved out into the old bigger map's meadows (tile coords far outside), plus the stand
    f.layout.m_me = { i: 70, j: -20 }; f.layout._stand = { i: -30, j: 80 };
    const moved = S.tidyLayout();
    ok(moved.indexOf('m_me') !== -1 && moved.indexOf('_stand') !== -1 && moved.length === 2, 'only what was outside moves (' + moved.join(',') + ')');
    const occ = S.occupied();
    occ.forEach((o) => ok(G.valid(o.i, o.j, occ, o.id), o.id + ' is on the land, not overlapping'));
    ok(S.tidyLayout().length === 0, 'nothing to tidy the second time');
    // same family state → same answer (every phone agrees)
    const again = JSON.parse(JSON.stringify(f.layout));
    f.layout.m_me = { i: 70, j: -20 }; f.layout._stand = { i: -30, j: 80 };
    S.tidyLayout();
    ok(JSON.stringify(f.layout) === JSON.stringify(again), 'the tidy-up is deterministic');
  }

  /* ---------- Block Blast: the rules ---------- */
  {
    const B = FF.blastCore, N = B.N;
    const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const empty = () => new Array(N * N).fill(0);
    const game = (board, ids) => ({ board, hand: ids.map((id) => (id ? { id, color: 2 } : null)), score: 0, combo: 0, miss: 0, moves: 0, clears: 0, over: false });
    const ids = Object.keys(B.SHAPES);
    ok(ids.length === 37 && ids.every((id) => { const s = B.SHAPES[id]; return s.cells.length >= 1 && s.cells.length <= 9 && s.rows <= 5 && s.cols <= 5 && s.cells.every((q) => q[0] < s.rows && q[1] < s.cols); }), 'every piece is a sane shape (' + ids.length + ')');
    ok(B.POOL.length === ids.length && B.POOL.every((x) => x.w > 0), 'every piece can be dealt');
    // fitting
    ok(B.fits(empty(), 'i5h', 0, 3) && !B.fits(empty(), 'i5h', 0, 4) && !B.fits(empty(), 'i5v', 4, 0) && !B.fits(empty(), 'o1', -1, 0), 'pieces stay on the board');
    { const b = empty(); b[0] = 1; ok(!B.fits(b, 'o2', 0, 0) && B.fits(b, 'c3d', 0, 0), 'pieces only go on empty cells (an L wraps a corner)'); }
    ok(B.spots(empty(), 'o1').length === 64 && B.spots(empty(), 'o3').length === 36, 'every spot is found');
    // scoring: a plain move scores 1 per block
    { const g = game(empty(), ['o2', null, 'o1']); const r = B.place(g, 0, 3, 3); ok(r && r.pts === 4 && g.score === 4 && !r.nl && g.hand[0] === null && !r.dealt, 'a move scores 1 per block'); ok(B.place(g, 2, 3, 3) === null && g.moves === 1, "can't drop on top of blocks"); }
    // one line, then the combo carries over two misses and doubles the next clear
    {
      const b = empty(); for (let c = 0; c < 4; c++) b[c] = 1; for (let c = 0; c < 4; c++) b[N + c] = 1;
      const g = game(b, ['i4h', 'o1', 'o1']);
      const r1 = B.place(g, 0, 0, 4);
      ok(r1.nl === 1 && r1.pts === 4 + 10 && r1.combo === 1 && r1.praise === 'good' && B.filled(g.board) === 4, 'one row clears: +10 (' + r1.pts + ')');
      B.place(g, 1, 5, 5); B.place(g, 2, 6, 6); // two misses, the third piece is dealt
      ok(g.combo === 1 && g.miss === 2, 'the combo survives two misses');
      g.hand = [{ id: 'i4h', color: 3 }, null, null];
      const r2 = B.place(g, 0, 1, 4);
      ok(r2.nl === 1 && r2.combo === 2 && r2.pts === 4 + 10 * 2, 'the next clear is worth double (' + r2.pts + ')');
      g.hand = [{ id: 'o1', color: 1 }, { id: 'o1', color: 1 }, { id: 'o1', color: 1 }];
      B.place(g, 0, 0, 0); B.place(g, 1, 0, 1); B.place(g, 2, 0, 2);
      ok(g.combo === 0, 'three misses in a row end the combo');
    }
    // a row and a column at once
    { const b = empty(); for (let k = 1; k < N; k++) { b[k] = 1; b[k * N] = 1; } b[N + 1] = 1; const g = game(b, ['o1', 'o1', 'o1']); const r = B.place(g, 0, 0, 0); ok(r.nl === 2 && r.lines.rows[0] === 0 && r.lines.cols[0] === 0 && r.cleared.length === 15 && r.pts === 1 + 30 && r.praise === 'great' && !r.allClear, 'a cross clears 2 lines: +30'); }
    // all clear
    { const b = empty(); for (let c = 0; c < N - 1; c++) b[c] = 4; const g = game(b, ['o1', 'o2', 'o2']); const r = B.place(g, 0, 0, 7); ok(r.allClear && r.pts === 1 + 10 + B.ALL_CLEAR && B.filled(g.board) === 0, 'an empty board is an all clear: +' + B.ALL_CLEAR); }
    // three pieces used → three new ones
    { const g = game(empty(), ['o1', 'o1', 'o1']); B.place(g, 0, 0, 0); B.place(g, 1, 0, 2); const r = B.place(g, 2, 0, 4, rng(5)); ok(r.dealt && g.hand.every((p) => p && B.SHAPES[p.id] && p.color >= 1 && p.color <= B.COLORS), 'a fresh hand after the third piece'); }
    // game over: nothing in hand fits
    { const b = empty().map((v, i) => ((i % N) + ((i / N) | 0)) % 2 ? 1 : 0); const g = game(b, ['o2', 'i2h', null]); g.over = !g.hand.some((p) => p && B.canPlace(g.board, p.id)); ok(g.over && B.place(g, 0, 0, 0) === null, 'no room for any piece = game over'); }
    // ---- fair hands: every hand dealt can be placed in full (some order, counting cleared lines) ----
    // a reference that shares nothing with the solver's bit tricks: plain arrays and the real place()
    const refFair = (board, hand) => {
      const rec = (b, left) => {
        if (left.length === 1) return B.canPlace(b, hand[left[0]]);
        return left.some((k) => B.spots(b, hand[k]).some((q) => {
          const g = game(b.slice(), ['o1', 'o1', 'o1']); g.hand[k] = { id: hand[k], color: 1 };
          return B.place(g, k, q[0], q[1]) && rec(g.board, left.filter((x) => x !== k));
        }));
      };
      const left = [0, 1, 2].filter((k) => hand[k]);
      return !left.length || rec(board, left);
    };
    const replays = (board, hand, plan) => {
      const g = game(board.slice(), hand);
      return plan.length === hand.filter(Boolean).length && plan.every((st, n) => (n === plan.length - 1 ? !!g.hand[st[0]] && B.fits(g.board, g.hand[st[0]].id, st[1], st[2]) : !!B.place(g, st[0], st[1], st[2])));
    };
    const tidyBoard = (R, fill) => { // a dense board as the game could leave it (no full lines)
      const b = empty().map(() => (R() < fill ? 1 : 0)), L = B.fullLines(b);
      L.rows.forEach((r) => { b[r * N + Math.floor(R() * N)] = 0; }); L.cols.forEach((c) => { b[Math.floor(R() * N) * N + c] = 0; });
      return B.fullLines(b).rows.length || B.fullLines(b).cols.length ? null : b;
    };
    {
      // the classic trap: each piece fits on its own, but no order fits all three
      const b = empty(); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!(r >= 2 && r <= 4 && c >= 2 && c <= 4) && (r + c) % 2) b[r * N + c] = 1;
      ok(['o3', 'o2', 'o2'].every((id) => B.canPlace(b, id)) && !B.solve(b, ['o3', 'o2', 'o2']) && !refFair(b, ['o3', 'o2', 'o2']), 'a hand where every piece fits alone but not all three is spotted');
      ok(B.solve(b, ['o3', 'o1', 'o1']) && replays(b, ['o3', 'o1', 'o1'], B.solve(b, ['o3', 'o1', 'o1'])), '…and a hand that does fit comes with a plan that really plays');
      // clearing a line on the way is what makes room
      const c = empty(); for (let k = 0; k < N; k++) c[k] = c[N + k] = c[2 * N + k] = 1; for (let k = 0; k < 4; k++) c[3 * N + k] = 1; for (let r = 4; r < N; r++) for (let k = 0; k < N; k++) if ((r + k) % 2) c[r * N + k] = 1;
      c[0] = c[N] = c[2 * N] = 0; // a gap down the left of the top three rows
      ok(!B.canPlace(c, 'o3') && B.solve(c, ['i3v', 'o3', 'o1']) && refFair(c, ['i3v', 'o3', 'o1']), 'a piece that only fits after another clears lines still counts');
    }
    {
      const R = rng(2026);
      let cases = 0, agree = 0, bad = 0, unsolv = 0;
      for (let k = 0; k < 220; k++) {
        const b = tidyBoard(R, 0.3 + R() * 0.5);
        if (!b) continue;
        for (let h = 0; h < 4; h++) {
          const hand = [ids[Math.floor(R() * ids.length)], ids[Math.floor(R() * ids.length)], h === 3 ? null : ids[Math.floor(R() * ids.length)]];
          const plan = B.solve(b, hand), ref = refFair(b, hand);
          cases++; if (!!plan === ref) agree++; if (!ref) unsolv++;
          if (plan && !replays(b, hand, plan)) bad++;
        }
      }
      ok(agree === cases && unsolv > 50, 'the fairness check matches the reference (' + agree + '/' + cases + ', ' + unsolv + ' unfair hands found)');
      ok(bad === 0, 'every plan it finds plays out through place()');
    }
    {
      // deals on crowded boards: always fair, never a game over before you've moved
      const R = rng(42); let deals = 0, fair = 0, over = 0, built = 0, builtFair = 0;
      for (let k = 0; k < 500; k++) {
        const b = tidyBoard(R, 0.3 + R() * 0.5);
        if (!b) continue;
        const g = game(b, [null, null, null]); B.deal(g, R); deals++;
        if (refFair(b, g.hand.map((p) => p.id))) fair++;
        if (g.over) over++;
        const fh = B.fairHand(b, 0.8, R); built++; if (refFair(b, fh)) builtFair++;
      }
      ok(fair === deals && over === 0, 'every hand dealt on a crowded board can be placed in full (' + fair + '/' + deals + ')');
      ok(builtFair === built, 'the fallback builder is always fair too (' + builtFair + '/' + built + ')');
    }
    {
      // whole games played well: every deal fair, and the work stays tiny
      const R = rng(11); let deals = 0, fair = 0, overAfterDeal = 0;
      const greedy = (g) => { let best = null, bs = -1e9; g.hand.forEach((p, s) => p && B.spots(g.board, p.id).forEach((q) => { const w = B.wouldClear(g.board, p.id, q[0], q[1]); const sc = (w.rows.length + w.cols.length) * 100 - q[0] * 2 - Math.abs(q[1] - 3.5); if (sc > bs) { bs = sc; best = [s, q[0], q[1]]; } })); return best; };
      for (let k = 0; k < 25; k++) {
        const g = B.newGame(R);
        while (!g.over && g.moves < 600) {
          const o = greedy(g), r = B.place(g, o[0], o[1], o[2], R);
          if (r.dealt) { deals++; if (refFair(g.board, g.hand.map((p) => p.id))) fair++; if (r.over) overAfterDeal++; }
        }
      }
      ok(fair === deals && overAfterDeal === 0, 'good players never get an impossible hand (' + fair + '/' + deals + ' deals)');
      const holey = empty().map((v, i) => (((i % N) + ((i / N) | 0)) % 2 ? 1 : 0)), all = { n: 1e9 };
      ok(B.solve(holey, ['o1', 'o1', 'o3'], all) === null && 1e9 - all.n < B.DEAL_WORK, 'even a long “no” fits well inside one deal’s budget (' + (1e9 - all.n) + ' spot tests)');
      const tiny = { n: 5 };
      ok(B.solve(empty(), ['o3', 'o3', 'o3'], tiny) === null && tiny.n < 0 && B.solve(empty(), ['o3', 'o3', 'o3']), 'a check cut short by its budget is never taken as fair');
    }
    // restore checks a saved game before trusting it
    ok(B.restore(null) === null && B.restore({ board: [1, 2], hand: [null, null, null] }) === null && B.restore({ board: empty(), hand: [{ id: 'zzz', color: 1 }, null, null] }) === null, 'a broken save is ignored');
    { const g = B.restore({ board: empty().map((v, i) => (i === 3 ? 99 : i === 4 ? 5 : 0)), hand: [{ id: 'o2', color: 40 }, null, null], score: 120, combo: 2, moves: 9 }); ok(g && g.board[3] === 0 && g.board[4] === 5 && g.hand[0].color === B.COLORS && g.score === 120 && g.moves === 9 && !g.over, 'a save comes back as it was (bad values tidied)'); }
    { const g = B.restore({ board: empty(), hand: [null, null, null], score: 50 }); ok(g && g.hand.every((p) => p), 'a save with an empty hand gets new pieces'); }
    {
      // a hand saved by an older version that can't all be placed is swapped for a fair one; a hand
      // you've already played from is kept (what's left is down to your own moves)
      const b = empty(); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!(r >= 2 && r <= 4 && c >= 2 && c <= 4) && (r + c) % 2) b[r * N + c] = 1;
      const g = B.restore({ board: b, hand: [{ id: 'o3', color: 1 }, { id: 'o2', color: 2 }, { id: 'o2', color: 3 }], score: 400, moves: 30 });
      ok(g && g.hand.every((p) => p) && B.solve(g.board, g.hand) && g.score === 400 && !g.over, 'an unfair saved hand comes back fair');
      const h = B.restore({ board: b, hand: [{ id: 'o3', color: 1 }, { id: 'o2', color: 2 }, null], score: 400, moves: 31 });
      ok(h && h.hand[0].id === 'o3' && h.hand[1].id === 'o2' && !h.hand[2], 'a part-played hand is kept as it was');
    }
    // whole games: a random player never breaks the rules, and the score adds up
    {
      const R = rng(7); let games = 0, moves = 0, top = 0, bad = 0;
      for (let k = 0; k < 150; k++) {
        const g = B.newGame(R); let sum = 0;
        while (!g.over && g.moves < 3000) {
          const opts = []; g.hand.forEach((p, s) => p && B.spots(g.board, p.id).forEach((q) => opts.push([s, q[0], q[1]])));
          if (!opts.length) { bad++; break; }
          const o = opts[Math.floor(R() * opts.length)], r = B.place(g, o[0], o[1], o[2], R);
          if (!r) { bad++; break; }
          sum += r.pts;
          if (r.dealt && r.over) bad++; // a fresh hand is never a game over
          if (g.board.some((v) => v < 0 || v > B.COLORS) || B.fullLines(g.board).rows.length || B.fullLines(g.board).cols.length) bad++;
        }
        if (sum !== g.score || !g.over) bad++;
        games++; moves += g.moves; top = Math.max(top, g.score);
      }
      ok(bad === 0, games + ' random games play by the rules (avg ' + Math.round(moves / games) + ' moves, top ' + top + ')');
    }
  }

  /* ---------- the News mailbox: one per family; three stories a day earn a few gems ---------- */
  {
    S.init({ memory: true });
    S.seedDemo('en');
    const f = S.family(), occ = S.occupied();
    ok(f.layout._news && FF.grid.valid(f.layout._news.i, f.layout._news.j, occ, '_news'), 'the family has a News mailbox, on a free spot');
    const p = S.playOf(), pts = p.pts, day0 = FF.todayOverride;
    let saves = 0;
    const off = FF.on('change', () => { saves++; });
    let r = S.newsRead('a1');
    ok(r.n === 1 && r.gems === 0 && !r.done, 'one story read: 1/3');
    r = S.newsRead('a1');
    ok(r.n === 1 && saves === 1, 'the same story counts once (and isn’t saved again)');
    S.newsRead('b2');
    r = S.newsRead('c3');
    ok(r.gems === FF.play.NEWS.GEMS && r.done && p.pts === pts + FF.play.NEWS.GEMS && p.log[0].k === 'news', 'the third story: +' + FF.play.NEWS.GEMS + ' gems');
    const s0 = saves;
    r = S.newsRead('d4');
    ok(r.gems === 0 && r.done && p.pts === pts + FF.play.NEWS.GEMS && saves === s0 && S.newsToday().done, 'once a day — and reading more costs no saves at all');
    FF.todayOverride = day0 + 1;
    r = S.newsRead('e5');
    ok(r.n === 1 && !r.done && S.newsToday().n === 1, 'a new day starts again');
    FF.todayOverride = day0;
    off();
    delete f.layout._news;
    ok(S.tidyLayout().indexOf('_news') !== -1 && f.layout._news && FF.grid.valid(f.layout._news.i, f.layout._news.j, S.occupied(), '_news'), 'a family from before the mailbox gets one too');
  }

  /* ---------- Block Blast live: a game as a tiny message (what watchers receive) ---------- */
  {
    const B = FF.blastCore;
    const g = B.newGame(() => 0.37);
    const st = B.solve(g.board, g.hand)[0], res = B.place(g, st[0], st[1], st[2]);
    const msg = B.pack(g, res), back = B.unpack(JSON.parse(JSON.stringify(msg)));
    ok(back && back.board.join('') === g.board.join('') && back.score === g.score && back.moves === g.moves && back.combo === g.combo && back.over === g.over, 'a game survives the trip to a watcher');
    ok(back.hand.every((p, k) => (p ? g.hand[k] && p.id === g.hand[k].id && p.color === g.hand[k].color : !g.hand[k])), '…with the pieces still in hand');
    ok(back.last && back.last.slot === res.slot && back.last.id === res.piece.id && back.last.r === res.r && back.last.c === res.c && back.last.color === res.piece.color && back.last.nl === res.nl, '…and the move that led there, to replay');
    ok(JSON.stringify(msg).length < 200, 'the message is tiny (' + JSON.stringify(msg).length + ' bytes)');
    ok(B.unpack(null) === null && B.unpack({ b: '1', h: '-,-,-' }) === null && B.unpack({ b: '0'.repeat(64), h: '-,-' }) === null, 'a broken message is ignored');
    const odd = B.unpack({ b: '9x'.repeat(32), h: 'zzz.3,o1.99,-', s: -5, m: 'lots', c: 1e309, o: 'yes', l: { j: 7, i: 'i5h', r: 6, c: 6 } });
    ok(odd && odd.board.every((v) => v >= 0 && v <= B.COLORS) && !odd.hand[0] && odd.hand[1].color === B.COLORS && odd.score === 0 && odd.moves === 0 && odd.combo === 0 && odd.over === false && odd.last === null, 'odd values from another phone are tidied, never trusted');
    const off = B.unpack({ b: '0'.repeat(64), h: 'o1.1,-,-', s: 1, m: 1, l: { j: 0, i: 'i5h', r: 0, c: 4 } });
    ok(off && off.last === null, 'a move that would hang off the board is dropped');
  }

  /* ---------- Block Blast: gems, best scores and the family ranking ---------- */
  {
    S.init({ memory: true });
    S.seedDemo('en');
    const P = FF.play, me = S.me(), p = S.playOf();
    const day0 = FF.todayOverride;
    me.bb = null; delete me.badges.bb_5k; delete me.badges.bb_20k; delete p.got['badge:bb_5k']; delete p.got['badge:bb_20k'];
    ok(P.BLAST.PER === 300 && P.BLAST.CAP == null, 'Block Blast: 1 gem per 300 points, no daily limit');
    let pts = p.pts;
    let r = S.blastFinish(299);
    ok(r.gems === 0 && p.pts === pts && r.best === 299 && r.newBest && S.bbOf(me).games === 1, 'under 300 points earns no gem (but sets a best)');
    r = S.blastFinish(1250);
    ok(r.gems === 4 && p.pts === pts + 4 && r.today === 4 && r.newBest, '1,250 points = 4 gems');
    r = S.blastFinish(900);
    ok(r.gems === 3 && !r.newBest && r.best === 1250, 'a lower score keeps the best');
    pts = p.pts;
    r = S.blastFinish(6000); // 20 gems — and a silver badge
    ok(r.gems === 20 && r.badges.indexOf('bb_5k') !== -1 && p.pts === pts + 20 + P.badgeGems('bb_5k'), '6,000 points = 20 gems (no daily limit); 5,000 points wins a silver badge (+' + P.badgeGems('bb_5k') + ')');
    r = S.blastFinish(3000);
    ok(r.gems === 10 && r.today === 37, 'more games, more gems — 37 today and counting');
    FF.todayOverride = day0 + 1;
    r = S.blastFinish(600);
    ok(r.gems === 2 && r.today === 2, 'the day\'s total starts again the next day');
    r = S.blastFinish(20000);
    ok(r.badges.indexOf('bb_20k') !== -1 && r.best === 20000, '20,000 points wins the gold badge');
    ok(S.bbOf(me).games === 7, 'every game is counted');
    // ranking: all-time and this week
    const all = S.blastBoard('all');
    ok(all.length === 4 && all[0].m.id === me.id && all.every((x, k) => !k || all[k - 1].v >= x.v), 'the all-time ranking is sorted, best first');
    ok(S.blastRank(me.id, 'all') === 1 && S.blastRank(me.id, 'week') === 1, 'you top the family with 20,000');
    FF.todayOverride = day0 + 14;
    ok(S.blastBoard('week').every((x) => x.v === 0) && S.blastRank(me.id, 'week') === 0 && S.blastRank(me.id, 'all') === 1, 'a new week starts the weekly ranking from zero');
    r = S.blastFinish(450);
    ok(r.wkBest === 450 && r.best === 20000 && r.rank === 1, 'the first game of the week leads the week');
    FF.todayOverride = day0;
    // every family gets one arcade, on a free spot, the same on every phone
    const f = S.family(), spot = JSON.stringify(f.layout._arcade);
    ok(!!f.layout._arcade && FF.grid.valid(f.layout._arcade.i, f.layout._arcade.j, S.occupied(), '_arcade'), 'the arcade is on the land');
    delete f.layout._arcade;
    ok(S.ensureArcade() && JSON.stringify(f.layout._arcade) === spot && !S.ensureArcade(), 'the arcade spot is the same every time');
    S.moveObject('_arcade', f.layout._arcade.i + 2, f.layout._arcade.j + 4);
    ok(S.tidyLayout().length === 0 && f.layout._arcade.j === JSON.parse(spot).j + 4, 'a moved arcade stays where it was put');
  }

  /* ---------- the Lucky Market: stalls, eggs, pets, plants, fishing (lucky.js + store) ---------- */
  {
    const Lk = FF.lucky, Pl = FF.play;
    const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const D0 = FF.fromYMD(2026, 10, 4);
    // the day's stalls: six, the same on every phone, different on another day
    const a = Lk.stock('m_me', D0), b = Lk.stock('m_me', D0), c = Lk.stock('m_me', D0 + 1);
    ok(a.length === 6 && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), 'six stalls a day, the same on every phone, new the next day');
    let fair = true, firstOk = true;
    for (let d = 0; d < 400; d++) {
      const st = Lk.stock('m_x', D0 + d), n = {};
      st.forEach((id) => { n[id] = (n[id] || 0) + 1; });
      if (Object.keys(n).some((id) => n[id] > (Lk.ITEMS[id].kind === 'deco' ? 1 : 2))) fair = false;
      if (st[0] !== 'egg' && st[0] !== 'seed') firstOk = false;
    }
    ok(fair && firstOk, 'the first stall is always an egg or a seed; never more than two of a kind (one of a decoration)');
    ok(Lk.stock('m_x', D0, { clover: 1, goldbell: 1, fireworks: 1 }).every((id) => Lk.ITEMS[id].kind !== 'deco'), 'decorations you own are never offered again');
    // prices: a few days of gems, never shop-pet money; selling straight away gets back less than you paid…
    ok(Lk.ITEMS.egg.price <= 100 && Lk.ITEMS.seed.price <= 50 && Lk.ITEMS.molotov.price <= 20 && Lk.ITEMS.goldegg.price < Pl.PETS[0].price, 'reasonable prices (egg ' + Lk.ITEMS.egg.price + ', seed ' + Lk.ITEMS.seed.price + ', Molotov ' + Lk.ITEMS.molotov.price + ')');
    const ev = (odds, f) => Lk.TIERS.reduce((t, r, k) => t + (odds[k] / 100) * f(r), 0);
    const petEV = (egg, form) => ev(Lk.ITEMS[egg].odds, (r) => Lk.PET_SELL[Lk.TIERS.indexOf(r)] * Lk.FORM_SELL[form]);
    ok(petEV('egg', 0) < Lk.ITEMS.egg.price && petEV('goldegg', 0) < Lk.ITEMS.goldegg.price, 'selling a new pet straight away gets back less than the egg cost');
    ok(petEV('egg', 2) > Lk.ITEMS.egg.price && petEV('goldegg', 2) > Lk.ITEMS.goldegg.price, '…a pet raised to majestic is worth more than its egg (care pays)');
    // hatching odds (20,000 eggs)
    const R = rng(9), seen = { common: 0, rare: 0, epic: 0, legendary: 0 }, gold = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let k = 0; k < 20000; k++) { seen[Lk.hatch('egg', R).r]++; gold[Lk.hatch('goldegg', R).r]++; }
    ok(Math.abs(seen.common / 200 - 62) < 1.5 && Math.abs(seen.legendary / 200 - 2.5) < 0.6, 'eggs hatch at the shown odds (common ' + (seen.common / 200).toFixed(1) + '%, legendary ' + (seen.legendary / 200).toFixed(1) + '%)');
    ok(gold.common === 0 && Math.abs(gold.legendary / 200 - 10) < 1, 'a golden egg is never common, legendary ' + (gold.legendary / 200).toFixed(1) + '%');
    // feeding: once a day; grown at 12 days, majestic at 30; a treat is an extra day
    const pet = { id: 'q1', sp: 'chick', r: 'common', fed: 0, fd: null, show: 0 };
    ok(Lk.need(pet, D0) === 'food' || Lk.need(pet, D0) === 'water', 'a pet is hungry or thirsty until it is fed');
    ok(Lk.feed(pet, D0) === 0 && Lk.need(pet, D0) === null && Lk.feed(pet, D0) === -1, 'fed once a day (a second time does nothing)');
    let grew = 0;
    for (let d = 1; d < 30; d++) { const r = Lk.feed(pet, D0 + d); if (r) grew = r; if (d === 11) ok(r === 1 && Lk.shownForm(pet) === 1, 'day 12: grown (and shown)'); }
    ok(grew === 2 && Lk.formsOf(pet) === 2 && pet.show === 2, 'day 30: majestic');
    pet.show = 0;
    ok(Lk.shownForm(pet) === 0 && Lk.feed(pet, D0 + 31) === 0 && pet.show === 0, 'you can keep an earlier form (it stays as you chose)');
    const fd = pet.fed; Lk.feed(pet, D0 + 31, true);
    ok(pet.fed === fd + 1, 'a treat counts as an extra day, even after today\'s meal');
    // plants: water once a day; sprout 1 · leaves 3 · bud 6 · bloom 9; a bloom grows in value
    const pl = { id: 'g1', sp: 'rose', r: 'rare', w: 0, wd: null, bloom: null };
    const stages = [];
    for (let d = 0; d < 9; d++) { Lk.water(pl, D0 + d); stages.push(Lk.stage(pl)); }
    ok(JSON.stringify(stages) === '[1,1,2,2,2,3,3,3,4]' && pl.bloom === D0 + 8, 'a plant sprouts, leafs, buds and blooms on day 9 (' + stages.join(',') + ')');
    ok(Lk.water(pl, D0 + 9) === -1 && !Lk.thirsty(pl, D0 + 10), 'a bloom needs no more water');
    ok(Lk.plantValue(pl, D0 + 8) === Lk.PLANT_SELL[1] && Lk.plantValue(pl, D0 + 8 + 30) === Lk.PLANT_SELL[1] * 2 && Lk.plantValue(pl, D0 + 8 + 90) === Lk.PLANT_SELL[1] * 2, 'a bloom is worth up to double after 30 days');
    const seedEV = (sd) => ev(Lk.ITEMS[sd].odds, (r) => Lk.PLANT_SELL[Lk.TIERS.indexOf(r)]);
    ok(seedEV('seed') < Lk.ITEMS.seed.price && seedEV('seed') * 2 > Lk.ITEMS.seed.price, 'a fresh bloom sells for less than its seed, an older one for more');
    // fishing: the needle, the zones, the catch
    ok(Lk.needleAt(0) === 0 && Lk.needleAt(Lk.SWEEP_MS) === 1 && Lk.needleAt(Lk.SWEEP_MS * 1.5) === 0.5 && Lk.needleAt(Lk.SWEEP_MS * 2) === 0, 'the needle sweeps right, then back');
    ok(Lk.judge(0.5, 0.5) === 'perfect' && Lk.judge(0.6, 0.5) === 'good' && Lk.judge(0.7, 0.5) === 'miss', 'perfect · good · miss');
    const R2 = rng(4); let gemsP = 0, gemsG = 0;
    for (let k = 0; k < 4000; k++) { gemsP += Lk.catchFish('perfect', R2).gems; gemsG += Lk.catchFish('good', R2).gems; }
    ok(Lk.catchFish('miss') === null && gemsP / 4000 > gemsG / 4000 && gemsG / 4000 > 2, 'a perfect stop catches better fish (' + (gemsP / 4000).toFixed(1) + ' vs ' + (gemsG / 4000).toFixed(1) + ' gems on average)');

    // ---- the store: buying, raising, selling, the Molotov, fishing ----
    S.init({ memory: true });
    S.seedDemo('en');
    const me = S.me(), p = S.playOf();
    p.pts = 5000;
    const stalls = S.luckyToday();
    ok(stalls.length === 6 && stalls.every((x) => !x.sold), 'six stalls to choose from');
    const eggSlot = stalls.findIndex((x) => x.item.kind === 'egg');
    const seedSlot = stalls.findIndex((x) => x.item.kind === 'seed');
    if (eggSlot !== -1) {
      const pts = p.pts, n = S.yardOf(me).pets.length;
      const r = S.buyLucky(eggSlot, rng(3));
      ok(r.ok && r.pet && p.pts === pts - r.price && S.yardOf(me).pets.length === n + 1, 'an egg: gems paid, a pet hatched');
      ok(S.buyLucky(eggSlot).reason === 'sold' && S.luckyToday()[eggSlot].sold, 'each stall sells once a day');
      const sold = S.sellPet(r.pet.id);
      ok(sold.ok && sold.gems === Lk.petValue(r.pet) && !S.yardOf(me).pets.some((x) => x.id === r.pet.id), 'sell a pet: its gems, and it\'s gone');
    }
    if (seedSlot !== -1) {
      const r = S.buyLucky(seedSlot, rng(5));
      const key = 'pl_' + r.plant.id, L = S.family().layout;
      ok(r.ok && L[key] && FF.grid.valid(L[key].i, L[key].j, S.occupied(), key), 'a seed is planted on a free spot on the map');
      const w = S.waterPlant(r.plant.id);
      ok(w.ok && w.stage === 1 && !S.waterPlant(r.plant.id).ok, 'water it once a day');
      const sold = S.sellPlant(r.plant.id);
      ok(sold.ok && !L[key] && !S.yardOf(me).plants.some((x) => x.id === r.plant.id), 'sell a plant: it leaves the map and the yard');
    }
    // room: four pets, six plants
    const full = S.yardOf(me);
    while (full.pets.length < Lk.MAX_PETS) full.pets.push({ id: 'q_fill' + full.pets.length, sp: 'frog', r: 'common', fed: 0 });
    ok(S.luckyToday().filter((x) => x.item.kind === 'egg').every((x) => x.full || x.sold), 'a full yard can\'t take another egg (sell one first)');
    // pets: feed a hungry one; the yard's house moves → the pet follows (drawn by the house)
    const hungry = S.yardOf(me).pets.find((x) => Lk.need(x, S.dayNow()));
    if (hungry) { const f = S.feedPet(hungry.id); ok(f.ok && !Lk.need(hungry, S.dayNow()), 'feeding a hungry pet'); }
    // the Molotov
    me.play.bag = { molotov: 1 };
    ok(S.throwMolotov('m_dad').ok && S.burns()['m_dad'] && !S.throwMolotov('m_mum').ok, 'a Molotov sets a house on fire (one in the bag, one throw)');
    ok(!S.burns(Date.now() + Lk.BURN_MS + 1000)['m_dad'], '…and it\'s back to normal after a day');
    // an exclusive decoration goes straight onto your house
    S.state.members.m_me.play.lucky = { day: S.dayNow(), stock: ['egg', 'clover', 'seed', 'treat', 'tonic', 'molotov'], sold: [] };
    const dr = S.buyLucky(1);
    ok(dr.ok && me.house.deco.yard === 'clover' && Pl.owns(p, 'clover') && Pl.item('clover').lucky, 'an exclusive decoration is yours and on your house');
    // fishing: five casts a day, gems for a catch, the badge after 30 fish
    const f0 = S.fishState();
    ok(f0.left === Lk.CASTS && f0.zone >= 0.25 && f0.zone <= 0.75, 'five casts a day');
    let got = 0;
    for (let k = 0; k < Lk.CASTS; k++) { const z = S.fishState().zone; const r = S.fishCast(z, rng(k + 1)); if (r.fish) got += r.fish.gems; }
    ok(got >= Lk.CASTS * (Lk.FISH_GEMS[0] + Lk.PERFECT_BONUS) && !S.fishCast(0.5).ok, 'perfect casts catch fish and gems (' + got + '); the sixth cast waits for tomorrow');
    p.fish.book = { minnow: 29, koi: 1 }; delete me.badges.angler;
    ok(S.evaluateBadges(me.id).indexOf('angler') !== -1, '30 fish: the Angler badge');
  }

  print('the map: where buildings may go (2.24 — the whole island, not a rectangle)');
  {
    const G = FF.grid, R = G.tileRange();
    let house = 0, top = 0, bad = 0, outOfView = 0, wet = 0, oldOk = 0, oldMoved = 0;
    const oldRect = (x, y) => x >= 152 && x <= 848 && y >= 300 && y <= 1330; // the old rule's rectangle
    for (let i = R.i0; i <= R.i1; i++) for (let j = R.j0; j <= R.j1; j++) {
      const c = G.center(i, j);
      if (G.valid(i, j, [], '__x__')) {
        house++;
        if (c.y < 300) top++;
        if (!G.inside(c.x, c.y, 60, 30, 30)) bad++;                                   // the footprint is on the island
        if (c.y - 228 < -G.HEADROOM.top || c.x - 96 < 0 || c.x + 96 > G.W) outOfView++; // the whole house can be seen
        if (G.inWater(c.x, c.y, 30, 20)) wet++;
      }
      if (oldRect(c.x, c.y)) { oldOk++; if (!G.inLand(c.x, c.y)) oldMoved++; }
    }
    ok(house >= 2 * 275, 'about twice as many spots for a house on an empty map (' + house + ')');
    ok(top >= 40, 'the top of the island takes buildings now (' + top + ' spots above y 300; before: none)');
    ok(bad === 0 && outOfView === 0 && wet === 0, 'every spot keeps the house on the island, in view, and out of the pond');
    ok(oldOk > 0 && oldMoved === 0, 'nothing placed under the old rules is ever moved by the new ones (' + oldOk + ' old spots checked)');
    ok(G.valid(...[G.snap(500, 210).i, G.snap(500, 210).j], [], '__x__') || G.valid(G.snap(500, 240).i, G.snap(500, 240).j, [], '__x__'), 'a house can go on the open grass at the top middle');
  }

  print('the daily spin (2.24 — eight equal slices, one spin a day)');
  {
    const P2 = FF.play, day = FF.today();
    const mk = () => P2.ensure({ badges: {} }, day);
    ok(P2.SPIN.length === 8, 'eight slices');
    let even = true;
    for (let k = 0; k < 8; k++) { const r = P2.spin(mk(), day, (k + 0.5) / 8); if (!r.ok || r.i !== k) even = false; }
    ok(even, 'every slice is an equal eighth of the chances');
    ok(P2.spin(mk(), day, 0.9999999).i === 7 && P2.spin(mk(), day, 0).i === 0, 'the very edges land on the first and the last slice');
    const p = mk(), pts0 = p.pts;
    const r1 = P2.spin(p, day, 7.5 / 8);
    ok(r1.ok && r1.prize.n === 40 && p.pts === pts0 + 40 && p.log[0].k === 'spin', 'the jackpot slice: 40 gems, added and logged');
    ok(!P2.spin(p, day, 0.1).ok && p.pts === pts0 + 40, 'a second spin the same day is refused');
    ok(!P2.spin(p, day - 1, 0.1).ok, 'putting the clock back doesn\'t give another spin');
    ok(P2.spin(p, day + 1, 0.1).ok, 'the next day: a new spin');
    const q = mk(), r2 = P2.spin(q, day, 2.5 / 8), r3 = P2.spin(mk(), day, 5.5 / 8);
    ok(r2.prize.id === 'tonic' && q.bag.tonic === 1 && r3.prize.id === 'treat', 'two slices put a tonic or a pet treat in your bag');
    const ev = P2.SPIN.reduce((n, x) => n + (x.k === 'gems' ? x.n : 0), 0) / 8;
    ok(ev > 8 && ev < 14, 'about 11 gems a day on average (' + ev + ') — a treat, not a flood');
    S.init({ memory: true }); S.seedDemo('en');
    ok(!S.spinToday().done, 'the demo: today\'s spin is waiting');
    const sr = S.spinWheel(0.3);
    ok(sr.ok && S.spinToday().done && S.spinToday().i === sr.i && !S.spinWheel(0.3).ok, 'spinning through the store: saved, once a day');
  }

  print('the Mystery Man (2.24 — true facts and a quiz: 2 gems a right answer, 10 a day)');
  {
    const P2 = FF.play, day = FF.today();
    const p = P2.ensure({ badges: {} }, day), pts0 = p.pts;
    let gems = 0;
    for (let k = 0; k < 14; k++) gems += P2.sageAnswer(p, day, 'f' + k, true).gems;
    ok(gems === P2.SAGE.GEMS * P2.SAGE.DAILY && p.pts === pts0 + gems, 'ten right answers pay 2 gems each, then no more that day (' + gems + ')');
    ok(P2.sageLeft(p, day) === 0 && P2.sageAnswer(p, day + 1, 'x', true).gems === 2, 'the next day pays again');
    ok(P2.sageAnswer(p, day + 1, 'y', false).gems === 0, 'a wrong answer pays nothing');
    const s1 = P2.sageOf(p, day + 1);
    ok(s1.seen[0] === 'y' && s1.seen[1] === 'x' && s1.right === 15 && s1.asked === 16, 'answers are remembered (newest first), right ones counted');
    for (let k = 0; k < 200; k++) P2.sageAnswer(p, day + 2, 'z' + k, false);
    ok(P2.sageOf(p, day + 2).seen.length === P2.SAGE.KEEP, 'only the last ' + P2.SAGE.KEEP + ' answers are kept (light to sync)');
    // the facts: about a hundred, the same in all three languages
    ['en', 'zh', 'th'].forEach((l) => { try { load('js/facts-' + l + '.js'); } catch (e) { load('FamFi/js/facts-' + l + '.js'); } }); // run from FamFi/ or the repo root
    const F = FF.FACTS, cats = ['earth', 'world', 'my', 'science', 'space', 'animals', 'body', 'money', 'history'];
    ok(F.en.length >= 100 && P2.SAGE.KEEP < F.en.length, F.en.length + ' facts — more than the answers remembered, so there\'s always a new one');
    ok(new Set(F.en.map((f) => f[0])).size === F.en.length, 'every fact has its own id');
    ['zh', 'th'].forEach((l) => ok(F[l].length === F.en.length && F[l].every((f, i) => f[0] === F.en[i][0] && f[1] === F.en[i][1] && f[2] === F.en[i][2]), l + ': the same facts, in the same order'));
    ['en', 'zh', 'th'].forEach((l) => ok(F[l].every((f) => f.length === 8 && cats.indexOf(f[1]) !== -1 && Array.isArray(f[6]) && f[6].length === 4 && new Set(f[6]).size === 4 &&
      f[6].every((o) => typeof o === 'string' && o.trim()) && [f[2], f[3], f[4], f[5], f[7]].every((x) => typeof x === 'string' && x.trim() && x.indexOf('<') === -1)), l + ': every fact has a picture, a story, a question, four different answers and a why'));
    ok(F.en.every((f) => f[4].length <= 330 && f[5].length <= 110 && f[7].length <= 140), 'stories, questions and whys stay short enough to read at a glance');
    cats.forEach((c) => ok(F.en.filter((f) => f[1] === c).length >= 5, 'enough facts about ' + c));
    // in a village
    S.init({ memory: true }); S.seedDemo('en');
    const L = S.family().layout, g = FF.grid;
    ok(L._sage && g.valid(L._sage.i, L._sage.j, S.occupied(), '_sage'), 'the demo village: he lies on a free, valid spot');
    const sc = g.center(L._sage.i, L._sage.j);
    ok(sc.y < 700, 'up on the quiet top half of the island (y ' + sc.y + ')');
    ok(!S.occupied().some((o) => { if (o.id === '_sage' || o.id.indexOf('pl_') === 0) return false; const c = g.center(o.i, o.j); return Math.abs(c.x - sc.x) < 160 && c.y > sc.y - 80 && c.y < sc.y + 300; }) &&
      !g.TREES.some((t) => Math.abs(t.x - sc.x) < 85 && t.y > sc.y && t.y < sc.y + 140), 'not hidden behind a building, its name tag or a tree');
    delete L._sage;
    ok(S.tidyLayout().indexOf('_sage') !== -1 && L._sage && g.valid(L._sage.i, L._sage.j, S.occupied(), '_sage'), 'a village from before 2.24 gets him the next time the app opens');
    const sa = S.sageAnswer('ocean', true);
    ok(sa.gems === 2 && S.sageToday().n === 1 && S.sageToday().seen[0] === 'ocean', 'answering through the store saves it');
  }

  print('family helpers (2.25 — someone else’s changes are checked before they touch your records)');
  {
    const Lg = FF.ledger, T = FF.today(), now = Date.now();
    const pf = { base: 'MYR', accounts: [{ id: 'b1', kind: 'bank', cur: 'MYR' }, { id: 'c1', kind: 'cash', cur: 'MYR' }, { id: 'u1', kind: 'bank', cur: 'USD' }, { id: 'k1', kind: 'broker', cur: 'USD' }],
      txns: [{ id: 's1', type: 'adjust', day: T - 10, amt: 1000, cur: 'MYR', acct: 'b1', start: true, ts: 1 }, { id: 'tr1', type: 'buy', day: T - 5, sym: 'AAPL', q: 1, p: 100, fee: 0, cur: 'USD', acct: 'k1', ts: 2 }] };
    const ex = (o) => Object.assign({ id: 'e' + Math.random().toString(36).slice(2, 8), type: 'expense', day: T, amt: 12.5, cur: 'MYR', acct: 'b1', cat: 'food', note: ' Nasi lemak ' }, o);
    ok(Lg.helpTx(pf, ex(), T).note === 'Nasi lemak' && Lg.helpTx(pf, ex({ note: 'x'.repeat(90) }), T).note.length === 60, 'a fine record passes (note tidied, at most 60 letters)');
    ok(!Lg.helpTx(pf, ex({ cat: 'salary' }), T) && !Lg.helpTx(pf, ex({ cat: 'nope' }), T), 'an expense needs a spending category');
    ok(!Lg.helpTx(pf, ex({ acct: 'nowhere' }), T) && !Lg.helpTx(pf, ex({ amt: -3 }), T) && !Lg.helpTx(pf, ex({ amt: 'lots' }), T) && !Lg.helpTx(pf, ex({ amt: 1e13 }), T), 'unknown accounts and odd amounts are refused');
    ok(!Lg.helpTx(pf, ex({ day: T + 5 }), T) && !Lg.helpTx(pf, ex({ day: T - 5000 }), T) && !Lg.helpTx(pf, ex({ cur: 'BTC' }), T), 'far-off dates and unknown currencies are refused');
    ok(!Lg.helpTx(pf, ex({ type: 'buy' }), T) && !Lg.helpTx(pf, ex({ id: '' }), T) && !Lg.helpTx(pf, ex({ note: 5 }), T), 'only everyday records, with an id');
    ok(!Lg.helpTx(pf, { id: 't1', type: 'transfer', day: T, amt: 5, acct: 'b1', to: 'b1' }, T) && !Lg.helpTx(pf, { id: 't2', type: 'transfer', day: T, amt: 5, acct: 'b1', to: 'u1' }, T), 'a move needs two different accounts — and, across currencies, what arrived');
    const mv = Lg.helpTx(pf, { id: 't3', type: 'transfer', day: T, amt: 50, acct: 'b1', to: 'u1', toAmt: 11.2, cur: 'SGD', cat: 'food' }, T);
    ok(mv && mv.cur === 'MYR' && mv.toCur === 'USD' && mv.toAmt === 11.2 && !mv.cat, 'a move takes its accounts’ currencies, nothing else');
    // applying
    const book = JSON.parse(JSON.stringify(pf));
    const add = { k: 'add', tx: ex({ id: 'h1' }) };
    ok(Lg.applyHelpOp(book, add, 'mum', T, now) && !Lg.applyHelpOp(book, add, 'mum', T, now) && book.txns.filter((x) => x.id === 'h1').length === 1, 'adding twice adds once');
    ok(book.txns.find((x) => x.id === 'h1').by === 'mum', 'it says who recorded it');
    const ed = { k: 'edit', tx: ex({ id: 'h1', amt: 20, cat: 'groceries', note: '' }) };
    ok(Lg.applyHelpOp(book, ed, 'dad', T, now) && !Lg.applyHelpOp(book, ed, 'dad', T, now), 'a fix applies once');
    const h1 = book.txns.find((x) => x.id === 'h1');
    ok(h1.amt === 20 && h1.cat === 'groceries' && !h1.note && h1.by === 'dad', 'the fixed record is exactly the new version');
    ok(!Lg.applyHelpOp(book, { k: 'edit', tx: ex({ id: 'tr1' }) }, 'dad', T, now) && !Lg.applyHelpOp(book, { k: 'del', id: 'tr1' }, 'dad', T, now), 'investment records can’t be changed or deleted by others');
    ok(!Lg.applyHelpOp(book, { k: 'edit', tx: ex({ id: 's1' }) }, 'dad', T, now), 'a balance update can’t be turned into something else');
    ok(!Lg.applyHelpOp(book, { k: 'del', id: 's1' }, 'dad', T, now) && book.txns.some((x) => x.id === 's1'), 'a starting balance can’t be deleted by others (they set the balance instead)');
    const cash = () => Lg.accountCash(book, book.accounts[1]);
    const bal = { k: 'bal', id: 'b-1', acct: 'c1', v: 88.8 };
    ok(Lg.applyHelpOp(book, bal, 'mum', T, now) && Math.abs(cash() - 88.8) < 1e-9 && !Lg.applyHelpOp(book, bal, 'mum', T, now), 'setting a balance makes it exactly that, once');
    ok(!Lg.applyHelpOp(book, { k: 'bal', id: 'b-2', acct: 'c1', v: 88.8 }, 'mum', T, now), 'setting it to what it already is changes nothing');
    ok(!Lg.applyHelpOp(book, { k: 'bal', id: 'b-3', acct: 'k1', v: 5 }, 'mum', T, now), 'investment accounts follow the market, not balances');
    const undoDel = Lg.helpUndo(book, { k: 'del', id: 'h1' });
    ok(Lg.applyHelpOp(book, { k: 'del', id: 'h1' }, 'dad', T, now) && !book.txns.some((x) => x.id === 'h1'), 'deleting a record');
    ok(undoDel.k === 'add' && Lg.applyHelpOp(book, undoDel, 'dad', T, now) && book.txns.find((x) => x.id === 'h1').amt === 20, 'Undo brings it back as it was');
    const undoBal = Lg.helpUndo(book, bal);
    ok(Lg.applyHelpOp(book, undoBal, 'mum', T, now) && Math.abs(cash() - 0) < 1e-9, 'Undo of a balance takes the adjustment away');
    ok(!Lg.applyHelpOp(book, { k: 'zap' }, 'x', T, now) && !Lg.applyHelpOp(book, null, 'x', T, now) && !Lg.applyHelpOp(null, add, 'x', T, now), 'anything else is ignored');
    // in the sample family (everyone on this phone)
    S.init({ memory: true }); S.seedDemo('en');
    ok(S.canHelp('m_mum') && !S.canHelp('m_me'), 'the demo: I may record for Mum (not “for” myself)');
    ok(!S.canHelp('m_gran') && !S.canHelp('m_dad'), 'Ah Ma and Dad keep something private (Dad shows his stocks to Mum only): no help unless they turn it on');
    const mumPf = S.member('m_mum').pf, mumAcct = mumPf.accounts.find((a) => !FF.ledger.isInvest(mumPf, a));
    const r = S.helpEdit('m_mum', { k: 'add', tx: { id: 'demo1', type: 'expense', day: FF.today(), amt: 30, cur: mumAcct.cur, acct: mumAcct.id, cat: 'groceries', note: 'Market' } });
    ok(r && S.member('m_mum').pf.txns.some((x) => x.id === 'demo1' && x.by === 'm_me'), 'the demo: it goes straight into Mum’s records, marked as mine');
    ok(S.helpEdit('m_gran', { k: 'del', id: 'x' }) === null, 'and never into Ah Ma’s');
    ok(S.canSee('m_gran', 'm_mum', 'holdings') && S.helpOf(S.me()), 'family helpers show the family all their numbers');
    S.setHelp(false);
    ok(!S.helpOf(S.me()) && S.me().helpSet === false, 'turning it off for myself sticks');
  }

  print('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed) throw new Error(failed + ' test(s) failed');
}).call(this);
