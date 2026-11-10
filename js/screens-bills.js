/* ============================================================
   Family Finance — screens-bills.js
   Bills, subscriptions and pay days: what is due, what is coming
   in the next 30 days (and the lowest the balance will get),
   every rule, repeats spotted in your records — and the sheet
   that adds or changes a rule.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, D = () => FF.data, B = () => FF.books, Lg = () => FF.ledger, R = () => FF.recur;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const ui = () => FF.ui;
  const M = (v, o) => FF.i18n.money(v, o && o.cur, o);
  const A = FF.actions = FF.actions || {};
  const K = () => FF.kit;
  const num = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };

  const me = () => S().me();
  const rules = () => S().extras().bills;
  const ruleName = (r) => (r.name ? esc(r.name) : r.type === 'transfer' ? t('trade.transfer') : t('cat.' + r.cat));
  const ruleLook = (r) => (r.type === 'transfer' ? { icon: '🔁', color: '#5D6B7E' } : Lg().catOf(r.cat));
  const accOf = (id) => me().pf.accounts.find((a) => a.id === id);
  function when(day) {
    const d = day - FF.today();
    if (d === 0) return t('common.today');
    if (d === 1) return t('bill.tomorrow');
    if (d === -1) return t('common.yesterday');
    return d > 0 ? t('bill.inDays', { n: d, count: d }) : t('bill.daysLate', { n: -d, count: -d });
  }
  const signed = (r, amt) => (r.type === 'income' ? '+' : r.type === 'expense' ? '−' : '') + FF.i18n.money(amt == null ? r.amt : amt, r.cur);
  const icon = (r, cls) => { const l = ruleLook(r); return '<span class="tx-ic emo ' + (cls || '') + '" style="--c:' + l.color + '" aria-hidden="true">' + l.icon + '</span>'; };

  /* everything waiting for a "paid?" — rules that ask first, oldest first */
  function dueNow() {
    const today = FF.today(), out = [];
    rules().forEach((r) => { if (r.off || r.auto || !R().valid(r, me().pf)) return; const o = R().open(r, today); if (o.length) out.push({ rule: r, day: o[0], more: o.length - 1 }); });
    return out.sort((a, b) => a.day - b.day);
  }
  function dueRow(x) {
    const r = x.rule;
    return '<div class="fz-due' + (x.day < FF.today() ? ' late' : '') + '">' + icon(r) + '<span class="row-main"><span class="row-t">' + ruleName(r) + '</span><span class="row-s">' + when(x.day) + ' · ' + FF.i18n.dateShort(x.day) + (x.more ? ' · ' + t('bill.moreWaiting', { n: x.more }) : '') + '</span></span>' +
      '<span class="fz-due-amt num">' + FF.i18n.money(r.amt, r.cur) + '</span>' +
      '<span class="fz-due-acts"><button type="button" class="btn btn-primary btn-sm" data-act="bill-pay" data-id="' + esc(r.id) + '">' + ic('check', 16) + t(r.type === 'income' ? 'bill.got' : 'bill.paid') + '</button><button type="button" class="btn btn-ghost btn-sm" data-act="bill-skip" data-id="' + esc(r.id) + '">' + t('bill.skip') + '</button></span></div>';
  }
  function upRow(x) {
    const r = x.rule;
    return '<button type="button" class="row fz-up" data-act="bill-open" data-id="' + esc(r.id) + '">' + icon(r) + '<span class="row-main"><span class="row-t">' + ruleName(r) + (r.auto ? '' : ' <span class="chip">' + t('bill.asks') + '</span>') + '</span><span class="row-s">' + when(x.day) + ' · ' + FF.i18n.dateShort(x.day) + '</span></span>' +
      '<span class="row-end"><span class="row-v num ' + (r.type === 'income' ? 'pos' : '') + '">' + signed(r) + '</span></span></button>';
  }

  /* ===================================================== THE PAGE */
  function page() {
    const m = me(), pf = m.pf, base = pf.base, today = FF.today();
    const list = rules();
    let h = '';
    if (!list.length) {
      h += FF.money.emptyState('basket', t('bill.empty.t'), t('bill.empty.b'), '<button type="button" class="btn btn-primary" data-act="bill-new">' + ic('plus', 18) + t('bill.add') + '</button>');
    } else {
      const tot = R().totals(list, base);
      h += '<section class="fz-hero fz-bill-hero"><div class="fz-hero-l">' + t('bill.fixed') + '</div><div class="fz-hero-num num">' + M(tot.out, { cur: base }) + '<small>' + t('bill.aMonth') + '</small></div>' +
        '<div class="fz-hero-split"><div><span>' + t('bill.aYear') + '</span><b class="num">' + M(tot.out * 12, { cur: base, whole: true }) + '</b></div>' + (tot.in > 0 ? '<div><span>' + t('bill.regularIn') + '</span><b class="num">' + M(tot.in, { cur: base, whole: true }) + '</b></div>' : '') + '</div></section>';
      const due = dueNow();
      if (due.length) h += '<section class="card fz-duecard"><div class="card-head"><h2>' + ic('bell', 18) + t('bill.dueT') + '</h2></div>' + due.map(dueRow).join('') + '</section>';
      // the next 30 days, and the lowest point on the way
      const liquid = B().position(pf, base).liquid;
      const fc = R().forecast(list.filter((r) => R().valid(r, pf)), liquid, base, today, 30);
      const up = fc.items.concat(R().upcoming(list.filter((r) => r.type === 'transfer' && R().valid(r, pf)), today, today + 30, today)).filter((x) => !(x.day <= today && !x.rule.auto)).sort((a, b) => a.day - b.day);
      if (fc.items.length) {
        const tight = fc.low.bal < 0;
        h += '<section class="card fz-fc"><div class="card-head"><h2>' + t('bill.next30') + '</h2></div>' + FF.charts.steps(fc.pts, { low: fc.low, label: t('bill.next30') }) +
          '<p class="fz-line ' + (tight ? 'soft' : 'good') + '">' + t(tight ? 'bill.lowBad' : 'bill.low', { amount: '<b>' + M(fc.low.bal, { cur: base, whole: true }) + '</b>', date: FF.i18n.dateShort(fc.low.day) }) + '</p>' +
          '<div class="fz-stats">' + K().stat(t('bill.nowReach'), M(liquid, { cur: base, whole: true })) + K().stat(t('bill.goingOut'), M(fc.out, { cur: base, whole: true }), 'out') + K().stat(t('bill.comingIn'), M(fc.in, { cur: base, whole: true }), 'in') + '</div>' +
          '<p class="hint">' + ic('info', 14) + '<span>' + t('bill.fcNote') + '</span></p></section>';
      }
      if (up.length) h += '<section class="card list-card"><div class="card-head"><h2>' + ic('calendar', 18) + t('bill.upT') + '</h2></div>' + up.slice(0, 12).map(upRow).join('') + '</section>';
      h += '<section class="card list-card"><div class="card-head"><h2>' + t('bill.allT') + '</h2><span class="muted">' + list.length + '</span></div>' + list.slice().sort((a, b) => (a.off ? 1 : 0) - (b.off ? 1 : 0) || R().monthly(b) * D().fx(b.cur, base) - R().monthly(a) * D().fx(a.cur, base)).map((r) => {
        const ok = R().valid(r, pf), nx = ok && !r.off ? R().nextOpen(r, today) : null;
        return '<button type="button" class="row fz-rule' + (r.off ? ' off' : '') + '" data-act="bill-open" data-id="' + esc(r.id) + '">' + icon(r) + '<span class="row-main"><span class="row-t">' + ruleName(r) + '</span><span class="row-s">' + t('bill.every.' + r.every) + (r.off ? ' · ' + t('bill.paused') : !ok ? ' · <span class="fz-warn">' + t('bill.broken') + '</span>' : nx != null ? ' · ' + t('bill.nextOn', { date: FF.i18n.dateShort(nx) }) : ' · ' + t('bill.ended')) + '</span></span>' +
          '<span class="row-end"><span class="row-v num ' + (r.type === 'income' ? 'pos' : '') + '">' + signed(r) + '</span></span>' + ic('chevR', 16) + '</button>';
      }).join('') + '</section>';
    }
    const found = R().detect(pf, list, today).filter((x) => !S().nudgeOff('rc:' + x.key, 90));
    if (found.length) h += '<section class="card fz-found"><div class="card-head"><h2>' + ic('sparkle', 18) + t('bill.foundT') + '</h2></div><p class="row-s fz-found-b">' + t('bill.foundB') + '</p>' + found.map((x, i) => {
      const r = x.rule;
      return '<div class="fz-due">' + icon(r) + '<span class="row-main"><span class="row-t">' + ruleName(r) + '</span><span class="row-s">' + t('bill.every.' + r.every) + ' · ' + t('bill.seen', { n: x.n }) + '</span></span><span class="fz-due-amt num">' + FF.i18n.money(r.amt, r.cur) + '</span>' +
        '<span class="fz-due-acts"><button type="button" class="btn btn-soft btn-sm" data-act="bill-found" data-i="' + i + '">' + ic('plus', 16) + t('bill.make') + '</button><button type="button" class="btn btn-ghost btn-sm" data-act="bill-found-no" data-k="' + esc(x.key) + '">' + t('bill.notNow') + '</button></span></div>';
    }).join('') + '</section>';
    if (list.length) h += '<button type="button" class="btn btn-primary btn-block" data-act="bill-new">' + ic('plus', 18) + t('bill.add') + '</button>';
    h += '<p class="foot-note">' + ic('lock', 14) + '<span>' + t('bill.private') + '</span></p>';
    return h;
  }

  /* the card on Home: what is waiting, and the next few things coming (nothing when there are no rules) */
  function homeCard() {
    const list = rules();
    if (!list.length) return '';
    const pf = me().pf, today = FF.today();
    const due = dueNow();
    const up = R().upcoming(list.filter((r) => r.type !== 'transfer' && R().valid(r, pf)), today, today + 14, today).filter((x) => !(x.day <= today && !x.rule.auto)).slice(0, 3 - Math.min(due.length, 2));
    if (!due.length && !up.length) return '';
    return '<section class="card list-card fz-billhome"><div class="card-head"><h2>' + t('bill.homeT') + '</h2><button type="button" class="link-btn" data-act="page" data-page="bills">' + t('home.seeAllShort') + '</button></div>' +
      due.slice(0, 2).map(dueRow).join('') + up.map(upRow).join('') + '</section>';
  }

  /* ===================================================== ACTIONS */
  const reward = (res) => { if (res && res.badges && res.badges.length) FF.app.celebrate({ badges: res.badges }); };
  A['bill-pay'] = (el) => {
    const r = rules().find((x) => x.id === el.dataset.id);
    if (!r) return;
    const snap = S().snapshot();
    const res = S().payBill(r.id);
    if (!res) { ui().toast(t('bill.cant'), { icon: 'info' }); return; }
    ui().sfx.pop(); ui().haptic();
    ui().toast(t(r.type === 'income' ? 'bill.gotDone' : 'bill.paidDone', { name: '<b>' + ruleName(r) + '</b>', amount: FF.i18n.money(r.amt, r.cur) }), { icon: ruleLook(r).icon, tone: 'success', action: t('common.undo'), actionIcon: 'undo', onAction: () => { S().restore(snap); ui().toast(t('common.undone'), { icon: 'undo' }); } });
    reward(res);
  };
  A['bill-skip'] = (el) => {
    const snap = S().snapshot();
    if (S().skipBill(el.dataset.id) == null) return;
    ui().sfx.tap();
    ui().toast(t('bill.skipped'), { icon: 'check', action: t('common.undo'), actionIcon: 'undo', onAction: () => S().restore(snap) });
  };
  A['bill-new'] = () => open({});
  A['bill-open'] = (el) => { const r = rules().find((x) => x.id === el.dataset.id); if (r) open({ edit: r }); };
  A['bill-found'] = (el) => { const x = R().detect(me().pf, rules(), FF.today()).filter((y) => !S().nudgeOff('rc:' + y.key, 90))[+el.dataset.i]; if (x) open({ from: x }); };
  A['bill-found-no'] = (el) => { S().dismissNudge('rc:' + el.dataset.k); ui().sfx.tap(); };

  /* ===================================================== ADD / CHANGE A RULE */
  const CURS = ['MYR', 'USD', 'SGD', 'THB'];
  function open(o) {
    o = o || {};
    const pf = me().pf, ed = o.edit, today = FF.today();
    const everyday = pf.accounts.filter((a) => !Lg().isInvest(pf, a));
    const st = { type: 'expense', name: '', amt: '', cur: pf.base, cat: null, acct: (everyday[0] || pf.accounts[0] || {}).id, to: null, every: 'month', day: today, auto: true, end: '' };
    if (ed) Object.assign(st, { editId: ed.id, type: ed.type, name: ed.name || '', amt: String(ed.amt), cur: ed.cur, cat: ed.cat || null, acct: ed.acct, to: ed.to || null, every: ed.every, day: R().nextOpen(ed, today) || ed.day0, day00: R().nextOpen(ed, today) || ed.day0, auto: ed.auto !== false, off: !!ed.off, end: ed.end != null ? FF.iso(ed.end) : '' });
    else if (o.from) { const r = o.from.rule; Object.assign(st, { type: r.type, name: r.name || '', amt: String(r.amt), cur: r.cur, cat: r.cat, acct: r.acct, every: r.every, day: o.from.next || today, foundKey: o.from.key }); }
    else if (o.preset) Object.assign(st, o.preset);
    return ui().openSheet({ className: 'sheet-tall fz-bill-sheet', label: t(ed ? 'bill.editT' : 'bill.add'), state: st, render, onRender: mount });
  }
  function render(api) {
    const st = api.state, pf = me().pf, tr = st.type === 'transfer';
    const from = accOf(st.acct);
    let f = K().sheetHead(t(st.editId ? 'bill.editT' : 'bill.add'));
    f += ui().segmented('btype', [{ v: 'expense', l: '🧾 ' + t('bill.t.expense') }, { v: 'income', l: '💰 ' + t('bill.t.income') }, { v: 'transfer', l: '🔁 ' + t('bill.t.transfer') }], st.type);
    f += '<label class="amt-wrap t-' + st.type + '"><span class="amt-cur" id="b-cur">' + (tr && from ? from.cur : st.cur) + '</span><input id="b-amt" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' + esc(st.amt) + '" aria-label="' + esc(t('trade.amount')) + '"></label>';
    if (!tr) f += '<div class="chips cur-chips" role="radiogroup">' + [pf.base].concat(CURS.filter((c) => c !== pf.base)).map((c) => '<button type="button" class="chip-btn sm' + (c === st.cur ? ' on' : '') + '" data-bcur="' + c + '" role="radio" aria-checked="' + (c === st.cur) + '">' + c + '</button>').join('') + '</div>';
    f += '<div class="form"><label class="field"><span class="f-l">' + t('bill.name') + '</span><input id="b-name" maxlength="40" autocomplete="off" placeholder="' + esc(t('bill.namePh.' + st.type)) + '" value="' + esc(st.name) + '"></label>';
    if (tr) {
      f += '<div class="field"><span class="f-l">' + t('rec.from') + '</span>' + chips('data-bacct', st.acct) + '</div><div class="field"><span class="f-l">' + t('rec.to') + '</span>' + (pf.accounts.length > 1 ? chips('data-bto', st.to, st.acct) : '<p class="hint">' + ic('info', 14) + '<span>' + t('rec.needTwo') + '</span></p>') + '</div>';
    } else {
      const cats = st.type === 'income' ? Lg().INCOME : Lg().EXPENSE;
      f += '<div class="field"><span class="f-l">' + t('rec.category') + '</span><div class="cat-grid">' + cats.map((c) => '<button type="button" class="cat-btn' + (c.id === st.cat ? ' on' : '') + '" data-bcat="' + c.id + '" style="--c:' + c.color + '"><span class="cb-ic" aria-hidden="true">' + c.icon + '</span><span class="cb-n">' + t('cat.' + c.id) + '</span></button>').join('') + '</div></div>';
      f += '<div class="field"><span class="f-l">' + t(st.type === 'income' ? 'rec.into' : 'rec.paidFrom') + '</span>' + chips('data-bacct', st.acct) + '</div>';
    }
    f += '<div class="field"><span class="f-l">' + t('bill.howOften') + '</span><div class="chips">' + R().EVERY.map((e) => '<button type="button" class="chip-btn sm' + (e === st.every ? ' on' : '') + '" data-bevery="' + e + '">' + t('bill.every.' + e) + '</button>').join('') + '</div></div>';
    f += '<div class="field-row"><label class="field"><span class="f-l">' + t('bill.nextDate') + '</span><input id="b-day" type="date" value="' + FF.iso(st.day) + '"></label></div>';
    f += '<div class="set-row"><span class="row-main"><span class="row-t">' + t('bill.autoT') + '</span><span class="row-s" id="b-auto-s">' + t(st.auto ? 'bill.autoOn' : 'bill.autoOff') + '</span></span>' + ui().toggle(st.auto, 'id="b-auto" aria-label="' + esc(t('bill.autoT')) + '"') + '</div>';
    f += '<details class="more"' + (st.end ? ' open' : '') + '><summary><span>' + t('trade.more') + '</span>' + ic('chevD', 16) + '</summary><label class="field"><span class="f-l">' + t('bill.endDate') + '</span><input id="b-end" type="date" value="' + esc(st.end) + '"><span class="f-hint">' + t('bill.endHint') + '</span></label></details>';
    f += '</div><p class="summary" id="b-sum" aria-live="polite"></p><p class="form-err" id="b-err" role="alert"></p>';
    f += '<button type="button" class="btn btn-primary btn-block btn-lg" id="b-go">' + ic('check', 20) + '<span>' + t('common.save') + '</span></button>';
    if (st.editId) f += '<button type="button" class="btn btn-soft btn-block" id="b-pause">' + (st.off ? '▶️ ' + t('bill.resume') : '⏸️ ' + t('bill.pause')) + '</button><button type="button" class="btn btn-danger-soft btn-block" id="b-del">' + ic('trash', 18) + '<span>' + t('bill.delete') + '</span></button>';
    return f;
  }
  function chips(attr, sel, exclude) {
    const pf = me().pf;
    return '<div class="chips acct-chips">' + Lg().accounts(pf, pf.base).map((x) => x.acc).filter((a) => a.id !== exclude).map((a) => { const k = Lg().kindOf(a); return '<button type="button" class="chip-btn' + (a.id === sel ? ' on' : '') + '" ' + attr + '="' + esc(a.id) + '"><span aria-hidden="true">' + k.icon + '</span>' + esc(K().accName(a)) + (a.cur !== pf.base ? ' · ' + a.cur : '') + '</button>'; }).join('') + '</div>';
  }
  function mount(body, api) {
    const st = api.state, pf = me().pf;
    const $ = (q) => body.querySelector(q);
    const keep = () => {
      st.amt = $('#b-amt').value; st.name = $('#b-name').value;
      const d = FF.fromISO($('#b-day').value); if (d != null) st.day = d;
      st.end = $('#b-end') ? $('#b-end').value : st.end;
    };
    const rerender = () => { keep(); api.render(); };
    const update = () => {
      keep();
      const v = num(st.amt);
      const cur = st.type === 'transfer' ? (accOf(st.acct) || {}).cur || st.cur : st.cur;
      $('#b-sum').innerHTML = v > 0 ? t('bill.sum', { amount: '<b>' + FF.i18n.money(v, cur) + '</b>', every: t('bill.every.' + st.every).toLowerCase(), date: FF.i18n.date(st.day), year: '<b>' + FF.i18n.money(R().yearly({ amt: v, every: st.every }), cur, { whole: true }) + '</b>' }) : '';
      $('#b-err').textContent = '';
    };
    $('[data-close]').addEventListener('click', () => api.close());
    body.querySelectorAll('input').forEach((i) => i.addEventListener('input', update));
    $('[data-seg="btype"]').addEventListener('click', (e) => { const b = e.target.closest('.seg-b'); if (!b || b.dataset.v === st.type) return; st.type = b.dataset.v; st.cat = null; if (st.type === 'transfer' && (!st.to || st.to === st.acct)) st.to = (pf.accounts.find((a) => a.id !== st.acct) || {}).id || null; ui().sfx.tap(); rerender(); });
    body.querySelectorAll('[data-bcur]').forEach((b) => b.addEventListener('click', () => { st.cur = b.dataset.bcur; ui().sfx.tap(); rerender(); }));
    body.querySelectorAll('[data-bcat]').forEach((b) => b.addEventListener('click', () => { st.cat = b.dataset.bcat; body.querySelectorAll('[data-bcat]').forEach((x) => x.classList.toggle('on', x === b)); ui().sfx.tap(); ui().haptic(); update(); }));
    body.querySelectorAll('[data-bacct]').forEach((b) => b.addEventListener('click', () => { st.acct = b.dataset.bacct; if (st.to === st.acct) st.to = (pf.accounts.find((a) => a.id !== st.acct) || {}).id || null; ui().sfx.tap(); rerender(); }));
    body.querySelectorAll('[data-bto]').forEach((b) => b.addEventListener('click', () => { st.to = b.dataset.bto; ui().sfx.tap(); rerender(); }));
    body.querySelectorAll('[data-bevery]').forEach((b) => b.addEventListener('click', () => { st.every = b.dataset.bevery; body.querySelectorAll('[data-bevery]').forEach((x) => x.classList.toggle('on', x === b)); ui().sfx.tap(); update(); }));
    $('#b-auto').addEventListener('click', () => { st.auto = !st.auto; const sw = $('#b-auto'); sw.classList.toggle('on', st.auto); sw.setAttribute('aria-checked', st.auto); $('#b-auto-s').textContent = t(st.auto ? 'bill.autoOn' : 'bill.autoOff'); ui().sfx.tap(); });
    $('#b-go').addEventListener('click', () => submit(api));
    if ($('#b-pause')) $('#b-pause').addEventListener('click', () => { S().updateBill(st.editId, { off: !st.off }); api.close(true); ui().toast(t(st.off ? 'bill.resumed' : 'bill.pausedDone'), { icon: 'check', tone: 'success' }); });
    const del = $('#b-del');
    if (del) del.addEventListener('click', () => {
      if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.innerHTML = ic('trash', 18) + '<span>' + t('tx.deleteSure') + '</span>'; ui().haptic(); return; }
      const gone = S().deleteBill(st.editId); api.close(true);
      ui().toast(t('bill.deleted'), { icon: 'trash', action: t('common.undo'), actionIcon: 'undo', onAction: () => S().restoreBill(gone) });
    });
    update();
    if (!st.amt && !st.editId && !FF.shot) setTimeout(() => $('#b-amt') && $('#b-amt').focus({ preventScroll: true }), 380);
  }
  function submit(api) {
    const st = api.state, pf = me().pf;
    const err = (k) => { const e = api.body.querySelector('#b-err'); e.textContent = t(k); ui().haptic(); e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); };
    const v = num(st.amt);
    if (!(v > 0)) return err('trade.err.amt');
    const from = accOf(st.acct);
    if (!from) return err('rec.err.accounts');
    const rule = { type: st.type, name: st.name.trim(), amt: v, cur: st.type === 'transfer' ? from.cur : st.cur, acct: from.id, every: st.every, day0: st.day, auto: st.auto, end: st.end ? FF.fromISO(st.end) : null };
    if (st.type === 'transfer') {
      const to = accOf(st.to);
      if (!to || to.id === from.id) return err('rec.err.accounts');
      rule.to = to.id;
      if (to.cur !== from.cur) { rule.toAmt = FF.round2(v * D().fx(from.cur, to.cur)); rule.toCur = to.cur; }
    } else {
      if (!st.cat) return err('rec.err.cat');
      rule.cat = st.cat;
    }
    if (rule.end != null && rule.end < rule.day0) return err('bill.err.end');
    api.close(true);
    ui().sfx.pop(); ui().haptic();
    if (st.editId) {
      // the date was left alone: keep counting from where the rule already was
      if (st.day === st.day00) { const old = rules().find((x) => x.id === st.editId); rule.day0 = old.day0; }
      S().updateBill(st.editId, Object.assign(rule, { off: !!st.off }));
      ui().toast(t('common.saved'), { icon: 'check', tone: 'success' });
    } else {
      const nb = S().addBill(rule);
      if (st.foundKey) S().dismissNudge('rc:' + st.foundKey);
      const nx = R().nextOpen(nb, FF.today());
      ui().toast(t('bill.added', { name: '<b>' + ruleName(nb) + '</b>', date: nx != null ? FF.i18n.dateShort(nx) : '' }), { icon: ruleLook(nb).icon, tone: 'success', action: t('common.undo'), actionIcon: 'undo', onAction: () => S().deleteBill(nb.id) });
    }
    setTimeout(runNow, 60);
  }
  /* rules that write themselves: add what is due (when the app opens, comes back, or a rule changes) */
  function runNow(quiet) {
    if (FF.shot || !S().me()) return [];
    const added = S().runBills();
    if (added.length && !quiet) {
      const base = me().pf.base, one = added.length === 1;
      const sum = FF.sum(added.filter((x) => x.type !== 'transfer'), (x) => (x.type === 'income' ? 1 : -1) * x.amt * D().fx(x.cur, base, x.day));
      ui().toast(one ? t('bill.auto1', { name: '<b>' + esc(added[0].note || t(added[0].type === 'transfer' ? 'trade.transfer' : 'cat.' + added[0].cat)) + '</b>', amount: FF.i18n.money(added[0].amt, added[0].cur) }) : t('bill.autoN', { n: added.length, amount: '<b>' + M(sum, { cur: base, sign: true }) + '</b>' }),
        { icon: '🔁', tone: 'success', action: t('common.view'), onAction: () => FF.app.push('bills'), duration: 6000 });
    }
    return added;
  }

  FF.bills = { page, homeCard, open, runNow, dueNow, ruleName, ruleLook, when };
})(window);
