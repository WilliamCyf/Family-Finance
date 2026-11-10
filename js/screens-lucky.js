/* ============================================================
   FamFi — screens-lucky.js
   The Lucky Market's sheets: the day's six stalls, an item up
   close, hatching an egg, a pet (feed · forms · sell), a plant
   (water · tonic · sell), your yard, throwing a Molotov and
   fishing at the pond. Rules: lucky.js · actions: store.js.

   Smooth by design: every sheet is plain HTML with still art;
   the only things that move are short, finite CSS effects and
   the fishing needle — one GPU animation, running only while
   you're casting (its position is read from the animation's own
   clock when you tap, so no code runs per frame).
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, Lk = () => FF.lucky, A = () => FF.art, ui = () => FF.ui;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const num = (n) => FF.i18n.num(n, 0);
  const gem = (s) => FF.art.gem(s || 16);
  const head = (title) => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + title + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>';
  const closeBtns = (body, api) => body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
  const tier = (r) => '<span class="lk-tier t-' + r + '">' + t('shop.r.' + r) + '</span>';
  const itemName = (id) => (Lk().ITEMS[id].kind === 'deco' ? t('deco.' + id) : t('lk.i.' + id));
  const itemDesc = (id) => (Lk().ITEMS[id].kind === 'deco' ? t('lk.decoB', { what: t('deco.' + id + '.b') }) : t('lk.i.' + id + '.b'));
  const itemArt = (id, size) => (Lk().ITEMS[id].kind === 'deco' ? FF.art.decoThumb(id) : A().lkItem(id, size));
  const petName = (sp) => t('lp.' + sp);
  const plantName = (sp) => t('lpl.' + sp);
  const mine = (owner) => owner === S().state.meId;
  const ownerName = (id) => { const m = S().member(id); return m ? m.name : ''; };
  function untilMidnight() {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(1, Math.round((next - now) / 60000));
    return mins >= 60 ? t('lk.hm', { h: Math.floor(mins / 60), m: mins % 60 }) : t('lk.m', { m: mins });
  }
  /* two taps to sell (the first one asks) */
  function twoTap(btn, sure, go) {
    btn.addEventListener('click', () => {
      if (!btn.classList.contains('confirm')) { btn.classList.add('confirm'); btn.querySelector('span').textContent = sure; ui().haptic(); return; }
      go();
    });
  }
  const village = () => { if (FF.app.tab !== 'family') FF.app.go('family'); };

  /* =========================================================
     THE MARKET
     ========================================================= */
  function openMarket() {
    if (!S().me()) return;
    ui().openSheet({ className: 'sheet-tall lk-sheet', label: t('lk.name'), render: renderMarket, onRender: mountMarket });
  }
  function stallCard(st) {
    const why = st.sold ? 'sold' : st.full ? 'full' : !st.afford ? 'short' : '';
    return '<button type="button" class="lk-stall k-' + st.item.kind + (why ? ' ' + why : '') + '" data-stall="' + st.slot + '">' +
      '<span class="lk-art">' + itemArt(st.id, 56) + '</span><span class="lk-n">' + esc(itemName(st.id)) + '</span>' +
      (st.sold ? '<span class="lk-stamp">' + t('lk.sold') + '</span>' : '<span class="lk-price">' + gem(14) + '<b class="num">' + num(st.price) + '</b></span>') + '</button>';
  }
  function renderMarket() {
    const m = S().me(), p = S().playOf(), y = S().yardOf(m), bag = p.bag || {};
    let h = head('🍀 ' + t('lk.name'));
    h += '<div class="lk-top"><span class="lk-bal">' + gem(22) + '<b class="num">' + num(p.pts) + '</b></span><span class="lk-new">' + ic('clock', 14) + '<span>' + t('lk.newIn', { time: untilMidnight() }) + '</span></span></div>';
    h += '<p class="lead small">' + t('lk.lead') + '</p>';
    h += '<div class="lk-grid">' + S().luckyToday().map(stallCard).join('') + '</div>';
    h += '<h3 class="group-h">' + t('lk.yours') + '</h3><div class="list-card">';
    h += '<button type="button" class="row" data-yard="pets"><span class="cat-emo sm" aria-hidden="true">🐾</span><span class="row-main"><span class="row-t">' + t('lk.myPets') + '</span><span class="row-s">' + t('lk.space', { n: y.pets.length, max: Lk().MAX_PETS }) + '</span></span>' + ic('chevR', 18) + '</button>';
    h += '<button type="button" class="row" data-yard="plants"><span class="cat-emo sm" aria-hidden="true">🌱</span><span class="row-main"><span class="row-t">' + t('lk.myPlants') + '</span><span class="row-s">' + t('lk.space', { n: y.plants.length, max: Lk().MAX_PLANTS }) + '</span></span>' + ic('chevR', 18) + '</button>';
    h += '<div class="row static lk-bag"><span class="cat-emo sm" aria-hidden="true">🎒</span><span class="row-main"><span class="row-t">' + t('lk.bag') + '</span><span class="row-s">' +
      ['molotov', 'tonic', 'treat'].map((k) => '<span class="lk-bagi">' + A().lkItem(k, 20) + '×' + num(bag[k] || 0) + '</span>').join('') + '</span></span>' +
      ((bag.molotov || 0) > 0 ? '<button type="button" class="btn btn-soft btn-sm" data-throw>🔥 ' + t('lk.throw') + '</button>' : '') + '</div>';
    h += '</div><p class="hint">' + ic('info', 14) + '<span>' + t('lk.note') + '</span></p>';
    return h;
  }
  function mountMarket(body, api) {
    closeBtns(body, api);
    body.querySelectorAll('[data-stall]').forEach((b) => b.addEventListener('click', () => openStall(+b.dataset.stall, api)));
    body.querySelectorAll('[data-yard]').forEach((b) => b.addEventListener('click', () => openYard(b.dataset.yard)));
    const th = body.querySelector('[data-throw]');
    if (th) th.addEventListener('click', () => openThrow());
  }

  /* one stall up close: what it is, the odds, buy */
  function openStall(slot, marketApi) {
    const st = S().luckyToday()[slot];
    if (!st) return;
    if (st.sold) { ui().toast(t('lk.soldToast'), { icon: 'info' }); return; }
    const it = st.item, odds = it.odds;
    const p = S().playOf();
    ui().openSheet({
      className: 'lk-item-sheet', label: itemName(st.id),
      render: () => {
        let h = head(esc(itemName(st.id)));
        h += '<div class="lk-hero k-' + it.kind + '">' + itemArt(st.id, 110) + '</div><p class="lead center">' + itemDesc(st.id) + '</p>';
        if (odds) {
          h += '<div class="lk-odds"><h3 class="sub-h">' + t('lk.odds') + '</h3>' + Lk().TIERS.map((r, k) => odds[k] ? '<div class="lk-odd t-' + r + '">' + tier(r) + '<span class="lk-odd-bar"><i style="width:' + Math.max(2, odds[k]) + '%"></i></span><b class="num">' + FF.i18n.num(odds[k], odds[k] % 1 ? 1 : 0) + '%</b></div>' : '').join('') + '</div>';
          h += '<p class="hint">' + ic('info', 14) + '<span>' + t(it.kind === 'egg' ? 'lk.eggHow' : 'lk.seedHow') + '</span></p>';
        }
        const why = st.full ? (it.kind === 'deco' ? t('lk.owned') : t(it.kind === 'egg' ? 'lk.petsFull' : 'lk.plantsFull', { max: it.kind === 'egg' ? Lk().MAX_PETS : Lk().MAX_PLANTS })) : !st.afford ? t('lk.short', { n: num(st.price - p.pts) }) : '';
        h += '<button type="button" class="btn btn-primary btn-block btn-lg" id="lk-buy"' + (why ? ' disabled' : '') + '>' + gem(18) + '<span>' + (why || t('lk.buy', { price: num(st.price) })) + '</span></button>';
        return h;
      },
      onRender: (body, api) => {
        closeBtns(body, api);
        const b = body.querySelector('#lk-buy');
        if (b) b.addEventListener('click', () => {
          const r = S().buyLucky(slot);
          if (!r.ok) { ui().toast(t('lk.cant'), { icon: 'info' }); return; }
          ui().sfx.coin(); ui().haptic();
          api.close(true);
          if (marketApi) marketApi.close(true);
          after(r);
        });
      }
    });
  }
  /* what happens after buying */
  function after(r) {
    if (r.kind === 'egg') { hatch(r.pet); return; }
    if (r.kind === 'seed') {
      village();
      setTimeout(() => FF.village.showThing('pl_' + r.plant.id), 350);
      ui().toast(t('lpl.planted'), { icon: '🌱', tone: 'success', duration: 5000 });
      return;
    }
    if (r.kind === 'bag') {
      if (r.id === 'molotov') { openThrow(); return; }
      ui().toast(t('lk.added', { what: t('lk.i.' + r.id) }), { icon: '🎒', tone: 'success' });
      return;
    }
    if (r.kind === 'deco') ui().toast(t('lk.decoOn', { what: t('deco.' + r.id) }), { icon: 'check', tone: 'success' });
    if (r.badges && r.badges.length) FF.app.celebrate({ badges: r.badges });
  }

  /* =========================================================
     HATCHING — the egg wobbles, cracks, and out comes…
     ========================================================= */
  function hatch(pet) {
    const big = pet.r === 'epic' || pet.r === 'legendary';
    ui().openSheet({
      className: 'lk-hatch-sheet', label: t('lp.hatchTitle'), dismissible: false,
      render: () => '<div class="lk-hatch">' +
        '<div class="lk-egg">' + A().lkItem(big ? 'goldegg' : 'egg', 120) + '</div>' +
        '<div class="lk-born t-' + pet.r + '"><div class="lk-born-art">' + A().lkPet(pet.sp, 0, 120) + '</div>' + tier(pet.r) +
        '<h2>' + t('lp.hatched', { pet: petName(pet.sp) }) + '</h2><p class="lead">' + t('lp.bornB') + '</p>' +
        '<button type="button" class="btn btn-primary btn-block btn-lg" data-see>' + ic('house', 18) + '<span>' + t('lp.seeIt') + '</span></button></div></div>',
      onRender: (body, api) => {
        const box = body.querySelector('.lk-hatch');
        ui().sfx.pop();
        setTimeout(() => {
          box.classList.add('open');
          ui().haptic();
          if (pet.r === 'legendary') { ui().sfx.success(); ui().confetti({ n: 180 }); }
          else if (big) { ui().sfx.chime(); ui().confetti({ n: 110 }); }
          else ui().sfx.chime();
        }, ui().reduced() ? 50 : 1500);
        body.querySelector('[data-see]').addEventListener('click', () => {
          api.close(true);
          village();
          setTimeout(() => FF.village.showThing('gp_' + pet.id), 350);
        });
      }
    });
  }

  /* =========================================================
     A PET — feed it, pick its look, or sell it
     ========================================================= */
  function findPet(owner, id) { const m = S().member(owner); return m ? S().yardOf(m).pets.find((x) => x.id === id) : null; }
  function openPet(owner, id) {
    if (!findPet(owner, id)) return;
    ui().openSheet({ className: 'lk-pet-sheet', label: t('lk.myPets'), render: () => renderPet(owner, id), onRender: (body, api) => mountPet(body, api, owner, id) });
  }
  function renderPet(owner, id) {
    const pet = findPet(owner, id);
    if (!pet) return head('') + '<p class="lead center">' + t('lp.gone') + '</p>';
    const form = Lk().shownForm(pet), unlocked = Lk().formsOf(pet), day = S().dayNow(), nd = mine(owner) ? Lk().need(pet, day) : null;
    const next = Lk().nextAt(pet), bag = mine(owner) ? (S().playOf().bag || {}) : {};
    let h = head(esc(petName(pet.sp)) + ' ' + tier(pet.r));
    if (!mine(owner)) h += '<p class="lk-owner">' + t('lp.ofX', { name: esc(ownerName(owner)) }) + '</p>';
    h += '<div class="lk-hero pet t-' + pet.r + '">' + A().lkPet(pet.sp, form, 104) + (nd ? '<span class="need-b big">' + (nd === 'food' ? '🍖' : '💧') + '</span>' : '') + '</div>';
    const pct = next ? Math.min(100, Math.round(((pet.fed || 0) / next) * 100)) : 100;
    h += '<div class="lk-prog"><div class="lk-prog-t"><b>' + t('lp.form.' + unlocked) + '</b><span>' + t('lp.fed', { n: pet.fed || 0, count: pet.fed || 0 }) + '</span></div><div class="lk-bar"><i style="width:' + pct + '%"></i></div>' +
      '<p class="row-s">' + (next ? t('lp.nextForm', { form: t('lp.form.' + (unlocked + 1)), n: next - (pet.fed || 0), count: next - (pet.fed || 0) }) : t('lp.maxForm')) + '</p></div>';
    if (mine(owner)) {
      h += nd ? '<button type="button" class="btn btn-primary btn-block btn-lg" data-feed>' + (nd === 'food' ? '🍖 ' + t('lp.feed') : '💧 ' + t('lp.giveWater')) + '</button>'
        : '<button type="button" class="btn btn-soft btn-block" disabled>' + ic('check', 18) + '<span>' + t('lp.happy') + '</span></button>';
      if ((bag.treat || 0) > 0 && next) h += '<button type="button" class="btn btn-soft btn-block" data-treat>🍪 <span>' + t('lp.treat', { n: bag.treat }) + '</span></button>';
      h += '<h3 class="sub-h">' + t('lp.forms') + '</h3><div class="lk-forms">' + [0, 1, 2].map((f) => {
        const open = f <= unlocked;
        return '<button type="button" class="lk-form' + (f === form ? ' on' : '') + (open ? '' : ' locked') + '" data-form="' + f + '"' + (open ? '' : ' disabled') + '>' + A().lkPet(pet.sp, f, 40) + '<span>' + (open ? t('lp.form.' + f) : t('lp.lockedAt', { n: Lk().EVOLVE[f] })) + '</span></button>';
      }).join('') + '</div><p class="hint">' + ic('info', 14) + '<span>' + t('lp.formsB') + '</span></p>';
      h += '<button type="button" class="btn btn-danger-soft btn-block" data-sell>' + gem(16) + '<span>' + t('lp.sell', { n: num(Lk().petValue(pet)) }) + '</span></button>';
    } else {
      h += '<p class="hint">' + ic('heart', 14) + '<span>' + t('lp.othersB', { name: esc(ownerName(owner)) }) + '</span></p>';
    }
    return h;
  }
  function mountPet(body, api, owner, id) {
    closeBtns(body, api);
    const feed = (treat) => {
      const r = S().feedPet(id, { treat });
      if (!r.ok) return;
      ui().sfx.pop(); ui().haptic();
      if (r.evolved) {
        ui().sfx.success(); ui().confetti({ n: 120 });
        ui().toast(t('lp.evolved', { pet: petName(r.pet.sp), form: t('lp.form.' + r.evolved) }), { icon: '✨', tone: 'success', duration: 5000 });
      } else ui().toast(t(treat ? 'lp.treated' : 'lp.fedToast', { pet: petName(r.pet.sp) }), { icon: '💛' });
      if (r.badges && r.badges.length) FF.app.celebrate({ badges: r.badges });
      api.render();
    };
    const f = body.querySelector('[data-feed]'); if (f) f.addEventListener('click', () => feed(false));
    const tr = body.querySelector('[data-treat]'); if (tr) tr.addEventListener('click', () => feed(true));
    body.querySelectorAll('[data-form]').forEach((b) => b.addEventListener('click', () => { if (S().setPetForm(id, +b.dataset.form)) { ui().sfx.tap(); api.render(); } }));
    const sell = body.querySelector('[data-sell]');
    if (sell) twoTap(sell, t('lp.sellSure'), () => {
      const r = S().sellPet(id);
      if (!r.ok) return;
      api.close(true);
      ui().sfx.coin();
      FF.shop.gemPop(r.gems);
      ui().toast(t('lp.sold', { pet: petName(r.pet.sp), n: num(r.gems) }), { icon: 'check', tone: 'success' });
    });
  }

  /* =========================================================
     A PLANT — water it, give it tonic, or sell it
     ========================================================= */
  function findPlant(owner, id) { const m = S().member(owner); return m ? S().yardOf(m).plants.find((x) => x.id === id) : null; }
  function openPlant(owner, id) {
    if (!findPlant(owner, id)) return;
    ui().openSheet({ className: 'lk-plant-sheet', label: t('lk.myPlants'), render: () => renderPlant(owner, id), onRender: (body, api) => mountPlant(body, api, owner, id) });
  }
  function renderPlant(owner, id) {
    const pl = findPlant(owner, id);
    if (!pl) return head('') + '<p class="lead center">' + t('lpl.gone') + '</p>';
    const st = Lk().stage(pl), bloomed = st >= 4, day = S().dayNow(), thirsty = mine(owner) && Lk().thirsty(pl, day), bag = mine(owner) ? (S().playOf().bag || {}) : {};
    let h = head(bloomed ? esc(plantName(pl.sp)) + ' ' + tier(pl.r) : t('lpl.mystery'));
    if (!mine(owner)) h += '<p class="lk-owner">' + t('lpl.ofX', { name: esc(ownerName(owner)) }) + '</p>';
    h += '<div class="lk-hero plant' + (bloomed ? ' t-' + pl.r : '') + '">' + A().lkPlant(pl, 132) + (thirsty ? '<span class="need-b big">💧</span>' : '') + '</div>';
    const goal = Lk().GROW[Lk().GROW.length - 1];
    if (!bloomed) {
      h += '<div class="lk-prog"><div class="lk-prog-t"><b>' + t('lpl.stage.' + st) + '</b><span>' + t('lpl.watered', { n: pl.w || 0, max: goal }) + '</span></div><div class="lk-bar water"><i style="width:' + Math.round(((pl.w || 0) / goal) * 100) + '%"></i></div>' +
        '<p class="row-s">' + t('lpl.toBloom', { n: Lk().daysToBloom(pl), count: Lk().daysToBloom(pl) }) + '</p></div>';
    } else {
      const age = Math.max(0, day - (pl.bloom == null ? day : pl.bloom));
      h += '<div class="lk-prog"><div class="lk-prog-t"><b>' + t('lpl.stage.4') + '</b><span>' + t('lpl.age', { n: age, count: age }) + '</span></div><p class="row-s">' + t('lpl.ageB') + '</p></div>';
    }
    if (mine(owner)) {
      if (!bloomed) {
        h += thirsty ? '<button type="button" class="btn btn-primary btn-block btn-lg" data-water>💧 ' + t('lpl.water') + '</button>' : '<button type="button" class="btn btn-soft btn-block" disabled>' + ic('check', 18) + '<span>' + t('lpl.wateredToday') + '</span></button>';
        if ((bag.tonic || 0) > 0) h += '<button type="button" class="btn btn-soft btn-block" data-tonic>🧪 <span>' + t('lpl.tonic', { n: bag.tonic }) + '</span></button>';
      }
      h += '<p class="hint">' + ic('move', 14) + '<span>' + t('lpl.moveB') + '</span></p>';
      h += '<button type="button" class="btn btn-danger-soft btn-block" data-sell>' + gem(16) + '<span>' + t('lpl.sell', { n: num(Lk().plantValue(pl, day)) }) + '</span></button>';
    }
    return h;
  }
  function mountPlant(body, api, owner, id) {
    closeBtns(body, api);
    const water = (tonic) => {
      const r = S().waterPlant(id, { tonic });
      if (!r.ok) return;
      ui().sfx.pop(); ui().haptic();
      if (r.bloomed) {
        const big = r.plant.r === 'epic' || r.plant.r === 'legendary';
        ui().sfx.success(); ui().confetti({ n: big ? 160 : 90 });
        ui().toast(t('lpl.bloomed', { plant: plantName(r.plant.sp), tier: t('shop.r.' + r.plant.r) }), { icon: '🌸', tone: 'success', duration: 5000 });
      } else if (r.grew) ui().toast(t('lpl.grew', { stage: t('lpl.stage.' + r.stage) }), { icon: '🌱', tone: 'success' });
      else ui().toast(t(tonic ? 'lpl.tonicDone' : 'lpl.wateredToast'), { icon: '💧' });
      if (r.badges && r.badges.length) FF.app.celebrate({ badges: r.badges });
      api.render();
    };
    const w = body.querySelector('[data-water]'); if (w) w.addEventListener('click', () => water(false));
    const tn = body.querySelector('[data-tonic]'); if (tn) tn.addEventListener('click', () => water(true));
    const sell = body.querySelector('[data-sell]');
    if (sell) twoTap(sell, t('lpl.sellSure'), () => {
      const r = S().sellPlant(id);
      if (!r.ok) return;
      api.close(true);
      ui().sfx.coin();
      FF.shop.gemPop(r.gems);
      ui().toast(t('lpl.sold', { n: num(r.gems) }), { icon: 'check', tone: 'success' });
    });
  }

  /* =========================================================
     YOUR YARD — every pet and plant in one list
     ========================================================= */
  function openYard(kind) {
    ui().openSheet({
      className: 'sheet-tall lk-yard-sheet', label: t(kind === 'pets' ? 'lk.myPets' : 'lk.myPlants'),
      render: () => {
        const m = S().me(), y = S().yardOf(m), day = S().dayNow();
        let h = head(t(kind === 'pets' ? 'lk.myPets' : 'lk.myPlants'));
        const list = kind === 'pets' ? y.pets : y.plants;
        if (!list.length) return h + '<div class="empty small"><p>' + t(kind === 'pets' ? 'lk.noPets' : 'lk.noPlants') + '</p></div>';
        h += '<div class="list-card">' + list.map((x) => {
          if (kind === 'pets') {
            const nd = Lk().need(x, day);
            return '<button type="button" class="row" data-o="' + x.id + '"><span class="lk-row-art">' + A().lkPet(x.sp, Lk().shownForm(x), 40) + '</span><span class="row-main"><span class="row-t">' + esc(petName(x.sp)) + ' ' + tier(x.r) + '</span><span class="row-s">' + t('lp.form.' + Lk().formsOf(x)) + ' · ' + t('lp.fed', { n: x.fed || 0, count: x.fed || 0 }) + '</span></span>' + (nd ? '<span class="need-b inline">' + (nd === 'food' ? '🍖' : '💧') + '</span>' : '') + ic('chevR', 18) + '</button>';
          }
          const st = Lk().stage(x);
          return '<button type="button" class="row" data-o="' + x.id + '"><span class="lk-row-art">' + A().lkPlant(x, 44) + '</span><span class="row-main"><span class="row-t">' + (st >= 4 ? esc(plantName(x.sp)) + ' ' + tier(x.r) : t('lpl.mystery')) + '</span><span class="row-s">' + t('lpl.stage.' + st) + '</span></span>' + (Lk().thirsty(x, day) ? '<span class="need-b inline">💧</span>' : '') + ic('chevR', 18) + '</button>';
        }).join('') + '</div>';
        return h;
      },
      onRender: (body, api) => {
        closeBtns(body, api);
        body.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => (kind === 'pets' ? openPet : openPlant)(S().state.meId, b.dataset.o)));
      }
    });
  }

  /* =========================================================
     THE MOLOTOV — pick a house
     ========================================================= */
  function openThrow() {
    const p = S().playOf();
    if (!((p.bag || {}).molotov > 0)) { ui().toast(t('lm.none'), { icon: 'info' }); return; }
    ui().openSheet({
      className: 'lk-throw-sheet', label: t('lm.title'),
      render: () => head('🔥 ' + t('lm.title')) + '<p class="lead">' + t('lm.lead') + '</p><div class="list-card">' +
        S().familyMembers().map((m) => '<button type="button" class="row" data-t="' + m.id + '">' + FF.art.avatar(m.avatar, 40) + '<span class="row-main"><span class="row-t">' + esc(m.name) + (m.id === S().state.meId ? ' <span class="chip chip-brand">' + t('common.you') + '</span>' : '') + '</span>' +
          (S().burns()[m.id] ? '<span class="row-s">' + t('lm.already') + '</span>' : '') + '</span><span class="lk-throw-ic">' + A().lkItem('molotov', 28) + '</span></button>').join('') + '</div>' +
        '<button type="button" class="btn btn-ghost btn-block" data-close>' + t('lm.later') + '</button>',
      onRender: (body, api) => {
        closeBtns(body, api);
        body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
          const id = b.dataset.t;
          api.close(true);
          ui().closeAllSheets();
          village();
          setTimeout(() => FF.village.throwAt(id, () => {
            const r = S().throwMolotov(id);
            if (r.ok) ui().toast(t(id === S().state.meId ? 'lm.doneSelf' : 'lm.done', { name: esc(ownerName(id)) }), { icon: '🔥', tone: 'success', duration: 5000 });
          }), 250);
        }));
      }
    });
  }
  /* someone set your house on fire: tell them once (just for fun) */
  function burnNews() {
    if (FF.shot || !S().me()) return;
    const me = S().state.meId, seen = +S().device().burnSeen || 0;
    let best = null;
    S().familyMembers().forEach((m) => { const b = S().yardOf(m).burn; if (m.id !== me && b && b.t === me && Lk().burning(b, Date.now()) && b.at > seen && (!best || b.at > best.at)) best = { at: b.at, by: m.name }; });
    if (!best) return;
    S().setDevice({ burnSeen: best.at });
    ui().toast(t('lm.hit', { name: esc(best.by) }), { icon: '🔥', duration: 6000 });
  }
  FF.on('change', (ev) => { if (ev && ev.reason === 'remote') setTimeout(burnNews, 600); });
  setTimeout(burnNews, 3000);

  /* =========================================================
     FISHING AT THE POND — tap Cast, then stop the needle in the green
     ========================================================= */
  function openFishing() {
    if (!S().me()) return;
    const st = { phase: 'ready', anim: null, res: null };
    ui().openSheet({ className: 'lk-fish-sheet', label: t('lf.title'), state: st, render: renderFish, onRender: mountFish, onClose: () => { if (st.anim) st.anim.cancel(); } });
  }
  function renderFish(api) {
    const st = api.state, f = S().fishState();
    const z = f.zone, G = Lk().GOOD, PF = Lk().PERFECT;
    let h = head('🎣 ' + t('lf.title'));
    h += '<div class="lf-pond"><div class="lf-water"><i></i><i></i></div><span class="lf-bob' + (st.phase === 'swing' ? ' wait' : '') + '"></span></div>';
    h += '<div class="lf-casts" aria-label="' + esc(t('lf.left', { n: f.left, count: f.left })) + '">' + Array.from({ length: Lk().CASTS }, (_, k) => '<i class="' + (k < f.left ? 'on' : '') + '"></i>').join('') + '<span>' + t('lf.left', { n: f.left, count: f.left }) + '</span></div>';
    const showZone = st.phase === 'result' && st.res ? st.res.zone : z;
    h += '<div class="lf-meter"><div class="lf-bar"><i class="lf-good" style="left:' + ((showZone - G) * 100).toFixed(1) + '%;width:' + (G * 200).toFixed(1) + '%"></i><i class="lf-perfect" style="left:' + ((showZone - PF) * 100).toFixed(1) + '%;width:' + (PF * 200).toFixed(1) + '%"></i><b class="lf-needle"' + (st.res ? ' style="transform:translateX(' + st.res.px + 'px)"' : '') + '></b></div></div>';
    if (st.phase === 'result' && st.res) {
      const r = st.res;
      h += '<div class="lf-result g-' + r.grade + '">' + (r.fish ? '<div class="lf-fish">' + A().lkFish(r.fish.sp, 96) + '</div><b>' + t('lf.' + r.grade) + '</b><span>' + t('lf.got', { fish: t('lf.fish.' + r.fish.sp), n: r.fish.gems }) + ' ' + tier(r.fish.r) + '</span>' : '<div class="lf-splash">💨</div><b>' + t('lf.miss') + '</b><span>' + t('lf.missB') + '</span>') + '</div>';
    } else {
      h += '<p class="lead center lf-how">' + t('lf.how') + '</p>';
    }
    if (f.left <= 0 && st.phase !== 'swing') h += '<button type="button" class="btn btn-soft btn-block" data-close>' + t('lf.none') + '</button>';
    else h += '<button type="button" class="btn btn-primary btn-block btn-lg lf-go" data-go>' + (st.phase === 'swing' ? '🎣 ' + t('lf.reel') : st.phase === 'result' ? t('lf.again') : '🎣 ' + t('lf.cast')) + '</button>';
    const book = Object.keys(f.book || {});
    if (book.length) h += '<div class="lf-book"><h3 class="sub-h">' + t('lf.book') + '</h3><div class="lf-book-in">' + Object.keys(Lk().FISH).filter((k) => f.book[k]).map((k) => '<span class="lf-bk t-' + Lk().FISH[k].r + '">' + A().lkFish(k, 34) + '<b class="num">×' + f.book[k] + '</b></span>').join('') + '</div></div>';
    return h;
  }
  function mountFish(body, api) {
    closeBtns(body, api);
    const st = api.state, go = body.querySelector('[data-go]');
    if (!go) return;
    const bar = body.querySelector('.lf-bar'), needle = body.querySelector('.lf-needle');
    go.addEventListener('click', () => {
      if (st.phase !== 'swing') {
        // cast: the needle sweeps on the GPU (one animation; nothing runs per frame)
        if (S().fishState().left <= 0) return;
        st.phase = 'swing'; st.res = null; api.render();
        const b2 = api.body.querySelector('.lf-bar'), n2 = api.body.querySelector('.lf-needle');
        const span = b2.clientWidth - n2.offsetWidth;
        st.span = span;
        if (st.anim) st.anim.cancel();
        st.anim = n2.animate([{ transform: 'translateX(0px)' }, { transform: 'translateX(' + span + 'px)' }], { duration: Lk().SWEEP_MS, iterations: Infinity, direction: 'alternate', easing: 'linear' });
        ui().sfx.whoosh();
        return;
      }
      // reel in: where is the needle right now? (read from the animation's own clock)
      const a = st.anim;
      const pos = Lk().needleAt(a ? a.currentTime : 0);
      if (a) { a.pause(); a.cancel(); }
      st.anim = null;
      const r = S().fishCast(pos);
      if (!r.ok) { st.phase = 'ready'; api.render(); return; }
      st.res = Object.assign({ px: Math.round(pos * (st.span || (bar.clientWidth - needle.offsetWidth))) }, r);
      st.phase = 'result';
      if (r.fish) { ui().haptic(); if (r.fish.r === 'legendary' || r.fish.r === 'epic') { ui().sfx.success(); ui().confetti({ n: 90 }); } else ui().sfx.coin(); FF.shop.gemPop(r.fish.gems); }
      else ui().sfx.bbBack();
      if (r.badges && r.badges.length) FF.app.celebrate({ badges: r.badges });
      api.render();
    });
  }

  FF.luckyUI = { openMarket, openStall, openPet, openPlant, openYard, openThrow, openFishing, hatch };
})(window);
