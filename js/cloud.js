/* ============================================================
   FamFi — cloud.js
   Real accounts and real shared families: Firebase Auth (email +
   password) and the Realtime Database of FamFi's Firebase
   project (sea-monoploy). The store stays local-first (instant, works offline);
   this layer mirrors it to the cloud and applies changes made on
   other phones.

     famfi/m/<uid>       fam · pub · money · priv · share
     famfi/f/<fid>       name · code · ownerId · created · members · goals · layout · pets · hall · help
     famfi/codes/<code>  { f: <fid>, n: <family name> }
     famfi/live/<fid>    who's playing Block Blast right now, and watching (see "live" below)

   A person's own documents (pub = profile, money = portfolio,
   priv = budget + settings) have one writer and are stored whole
   as JSON { rev, d }. Family data has many writers and is written
   key by key. Who may read or write what: database.rules.json.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store;
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const P = 'famfi/';
  const DOCS = ['pub', 'money', 'priv'];

  let auth = null, db = null, loading = null;
  let user = null, connected = false;
  let mine = null;               // listener on famfi/m/<me>
  let mineSeen = false;          // the cloud's copy of my profile has arrived this session (nothing is sent before)
  let fam = null;                // { id, ref, cloud, first, fresh } — cloud: the family as the server has it
  const watched = {};            // other members: uid -> { pub, money, moneyOn }
  const inflight = {};           // doc -> rev being sent
  let quiet = 0;                 // > 0 while applying cloud data (nothing to send back)
  let joining = false;           // a join is in progress: a refusal is not "you were removed"
  let skew = null;               // server clock − this phone's clock (ms), once known

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fail = (code) => { const e = new Error(code); e.code = code; return e; };
  const digest = (o) => { const s = JSON.stringify(o); return FF.hash(s) + ':' + s.length; };
  /* this copy of the app (each phone, each browser): uploads carry it, so a copy knows its own
     write when it echoes back — two phones saving in the same millisecond can't be mistaken */
  let devMem = null;
  function devId() {
    if (devMem) return devMem;
    const d = S().device().sid;
    devMem = d || FF.uid('d');
    if (!d) S().setDevice({ sid: devMem });
    return devMem;
  }
  function parse(raw) { try { const o = typeof raw === 'string' ? JSON.parse(raw) : null; return o && typeof o.rev === 'number' && o.d ? o : null; } catch (e) { return null; } }
  function timeout(p, ms) { let k; return Promise.race([p, new Promise((res, rej) => { k = setTimeout(() => rej(fail('timeout')), ms || 15000); })]).finally(() => clearTimeout(k)); }
  const st = () => S().state;
  const myId = () => (user ? user.uid : null);

  /* ---------------- SDK (loaded on demand, so the app opens instantly) ---------------- */
  function script(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = res; s.onerror = () => { s.remove(); rej(fail('offline')); };
      document.head.appendChild(s);
    });
  }
  function ready() {
    if (loading) return loading;
    loading = (async () => {
      const cfg = root.FAMFI_FIREBASE;
      if (!cfg || !cfg.apiKey) throw fail('no-config');
      if (typeof firebase === 'undefined') await script(SDK + 'firebase-app-compat.js');
      if (!firebase.auth) await script(SDK + 'firebase-auth-compat.js');
      if (!firebase.database) await script(SDK + 'firebase-database-compat.js');
      // FamFi's own named app instance (renaming it would sign everyone out: the saved sign-in is keyed by this name)
      const app = firebase.apps.filter((a) => a.name === 'famfi')[0] || firebase.initializeApp(cfg, 'famfi');
      auth = app.auth(); db = app.database();
      if (cfg.emulator) { auth.useEmulator(cfg.emulator.auth, { disableWarnings: true }); db.useEmulator(cfg.emulator.host, cfg.emulator.dbPort); }
      db.ref('.info/connected').on('value', (s) => { connected = !!s.val(); FF.emit('cloud-status', status()); if (connected) { flush(); liveResume(); } });
      db.ref('.info/serverTimeOffset').on('value', (s) => { skew = +s.val() || 0; });
      await new Promise((res) => { const off = auth.onAuthStateChanged((u) => { off(); user = u; res(); }); });
      auth.onAuthStateChanged(onAuth);
      return true;
    })();
    loading.catch(() => { loading = null; });
    return loading;
  }
  const status = () => ({ loaded: !!db, connected, signedIn: !!user });
  /* today by the server's clock, in this phone's time zone (the daily gift can't be fooled by
     changing the phone's date); before the server has answered: the phone's own day */
  function serverDay() {
    if (FF.todayOverride != null || skew == null || !st() || !st().uid) return FF.today();
    return FF.dayOfDate(new Date(Date.now() + skew));
  }
  function onAuth(u) {
    user = u;
    if (u && st() && st().uid === u.uid) attach();
    else if (!u && mine) { detach(); FF.emit('cloud-signed-out'); }
  }
  async function online() {
    await ready();
    if (!user) throw fail('signed-out');
    if (connected) return;
    await new Promise((res, rej) => {
      const k = setTimeout(() => { off(); rej(fail('offline')); }, 8000);
      const off = FF.on('cloud-status', (s) => { if (s.connected) { clearTimeout(k); off(); res(); } });
    });
  }

  /* ---------------- my own documents ---------------- */
  /* pub: my house & profile · money: what my family may see (investments + account balances,
     never what I spent on — unless I let them help: then all my records, so they can) ·
     priv: everything, only for my own phones */
  function docsOf(m, s) {
    const help = S().helpOf(m);
    return {
      pub: { name: m.name, avatar: m.avatar, house: m.house, privacy: m.privacy, badges: m.badges || {}, joined: m.joined, logw: S().logWeeks(m), streak: m.play ? { n: m.play.streak, d: m.play.day } : null, bb: m.bb || null, yard: m.yard || null, help },
      // share: 'full' marks the family's copy of the whole book (my own phones never take it back)
      money: { pf: help ? Object.assign({}, m.pf, { share: 'full' }) : FF.ledger.shareView(m.pf) },
      // gems, streak and what you bought: only your own phones
      priv: { email: m.email || '', prefs: m.prefs || {}, budgets: m.budgets || [], seen: s.seen || {}, pf: m.pf, play: m.play || null, help: m.helpSet != null ? !!m.helpSet : null }
    };
  }
  /* who may download my portfolio, and whether family may leave changes in my help mailbox
     (both enforced by the database rules) */
  function shareOf(m) {
    const who = {}, help = S().helpOf(m);
    let all = help;
    S().SECTIONS.forEach((k) => {
      const p = m.privacy && m.privacy[k];
      if (!p || p.mode === 'family') all = true;
      else if (p.mode === 'some') (p.who || []).forEach((id) => { who[id] = true; });
    });
    return { all, who, help };
  }
  const sharesWith = (m, viewer) => m.help === true || S().SECTIONS.some((k) => { const p = m.privacy && m.privacy[k]; return !p || p.mode === 'family' || (p.mode === 'some' && (p.who || []).indexOf(viewer) !== -1); });

  /* after every local save: note what changed (persisted, so offline edits are sent later) */
  function track() {
    const s = st(), m = S().me();
    if (quiet || !s || !s.uid || !m) return;
    const sync = s.sync || (s.sync = {});
    const docs = docsOf(m, s);
    let changed = false;
    DOCS.forEach((k) => {
      const h = digest(docs[k]);
      const x = sync[k] || (sync[k] = {});
      if (x.h === h) return;
      if (x.base == null) x.base = baseOf(x);
      x.h = h; x.rev = Math.max(Date.now(), (x.rev || 0) + 1); x.dirty = true; changed = true;
    });
    if (changed) S().persist();
    flush();
  }
  /* send whatever the cloud doesn't have yet */
  function flush() {
    const s = st(), m = S().me();
    if (!mine || !mineSeen || !connected || quiet || !s || !m || s.uid !== myId()) return;
    const sync = s.sync || (s.sync = {});
    const docs = docsOf(m, s);
    const upd = {};
    DOCS.forEach((k) => {
      const x = sync[k];
      if (x && x.dirty && inflight[k] !== x.rev) { upd[P + 'm/' + s.uid + '/' + k] = JSON.stringify({ rev: x.rev, by: devId(), d: docs[k] }); inflight[k] = x.rev; }
    });
    const share = shareOf(m), sj = JSON.stringify(share);
    if (sync.share !== sj && inflight.share !== sj) { upd[P + 'm/' + s.uid + '/share'] = share; inflight.share = sj; }
    Object.assign(upd, familyDiff());
    if (!Object.keys(upd).length) { helpFlush(); return; }
    const sent = Object.assign({}, inflight);
    db.ref().update(upd).then(() => {
      DOCS.forEach((k) => { const x = sync[k]; if (x && sent[k] != null) { x.base = Math.max(x.base || 0, sent[k]); if (x.rev === sent[k]) x.dirty = false; } if (inflight[k] === sent[k]) delete inflight[k]; });
      if (sent.share) { sync.share = sent.share; if (inflight.share === sent.share) delete inflight.share; }
      S().persist();
      flush();
    }).catch((e) => {
      DOCS.concat('share').forEach((k) => { if (inflight[k] === sent[k]) delete inflight[k]; });
      console.warn('FamFi sync:', e && (e.code || e.message));
      FF.emit('cloud-error', e);
    });
  }
  function adopt(m, s, k, d) {
    if (k === 'pub') Object.assign(m, { name: d.name, avatar: d.avatar, house: d.house, privacy: d.privacy || m.privacy, badges: d.badges || {}, joined: d.joined, bb: d.bb || m.bb, yard: d.yard || m.yard || null });
    if (k === 'priv' && d.play) m.play = d.play;
    if (k === 'priv') { if (d.help === true || d.help === false) m.helpSet = d.help; else delete m.helpSet; }
    // my own records come from priv; money is only the family's summary (older versions kept everything there)
    if (k === 'money' && d.pf && !d.pf.share) { S().learnAssets(d.pf); m.pf = d.pf; }
    if (k === 'priv') {
      Object.assign(m, { email: d.email || m.email, prefs: d.prefs || m.prefs });
      if (d.pf) { S().learnAssets(d.pf); m.pf = d.pf; }
      if (d.budgets) m.budgets = d.budgets;
      else if (d.budget) { m.budget = d.budget; delete m.budgets; }
      S().upgradeMember(m);
      s.seen = d.seen || {};
      if (s.family) s.family.seen = s.seen;
    }
  }
  /* the cloud version this phone's copy was built on (phones from before 2.21 kept none: a copy
     with unsent changes then counts as built on nothing, so it is combined, never sent over the top) */
  const baseOf = (x) => (x.base != null ? x.base : x.dirty ? 0 : x.rev || 0);
  /* The cloud has a copy this phone never saw while this phone changed things too (an old copy
     reopened, or two phones used offline): keep both — the cloud's copy plus everything added here
     (records, accounts, budgets, pets, plants; an automatic dividend found on both counts once).
     Before 2.21 the later clock simply won, and an old copy could wipe out newer records. */
  const union = (a, b, same) => { a = a || []; return a.concat((b || []).filter((x) => x && x.id && !a.some((y) => y && (y.id === x.id || (same && same(x, y)))))); };
  function merge(m, s, k, d) {
    if (k === 'money') return; // the family's summary of my records: rebuilt from them, never taken back
    if (k === 'pub') {
      const y0 = S().yardOf(m);
      adopt(m, s, k, d);
      const y = S().yardOf(m);
      m.yard = { pets: union(y.pets, y0.pets), plants: union(y.plants, y0.plants), burn: y.burn || y0.burn };
      return;
    }
    const pf0 = m.pf, budgets0 = m.budgets, seen0 = s.seen, x0 = m.prefs && m.prefs.x;
    adopt(m, s, k, d);
    // bills, savings goals and the watchlist (Family Finance 3) live in the settings: keep both sides'
    if (x0 && m.prefs && m.prefs.x !== x0) {
      const x = S().extras(m, true);
      x.bills = union(x.bills, x0.bills); x.goals = union(x.goals, x0.goals);
      (x0.watch || []).forEach((sym) => { if (x.watch.indexOf(sym) === -1) x.watch.push(sym); });
      if (x0.nz) x.nz = Object.assign({}, x0.nz, x.nz);
    }
    if (pf0 && m.pf && m.pf !== pf0) {
      m.pf.txns = union(m.pf.txns, pf0.txns, (x, y) => !!x.ref && x.ref === y.ref);
      m.pf.accounts = union(m.pf.accounts, pf0.accounts);
      if (pf0.assets) m.pf.assets = Object.assign({}, pf0.assets, m.pf.assets);
      if (pf0.divSkip) m.pf.divSkip = (m.pf.divSkip || []).concat(pf0.divSkip.filter((r) => (m.pf.divSkip || []).indexOf(r) === -1));
    }
    if (Array.isArray(budgets0) && Array.isArray(m.budgets) && m.budgets !== budgets0) m.budgets = union(m.budgets, budgets0);
    if (seen0 && s.seen !== seen0) { s.seen = Object.assign({}, seen0, s.seen); if (s.family) s.family.seen = s.seen; }
  }
  /* my documents changed in the cloud (another of my phones, or my own write echoing back) */
  function onMine(snap) {
    const s = st(), m = S().me();
    if (!s || !m || s.uid !== myId()) return;
    const v = snap.val() || {};
    const sync = s.sync || (s.sync = {});
    const took = [];
    DOCS.forEach((k) => {
      const c = parse(v[k]);
      const x = sync[k] || (sync[k] = {});
      const base = baseOf(x);
      const own = c && (!c.by || c.by === devId()); // copies saved before 2.21 carry no id: go by the revision alone
      if (c && own && (c.rev === x.rev || c.rev === inflight[k])) { x.base = Math.max(base, c.rev); if (c.rev === x.rev) x.dirty = false; return; } // my own write
      if (c && c.rev > base) {
        // the cloud has a copy this phone never saw. Nothing changed here meanwhile: take it.
        // Something did (an old copy reopened, or two phones used offline): keep both.
        const both = !!x.dirty;
        quiet++; if (both) merge(m, s, k, c.d); else adopt(m, s, k, c.d); quiet--;
        const h = digest(docsOf(m, s)[k]);
        sync[k] = both ? { h, rev: Math.max(Date.now(), c.rev + 1), base: c.rev, dirty: true } : { h, rev: c.rev, base: c.rev };
        took.push(k);
      } else if (!c || c.rev < (x.rev || 0)) { x.base = base; x.dirty = true; } // the cloud is missing it or has an older copy: send ours
    });
    mineSeen = true;
    if (took.length) { S().persist(); FF.emit('change', { reason: 'remote' }); if (took.indexOf('priv') !== -1) FF.emit('cloud-prefs'); }
    if (v.fam && (!fam || fam.id !== v.fam)) watchFamily(v.fam);
    else if (!v.fam && fam) gone('removed');
    else if (!v.fam && !fam && s.family && !s.family.demo) leftFamily('left');
    flush();
  }
  function attach() {
    const s = st();
    if (!db || !user || !s || s.uid !== user.uid || mine) return;
    mineSeen = false;
    mine = db.ref(P + 'm/' + user.uid);
    mine.on('value', onMine, (e) => console.warn('FamFi profile:', e && e.code));
  }
  function detach() {
    if (mine) { mine.off(); mine = null; }
    mineSeen = false;
    dropFamily();
  }

  /* ---------------- the family ---------------- */
  const goalOut = (g) => ({ text: g.text, by: g.by, at: g.at, ts: g.ts || 0, done: g.done ? { by: g.done.by, day: g.done.day } : null });
  function fromCloud(fid, v) {
    const goals = Object.keys(v.goals || {}).map((id) => Object.assign({ id }, goalOut(v.goals[id])))
      .sort((a, b) => a.at - b.at || a.ts - b.ts || (a.id < b.id ? -1 : 1));
    const layout = {};
    Object.keys(v.layout || {}).forEach((k) => { layout[k] = { i: v.layout[k].i, j: v.layout[k].j }; });
    return { id: fid, name: v.name || '', code: v.code || '', ownerId: v.ownerId || '', created: v.created || FF.today(), members: Object.keys(v.members || {}), goals, layout, pets: Object.assign({}, v.pets), invites: [], hall: hallFromCloud(v.hall), help: helpFromCloud(v.help) };
  }
  /* the help mailboxes: { member: { key: { by, at, op } } } (anything unreadable is left out) */
  function helpFromCloud(h) {
    const out = {};
    Object.keys(h || {}).forEach((t) => {
      const box = h[t] || {};
      Object.keys(box).forEach((k) => {
        const e = box[k];
        let op = null;
        try { op = e && typeof e.o === 'string' ? JSON.parse(e.o) : null; } catch (x) { op = null; }
        if (!e || typeof e.by !== 'string' || !op || typeof op !== 'object' || typeof op.k !== 'string') return;
        (out[t] = out[t] || {})[k] = { by: e.by, at: +e.at || 0, op, sent: 1 }; // it's in the cloud: sent
      });
    });
    return out;
  }
  function hallFromCloud(h) {
    if (!h || !h.name) return null;
    const accounts = {};
    Object.keys(h.accounts || {}).forEach((aid) => {
      const a = h.accounts[aid];
      if (!a || !a.name) return;
      const entries = {};
      Object.keys(a.entries || {}).forEach((eid) => { const e = a.entries[eid]; entries[eid] = { t: e.t === 'add' ? 'add' : 'set', amt: +e.amt || 0, day: e.day, note: e.note || '', by: e.by || '', ts: e.ts || 0 }; });
      accounts[aid] = { name: a.name, kind: a.kind || 'other', cur: a.cur || 'MYR', by: a.by || '', at: a.at || 0, entries };
    });
    return { name: h.name, by: h.by || '', at: h.at || 0, accounts };
  }
  /* the hall, key by key (several people may be updating different assets at once) */
  const HALL_FIELDS = ['name', 'kind', 'cur', 'by', 'at'];
  function hallDiff(lh, ch, b, upd) {
    if (!lh) return;
    ch = ch || { accounts: {} };
    ['name', 'by', 'at'].forEach((k) => { if (lh[k] !== ch[k] && lh[k] != null) upd[b + 'hall/' + k] = lh[k]; });
    const la = lh.accounts || {}, ca = ch.accounts || {};
    Object.keys(la).forEach((aid) => {
      const a = la[aid], c = ca[aid] || { entries: {} }, ab = b + 'hall/accounts/' + aid + '/';
      HALL_FIELDS.forEach((k) => { if (a[k] !== c[k] && a[k] != null) upd[ab + k] = a[k]; });
      const le = a.entries || {}, ce = c.entries || {};
      Object.keys(le).forEach((eid) => { if (JSON.stringify(le[eid]) !== JSON.stringify(ce[eid])) upd[ab + 'entries/' + eid] = le[eid]; });
      Object.keys(ce).forEach((eid) => { if (!le[eid]) upd[ab + 'entries/' + eid] = null; });
    });
    Object.keys(ca).forEach((aid) => { if (!la[aid]) upd[b + 'hall/accounts/' + aid] = null; });
  }
  function orderMembers(f) {
    const s = st();
    const j = (id) => { const m = s.members[id]; return m && m.joined != null ? m.joined : 1e9; };
    f.members.sort((a, b) => j(a) - j(b) || (a < b ? -1 : 1));
  }
  function watchFamily(fid) {
    dropFamily();
    fam = { id: fid, ref: db.ref(P + 'f/' + fid), cloud: null, first: true, fresh: {} };
    const me = fam;
    fam.ref.on('value', onFamily, () => { if (fam === me && auth && auth.currentUser) gone('removed'); });
    liveAttach(fid);
  }
  function dropFamily() {
    liveDetach();
    if (fam) { fam.ref.off(); fam = null; }
    Object.keys(watched).forEach(unwatch);
  }
  function onFamily(snap) {
    const s = st(), me = myId();
    if (!fam || !s || !me || s.uid !== me) return;
    const v = snap.val();
    if (!v || !v.members || !v.members[me]) { gone('removed'); return; }
    const f = fromCloud(fam.id, v);
    const before = s.family && s.family.id === f.id ? s.family.members.slice() : null;
    fam.cloud = clone(f);
    // what I recorded for someone that hasn't gone out yet (made offline, or just now) stays —
    // the cloud's copy can't know about it. Sent ones that are gone have been taken in.
    const old = s.family && s.family.id === f.id ? s.family.help : null;
    if (old) Object.keys(old).forEach((t) => Object.keys(old[t]).forEach((k) => { const e = old[t][k]; if (e && e.by === me && !e.sent && !(f.help[t] && f.help[t][k])) (f.help[t] = f.help[t] || {})[k] = e; }));
    quiet++;
    s.family = f;
    f.seen = s.seen || (s.seen = {});
    f.members.forEach((x) => { if (x !== me) watch(x); });
    Object.keys(watched).forEach((x) => { if (f.members.indexOf(x) === -1) unwatch(x); });
    Object.keys(s.members).forEach((x) => { if (x !== me && f.members.indexOf(x) === -1) delete s.members[x]; });
    orderMembers(f);
    S().me().role = f.ownerId === me ? 'owner' : 'member';
    quiet--;
    const first = fam.first;
    fam.first = false;
    // someone new moved in: their house pops up once we know what it looks like
    if (!first && before) f.members.forEach((x) => { if (x !== me && before.indexOf(x) === -1) fam.fresh[x] = 1; });
    S().tidyLayout(); // anything left outside the (smaller again) map moves back in; sent with the next save
    const helped = S().applyHelp(); // what the family recorded for me: into my records (sent with this save)
    f.members.forEach((x) => { if (x !== me) S().refreshHelp(x); });
    const pets = S().evaluatePets(first);
    const badges = S().evaluateBadges(me, first);
    S().save();
    FF.emit('change', { reason: 'remote' });
    if (first) FF.emit('cloud-family', f);
    if (pets.length || badges.length) FF.emit('celebrate', { pets, badges });
    if (helped.length) FF.emit('help-applied', helped);
  }
  function watch(x) {
    if (watched[x]) return;
    const w = watched[x] = { pub: db.ref(P + 'm/' + x + '/pub'), money: db.ref(P + 'm/' + x + '/money'), moneyOn: false };
    w.pub.on('value', (snap) => onPub(x, snap.val()), () => {});
  }
  function unwatch(x) {
    const w = watched[x];
    if (!w) return;
    w.pub.off(); w.money.off();
    delete watched[x];
  }
  function onPub(x, raw) {
    const s = st(), w = watched[x];
    const c = parse(raw);
    if (!s || !fam || !w || !c) return;
    const d = c.d;
    const m = s.members[x] || (s.members[x] = { id: x, key: 'custom', pf: S().emptyPf(), _noMoney: true, budget: { on: false, income: 0, cats: [], spends: [] }, prefs: {} });
    Object.assign(m, { name: d.name, avatar: d.avatar, house: d.house, privacy: d.privacy || {}, badges: d.badges || {}, joined: d.joined, logw: d.logw || [], streak: d.streak || null, bb: d.bb || null, yard: d.yard || null, help: d.help === true });
    m.role = s.family && s.family.ownerId === x ? 'owner' : 'member';
    // their portfolio: listen while they share anything with me, drop it the moment they don't
    if (sharesWith(m, s.uid)) {
      if (!w.moneyOn) {
        w.moneyOn = true;
        w.money.on('value', (snap) => onMoney(x, snap.val()), () => { w.moneyOn = false; onMoney(x, null); });
      }
    } else {
      if (w.moneyOn) { w.money.off(); w.moneyOn = false; }
      onMoney(x, null, true);
    }
    if (s.family) orderMembers(s.family);
    S().persist();
    FF.emit('change', { reason: 'remote' });
    if (fam.fresh[x]) { delete fam.fresh[x]; FF.emit('member-joined', { id: x }); }
  }
  function onMoney(x, raw, silent) {
    const s = st(), m = s && s.members[x];
    if (!m) return;
    const c = parse(raw);
    if (c && c.d.pf) { S().learnAssets(c.d.pf); m.pf = c.d.pf; m._noMoney = false; } else { m.pf = S().emptyPf(m.pf && m.pf.base); m._noMoney = true; }
    delete m._pf0;
    S().refreshHelp(x); // anything the family recorded for them that their phone hasn't taken in yet
    if (!silent) { S().persist(); FF.emit('change', { reason: 'remote' }); }
  }
  function gone(why) { if (joining) dropFamily(); else leftFamily(why); }
  function leftFamily(why) {
    const s = st();
    const name = s && s.family ? s.family.name : '';
    const fid = fam ? fam.id : s && s.family && s.family.id;
    dropFamily();
    if (!s) return;
    quiet++;
    Object.keys(s.members).forEach((x) => { if (x !== s.uid) delete s.members[x]; });
    s.family = null;
    quiet--;
    S().persist();
    // forget the family we were removed from — unless another of my phones has already moved on
    if (why === 'removed' && db && user && fid) db.ref(P + 'm/' + user.uid + '/fam').transaction((cur) => (cur === fid ? null : cur)).catch(() => {});
    FF.emit('family-gone', { why, name });
    FF.emit('change', { reason: 'remote' });
  }
  /* local family edits → only the keys that changed (others may be editing too) */
  function familyDiff() {
    const s = st(), f = s && s.family;
    if (!fam || !fam.cloud || !f || f.id !== fam.id) return {};
    const c = fam.cloud, b = P + 'f/' + fam.id + '/', upd = {};
    if (f.name !== c.name && c.ownerId === s.uid) { upd[b + 'name'] = f.name; upd[P + 'codes/' + c.code + '/n'] = f.name; }
    const gl = {}, gc = {};
    f.goals.forEach((g) => { gl[g.id] = goalOut(g); });
    c.goals.forEach((g) => { gc[g.id] = goalOut(g); });
    Object.keys(gl).forEach((id) => { if (JSON.stringify(gl[id]) !== JSON.stringify(gc[id])) upd[b + 'goals/' + id] = gl[id]; });
    Object.keys(gc).forEach((id) => { if (!gl[id]) upd[b + 'goals/' + id] = null; });
    Object.keys(f.layout).forEach((k) => { const p = f.layout[k], q = c.layout[k]; if (!q || p.i !== q.i || p.j !== q.j) upd[b + 'layout/' + k] = { i: p.i, j: p.j }; });
    Object.keys(c.layout).forEach((k) => { if (k.indexOf('pl_') === 0 && !f.layout[k]) upd[b + 'layout/' + k] = null; }); // a plant that was sold
    Object.keys(f.pets || {}).forEach((p) => { if (c.pets[p] !== f.pets[p]) upd[b + 'pets/' + p] = f.pets[p]; });
    hallDiff(f.hall, c.hall, b, upd);
    if (Object.keys(upd).length) { const seen = f.seen, h = fam.cloud.help; delete f.seen; fam.cloud = clone(f); fam.cloud.help = h; f.seen = seen; }
    return upd;
  }
  /* The help mailboxes, sent on their own: a change for someone who has just stopped letting
     the family help is refused by the database — that must never hold up anything else. New
     changes go one at a time; emptied ones (mine, once applied) only after my records have
     reached the cloud, so a helper never sees their change vanish and come back. */
  let helpBusy = false;
  function helpFlush() {
    const s = st(), f = s && s.family;
    if (helpBusy || !fam || !fam.cloud || !f || f.id !== fam.id || !connected || !mineSeen || quiet) return;
    const lh = f.help || {}, ch = fam.cloud.help || (fam.cloud.help = {}), b = P + 'f/' + fam.id + '/help/';
    const docsBusy = DOCS.some((k) => (s.sync && s.sync[k] && s.sync[k].dirty) || inflight[k] != null);
    const del = {};
    if (!docsBusy) Object.keys(ch).forEach((t) => Object.keys(ch[t]).forEach((k) => { if (!(lh[t] && lh[t][k])) del[b + t + '/' + k] = null; }));
    let add = null;
    Object.keys(lh).some((t) => Object.keys(lh[t]).some((k) => { if (ch[t] && ch[t][k]) return false; add = { t, k, e: lh[t][k] }; return true; }));
    if (!Object.keys(del).length && !add) return;
    helpBusy = true;
    const done = () => { helpBusy = false; helpFlush(); };
    if (Object.keys(del).length) {
      db.ref().update(del).then(() => {
        Object.keys(del).forEach((p) => { const q = p.slice(b.length).split('/'); if (ch[q[0]]) { delete ch[q[0]][q[1]]; if (!Object.keys(ch[q[0]]).length) delete ch[q[0]]; } });
        done();
      }, (e) => { helpBusy = false; console.warn('FamFi help:', e && (e.code || e.message)); });
      return;
    }
    const e = add.e;
    db.ref().update({ [b + add.t + '/' + add.k]: { by: e.by, at: e.at, o: JSON.stringify(e.op) } }).then(() => {
      e.sent = 1; // out: if it later disappears, their phone has taken it in
      (ch[add.t] = ch[add.t] || {})[add.k] = e;
      S().persist();
      done();
    }, (err) => {
      helpBusy = false;
      if (!/PERMISSION/i.test((err && (err.code || err.message)) || '')) return; // offline etc.: tried again later
      // they don't let the family help (any more), or left: this change can't be delivered
      const box = f.help && f.help[add.t];
      if (box) { delete box[add.k]; if (!Object.keys(box).length) delete f.help[add.t]; }
      S().refreshHelp(add.t);
      S().persist();
      FF.emit('change', { reason: 'remote' });
      FF.emit('help-refused', { id: add.t });
      helpFlush();
    });
  }
  function waitFamily(ms) {
    return new Promise((res) => {
      if (S().family()) return res(true);
      const off = FF.on('cloud-family', () => { off(); clearTimeout(k); res(true); });
      const k = setTimeout(() => { off(); res(!!S().family()); }, ms);
    });
  }
  async function freeCode(name) {
    for (let k = 0; k < 6; k++) {
      const code = S().makeCode(name);
      const snap = await timeout(db.ref(P + 'codes/' + code).once('value'));
      if (!snap.exists()) return code;
    }
    throw fail('busy');
  }
  const send = (upd) => timeout(db.ref().update(upd), 20000);

  /* ---------------- account actions ---------------- */
  async function signUp(email, password, profile, opts) {
    await ready();
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    user = cred.user;
    S().createAccount(Object.assign({}, profile, { email }), user.uid, opts);
    attach();
    return user.uid;
  }
  /* → { profile: false } when the sign-in works but this person has never used FamFi */
  async function signIn(email, password) {
    await ready();
    const cred = await auth.signInWithEmailAndPassword(email, password);
    user = cred.user;
    detach();
    const s0 = st();
    if (s0 && s0.uid === user.uid && S().me()) {
      // the same person signing back in (e.g. an expired session): keep this phone's copy —
      // anything changed here meanwhile is newer and gets sent, anything newer in the cloud comes in
      attach();
      await waitFamily(s0.family ? 8000 : 2500);
      return { profile: true, family: !!S().family() };
    }
    const v = (await timeout(db.ref(P + 'm/' + user.uid).once('value'))).val() || {};
    const docs = {};
    DOCS.forEach((k) => { const c = parse(v[k]); if (c) docs[k] = c; });
    if (!docs.pub) return { profile: false };
    S().loadAccount(user.uid, { pub: docs.pub && docs.pub.d, money: docs.money && docs.money.d, priv: docs.priv && docs.priv.d }, email);
    const s = st(), m = S().me(), now = docsOf(m, s);
    s.sync = {};
    DOCS.forEach((k) => { s.sync[k] = docs[k] ? { h: digest(now[k]), rev: docs[k].rev, base: docs[k].rev } : { h: digest(now[k]), rev: Date.now(), base: 0, dirty: true }; });
    S().persist();
    attach();
    if (v.fam) await waitFamily(8000);
    return { profile: true, family: !!S().family() };
  }
  /* signed in, but no FamFi profile yet (e.g. a sign-in made before FamFi had accounts of its own) */
  async function completeProfile(profile, opts) {
    await ready();
    if (!user) throw fail('signed-out');
    S().createAccount(Object.assign({}, profile, { email: user.email || profile.email || '' }), user.uid, opts);
    attach();
  }
  async function resetPassword(email, lang) {
    await ready();
    auth.languageCode = { zh: 'zh-CN', th: 'th' }[lang] || 'en';
    await auth.sendPasswordResetEmail(email);
  }
  /* boot with a saved cloud account: 'ok' | 'signed-out' | 'offline' */
  async function resume() {
    try { await ready(); } catch (e) { return 'offline'; }
    const s = st();
    if (user && s && user.uid === s.uid) { attach(); return 'ok'; }
    return 'signed-out';
  }
  async function signOut() {
    detach();
    if (auth) await auth.signOut().catch(() => {});
    user = null;
  }
  async function deleteAccount(password) {
    await online();
    const u = auth.currentUser;
    await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, password));
    if (S().family()) await leaveFamily();
    detach();
    await timeout(db.ref(P + 'm/' + u.uid).remove(), 20000);
    // FamFi is the only app on this sign-in now: deleting the account removes the sign-in too
    await u.delete();
    user = null;
    return { deleted: true };
  }

  /* ---------------- family actions ---------------- */
  async function lookup(code) {
    await online();
    const v = (await timeout(db.ref(P + 'codes/' + code).once('value'))).val();
    return v && v.f ? v : null;
  }
  async function createFamily(name) {
    await online();
    if (S().family()) await leaveFamily();
    const uid = user.uid;
    const fid = db.ref(P + 'f').push().key;
    const code = await freeCode(name);
    quiet++;
    S().createFamily(name, { id: fid, code });
    quiet--;
    const f = S().family();
    const b = P + 'f/' + fid + '/', upd = {};
    upd[b + 'ownerId'] = uid; upd[b + 'code'] = code; upd[b + 'name'] = f.name; upd[b + 'created'] = f.created;
    upd[b + 'members/' + uid] = code;
    Object.keys(f.layout).forEach((k) => { upd[b + 'layout/' + k] = { i: f.layout[k].i, j: f.layout[k].j }; });
    Object.keys(f.pets).forEach((p) => { upd[b + 'pets/' + p] = f.pets[p]; });
    upd[P + 'codes/' + code] = { f: fid, n: f.name };
    upd[P + 'm/' + uid + '/fam'] = fid;
    try { await send(upd); } catch (e) { const s = st(); s.family = null; S().persist(); throw e; }
    S().save();
    return f;
  }
  async function joinFamily(code) {
    await online();
    const info = await lookup(code);
    if (!info) throw fail('not-found');
    if (fam && fam.id === info.f) return info;
    if (S().family()) await leaveFamily();
    const upd = {};
    upd[P + 'f/' + info.f + '/members/' + user.uid] = code;
    upd[P + 'm/' + user.uid + '/fam'] = info.f;
    joining = true;
    try {
      try { await send(upd); } catch (e) { throw /PERMISSION/i.test(e.code || e.message || '') ? fail('not-found') : e; }
      if (!(await waitFamily(10000))) throw fail('timeout');
    } finally { joining = false; }
    S().placeMe();
    return info;
  }
  async function leaveFamily() {
    await online();
    const s = st(), f = s.family, uid = user.uid;
    if (!f || f.demo) return;
    const b = P + 'f/' + f.id + '/', upd = {};
    const rest = f.members.filter((x) => x !== uid);
    if (!rest.length && f.ownerId === uid) { upd[P + 'f/' + f.id] = null; upd[P + 'codes/' + f.code] = null; }
    else {
      if (f.ownerId === uid) upd[b + 'ownerId'] = rest[0]; // the longest-standing member looks after it
      upd[b + 'members/' + uid] = null;
      upd[b + 'layout/' + uid] = null;
    }
    upd[P + 'm/' + uid + '/fam'] = null;
    dropFamily();
    quiet++;
    Object.keys(s.members).forEach((x) => { if (x !== uid) delete s.members[x]; });
    s.family = null;
    quiet--;
    S().save();
    await send(upd);
  }
  async function removeMember(x) {
    await online();
    const f = S().family();
    if (!f || f.ownerId !== user.uid || x === user.uid) return null;
    const code = await freeCode(f.name);
    const b = P + 'f/' + f.id + '/', upd = {};
    upd[b + 'members/' + x] = null; upd[b + 'layout/' + x] = null;
    upd[b + 'code'] = code; upd[P + 'codes/' + f.code] = null; upd[P + 'codes/' + code] = { f: f.id, n: f.name };
    await send(upd);
    return code;
  }
  async function newCode() {
    await online();
    const f = S().family();
    if (!f || f.ownerId !== user.uid) return null;
    const code = await freeCode(f.name);
    const upd = {};
    upd[P + 'f/' + f.id + '/code'] = code; upd[P + 'codes/' + f.code] = null; upd[P + 'codes/' + code] = { f: f.id, n: f.name };
    await send(upd);
    return code;
  }

  /* ---------------- Block Blast, live: who's playing, and watching them ----------------
     famfi/live/<fid>/on/<uid>          { at }   playing right now — gone when they stop, put the app
                                                 away or drop offline (the server removes it then)
     famfi/live/<fid>/g/<uid>           the game as blast.pack() writes it, sent ONLY while someone watches
     famfi/live/<fid>/eye/<uid>/<who>   at       <who> is watching <uid>
     famfi/live/<fid>/chat/<uid>/<id>   { u, at, t | e }   the chat beside <uid>'s game (see below)
     The family listens to on/ alone, which changes only when a game starts or stops. A game's moves
     reach just the people watching it; nobody watching = nothing sent but "I'm playing". */
  const live = { fid: null, ref: null, on: {}, me: null, eye: null, want: null, chat: null };
  const liveNow = () => Date.now() + (skew || 0);
  const lbase = () => P + 'live/' + live.fid;
  const quietly = (p) => { if (p && p.catch) p.catch(() => {}); };
  const onLeave = (path, how) => { const r = db.ref(path); if (r.onDisconnect) quietly(r.onDisconnect()[how]()); };
  const lsend = (upd) => quietly(db.ref(lbase()).update(upd));
  const familyIds = () => { const f = S().family(); return f && !f.demo ? f.members : []; };
  function liveAttach(fid) {
    liveDetach();
    live.fid = fid;
    const r = live.ref = db.ref(lbase() + '/on');
    r.on('value', (s) => { if (live.ref !== r) return; live.on = s.val() || {}; FF.emit('live', { k: 'on' }); }, () => { if (live.ref === r) live.on = {}; });
    if (live.want) { const w = live.want; live.want = null; livePlay(w === true ? null : w); }
  }
  function liveDetach() {
    if (!live.fid) return;
    liveQuit(); liveUnwatch(); chatDetach();
    if (live.ref) live.ref.off();
    live.fid = null; live.ref = null; live.on = {};
    FF.emit('live', { k: 'on' });
  }
  /* back online after a drop: the server cleared what we'd left behind, so say it again */
  function liveResume() {
    if (!live.fid || !user) return;
    if (live.me && live.me.playing) livePlay(live.me.state);
    const w = live.eye;
    if (w) { onLeave(lbase() + '/eye/' + w.uid + '/' + myId(), 'remove'); lsend({ ['eye/' + w.uid + '/' + myId()]: liveNow() }); }
  }
  const watchedBy = () => (live.me ? Object.keys(live.me.eyes).filter((u) => u !== myId()) : []);
  const gOut = () => Object.assign({}, live.me.state, { at: liveNow() });
  function liveSend() { if (live.me && live.me.state && live.fid) lsend({ ['g/' + myId()]: gOut() }); }
  /* I'm playing (again): tell the family, and listen for anyone who starts watching */
  function livePlay(state) {
    if (!db || !user) return;
    if (!live.fid) { live.want = state || true; return; }
    const me = myId(), b = lbase();
    if (!live.me) {
      const m = live.me = { eyes: {}, state: null, playing: false, ref: db.ref(b + '/eye/' + me) };
      m.ref.on('value', (s) => {
        if (live.me !== m) return;
        const before = m.eyes;
        m.eyes = s.val() || {};
        const fresh = Object.keys(m.eyes).filter((u) => u !== me && !before[u]);
        if (fresh.length) liveSend(); // someone new: show them the game as it is
        FF.emit('live', { k: 'eyes', fresh });
      }, () => {});
      chatAttach(me);
    }
    if (state) live.me.state = state;
    live.me.playing = true;
    onLeave(b + '/on/' + me, 'remove'); onLeave(b + '/g/' + me, 'remove');
    const upd = { ['on/' + me]: { at: liveNow() } };
    if (watchedBy().length && live.me.state) upd['g/' + me] = gOut();
    lsend(upd);
  }
  /* a move — sent only if someone is watching */
  function liveMove(state) { if (!live.me) return; live.me.state = state; if (watchedBy().length) liveSend(); }
  /* the game ended: watchers get the final board, and I'm no longer "playing" */
  function liveOver(state) {
    if (!live.me) return;
    live.me.state = state; live.me.playing = false;
    const upd = { ['on/' + myId()]: null };
    if (watchedBy().length) upd['g/' + myId()] = gOut();
    lsend(upd);
  }
  /* left the game (closed it, or put the app away): nothing of it stays behind */
  function liveQuit() {
    live.want = null;
    const m = live.me;
    if (!m) return;
    live.me = null;
    m.ref.off();
    if (live.chat && live.chat.room === myId()) chatDetach();
    if (!db || !user || !live.fid) return;
    const me = myId(), b = lbase();
    lsend({ ['on/' + me]: null, ['g/' + me]: null });
    onLeave(b + '/on/' + me, 'cancel'); onLeave(b + '/g/' + me, 'cancel');
  }
  /* watch someone's game: cb(their latest game, or null) after every move they make */
  function liveWatch(uid, cb) {
    liveUnwatch();
    if (!db || !user || !live.fid || uid === myId()) return false;
    const b = lbase(), me = myId();
    const w = live.eye = { uid, g: db.ref(b + '/g/' + uid), v: db.ref(b + '/eye/' + uid), viewers: {} };
    onLeave(b + '/eye/' + uid + '/' + me, 'remove');
    lsend({ ['eye/' + uid + '/' + me]: liveNow() });
    w.g.on('value', (s) => { if (live.eye === w) cb(s.val()); }, () => { if (live.eye === w) cb(null); });
    w.v.on('value', (s) => { if (live.eye !== w) return; w.viewers = s.val() || {}; FF.emit('live', { k: 'viewers' }); }, () => {});
    chatAttach(uid);
    return true;
  }
  function liveUnwatch() {
    const w = live.eye;
    if (!w) return;
    live.eye = null;
    w.g.off(); w.v.off();
    if (live.chat && live.chat.room === w.uid) chatDetach();
    if (!db || !user || !live.fid) return;
    lsend({ ['eye/' + w.uid + '/' + myId()]: null });
    onLeave(lbase() + '/eye/' + w.uid + '/' + myId(), 'cancel');
  }
  /* ---------------- the chat beside a live game ----------------
     The player and whoever watches them share one small room: words and emoji. It's emptied
     when the player opens the game, takes messages only while the game is live (database
     rules: from the player, or someone watching them), and the player keeps it to the last 40.
     Only the player and their watchers listen — nobody else downloads a thing. */
  const CHAT_KEEP = 40;
  const okMsg = (x) => !!x && typeof x.u === 'string' && (typeof x.t === 'string' || typeof x.e === 'string');
  function chatAttach(room) {
    if (!db || !user || !live.fid || !room) return;
    if (live.chat && live.chat.room === room) return;
    chatDetach();
    const c = live.chat = { room, ref: db.ref(lbase() + '/chat/' + room), msgs: [], seen: null };
    c.ref.on('value', (snap) => {
      if (live.chat !== c) return;
      const v = snap.val() || {};
      const all = Object.keys(v).sort().map((id) => Object.assign({ id }, v[id])).filter(okMsg);
      const prev = c.seen;
      c.seen = {};
      all.forEach((x) => { c.seen[x.id] = 1; });
      const fresh = prev ? all.filter((x) => !prev[x.id]) : []; // the first look is history, not news
      c.msgs = all.slice(-CHAT_KEEP);
      if (room === myId() && all.length > CHAT_KEEP + 10) { const upd = {}; all.slice(0, all.length - CHAT_KEEP).forEach((x) => { upd['chat/' + room + '/' + x.id] = null; }); lsend(upd); }
      FF.emit('live', { k: 'chat', fresh });
    }, () => {});
  }
  function chatDetach() { const c = live.chat; if (!c) return; live.chat = null; c.ref.off(); }
  /* a new game screen: last time's chat is cleared away */
  function chatReset() { if (db && user && live.fid) lsend({ ['chat/' + myId()]: null }); }
  function chatPost(body) {
    const c = live.chat;
    if (!c || !db || !user || !live.fid) return Promise.resolve(false);
    const id = c.ref.push().key;
    return db.ref(lbase()).update({ ['chat/' + c.room + '/' + id]: Object.assign({ u: myId(), at: liveNow() }, body) }).then(() => true, () => false);
  }
  const chatSay = (text) => { const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 140); return t ? chatPost({ t }) : Promise.resolve(false); };
  const chatReact = (e) => (typeof e === 'string' && e && e.length <= 16 ? chatPost({ e }) : Promise.resolve(false));

  const liveApi = {
    ok: () => !!(db && user && live.fid && S().mode() === 'cloud'),
    play: livePlay, move: liveMove, over: liveOver, quit: liveQuit, watch: liveWatch, unwatch: liveUnwatch,
    /* family members playing right now (not me), longest-playing first */
    playing: () => { const me = myId(), ids = familyIds(); return Object.keys(live.on).filter((u) => u !== me && ids.indexOf(u) !== -1 && live.on[u] && live.on[u].at).map((u) => ({ uid: u, at: live.on[u].at })).sort((a, b) => a.at - b.at); },
    isPlaying: (uid) => !!(live.on[uid] && live.on[uid].at),
    watchers: () => { const ids = familyIds(); return watchedBy().filter((u) => ids.indexOf(u) !== -1); },      // watching me
    viewers: () => { const w = live.eye, ids = familyIds(); return w ? Object.keys(w.viewers).filter((u) => ids.indexOf(u) !== -1) : []; }, // watching who I watch
    watching: () => (live.eye ? live.eye.uid : null),
    now: liveNow,
    // the chat beside the game I'm playing or watching
    chat: () => (live.chat ? live.chat.msgs : []),
    chatRoom: () => (live.chat ? live.chat.room : null),
    say: chatSay, react: chatReact, chatReset
  };

  /* start loading in the background; keep the local copy in step with the cloud */
  function boot() {
    FF.on('saved', track);
    if (S().mode() === 'cloud') ready().catch(() => {});
    root.addEventListener && root.addEventListener('online', () => { if (S().mode() === 'cloud' && !mine) resume().catch(() => {}); });
  }

  FF.cloud = {
    boot, ready, resume, status, serverDay, signUp, signIn, completeProfile, resetPassword, signOut, deleteAccount,
    lookup, createFamily, joinFamily, leaveFamily, removeMember, newCode, live: liveApi,
    // exposed for tests
    _: { docsOf, shareOf, sharesWith, fromCloud, goalOut, familyDiff, digest, parse, hallFromCloud, helpFromCloud, helpFlush }
  };
})(typeof window !== 'undefined' ? window : this);
