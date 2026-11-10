/* ============================================================
   Family Finance — screens-goals.js
   Savings goals (a target, a date, what has been set aside) and
   the planner tools: growth, reaching a target, a loan paid off,
   "enough", and a little invested every month.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, C = () => FF.calc, D = () => FF.data, B = () => FF.books, Lg = () => FF.ledger, P = () => FF.plan;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const ui = () => FF.ui;
  const M = (v, o) => FF.i18n.money(v, o && o.cur, o);
  const A = FF.actions = FF.actions || {};
  const K = () => FF.kit;
  const num = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const me = () => S().me();
  const goals = () => S().extras().goals;

  /* =====================================================
     SAVINGS GOALS
     ===================================================== */
  const EMOS = ['🎯', '🏖️', '✈️', '🏠', '🚗', '🎓', '💍', '👶', '🛟', '💻', '📱', '🎁', '🏍️', '🐶', '🎉', '🧧'];
  const ringOf = (g, p, size) => '<span class="fz-goal-ring" style="width:' + size + 'px;height:' + size + 'px">' + FF.charts.ring(p.pct, { size, th: Math.round(size / 9), color: p.done ? 'var(--sun-2)' : 'var(--brand)' }) + '<span class="fz-ring-c emo">' + esc(g.emo || '🎯') + '</span></span>';
  function goalLine(g, p) {
    if (p.done) return '🎉 ' + t('goal.done');
    if (p.late) return t('goal.late', { amount: M(p.left, { cur: g.cur, whole: true }) });
    if (p.perMonth != null) return t('goal.perMonth', { amount: '<b>' + M(p.perMonth, { cur: g.cur, whole: true }) + '</b>', date: FF.i18n.dateShort(g.due) });
    if (p.eta != null) return t('goal.eta', { date: FF.i18n.monthYear(FF.ymd(p.eta).y, FF.ymd(p.eta).m) });
    return t('goal.left', { amount: M(p.left, { cur: g.cur, whole: true }) });
  }
  function goalCard(g) {
    const p = P().goal(g, me().pf);
    return '<button type="button" class="card fz-goal' + (p.done ? ' done' : '') + '" data-act="goal-open" data-id="' + esc(g.id) + '">' + ringOf(g, p, 64) +
      '<span class="row-main"><span class="row-t">' + esc(g.name || t('goal.unnamed')) + '</span><span class="fz-goal-n num">' + M(p.saved, { cur: g.cur, whole: true }) + ' <span class="muted">' + t('goal.of', { amount: M(p.target, { cur: g.cur, whole: true }) }) + '</span></span>' +
      '<span class="bar"><span style="width:' + (p.pct * 100).toFixed(1) + '%"></span></span><span class="row-s">' + goalLine(g, p) + '</span></span><span class="fz-goal-p num">' + FF.i18n.pct(p.pct, { dp: 0 }) + '</span></button>';
  }
  function page() {
    const list = goals(), pf = me().pf, base = pf.base;
    if (!list.length) return FF.money.emptyState('sprout', t('goal.empty.t'), t('goal.empty.b'), '<button type="button" class="btn btn-primary" data-act="goal-new">' + ic('plus', 18) + t('goal.add') + '</button>') + ideas();
    const ps = list.map((g) => ({ g, p: P().goal(g, pf) }));
    const saved = FF.sum(ps, (x) => Math.min(x.p.saved, x.p.target || x.p.saved) * D().fx(x.g.cur, base)), target = FF.sum(ps, (x) => x.p.target * D().fx(x.g.cur, base));
    let h = '<section class="fz-hero fz-goal-hero"><div class="fz-hero-l">' + t('goal.heroL') + '</div><div class="fz-hero-num num">' + M(saved, { cur: base, whole: true }) + '<small>' + t('goal.of', { amount: M(target, { cur: base, whole: true }) }) + '</small></div>' +
      '<span class="fz-hero-bar"><i style="width:' + (target > 0 ? FF.clamp(saved / target, 0, 1) * 100 : 0).toFixed(1) + '%"></i></span></section>';
    h += ps.sort((a, b) => (a.p.done ? 1 : 0) - (b.p.done ? 1 : 0) || (a.g.due || 1e9) - (b.g.due || 1e9)).map((x) => goalCard(x.g)).join('');
    h += '<button type="button" class="btn btn-primary btn-block" data-act="goal-new">' + ic('plus', 18) + t('goal.add') + '</button><p class="foot-note">' + ic('lock', 14) + '<span>' + t('goal.private') + '</span></p>';
    return h;
  }
  const IDEAS = [['🛟', 'emergency'], ['✈️', 'trip'], ['🏠', 'home'], ['🎓', 'school']];
  const ideas = () => '<h3 class="group-h">' + t('goal.ideasT') + '</h3><div class="fz-tiles">' + IDEAS.map((x) => K().tile({ emo: x[0], color: '#E9AE2E', title: t('goal.idea.' + x[1]), attrs: 'data-act="goal-new" data-emo="' + x[0] + '" data-name="' + esc(t('goal.idea.' + x[1])) + '"' })).join('') + '</div>';
  /* a row of goals on Home (nothing when there are none) */
  function homeCard() {
    const list = goals();
    if (!list.length) return '';
    const pf = me().pf;
    return '<section class="fz-goalstrip"><div class="sec-head"><h2>' + t('goal.title') + '</h2><button type="button" class="link-btn" data-act="page" data-page="savings">' + t('home.seeAllShort') + '</button></div><div class="fz-hscroll">' +
      list.map((g) => { const p = P().goal(g, pf); return '<button type="button" class="fz-goalchip' + (p.done ? ' done' : '') + '" data-act="goal-open" data-id="' + esc(g.id) + '">' + ringOf(g, p, 52) + '<span class="fz-gc-n">' + esc(g.name || t('goal.unnamed')) + '</span><span class="fz-gc-v num">' + FF.i18n.pct(p.pct, { dp: 0 }) + ' · ' + M(p.saved, { cur: g.cur, whole: true, compact: true }) + '</span></button>'; }).join('') +
      '<button type="button" class="fz-goalchip add" data-act="goal-new"><span class="fz-goal-ring add">' + ic('plus', 22) + '</span><span class="fz-gc-n">' + t('goal.add') + '</span></button></div></section>';
  }

  /* ---- one goal: put money aside, take some out, its history ---- */
  function openGoal(id) {
    const st = { id, amt: '' };
    return ui().openSheet({
      className: 'sheet-tall fz-goal-sheet', label: t('goal.title'), state: st,
      render: () => {
        const g = goals().find((x) => x.id === id);
        if (!g) return K().sheetHead(t('goal.title'));
        const pf = me().pf, p = P().goal(g, pf);
        const acc = p.linked ? pf.accounts.find((a) => a.id === g.acct) : null;
        let f = K().sheetHead(esc(g.name || t('goal.unnamed')));
        f += '<div class="fz-goal-top">' + ringOf(g, p, 132) + '<div class="fz-goal-big num">' + M(p.saved, { cur: g.cur }) + '</div><p class="muted">' + t('goal.of', { amount: M(p.target, { cur: g.cur }) }) + ' · ' + FF.i18n.pct(p.pct, { dp: 0 }) + '</p><p class="fz-line ' + (p.done ? 'good' : '') + '">' + goalLine(g, p) + '</p></div>';
        if (acc) f += '<p class="hint">' + ic('info', 14) + '<span>' + t('goal.linkedB', { name: '<b>' + esc(K().accName(acc)) + '</b>' }) + '</span></p><button type="button" class="btn btn-soft btn-block" data-go-acct="' + esc(acc.id) + '">' + Lg().kindOf(acc).icon + ' ' + esc(K().accName(acc)) + '</button>';
        else {
          f += '<label class="amt-wrap t-income"><span class="amt-cur">' + g.cur + '</span><input id="g-amt" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' + esc(st.amt) + '" aria-label="' + esc(t('trade.amount')) + '"></label>' +
            '<div class="chips center">' + quick(g).map((v) => '<button type="button" class="chip-btn sm" data-q="' + v + '">+' + FF.i18n.num(v, 0) + '</button>').join('') + '</div><p class="form-err" id="g-err" role="alert"></p>' +
            '<div class="btn-row"><button type="button" class="btn btn-primary" id="g-put">' + ic('plus', 18) + t('goal.put') + '</button><button type="button" class="btn btn-soft" id="g-take"' + (p.saved > 0 ? '' : ' disabled') + '>' + ic('minus', 18) + t('goal.take') + '</button></div>';
          const puts = (g.puts || []).slice().sort((a, b) => b.day - a.day).slice(0, 6);
          if (puts.length) f += '<h3 class="sub-h">' + t('goal.history') + '</h3><div class="card list-card fz-puts">' + puts.map((x) => '<div class="row static"><span class="tx-ic emo sm" style="--c:' + (x.amt >= 0 ? '#2F9A4C' : '#E0563F') + '" aria-hidden="true">' + (x.amt >= 0 ? '➕' : '➖') + '</span><span class="row-main"><span class="row-t">' + t(x.amt >= 0 ? 'goal.putRow' : 'goal.takeRow') + '</span><span class="row-s">' + FF.i18n.date(x.day) + '</span></span><span class="row-end"><span class="row-v num ' + (x.amt >= 0 ? 'pos' : '') + '">' + FF.i18n.money(x.amt, g.cur, { sign: true }) + '</span></span></div>').join('') + '</div>';
          if (p.perMonth != null && !p.done) f += K().how('<p>' + t('goal.how') + '</p>' + K().eq(t('goal.howL'), K().frac(M(p.left, { cur: g.cur, whole: true }), t('goal.howMonths', { n: Math.max(1, Math.ceil(p.daysLeft / 30.4375)) })), M(p.perMonth, { cur: g.cur, whole: true })));
        }
        f += '<div class="btn-row fz-goal-foot"><button type="button" class="btn btn-ghost" id="g-edit">' + ic('edit', 18) + t('common.edit') + '</button><button type="button" class="btn btn-ghost fz-del" id="g-del">' + ic('trash', 18) + t('common.delete') + '</button></div>';
        return f;
      },
      onRender: (body, api) => {
        const $ = (q) => body.querySelector(q);
        const g = goals().find((x) => x.id === id);
        $('[data-close]').addEventListener('click', () => api.close());
        if (!g) return;
        const amt = $('#g-amt');
        if (amt) amt.addEventListener('input', () => { st.amt = amt.value; $('#g-err').textContent = ''; });
        body.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { st.amt = String(FF.round2(num(st.amt) + (+b.dataset.q))); amt.value = st.amt; ui().sfx.tap(); }));
        const move = (sign) => {
          const v = num(st.amt);
          if (!(v > 0)) { $('#g-err').textContent = t('trade.err.amt'); ui().haptic(); return; }
          const res = S().putSaving(id, sign * v);
          if (!res) return;
          st.amt = '';
          ui().sfx.pop(); ui().haptic();
          if (res.reached) cheer(res);
          else ui().toast(t(sign > 0 ? 'goal.putDone' : 'goal.takeDone', { amount: '<b>' + FF.i18n.money(v, g.cur) + '</b>', name: esc(g.name || t('goal.unnamed')) }), { icon: g.emo || '🎯', tone: 'success' });
          if (!api.closing) api.render();
        };
        if ($('#g-put')) $('#g-put').addEventListener('click', () => move(1));
        if ($('#g-take')) $('#g-take').addEventListener('click', () => move(-1));
        const ga = $('[data-go-acct]');
        if (ga) ga.addEventListener('click', () => { api.close(true); FF.app.push('account', { id: ga.dataset.goAcct }); });
        $('#g-edit').addEventListener('click', () => { api.close(true); editGoal({ edit: g }); });
        const del = $('#g-del');
        del.addEventListener('click', () => {
          if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.innerHTML = ic('trash', 18) + t('tx.deleteSure'); ui().haptic(); return; }
          const gone = S().deleteSaving(id); api.close(true);
          ui().toast(t('goal.deleted'), { icon: 'trash', action: t('common.undo'), actionIcon: 'undo', onAction: () => S().restoreSaving(gone) });
        });
      }
    });
  }
  /* sensible "+ amounts" for the goal's size */
  function quick(g) {
    const s = g.target >= 50000 ? 1000 : g.target >= 5000 ? 100 : g.target >= 500 ? 50 : 10;
    return [s, s * 2, s * 5];
  }
  function cheer(res) {
    const g = res.g, done = res.reached === 4;
    ui().sfx.success();
    ui().confetti({ n: done ? 150 : 70 });
    ui().toast(done ? t('goal.cheerDone', { name: '<b>' + esc(g.name || t('goal.unnamed')) + '</b>' }) : t('goal.cheer', { pct: res.reached * 25, name: '<b>' + esc(g.name || t('goal.unnamed')) + '</b>' }), { icon: done ? '🏆' : g.emo || '🎯', tone: 'success', duration: 5200 });
  }

  /* ---- add / change a goal ---- */
  function editGoal(o) {
    o = o || {};
    const ed = o.edit, pf = me().pf;
    const st = { name: o.name || '', emo: o.emo || '🎯', target: o.target ? String(o.target) : '', due: '', acct: null, start: '' };
    if (ed) Object.assign(st, { editId: ed.id, name: ed.name, emo: ed.emo || '🎯', target: String(ed.target), due: ed.due != null ? FF.iso(ed.due) : '', acct: ed.acct || null });
    return ui().openSheet({
      className: 'sheet-tall fz-goal-edit', label: t(ed ? 'goal.editT' : 'goal.add'), state: st,
      render: () => {
        const everyday = pf.accounts.filter((a) => !Lg().isInvest(pf, a) && a.kind !== 'credit' && a.kind !== 'loan');
        let f = K().sheetHead(t(st.editId ? 'goal.editT' : 'goal.add'));
        f += '<div class="fz-emo-pick" role="radiogroup" aria-label="' + esc(t('goal.pickEmo')) + '">' + EMOS.map((e) => '<button type="button" class="fz-emo' + (e === st.emo ? ' on' : '') + '" data-emo="' + e + '" role="radio" aria-checked="' + (e === st.emo) + '">' + e + '</button>').join('') + '</div>';
        f += '<div class="form"><label class="field"><span class="f-l">' + t('goal.name') + '</span><input id="ge-name" maxlength="40" autocomplete="off" placeholder="' + esc(t('goal.namePh')) + '" value="' + esc(st.name) + '"></label>' +
          '<label class="field"><span class="f-l">' + t('goal.target', { cur: pf.base }) + '</span><input id="ge-target" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(st.target) + '"></label>' +
          '<label class="field"><span class="f-l">' + t('goal.due') + '</span><input id="ge-due" type="date" min="' + FF.iso(FF.today() + 1) + '" value="' + esc(st.due) + '"><span class="f-hint">' + t('goal.dueHint') + '</span></label>';
        if (!st.editId && !st.acct) f += '<label class="field"><span class="f-l">' + t('goal.start') + '</span><input id="ge-start" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(st.start) + '"></label>';
        if (everyday.length) f += '<div class="field"><span class="f-l">' + t('goal.link') + '</span><div class="chips acct-chips"><button type="button" class="chip-btn' + (!st.acct ? ' on' : '') + '" data-gacct="">' + t('goal.linkNone') + '</button>' + everyday.map((a) => '<button type="button" class="chip-btn' + (a.id === st.acct ? ' on' : '') + '" data-gacct="' + esc(a.id) + '"><span aria-hidden="true">' + Lg().kindOf(a).icon + '</span>' + esc(K().accName(a)) + '</button>').join('') + '</div><span class="f-hint">' + t('goal.linkHint') + '</span></div>';
        f += '</div><p class="summary" id="ge-sum" aria-live="polite"></p><p class="form-err" id="ge-err" role="alert"></p><button type="button" class="btn btn-primary btn-block btn-lg" id="ge-go">' + ic('check', 20) + '<span>' + t('common.save') + '</span></button>';
        return f;
      },
      onRender: (body, api) => {
        const $ = (q) => body.querySelector(q);
        const keep = () => { st.name = $('#ge-name').value; st.target = $('#ge-target').value; st.due = $('#ge-due').value; if ($('#ge-start')) st.start = $('#ge-start').value; };
        const update = () => {
          keep();
          const target = num(st.target), due = st.due ? FF.fromISO(st.due) : null, start = st.acct ? 0 : num(st.start);
          let s = '';
          if (target > 0 && due != null && due > FF.today() && !st.editId) { const months = Math.max(1, Math.ceil((due - FF.today()) / 30.4375)); s = t('goal.sum', { amount: '<b>' + M(Math.max(0, target - start) / months, { cur: pf.base, whole: true }) + '</b>', n: months }); }
          $('#ge-sum').innerHTML = s; $('#ge-err').textContent = '';
        };
        $('[data-close]').addEventListener('click', () => api.close());
        body.querySelectorAll('input').forEach((i) => i.addEventListener('input', update));
        body.querySelectorAll('[data-emo]').forEach((b) => b.addEventListener('click', () => { st.emo = b.dataset.emo; body.querySelectorAll('[data-emo]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); ui().sfx.tap(); }));
        body.querySelectorAll('[data-gacct]').forEach((b) => b.addEventListener('click', () => { keep(); st.acct = b.dataset.gacct || null; ui().sfx.tap(); api.render(); }));
        $('#ge-go').addEventListener('click', () => {
          keep();
          const err = (k) => { const e = $('#ge-err'); e.textContent = t(k); ui().haptic(); };
          const target = num(st.target);
          if (!st.name.trim()) return err('goal.err.name');
          if (!(target > 0)) return err('goal.err.target');
          const g = { name: st.name.trim(), emo: st.emo, target, cur: pf.base, due: st.due ? FF.fromISO(st.due) : null, acct: st.acct || null };
          api.close(true); ui().sfx.pop(); ui().haptic();
          if (st.editId) { S().updateSaving(st.editId, g); ui().toast(t('common.saved'), { icon: 'check', tone: 'success' }); }
          else { const ng = S().addSaving(Object.assign(g, { start: st.acct ? 0 : num(st.start) })); ui().toast(t('goal.added', { name: '<b>' + esc(ng.name) + '</b>' }), { icon: ng.emo, tone: 'success', action: t('common.view'), onAction: () => openGoal(ng.id) }); }
        });
        update();
      }
    });
  }
  A['goal-new'] = (el) => editGoal({ emo: el && el.dataset.emo, name: el && el.dataset.name });
  A['goal-open'] = (el) => openGoal(el.dataset.id);

  /* =====================================================
     THE PLANNER
     ===================================================== */
  const TOOL_ORDER = ['grow', 'target', 'loan', 'freedom', 'dca'];
  const TOOL_EMO = { grow: '🌱', target: '🏁', loan: '🏦', freedom: '🏝️', dca: '🗓️' };
  const TOOL_COL = { grow: '#2F9A4C', target: '#E9AE2E', loan: '#3D8FD6', freedom: '#1F9E91', dca: '#8A5BC7' };
  function plannerPage() {
    return '<p class="lead">' + t('plan.lead') + '</p><section class="card list-card">' + TOOL_ORDER.map((k) => '<button type="button" class="row menu-row" data-act="tool" data-k="' + k + '"><span class="mr-ic" style="--c:' + TOOL_COL[k] + '"><span class="emo">' + TOOL_EMO[k] + '</span></span><span class="row-main"><span class="row-t">' + t('plan.' + k + '.t') + '</span><span class="row-s">' + t('plan.' + k + '.s') + '</span></span>' + ic('chevR', 18) + '</button>').join('') + '</section><p class="foot-note">' + ic('info', 14) + '<span>' + t('plan.note') + '</span></p>';
  }
  A.tool = (el) => FF.app.push('tool', { k: el.dataset.k });

  /* each tool: its sliders (with starting values taken from the person's own numbers) and its answer */
  const vals = {};
  const nice = (v) => { if (!(v > 0)) return 0; const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1)); return Math.round(v / p) * p; };
  function defaults(k) {
    const m = me(), pf = m.pf, base = pf.base, sc = D().fx('MYR', base);
    const u = B().usual(pf, base), pos = B().position(pf, base);
    const kept = u.monthlyIncome != null && u.monthlyIncome - u.monthlyExpense > 0 ? u.monthlyIncome - u.monthlyExpense : 0;
    switch (k) {
      case 'grow': return { start: nice(pos.invest) || 0, monthly: nice(kept) || nice(500 * sc), years: 20, rate: 6 };
      case 'target': return { target: nice(100000 * sc), start: nice(pos.invest) || 0, years: 10, rate: 5 };
      case 'loan': return { amount: nice(300000 * sc), rate: 4, years: 30, extra: 0 };
      case 'freedom': return { spend: nice(u.monthlyExpense || 0) || nice(3000 * sc), start: nice(pos.invest) || 0, monthly: nice(kept) || nice(1000 * sc), rate: 4, take: 4 };
      default: return { sym: 'VOO', monthly: nice(500 * sc), months: 36 };
    }
  }
  function fields(k) {
    const base = me().pf.base, sc = D().fx('MYR', base);
    const cap = (v) => nice(v * sc);
    const F = {
      grow: [['start', 'money', 0, cap(500000)], ['monthly', 'money', 0, cap(10000)], ['years', 'years', 1, 40, 1], ['rate', 'pct', 0, 12, 0.5]],
      target: [['target', 'money', 0, cap(2000000)], ['start', 'money', 0, cap(500000)], ['years', 'years', 1, 40, 1], ['rate', 'pct', 0, 12, 0.5]],
      loan: [['amount', 'money', 0, cap(1500000)], ['rate', 'pct', 0, 12, 0.1], ['years', 'years', 1, 35, 1], ['extra', 'money', 0, cap(3000)]],
      freedom: [['spend', 'money', 0, cap(20000)], ['start', 'money', 0, cap(2000000)], ['monthly', 'money', 0, cap(15000)], ['rate', 'pct', 0, 8, 0.5], ['take', 'pct', 2, 6, 0.5]],
      dca: [['monthly', 'money', 0, cap(5000)]]
    };
    return F[k].map((f) => ({ k: f[0], kind: f[1], min: f[2], max: f[3], step: f[4] || (f[1] === 'money' ? Math.max(1, nice(f[3] / 200)) : 1) }));
  }
  const shown = (f, v) => (f.kind === 'money' ? M(v, { cur: me().pf.base, whole: true }) : f.kind === 'pct' ? FF.i18n.num(v, 1) + '%' : t('plan.nYears', { n: v, count: v }));
  function toolPage(p) {
    const k = p.k, v = vals[k] || (vals[k] = defaults(k));
    let h = '<p class="lead">' + t('plan.' + k + '.lead') + '</p>';
    if (k === 'dca') {
      const pop = ['VOO', 'QQQ', 'VT', 'SCHD', 'AAPL', 'MSFT', 'NVDA', 'KO', 'BTC', 'ETH'].filter((s) => D().asset(s));
      h += '<section class="card"><div class="field"><span class="f-l">' + t('plan.dca.pick') + '</span><div class="chips">' + pop.map((s) => '<button type="button" class="chip-btn sm' + (s === v.sym ? ' on' : '') + '" data-sym="' + s + '">' + s + '</button>').join('') + '</div></div>' +
        '<div class="field"><span class="f-l">' + t('plan.dca.back') + '</span>' + ui().segmented('dcam', [12, 36, 60].map((n) => ({ v: n, l: t('plan.nYears', { n: n / 12, count: n / 12 }) })), v.months, 'fz-seg-sm') + '</div></section>';
    }
    h += '<section class="card fz-tool-in">' + fields(k).map((f) => '<label class="fz-slide"><span class="fz-slide-top"><span class="f-l">' + t('plan.f.' + k + '.' + f.k) + '</span><b class="num" data-shown="' + f.k + '">' + shown(f, v[f.k]) + '</b></span>' +
      '<input type="range" data-f="' + f.k + '" min="' + f.min + '" max="' + Math.max(f.max, v[f.k]) + '" step="' + f.step + '" value="' + v[f.k] + '" aria-label="' + esc(t('plan.f.' + k + '.' + f.k)) + '"></label>').join('') +
      '<button type="button" class="link-btn" data-act="tool-reset" data-k="' + k + '">' + ic('undo', 14) + ' ' + t('plan.reset') + '</button></section>';
    h += '<div id="fz-tool-out">' + toolOut(k) + '</div>';
    h += '<p class="foot-note">' + ic('info', 14) + '<span>' + t('plan.' + k + '.note') + '</span></p>';
    return h;
  }
  function toolOut(k) {
    const v = vals[k], base = me().pf.base;
    const mw = (x) => M(x, { cur: base, whole: true });
    if (k === 'grow') {
      const r = P().grow({ start: v.start, monthly: v.monthly, rate: v.rate / 100, years: v.years });
      return '<section class="fz-hero fz-tool-hero"><div class="fz-hero-l">' + t('plan.grow.out', { n: v.years, count: v.years }) + '</div><div class="fz-hero-num num">' + mw(r.value) + '</div><div class="fz-hero-split"><div><span>' + t('plan.paidIn') + '</span><b class="num">' + mw(r.paid) + '</b></div><div><span>' + t('plan.growth') + '</span><b class="num">' + mw(r.growth) + '</b></div></div></section>' +
        '<section class="card"><div class="legend"><span><i class="lg-v"></i>' + t('plan.value') + '</span><span><i class="lg-c"></i>' + t('plan.paidIn') + '</span></div>' + FF.charts.grow(r.series, { label: t('plan.grow.t'), x0: t('plan.now'), x1: t('plan.nYears', { n: v.years, count: v.years }) }) +
        '<p class="fz-line good">' + t('plan.grow.line', { pct: '<b>' + FF.i18n.pct(r.value > 0 ? r.growth / r.value : 0, { dp: 0 }) + '</b>' }) + '</p>' +
        K().how('<p>' + t('plan.grow.how') + '</p><div class="fz-eq"><span class="fz-eq-l">' + t('plan.nextMonth') + '</span><span class="fz-eq-s">=</span><span>' + t('plan.thisMonth') + ' × ( 1 +</span>' + K().frac(FF.i18n.num(v.rate, 1) + '%', '12') + '<span>) + ' + mw(v.monthly) + '</span></div>') + '</section>';
    }
    if (k === 'target') {
      const need = P().needed({ target: v.target, start: v.start, rate: v.rate / 100, years: v.years });
      const r = P().grow({ start: v.start, monthly: need, rate: v.rate / 100, years: v.years });
      const flat = Math.max(0, v.target - v.start) / (v.years * 12);
      return '<section class="fz-hero fz-tool-hero"><div class="fz-hero-l">' + t('plan.target.out', { amount: mw(v.target), n: v.years, count: v.years }) + '</div><div class="fz-hero-num num">' + mw(need) + '<small>' + t('bill.aMonth') + '</small></div>' +
        '<div class="fz-hero-split"><div><span>' + t('plan.paidIn') + '</span><b class="num">' + mw(r.paid) + '</b></div><div><span>' + t('plan.growth') + '</span><b class="num">' + mw(Math.max(0, r.value - r.paid)) + '</b></div></div></section>' +
        '<section class="card">' + FF.charts.grow(r.series, { label: t('plan.target.t'), target: v.target, x0: t('plan.now'), x1: t('plan.nYears', { n: v.years, count: v.years }) }) +
        (need > 0 ? '<p class="fz-line good">' + t('plan.target.line', { amount: '<b>' + mw(Math.max(0, flat - need)) + '</b>' }) + '</p>' : '<p class="fz-line good">' + t('plan.target.already') + '</p>') +
        '<button type="button" class="btn btn-soft btn-block" data-act="tool-goal">🏁 ' + t('plan.target.make') + '</button></section>';
    }
    if (k === 'loan') {
      const r = P().loan({ amount: v.amount, rate: v.rate / 100, years: v.years, extra: v.extra });
      const yrs = (months) => (months % 12 ? t('plan.yrsMonths', { y: Math.floor(months / 12), m: months % 12 }) : t('plan.nYears', { n: months / 12, count: months / 12 }));
      let h = '<section class="fz-hero fz-tool-hero"><div class="fz-hero-l">' + t('plan.loan.out') + '</div><div class="fz-hero-num num">' + M(r.payment, { cur: base }) + '<small>' + t('bill.aMonth') + '</small></div>' +
        '<div class="fz-hero-split"><div><span>' + t('plan.loan.interest') + '</span><b class="num">' + mw(r.interest) + '</b></div><div><span>' + t('plan.loan.total') + '</span><b class="num">' + mw(r.total) + '</b></div></div></section>';
      h += '<section class="card">' + FF.charts.grow(r.series.map((x) => ({ year: x.year, value: x.bal })), { single: true, label: t('plan.loan.t'), x0: t('plan.now'), x1: yrs(r.months) }) +
        '<p class="fz-line">' + t('plan.loan.line', { pct: '<b>' + FF.i18n.pct(v.amount > 0 ? r.interest / v.amount : 0, { dp: 0 }) + '</b>' }) + '</p>';
      if (r.extra && isFinite(r.extra.months)) h += '<div class="fz-callout">💡 ' + t('plan.loan.extra', { extra: '<b>' + mw(v.extra) + '</b>', saved: '<b>' + mw(r.extra.saved) + '</b>', sooner: '<b>' + yrs(r.extra.sooner) + '</b>' }) + '</div>';
      h += K().how('<p>' + t('plan.loan.how') + '</p><div class="fz-eq"><span class="fz-eq-l">' + t('plan.loan.pay') + '</span><span class="fz-eq-s">=</span>' + K().frac(t('plan.loan.amt') + ' × ' + t('plan.loan.mrate'), '1 − ( 1 + ' + t('plan.loan.mrate') + ' )<sup>−' + t('plan.loan.n') + '</sup>') + '</div><p class="row-s">' + t('plan.loan.howB', { rate: FF.i18n.num(v.rate / 12, 3) + '%', n: r.months }) + '</p>') + '</section>';
      return h;
    }
    if (k === 'freedom') {
      const r = P().freedom({ spend: v.spend, start: v.start, monthly: v.monthly, rate: v.rate / 100, take: v.take / 100 });
      const when = r.months == null ? t('plan.freedom.never') : r.months === 0 ? t('plan.freedom.now') : t('plan.freedom.in', { n: FF.i18n.num(r.years, 1) });
      return '<section class="fz-hero fz-tool-hero"><div class="fz-hero-l">' + t('plan.freedom.out') + '</div><div class="fz-hero-num num">' + mw(r.target) + '</div>' +
        '<span class="fz-hero-bar"><i style="width:' + (r.progress * 100).toFixed(1) + '%"></i></span><div class="fz-hero-split"><div><span>' + t('plan.freedom.have') + '</span><b class="num">' + FF.i18n.pct(r.progress, { dp: 0 }) + '</b></div><div><span>' + t('plan.freedom.when') + '</span><b>' + when + '</b></div></div></section>' +
        '<section class="card">' + (r.series.length > 1 ? FF.charts.grow(r.series, { single: true, target: r.target, label: t('plan.freedom.t'), x0: t('plan.now'), x1: r.months == null ? '100+' : t('plan.nYears', { n: Math.ceil(r.years), count: Math.ceil(r.years) }) }) : '') +
        K().how('<p>' + t('plan.freedom.how') + '</p>' + K().eq(t('plan.freedom.pot'), K().frac(t('plan.freedom.yearSpend') + ' ' + mw(v.spend * 12), t('plan.freedom.share') + ' ' + FF.i18n.num(v.take, 1) + '%'), mw(r.target))) + '</section>';
    }
    const r = P().dca(v.sym, v.monthly, v.months, base);
    if (!r) return '<section class="card"><p class="muted center pad">' + t('plan.dca.none') + '</p></section>';
    const live = D().isLive(v.sym);
    return '<section class="fz-hero fz-tool-hero"><div class="fz-hero-l">' + t('plan.dca.out', { name: esc(D().displayName(r.a, FF.i18n.lang)) }) + '</div><div class="fz-hero-num num">' + mw(r.value) + '</div>' +
      '<div class="fz-hero-split"><div><span>' + t('plan.paidIn') + '</span><b class="num">' + mw(r.paid) + '</b></div><div><span>' + t(r.gain >= 0 ? 'plan.dca.gain' : 'plan.dca.loss') + '</span><b class="num">' + mw(Math.abs(r.gain)) + ' · ' + FF.i18n.pct(r.pct, { sign: true, dp: 0 }) + '</b></div></div></section>' +
      '<section class="card"><div class="legend"><span><i class="lg-v"></i>' + t('plan.value') + '</span><span><i class="lg-c"></i>' + t('plan.paidIn') + '</span></div>' + FF.charts.grow(r.series.map((x) => ({ year: 0, value: x.value, paid: x.contrib })), { label: t('plan.dca.t'), x0: FF.i18n.dateShort(r.series[0].day), x1: t('common.today') }) +
      (live ? '' : '<p class="hint">' + ic('info', 14) + '<span>' + t('plan.dca.demo') + '</span></p>') + '</section>';
  }
  function afterTool(el, p) {
    const k = p.k, v = vals[k];
    const out = el.querySelector('#fz-tool-out');
    const fs = {}; fields(k).forEach((f) => { fs[f.k] = f; });
    let raf = 0;
    const redraw = () => { raf = 0; if (out) { out.innerHTML = toolOut(k); ui().fitAll(out); } };
    el.querySelectorAll('input[type="range"]').forEach((inp) => inp.addEventListener('input', () => {
      const f = fs[inp.dataset.f];
      v[f.k] = +inp.value;
      const lab = el.querySelector('[data-shown="' + f.k + '"]');
      if (lab) lab.textContent = shown(f, v[f.k]);
      if (!raf) raf = requestAnimationFrame(redraw); // at most one redraw per screen refresh while a slider moves
    }));
    el.querySelectorAll('[data-sym]').forEach((b) => b.addEventListener('click', () => { v.sym = b.dataset.sym; ui().sfx.tap(); FF.app.refresh(true); }));
    const seg = el.querySelector('[data-seg="dcam"]');
    if (seg) seg.addEventListener('click', (e) => { const b = e.target.closest('.seg-b'); if (!b) return; v.months = +b.dataset.v; ui().sfx.tap(); FF.app.refresh(true); });
  }
  A['tool-reset'] = (el) => { delete vals[el.dataset.k]; ui().sfx.tap(); FF.app.refresh(true); };
  A['tool-goal'] = () => { const v = vals.target; editGoal({ target: v.target, emo: '🏁' }); };

  FF.goals = { page, homeCard, openGoal, editGoal, plannerPage, toolPage, afterTool, goalLine };
})(window);
