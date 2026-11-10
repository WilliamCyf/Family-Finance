/* FamFi tests — an in-memory stand-in for Firebase (Auth + Realtime Database compat API)
   that enforces the real database.rules.json, so several "phones" (vm contexts) can be
   tested against one shared database. Node only.

   Rules semantics implemented (strict side of the real ones):
   • .read / .write cascade: granted if any rule from the root down to the path says yes.
   • a write needs a grant at its own path or above (deeper rules don't grant).
   • .validate runs (for non-null new data) at the written path, every ancestor and every
     written descendant; `$other: { .validate: false }` blocks unknown keys.
   • multi-path update(): all-or-nothing; root/data = before, newData = after.
   • listeners are NOT revoked when sharing changes (worst case for the client). */
'use strict';
(function (root) {
const tick = typeof setImmediate === 'function' ? setImmediate : (fn) => setTimeout(fn, 0);

const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const segs = (p) => String(p || '').split('/').filter(Boolean);
function getAt(tree, p) { let n = tree; for (const s of segs(p)) { if (n == null || typeof n !== 'object') return null; n = n[s]; } return n === undefined ? null : n; }
function setAt(tree, p, v) {
  const ss = segs(p);
  if (!ss.length) return v == null ? {} : clone(v);
  let n = tree;
  const stack = [];
  for (let i = 0; i < ss.length - 1; i++) {
    if (n[ss[i]] == null || typeof n[ss[i]] !== 'object') { if (v == null) return tree; n[ss[i]] = {}; }
    stack.push([n, ss[i]]);
    n = n[ss[i]];
  }
  const last = ss[ss.length - 1];
  if (v == null || (typeof v === 'object' && !Object.keys(v).length)) delete n[last]; else n[last] = clean(clone(v));
  for (let i = stack.length - 1; i >= 0; i--) { const [o, k] = stack[i]; if (o[k] && typeof o[k] === 'object' && !Object.keys(o[k]).length) delete o[k]; }
  return tree;
}
function clean(v) { // RTDB drops nulls and empty objects
  if (v == null || typeof v !== 'object') return v;
  Object.keys(v).forEach((k) => { v[k] = clean(v[k]); if (v[k] == null || (typeof v[k] === 'object' && !Object.keys(v[k]).length)) delete v[k]; });
  return v;
}

class RuleSnap {
  constructor(tree, path) { this.t = tree; this.p = segs(path).join('/'); }
  val() { return clone(getAt(this.t, this.p)); }
  exists() { return getAt(this.t, this.p) !== null; }
  child(c) { return new RuleSnap(this.t, this.p + '/' + String(c)); }
  parent() { const s = segs(this.p); if (!s.length) throw new Error('no parent'); s.pop(); return new RuleSnap(this.t, s.join('/')); }
  hasChild(c) { return this.child(c).exists(); }
  hasChildren(a) { const v = getAt(this.t, this.p); if (!v || typeof v !== 'object') return false; return a ? a.every((k) => v[k] != null) : true; }
  isString() { return typeof getAt(this.t, this.p) === 'string'; }
  isNumber() { return typeof getAt(this.t, this.p) === 'number'; }
  isBoolean() { return typeof getAt(this.t, this.p) === 'boolean'; }
}

class Server {
  constructor(rules) { // the parsed database.rules.json
    this.rules = rules.rules;
    this.data = {};
    this.users = {};          // email -> { uid, password }
    this.clients = new Set();
    this.n = 0;
    this.log = [];
    this.sessions = {};       // phone name -> signed-in email
  }
  /* evaluate one rule expression */
  ev(expr, ctx) {
    if (expr === true || expr === false) return expr;
    const names = Object.keys(ctx.vars);
    try {
      // eslint-disable-next-line no-new-func
      const f = new Function('auth', 'root', 'data', 'newData', 'now', ...names, '"use strict"; return (' + expr + ');');
      return f(ctx.auth, ctx.root, ctx.data, ctx.newData, Date.now(), ...names.map((k) => ctx.vars[k])) === true;
    } catch (e) { return false; } // an error in a rule = denied
  }
  /* rule nodes along a path: [{ node, path, vars }] (stops where no rule matches) */
  walk(path) {
    const out = [{ node: this.rules, path: '', vars: {} }];
    let node = this.rules, vars = {}, p = '';
    for (const s of segs(path)) {
      let next = node[s], v = vars;
      if (!next) { const w = Object.keys(node).find((k) => k[0] === '$'); if (w) { next = node[w]; v = Object.assign({}, vars, { [w]: s }); } }
      p = p ? p + '/' + s : s;
      if (!next) break;
      out.push({ node: next, path: p, vars: v });
      node = next; vars = v;
    }
    return out;
  }
  canRead(auth, path) {
    return this.walk(path).some((l) => l.node['.read'] != null && this.ev(l.node['.read'], { auth, root: new RuleSnap(this.data, ''), data: new RuleSnap(this.data, l.path), newData: null, vars: l.vars }));
  }
  /* multi-path update: { path: value|null } relative to the root */
  update(auth, upd) {
    const before = this.data;
    let after = clone(before) || {};
    for (const p of Object.keys(upd)) after = setAt(after, p, upd[p]);
    const root = new RuleSnap(before, '');
    for (const p of Object.keys(upd)) {
      const levels = this.walk(p);
      const full = levels.length === segs(p).length + 1;
      const ok = levels.some((l) => l.node['.write'] != null && this.ev(l.node['.write'], { auth, root, data: new RuleSnap(before, l.path), newData: new RuleSnap(after, l.path), vars: l.vars }));
      if (!ok) return this.deny('write', p, auth);
      // validation: ancestors + the path itself…
      for (const l of levels) {
        if (l.node['.validate'] == null || getAt(after, l.path) === null) continue;
        if (!this.ev(l.node['.validate'], { auth, root, data: new RuleSnap(before, l.path), newData: new RuleSnap(after, l.path), vars: l.vars })) return this.deny('validate', l.path, auth);
      }
      // …and everything written below it
      if (full && upd[p] != null && typeof upd[p] === 'object') {
        const last = levels[levels.length - 1];
        const bad = this.validateBelow(auth, root, before, after, last.node, last.path, last.vars, upd[p]);
        if (bad) return this.deny('validate', bad, auth);
      }
    }
    this.data = clean(after) || {};
    this.log.push(upd);
    this.clients.forEach((c) => c._changed());
    return null;
  }
  validateBelow(auth, root, before, after, node, path, vars, value) {
    for (const k of Object.keys(value)) {
      let next = node[k], v = vars;
      if (!next) { const w = Object.keys(node).find((x) => x[0] === '$'); if (w) { next = node[w]; v = Object.assign({}, vars, { [w]: k }); } }
      if (!next) continue;
      const p = path + '/' + k;
      if (next['.validate'] != null && getAt(after, p) !== null && !this.ev(next['.validate'], { auth, root, data: new RuleSnap(before, p), newData: new RuleSnap(after, p), vars: v })) return p;
      if (value[k] && typeof value[k] === 'object') { const bad = this.validateBelow(auth, root, before, after, next, p, v, value[k]); if (bad) return bad; }
    }
    return null;
  }
  deny(kind, p, auth) {
    const e = new Error('PERMISSION_DENIED: Permission denied');
    e.code = 'PERMISSION_DENIED'; e.kind = kind; e.path = p; e.uid = auth && auth.uid;
    return e;
  }
}

/* one phone's `firebase` global (compat API surface used by FamFi) */
function makeFirebase(server, name) {
  const client = { name, user: null, listeners: [], connected: true, authCbs: [], conn: [], od: {} };
  const authOf = () => (client.user ? { uid: client.user.uid, token: { email: client.user.email } } : null);
  const snap = (v) => ({ val: () => clone(v), exists: () => v !== null && v !== undefined });
  function fire(l, force) {
    const v = getAt(server.data, l.path);
    const j = JSON.stringify(v);
    if (!force && j === l.last) return;
    l.last = j;
    tick(() => { if (client.listeners.indexOf(l) !== -1) l.cb(snap(clone(v))); });
  }
  client._changed = () => { if (client.connected) client.listeners.forEach((l) => fire(l)); };
  client._recheck = () => {
    client.listeners.slice().forEach((l) => {
      if (!server.canRead(authOf(), l.path)) { client.listeners.splice(client.listeners.indexOf(l), 1); const e = server.deny('read', l.path, authOf()); tick(() => l.cancel && l.cancel(e)); }
    });
  };
  function ref(path) {
    path = segs(path).join('/');
    return {
      key: segs(path).pop() || null,
      on(ev, cb, cancel) {
        if (path === '.info/connected') { client.conn.push(cb); tick(() => cb(snap(client.connected))); return cb; }
        if (!server.canRead(authOf(), path)) { const e = server.deny('read', path, authOf()); tick(() => cancel && cancel(e)); return cb; }
        const l = { path, cb, cancel, last: undefined };
        client.listeners.push(l);
        if (client.connected) fire(l, true);
        return cb;
      },
      off() { client.listeners = client.listeners.filter((l) => l.path !== path); },
      once() {
        return new Promise((res, rej) => tick(() => {
          if (!client.connected) return; // waits forever offline, like the SDK
          if (!server.canRead(authOf(), path)) return rej(server.deny('read', path, authOf()));
          res(snap(getAt(server.data, path)));
        }));
      },
      update(obj) {
        const upd = {};
        Object.keys(obj).forEach((k) => { upd[(path ? path + '/' : '') + segs(k).join('/')] = obj[k]; });
        return new Promise((res, rej) => tick(() => { const err = server.update(authOf(), upd); if (err) rej(err); else res(); }));
      },
      remove() { return ref('').update({ [path]: null }); },
      transaction(fn) {
        return new Promise((res, rej) => tick(() => {
          const nv = fn(clone(getAt(server.data, path)));
          if (nv === undefined) return res({ committed: false });
          const err = server.update(authOf(), { [path]: nv });
          if (err) rej(err); else res({ committed: true });
        }));
      },
      push() { server.n++; return ref(path + '/-F' + String(server.n).padStart(6, '0')); },
      // the server removes these when this phone drops off (run with the auth it had when set up)
      onDisconnect() {
        return {
          remove() { client.od[path] = authOf(); return Promise.resolve(); },
          cancel() { delete client.od[path]; return Promise.resolve(); }
        };
      },
      child(c) { return ref(path + '/' + c); }
    };
  }
  function setUser(u) {
    client.user = u;
    server.sessions[name] = u ? u.email : null; // like Firebase: stay signed in across reloads
    client._recheck();
    client.authCbs.forEach((cb) => tick(() => cb(u)));
  }
  function userObj(rec, email) {
    return {
      uid: rec.uid, email,
      reauthenticateWithCredential(c) { return rec.password === c.password && c.email === email ? Promise.resolve() : Promise.reject(Object.assign(new Error('wrong'), { code: 'auth/wrong-password' })); },
      delete() { delete server.users[email]; setUser(null); return Promise.resolve(); }
    };
  }
  const auth = {
    get currentUser() { return client.user; },
    languageCode: 'en',
    onAuthStateChanged(cb) { client.authCbs.push(cb); tick(() => { if (client.authCbs.indexOf(cb) !== -1) cb(client.user); }); return () => { client.authCbs = client.authCbs.filter((x) => x !== cb); }; },
    createUserWithEmailAndPassword(email, pw) {
      return new Promise((res, rej) => tick(() => {
        if (server.users[email]) return rej(Object.assign(new Error('exists'), { code: 'auth/email-already-in-use' }));
        if (String(pw).length < 6) return rej(Object.assign(new Error('weak'), { code: 'auth/weak-password' }));
        server.n++;
        const rec = server.users[email] = { uid: 'uid' + server.n + name.replace(/\W/g, ''), password: pw };
        const u = userObj(rec, email);
        setUser(u);
        res({ user: u });
      }));
    },
    signInWithEmailAndPassword(email, pw) {
      return new Promise((res, rej) => tick(() => {
        const rec = server.users[email];
        if (!rec || rec.password !== pw) return rej(Object.assign(new Error('bad'), { code: 'auth/invalid-credential' }));
        const u = userObj(rec, email);
        setUser(u);
        res({ user: u });
      }));
    },
    signOut() { setUser(null); return Promise.resolve(); },
    sendPasswordResetEmail() { return Promise.resolve(); },
    useEmulator() {}
  };
  const db = { ref, useEmulator() {} };
  const app = { name: 'famfi', auth: () => auth, database: () => db };
  const firebase = {
    apps: [],
    initializeApp(cfg, n) { app.name = n; firebase.apps.push(app); return app; },
    auth: Object.assign(() => auth, { EmailAuthProvider: { credential: (email, password) => ({ email, password }) } }),
    database: () => db
  };
  client.setConnected = (on) => {
    if (!on && client.connected) { // dropped: the server runs this phone's onDisconnect() work
      const od = client.od;
      client.od = {};
      Object.keys(od).forEach((p) => server.update(od[p], { [p]: null }));
    }
    client.connected = on;
    client.conn.forEach((cb) => tick(() => cb(snap(on))));
    if (on) client.listeners.forEach((l) => fire(l));
  };
  client.ref = ref;
  client.firebase = firebase;
  const kept = server.sessions[name];
  if (kept && server.users[kept]) client.user = userObj(server.users[kept], kept);
  server.clients.add(client);
  return client;
}

const api = { Server, makeFirebase, getAt };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FakeBase = api;
})(typeof window !== 'undefined' ? window : this);
