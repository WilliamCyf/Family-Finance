/* ============================================================
   FamFi — village.js
   The Family village: a pannable / pinch-zoomable isometric map.
   • Houses: tap to visit, long-press → edit mode (jiggle, drag,
     snap-to-grid, green/red footprint, edge auto-scroll).
   • Family Goals stand, landmarks, swaying trees, windmill.
   • Roaming animals with personalities. They are pointer-events:
     none and only get a tap when nothing else was hit, so they
     can never block houses, the stand or controls.
   • Only transforms/opacity animate (GPU) for 60fps. Smoothness rules
     (measured — see audit notes in the README):
       – the map moves at most once per screen refresh;
       – the name tags' counter-zoom is set on the tags layer only, and
         only when the zoom changes (on the whole world it restyled
         every house, tree and animal on every finger move);
       – while a finger moves the map, and for anything off screen, the
         little drawn-in animations (legs, wings, twinkles) and the
         animals wait — they'd otherwise be repainted every frame;
       – the ground is drawn once into a picture (no redrawing of
         thousands of shapes while you pan or zoom).
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, G = () => FF.grid, A = () => FF.art;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const ui = () => FF.ui;

  let el = null, vp = null, world = null, L = {};
  const cam = { x: 0, y: 0, s: 1 };
  let vw = 390, vh = 844;
  let editing = false;
  let visible = false;
  const houses = {};   // id -> {el, tag, key, i, j}
  let stand = null;
  let hall = null;     // the Town Hall (or its build plot)
  let arcade = null;   // the Block Blast arcade
  let animals = [];
  let builtFor = '';   // theme|lang the static scenery was built for
  let inertia = null;
  let menuEl = null;

  const reduced = () => document.documentElement.classList.contains('reduce-motion');
  const night = () => document.documentElement.classList.contains('theme-dark');

  /* ---------------- build ---------------- */
  function mount(host) {
    el = document.createElement('div');
    el.className = 'village';
    el.innerHTML =
      '<div class="v-viewport" role="application" aria-label="' + esc(t('village.a11y')) + '"><div class="v-world">' +
      '<div class="v-ground"></div><div class="v-grid"></div><div class="v-sprites"></div><div class="v-ambient"></div><div class="v-tags"></div><div class="v-fx"></div>' +
      '</div></div>' +
      '<div class="v-hud"><div class="v-sign"></div><div class="v-btns"></div></div>' +
      '<div class="v-editbar"></div>';
    host.appendChild(el);
    vp = el.querySelector('.v-viewport');
    world = el.querySelector('.v-world');
    ['ground', 'grid', 'sprites', 'ambient', 'tags', 'fx'].forEach((k) => { L[k] = el.querySelector('.v-' + k); });
    // the world's size comes from the land
    [world].concat(Object.keys(L).map((k) => L[k])).forEach((n) => { n.style.width = G().W + 'px'; n.style.height = G().H + 'px'; });
    bindPointer();
    window.addEventListener('resize', () => { measure(); clampCam(); apply(); });
    el.addEventListener('click', onHudClick);
    build();
    centerInitial();
  }
  function measure() { const r = vp.getBoundingClientRect(); vw = r.width || innerWidth; vh = r.height || innerHeight; }

  function build() {
    A().night = night();
    builtFor = (night() ? 'n' : 'd') + FF.i18n.lang;
    const gk = night() ? 'n' : 'd';
    if (baked && baked.key === gk) { L.ground.innerHTML = ''; L.ground.appendChild(baked.canvas); } // same picture (e.g. only the language changed)
    else { L.ground.innerHTML = A().ground(); bakeGround(gk); }
    L.grid.innerHTML = gridSvg();
    // scenery sprites
    L.sprites.innerHTML = '';
    Object.keys(houses).forEach((k) => delete houses[k]);
    stand = null;
    hall = null;
    arcade = null;
    lucky = null; pond = null; news = null; sage = null;
    Object.keys(plants).forEach((k) => delete plants[k]);
    Object.keys(gpets).forEach((k) => delete gpets[k]);
    G().TREES.forEach((tr, k) => {
      const sp = A().tree(tr.kind, k + 3);
      addSprite('prop tree', tr.x, tr.y, sp, '<div class="sway-wrap" style="animation-delay:-' + (k * 0.7).toFixed(1) + 's">' + sp.svg + '</div>');
    });
    G().LANDMARKS.forEach((lm) => {
      let sp;
      if (lm.kind === 'familyTree') sp = A().familyTree(t('village.familyTree'));
      else if (lm.kind === 'windmill') sp = A().windmill({ noBlades: true });
      else if (lm.kind === 'well') sp = A().well();
      else if (lm.kind === 'lamp') sp = A().lamp();
      else if (lm.kind === 'bench') sp = A().benchSprite();
      else if (lm.kind === 'signpost') sp = A().signpost('FamFi', t('village.welcome'));
      if (!sp) return;
      const node = addSprite('prop lm-' + lm.kind, lm.x, lm.y, sp, sp.svg);
      if (lm.kind === 'windmill') {
        const b = document.createElement('div');
        b.className = 'blades-layer';
        b.style.left = (sp.hub[0] - 64) + 'px'; b.style.top = (sp.hub[1] - 64) + 'px';
        b.innerHTML = A().windmillBlades();
        node.appendChild(b);
      }
    });
    // ambient life
    L.ambient.innerHTML = ambientHtml();
    flutters = Array.prototype.map.call(L.ambient.querySelectorAll('.butterfly'), (b) => ({ el: b, x: parseFloat(b.style.left), y: parseFloat(b.style.top) }));
    animals.forEach((a) => { a.gone = true; clearTimeout(a.t); a.el.remove(); });
    animals = [];
    L.tags.innerHTML = '';
    render();
  }
  /* the ground, drawn once into a picture at 2× (pan/zoom then never redraws its ~2,000 shapes).
     The vector ground shows until the picture is ready; if anything fails it simply stays. */
  let bakeTok = 0, baked = null, bakeLater = null;
  function bakeGround(key) {
    const tok = ++bakeTok, g = G(), k = 2;
    baked = null;
    if (g.W * k * g.H * k > 16.7e6) return; // iOS's biggest canvas
    const go = () => {
      if (tok !== bakeTok) return;
      if (!visible) { bakeLater = go; return; }                 // when the village is next shown
      if (isMoving) { setTimeout(go, 400); return; }            // drawing it takes a moment on a phone: not mid-gesture
      let url;
      try { url = URL.createObjectURL(new Blob([A().ground({ scale: k })], { type: 'image/svg+xml' })); } catch (e) { return; }
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (tok !== bakeTok) return;
        try {
          const c = document.createElement('canvas');
          c.width = g.W * k; c.height = g.H * k;
          c.className = 'ground-bmp';
          c.style.width = g.W + 'px'; c.style.height = g.H + 'px';
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          L.ground.innerHTML = '';
          L.ground.appendChild(c);
          baked = { key, canvas: c };
        } catch (e) { /* keep the vector ground */ }
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    };
    setTimeout(go, 700);
  }
  let flutters = []; // butterflies: {el, x, y}
  function addSprite(cls, x, y, sp, inner) {
    const d = document.createElement('div');
    d.className = 'sp ' + cls;
    d.style.width = sp.w + 'px'; d.style.height = sp.h + 'px';
    d.style.transform = 'translate3d(' + (x - sp.ax) + 'px,' + (y - sp.ay) + 'px,0)';
    d.style.zIndex = Math.round(y);
    d.innerHTML = inner;
    L.sprites.appendChild(d);
    return d;
  }
  function gridSvg() {
    const g = G();
    let s = '<svg viewBox="0 0 ' + g.W + ' ' + g.H + '" width="' + g.W + '" height="' + g.H + '" aria-hidden="true"><defs><clipPath id="v-gridclip"><path d="' + A().landPath() + '"/></clipPath></defs><g clip-path="url(#v-gridclip)" stroke="rgba(255,255,255,.55)" stroke-width="1" fill="none">';
    const R = g.tileRange();
    for (let i = R.i0; i <= R.i1; i++) { const a = g.toWorld(i, R.j0), b = g.toWorld(i, R.j1); s += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>'; }
    for (let j = R.j0; j <= R.j1; j++) { const a = g.toWorld(R.i0, j), b = g.toWorld(R.i1, j); s += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>'; }
    return s + '</g></svg>';
  }
  function ambientHtml() {
    const g = G(), P = g.POND, SH = g.SH;
    let h = '';
    h += '<div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div>';
    [[P.x - 60, P.y - 10], [P.x + 40, P.y + 20], [P.x + 10, P.y - 40]].forEach((p, k) => { h += '<div class="ripple" style="left:' + p[0] + 'px;top:' + p[1] + 'px;animation-delay:' + (k * 1.3) + 's"></div>'; });
    if (night()) {
      for (let k = 0; k < 16; k++) { const r = FF.rng(k + 99); h += '<div class="firefly" style="left:' + Math.round(120 + r() * (g.W - 240)) + 'px;top:' + Math.round(220 + r() * (g.H - 440)) + 'px;animation-delay:-' + (r() * 6).toFixed(1) + 's;animation-duration:' + (5 + r() * 5).toFixed(1) + 's"></div>'; }
    } else {
      const fly = '<svg viewBox="0 0 20 16" width="16" height="13"><g class="wing-l"><path d="M10 8C6 1 1 2 2 7c1 3 5 3 8 1z" fill="var(--bf)"/></g><g class="wing-r"><path d="M10 8c4-7 9-6 8-1-1 3-5 3-8 1z" fill="var(--bf)"/></g><rect x="9.3" y="5" width="1.4" height="7" rx=".7" fill="#4A3B2A"/></svg>';
      [['#FFB0C8', 300, 640], ['#FFE07A', 640, 760], ['#B9E4FF', 420, 1080], ['#FFFFFF', 760, 980]].forEach((b, k) => { h += '<div class="butterfly b' + k + '" style="left:' + (b[1] + SH.x) + 'px;top:' + (b[2] + SH.y) + 'px;--bf:' + b[0] + '">' + fly + '</div>'; });
    }
    return h;
  }

  /* ---------------- sync with state ---------------- */
  function render() {
    if (!el) return;
    const f = S().family();
    if (!f) return;
    if (builtFor !== (night() ? 'n' : 'd') + FF.i18n.lang) { build(); return; }
    const me = S().state.meId;
    // houses
    const seen = {};
    f.members.forEach((id) => {
      const m = S().member(id);
      const pos = f.layout[id];
      if (!m || !pos) return;
      seen[id] = 1;
      const lv = FF.family.visibleLevel(m, me);
      const key = JSON.stringify(m.house) + lv + night();
      let hs = houses[id];
      if (!hs) {
        hs = houses[id] = { el: document.createElement('div'), tag: document.createElement('button'), key: '', id };
        hs.el.className = 'sp house';
        hs.el.dataset.id = id;
        hs.el.style.width = A().HOUSE_VB.w + 'px'; hs.el.style.height = A().HOUSE_VB.h + 'px';
        L.sprites.appendChild(hs.el);
        hs.tag.type = 'button';
        hs.tag.className = 'tag';
        hs.tag.dataset.id = id;
        L.tags.appendChild(hs.tag);
      }
      if (hs.key !== key) {
        const meta = {};
        const svg = A().house(m.house, lv, { split: true, meta });
        hs.meta = meta;
        let extra = '', back = '', front = '';
        if (meta.chimney) extra += '<div class="smoke-layer" style="left:' + (meta.chimney[0] + 96) + 'px;top:' + (meta.chimney[1] + 228) + 'px"><i></i><i></i><i></i></div>';
        if (meta.flag && m.house.flag && m.house.flag.on) extra += '<div class="flag-layer" style="left:' + (meta.flag[0] + 96) + 'px;top:' + (meta.flag[1] + 228) + 'px">' + A().flagCloth(m.house.flag) + '</div>';
        if (meta.grand) extra += '<div class="sparkles" style="left:96px;top:' + Math.round(meta.top + 228 + 46) + 'px"><i></i><i></i><i></i><i></i><i></i></div>';
        // shop decorations: each its own layer (anything that moves animates on the GPU)
        A().decoLayers(FF.play.shownDeco(m.house), meta).forEach((l) => { const x = A().layerHtml(l, 96, 228); if (l.back) back += x; else front += x; });
        hs.el.innerHTML = '<div class="h-foot"></div><div class="h-body" style="--jd:-' + ((FF.hash(id) % 10) / 20).toFixed(2) + 's">' + back + svg + extra + front + '</div>';
        hs.paused = null; // fresh animations: let cull() decide again
        hs.burning = null; // (its fire, if any, is put back by syncBurns)
        hs.key = key;
        hs.top = meta.top;
      }
      hs.el.classList.toggle('mine', id === me);
      placeHouse(hs, pos.i, pos.j);
      // floating tag: photo, name, net worth (privacy aware)
      const s = FF.calc.summary(m.pf, m.pf.base);
      const nw = S().canSee(me, id, 'netWorth') ? '<span class="tag-nw num">' + FF.i18n.money(s.value, m.pf.base, { compact: true, whole: s.value >= 10000 ? false : true }) + '</span>' : '<span class="tag-nw lock">' + ic('lock', 11) + t('village.private') + '</span>';
      hs.tag.className = 'tag' + (id === me ? ' me' : '');
      hs.tag.setAttribute('aria-label', t(id === me ? 'village.yourHouse' : 'village.visitX', { name: m.name }));
      hs.tag.innerHTML = '<span class="tag-in">' + A().avatar(m.avatar, 30) + '<span class="tag-txt"><b>' + esc(m.name) + '</b>' + nw + '</span>' + (id === me ? '<span class="tag-you">' + t('common.you') + '</span>' : '') + '</span>';
    });
    Object.keys(houses).forEach((id) => { if (!seen[id]) { houses[id].el.remove(); houses[id].tag.remove(); delete houses[id]; } });
    // goals stand
    const done = f.goals.filter((g) => g.done).length;
    const skey = done + '/' + f.goals.length + night() + FF.i18n.lang;
    if (!stand) {
      stand = { el: document.createElement('div'), tag: document.createElement('button'), key: '' };
      stand.el.className = 'sp stand';
      stand.el.dataset.id = '_stand';
      L.sprites.appendChild(stand.el);
      stand.tag.type = 'button';
      stand.tag.className = 'tag tag-goals';
      stand.tag.dataset.id = '_stand';
      L.tags.appendChild(stand.tag);
    }
    if (stand.key !== skey) {
      const sp = A().goalsStand({ title: t('village.goalsPoster', { year: FF.i18n.year(FF.ymd(FF.today()).y) }), done, total: f.goals.length });
      stand.sp = sp;
      stand.el.style.width = sp.w + 'px'; stand.el.style.height = sp.h + 'px';
      stand.el.innerHTML = '<div class="h-foot"></div><div class="h-body" style="--jd:-.3s">' + sp.svg + '</div>';
      stand.key = skey;
    }
    stand.tag.setAttribute('aria-label', t('village.openGoals'));
    stand.tag.innerHTML = '<span class="tag-in">' + ic('target', 16) + '<b>' + t('village.goalsTag') + '</b><span class="num">' + done + '/' + f.goals.length + '</span></span>';
    placeStand(f.layout._stand.i, f.layout._stand.j);
    syncHall(f);
    syncArcade(f);
    syncLucky(f);
    syncNews(f);
    syncSage(f);
    syncYard(f, me);
    syncBurns();
    syncPond();
    // animals for unlocked pets
    syncAnimals();
    animals.forEach((a) => {
      if (reduced()) { if (a.walk) { stopWalk(a); setState(a, 'idle'); } clearTimeout(a.t); a.t = null; a.waiting = true; return; }
      if (a.xp && !a.run && farFromHome(where(a))) { stopWalk(a); decide(a); } else wake(a);
    });
    hud();
    applyCam();
  }
  function placeHouse(hs, i, j) {
    const c = G().center(i, j);
    hs.i = i; hs.j = j; hs.x = c.x; hs.y = c.y;
    hs.el.style.transform = 'translate3d(' + (c.x - 96) + 'px,' + (c.y - 228) + 'px,0)';
    hs.el.style.zIndex = Math.round(c.y + 30);
    hs.tag.style.transform = 'translate3d(' + c.x + 'px,' + (c.y + (hs.top || -140) - 8) + 'px,0)';
    petsFollow(hs);
  }
  function placeStand(i, j) {
    const c = G().center(i, j);
    stand.i = i; stand.j = j; stand.x = c.x; stand.y = c.y;
    stand.el.style.transform = 'translate3d(' + (c.x - stand.sp.ax) + 'px,' + (c.y + 18 - stand.sp.ay) + 'px,0)';
    stand.el.style.zIndex = Math.round(c.y + 30);
    stand.tag.style.transform = 'translate3d(' + c.x + 'px,' + (c.y + 18 - stand.sp.ay - 6) + 'px,0)';
  }
  /* the Town Hall: family assets, its total on top. Before it exists: a plot to build it */
  function syncHall(f) {
    const built = !!f.hall;
    const pos = f.layout._hall || (hall && !hall.built && hall.site && hall.siteFor === f.members.length ? hall.site : S().hallSpot(S().occupied()));
    if (!f.layout._hall && hall) { hall.site = pos; hall.siteFor = f.members.length; }
    if (!hall) {
      hall = { el: document.createElement('div'), tag: document.createElement('button'), key: '' };
      hall.el.className = 'sp hall';
      hall.el.dataset.id = '_hall';
      L.sprites.appendChild(hall.el);
      hall.tag.type = 'button';
      hall.tag.dataset.id = '_hall';
      L.tags.appendChild(hall.tag);
    }
    const key = (built ? 'hall' : 'site') + night();
    if (hall.key !== key) {
      const sp = built ? A().townHall({}) : A().buildSite();
      hall.sp = sp;
      hall.el.style.width = sp.w + 'px'; hall.el.style.height = sp.h + 'px';
      hall.el.innerHTML = footOf(sp) + '<div class="h-body" style="--jd:-.6s">' + sp.svg + '</div>';
      hall.paused = null;
      hall.key = key;
    }
    hall.built = built;
    hall.el.classList.toggle('site', !built);
    hall.tag.className = 'tag tag-hall' + (built ? '' : ' site');
    if (built) {
      const base = S().me().pf.base;
      const total = FF.ledger.hallTotal(f.hall, base);
      hall.tag.setAttribute('aria-label', t('hall.open', { name: f.hall.name }));
      hall.tag.innerHTML = '<span class="tag-in"><span class="hall-ic" aria-hidden="true">🏛️</span><span class="tag-txt"><b>' + esc(f.hall.name) + '</b><span class="tag-nw num">' + FF.i18n.money(total, base, { compact: true, whole: total >= 10000 ? false : true }) + '</span></span></span>';
    } else {
      hall.tag.setAttribute('aria-label', t('hall.buildT'));
      hall.tag.innerHTML = '<span class="tag-in">' + ic('hammer', 16) + '<b>' + t('hall.buildTag') + '</b></span>';
    }
    placeHall(pos.i, pos.j);
  }
  function placeHall(i, j) {
    const c = G().center(i, j);
    hall.i = i; hall.j = j; hall.x = c.x; hall.y = c.y;
    const y0 = c.y + 18 - hall.sp.ay;
    hall.el.style.transform = 'translate3d(' + (c.x - hall.sp.ax) + 'px,' + y0 + 'px,0)';
    hall.el.style.zIndex = Math.round(c.y + 30);
    hall.tag.style.transform = 'translate3d(' + c.x + 'px,' + (y0 + (hall.built ? 18 : 22)) + 'px,0)';
  }
  /* the green / red spot shown while a building is moved (edit mode): a house-sized diamond centred on
     the tile the building stands on — placed from the building's own anchor (each picture differs) */
  const footOf = (sp) => '<div class="h-foot" style="left:' + Math.round(sp.ax - 72) + 'px;top:' + Math.round(sp.ay - 18 - 36) + 'px"></div>';
  /* the Block Blast arcade: tap to play; its sign shows the family champion */
  function syncArcade(f) {
    const pos = f.layout._arcade;
    if (!pos) return;
    if (!arcade) {
      arcade = { el: document.createElement('div'), tag: document.createElement('button'), key: '' };
      arcade.el.className = 'sp arcade';
      arcade.el.dataset.id = '_arcade';
      L.sprites.appendChild(arcade.el);
      arcade.tag.type = 'button';
      arcade.tag.className = 'tag tag-arcade';
      arcade.tag.dataset.id = '_arcade';
      L.tags.appendChild(arcade.tag);
    }
    const key = 'a' + night();
    if (arcade.key !== key) {
      const sp = A().arcade({});
      arcade.sp = sp;
      arcade.el.style.width = sp.w + 'px'; arcade.el.style.height = sp.h + 'px';
      const sg = sp.sign;
      // the neon glow blinks on its own layer (opacity only — the GPU does it)
      arcade.el.innerHTML = footOf(sp) + '<div class="h-body" style="--jd:-.45s">' + sp.svg + '<i class="neon" style="left:' + (sg[0] - 4) + 'px;top:' + (sg[1] - 4) + 'px;width:' + (sg[2] + 8) + 'px;height:' + (sg[3] + 8) + 'px"></i></div>';
      arcade.key = key;
    }
    arcadeTag();
    placeArcade(pos.i, pos.j);
  }
  /* its sign: the family champion — or, while family members are playing, who (tap to watch) */
  function arcadeTag() {
    if (!arcade) return;
    const live = FF.blast ? FF.blast.livePlayers() : [];
    // the sign crowns this week's best (since Monday) — like the ranking, which opens on "This week";
    // the all-time best is one tap away there
    const top = S().blastBoard('week').filter((x) => x.v > 0)[0];
    const key = live.map((x) => x.uid).join() + '|' + (top ? top.m.id + top.v : '') + '|' + FF.weekOf(S().dayNow()) + '|' + FF.i18n.lang;
    if (arcade.tagKey === key) return;
    const fresh = live.length && !(arcade.tagKey || '').split('|')[0];
    arcade.tagKey = key;
    arcade.tag.setAttribute('aria-label', live.length ? t('bb.watchT') : t('bb.open'));
    arcade.tag.classList.toggle('live', !!live.length);
    const who = live.length === 1 ? (S().member(live[0].uid) || {}).name || '' : '';
    arcade.tag.innerHTML = '<span class="tag-in' + (fresh ? ' ping' : '') + '"><span class="bb-ic" aria-hidden="true">🧩</span><span class="tag-txt"><b>' + t('bb.name') + '</b>' +
      (live.length ? '<span class="tag-live"><i aria-hidden="true"></i>' + esc(who ? t('bb.tagLive1', { name: who }) : t('bb.tagLiveN', { n: live.length })) + '</span>'
        : '<span class="tag-nw">' + (top ? '👑 ' + esc(top.m.name) + ' · <span class="num">' + FF.i18n.num(top.v, 0) + '</span>' : t('bb.tapToPlay')) + '</span>') + '</span></span>';
  }
  // someone starts or stops a game: only the arcade's sign changes (nothing else re-renders)
  FF.on('live', (e) => { if (e && e.k === 'on') arcadeTag(); });
  function placeArcade(i, j) {
    const c = G().center(i, j);
    arcade.i = i; arcade.j = j; arcade.x = c.x; arcade.y = c.y;
    const y0 = c.y + 18 - arcade.sp.ay;
    arcade.el.style.transform = 'translate3d(' + (c.x - arcade.sp.ax) + 'px,' + y0 + 'px,0)';
    arcade.el.style.zIndex = Math.round(c.y + 30);
    arcade.tag.style.transform = 'translate3d(' + c.x + 'px,' + (y0 + arcade.sp.sign[1] - 6) + 'px,0)';
  }

  /* =========================================================
     THE LUCKY MARKET · PETS · PLANTS · FIRE · THE POND (lucky.js)
     All still pictures — a pet or a plant costs nothing while you
     look at it. Only a burning house animates (its flames are
     paused off screen and while the map moves, like the rest).
     ========================================================= */
  let lucky = null;              // the market building
  const plants = {};             // 'pl_<id>' → sprite
  const gpets = {};              // 'gp_<id>' → sprite (sits by its owner's house)
  let pond = null;               // the fishing sign + tag
  function syncLucky(f) {
    const pos = f.layout._lucky;
    if (!pos) return;
    if (!lucky) {
      lucky = { el: document.createElement('div'), tag: document.createElement('button'), key: '' };
      lucky.el.className = 'sp lucky';
      lucky.el.dataset.id = '_lucky';
      L.sprites.appendChild(lucky.el);
      lucky.tag.type = 'button';
      lucky.tag.className = 'tag tag-lucky';
      lucky.tag.dataset.id = '_lucky';
      L.tags.appendChild(lucky.tag);
    }
    const key = 'l' + night();
    if (lucky.key !== key) {
      const sp = A().luckyMarket();
      lucky.sp = sp;
      lucky.el.style.width = sp.w + 'px'; lucky.el.style.height = sp.h + 'px';
      lucky.el.innerHTML = footOf(sp) + '<div class="h-body" style="--jd:-.2s">' + sp.svg + '</div>';
      lucky.key = key;
    }
    const left = S().me() ? FF.lucky.leftToday(S().playOf(), S().dayNow()) : 0;
    lucky.tag.setAttribute('aria-label', t('lk.open'));
    lucky.tag.innerHTML = '<span class="tag-in"><span class="lk-ic" aria-hidden="true">🍀</span><span class="tag-txt"><b>' + t('lk.name') + '</b><span class="tag-nw">' + (left > 0 ? t('lk.tagLeft', { n: left, count: left }) : t('lk.tagSoldOut')) + '</span></span></span>';
    placeLucky(pos.i, pos.j);
  }
  /* the News mailbox: its flag is up when there's news you haven't looked at (no feed is
     checked for that — just whether you've opened it in the last 3 hours) */
  let news = null;
  const newsFresh = () => Date.now() - (FF.newsUI ? FF.newsUI.lastSeen() : 0) > 3 * 36e5;
  function syncNews(f) {
    const pos = f.layout._news;
    if (!pos) return;
    if (!news) {
      news = { el: document.createElement('div'), tag: document.createElement('button'), key: '' };
      news.el.className = 'sp news';
      news.el.dataset.id = '_news';
      L.sprites.appendChild(news.el);
      news.tag.type = 'button';
      news.tag.className = 'tag tag-news';
      news.tag.dataset.id = '_news';
      L.tags.appendChild(news.tag);
    }
    const fresh = newsFresh(), key = 'n' + night() + (fresh ? 1 : 0);
    if (news.key !== key) {
      const sp = A().newsBox({ flag: fresh });
      news.sp = sp;
      news.el.style.width = sp.w + 'px'; news.el.style.height = sp.h + 'px';
      news.el.innerHTML = footOf(sp) + '<div class="h-body" style="--jd:-.6s">' + sp.svg + '</div>';
      news.key = key;
    }
    const today = S().me() ? S().newsToday() : null, goal = FF.play.NEWS.GOAL;
    news.tag.setAttribute('aria-label', t('news.open'));
    news.tag.innerHTML = '<span class="tag-in"><span class="nw-tag-ic" aria-hidden="true">📰</span><span class="tag-txt"><b>' + t('news.name') + '</b><span class="tag-nw">' +
      (today && today.done ? t('news.tagDone') : fresh ? t('news.tagFresh') : t('news.tagRead', { n: today ? today.n : 0, goal })) + '</span></span></span>';
    placeNews(pos.i, pos.j);
  }
  /* the Mystery Man: lying in the grass, his hat over his eyes. Tap him for a true fact and a
     quiz (screens-sage.js). A still picture — only his wheat stalk, a box of its own, sways as
     he chews (on the GPU; it stops with everything else when the village dozes). */
  let sage = null;
  function syncSage(f) {
    const pos = f.layout._sage;
    if (!pos) return;
    if (!sage) {
      sage = { el: document.createElement('div'), tag: document.createElement('button'), key: '' };
      sage.el.className = 'sp sage';
      sage.el.dataset.id = '_sage';
      L.sprites.appendChild(sage.el);
      sage.tag.type = 'button';
      sage.tag.className = 'tag tag-sage';
      sage.tag.dataset.id = '_sage';
      L.tags.appendChild(sage.tag);
    }
    const key = 's' + night();
    if (sage.key !== key) {
      const sp = A().sageMan(), wh = sp.wheat;
      sage.sp = sp;
      sage.el.style.width = sp.w + 'px'; sage.el.style.height = sp.h + 'px';
      sage.el.innerHTML = footOf(sp) + '<div class="h-body" style="--jd:-.15s">' + sp.svg +
        '<i class="sage-wheat" style="left:' + wh[0] + 'px;top:' + wh[1] + 'px;width:' + wh[2] + 'px;height:' + wh[3] + 'px">' + sp.wheatSvg + '</i></div>';
      sage.key = key;
    }
    const today = S().me() ? S().sageToday() : null, left = today ? Math.max(0, FF.play.SAGE.DAILY - today.n) : 0;
    sage.tag.setAttribute('aria-label', t('sage.open'));
    sage.tag.innerHTML = '<span class="tag-in"><span class="sg-ic" aria-hidden="true">❓</span><span class="tag-txt"><b>' + t('sage.name') + '</b><span class="tag-nw">' +
      (left > 0 ? t('sage.tagLeft', { n: left * FF.play.SAGE.GEMS }) : t('sage.tagDone')) + '</span></span></span>';
    placeSage(pos.i, pos.j);
  }
  function placeSage(i, j) {
    const c = G().center(i, j);
    sage.i = i; sage.j = j; sage.x = c.x; sage.y = c.y;
    const y0 = c.y + 18 - sage.sp.ay;
    sage.el.style.transform = 'translate3d(' + (c.x - sage.sp.ax) + 'px,' + y0 + 'px,0)';
    sage.el.style.zIndex = Math.round(c.y + 30);
    sage.tag.style.transform = 'translate3d(' + (c.x - sage.sp.ax + sage.sp.sign[0] + sage.sp.sign[2] / 2) + 'px,' + (y0 + sage.sp.sign[1] - 4) + 'px,0)';
  }
  function placeNews(i, j) {
    const c = G().center(i, j);
    news.i = i; news.j = j; news.x = c.x; news.y = c.y;
    const y0 = c.y + 18 - news.sp.ay;
    news.el.style.transform = 'translate3d(' + (c.x - news.sp.ax) + 'px,' + y0 + 'px,0)';
    news.el.style.zIndex = Math.round(c.y + 30);
    news.tag.style.transform = 'translate3d(' + (c.x - news.sp.ax + news.sp.sign[0] + news.sp.sign[2] / 2) + 'px,' + (y0 + news.sp.sign[1] - 4) + 'px,0)';
  }
  function placeLucky(i, j) {
    const c = G().center(i, j);
    lucky.i = i; lucky.j = j; lucky.x = c.x; lucky.y = c.y;
    const y0 = c.y + 18 - lucky.sp.ay;
    lucky.el.style.transform = 'translate3d(' + (c.x - lucky.sp.ax) + 'px,' + y0 + 'px,0)';
    lucky.el.style.zIndex = Math.round(c.y + 30);
    lucky.tag.style.transform = 'translate3d(' + (c.x - lucky.sp.ax + lucky.sp.sign[0] + lucky.sp.sign[2] / 2) + 'px,' + (y0 + lucky.sp.sign[1] - 6) + 'px,0)';
  }
  function syncYard(f, me) {
    const day = S().dayNow(), idx = S().plantIndex(), seenP = {}, seenQ = {};
    // plants: wherever their key sits on the map
    Object.keys(f.layout).forEach((k) => {
      if (k.indexOf('pl_') !== 0) return;
      const hit = idx[k];
      if (!hit) return;
      seenP[k] = 1;
      let o = plants[k];
      if (!o) { o = plants[k] = { el: document.createElement('div'), key: '', id: k }; o.el.className = 'sp plant'; o.el.dataset.id = k; L.sprites.appendChild(o.el); }
      const thirsty = hit.owner === me && FF.lucky.thirsty(hit.plant, day);
      const key = FF.lucky.stage(hit.plant) + '|' + hit.plant.sp + '|' + thirsty + '|' + night();
      if (o.key !== key) {
        o.el.className = 'sp plant st-' + FF.lucky.stage(hit.plant);
        o.el.innerHTML = '<div class="pl-in">' + A().lkPlant(hit.plant, 60) + '</div>' + (thirsty ? '<span class="need-b" aria-hidden="true">💧</span>' : '');
        o.key = key;
      }
      o.owner = hit.owner; o.pid = hit.plant.id;
      placePlant(o, f.layout[k].i, f.layout[k].j);
    });
    Object.keys(plants).forEach((k) => { if (!seenP[k]) { plants[k].el.remove(); delete plants[k]; } });
    // pets: by their owner's house
    S().familyMembers().forEach((m) => {
      if (!houses[m.id]) return;
      S().yardOf(m).pets.slice(0, FF.lucky.MAX_PETS).forEach((pt, n) => {
        if (!FF.lucky.PETS[pt.sp]) return;
        const k = 'gp_' + pt.id;
        seenQ[k] = 1;
        let o = gpets[k];
        if (!o) { o = gpets[k] = { el: document.createElement('div'), key: '', id: k }; o.el.className = 'sp gpet'; o.el.dataset.id = k; L.sprites.appendChild(o.el); }
        const nd = m.id === me ? FF.lucky.need(pt, day) : null, form = FF.lucky.shownForm(pt), base = FF.lucky.PETS[pt.sp].size;
        const key = pt.sp + form + '|' + nd + '|' + night();
        if (o.key !== key) {
          o.size = Math.round(base * FF.lucky.FORM_SCALE[form]);
          o.el.style.width = o.size + 'px'; o.el.style.height = o.size + 'px';
          o.el.innerHTML = '<div class="gp-in">' + A().lkPet(pt.sp, form, base) + '</div>' + (nd ? '<span class="need-b" aria-hidden="true">' + (nd === 'food' ? '🍖' : '💧') + '</span>' : '');
          o.key = key;
        }
        o.owner = m.id; o.pid = pt.id; o.n = n; o.house = m.id;
        placePet(o);
      });
    });
    Object.keys(gpets).forEach((k) => { if (!seenQ[k]) { gpets[k].el.remove(); delete gpets[k]; } });
  }
  function placePet(o) {
    const hs = houses[o.house];
    if (!hs || hs.x == null) return;
    const SP = FF.lucky.PET_SPOTS, sp = SP[o.n % SP.length], x = hs.x + sp[0], y = hs.y + sp[1];
    o.x = x; o.y = y;
    o.el.style.transform = 'translate3d(' + (x - o.size / 2).toFixed(1) + 'px,' + (y - o.size * 0.92).toFixed(1) + 'px,0)';
    o.el.style.zIndex = Math.round(y + 30);
  }
  function petsFollow(hs) { Object.keys(gpets).forEach((k) => { if (gpets[k].house === hs.id) placePet(gpets[k]); }); }
  function placePlant(o, i, j) {
    const c = G().center(i, j);
    o.i = i; o.j = j; o.x = c.x; o.y = c.y;
    o.el.style.transform = 'translate3d(' + (c.x - 24) + 'px,' + (c.y - 56) + 'px,0)';
    o.el.style.zIndex = Math.round(c.y + 30);
  }
  /* a house someone threw a Molotov at: flames on the roof for a day */
  function syncBurns() {
    const b = S().burns(Date.now());
    Object.keys(houses).forEach((id) => {
      const hs = houses[id], on = !!b[id];
      if (on === hs.burning) return;
      hs.burning = on;
      hs.el.classList.toggle('burning', on);
      const old = hs.el.querySelector('.fire');
      if (old) old.remove();
      if (on) {
        const fire = document.createElement('div');
        fire.className = 'fire';
        fire.style.left = '96px'; fire.style.top = Math.round(228 + (hs.top || -140) + 38) + 'px';
        fire.innerHTML = '<i></i><i></i><i></i><i></i><b></b>';
        hs.el.querySelector('.h-body').appendChild(fire);
        hs.paused = null; cullSoon(); // off screen or while the map moves, the flames wait too
      }
    });
  }
  /* the pond: a little fishing sign and its tag */
  function syncPond() {
    const PD = G().POND;
    if (!pond) {
      const sp = A().pondSign();
      pond = { el: document.createElement('div'), tag: document.createElement('button'), sp };
      pond.el.className = 'sp pondsign';
      pond.el.dataset.id = '_pond';
      pond.el.style.width = sp.w + 'px'; pond.el.style.height = sp.h + 'px';
      pond.el.innerHTML = sp.svg;
      L.sprites.appendChild(pond.el);
      pond.tag.type = 'button';
      pond.tag.className = 'tag tag-pond';
      pond.tag.dataset.id = '_pond';
      L.tags.appendChild(pond.tag);
      const x = PD.x - PD.rx - 6, y = PD.y + 8;
      pond.el.style.transform = 'translate3d(' + (x - sp.ax) + 'px,' + (y - sp.ay) + 'px,0)';
      pond.el.style.zIndex = Math.round(y + 30);
      pond.tag.style.transform = 'translate3d(' + PD.x + 'px,' + (PD.y - PD.ry - 16) + 'px,0)';
    }
    const left = S().me() ? FF.lucky.castsLeft(S().playOf(), S().dayNow()) : 0;
    pond.tag.setAttribute('aria-label', t('lf.title'));
    pond.tag.innerHTML = '<span class="tag-in"><span class="lk-ic fish" aria-hidden="true">🎣</span><span class="tag-txt"><b>' + t('lf.tag') + '</b><span class="tag-nw">' + (left > 0 ? t('lf.left', { n: left, count: left }) : t('lf.tagDone')) + '</span></span></span>';
  }
  /* a Molotov flies from the bottom of the screen onto a house (x moves evenly, y arcs) */
  function throwAt(targetId, done) {
    const hs = houses[targetId];
    if (!hs || !vp) { if (done) done(); return; }
    lookAt(hs.x, hs.y - 70, Math.max(cam.s, 0.9), true);
    if (reduced()) { if (done) done(); return; }
    setTimeout(() => {
      const r = vp.getBoundingClientRect(), to = toScreen(hs.x, hs.y + (hs.top || -140) + 46);
      const from = { x: r.left + r.width / 2, y: r.bottom - 60 };
      const outer = document.createElement('div'), inner = document.createElement('div');
      outer.className = 'molotov-fly'; inner.className = 'mf-in';
      inner.innerHTML = A().lkItem('molotov', 36);
      outer.appendChild(inner); document.body.appendChild(outer);
      const dur = 760, peak = Math.min(from.y, to.y) - 150;
      outer.animate([{ transform: 'translateX(' + (from.x - 18) + 'px)' }, { transform: 'translateX(' + (to.x - 18) + 'px)' }], { duration: dur, easing: 'linear', fill: 'forwards' });
      const a = inner.animate([
        { transform: 'translateY(' + (from.y - 18) + 'px) rotate(0deg)', easing: 'cubic-bezier(.2,.7,.4,1)' },
        { transform: 'translateY(' + (peak - 18) + 'px) rotate(300deg)', offset: 0.45, easing: 'cubic-bezier(.6,0,.8,.4)' },
        { transform: 'translateY(' + (to.y - 18) + 'px) rotate(620deg)' }
      ], { duration: dur, fill: 'forwards' });
      ui().sfx.whoosh();
      a.onfinish = () => { outer.remove(); ui().sfx.stamp(); ui().haptic(); dust(hs.x, hs.y + (hs.top || -140) + 60); hearts(hs.x, hs.y + (hs.top || -140) + 30, 4, '🔥'); if (done) done(); };
    }, reduced() ? 0 : 520);
  }
  /* bring a plant or pet into view (after buying one) */
  function showThing(id) {
    const o = plants[id] || gpets[id];
    if (o && o.x != null) { lookAt(o.x, o.y - 30, Math.max(cam.s, 1), true); setTimeout(() => bounceEl(o.el), 500); }
  }
  /* a freshly built hall: bounce, dust, confetti */
  function hallBuilt() {
    render();
    if (!hall) return;
    lookAt(hall.x, hall.y - 80, Math.max(cam.s, 0.95), true);
    bounceEl(hall.el);
    setTimeout(() => { dust(hall.x, hall.y + 18); const p = toScreen(hall.x, hall.y - 120); ui().confetti({ x: p.x, y: p.y, n: 140 }); ui().sfx.success(); }, reduced() ? 0 : 380);
  }
  function hud() {
    const f = S().family();
    el.querySelector('.v-sign').innerHTML = '<div class="sign-board"><b>' + esc(f.name) + '</b><span>' + t('village.members', { n: f.members.length }) + '</span></div>';
    // top right: your gems (→ the Shop) beside Invite, and the edit hammer underneath
    el.querySelector('.v-btns').innerHTML = editing ? '' :
      '<div class="v-row">' + (S().me() ? FF.spinUI.hudBtn() + FF.shop.pill() : '') + '<button type="button" class="wood-btn" data-hud="invite" aria-label="' + esc(t('menu.invite')) + '">' + ic('userPlus', 22) + '</button></div>' +
      '<button type="button" class="wood-btn" data-hud="edit" aria-label="' + esc(t('village.edit')) + '">' + ic('hammer', 22) + '</button>';
    el.querySelector('.v-editbar').innerHTML = editing ? '<div class="eb-hint">' + ic('move', 18) + '<span>' + t('village.editHint') + '</span></div><button type="button" class="btn btn-primary" data-hud="done">' + ic('check', 18) + t('common.done') + '</button>' : '';
    ui().fitAll(el.querySelector('.v-hud'));
  }
  function onHudClick(e) {
    const b = e.target.closest('[data-hud]');
    if (!b) return;
    ui().sfx.tap();
    const k = b.dataset.hud;
    if (k === 'invite') FF.family.openInvite();
    else if (k === 'spin') FF.spinUI.open();
    else if (k === 'edit') setEdit(true);
    else if (k === 'done') setEdit(false);
  }

  /* ---------------- camera ---------------- */
  function minScale() { return Math.max(vw / G().W, vh / G().H, 0.5); }
  function clampCam() {
    const g = G();
    cam.s = FF.clamp(cam.s, minScale(), 1.9);
    const ww = g.W * cam.s, wh = g.H * cam.s;
    cam.x = ww <= vw ? (vw - ww) / 2 : FF.clamp(cam.x, vw - ww, 0);
    // a little room past the map's top and bottom: roofs at the top of the island stay in view,
    // and the bottom can be scrolled clear of the tab bar
    const top = g.HEADROOM.top * cam.s, bottom = g.HEADROOM.bottom * cam.s;
    cam.y = wh <= vh ? (vh - wh) / 2 : FF.clamp(cam.y, vh - wh - bottom, top);
  }
  let invShown = null, camRaf = null;
  function apply() {
    if (camRaf) { cancelAnimationFrame(camRaf); camRaf = null; }
    world.style.transform = 'translate3d(' + cam.x.toFixed(2) + 'px,' + cam.y.toFixed(2) + 'px,0) scale(' + cam.s.toFixed(4) + ')';
    const inv = (1 / cam.s).toFixed(4);
    if (inv !== invShown) { invShown = inv; L.tags.style.setProperty('--inv', inv); }
    cullSoon();
  }
  /* finger moves come faster than the screen refreshes (up to 120 a second): draw once per frame */
  function requestApply() { if (!camRaf) camRaf = requestAnimationFrame(() => { camRaf = null; apply(); }); }
  /* Animations drawn inside an SVG picture (walking legs, wings, twinkling lights, a waving
     paw) are repainted by the phone every frame. They wait while a finger moves the map and
     while they're off screen; everything else runs on the GPU and never waits.
     (Paused through the Web Animations API: no restyling of the village.) */
  let isMoving = false, moveT = null;
  function setMoving(on) {
    clearTimeout(moveT);
    if (on) { if (!isMoving) { isMoving = true; cull(); } return; }
    moveT = setTimeout(() => { isMoving = false; cull(); }, 180);
  }
  let cullT = null;
  function cullSoon() { if (!cullT) cullT = setTimeout(() => { cullT = null; cull(); }, 250); }
  function cull() {
    if (!el || !vp) return;
    const m = 160 / cam.s;
    const x0 = -cam.x / cam.s - m, y0 = -cam.y / cam.s - m, x1 = (vw - cam.x) / cam.s + m, y1 = (vh - cam.y) / cam.s + m;
    const off = (b) => b.x1 < x0 || b.x0 > x1 || b.y1 < y0 || b.y0 > y1;
    const flip = new Map(); // owner element → pause?  (only the ones that changed)
    const set = (g, box) => {
      g.off = off(box);
      const pause = g.off || isMoving;
      if (g.paused !== pause && g.el) { g.paused = pause; flip.set(g.el, pause); }
    };
    Object.keys(houses).forEach((id) => { const h = houses[id]; set(h, { x0: h.x - 100, y0: h.y - 240, x1: h.x + 100, y1: h.y + 50 }); });
    if (hall && hall.sp) set(hall, { x0: hall.x - hall.sp.ax, y0: hall.y - hall.sp.ay, x1: hall.x + hall.sp.ax, y1: hall.y + 40 });
    animals.forEach((a) => { where(a); set(a, { x0: a.x - 60, y0: a.y - 60, x1: a.x + 60, y1: a.y + 20 }); if (!a.off && a.waiting) wake(a); });
    flutters.forEach((b) => set(b, { x0: b.x - 40, y0: b.y - 80, x1: b.x + 180, y1: b.y + 80 }));
    if (!flip.size || !el.getAnimations) return;
    // one pass over the village's animations (asking per house/animal would restyle the page each time)
    el.getAnimations({ subtree: true }).forEach((an) => {
      const tg = an.effect && an.effect.target;
      if (!(tg instanceof SVGElement) && !(tg && tg.parentNode && tg.parentNode.classList && tg.parentNode.classList.contains('fire'))) return;
      const owner = tg.closest('.sp, .butterfly');
      if (!owner || !flip.has(owner)) return;
      try { if (flip.get(owner)) an.pause(); else an.play(); } catch (e) { /* finished or removed */ }
    });
  }
  const applyCam = () => { if (vp) { clampCam(); apply(); } };
  function lookAt(x, y, s, animate) {
    cam.s = s || cam.s;
    cam.x = vw / 2 - x * cam.s;
    cam.y = vh / 2 - y * cam.s;
    clampCam();
    if (animate && !reduced()) { world.classList.add('glide'); setTimeout(() => world.classList.remove('glide'), 620); }
    apply();
  }
  function centerInitial(animate) {
    measure();
    const f = S().family();
    if (!f) return;
    const pts = Object.keys(f.layout).map((id) => G().center(f.layout[id].i, f.layout[id].j));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min.apply(null, xs) - 100, x1 = Math.max.apply(null, xs) + 100;
    const y0 = Math.min.apply(null, ys) - 210, y1 = Math.max.apply(null, ys) + 60;
    // fit every house (with its tag) between the HUD and the tab bar
    const usableH = vh - 250;
    const s = FF.clamp(Math.min(vw / (x1 - x0), usableH / (y1 - y0)), 0.62, 1.1);
    lookAt((x0 + x1) / 2, (y0 + y1) / 2 + 10 / s, s, animate);
  }
  const toWorld = (sx, sy) => { const r = vp.getBoundingClientRect(); return { x: (sx - r.left - cam.x) / cam.s, y: (sy - r.top - cam.y) / cam.s }; };
  const toScreen = (wx, wy) => { const r = vp.getBoundingClientRect(); return { x: r.left + cam.x + wx * cam.s, y: r.top + cam.y + wy * cam.s }; };

  /* ---------------- pointer: pan / pinch / tap / long-press / drag ---------------- */
  const ptrs = new Map();
  let mode = null, down = null, lp = null, pinch0 = null, drag = null, vel = { x: 0, y: 0, t: 0 };
  function bindPointer() {
    vp.addEventListener('pointerdown', onDown);
    vp.addEventListener('pointermove', onMove);
    vp.addEventListener('pointerup', onUp);
    vp.addEventListener('pointercancel', onUp);
    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      setMoving(true);
      zoomAt(e.clientX, e.clientY, cam.s * k);
      setMoving(false);
    }, { passive: false });
    vp.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function zoomAt(sx, sy, ns) {
    const w = toWorld(sx, sy);
    cam.s = FF.clamp(ns, minScale(), 1.9);
    const r = vp.getBoundingClientRect();
    cam.x = sx - r.left - w.x * cam.s; cam.y = sy - r.top - w.y * cam.s;
    clampCam(); requestApply();
  }
  function hitId(target) {
    const n = target.closest('.tag, .sp.house, .sp.stand, .sp.hall, .sp.arcade, .sp.lucky, .sp.news, .sp.sage, .sp.plant, .sp.gpet, .sp.pondsign');
    return n ? n.dataset.id : null;
  }
  function onDown(e) {
    if (e.button && e.button !== 0) return;
    try { vp.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already released */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    closeMenu();
    if (inertia) { cancelAnimationFrame(inertia); inertia = null; setMoving(false); }
    if (ptrs.size === 2) {
      clearTimeout(lp);
      if (mode === 'drag') dragCancel();
      const p = Array.from(ptrs.values());
      pinch0 = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), s: cam.s };
      mode = 'pinch'; down = null;
      setMoving(true);
      return;
    }
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: hitId(e.target), moved: false, cx: cam.x, cy: cam.y, lp: false };
    vel = { x: 0, y: 0, t: performance.now(), lx: e.clientX, ly: e.clientY };
    if (down.id) {
      const tg = e.target.closest('.tag, .sp');
      if (tg) tg.classList.add('pressed');
      lp = setTimeout(onLongPress, 430);
    }
  }
  function onMove(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'pinch' && ptrs.size >= 2) {
      const p = Array.from(ptrs.values());
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      zoomAt((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2, pinch0.s * d / pinch0.d);
      return;
    }
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) > 8) {
      down.moved = true;
      clearTimeout(lp);
      unpress();
      if (editing && down.id && !down.lp) { mode = 'drag'; dragStart(down.id, e); }
      else if (!mode) { mode = 'pan'; setMoving(true); }
    }
    if (mode === 'pan') {
      cam.x = down.cx + dx; cam.y = down.cy + dy;
      clampCam(); requestApply();
      const now = performance.now(), dt = Math.max(1, now - vel.t);
      vel.x = 0.8 * ((e.clientX - vel.lx) / dt) + 0.2 * vel.x; vel.y = 0.8 * ((e.clientY - vel.ly) / dt) + 0.2 * vel.y;
      vel.t = now; vel.lx = e.clientX; vel.ly = e.clientY;
    } else if (mode === 'drag') dragMove(e);
  }
  function onUp(e) {
    ptrs.delete(e.pointerId);
    clearTimeout(lp);
    unpress();
    if (mode === 'pinch') { if (!ptrs.size) { mode = null; setMoving(false); } return; }
    if (mode === 'drag') dragEnd();
    else if (mode === 'pan') { if (!startInertia()) setMoving(false); }
    else if (down && !down.moved && !down.lp && e.type === 'pointerup') tap(e, down);
    mode = null; down = null;
  }
  function unpress() { el.querySelectorAll('.pressed').forEach((n) => n.classList.remove('pressed')); }
  function onLongPress() {
    if (!down || down.moved) return;
    down.lp = true;
    ui().haptic();
    if (!editing) setEdit(true);
    mode = 'drag';
    dragStart(down.id, { clientX: down.x, clientY: down.y });
  }
  function startInertia() {
    if (reduced()) return false;
    if (performance.now() - vel.t > 80) return false;
    let vx = vel.x * 16, vy = vel.y * 16;
    const step = () => {
      vx *= 0.92; vy *= 0.92;
      cam.x += vx; cam.y += vy;
      clampCam(); apply();
      if (Math.abs(vx) + Math.abs(vy) > 0.4) inertia = requestAnimationFrame(step); else { inertia = null; setMoving(false); }
    };
    inertia = requestAnimationFrame(step);
    return true;
  }

  /* ---------------- taps ---------------- */
  function tap(e, d) {
    const me = S().state.meId;
    if (d.id) {
      ui().sfx.tap();
      if (d.id === '_stand') { if (!editing) { bounceEl(stand.el); FF.family.openGoals(); } else ui().toast(t('village.dragStand'), { icon: 'move' }); return; }
      if (d.id === '_lucky') { if (editing) { ui().toast(t('village.dragStand'), { icon: 'move' }); return; } bounceEl(lucky.el); FF.luckyUI.openMarket(); return; }
      if (d.id === '_news') { if (editing) { ui().toast(t('village.dragStand'), { icon: 'move' }); return; } bounceEl(news.el); setTimeout(() => FF.newsUI.open(), reduced() ? 0 : 140); return; }
      if (d.id === '_sage') { if (editing) { ui().toast(t('village.dragStand'), { icon: 'move' }); return; } bounceEl(sage.el); setTimeout(() => FF.sageUI.open(), reduced() ? 0 : 140); return; }
      if (d.id === '_pond') { if (!editing) FF.luckyUI.openFishing(); return; }
      if (d.id.indexOf('pl_') === 0) { const o = plants[d.id]; if (!o) return; if (editing) { ui().toast(t('village.dragStand'), { icon: 'move' }); return; } bounceEl(o.el); FF.luckyUI.openPlant(o.owner, o.pid); return; }
      if (d.id.indexOf('gp_') === 0) { const o = gpets[d.id]; if (!o) return; bounceEl(o.el); if (!editing) FF.luckyUI.openPet(o.owner, o.pid); return; }
      if (d.id === '_arcade') {
        if (editing) { ui().toast(t('village.dragStand'), { icon: 'move' }); return; }
        bounceEl(arcade.el);
        const p = toScreen(arcade.x, arcade.y - 80);
        setTimeout(() => FF.blast.openArcade({ from: p }), reduced() ? 0 : 160); // play — or watch whoever's playing
        return;
      }
      if (d.id === '_hall') {
        if (editing) { ui().toast(t(hall && hall.built ? 'village.dragStand' : 'hall.buildFirst'), { icon: 'move' }); return; }
        bounceEl(hall.el);
        if (hall.built) FF.app.push('hall'); else FF.hall.openBuild();
        return;
      }
      if (editing) {
        if (d.id === me) FF.family.openCustomizer(me);
        else ui().toast(t('village.onlyOwner', { name: esc(S().member(d.id).name) }), { icon: 'brush' });
        return;
      }
      if (d.id === me) { openMenu(me); return; }
      enterVisit(d.id);
      return;
    }
    // nothing else was hit → maybe an animal, or the pond
    const w = toWorld(e.clientX, e.clientY);
    animals.forEach(where);
    if (!editing && G().inWater(w.x, w.y) && !animals.some((a) => Math.hypot(a.x - w.x, (a.y - a.size * 0.35) - w.y) < 34 / cam.s)) { FF.luckyUI.openFishing(); return; }
    let best = null, bd = 34 / cam.s;
    animals.forEach((a) => { const dd = Math.hypot(a.x - w.x, (a.y - a.size * 0.35) - w.y); if (dd < bd) { bd = dd; best = a; } });
    if (best) react(best);
  }
  function openMenu(id) {
    closeMenu();
    const hs = houses[id];
    menuEl = document.createElement('div');
    menuEl.className = 'house-menu';
    menuEl.style.transform = 'translate3d(' + hs.x + 'px,' + (hs.y + (hs.top || -140) - 58) + 'px,0)';
    menuEl.innerHTML = '<div class="hm-in"><button type="button" data-hm="money">' + ic('wallet', 18) + '<span>' + t('village.myMoney') + '</span></button><button type="button" data-hm="decorate">' + ic('brush', 18) + '<span>' + t('village.decorate') + '</span></button></div>';
    L.tags.appendChild(menuEl);
    menuEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    menuEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-hm]'); if (!b) return;
      ui().sfx.tap();
      closeMenu();
      if (b.dataset.hm === 'money') FF.app.go('home'); else FF.family.openCustomizer(id);
    });
    requestAnimationFrame(() => menuEl && menuEl.classList.add('show'));
  }
  function closeMenu() { if (menuEl) { const m = menuEl; menuEl = null; m.classList.remove('show'); setTimeout(() => m.remove(), 200); } }

  /* ---------------- edit mode + drag ---------------- */
  function setEdit(on) {
    if (editing === on) return;
    editing = on;
    el.classList.toggle('editing', on);
    closeMenu();
    if (on) { ui().sfx.pop(); if (!S().family().seen || !S().family().seen.editTip) { S().markSeen('editTip'); } }
    else ui().sfx.snap();
    hud();
    FF.emit('village-edit', on);
  }
  function objOf(id) { return id === '_stand' ? stand : id === '_hall' ? (hall && hall.built ? hall : null) : id === '_arcade' ? arcade : id === '_lucky' ? lucky : id === '_news' ? news : id === '_sage' ? sage : id.indexOf('pl_') === 0 ? plants[id] : houses[id]; }
  const placeObj = (id, o, i, j) => { if (id === '_stand') placeStand(i, j); else if (id === '_hall') placeHall(i, j); else if (id === '_arcade') placeArcade(i, j); else if (id === '_lucky') placeLucky(i, j); else if (id === '_news') placeNews(i, j); else if (id === '_sage') placeSage(i, j); else if (id.indexOf('pl_') === 0) placePlant(o, i, j); else placeHouse(o, i, j); };
  function dragStart(id, e) {
    const o = objOf(id);
    if (!o) { mode = null; return; }
    const w = toWorld(e.clientX, e.clientY);
    drag = { id, o, from: { i: o.i, j: o.j }, off: { x: w.x - o.x, y: w.y - o.y }, i: o.i, j: o.j, ok: true, sx: e.clientX, sy: e.clientY };
    o.el.classList.add('lifted');
    o.el.style.zIndex = 9000;
    if (o.tag) o.tag.classList.add('lifted');
    ui().sfx.pop();
    autoScroll();
  }
  function dragMove(e) {
    if (!drag) return;
    drag.sx = e.clientX; drag.sy = e.clientY;
    updateDrag();
  }
  function updateDrag() {
    const w = toWorld(drag.sx, drag.sy);
    const g = G();
    const sn = g.snap(w.x - drag.off.x, w.y - drag.off.y);
    if (sn.i === drag.i && sn.j === drag.j) return;
    drag.i = sn.i; drag.j = sn.j;
    drag.ok = g.valid(sn.i, sn.j, S().occupied(), drag.id);
    placeObj(drag.id, drag.o, sn.i, sn.j);
    drag.o.el.style.zIndex = 9000;
    drag.o.el.classList.toggle('bad', !drag.ok);
    ui().sfx.tap();
  }
  function autoScroll() {
    if (!drag) return;
    const r = vp.getBoundingClientRect();
    const edge = 56, sp = 9;
    let dx = 0, dy = 0;
    if (drag.sx < r.left + edge) dx = sp; else if (drag.sx > r.right - edge) dx = -sp;
    if (drag.sy < r.top + edge + 60) dy = sp; else if (drag.sy > r.bottom - edge - 110) dy = -sp;
    if (dx || dy) { cam.x += dx; cam.y += dy; clampCam(); apply(); updateDrag(); }
    requestAnimationFrame(autoScroll);
  }
  function dragEnd() {
    if (!drag) return;
    const d = drag; drag = null;
    d.o.el.classList.remove('lifted', 'bad');
    if (d.o.tag) d.o.tag.classList.remove('lifted');
    if (d.ok && (d.i !== d.from.i || d.j !== d.from.j)) {
      S().moveObject(d.id, d.i, d.j);
      ui().sfx.snap(); ui().haptic();
      dust(d.o.x, d.o.y + 20);
      bounceEl(d.o.el);
    } else {
      placeObj(d.id, d.o, d.from.i, d.from.j);
      if (!d.ok) { ui().toast(t('village.cantPlace'), { icon: 'info' }); shakeEl(d.o.el); }
    }
  }
  function dragCancel() { if (drag) { drag.ok = false; dragEnd(); } }

  /* ---------------- little effects ---------------- */
  function bounceEl(n) { n.classList.remove('bounce'); void n.offsetWidth; n.classList.add('bounce'); }
  function shakeEl(n) { n.classList.remove('shake'); void n.offsetWidth; n.classList.add('shake'); }
  function dust(x, y) {
    if (reduced()) return;
    for (let k = 0; k < 7; k++) {
      const p = document.createElement('i');
      p.className = 'dust';
      const a = (k / 7) * Math.PI * 2;
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.setProperty('--dx', Math.cos(a) * 46 + 'px'); p.style.setProperty('--dy', Math.sin(a) * 20 + 'px');
      L.fx.appendChild(p);
      setTimeout(() => p.remove(), 800);
    }
  }
  function hearts(x, y, n, emo) {
    for (let k = 0; k < (n || 3); k++) {
      const p = document.createElement('i');
      p.className = 'heart-fx';
      p.textContent = emo || '❤';
      p.style.left = (x + (k - 1) * 10) + 'px'; p.style.top = y + 'px';
      p.style.animationDelay = k * 90 + 'ms';
      L.fx.appendChild(p);
      setTimeout(() => p.remove(), 1400);
    }
  }
  function bounce(id) { const o = objOf(id); if (o) { bounceEl(o.el); dust(o.x, o.y + 20); } }

  /* ---------------- animals ---------------- */
  const ZONES = {
    chicken: { x: 640, y: 600, r: 150, speed: 26 },
    chick: { x: 640, y: 600, r: 150, speed: 34 },
    puppy: { x: 500, y: 860, r: 360, speed: 62 },
    cat: { x: 470, y: 820, r: 260, speed: 20 },
    duck: { x: 725, y: 1145, r: 0, speed: 14 },
    pig: { x: 330, y: 1060, r: 170, speed: 16 }
  };
  Object.keys(ZONES).forEach((k) => { ZONES[k].x += FF.grid.SH.x; ZONES[k].y += FF.grid.SH.y; });
  /* exclusive pets (bought in the shop) live around their owner's house and follow it when it moves */
  const XPET = {
    bunny: { speed: 30, moods: [['walk', 0.2], ['hop', 0.45], ['idle', 0.25], ['sleep', 0.1]] },
    shiba: { speed: 40, moods: [['walk', 0.45], ['wag', 0.2], ['hop', 0.15], ['idle', 0.2]] },
    penguin: { speed: 14, moods: [['walk', 0.55], ['idle', 0.35], ['hop', 0.1]] },
    redpanda: { speed: 22, moods: [['walk', 0.35], ['idle', 0.35], ['sleep', 0.3]] },
    capybara: { speed: 12, moods: [['walk', 0.15], ['idle', 0.45], ['sleep', 0.4]] },
    tapir: { speed: 18, moods: [['walk', 0.4], ['idle', 0.35], ['sleep', 0.25]] },
    fox: { speed: 36, moods: [['walk', 0.45], ['idle', 0.25], ['hop', 0.2], ['sleep', 0.1]] },
    dragon: { speed: 30, moods: [['walk', 0.6], ['idle', 0.4]] }
  };
  function homeOf(a) {
    const f = S().family(), pos = f && f.layout[a.own];
    return pos ? G().center(pos.i, pos.j) : null;
  }
  function syncPets() {
    const f = S().family();
    const want = {};
    f.members.forEach((id) => {
      const m = S().member(id);
      if (!m || !f.layout[id]) return;
      FF.play.shownPets(m.house).forEach((kind, n) => { want['x:' + id + ':' + kind] = { kind, own: id, n }; });
    });
    animals = animals.filter((a) => { if (a.own && !want[a.id]) { a.gone = true; clearTimeout(a.t); a.el.remove(); return false; } return true; });
    Object.keys(want).forEach((key) => { if (!animals.some((a) => a.id === key)) spawnPet(key, want[key]); });
  }
  function spawnPet(key, w) {
    const home = homeOf({ own: w.own });
    if (!home) return;
    const size = (FF.play.item(w.kind) || {}).size || 40;
    const spots = [[46, 34], [-44, 36], [76, 14]];
    const p = spots[w.n % 3];
    const a = { id: key, kind: w.kind, own: w.own, xp: true, size, x: home.x + p[0], y: home.y + p[1], tx: 0, ty: 0, state: 'idle', until: 0, dir: p[0] < 0 ? -1 : 1, el: document.createElement('div') };
    a.tx = a.x; a.ty = a.y;
    a.el.className = 'sp animal xpet an-' + w.kind + (A().PET_FLY[w.kind] ? ' flyer' : '');
    a.el.style.width = size + 'px'; a.el.style.height = size + 'px';
    a.el.innerHTML = '<div class="an-flip">' + A().xpet(w.kind) + '</div><div class="an-bubble"></div><div class="zz">z<b>z</b></div>';
    L.sprites.appendChild(a.el);
    animals.push(a);
    setState(a, 'idle');
    drawAnimal(a);
    wake(a);
    if (S().state.seen && !S().state.seen['xpet:' + key]) {
      S().markSeen('xpet:' + key);
      a.el.classList.add('arrive');
      setTimeout(() => { a.el.classList.remove('arrive'); hearts(a.x, a.y - size, 4, '✨'); }, 900);
    }
  }
  function syncAnimals() {
    syncPets();
    const f = S().family();
    S().PETS.forEach((kind) => {
      if (!f.pets[kind]) return;
      const count = kind === 'chicken' ? 2 : 1;
      for (let n = 0; n < count; n++) {
        const id = kind + n;
        if (animals.some((a) => a.id === id)) continue;
        spawn(kind, id, n, f.seen && !f.seen['pet:' + kind]);
      }
      if (f.seen && !f.seen['pet:' + kind]) S().markSeen('pet:' + kind);
    });
  }
  function spawn(kind, id, n, arriving) {
    const z = ZONES[kind];
    const size = A().ANIMAL_SIZE[kind];
    const r = FF.rng(FF.hash(id));
    let x = z.x + (r() - 0.5) * z.r, y = z.y + (r() - 0.5) * z.r * 0.6;
    if (kind === 'duck') { x = G().POND.x - 25 + n * 30; y = G().POND.y - 5; }
    const p = freeSpot(kind, x, y);
    const a = { id, kind, size, x: p.x, y: p.y, tx: p.x, ty: p.y, state: 'idle', until: 0, dir: r() < 0.5 ? -1 : 1, el: document.createElement('div') };
    a.el.className = 'sp animal an-' + kind;
    a.el.style.width = size + 'px'; a.el.style.height = size + 'px';
    a.el.innerHTML = '<div class="an-flip">' + A().animal(kind) + '</div><div class="an-bubble"></div><div class="zz">z<b>z</b></div>';
    L.sprites.appendChild(a.el);
    animals.push(a);
    setState(a, kind === 'duck' ? 'swim' : reduced() && (kind === 'cat' || kind === 'pig') ? 'sleep' : 'idle');
    drawAnimal(a);
    wake(a);
    if (arriving) {
      a.el.classList.add('arrive');
      setTimeout(() => { a.el.classList.remove('arrive'); hearts(a.x, a.y - size, 4, '✨'); }, 900);
    }
  }
  function inHouse(x, y) {
    const f = S().family();
    return Object.keys(f.layout).some((id) => { const c = G().center(f.layout[id].i, f.layout[id].j); return Math.abs(x - c.x) / 80 + Math.abs(y - c.y) / 44 < 1; });
  }
  const inPond = (x, y, m) => G().inWater(x, y, m || 0, (m || 0) * 0.6);
  const onLand = (x, y) => G().inside(x, y, 70, 140, 80);
  function freeSpot(kind, x, y) {
    if (kind === 'duck') return { x, y };
    for (let k = 0; k < 14; k++) {
      if (!inHouse(x, y) && !inPond(x, y, 20) && onLand(x, y)) return { x, y };
      const z = ZONES[kind];
      x = z.x + (Math.random() - 0.5) * z.r * 2; y = z.y + (Math.random() - 0.5) * z.r * 1.2;
    }
    return { x: G().PLAZA.x, y: G().PLAZA.y + 140 };
  }
  /* a pet's next spot: somewhere around its own house (mostly in front, where you can see it) */
  function petTarget(a) {
    const c = homeOf(a);
    if (!c) return { x: a.x, y: a.y };
    if (A().PET_FLY[a.kind] && Math.random() < 0.3) return { x: c.x + (Math.random() - 0.5) * 120, y: c.y - 10 + (Math.random() - 0.5) * 50 };
    for (let k = 0; k < 12; k++) {
      const t = Math.random() < 0.7 ? Math.random() * Math.PI : Math.random() * Math.PI * 2;
      const x = c.x + Math.cos(t) * (70 + Math.random() * 45), y = c.y + 18 + Math.sin(t) * (28 + Math.random() * 24);
      if (inHouse(x, y) || inPond(x, y, 16) || !onLand(x, y)) continue;
      return { x, y };
    }
    return { x: c.x + 40, y: c.y + 38 };
  }
  function pickTarget(a) {
    if (a.xp) return petTarget(a);
    const z = ZONES[a.kind];
    if (a.kind === 'duck') {
      const P = G().POND, ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.68;
      return { x: P.x + Math.cos(ang) * P.rx * rr, y: P.y + Math.sin(ang) * P.ry * rr };
    }
    if (a.kind === 'chick') {
      const mum = animals.find((x) => x.kind === 'chicken');
      if (mum) return { x: mum.x - 18 * mum.dir + (Math.random() - 0.5) * 10, y: mum.y + 8 };
    }
    if (a.kind === 'cat' && Math.random() < 0.6) {
      const f = S().family(), ids = Object.keys(f.layout);
      const pick = f.layout[ids[Math.floor(Math.random() * ids.length)]];
      const c = G().center(pick.i, pick.j);
      return freeSpot('cat', c.x - 50 + Math.random() * 30, c.y + 46);
    }
    for (let k = 0; k < 10; k++) {
      const x = a.x + (Math.random() - 0.5) * z.r * 1.4, y = a.y + (Math.random() - 0.5) * z.r * 0.8;
      const dz = Math.hypot(x - z.x, (y - z.y) * 1.6);
      if (dz > z.r * 1.25) continue;
      if (inHouse(x, y) || inHouse((x + a.x) / 2, (y + a.y) / 2) || inPond(x, y, 24) || !onLand(x, y)) continue;
      return { x, y };
    }
    return { x: a.x, y: a.y };
  }
  const MOODS = {
    chicken: [['walk', 0.4], ['peck', 0.45], ['idle', 0.15]],
    chick: [['walk', 0.6], ['hop', 0.2], ['peck', 0.2]],
    puppy: [['walk', 0.45], ['idle', 0.2], ['hop', 0.2], ['wag', 0.15]],
    cat: [['walk', 0.22], ['sleep', 0.6], ['idle', 0.18]],
    duck: [['swim', 0.75], ['idle', 0.25]],
    pig: [['walk', 0.32], ['sleep', 0.4], ['idle', 0.28]]
  };
  function setState(a, st) {
    a.state = st;
    a.el.classList.remove('walk', 'peck', 'sleep', 'hop', 'wag', 'idle', 'swim');
    a.el.classList.add(st === 'walk' ? 'walk' : st);
    if (st === 'swim') a.el.classList.add('walk');
  }
  /* Walking is drawn by the graphics chip: each walk is one transform animation, from where
     the animal stands to where it's going, so nothing runs per frame. (Moving them from a
     script every frame made the browser rebuild the village's layers 60 times a second —
     measured ~230 ms of work every second, the village's biggest cost.) What an animal does
     next is decided when its walk ends or its nap is over: a timer every few seconds. Where a
     walking animal is right now is read off its animation's clock, only when something asks
     (a tap, the off-screen check). */
  const tfAt = (a, x, y) => 'translate3d(' + (x - a.size / 2).toFixed(1) + 'px,' + (y - a.size * 0.93).toFixed(1) + 'px,0)';
  function where(a) {
    const w = a.walk;
    if (w) {
      const ct = w.anim.currentTime, p = ct == null ? 1 : Math.min(1, Math.max(0, ct / w.dur));
      a.x = w.x0 + (w.x1 - w.x0) * p; a.y = w.y0 + (w.y1 - w.y0) * p;
    }
    return a;
  }
  function drawAnimal(a) {
    const tf = tfAt(a, a.x, a.y);
    if (a.tf !== tf) { a.tf = tf; a.el.style.transform = tf; } // a resting animal costs nothing
    const z = Math.round(a.y);
    if (a.z !== z) { a.z = z; a.el.style.zIndex = z; }
    if (a.fd !== a.dir) { a.fd = a.dir; a.el.classList.toggle('left', a.dir < 0); }
  }
  /* stand still right where it is */
  function stopWalk(a) {
    const w = a.walk;
    if (!w) return;
    where(a);
    a.walk = null;
    w.anim.onfinish = null;
    try { w.anim.cancel(); } catch (e) { /* already gone */ }
    drawAnimal(a);
  }
  function walkTo(a, x, y, sp, maxMs) {
    stopWalk(a);
    const d = Math.hypot(x - a.x, y - a.y);
    if (d < 2) return false;
    let dur = (d / sp) * 1000;
    if (dur > maxMs) { const k = maxMs / dur; x = a.x + (x - a.x) * k; y = a.y + (y - a.y) * k; dur = maxMs; }
    if (Math.abs(x - a.x) > 0.5) a.dir = x > a.x ? 1 : -1;
    const x0 = a.x, y0 = a.y, from = tfAt(a, x0, y0), to = tfAt(a, x, y);
    // the style holds where it ends up; the animation draws the way there
    a.tf = to; a.el.style.transform = to;
    const z = Math.round(Math.max(y0, y)); // in front of whatever it passes on the way
    if (a.z !== z) { a.z = z; a.el.style.zIndex = z; }
    if (a.fd !== a.dir) { a.fd = a.dir; a.el.classList.toggle('left', a.dir < 0); }
    const anim = a.el.animate([{ transform: from }, { transform: to }], { duration: dur, easing: 'linear' });
    if (!visible) anim.pause();
    a.walk = { x0, y0, x1: x, y1: y, dur, anim };
    anim.onfinish = () => {
      if (!a.walk || a.walk.anim !== anim) return;
      a.walk = null; a.x = x; a.y = y; a.run = false;
      drawAnimal(a);
      decide(a);
    };
    return true;
  }
  const farFromHome = (a) => { if (!a.xp) return false; const c = homeOf(a); return !!c && Math.hypot(a.x - c.x, (a.y - c.y) * 1.6) > 230; };
  function plan(a, ms) { clearTimeout(a.t); a.t = setTimeout(() => { a.t = null; decide(a); }, ms); }
  /* an animal that isn't busy gets going (a little apart, so they don't all move at once) */
  function wake(a) { if (a.gone || a.walk || a.t) return; a.waiting = false; plan(a, 200 + Math.random() * 1200); }
  function decide(a) {
    clearTimeout(a.t); a.t = null;
    if (a.gone || a.walk) return;
    if (a.kind === 'duck') a.el.classList.add('swimming');
    // its house moved away: hurry after it (even from off screen)
    if (visible && !reduced() && farFromHome(a)) {
      const tg = petTarget(a);
      a.run = true; setState(a, 'walk');
      if (walkTo(a, tg.x, tg.y, XPET[a.kind].speed * 4, 30000)) return;
      a.run = false;
    }
    // the village is covered or in the background, calm motion is on, or it's off screen: rest until seen
    if (!visible || dozing || reduced() || a.off) { if (a.state === 'walk') setState(a, 'idle'); a.waiting = true; return; }
    if (isMoving) { plan(a, 400); return; } // a finger is moving the map
    const moods = a.xp ? XPET[a.kind].moods : MOODS[a.kind];
    let r = Math.random(), st = moods[0][0];
    for (let k = 0; k < moods.length; k++) { r -= moods[k][1]; if (r <= 0) { st = moods[k][0]; break; } }
    if (st === 'walk' || st === 'swim') {
      if (a.kind === 'chick') animals.forEach(where); // it follows its mum to where she is now
      const tg = pickTarget(a);
      const sp = (a.xp ? XPET[a.kind].speed : ZONES[a.kind].speed) * (a.kind === 'chick' && Math.hypot(tg.x - a.x, tg.y - a.y) > 30 ? 1.6 : 1);
      setState(a, st);
      if (walkTo(a, tg.x, tg.y, sp, 9000)) return;
      st = 'idle';
    }
    setState(a, st);
    plan(a, 1000 * (st === 'sleep' ? 7 + Math.random() * 9 : st === 'peck' ? 1.2 + Math.random() * 1.6 : 1.5 + Math.random() * 2.5));
  }
  const pauseAnimals = () => animals.forEach((a) => { if (a.walk) a.walk.anim.pause(); });
  const resumeAnimals = () => { if (dozing) return; animals.forEach((a) => { if (a.walk) a.walk.anim.play(); else wake(a); }); };
  function react(a) {
    stopWalk(a);
    ui().sfx.animal(a.kind);
    ui().haptic();
    a.el.classList.remove('wiggle'); void a.el.offsetWidth; a.el.classList.add('wiggle');
    hearts(a.x, a.y - a.size * 0.9, 3);
    const n = 1 + Math.floor(Math.random() * 3);
    const b = a.el.querySelector('.an-bubble');
    b.textContent = t((a.xp ? 'xpet.' : 'pet.') + a.kind + '.say' + n);
    b.style.setProperty('--inv', (1 / cam.s).toFixed(4));
    b.classList.add('show');
    clearTimeout(a.bt);
    a.bt = setTimeout(() => b.classList.remove('show'), 2400);
    if (a.state === 'sleep') { setState(a, 'idle'); plan(a, 2500); }
    else if (!reduced()) { setState(a, a.kind === 'duck' ? 'swim' : a.kind === 'dragon' ? 'idle' : 'hop'); plan(a, 800); }
    if (a.kind === 'dragon') { a.el.classList.remove('puff'); void a.el.offsetWidth; a.el.classList.add('puff'); }
  }

  /* ---------------- doze ----------------
     After 45 s with nobody touching the phone, the wind drops: trees, windmill, flags, smoke,
     butterflies and decorations pause and the animals stop wandering — a phone left open on
     the Family tab then costs next to nothing (measured in WebKit: ~110 → ~10 ms of work a
     second). Any touch anywhere wakes it at once. */
  const DOZE_MS = 45000;
  let dozing = false, dozeT = null;
  function stir() {
    clearTimeout(dozeT); dozeT = null;
    if (dozing) { dozing = false; if (el) el.classList.remove('dozing'); if (visible) resumeAnimals(); }
    if (visible) dozeT = setTimeout(doze, DOZE_MS);
  }
  function doze() {
    dozeT = null;
    if (!visible || !el || editing) return;
    dozing = true;
    el.classList.add('dozing');
    pauseAnimals();
  }
  document.addEventListener('pointerdown', stir, { capture: true, passive: true });

  /* ---------------- show / hide ---------------- */
  function show() {
    clearTimeout(coverT); coverT = null;
    el.classList.remove('asleep');
    visible = true;
    el.classList.add('live');
    measure();
    render();
    if (bakeLater) { const go = bakeLater; bakeLater = null; setTimeout(go, 700); }
    resumeAnimals();
    stir();
  }
  function hide() { visible = false; pauseAnimals(); stir(); el && el.classList.remove('live'); closeMenu(); if (editing) setEdit(false); }
  /* Something full-screen covers the village (the game, a visit, a page): once it has finished
     opening, the village sleeps — not displayed at all, so none of its animations run and the
     animals stop. Covered by an opaque layer they'd otherwise still be drawn every frame, and
     the phone warms up for nothing. It wakes the moment the cover starts to go. */
  let coverT = null;
  function cover(on, delay) {
    clearTimeout(coverT); coverT = null;
    if (!el) return;
    if (on) { coverT = setTimeout(() => { coverT = null; if (editing) setEdit(false); el.classList.add('asleep'); visible = false; pauseAnimals(); stir(); }, delay || 0); return; }
    if (!el.classList.contains('asleep')) return;
    el.classList.remove('asleep');
    if (!el.classList.contains('live') || document.hidden) return;
    visible = true; measure(); cullSoon();
    if (bakeLater) { const go = bakeLater; bakeLater = null; setTimeout(go, 700); }
    resumeAnimals();
    stir();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { visible = false; pauseAnimals(); stir(); }
    else if (el && el.classList.contains('live') && !el.classList.contains('asleep')) { visible = true; resumeAnimals(); stir(); }
  });

  /* ---------------- visit transition ---------------- */
  let saved = null;
  function enterVisit(id) {
    const hs = houses[id];
    if (!hs) { FF.app.openVisit(id); return; }
    saved = { x: cam.x, y: cam.y, s: cam.s, id };
    const door = hs.meta && hs.meta.door ? { x: hs.x + hs.meta.door[0], y: hs.y + hs.meta.door[1] - 10 } : { x: hs.x - 20, y: hs.y - 20 };
    ui().sfx.whoosh();
    if (reduced()) { FF.app.openVisit(id, { from: toScreen(door.x, door.y) }); return; }
    el.classList.add('zooming');
    lookAt(door.x, door.y, 2.6, true);
    const scr = { x: vw / 2, y: vh / 2 };
    setTimeout(() => FF.app.openVisit(id, { from: scr }), 380);
  }
  function exitVisit() {
    el.classList.remove('zooming');
    if (saved) {
      const s = saved; saved = null;
      if (!reduced()) { world.classList.add('glide'); setTimeout(() => world.classList.remove('glide'), 620); }
      cam.x = s.x; cam.y = s.y; cam.s = s.s; clampCam(); apply();
      setTimeout(() => bounce(s.id), 300);
    }
  }

  /* ---------------- someone moved in! ---------------- */
  function popIn(id, opts) {
    opts = opts || {};
    render();
    const hs = houses[id];
    if (!hs) return;
    const m = S().member(id);
    lookAt(hs.x, hs.y - 60, Math.max(cam.s, 0.95), true);
    hs.el.classList.add('popping');
    hs.tag.classList.add('drop');
    setTimeout(() => {
      dust(hs.x, hs.y + 18);
      hearts(hs.x, hs.y - 120, 5, '✨');
      ui().sfx.pop(); setTimeout(() => ui().sfx.chime(), 160);
      ui().haptic();
      const p = toScreen(hs.x, hs.y - 80);
      ui().confetti({ x: p.x, y: p.y, n: 120 });
    }, reduced() ? 0 : 520);
    setTimeout(() => { hs.el.classList.remove('popping'); hs.tag.classList.remove('drop'); }, 1600);
    if (!opts.silent) setTimeout(() => ui().toast(t(opts.self ? 'village.youMovedIn' : 'village.movedIn', { name: '<b>' + esc(m.name) + '</b>' }), { icon: '🎉', tone: 'success', duration: 4200 }), 700);
  }

  FF.village = {
    mount, render, rebuild: build, show, hide, cover, setEdit, throwAt, showThing, popIn, bounce, enterVisit, exitVisit, centerInitial, hallBuilt,
    get editing() { return editing; }, get asleep() { return !!(el && el.classList.contains('asleep')); }, get el() { return el; }, houses, get animals() { return animals; }, cam,
    _perf: { apply: () => { clampCam(); apply(); }, setMoving, cull, doze, get dozing() { return dozing; } } // for the smoothness audit (tests/perf notes)
  };
})(window);
