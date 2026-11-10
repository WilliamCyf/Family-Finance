/* ============================================================
   FamFi — app.js
   Boot, 7-tab navigation (icon tabs + expanding active pill),
   page stack, visit overlay, prefs (theme, Dynamic Type, calm
   motion, gain colour), instant language switching, onboarding,
   celebrations, and a "shot" mode used by the design board.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = FF.store, ui = FF.ui;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const $ = (s, e) => (e || document).querySelector(s);
  const A = FF.actions = FF.actions || {};

  const TABS = [
    { id: 'family', icon: null }, { id: 'home', icon: 'wallet' }, { id: 'return', icon: 'trend' },
    { id: 'div', icon: 'dividend' }, { id: 'manage', icon: 'sliders' }, { id: 'menu', icon: 'grid' }
  ];
  const app = { tab: 'family', pages: [], visit: null, loading: true, dirty: {}, drawn: {} };
  const params = new URLSearchParams(location.search);
  const SHOT = params.get('shot');
  FF.shot = SHOT;

  /* =========================================================
     PREFERENCES
     ========================================================= */
  const mqMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let dynType = 17;
  function measureDynamicType() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;font:-apple-system-body';
    document.body.appendChild(probe);
    const fs = parseFloat(getComputedStyle(probe).fontSize) || 16;
    probe.remove();
    dynType = CSS.supports && CSS.supports('font', '-apple-system-body') ? FF.clamp(fs, 14, 28) : 17;
  }
  /* Appearance → Auto: light by day, dark at night by the phone's clock (dark from 7 pm to 7 am) —
     the village goes to its night look with it. One timer for the next switch, nothing else; iOS
     pauses timers in the background, so coming back to the app checks again. */
  const NIGHT_FROM = 19, DAY_FROM = 7;
  const nightNow = () => { const h = new Date().getHours(); return h >= NIGHT_FROM || h < DAY_FROM; };
  const themeOf = () => params.get('theme') || S.prefs().theme;
  const darkWanted = () => { const th = themeOf(); return th === 'dark' || (th === 'system' && nightNow()); };
  let autoTimer = 0;
  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (themeOf() !== 'system') return;
    const now = new Date(), next = new Date(now), h = now.getHours();
    if (h >= DAY_FROM && h < NIGHT_FROM) next.setHours(NIGHT_FROM, 0, 5, 0);
    else { if (h >= NIGHT_FROM) next.setDate(next.getDate() + 1); next.setHours(DAY_FROM, 0, 5, 0); }
    autoTimer = setTimeout(checkAuto, Math.max(1000, next - now));
  }
  function checkAuto() {
    if (!S.me || !S.state) return; // not started yet
    if (darkWanted() !== document.documentElement.classList.contains('theme-dark')) { applyPrefs(); refresh(true); }
    else scheduleAuto();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkAuto(); });
  function applyPrefs() {
    const p = S.prefs();
    const dark = darkWanted();
    const root = document.documentElement;
    root.classList.toggle('theme-dark', dark);
    root.dataset.theme = dark ? 'dark' : 'light';
    const motion = params.get('motion') || p.motion;
    root.classList.toggle('reduce-motion', motion === 'reduce' || (motion === 'system' && mqMotion.matches));
    root.dataset.gain = 'green'; // green up, red down for everyone (the colour option was removed in v2.9)
    const mult = { default: 1, large: 1.12, xl: 1.25 }[p.text] || 1;
    root.style.fontSize = (dynType * mult).toFixed(2) + 'px';
    root.dataset.text = p.text || 'default';
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#16140F' : '#FBF7EF'));
    if (FF.village && FF.village.el) FF.village.render();
    app.drawn = {}; // text size, theme…: every screen is drawn again when it's next shown
    scheduleAuto();
  }
  mqMotion.addEventListener && mqMotion.addEventListener('change', applyPrefs);

  /* =========================================================
     TAB BAR — icon-only, active tab grows into a labelled pill
     ========================================================= */
  function renderTabbar() {
    const nav = $('#tabbar');
    nav.innerHTML = TABS.map((x) => '<button type="button" class="tab t-' + x.id + (x.id === app.tab ? ' on' : '') + '" role="tab" data-tab="' + x.id + '" aria-selected="' + (x.id === app.tab) + '" aria-label="' + FF.esc(t('tab.' + x.id)) + '">' +
      '<span class="tab-ic">' + (x.id === 'family' ? FF.art.familyIcon(28) : ic(x.icon, 24)) + '</span><span class="tab-l"><span class="tab-lt">' + t('tab.' + x.id) + '</span></span></button>').join('');
    layoutTabs();
  }
  function layoutTabs() {
    const nav = $('#tabbar');
    const on = nav.querySelector('.tab.on');
    if (!on) return;
    const lt = on.querySelector('.tab-lt');
    lt.style.fontSize = '';
    // room left for the label = bar − the six icon tabs − the pill's own padding, icon and gap (measured)
    const cs = getComputedStyle(nav);
    const bw = nav.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let others = 0;
    nav.querySelectorAll('.tab:not(.on)').forEach((x) => { others += Math.max(44, x.offsetWidth); });
    const tcs = getComputedStyle(on);
    const pillBase = parseFloat(tcs.paddingLeft) + parseFloat(tcs.paddingRight) + on.querySelector('.tab-ic').offsetWidth + parseFloat(tcs.columnGap || tcs.gap || 4);
    const avail = Math.max(36, Math.floor(bw - others - pillBase - 2));
    let w = lt.scrollWidth;
    if (w > avail) {
      const fs = parseFloat(getComputedStyle(lt).fontSize);
      lt.style.fontSize = Math.max(10, fs * avail / w).toFixed(2) + 'px';
      w = lt.scrollWidth;
    }
    nav.style.setProperty('--lw', Math.ceil(Math.min(w, avail)) + 1 + 'px');
  }
  function onTabClick(e) {
    const b = e.target.closest('.tab');
    if (!b) return;
    if (b.dataset.tab === app.tab) { const sc = screenEl(app.tab); if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    ui.sfx.tap();
    go(b.dataset.tab);
  }

  /* =========================================================
     SCREENS
     ========================================================= */
  const RENDER = {
    home: { r: (c) => (app.loading ? homeSkeleton() : FF.money.home(c)), a: (el, c) => { if (!app.loading) FF.money.afterHome(el, c); } },
    return: { r: FF.money.ret, a: FF.money.afterReturn },
    div: { r: FF.money.div },
    manage: { r: FF.manage.manage, a: FF.manage.afterManage },
    menu: { r: FF.menu.menu, a: FF.menu.afterMenu }
  };
  function homeSkeleton() {
    return '<header class="home-head"><span class="sk" style="width:44px;height:44px;border-radius:50%"></span><div class="home-hello" style="flex:1"><span class="sk" style="width:40%;height:14px;margin-bottom:8px"></span><span class="sk" style="width:55%;height:26px"></span></div><span class="sk" style="width:96px;height:44px;border-radius:22px"></span></header>' +
      '<section class="hero"><span class="sk" style="width:38%;height:14px;margin-bottom:12px"></span><span class="sk" style="width:78%;height:46px;margin-bottom:12px"></span><span class="sk" style="width:64%;height:18px;margin-bottom:16px"></span><div class="stat-chips"><span class="sk" style="height:66px;border-radius:18px"></span><span class="sk" style="height:66px;border-radius:18px"></span></div></section>' +
      '<p class="loading-note" role="status">' + ic('refresh', 14) + t('common.updating') + '</p>' +
      '<section class="card"><span class="sk" style="height:84px;border-radius:14px"></span></section><section class="card list-card">' + [1, 2, 3, 4].map(() => '<div class="row static"><span class="sk" style="width:42px;height:42px;border-radius:50%"></span><span class="row-main"><span class="sk" style="width:60%;height:15px;margin-bottom:6px"></span><span class="sk" style="width:40%;height:12px"></span></span><span class="sk" style="width:70px;height:28px"></span></div>').join('') + '</section>';
  }
  const screenEl = (id) => document.querySelector('.screen[data-tab="' + id + '"]');
  function ensureScreen(id) {
    let el = screenEl(id);
    if (el) return el;
    el = document.createElement('section');
    el.className = 'screen' + (id === 'family' ? ' screen-village' : '');
    el.dataset.tab = id;
    el.setAttribute('role', 'tabpanel');
    $('#screens').appendChild(el);
    if (id === 'family') FF.village.mount(el);
    if (PULL[id]) bindPull(el);
    return el;
  }
  /* A screen you've already seen is shown as it was when nothing it shows has changed (records,
     prices, the family, language, settings, the day): switching tabs is instant instead of
     rebuilding hundreds of elements and re-fitting their labels every time. */
  const drawKey = () => FF.today() + '|' + FF.i18n.lang + '|' + app.loading + '|' + (S.state ? S.state.meId : '');
  function stale(id) { const el = screenEl(id); return !el || !el.firstChild || app.dirty[id] !== false || app.drawn[id] !== drawKey(); }
  function renderScreen(id, keepScroll) {
    const el = ensureScreen(id);
    if (id === 'family') { FF.village.render(); return; }
    if (!S.me()) return;
    const top = el.scrollTop;
    const ctx = { id: S.state.meId, viewer: S.state.meId };
    el.innerHTML = '<div class="scr-in">' + RENDER[id].r(ctx) + '</div>';
    if (RENDER[id].a) RENDER[id].a(el, ctx);
    ui.fitAll(el);
    if (keepScroll) el.scrollTop = top;
    app.dirty[id] = false;
    app.drawn[id] = drawKey();
  }
  function go(id, opts) {
    opts = opts || {};
    if (!TABS.some((x) => x.id === id)) id = 'home';
    const prev = app.tab;
    app.tab = id;
    while (app.pages.length) popPage(true);
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('on', 'enter'));
    const el = ensureScreen(id);
    el.classList.add('on');
    if (id !== 'family' && stale(id)) renderScreen(id);
    if (!opts.instant && prev !== id) { void el.offsetWidth; el.classList.add('enter'); }
    if (id === 'family') FF.village.show(); else FF.village.hide();
    document.documentElement.dataset.tab = id;
    renderTabbar();
    ui.closePop();
  }
  let refreshQueued = false;
  function refresh(now) {
    if (now) return doRefresh(true);
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => doRefresh(false));
  }
  function doRefresh(force) {
    refreshQueued = false;
    if (!S.me()) return;
    Object.keys(RENDER).forEach((k) => { app.dirty[k] = true; });
    if (app.tab === 'family') FF.village.render(); else renderScreen(app.tab, true);
    if (app.pages.length) { const top = app.pages[app.pages.length - 1]; if (force !== false || !PAGES[top.id].still) renderPage(top, true); }
    if (app.visit && !S.member(app.visit.id)) closeVisit();
    if (app.visit) renderVisit(true);
  }

  /* =========================================================
     PAGES (pushed, iOS-style)
     ========================================================= */
  const PAGES = {
    budget: { title: () => t('budget.title'), r: () => FF.menu.budgetPage(), a: (el) => FF.menu.afterBudget(el) },
    account: { title: (p) => { const a = S.me().pf.accounts.find((x) => x.id === p.id); return a ? FF.manage.accName(a) : ''; }, r: (p) => FF.manage.accountPage(p), a: (el, p) => FF.manage.afterAccount(el, p) },
    hall: { title: () => (S.family() && S.family().hall ? S.family().hall.name : t('hall.title')), r: () => FF.hall.page(), a: (el) => FF.hall.after(el) },
    holding: { title: (p) => FF.data.displayName(FF.data.asset(p.sym), FF.i18n.lang), r: (p) => FF.manage.holdingPage(p), a: (el, p) => FF.manage.afterHolding(el, p) },
    privacy: { title: () => t('menu.privacy'), r: () => FF.menu.privacyPage() },
    family: { title: () => t('menu.group'), r: () => FF.menu.familyPage() },
    badges: { title: () => t('menu.badges'), r: () => FF.menu.badgesPage() },
    shop: { title: () => t('shop.title'), r: () => FF.shop.shopPage(), a: (el) => FF.shop.afterShop(el) },
    friends: { title: () => t('menu.friends'), r: () => FF.menu.friendsPage() },
    help: { title: () => t('menu.helpRow'), r: () => FF.menu.helpPage() },
    // still: keeps itself up to date (re-drawing it for unrelated changes would only reload its photos)
    // bare: no tab bar over it (Back is right there) — every poster stays in view
    news: { title: () => t('news.name'), r: () => FF.newsUI.page(), a: (el) => FF.newsUI.after(el), still: true, bare: true }
  };
  function push(id, p) {
    const pg = { id, p: p || {}, el: document.createElement('section') };
    pg.el.className = 'page';
    $('#pages').appendChild(pg.el);
    app.pages.push(pg);
    if (app.tab === 'family') FF.village.cover(true, 480); // the page covers the village once it has slid in
    renderPage(pg);
    document.documentElement.classList.add('has-page');
    document.documentElement.classList.toggle('page-bare', !!PAGES[id].bare);
    requestAnimationFrame(() => requestAnimationFrame(() => pg.el.classList.add('in')));
    edgeSwipe(pg);
    ui.sfx.tap();
  }
  function renderPage(pg, keep) {
    const def = PAGES[pg.id];
    const body = pg.el.querySelector('.page-body');
    const top = body ? body.scrollTop : 0;
    pg.el.innerHTML = '<header class="page-head"><button type="button" class="back-btn" data-act="back">' + ic('chevL', 24) + '<span>' + t('common.back') + '</span></button><h2 class="page-title" data-fit="14">' + FF.esc(def.title(pg.p)) + '</h2><span class="ph-spacer"></span></header><div class="page-body"><div class="scr-in">' + def.r(pg.p) + '</div></div>';
    if (def.a) def.a(pg.el, pg.p);
    ui.fitAll(pg.el);
    if (keep) pg.el.querySelector('.page-body').scrollTop = top;
  }
  function popPage(instant) {
    const pg = app.pages.pop();
    if (!pg) return;
    if (instant || ui.reduced()) pg.el.remove();
    else { pg.el.classList.remove('in'); setTimeout(() => pg.el.remove(), 360); }
    const top = app.pages[app.pages.length - 1];
    document.documentElement.classList.toggle('page-bare', !!(top && PAGES[top.id].bare));
    if (!app.pages.length) { document.documentElement.classList.remove('has-page'); FF.village.cover(false); }
    if (!instant) { renderScreen(app.tab === 'family' ? 'home' : app.tab, true); if (app.tab === 'family') FF.village.render(); }
  }
  function edgeSwipe(pg) {
    let x0 = null, dx = 0;
    pg.el.addEventListener('pointerdown', (e) => { if (e.clientX < 24 && e.pointerType !== 'mouse') { x0 = e.clientX; pg.el.setPointerCapture(e.pointerId); if (app.pages.length === 1) FF.village.cover(false); } }); // what's underneath shows while swiping back
    pg.el.addEventListener('pointermove', (e) => { if (x0 == null) return; dx = Math.max(0, e.clientX - x0); pg.el.style.transition = 'none'; pg.el.style.transform = 'translateX(' + dx + 'px)'; });
    const end = () => { if (x0 == null) return; pg.el.style.transition = ''; pg.el.style.transform = ''; if (dx > innerWidth * 0.33) popPage(); else if (app.tab === 'family' && app.pages.length === 1) FF.village.cover(true, 480); x0 = null; dx = 0; };
    pg.el.addEventListener('pointerup', end); pg.el.addEventListener('pointercancel', end);
  }

  /* =========================================================
     VISIT A FAMILY MEMBER (read-only)
     ========================================================= */
  function openVisit(id, opts) {
    opts = opts || {};
    const v = $('#visit');
    app.visit = { id, tab: 'home', viewer: opts.viewer || S.state.meId, loading: !SHOT, from: opts.from };
    renderVisit();
    document.documentElement.classList.add('in-visit');
    const from = opts.from || { x: innerWidth / 2, y: innerHeight / 2 };
    v.style.setProperty('--ox', from.x + 'px'); v.style.setProperty('--oy', from.y + 'px');
    v.classList.remove('closing');
    v.classList.add('open');
    FF.village.cover(true, 680); // the visit covers the village once it has opened
    if (app.visit.loading) setTimeout(() => { if (app.visit) { app.visit.loading = false; renderVisit(); } }, 420);
  }
  function renderVisit(keep) {
    const v = $('#visit');
    const sc = v.querySelector('.visit-scroll');
    const top = sc ? sc.scrollTop : 0;
    v.innerHTML = '<div class="visit-scroll"><div class="scr-in">' + FF.family.visitHtml(app.visit) + '</div></div><div class="visit-bar"><button type="button" class="btn btn-wood btn-block btn-lg" data-act="exit-visit">' + ic('exit', 20) + '<span>' + t('visit.exitLong') + '</span></button></div>';
    const ctx = visitCtx();
    if (!app.visit.loading) {
      if (app.visit.tab === 'home') FF.money.afterHome(v, ctx);
      if (app.visit.tab === 'return') FF.money.afterReturn(v, ctx);

    }
    const seg = v.querySelector('[data-seg="visit"]');
    if (seg) seg.addEventListener('click', (e) => { const b = e.target.closest('.seg-b'); if (!b || !app.visit) return; app.visit.tab = b.dataset.v; ui.sfx.tap(); renderVisit(); v.querySelector('.visit-scroll').scrollTop = 0; });
    ui.fitAll(v);
    if (keep) v.querySelector('.visit-scroll').scrollTop = top;
  }
  function closeVisit() {
    const v = $('#visit');
    if (!app.visit) return;
    v.classList.add('closing');
    v.classList.remove('open');
    ui.sfx.whoosh();
    app.visit = null;
    document.documentElement.classList.remove('in-visit');
    FF.village.cover(false);
    FF.village.exitVisit();
    setTimeout(() => { if (!app.visit) v.innerHTML = ''; v.classList.remove('closing'); }, ui.reduced() ? 150 : 520);
  }
  const visitCtx = () => (app.visit ? { id: app.visit.id, ro: true, viewer: app.visit.viewer, inVisit: true } : null);

  /* =========================================================
     LANGUAGE — instant, no reload, remembered per user
     ========================================================= */
  function setLang(l) {
    return FF.i18n.ensure(l).then(() => {
      S.setLang(l);
      FF.i18n.setLang(l);
      const a = $('#app');
      a.classList.remove('lang-swap'); void a.offsetWidth; a.classList.add('lang-swap');
      renderTabbar();
      if (!S.me() || $('#flow').classList.contains('show')) FF.family.renderFlow();
      refresh(true);
      if (FF.village.el) FF.village.render();
    });
  }

  /* =========================================================
     CELEBRATIONS (badges, new pets)
     ========================================================= */
  let celebrateQ = Promise.resolve();
  function celebrate(res) {
    if (!res || SHOT) return;
    const items = [];
    (res.badges || []).forEach((b) => items.push(() => { ui.sfx.chime(); ui.toast(t('badge.new', { name: '<b>' + t('badge.' + b) + '</b>' }) + ' <span class="toast-gems">+' + FF.play.badgeGems(b) + FF.art.gem(14) + '</span>', { icon: FF.play.badge(b).e, tone: 'success', action: t('common.view'), onAction: () => push('badges'), duration: 4200 }); }));
    (res.pets || []).forEach((p) => items.push(() => { ui.sfx.success(); ui.confetti({ n: 80 }); ui.toast(t('pet.arrived', { name: '<b>' + t('pet.' + p + '.name') + '</b>' }), { icon: '🐾', tone: 'success', action: t('pet.sayHi'), onAction: () => go('family'), duration: 5200 }); }));
    items.forEach((fn) => { celebrateQ = celebrateQ.then(() => new Promise((r) => { fn(); setTimeout(r, 2600); })); });
  }
  function flash(sel) {
    setTimeout(() => { const el = document.querySelector('.screen.on ' + sel + ', .page.in ' + sel); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } }, 80);
  }

  /* =========================================================
     ONBOARDING / ACCOUNT
     ========================================================= */
  function startFlow(step) {
    const f = $('#flow');
    f.classList.add('show');
    document.documentElement.classList.add('in-flow');
    FF.family.flow.step = step || 'welcome';
    FF.family.renderFlow();
  }
  function hideFlow() { $('#flow').classList.remove('show'); document.documentElement.classList.remove('in-flow'); }
  function finishOnboarding(o) {
    o = o || {};
    hideFlow();
    applyPrefs();
    go('family', { instant: true });
    FF.village.centerInitial();
    if (o.newVillage) setTimeout(() => { FF.village.popIn(S.state.meId, { silent: true }); setTimeout(() => ui.toast(t('village.ready'), { icon: '🏡', tone: 'success', action: t('menu.invite'), onAction: () => FF.family.openInvite(), duration: 7000 }), 900); }, 350);
    if (o.joined) setTimeout(() => FF.village.popIn(S.state.meId, { self: true }), 350);
    if (o.demo) setTimeout(() => ui.toast(t('demo.welcome', { family: '<b>' + FF.esc(S.family().name) + '</b>' }), { icon: '👋', duration: 5200 }), 600);
  }
  async function startDemo() {
    await FF.market.ready(2500); // demo purchases use real historical prices when online
    S.seedDemo(FF.i18n.lang);
    S.save();
    finishOnboarding({ demo: true });
  }
  function clearScreens() {
    while (app.pages.length) popPage(true);
    if (app.visit) closeVisit();
    ui.closeAllSheets();
    document.querySelectorAll('.screen').forEach((s) => s.remove());
    FF.village.hide();
  }
  /* signs out of the account (records stay in the cloud) or clears the demo / this phone */
  async function signOut(opts) {
    opts = opts || {};
    if (S.mode() === 'cloud' || opts.cloud) await FF.cloud.signOut();
    clearScreens();
    S.signOut();
    FF.family.flow.st = opts.st || {};
    startFlow(opts.step || 'welcome');
  }
  const leaveDemo = (step) => signOut({ step: step || 'welcome' });
  /* settings that came with the account (language, theme…) */
  function adoptPrefs() {
    const l = S.prefs().lang;
    if (l && l !== FF.i18n.lang && FF.i18n.LANGS.indexOf(l) !== -1) setLang(l); else { applyPrefs(); renderTabbar(); }
  }
  function clearJoinLink() {
    if (params.has('join')) { params.delete('join'); try { history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '')); } catch (e) { /* ignore */ } }
  }
  const flowOn = () => $('#flow').classList.contains('show');

  /* =========================================================
     GLOBAL EVENTS
     ========================================================= */
  Object.assign(A, {
    tab: (el) => go(el.dataset.tab),
    page: (el) => push(el.dataset.page),
    back: () => popPage(),
    'exit-visit': () => closeVisit(),
    'div-month': (el) => { FF.money.divMonth(app.visit ? visitCtx() : { id: S.state.meId }, +el.dataset.d); app.visit ? renderVisit(true) : refresh(true); },
    'div-day': (el) => { FF.money.divDay(app.visit ? visitCtx() : { id: S.state.meId }, +el.dataset.day); ui.sfx.tap(); app.visit ? renderVisit(true) : refresh(true); },
    harvest: (el) => FF.money.harvest(el),
    // "Update" next to the prices line: fresh prices now (they otherwise update about hourly)
    'prices-update': async (el) => {
      if (el.classList.contains('busy')) return;
      el.classList.add('busy'); ui.sfx.tap();
      await updatePrices();
      el.classList.remove('busy');
    }
  });
  /* fresh prices now (the "Update" button and pulling down), then say what happened */
  let updating = null;
  function updatePrices() {
    if (updating) return updating;
    updating = FF.market.update().catch(() => ({ ok: false })).then((r) => {
      updating = null;
      if (r.offline) ui.toast(t('mkt.offlineNow'), { icon: 'info' });
      else if (r.recent) ui.toast(t('mkt.justUpdated'), { icon: 'check' });
      else if (r.final) ui.toast(t('mkt.finalNow'), { icon: 'clock' });
      else if (r.ok) ui.toast(t('mkt.updated'), { icon: 'check', tone: 'success' });
      else ui.toast(t('mkt.updateFail'), { icon: 'info' });
      refresh();
      return r;
    });
    return updating;
  }

  /* Pull down at the top of Home, Return or Dividend to update prices — iOS-style. Passive
     touch listeners and one transformed badge: it never fights the page's own scrolling. */
  const PULL = { home: 1, return: 1, div: 1 };
  const PULL_AT = 70;
  let ptrEl = null;
  function ptrBadge() {
    if (!ptrEl) {
      ptrEl = document.createElement('div');
      ptrEl.className = 'ptr';
      ptrEl.setAttribute('aria-hidden', 'true');
      ptrEl.innerHTML = '<span class="ptr-c">' + ic('refresh', 20) + '</span>';
      $('#screens').appendChild(ptrEl);
    }
    return ptrEl;
  }
  function bindPull(el) {
    let y0 = null, dist = 0, raf = 0;
    const draw = () => {
      raf = 0;
      const b = ptrBadge(), d = Math.min(dist, PULL_AT * 1.3);
      b.style.transform = 'translate3d(-50%,' + (d - 56).toFixed(1) + 'px,0) rotate(' + (d * 4).toFixed(0) + 'deg)';
      b.style.opacity = Math.min(1, d / 40).toFixed(2);
      b.classList.toggle('armed', dist >= PULL_AT);
    };
    const reset = () => { const b = ptrBadge(); b.style.transition = 'transform .3s var(--ease), opacity .25s'; b.style.transform = 'translate3d(-50%,-56px,0)'; b.style.opacity = '0'; b.classList.remove('armed'); setTimeout(() => { b.style.transition = ''; }, 320); };
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || el.scrollTop > 0 || ui.topSheet() || updating || app.tab !== el.dataset.tab) { y0 = null; return; }
      y0 = e.touches[0].clientY; dist = 0;
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      const dy = e.touches[0].clientY - y0;
      if (el.scrollTop > 0 || dy < -4) { y0 = null; dist = 0; reset(); return; } // scrolling down the page, not pulling
      const was = dist >= PULL_AT;
      dist = Math.max(0, dy) * 0.55;
      if (!was && dist >= PULL_AT) ui.haptic();
      if (!raf) raf = requestAnimationFrame(draw);
    }, { passive: true });
    const end = () => {
      if (y0 == null) return;
      y0 = null;
      if (dist < PULL_AT) { dist = 0; reset(); return; }
      dist = 0;
      const b = ptrBadge();
      b.style.transition = 'transform .25s var(--ease)';
      b.style.transform = 'translate3d(-50%,14px,0)';
      b.classList.add('busy');
      ui.sfx.tap();
      updatePrices().then(() => { b.classList.remove('busy'); reset(); });
    };
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', () => { y0 = null; dist = 0; reset(); }, { passive: true });
  }

  function onClick(e) {
    const learn = e.target.closest('[data-learn]');
    if (learn) { e.preventDefault(); ui.learn(learn.dataset.learn, learn); return; }
    const a = e.target.closest('[data-act]');
    if (!a || a.disabled) return;
    const fn = A[a.dataset.act];
    if (fn) { e.preventDefault(); fn(a, e); }
  }
  FF.on('change', (ev) => {
    if (!S.me()) return;
    if (flowOn() && FF.family.flow.step !== 'choice') return;
    refresh();
    if (ev && ['goal-toggled', 'goal-added', 'goal-deleted', 'remote'].indexOf(ev.reason) !== -1) FF.family.refreshGoals();
  });
  FF.on('market', () => { if (S.me()) { S.repriceDemo(); collectDividends(); refresh(); } });
  /* dividends that were paid since we last looked: added for you (after US tax) */
  function collectDividends() {
    if (SHOT || !S.me() || (S.mode() !== 'cloud' && S.mode() !== 'legacy')) return;
    const added = S.autoDividends(FF.market.dividends());
    if (!added.length || flowOn()) return;
    const me = S.me(), base = me.pf.base;
    const sum = FF.sum(added, (x) => x.amt * FF.data.fx(x.cur, base));
    const a = FF.data.asset(added[0].sym);
    const msg = added.length === 1 ? t('div.autoToast1', { amount: '<b>' + FF.i18n.money(added[0].amt, added[0].cur) + '</b>', name: FF.esc(FF.data.displayName(a, FF.i18n.lang)), pct: FF.i18n.pct(added[0].tax, { dp: 0 }) })
      : t('div.autoToastN', { n: added.length, amount: '<b>' + FF.i18n.money(sum, base) + '</b>' });
    ui.sfx.chime();
    ui.toast(msg, { icon: '🧺', tone: 'success', action: t('common.view'), onAction: () => go('div'), duration: 7000 });
  }
  /* the 15-second price check found nothing new: redraw Home only if its status line would
     look different (live ↔ closed, offline, a newer time) — not the whole screen every 15 s */
  let statusSig = '', statusAt = 0;
  FF.on('market-status', (m) => {
    if (!S.me() || !m) return;
    const sig = [m.stocksLive, m.stocksHistory, m.cryptoLive, m.anyOpen, m.online, m.latest].join('|');
    if (sig === statusSig && Date.now() - statusAt < 5 * 60000) return;
    if (sig !== statusSig) ['home', 'return', 'div'].forEach((k) => { app.dirty[k] = true; }); // seen later: drawn fresh
    statusSig = sig; statusAt = Date.now();
    if (app.tab === 'home') refresh();
  });
  FF.on('member-joined', (d) => {
    if (d.self || flowOn()) return;
    const m = S.member(d.id);
    if (S.mode() === 'cloud' && app.tab !== 'family') {
      // someone really moved in while you were elsewhere in the app
      ui.toast(t('village.movedIn', { name: '<b>' + FF.esc(m ? m.name : '') + '</b>' }), { icon: '🎉', tone: 'success', action: t('common.view'), onAction: () => { go('family'); setTimeout(() => FF.village.popIn(d.id, { silent: true }), 250); }, duration: 6000 });
      return;
    }
    if (app.tab !== 'family') go('family');
    setTimeout(() => FF.village.popIn(d.id), 250);
    if (d.pets && d.pets.length) setTimeout(() => celebrate({ pets: d.pets }), 2400);
  });
  /* ---- the cloud ---- */
  FF.on('celebrate', (res) => { if (!flowOn()) celebrate(res); });
  FF.on('cloud-prefs', () => { if (!flowOn()) adoptPrefs(); });
  FF.on('cloud-family', () => {
    // a family appeared for this account (e.g. joined on another phone) while choosing
    if (flowOn() && FF.family.flow.step === 'choice') finishOnboarding({});
  });
  FF.on('family-gone', (d) => {
    if (S.mode() !== 'cloud') return;
    clearScreens();
    FF.family.flow.st = {};
    startFlow('choice');
    if (d.name) ui.toast(t('family.gone', { family: '<b>' + FF.esc(d.name) + '</b>' }), { icon: '🏡', duration: 6000 });
  });
  FF.on('cloud-signed-out', () => {
    if (S.mode() !== 'cloud' || flowOn()) return;
    clearScreens();
    FF.family.flow.st = { email: S.me().email, again: true };
    startFlow('signin');
  });
  A['sign-out-now'] = () => signOut();

  /* =========================================================
     SHOT MODE (design board renders real screens in iframes)
     ========================================================= */
  function shot(name) {
    const lang = FF.i18n.lang;
    app.loading = false;
    switch (name) {
      case 'splash': return 'splash';
      case 'welcome': startFlow('welcome'); return;
      case 'signup': FF.family.flow.st = { name: S.SEED_TEXT[lang].names.me, email: 'jamie@example.com' }; startFlow('signup'); return;
      case 'choice': S.createAccount({ name: S.SEED_TEXT[lang].names.me, avatar: Object.assign({ kind: 'illus' }, FF.art.AVATAR_PRESETS[0]) }); startFlow('choice'); return;
      case 'create': S.createAccount({ name: S.SEED_TEXT[lang].names.me, avatar: Object.assign({ kind: 'illus' }, FF.art.AVATAR_PRESETS[0]) }); FF.family.flow.st = { fam: S.SEED_TEXT[lang].family }; startFlow('create'); return;
      case 'join': S.createAccount({ name: S.SEED_TEXT[lang].names.me, avatar: Object.assign({ kind: 'illus' }, FF.art.AVATAR_PRESETS[0]) }); FF.family.flow.st = { code: S.SEED_TEXT[lang].code }; startFlow('join'); return;
    }
    S.seedDemo(lang, {});
    if (name === 'goals-empty') S.state.family.goals = [];
    if (name === 'home-empty') { S.createAccount({ name: S.SEED_TEXT[lang].names.me, avatar: Object.assign({ kind: 'illus' }, FF.art.AVATAR_PRESETS[0]) }); S.createFamily(S.SEED_TEXT[lang].family); }
    if (name === 'loading') app.loading = true;
    const tabFor = { home: 'home', 'home-empty': 'home', loading: 'home', return: 'return', div: 'div', manage: 'manage', menu: 'menu', language: 'menu', budget: 'home', privacy: 'menu', badges: 'menu', friends: 'menu', trade: 'home', 'trade-details': 'home', spend: 'home', account: 'home', hall: 'family', blast: 'family', 'blast-rank': 'family', 'blast-chat': 'family', 'blast-chatp': 'family', 'blast-watch': 'family', 'blast-watchp': 'family', shop: 'home', 'shop-pets': 'home', daily: 'home', item: 'home', 'item-pet': 'home', levelup: 'home', earn: 'home' };
    go(tabFor[name] || 'family', { instant: true });
    setTimeout(() => {
      switch (name) {
        case 'village-edit': FF.village.setEdit(true); break;
        case 'customize': FF.family.openCustomizer(S.state.meId); break;
        case 'goals': case 'goals-empty': FF.family.openGoals(); break;
        case 'goals-add': FF.family.openGoals(); setTimeout(() => A.goals && null, 0); setTimeout(() => document.querySelector('[data-add-goal]').click(), 60); break;
        case 'invite': FF.family.openInvite(); break;
        case 'visit': openVisit('m_mum'); break;
        case 'visit-private': openVisit('m_gran'); break;
        case 'trade': { const api = FF.manage.openTrade({ type: 'buy' }); api.state.query = lang === 'zh' ? '苹果' : lang === 'th' ? 'แอปเปิล' : 'apple'; api.render(); break; }
        case 'trade-details': FF.manage.openTrade({ type: 'buy', sym: 'AAPL', q: '10' }); break;
        case 'news': FF.newsUI.open(); break;
        case 'language': FF.menu.openLanguage(); break;
        case 'budget': push('budget'); break;
        case 'spend': FF.manage.openTrade({ type: 'expense', cat: 'food', amt: '12.50', note: lang === 'zh' ? '椰浆饭' : lang === 'th' ? 'ข้าวมันไก่' : 'Nasi lemak' }); break;
        case 'account': push('account', { id: 'w2' }); break;
        case 'hall': push('hall'); break;
        case 'privacy': push('privacy'); break;
        case 'badges': push('badges'); break;
        case 'friends': push('friends'); break;
        case 'shop': push('shop'); break;
        case 'shop-pets': FF.shop && push('shop'); setTimeout(() => { const b = document.querySelector('[data-seg="shop"] [data-v="pets"]'); if (b) b.click(); }, 30); break;
        case 'daily': FF.shop.openDaily(); break;
        case 'item': FF.shop.openItem(params.get('id') || 'koi'); break;
        case 'item-pet': FF.shop.openItem(params.get('id') || 'dragon'); break;
        case 'levelup': FF.shop.levelUp({ from: 2, to: +(params.get('lv') || 6) }); break;
        case 'earn': FF.shop.openEarn(); break;
        case 'blast': FF.blast.open(); break;
        case 'blast-rank': FF.blast.open(); setTimeout(() => FF.blast.openRanking(), 200); break;
        case 'visit-help': openVisit('m_mum'); break;
        case 'visit-help-records': openVisit('m_mum'); setTimeout(() => { app.visit.tab = 'records'; renderVisit(); }, 500); break;
        case 'help-add': openVisit('m_mum'); setTimeout(() => FF.manage.openTrade({ type: 'expense', who: 'm_mum', cat: 'groceries', amt: '45.50', note: lang === 'zh' ? '买菜' : lang === 'th' ? 'ซื้อของเข้าบ้าน' : 'Groceries' }), 500); break;
        case 'help-intro': FF.helpUI.openIntro(); break;
        case 'blast-chat': case 'blast-chatp': case 'blast-watch': case 'blast-watchp': shotChat(name, lang); break;
      }
    }, 50);
  }

  /* the Block Blast chat on the design board: a pretend family watching (no cloud needed) */
  function shotChat(name, lang) {
    const watch = name === 'blast-watch' || name === 'blast-watchp', room = watch ? 'm_mum' : S.state.meId, B = FF.blastCore;
    const say = { en: ['Nice move! 👏', 'Go Jamie, go!', 'That combo 😮'], zh: ['好棒！👏', '加油加油！', '这连击太厉害了 😮'], th: ['เยี่ยมมาก! 👏', 'สู้ ๆ นะ!', 'คอมโบนี้สุดยอด 😮'] }[lang] || [];
    let n = 0;
    const msgs = [{ u: 'm_dad', t: say[1] }, { u: 'm_mum', e: '🔥' }, { u: watch ? 'm_me' : 'm_mum', t: say[0] }, { u: 'm_gran', e: '👏' }, { u: watch ? 'm_dad' : 'm_gran', t: say[2] }].map((x) => Object.assign({ id: '-s' + (++n), at: Date.now() }, x));
    const fake = {
      ok: () => true, play() {}, move() {}, over() {}, quit() {}, unwatch() {}, chatReset() {}, now: () => Date.now(),
      playing: () => [{ uid: 'm_mum', at: Date.now() - 120000 }], isPlaying: () => true, watching: () => (watch ? room : null),
      watchers: () => ['m_mum', 'm_dad', 'm_gran'], viewers: () => ['m_me', 'm_dad', 'm_gran'],
      watch(uid, cb) { const g = B.newGame(); for (let k = 0; k < 6; k++) { const st = B.solve(g.board, g.hand)[0]; if (!st) break; B.place(g, st[0], st[1], st[2]); } setTimeout(() => cb(B.pack(g)), 300); return true; },
      chat: () => msgs, chatRoom: () => room,
      say: (txt) => { msgs.push({ id: '-s' + (++n), u: S.state.meId, t: txt, at: Date.now() }); FF.emit('live', { k: 'chat', fresh: [msgs[msgs.length - 1]] }); return Promise.resolve(true); },
      react: (e) => { msgs.push({ id: '-s' + (++n), u: S.state.meId, e, at: Date.now() }); FF.emit('live', { k: 'chat', fresh: [msgs[msgs.length - 1]] }); return Promise.resolve(true); }
    };
    FF.blast._fakeLive(fake);
    FF.blast.open(watch ? { watch: room } : {});
    setTimeout(() => {
      if (!watch) FF.emit('live', { k: 'eyes', fresh: [] });
      FF.emit('live', { k: 'chat', fresh: msgs.slice(0, 2) });
      setTimeout(() => FF.emit('live', { k: 'chat', fresh: msgs.slice(2) }), 500);
      if (name === 'blast-chatp' || name === 'blast-watchp') setTimeout(() => FF.blast.openChat(), 900);
    }, 600);
  }

  /* =========================================================
     BOOT
     ========================================================= */
  async function boot() {
    document.body.insertAdjacentHTML('afterbegin', FF.art.defs());
    measureDynamicType();
    FF.market.load();                       // last prices seen → instant, works offline
    S.init({ memory: !!SHOT });
    const asked = params.get('lang') || S.prefs().lang || (navigator.language || 'en').slice(0, 2);
    const lang = FF.i18n.LANGS.indexOf(asked) !== -1 ? asked : 'en';
    await FF.i18n.ensure(lang); // only this language's words are loaded (English is always there)
    FF.i18n.setLang(lang);
    if (S.me() && S.me().prefs && S.me().prefs.lang !== FF.i18n.lang && !params.get('lang')) S.setLang(FF.i18n.lang);
    applyPrefs();
    document.addEventListener('click', onClick);
    $('#tabbar').addEventListener('click', onTabClick);
    window.addEventListener('resize', () => { layoutTabs(); ui.fitAll(document); });
    document.addEventListener('pointerdown', () => ui.sfx.unlock(), { once: true });
    // splash copy in the chosen language
    const tag = $('#splash .splash-tag');
    if (tag) tag.textContent = t('splash.tag');

    // design-board shots: seed the demo family with real prices when we can get them quickly
    if (SHOT && !FF.market.summary().stocksLive) await FF.market.ready(4000);
    const shotRes = SHOT ? shot(SHOT) : null;
    if (SHOT) {
      FF.market.refresh();
      document.documentElement.classList.add('shot');
      // the design board frames screens like an iPhone 15: simulate its safe areas
      if (params.get('safe')) { document.documentElement.style.setProperty('--sat', '50px'); document.documentElement.style.setProperty('--sab', '30px'); }
      if (shotRes !== 'splash') $('#splash').remove();
      renderTabbar();
      return;
    }
    const join = S.normalizeCode(params.get('join'));
    const mode = S.mode();
    FF.cloud.boot();
    if (mode === 'none') {
      FF.family.flow.st = join ? { code: join, then: 'join' } : {};
      startFlow('welcome');
    } else if (mode === 'legacy') {
      // made before accounts existed: keep their records, ask them to sign up so families really connect
      const m = S.me();
      FF.family.flow.st = { name: m.name, email: m.email, avatar: m.avatar, legacy: true, code: join, then: join ? 'join' : null };
      startFlow('upgrade');
    } else if (mode === 'demo') {
      if (join) { FF.family.flow.st = { code: join, then: 'join' }; startFlow('welcome'); } else go('family', { instant: true });
    } else {
      if (S.family()) go('family', { instant: true });
      if (join) { FF.family.flow.st = { code: join }; startFlow('join'); } else if (!S.family()) startFlow('choice');
      FF.cloud.resume().then((r) => {
        if (r !== 'signed-out' || S.mode() !== 'cloud') return;
        clearScreens();
        FF.family.flow.st = { email: S.me().email, again: true, code: join, then: join ? 'join' : null };
        startFlow('signin');
      });
    }
    renderTabbar();
    // prices load (skeleton) — then the real numbers count up. Cached prices show at once.
    FF.market.start();
    setTimeout(collectDividends, 1500);
    // the daily gift pops up once a day (also when the app comes back from the background on a new day)
    setTimeout(() => { FF.shop.checkSoon(); FF.shop.maybeDaily(); }, 2400);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => FF.shop.maybeDaily(), 900); });
    const cachedLive = FF.market.summary().stocksLive;
    FF.market.ready(cachedLive ? 600 : 2500).then(() => { app.loading = false; if (app.tab === 'home') renderScreen('home', true); });
    // splash: wait for fonts (max 1.2s), then lift the curtain
    const t0 = performance.now();
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 1200))]).then(() => {
      setTimeout(() => {
        const sp = $('#splash');
        sp.classList.add('out');
        setTimeout(() => sp.remove(), 650);
        layoutTabs();
        ui.fitAll(document);
      }, Math.max(0, 650 - (performance.now() - t0)));
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layoutTabs(); ui.fitAll(document); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && !params.has('nosw')) keepUpToDate();
  }

  /* Updates. iPhone home-screen apps resume from the background without reloading, so
     FamFi checks for a new version each time it comes back; when one has been installed it
     reloads at a calm moment (nothing half-typed: no sheet, not mid sign-up), or else the
     next time it goes to the background — never in the middle of an entry. */
  function keepUpToDate() {
    const sw = navigator.serviceWorker;
    const hadOld = !!sw.controller;
    sw.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
    let reloading = false;
    const reload = () => { if (!reloading) { reloading = true; location.reload(); } };
    sw.addEventListener('controllerchange', () => {
      if (!hadOld) return; // first install: what's on screen is already current
      const busy = () => !!document.querySelector('.sheet-layer:not(.closing)') || flowOn();
      if (document.hidden || !busy()) { reload(); return; }
      const later = () => { if (document.hidden) { document.removeEventListener('visibilitychange', later); reload(); } };
      document.addEventListener('visibilitychange', later);
    });
  }

  /* a small frame-rate counter for checking smoothness on a real phone: tap the version line at
     the bottom of Menu five times (again to hide). Off by default; remembered on this phone. */
  let fpsEl = null, fpsTaps = [];
  function fpsMeter(on) {
    if (!on) { if (fpsEl) { fpsEl.remove(); fpsEl = null; } return; }
    if (fpsEl) return;
    fpsEl = document.createElement('div');
    fpsEl.className = 'fps-meter';
    document.body.appendChild(fpsEl);
    let n = 0, worst = 0, slow = 0, last = performance.now(), t0 = last;
    const tick = (now) => {
      if (!fpsEl) return;
      const d = now - last; last = now; n++; worst = Math.max(worst, d); if (d > 25) slow++;
      if (now - t0 >= 1000) { fpsEl.textContent = Math.round((n * 1000) / (now - t0)) + ' fps · slowest ' + Math.round(worst) + ' ms · ' + slow + ' dropped'; n = 0; worst = 0; slow = 0; t0 = now; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  A['fps-tap'] = () => {
    const now = Date.now();
    fpsTaps = fpsTaps.filter((x) => now - x < 2500).concat(now);
    if (fpsTaps.length < 5) return;
    fpsTaps = [];
    const on = !S.device().fps;
    S.setDevice({ fps: on });
    fpsMeter(on);
    ui.toast(on ? 'Frame-rate counter on' : 'Frame-rate counter off', { icon: 'info' });
  };
  if (S.device().fps || params.get('fps')) setTimeout(() => fpsMeter(true), 500);

  FF.app = { boot, go, refresh, push, pop: popPage, openVisit, closeVisit, visitCtx, setLang, applyPrefs, adoptPrefs, celebrate, flash, startFlow, finishOnboarding, startDemo, signOut, leaveDemo, clearJoinLink, clearScreens, get tab() { return app.tab; }, get loading() { return app.loading; }, state: app };
  document.addEventListener('DOMContentLoaded', boot);
})(window);
