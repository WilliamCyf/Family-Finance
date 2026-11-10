/* ============================================================
   FamFi — screens-menu.js
   Menu tab, language picker, settings, privacy, family group,
   badges & streaks, village friends, help, Monthly Budget.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, C = () => FF.calc;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const M = (v, o) => FF.i18n.money(v, o && o.cur, o);
  const ui = () => FF.ui;
  const A = FF.actions = FF.actions || {};

  const row = (o) => '<button type="button" class="row menu-row" ' + (o.attrs || '') + '><span class="mr-ic" style="--c:' + (o.color || 'var(--brand)') + '">' + (o.iconHtml || ic(o.icon, 20)) + '</span><span class="row-main"><span class="row-t">' + o.title + '</span>' + (o.sub ? '<span class="row-s">' + o.sub + '</span>' : '') + '</span>' + (o.end || '') + ic('chevR', 18) + '</button>';

  /* ===================================================== MENU */
  function menu() {
    const m = S().me(), f = S().family(), p = S().prefs();
    let h = FF.money.header(t('menu.title'));
    h += '<section class="card profile-card"><button type="button" class="pc-avatar" data-act="edit-profile" aria-label="' + esc(t('menu.editProfile')) + '">' + FF.art.avatar(m.avatar, 68) + '<span class="pc-edit">' + ic('edit', 14) + '</span></button><div class="row-main"><span class="pc-name">' + esc(m.name) + '</span>' + (m.email ? '<span class="row-s">' + esc(m.email) + '</span>' : '') + (f ? '<span class="chip">' + ic('house', 14) + esc(f.name) + '</span>' : '') + '</div></section>';
    // language — clearly visible, with a chip showing the current language
    h += '<section class="card list-card">' + row({ icon: 'globe', color: '#3D8FD6', title: t('menu.language'), sub: t('menu.languageSub'), end: '<span class="lang-chip" lang="' + FF.i18n.lang + '">' + FF.i18n.NATIVE[FF.i18n.lang] + '</span>', attrs: 'data-act="language" id="menu-lang"' }) + '</section>';
    h += '<h3 class="group-h">' + t('menu.family') + '</h3><section class="card list-card">' +
      row({ icon: 'users', color: '#2F9A4C', title: t('menu.group'), sub: f ? t('menu.groupSub', { n: f.members.length }) : t('menu.noGroup'), attrs: f ? 'data-act="page" data-page="family"' : 'data-act="create-family"' }) +
      (f ? row({ icon: 'userPlus', color: '#E0563F', title: t('menu.invite'), sub: t('menu.inviteSub'), attrs: 'data-act="invite"' }) : '') +
      row({ icon: 'shield', color: '#5D6B7E', title: t('menu.privacy'), sub: t('menu.privacySub'), attrs: 'data-act="page" data-page="privacy"' }) + '</section>';
    h += '<h3 class="group-h">' + t('menu.you') + '</h3><section class="card list-card">' +
      row({ iconHtml: '<span class="emo">🎯</span>', color: '#E9AE2E', title: t('budget.title'), sub: (m.budgets || []).length ? t('menu.budgetsN', { n: m.budgets.length, count: m.budgets.length }) : t('menu.budgetOff'), attrs: 'data-act="page" data-page="budget"' }) +
      row({ iconHtml: FF.art.gem(22), color: '#3DB2E8', title: t('menu.shop'), sub: t('menu.shopSub', { gems: FF.i18n.num(S().playOf(m).pts), n: FF.play.streakNow(S().playOf(m), S().dayNow()) }), attrs: 'data-act="shop"' }) +
      row({ icon: 'medal', color: '#C9A227', title: t('menu.badges'), sub: t('menu.badgesSub', { n: S().BADGES.filter((k) => m.badges && m.badges[k]).length, total: S().BADGES.length }), attrs: 'data-act="page" data-page="badges"' }) +
      (f ? row({ icon: 'paw', color: '#B07A45', title: t('menu.friends'), sub: t('menu.friendsSub', { n: Object.keys(f.pets || {}).length, total: S().PETS.length }), attrs: 'data-act="page" data-page="friends"' }) : '') + '</section>';
    h += '<h3 class="group-h">' + t('menu.settings') + '</h3><section class="card settings-card">' +
      '<div class="set-row"><span class="mr-ic" style="--c:#8A5BC7">' + ic('palette', 20) + '</span><span class="row-main"><span class="row-t">' + t('set.theme') + '</span><span class="row-s">' + t('set.autoB') + '</span></span></div>' + ui().segmented('theme', [{ v: 'system', l: t('set.auto') }, { v: 'light', l: t('set.light') }, { v: 'dark', l: t('set.dark') }], p.theme) +
      '<div class="set-row"><span class="mr-ic" style="--c:#2A9D8F">' + ic('textSize', 20) + '</span><span class="row-main"><span class="row-t">' + t('set.text') + '</span><span class="row-s">' + t('set.textSub') + '</span></span></div>' + ui().segmented('text', [{ v: 'default', l: '<span style="font-size:15px">A</span>' }, { v: 'large', l: '<span style="font-size:18px">A</span>' }, { v: 'xl', l: '<span style="font-size:21px">A</span>' }], p.text) +
      '<div class="set-row"><span class="mr-ic" style="--c:#3D8FD6">' + ic('motion', 20) + '</span><span class="row-main"><span class="row-t">' + t('set.motion') + '</span><span class="row-s">' + t('set.motionSub') + '</span></span>' + ui().toggle(document.documentElement.classList.contains('reduce-motion'), 'data-act="toggle-motion" aria-label="' + esc(t('set.motion')) + '"') + '</div>' +
      '<div class="set-row"><span class="mr-ic" style="--c:#E66FA0">' + ic('sound', 20) + '</span><span class="row-main"><span class="row-t">' + t('set.sound') + '</span></span>' + ui().toggle(p.sound !== false, 'data-act="toggle-sound" aria-label="' + esc(t('set.sound')) + '"') + '</div>' +
      '</section>';
    h += '<h3 class="group-h">' + t('menu.help') + '</h3><section class="card list-card">' +
      row({ icon: 'help', color: '#2F9A4C', title: t('menu.helpRow'), sub: t('menu.helpSub'), attrs: 'data-act="page" data-page="help"' }) +
      row({ icon: 'share', color: '#3D8FD6', title: t('menu.install'), sub: t('menu.installSub'), attrs: 'data-act="install"' }) + '</section>';
    const mode = S().mode();
    h += '<button type="button" class="btn btn-danger-soft btn-block" data-act="sign-out">' + ic('logout', 18) + t(mode === 'demo' ? 'menu.leaveDemo' : 'menu.signOut') + '</button>';
    if (mode === 'cloud') h += '<button type="button" class="btn btn-ghost btn-block btn-sm" data-act="delete-account">' + t('menu.delete') + '</button>';
    const cs = FF.cloud.status();
    h += '<p class="foot-note center" data-act="fps-tap">FamFi 2.25 · ' + (mode === 'demo' ? t('menu.demoNote') : mode === 'cloud' ? (cs.connected ? ic('check', 12) + t('menu.synced') : t('menu.offline')) : t('menu.local')) + '</p>';
    return h;
  }
  function afterMenu(el) {
    el.querySelectorAll('[data-seg]').forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('.seg-b'); if (!b) return;
      S().setPref(seg.dataset.seg, b.dataset.v);
      ui().sfx.tap();
      FF.app.applyPrefs();
      FF.app.refresh(true);
    }));
  }

  /* ===================================================== LANGUAGE SHEET */
  function openLanguage() {
    ui().openSheet({
      className: 'lang-sheet', label: t('menu.language'),
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + ic('globe', 22) + '<span>' + t('menu.language') + '</span></h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<p class="lead center">' + t('lang.lead') + '</p><div class="lang-list" role="radiogroup">' +
        FF.i18n.LANGS.map((l) => '<button type="button" class="lang-opt' + (l === FF.i18n.lang ? ' on' : '') + '" role="radio" aria-checked="' + (l === FF.i18n.lang) + '" data-lang="' + l + '"><span class="lo-flag" aria-hidden="true">' + { en: 'Aa', zh: '文', th: 'ก' }[l] + '</span><span class="row-main"><span class="lo-native" lang="' + l + '">' + FF.i18n.NATIVE[l] + '</span><span class="row-s">' + t('lang.' + l) + '</span></span><span class="lo-check">' + ic('check', 20) + '</span></button>').join('') +
        '</div><p class="hint center">' + ic('info', 14) + t('lang.note') + '</p><button type="button" class="btn btn-primary btn-block btn-lg" data-close>' + t('common.done') + '</button>',
      onRender: (body, api) => {
        body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
        body.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
          if (b.dataset.lang === FF.i18n.lang) return;
          ui().sfx.pop(); ui().haptic();
          FF.app.setLang(b.dataset.lang).then(() => { if (!api.closing) api.render(); });
        }));
      }
    });
  }

  /* ===================================================== PROFILE */
  function openProfile() {
    const m = S().me();
    const st = { avatar: JSON.parse(JSON.stringify(m.avatar)) };
    ui().openSheet({
      className: 'sheet-tall', label: t('menu.editProfile'), state: st,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('menu.editProfile') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div class="center">' + FF.art.avatar(st.avatar, 96) + '</div>' + FF.family.avatarPicker(st.avatar) +
        '<div class="form"><label class="field"><span class="f-l">' + t('signup.name') + '</span><input id="pf-name" maxlength="20" value="' + esc(m.name) + '"></label><p class="hint">' + ic('info', 14) + t('signup.nameHint') + '</p></div>' +
        '<button type="button" class="btn btn-primary btn-block btn-lg" id="pf-go">' + t('common.save') + '</button>',
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        FF.family.mountAvatarPicker(body, st, () => api.render());
        body.querySelector('#pf-go').addEventListener('click', () => {
          const name = body.querySelector('#pf-name').value.trim() || m.name;
          S().updateProfile({ name, avatar: st.avatar });
          api.close(true); ui().toast(t('common.saved'), { icon: 'check', tone: 'success' });
        });
      }
    });
  }

  /* ===================================================== PRIVACY */
  function privacyPage() {
    const m = S().me(), f = S().family();
    const others = S().familyMembers().filter((x) => x.id !== m.id);
    let h = '<p class="lead">' + t('privacy.lead') + '</p>';
    // family helpers (v2.25): one switch above the details — on, the family sees (and may add to) everything
    const help = S().helpOf(m);
    h += '<section class="card help-set"><div class="set-row"><span class="mr-ic" style="--c:#E9AE2E" aria-hidden="true"><span class="hs-emo">🤝</span></span><span class="row-main"><span class="row-t">' + t('help.setT') + '</span><span class="row-s">' + t(help ? 'help.setOn' : 'help.setOff') + '</span></span>' +
      ui().toggle(help, 'data-act="help-toggle" aria-label="' + esc(t('help.setT')) + '"') + '</div></section>';
    if (help) h += '<p class="hint">' + ic('info', 14) + '<span>' + t('help.privNote') + '</span></p>';
    h += '<section class="card list-card">' + S().SECTIONS.map((sec) => {
      const p = m.privacy[sec] || { mode: 'family' };
      const who = p.mode === 'some' ? (p.who || []).map((id) => S().member(id)).filter(Boolean).map((x) => esc(x.name)).join(', ') : '';
      return row({ icon: { netWorth: 'wallet', holdings: 'list', returns: 'trend', dividends: 'dividend' }[sec], color: p.mode === 'me' ? '#5D6B7E' : p.mode === 'some' ? '#E9AE2E' : '#2F9A4C', title: t('privacy.sec.' + sec), sub: p.mode === 'some' ? t('privacy.someList', { names: who || '—' }) : t('privacy.mode.' + p.mode), end: '<span class="priv-ic">' + ic(p.mode === 'me' ? 'lock' : 'eye', 16) + '</span>', attrs: 'data-act="privacy-edit" data-sec="' + sec + '"' });
    }).join('') + '</section>';
    h += '<p class="hint">' + ic('shield', 14) + t('privacy.note') + '</p>';
    if (f && others.length) {
      h += '<h3 class="group-h">' + t('privacy.preview') + '</h3><section class="card"><p class="row-s">' + t('privacy.previewSub') + '</p><div class="chips">' + others.map((o) => '<button type="button" class="chip-btn" data-act="preview-as" data-id="' + o.id + '">' + FF.art.avatar(o.avatar, 24) + esc(o.name) + '</button>').join('') + '</div></section>';
    }
    return h;
  }
  function openPrivacyEdit(sec) {
    const m = S().me();
    const cur = m.privacy[sec] || { mode: 'family', who: [] };
    const st = { mode: cur.mode, who: (cur.who || []).slice() };
    const others = S().familyMembers().filter((x) => x.id !== m.id);
    ui().openSheet({
      label: t('privacy.sec.' + sec), state: st,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('privacy.sec.' + sec) + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div><p class="lead">' + t('privacy.who') + '</p>' +
        '<div class="radio-list">' + ['family', 'some', 'me'].map((md) => '<button type="button" class="radio' + (st.mode === md ? ' on' : '') + '" data-mode="' + md + '"><span class="mr-ic" style="--c:' + (md === 'me' ? '#5D6B7E' : md === 'some' ? '#E9AE2E' : '#2F9A4C') + '">' + ic(md === 'family' ? 'users' : md === 'some' ? 'user' : 'lock', 18) + '</span><span class="row-main"><span class="row-t">' + t('privacy.mode.' + md) + '</span><span class="row-s">' + t('privacy.modeSub.' + md) + '</span></span><span class="radio-dot">' + ic('check', 16) + '</span></button>').join('') + '</div>' +
        (st.mode === 'some' ? '<div class="check-list">' + (others.length ? others.map((o) => '<button type="button" class="check-row' + (st.who.indexOf(o.id) !== -1 ? ' on' : '') + '" data-who="' + o.id + '">' + FF.art.avatar(o.avatar, 32) + '<span class="row-main"><span class="row-t">' + esc(o.name) + '</span></span><span class="cbox">' + ic('check', 14) + '</span></button>').join('') : '<p class="muted">' + t('privacy.noOthers') + '</p>') + '</div>' : '') +
        '<button type="button" class="btn btn-primary btn-block btn-lg" id="pv-go">' + t('common.save') + '</button>',
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        body.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { st.mode = b.dataset.mode; api.render(); }));
        body.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => { const id = b.dataset.who; const i = st.who.indexOf(id); if (i === -1) st.who.push(id); else st.who.splice(i, 1); b.classList.toggle('on'); }));
        body.querySelector('#pv-go').addEventListener('click', () => { S().setPrivacy(sec, st.mode, st.who); api.close(true); ui().toast(t('privacy.saved'), { icon: 'shield', tone: 'success' }); });
      }
    });
  }

  /* ===================================================== FAMILY GROUP */
  function familyPage() {
    const f = S().family(), me = S().me();
    const isOwner = f.ownerId === me.id;
    const real = !f.demo;
    let h = '<section class="card fam-card"><div class="fam-top">' + FF.art.emptyArt('village', 96) + '<div class="row-main"><span class="row-s">' + t('family.name') + '</span><span class="pc-name">' + esc(f.name) + '</span><span class="row-s">' + t('family.since', { date: FF.i18n.date(f.created) }) + '</span></div></div>' +
      (isOwner ? '<button type="button" class="btn btn-soft btn-sm" data-act="rename-family">' + ic('edit', 16) + t('family.rename') + '</button>' : '') + '</section>';
    h += '<h3 class="group-h">' + t('family.members', { n: f.members.length }) + '</h3><section class="card list-card">' + S().familyMembers().map((m) => {
      const s = C().summary(m.pf, m.pf.base);
      const lv = C().level(s.value * FF.data.fx(m.pf.base, 'MYR'));
      const kick = real && isOwner && m.id !== me.id ? '<button type="button" class="btn btn-ghost btn-sm" data-act="remove-member" data-id="' + esc(m.id) + '">' + t('family.remove') + '</button>' : '';
      return '<div class="row static">' + FF.art.avatar(m.avatar, 44) + '<span class="row-main"><span class="row-t">' + esc(m.name) + (m.id === me.id ? ' <span class="chip chip-brand">' + t('common.you') + '</span>' : '') + (m.id === f.ownerId ? ' <span class="chip">' + t('family.owner') + '</span>' : '') + '</span><span class="row-s">' + t('family.joined', { date: FF.i18n.date(m.joined) }) + (S().canSee(me.id, m.id, 'netWorth') ? ' · ' + t('level.n', { n: lv }) : '') + '</span></span>' + kick + '</div>';
    }).join('') + '</section>';
    h += '<button type="button" class="btn btn-primary btn-block btn-lg" data-act="invite">' + ic('userPlus', 20) + t('menu.invite') + '</button>';
    if (real) {
      h += '<div class="code-box"><span class="row-s">' + t('invite.code') + '</span><b class="code">' + esc(f.code) + '</b>' + (isOwner ? '<button type="button" class="btn btn-ghost btn-sm" data-act="new-code">' + ic('refresh', 16) + t('family.newCode') + '</button>' : '') + '</div>';
      h += '<button type="button" class="btn btn-danger-soft btn-block" data-act="leave-family">' + ic('exit', 18) + t('family.leave') + '</button>';
    }
    return h;
  }
  function openRename() {
    const f = S().family();
    ui().openSheet({
      label: t('family.rename'),
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('family.rename') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div><div class="form"><label class="field"><span class="f-l">' + t('family.name') + '</span><input id="fam-n" maxlength="28" value="' + esc(f.name) + '" autofocus></label></div><button type="button" class="btn btn-primary btn-block btn-lg" id="fam-go">' + t('common.save') + '</button>',
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        body.querySelector('#fam-go').addEventListener('click', () => { const v = body.querySelector('#fam-n').value.trim(); if (v) S().renameFamily(v); api.close(true); });
      }
    });
  }

  /* ===================================================== BADGES & STREAKS */
  const BADGE_EMO = {};
  FF.play.BADGES.forEach((b) => { BADGE_EMO[b.k] = b.e; });
  function badgesPage() {
    const m = S().me();
    const st = S().streakOf(m.id);
    const s = C().summary(m.pf, m.pf.base);
    const lvVal = s.value * FF.data.fx(m.pf.base, 'MYR');
    const lv = C().level(lvVal), next = C().nextLevelAt(lv);
    let h = '<section class="card streak-card"><div class="streak-top"><span class="streak-sprout s' + Math.min(4, Math.ceil(st.weeks / 2)) + '">🌱</span><div><b class="streak-n">' + t('streak.weeks', { n: st.weeks }) + '</b><p class="row-s">' + t('streak.explain') + '</p></div></div>' +
      '<div class="week-dots" aria-label="' + esc(t('streak.last8')) + '">' + st.recent.map((on, i) => '<span class="wd' + (on ? ' on' : '') + (i === 7 ? ' now' : '') + '"></span>').join('') + '</div>' +
      '<p class="hint">' + (st.thisWeek ? ic('check', 14) + t('streak.doneWeek') : ic('info', 14) + t('streak.todo')) + '</p></section>';
    h += '<section class="card level-card"><div class="lvl-top"><div class="lvl-house">' + FF.art.houseHtml(m.house, lv, { still: true }) + '</div><div><span class="row-s">' + t('level.yourHouse') + '</span><b class="pc-name">' + t('level.n', { n: lv }) + ' · ' + t('level.name.' + lv) + '</b>' +
      (next ? '<p class="row-s">' + t('level.next', { amount: M(next * FF.data.fx('MYR', m.pf.base), { cur: m.pf.base, whole: true }) }) + '</p><div class="meter"><span style="width:' + (FF.clamp(lvVal / next, 0, 1) * 100).toFixed(1) + '%"></span></div>' : '<p class="row-s">' + t('level.max') + '</p>') + '</div></div>' +
      FF.shop.houseLadder(m) + '<p class="hint">' + ic('info', 14) + t('level.note') + '</p></section>';
    const all = S().BADGES, gotN = all.filter((k) => m.badges && m.badges[k]).length;
    h += '<h3 class="group-h">' + t('badges.title') + ' · ' + gotN + '/' + all.length + '</h3>';
    FF.play.TIER_ORDER.forEach((tier) => {
      const list = FF.play.BADGES.filter((b) => b.tier === tier);
      h += '<div class="tier-h t-' + tier + '"><span class="tier-dot" aria-hidden="true"></span><b>' + t('badges.tier.' + tier) + '</b><span class="tier-gems">+' + FF.play.TIERS[tier] + FF.art.gem(14) + ' ' + t('badges.each') + '</span></div><div class="badge-grid">' + list.map((b) => {
        const got = m.badges && m.badges[b.k];
        return '<div class="badge t-' + tier + (got ? ' got' : '') + '"><span class="b-emo">' + b.e + '</span><b>' + t('badge.' + b.k) + '</b><span class="row-s">' + (got ? t('badges.on', { date: FF.i18n.dateShort(got) }) : t('badge.' + b.k + '.how')) + '</span></div>';
      }).join('') + '</div>';
    });
    return h;
  }

  /* ===================================================== VILLAGE FRIENDS */
  function friendsPage() {
    const f = S().family();
    let h = '<p class="lead">' + t('friends.lead') + '</p><div class="friend-grid">';
    S().PETS.forEach((p) => {
      const got = f && f.pets && f.pets[p];
      h += '<div class="friend' + (got ? ' got' : '') + '"><div class="fr-art an-' + p + '">' + FF.art.animal(p) + '</div><b>' + t('pet.' + p + '.name') + '</b><span class="row-s">' + (got ? t('pet.' + p + '.bio') : ic('lock', 12) + ' ' + t('pet.' + p + '.how')) + '</span></div>';
    });
    return h + '</div>';
  }


  /* ===================================================== HELP */
  function helpPage() {
    const qs = ['what', 'prices', 'safe', 'who', 'stocks', 'family', 'offline', 'install'];
    return '<p class="lead">' + t('help.lead') + '</p>' + qs.map((q) => '<details class="card faq"><summary>' + t('help.' + q + '.q') + ic('chevD', 18) + '</summary><p>' + t('help.' + q + '.a') + '</p></details>').join('') +
      '<section class="card"><div class="card-head"><h2>' + t('help.glossary') + '</h2></div><div class="chips">' + ['netWorth', 'gain', 'cash', 'stock', 'etf', 'crypto', 'dividend', 'diversify', 'return', 'fxEffect', 'fees', 'avgCost'].map((k) => '<button type="button" class="chip-btn" data-learn="' + k + '">' + t('learn.' + k + '.t') + '</button>').join('') + '</div></section>';
  }

  /* ===================================================== BUDGETS */
  const Lg = () => FF.ledger;
  function budgetPage() {
    const m = S().me(), base = m.pf.base;
    const bs = (m.budgets || []).map((b) => ({ b, p: Lg().budgetProgress(b, m.pf) }));
    let h = '';
    if (!bs.length) {
      h += '<div class="empty">' + FF.art.emptyArt('basket', 120) + '<h3>' + t('budget.emptyT') + '</h3><p>' + t('budget.emptyB') + '</p></div>';
      const inc = Lg().monthStats(m.pf, base, FF.ymd(FF.today()).y, FF.ymd(FF.today()).m);
      const suggest = [{ cats: [], share: 0.7 }, { cats: ['food'], share: 0.15 }, { cats: ['groceries'], share: 0.12 }, { cats: ['transport'], share: 0.08 }, { cats: ['fun', 'shopping'], share: 0.06 }];
      const basis = inc.income > 100 ? inc.income : base === 'THB' ? 30000 : 4000;
      h += '<h3 class="group-h">' + t('budget.ideas') + '</h3><section class="card list-card">' + suggest.map((x) => {
        const amt = Math.round(basis * x.share / 10) * 10;
        const fake = { cats: x.cats };
        return '<button type="button" class="row" data-act="budget-new" data-cats="' + x.cats.join(',') + '" data-amt="' + amt + '"><span class="cat-emo sm" aria-hidden="true">' + FF.money.budgetIcon(fake) + '</span><span class="row-main"><span class="row-t">' + esc(FF.money.budgetName(fake)) + '</span><span class="row-s">' + t('budget.perMonth', { amount: M(amt, { cur: base, whole: true }) }) + '</span></span>' + ic('plus', 18) + '</button>';
      }).join('') + '</section>';
    } else {
      h += '<section class="card budgets-card">' + bs.map((x) => FF.money.budgetRow(x.b, x.p)).join('') + '</section>';
    }
    h += '<button type="button" class="btn btn-primary btn-block btn-lg" data-act="budget-new">' + ic('plus', 20) + t('budget.new') + '</button>';
    // where this month's money went
    const tp = FF.ymd(FF.today());
    const ms = Lg().monthStats(m.pf, base, tp.y, tp.m);
    if (ms.byCat.length) {
      h += '<h3 class="group-h">' + t('budget.whereWent', { month: FF.i18n.monthYear(tp.y, tp.m) }) + '</h3><section class="card list-card">' + ms.byCat.map((c) => '<button type="button" class="row" data-act="cat-records" data-cat="' + c.cat.id + '"><span class="cat-emo sm" aria-hidden="true">' + c.cat.icon + '</span><span class="row-main"><span class="row-t">' + t('cat.' + c.cat.id) + '</span><span class="bar"><span style="width:' + (c.pct * 100).toFixed(1) + '%;--c:' + c.cat.color + '"></span></span></span><span class="row-end"><span class="row-v num">' + M(c.amt, { cur: base, whole: true }) + '</span><span class="row-s">' + FF.i18n.pct(c.pct, { dp: 0 }) + '</span></span></button>').join('') + '</section>';
    }
    h += '<p class="foot-note">' + ic('info', 14) + '<span>' + t('budget.how') + '</span></p>';
    return h;
  }
  function afterBudget() { /* rows use global actions */ }
  /* create or change a budget */
  function openBudgetEdit(id, preset) {
    const m = S().me(), base = m.pf.base;
    const b = id ? (m.budgets || []).find((x) => x.id === id) : null;
    const st = b ? { name: b.name || '', amt: String(b.amt), period: b.period || 'month', cats: (b.cats || []).slice() } : Object.assign({ name: '', amt: '', period: 'month', cats: [] }, preset || {});
    const cur = b ? b.cur : base;
    ui().openSheet({
      className: 'sheet-tall', label: t(b ? 'budget.editT' : 'budget.new'), state: st,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t(b ? 'budget.editT' : 'budget.new') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<label class="amt-wrap"><span class="amt-cur">' + cur + '</span><input id="bg-amt" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(st.amt) + '" aria-label="' + esc(t('budget.amount')) + '"></label>' +
        ui().segmented('bg-period', [{ v: 'month', l: t('budget.monthly') }, { v: 'week', l: t('budget.weekly') }], st.period) +
        '<div class="form"><div class="field"><span class="f-l">' + t('budget.covers') + '</span><div class="chips"><button type="button" class="chip-btn' + (!st.cats.length ? ' on' : '') + '" data-allcats>🎯 ' + t('budget.allSpending') + '</button></div>' +
        '<div class="cat-grid">' + Lg().EXPENSE.map((c) => '<button type="button" class="cat-btn' + (st.cats.indexOf(c.id) !== -1 ? ' on' : '') + '" data-bcat="' + c.id + '" style="--c:' + c.color + '"><span class="cb-ic" aria-hidden="true">' + c.icon + '</span><span class="cb-n">' + t('cat.' + c.id) + '</span></button>').join('') + '</div></div>' +
        '<label class="field"><span class="f-l">' + t('budget.nameOpt') + '</span><input id="bg-name" maxlength="30" value="' + esc(st.name) + '" placeholder="' + esc(FF.money.budgetName({ cats: st.cats })) + '"></label></div>' +
        '<p class="form-err" id="bg-err" role="alert"></p><button type="button" class="btn btn-primary btn-block btn-lg" id="bg-go">' + t('common.save') + '</button>' +
        (b ? '<button type="button" class="btn btn-danger-soft btn-block" id="bg-del">' + ic('trash', 18) + t('budget.delete') + '</button>' : ''),
      onRender: (body, api) => {
        const keep = () => { st.amt = body.querySelector('#bg-amt').value; st.name = body.querySelector('#bg-name').value; };
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        body.querySelector('[data-seg="bg-period"]').addEventListener('click', (e) => { const x = e.target.closest('.seg-b'); if (!x) return; keep(); st.period = x.dataset.v; api.render(); });
        body.querySelector('[data-allcats]').addEventListener('click', () => { keep(); st.cats = []; api.render(); });
        body.querySelectorAll('[data-bcat]').forEach((x) => x.addEventListener('click', () => { keep(); const c = x.dataset.bcat; const i = st.cats.indexOf(c); if (i === -1) st.cats.push(c); else st.cats.splice(i, 1); ui().sfx.tap(); api.render(); }));
        body.querySelector('#bg-go').addEventListener('click', () => {
          keep();
          const amt = parseFloat(String(st.amt).replace(/,/g, ''));
          if (!(amt > 0)) { body.querySelector('#bg-err').textContent = t('budget.err'); ui().haptic(); return; }
          const data = { name: st.name.trim(), amt, period: st.period, cats: st.cats.slice() };
          if (b) S().updateBudget(b.id, data); else S().addBudget(Object.assign(data, { cur }));
          api.close(true); ui().sfx.chime();
          ui().toast(t(b ? 'budget.saved' : 'budget.created', { name: '<b>' + esc(data.name || FF.money.budgetName(data)) + '</b>' }), { icon: '🎯', tone: 'success' });
        });
        const del = body.querySelector('#bg-del');
        if (del) del.addEventListener('click', () => {
          const gone = S().deleteBudget(b.id);
          api.close(true);
          ui().toast(t('budget.deleted'), { icon: 'trash', action: t('common.undo'), actionIcon: 'undo', onAction: () => S().restoreBudget(gone) });
        });
      }
    });
  }

  /* ---------- actions ---------- */
  Object.assign(A, {
    language: () => openLanguage(),
    'edit-profile': () => openProfile(),
    'toggle-motion': (el) => { const on = !el.classList.contains('on'); S().setPref('motion', on ? 'reduce' : 'full'); FF.app.applyPrefs(); el.classList.toggle('on', on); el.setAttribute('aria-checked', on); ui().sfx.tap(); FF.app.refresh(true); },
    'toggle-sound': (el) => { const on = !el.classList.contains('on'); S().setPref('sound', on); el.classList.toggle('on', on); el.setAttribute('aria-checked', on); if (on) ui().sfx.chime(); },
    'privacy-edit': (el) => openPrivacyEdit(el.dataset.sec),
    'preview-as': (el) => FF.app.openVisit(S().state.meId, { viewer: el.dataset.id }),
    'rename-family': () => openRename(),
    'budget-open': (el) => openBudgetEdit(el.dataset.id),
    'budget-new': (el) => openBudgetEdit(null, el && el.dataset.amt ? { amt: el.dataset.amt, cats: el.dataset.cats ? el.dataset.cats.split(',') : [] } : null),
    install: () => ui().openSheet({ label: t('menu.install'), render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('menu.install') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div><div class="center">' + FF.art.logo(84) + '</div><ol class="install-steps"><li>' + ic('share', 20) + t('install.s1') + '</li><li>' + ic('plus', 20) + t('install.s2') + '</li><li>' + ic('check', 20) + t('install.s3') + '</li></ol>', onRender: (b, api) => b.querySelector('[data-close]').addEventListener('click', () => api.close()) }),
    'sign-out': () => {
      const demo = S().mode() === 'demo';
      const title = t(demo ? 'menu.leaveDemo' : 'menu.signOut');
      confirmSheet({ title, body: t(demo ? 'signout.demoB' : 'signout.b'), cta: demo ? title : t('signout.cta'), go: () => FF.app.signOut() });
    },
    'delete-account': () => openDeleteAccount(),
    'leave-family': () => {
      const f = S().family(), me = S().me();
      const rest = S().familyMembers().filter((m) => m.id !== me.id);
      const body = t('family.leaveB') + (f.ownerId === me.id ? ' ' + (rest.length ? t('family.leaveOwnerB', { name: '<b>' + esc(rest[0].name) + '</b>' }) : t('family.leaveLastB')) : '');
      confirmSheet({ title: t('family.leaveT', { family: esc(f.name) }), body, cta: t('family.leave'), work: async () => {
        await FF.cloud.leaveFamily();
        FF.app.clearScreens();
        FF.family.flow.st = {};
        FF.app.startFlow('choice');
        ui().toast(t('family.left', { family: '<b>' + esc(f.name) + '</b>' }), { icon: '🏡' });
      } });
    },
    'remove-member': (el) => {
      const m = S().member(el.dataset.id);
      if (!m) return;
      confirmSheet({ title: t('family.removeT', { name: esc(m.name) }), body: t('family.removeB', { name: '<b>' + esc(m.name) + '</b>' }), cta: t('family.remove'), work: async () => {
        const code = await FF.cloud.removeMember(m.id);
        ui().toast(t('family.removed', { name: '<b>' + esc(m.name) + '</b>', code: '<b>' + esc(code || '') + '</b>' }), { icon: 'check', tone: 'success', duration: 6000 });
      } });
    },
    'new-code': () => confirmSheet({ title: t('family.newCode'), body: t('family.newCodeB'), cta: t('family.newCode'), danger: false, work: async () => {
      const code = await FF.cloud.newCode();
      ui().toast(t('family.codeChanged', { code: '<b>' + esc(code || '') + '</b>' }), { icon: 'check', tone: 'success', duration: 6000 });
    } })
  });

  /* a yes/no sheet; `work` runs with the button showing progress, errors stay in the sheet */
  function confirmSheet(o) {
    ui().openSheet({
      label: o.title,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + o.title + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div><p class="lead">' + o.body + '</p>' + (o.extra || '') +
        '<p class="form-err" role="alert"></p><button type="button" class="btn ' + (o.danger === false ? 'btn-primary' : 'btn-danger') + ' btn-block btn-lg" id="cf-go">' + o.cta + '</button><button type="button" class="btn btn-ghost btn-block" data-close>' + t('common.cancel') + '</button>',
      onRender: (b, api) => {
        b.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', () => api.close()));
        b.querySelector('#cf-go').addEventListener('click', async (e) => {
          if (!o.work) { api.close(true); o.go(); return; }
          const btn = e.currentTarget, err = b.querySelector('.form-err');
          if (btn.disabled) return;
          btn.disabled = true; btn.classList.add('busy'); err.textContent = '';
          try { await o.work(b); api.close(true); FF.app.refresh(true); }
          catch (x) { console.warn('FamFi:', x && (x.code || x.message)); err.textContent = t({ offline: 'err.offline', timeout: 'err.offline', 'auth/network-request-failed': 'err.offline', 'auth/wrong-password': 'signin.err.wrong', 'auth/invalid-credential': 'signin.err.wrong', 'auth/invalid-login-credentials': 'signin.err.wrong', 'auth/too-many-requests': 'err.tooMany', 'signed-out': 'signin.again' }[x && x.code] || 'err.generic'); ui().haptic(); }
          finally { btn.disabled = false; btn.classList.remove('busy'); }
        });
      }
    });
  }
  function openDeleteAccount() {
    confirmSheet({
      title: t('delete.t'), body: t('delete.b'), cta: t('delete.cta'),
      extra: '<div class="form"><label class="field"><span class="f-l">' + t('delete.pw') + '</span><input id="del-pw" type="password" autocomplete="current-password"></label></div>',
      work: async (b) => {
        const pw = b.querySelector('#del-pw').value;
        if (!pw) { const e = new Error('pw'); e.code = 'auth/wrong-password'; throw e; }
        const r = await FF.cloud.deleteAccount(pw);
        await FF.app.signOut();
        ui().toast(t('delete.done'), { icon: 'check', tone: 'success', duration: 7000 });
      }
    });
  }

  FF.menu = { menu, afterMenu, openLanguage, privacyPage, familyPage, badgesPage, friendsPage, helpPage, budgetPage, afterBudget, openBudgetEdit, BADGE_EMO };
})(window);
