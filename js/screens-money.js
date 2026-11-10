/* ============================================================
   FamFi — screens-money.js
   Home · Return · Allocation · Dividend.
   Every view takes a ctx so the same screens power "visit a
   family member" (read-only, privacy-aware) — or, when they let
   their family help (v2.25), a visit where you can record for them.
     ctx = { id: memberId, ro: readOnly, viewer: viewerId, inVisit, help }
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, C = () => FF.calc, D = () => FF.data;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const ui = () => FF.ui;
  const M = (v, o) => FF.i18n.money(v, o && o.cur, o);

  const Lg = () => FF.ledger;
  const A = FF.actions = FF.actions || {};
  const member = (ctx) => S().member(ctx.id);
  const accName = (acc) => acc.name || (acc.nameKey ? t(acc.nameKey) : acc.id);
  const pfOf = (ctx) => member(ctx).pf;
  const baseOf = (ctx) => pfOf(ctx).base;
  const can = (ctx, sec) => S().canSee(ctx.viewer || S().state.meId, ctx.id, sec);

  function lockedCard(ctx, sec) {
    const m = member(ctx);
    return '<div class="card locked">' + ic('lock', 28) + '<h3>' + t('privacy.lockedTitle', { name: esc(m.name) }) + '</h3><p>' + t('privacy.lockedBody.' + sec) + '</p></div>';
  }
  function header(title, opts) {
    opts = opts || {};
    return '<header class="scr-head' + (opts.cls ? ' ' + opts.cls : '') + '"><div class="scr-head-txt">' + (opts.kicker ? '<div class="kicker">' + opts.kicker + '</div>' : '') + '<h1 class="scr-title">' + title + '</h1>' + (opts.sub ? '<p class="scr-sub">' + opts.sub + '</p>' : '') + '</div>' + (opts.right || '') + '</header>';
  }
  function emptyState(art, title, body, btn) {
    return '<div class="empty">' + FF.art.emptyArt(art, 132) + '<h3>' + title + '</h3><p>' + body + '</p>' + (btn || '') + '</div>';
  }

  /* ===================================================== HOME */
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? t('home.morning') : h < 18 ? t('home.afternoon') : t('home.evening');
  }
  /* where today's prices come from, in one honest line */
  function quoteTime(ms) {
    if (!ms) return '';
    const d = new Date(ms), day = FF.dayOfDate(d);
    return (day === FF.today() ? '' : FF.i18n.dateShort(day) + ' ') + FF.i18n.time(d);
  }
  function priceNote() {
    const m = FF.market.summary();
    if (!m.stocksLive && !m.stocksHistory && !m.cryptoLive) return ic('clock', 14) + '<span>' + t('mkt.demo') + '</span>';
    const time = quoteTime(m.latest);
    if (!m.online) return ic('clock', 14) + '<span>' + t('mkt.offline', { time }) + '</span>';
    if (!m.stocksLive && m.stocksHistory) return ic('clock', 14) + '<span>' + t('mkt.eod', { time }) + '</span>';
    if (!m.stocksLive) return ic('info', 14) + '<span>' + t('mkt.partial') + '</span>';
    // prices update about once an hour (and when the app is opened); "Update" gets them now
    return '<span class="live-dot' + (m.anyOpen ? ' on' : '') + '"></span><span>' + t(m.anyOpen ? 'mkt.live' : 'mkt.closed', { time }) + '</span>' +
      '<button type="button" class="link-btn mkt-up" data-act="prices-update">' + ic('refresh', 14) + '<span>' + t('mkt.update') + '</span></button>';
  }
  /* small source tag for one asset: Live · Delayed · Market closed · Demo price */
  function sourceTag(sym) {
    const L = D().liveInfo(sym);
    if (!L) return '<span class="src-tag demo">' + t('mkt.tagDemo') + '</span>';
    const when = '<span class="src-time">' + t('mkt.asOf', { time: quoteTime(L.t) }) + '</span>';
    const stock = D().asset(sym).t !== 'crypto';
    if (stock && !L.quoted) return '<span class="src-tag closed">' + t('mkt.tagEod') + '</span>' + when;
    if (!L.open && stock) return '<span class="src-tag closed">' + t('mkt.tagClosed') + '</span>' + when;
    if (L.delayed) return '<span class="src-tag delayed">' + t('mkt.tagDelayed', { n: L.delayed }) + '</span>' + when;
    return '<span class="src-tag live"><i></i>' + t('mkt.tagLive') + '</span>' + when;
  }
  function holdingRow(h, base, ro) {
    const demo = !D().isLive(h.sym) && FF.market.summary().stocksLive;
    return '<button type="button" class="row hold-row" data-act="holding" data-sym="' + h.sym + '"' + (ro ? ' data-ro="1"' : '') + '>' + ui().assetLogo(h.a, 42) +
      '<span class="row-main"><span class="row-t">' + esc(D().displayName(h.a, FF.i18n.lang)) + '</span><span class="row-s">' + t('units.' + (h.a.t === 'crypto' ? 'coins' : 'shares'), { n: FF.i18n.qty(h.qty), count: h.qty }) + ' · ' + esc(h.a.s) + (demo ? ' · ' + t('mkt.rowDemo') : '') + '</span></span>' +
      '<span class="row-end"><span class="row-v num">' + M(h.value, { cur: base }) + '</span>' + ui().delta(h.dayPct, { pct: true, size: 12 }) + '</span></button>';
  }

  function home(ctx) {
    const m = member(ctx), pf = m.pf, base = pf.base;
    const ro = ctx.ro;
    let h = '';
    if (!ctx.inVisit) {
      h += '<header class="home-head"><button type="button" class="avatar-btn" data-act="tab" data-tab="menu" aria-label="' + esc(t('tab.menu')) + '">' + FF.art.avatar(m.avatar, 44) + '</button>' +
        '<div class="home-hello"><span class="kicker" data-fit="10">' + greeting() + '</span><h1 class="scr-title">' + esc(m.name) + '</h1></div>' +
        '<button type="button" class="btn btn-primary btn-add" data-act="add-trade">' + ic('plus', 20) + '<span>' + t('home.add') + '</span></button></header>';
    }
    // they share nothing with you: say so (don't guess "nothing added yet")
    if (ro && m._noMoney) return h + lockedCard(ctx, 'netWorth');
    if (ro && !pf.txns.length && !ctx.help) return h + emptyState('sprout', t('visit.emptyTitle', { name: esc(m.name) }), t('visit.emptyBody'));
    const s = C().summary(pf, base);
    const accts = Lg().accounts(pf, base);
    const inv = Lg().investView(pf);
    const hasInvest = inv.txns.some((x) => x.type === 'buy');

    // ---- the answer first: everything you have, then where it is ----
    if (can(ctx, 'netWorth')) {
      h += '<section class="hero" aria-live="polite"><div class="hero-label">' + (ro ? t('visit.total', { name: esc(m.name) }) : t('home.total')) + ui().learnBtn('netWorth') + '</div>' +
        '<div class="hero-num num" data-count="' + s.value + '" data-key="hero-' + ctx.id + '">' + M(s.value, { cur: base }) + '</div>' +
        '<p class="hero-sub">' + t('home.acrossN', { n: accts.length, count: accts.length }) + '</p></section>';
      if (ctx.help) h += helpCard(m);
      h += accountsGrid(accts, base, ro, ctx.help ? ctx.id : null);
    } else h += lockedCard(ctx, 'netWorth');

    if (ctx.help) { // a family member who lets you help: their month and their latest records, for you to add to and fix
      h += monthCard(m, base, ctx.id);
      h += recentCard(pf, base, ctx.id);
    }
    if (!ro) {
      h += quickRow();
      if (!pf.txns.length) h += gettingStarted();
      h += budgetsCard(m);
      h += monthCard(m, base);
      h += recentCard(pf, base);
    }
    if (hasInvest) h += investCard(ctx, m, inv, base);
    h += allocCard(ctx, pf, inv, base);
    if (ctx.inVisit) h += visitStreak(m);
    if (hasInvest) h += '<p class="foot-note price-note">' + priceNote() + '</p>';
    return h;
  }

  /* "spent something for Mum, or did she forget? add it here" */
  function helpCard(m) {
    const top = '<section class="card help-card"><div class="help-top"><span class="help-ic" aria-hidden="true">🤝</span><div class="row-main"><b class="help-t">' + t('help.cardT', { name: esc(m.name) }) + '</b><span class="row-s">' + t('help.cardB', { name: esc(m.name) }) + '</span></div></div>';
    if (!m.pf.accounts.length) return top + '<p class="hint">' + ic('info', 14) + '<span>' + t('help.noAccounts', { name: esc(m.name) }) + '</span></p></section>';
    return top +
      '<div class="quick-row" role="group" aria-label="' + esc(t('help.cardT', { name: m.name })) + '">' + [['expense', '🧾'], ['income', '💰'], ['transfer', '🔁']].map((q) =>
        '<button type="button" class="quick q-' + q[0] + '" data-act="help-add" data-who="' + esc(m.id) + '" data-type="' + q[0] + '"><span class="q-ic" aria-hidden="true">' + q[1] + '</span><span class="q-t" data-fit="12">' + t('quick.' + q[0]) + '</span></button>').join('') + '</div></section>';
  }
  /* ---- accounts, Wallet-style tiles (who: a family member I'm helping — their tiles open for me) ---- */
  function accountsGrid(accts, base, ro, who) {
    const tile = (x) => {
      const k = Lg().kindOf(x.acc);
      const inner = '<span class="at-ic" aria-hidden="true">' + k.icon + '</span><span class="at-name" data-fit="11">' + esc(accName(x.acc)) + '</span>' +
        '<span class="at-val num">' + M(x.value, { cur: x.acc.cur, compact: Math.abs(x.value) >= 1e6 }) + '</span>' +
        '<span class="at-kind">' + t('acct.kind.' + (x.acc.kind || 'other')) + (x.acc.cur !== base ? ' · ' + x.acc.cur : '') + '</span>';
      const cls = 'acct-tile' + (x.value < -0.004 ? ' neg' : '');
      if (who) return '<button type="button" class="' + cls + '" style="--c:' + k.color + '" data-act="help-acct" data-who="' + esc(who) + '" data-id="' + esc(x.acc.id) + '">' + inner + '</button>';
      return ro ? '<div class="' + cls + '" style="--c:' + k.color + '">' + inner + '</div>'
        : '<button type="button" class="' + cls + '" style="--c:' + k.color + '" data-act="account" data-id="' + esc(x.acc.id) + '">' + inner + '</button>';
    };
    return '<section class="acct-section"><div class="sec-head"><h2>' + t('home.accounts') + '</h2>' + (ro ? '' : '<button type="button" class="link-btn" data-act="manage-seg" data-seg="accounts">' + t('home.manage') + '</button>') + '</div>' +
      '<div class="acct-grid">' + accts.map(tile).join('') +
      (ro ? '' : '<button type="button" class="acct-tile add" data-act="add-account"><span class="at-ic" aria-hidden="true">' + ic('plus', 22) + '</span><span class="at-name">' + t('acct.add') + '</span><span class="at-kind">' + t('home.addAcctHint') + '</span></button>') + '</div></section>';
  }
  const quickRow = () => '<div class="quick-row" role="group" aria-label="' + esc(t('home.add')) + '">' + [['expense', '🧾'], ['income', '💰'], ['transfer', '🔁']].map((q) =>
    '<button type="button" class="quick q-' + q[0] + '" data-act="add-trade" data-type="' + q[0] + '"><span class="q-ic" aria-hidden="true">' + q[1] + '</span><span class="q-t" data-fit="12">' + t('quick.' + q[0]) + '</span></button>').join('') + '</div>';
  function gettingStarted() {
    return '<section class="setup-card first"><h2>' + t('start.t') + '</h2><p>' + t('start.b') + '</p>' +
      '<ol class="steps"><li class="now"><span class="step-dot">1</span>' + t('start.s1') + '</li><li><span class="step-dot">2</span>' + t('start.s2') + '</li><li><span class="step-dot">3</span>' + t('start.s3') + '</li></ol>' +
      '<div class="btn-row"><button type="button" class="btn btn-sun" data-act="add-account">' + ic('plus', 18) + t('acct.add') + '</button><button type="button" class="btn btn-soft" data-act="add-trade" data-type="expense">' + t('quick.expense') + '</button></div>' + importHint() + '</section>';
  }

  /* ---- budgets ---- */
  const budgetName = (b) => b.name || (b.cats && b.cats.length ? t('cat.' + b.cats[0]) + (b.cats.length > 1 ? ' +' + (b.cats.length - 1) : '') : t('budget.allSpending'));
  const budgetIcon = (b) => (b.cats && b.cats.length === 1 ? Lg().catOf(b.cats[0]).icon : '🎯');
  function budgetRow(b, p) {
    const elapsed = FF.clamp((FF.today() - p.from + 1) / (p.to - p.from + 1), 0, 1);
    const left = p.left >= 0 ? t('budget.leftShort', { amount: M(p.left, { cur: b.cur, whole: true }) }) : t('budget.overShort', { amount: M(-p.left, { cur: b.cur, whole: true }) });
    const note = p.status === 'over' ? t('budget.overNote') : p.status === 'risk' ? t('budget.risk', { amount: M(p.projected, { cur: b.cur, whole: true }) }) : p.daysLeft ? t('budget.perDayShort', { amount: M(p.perDay, { cur: b.cur, whole: true }), n: p.daysLeft, count: p.daysLeft }) : '';
    return '<button type="button" class="budget-row" data-act="budget-open" data-id="' + esc(b.id) + '"><span class="br-top"><span class="br-ic" aria-hidden="true">' + budgetIcon(b) + '</span><span class="row-t">' + esc(budgetName(b)) + '</span><span class="br-left num ' + p.status + '">' + left + '</span></span>' +
      '<span class="bar ' + p.status + '"><span style="width:' + (FF.clamp(p.pct, 0, 1) * 100).toFixed(1) + '%"></span><i class="pace" style="left:' + (elapsed * 100).toFixed(1) + '%"></i></span>' +
      '<span class="row-s">' + t('budget.spentOf', { spent: M(p.spent, { cur: b.cur, whole: true }), amt: M(b.amt, { cur: b.cur, whole: true }) }) + (note ? ' · ' + note : '') + '</span></button>';
  }
  function budgetsCard(m) {
    const bs = (m.budgets || []).map((b) => ({ b, p: Lg().budgetProgress(b, m.pf) })).sort((x, y) => y.p.pct - x.p.pct);
    if (!bs.length) return '';
    return '<section class="card budgets-card"><div class="card-head"><h2>' + t('budget.title') + '</h2><button type="button" class="link-btn" data-act="page" data-page="budget">' + t('home.seeAllShort') + '</button></div>' +
      bs.slice(0, 3).map((x) => budgetRow(x.b, x.p)).join('') + '</section>';
  }

  /* ---- this month: money in and out, where it went (who: a family member's, for helping) ---- */
  function monthCard(m, base, who) {
    const pf = m.pf, tp = FF.ymd(FF.today());
    const ms = Lg().monthStats(pf, base, tp.y, tp.m);
    const noBudgets = !(m.budgets || []).length && !who;
    const whoAttr = who ? ' data-who="' + esc(who) + '"' : '';
    let h = '<section class="card month-card"><div class="card-head"><h2>' + FF.i18n.monthYear(tp.y, tp.m) + '</h2>' +
      (noBudgets ? '<button type="button" class="chip-btn sm" data-act="budget-new">🎯 ' + t('budget.set') + '</button>' : '') + '</div>';
    if (!ms.n) return h + '<p class="muted">' + t(who ? 'help.noMonth' : 'home.noMonth', { name: esc(m.name) }) + '</p><button type="button" class="btn btn-soft btn-block" data-act="' + (who ? 'help-add' : 'add-trade') + '"' + whoAttr + ' data-type="expense">🧾 ' + t('quick.expense') + '</button></section>';
    const max = Math.max(ms.income, ms.expense, 1);
    h += '<div class="flow"><div class="flow-row in"><span class="fl-l">' + t('home.moneyIn') + '</span><span class="fl-bar"><i style="width:' + (ms.income / max * 100).toFixed(1) + '%"></i></span><b class="num">' + M(ms.income, { cur: base, whole: true }) + '</b></div>' +
      '<div class="flow-row out"><span class="fl-l">' + t('home.moneyOut') + '</span><span class="fl-bar"><i style="width:' + (ms.expense / max * 100).toFixed(1) + '%"></i></span><b class="num">' + M(ms.expense, { cur: base, whole: true }) + '</b></div></div>';
    h += '<p class="flow-net ' + (ms.net >= 0 ? 'good' : 'soft') + '">' + (ms.net >= 0 ? t('home.kept', { amount: '<b>' + M(ms.net, { cur: base, whole: true }) + '</b>' }) : t('home.overspent', { amount: '<b>' + M(-ms.net, { cur: base, whole: true }) + '</b>' })) + '</p>';
    if (ms.byCat.length) {
      const top = ms.byCat.slice(0, 5);
      h += '<h3 class="sub-h">' + t('home.whereWent') + '</h3><div class="spend-split"><div class="mini-donut">' + FF.charts.donut(ms.byCat.map((c) => ({ key: c.cat.id, value: c.amt, color: c.cat.color })), { size: 112, thickness: 18, label: t('home.whereWent') }) + '<span class="md-c">' + top[0].cat.icon + '</span></div><div class="cat-list">' +
        top.map((c) => '<button type="button" class="cat-line" data-act="' + (who ? 'help-cat' : 'cat-records') + '"' + whoAttr + ' data-cat="' + c.cat.id + '"><span class="cl-ic" aria-hidden="true">' + c.cat.icon + '</span><span class="cl-n">' + t('cat.' + c.cat.id) + '</span><span class="cl-v num">' + M(c.amt, { cur: base, whole: true }) + '</span><span class="cl-p num">' + FF.i18n.pct(c.pct, { dp: 0 }) + '</span></button>').join('') + '</div></div>';
    }
    return h + '</section>';
  }
  function recentCard(pf, base, who) {
    const list = Lg().recent(pf, 5);
    if (!list.length) return '';
    const all = who ? '<button type="button" class="link-btn" data-act="help-records" data-who="' + esc(who) + '">' + t('home.seeAllShort') + '</button>' : '<button type="button" class="link-btn" data-act="manage-seg" data-seg="records">' + t('home.seeAllShort') + '</button>';
    return '<section class="card list-card"><div class="card-head"><h2>' + t('home.recent') + '</h2>' + all + '</div>' +
      list.map((tx) => FF.manage.recordRow(tx, base, null, who ? { pf, who } : null)).join('') +
      (who || S().device().editHint ? '' : '<p class="tap-hint in-card">' + ic('edit', 14) + '<span>' + t('rec.tapEdit') + '</span></p>') + '</section>';
  }

  /* ---- investments (the stock tracker's summary) ---- */
  function investCard(ctx, m, inv, base) {
    const s = C().summary(inv, base);
    const ro = ctx.ro;
    let h = '<section class="card invest-card"><div class="card-head"><h2>' + ic('trend', 18) + t('home.invest') + '</h2><button type="button" class="link-btn" data-act="tab" data-tab="return">' + t('home.seeAllShort') + '</button></div>';
    if (can(ctx, 'netWorth')) h += '<div class="inv-num num">' + M(s.value, { cur: base }) + '</div>';
    if (can(ctx, 'returns')) h += '<p class="hero-answer ' + (s.gain >= 0 ? 'good' : 'soft') + '">' + (s.gain >= 0 ? t(ro ? 'visit.upAll' : 'home.upInvest', { amount: '<b>' + M(s.gain, { cur: base, whole: true }) + '</b>', pct: FF.i18n.pct(s.gainPct, { sign: true }), name: esc(m.name) }) : t(ro ? 'visit.downAll' : 'home.downInvest', { amount: '<b>' + M(-s.gain, { cur: base, whole: true }) + '</b>', pct: FF.i18n.pct(s.gainPct, { sign: true }), name: esc(m.name) })) + '</p>';
    if (can(ctx, 'holdings')) h += s.holdings.slice(0, ro ? 50 : 3).map((x) => holdingRow(x, base, ro)).join('');
    return h + '</section>';
  }

  /* ---- where your money is: holdings + cash ---- */
  const allocState = {};
  function allocSlices(pf, base) {
    const s = C().summary(pf, base);
    let slices = s.holdings.map((x) => ({ key: x.sym, name: D().displayName(x.a, FF.i18n.lang), value: x.value, color: D().logoColor(x.a) }));
    if (slices.length > 7) {
      const rest = slices.slice(6);
      slices = slices.slice(0, 6).concat([{ key: 'others', name: t('alloc.others', { n: rest.length }), value: FF.sum(rest, (x) => x.value), color: '#A79E8C' }]);
    }
    const cash = C().cashByAccountIn(pf, base);
    let pos = 0, owed = 0;
    Object.keys(cash).forEach((id) => { if (cash[id] > 0) pos += cash[id]; else owed -= cash[id]; });
    if (pos > 0.005) slices.push({ key: 'cash', name: t('type.cash'), value: pos, color: '#E9AE2E' });
    slices = slices.filter((x) => x.value > 0.005).sort((x, y) => y.value - x.value);
    const total = FF.sum(slices, (x) => x.value);
    slices.forEach((x) => { x.pct = total > 0 ? x.value / total : 0; });
    return { slices, total, owed };
  }
  function allocCard(ctx, pf, inv, base) {
    if (!can(ctx, 'holdings') || !can(ctx, 'netWorth')) return '';
    const scope = allocState[ctx.id] || 'all';
    const a = allocSlices(scope === 'all' ? pf : inv, base);
    const hasInv = inv.txns.some((x) => x.type === 'buy');
    if (!a.slices.length && scope === 'all') return '';
    let h = '<section class="card donut-card alloc-home"><div class="card-head"><h2>' + t('alloc.homeT') + '</h2></div>';
    if (hasInv) h += ui().segmented('alloc-' + ctx.id, [{ v: 'all', l: t('alloc.all') }, { v: 'invest', l: t('alloc.invest') }], scope, 'seg-alloc');
    if (!a.slices.length) return h + '<p class="muted center pad">' + t('alloc.none') + '</p></section>';
    const top = a.slices[0];
    h += '<div class="donut-wrap">' + FF.charts.donut(a.slices, { size: 196, thickness: 28, label: t('alloc.homeT') }) +
      '<div class="donut-center"><span class="dc-l">' + t('alloc.biggest') + '</span><b>' + esc(top.name) + '</b><span class="dc-p num">' + FF.i18n.pct(top.pct, { dp: 0 }) + '</span></div></div>';
    h += '<div class="alloc-legend">' + a.slices.map((sl) => '<div class="al-row"><span class="swatch" style="--c:' + sl.color + '"></span><span class="al-n">' + esc(sl.name) + '</span><span class="al-p num">' + FF.i18n.pct(sl.pct, { dp: sl.pct < 0.1 ? 1 : 0 }) + '</span><span class="al-v num">' + M(sl.value, { cur: base, whole: true }) + '</span></div>').join('') + '</div>';
    if (a.owed > 0.005) h += '<p class="hint">' + ic('info', 14) + '<span>' + t('alloc.owed', { amount: '<b>' + M(a.owed, { cur: base, whole: true }) + '</b>' }) + '</span></p>';
    return h + '</section>';
  }

  function importHint() {
    return '<button type="button" class="link-row" data-act="csv">' + ic('file', 18) + '<span>' + t('csv.hint') + '</span>' + ic('chevR', 16) + '</button>';
  }
  function visitStreak(m) {
    const st = S().streakOf(m.id);
    const badges = Object.keys(m.badges || {});
    return '<section class="card visit-fun"><div class="vf-item"><span class="vf-big">🌱</span><span><b>' + t('streak.weeks', { n: st.weeks }) + '</b><span class="row-s">' + t('streak.logging') + '</span></span></div>' +
      '<div class="vf-item"><span class="vf-big">🏅</span><span><b>' + t('badges.count', { n: badges.length }) + '</b><span class="row-s">' + t('badges.earned') + '</span></span></div></section>';
  }
  function afterHome(el, ctx) {
    const hero = el.querySelector('.hero-num');
    if (hero) FF.ui.countUp(hero, +hero.dataset.count, (v) => M(v, { cur: baseOf(ctx) }), hero.dataset.key);
    const seg = el.querySelector('[data-seg="alloc-' + ctx.id + '"]');
    if (seg) seg.addEventListener('click', (e) => { const b = e.target.closest('.seg-b'); if (!b) return; allocState[ctx.id] = b.dataset.v; FF.ui.sfx.tap(); if (ctx.inVisit) FF.app.refresh(true); else FF.app.refresh(true); });
  }

  /* ===================================================== RETURN (investments only) */
  const PERIODS = ['1m', '3m', 'ytd', '1y', 'all'];
  const retState = {};
  const ipf = (ctx) => Lg().investView(pfOf(ctx));
  function ret(ctx) {
    const pf = ipf(ctx), base = pf.base;
    const period = retState[ctx.id] || 'ytd';
    let h = ctx.inVisit ? '' : header(t('ret.title'), { kicker: t('tab.return') });
    if (!can(ctx, 'returns')) return h + lockedCard(ctx, 'returns');
    if (!pf.txns.some((x) => x.type === 'buy')) return h + emptyState('sprout', t('ret.empty.t'), t('ret.empty.b'), ctx.ro ? '' : '<button type="button" class="btn btn-primary" data-act="add-trade" data-type="buy">' + ic('plus', 18) + t('ret.empty.cta') + '</button>');
    const r = C().returnFor(pf, base, period);
    const up = r.gain >= 0;
    h += ui().segmented('period', PERIODS.map((p) => ({ v: p, l: t('period.' + p) })), period, 'seg-period');
    h += '<section class="answer-card ' + (up ? 'up' : 'down') + '">' +
      '<div class="ans-kicker">' + t(up ? (ctx.ro ? 'ret.madeThey' : 'ret.made') : (ctx.ro ? 'ret.lostThey' : 'ret.lost'), { name: esc(member(ctx).name) }) + '</div>' +
      '<div class="ans-num num">' + (up ? ic('up', 26) : ic('down', 26)) + '<span>' + M(Math.abs(r.gain), { cur: base }) + '</span></div>' +
      '<div class="ans-sub">' + t('ret.period.' + period) + ' · <b>' + FF.i18n.pct(r.pct, { sign: true }) + '</b>' + ui().learnBtn('return') + '</div>' +
      (up ? '' : '<p class="calm">' + ic('leaf', 16) + '<span>' + t('ret.calm') + '</span></p>') + '</section>';
    h += '<section class="card"><div class="card-head"><h2>' + t('ret.where') + '</h2></div><dl class="kv big">' +
      '<div><dt><span class="dot" style="--c:var(--chart-1)"></span>' + t('ret.price') + ui().learnBtn('priceGrowth') + '</dt><dd>' + ui().delta(r.priceGrowth, { cur: base }) + '</dd></div>' +
      '<div><dt><span class="dot" style="--c:var(--sun)"></span>' + t('ret.divs') + ui().learnBtn('dividend') + '</dt><dd>' + ui().delta(r.dividends, { cur: base }) + '</dd></div>' +
      (Math.abs(r.fxEffect) >= 0.005 ? '<div><dt><span class="dot" style="--c:var(--sky)"></span>' + t('ret.fx') + ui().learnBtn('fxEffect') + '</dt><dd>' + ui().delta(r.fxEffect, { cur: base }) + '</dd></div>' : '') +
      '<div><dt><span class="dot" style="--c:var(--ink-3)"></span>' + t('ret.fees') + ui().learnBtn('fees') + '</dt><dd>' + ui().delta(-r.fees, { cur: base }) + '</dd></div>' +
      '</dl></section>';
    h += '<section class="card"><div class="card-head"><h2>' + t('ret.chart.t') + '</h2></div><div class="legend"><span><i class="lg-v"></i>' + t('ret.chart.value') + '</span><span><i class="lg-c"></i>' + t('ret.chart.in') + ui().learnBtn('moneyIn') + '</span></div><div class="chart-host" id="ret-chart-' + ctx.id + '"></div><p class="hint">' + ic('focus', 14) + t('ret.chart.hint') + '</p></section>';
    if (r.parts.length) {
      const helpers = r.parts.filter((p) => p.gain > 0).slice(0, 3);
      const back = r.parts.filter((p) => p.gain < 0).slice(-3).reverse();
      h += '<details class="card more-card"><summary><span>' + t('ret.detailsT') + '</span>' + ic('chevD', 18) + '</summary>';
      if (helpers.length) h += '<h3 class="sub-h">' + t('ret.helpers') + '</h3>' + helpers.map((p) => partRow(p, base)).join('');
      if (back.length) h += '<h3 class="sub-h">' + t('ret.heldBack') + '</h3>' + back.map((p) => partRow(p, base)).join('');
      h += '</details>';
    }
    // everything you own (Portseido-style list)
    if (can(ctx, 'holdings')) {
      const s = C().summary(pf, base);
      if (s.count) {
        h += '<section class="card list-card"><div class="card-head"><h2>' + (ctx.ro ? t('visit.own', { name: esc(member(ctx).name) }) : t('home.own')) + '</h2><span class="muted">' + t('home.ownCount', { n: s.count }) + '</span></div>' +
          s.holdings.map((x) => holdingGainRow(x, base, ctx.ro)).join('') +
          (FF.isZero(s.cash) ? '' : '<div class="kv-foot"><span>' + t('ret.cashInvest') + '</span><b class="num">' + M(s.cash, { cur: base }) + '</b></div>') + '</section>';
      }
      if (!ctx.ro) h += '<button type="button" class="btn btn-soft btn-block" data-act="add-trade" data-type="buy">' + ic('plus', 18) + t('ret.addBuy') + '</button>';
    }
    h += '<p class="foot-note price-note">' + priceNote() + '</p>';
    return h;
  }
  /* a holding with its gain since bought */
  function holdingGainRow(x, base, ro) {
    return '<button type="button" class="row hold-row" data-act="holding" data-sym="' + x.sym + '"' + (ro ? ' data-ro="1"' : '') + '>' + ui().assetLogo(x.a, 42) +
      '<span class="row-main"><span class="row-t">' + esc(D().displayName(x.a, FF.i18n.lang)) + '</span><span class="row-s">' + t('units.' + (x.a.t === 'crypto' ? 'coins' : 'shares'), { n: FF.i18n.qty(x.qty), count: x.qty }) + ' · ' + FF.i18n.pct(x.weight, { dp: 0 }) + '</span></span>' +
      '<span class="row-end"><span class="row-v num">' + M(x.value, { cur: base }) + '</span>' + ui().delta(x.gain, { cur: base, whole: true }) + '</span></button>';
  }
  const partRow = (p, base) => '<div class="row static">' + ui().assetLogo(p.a, 36) + '<span class="row-main"><span class="row-t">' + esc(D().displayName(p.a, FF.i18n.lang)) + '</span></span><span class="row-end">' + ui().delta(p.gain, { cur: base }) + '</span></div>';
  function afterReturn(el, ctx) {
    const host = el.querySelector('#ret-chart-' + ctx.id);
    if (!host) return;
    const pf = ipf(ctx), base = pf.base;
    const period = retState[ctx.id] || 'ytd';
    const r = C().returnFor(pf, base, period);
    const pts = C().history(pf, base, Math.max(r.from, C().firstDay(pf) - 1), r.to, 120);
    FF.charts.line(host, pts, { cur: base, label: t('ret.chart.t') });
    const seg = el.querySelector('[data-seg="period"]');
    if (seg) seg.addEventListener('click', (e) => { const b = e.target.closest('.seg-b'); if (!b) return; retState[ctx.id] = b.dataset.v; FF.ui.sfx.tap(); FF.app.refresh(true); });
  }

  /* ===================================================== DIVIDEND (added automatically, after US tax) */
  const divState = {};
  function div(ctx) {
    const full = pfOf(ctx), pf = ipf(ctx), base = full.base;
    const today = FF.today(), tp = FF.ymd(today);
    const st = divState[ctx.id] || (divState[ctx.id] = { y: tp.y, m: tp.m, sel: null });
    let h = ctx.inVisit ? '' : header(t('div.title'), { kicker: t('tab.div') });
    if (!can(ctx, 'dividends')) return h + lockedCard(ctx, 'dividends');
    const events = ctx.ro ? {} : FF.market.dividends();
    const tax = Lg().taxOf(full);
    const year = Lg().dividendItems(full, base, FF.fromYMD(tp.y, 1, 1), FF.fromYMD(tp.y, 12, 31), events);
    if (!pf.txns.some((x) => x.type === 'buy') && !year.length) return h + emptyState('basket', t('div.empty.t'), t('div.empty.b'), ctx.ro ? '' : '<button type="button" class="btn btn-primary" data-act="add-trade" data-type="buy">' + ic('plus', 18) + t('ret.addBuy') + '</button>');
    const got = FF.sum(year.filter((x) => x.status === 'received'), (x) => x.base), all = FF.sum(year, (x) => x.base);
    h += '<section class="answer-card sun"><div class="ans-kicker">' + t(ctx.ro ? 'div.yearThey' : 'div.year', { year: FF.i18n.year(tp.y), name: esc(member(ctx).name) }) + '</div><div class="ans-num num"><span>' + M(all, { cur: base }) + '</span></div>' +
      '<div class="ans-sub">' + t('div.soFar', { amount: '<b>' + M(got, { cur: base }) + '</b>' }) + ' · ' + t('div.perMonth', { amount: '<b>' + M(all / 12, { cur: base }) + '</b>' }) + ui().learnBtn('dividend') + '</div>' +
      (ctx.ro ? '' : '<button type="button" class="tax-chip" data-act="div-tax">' + ic('info', 14) + t('div.taxChip', { pct: FF.i18n.pct(tax, { dp: 0 }) }) + ic('edit', 14) + '</button>') + '</section>';
    if (!ctx.ro) {
      const soon = Lg().dividendItems(full, base, today + 1, today + 60, events).filter((x) => x.status === 'coming');
      if (soon.length) h += '<section class="card list-card"><div class="card-head"><h2>' + ic('calendar', 18) + t('div.comingT') + '</h2></div>' + soon.map((x) => divRow(x, base, t('div.payOn', { date: FF.i18n.dateShort(x.day) }))).join('') + '</section>';
      const autos = full.txns.filter((x) => x.type === 'dividend' && x.auto).sort((a, b) => b.day - a.day).slice(0, 5);
      if (autos.length) h += '<section class="card list-card"><div class="card-head"><h2>' + ic('basket', 18) + t('div.recentT') + '</h2></div>' + autos.map((x) => '<button type="button" class="row" data-act="tx" data-id="' + x.id + '">' + ui().assetLogo(D().asset(x.sym), 36) + '<span class="row-main"><span class="row-t">' + esc(D().displayName(D().asset(x.sym), FF.i18n.lang)) + ' <span class="src-tag live auto">' + t('div.auto') + '</span></span><span class="row-s">' + FF.i18n.dateShort(x.day) + ' · ' + t('div.afterTax', { gross: FF.i18n.money(x.gross || x.amt, x.cur) }) + '</span></span><span class="row-end"><span class="row-v num pos">' + FF.i18n.money(x.amt, x.cur, { sign: true }) + '</span></span></button>').join('') + '</section>';
    }
    // calendar
    const mo = Lg().dividendItems(full, base, FF.monthStart(st.y, st.m), FF.monthEnd(st.y, st.m), events);
    const first = FF.monthStart(st.y, st.m), dim = FF.daysInMonth(st.y, st.m);
    const lead = (FF.ymd(first).wd + 6) % 7;
    const byDay = {};
    mo.forEach((x) => { (byDay[x.day] = byDay[x.day] || []).push(x); });
    h += '<section class="card cal-card"><div class="cal-head"><button type="button" class="icon-btn" data-act="div-month" data-d="-1" aria-label="' + esc(t('a11y.prevMonth')) + '">' + ic('chevL', 20) + '</button><div class="cal-title"><b>' + FF.i18n.monthYear(st.y, st.m) + '</b><span class="num">' + M(FF.sum(mo, (x) => x.base), { cur: base }) + '</span></div><button type="button" class="icon-btn" data-act="div-month" data-d="1" aria-label="' + esc(t('a11y.nextMonth')) + '">' + ic('chevR', 20) + '</button></div>';
    h += '<div class="cal-grid" role="grid">' + FF.i18n.weekdaysNarrow().map((w) => '<span class="cal-wd">' + esc(w) + '</span>').join('');
    for (let k = 0; k < lead; k++) h += '<span class="cal-cell blank"></span>';
    for (let d = 1; d <= dim; d++) {
      const day = first + d - 1;
      const items = byDay[day] || [];
      const status = items.length ? (items.some((x) => x.status === 'coming') ? 'upcoming' : items.some((x) => x.status === 'estimated') ? 'estimated' : 'received') : '';
      h += '<button type="button" class="cal-cell' + (day === today ? ' today' : '') + (status ? ' has ' + status : '') + (st.sel === day ? ' sel' : '') + '" data-act="div-day" data-day="' + day + '" aria-label="' + esc(FF.i18n.date(day) + (items.length ? ': ' + M(FF.sum(items, (x) => x.base), { cur: base }) : '')) + '"><span class="cal-d">' + d + '</span>' + (status ? '<span class="coin-dot"></span>' : '') + '</button>';
    }
    h += '</div><div class="cal-legend"><span><i class="coin-dot received"></i>' + t('div.got') + '</span><span><i class="coin-dot upcoming"></i>' + t('div.coming') + '</span><span><i class="coin-dot estimated"></i>' + t('div.estimated') + '</span></div>';
    const list = st.sel ? (byDay[st.sel] || []) : mo;
    h += '<div class="cal-list">' + (list.length ? list.map((x) => divRow(x, base, FF.i18n.date(x.day) + ' · ' + t('div.status.' + x.status))).join('') : '<p class="muted center pad">' + t(st.sel ? 'div.noneDay' : 'div.noneMonth') + '</p>') + '</div></section>';
    // by month
    const months = [];
    for (let mm = 1; mm <= 12; mm++) {
      const its = year.filter((x) => FF.ymd(x.day).m === mm);
      months.push({ m: mm, received: FF.sum(its.filter((x) => x.status === 'received'), (x) => x.base), expected: FF.sum(its.filter((x) => x.status !== 'received'), (x) => x.base) });
    }
    h += '<section class="card"><div class="card-head"><h2>' + t('div.byMonth', { year: FF.i18n.year(tp.y) }) + '</h2></div>' + FF.charts.bars(months, { current: tp.m, label: t('div.byMonth', { year: tp.y }) }) + '<div class="legend"><span><i class="lg-got"></i>' + t('div.got') + '</span><span><i class="lg-exp"></i>' + t('div.expected') + '</span></div></section>';
    if (!ctx.ro) h += '<p class="foot-note">' + ic('info', 14) + '<span>' + t('div.how', { pct: FF.i18n.pct(tax, { dp: 0 }) }) + '</span></p>';
    return h;
  }
  const divRow = (x, base, sub) => '<div class="row static">' + ui().assetLogo(x.a, 36) + '<span class="row-main"><span class="row-t">' + esc(D().displayName(x.a, FF.i18n.lang)) + '</span><span class="row-s">' + sub + '</span></span><span class="row-end"><span class="row-v num">' + M(x.base, { cur: base }) + '</span>' + (x.cur !== base ? '<span class="row-s num">' + FF.i18n.money(x.amt, x.cur) + '</span>' : '') + '</span></div>';
  function divMonth(ctx, dlt) {
    const st = divState[ctx.id];
    const n = FF.addMonths(st.y, st.m, dlt);
    st.y = n.y; st.m = n.m; st.sel = null;
  }
  function divDay(ctx, day) { const st = divState[ctx.id]; st.sel = st.sel === day ? null : day; }
  /* the US withholding tax taken from dividends (30% unless a tax treaty says less) */
  function openDivTax() {
    const pf = S().me().pf;
    const st = { v: Math.round(Lg().taxOf(pf) * 100) };
    ui().openSheet({
      label: t('div.taxT'), state: st,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('div.taxT') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<p class="lead">' + t('div.taxB') + '</p><div class="chips center">' + [30, 15, 10, 0].map((v) => '<button type="button" class="chip-btn' + (v === st.v ? ' on' : '') + '" data-v="' + v + '">' + v + '%</button>').join('') + '</div>' +
        '<p class="hint">' + ic('info', 14) + '<span>' + t('div.taxNote') + '</span></p><button type="button" class="btn btn-primary btn-block btn-lg" id="tax-go">' + t('common.save') + '</button>',
      onRender: (b, api) => {
        b.querySelector('[data-close]').addEventListener('click', () => api.close());
        b.querySelectorAll('[data-v]').forEach((x) => x.addEventListener('click', () => { st.v = +x.dataset.v; api.render(); }));
        b.querySelector('#tax-go').addEventListener('click', () => { S().setDivTax(st.v / 100); api.close(true); FF.ui.toast(t('div.taxSaved', { pct: st.v + '%' }), { icon: 'check', tone: 'success' }); });
      }
    });
  }
  A['div-tax'] = () => openDivTax();

  FF.money = { priceNote, sourceTag, quoteTime, home, afterHome, ret, afterReturn, div, divMonth, divDay, header, emptyState, lockedCard, holdingRow, holdingGainRow, member, can, accName, budgetRow, budgetName, budgetIcon, allocSlices };
})(window);
