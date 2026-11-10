/* ============================================================
   FamFi — screens-shop.js
   The Shop (decorations + exclusive pets, bought with gems), the
   daily gift with its streak, "how to earn gems", the house-level
   ladder and the little celebrations (gems popping in, a house
   growing a level). Rules: play.js · state: store.js.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, Pl = () => FF.play;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const ui = () => FF.ui;
  const A = FF.actions = FF.actions || {};
  const num = (n) => FF.i18n.num ? FF.i18n.num(n) : String(n);
  const gems = (n, size) => '<span class="gems num">' + FF.art.gem(size || 16) + '<b>' + num(n) + '</b></span>';
  const itemName = (id) => (id === 'shield' ? t('shop.shield') : Pl().item(id) && Pl().item(id).kind === 'pet' ? t('xpet.' + id + '.name') : t('deco.' + id));
  let tab = 'deco';

  /* ===================================================== SHOP PAGE */
  function shopPage() {
    const m = S().me(), p = S().playOf(m), day = S().dayNow();
    const v = Pl().preview(p, day);
    const streak = Pl().streakNow(p, day);
    let h = '<section class="card shop-hero"><div class="sh-row"><div><span class="kicker">' + t('shop.yourGems') + '</span><div class="sh-bal" data-gem-bal>' + FF.art.gem(30) + '<b class="num">' + num(p.pts) + '</b></div></div>' +
      '<div class="sh-streak' + (streak ? ' on' : '') + '"><span class="flame" aria-hidden="true">🔥</span><b class="num">' + streak + '</b><span>' + t('daily.days', { n: streak, count: streak }) + '</span></div></div>' +
      (v.claimed ? '<button type="button" class="btn btn-soft btn-block" data-act="daily">' + ic('check', 18) + t('daily.doneShort', { gems: num(Pl().giftFor(p.streak + 1)) }) + '</button>'
        : '<button type="button" class="btn btn-sun btn-block btn-lg gift-ready" data-act="daily"><span class="gift-emo" aria-hidden="true">🎁</span>' + t('daily.collect', { gems: num(v.gift + v.chest) }) + '</button>') +
      '<button type="button" class="link-btn earn-link" data-act="earn-info">' + ic('info', 16) + t('shop.earn') + '</button></section>';
    h += ui().segmented('shop', [{ v: 'deco', l: t('shop.tab.deco') }, { v: 'pets', l: t('shop.tab.pets') }], tab, 'seg-shop');
    if (tab === 'deco') {
      h += '<p class="lead small">' + t('shop.decoLead') + '</p>';
      Pl().SLOTS.forEach((slot) => {
        const items = Pl().DECOR.filter((d) => d.slot === slot && (!d.lucky || Pl().owns(p, d.id))); // Lucky Market exclusives: once you have them
        h += '<h3 class="group-h">' + t('shop.slot.' + slot) + '</h3><div class="shop-grid">' + items.map((d) => card(d, p, m)).join('') + '</div>';
      });
      h += '<h3 class="group-h">' + t('shop.helpful') + '</h3><div class="shop-grid">' + shieldCard(p) + '</div>';
    } else {
      h += '<p class="lead small">' + t('shop.petsLead', { n: Pl().MAX_PETS }) + '</p><div class="shop-grid pets">' + Pl().PETS.map((x) => card(x, p, m)).join('') + '</div>';
    }
    return h;
  }
  function card(it, p, m) {
    const owned = Pl().owns(p, it.id);
    const pet = it.kind === 'pet';
    const on = pet ? (m.house.pets || []).indexOf(it.id) !== -1 : m.house.deco && m.house.deco[it.slot] === it.id;
    const art = pet ? '<span class="sc-pet an-' + it.id + ' idle' + (FF.art.PET_FLY[it.id] ? ' flyer' : '') + '">' + FF.art.xpet(it.id) + '</span>' : FF.art.decoThumb(it.id);
    const state = owned ? '<span class="sc-state' + (on ? ' on' : '') + '">' + (on ? ic('check', 13) + t(pet ? 'shop.atHome' : 'shop.on') : t(pet ? 'shop.resting' : 'shop.owned')) + '</span>'
      : '<span class="sc-price' + (p.pts < it.price ? ' short' : '') + '">' + gems(it.price, 14) + '</span>';
    return '<button type="button" class="shop-card r-' + it.r + (owned ? ' owned' : '') + (on ? ' on' : '') + '" data-act="shop-item" data-id="' + it.id + '"><span class="sc-art">' + art + '</span>' +
      '<span class="sc-r">' + t('shop.r.' + it.r) + '</span><b class="sc-name" data-fit="12">' + esc(itemName(it.id)) + '</b>' + state + '</button>';
  }
  function shieldCard(p) {
    const S0 = Pl().SHIELD;
    return '<button type="button" class="shop-card r-common shield" data-act="shop-item" data-id="shield"><span class="sc-art"><span class="shield-emo">🛡️</span></span><span class="sc-r">' + t('shop.shieldHave', { n: p.shields, max: S0.max }) + '</span><b class="sc-name" data-fit="12">' + t('shop.shield') + '</b><span class="sc-price' + (p.pts < S0.price ? ' short' : '') + '">' + gems(S0.price, 14) + '</span></button>';
  }
  function afterShop(el) {
    const seg = el.querySelector('[data-seg="shop"]');
    if (seg) seg.addEventListener('click', (e) => { const b = e.target.closest('.seg-b'); if (!b || b.dataset.v === tab) return; tab = b.dataset.v; ui().sfx.tap(); FF.app.refresh(true); });
  }

  /* ===================================================== ONE ITEM */
  function openItem(id) {
    if (id === 'shield') { openShield(); return; }
    const it = Pl().item(id);
    if (!it) return;
    const st = { confirm: false };
    ui().openSheet({
      className: 'item-sheet', label: itemName(id), state: st,
      render: () => {
        const m = S().me(), p = S().playOf(m);
        const owned = Pl().owns(p, id), pet = it.kind === 'pet';
        const lv = FF.family.levelOf(m);
        let stage;
        if (pet) stage = '<div class="item-stage pet-stage"><div class="ps-pet sp animal an-' + id + ' walk' + (FF.art.PET_FLY[id] ? ' flyer' : '') + '">' + '<div class="an-flip">' + FF.art.xpet(id) + '</div></div></div>';
        else {
          const h = JSON.parse(JSON.stringify(m.house));
          h.deco = Object.assign({}, h.deco); h.deco[it.slot] = id;
          stage = '<div class="item-stage"><div class="is-house">' + FF.art.houseHtml(h, lv, { pets: true }) + '</div><div class="is-zoom" aria-hidden="true">' + FF.art.decoThumb(id) + '</div></div>';
        }
        let body = '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + esc(itemName(id)) + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' + stage +
          '<div class="item-meta"><span class="chip r-chip r-' + it.r + '">' + t('shop.r.' + it.r) + '</span><span class="chip">' + (pet ? '🐾 ' + t('shop.tab.pets') : t('shop.slot.' + it.slot)) + '</span>' + (owned ? '' : '<span class="chip">' + gems(it.price, 13) + '</span>') + '</div>' +
          '<p class="item-desc">' + t(pet ? 'xpet.' + id + '.bio' : 'deco.' + id + '.b') + '</p>';
        if (!owned) {
          const short = it.price - p.pts;
          if (short > 0) body += '<p class="hint warn">' + ic('info', 14) + '<span>' + t('shop.short', { gems: num(short), n: Math.ceil(short / 20) }) + '</span></p><button type="button" class="btn btn-soft btn-block btn-lg" data-act="daily">🎁 ' + t('daily.title') + '</button>';
          else {
            if (!pet && m.house.deco && m.house.deco[it.slot]) body += '<p class="hint">' + ic('info', 14) + '<span>' + t('shop.replaces', { name: esc(itemName(m.house.deco[it.slot])) }) + '</span></p>';
            body += '<button type="button" class="btn ' + (st.confirm ? 'btn-sun confirm' : 'btn-primary') + ' btn-block btn-lg" id="item-buy">' + (st.confirm ? t('shop.confirm', { left: num(p.pts - it.price) }) : t(pet ? 'shop.adopt' : 'shop.buyFor', { price: gems(it.price, 18) })) + '</button>';
          }
        } else if (pet) {
          const home = m.house.pets || [];
          if (home.indexOf(id) !== -1) body += '<button type="button" class="btn btn-soft btn-block btn-lg" id="pet-rest">' + t('shop.rest') + '</button>';
          else if (home.length < Pl().MAX_PETS) body += '<button type="button" class="btn btn-primary btn-block btn-lg" id="pet-home">🏡 ' + t('shop.bringHome') + '</button>';
          else body += '<p class="hint">' + ic('info', 14) + '<span>' + t('shop.full', { n: Pl().MAX_PETS }) + '</span></p><div class="swap-row">' + home.map((x) => '<button type="button" class="btn btn-soft" data-swap="' + x + '"><span class="swap-pet an-' + x + '">' + FF.art.xpet(x) + '</span>' + t('shop.swapFor', { name: esc(itemName(x)) }) + '</button>').join('') + '</div>';
        } else {
          const on = m.house.deco && m.house.deco[it.slot] === id;
          body += on ? '<button type="button" class="btn btn-soft btn-block btn-lg" id="deco-off">' + t('shop.takeOff') + '</button>' : '<button type="button" class="btn btn-primary btn-block btn-lg" id="deco-on">' + ic('check', 18) + t('shop.putOn') + '</button>';
        }
        return body;
      },
      onRender: (body, api) => {
        body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
        const buy = body.querySelector('#item-buy');
        if (buy) buy.addEventListener('click', () => {
          if (!st.confirm) { st.confirm = true; ui().sfx.tap(); ui().haptic(); api.render(); clearTimeout(st.k); st.k = setTimeout(() => { if (st.confirm) { st.confirm = false; if (!api.closing) api.render(); } }, 4000); return; }
          clearTimeout(st.k);
          const r = S().buyItem(id);
          if (!r.ok) { ui().toast(t('shop.short', { gems: num(it.price - S().playOf().pts), n: Math.ceil((it.price - S().playOf().pts) / 20) }), { icon: 'info' }); return; }
          api.close(true);
          bought(id, r);
        });
        const on = body.querySelector('#deco-on'), off = body.querySelector('#deco-off');
        if (on) on.addEventListener('click', () => { const b = S().setDeco(it.slot, id); ui().sfx.chime(); api.render(); ui().toast(t('shop.putOnDone', { name: '<b>' + esc(itemName(id)) + '</b>' }), { icon: '🏡', tone: 'success', action: t('shop.seeIt'), onAction: () => seeHouse() }); FF.app.celebrate({ badges: b }); });
        if (off) off.addEventListener('click', () => { S().setDeco(it.slot, null); ui().sfx.tap(); api.render(); });
        const home = body.querySelector('#pet-home'), rest = body.querySelector('#pet-rest');
        if (home) home.addEventListener('click', () => { S().setPetHome(id, true); ui().sfx.animal(id); api.render(); ui().toast(t('shop.petHome', { name: '<b>' + esc(itemName(id)) + '</b>' }), { icon: '🐾', tone: 'success', action: t('shop.seeIt'), onAction: () => seeHouse() }); });
        if (rest) rest.addEventListener('click', () => { S().setPetHome(id, false); ui().sfx.tap(); api.render(); });
        body.querySelectorAll('[data-swap]').forEach((b) => b.addEventListener('click', () => { S().setPetHome(id, true, b.dataset.swap); ui().sfx.animal(id); api.render(); }));
        const pet = body.querySelector('.ps-pet');
        if (pet) pet.addEventListener('click', () => { ui().sfx.animal(id); pet.classList.remove('wiggle'); void pet.offsetWidth; pet.classList.add('wiggle'); });
      },
      onClose: () => clearTimeout(st.k)
    });
  }
  function bought(id, r) {
    const it = Pl().item(id), pet = it && it.kind === 'pet';
    ui().sfx.success(); ui().haptic();
    ui().confetti({ n: it && (it.r === 'legendary' || it.r === 'epic') ? 170 : 110 });
    const name = '<b>' + esc(itemName(id)) + '</b>';
    const msg = pet ? (r.home ? t('shop.boughtPet', { name }) : t('shop.boughtRest', { name })) : t('shop.bought', { name });
    ui().toast(msg, { icon: pet ? '🐾' : '🎉', tone: 'success', action: t('shop.seeIt'), onAction: () => seeHouse(), duration: 6000 });
    if (r.badges && r.badges.length) setTimeout(() => FF.app.celebrate({ badges: r.badges }), 1800);
  }
  /* jump to the village and look at your own house */
  function seeHouse() {
    while (FF.app.state.pages.length) FF.app.pop(true);
    ui().closeAllSheets();
    FF.app.go('family');
    setTimeout(() => FF.village.bounce(S().state.meId), 250);
  }
  function openShield() {
    const SH = Pl().SHIELD;
    ui().openSheet({
      label: t('shop.shield'),
      render: () => {
        const p = S().playOf();
        const why = Pl().canBuy(p, 'shield');
        return '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('shop.shield') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
          '<div class="shield-big" aria-hidden="true">🛡️</div><p class="item-desc">' + t('shop.shieldB', { n: SH.max }) + '</p><p class="center"><span class="chip">' + t('shop.shieldHave', { n: p.shields, max: SH.max }) + '</span></p>' +
          (why === 'full' ? '<p class="hint">' + ic('check', 14) + t('shop.shieldFull') + '</p>' : why === 'short' ? '<p class="hint warn">' + ic('info', 14) + '<span>' + t('shop.short', { gems: num(SH.price - p.pts), n: Math.ceil((SH.price - p.pts) / 20) }) + '</span></p>'
            : '<button type="button" class="btn btn-primary btn-block btn-lg" id="shield-buy">' + t('shop.buyFor', { price: gems(SH.price, 18) }) + '</button>');
      },
      onRender: (body, api) => {
        body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
        const b = body.querySelector('#shield-buy');
        if (b) b.addEventListener('click', () => { const r = S().buyItem('shield'); if (r.ok) { ui().sfx.success(); ui().toast(t('shop.shieldBought'), { icon: '🛡️', tone: 'success' }); api.render(); } });
      }
    });
  }

  /* ===================================================== DAILY GIFT */
  let dailyApi = null;
  function openDaily(auto) {
    if (dailyApi && !dailyApi.closing) return; // (closeAllSheets closes it without onClose)
    const st = { res: null };
    dailyApi = ui().openSheet({
      className: 'daily-sheet', label: t('daily.title'), state: st,
      render: () => {
        const p = S().playOf(), day = S().dayNow();
        const v = Pl().preview(p, day);
        const r = st.res;
        const streak = r ? r.streak : v.claimed ? p.streak : Math.max(0, Pl().streakNow(p, day));
        const week = r ? Pl().weekOf(r.streak, true) : v.week;
        let h = '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('daily.title') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>';
        h += '<div class="dg-top"><div class="dg-flame' + (streak ? ' on' : '') + '"><span aria-hidden="true">🔥</span><b class="num">' + streak + '</b></div><div><b class="dg-t">' + t('daily.streak', { n: streak, count: streak }) + '</b><span class="row-s">' + t('daily.best', { n: Math.max(p.best, streak) }) + (p.shields ? ' · 🛡️ ' + t('daily.shields', { n: p.shields, count: p.shields }) : '') + '</span></div>' +
          '<span class="dg-bal" data-gem-bal>' + FF.art.gem(20) + '<b class="num">' + num(p.pts) + '</b></span></div>';
        h += '<ol class="dg-week">' + week.map((d) => '<li class="dg-day ' + d.state + (d.i === 6 ? ' big' : '') + '"><span class="dg-d">' + t('daily.day', { n: d.i + 1 }) + '</span><span class="dg-ic" aria-hidden="true">' + (d.i === 6 ? '🎁' : FF.art.gem(22)) + '</span><b class="num">' + d.gems + '</b>' + (d.state === 'done' ? '<span class="dg-ok">' + ic('check', 12) + '</span>' : '') + '</li>').join('') + '</ol>';
        if (!r && !v.claimed) {
          if (v.lost) h += '<p class="hint warn">' + ic('info', 14) + '<span>' + t('daily.lost', { n: v.lost }) + '</span></p>';
          if (v.shieldsUsed) h += '<p class="hint">🛡️ <span>' + t('daily.willSave') + '</span></p>';
          if (v.chest) h += '<p class="dg-chest">🎉 ' + t('daily.chest', { n: v.chest }) + '</p>';
          h += '<button type="button" class="btn btn-sun btn-block btn-lg gift-ready" id="dg-go"><span class="gift-emo" aria-hidden="true">🎁</span>' + t('daily.collect', { gems: num(v.gift + v.chest) }) + '</button>';
        } else {
          if (r && r.shieldsUsed) h += '<p class="hint">🛡️ <span>' + t('daily.saved', { n: r.shieldsUsed, count: r.shieldsUsed }) + '</span></p>';
          if (r && r.chest) h += '<p class="dg-chest">🎉 ' + t('daily.chest', { n: r.chest }) + '</p>';
          h += '<p class="dg-done">' + ic('check', 18) + '<span>' + t('daily.done', { gems: num(Pl().giftFor(streak + 1)) }) + '</span></p>';
          h += '<button type="button" class="btn btn-primary btn-block btn-lg" id="dg-shop">' + FF.art.gem(18) + t('daily.toShop') + '</button>';
        }
        const next = [30, 100, 365].find((x) => x > streak), bk = 'checkin_' + next;
        if (next) h += '<p class="hint">' + ic('medal', 14) + '<span>' + t('daily.next', { n: next, badge: t('badge.' + bk), gems: num(Pl().badgeGems(bk)) }) + '</span></p>';
        return h;
      },
      onRender: (body, api) => {
        body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
        const go = body.querySelector('#dg-go');
        if (go) go.addEventListener('click', () => {
          const tile = body.querySelector('.dg-day.today') || go;
          const before = S().playOf().pts;
          const r = S().claimDaily();
          if (!r.ok) { api.render(); return; }
          st.res = r;
          ui().haptic(); ui().sfx.coin();
          api.render();
          const bal = body.querySelector('[data-gem-bal] b');
          ui().coinBurst(tile, body.querySelector('[data-gem-bal]'), Math.min(14, 5 + Math.round(r.gems / 10)), () => { ui().sfx.chime(); });
          if (bal) ui().countUp(bal, before + r.gems, (x) => num(Math.round(x)), 'gems-daily-' + before);
          if (r.chest || r.streak % 7 === 0) setTimeout(() => ui().confetti({ n: 120 }), 500);
          if (r.extra && r.extra.budget) setTimeout(() => budgetToast(r.extra.budget), 2600);
          if (r.extra && r.extra.level) setTimeout(() => levelUp(r.extra.level), 2600);
          if (r.badges && r.badges.length) setTimeout(() => FF.app.celebrate({ badges: r.badges }), 2000);
        });
        const sh = body.querySelector('#dg-shop');
        if (sh) sh.addEventListener('click', () => { api.close(); if (!FF.app.state.pages.some((x) => x.id === 'shop')) FF.app.push('shop'); });
      },
      onClose: () => { dailyApi = null; FF.app.refresh(true); }
    });
    if (auto) ui().sfx.pop();
  }
  /* once a day, after opening the app: the gift pops up by itself (dismissed = not again today) */
  function maybeDaily() {
    const mode = S().mode();
    if (FF.shot || !S().me() || mode === 'none' || document.documentElement.classList.contains('in-flow') || ui().topSheet()) return;
    const day = S().dayNow(), p = S().playOf();
    if (Pl().preview(p, day).claimed) return;
    if (S().device().giftShown === day) return;
    S().setDevice({ giftShown: day });
    openDaily(true);
  }

  /* ===================================================== HOW TO EARN */
  function openEarn() {
    const rows = [['🎁', 'earn.daily', 'earn.dailyB'], ['🎡', 'earn.spin', 'earn.spinB'], ['🎉', 'earn.chest', 'earn.chestB'], ['🧾', 'earn.log', 'earn.logB'], ['🎯', 'earn.budget', 'earn.budgetB'], ['🧩', 'earn.game', 'earn.gameB'], ['🎣', 'earn.fish', 'earn.fishB'], ['📰', 'earn.news', 'earn.newsB'], ['❓', 'earn.sage', 'earn.sageB'], ['🐣', 'earn.raise', 'earn.raiseB'], ['🏅', 'earn.badge', 'earn.badgeB']];
    ui().openSheet({
      label: t('shop.earn'),
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('shop.earn') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div class="list-card earn-list">' + rows.map((r) => '<div class="row static"><span class="cat-emo sm" aria-hidden="true">' + r[0] + '</span><span class="row-main"><span class="row-t">' + t(r[1]) + '</span><span class="row-s">' + t(r[2], { a: num(Pl().CYCLE[0]), b: num(Pl().CYCLE[5]), c: num(Pl().CYCLE[6]), chest: num(Pl().CHEST), log: Pl().LOG_GEMS, budget: Pl().BUDGET_GEMS, per: num(Pl().BLAST.PER) }) + '</span></span></div>').join('') + '</div>' +
        '<p class="hint">' + ic('heart', 14) + '<span>' + t('earn.note') + '</span></p><button type="button" class="btn btn-primary btn-block" data-close>' + t('common.gotIt') + '</button>',
      onRender: (body, api) => body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()))
    });
  }

  /* ===================================================== HOUSE LEVELS */
  /* every level as a little house, with what it takes (in your currency) */
  function houseLadder(m) {
    const lv = FF.family.levelOf(m), base = m.pf.base;
    return '<div class="ladder" role="list">' + FF.calc.LEVELS.map((v, i) => {
      const n = i + 1;
      const amt = v ? FF.i18n.money(v * FF.data.fx('MYR', base), base, { compact: true, whole: true }) : '';
      return '<div class="lad' + (n === lv ? ' now' : n < lv ? ' past' : '') + '" role="listitem"><div class="lad-h">' + FF.art.houseHtml(Object.assign({}, m.house, { deco: {}, pets: [] }), n, { still: true }) + '</div><b>' + t('level.name.' + n) + '</b><span class="row-s">' + (v ? t('level.from', { amount: amt }) : t('level.start')) + '</span>' + (n === lv ? '<span class="lad-you">' + t('level.now') + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function levelUp(l) {
    const m = S().me();
    ui().sfx.success(); ui().haptic();
    ui().openSheet({
      className: 'levelup-sheet', label: t('level.up'),
      render: () => '<div class="lu-stage"><div class="lu-rays" aria-hidden="true"></div><div class="lu-house">' + FF.art.houseHtml(m.house, l.to, { pets: true }) + '</div></div>' +
        '<h2 class="lu-t">' + t('level.up') + '</h2><p class="lu-b">' + t('level.upB', { name: '<b>' + t('level.name.' + l.to) + '</b>', amount: FF.i18n.money(FF.calc.LEVELS[l.to - 1] * FF.data.fx('MYR', m.pf.base), m.pf.base, { compact: true, whole: true }) }) + '</p>' +
        '<button type="button" class="btn btn-primary btn-block btn-lg" data-see>' + ic('house', 18) + t('level.see') + '</button>',
      onRender: (body, api) => { body.querySelector('[data-see]').addEventListener('click', () => { api.close(); seeHouse(); }); }
    });
    setTimeout(() => ui().confetti({ n: 180 }), 300);
  }
  function budgetToast(b) {
    ui().sfx.chime();
    ui().toast(t('gems.budget', { month: FF.i18n.monthYear(b.y, b.m), n: b.gems }), { icon: FF.art.gem(20), tone: 'success', duration: 6000, action: t('home.shop'), onAction: () => FF.app.push('shop') });
  }
  /* rewards that just happen (a month on budget, a bigger house): checked after changes settle */
  let rewardTimer = null;
  function checkSoon() {
    clearTimeout(rewardTimer);
    rewardTimer = setTimeout(() => {
      if (FF.shot || !S().me() || S().mode() === 'none' || document.documentElement.classList.contains('in-flow')) return;
      const ms = FF.market.summary();
      const r = S().checkRewards({ prices: !!(ms.stocksLive || ms.stocksHistory) });
      if (r.budget) budgetToast(r.budget);
      if (r.level) setTimeout(() => levelUp(r.level), r.budget ? 2600 : 0);
      if (r.badges && r.badges.length) setTimeout(() => FF.app.celebrate({ badges: r.badges }), 800);
    }, 1200);
  }
  /* "+5 💎" floats up from the top of the screen */
  function gemPop(n) {
    if (!n) return;
    const el = document.createElement('div');
    el.className = 'gem-pop';
    el.innerHTML = '+' + num(n) + FF.art.gem(18);
    document.body.appendChild(el);
    ui().sfx.coin();
    setTimeout(() => el.remove(), 2000);
  }

  /* the home screen's shop button (gems + a dot when today's gift is waiting) */
  function pill() {
    const p = S().playOf(), ready = !Pl().preview(p, S().dayNow()).claimed;
    const pts = p.pts - (FF.spinUI ? FF.spinUI.held() : 0); // a prize still spinning on the wheel shows when it lands
    return '<button type="button" class="gem-pill' + (ready ? ' ready' : '') + '" data-act="shop" aria-label="' + esc(t('home.shopA', { n: num(pts) })) + '">' + FF.art.gem(18) + '<b class="num">' + num(pts) + '</b>' + (ready ? '<i class="gp-dot" aria-hidden="true"></i>' : '') + '</button>';
  }

  Object.assign(A, {
    shop: () => { if (FF.app.state.pages.length && FF.app.state.pages[FF.app.state.pages.length - 1].id === 'shop') return; FF.app.push('shop'); },
    'shop-item': (el) => openItem(el.dataset.id),
    daily: () => openDaily(false),
    'earn-info': () => openEarn()
  });
  FF.on('gems', (d) => { if (d && d.k === 'log') gemPop(d.n); });
  FF.on('change', (ev) => { if (ev && ['txn', 'txn-edited', 'txn-deleted', 'remote', 'dividends-auto', 'budget', 'setup-finished'].indexOf(ev.reason) !== -1) checkSoon(); });
  FF.on('market', () => checkSoon());

  FF.shop = { shopPage, afterShop, openItem, openDaily, maybeDaily, openEarn, houseLadder, levelUp, gemPop, pill, checkSoon, seeHouse, gems, itemName };
})(window);
