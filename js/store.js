/* ============================================================
   FamFi — store.js
   App state, persistence (localStorage, local-first), demo
   families, and every user action. Actions are optimistic:
   they update state instantly and emit 'change'.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const C = () => FF.calc;
  const L = () => FF.ledger;
  const G = () => FF.grid;
  const NS = root.FAMFI_NS || ''; // dev only: several test phones in one browser
  const KEY = 'famfi.v1' + NS;
  const DEVICE_KEY = 'famfi.device' + NS;
  const r2 = FF.round2;

  let state = null;
  let memoryOnly = false;

  // uid: the Firebase account this phone is signed in to (null = demo / not signed up yet)
  const blank = () => ({ v: 1, meId: null, uid: null, family: null, members: {}, seen: {}, sync: {} });
  const DEFAULT_BASE = 'MYR'; // FamFi families are in Malaysia: money shows in ringgit unless changed
  const DEFAULT_PREFS = { lang: 'en', theme: 'system', motion: 'system', text: 'default', sound: true, haptics: true, gain: 'green' };

  /* ---------------- persistence ---------------- */
  function load() {
    if (memoryOnly) return;
    try { state = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch (e) { state = blank(); }
    if (!state || state.v !== 1) state = blank();
    Object.keys(state.members || {}).forEach((id) => learnAssets(state.members[id].pf));
    if (state.meId && state.members[state.meId]) upgradeMember(state.members[state.meId]);
    migrate();
    if (tidyLayout().length) persist();
    // tips already seen live with the person, not the family (families are shared now)
    state.seen = state.seen || (state.family && state.family.seen) || {};
    if (state.family) state.family.seen = state.seen;
  }
  /* FamFi now covers US stocks, US ETFs and crypto only. Older saved data may hold
     assets that left the catalogue: the demo family is simply re-created; for real
     users those records are set aside so nothing breaks. */
  function migrate() {
    if (!state || !state.members) return;
    const gone = (t) => t.sym && !FF.data.asset(t.sym);
    const ids = Object.keys(state.members);
    if (!ids.some((id) => state.members[id].pf.txns.some(gone))) return;
    if (state.family && state.family.demo && state.meId === 'm_me') {
      const lang = (state.members.m_me.prefs || {}).lang || 'en';
      seedDemo(lang);
    } else {
      ids.forEach((id) => {
        const pf = state.members[id].pf;
        pf.retired = (pf.retired || []).concat(pf.txns.filter(gone));
        pf.txns = pf.txns.filter((t) => !gone(t));
      });
    }
    save();
  }
  /* older saved data → today's shape (budgets as records + budgets list) */
  function upgradeMember(m) {
    if (!m || !m.pf) return;
    L().upgradeBudget(m);
    if (!Array.isArray(m.budgets)) m.budgets = [];
    if (!m.pf.v) m.pf.v = 2;
    if (m.house) FF.play.cleanHouse(m.house, m.play || FF.play.fresh());
  }
  /* stocks added through live search travel with the portfolio that holds them */
  function learnAssets(pf) {
    if (!pf || !pf.assets) return;
    let added = false;
    Object.keys(pf.assets).forEach((sym) => { if (!FF.data.asset(sym) && FF.data.addAsset(pf.assets[sym])) added = true; });
    if (added && FF.market && FF.market.applyCached) FF.market.applyCached();
  }
  function rememberAsset(pf, sym) {
    const a = sym && FF.data.asset(sym);
    if (!a || !a.custom) return;
    pf.assets = pf.assets || {};
    if (!pf.assets[sym]) pf.assets[sym] = FF.data.assetDef(a);
  }
  function persist() {
    if (memoryOnly) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full / private mode */ }
  }
  function save() {
    if (memoryOnly) return;
    persist();
    FF.emit('saved'); // the cloud layer sends what changed
  }
  /* 'none' · 'demo' (sample family, this phone only) · 'cloud' (signed-in account)
     · 'legacy' (made before accounts existed: kept on this phone until they sign up) */
  function mode() {
    if (!state || !state.meId || !state.members[state.meId]) return 'none';
    if (state.uid) return 'cloud';
    if (state.meId === 'm_me' && state.family && state.family.demo) return 'demo';
    return 'legacy';
  }
  function commit(reason, data) { save(); FF.emit('change', { reason, data }); }
  function device() { try { return JSON.parse(localStorage.getItem(DEVICE_KEY)) || {}; } catch (e) { return {}; } }
  function setDevice(patch) { if (memoryOnly) return; try { localStorage.setItem(DEVICE_KEY, JSON.stringify(Object.assign(device(), patch))); } catch (e) { /* ignore */ } }

  /* snapshot undo for your own records — used by toasts ("Undo"). Only your own data is
     put back: the family (and everyone else in it) may have changed since. */
  function snapshot() { return JSON.stringify(me()); }
  function restore(snap, reason) {
    const m = JSON.parse(snap);
    if (!m || !state || m.id !== state.meId) return;
    state.members[m.id] = m;
    commit(reason || 'undo');
  }

  /* ---------------- accessors ---------------- */
  const me = () => (state && state.meId ? state.members[state.meId] : null);
  const member = (id) => (state ? state.members[id] : null);
  const family = () => (state ? state.family : null);
  const familyMembers = () => (state && state.family ? state.family.members.map((id) => state.members[id]).filter(Boolean) : (me() ? [me()] : []));
  const prefs = () => Object.assign({}, DEFAULT_PREFS, { lang: device().lang || DEFAULT_PREFS.lang }, me() ? me().prefs : {});

  /* ---------------- privacy ---------------- */
  const SECTIONS = ['netWorth', 'holdings', 'returns', 'dividends'];
  function canSee(viewerId, ownerId, section) {
    if (viewerId === ownerId) return true;
    const o = member(ownerId);
    if (o && o._noMoney && viewerId === state.meId) return false; // their numbers never reached this phone
    if (o && helpOf(o) && state.family && state.family.members.indexOf(viewerId) !== -1) return true; // they let their family help: nothing is hidden from it
    const p = o && o.privacy && o.privacy[section];
    if (!p || p.mode === 'family') return true;
    if (p.mode === 'some') return (p.who || []).indexOf(viewerId) !== -1;
    return false;
  }

  /* =========================================================
     DEMO FAMILIES (user content is seeded in the chosen language
     and is never auto-translated afterwards)
     ========================================================= */
  const REGION_OF = (lang) => (lang === 'th' ? 'th' : 'my');
  const SEED_TEXT = {
    en: {
      family: 'The Tan Family', code: 'TAN-4K7Q',
      names: { me: 'Jamie', mum: 'Mum', dad: 'Dad', gran: 'Ah Ma', sis: 'Mei' },
      plates: { me: "Jamie's Den", mum: "Mum's Nest", dad: 'The Workshop', gran: "Ah Ma's Garden", sis: "Mei's Pad" },
      accounts: { a1: 'US brokerage', a3: 'Crypto wallet', w1: 'Cash', w2: 'Maybank', w3: 'Touch ’n Go' },
      goals: ['Save RM 10,000 emergency fund', 'Start investing monthly', 'Pay off the car loan', 'Family trip to Penang', 'Everyone logs spending for 4 weeks'],
      notes: { food: ['Nasi lemak', 'Mamak with friends', 'Lunch', 'Bubble tea'], groceries: ['Tesco', 'Pasar malam', 'Mydin'], transport: ['Petrol', 'Grab', 'Toll'], bills: ['TNB electricity', 'Unifi', 'Water bill'], housing: ['Rent'], fun: ['Cinema', 'Concert'], shopping: ['Shopee', 'Uniqlo'], health: ['Clinic'], family: ['School fees', 'Tuition'], salary: ['Salary'], interest: ['FD interest'] },
      hall: 'Tan Family Hall', hallAccs: ['Family unit trust (ASB)', 'Kampung land, Kedah', 'Family emergency fund']
    },
    zh: {
      family: '陈家', code: 'TAN-4K7Q',
      names: { me: '小杰', mum: '妈妈', dad: '爸爸', gran: '阿嬷', sis: '小美' },
      plates: { me: '小杰的窝', mum: '妈妈小屋', dad: '爸爸工坊', gran: '阿嬷花园', sis: '小美的家' },
      accounts: { a1: '美股账户', a3: '加密钱包', w1: '现金', w2: 'Maybank 储蓄', w3: 'Touch ’n Go' },
      goals: ['存够 RM 10,000 应急金', '开始每月定投', '还清车贷', '全家去槟城旅行', '每人连续 4 周记账'],
      notes: { food: ['椰浆饭', '和朋友吃嘛嘛档', '午餐', '奶茶'], groceries: ['Tesco', '夜市', 'Mydin'], transport: ['油钱', 'Grab', '过路费'], bills: ['电费', 'Unifi 网费', '水费'], housing: ['房租'], fun: ['电影', '演唱会'], shopping: ['Shopee', 'Uniqlo'], health: ['诊所'], family: ['学费', '补习'], salary: ['薪水'], interest: ['定存利息'] },
      hall: '陈家大会堂', hallAccs: ['家庭单位信托 (ASB)', '吉打老家土地', '家庭应急金']
    },
    th: {
      family: 'บ้านสุขสันต์', code: 'SUK-8P2M',
      names: { me: 'ต้นกล้า', mum: 'แม่', dad: 'พ่อ', gran: 'ยาย', sis: 'มิว' },
      plates: { me: 'บ้านต้นกล้า', mum: 'รังของแม่', dad: 'โรงงานพ่อ', gran: 'สวนยาย', sis: 'ห้องมิว' },
      accounts: { a1: 'บัญชีหุ้นสหรัฐฯ', a3: 'กระเป๋าคริปโต', w1: 'เงินสด', w2: 'กสิกรไทย', w3: 'TrueMoney' },
      goals: ['เก็บเงินสำรองฉุกเฉิน ฿100,000', 'เริ่มลงทุนทุกเดือน', 'ผ่อนรถให้หมด', 'เที่ยวเชียงใหม่ทั้งครอบครัว', 'ทุกคนจดรายจ่าย 4 สัปดาห์ติด'],
      notes: { food: ['ข้าวมันไก่', 'ชาบูกับเพื่อน', 'ข้าวกลางวัน', 'ชานม'], groceries: ['Big C', 'ตลาดนัด', 'Lotus’s'], transport: ['น้ำมันรถ', 'Grab', 'BTS'], bills: ['ค่าไฟ', 'ค่าเน็ต', 'ค่าน้ำ'], housing: ['ค่าเช่าบ้าน'], fun: ['ดูหนัง', 'คอนเสิร์ต'], shopping: ['Shopee', 'Uniqlo'], health: ['คลินิก'], family: ['ค่าเทอม', 'เรียนพิเศษ'], salary: ['เงินเดือน'], interest: ['ดอกเบี้ยเงินฝาก'] },
      hall: 'ศาลาครอบครัว', hallAccs: ['กองทุนรวมครอบครัว', 'ที่ดินบ้านเกิด', 'เงินสำรองครอบครัว']
    }
  };
  // goal meta: who ticked it and how many days ago (null = open)
  const GOAL_META = [{ by: 'mum', ago: 205, add: 'mum', addAgo: 270 }, { by: 'me', ago: 240, add: 'me', addAgo: 268 }, { add: 'dad', addAgo: 266 }, { add: 'gran', addAgo: 150 }, { add: 'me', addAgo: 30 }];

  const LOOKS = {
    me: { avatar: { style: 'spiky', skin: '#F1C7A0', hair: '#2B2320', bg: '#CFEBC9', shirt: '#2F8F46' }, house: { roof: 'gable', roofColor: '#3D7FD1', wall: 'wood', wallColor: '#FFF1D6', door: 'arch', doorColor: '#2F7D4A', flag: { on: true, color: '#FFC23D', emblem: 'star' }, decor: ['flowers', 'mailbox', 'lantern'] }, pos: [372, 690] },
    mum: { avatar: { style: 'long', skin: '#F4CDAA', hair: '#3A2A22', bg: '#FFD9E2', shirt: '#E66FA0' }, house: { roof: 'gable', roofColor: '#E0563F', wall: 'plaster', wallColor: '#FFD9BE', door: 'round', doorColor: '#E3A520', flag: { on: true, color: '#E66FA0', emblem: 'heart' }, decor: ['flowers', 'fence', 'bench'] }, pos: [600, 650] },
    dad: { avatar: { style: 'short', skin: '#E9B98F', hair: '#1F1A17', bg: '#CFE6FB', shirt: '#3D7FD1', glasses: true }, house: { roof: 'hip', roofColor: '#5D6B7E', wall: 'brick', wallColor: '#EED9B4', door: 'square', doorColor: '#8A5A30', flag: { on: true, color: '#3E9B55', emblem: 'leaf' }, decor: ['fence', 'bush', 'fountain', 'mailbox'] }, pos: [690, 905] },
    gran: { avatar: { style: 'bun', skin: '#F0C9A6', hair: '#C9C5C0', bg: '#E8DDFB', shirt: '#8A5BC7', glasses: true }, house: { roof: 'steep', roofColor: '#3E9B55', wall: 'plaster', wallColor: '#FBFBF7', door: 'arch', doorColor: '#C8412F', flag: { on: false, color: '#8A5BC7', emblem: 'flower' }, decor: ['flowers', 'lantern', 'bench', 'bush'] }, pos: [340, 930] },
    sis: { avatar: { style: 'bob', skin: '#F6D2B0', hair: '#4A2E22', bg: '#FFEFB0', shirt: '#2A9D8F' }, house: { roof: 'gable', roofColor: '#E66FA0', wall: 'plaster', wallColor: '#E4D6FA', door: 'round', doorColor: '#2A9D8F', flag: { on: true, color: '#2A9D8F', emblem: 'paw' }, decor: ['flowers', 'mailbox'] }, pos: [470, 1035] }
  };
  const STAND_POS = [505, 820];
  // the demo family shows off the shop: what each has bought and put on their house
  const DEMO_PLAY = {
    me: { pts: 420, streak: 6, best: 15, owned: ['wreath', 'kite', 'bunny', 'nest'], deco: { door: 'wreath', sky: 'kite' }, pets: ['bunny'] },
    mum: { pts: 260, streak: 31, best: 48, owned: ['lanterns', 'birdbath', 'nest', 'shiba', 'bunny'], deco: { door: 'lanterns', yard: 'birdbath', roof: 'nest' }, pets: ['shiba'] },
    dad: { pts: 1310, streak: 3, best: 22, owned: ['vane', 'koi', 'penguin', 'fox'], deco: { roof: 'vane', yard: 'koi' }, pets: ['penguin', 'fox'] },
    gran: { pts: 90, streak: 102, best: 102, owned: ['roofcat', 'luckycat', 'capybara', 'rainbow'], deco: { roof: 'roofcat', door: 'luckycat', sky: 'rainbow' }, pets: ['capybara'] },
    sis: { pts: 140, streak: 2, best: 2, owned: ['balloon', 'redpanda'], deco: { sky: 'balloon' }, pets: ['redpanda'] }
  };
  // seed positions above are in the original village's coordinates (the land has since grown on every side)
  const nearFree = (x, y, occ, id) => G().nearestFree(x + G().SH.x, y + G().SH.y, occ, id);

  /* investment plans — every family invests in the US market (USD brokerage + crypto wallet).
     setupAgo: when they joined  b: things they owned by then [sym, daysAgo, qty, acct]
     dca: monthly buys [sym, qty, acct, everyNMonths]  extra: spare cash left in the brokerage (USD) */
  const US_PLANS = {
    me: { setupAgo: 430, b: [['VOO', 720, 4, 'a1'], ['AAPL', 660, 10, 'a1'], ['NVDA', 560, 28, 'a1'], ['MSFT', 500, 3, 'a1'], ['KO', 450, 30, 'a1'], ['BTC', 470, 0.015, 'a3']], dca: [['VOO', 0.25, 'a1', 1]], extra: 400 },
    mum: { setupAgo: 390, b: [['KO', 1500, 100, 'a1'], ['JNJ', 1300, 25, 'a1'], ['O', 1100, 150, 'a1'], ['PG', 900, 30, 'a1'], ['SCHD', 800, 300, 'a1']], dca: [['SCHD', 10, 'a1', 1]], extra: 3500 },
    dad: { setupAgo: 520, b: [['VOO', 1600, 25, 'a1'], ['VT', 1400, 80, 'a1'], ['BND', 1200, 100, 'a1'], ['JPM', 1300, 20, 'a1'], ['MSFT', 1000, 10, 'a1'], ['GLD', 900, 15, 'a1']], dca: [['VT', 3, 'a1', 1]], extra: 18000 },
    gran: { setupAgo: 300, b: [['KO', 1900, 50, 'a1'], ['JNJ', 1700, 20, 'a1'], ['BND', 1200, 80, 'a1'], ['O', 1000, 60, 'a1']], dca: [], extra: 2000 },
    sis: { setupAgo: 40, b: [['ETH', 200, 0.4, 'a3'], ['VT', 150, 10, 'a1']], dca: [], extra: 200 }
  };
  const PLANS = { my: US_PLANS, th: US_PLANS };
  const REGION_ACCOUNTS = { my: { a1: 'USD', a3: 'USD' }, th: { a1: 'USD', a3: 'USD' } };
  const REGION_BASE = { my: 'MYR', th: 'THB' };

  const roundNice = (v) => (v >= 1000 ? Math.round(v / 50) * 50 : Math.round(v / 10) * 10);

  const ts = (day, hour) => day * FF.DAY_MS + (hour || 9) * 3600000 + Math.floor(Math.random() * 3600000);

  /* ---------- demo everyday money: Wallet-style accounts, pay day, spending, top-ups ---------- */
  const EVERYDAY = { // ringgit a month (the Thai demo uses baht ×8)
    me: { salary: 5200, start: [180, 4200, 90] }, mum: { salary: 7800, start: [300, 12600, 150] },
    dad: { salary: 9600, start: [220, 23800, 60] }, gran: { salary: 0, interest: 160, start: [450, 18500, 0] }, sis: { salary: 2600, start: [90, 1300, 120] }
  };
  const SPEND_PLAN = [['food', 0.13, 'w3'], ['groceries', 0.1, 'w2'], ['transport', 0.06, 'w3'], ['bills', 0.05, 'w2'], ['housing', 0.2, 'w2'],
    ['fun', 0.03, 'w1'], ['shopping', 0.04, 'w2'], ['health', 0.015, 'w1'], ['family', 0.035, 'w2']];
  function seedEveryday(key, region, lang, pf) {
    const plan = EVERYDAY[key], T = SEED_TEXT[lang], k = region === 'th' ? 8 : 1, cur = REGION_BASE[region];
    const t0 = FF.today(), from = t0 - 400;
    const rnd = FF.rng(FF.hash('everyday:' + key + region));
    ['w1', 'w2', 'w3'].forEach((id, i) => { if (plan.start[i] || id !== 'w3') pf.accounts.push({ id, name: T.accounts[id], kind: id === 'w1' ? 'cash' : id === 'w2' ? 'bank' : 'ewallet', cur }); });
    const has = (id) => pf.accounts.some((a) => a.id === id);
    const bal = {};
    const add = (tx) => { tx.id = FF.uid('t'); tx.seed = true; tx.ts = tx.ts || ts(tx.day, 12); pf.txns.push(tx); };
    const note = (c) => { const n = T.notes[c] || ['']; return n[Math.floor(rnd() * n.length)]; };
    ['w1', 'w2', 'w3'].forEach((id, i) => { if (!has(id)) return; bal[id] = plan.start[i] * k; add({ type: 'adjust', day: from, amt: bal[id], cur, acct: id, note: '', start: true, ts: ts(from, 8) }); });
    for (let d = from + 1; d <= t0; d++) {
      const p = FF.ymd(d);
      if (p.d === 25 && plan.salary) { add({ type: 'income', day: d, amt: plan.salary * k, cur, acct: 'w2', cat: 'salary', note: note('salary'), ts: ts(d, 9) }); bal.w2 += plan.salary * k; }
      if (p.d === 1 && plan.interest) { add({ type: 'income', day: d, amt: plan.interest * k, cur, acct: 'w2', cat: 'interest', note: note('interest'), ts: ts(d, 9) }); bal.w2 += plan.interest * k; }
      if (p.wd === 1 && has('w3') && bal.w3 < 80 * k && bal.w2 > 400 * k) { add({ type: 'transfer', day: d, amt: 100 * k, cur, acct: 'w2', to: 'w3', ts: ts(d, 10) }); bal.w2 -= 100 * k; bal.w3 += 100 * k; } // weekly e-wallet top-up
      if (p.d === 27 && bal.w2 > 600 * k) { add({ type: 'transfer', day: d, amt: 300 * k, cur, acct: 'w2', to: 'w1', ts: ts(d, 10) }); bal.w2 -= 300 * k; bal.w1 += 300 * k; }
      const income = (plan.salary || 2000) * k;
      SPEND_PLAN.forEach((sp) => {
        const monthly = sp[0] === 'housing' || sp[0] === 'bills' || sp[0] === 'family';
        const go = monthly ? p.d === (sp[0] === 'housing' ? 1 : sp[0] === 'bills' ? 6 : 10) : rnd() < (sp[0] === 'food' ? 0.55 : sp[0] === 'transport' ? 0.3 : 0.12);
        if (!go) return;
        const per = monthly ? income * sp[1] : (income * sp[1]) / (sp[0] === 'food' ? 16 : sp[0] === 'transport' ? 9 : 3.5);
        const amt = r2(per * (0.7 + rnd() * 0.6));
        // pay from the usual place, or whatever has enough (like real life)
        const acct = [sp[2], 'w1', 'w2'].find((id) => has(id) && bal[id] - amt >= 20 * k);
        if (!(amt > 0) || !acct) return;
        bal[acct] -= amt;
        add({ type: 'expense', day: d, amt, cur, acct, cat: sp[0], note: note(sp[0]), ts: ts(d, 18) });
      });
    }
  }
  function seedBudgets(key, region) {
    if (key !== 'me' && key !== 'mum') return [];
    const k = region === 'th' ? 8 : 1, cur = REGION_BASE[region], income = EVERYDAY[key].salary * k;
    return [
      { id: 'b_all', name: '', amt: roundNice(income * 0.75), cur, period: 'month', cats: [], ts: 1 },
      { id: 'b_food', name: '', amt: roundNice(income * 0.15), cur, period: 'month', cats: ['food'], ts: 2 },
      { id: 'b_groc', name: '', amt: roundNice(income * 0.12), cur, period: 'month', cats: ['groceries'], ts: 3 },
      { id: 'b_fun', name: '', amt: roundNice(income * 0.03), cur, period: 'month', cats: ['fun', 'shopping'], ts: 4 }
    ];
  }
  const priceOn = (sym, day) => FF.data.price(sym, day);

  function seedPortfolio(key, region, lang, opts) {
    const plan = PLANS[region][key];
    const t0 = FF.today();
    const base = REGION_BASE[region];
    const names = SEED_TEXT[lang].accounts;
    const pf = {
      base,
      accounts: ['a1', 'a3'].map((id) => ({ id, name: names[id], kind: id === 'a3' ? 'crypto' : 'broker', cur: REGION_ACCOUNTS[region][id] })),
      txns: []
    };
    const setupDay = t0 - plan.setupAgo;
    const add = (tx) => { tx.id = FF.uid('t'); tx.seed = true; pf.txns.push(tx); return tx; };
    // 1) things they already owned when they joined (added that day, with the date and price they paid)
    plan.b.forEach((b) => {
      const a = FF.data.asset(b[0]);
      add({ type: 'buy', day: t0 - b[1], sym: b[0], q: b[2], p: priceOn(b[0], t0 - b[1]), fee: 0, cur: a.c, acct: b[3], ts: ts(setupDay) });
    });
    // 2) spare cash sitting in the brokerage
    if (plan.extra) add({ type: 'deposit', day: setupDay + 1, amt: plan.extra, cur: REGION_ACCOUNTS[region].a1, acct: 'a1', ts: ts(setupDay + 1) });
    // 3) monthly habit since then
    let ym = FF.ymd(setupDay);
    let k = 0;
    for (;;) {
      ym = FF.addMonths(ym.y, ym.m, 1);
      const d3 = FF.fromYMD(ym.y, ym.m, 3);
      if (d3 > t0) break;
      k++;
      plan.dca.forEach((dc) => {
        if (k % dc[3] !== 0) return;
        const a = FF.data.asset(dc[0]);
        add({ type: 'buy', day: d3, sym: dc[0], q: dc[1], p: priceOn(dc[0], d3), fee: 0, cur: a.c, acct: dc[2], ts: ts(d3) });
      });
    }
    // 4) dividends since they joined (the newest ones are left to "harvest" for me)
    const keepFor = opts && opts.harvest ? 31 : -1;
    C().projected(pf, base, setupDay + 1, t0).forEach((p) => {
      if (t0 - p.day <= keepFor) return;
      const acct = (pf.txns.find((t) => t.sym === p.sym) || {}).acct || 'a1';
      add({ type: 'dividend', day: p.day, sym: p.sym, amt: p.amt, cur: p.cur, acct, ref: p.ref, ts: ts(p.day + 1, 20) });
    });
    return pf;
  }

  function seedMember(key, lang, region) {
    const L = LOOKS[key];
    const T = SEED_TEXT[lang];
    const id = 'm_' + key;
    const t0 = FF.today();
    const m = {
      id, key, name: T.names[key], email: key === 'me' ? 'jamie@example.com' : '',
      role: key === 'mum' ? 'owner' : 'member', joined: t0 - (key === 'sis' ? 0 : (PLANS[region][key].setupAgo + 5)),
      avatar: Object.assign({ kind: 'illus' }, L.avatar),
      house: Object.assign({ plate: T.plates[key] }, JSON.parse(JSON.stringify(L.house))),
      privacy: { netWorth: { mode: 'family', who: [] }, holdings: { mode: 'family', who: [] }, returns: { mode: 'family', who: [] }, dividends: { mode: 'family', who: [] } },
      prefs: Object.assign({}, DEFAULT_PREFS, { lang }),
      pf: seedPortfolio(key, region, lang, {}),
      budgets: seedBudgets(key, region),
      badges: {}
    };
    seedEveryday(key, region, lang, m.pf);
    const dp = DEMO_PLAY[key];
    const owned = {};
    dp.owned.forEach((id, k) => { owned[id] = t0 - 40 + k * 7; });
    const got = { welcome: 1 };
    FF.play.BADGES.forEach((b) => { got['badge:' + b.k] = 1; }); // demo gems stay as shown
    const BB = { me: 8420, mum: 12880, dad: 5210, gran: 15640, sis: 3300 }[key];
    m.bb = { best: BB, at: t0 - 3, wk: FF.weekOf(t0), wkBest: Math.round(BB * 0.62), games: 12 + (BB % 17) };
    m.play = Object.assign(FF.play.fresh(), { pts: dp.pts, earned: dp.pts + 2400, day: t0 - 1, streak: dp.streak, best: dp.best, shields: key === 'mum' ? 1 : 0, owned, got });
    m.house.deco = Object.assign({}, dp.deco);
    m.house.pets = dp.pets.slice();
    if (key === 'gran') m.privacy.netWorth = { mode: 'me', who: [] };
    if (key === 'dad') m.privacy.holdings = { mode: 'some', who: ['m_mum'] };
    return m;
  }

  function seedDemo(lang, opts) {
    opts = opts || {};
    lang = SEED_TEXT[lang] ? lang : 'en';
    const region = REGION_OF(lang);
    const T = SEED_TEXT[lang];
    const t0 = FF.today();
    const keys = ['me', 'mum', 'dad', 'gran'];
    state = blank();
    keys.forEach((k) => { state.members['m_' + k] = seedMember(k, lang, region); });
    state.meId = 'm_me';
    const goals = opts.noGoals ? [] : T.goals.map((text, k) => {
      const g = GOAL_META[k];
      return { id: 'g' + k, text, by: 'm_' + g.add, at: t0 - g.addAgo, done: g.by ? { by: 'm_' + g.by, day: t0 - g.ago } : null };
    });
    state.family = {
      id: 'f_demo', name: T.family, code: T.code, ownerId: 'm_mum', created: t0 - 560, demo: true,
      members: keys.map((k) => 'm_' + k), goals, layout: {}, pets: {}, invites: [], seen: state.seen
    };
    // place houses + goals stand
    const occ = [];
    const st = nearFree(STAND_POS[0], STAND_POS[1], occ, '_stand');
    state.family.layout._stand = st; occ.push({ id: '_stand', i: st.i, j: st.j });
    keys.forEach((k) => {
      const p = nearFree(LOOKS[k].pos[0], LOOKS[k].pos[1], occ, 'm_' + k);
      state.family.layout['m_' + k] = p; occ.push({ id: 'm_' + k, i: p.i, j: p.j });
    });
    if (!opts.noHall) {
      const k = region === 'th' ? 8 : 1, cur = REGION_BASE[region];
      const e = (id, tt, amt, ago, by) => { const o = {}; o[id] = { t: tt, amt: amt * k, day: t0 - ago, by: 'm_' + by, ts: (t0 - ago) * FF.DAY_MS }; return o; };
      state.family.hall = { name: T.hall, by: 'm_mum', at: t0 - 210, accounts: {
        h1: { name: T.hallAccs[0], kind: 'fund', cur, by: 'm_dad', at: t0 - 200, entries: Object.assign(e('e1', 'set', 38000, 200, 'dad'), e('e2', 'add', 2000, 120, 'mum'), e('e3', 'set', 46500, 18, 'dad')) },
        h2: { name: T.hallAccs[1], kind: 'property', cur, by: 'm_gran', at: t0 - 190, entries: e('e1', 'set', 120000, 190, 'gran') },
        h3: { name: T.hallAccs[2], kind: 'savings', cur, by: 'm_mum', at: t0 - 180, entries: Object.assign(e('e1', 'set', 6000, 180, 'mum'), e('e2', 'add', 500, 90, 'me'), e('e3', 'add', 500, 30, 'mum')) }
      } };
      const hp = hallSpot(occ);
      state.family.layout._hall = hp; occ.push({ id: '_hall', i: hp.i, j: hp.j });
    }
    ensureArcade();
    ensureLucky();
    ensureNews();
    ensureSage();
    seedYards(t0);
    // everything earned so far happened in the past: no celebrations on first open
    keys.forEach((k) => evaluateBadges('m_' + k, true));
    evaluatePets(true);
    if (opts.lockPig === false) { /* keep */ }
    return state;
  }

  /* Demo families may be created before real price history has arrived. Once it has,
     re-price the seeded purchases to the real close of their day (demo data only —
     anything a person typed is never touched). */
  function repriceDemo() {
    if (!state || !state.family || !state.family.demo) return false;
    let any = false;
    Object.keys(state.members).forEach((id) => {
      const pf = state.members[id].pf;
      let changed = false;
      pf.txns.forEach((t) => {
        if (!t.seed || (t.type !== 'buy' && t.type !== 'sell')) return;
        const L = FF.data.liveInfo(t.sym);
        if (!L || !L.c || t.day < L.d0) return;
        const p = FF.data.price(t.sym, t.day);
        if (p > 0 && Math.abs(p - t.p) > 1e-9) { t.p = p; changed = true; }
      });
      if (changed) any = true;
    });
    if (any) save();
    return any;
  }

  /* =========================================================
     ACCOUNTS & FAMILY
     ========================================================= */
  function newPortfolio(base) {
    return { v: 2, base, accounts: [{ id: 'a1', name: '', nameKey: 'seed.mainAccount', kind: 'cash', cur: base }], txns: [] };
  }
  const emptyPf = (base) => ({ base: base || 'MYR', accounts: [], txns: [] });
  const PRIVACY0 = () => ({ netWorth: { mode: 'family', who: [] }, holdings: { mode: 'family', who: [] }, returns: { mode: 'family', who: [] }, dividends: { mode: 'family', who: [] } });
  /* uid: the new Firebase account (none for local-only shots). opts.legacy: carry over the
     records someone made on this phone before accounts existed. */
  function createAccount(profile, uid, opts) {
    const lang = prefs().lang;
    const old = opts && opts.legacy && mode() === 'legacy' ? JSON.parse(JSON.stringify(me())) : null;
    const seen = old && state.seen;
    state = blank();
    const id = uid || FF.uid('m');
    const base = DEFAULT_BASE; // whatever the language — changeable in Manage → Currency
    const m = state.members[id] = {
      id, key: 'custom', name: profile.name, email: profile.email || '', role: 'owner', joined: FF.today(),
      avatar: profile.avatar, house: Object.assign({ plate: profile.name }, JSON.parse(JSON.stringify(LOOKS.me.house)), { flag: { on: true, color: '#FFC23D', emblem: 'star' } }),
      privacy: PRIVACY0(), prefs: Object.assign({}, DEFAULT_PREFS, { lang }), pf: newPortfolio(base), budgets: [], badges: {}
    };
    if (old) {
      Object.assign(m, { pf: old.pf, budget: old.budget, budgets: old.budgets, house: old.house || m.house, badges: old.badges || {}, play: old.play, prefs: Object.assign({}, m.prefs, old.prefs, { lang }) });
      upgradeMember(m);
      // "only these people" lists pointed at people on this phone only
      SECTIONS.forEach((k) => { const p = old.privacy && old.privacy[k]; m.privacy[k] = p && p.mode === 'me' ? { mode: 'me', who: [] } : { mode: 'family', who: [] }; });
      state.seen = seen || {};
    }
    state.meId = id;
    state.uid = uid || null;
    commit('account');
    return id;
  }
  /* a signed-in account, from its cloud documents (no family yet — the cloud layer fills that in) */
  function loadAccount(uid, d, email) {
    const lang = prefs().lang;
    // records made on this phone before accounts existed are kept aside, never just dropped
    if (mode() === 'legacy' && !memoryOnly) { try { localStorage.setItem(KEY + '.backup', JSON.stringify(state)); } catch (e) { /* ignore */ } }
    state = blank();
    state.uid = uid; state.meId = uid;
    const pub = d.pub || {}, pv = d.priv || {};
    state.members[uid] = {
      id: uid, key: 'custom', name: pub.name || '', email: pv.email || email || '', role: 'member', joined: pub.joined || FF.today(),
      avatar: pub.avatar, house: pub.house, privacy: pub.privacy || PRIVACY0(), badges: pub.badges || {},
      // your full records travel privately (priv); the shared copy (money) is only a summary
      prefs: Object.assign({}, DEFAULT_PREFS, { lang }, pv.prefs), pf: pv.pf || (d.money && !d.money.pf.share && d.money.pf) || newPortfolio(DEFAULT_BASE),
      budgets: pv.budgets, budget: pv.budget,
      // everything else the profile carries (before 2.23 these were left behind, so a new device
      // started with no pets, plants, Block Blast scores or gems — and its first save wiped them
      // for every phone): the yard and the arcade (shared), gems, streak and bag (private)
      yard: pub.yard || null, bb: pub.bb || null, play: pv.play || null,
      helpSet: pv.help // their own choice about family help (none yet: the default)
    };
    upgradeMember(state.members[uid]);
    learnAssets(state.members[uid].pf);
    state.seen = pv.seen || {};
    persist();
  }
  /* invite codes: 3 letters from the family name + 5 random (28.6 million per prefix) */
  const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function makeCode(name) {
    const letters = (String(name || '').toUpperCase().replace(/[^A-Z]/g, '').replace(/^THE(?=[A-Z]{3})/, '') + 'FAM').slice(0, 3);
    let s = '';
    const rnd = new Uint32Array(5);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(rnd); else for (let k = 0; k < 5; k++) rnd[k] = Math.floor(Math.random() * 4294967296);
    for (let k = 0; k < 5; k++) s += CODE_ABC[rnd[k] % CODE_ABC.length];
    return letters + '-' + s;
  }
  /* what someone typed → ABC-12345 (null if it can't be a code) */
  function normalizeCode(v) {
    const c = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c.length === 8 ? c.slice(0, 3) + '-' + c.slice(3) : null;
  }
  function createFamily(name, o) {
    o = o || {};
    const m = me();
    const pos = nearFree(LOOKS.me.pos[0] + 60, LOOKS.me.pos[1] + 30, [], m.id);
    const occ = [{ id: m.id, i: pos.i, j: pos.j }];
    const st = nearFree(STAND_POS[0], STAND_POS[1], occ, '_stand');
    state.family = { id: o.id || FF.uid('f'), name, code: o.code || makeCode(name), ownerId: m.id, created: FF.today(), members: [m.id], goals: [], layout: { _stand: { i: st.i, j: st.j } }, pets: {}, invites: [], seen: state.seen || (state.seen = {}) };
    state.family.layout[m.id] = pos;
    ensureArcade();
    ensureLucky();
    ensureNews();
    ensureSage();
    m.role = 'owner';
    evaluatePets(true);
    commit('family');
  }
  /* just moved into a family the cloud loaded: put my house next to the newest neighbour */
  function placeMe() {
    const id = state.meId;
    if (!state.family.layout[id]) placeNewMember(id);
    me().role = state.family.ownerId === id ? 'owner' : 'member';
    const pets = evaluatePets();
    const badges = evaluateBadges(id);
    commit('joined', { id, pets, badges });
    return { pets, badges };
  }
  function occupied() {
    const L = state.family.layout;
    const plants = plantIndex();
    return Object.keys(L).filter((id) => id.indexOf('pl_') !== 0 || plants[id]).map((id) => ({ id, i: L[id].i, j: L[id].j }));
  }
  /* the demo family's pets and plants (and Dad's little joke on Mum's house) */
  function seedYards(t0) {
    const D = {
      me: { pets: [['hamster', 'common', 16, 1], ['otter', 'rare', 4, 0]], plants: [['sunflower', 'common', 11, 5], ['tulip', 'common', 4, null]] },
      mum: { pets: [['kitsune', 'epic', 33, 2]], plants: [['bonsai', 'epic', 14, 9]] },
      dad: { pets: [['frog', 'common', 3, 0]], plants: [['rose', 'rare', 9, 2]], burn: 'm_mum' },
      gran: { pets: [['phoenix', 'legendary', 31, 2], ['chick', 'common', 13, 1]], plants: [['moneytree', 'legendary', 9, 40], ['lavender', 'rare', 9, 6]] }
    };
    Object.keys(D).forEach((k) => {
      const m = state.members['m_' + k]; if (!m) return;
      const d = D[k];
      m.yard = {
        pets: d.pets.map((x, n) => ({ id: 'q_demo_' + k + n, sp: x[0], r: x[1], at: t0 - x[2] - 2, fed: x[2], fd: n === 0 && k === 'me' ? null : t0, show: x[3] })),
        plants: d.plants.map((x, n) => { const w = x[2]; return { id: 'g_demo_' + k + n, sp: x[0], r: x[1], at: t0 - w - 3, w, wd: w >= 9 ? t0 - 2 : (n === 1 && k === 'me' ? t0 - 1 : t0), bloom: w >= 9 ? t0 - (x[3] || 0) : null }; }),
        burn: d.burn ? { t: d.burn, at: Date.now() - 3 * 3600 * 1000 } : null
      };
      m.yard.plants.forEach((pl) => { state.family.layout['pl_' + pl.id] = plantSpot(m.id, 'pl_' + pl.id); });
    });
    const p = state.members.m_me && state.members.m_me.play;
    if (p) p.bag = { molotov: 1, tonic: 1, treat: 1 };
  }
  function placeNewMember(id) {
    // next to the most recent neighbour
    const L = state.family.layout;
    const others = state.family.members.filter((x) => x !== id && L[x]);
    const ref = others.length ? G().center(L[others[others.length - 1]].i, L[others[others.length - 1]].j) : { x: 470 + G().SH.x, y: 760 + G().SH.y };
    const p = G().nearestFree(ref.x + 40, ref.y + 60, occupied(), id);
    L[id] = { i: p.i, j: p.j };
    if (state.family.members.indexOf(id) === -1) state.family.members.push(id);
  }
  /* demo: preview what happens when someone accepts your invite */
  function simulateJoin() {
    const lang = prefs().lang;
    const region = REGION_OF(lang);
    let key = 'sis';
    if (state.members.m_sis) { // already here: add a cousin with a fresh look
      key = 'sis';
    }
    const m = seedMember(key, SEED_TEXT[lang] ? lang : 'en', region);
    if (state.members[m.id]) m.id = FF.uid('m');
    m.joined = FF.today();
    m.pf.base = me().pf.base;
    state.members[m.id] = m;
    placeNewMember(m.id);
    evaluateBadges(m.id, true);
    const pets = evaluatePets();
    evaluateBadges(state.meId);
    commit('joined', { id: m.id, pets });
    FF.emit('member-joined', { id: m.id, pets });
    return m.id;
  }
  function renameFamily(name) { state.family.name = name; commit('family'); }
  function updateProfile(patch) { Object.assign(me(), patch); commit('profile'); }

  /* =========================================================
     PORTFOLIO ACTIONS
     ========================================================= */
  function addTxn(tx) {
    const m = me();
    tx.id = FF.uid('t');
    tx.ts = Date.now();
    if (tx.type === 'buy' || tx.type === 'sell') { tx.q = +tx.q; tx.p = +tx.p; tx.fee = +(tx.fee || 0); }
    if (tx.amt != null) tx.amt = r2(+tx.amt);
    if (tx.toAmt != null) tx.toAmt = r2(+tx.toAmt);
    rememberAsset(m.pf, tx.sym);
    m.pf.txns.push(tx);
    const gems = FF.play.logReward(playOf(m), dayNow());
    const fresh = evaluateBadges(m.id);
    commit('txn', { tx, badges: fresh, gems });
    if (gems) FF.emit('gems', { n: gems, k: 'log' });
    return { tx, badges: fresh, gems };
  }
  /* change a record (amount, date, category, note, account …) */
  function updateTxn(id, patch) {
    const m = me();
    const tx = m.pf.txns.find((t) => t.id === id);
    if (!tx) return null;
    Object.assign(tx, patch);
    if (!patch.by) delete tx.by; // changed by its owner: no longer "recorded by Mum"
    ['amt', 'toAmt', 'q', 'p', 'fee'].forEach((k) => { if (tx[k] != null && tx[k] !== '') tx[k] = k === 'q' || k === 'p' ? +tx[k] : r2(+tx[k]); });
    if (tx.auto && patch.amt != null) tx.edited = true; // a dividend you corrected by hand
    rememberAsset(m.pf, tx.sym);
    commit('txn-edited', { tx });
    return tx;
  }
  function deleteTxn(id) {
    const m = me();
    const tx = m.pf.txns.find((t) => t.id === id);
    if (tx && tx.auto && tx.ref) { m.pf.divSkip = m.pf.divSkip || []; if (m.pf.divSkip.indexOf(tx.ref) === -1) m.pf.divSkip.push(tx.ref); } // never re-added
    m.pf.txns = m.pf.txns.filter((t) => t.id !== id);
    commit('txn-deleted', { tx });
  }
  function collectDividends(list) {
    const m = me();
    list.forEach((p) => {
      const acct = (m.pf.txns.find((t) => t.sym === p.sym && t.acct) || {}).acct || m.pf.accounts[0].id;
      m.pf.txns.push({ id: FF.uid('t'), type: 'dividend', day: p.day, sym: p.sym, amt: p.amt, cur: p.cur, acct, ref: p.ref, ts: Date.now(), harvested: true });
    });
    const fresh = evaluateBadges(m.id);
    const pets = evaluatePets();
    commit('harvest', { badges: fresh, pets });
    return { badges: fresh, pets };
  }
  function addAccount(acc, start) {
    const m = me();
    acc.id = FF.uid('a');
    m.pf.accounts.push(acc);
    if (start && +start) m.pf.txns.push({ id: FF.uid('t'), type: 'adjust', day: FF.today(), amt: r2(+start), cur: acc.cur, acct: acc.id, start: true, ts: Date.now() });
    const badges = evaluateBadges(m.id);
    commit('account-added', { acc, badges });
    if (badges.length) FF.emit('celebrate', { badges });
    return acc;
  }
  /* "the money in it is really X now": one adjustment record makes it so (stocks it holds aren't part of it) */
  function adjustBalance(id, value, note) {
    const m = me();
    const acc = m.pf.accounts.find((a) => a.id === id);
    if (!acc) return null;
    const delta = r2(+value - L().accountCash(m.pf, acc));
    if (FF.isZero(delta)) return null;
    const tx = { id: FF.uid('t'), type: 'adjust', day: FF.today(), amt: delta, cur: acc.cur, acct: id, note: note || '', ts: Date.now() };
    m.pf.txns.push(tx);
    const badges = evaluateBadges(m.id);
    commit('txn', { tx, badges });
    if (badges.length) FF.emit('celebrate', { badges });
    return tx;
  }
  function updateAccount(id, patch) {
    const acc = me().pf.accounts.find((a) => a.id === id);
    if (!acc) return null;
    Object.assign(acc, patch);
    if (patch.name) delete acc.nameKey; // a name they typed replaces the built-in "Main account"
    commit('account-edited');
    return acc;
  }
  const accountRecords = (pf, id) => pf.txns.filter((t) => t.acct === id || (t.parts || []).some((p) => p.acct === id)).length;
  /* delete an account; its records move to `moveTo` so no money or history is lost.
     The last account can't go (every record needs a home). */
  function removeAccount(id, moveTo) {
    const pf = me().pf;
    if (pf.accounts.length < 2 || !pf.accounts.some((a) => a.id === id)) return false;
    const to = pf.accounts.some((a) => a.id === moveTo && a.id !== id) ? moveTo : pf.accounts.find((a) => a.id !== id).id;
    pf.txns.forEach((t) => {
      if (t.acct === id) t.acct = to;
      (t.parts || []).forEach((p) => { if (p.acct === id) p.acct = to; });
    });
    pf.accounts = pf.accounts.filter((a) => a.id !== id);
    commit('account-removed', { id, to });
    return true;
  }
  function setBase(cur) { me().pf.base = cur; commit('base'); }
  function importTxns(list) {
    const m = me();
    list.forEach((tx) => { tx.id = FF.uid('t'); tx.ts = Date.now(); rememberAsset(m.pf, tx.sym); m.pf.txns.push(tx); });
    evaluateBadges(m.id);
    commit('import', { n: list.length });
  }

  /* =========================================================
     BUDGET
     ========================================================= */
  /* { name, amt, cur, period: 'month' | 'week', cats: [] (all spending), accts: [] (all accounts) } */
  function addBudget(b) {
    const m = me();
    const nb = Object.assign({ id: FF.uid('b'), name: '', period: 'month', cats: [], accts: [], cur: m.pf.base, ts: Date.now() }, b, { amt: r2(+b.amt) });
    m.budgets = m.budgets || [];
    m.budgets.push(nb);
    commit('budget', { b: nb });
    return nb;
  }
  function updateBudget(id, patch) {
    const b = (me().budgets || []).find((x) => x.id === id);
    if (!b) return null;
    Object.assign(b, patch);
    if (patch.amt != null) b.amt = r2(+patch.amt);
    commit('budget', { b });
    return b;
  }
  function deleteBudget(id) {
    const m = me();
    const b = (m.budgets || []).find((x) => x.id === id);
    m.budgets = (m.budgets || []).filter((x) => x.id !== id);
    commit('budget-deleted', { b });
    return b;
  }
  function restoreBudget(b) { if (!b) return; const m = me(); m.budgets = (m.budgets || []).filter((x) => x.id !== b.id).concat([b]).sort((x, y) => (x.ts || 0) - (y.ts || 0)); commit('budget', { b }); }

  /* =========================================================
     DIVIDENDS — added automatically, after US tax
     ========================================================= */
  function autoDividends(events) {
    const m = me();
    if (!m || mode() === 'demo' || mode() === 'none') return [];
    const plan = L().dividendPlan(m.pf, events);
    if (!plan.add.length) return [];
    plan.add.forEach((tx) => { tx.id = FF.uid('t'); tx.ts = Date.now(); m.pf.txns.push(tx); });
    const badges = evaluateBadges(m.id);
    const pets = evaluatePets();
    commit('dividends-auto', { added: plan.add, badges, pets });
    return plan.add;
  }
  function setDivTax(rate) { me().pf.divTax = FF.clamp(+rate, 0, 0.5); commit('div-tax'); }

  /* =========================================================
     THE TOWN HALL — family assets everyone can see and update
     ========================================================= */
  /* the most open spot near the plaza (the hall is big; on screen, buildings behind and in
     front overlap long before their tiles touch) */
  function hallSpot(occ) {
    const g = G(), pz = g.PLAZA;
    const others = occ.filter((o) => o.id !== '_hall').map((o) => g.center(o.i, o.j));
    let best = null;
    const R = g.tileRange();
    for (let i = R.i0; i <= R.i1; i += 1) for (let j = R.j0; j <= R.j1; j += 1) {
      const c = g.center(i, j);
      if (Math.abs(c.x - pz.x) > 420 || Math.abs(c.y - pz.y) > 360) continue;
      if (!g.valid(i, j, occ, '_hall')) continue;
      const room = others.reduce((m, o) => Math.min(m, Math.hypot((c.x - o.x) * 0.9, (c.y - o.y) * 1.6)), 1e9);
      const score = Math.min(room, 260) - 0.25 * Math.hypot(c.x - pz.x, c.y - pz.y);
      if (!best || score > best.score) best = { i, j, score };
    }
    return best ? { i: best.i, j: best.j } : g.nearestFree(pz.x + 150, pz.y - 40, occ, '_hall');
  }
  function buildHall(name) {
    const f = state.family;
    if (!f || f.hall) return null;
    f.hall = { name: String(name || '').trim().slice(0, 40), by: state.meId, at: FF.today(), accounts: {} };
    if (!f.layout._hall) f.layout._hall = hallSpot(occupied());
    commit('hall-built', { hall: f.hall });
    return f.hall;
  }
  function renameHall(name) { const h = state.family && state.family.hall; if (!h) return; h.name = String(name).trim().slice(0, 40); commit('hall'); }
  function addHallAccount(o) {
    const h = state.family.hall;
    const id = FF.uid('h');
    h.accounts = h.accounts || {};
    h.accounts[id] = { name: String(o.name).trim().slice(0, 40), kind: o.kind || 'other', cur: o.cur || me().pf.base, by: state.meId, at: FF.today(), entries: {} };
    if (o.value != null && o.value !== '') addHallEntry(id, { t: 'set', amt: +o.value, note: '' }, true);
    commit('hall', { id });
    return id;
  }
  function updateHallAccount(id, patch) { const a = state.family.hall.accounts[id]; if (!a) return; ['name', 'kind', 'cur'].forEach((k) => { if (patch[k] != null) a[k] = k === 'name' ? String(patch[k]).trim().slice(0, 40) : patch[k]; }); commit('hall', { id }); }
  function deleteHallAccount(id) { const h = state.family.hall; const a = h.accounts[id]; delete h.accounts[id]; commit('hall', { id }); return a; }
  function restoreHallAccount(id, a) { if (!a) return; state.family.hall.accounts[id] = a; commit('hall', { id }); }
  function addHallEntry(aid, e, quiet) {
    const a = state.family.hall.accounts[aid];
    if (!a) return null;
    const id = FF.uid('e');
    a.entries = a.entries || {};
    a.entries[id] = { t: e.t === 'add' ? 'add' : 'set', amt: r2(+e.amt), day: e.day || FF.today(), note: String(e.note || '').slice(0, 80), by: state.meId, ts: Date.now() };
    if (!quiet) commit('hall', { id: aid });
    return id;
  }
  function deleteHallEntry(aid, eid) { const a = state.family.hall.accounts[aid]; if (a && a.entries) { delete a.entries[eid]; commit('hall', { id: aid }); } }

  /* =========================================================
     VILLAGE
     ========================================================= */
  function moveObject(id, i, j) { state.family.layout[id] = { i, j }; commit('layout', { id }); }
  /* the Block Blast arcade: every family gets one, on a free spot near the plaza (same spot on every phone) */
  function arcadeSpot(occ) {
    const g = G(), pz = g.PLAZA;
    return g.nearestFree(pz.x - 250, pz.y + 150, occ.filter((o) => o.id !== '_arcade'), '_arcade');
  }
  function ensureArcade() {
    const f = state && state.family;
    if (!f || !f.layout || f.layout._arcade) return false;
    f.layout._arcade = arcadeSpot(occupied());
    return true;
  }
  /* a house (or the stand / hall) somehow left outside the land moves to the nearest free spot
     inside. Same inputs → same answer on every phone, so whoever opens the app first tidies up
     for everyone. Returns the ids moved. */
  function tidyLayout() {
    const f = state && state.family;
    if (!f || !f.layout) return [];
    const g = G(), moved = [];
    if (ensureArcade()) moved.push('_arcade');
    if (ensureLucky()) moved.push('_lucky');
    if (ensureNews()) moved.push('_news');
    if (ensureSage()) moved.push('_sage');
    placeMyPlants().forEach((k) => moved.push(k));
    Object.keys(f.layout).sort().forEach((id) => {
      const p = f.layout[id], c = g.center(p.i, p.j);
      if (g.inLand(c.x, c.y)) return;
      const occ = occupied().filter((o) => o.id !== id);
      let tx = c.x, ty = c.y;
      for (let k = 0; k < 30 && !g.inLand(tx, ty); k++) { tx += (g.LC.x - tx) * 0.12; ty += (g.LC.y - ty) * 0.12; }
      f.layout[id] = g.nearestFree(tx, ty, occ, id);
      moved.push(id);
    });
    return moved;
  }
  function setHouse(memberId, house) { member(memberId).house = house; commit('house', { id: memberId }); }
  function addGoal(text) {
    const g = { id: FF.uid('g'), text: String(text).trim().slice(0, 80), by: state.meId, at: FF.today(), ts: Date.now(), done: null };
    state.family.goals.push(g);
    commit('goal-added', { g });
    return g;
  }
  function toggleGoal(id) {
    const g = state.family.goals.find((x) => x.id === id);
    if (!g) return {};
    g.done = g.done ? null : { by: state.meId, day: FF.today() };
    const fresh = g.done ? evaluateBadges(state.meId) : [];
    const pets = g.done ? evaluatePets() : [];
    commit('goal-toggled', { g, badges: fresh, pets });
    return { g, badges: fresh, pets };
  }
  function deleteGoal(id) {
    const g = state.family.goals.find((x) => x.id === id);
    state.family.goals = state.family.goals.filter((x) => x.id !== id);
    commit('goal-deleted');
    return g;
  }
  function restoreGoal(g) {
    if (!g || !state.family || state.family.goals.some((x) => x.id === g.id)) return;
    state.family.goals.push(g);
    state.family.goals.sort((a, b) => a.at - b.at || (a.ts || 0) - (b.ts || 0));
    commit('goal-added', { g });
  }

  /* ---------- pets: new friends arrive with family progress ---------- */
  const PETS = ['chicken', 'chick', 'puppy', 'cat', 'duck', 'pig'];
  function petRules() {
    const f = state.family;
    const done = f ? f.goals.filter((g) => g.done).length : 0;
    const anyDiv = familyMembers().some((m) => m.pf.txns.some((t) => t.type === 'dividend'));
    return { chicken: true, chick: true, puppy: f && f.members.length >= 2, cat: done >= 1, duck: anyDiv, pig: done >= 3 };
  }
  function evaluatePets(silent) {
    if (!state.family) return [];
    const rules = petRules();
    const fresh = [];
    PETS.forEach((p) => { if (rules[p] && !state.family.pets[p]) { state.family.pets[p] = FF.today(); if (!silent) fresh.push(p); } });
    return fresh;
  }

  /* ---------- badges ---------- */
  const BADGES = FF.play.BADGES.map((b) => b.k);
  function logDays(m) {
    const days = m.pf.txns.filter((t) => !t.auto).map((t) => Math.floor((t.ts || t.day * FF.DAY_MS) / FF.DAY_MS));
    ((m.budget && m.budget.spends) || []).forEach((s) => days.push(Math.floor((s.ts || s.day * FF.DAY_MS) / FF.DAY_MS)));
    return days;
  }
  function evaluateBadges(id, silent) {
    const m = member(id);
    if (!m) return [];
    const mine = id === state.meId;
    const p = mine ? playOf(m) : m.play;
    const b = m.badges || (m.badges = {});
    const fresh = [];
    const give = (k) => {
      if (b[k]) return;
      b[k] = FF.today();
      // gems for your own badges (bronze 25 · silver 100 · gold 300 · diamond 1000)
      if (mine) FF.play.once(p, 'badge:' + k, FF.play.badgeGems(k), 'badge', dayNow(), { b: k });
      if (!silent) fresh.push(k);
    };
    const pf = m.pf;
    if (pf.txns.some((t) => t.type === 'buy')) give('first_holding');
    if (pf.txns.some((t) => t.type === 'adjust' || t.type === 'opening')) give('setup_done'); // an account's real balance is in
    if (pf.txns.some((t) => t.type === 'dividend')) give('first_dividend');
    const s = C().summary(pf, pf.base);
    const types = {};
    s.holdings.forEach((h) => { types[h.a.t] = 1; });
    if (s.count >= 4 && s.holdings[0].weight <= 0.4 && Object.keys(types).length >= 2) give('diversified');
    if (m.budgets && m.budgets.length) {
      const p = FF.ymd(FF.today());
      const prev = FF.addMonths(p.y, p.m, -1);
      if (L().stayedOnBudgets(pf, m.budgets, prev.y, prev.m)) give('on_budget');
    }
    if (C().weekStreak(logDays(m)).weeks >= 4) give('streak_4');
    if (state.family && state.family.goals.some((g) => g.done && g.done.by === id)) give('team_player');
    if (state.family && state.family.members.length >= 2) give('village_builder');
    // ---- the harder ones ----
    if (p) { if (p.best >= 30) give('checkin_30'); if (p.best >= 100) give('checkin_100'); if (p.best >= 365) give('checkin_365'); }
    const logged = {};
    logDays(m).forEach((d) => { logged[d] = 1; });
    const nLogged = Object.keys(logged).length;
    if (nLogged >= 100) give('logger_100');
    if (nLogged >= 365) give('logger_365');
    if (pf.txns.filter((t) => t.type === 'dividend').length >= 12) give('div_12');
    const months = monthsInRow(m);
    if (months.budget >= 3) give('budget_3');
    if (months.budget >= 6) give('budget_6');
    if (months.saverAny) give('saver_20');
    if (months.saver >= 3) give('saver_3');
    if ((!b.house_3 || !b.house_5 || !b.millionaire) && pricesReal(m)) {
      const lv = levelOf(m);
      if (lv >= 3) give('house_3');
      if (lv >= 5) give('house_5');
      if (lv >= 6) give('millionaire');
    }
    const h = m.house || {};
    if (FF.play.SLOTS.every((sl) => h.deco && h.deco[sl])) give('decorator');
    if (p && FF.play.ownedPets(p).length >= 4) give('collector');
    const bb = bbOf(m);
    if (bb.best >= 5000) give('bb_5k');
    if (bb.best >= 20000) give('bb_20k');
    const yd = yardOf(m);
    if (yd.plants.some((pl) => Lk().bloomed(pl))) give('green_thumb');
    if (yd.pets.some((pt) => Lk().formsOf(pt) >= 2)) give('pet_majestic');
    if (p && p.fish && p.fish.book && Object.keys(p.fish.book).reduce((a, k) => a + p.fish.book[k], 0) >= 30) give('angler');
    return fresh;
  }
  /* finished months in a row (ending last month) inside every budget, and saving 20%+ of income */
  function monthsInRow(m) {
    const t = FF.ymd(FF.today());
    const out = { budget: 0, saver: 0, saverAny: false };
    let budgetRun = true, saverRun = true;
    for (let k = 1; k <= 12; k++) {
      const p = FF.addMonths(t.y, t.m, -k);
      if (budgetRun && k <= 6) { if (m.budgets && m.budgets.length && L().stayedOnBudgets(m.pf, m.budgets, p.y, p.m)) out.budget++; else budgetRun = false; }
      const ms = L().monthStats(m.pf, m.pf.base, p.y, p.m);
      const saved = ms.income > 0 && ms.expense > 0 && ms.net >= ms.income * 0.2;
      if (saved) out.saverAny = true;
      if (saverRun) { if (saved) out.saver++; else saverRun = false; }
      if (!budgetRun && !saverRun && out.saverAny) break;
    }
    return out;
  }
  /* a house level only counts on real prices (not the placeholders shown before any arrive) */
  function pricesReal(m) {
    if (!m.pf.txns.some((x) => x.sym)) return true;
    const ms = FF.market && FF.market.summary ? FF.market.summary() : null;
    return !!(ms && (ms.stocksLive || ms.stocksHistory)) || (state && state.family && state.family.demo);
  }
  /* house level from the total (thresholds in ringgit: calc.LEVELS) */
  function levelOf(m) {
    const s = C().summary(m.pf, m.pf.base);
    return C().level(s.value * FF.data.fx(m.pf.base, 'MYR'));
  }

  /* =========================================================
     BLOCK BLAST — best scores (shared with the family), gems for playing
     ========================================================= */
  function bbOf(m) {
    const b = (m && m.bb) || {};
    return { best: b.best | 0, at: b.at || null, wk: b.wk | 0, wkBest: b.wkBest | 0, games: b.games | 0 };
  }
  /* a game just ended (game over, or a new game started over it) */
  function blastFinish(score) {
    const m = me(), p = playOf(m), day = dayNow(), wk = FF.weekOf(day);
    score = Math.max(0, Math.round(+score || 0));
    const b = bbOf(m), was = b.best;
    if (b.wk !== wk) { b.wk = wk; b.wkBest = 0; }
    if (score > b.best) { b.best = score; b.at = day; }
    if (score > b.wkBest) b.wkBest = score;
    b.games++;
    m.bb = b;
    const g = FF.play.blastReward(p, score, day);
    const badges = evaluateBadges(m.id);
    commit('blast', { score });
    return { score, gems: g.n, today: g.today, best: b.best, newBest: score > was && score > 0, wkBest: b.wkBest, badges, rank: blastRank(m.id, 'week') };
  }
  /* the family ranking: 'week' (since Monday) or 'all' */
  function blastBoard(period) {
    const wk = FF.weekOf(dayNow());
    return familyMembers().map((m) => { const b = bbOf(m); return { m, v: period === 'week' ? (b.wk === wk ? b.wkBest : 0) : b.best, games: b.games }; })
      .sort((a, b) => b.v - a.v || (a.m.joined || 0) - (b.m.joined || 0));
  }
  function blastRank(id, period) { const l = blastBoard(period).filter((x) => x.v > 0); const i = l.findIndex((x) => x.m.id === id); return i === -1 ? 0 : i + 1; }


  /* =========================================================
     THE LUCKY MARKET · PETS · PLANTS · FISHING (rules: lucky.js)
     m.yard (shared with the family): { pets, plants, burn }.
     Your bag, the day's stalls and fishing live in m.play (private).
     A plant's place on the map is a family layout key: 'pl_' + its id.
     ========================================================= */
  const Lk = () => FF.lucky;
  function yardOf(m) {
    const y = (m && m.yard) || {};
    return { pets: Array.isArray(y.pets) ? y.pets : [], plants: Array.isArray(y.plants) ? y.plants : [], burn: y.burn && y.burn.t ? y.burn : null };
  }
  /* my yard, tidied once and then always the same object (actions change it in place) */
  function myYard() { const m = me(), y = m.yard; if (!y || !Array.isArray(y.pets) || !Array.isArray(y.plants) || y.burn === undefined) m.yard = yardOf(m); return m.yard; }
  /* every plant on the map → { owner, plant } */
  function plantIndex() {
    const out = {};
    if (state && state.members) Object.keys(state.members).forEach((mid) => yardOf(state.members[mid]).plants.forEach((pl) => { out['pl_' + pl.id] = { owner: mid, plant: pl }; }));
    return out;
  }
  /* the Lucky Market: one per family, near the plaza on the free spot with the most room around
     it, away from the pond (its fishing sign) — the same spot on every phone */
  function luckySpot(occ) {
    const g = G(), pz = g.PLAZA, PD = g.POND;
    const mine = occ.filter((o) => o.id !== '_lucky');
    const others = mine.filter((o) => o.id.indexOf('pl_') !== 0).map((o) => g.center(o.i, o.j));
    const R = g.tileRange();
    let best = null;
    for (let i = R.i0; i <= R.i1; i++) for (let j = R.j0; j <= R.j1; j++) {
      const c = g.center(i, j);
      if (Math.abs(c.x - pz.x) > 460 || Math.abs(c.y - pz.y) > 420) continue;
      if (!g.valid(i, j, mine, '_lucky')) continue;
      const room = others.reduce((m, o) => Math.min(m, Math.hypot((c.x - o.x) * 0.9, (c.y - o.y) * 1.6)), 1e9);
      const pond = Math.hypot(c.x - PD.x, (c.y - PD.y) * 1.6);
      const score = Math.min(room, 260) - 0.22 * Math.hypot(c.x - pz.x, c.y - pz.y) - (pond < 330 ? 330 - pond : 0);
      if (!best || score > best.score) best = { i, j, score };
    }
    return best ? { i: best.i, j: best.j } : g.nearestFree(pz.x + 250, pz.y - 40, mine, '_lucky');
  }
  function ensureLucky() {
    const f = state && state.family;
    if (!f || !f.layout || f.layout._lucky) return false;
    f.layout._lucky = luckySpot(occupied());
    return true;
  }
  /* the News mailbox: one per family, on the free spot near the plaza with the most room around
     it (but not by the pond or the market) — the same spot on every phone */
  function newsSpot(occ) {
    const g = G(), pz = g.PLAZA, PD = g.POND;
    const mine = occ.filter((o) => o.id !== '_news');
    const others = mine.filter((o) => o.id.indexOf('pl_') !== 0).map((o) => g.center(o.i, o.j));
    const R = g.tileRange();
    let best = null;
    for (let i = R.i0; i <= R.i1; i++) for (let j = R.j0; j <= R.j1; j++) {
      const c = g.center(i, j);
      if (Math.abs(c.x - pz.x) > 420 || Math.abs(c.y - pz.y) > 380) continue;
      if (!g.valid(i, j, mine, '_news')) continue;
      const room = others.reduce((m, o) => Math.min(m, Math.hypot((c.x - o.x) * 0.9, (c.y - o.y) * 1.6)), 1e9);
      const pond = Math.hypot(c.x - PD.x, (c.y - PD.y) * 1.6);
      // its sign floats above it, like a house's name tag: keep the two from landing on each other
      const tags = others.reduce((n, o) => n + (Math.abs(c.x - o.x) < 140 && Math.abs(c.y - o.y) < 110 ? 1 : 0), 0);
      const score = Math.min(room, 220) - 0.3 * Math.hypot(c.x - pz.x, c.y - pz.y) - (pond < 300 ? 300 - pond : 0) - tags * 160;
      if (!best || score > best.score) best = { i, j, score };
    }
    return best ? { i: best.i, j: best.j } : g.nearestFree(pz.x - 220, pz.y + 60, mine, '_news');
  }
  function ensureNews() {
    const f = state && state.family;
    if (!f || !f.layout || f.layout._news) return false;
    f.layout._news = newsSpot(occupied());
    return true;
  }
  /* the Mystery Man: one per family, lying in the grass on the island's quiet top (free since 2.24).
     He's small and lies flat, so he keeps out from behind anything taller: a building or a tree
     just below him (drawn in front) would hide him, and so would its name tag above it. The same
     spot on every phone. */
  const behindSomething = (c, others) => others.some((o) => Math.abs(c.x - o.x) < 160 && o.y - c.y > -80 && o.y - c.y < 300) ||
    G().TREES.concat(G().LANDMARKS).some((t) => Math.abs(c.x - t.x) < 85 && t.y - c.y > 0 && t.y - c.y < 140);
  function sageSpot(occ) {
    const g = G();
    const mine = occ.filter((o) => o.id !== '_sage');
    const others = mine.filter((o) => o.id.indexOf('pl_') !== 0).map((o) => g.center(o.i, o.j));
    const R = g.tileRange(), aim = { x: 470, y: 330 };
    let best = null;
    for (let i = R.i0; i <= R.i1; i++) for (let j = R.j0; j <= R.j1; j++) {
      const c = g.center(i, j);
      if (Math.abs(c.x - aim.x) > 380 || Math.abs(c.y - aim.y) > 340) continue;
      if (!g.valid(i, j, mine, '_sage')) continue;
      const room = others.reduce((m, o) => Math.min(m, Math.hypot((c.x - o.x) * 0.9, (c.y - o.y) * 1.6)), 1e9);
      const score = Math.min(room, 220) - 0.3 * Math.hypot(c.x - aim.x, (c.y - aim.y) * 1.2) - (behindSomething(c, others) ? 500 : 0);
      if (!best || score > best.score) best = { i, j, score };
    }
    return best ? { i: best.i, j: best.j } : g.nearestFree(aim.x, aim.y, mine, '_sage');
  }
  function ensureSage() {
    const f = state && state.family;
    if (!f || !f.layout || f.layout._sage) return false;
    f.layout._sage = sageSpot(occupied());
    return true;
  }
  /* the daily spin (the rules — eight equal slices — live in play.js) */
  function spinToday() { const p = playOf(); return { done: FF.play.spinDone(p, dayNow()), i: p && p.spin ? p.spin.i : null }; }
  function spinWheel(rnd) {
    const m = me();
    if (!m) return { ok: false, reason: 'signin' };
    const p = playOf(m), r = FF.play.spin(p, dayNow(), rnd);
    if (!r.ok) return r;
    commit('play', { spin: r.i });
    if (r.prize.k === 'gems') FF.emit('gems', { n: r.prize.n, k: 'spin' });
    return r;
  }
  /* the Mystery Man's quiz: a right answer pays 2 gems (the first 10 a day); every answer is saved
     so the next fact is a new one, on every phone */
  function sageToday() { const p = playOf(); return p ? FF.play.sageOf(p, dayNow()) : null; }
  function sageAnswer(id, right) {
    const m = me();
    if (!m || !id) return null;
    const p = playOf(m), r = FF.play.sageAnswer(p, dayNow(), id, !!right);
    commit('play', { sage: r.gems });
    if (r.gems) FF.emit('gems', { n: r.gems, k: 'sage' });
    return r;
  }
  /* reading the news: three stories in a day earn a few gems (once a day). Only those first
     reads are saved (and sent to your other phones) — after that, reading costs nothing. */
  function newsRead(id) {
    const m = me();
    if (!m || !id) return null;
    const p = playOf(m), day = dayNow(), NW = FF.play.NEWS;
    if (!p.news || p.news.day !== day) p.news = { day, ids: [], paid: false };
    const nw = p.news;
    if (nw.paid || nw.ids.indexOf(String(id)) !== -1) return { n: nw.paid ? NW.GOAL : nw.ids.length, gems: 0, done: !!nw.paid };
    nw.ids.push(String(id).slice(0, 16));
    let gems = 0;
    if (nw.ids.length >= NW.GOAL) { nw.paid = true; nw.ids = []; gems = FF.play.earn(p, NW.GEMS, 'news', day); }
    commit('news', { gems });
    if (gems) FF.emit('gems', { n: gems, k: 'news' });
    return { n: nw.paid ? NW.GOAL : nw.ids.length, gems, done: !!nw.paid };
  }
  function newsToday() {
    const m = me(), p = m && m.play, day = dayNow(), nw = p && p.news;
    return !nw || nw.day !== day ? { n: 0, done: false } : { n: nw.paid ? FF.play.NEWS.GOAL : nw.ids.length, done: !!nw.paid };
  }
  /* a new plant goes in front of its owner's house — clear of where the pets sit (move it
     anywhere in edit mode) */
  function plantSpot(ownerId, id) {
    const f = state.family, g = G(), h = f && f.layout[ownerId];
    const c = h ? g.center(h.i, h.j) : g.PLAZA;
    // keep clear of every house's pet spots too (pets aren't on the grid, so mark them for the search)
    const zones = [];
    if (f) familyMembers().forEach((m) => { const p = f.layout[m.id]; if (!p) return; const hc = g.center(p.i, p.j); Lk().PET_SPOTS.forEach((d, k) => { const sn = g.snap(hc.x + d[0], hc.y + d[1]); zones.push({ id: 'pl_zone_' + m.id + k, i: sn.i, j: sn.j }); }); });
    return g.nearestFree(c.x, c.y + 112, occupied().filter((o) => o.id !== id).concat(zones), id);
  }
  function placeMyPlants() {
    const f = state && state.family, m = me();
    if (!f || !f.layout || !m) return [];
    const out = [];
    yardOf(m).plants.forEach((pl) => { const k = 'pl_' + pl.id; if (!f.layout[k]) { f.layout[k] = plantSpot(m.id, k); out.push(k); } });
    return out;
  }
  function bagOf(p) { p.bag = Object.assign({}, p.bag); return p.bag; }
  /* is there room for what this stall sells? */
  function luckyFull(id, m) {
    const it = Lk().ITEMS[id], y = yardOf(m);
    if (it.kind === 'egg') return y.pets.length >= Lk().MAX_PETS;
    if (it.kind === 'seed') return y.plants.length >= Lk().MAX_PLANTS;
    if (it.kind === 'deco') return FF.play.owns(playOf(m), id);
    return false;
  }
  /* today's six stalls */
  function luckyToday() {
    const m = me(), p = playOf(m), day = dayNow();
    const L = Lk().today(p, m.id, day, p.owned);
    return L.stock.map((id, k) => { const it = Lk().ITEMS[id]; return { slot: k, id, item: it, price: it.price, sold: L.sold.indexOf(k) !== -1, afford: p.pts >= it.price, full: luckyFull(id, m) }; });
  }
  function buyLucky(slot, rnd) {
    const m = me(), p = playOf(m), day = dayNow();
    const L = Lk().today(p, m.id, day, p.owned);
    const id = L.stock[slot];
    if (id == null) return { ok: false, reason: 'unknown' };
    if (L.sold.indexOf(slot) !== -1) return { ok: false, reason: 'sold' };
    const it = Lk().ITEMS[id];
    if (luckyFull(id, m)) return { ok: false, reason: it.kind === 'deco' ? 'owned' : 'full' };
    if (p.pts < it.price) return { ok: false, reason: 'short' };
    FF.play.earn(p, -it.price, 'lucky', day, { id });
    L.sold = L.sold.concat([slot]);
    const r = { ok: true, id, kind: it.kind, price: it.price };
    const y = myYard();
    if (it.kind === 'egg') {
      const h = Lk().hatch(id, rnd);
      r.pet = { id: FF.uid('q'), sp: h.sp, r: h.r, at: day, fed: 0, fd: null, show: 0 };
      y.pets = y.pets.concat([r.pet]);
    } else if (it.kind === 'seed') {
      const sw = Lk().sow(id, rnd);
      r.plant = { id: FF.uid('g'), sp: sw.sp, r: sw.r, at: day, w: 0, wd: null, bloom: null };
      y.plants = y.plants.concat([r.plant]);
      if (state.family && state.family.layout) state.family.layout['pl_' + r.plant.id] = plantSpot(m.id, 'pl_' + r.plant.id);
    } else if (it.kind === 'bag') {
      const bag = bagOf(p); bag[id] = (bag[id] || 0) + 1; r.bag = bag[id];
    } else if (it.kind === 'deco') {
      p.owned[id] = day;
      const d = FF.play.item(id);
      m.house.deco = Object.assign({}, m.house.deco);
      r.replaced = m.house.deco[d.slot] || null;
      m.house.deco[d.slot] = id;
    }
    r.badges = evaluateBadges(m.id);
    commit('lucky', { r });
    return r;
  }
  const findPet = (id) => myYard().pets.find((x) => x.id === id);
  const findPlant = (id) => myYard().plants.find((x) => x.id === id);
  /* feed a pet (once a day — a treat from your bag counts as an extra day) */
  function feedPet(id, opts) {
    const m = me(), p = playOf(m), y = myYard(), pet = findPet(id), day = dayNow();
    if (!pet) return { ok: false, reason: 'gone' };
    const treat = !!(opts && opts.treat);
    if (treat && !((p.bag || {}).treat > 0)) return { ok: false, reason: 'none' };
    const res = Lk().feed(pet, day, treat);
    if (res === -1) return { ok: false, reason: 'fed' };
    if (treat) bagOf(p).treat--;
    y.pets = y.pets.slice();
    const badges = evaluateBadges(m.id);
    commit('pet', { id });
    return { ok: true, evolved: res, pet, badges };
  }
  function setPetForm(id, form) {
    const y = myYard(), pet = findPet(id);
    if (!pet || form < 0 || form > Lk().formsOf(pet)) return false;
    pet.show = form; y.pets = y.pets.slice();
    commit('pet', { id });
    return true;
  }
  function sellPet(id) {
    const m = me(), p = playOf(m), y = myYard(), pet = findPet(id);
    if (!pet) return { ok: false };
    const gems = Lk().petValue(pet);
    y.pets = y.pets.filter((x) => x.id !== id);
    FF.play.earn(p, gems, 'sell', dayNow(), { pet: pet.sp });
    commit('pet', { id, sold: true });
    return { ok: true, gems, pet };
  }
  /* water a plant (once a day; a growth tonic counts as an extra day) */
  function waterPlant(id, opts) {
    const m = me(), p = playOf(m), y = myYard(), pl = findPlant(id), day = dayNow();
    if (!pl) return { ok: false, reason: 'gone' };
    const tonic = !!(opts && opts.tonic);
    if (tonic && !((p.bag || {}).tonic > 0)) return { ok: false, reason: 'none' };
    const before = Lk().stage(pl);
    const st = Lk().water(pl, day, tonic);
    if (st === -1) return { ok: false, reason: Lk().bloomed(pl) ? 'bloomed' : 'watered' };
    if (tonic) bagOf(p).tonic--;
    y.plants = y.plants.slice();
    const badges = evaluateBadges(m.id);
    commit('plant', { id });
    return { ok: true, stage: st, grew: st > before, bloomed: Lk().bloomed(pl) && before < 4, plant: pl, badges };
  }
  function sellPlant(id) {
    const m = me(), p = playOf(m), y = myYard(), pl = findPlant(id);
    if (!pl) return { ok: false };
    const gems = Lk().plantValue(pl, dayNow());
    y.plants = y.plants.filter((x) => x.id !== id);
    if (state.family && state.family.layout) delete state.family.layout['pl_' + id];
    FF.play.earn(p, gems, 'sell', dayNow(), { plant: pl.sp || 'seed' });
    commit('plant', { id, sold: true });
    return { ok: true, gems, plant: pl };
  }
  /* the Molotov: someone's house "burns" for a day (one of yours at a time — a new one moves it) */
  function throwMolotov(targetId) {
    const m = me(), p = playOf(m), y = myYard();
    if (!member(targetId)) return { ok: false, reason: 'gone' };
    if (!((p.bag || {}).molotov > 0)) return { ok: false, reason: 'none' };
    bagOf(p).molotov--;
    y.burn = { t: targetId, at: Date.now() };
    commit('burn', { t: targetId });
    return { ok: true };
  }
  /* which houses are burning now: target id → [thrower ids] */
  function burns(now) {
    const out = {};
    familyMembers().forEach((m) => { const b = yardOf(m).burn; if (Lk().burning(b, now || Date.now()) && member(b.t)) (out[b.t] = out[b.t] || []).push(m.id); });
    return out;
  }
  /* fishing: five casts a day */
  function fishState() {
    const m = me(), p = playOf(m), day = dayNow(), fd = Lk().fishDay(p, day);
    return { left: Lk().CASTS - fd.casts, cast: fd.casts, zone: Lk().zoneOf(m.id, day, fd.casts), book: fd.book };
  }
  function fishCast(pos, rnd) {
    const m = me(), p = playOf(m), day = dayNow(), fd = Lk().fishDay(p, day);
    if (fd.casts >= Lk().CASTS) return { ok: false, reason: 'done' };
    const zone = Lk().zoneOf(m.id, day, fd.casts);
    const grade = Lk().judge(pos, zone);
    const fish = Lk().catchFish(grade, rnd);
    fd.casts++;
    if (fish) {
      fd.book = Object.assign({}, fd.book); fd.book[fish.sp] = (fd.book[fish.sp] || 0) + 1;
      FF.play.earn(p, fish.gems, 'fish', day, { f: fish.sp });
    }
    const badges = evaluateBadges(m.id);
    commit('fish', { grade });
    return { ok: true, grade, fish, zone, left: Lk().CASTS - fd.casts, badges };
  }

  /* =========================================================
     FAMILY HELP (v2.25): record for a family member who lets you
     — add what they spent or received, fix a record, set a balance.
     Their own phone applies it (ledger.applyHelpOp checks it first),
     so their records only ever have one writer; until it does, the
     change waits in the family's "help" mailbox and everyone sees
     it on top of their records ("waiting for Dad's phone").
     ========================================================= */
  // you let your family help unless you've said otherwise — or made anything private
  const restricted = (m) => SECTIONS.some((k) => { const p = m.privacy && m.privacy[k]; return !!(p && p.mode && p.mode !== 'family'); });
  function helpOf(m) {
    if (!m) return false;
    if (state && m.id === state.meId) return m.helpSet != null ? !!m.helpSet : !restricted(m);
    // someone else: what their profile says (an older app says nothing: no help); demo: the default
    return m.help != null ? !!m.help : mode() === 'demo' && !restricted(m);
  }
  function setHelp(on) { me().helpSet = !!on; commit('help-set'); }
  /* may I record for this family member? */
  function canHelp(id) {
    const f = state && state.family, m = member(id);
    if (!f || !m || !state.meId || id === state.meId || f.members.indexOf(id) === -1 || m._noMoney) return false;
    const md = mode();
    return (md === 'cloud' || md === 'demo') && helpOf(m);
  }
  /* changes for this member that haven't reached their phone yet, oldest first */
  function pendingFor(id) {
    const f = state && state.family, box = f && f.help && f.help[id];
    return box ? Object.keys(box).map((k) => Object.assign({ key: k }, box[k])).sort((a, b) => a.at - b.at || (a.key < b.key ? -1 : 1)) : [];
  }
  /* their records as everyone should see them: as their phone last sent them + what's on its way */
  function refreshHelp(id) {
    const m = member(id);
    if (!m || !state || id === state.meId) return;
    const base = m._pf0 || m.pf;
    const list = pendingFor(id);
    if (!list.length) { m.pf = base; delete m._pf0; return; }
    const view = JSON.parse(JSON.stringify(base)), today = FF.today(), now = Date.now();
    list.forEach((e) => {
      if (!L().applyHelpOp(view, e.op, e.by, today, now)) return;
      const id2 = e.op.k === 'add' || e.op.k === 'edit' ? e.op.tx.id : e.op.k === 'bal' ? e.op.id : null;
      const tx = id2 && view.txns.find((x) => x.id === id2);
      if (tx) tx._pending = 1;
    });
    m._pf0 = base;
    m.pf = view;
  }
  /* record something for a family member → { undo } (the op that puts it back), or null if it
     wouldn't change anything */
  function helpEdit(id, op) {
    if (!canHelp(id)) return null;
    const m = member(id), f = state.family, today = FF.today(), now = Date.now();
    const undo = L().helpUndo(m.pf, op);
    if (mode() === 'demo') { // the sample family lives on this phone: straight into their records
      if (!L().applyHelpOp(m.pf, op, state.meId, today, now)) return null;
      commit('help', { id, op });
      return { op, undo };
    }
    const test = JSON.parse(JSON.stringify(m.pf));
    if (!L().applyHelpOp(test, op, state.meId, today, now)) return null;
    f.help = f.help || {};
    (f.help[id] = f.help[id] || {})[FF.uid('h')] = { by: state.meId, at: now, op };
    refreshHelp(id);
    commit('help', { id, op });
    return { op, undo };
  }
  /* what the family recorded for me: into my records (only if I let them, only from people
     still in the family), then out of the mailbox. Mailboxes of people who left are emptied.
     → what was applied (the cloud layer saves and sends) */
  function applyHelp() {
    const f = state && state.family;
    if (!f || !f.help) return [];
    Object.keys(f.help).forEach((t) => { if (f.members.indexOf(t) === -1) delete f.help[t]; });
    if (!f.help[state.meId]) return [];
    const m = me(), on = helpOf(m), today = FF.today(), now = Date.now(), done = [];
    pendingFor(state.meId).forEach((e) => {
      if (on && e.by !== state.meId && f.members.indexOf(e.by) !== -1 && L().applyHelpOp(m.pf, e.op, e.by, today, now)) done.push(e);
    });
    delete f.help[state.meId];
    return done;
  }

  /* =========================================================
     GEMS, THE DAILY GIFT & THE SHOP (the rules live in play.js)
     ========================================================= */
  // the day for the daily gift: the server's clock when signed in (changing the phone's date doesn't help)
  const dayNow = () => (FF.cloud && FF.cloud.serverDay ? FF.cloud.serverDay() : FF.today());
  function playOf(m) { m = m || me(); return m ? FF.play.ensure(m, dayNow()) : null; }
  function claimDaily() {
    const m = me(), p = playOf(m);
    const r = FF.play.claim(p, dayNow());
    if (!r.ok) return r;
    r.badges = evaluateBadges(m.id);
    r.extra = checkRewards();
    commit('play', { r });
    return r;
  }
  /* buy something: decorations go straight onto your house, pets move in while there's room */
  function buyItem(id) {
    const m = me(), p = playOf(m);
    const r = FF.play.buy(p, id, dayNow());
    if (!r.ok) return r;
    const it = r.item, h = m.house;
    if (it && it.kind === 'pet') {
      h.pets = (h.pets || []).slice();
      if (h.pets.length < FF.play.MAX_PETS) { h.pets.push(id); r.home = true; }
    } else if (it) {
      h.deco = Object.assign({}, h.deco);
      r.replaced = h.deco[it.slot] || null;
      h.deco[it.slot] = id;
      r.on = true;
    }
    r.badges = evaluateBadges(m.id);
    commit('play', { r, id, house: true });
    return r;
  }
  function setDeco(slot, id) {
    const m = me();
    m.house.deco = Object.assign({}, m.house.deco);
    if (id) m.house.deco[slot] = id; else delete m.house.deco[slot];
    FF.play.cleanHouse(m.house, playOf(m));
    const badges = evaluateBadges(m.id);
    commit('house', { id: m.id, badges });
    return badges;
  }
  /* a pet comes to live at your house (or goes back to rest); swap: who leaves to make room */
  function setPetHome(id, on, swap) {
    const m = me();
    let pets = (m.house.pets || []).filter((x) => x !== id && x !== swap);
    if (on) pets.push(id);
    m.house.pets = pets;
    FF.play.cleanHouse(m.house, playOf(m));
    commit('house', { id: m.id, pet: id });
  }
  /* rewards that come from what happened rather than a tap: a month inside your budgets,
     and (no gems — the house is the reward) a bigger house, celebrated once on each phone.
     o.prices: real prices have arrived (a house never "grows" on placeholder prices).
     Nothing is saved unless gems changed: a phone that just opened must not overwrite what
     your other phone sent before it has caught up. */
  function checkRewards(o) {
    o = o || {};
    const m = me();
    if (!m || mode() === 'none') return {};
    const p = playOf(m), day = dayNow(), out = {};
    const t = FF.ymd(day), prev = FF.addMonths(t.y, t.m, -1);
    if ((m.budgets || []).length && L().stayedOnBudgets(m.pf, m.budgets, prev.y, prev.m)) {
      const n = FF.play.once(p, 'budget:' + prev.y + '-' + prev.m, FF.play.BUDGET_GEMS, 'budget', day, { y: prev.y, m: prev.m });
      if (n) out.budget = { gems: n, y: prev.y, m: prev.m };
    }
    const priced = o.prices || !m.pf.txns.some((x) => x.sym);
    if (priced) {
      const lv = levelOf(m), seen = device().lvl && device().lvl[m.id];
      if (!seen || lv > seen) {
        if (seen) out.level = { from: seen, to: lv };
        setDevice({ lvl: Object.assign({}, device().lvl, { [m.id]: lv }) });
      }
    }
    if (out.budget || out.level) { out.badges = evaluateBadges(m.id); commit('play', { rewards: out }); }
    return out;
  }
  /* weeks with any logging — what other family members get to see of my streak */
  function logWeeks(m) {
    const w = {};
    logDays(m).forEach((d) => { w[FF.weekOf(d)] = 1; });
    const now = FF.weekOf(FF.today());
    return Object.keys(w).map(Number).filter((x) => x > now - 104).sort((a, b) => a - b);
  }
  const streakOf = (id) => {
    const m = member(id);
    if (id !== state.meId && m.logw) return C().weekStreak(m.logw.map((w) => w * 7 - 3)); // a day in that week
    return C().weekStreak(logDays(m));
  };

  /* =========================================================
     FAMILY FINANCE 3 — bills & pay days, savings goals, a watchlist
     Kept inside the person's own settings (prefs.x): private (the family never receives it),
     synced across their own phones, and carried along untouched by a phone that still runs
     FamFi 2.x — which sends the whole settings object back as it found it.
     ========================================================= */
  const X0 = () => ({ v: 1, bills: [], goals: [], watch: [] });
  /* reading never changes anything (so just looking at a screen can't make a phone "have
     something to send"); `write` attaches the tidy object for the actions below */
  function extras(m, write) {
    m = m || me();
    if (!m) return X0();
    const x = m.prefs && m.prefs.x;
    if (x && typeof x === 'object' && Array.isArray(x.bills) && Array.isArray(x.goals) && Array.isArray(x.watch)) return x;
    const o = X0();
    if (x && typeof x === 'object') { ['bills', 'goals', 'watch'].forEach((k) => { if (Array.isArray(x[k])) o[k] = x[k]; }); if (x.nz) o.nz = x.nz; }
    if (write) { m.prefs = Object.assign({}, DEFAULT_PREFS, m.prefs); m.prefs.x = o; }
    return o;
  }
  const Rc = () => FF.recur;
  const cleanBill = (b) => {
    const o = { type: b.type === 'income' || b.type === 'transfer' ? b.type : 'expense', name: String(b.name || '').trim().slice(0, 40), amt: r2(Math.abs(+b.amt || 0)), cur: b.cur, acct: b.acct, every: Rc().EVERY.indexOf(b.every) !== -1 ? b.every : 'month', day0: Math.round(+b.day0), auto: b.auto !== false };
    if (o.type === 'transfer') { o.to = b.to; if (b.toAmt != null && b.toCur) { o.toAmt = r2(+b.toAmt); o.toCur = b.toCur; } } else o.cat = b.cat;
    if (b.end != null && isFinite(+b.end)) o.end = Math.round(+b.end);
    if (b.off) o.off = true;
    return o;
  };
  /* a new rule only looks ahead: nothing before its first date is ever asked for */
  function addBill(b) {
    const x = extras(null, true);
    const nb = Object.assign({ id: FF.uid('r'), ts: Date.now() }, cleanBill(b));
    nb.last = b.last != null ? Math.round(+b.last) : Math.max(nb.day0 - 1, FF.today() - 1);
    x.bills.push(nb);
    commit('bill', { b: nb });
    return nb;
  }
  function updateBill(id, patch) {
    const x = extras(null, true), i = x.bills.findIndex((b) => b.id === id);
    if (i === -1) return null;
    const old = x.bills[i];
    const nb = Object.assign({ id: old.id, ts: old.ts }, cleanBill(Object.assign({}, old, patch)));
    // a new date or rhythm starts the counting again from there (never reaching back before
    // today); otherwise what was already dealt with stays dealt with
    nb.last = nb.day0 !== old.day0 || nb.every !== old.every ? Math.max(nb.day0 - 1, FF.today() - 1) : (old.last != null ? old.last : nb.day0 - 1);
    x.bills[i] = nb;
    commit('bill', { b: nb });
    return nb;
  }
  function deleteBill(id) {
    const x = extras(null, true), b = x.bills.find((y) => y.id === id);
    x.bills = x.bills.filter((y) => y.id !== id);
    commit('bill-deleted', { b });
    return b;
  }
  function restoreBill(b) { if (!b) return; const x = extras(null, true); x.bills = x.bills.filter((y) => y.id !== b.id).concat([b]).sort((p, q) => (p.ts || 0) - (q.ts || 0)); commit('bill', { b }); }
  /* write the record for one due day (once: the reference is the same on every phone) */
  function writeBill(m, rule, due, opts) {
    const ref = Rc().refOf(rule, due);
    if (m.pf.txns.some((t) => t.ref === ref)) return null;
    const tx = Rc().record(rule, due);
    if (opts && opts.amt != null && +opts.amt > 0) tx.amt = r2(+opts.amt);
    if (opts && opts.day != null) tx.day = opts.day;
    tx.id = FF.uid('t'); tx.ts = Date.now();
    m.pf.txns.push(tx);
    return tx;
  }
  /* Every rule that writes itself: add what has come due since it was last looked at. Rules set
     to "ask me" are left for the person to confirm (payBill) or skip (skipBill).
     Run when the app opens and when it comes back on a new day. */
  function runBills(day) {
    const m = me();
    if (!m || mode() === 'none') return [];
    day = day == null ? FF.today() : day;
    const x = extras(m, true), added = [];
    let touched = false;
    x.bills.forEach((rule) => {
      if (rule.off || !rule.auto || !Rc().valid(rule, m.pf)) return;
      const open = Rc().open(rule, day);
      if (!open.length) return;
      open.forEach((d) => { const tx = writeBill(m, rule, d); if (tx) added.push(tx); });
      rule.last = open[open.length - 1];
      touched = true;
    });
    if (!touched) return [];
    const badges = added.length ? evaluateBadges(m.id) : [];
    commit('bills-auto', { added, badges });
    return added;
  }
  /* "I've paid it" — the oldest open day of the rule (or the next one, paid early) */
  function payBill(id, opts) {
    const m = me(), x = extras(m, true), rule = x.bills.find((b) => b.id === id);
    if (!rule || !Rc().valid(rule, m.pf)) return null;
    const today = FF.today();
    const due = Rc().nextOpen(rule, today);
    if (due == null) return null;
    const tx = writeBill(m, rule, due, { amt: opts && opts.amt, day: Math.min(due, today) });
    rule.last = Math.max(Rc().handledUpTo(rule), due);
    const gems = tx ? FF.play.logReward(playOf(m), dayNow()) : 0;
    const badges = tx ? evaluateBadges(m.id) : [];
    commit('bill-paid', { tx, due, badges, gems });
    if (gems) FF.emit('gems', { n: gems, k: 'log' });
    return { tx, due, badges };
  }
  function skipBill(id) {
    const x = extras(null, true), rule = x.bills.find((b) => b.id === id);
    if (!rule) return null;
    const due = Rc().nextOpen(rule, FF.today());
    if (due == null) return null;
    rule.last = Math.max(Rc().handledUpTo(rule), due);
    commit('bill-skipped', { due });
    return due;
  }

  /* ---------- savings goals: a target, a date, and what has been set aside ---------- */
  const cleanSaving = (g) => {
    const o = { name: String(g.name || '').trim().slice(0, 40), emo: String(g.emo || '🎯').slice(0, 8), target: r2(Math.max(0, +g.target || 0)), cur: g.cur };
    if (g.due != null && isFinite(+g.due)) o.due = Math.round(+g.due);
    if (g.acct) o.acct = g.acct;
    return o;
  };
  function addSaving(g) {
    const x = extras(null, true);
    const ng = Object.assign({ id: FF.uid('s'), ts: Date.now(), puts: [] }, cleanSaving(Object.assign({ cur: me().pf.base }, g)));
    if (+g.start > 0) ng.puts.push({ id: FF.uid('p'), day: FF.today(), amt: r2(+g.start) });
    x.goals.push(ng);
    commit('saving', { g: ng });
    return ng;
  }
  function updateSaving(id, patch) {
    const x = extras(null, true), i = x.goals.findIndex((g) => g.id === id);
    if (i === -1) return null;
    const old = x.goals[i];
    x.goals[i] = Object.assign({ id: old.id, ts: old.ts, puts: old.puts || [] }, cleanSaving(Object.assign({}, old, patch)));
    if (old.cheered) x.goals[i].cheered = old.cheered;
    commit('saving', { g: x.goals[i] });
    return x.goals[i];
  }
  function deleteSaving(id) {
    const x = extras(null, true), g = x.goals.find((y) => y.id === id);
    x.goals = x.goals.filter((y) => y.id !== id);
    commit('saving-deleted', { g });
    return g;
  }
  function restoreSaving(g) { if (!g) return; const x = extras(null, true); x.goals = x.goals.filter((y) => y.id !== g.id).concat([g]).sort((p, q) => (p.ts || 0) - (q.ts || 0)); commit('saving', { g }); }
  /* set money aside for a goal (a negative amount takes some back out); → the goal's new state */
  function putSaving(id, amt, day) {
    const m = me(), x = extras(m, true), g = x.goals.find((y) => y.id === id);
    amt = r2(+amt);
    if (!g || !isFinite(amt) || FF.isZero(amt)) return null;
    const before = FF.plan.goal(g, m.pf);
    g.puts = (g.puts || []).concat([{ id: FF.uid('p'), day: day == null ? FF.today() : day, amt }]);
    const after = FF.plan.goal(g, m.pf);
    // milestones are cheered once each: a quarter, half, three quarters, done
    const step = (p) => (p.done ? 4 : Math.floor(p.pct * 4 + 1e-9));
    const reached = step(after) > Math.max(step(before), g.cheered || 0) ? step(after) : 0;
    if (reached) g.cheered = reached;
    commit('saving-put', { g, reached });
    return { g, before, after, reached };
  }
  function toggleWatch(sym) {
    const x = extras(null, true), i = x.watch.indexOf(sym);
    if (i === -1) { x.watch.push(sym); rememberAsset(me().pf, sym); } else x.watch.splice(i, 1);
    commit('watch', { sym, on: i === -1 });
    return i === -1;
  }
  /* a tip the person closed stays closed for a while (remembered with the day it was closed) */
  function dismissNudge(key) { const x = extras(null, true); x.nz = Object.assign({}, x.nz); x.nz[key] = FF.today(); Object.keys(x.nz).forEach((k) => { if (x.nz[k] < FF.today() - 120) delete x.nz[k]; }); commit('nudge', { key }); }
  const nudgeOff = (key, days) => { const x = extras(null, true), d = x.nz && x.nz[key]; return d != null && FF.today() - d < (days || 14); };

  /* ---------- hide amounts (this phone only) ---------- */
  function setHide(on) { FF.hideMoney = !!on; setDevice({ hide: !!on }); FF.emit('change', { reason: 'hide' }); }

  /* ---------- a backup you can keep: everything that is yours, as one file ---------- */
  function backup() {
    const m = me();
    if (!m) return null;
    return { app: 'family-finance', v: 1, at: Date.now(), name: m.name, base: m.pf.base, pf: JSON.parse(JSON.stringify(m.pf)), budgets: JSON.parse(JSON.stringify(m.budgets || [])), x: JSON.parse(JSON.stringify(extras(m))) };
  }
  /* what a backup file holds, or null when it isn't one (nothing is changed) */
  function readBackup(o) {
    if (!o || typeof o !== 'object' || (o.app !== 'family-finance' && o.app !== 'famfi') || !o.pf || !Array.isArray(o.pf.txns) || !Array.isArray(o.pf.accounts)) return null;
    const okTx = (t) => t && typeof t === 'object' && typeof t.id === 'string' && typeof t.type === 'string' && isFinite(+t.day);
    const okAcc = (a) => a && typeof a === 'object' && typeof a.id === 'string' && typeof a.cur === 'string';
    if (!o.pf.txns.every(okTx) || !o.pf.accounts.every(okAcc) || !o.pf.accounts.length) return null;
    return { at: o.at || 0, name: o.name || '', records: o.pf.txns.length, accounts: o.pf.accounts.length, budgets: Array.isArray(o.budgets) ? o.budgets.length : 0, bills: o.x && Array.isArray(o.x.bills) ? o.x.bills.length : 0, goals: o.x && Array.isArray(o.x.goals) ? o.x.goals.length : 0 };
  }
  /* put a backup back: your records, accounts, budgets, bills and goals become the file's.
     (Take a snapshot() first — the caller offers Undo.) */
  function restoreBackup(o) {
    const m = me();
    if (!m || !readBackup(o)) return false;
    const pf = JSON.parse(JSON.stringify(o.pf));
    delete pf.share;
    if (!pf.base) pf.base = m.pf.base;
    learnAssets(pf);
    pf.txns = pf.txns.filter((t) => !t.sym || FF.data.asset(t.sym));
    m.pf = pf;
    if (Array.isArray(o.budgets)) m.budgets = JSON.parse(JSON.stringify(o.budgets));
    if (o.x && typeof o.x === 'object') { m.prefs = Object.assign({}, m.prefs); m.prefs.x = JSON.parse(JSON.stringify(o.x)); extras(m, true); }
    upgradeMember(m);
    evaluateBadges(m.id, true);
    commit('restore');
    return true;
  }

  /* =========================================================
     PREFS & PRIVACY
     ========================================================= */
  function setLang(lang) {
    setDevice({ lang });
    if (me()) { me().prefs = Object.assign({}, DEFAULT_PREFS, me().prefs, { lang }); save(); }
    FF.emit('lang', lang);
  }
  function setPref(key, val) {
    if (me()) { me().prefs = Object.assign({}, DEFAULT_PREFS, me().prefs); me().prefs[key] = val; save(); }
    else { const d = device(); d[key] = val; setDevice(d); }
    FF.emit('prefs', { key, val });
  }
  function setPrivacy(section, mode, who) { me().privacy[section] = { mode, who: who || [] }; commit('privacy'); }
  function markSeen(key) { state.seen = state.seen || {}; state.seen[key] = 1; if (state.family) state.family.seen = state.seen; save(); }

  function signOut() {
    state = blank();
    if (!memoryOnly) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
    FF.emit('change', { reason: 'signout' });
  }

  function init(opts) {
    opts = opts || {};
    memoryOnly = !!opts.memory;
    if (memoryOnly) state = blank(); else load();
    FF.hideMoney = !memoryOnly && !!device().hide;
  }

  FF.store = {
    init, load, save, persist, learnAssets, commit, snapshot, restore, mode, get state() { return state; }, set state(s) { state = s; },
    me, member, family, familyMembers, prefs, device, setDevice, canSee, SECTIONS, PETS, BADGES,
    seedDemo, seedMember, repriceDemo, createAccount, loadAccount, emptyPf, makeCode, normalizeCode, createFamily, placeMe, simulateJoin, renameFamily, updateProfile, placeNewMember,
    addTxn, updateTxn, deleteTxn, collectDividends, addAccount, adjustBalance, updateAccount, removeAccount, accountRecords, setBase, importTxns,
    addBudget, updateBudget, deleteBudget, restoreBudget, autoDividends, setDivTax, upgradeMember,
    buildHall, renameHall, addHallAccount, updateHallAccount, deleteHallAccount, restoreHallAccount, addHallEntry, deleteHallEntry,
    moveObject, tidyLayout, setHouse, addGoal, toggleGoal, deleteGoal, restoreGoal, hallSpot, evaluatePets, evaluateBadges, petRules, streakOf, logWeeks, occupied,
    setLang, setPref, setPrivacy, markSeen, signOut, LOOKS, SEED_TEXT,
    bbOf, blastFinish, blastBoard, blastRank, ensureArcade,
    yardOf, plantIndex, ensureLucky, ensureNews, ensureSage, sageSpot, spinToday, spinWheel, sageToday, sageAnswer, newsRead, newsToday, luckyToday, buyLucky, feedPet, setPetForm, sellPet, waterPlant, sellPlant, throwMolotov, burns, fishState, fishCast,
    levelOf, playOf, dayNow, claimDaily, buyItem, setDeco, setPetHome, checkRewards,
    helpOf, setHelp, canHelp, pendingFor, refreshHelp, helpEdit, applyHelp,
    extras, addBill, updateBill, deleteBill, restoreBill, runBills, payBill, skipBill,
    addSaving, updateSaving, deleteSaving, restoreSaving, putSaving, toggleWatch, dismissNudge, nudgeOff, setHide, backup, readBackup, restoreBackup
  };
})(typeof window !== 'undefined' ? window : this);
