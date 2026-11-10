/* ============================================================
   FamFi — play.js
   Gems 💎, the daily gift + streak, the shop catalogue (house
   decorations and exclusive pets) and badge tiers. Pure logic —
   no DOM (runs in the jsc tests). The store keeps the state in
   member.play (private, synced to your own phones); what you
   put on show lives in member.house (deco + pets), which your
   family sees in the village.

   Pacing (on purpose, so the shop lasts): an every-day user earns
   roughly 850–950 gems a month — a week of daily gifts is 150, the
   first record you log each day +5, a month inside your budgets
   +100, plus badges. The cheapest decoration is a few days away,
   the first pet about three weeks, the dragon months; the whole
   catalogue is a long-term goal. Gems are never given for being
   wealthy (house levels already show that) — only for habits.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;

  /* ---------- earning ---------- */
  const CYCLE = [10, 10, 15, 15, 20, 20, 60]; // day 1…7 of each week in a row (day 7: the big gift)
  const CHEST_EVERY = 30, CHEST = 150;       // every 30th day in a row: a monthly chest on top
  const LOG_GEMS = 5;                         // the first record you log each day
  const BUDGET_GEMS = 100;                    // a whole month inside every monthly budget
  const WELCOME = 50;
  const TIERS = { bronze: 25, silver: 100, gold: 300, diamond: 1000 };
  // Block Blast: 1 gem per 300 points in a game — no daily limit
  // (a careful player scores ~1,500 in a median game, 5,000+ in a great one)
  const BLAST = { PER: 300 };
  const NEWS = { GOAL: 3, GEMS: 5 }; // read 3 stories in the News mailbox in a day → 5 gems (once a day)
  /* the daily spin: eight equal slices, each exactly as likely (1 in 8) — about 11 gems a day on
     average (5·10·15·5·10·40) plus, twice in eight, a Lucky Market tonic or pet treat */
  const SPIN = [{ k: 'gems', n: 5 }, { k: 'gems', n: 10 }, { k: 'item', id: 'tonic' }, { k: 'gems', n: 15 }, { k: 'gems', n: 5 }, { k: 'item', id: 'treat' }, { k: 'gems', n: 10 }, { k: 'gems', n: 40 }];
  /* the Mystery Man's quiz: 2 gems for each right answer, the first 10 right answers of a day
     (after that he still teaches — for the joy of it) */
  const SAGE = { GEMS: 2, DAILY: 10, KEEP: 80 };
  const TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond'];
  const LOG_KEEP = 40;

  /* ---------- the shop ---------- */
  const SLOTS = ['roof', 'door', 'yard', 'sky'];
  const RARITY = ['common', 'rare', 'epic', 'legendary'];
  const DECOR = [
    { id: 'wreath', slot: 'door', price: 100, r: 'common', e: '💐' },
    { id: 'lanterns', slot: 'door', price: 200, r: 'common', e: '🏮' },
    { id: 'luckycat', slot: 'door', price: 450, r: 'rare', e: '🐱' },
    { id: 'nest', slot: 'roof', price: 150, r: 'common', e: '🐦' },
    { id: 'lights', slot: 'roof', price: 300, r: 'rare', e: '✨' },
    { id: 'roofcat', slot: 'roof', price: 500, r: 'rare', e: '🐈' },
    { id: 'vane', slot: 'roof', price: 650, r: 'epic', e: '🐓' },
    { id: 'gnome', slot: 'yard', price: 150, r: 'common', e: '🍄' },
    { id: 'birdbath', slot: 'yard', price: 250, r: 'common', e: '🕊️' },
    { id: 'pumpkins', slot: 'yard', price: 300, r: 'rare', e: '🎃' },
    { id: 'snowman', slot: 'yard', price: 350, r: 'rare', e: '⛄' },
    { id: 'koi', slot: 'yard', price: 800, r: 'epic', e: '🐟' },
    { id: 'kite', slot: 'sky', price: 700, r: 'epic', e: '🪁' },
    { id: 'balloon', slot: 'sky', price: 1000, r: 'epic', e: '🎈' },
    { id: 'rainbow', slot: 'sky', price: 1500, r: 'legendary', e: '🌈' },
    // exclusive: only ever sold at the Lucky Market (lucky.js), on the odd day
    { id: 'clover', slot: 'yard', price: 260, r: 'rare', e: '🍀', lucky: true },
    { id: 'goldbell', slot: 'door', price: 300, r: 'rare', e: '🔔', lucky: true },
    { id: 'fireworks', slot: 'sky', price: 420, r: 'epic', e: '🎆', lucky: true }
  ];
  const PETS = [
    { id: 'bunny', price: 500, r: 'common', e: '🐰', size: 34 },
    { id: 'shiba', price: 800, r: 'common', e: '🐕', size: 40 },
    { id: 'penguin', price: 1000, r: 'rare', e: '🐧', size: 36 },
    { id: 'redpanda', price: 1300, r: 'rare', e: '🦝', size: 40 },
    { id: 'capybara', price: 1600, r: 'epic', e: '🦫', size: 44 },
    { id: 'tapir', price: 1800, r: 'epic', e: '🐘', size: 44 },
    { id: 'fox', price: 2000, r: 'epic', e: '🦊', size: 40 },
    { id: 'dragon', price: 3000, r: 'legendary', e: '🐉', size: 44 }
  ];
  const SHIELD = { id: 'shield', price: 200, max: 2, e: '🛡️' };
  const MAX_PETS = 3; // how many can live at your house at once
  const ITEMS = {};
  DECOR.forEach((d) => { d.kind = 'deco'; ITEMS[d.id] = d; });
  PETS.forEach((p) => { p.kind = 'pet'; ITEMS[p.id] = p; });
  const item = (id) => ITEMS[id] || null;

  /* ---------- badges (bronze = the easy first steps; the rest take real habits) ---------- */
  const BADGES = [
    { k: 'first_holding', tier: 'bronze', e: '🌱' }, { k: 'setup_done', tier: 'bronze', e: '✅' }, { k: 'first_dividend', tier: 'bronze', e: '🧺' },
    { k: 'diversified', tier: 'bronze', e: '🌈' }, { k: 'on_budget', tier: 'bronze', e: '🎯' }, { k: 'streak_4', tier: 'bronze', e: '🌿' },
    { k: 'team_player', tier: 'bronze', e: '🤝' }, { k: 'village_builder', tier: 'bronze', e: '🏡' },
    { k: 'checkin_30', tier: 'silver', e: '🔥' }, { k: 'logger_100', tier: 'silver', e: '📒' }, { k: 'budget_3', tier: 'silver', e: '🗓️' },
    { k: 'saver_20', tier: 'silver', e: '💰' }, { k: 'div_12', tier: 'silver', e: '🌾' }, { k: 'house_3', tier: 'silver', e: '🏠' }, { k: 'decorator', tier: 'silver', e: '🎨' },
    { k: 'checkin_100', tier: 'gold', e: '💯' }, { k: 'budget_6', tier: 'gold', e: '🏅' }, { k: 'saver_3', tier: 'gold', e: '🐷' },
    { k: 'house_5', tier: 'gold', e: '🏰' }, { k: 'collector', tier: 'gold', e: '🐾' },
    { k: 'bb_5k', tier: 'silver', e: '🧩' }, { k: 'bb_20k', tier: 'gold', e: '💥' },
    { k: 'green_thumb', tier: 'bronze', e: '🌸' }, { k: 'angler', tier: 'silver', e: '🎣' }, { k: 'pet_majestic', tier: 'gold', e: '👑' },
    { k: 'checkin_365', tier: 'diamond', e: '👑' }, { k: 'logger_365', tier: 'diamond', e: '📚' }, { k: 'millionaire', tier: 'diamond', e: '🏆' }
  ];
  const BADGE = {};
  BADGES.forEach((b) => { BADGE[b.k] = b; });
  const badge = (k) => BADGE[k] || { k, tier: 'bronze', e: '🏅' };
  const badgeGems = (k) => TIERS[badge(k).tier];

  /* ---------- state ---------- */
  const fresh = () => ({ pts: 0, earned: 0, day: null, streak: 0, best: 0, shields: 0, owned: {}, got: {}, log: [], logDay: null, bbDay: null, bbToday: 0, bag: {}, lucky: null, fish: null, spin: null, sage: null });
  /* a member's play state, created (with a welcome gift) the first time it's needed. Badges
     earned before gems existed count once, at bronze value. */
  function ensure(m, day) {
    if (!m) return null;
    let p = m.play;
    if (!p || typeof p !== 'object') {
      p = m.play = fresh();
      const had = Object.keys(m.badges || {});
      had.forEach((k) => { p.got['badge:' + k] = 1; });
      earn(p, WELCOME + had.length * TIERS.bronze, 'welcome', day == null ? FF.today() : day, had.length ? { n: had.length } : null);
    }
    const f = fresh();
    Object.keys(f).forEach((k) => { if (p[k] == null) p[k] = f[k]; });
    if (!Array.isArray(p.log)) p.log = [];
    return p;
  }
  function earn(p, n, k, day, x) {
    p.pts += n;
    if (n > 0) p.earned += n;
    p.log.unshift(Object.assign({ d: day, k, n }, x || {}));
    if (p.log.length > LOG_KEEP) p.log.length = LOG_KEEP;
    return n;
  }
  /* one-time rewards (a badge, a budget month): never twice */
  function once(p, key, n, k, day, x) {
    if (p.got[key]) return 0;
    p.got[key] = 1;
    return earn(p, n, k, day, x);
  }

  /* ---------- the daily gift ---------- */
  const giftFor = (n) => CYCLE[(Math.max(1, n) - 1) % CYCLE.length];
  const chestFor = (n) => (n > 0 && n % CHEST_EVERY === 0 ? CHEST : 0);
  /* what tapping "Collect" today would do */
  function preview(p, day) {
    // already collected today — or the clock went backwards (never a second gift that way)
    if (p.day != null && day <= p.day) return { claimed: true, streak: p.streak, gift: 0, chest: 0, week: weekOf(p.streak, true) };
    const gap = p.day == null ? Infinity : day - p.day - 1;          // whole days missed
    const keeps = gap === 0 || (gap > 0 && gap <= p.shields);
    const streak = keeps ? p.streak + 1 : 1;
    return { claimed: false, streak, gift: giftFor(streak), chest: chestFor(streak), shieldsUsed: keeps && gap > 0 ? gap : 0, lost: !keeps && p.streak > 0 ? p.streak : 0, week: weekOf(streak, false) };
  }
  /* the 7-day track to draw: which day of this week's cycle, and what each pays */
  function weekOf(streak, claimedToday) {
    const at = (Math.max(1, streak) - 1) % CYCLE.length;    // index of today's (or the next) gift
    return CYCLE.map((g, i) => ({ i, gems: g, state: i < at || (i === at && claimedToday) ? 'done' : i === at ? 'today' : 'later' }));
  }
  function claim(p, day) {
    const v = preview(p, day);
    if (v.claimed) return { ok: false, reason: 'claimed' };
    if (v.shieldsUsed) p.shields -= v.shieldsUsed;
    p.streak = v.streak;
    p.best = Math.max(p.best, p.streak);
    p.day = day;
    earn(p, v.gift, 'gift', day, { s: p.streak });
    if (v.chest) earn(p, v.chest, 'chest', day, { s: p.streak });
    return { ok: true, gems: v.gift + v.chest, gift: v.gift, chest: v.chest, streak: p.streak, shieldsUsed: v.shieldsUsed, lost: v.lost };
  }
  /* is the streak still alive today (claimed yesterday, or shields can cover the gap)? */
  function streakNow(p, day) {
    if (!p || !p.streak || p.day == null) return 0;
    if (p.day >= day - 1) return p.streak;
    return day - p.day - 1 <= p.shields ? p.streak : 0;
  }
  /* +5 for the first record each day */
  function logReward(p, day) {
    if (p.logDay === day) return 0;
    p.logDay = day;
    return earn(p, LOG_GEMS, 'log', day);
  }

  /* ---------- Block Blast ---------- */
  /* gems for a finished game: 1 per 300 points, no daily limit (bbToday is just today's total) */
  function blastReward(p, score, day) {
    if (p.bbDay !== day) { p.bbDay = day; p.bbToday = 0; }
    const n = Math.max(0, Math.floor(Math.max(0, score) / BLAST.PER));
    if (n) { p.bbToday += n; earn(p, n, 'game', day, { s: score }); }
    return { n, today: p.bbToday };
  }

  /* ---------- the daily spin ---------- */
  /* spun today already (or the clock went backwards: never a second spin that way)? */
  const spinDone = (p, day) => !!(p && p.spin && p.spin.day >= day);
  /* rnd in [0, 1): which slice (all eight equally likely) */
  function spin(p, day, rnd) {
    if (spinDone(p, day)) return { ok: false, reason: 'done' };
    const i = Math.min(SPIN.length - 1, Math.floor((rnd != null ? rnd : Math.random()) * SPIN.length));
    const prize = SPIN[i];
    p.spin = { day, i };
    if (prize.k === 'gems') earn(p, prize.n, 'spin', day, { i });
    else { p.bag = Object.assign({}, p.bag); p.bag[prize.id] = (p.bag[prize.id] || 0) + 1; }
    return { ok: true, i, prize };
  }

  /* ---------- the Mystery Man's quiz ---------- */
  function sageOf(p, day) {
    const s = p.sage && typeof p.sage === 'object' ? p.sage : {};
    const today = s.day === day;
    return { day, n: today ? s.n | 0 : 0, right: s.right | 0, asked: s.asked | 0, seen: Array.isArray(s.seen) ? s.seen : [] };
  }
  /* how many more right answers pay today */
  const sageLeft = (p, day) => Math.max(0, SAGE.DAILY - sageOf(p, day).n);
  /* an answer to fact id: right → 2 gems while today's 10 last; every fact is remembered as seen
     (so the next one is new) */
  function sageAnswer(p, day, id, right) {
    const s = sageOf(p, day);
    s.asked++;
    s.seen = [String(id)].concat(s.seen.filter((x) => x !== String(id))).slice(0, SAGE.KEEP);
    let gems = 0;
    if (right) {
      s.right++;
      if (s.n < SAGE.DAILY) { s.n++; gems = earn(p, SAGE.GEMS, 'sage', day, { id: String(id) }); }
    }
    p.sage = s;
    return { gems, left: Math.max(0, SAGE.DAILY - s.n), right: s.right, asked: s.asked };
  }

  /* ---------- buying ---------- */
  function owns(p, id) { return !!(p && p.owned && p.owned[id]); }
  function canBuy(p, id) {
    if (id === SHIELD.id) return p.shields >= SHIELD.max ? 'full' : p.pts < SHIELD.price ? 'short' : 'ok';
    const it = item(id);
    if (!it) return 'unknown';
    if (owns(p, id)) return 'owned';
    return p.pts < it.price ? 'short' : 'ok';
  }
  function buy(p, id, day) {
    const why = canBuy(p, id);
    if (why !== 'ok') return { ok: false, reason: why };
    if (id === SHIELD.id) { p.shields++; earn(p, -SHIELD.price, 'buy', day, { id }); return { ok: true, price: SHIELD.price }; }
    const it = item(id);
    p.owned[id] = day;
    earn(p, -it.price, 'buy', day, { id });
    return { ok: true, price: it.price, item: it };
  }
  const ownedPets = (p) => PETS.filter((x) => owns(p, x.id)).map((x) => x.id);

  /* ---------- the house you show ---------- */
  /* only items you own, one per slot, at most MAX_PETS pets (protects against odd data) */
  function cleanHouse(h, p) {
    if (!h) return h;
    const deco = {};
    SLOTS.forEach((s) => { const id = h.deco && h.deco[s]; const it = item(id); if (it && it.kind === 'deco' && it.slot === s && (!p || owns(p, id))) deco[s] = id; });
    const pets = (Array.isArray(h.pets) ? h.pets : []).filter((id, i, a) => { const it = item(id); return it && it.kind === 'pet' && a.indexOf(id) === i && (!p || owns(p, id)); }).slice(0, MAX_PETS);
    h.deco = deco; h.pets = pets;
    return h;
  }
  /* what others may draw: whatever is valid in the catalogue (they can't see your purchases) */
  function shownDeco(h) {
    const out = {};
    SLOTS.forEach((s) => { const id = h && h.deco && h.deco[s]; const it = item(id); if (it && it.kind === 'deco' && it.slot === s) out[s] = id; });
    return out;
  }
  const shownPets = (h) => (h && Array.isArray(h.pets) ? h.pets.filter((id, i, a) => item(id) && item(id).kind === 'pet' && a.indexOf(id) === i).slice(0, MAX_PETS) : []);

  FF.play = {
    CYCLE, CHEST, CHEST_EVERY, LOG_GEMS, BUDGET_GEMS, WELCOME, TIERS, BLAST, NEWS, SPIN, SAGE, spin, spinDone, sageOf, sageLeft, sageAnswer, blastReward, TIER_ORDER, SLOTS, RARITY, DECOR, PETS, SHIELD, MAX_PETS, BADGES,
    item, badge, badgeGems, fresh, ensure, earn, once, giftFor, chestFor, preview, weekOf, claim, streakNow, logReward,
    owns, canBuy, buy, ownedPets, cleanHouse, shownDeco, shownPets
  };
})(typeof window !== 'undefined' ? window : this);
