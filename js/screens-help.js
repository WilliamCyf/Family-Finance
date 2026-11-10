/* ============================================================
   FamFi — screens-help.js
   Family helpers (v2.25): record for a family member who lets you.

   Tap their house → their Home now has "Record for Mum" (spent ·
   received · moved), their accounts open (set a balance, add to
   one), their records can be fixed or deleted, and there's a
   Records tab with everything. The same sheets as your own records
   (screens-manage.js, with { who }) — the change then goes to them:
   their own phone puts it into their records (store.helpEdit →
   the family's help mailbox → store.applyHelp on their phone), so
   nobody ever overwrites anybody. Until it lands it shows as
   "waiting for their phone"; afterwards it says "✍️ Mum".

   On the other side: a toast when the family has recorded for you,
   a one-time "New: family helpers", and the switch in Privacy.
   No animations, no timers: plain lists, drawn when something changes.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, Lg = () => FF.ledger;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const ui = () => FF.ui;
  const A = FF.actions = FF.actions || {};
  const nameOf = (id) => { const m = id && S().member(id); return m ? m.name : t('help.someone'); };
  const accName = (acc) => FF.manage.accName(acc);

  /* ===================================================== THE RECORDS TAB (in their house) */
  const rec = { who: null, filter: 'all', cat: null, n: 60 };
  function records(ctx) {
    const m = S().member(ctx.id), pf = m.pf, base = pf.base;
    if (rec.who !== ctx.id) Object.assign(rec, { who: ctx.id, filter: 'all', cat: null, n: 60 });
    const F = FF.manage.REC_FILTERS, who = esc(ctx.id);
    let h = '<div class="help-rec-top"><p class="row-s">' + t('help.recLead', { name: esc(m.name) }) + '</p>' +
      (pf.accounts.length ? '<button type="button" class="btn btn-primary btn-sm" data-act="help-add" data-who="' + who + '">' + ic('plus', 16) + t('help.add') + '</button>' : '') + '</div>';
    h += '<div class="chips filter-chips" role="group">' + Object.keys(F).map((k) => '<button type="button" class="chip-btn' + (rec.filter === k && !rec.cat ? ' on' : '') + '" data-act="help-rf" data-who="' + who + '" data-f="' + k + '">' + t('rec.f.' + k) + '</button>').join('') +
      (rec.cat ? '<button type="button" class="chip-btn on" data-act="help-rf" data-who="' + who + '" data-f="all">' + Lg().catOf(rec.cat).icon + ' ' + t('cat.' + rec.cat) + ' ' + ic('close', 12) + '</button>' : '') + '</div>';
    const f = rec.cat ? (x) => (x.type === 'expense' || x.type === 'income') && (x.cat || 'other') === rec.cat : F[rec.filter] || F.all;
    const all = Lg().recent(pf, 100000, f);
    if (!all.length) h += '<div class="empty small">' + FF.art.emptyArt('sprout', 96) + '<p>' + t('help.none') + '</p></div>';
    h += FF.manage.dayGroups(all.slice(0, rec.n), base, null, { pf, who: ctx.id });
    if (all.length > rec.n) h += '<button type="button" class="btn btn-ghost btn-block" data-act="help-more">' + t('rec.more', { n: all.length - rec.n }) + '</button>';
    return h;
  }
  /* jump to the Records tab of the house I'm in (optionally one spending category) */
  function toRecords(cat) {
    const v = FF.app.state.visit;
    if (!v) return;
    v.tab = 'records';
    Object.assign(rec, { who: v.id, filter: 'all', cat: cat || null, n: 60 });
    ui().sfx.tap();
    FF.app.refresh(true);
    const sc = document.querySelector('#visit .visit-scroll');
    if (sc) sc.scrollTop = 0;
  }

  /* ===================================================== ONE OF THEIR ACCOUNTS */
  function openAccount(who, id) {
    if (!S().canHelp(who)) return;
    let off = null;
    ui().openSheet({
      className: 'sheet-tall help-acct-sheet', label: t('help.recordFor', { name: nameOf(who) }),
      render: () => {
        const head = '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('help.recordFor', { name: esc(nameOf(who)) }) + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>';
        const m = S().member(who), pf = m && m.pf, acc = pf && pf.accounts.find((a) => a.id === id);
        if (!acc || !S().canHelp(who)) return head + '<p class="muted center pad">' + t('acct.gone') + '</p>';
        const k = Lg().kindOf(acc), v = Lg().accountValue(pf, acc), invest = Lg().isInvest(pf, acc), base = pf.base, W = esc(who);
        let h = head + FF.manage.helpBanner(who);
        h += '<section class="acct-hero" style="--c:' + k.color + '"><span class="ah-ic" aria-hidden="true">' + k.icon + '</span><div class="row-main"><span class="row-s">' + esc(accName(acc)) + (accName(acc) !== t('acct.kind.' + (acc.kind || 'other')) ? ' · ' + t('acct.kind.' + (acc.kind || 'other')) : '') + ' · ' + acc.cur + '</span><b class="ah-v num' + (v < -0.004 ? ' neg' : '') + '">' + FF.i18n.money(v, acc.cur) + '</b>' + (acc.cur !== base ? '<span class="row-s num">≈ ' + FF.i18n.money(v * FF.data.fx(acc.cur, base), base) + '</span>' : '') + '</div></section>';
        if (invest) h += '<p class="hint">' + ic('info', 14) + '<span>' + t('help.investNote', { name: esc(m.name) }) + '</span></p>';
        else {
          h += '<div class="quick-row">' + [['expense', '🧾'], ['income', '💰'], ['transfer', '🔁']].map((q) => '<button type="button" class="quick q-' + q[0] + '" data-act="help-add" data-who="' + W + '" data-type="' + q[0] + '" data-acct="' + esc(acc.id) + '"><span class="q-ic" aria-hidden="true">' + q[1] + '</span><span class="q-t" data-fit="12">' + t('quick.' + q[0]) + '</span></button>').join('') + '</div>';
          h += '<button type="button" class="btn btn-soft btn-block" data-act="help-adjust" data-who="' + W + '" data-id="' + esc(acc.id) + '">⚖️ ' + t('help.setBalance') + '</button>';
        }
        const recs = Lg().recent(pf, 40, (x) => x.acct === acc.id || x.to === acc.id || (x.parts || []).some((q) => q.acct === acc.id));
        h += '<h3 class="group-h">' + t('acct.records') + '</h3>' + (recs.length ? FF.manage.dayGroups(recs, base, acc.id, { pf, who }) : '<p class="muted center pad">' + t('man.noTx') + '</p>');
        return h;
      },
      onRender: (body, api) => {
        body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
        // what I (or anyone) record shows here at once — and when their phone takes it in
        if (!off) off = FF.on('change', () => { if (!api.layer.isConnected || api.closing) { off(); off = null; return; } const sc = api.body.scrollTop; api.render(); api.body.scrollTop = sc; });
      },
      onClose: () => { if (off) { off(); off = null; } }
    });
  }

  /* ===================================================== THE OTHER SIDE: "Mum recorded … for you" */
  function what(tx) {
    if (!tx) return '';
    const i = FF.manage.txInfo(tx, S().me().pf.base, null, S().me().pf);
    return i.title + ' ' + FF.i18n.money(Math.abs(i.amt), i.cur);
  }
  FF.on('help-applied', (list) => {
    if (!list || !list.length || !S().me()) return;
    const pf = S().me().pf, names = [];
    list.forEach((e) => { const n = nameOf(e.by); if (names.indexOf(n) === -1) names.push(n); });
    let msg;
    if (list.length === 1) {
      const e = list[0], op = e.op, name = '<b>' + esc(names[0]) + '</b>';
      if (op.k === 'add') msg = t('help.inAdd', { name, what: esc(what(op.tx)) });
      else if (op.k === 'edit') msg = t('help.inEdit', { name, what: esc(what(pf.txns.find((x) => x.id === op.tx.id) || op.tx)) });
      else if (op.k === 'bal') { const acc = pf.accounts.find((a) => a.id === op.acct); msg = t('help.inBal', { name, acct: esc(acc ? accName(acc) : ''), amount: FF.i18n.money(op.v, acc ? acc.cur : pf.base) }); }
      else msg = t('help.inDel', { name });
    } else msg = t('help.inMany', { names: '<b>' + esc(names.join(', ')) + '</b>', n: list.length });
    ui().toast(msg, { icon: '🤝', tone: 'success', duration: 6500 });
  });
  FF.on('help-refused', (e) => ui().toast(t('help.refused', { name: '<b>' + esc(nameOf(e && e.id)) + '</b>' }), { icon: 'info', duration: 6500 }));

  /* ===================================================== "NEW: FAMILY HELPERS" (once) */
  function maybeIntro(tries) {
    const f = S().family(), md = S().mode();
    if (FF.shot || !f || f.members.length < 2 || (md !== 'cloud' && md !== 'demo') || (S().state.seen || {}).helpIntro) return;
    // not on top of anything else (the daily gift, a game, signing in): try again a little later
    if (ui().topSheet() || document.documentElement.classList.contains('in-flow') || document.documentElement.classList.contains('in-game') || document.hidden) {
      if ((tries || 0) < 6) setTimeout(() => maybeIntro((tries || 0) + 1), 5000);
      return;
    }
    S().markSeen('helpIntro');
    openIntro();
  }
  function openIntro() {
    const on = S().helpOf(S().me());
    const others = S().familyMembers().filter((x) => x.id !== S().state.meId).slice(0, 3);
    ui().openSheet({
      className: 'help-intro', label: t('help.introT'),
      render: () => '<div class="hi-art" aria-hidden="true"><span class="hi-hand">🤝</span>' + others.map((o) => FF.art.avatar(o.avatar, 44)).join('') + '</div>' +
        '<h2 class="hi-t">' + t('help.introT') + '</h2>' +
        '<ul class="hi-list"><li><span aria-hidden="true">🏡</span><span>' + t('help.intro1') + '</span></li><li><span aria-hidden="true">✍️</span><span>' + t('help.intro2') + '</span></li><li><span aria-hidden="true">🔒</span><span>' + t('help.intro3') + '</span></li></ul>' +
        '<p class="hi-state ' + (on ? 'on' : 'off') + '">' + (on ? '✓ ' + t('help.introOn') : t('help.introOff')) + '</p>' +
        '<button type="button" class="btn btn-primary btn-block btn-lg" data-close>' + t('common.gotIt') + '</button>' +
        '<button type="button" class="btn btn-ghost btn-block" data-priv>' + ic('shield', 18) + t('help.toPrivacy') + '</button>',
      onRender: (body, api) => {
        body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
        body.querySelector('[data-priv]').addEventListener('click', () => { api.close(true); FF.app.go('menu'); setTimeout(() => FF.app.push('privacy'), 60); });
      }
    });
  }
  FF.on('cloud-family', () => setTimeout(() => maybeIntro(0), 3500));

  /* ===================================================== ACTIONS */
  Object.assign(A, {
    'help-acct': (el) => { ui().sfx.tap(); openAccount(el.dataset.who, el.dataset.id); },
    'help-records': () => toRecords(null),
    'help-cat': (el) => toRecords(el.dataset.cat),
    'help-rf': (el) => { rec.filter = el.dataset.f; rec.cat = null; rec.n = 60; ui().sfx.tap(); FF.app.refresh(true); },
    'help-more': () => { rec.n += 120; FF.app.refresh(true); },
    'help-toggle': () => {
      const on = !S().helpOf(S().me());
      S().setHelp(on);
      FF.app.refresh(true); // the switch and the words beside it change at once
      ui().sfx.tap(); ui().haptic();
      ui().toast(t(on ? 'help.turnedOn' : 'help.turnedOff'), { icon: on ? '🤝' : 'shield', tone: 'success' });
    }
  });

  FF.helpUI = { records, openAccount, openIntro, maybeIntro };
})(window);
