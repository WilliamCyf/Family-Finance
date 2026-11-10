/* ============================================================
   FamFi — lucky.js
   The Lucky Market (a building in the village) and everything
   it sells, plus fishing at the pond. Pure rules — no DOM (runs
   in the jsc tests); the store applies them, the village and
   screens-lucky.js draw them.

   • Six stalls a day, different every day (the same on all your
     phones: the day's stock is drawn from a seed of you + the
     day). Each stall sells once — then it's sold out until
     tomorrow.
   • Pet eggs hatch a pet (gacha: common → legendary). Feed it once
     a day when it's hungry or thirsty; after 12 days fed it grows,
     after 30 it becomes majestic. Switch between the forms it has
     unlocked any time, or sell it for gems.
   • Seed packets grow into a plant somewhere on the map (move it
     in edit mode). Water it once a day: sprout after 1 day, leaves
     after 3, a bud after 6, and on day 9 it blooms into its kind
     (common → legendary). Older blooms sell for more.
   • A Molotov sets a family member's house "on fire" for a day —
     just for fun, nothing else happens.
   • Growth tonic / pet treat: one extra day of growth / feeding.
   • Now and then an exclusive decoration you can't get anywhere
     else.
   • Fishing: five casts a day; stop the needle in the green zone.

   Pacing (an every-day user earns ~30 gems a day): an egg is
   about three days of gems, a seed about one and a half; selling
   straight away gets back less than you paid, but a pet you've
   raised or a plant you've let grow is worth more than its egg or
   seed — care pays.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;

  const TIERS = ['common', 'rare', 'epic', 'legendary'];

  /* ---------- what the market sells ---------- */
  const ITEMS = {
    egg: { kind: 'egg', price: 80, w: 20, e: '🥚', odds: [62, 26, 9.5, 2.5] },
    goldegg: { kind: 'egg', price: 220, w: 5, e: '🥚', odds: [0, 60, 30, 10] },
    seed: { kind: 'seed', price: 40, w: 22, e: '🌱', odds: [62, 26, 9.5, 2.5] },
    rareseed: { kind: 'seed', price: 120, w: 6, e: '🌱', odds: [0, 60, 30, 10] },
    molotov: { kind: 'bag', price: 15, w: 12, e: '🔥' },
    tonic: { kind: 'bag', price: 20, w: 10, e: '🧪' },
    treat: { kind: 'bag', price: 20, w: 10, e: '🍪' },
    // exclusive decorations (only ever sold here) — see play.js DECOR, lucky: true
    clover: { kind: 'deco', price: 260, w: 4, e: '🍀' },
    goldbell: { kind: 'deco', price: 300, w: 4, e: '🔔' },
    fireworks: { kind: 'deco', price: 420, w: 3, e: '🎆' }
  };
  const STALLS = 6;
  const MAX_SAME = 2;               // at most two of the same thing on one day

  /* ---------- pets ---------- */
  const PETS = {
    chick: { r: 'common', size: 36 }, hamster: { r: 'common', size: 36 }, frog: { r: 'common', size: 36 },
    otter: { r: 'rare', size: 40 }, koala: { r: 'rare', size: 40 },
    kitsune: { r: 'epic', size: 42 }, unicorn: { r: 'epic', size: 44 },
    phoenix: { r: 'legendary', size: 46 }
  };
  const MAX_PETS = 4;               // pets in your yard at once (sell one to make room)
  const PET_SPOTS = [[-68, 28], [68, 30], [-38, 56], [42, 60]]; // where they sit, from the house (world px)
  const EVOLVE = [0, 12, 30];       // days fed to unlock each form: baby · grown · majestic
  const FORM_SCALE = [1, 1.22, 1.45];
  const PET_SELL = [25, 60, 150, 400];
  const FORM_SELL = [1, 1.8, 3.2];

  /* ---------- plants ---------- */
  const PLANTS = {
    sunflower: { r: 'common' }, tulip: { r: 'common' },
    rose: { r: 'rare' }, lavender: { r: 'rare' },
    bonsai: { r: 'epic' }, crystal: { r: 'epic' },
    moneytree: { r: 'legendary' }
  };
  const MAX_PLANTS = 6;
  const GROW = [1, 3, 6, 9];        // days watered: sprout · leaves · bud · bloom
  const PLANT_SELL = [15, 40, 100, 300];
  const UNRIPE_SELL = 8;
  const AGE_FULL = 30;              // a bloom is worth up to twice as much after 30 days

  /* ---------- the Molotov ---------- */
  const BURN_MS = 24 * 3600 * 1000;

  /* ---------- fishing ---------- */
  const CASTS = 5;                  // casts a day
  const SWEEP_MS = 1250;            // the needle crosses the bar in 1.25 s (then back)
  const GOOD = 0.15, PERFECT = 0.04; // half-widths of the green zone and its golden centre
  const FISH = { minnow: { r: 'common' }, carp: { r: 'common' }, koi: { r: 'rare' }, goldkoi: { r: 'epic' }, pearl: { r: 'legendary' } };
  const FISH_ODDS = { perfect: [40, 35, 18, 7], good: [75, 22, 3, 0] };
  const FISH_GEMS = [2, 4, 8, 20];
  const PERFECT_BONUS = 2;

  const tierIx = (r) => Math.max(0, TIERS.indexOf(r));
  const seeded = (s) => FF.rng(FF.hash(String(s)));

  /* pick by weights */
  function pickW(list, wOf, r) {
    const tot = list.reduce((a, x) => a + wOf(x), 0);
    let v = r() * tot;
    for (let k = 0; k < list.length; k++) { v -= wOf(list[k]); if (v <= 0) return list[k]; }
    return list[list.length - 1];
  }
  /* a rarity from odds [common, rare, epic, legendary] (percent) */
  function rollTier(odds, r) {
    let v = r() * 100;
    for (let k = 0; k < TIERS.length; k++) { v -= odds[k]; if (v < 0) return TIERS[k]; }
    for (let k = TIERS.length - 1; k >= 0; k--) if (odds[k] > 0) return TIERS[k];
    return 'common';
  }
  const ofTier = (table, tier) => Object.keys(table).filter((k) => table[k].r === tier);

  /* =========================================================
     THE DAY'S STALLS
     ========================================================= */
  /* six things for this member on this day. `skip`: exclusive decorations already owned
     (they're never offered twice). The first stall is always an egg or a seed packet. */
  function stock(memberId, day, skip) {
    const r = seeded('lucky|' + memberId + '|' + day);
    const pool = Object.keys(ITEMS).filter((id) => !(skip && skip[id]));
    const count = {};
    const out = [];
    const first = r() < 0.5 ? 'egg' : 'seed';
    out.push(first); count[first] = 1;
    while (out.length < STALLS) {
      const id = pickW(pool.filter((x) => (count[x] || 0) < (ITEMS[x].kind === 'deco' ? 1 : MAX_SAME)), (x) => ITEMS[x].w, r);
      out.push(id); count[id] = (count[id] || 0) + 1;
    }
    return out;
  }
  /* today's stalls in the play state (made once a day, so buying a decoration doesn't reshuffle) */
  function today(p, memberId, day, ownedDeco) {
    if (!p.lucky || p.lucky.day !== day || !Array.isArray(p.lucky.stock)) {
      const skip = {};
      Object.keys(ITEMS).forEach((id) => { if (ITEMS[id].kind === 'deco' && ownedDeco && ownedDeco[id]) skip[id] = 1; });
      p.lucky = { day, stock: stock(memberId, day, skip), sold: [] };
    }
    if (!Array.isArray(p.lucky.sold)) p.lucky.sold = [];
    return p.lucky;
  }
  const leftToday = (p, day) => (!p.lucky || p.lucky.day !== day ? STALLS : STALLS - p.lucky.sold.length);

  /* =========================================================
     PETS
     ========================================================= */
  function hatch(eggId, r) {
    const tier = rollTier(ITEMS[eggId].odds, r || Math.random);
    const kinds = ofTier(PETS, tier);
    const sp = kinds[Math.floor((r || Math.random)() * kinds.length)];
    return { sp, r: tier };
  }
  /* forms unlocked: 0 baby, 1 grown (12 days fed), 2 majestic (30) */
  const formsOf = (pet) => EVOLVE.filter((d) => (pet.fed || 0) >= d).length - 1;
  const shownForm = (pet) => Math.max(0, Math.min(formsOf(pet), pet.show == null ? formsOf(pet) : pet.show));
  /* what it wants today: 'food' or 'water' (one or the other each day), or null once fed */
  function need(pet, day) {
    if (pet.fd === day) return null;
    return FF.hash(pet.id + '|' + day) % 2 ? 'food' : 'water';
  }
  /* feed it (once a day). Returns the form it just unlocked (1 or 2), 0 if none, or -1 if it wasn't hungry */
  function feed(pet, day, extra) {
    if (!extra && pet.fd === day) return -1;
    const before = formsOf(pet);
    pet.fed = (pet.fed || 0) + 1;
    if (!extra) pet.fd = day;
    const after = formsOf(pet);
    if (after > before && (pet.show == null || pet.show === before)) pet.show = after; // show the new form (they can switch back)
    return after > before ? after : 0;
  }
  const nextAt = (pet) => { const f = formsOf(pet); return f < EVOLVE.length - 1 ? EVOLVE[f + 1] : null; };
  const petValue = (pet) => Math.round(PET_SELL[tierIx(pet.r)] * FORM_SELL[formsOf(pet)]);

  /* =========================================================
     PLANTS
     ========================================================= */
  function sow(seedId, r) {
    const tier = rollTier(ITEMS[seedId].odds, r || Math.random);
    const kinds = ofTier(PLANTS, tier);
    return { sp: kinds[Math.floor((r || Math.random)() * kinds.length)], r: tier };
  }
  /* 0 seed · 1 sprout · 2 leaves · 3 bud · 4 bloom */
  const stage = (pl) => GROW.filter((d) => (pl.w || 0) >= d).length;
  const bloomed = (pl) => stage(pl) >= 4;
  const thirsty = (pl, day) => !bloomed(pl) && pl.wd !== day;
  /* water it (once a day; a tonic counts as an extra day). Returns the stage reached, or -1 if already watered */
  function water(pl, day, extra) {
    if (bloomed(pl)) return -1;
    if (!extra && pl.wd === day) return -1;
    pl.w = (pl.w || 0) + 1;
    if (!extra) pl.wd = day;
    if (bloomed(pl) && pl.bloom == null) pl.bloom = day;
    return stage(pl);
  }
  const daysToBloom = (pl) => Math.max(0, GROW[GROW.length - 1] - (pl.w || 0));
  function plantValue(pl, day) {
    if (!bloomed(pl)) return UNRIPE_SELL;
    const age = Math.max(0, Math.min(AGE_FULL, day - (pl.bloom == null ? day : pl.bloom)));
    return Math.round(PLANT_SELL[tierIx(pl.r)] * (1 + age / AGE_FULL));
  }

  /* =========================================================
     THE MOLOTOV — on fire for a day (just a look)
     ========================================================= */
  const burning = (burn, now) => !!(burn && burn.t && now - (burn.at || 0) < BURN_MS);

  /* =========================================================
     FISHING
     ========================================================= */
  /* where the green zone sits for this cast (centre 0.25…0.75 of the bar) */
  const zoneOf = (memberId, day, n) => 0.25 + seeded('fish|' + memberId + '|' + day + '|' + n)() * 0.5;
  /* the needle's place on the bar (0…1) after ms: it sweeps right, then left, then right… */
  function needleAt(ms) {
    const t = (Math.max(0, ms) / SWEEP_MS) % 2;
    return t <= 1 ? t : 2 - t;
  }
  const judge = (pos, centre) => { const d = Math.abs(pos - centre); return d <= PERFECT ? 'perfect' : d <= GOOD ? 'good' : 'miss'; };
  function catchFish(grade, r) {
    if (grade === 'miss') return null;
    r = r || Math.random;
    const tier = rollTier(FISH_ODDS[grade], r);
    const kinds = ofTier(FISH, tier);
    const sp = kinds[Math.floor(r() * kinds.length)];
    return { sp, r: tier, gems: FISH_GEMS[tierIx(tier)] + (grade === 'perfect' ? PERFECT_BONUS : 0) };
  }
  function fishDay(p, day) {
    if (!p.fish || p.fish.day !== day) p.fish = { day, casts: 0, book: (p.fish && p.fish.book) || {} };
    if (!p.fish.book) p.fish.book = {};
    return p.fish;
  }
  const castsLeft = (p, day) => CASTS - (p.fish && p.fish.day === day ? p.fish.casts : 0);

  FF.lucky = {
    TIERS, ITEMS, STALLS, PETS, MAX_PETS, PET_SPOTS, EVOLVE, FORM_SCALE, PET_SELL, FORM_SELL, PLANTS, MAX_PLANTS, GROW, PLANT_SELL, UNRIPE_SELL, AGE_FULL,
    BURN_MS, CASTS, SWEEP_MS, GOOD, PERFECT, FISH, FISH_ODDS, FISH_GEMS, PERFECT_BONUS,
    rollTier, stock, today, leftToday, hatch, formsOf, shownForm, need, feed, nextAt, petValue,
    sow, stage, bloomed, thirsty, water, daysToBloom, plantValue, burning, zoneOf, needleAt, judge, catchFish, fishDay, castsLeft
  };
})(typeof window !== 'undefined' ? window : this);
