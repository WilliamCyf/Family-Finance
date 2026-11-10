/* ============================================================
   FamFi — screens-hall.js
   The family Town Hall: assets that belong to the whole family
   rather than one person — a family unit trust, the kampung land,
   a shared emergency fund. Anyone in the family can rename the
   hall, add assets, and update their values; the total shows on
   top of the building in the village.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, L = () => FF.ledger;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const M = (v, o) => FF.i18n.money(v, o && o.cur, o);
  const ui = () => FF.ui;
  const A = FF.actions = FF.actions || {};
  const KIND_ORDER = ['fund', 'property', 'savings', 'business', 'gold', 'vehicle', 'other'];
  const CURS = FF.data.DISPLAY_CURRENCIES;
  const num = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const who = (id) => { const m = S().member(id); return m ? m.name : t('hall.someone'); };
  const hall = () => (S().family() || {}).hall;

  /* ===================================================== BUILD */
  function openBuild() {
    const f = S().family();
    if (!f || f.hall) return;
    const st = { name: t('hall.defaultName', { family: f.name.replace(/^The\s+/i, '') }).slice(0, 40) };
    ui().openSheet({
      label: t('hall.buildT'), state: st,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('hall.buildT') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div class="hall-preview">' + FF.art.townHall({}).svg + '</div>' +
        '<p class="lead center">' + t('hall.buildB') + '</p>' +
        '<ul class="perks"><li>' + ic('users', 20) + t('hall.p1') + '</li><li>' + ic('wallet', 20) + t('hall.p2') + '</li><li>' + ic('edit', 20) + t('hall.p3') + '</li></ul>' +
        '<div class="form"><label class="field"><span class="f-l">' + t('hall.name') + '</span><input id="hl-name" maxlength="40" value="' + esc(st.name) + '"></label></div>' +
        '<p class="form-err" id="hl-err" role="alert"></p><button type="button" class="btn btn-primary btn-block btn-lg" id="hl-go">' + ic('hammer', 20) + t('hall.build') + '</button>',
      onRender: (b, api) => {
        b.querySelector('[data-close]').addEventListener('click', () => api.close());
        b.querySelector('#hl-go').addEventListener('click', () => {
          const name = b.querySelector('#hl-name').value.trim();
          if (!name) { b.querySelector('#hl-err').textContent = t('hall.errName'); ui().haptic(); return; }
          S().buildHall(name);
          api.close(true);
          FF.app.go('family');
          setTimeout(() => FF.village.hallBuilt(), 250);
          setTimeout(() => ui().toast(t('hall.built', { name: '<b>' + esc(name) + '</b>' }), { icon: '🏛️', tone: 'success', action: t('hall.addAsset'), onAction: () => { FF.app.push('hall'); setTimeout(() => openAsset(null), 400); }, duration: 7000 }), 900);
        });
      }
    });
  }

  /* ===================================================== THE HALL PAGE */
  function page() {
    const h0 = hall();
    if (!h0) return '<div class="empty">' + FF.art.emptyArt('village', 120) + '<h3>' + t('hall.noneT') + '</h3><p>' + t('hall.noneB') + '</p><button type="button" class="btn btn-primary" data-act="hall-build">' + ic('hammer', 18) + t('hall.build') + '</button></div>';
    const base = S().me().pf.base;
    const total = L().hallTotal(h0, base);
    const accs = Object.keys(h0.accounts || {}).map((id) => ({ id, a: h0.accounts[id], v: L().hallBalance(h0.accounts[id]) })).sort((x, y) => y.v * FF.data.fx(y.a.cur, base) - x.v * FF.data.fx(x.a.cur, base));
    let h = '<section class="hall-hero"><div class="hh-art">' + FF.art.townHall({}).svg + '</div>' +
      '<div class="hh-name"><h1 class="scr-title">' + esc(h0.name) + '</h1><button type="button" class="icon-btn" data-act="hall-rename" aria-label="' + esc(t('hall.rename')) + '">' + ic('edit', 18) + '</button></div>' +
      '<div class="hh-total num" data-count="' + total + '">' + M(total, { cur: base }) + '</div>' +
      '<p class="hero-sub">' + t('hall.sub', { n: accs.length, count: accs.length }) + '</p></section>';
    h += '<div class="acct-grid">' + accs.map((x) => '<button type="button" class="acct-tile" style="--c:#4E7BB5" data-act="hall-asset" data-id="' + esc(x.id) + '"><span class="at-ic" aria-hidden="true">' + (L().HALL_KINDS[x.a.kind] || '💼') + '</span><span class="at-name" data-fit="11">' + esc(x.a.name) + '</span><span class="at-val num">' + M(x.v, { cur: x.a.cur, compact: Math.abs(x.v) >= 1e6 }) + '</span><span class="at-kind">' + t('hall.kind.' + (x.a.kind || 'other')) + (x.a.cur !== base ? ' · ' + x.a.cur : '') + '</span></button>').join('') +
      '<button type="button" class="acct-tile add" data-act="hall-asset"><span class="at-ic" aria-hidden="true">' + ic('plus', 22) + '</span><span class="at-name">' + t('hall.addAsset') + '</span><span class="at-kind">' + t('hall.addHint') + '</span></button></div>';
    const act = L().hallActivity(h0, 12);
    if (act.length) {
      h += '<h3 class="group-h">' + t('hall.activity') + '</h3><section class="card list-card">' + act.map((e) => '<div class="row static"><span class="tx-ic emo" style="--c:#4E7BB5" aria-hidden="true">' + (L().HALL_KINDS[e.acc.kind] || '💼') + '</span><span class="row-main"><span class="row-t">' + esc(e.acc.name) + '</span><span class="row-s">' + t(e.t === 'set' ? 'hall.didSet' : e.amt >= 0 ? 'hall.didAdd' : 'hall.didTake', { name: esc(who(e.by)), amount: M(Math.abs(e.amt), { cur: e.acc.cur, whole: true }) }) + (e.note ? ' · ' + esc(e.note) : '') + '</span></span><span class="row-end"><span class="row-v num">' + M(e.after, { cur: e.acc.cur, whole: true }) + '</span><span class="row-s">' + FF.i18n.dateShort(e.day) + '</span></span></div>').join('') + '</section>';
    }
    h += '<p class="foot-note">' + ic('users', 14) + '<span>' + t('hall.note') + '</span></p>';
    return h;
  }
  function after(el) {
    const n = el.querySelector('.hh-total');
    if (n) ui().countUp(n, +n.dataset.count, (v) => M(v, { cur: S().me().pf.base }), 'hall-total');
  }

  /* ===================================================== ONE ASSET */
  function openAsset(id) {
    const h0 = hall();
    if (!h0) return;
    if (!id) return openAssetEdit(null);
    const a = h0.accounts[id];
    if (!a) return;
    ui().openSheet({
      className: 'sheet-tall', label: a.name,
      render: () => {
        const cur = hall() && hall().accounts[id];
        if (!cur) return '';
        const v = L().hallBalance(cur);
        const hist = L().hallActivity({ accounts: { x: cur } }, 30);
        return '<div class="sheet-head"><button type="button" class="icon-btn" data-edit aria-label="' + esc(t('common.edit')) + '">' + ic('edit', 20) + '</button><h2>' + esc(cur.name) + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
          '<div class="tx-hero"><span class="tx-ic big emo" style="--c:#4E7BB5" aria-hidden="true">' + (L().HALL_KINDS[cur.kind] || '💼') + '</span><span class="row-s">' + t('hall.kind.' + (cur.kind || 'other')) + ' · ' + cur.cur + '</span><div class="tx-amt num">' + M(v, { cur: cur.cur }) + '</div></div>' +
          '<div class="btn-row"><button type="button" class="btn btn-primary" data-entry="set">' + ic('edit', 18) + t('hall.update') + '</button></div>' +
          '<div class="btn-row"><button type="button" class="btn btn-soft" data-entry="add">' + ic('plus', 18) + t('hall.add') + '</button><button type="button" class="btn btn-soft" data-entry="take">' + ic('minus', 18) + t('hall.take') + '</button></div>' +
          '<h3 class="group-h">' + t('hall.history') + '</h3><section class="card list-card">' + (hist.length ? hist.map((e) => '<div class="row static"><span class="row-main"><span class="row-t">' + t(e.t === 'set' ? 'hall.didSet' : e.amt >= 0 ? 'hall.didAdd' : 'hall.didTake', { name: esc(who(e.by)), amount: M(Math.abs(e.amt), { cur: cur.cur, whole: true }) }) + '</span><span class="row-s">' + FF.i18n.date(e.day) + (e.note ? ' · ' + esc(e.note) : '') + '</span></span><span class="row-end"><span class="row-v num">' + M(e.after, { cur: cur.cur, whole: true }) + '</span><button type="button" class="link" data-del-entry="' + esc(e.id) + '">' + t('common.delete') + '</button></span></div>').join('') : '<p class="muted center pad">' + t('hall.noHistory') + '</p>') + '</section>';
      },
      onRender: (b, api) => {
        b.querySelector('[data-close]').addEventListener('click', () => api.close());
        b.querySelector('[data-edit]').addEventListener('click', () => { api.close(true); openAssetEdit(id); });
        b.querySelectorAll('[data-entry]').forEach((x) => x.addEventListener('click', () => openEntry(id, x.dataset.entry, () => api.render())));
        b.querySelectorAll('[data-del-entry]').forEach((x) => x.addEventListener('click', () => { S().deleteHallEntry(id, x.dataset.delEntry); ui().sfx.tap(); api.render(); }));
      }
    });
  }
  /* update the value / add money / take some out */
  function openEntry(id, kind, done) {
    const a = hall().accounts[id];
    const v = L().hallBalance(a);
    ui().openSheet({
      label: t('hall.' + (kind === 'set' ? 'update' : kind)),
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('hall.' + (kind === 'set' ? 'update' : kind)) + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<p class="lead">' + t(kind === 'set' ? 'hall.updateB' : kind === 'add' ? 'hall.addB' : 'hall.takeB', { name: '<b>' + esc(a.name) + '</b>', amount: '<b>' + M(v, { cur: a.cur }) + '</b>' }) + '</p>' +
        '<label class="amt-wrap"><span class="amt-cur">' + a.cur + '</span><input id="he-amt" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' + (kind === 'set' ? FF.round2(v) : '') + '"></label>' +
        '<div class="form"><label class="field"><span class="f-l">' + t('rec.note') + '</span><input id="he-note" maxlength="60" placeholder="' + esc(t('hall.notePh')) + '"></label></div>' +
        '<p class="form-err" id="he-err" role="alert"></p><button type="button" class="btn btn-primary btn-block btn-lg" id="he-go">' + t('common.save') + '</button>',
      onRender: (b, api) => {
        b.querySelector('[data-close]').addEventListener('click', () => api.close());
        const inp = b.querySelector('#he-amt');
        setTimeout(() => { inp.focus(); inp.select(); }, 350);
        b.querySelector('#he-go').addEventListener('click', () => {
          const n = num(inp.value);
          if (kind !== 'set' && !(n > 0)) { b.querySelector('#he-err').textContent = t('trade.err.amt'); ui().haptic(); return; }
          S().addHallEntry(id, { t: kind === 'set' ? 'set' : 'add', amt: kind === 'take' ? -n : n, note: b.querySelector('#he-note').value.trim() });
          api.close(true); ui().sfx.chime(); ui().haptic();
          ui().toast(t('hall.saved', { name: '<b>' + esc(a.name) + '</b>', amount: '<b>' + M(L().hallBalance(hall().accounts[id]), { cur: a.cur }) + '</b>' }), { icon: '🏛️', tone: 'success' });
          if (done) done();
        });
      }
    });
  }
  /* add a new asset, or rename / change / remove one */
  function openAssetEdit(id) {
    const a = id ? hall().accounts[id] : null;
    const st = a ? { name: a.name, kind: a.kind || 'other', cur: a.cur } : { name: '', kind: 'fund', cur: S().me().pf.base };
    ui().openSheet({
      label: t(a ? 'hall.editAsset' : 'hall.addAsset'), state: st,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t(a ? 'hall.editAsset' : 'hall.addAsset') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div class="form"><label class="field"><span class="f-l">' + t('hall.assetName') + '</span><input id="ha-name" maxlength="40" value="' + esc(st.name) + '" placeholder="' + esc(t('hall.assetPh')) + '"></label>' +
        '<div class="field"><span class="f-l">' + t('acct.kind') + '</span><div class="chips">' + KIND_ORDER.map((k) => '<button type="button" class="chip-btn' + (k === st.kind ? ' on' : '') + '" data-hk="' + k + '">' + L().HALL_KINDS[k] + ' ' + t('hall.kind.' + k) + '</button>').join('') + '</div></div>' +
        '<div class="field"><span class="f-l">' + t('acct.cur') + '</span><div class="chips">' + CURS.map((c) => '<button type="button" class="chip-btn sm' + (c === st.cur ? ' on' : '') + '" data-hc="' + c + '">' + c + '</button>').join('') + '</div></div>' +
        (a ? '' : '<label class="field"><span class="f-l">' + t('hall.valueNow') + '</span><input id="ha-val" inputmode="decimal" autocomplete="off" placeholder="0.00"></label>') + '</div>' +
        '<p class="form-err" id="ha-err" role="alert"></p><button type="button" class="btn btn-primary btn-block btn-lg" id="ha-go">' + t('common.save') + '</button>' +
        (a ? '<button type="button" class="btn btn-danger-soft btn-block" id="ha-del">' + ic('trash', 18) + t('hall.deleteAsset') + '</button>' : ''),
      onRender: (b, api) => {
        const keep = () => { st.name = b.querySelector('#ha-name').value; const v = b.querySelector('#ha-val'); if (v) st.val = v.value; };
        b.querySelector('[data-close]').addEventListener('click', () => api.close());
        b.querySelectorAll('[data-hk]').forEach((x) => x.addEventListener('click', () => { keep(); st.kind = x.dataset.hk; api.render(); if (st.val != null && b.querySelector('#ha-val')) b.querySelector('#ha-val').value = st.val; }));
        b.querySelectorAll('[data-hc]').forEach((x) => x.addEventListener('click', () => { keep(); st.cur = x.dataset.hc; api.render(); if (st.val != null && b.querySelector('#ha-val')) b.querySelector('#ha-val').value = st.val; }));
        b.querySelector('#ha-go').addEventListener('click', () => {
          keep();
          const name = st.name.trim();
          if (!name) { b.querySelector('#ha-err').textContent = t('hall.errAsset'); ui().haptic(); return; }
          if (a) S().updateHallAccount(id, { name, kind: st.kind, cur: st.cur });
          else S().addHallAccount({ name, kind: st.kind, cur: st.cur, value: st.val != null && st.val !== '' ? num(st.val) : null });
          api.close(true); ui().sfx.chime();
          ui().toast(t(a ? 'hall.assetSaved' : 'hall.assetAdded', { name: '<b>' + esc(name) + '</b>' }), { icon: L().HALL_KINDS[st.kind], tone: 'success' });
        });
        const del = b.querySelector('#ha-del');
        if (del) del.addEventListener('click', () => {
          const gone = S().deleteHallAccount(id);
          api.close(true);
          ui().toast(t('hall.assetDeleted', { name: '<b>' + esc(gone.name) + '</b>' }), { icon: 'trash', action: t('common.undo'), actionIcon: 'undo', onAction: () => S().restoreHallAccount(id, gone) });
        });
      }
    });
  }
  function openRename() {
    const h0 = hall();
    ui().openSheet({
      label: t('hall.rename'),
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('hall.rename') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div class="form"><label class="field"><span class="f-l">' + t('hall.name') + '</span><input id="hr-name" maxlength="40" value="' + esc(h0.name) + '"></label><p class="hint">' + ic('users', 14) + '<span>' + t('hall.renameHint') + '</span></p></div>' +
        '<button type="button" class="btn btn-primary btn-block btn-lg" id="hr-go">' + t('common.save') + '</button>',
      onRender: (b, api) => {
        b.querySelector('[data-close]').addEventListener('click', () => api.close());
        b.querySelector('#hr-go').addEventListener('click', () => { const v = b.querySelector('#hr-name').value.trim(); if (v) S().renameHall(v); api.close(true); ui().sfx.chime(); });
      }
    });
  }

  Object.assign(A, {
    'hall-build': () => openBuild(),
    'hall-rename': () => openRename(),
    'hall-asset': (el) => openAsset(el.dataset.id || null)
  });
  FF.hall = { openBuild, page, after, openAsset, openAssetEdit };
})(window);
