/* FamFi — design board: renders specimens with the real art/ui code, and frames live app screens. */
(function () {
  'use strict';
  const FF = window.FF;
  const A = FF.art;
  const ic = (n, s) => A.icon(n, s);
  const $ = (id) => document.getElementById(id);
  FF.i18n.setLang('en');
  FF.store.init({ memory: true });
  document.body.insertAdjacentHTML('afterbegin', A.defs());

  /* ---------- theme toggle for the board ---------- */
  const themeBtn = $('b-theme');
  const setTheme = (dark) => { document.documentElement.classList.toggle('theme-dark', dark); themeBtn.innerHTML = ic(dark ? 'sun' : 'moon', 22); renderKit(); renderSwatches(); };
  themeBtn.addEventListener('click', () => setTheme(!document.documentElement.classList.contains('theme-dark')));
  themeBtn.innerHTML = ic('moon', 22);

  /* ---------- principles ---------- */
  const P = [
    ['trend', 'Lead with answers', '“You’re up RM 1,240 this year” comes first, in a sentence. Charts and breakdowns sit one tap below.'],
    ['target', 'One primary action', 'Each screen has one obvious next step: Add on Home, Collect on Dividend, Save in every sheet.'],
    ['info', 'Plain words, tap to learn', 'No jargon without an ⓘ. Tapping it gives a one-line, friendly explanation — in all three languages.'],
    ['eye', 'Never colour alone', 'Gains and losses always carry ▲/▼ arrows and spoken words. People can switch to China-style red-for-up.'],
    ['leaf', 'Calm, not casino', 'Rewards go to logging, budgeting, spreading out and family goals — never to trading more. Numbers stay sober.'],
    ['shield', 'You choose who sees what', 'Per-section visibility (everyone, some people, just me). Visits are always view-only, with a big Exit.'],
    ['textSize', 'Readable for grandparents', 'Follows iOS Dynamic Type, plus A / A+ / A++. Every target is 44pt or bigger; primary actions sit in the thumb zone.'],
    ['sparkle', 'Feels like a game', 'A living village: houses pop in, animals react, coins fly into the basket — with a Calm-motion switch for anyone who prefers stillness.']
  ];
  $('principles-grid').innerHTML = P.map((p) => '<div class="b-card"><span class="b-ic">' + ic(p[0], 24) + '</span><h4>' + p[1] + '</h4><p>' + p[2] + '</p></div>').join('');

  /* ---------- colour (read live from tokens.css, light + dark) ---------- */
  const TOKENS = [['--bg', 'Paper', 'Screen background'], ['--card', 'Card', 'Surfaces'], ['--sunken', 'Sunken', 'Tracks, fields'], ['--line', 'Line', 'Hairlines'], ['--ink', 'Ink', 'Primary text'], ['--ink-2', 'Ink 2', 'Secondary text'], ['--ink-3', 'Ink 3', 'Tertiary, hints'],
    ['--brand', 'Leaf green', 'Primary actions'], ['--brand-tint', 'Leaf tint', 'Active pills, soft buttons'], ['--sun', 'Sunflower', 'Money coming in, Setup'], ['--sun-tint', 'Sun tint', 'Harvest, nudges'], ['--gain', 'Gain', 'Always with ▲ + words'], ['--loss', 'Loss', 'Always with ▼ + words'],
    ['--wood', 'Wood', 'Village chrome, Exit'], ['--sky', 'Sky', 'Charts, stocks'], ['--plum', 'Plum', 'Crypto'], ['--barn', 'Barn red', 'Roofs, accents']];
  function renderSwatches() {
    const root = document.documentElement;
    const wasDark = root.classList.contains('theme-dark');
    const read = (dark) => { root.classList.toggle('theme-dark', dark); const cs = getComputedStyle(root); const o = {}; TOKENS.forEach((t) => { o[t[0]] = cs.getPropertyValue(t[0]).trim(); }); return o; };
    const light = read(false), dark = read(true);
    root.classList.toggle('theme-dark', wasDark);
    const fg = (hex) => { const h = hex.replace('#', ''); if (h.length < 6) return '#000'; const n = parseInt(h.slice(0, 6), 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)); return l > 150 ? '#27241E' : '#FFFFFF'; };
    $('swatches').innerHTML = TOKENS.map((t) => '<div class="b-sw"><div class="b-sw-chips"><i style="background:' + light[t[0]] + ';color:' + fg(light[t[0]]) + '">' + light[t[0]] + '</i><i style="background:' + dark[t[0]] + ';color:' + fg(dark[t[0]]) + '">' + dark[t[0]] + '</i></div><div class="b-sw-meta"><b>' + t[1] + '</b><span>' + t[0] + ' · ' + t[2] + '</span></div></div>').join('');
  }

  /* ---------- type ---------- */
  const T = [
    ['Display · English', 'Fredoka 600', 'font-family:var(--font-display);font-weight:600;font-size:2rem', 'How much have I made?'],
    ['Display · 简体中文', 'ZCOOL KuaiLe', 'font-family:var(--font-display);font-size:2rem', '我赚了多少？'],
    ['Display · ไทย', 'Mitr 500', 'font-family:var(--font-display);font-weight:500;font-size:2rem;line-height:1.4', 'ฉันได้กำไรเท่าไร?'],
    ['UI · English', 'Nunito 600–900', 'font-family:var(--font-ui);font-weight:700;font-size:1.1rem', 'You’re up <b style="color:var(--gain)">RM&nbsp;1,240</b> since you started.'],
    ['UI · 简体中文', 'Noto Sans SC', 'font-family:var(--font-ui);font-weight:700;font-size:1.1rem;line-height:1.55', '开始以来，你赚了 <b style="color:var(--gain)">RM&nbsp;1,240</b>。'],
    ['UI · ไทย (looped)', 'Noto Sans Thai Looped · line-height 1.66', 'font-family:var(--font-ui);font-weight:700;font-size:1.1rem;line-height:1.66', 'ตั้งแต่เริ่ม คุณได้กำไร <b style="color:var(--gain)">฿1,240</b> — ผู้สูงอายุอ่านง่าย'],
    ['Numbers', 'Nunito 900 · tabular', 'font-family:var(--font-ui);font-weight:900;font-size:2rem;font-variant-numeric:tabular-nums', 'RM&nbsp;128,450.20 <span class="delta up" style="font-size:1.1rem">' + ic('up', 18) + '+0.9%</span>']
  ];
  const SCALE = [['Hero number', '2.95rem · 50px', 'font-weight:900;font-size:2.95rem;line-height:1.05', 'RM 68,806'], ['Large title', '1.85rem · 31px', 'font-family:var(--font-display);font-weight:600;font-size:1.85rem', 'Money coming in'], ['Title', '1.2rem · 20px', 'font-family:var(--font-display);font-weight:600;font-size:1.2rem', 'Where it came from'],
    ['Body', '1rem · 17px', 'font-weight:600;font-size:1rem', 'Money in your accounts that isn’t invested yet.'], ['Footnote', '.84rem · 14px', 'font-weight:700;font-size:.84rem;color:var(--ink-3)', 'Touch and slide along the chart.'], ['Caption', '.76rem · 13px', 'font-weight:800;font-size:.76rem;color:var(--ink-3);letter-spacing:.06em', 'UPDATED 6:26 PM']];
  $('type').innerHTML = T.map((r) => '<div class="b-type-row"><div class="meta"><b>' + r[0] + '</b><span>' + r[1] + '</span></div><div class="spec" style="' + r[2] + '">' + r[3] + '</div></div>').join('') +
    '<h3 class="b-h3" style="margin-top:18px">Scale <span class="muted" style="font-size:1rem">(17px base · scales with Dynamic Type)</span></h3><div class="b-scale">' + SCALE.map((s) => '<div><small>' + s[0] + ' · ' + s[1] + '</small><div style="' + s[2] + '">' + s[3] + '</div></div>').join('') + '</div>';

  /* ---------- components ---------- */
  const tabbar = (active, pressed) => '<nav class="tabbar b-tabbar" style="--lw:' + (active === 'family' ? 50 : 44) + 'px">' + ['family', 'home', 'return', 'div', 'manage', 'menu'].map((id) => {
    const icn = { home: 'wallet', return: 'trend', alloc: 'pie', div: 'dividend', manage: 'sliders', menu: 'grid' }[id];
    return '<button type="button" class="tab t-' + id + (id === active ? ' on' : '') + (id === pressed ? ' is-pressed' : '') + '"><span class="tab-ic">' + (id === 'family' ? A.familyIcon(28) : ic(icn, 24)) + '</span><span class="tab-l"><span class="tab-lt">' + FF.i18n.t('tab.' + id) + '</span></span></button>';
  }).join('') + '</nav>';
  const avatar = A.avatar(A.AVATAR_PRESETS[1], 30);
  const C = [
    ['Tab bar — 7 tabs, one bar', '<div class="b-demo col">' + tabbar('family') + tabbar('home', 'return') + '</div><p class="b-note">Icon-only tabs; the active one grows into a labelled pill (Family is the signature, in warm wood-gold). Second bar: Home active, Return <b>pressed</b> (icon squeezes, tint behind). Labels auto-fit — never truncated in any language.</p>'],
    ['Buttons', '<div class="b-demo"><button class="btn btn-primary">' + ic('plus', 18) + 'Add</button><button class="btn btn-primary is-pressed">Pressed</button><button class="btn btn-sun">' + ic('check', 18) + 'Collect</button><button class="btn btn-wood">' + ic('exit', 18) + 'Back to the village</button><button class="btn btn-soft">Add cash</button><button class="btn btn-ghost">Not yet</button><button class="btn btn-danger-soft" style="margin:0">' + ic('trash', 18) + 'Delete</button></div><p class="b-note">Chunky 3D base (4px edge) presses down 2px — a little Hay Day, still clean. Min height 48 (56 for large).</p>'],
    ['Money, never colour alone', '<div class="b-demo">' + FF.ui.delta(1240.5, { cur: 'MYR' }) + FF.ui.delta(-312.25, { cur: 'MYR' }) + FF.ui.delta(0, { cur: 'MYR' }) + FF.ui.delta(0.083, { pct: true }) + '</div><div class="b-demo" style="--gain:var(--red);--loss:var(--green)">' + FF.ui.delta(1240.5, { cur: 'MYR' }) + FF.ui.delta(-312.25, { cur: 'MYR' }) + '<span class="chip">“Red means up” setting</span></div><p class="b-note">Arrows + sign + aria-label (“up RM 1,240.50”). Gains colour follows the user’s setting.</p>'],
    ['Answer card', '<div class="answer-card up" style="margin:0"><div class="ans-kicker">You made</div><div class="ans-num num">' + ic('up', 26) + '<span>RM&nbsp;5,968.58</span></div><div class="ans-sub">so far this year · <b>+10.5%</b>' + FF.ui.learnBtn('return') + '</div></div><p class="b-note">The sentence is the hero; the percentage is secondary; the ⓘ opens a tap-to-learn tooltip.</p>'],
    ['Tap-to-learn tooltip', '<div class="b-demo" style="padding-top:20px"><div class="popover b-pop below show"><div class="pop-arrow"></div><div class="pop-title">' + ic('sparkle', 16) + '<span>Dividend</span></div><p>' + FF.i18n.t('learn.dividend.b') + '</p><button class="pop-ok">Got it</button></div></div>'],
    ['Segmented, switch, chips', '<div class="b-demo col">' + FF.ui.segmented('d', [{ v: '1m', l: '1 month' }, { v: '3m', l: '3 months' }, { v: 'ytd', l: 'This year' }, { v: '1y', l: '1 year' }, { v: 'all', l: 'All time' }], 'ytd') + '<div style="display:flex;gap:10px;align-items:center">' + FF.ui.toggle(true) + FF.ui.toggle(false) + '<span class="chip chip-sun">' + ic('sprout', 14) + 'Setup Mode</span><span class="chip chip-brand">You</span><span class="chip">' + ic('eye', 14) + 'View only</span></div></div>'],
    ['House tag (village)', '<div class="b-demo" style="background:#9BD167;justify-content:center;gap:24px;padding:20px"><div class="b-tag tag me"><span class="tag-in">' + A.avatar(A.AVATAR_PRESETS[0], 30) + '<span class="tag-txt"><b>Jamie</b><span class="tag-nw num">RM 68.8K</span></span><span class="tag-you">You</span></span></div><div class="b-tag tag"><span class="tag-in">' + A.avatar(A.AVATAR_PRESETS[3], 30) + '<span class="tag-txt"><b>Ah Ma</b><span class="tag-nw lock">' + ic('lock', 11) + 'Private</span></span></span></div><div class="b-tag tag tag-goals"><span class="tag-in">' + ic('target', 16) + '<b>Goals</b><span class="num">2/5</span></span></div></div><p class="b-note">Photo, name, total (compact, locale-aware). Counter-scaled so they stay readable at every zoom; 44pt tall.</p>'],
    ['Toast with Undo', '<div class="b-demo" style="background:transparent;padding:0"><div class="toast b-toast success"><span class="toast-ic">' + ic('check', 20) + '</span><span class="toast-msg">Added: Bought 10 Apple</span><button class="toast-act">' + ic('undo', 16) + 'Undo</button></div></div><p class="b-note">Every change is optimistic and instantly undoable.</p>'],
    ['Loading skeleton', '<div class="b-demo col" style="gap:8px">' + FF.ui.skeleton([[14, '40%'], [42, '75%'], [16, '60%'], [60, '100%', 'border-radius:16px']]) + '</div><p class="b-note">Same dimensions as the real content, so nothing jumps when numbers arrive.</p>'],
    ['Empty state', '<div class="empty" style="padding:6px">' + A.emptyArt('poster', 110) + '<h3>No goals yet</h3><p>What should your family aim for this year? Pick an idea or write your own.</p></div>']
  ];
  $('components-grid').innerHTML = C.map((c) => '<div class="b-card"><h4>' + c[0] + '</h4>' + c[1] + '</div>').join('');
  FF.ui.fitAll(document);
  document.addEventListener('click', (e) => { const l = e.target.closest('[data-learn]'); if (l) FF.ui.learn(l.dataset.learn, l); });
  $('icons').innerHTML = '<div>' + A.familyIcon(28) + '<span>family (signature)</span></div>' + Object.keys(A.ICONS).map((k) => '<div>' + ic(k, 26) + '<span>' + k + '</span></div>').join('');

  /* ---------- village kit ---------- */
  function renderKit() {
    const night = document.documentElement.classList.contains('theme-dark');
    const L = FF.store.LOOKS;
    const cell = (inner, label, isNight) => '<div class="b-kit-cell' + (isNight ? ' night' : '') + '">' + inner + '<div>' + label + '</div></div>';
    let h = '<h3 class="b-h3">Houses grow with your total</h3><div class="b-kit-row">';
    A.night = false;
    ['me', 'mum', 'gran', 'mum', 'dad', 'me'].forEach((k, i) => { h += cell(A.house(Object.assign({ plate: '' }, L[k].house), i + 1, { still: true }), 'Level ' + (i + 1) + ' · ' + FF.i18n.t('level.name.' + (i + 1))); });
    h += '</div><h3 class="b-h3">Every part is customisable</h3><div class="b-kit-row">';
    const base = Object.assign({ plate: 'The Nest' }, L.me.house);
    [['roof', 'gable', 'Classic roof'], ['roof', 'hip', 'Cottage roof'], ['roof', 'steep', 'Storybook roof'], ['door', 'round', 'Round door + brick', { wall: 'brick', wallColor: '#F9D0D6' }], ['door', 'square', 'Square door + wood', { wall: 'wood', roofColor: '#8A5BC7' }]].forEach((v) => {
      const hh = Object.assign({}, base, { [v[0]]: v[1] }, v[3] || {});
      h += cell(A.house(hh, 3, { still: true }), v[2]);
    });
    h += '</div><h3 class="b-h3">Night (dark mode) — windows and lamps glow</h3><div class="b-kit-row">';
    A.night = true;
    h += cell(A.house(Object.assign({ plate: '' }, L.mum.house), 4, { still: true }), 'Mum · night', true) + cell(A.house(Object.assign({ plate: '' }, L.dad.house), 5, { still: true }), 'Dad · night', true) + cell(A.lamp().svg, 'Lamp', true) + cell(A.goalsStand({ title: 'Goals 2026', done: 2, total: 5 }).svg, 'Goals stand', true);
    A.night = false;
    h += '</div><h3 class="b-h3">Village friends</h3><p class="b-sub">Each has a personality: chickens peck, the chick follows its mum, the puppy bounds, the cat naps in gardens, the duckling paddles, Penny the piggy bank snoozes. Tap reactions: hearts, wiggle, a sound and a little money tip. They never block taps on houses or controls.</p><div class="b-kit-row">';
    FF.store.PETS.forEach((p) => { h += cell(A.animal(p), FF.i18n.t('pet.' + p + '.name') + '<br><span style="font-weight:600;opacity:.8">' + FF.i18n.t('pet.' + p + '.how') + '</span>'); });
    h += '</div><h3 class="b-h3">Landmarks & the Family Goals stand</h3><div class="b-kit-row">';
    h += cell(A.familyTree('Family Tree').svg, 'Family Tree (with swing)') + cell(A.windmill().svg, 'Windmill') + cell(A.well().svg, 'Well') + cell(A.signpost('FamFi', 'Welcome!').svg, 'Signpost') + cell(A.tree('blossom', 4).svg, 'Blossom') + cell(A.tree('pine', 2).svg, 'Pine');
    [[0, 5], [3, 5], [5, 5]].forEach((g) => { h += cell(A.goalsStand({ title: 'Goals 2026', done: g[0], total: g[1] }).svg, g[0] + ' of ' + g[1] + (g[0] === g[1] ? ' · ribbon!' : '')); });
    h += '</div>';
    $('kit').innerHTML = h;
    A.night = night;
  }

  /* ---------- live screens ---------- */
  const GROUPS = [
    ['Getting started', 'Splash, sign-up, then start a village or join one with a code.', [
      ['splash', 'Splash', 'Logo pop, wordmark, tagline in the chosen language'], ['welcome', 'Welcome', 'Language chip up front; demo family for the curious'], ['signup', 'Sign up', 'Pick an illustrated avatar or a photo'],
      ['choice', 'Create or join', 'Two big, plain choices'], ['create', 'Create a village', 'Live wooden-sign preview'], ['join', 'Join with a code', 'Big, auto-formatted code field'], ['loading', 'Loading state', 'Skeletons match the real layout — no jumps']]],
    ['The Family village', 'The signature first tab: houses, tags, the goals stand and roaming animals.', [
      ['village', 'Village', 'Tap a house to visit; tap an animal to say hi'], ['village-edit', 'Edit mode', 'Long-press → jiggle, drag, snap to grid'], ['customize', 'House customiser', 'Roof, walls, door, flag, garden, nameplate'],
      ['goals', 'Family Goals poster', 'Who ticked it and when; DONE! stamps'], ['goals-add', 'Add a goal', 'Ideas, or your own words'], ['goals-empty', 'Goals — empty', 'A blank poster with quick ideas'],
      ['invite', 'Invite family', 'Code, share link, and a “someone joins” preview'], ['visit', 'Visiting Mum', 'Read-only, with a huge Exit'], ['visit-private', 'Privacy respected', 'Ah Ma keeps her total private']]],
    ['Money screens', 'Clean, calm data. Answers first, details on tap.', [
      ['home', 'Home', 'Total · accounts · quick add · budgets · the month · investments · where your money is'], ['home-empty', 'Home — new', 'Main account + three steps to set up'],
      ['return', 'Return', '“How much have I made?” + period picker + every holding'], ['div', 'Dividend', 'Added automatically after 30% US tax · coming soon · calendar'],
      ['trade', 'Add holding · search', 'US stocks & ETFs — search in English, 中文 or ไทย'], ['trade-details', 'Add holding · details', 'Live price + sentence: “You bought 10 Apple for…”'], ['budget', 'Budgets', 'Monthly / weekly limits with a “where you should be” marker'], ['spend', 'I spent', 'Amount, currency, category grid, account, note'], ['account', 'One account', 'Balance, trend, quick add, records'], ['hall', 'Town Hall', 'Family assets everyone can update']]],
    ['Manage & Menu', 'Records, settings and the language picker.', [
      ['manage', 'Manage', 'Holdings · Activity · Accounts · Currency'], ['menu', 'Menu', 'Language row with globe + current-language chip'],
      ['language', 'Language sheet', 'Each option in its own script'], ['privacy', 'Who can see my money', 'Everyone · some people · just me'], ['badges', 'Badges & streaks', 'Streak sprout, house level, badges'], ['friends', 'Village friends', 'Animals unlock with family progress']]],
    ['Gems, Shop & house levels', 'A daily gift with a streak; gems buy decorations and pets your family sees in the village.', [
      ['daily', 'Daily gift', 'A week of gifts, the big one on day 7; shields protect a streak'], ['shop', 'Shop · decorations', 'Roof · front door · garden · sky — rarity and price'],
      ['shop-pets', 'Shop · pets', 'Eight exclusive pets that live around your house'], ['item', 'Try it on', 'Your own house with the item on it — tap twice to buy'],
      ['item-pet', 'A legendary pet', 'Ember the baby dragon'], ['levelup', 'Your house grew!', 'Six levels: RM 50k · 100k · 300k · 500k · 1M'], ['earn', 'How to earn gems', 'Good habits only — never wealth']]],
    ['Dark mode', 'The village becomes a night village; data screens go warm-dark.', [
      ['village', 'Village · night', 'Glowing windows, lamps, fireflies, the Town Hall', 'dark'], ['home', 'Home · dark', '', 'dark'], ['div', 'Dividend · dark', '', 'dark'], ['goals', 'Goals · dark', '', 'dark']]]
  ];
  const lightStatus = (shot, theme) => theme === 'dark' || /^village|^customize|^goals|^invite/.test(shot);
  function phone(shot, lang, theme, title, note) {
    const src = 'index.html?shot=' + shot + '&lang=' + lang + '&safe=1' + (theme ? '&theme=' + theme : '');
    const light = lightStatus(shot, theme);
    return '<div class="b-phone"><div class="b-frame"><div class="b-screen"><div class="b-status' + (light ? ' light' : '') + '"><span>9:41</span><i>●●● ◔ ▮</i></div><div class="b-island"></div><iframe loading="lazy" title="' + FF.esc(title) + '" data-src="' + src + '"></iframe><div class="b-home' + (light ? ' light' : '') + '"></div></div></div><div class="b-cap"><b>' + title + '</b>' + (note ? '<span>' + note + '</span>' : '') + '</div></div>';
  }
  $('screen-groups').innerHTML = GROUPS.map((g) => '<div class="b-group"><h3>' + g[0] + '</h3><p>' + g[1] + '</p><div class="b-phones">' + g[2].map((s) => phone(s[0], 'en', s[3], s[1], s[2])).join('') + '</div></div>').join('');
  $('lang-grid').innerHTML = [['village', 'en', 'Village · English'], ['village', 'zh', '村庄 · 简体中文'], ['village', 'th', 'หมู่บ้าน · ไทย'], ['home', 'en', 'Home · English'], ['home', 'zh', '首页 · 简体中文'], ['home', 'th', 'หน้าหลัก · ไทย'], ['menu', 'zh', '菜单 · 简体中文'], ['menu', 'th', 'เมนู · ไทย'], ['goals', 'th', 'เป้าหมาย · ไทย']].map((p) => phone(p[0], p[1], '', p[2], '')).join('');
  // load iframes as they approach the viewport, and unload far-away ones (keeps the board light)
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    const f = en.target;
    if (en.isIntersecting) { if (!f.src) f.src = f.dataset.src; }
  }), { rootMargin: '600px 0px' });
  document.querySelectorAll('iframe[data-src]').forEach((f) => io.observe(f));

  /* ---------- motion ---------- */
  $('motion-grid').innerHTML =
    '<div class="b-card"><h4>Timing & easing</h4><table><tr><td>120ms</td><td>Press feedback, toggles, chips</td></tr><tr><td>220ms</td><td>State changes, colour, segmented controls</td></tr><tr><td>380–440ms</td><td>Sheets & pages — iOS curve <code>cubic-bezier(.32,.72,0,1)</code></td></tr><tr><td>Spring</td><td><code>cubic-bezier(.34,1.56,.64,1)</code> — pop-ins, stamps, tag drops</td></tr><tr><td>Count-up</td><td>650ms ease-out on big numbers when they change</td></tr></table></div>' +
    '<div class="b-card"><h4>Signature moments</h4><table><tr><td>Visit</td><td>Camera glides into the front door, then a circular reveal opens their house; Exit reverses it</td></tr><tr><td>Move-in</td><td>House drops in, squash & stretch, dust puffs, confetti, tag lands</td></tr><tr><td>Harvest</td><td>Coins arc from the basket to the Home tab with soft clinks</td></tr><tr><td>Goal tick</td><td>Box bounces, red DONE! stamp slams in, confetti, poster bar fills</td></tr><tr><td>Edit</td><td>Houses jiggle like iOS; lifted house floats with a green/red footprint</td></tr></table></div>' +
    '<div class="b-card"><h4>60fps rules</h4><table><tr><td>GPU only</td><td>Only transform & opacity animate on big layers. Flags, smoke, windmill blades and tree sway are separate composited layers.</td></tr><tr><td>Animals</td><td>One rAF loop, translate3d per sprite, depth by y; paused when the tab or app is hidden</td></tr><tr><td>Static ground</td><td>The 1000×1500 map is drawn once; nothing inside it animates</td></tr></table></div>' +
    '<div class="b-card"><h4>Calm motion</h4><table><tr><td>System</td><td>Follows iOS “Reduce Motion” by default; can be forced on/off in Menu</td></tr><tr><td>When on</td><td>Animals rest in place, ambient loops stop, sheets & pages crossfade, confetti becomes a single check pulse</td></tr><tr><td>Haptics</td><td>Light taps on snap, tick and harvest (iOS 18 switch haptic, vibrate elsewhere)</td></tr></table><div class="b-demo"><button class="btn btn-soft" id="demo-sheet">Open a sheet</button><button class="btn btn-soft" id="demo-toast">Show a toast</button></div></div>';
  $('demo-sheet').addEventListener('click', () => FF.ui.openSheet({ render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>A FamFi sheet</h2><button type="button" class="icon-btn" data-close>' + ic('close', 22) + '</button></div><p class="lead">Drag the grabber down, tap the backdrop or the ✕ to close. Sheets spring up from the bottom and keep one primary action at thumb height.</p><button class="btn btn-primary btn-block btn-lg" data-close>Got it</button>', onRender: (b, api) => b.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', () => api.close())) }));
  $('demo-toast').addEventListener('click', () => FF.ui.toast('Added: Bought 10 Apple', { icon: 'check', tone: 'success', action: 'Undo', actionIcon: 'undo' }));

  renderSwatches();
  renderKit();
})();
