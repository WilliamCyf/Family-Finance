/* ============================================================
   Family Finance — screens-insights.js
   The Insights tab ("how is my money doing?") and its pages:
   money health · net worth · money in and out · spending ·
   the family's books. Also the small kit the other new screens
   share (stacked fractions, "how it's worked out", file export).
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, C = () => FF.calc, D = () => FF.data, B = () => FF.books, Lg = () => FF.ledger;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const ui = () => FF.ui;
  const M = (v, o) => FF.i18n.money(v, o && o.cur, o);
  const A = FF.actions = FF.actions || {};
  const pct = (v, dp) => FF.i18n.pct(v, { dp: dp == null ? 0 : dp });
  const accName = (acc) => (acc ? acc.name || (acc.nameKey ? t(acc.nameKey) : acc.id) : t('acct.none'));

  /* =====================================================
     THE KIT
     ===================================================== */
  /* a fraction written the way it is on paper: the top over a line over the bottom */
  const frac = (top, bottom) => '<span class="fz-frac"><span class="fz-frac-t">' + top + '</span><span class="fz-frac-b">' + bottom + '</span></span>';
  /* "what = top / bottom = answer" on one row */
  const eq = (lhs, f, rhs, tail) => '<div class="fz-eq">' + (lhs ? '<span class="fz-eq-l">' + lhs + '</span><span class="fz-eq-s">=</span>' : '') + f + (tail ? '<span class="fz-eq-s">' + tail + '</span>' : '') + (rhs != null ? '<span class="fz-eq-s">=</span><b class="fz-eq-r num">' + rhs + '</b>' : '') + '</div>';
  /* a fold-out "How it's worked out" */
  const how = (inner, title) => '<details class="fz-how"><summary>' + ic('calc', 16) + '<span>' + (title || t('kit.how')) + '</span>' + ic('chevD', 16) + '</summary><div class="fz-how-b">' + inner + '</div></details>';
  const sheetHead = (title, icon) => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + (icon || '') + '<span>' + title + '</span></h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>';
  const tile = (o) => '<button type="button" class="fz-tile" ' + (o.attrs || '') + ' style="--c:' + (o.color || 'var(--brand)') + '"><span class="fz-tile-ic" aria-hidden="true">' + (o.emo || ic(o.icon, 22)) + '</span><span class="fz-tile-t" data-fit="12">' + o.title + '</span>' + (o.sub ? '<span class="fz-tile-s">' + o.sub + '</span>' : '') + (o.badge ? '<span class="fz-tile-b">' + o.badge + '</span>' : '') + '</button>';
  const stat = (label, value, cls, sub) => '<div class="fz-stat ' + (cls || '') + '"><span class="fz-stat-l">' + label + '</span><b class="fz-stat-v num" data-fit="12">' + value + '</b>' + (sub ? '<span class="fz-stat-s">' + sub + '</span>' : '') + '</div>';
  const levelColor = (score) => (score >= 75 ? 'var(--green)' : score >= 45 ? 'var(--sun-2)' : 'var(--coral)');
  /* up is good for money you have; for spending, up is the thing to watch — so the colour can be flipped */
  function change(v, o) {
    o = o || {};
    const up = v > (o.pct ? 0.0005 : 0.004), down = v < -(o.pct ? 0.0005 : 0.004);
    const good = o.flip ? down : up, bad = o.flip ? up : down;
    const txt = o.pct ? FF.i18n.pct(Math.abs(v), { dp: Math.abs(v) < 0.1 ? 1 : 0 }) : M(Math.abs(v), { cur: o.cur, whole: o.whole !== false });
    return '<span class="fz-chg ' + (good ? 'good' : bad ? 'bad' : 'flat') + '" aria-label="' + esc((up ? t('a11y.up') : down ? t('a11y.down') : t('a11y.flat')) + ' ' + txt) + '">' + (up ? ic('up', 13) : down ? ic('down', 13) : '') + '<span class="num">' + txt + '</span></span>';
  }
  /* hand a file to the phone: the share sheet where there is one (iPhone: "Save to Files"),
     a plain download elsewhere */
  async function saveFile(name, text, mime) {
    const type = mime || 'text/plain';
    try {
      const file = new File([text], name, { type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'shared'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    try {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const a = document.createElement('a');
      a.href = url; a.download = name; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
      return 'saved';
    } catch (e) { return 'failed'; }
  }
  /* one line of a spreadsheet file: quotes around anything with a comma, a quote or a line break */
  const csvLine = (cells) => cells.map((c) => { const s = c == null ? '' : String(c); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
  const csvNum = (v) => (isFinite(v) ? (Math.round(v * 100) / 100).toFixed(2) : '');
  FF.kit = { frac, eq, how, sheetHead, tile, stat, change, levelColor, saveFile, csvLine, csvNum, accName };

  const me = () => S().me();
  const PIL = { save: '💰', buffer: '🛟', debt: '💳', budget: '🎯', invest: '🌱', habit: '✍️' };

  /* =====================================================
     THE INSIGHTS TAB
     ===================================================== */
  const st = { net: '1y', flow: 6, flowSel: null, spend: 0, spendDay: null, books: 'own', booksAt: 'today', booksPeriod: 'month', scope: 'me', terms: false };
  function tab() {
    const m = me(), pf = m.pf, base = pf.base;
    let h = FF.money.header(t('ins.title'), { kicker: t('tab.insights') });
    if (!pf.txns.length) {
      return h + FF.money.emptyState('sprout', t('ins.empty.t'), t('ins.empty.b'), '<button type="button" class="btn btn-primary" data-act="add-trade" data-type="expense">' + ic('plus', 18) + t('quick.expense') + '</button>') + toolsGrid(m);
    }
    const hl = B().health(m, base);
    h += healthCard(hl);
    h += netCard(pf, base, hl.pos);
    h += flowCard(pf, base);
    h += spendCard(pf, base);
    h += toolsGrid(m);
    return h;
  }
  function afterTab(el) {
    drawNet(el);
    bindSeg(el, 'net', (v) => { st.net = v; });
  }
  function bindSeg(el, name, set, after) {
    const seg = el.querySelector('[data-seg="' + name + '"]');
    if (seg) seg.addEventListener('click', (e) => { const b = e.target.closest('.seg-b'); if (!b || b.classList.contains('on')) return; set(b.dataset.v); ui().sfx.tap(); if (after) after(); else FF.app.refresh(true); });
  }

  /* ---- money health ---- */
  function healthSummary(hl) {
    if (hl.focus) return t('hl.next.' + hl.focus);
    return t('hl.allGood');
  }
  function pillarChips(hl) {
    return '<span class="fz-pillars" aria-hidden="true">' + hl.pillars.map((p) => '<span class="fz-pil ' + (p.has ? p.level : 'none') + '"><span class="fz-pil-e">' + PIL[p.k] + '</span><span class="fz-pil-bar"><i style="width:' + (p.has ? Math.max(8, p.score) : 0) + '%"></i></span></span>').join('') + '</span>';
  }
  function healthCard(hl) {
    if (hl.score == null) {
      return '<button type="button" class="card fz-health none" data-act="page" data-page="health"><span class="fz-health-ring">' + FF.charts.ring(0, { size: 96, th: 10 }) + '<span class="fz-ring-c"><b>?</b></span></span>' +
        '<span class="fz-health-txt"><span class="kicker">' + t('hl.title') + '</span><span class="fz-health-grade">' + t('hl.none.t') + '</span><span class="row-s">' + t('hl.none.b') + '</span></span>' + ic('chevR', 18) + '</button>';
    }
    return '<button type="button" class="card fz-health" data-act="page" data-page="health" aria-label="' + esc(t('hl.title') + ': ' + hl.score + ' — ' + t('hl.grade.' + hl.grade)) + '">' +
      '<span class="fz-health-ring">' + FF.charts.ring(hl.score / 100, { size: 96, th: 10, color: levelColor(hl.score) }) + '<span class="fz-ring-c"><b class="num">' + hl.score + '</b><span>' + t('hl.of100') + '</span></span></span>' +
      '<span class="fz-health-txt"><span class="kicker">' + t('hl.title') + '</span><span class="fz-health-grade">' + t('hl.grade.' + hl.grade) + '</span><span class="row-s">' + healthSummary(hl) + '</span></span>' + ic('chevR', 18) + pillarChips(hl) + '</button>';
  }

  /* ---- net worth ---- */
  const NET_PERIODS = ['3m', '6m', '1y', 'all'];
  const netDays = (pf, period) => {
    const today = FF.today(), first = C().firstDay(pf);
    const back = { '3m': 91, '6m': 182, '1y': 365 }[period];
    const from = back ? Math.max(first, today - back) : first;
    return B().spread(Math.min(from, today), today, 70);
  };
  function netCard(pf, base, pos) {
    const today = FF.today(), p = FF.ymd(today);
    const before = B().netSeries(pf, base, [FF.monthStart(p.y, p.m) - 1], { sinceStart: true })[0];
    const d = pos.net - before.net;
    return '<section class="card fz-net"><div class="card-head"><h2>' + t('nw.title') + ui().learnBtn('netWorth') + '</h2><button type="button" class="link-btn" data-act="page" data-page="networth">' + t('ins.details') + '</button></div>' +
      '<div class="fz-big num">' + M(pos.net, { cur: base }) + '</div><p class="fz-sub">' + change(d, { cur: base }) + '<span>' + t('nw.thisMonth') + '</span></p>' +
      ui().segmented('net', NET_PERIODS.map((k) => ({ v: k, l: t('nw.p.' + k) })), st.net, 'fz-seg-sm') +
      '<div class="chart-host" id="fz-net-chart"></div>' + ownOwe(pos, base) + '</section>';
  }
  function ownOwe(pos, base) {
    const total = pos.assets + pos.debts;
    const w = total > 0 ? FF.clamp(pos.assets / total, 0.02, pos.debts > 0.005 ? 0.98 : 1) : 1;
    return '<div class="fz-ownowe"><div class="fz-oo-bar" aria-hidden="true"><i class="own" style="flex:' + w.toFixed(4) + '"></i>' + (pos.debts > 0.005 ? '<i class="owe" style="flex:' + (1 - w).toFixed(4) + '"></i>' : '') + '</div>' +
      '<div class="fz-oo-row"><span><i class="dot" style="--c:var(--chart-1)"></i>' + t('nw.own') + ' <b class="num">' + M(pos.assets, { cur: base, whole: true }) + '</b></span><span><i class="dot" style="--c:var(--coral)"></i>' + t('nw.owe') + ' <b class="num">' + M(pos.debts, { cur: base, whole: true }) + '</b></span></div></div>';
  }
  function drawNet(el) {
    const host = el.querySelector('#fz-net-chart');
    if (!host) return;
    const pf = me().pf, base = pf.base;
    const pts = B().netSeries(pf, base, netDays(pf, st.net), { sinceStart: true }).map((p) => ({ day: p.day, value: p.net }));
    if (pts.length < 2) { host.innerHTML = '<p class="muted center pad">' + t('nw.soon') + '</p>'; return; }
    FF.charts.line(host, pts, { cur: base, noContrib: true, label: t('nw.title'), height: 150 });
  }

  /* ---- money in and out ---- */
  function flowCard(pf, base) {
    const ms = B().months(pf, base, 6);
    if (!ms.some((x) => x.n)) return '';
    const withIncome = ms.filter((x) => x.income > 0);
    const inc = FF.sum(withIncome, (x) => x.income), kept = FF.sum(withIncome, (x) => x.net);
    const line = withIncome.length ? (kept >= 0 ? t('cf.keepAvg', { pct: '<b>' + pct(kept / inc) + '</b>' }) : t('cf.overAvg', { pct: '<b>' + pct(-kept / inc) + '</b>' })) : t('cf.noIncome');
    return '<section class="card fz-flowcard"><div class="card-head"><h2>' + t('cf.title') + '</h2><button type="button" class="link-btn" data-act="page" data-page="cashflow">' + t('ins.details') + '</button></div>' +
      FF.charts.flow(ms, { label: t('cf.title') }) + flowLegend() + '<p class="fz-line ' + (kept >= 0 ? 'good' : 'soft') + '">' + line + '</p></section>';
  }
  const flowLegend = () => '<div class="legend"><span><i style="background:var(--chart-1)"></i>' + t('home.moneyIn') + '</span><span><i style="background:var(--coral)"></i>' + t('home.moneyOut') + '</span></div>';

  /* ---- spending this month ---- */
  function catDelta(c, base) {
    if (c.avg3 == null || c.avg3 <= 0) return c.amt > 0 ? '<span class="fz-chg flat">' + t('sp.new') + '</span>' : '';
    return change((c.amt - c.avg3) / c.avg3, { pct: true, flip: true });
  }
  function spendCard(pf, base) {
    const sp = B().spending(pf, base);
    if (!(sp.spent > 0) && !(sp.prevFull > 0)) return '';
    let cmp = '';
    if (sp.prevSame > 0) { const d = sp.spent - sp.prevSame; cmp = FF.isZero(d) ? t('sp.sameAsLast') : t(d > 0 ? 'sp.moreThanLast' : 'sp.lessThanLast', { amount: '<b>' + M(Math.abs(d), { cur: base, whole: true }) + '</b>' }); }
    let h = '<section class="card fz-spend"><div class="card-head"><h2>' + t('sp.title') + '</h2><button type="button" class="link-btn" data-act="page" data-page="spending">' + t('ins.details') + '</button></div>' +
      '<div class="fz-big num">' + M(sp.spent, { cur: base }) + '</div><p class="fz-sub"><span>' + (cmp || t('sp.soFar', { month: FF.i18n.monthYear(sp.y, sp.m) })) + '</span></p>';
    if (sp.projected != null && sp.dom < sp.dim) h += paceBar(sp, base);
    const top = sp.cats.filter((c) => c.amt > 0).slice(0, 4);
    if (top.length) h += '<div class="fz-catrows">' + top.map((c) => catRow(c, sp, base)).join('') + '</div>';
    const odd = B().unusual(sp);
    if (odd) h += '<p class="hint fz-odd">' + ic('info', 14) + '<span>' + t('sp.unusual', { cat: '<b>' + t('cat.' + odd.cat.id) + '</b>', amount: M(odd.amt, { cur: base, whole: true }), usual: M(odd.avg3, { cur: base, whole: true }) }) + '</span></p>';
    return h + '</section>';
  }
  /* the month as a bar: how far through it we are (the tick) and how much of a usual month is spent */
  function paceBar(sp, base) {
    const ref = sp.avg3 != null && sp.avg3 > 0 ? sp.avg3 : sp.prevFull > 0 ? sp.prevFull : null;
    if (ref == null) return '<p class="fz-pace-note">' + t('sp.pace', { amount: '<b>' + M(sp.projected, { cur: base, whole: true }) + '</b>' }) + '</p>';
    const fill = FF.clamp(sp.spent / ref, 0, 1), over = sp.projected > ref * 1.08;
    return '<div class="fz-pace"><span class="bar ' + (sp.spent > ref ? 'over' : over ? 'close' : '') + '"><span style="width:' + (fill * 100).toFixed(1) + '%"></span><i class="pace" style="left:' + (sp.dom / sp.dim * 100).toFixed(1) + '%"></i></span>' +
      '<p class="fz-pace-note">' + t(over ? 'sp.paceOver' : 'sp.paceOk', { amount: '<b>' + M(sp.projected, { cur: base, whole: true }) + '</b>', usual: M(ref, { cur: base, whole: true }) }) + '</p></div>';
  }
  function catRow(c, sp, base, act) {
    const max = Math.max.apply(null, sp.cats.map((x) => Math.max(x.amt, x.avg3 || 0)).concat([1]));
    return '<button type="button" class="fz-catrow" data-act="' + (act || 'cat-records') + '" data-cat="' + c.cat.id + '"><span class="tx-ic emo sm" style="--c:' + c.cat.color + '" aria-hidden="true">' + c.cat.icon + '</span>' +
      '<span class="fz-cr-main"><span class="fz-cr-top"><span class="fz-cr-n">' + t('cat.' + c.cat.id) + '</span><span class="fz-cr-v num">' + M(c.amt, { cur: base, whole: true }) + '</span></span>' +
      '<span class="fz-cr-bar"><i style="width:' + (c.amt / max * 100).toFixed(1) + '%;background:' + c.cat.color + '"></i>' + (c.avg3 != null && c.avg3 > 0 ? '<b class="fz-cr-tick" style="left:' + (c.avg3 / max * 100).toFixed(1) + '%"></b>' : '') + '</span>' +
      '<span class="fz-cr-foot"><span>' + (c.avg3 != null && c.avg3 > 0 ? t('sp.usually', { amount: M(c.avg3, { cur: base, whole: true }) }) : pct(c.pct)) + '</span>' + catDelta(c, base) + '</span></span></button>';
  }

  /* ---- tools ---- */
  function toolsGrid(m) {
    const x = S().extras(m), today = FF.today();
    const due = FF.sum(x.bills, (b) => (b.off || b.auto ? 0 : FF.recur.open(b, today).length));
    return '<h3 class="group-h">' + t('ins.tools') + '</h3><div class="fz-tiles">' +
      tile({ emo: '🧾', color: '#E0563F', title: t('bill.title'), sub: x.bills.length ? t('bill.count', { n: x.bills.length, count: x.bills.length }) : t('bill.tileSub'), badge: due ? String(due) : '', attrs: 'data-act="page" data-page="bills"' }) +
      tile({ emo: '🏁', color: '#E9AE2E', title: t('goal.title'), sub: x.goals.length ? t('goal.count', { n: x.goals.length, count: x.goals.length }) : t('goal.tileSub'), attrs: 'data-act="page" data-page="savings"' }) +
      tile({ emo: '📒', color: '#3D8FD6', title: t('bk.title'), sub: t('bk.tileSub'), attrs: 'data-act="page" data-page="books"' }) +
      tile({ emo: '🧮', color: '#8A5BC7', title: t('plan.title'), sub: t('plan.tileSub'), attrs: 'data-act="page" data-page="planner"' }) +
      tile({ emo: '🎞️', color: '#1F9E91', title: t('story.title'), sub: t('story.tileSub'), attrs: 'data-act="story"' }) +
      tile({ emo: '💾', color: '#5D6B7E', title: t('bkp.title'), sub: t('bkp.tileSub'), attrs: 'data-act="page" data-page="backup"' }) + '</div>';
  }

  /* =====================================================
     MONEY HEALTH (page)
     ===================================================== */
  function pillarValue(p, hl, base) {
    if (!p.has) return t('hl.' + p.k + '.none');
    switch (p.k) {
      case 'save': return p.value >= 0 ? t('hl.save.v', { pct: '<b>' + pct(p.value) + '</b>' }) : t('hl.save.vNeg', { pct: '<b>' + pct(-p.value) + '</b>' });
      case 'buffer': return t('hl.buffer.v', { n: '<b>' + FF.i18n.num(p.value, 1) + '</b>' });
      case 'debt': return p.value < 0.0005 ? t('hl.debt.v0') : t('hl.debt.v', { pct: '<b>' + pct(Math.min(p.value, 9.99)) + '</b>' });
      case 'budget': return t('hl.budget.v', { n: '<b>' + Math.round(p.value * p.n) + '</b>', total: p.n });
      case 'invest': return t('hl.invest.v', { n: '<b>' + FF.i18n.num(p.value, 1) + '</b>' });
      default: return t('hl.habit.v', { n: '<b>' + p.value + '</b>' });
    }
  }
  function pillarHow(p, hl, base) {
    const u = hl.usual, pos = hl.pos;
    const mw = (v) => M(v, { cur: base, whole: true });
    switch (p.k) {
      case 'save': return '<p>' + t('hl.save.how', { n: u.span }) + '</p>' + eq(t('hl.save.lhs'), frac(mw(u.income) + ' − ' + mw(u.expense), mw(u.income)), pct(p.value));
      case 'buffer': return '<p>' + t('hl.buffer.how') + '</p>' + eq(t('hl.buffer.lhs'), frac(mw(pos.liquid), mw(u.monthlyExpense)), t('hl.months', { n: FF.i18n.num(p.value, 1) }));
      case 'debt': return '<p>' + t('hl.debt.how') + '</p>' + eq(t('hl.debt.lhs'), frac(mw(pos.debts), mw(pos.assets)), pct(Math.min(p.value, 9.99)));
      case 'budget': return '<p>' + t('hl.budget.how') + '</p>';
      case 'invest': return '<p>' + t('hl.invest.how') + '</p>';
      default: return '<p>' + t('hl.habit.how') + '</p>' + eq(t('hl.habit.lhs'), frac(String(p.value), '30'), pct(p.value / 30));
    }
  }
  const PIL_ACT = { save: 'data-act="page" data-page="cashflow"', buffer: 'data-act="page" data-page="networth"', debt: 'data-act="page" data-page="networth"', budget: 'data-act="page" data-page="budget"', invest: 'data-act="tab" data-tab="invest"', habit: 'data-act="add-trade" data-type="expense"' };
  function healthPage() {
    const m = me(), base = m.pf.base, hl = B().health(m, base);
    let h = '<section class="fz-hero fz-health-hero">' +
      '<div class="fz-hero-ring">' + FF.charts.ring((hl.score || 0) / 100, { size: 150, th: 14, color: '#fff', track: 'rgba(255,255,255,.2)' }) + '<span class="fz-ring-c"><b class="num">' + (hl.score == null ? '?' : hl.score) + '</b><span>' + t('hl.of100') + '</span></span></div>' +
      '<h2>' + (hl.score == null ? t('hl.none.t') : t('hl.grade.' + hl.grade)) + '</h2><p>' + (hl.score == null ? t('hl.none.b') : healthSummary(hl)) + '</p></section>';
    h += hl.pillars.map((p) => {
      const col = p.has ? levelColor(p.score) : 'var(--line-2)';
      return '<section class="card fz-pcard ' + (p.has ? p.level : 'none') + '"><div class="fz-pc-head"><span class="fz-pc-ic" style="--c:' + col + '" aria-hidden="true">' + PIL[p.k] + '</span><div class="row-main"><h3>' + t('hl.' + p.k + '.t') + '</h3><span class="row-s">' + t('hl.weight', { n: p.weight }) + '</span></div>' +
        '<span class="fz-pc-score num" style="--c:' + col + '">' + (p.has ? p.score : '–') + '</span></div>' +
        '<p class="fz-pc-v">' + pillarValue(p, hl, base) + '</p>' +
        (p.has ? '<span class="fz-meter" aria-hidden="true"><i style="left:' + FF.clamp(p.score, 2, 98) + '%"></i></span>' : '') +
        '<p class="fz-pc-tip">' + ic('sparkle', 14) + '<span>' + t('hl.' + p.k + '.tip') + '</span></p>' +
        (p.has ? how(pillarHow(p, hl, base)) : '') +
        '<button type="button" class="btn btn-soft btn-sm btn-block" ' + PIL_ACT[p.k] + '>' + t('hl.' + p.k + '.cta') + '</button></section>';
    }).join('');
    h += '<p class="foot-note">' + ic('heart', 14) + '<span>' + t('hl.fair') + '</span></p>';
    return h;
  }

  /* =====================================================
     NET WORTH (page)
     ===================================================== */
  const SHELF_EMO = { liquid: '👛', invest: '📈', longterm: '🏦', hall: '🏛️' };
  function visibleFamily() {
    const meId = S().state.meId;
    return S().familyMembers().map((x) => ({ m: x, see: x.id === meId || (S().canSee(meId, x.id, 'netWorth') && !x._noMoney) }));
  }
  function scopeSeg() {
    const fam = S().family();
    if (!fam || fam.members.length < 2) return '';
    return ui().segmented('scope', [{ v: 'me', l: t('bk.me') }, { v: 'family', l: t('bk.family') }], st.scope, 'fz-seg-sm');
  }
  function lineRow(emo, color, name, sub, value, base, attrs) {
    const inner = '<span class="tx-ic emo sm" style="--c:' + color + '" aria-hidden="true">' + emo + '</span><span class="row-main"><span class="row-t">' + name + '</span>' + (sub ? '<span class="row-s">' + sub + '</span>' : '') + '</span><span class="row-end"><span class="row-v num">' + M(value, { cur: base }) + '</span></span>';
    return attrs ? '<button type="button" class="row fz-lrow" ' + attrs + '>' + inner + ic('chevR', 16) + '</button>' : '<div class="row static fz-lrow">' + inner + '</div>';
  }
  function networthPage() {
    const m = me(), pf = m.pf, base = pf.base;
    const fam = S().family(), famOn = st.scope === 'family' && fam && fam.members.length > 1;
    let h = scopeSeg();
    if (famOn) return h + familyNet(base);
    const pos = B().position(pf, base);
    const u = B().usual(pf, base), r = B().ratios(pos, u);
    h += '<section class="fz-hero"><div class="fz-hero-l">' + t('nw.title') + '</div><div class="fz-hero-num num">' + M(pos.net, { cur: base }) + '</div>' +
      '<div class="fz-hero-split"><div><span>' + t('nw.own') + '</span><b class="num">' + M(pos.assets, { cur: base, whole: true }) + '</b></div><div><span>' + t('nw.owe') + '</span><b class="num">' + M(pos.debts, { cur: base, whole: true }) + '</b></div></div></section>';
    h += '<section class="card"><div class="card-head"><h2>' + t('nw.trend') + '</h2></div>' + ui().segmented('net', NET_PERIODS.map((k) => ({ v: k, l: t('nw.p.' + k) })), st.net, 'fz-seg-sm') + '<div class="chart-host" id="fz-net-chart"></div><p class="hint">' + ic('info', 14) + '<span>' + t('nw.trendNote') + '</span></p></section>';
    // what you own, shelf by shelf
    const own = pos.lines.filter((l) => l.shelf === 'liquid' || l.shelf === 'invest' || l.shelf === 'longterm');
    const group = (shelf, extra) => {
      const lines = own.filter((l) => l.shelf === shelf && (Math.abs(l.value) > 0.004 || shelf === 'liquid'));
      const total = FF.sum(lines, (l) => l.value) + (extra || 0);
      if (!lines.length && !(extra > 0.004)) return '';
      return '<div class="fz-shelf"><div class="fz-shelf-h"><span>' + SHELF_EMO[shelf] + ' ' + t('nw.shelf.' + shelf) + '</span><b class="num">' + M(total, { cur: base, whole: true }) + '</b></div>' +
        (shelf === 'invest' && extra > 0.004 ? lineRow('📊', '#8A5BC7', t('nw.holdings'), t('home.ownCount', { n: pos.holdings.length }), extra, base, 'data-act="tab" data-tab="invest"') : '') +
        lines.map((l) => { const k = Lg().kindOf(l.acc); return lineRow(k.icon, k.color, esc(accName(l.acc)), t('acct.kind.' + l.kind) + (l.acc && l.acc.cur !== base ? ' · ' + l.acc.cur : ''), l.value, base, l.acc ? 'data-act="account" data-id="' + esc(l.id) + '"' : ''); }).join('') + '</div>';
    };
    h += '<section class="card list-card fz-own"><div class="card-head"><h2>' + t('nw.ownT') + '</h2><b class="num fz-tot">' + M(pos.assets, { cur: base, whole: true }) + '</b></div>' + group('liquid') + group('invest', pos.invest - FF.sum(own.filter((l) => l.shelf === 'invest'), (l) => l.value)) + group('longterm') + '</section>';
    const owe = pos.lines.filter((l) => l.shelf === 'debtShort' || l.shelf === 'debtLong');
    h += '<section class="card list-card fz-owe"><div class="card-head"><h2>' + t('nw.oweT') + '</h2><b class="num fz-tot">' + M(pos.debts, { cur: base, whole: true }) + '</b></div>' +
      (owe.length ? owe.map((l) => { const k = Lg().kindOf(l.acc); return lineRow(k.icon, k.color, esc(accName(l.acc)), t(l.shelf === 'debtLong' ? 'nw.debtLong' : 'nw.debtShort'), -l.value, base, l.acc ? 'data-act="account" data-id="' + esc(l.id) + '"' : ''); }).join('') : '<p class="muted center pad">' + t('nw.noDebt') + '</p>') + '</section>';
    // the three numbers a planner would look at, each written out
    const mw = (v) => M(v, { cur: base, whole: true });
    let rr = '';
    if (r.buffer != null) rr += '<div class="fz-ratio"><div class="fz-ratio-h"><span>🛟 ' + t('nw.r.buffer') + '</span><b class="num">' + t('hl.months', { n: FF.i18n.num(r.buffer, 1) }) + '</b></div>' + eq('', frac(t('nw.r.reach') + ' ' + mw(pos.liquid), t('nw.r.month') + ' ' + mw(u.monthlyExpense))) + '<p class="row-s">' + t('nw.r.bufferB') + '</p></div>';
    if (r.debt != null) rr += '<div class="fz-ratio"><div class="fz-ratio-h"><span>💳 ' + t('nw.r.debt') + '</span><b class="num">' + pct(Math.min(r.debt, 9.99)) + '</b></div>' + eq('', frac(t('nw.owe') + ' ' + mw(pos.debts), t('nw.own') + ' ' + mw(pos.assets))) + '<p class="row-s">' + t('nw.r.debtB') + '</p></div>';
    if (r.invested != null) rr += '<div class="fz-ratio"><div class="fz-ratio-h"><span>🌱 ' + t('nw.r.invested') + '</span><b class="num">' + pct(FF.clamp(r.invested, 0, 9.99)) + '</b></div>' + eq('', frac(t('nw.shelf.invest') + ' ' + mw(pos.invest), t('nw.title') + ' ' + mw(pos.net))) + '<p class="row-s">' + t('nw.r.investedB') + '</p></div>';
    if (rr) h += '<section class="card"><div class="card-head"><h2>' + t('nw.ratios') + '</h2></div>' + rr + '</section>';
    h += '<button type="button" class="btn btn-soft btn-block" data-act="page" data-page="books">📒 ' + t('bk.open') + '</button>';
    return h;
  }
  function familyNet(base) {
    const fam = S().family(), list = visibleFamily();
    const parts = list.filter((x) => x.see).map((x) => ({ id: x.m.id, name: x.m.name, pf: x.m.pf }));
    const fp = B().familyPosition(parts, fam.hall, base);
    const hidden = list.filter((x) => !x.see);
    let h = '<section class="fz-hero"><div class="fz-hero-l">' + t('nw.famTitle', { family: esc(fam.name) }) + '</div><div class="fz-hero-num num">' + M(fp.net, { cur: base }) + '</div>' +
      '<div class="fz-hero-split"><div><span>' + t('nw.own') + '</span><b class="num">' + M(fp.assets, { cur: base, whole: true }) + '</b></div><div><span>' + t('nw.owe') + '</span><b class="num">' + M(fp.debts, { cur: base, whole: true }) + '</b></div></div></section>';
    const max = Math.max.apply(null, fp.who.map((w) => Math.abs(w.net)).concat([fp.hall, 1]));
    h += '<section class="card list-card"><div class="card-head"><h2>' + t('nw.famWho') + '</h2></div>' +
      fp.who.sort((a, b) => b.net - a.net).map((w) => { const mm = S().member(w.id); return '<div class="row static fz-who">' + FF.art.avatar(mm.avatar, 38) + '<span class="row-main"><span class="row-t">' + esc(w.name) + (w.id === S().state.meId ? ' <span class="chip">' + t('common.you') + '</span>' : '') + '</span><span class="fz-who-bar"><i style="width:' + (Math.max(0, w.net) / max * 100).toFixed(1) + '%"></i></span></span><span class="row-end"><span class="row-v num' + (w.net < 0 ? ' neg' : '') + '">' + M(w.net, { cur: base, whole: true }) + '</span></span></div>'; }).join('') +
      (fp.hall > 0.004 ? '<button type="button" class="row fz-who" data-act="page" data-page="hall"><span class="tx-ic emo" style="--c:#3D7FD1" aria-hidden="true">🏛️</span><span class="row-main"><span class="row-t">' + esc(fam.hall.name) + '</span><span class="fz-who-bar"><i style="width:' + (fp.hall / max * 100).toFixed(1) + '%;background:var(--sky)"></i></span></span><span class="row-end"><span class="row-v num">' + M(fp.hall, { cur: base, whole: true }) + '</span></span></button>' : '') +
      hidden.map((x) => '<div class="row static fz-who">' + FF.art.avatar(x.m.avatar, 38) + '<span class="row-main"><span class="row-t">' + esc(x.m.name) + '</span><span class="row-s">' + ic('lock', 12) + ' ' + t('nw.famPrivate') + '</span></span></div>').join('') + '</section>';
    const shelves = [['liquid', fp.liquid], ['invest', fp.invest], ['longterm', fp.longterm - fp.hall], ['hall', fp.hall]].filter((x) => x[1] > 0.004);
    const tot = FF.sum(shelves, (x) => x[1]) || 1;
    const COL = { liquid: '#E9AE2E', invest: '#8A5BC7', longterm: '#5D6B7E', hall: '#3D8FD6' };
    h += '<section class="card"><div class="card-head"><h2>' + t('nw.famWhere') + '</h2></div><div class="fz-stack" aria-hidden="true">' + shelves.map((x) => '<i style="flex:' + (x[1] / tot).toFixed(4) + ';background:' + COL[x[0]] + '"></i>').join('') + '</div>' +
      '<div class="alloc-legend">' + shelves.map((x) => '<div class="al-row"><span class="swatch" style="--c:' + COL[x[0]] + '"></span><span class="al-n">' + t('nw.shelf.' + x[0]) + '</span><span class="al-p num">' + pct(x[1] / tot) + '</span><span class="al-v num">' + M(x[1], { cur: base, whole: true }) + '</span></div>').join('') + '</div>' +
      (hidden.length ? '<p class="hint">' + ic('info', 14) + '<span>' + t('nw.famNote', { n: hidden.length, count: hidden.length }) + '</span></p>' : '') + '</section>';
    return h;
  }
  function afterNetworth(el) {
    drawNet(el);
    bindSeg(el, 'net', (v) => { st.net = v; });
    bindSeg(el, 'scope', (v) => { st.scope = v; });
  }

  /* =====================================================
     MONEY IN AND OUT (page)
     ===================================================== */
  function cashflowPage() {
    const pf = me().pf, base = pf.base, n = st.flow;
    const ms = B().months(pf, base, n);
    if (st.flowSel == null || st.flowSel >= n) st.flowSel = n - 1;
    const sel = ms[st.flowSel];
    let h = ui().segmented('flow', [{ v: 6, l: t('cf.6m') }, { v: 12, l: t('cf.12m') }], n, 'fz-seg-sm');
    h += '<section class="card"><div class="card-head"><h2>' + t('cf.title') + '</h2></div>' + FF.charts.flow(ms, { label: t('cf.title'), sel: st.flowSel, tap: true, height: 170 }) + flowLegend() + '<p class="hint">' + ic('focus', 14) + '<span>' + t('cf.tapHint') + '</span></p></section>';
    const used = ms.filter((x) => x.n);
    if (used.length) {
      const k = used.length;
      const inc = FF.sum(used, (x) => x.income), exp = FF.sum(used, (x) => x.expense);
      h += '<div class="fz-stats">' + stat(t('cf.avgIn'), M(inc / k, { cur: base, whole: true }), 'in') + stat(t('cf.avgOut'), M(exp / k, { cur: base, whole: true }), 'out') + stat(t('cf.avgKept'), M((inc - exp) / k, { cur: base, whole: true }), inc - exp >= 0 ? 'good' : 'bad', inc > 0 ? pct((inc - exp) / inc) : '') + '</div>';
    }
    const stm = B().statement(pf, base, FF.monthStart(sel.y, sel.m), Math.min(FF.monthEnd(sel.y, sel.m), FF.today()));
    h += '<section class="card fz-month"><div class="card-head"><h2>' + FF.i18n.monthYear(sel.y, sel.m) + '</h2>' + (stm.rate != null ? '<span class="chip ' + (stm.net >= 0 ? 'chip-brand' : '') + '">' + t(stm.net >= 0 ? 'cf.keptPct' : 'cf.overPct', { pct: pct(Math.abs(stm.rate)) }) + '</span>' : '') + '</div>';
    if (!stm.n) h += '<p class="muted center pad">' + t('cf.nothing') + '</p>';
    else {
      h += '<dl class="kv big"><div><dt><span class="dot" style="--c:var(--chart-1)"></span>' + t('home.moneyIn') + '</dt><dd class="num">' + M(stm.income, { cur: base }) + '</dd></div><div><dt><span class="dot" style="--c:var(--coral)"></span>' + t('home.moneyOut') + '</dt><dd class="num">' + M(stm.expense, { cur: base }) + '</dd></div>' +
        '<div class="fz-kept"><dt>' + t(stm.net >= 0 ? 'cf.kept' : 'cf.short') + '</dt><dd class="num ' + (stm.net >= 0 ? 'pos' : 'neg') + '">' + M(Math.abs(stm.net), { cur: base }) + '</dd></div></dl>';
      if (stm.rate != null) h += how('<p>' + t('cf.rateHow') + '</p>' + eq(t('hl.save.lhs'), frac(M(stm.income, { cur: base, whole: true }) + ' − ' + M(stm.expense, { cur: base, whole: true }), M(stm.income, { cur: base, whole: true })), pct(stm.rate)));
      const part = (title, list, total) => (list.length ? '<h3 class="sub-h">' + title + '</h3>' + list.map((c) => '<div class="fz-crow"><span class="tx-ic emo sm" style="--c:' + c.cat.color + '" aria-hidden="true">' + c.cat.icon + '</span><span class="fz-cr-main"><span class="fz-cr-top"><span class="fz-cr-n">' + t('cat.' + c.cat.id) + '</span><span class="fz-cr-v num">' + M(c.amt, { cur: base, whole: true }) + '</span></span><span class="fz-cr-bar"><i style="width:' + (c.pct * 100).toFixed(1) + '%;background:' + c.cat.color + '"></i></span></span><span class="fz-cr-p num">' + pct(c.pct) + '</span></div>').join('') : '');
      h += part(t('cf.from'), stm.incomeBy, stm.income) + part(t('home.whereWent'), stm.expenseBy, stm.expense);
    }
    return h + '</section>';
  }
  function afterCashflow(el) {
    bindSeg(el, 'flow', (v) => { st.flow = +v; st.flowSel = null; });
    const svg = el.querySelector('.fz-flow');
    if (svg) svg.addEventListener('click', (e) => { const r = e.target.closest('[data-i]'); if (!r) return; st.flowSel = +r.dataset.i; ui().sfx.tap(); FF.app.refresh(true); });
  }

  /* =====================================================
     SPENDING (page)
     ===================================================== */
  function spendingPage() {
    const pf = me().pf, base = pf.base, today = FF.today(), tp = FF.ymd(today);
    const q = FF.addMonths(tp.y, tp.m, st.spend);
    const asOf = st.spend === 0 ? today : FF.monthEnd(q.y, q.m);
    const sp = B().spending(pf, base, asOf);
    let h = '<div class="cal-head fz-monthnav"><button type="button" class="icon-btn" data-act="sp-month" data-d="-1" aria-label="' + esc(t('a11y.prevMonth')) + '">' + ic('chevL', 20) + '</button><div class="cal-title"><b>' + FF.i18n.monthYear(q.y, q.m) + '</b></div><button type="button" class="icon-btn" data-act="sp-month" data-d="1"' + (st.spend >= 0 ? ' disabled' : '') + ' aria-label="' + esc(t('a11y.nextMonth')) + '">' + ic('chevR', 20) + '</button></div>';
    h += '<section class="card fz-spend"><div class="fz-big num">' + M(sp.spent, { cur: base }) + '</div>';
    const bits = [];
    if (st.spend === 0 && sp.prevSame > 0) { const d = sp.spent - sp.prevSame; bits.push(FF.isZero(d) ? t('sp.sameAsLast') : t(d > 0 ? 'sp.moreThanLast' : 'sp.lessThanLast', { amount: '<b>' + M(Math.abs(d), { cur: base, whole: true }) + '</b>' })); }
    if (st.spend !== 0 && sp.prevFull > 0) { const d = sp.spent - sp.prevFull; bits.push(FF.isZero(d) ? t('sp.sameMonth') : t(d > 0 ? 'sp.moreMonth' : 'sp.lessMonth', { amount: '<b>' + M(Math.abs(d), { cur: base, whole: true }) + '</b>' })); }
    h += '<p class="fz-sub"><span>' + (bits[0] || t('sp.spentIn', { month: FF.i18n.monthYear(q.y, q.m) })) + '</span></p>';
    if (st.spend === 0 && sp.projected != null && sp.dom < sp.dim) h += paceBar(sp, base);
    h += '<div class="fz-stats three">' + stat(t('sp.perDay'), M(sp.perDay, { cur: base, whole: true })) + stat(t('sp.quiet'), String(sp.quietDays), '', t('sp.quietSub')) + stat(t('sp.usual'), sp.avg3 == null ? '–' : M(sp.avg3, { cur: base, whole: true })) + '</div></section>';
    // the month as a calendar: the darker the day, the more was spent
    const first = sp.from, lead = (FF.ymd(first).wd + 6) % 7;
    const maxDay = Math.max.apply(null, Object.keys(sp.cal).map((k) => sp.cal[k]).concat([1]));
    h += '<section class="card cal-card fz-heat"><div class="card-head"><h2>' + t('sp.calT') + '</h2></div><div class="cal-grid" role="grid">' + FF.i18n.weekdaysNarrow().map((w) => '<span class="cal-wd">' + esc(w) + '</span>').join('');
    for (let k = 0; k < lead; k++) h += '<span class="cal-cell blank"></span>';
    for (let d = 1; d <= sp.dim; d++) {
      const day = first + d - 1, v = sp.cal[day] || 0;
      const lvl = v <= 0 ? 0 : 1 + Math.min(3, Math.floor((v / maxDay) * 3.999));
      h += '<button type="button" class="cal-cell fz-hc l' + lvl + (day === today ? ' today' : '') + (st.spendDay === day ? ' sel' : '') + (day > asOf ? ' later' : '') + '" data-act="sp-day" data-day="' + day + '" aria-label="' + esc(FF.i18n.date(day) + (v > 0 ? ': ' + M(v, { cur: base }) : '')) + '"><span class="cal-d">' + d + '</span></button>';
    }
    h += '</div><div class="fz-heat-leg" aria-hidden="true"><span>' + t('sp.less') + '</span><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>' + t('sp.more') + '</span></div>';
    if (st.spendDay != null && st.spendDay >= sp.from && st.spendDay <= FF.monthEnd(q.y, q.m)) {
      const list = Lg().recent(pf, 200, (x) => x.type === 'expense' && x.day === st.spendDay);
      h += '<div class="cal-list"><div class="day-head"><span>' + FF.i18n.dateLong(st.spendDay) + '</span><span class="num">' + M(sp.cal[st.spendDay] || 0, { cur: base }) + '</span></div>' + (list.length ? list.map((tx) => FF.manage.recordRow(tx, base)).join('') : '<p class="muted center pad">' + t('sp.noneDay') + '</p>') + '</div>';
    }
    h += '</section>';
    const cats = sp.cats.filter((c) => c.amt > 0 || (c.avg3 || 0) > 0);
    if (cats.length) h += '<section class="card"><div class="card-head"><h2>' + t('sp.catsT') + '</h2></div><p class="hint fz-tickhint"><b class="fz-cr-tick demo"></b><span>' + t('sp.tickHint') + '</span></p><div class="fz-catrows">' + cats.map((c) => catRow(c, sp, base)).join('') + '</div></section>';
    if (sp.shops.length) h += '<section class="card list-card"><div class="card-head"><h2>' + t('sp.shopsT') + '</h2></div>' + sp.shops.map((s, i) => '<div class="row static"><span class="fz-rank">' + (i + 1) + '</span><span class="row-main"><span class="row-t">' + esc(s.name) + '</span><span class="row-s">' + Lg().catOf(s.cat).icon + ' ' + t('sp.times', { n: s.n, count: s.n }) + '</span></span><span class="row-end"><span class="row-v num">' + M(s.amt, { cur: base, whole: true }) + '</span></span></div>').join('') + '</section>';
    if (sp.weekdays.some((v) => v > 0)) {
      const mx = Math.max.apply(null, sp.weekdays.concat([1])), wn = FF.i18n.weekdaysNarrow(), top = sp.weekdays.indexOf(Math.max.apply(null, sp.weekdays));
      h += '<section class="card"><div class="card-head"><h2>' + t('sp.weekT') + '</h2></div><div class="fz-week" aria-hidden="true">' + sp.weekdays.map((v, i) => '<span class="' + (i === top ? 'top' : '') + '"><i style="height:' + Math.max(4, v / mx * 100).toFixed(0) + '%"></i><b>' + esc(wn[i]) + '</b></span>').join('') + '</div><p class="fz-line">' + t('sp.weekB', { amount: '<b>' + M(sp.weekdays[top], { cur: base, whole: true }) + '</b>', day: '<b>' + FF.i18n.dateLong(FF.fromYMD(2026, 6, 1) + top).split(/[ ,]/)[0].replace(/^วัน/, '') + '</b>' }) + '</p></section>';
    }
    if (sp.biggest.length) h += '<section class="card list-card"><div class="card-head"><h2>' + t('sp.bigT') + '</h2></div>' + sp.biggest.map((b) => FF.manage.recordRow(b.tx, base)).join('') + '</section>';
    if (!(sp.spent > 0)) h += '<p class="muted center pad">' + t('sp.none') + '</p>';
    return h;
  }
  A['sp-month'] = (el) => { st.spend = Math.min(0, st.spend + (+el.dataset.d)); st.spendDay = null; ui().sfx.tap(); FF.app.refresh(true); };
  A['sp-day'] = (el) => { const d = +el.dataset.day; st.spendDay = st.spendDay === d ? null : d; ui().sfx.tap(); FF.app.refresh(true); };

  /* =====================================================
     THE BOOKS (page) — the same numbers, laid out the way an
     accountant would, with the plain words first
     ===================================================== */
  const AT = ['today', 'month', 'year'];
  const atDay = (k) => { const p = FF.ymd(FF.today()); return k === 'month' ? FF.monthStart(p.y, p.m) - 1 : k === 'year' ? FF.fromYMD(p.y, 1, 1) - 1 : FF.today(); };
  const PERIODS = ['month', 'lastMonth', 'year', 'lastYear', '12m'];
  function periodRange(k) {
    const today = FF.today(), p = FF.ymd(today);
    if (k === 'lastMonth') { const q = FF.addMonths(p.y, p.m, -1); return [FF.monthStart(q.y, q.m), FF.monthEnd(q.y, q.m)]; }
    if (k === 'year') return [FF.fromYMD(p.y, 1, 1), today];
    if (k === 'lastYear') return [FF.fromYMD(p.y - 1, 1, 1), FF.fromYMD(p.y - 1, 12, 31)];
    if (k === '12m') return [today - 364, today];
    return [FF.monthStart(p.y, p.m), today];
  }
  const term = (plain, formal) => plain + (st.terms ? '<span class="fz-term">' + formal + '</span>' : '');
  const bRow = (label, value, base, cls) => '<div class="fz-brow ' + (cls || '') + '"><span>' + label + '</span><b class="num">' + (value == null ? '' : M(value, { cur: base })) + '</b></div>';
  function booksPage() {
    const m = me(), pf = m.pf, base = pf.base;
    const fam = S().family(), canFam = fam && fam.members.length > 1;
    let h = '<p class="lead">' + t('bk.lead') + '</p>' + ui().segmented('books', [{ v: 'own', l: t('bk.tab.own') }, { v: 'flow', l: t('bk.tab.flow') }], st.books);
    if (st.books === 'own') {
      const famOn = st.scope === 'family' && canFam;
      h += scopeSeg();
      h += '<div class="chips fz-chips">' + AT.map((k) => '<button type="button" class="chip-btn sm' + (st.booksAt === k ? ' on' : '') + '" data-act="bk-at" data-v="' + k + '">' + t('bk.at.' + k) + '</button>').join('') + '</div>';
      const day = atDay(st.booksAt);
      let pos, hall = 0;
      if (famOn) { const parts = visibleFamily().filter((x) => x.see).map((x) => ({ id: x.m.id, name: x.m.name, pf: x.m.pf })); pos = B().familyPosition(parts, fam.hall, base, day); hall = pos.hall; } else pos = B().position(pf, base, day);
      h += '<section class="card fz-book"><div class="fz-book-h"><h2>' + term(t('bk.own.t'), t('bk.own.f')) + '</h2><span class="row-s">' + (famOn ? esc(fam.name) : esc(m.name)) + ' · ' + t('bk.asAt', { date: FF.i18n.date(day) }) + '</span></div>' +
        '<h3 class="fz-book-sec">' + term(t('nw.ownT'), t('bk.f.assets')) + '</h3>' +
        bRow(term(t('nw.shelf.liquid'), t('bk.f.current')), pos.liquid, base) + bRow(term(t('nw.shelf.invest'), t('bk.f.invest')), pos.invest, base) + bRow(term(t('nw.shelf.longterm'), t('bk.f.noncurrent')), pos.longterm - hall, base) + (famOn && hall > 0.004 ? bRow(term(t('nw.shelf.hall'), t('bk.f.joint')), hall, base) : '') +
        bRow(t('bk.totalOwn'), pos.assets, base, 'total') +
        '<h3 class="fz-book-sec">' + term(t('nw.oweT'), t('bk.f.liab')) + '</h3>' +
        bRow(term(t('nw.debtShort'), t('bk.f.currentL')), pos.debtShort, base) + bRow(term(t('nw.debtLong'), t('bk.f.noncurrentL')), pos.debtLong, base) + bRow(t('bk.totalOwe'), pos.debts, base, 'total') +
        bRow(term(t('nw.title'), t('bk.f.equity')), pos.net, base, 'grand') +
        how('<p>' + t('bk.own.how') + '</p><div class="fz-eq"><span class="fz-eq-l">' + t('nw.title') + '</span><span class="fz-eq-s">=</span><span>' + t('nw.own') + ' − ' + t('nw.owe') + '</span></div><div class="fz-eq"><b class="num">' + M(pos.net, { cur: base, whole: true }) + '</b><span class="fz-eq-s">=</span><span class="num">' + M(pos.assets, { cur: base, whole: true }) + ' − ' + M(pos.debts, { cur: base, whole: true }) + '</span></div>') + '</section>';
    } else {
      h += '<div class="chips fz-chips">' + PERIODS.map((k) => '<button type="button" class="chip-btn sm' + (st.booksPeriod === k ? ' on' : '') + '" data-act="bk-period" data-v="' + k + '">' + t('bk.p.' + k) + '</button>').join('') + '</div>';
      const r = periodRange(st.booksPeriod), stm = B().statement(pf, base, r[0], r[1]);
      h += '<section class="card fz-book"><div class="fz-book-h"><h2>' + term(t('bk.flow.t'), t('bk.flow.f')) + '</h2><span class="row-s">' + esc(m.name) + ' · ' + FF.i18n.date(r[0]) + ' – ' + FF.i18n.date(r[1]) + '</span></div>';
      if (!stm.n && FF.isZero(stm.dividends) && FF.isZero(stm.realized)) h += '<p class="muted center pad">' + t('cf.nothing') + '</p>';
      else {
        h += '<h3 class="fz-book-sec">' + term(t('home.moneyIn'), t('bk.f.income')) + '</h3>' + stm.incomeBy.map((c) => bRow(c.cat.icon + ' ' + t('cat.' + c.cat.id), c.amt, base)).join('') + bRow(t('bk.totalIn'), stm.income, base, 'total') +
          '<h3 class="fz-book-sec">' + term(t('home.moneyOut'), t('bk.f.expenses')) + '</h3>' + stm.expenseBy.map((c) => bRow(c.cat.icon + ' ' + t('cat.' + c.cat.id), c.amt, base)).join('') + bRow(t('bk.totalOut'), stm.expense, base, 'total') +
          bRow(term(t(stm.net >= 0 ? 'cf.kept' : 'cf.short'), t(stm.net >= 0 ? 'bk.f.surplus' : 'bk.f.deficit')), Math.abs(stm.net), base, 'grand ' + (stm.net >= 0 ? 'pos' : 'neg')) +
          (stm.rate != null ? '<div class="fz-brow note"><span>' + t('hl.save.lhs') + '</span><b class="num">' + pct(stm.rate) + '</b></div>' : '');
        if (!FF.isZero(stm.dividends) || !FF.isZero(stm.realized) || !FF.isZero(stm.fees)) {
          h += '<h3 class="fz-book-sec">' + term(t('bk.invT'), t('bk.f.other')) + '</h3>' + bRow(t('ret.divs'), stm.dividends, base) + bRow(t('bk.realized'), stm.realized, base) + bRow(t('ret.fees'), -stm.fees, base) + '<p class="row-s fz-book-note">' + t('bk.invNote') + '</p>';
        }
      }
      h += '</section>';
    }
    h += '<div class="set-row fz-termrow"><span class="row-main"><span class="row-t">' + t('bk.terms') + '</span><span class="row-s">' + t('bk.termsSub') + '</span></span>' + ui().toggle(st.terms, 'data-act="bk-terms" aria-label="' + esc(t('bk.terms')) + '"') + '</div>';
    h += '<button type="button" class="btn btn-soft btn-block" data-act="bk-export">' + ic('download', 18) + t('bk.export') + '</button><p class="foot-note">' + ic('info', 14) + '<span>' + t('bk.exportNote') + '</span></p>';
    return h;
  }
  function afterBooks(el) {
    bindSeg(el, 'books', (v) => { st.books = v; });
    bindSeg(el, 'scope', (v) => { st.scope = v; });
  }
  A['bk-at'] = (el) => { st.booksAt = el.dataset.v; ui().sfx.tap(); FF.app.refresh(true); };
  A['bk-period'] = (el) => { st.booksPeriod = el.dataset.v; ui().sfx.tap(); FF.app.refresh(true); };
  A['bk-terms'] = () => { st.terms = !st.terms; ui().sfx.tap(); FF.app.refresh(true); };
  /* the statement on screen as a spreadsheet file (opens in Excel, Numbers, Google Sheets) */
  A['bk-export'] = async (el) => {
    if (el.classList.contains('busy')) return;
    const m = me(), pf = m.pf, base = pf.base, L = FF.kit.csvLine, N = FF.kit.csvNum;
    const rows = [L(['Family Finance', m.name, base])];
    let name;
    if (st.books === 'own') {
      const day = atDay(st.booksAt), pos = B().position(pf, base, day);
      name = 'family-finance-position-' + FF.iso(day) + '.csv';
      rows.push(L([t('bk.own.f'), FF.iso(day)]), '', L([t('bk.f.assets'), '', base]));
      pos.lines.filter((l) => l.shelf !== 'debtShort' && l.shelf !== 'debtLong').forEach((l) => rows.push(L([t('nw.shelf.' + l.shelf), accName(l.acc), N(l.value)])));
      pos.holdings.forEach((x) => rows.push(L([t('nw.shelf.invest'), x.a ? D().displayName(x.a, FF.i18n.lang) + ' (' + x.sym + ')' : x.sym, N(x.value)])));
      rows.push(L([t('bk.totalOwn'), '', N(pos.assets)]), '', L([t('bk.f.liab'), '', base]));
      pos.lines.filter((l) => l.shelf === 'debtShort' || l.shelf === 'debtLong').forEach((l) => rows.push(L([t(l.shelf === 'debtLong' ? 'nw.debtLong' : 'nw.debtShort'), accName(l.acc), N(-l.value)])));
      rows.push(L([t('bk.totalOwe'), '', N(pos.debts)]), '', L([t('bk.f.equity'), '', N(pos.net)]));
    } else {
      const r = periodRange(st.booksPeriod), stm = B().statement(pf, base, r[0], r[1]);
      name = 'family-finance-income-' + FF.iso(r[0]) + '_' + FF.iso(r[1]) + '.csv';
      rows.push(L([t('bk.flow.f'), FF.iso(r[0]), FF.iso(r[1])]), '', L([t('bk.f.income'), '', base]));
      stm.incomeBy.forEach((c) => rows.push(L(['', t('cat.' + c.cat.id), N(c.amt)])));
      rows.push(L([t('bk.totalIn'), '', N(stm.income)]), '', L([t('bk.f.expenses'), '', base]));
      stm.expenseBy.forEach((c) => rows.push(L(['', t('cat.' + c.cat.id), N(c.amt)])));
      rows.push(L([t('bk.totalOut'), '', N(stm.expense)]), '', L([t(stm.net >= 0 ? 'bk.f.surplus' : 'bk.f.deficit'), '', N(stm.net)]), '', L([t('ret.divs'), '', N(stm.dividends)]), L([t('bk.realized'), '', N(stm.realized)]), L([t('ret.fees'), '', N(-stm.fees)]));
    }
    el.classList.add('busy');
    const res = await saveFile(name, '﻿' + rows.join('\r\n'), 'text/csv'); // the first character tells Excel the file is UTF-8 (Chinese and Thai show correctly)
    el.classList.remove('busy');
    if (res === 'saved' || res === 'shared') ui().toast(t('bkp.saved'), { icon: 'check', tone: 'success' });
    else if (res === 'failed') ui().toast(t('bkp.failed'), { icon: 'info' });
  };

  FF.insights = { tab, afterTab, healthPage, networthPage, afterNetworth, cashflowPage, afterCashflow, spendingPage, booksPage, afterBooks, healthCard, ownOwe, state: st, PIL, periodRange };
})(window);
