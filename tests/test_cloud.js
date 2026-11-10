/* FamFi — accounts + shared families, end to end across several "phones".
   Each phone is its own JS context running the real store.js + cloud.js; they share one
   in-memory database that enforces the real database.rules.json (see fakebase.js).
   Run: node FamFi/tests/test_cloud.js */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { Server, makeFirebase, getAt } = require('./fakebase');

const ROOT = path.join(__dirname, '..');
const FILES = ['js/core.js', 'js/data.js', 'js/calc.js', 'js/ledger.js', 'js/books.js', 'js/recur.js', 'js/plan.js', 'js/play.js', 'js/lucky.js', 'js/blast.js', 'js/grid.js', 'js/store.js', 'js/cloud.js'];
// a phone that was never updated: FamFi 2.25's own store, sync and ledger code (kept in tests/old)
const OLD_FILES = ['js/core.js', 'js/data.js', 'js/calc.js', 'tests/old/ledger-2.25.js', 'js/play.js', 'js/lucky.js', 'js/blast.js', 'js/grid.js', 'tests/old/store-2.25.js', 'tests/old/cloud-2.25.js'];
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  ✗ ' + msg); } }
const near2 = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, msg + ' (' + a + ' vs ' + b + ')');
const settle = async (n) => { for (let i = 0; i < (n || 40); i++) await new Promise((r) => setImmediate(r)); };
async function rejects(p, code, msg) {
  try { await p; ok(false, msg + ' (expected ' + code + ', but it worked)'); }
  catch (e) { ok(!code || e.code === code, msg + ' (got ' + (e && e.code) + ')'); }
}
function storage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
function phone(server, name, store, files) {
  const fb = makeFirebase(server, name);
  const ctx = { console, setTimeout, clearTimeout, setImmediate, localStorage: store || storage(), firebase: fb.firebase, FAMFI_FIREBASE: { apiKey: 'test' } };
  ctx.window = ctx;
  vm.createContext(ctx);
  (files || FILES).forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  const FF = ctx.FF;
  FF.store.init({});
  FF.cloud.boot();
  const events = [];
  ['member-joined', 'family-gone', 'cloud-family', 'cloud-signed-out', 'celebrate'].forEach((e) => FF.on(e, (d) => events.push([e, d])));
  return { FF, S: FF.store, C: FF.cloud, fb, ctx, events, name, storage: ctx.localStorage };
}
const AV = (style) => ({ kind: 'illus', style, skin: '#F1C7A0', hair: '#2B2320', bg: '#CFEBC9', shirt: '#2F8F46' });
const buy = (P, sym, q, p) => P.S.addTxn({ type: 'buy', day: P.FF.today() - 30, sym, q, p, fee: 0, cur: 'USD', acct: 'a1' });

async function main() {
  const server = new Server(JSON.parse(fs.readFileSync(process.env.FAMFI_RULES || path.join(ROOT, 'database.rules.json'), 'utf8')));
  const raw = (u, p) => new Promise((res) => u.fb.ref(p).once().then((s) => res({ ok: true, v: s.val() }), (e) => res({ ok: false, e })));
  const write = (u, upd) => u.fb.ref('').update(upd).then(() => true, (e) => e);

  console.log('0. invite codes');
  const P0 = phone(server, 'p0');
  ok(P0.S.normalizeCode(' tan-4k7qx ') === 'TAN-4K7QX' && P0.S.normalizeCode('TAN4K7QX') === 'TAN-4K7QX', 'codes are tidied up (case, dash, spaces)');
  ok(P0.S.normalizeCode('TAN-4K7Q') === null && P0.S.normalizeCode('') === null, 'short codes are rejected');
  ok(/^FAM-/.test(P0.S.makeCode('陈家')) && /^SUK-/.test(P0.S.makeCode('Sukhum')) && /^TAN-/.test(P0.S.makeCode('The Tan Family')), 'code prefix comes from the family name');
  const many = new Set(); for (let i = 0; i < 2000; i++) many.add(P0.S.makeCode('Tan'));
  ok(many.size > 1990, 'codes are random (' + many.size + '/2000 unique)');
  server.clients.delete(P0.fb);

  /* ---------------- 1. the reported bug: create → share code → sister joins THE SAME family ---------------- */
  console.log('1. create a family, sister joins with the code');
  const me = phone(server, 'me');
  await me.C.signUp('me@example.com', 'secret-123', { name: 'Jamie', avatar: AV('spiky') });
  await settle();
  ok(me.S.mode() === 'cloud', 'me: signed-up account is a cloud account');
  const uidMe = me.S.state.uid;
  ok(getAt(server.data, 'famfi/m/' + uidMe + '/pub'), 'me: profile saved to the cloud');
  buy(me, 'AAPL', 10, 200);
  await settle();
  const fam = await me.C.createFamily('The Tan Family');
  await settle();
  const code = me.S.family().code;
  ok(/^TAN-[A-Z2-9]{5}$/.test(code), 'invite code looks like TAN-XXXXX (' + code + ')');
  ok(getAt(server.data, 'famfi/codes/' + code + '/f') === fam.id, 'code points at the family');
  ok(getAt(server.data, 'famfi/f/' + fam.id + '/members/' + uidMe) === code, 'creator is a member');

  const sis = phone(server, 'sis');
  await sis.C.signUp('sis@example.com', 'secret-456', { name: 'Mei', avatar: AV('bob') });
  await settle();
  const uidSis = sis.S.state.uid;
  const found = await sis.C.lookup(code);
  ok(found && found.f === fam.id && found.n === 'The Tan Family', 'sister: code finds "The Tan Family" before joining');
  await sis.C.joinFamily(code);
  await settle(80);
  ok(sis.S.family() && sis.S.family().id === fam.id, 'sister: joined MY family (not a demo family)');
  ok(!sis.S.family().demo, 'sister: family is real, not demo');
  ok(sis.S.family().members.length === 2, 'sister: sees 2 members');
  ok(sis.S.member(uidMe) && sis.S.member(uidMe).name === 'Jamie', 'sister: sees Jamie');
  ok(sis.S.member(uidMe).pf.txns.length === 1, 'sister: sees Jamie’s shared portfolio');
  ok(me.S.family().members.indexOf(uidSis) !== -1, 'me: sister appears in my family');
  ok(me.S.member(uidSis) && me.S.member(uidSis).name === 'Mei', 'me: sees Mei');
  ok(me.events.some((e) => e[0] === 'member-joined' && e[1].id === uidSis), 'me: "moved in" event for Mei');
  ok(me.S.family().layout[uidSis] && sis.S.family().layout[uidMe], 'both houses placed on both phones');
  ok(!Object.keys(me.S.state.members).some((id) => /^m_/.test(id)), 'no demo people anywhere');
  ok(me.S.family().pets.puppy, 'puppy unlocks with 2 members (both phones agree)');

  /* ---------------- 2. wrong codes and strangers ---------------- */
  console.log('2. wrong codes, strangers and the database rules');
  const stranger = phone(server, 'stranger');
  await stranger.C.signUp('x@example.com', 'secret-789', { name: 'X', avatar: AV('short') });
  await settle();
  ok((await stranger.C.lookup('ZZZ-99999')) === null, 'unknown code → not found');
  await rejects(stranger.C.joinFamily('ZZZ-99999'), 'not-found', 'joining with an unknown code fails');
  ok(!stranger.S.family(), 'stranger: still no family');
  const uidX = stranger.S.state.uid;
  ok((await raw(stranger, 'famfi/f/' + fam.id)).ok === false, 'stranger can’t read the family');
  ok((await raw(stranger, 'famfi/m/' + uidMe + '/pub')).ok === false, 'stranger can’t read my profile');
  ok((await raw(stranger, 'famfi/m/' + uidMe + '/money')).ok === false, 'stranger can’t read my money');
  ok((await raw(stranger, 'famfi/m/' + uidMe)).ok === false, 'stranger can’t read my account');
  ok((await raw(stranger, 'famfi/codes')).ok === false, 'nobody can list all codes');
  ok((await raw(stranger, 'famfi/f')).ok === false, 'nobody can list families');
  ok((await write(stranger, { ['famfi/f/' + fam.id + '/members/' + uidX]: 'TAN-AAAAA' })) !== true, 'stranger can’t join with a made-up code');
  ok((await write(stranger, { ['famfi/f/' + fam.id + '/goals/gX']: { text: 'hi', by: uidX, at: 1 } })) !== true, 'stranger can’t add family goals');
  ok((await write(stranger, { ['famfi/f/' + fam.id + '/ownerId']: uidX })) !== true, 'stranger can’t take over the family');
  ok((await write(stranger, { ['famfi/f/' + fam.id + '/code']: 'XXX-11111' })) !== true, 'stranger can’t change the code');
  ok((await write(stranger, { ['famfi/codes/' + code]: { f: 'other', n: 'x' } })) !== true, 'stranger can’t hijack the code');
  ok((await write(stranger, { ['famfi/codes/' + code]: null })) !== true, 'stranger can’t delete the code');
  ok((await write(stranger, { ['famfi/m/' + uidMe + '/money']: '{}' })) !== true, 'stranger can’t change my money');
  ok((await write(stranger, { ['famfi/f/' + fam.id]: null })) !== true, 'stranger can’t delete the family');
  ok((await write(sis, { ['famfi/f/' + fam.id + '/name']: 'Mei’s' })) !== true, 'members can’t rename (owner only)');
  ok((await write(sis, { ['famfi/f/' + fam.id + '/members/' + uidMe]: null })) !== true, 'members can’t remove others');
  ok((await write(sis, { ['famfi/m/' + uidMe + '/pub']: '{}' })) !== true, 'members can’t edit each other’s profile');
  ok((await raw({ fb: makeFirebase(server, 'anon') }, 'famfi/codes/' + code)).ok === false, 'signed-out visitors can’t look up codes');
  const fakeCode = await write(stranger, { ['famfi/f/evil/ownerId']: uidX, ['famfi/f/evil/code']: code, ['famfi/f/evil/members/' + uidX]: code });
  ok(fakeCode === true, '(anyone may create their own family)');
  ok((await write(stranger, { ['famfi/codes/' + code]: { f: 'evil', n: 'Evil' } })) !== true, '…but can’t steal an existing code for it');

  /* ---------------- 3. live family features ---------------- */
  console.log('3. goals, village and renames sync live');
  const g = me.S.addGoal('Save for Penang');
  await settle();
  ok(sis.S.family().goals.some((x) => x.id === g.id && x.text === 'Save for Penang'), 'sister sees my new goal');
  sis.S.toggleGoal(g.id);
  await settle();
  const mg = me.S.family().goals.find((x) => x.id === g.id);
  ok(mg && mg.done && mg.done.by === uidSis, 'I see she ticked it');
  sis.S.addGoal('Learn about dividends');
  me.S.addGoal('Emergency fund');
  await settle();
  ok(me.S.family().goals.length === 3 && sis.S.family().goals.length === 3, 'goals added at the same time on two phones both survive');
  const del = me.S.deleteGoal(g.id);
  await settle();
  ok(!sis.S.family().goals.some((x) => x.id === g.id), 'deleted goal disappears for her');
  me.S.restoreGoal(del);
  await settle();
  ok(sis.S.family().goals.some((x) => x.id === g.id), 'undo brings it back for her too');
  const L = sis.S.family().layout[uidSis];
  sis.S.moveObject(uidSis, L.i + 1, L.j);
  await settle();
  ok(me.S.family().layout[uidSis].i === L.i + 1, 'I see her house move');
  me.S.renameFamily('Tan Family 🏡');
  await settle();
  ok(sis.S.family().name === 'Tan Family 🏡', 'rename reaches her');
  ok(getAt(server.data, 'famfi/codes/' + code + '/n') === 'Tan Family 🏡', 'code shows the new name');
  me.S.setHouse(uidMe, Object.assign({}, me.S.me().house, { roofColor: '#123456' }));
  await settle();
  ok(sis.S.member(uidMe).house.roofColor === '#123456', 'she sees my new roof colour');

  // a stock found through live search reaches her phone with my purchase
  me.FF.data.addAsset({ s: 'RDXQ', n: 'Looked-up Co', t: 'stock', sec: 'tech', x: 'NYSE', p: 40 });
  buy(me, 'RDXQ', 4, 40);
  await settle();
  ok(sis.FF.data.asset('RDXQ') && sis.FF.data.asset('RDXQ').n === 'Looked-up Co', 'sister’s phone learns a looked-up stock from my portfolio');
  ok(sis.FF.calc.summary(sis.S.member(uidMe).pf, 'USD').holdings.some((h) => h.sym === 'RDXQ'), '…and sees it in my holdings');

  /* ---------------- 4. privacy is enforced by the database ---------------- */
  console.log('4. privacy');
  ['netWorth', 'holdings', 'returns', 'dividends'].forEach((k) => sis.S.setPrivacy(k, 'me'));
  buy(sis, 'VOO', 2, 500);
  await settle();
  ok((await raw(me, 'famfi/m/' + uidSis + '/money')).ok === false, 'hide everything → the database refuses her money to me');
  ok(me.S.member(uidSis)._noMoney && me.S.member(uidSis).pf.txns.length === 0, 'and my phone holds none of her numbers');
  ok(!me.S.canSee(uidMe, uidSis, 'netWorth'), 'her net worth shows as private');
  sis.S.setPrivacy('netWorth', 'some', [uidMe]);
  await settle(80);
  ok((await raw(me, 'famfi/m/' + uidSis + '/money')).ok === true, 'share with me only → I may read it');
  ok((await raw(stranger, 'famfi/m/' + uidSis + '/money')).ok === false, '…a stranger still may not');
  ok(me.S.member(uidSis).pf.txns.length === 1 && me.S.canSee(uidMe, uidSis, 'netWorth'), 'my phone picks her numbers up again');
  ok(!me.S.canSee(uidMe, uidSis, 'holdings'), 'sections she still hides stay hidden');
  ['netWorth', 'holdings', 'returns', 'dividends'].forEach((k) => sis.S.setPrivacy(k, 'family'));
  await settle(80);
  ok((await raw(me, 'famfi/m/' + uidSis + '/priv')).ok === false, 'budgets & settings are never shared');

  /* ---------------- 5. my second phone + offline edits ---------------- */
  console.log('5. second phone, offline edits');
  const me2 = phone(server, 'me-ipad');
  const r = await me2.C.signIn('me@example.com', 'secret-123');
  await settle(80);
  ok(r.profile && r.family, 'second phone: sign in finds profile + family');
  ok(me2.S.me().pf.txns.length === 2 && me2.S.family().id === fam.id, 'second phone: same records and family');
  ok(me2.S.member(uidSis) && me2.S.member(uidSis).name === 'Mei', 'second phone: sees Mei');
  buy(me2, 'NVDA', 3, 120);
  await settle(80);
  ok(me.S.me().pf.txns.length === 3, 'first phone gets the trade made on the second');
  ok(sis.S.member(uidMe).pf.txns.length === 3, 'sister sees it too');
  me.fb.setConnected(false);
  await settle();
  buy(me, 'KO', 5, 60);
  await settle();
  ok(me.S.state.sync.money.dirty === true, 'offline trade is kept and marked to send');
  ok(JSON.parse(me.storage.getItem('famfi.v1')).sync.money.dirty === true, '…and that survives closing the app');
  ok(me2.S.me().pf.txns.length === 3, 'nothing sent while offline');
  me.fb.setConnected(true);
  await settle(80);
  ok(me2.S.me().pf.txns.length === 4 && !me.S.state.sync.money.dirty, 'back online → sent, and the other phone has it');
  await rejects(me2.C.signIn('me@example.com', 'wrong-pw'), 'auth/invalid-credential', 'wrong password is refused');
  // a session that expires (signed out by Firebase, not by the person): edits made meanwhile survive signing back in
  await me2.fb.firebase.auth().signOut();
  await settle();
  ok(me2.events.some((e) => e[0] === 'cloud-signed-out'), 'expired session is noticed');
  buy(me2, 'MSFT', 1, 400);
  await settle();
  ok(me.S.me().pf.txns.length === 4, 'nothing is sent while signed out');
  await me2.C.signIn('me@example.com', 'secret-123');
  await settle(80);
  ok(me2.S.me().pf.txns.length === 5 && me.S.me().pf.txns.length === 5, 'signing back in keeps the edit made meanwhile and sends it');
  ok(me2.S.family() && me2.S.family().id === fam.id, '…and the family is still there');

  /* ---------------- 6. remove, rejoin, leave, ownership ---------------- */
  console.log('6. remove a member, new code, leave');
  const newCode = await me.C.removeMember(uidSis);
  await settle(80);
  ok(newCode && newCode !== code, 'removing someone makes a new code');
  ok(!sis.S.family() && sis.events.some((e) => e[0] === 'family-gone' && e[1].why === 'removed'), 'sister: told she’s no longer in the family');
  ok((await raw(sis, 'famfi/f/' + fam.id)).ok === false, 'sister can no longer read the family');
  ok((await raw(sis, 'famfi/m/' + uidMe + '/money')).ok === false, '…or my money');
  ok(!me.S.member(uidSis) && me.S.family().members.length === 1, 'me: she’s gone from my village');
  ok((await sis.C.lookup(code)) === null, 'old code stops working');
  await rejects(sis.C.joinFamily(code), 'not-found', 'rejoining with the old code fails');
  await sis.C.joinFamily(newCode);
  await settle(80);
  ok(sis.S.family() && sis.S.family().id === fam.id && me.S.member(uidSis), 'the new code lets her back in');
  await me.C.leaveFamily();
  await settle(80);
  ok(!me.S.family(), 'me: left');
  ok(sis.S.family().ownerId === uidSis && sis.S.me().role === 'owner', 'sister becomes the owner when the owner leaves');
  ok(!sis.S.member(uidMe), 'sister: my house is gone');
  ok(me2.S.family() === null || me2.events.some((e) => e[0] === 'family-gone'), 'my second phone leaves too');
  const c2 = sis.S.family().code;
  await sis.C.leaveFamily();
  await settle(80);
  ok(getAt(server.data, 'famfi/f/' + fam.id) === null && getAt(server.data, 'famfi/codes/' + c2) === null, 'last one out → family and code deleted');

  /* ---------------- 7. switching family via a new code ---------------- */
  console.log('7. switch families');
  const f2 = await me.C.createFamily('Lim Family');
  await settle();
  const f3 = await sis.C.createFamily('Mei’s Family');
  await settle();
  await me.C.joinFamily(sis.S.family().code);
  await settle(80);
  ok(me.S.family().id === f3.id && getAt(server.data, 'famfi/f/' + f2.id) === null, 'joining another family leaves (and cleans up) the old one');
  ok(sis.S.family().members.length === 2, 'sister sees me arrive in her family');

  /* ---------------- 8. made-before-accounts (legacy) phones keep their records ---------------- */
  console.log('8. upgrade a phone that used the old local-only version');
  const oldStore = storage();
  const old = phone(server, 'old', oldStore);
  old.S.createAccount({ name: 'Ah Ma', avatar: AV('bun') }); // no uid: how the old version made accounts
  buy(old, 'KO', 50, 55);
  old.S.markSeen('editTip');
  ok(old.S.mode() === 'legacy', 'old local account is detected');
  await old.C.signUp('ahma@example.com', 'secret-999', { name: 'Ah Ma', avatar: AV('bun') }, { legacy: true });
  await settle();
  ok(old.S.mode() === 'cloud' && old.S.me().pf.txns.length === 1 && old.S.state.seen.editTip, 'records and tips carried into the new account');
  ok(JSON.parse(getAt(server.data, 'famfi/m/' + old.S.state.uid + '/money')).d.pf.txns.length === 1, 'and saved to the cloud');

  /* ---------------- 9. the demo stays on the phone ---------------- */
  console.log('9. demo + delete account');
  const demo = phone(server, 'demo');
  demo.S.seedDemo('en');
  demo.S.save();
  await settle();
  ok(demo.S.mode() === 'demo' && server.log.every((u) => Object.keys(u).every((k) => k.indexOf('m_me') === -1)), 'demo family never reaches the cloud');

  const before = Object.keys(server.users).length;
  await rejects(sis.C.deleteAccount('nope'), 'auth/wrong-password', 'delete needs the right password');
  const del2 = await sis.C.deleteAccount('secret-456');
  await settle(80);
  ok(del2.deleted && Object.keys(server.users).length === before - 1, 'account deleted, sign-in and all');
  ok(getAt(server.data, 'famfi/m/' + uidSis) === null, 'her FamFi data is gone');
  ok(!me.S.member(uidSis) && me.S.family() && me.S.family().ownerId === uidMe, 'she left the family first; I’m the owner now');

  /* ---------------- 10. everyday money stays private; the Town Hall is shared ---------------- */
  console.log('10. everyday money, family copy, Town Hall');
  const ann = phone(server, 'ann');
  await ann.C.signUp('ann@example.com', 'secret-aaa', { name: 'Ann', avatar: AV('long') });
  await settle();
  const fA = await ann.C.createFamily('Lee Family');
  await settle();
  const ben = phone(server, 'ben');
  await ben.C.signUp('ben@example.com', 'secret-bbb', { name: 'Ben', avatar: AV('short') });
  await settle();
  await ben.C.joinFamily(ann.S.family().code);
  await settle(80);
  const uidAnn = ann.S.state.uid;
  const bank = ann.S.addAccount({ name: 'Public Bank', kind: 'bank', cur: 'MYR' }, 9000);
  ann.S.addTxn({ type: 'expense', day: ann.FF.today(), amt: 1234.5, cur: 'MYR', acct: bank.id, cat: 'shopping', note: 'Secret birthday present' });
  ann.S.addTxn({ type: 'income', day: ann.FF.today(), amt: 6000, cur: 'MYR', acct: bank.id, cat: 'salary', note: 'Salary Sept' });
  ann.S.addBudget({ amt: 2000, cats: ['shopping'] });
  await settle(80);
  // 2.25: family helpers (on unless you say no, or made anything private) see all your records
  const fullDoc = getAt(server.data, 'famfi/m/' + uidAnn + '/money');
  ok(fullDoc.indexOf('Secret birthday') !== -1 && getAt(server.data, 'famfi/m/' + uidAnn + '/share/help') === true, 'letting the family help: the family copy has every record');
  ok(ben.S.member(uidAnn).pf.txns.some((t) => t.note === 'Salary Sept') && ben.S.canHelp(uidAnn), 'Ben sees her records and may help');
  ann.S.setHelp(false);
  await settle(80);
  const moneyDoc = getAt(server.data, 'famfi/m/' + uidAnn + '/money');
  ok(moneyDoc.indexOf('Secret birthday') === -1 && moneyDoc.indexOf('Salary Sept') === -1 && moneyDoc.indexOf('shopping') === -1, 'help turned off: the family copy never says what was spent on');
  ok(!ben.S.canHelp(uidAnn) && !ben.S.member(uidAnn).pf.txns.some((t) => t.note === 'Salary Sept'), 'help turned off: Ben no longer sees her records, nor may help');
  ok(JSON.parse(getAt(server.data, 'famfi/m/' + uidAnn + '/priv')).d.pf.txns.some((t) => t.note === 'Secret birthday present'), 'my own records are kept privately, in full');
  const annSeenByBen = ben.S.member(uidAnn);
  near2(ben.FF.calc.summary(annSeenByBen.pf, 'MYR').value, ann.FF.calc.summary(ann.S.me().pf, 'MYR').value, 0.05, 'Ben sees Ann’s total exactly');
  ok(annSeenByBen.pf.accounts.some((a) => a.name === 'Public Bank') && !annSeenByBen.budgets, 'Ben sees her account balances, never her budgets');
  ok((await raw(ben, 'famfi/m/' + uidAnn + '/priv')).ok === false, 'the private copy is unreadable to family');
  const ann2 = phone(server, 'ann-ipad');
  await ann2.C.signIn('ann@example.com', 'secret-aaa');
  await settle(80);
  ok(ann2.S.me().pf.txns.some((t) => t.note === 'Secret birthday present') && ann2.S.me().budgets.length === 1, 'my second phone gets everything (records, budgets)');
  // the Town Hall
  ann.S.buildHall('Lee Hall');
  await settle(60);
  ok(ben.S.family().hall && ben.S.family().hall.name === 'Lee Hall', 'Ben sees the hall Ann built');
  const hid = ben.S.addHallAccount({ name: 'ASB fund', kind: 'fund', cur: 'MYR', value: 45000 });
  await settle(60);
  ok(ann.S.family().hall.accounts[hid] && ann.FF.ledger.hallBalance(ann.S.family().hall.accounts[hid]) === 45000, 'Ann sees the asset Ben added (RM 45,000)');
  ann.S.addHallEntry(hid, { t: 'set', amt: 47250, note: 'Yearly dividend' });
  ben.S.renameHall('Lee Family HQ');
  await settle(60);
  ok(ben.FF.ledger.hallBalance(ben.S.family().hall.accounts[hid]) === 47250 && ann.S.family().hall.name === 'Lee Family HQ', 'updates and renames from both sides arrive');
  ok(ann.FF.ledger.hallTotal(ann.S.family().hall, 'MYR') === 47250, 'hall total');
  const outsider = phone(server, 'outsider');
  await outsider.C.signUp('o@example.com', 'secret-ooo', { name: 'O', avatar: AV('bob') });
  await settle();
  ok((await write(outsider, { ['famfi/f/' + fA.id + '/hall/name']: 'Mine now' })) !== true, 'strangers can’t touch the hall');
  ok((await write(ben, { ['famfi/f/' + fA.id + '/hall/accounts/' + hid + '/entries/x']: { t: 'steal', amt: 1, day: 1 } })) !== true, 'hall entries are checked');
  ann.S.deleteHallAccount(hid);
  await settle(60);
  ok(!ben.S.family().hall.accounts[hid], 'a removed asset disappears for everyone');

  /* ---------------- 11. gems & the shop: mine on all my phones; family sees the house, not the gems ---------------- */
  console.log('11. gems, the daily gift and the shop');
  const g1 = ann.S.claimDaily();
  ok(g1.ok, 'Ann collects her daily gift');
  ann.S.playOf().pts += 2000; ann.S.save();
  const kite = ann.S.buyItem('kite'), bun = ann.S.buyItem('bunny');
  ok(kite.ok && bun.ok && bun.home, 'Ann buys a kite and a bunny');
  await settle(80);
  const a2p = ann2.S.me().play;
  ok(a2p && a2p.pts === ann.S.me().play.pts && a2p.streak === 1 && a2p.owned.kite && a2p.owned.bunny, 'her other phone has the same gems, streak and things (' + (a2p && a2p.pts) + ')');
  ok(!ann2.S.claimDaily().ok, 'the daily gift can’t be collected twice from another phone');
  const annOnBen = ben.S.member(uidAnn);
  ok(annOnBen.house.deco.sky === 'kite' && annOnBen.house.pets[0] === 'bunny', 'Ben sees Ann’s kite and her bunny in the village');
  ok(!annOnBen.play && annOnBen.streak && annOnBen.streak.n === 1, 'Ben sees her streak — but never her gems');
  const pubRaw = (await raw(ben, 'famfi/m/' + uidAnn + '/pub')).v;
  ok(pubRaw.indexOf('"pts"') === -1 && pubRaw.indexOf('owned') === -1, 'nothing about gems or purchases is in the shared profile');

  /* ---------------- 12. the map shrank back: houses left outside move in, for everyone ---------------- */
  console.log('12. houses outside the (smaller again) map move back in');
  const uidBen = ben.S.state.uid;
  ok((await write(ben, { ['famfi/f/' + fA.id + '/layout/' + uidBen]: { i: '<b>', j: 3 } })) !== true && (await write(ben, { ['famfi/f/' + fA.id + '/layout/' + uidBen]: { i: 4, j: null } })) !== true, 'a house spot that isn’t two numbers is refused (it would break everyone’s map)');
  ok((await write(ben, { ['famfi/f/' + fA.id + '/layout/' + uidBen]: { i: 70, j: -20 } })) === true, 'Ben’s house is out in the old bigger map’s meadow');
  await settle(120);
  const G = ann.FF.grid;
  const posOn = (P) => P.S.family().layout[uidBen];
  const inLandOn = (P) => { const p = posOn(P), c = G.center(p.i, p.j); return G.inLand(c.x, c.y); };
  ok(inLandOn(ann) && inLandOn(ben), 'it moves back onto the land');
  ok(JSON.stringify(posOn(ann)) === JSON.stringify(posOn(ben)), 'every phone agrees where it went');
  const cloudPos = (await raw(ann, 'famfi/f/' + fA.id + '/layout/' + uidBen)).v;
  ok(cloudPos && cloudPos.i === posOn(ann).i && cloudPos.j === posOn(ann).j, 'and the new spot is saved for the family');
  const occA = ann.S.occupied();
  ok(occA.every((o) => G.valid(o.i, o.j, occA, o.id)), 'nothing overlaps');

  /* ---------------- 13. Block Blast: one arcade per family, scores shared, gems private ---------------- */
  console.log('13. Block Blast: the arcade, the family ranking and the gems');
  const arcCloud = (await raw(ann, 'famfi/f/' + fA.id + '/layout/_arcade')).v;
  ok(arcCloud && JSON.stringify(arcCloud) === JSON.stringify(ben.S.family().layout._arcade), 'the family has an arcade, in the same spot on every phone');
  const newsCloud = (await raw(ann, 'famfi/f/' + fA.id + '/layout/_news')).v;
  ok(newsCloud && JSON.stringify(newsCloud) === JSON.stringify(ben.S.family().layout._news) && JSON.stringify(newsCloud) === JSON.stringify(ann.S.family().layout._news), 'the family has a News mailbox, in the same spot on every phone');
  const annPts = ann.S.playOf().pts;
  const bb1 = ann.S.blastFinish(1520);
  ok(bb1.gems === 5 && bb1.newBest, 'Ann scores 1,520 → 5 gems');
  ben.S.blastFinish(900);
  await settle(80);
  ok(ben.S.bbOf(ben.S.member(uidAnn)).best === 1520 && ann.S.bbOf(ann.S.member(uidBen)).best === 900, 'everyone sees each other’s best score');
  ok(ben.S.blastBoard('week')[0].m.id === uidAnn && ben.S.blastRank(uidBen, 'week') === 2, 'the ranking agrees on Ben’s phone (Ann first, Ben second)');
  ok(ann2.S.me().play.pts === annPts + 5 && ann2.S.bbOf(ann2.S.me()).games === 1, 'Ann’s other phone has her game gems and her game count');
  const annPub = (await raw(ben, 'famfi/m/' + uidAnn + '/pub')).v;
  ok(annPub.indexOf('"bb"') !== -1 && annPub.indexOf('"pts"') === -1, 'the shared profile carries the score, never the gems');
  const arcTo = G.nearestFree(G.PLAZA.x + 220, G.PLAZA.y + 120, ben.S.occupied().filter((o) => o.id !== '_arcade'), '_arcade');
  ben.S.moveObject('_arcade', arcTo.i, arcTo.j);
  await settle(80);
  ok(JSON.stringify(ann.S.family().layout._arcade) === JSON.stringify({ i: arcTo.i, j: arcTo.j }), 'Ben moves the arcade and Ann sees it move');

  /* ---------------- 14. the Lucky Market: pets and plants show for the family; selling and the Molotov sync ---------------- */
  console.log('14. Lucky Market: pets, plants and the Molotov across phones');
  const ap = ann.S.playOf(); ap.pts += 1000;
  ap.lucky = { day: ann.S.dayNow(), stock: ['seed', 'egg', 'molotov', 'treat', 'tonic', 'seed'], sold: [] };
  const sd = ann.S.buyLucky(0), eg = ann.S.buyLucky(1), mo = ann.S.buyLucky(2);
  ok(sd.ok && eg.ok && mo.ok, 'Ann buys a seed packet, an egg and a Molotov');
  await settle(80);
  const plantKey = 'pl_' + sd.plant.id;
  const annOnBen2 = ben.S.member(uidAnn);
  ok(ben.S.family().layout[plantKey] && ben.S.yardOf(annOnBen2).plants.some((x) => x.id === sd.plant.id), 'Ben sees Ann\'s new plant on the map');
  ok(ben.S.yardOf(annOnBen2).pets.some((x) => x.id === eg.pet.id && x.sp === eg.pet.sp), 'Ben sees the pet Ann hatched');
  ok((await raw(ben, 'famfi/m/' + uidAnn + '/pub')).v.indexOf('"pts"') === -1, 'still no gems in the shared profile');
  ok(ann.S.throwMolotov(uidBen).ok, 'Ann throws the Molotov at Ben\'s house');
  await settle(80);
  ok(ben.S.burns()[uidBen] && ben.S.burns()[uidBen].indexOf(uidAnn) !== -1, 'Ben\'s phone shows his house on fire (from Ann)');
  ann.S.sellPlant(sd.plant.id);
  await settle(80);
  ok(!ben.S.family().layout[plantKey] && (await raw(ann, 'famfi/f/' + fA.id + '/layout/' + plantKey)).v == null, 'a sold plant leaves the map for everyone (and the database)');

  /* ---------------- 15. Block Blast live: who's playing, watching them, nothing left behind ---------------- */
  console.log('15. Block Blast live: playing, watching, and nothing left behind');
  const cara = phone(server, 'cara');
  await cara.C.signUp('cara@example.com', 'secret-ccc', { name: 'Cara', avatar: AV('bob') });
  await settle();
  await cara.C.joinFamily(ann.S.family().code);
  await settle(120);
  const uidCara = cara.S.state.uid, LIVE = 'famfi/live/' + fA.id;
  const LA = ann.C.live, LB = ben.C.live, LC = cara.C.live, BA = ann.FF.blastCore, BC = cara.FF.blastCore;
  ok(LA.ok() && LB.ok() && LC.ok(), 'every phone in the family can play live');
  const ga = BA.newGame(), gb = BA.newGame();
  const step = (g) => { const st = BA.solve(g.board, g.hand)[0]; return BA.place(g, st[0], st[1], st[2]); };
  LA.play(BA.pack(ga)); LB.play(BA.pack(gb));
  await settle(80);
  const onC = LC.playing().map((x) => x.uid);
  ok(onC.length === 2 && onC.indexOf(uidAnn) !== -1 && onC.indexOf(uidBen) !== -1, 'Cara sees that Ann and Ben are both playing');
  ok(LA.playing().length === 1 && LA.playing()[0].uid === uidBen, 'Ann sees Ben playing (not herself)');
  ok(getAt(server.data, LIVE + '/g') == null, 'nobody watching yet: no game is sent at all');
  let mark = server.log.length;
  LA.move(BA.pack(ga, step(ga))); LA.move(BA.pack(ga, step(ga)));
  await settle(40);
  ok(server.log.slice(mark).every((u) => !Object.keys(u).some((k) => k.indexOf('famfi/live/') === 0)), 'moves nobody is watching cost no writes');
  // Cara chooses Ann
  const seenA = [], seenB = [];
  ok(LC.watch(uidAnn, (v) => seenA.push(v)), 'Cara starts watching Ann');
  await settle(80);
  const a0 = BC.unpack(seenA.filter(Boolean).pop());
  ok(a0 && a0.moves === ga.moves && a0.board.join('') === ga.board.join('') && a0.score === ga.score && a0.hand.map((p) => p && p.id).join() === ga.hand.map((p) => p && p.id).join(), 'Cara gets Ann’s game exactly as it is right now');
  ok(LA.watchers().join() === uidCara && LC.viewers().join() === uidCara, 'Ann knows Cara is watching; Cara sees one viewer');
  const r1 = step(ga); LA.move(BA.pack(ga, r1));
  await settle(60);
  const a1 = BC.unpack(seenA[seenA.length - 1]);
  ok(a1 && a1.moves === ga.moves && a1.last && a1.last.id === r1.piece.id && a1.last.r === r1.r && a1.last.c === r1.c && a1.last.slot === r1.slot && a1.last.nl === r1.nl, 'each move reaches Cara with the piece and spot, to replay it');
  ok(getAt(server.data, LIVE + '/g/' + uidBen) == null, 'Ben isn’t watched, so his game isn’t sent');
  const sz = JSON.stringify(getAt(server.data, LIVE + '/g/' + uidAnn)).length;
  ok(sz < 260, 'one move is a tiny message (' + sz + ' bytes)');
  // …then switches to Ben
  LC.watch(uidBen, (v) => seenB.push(v));
  await settle(80);
  ok(getAt(server.data, LIVE + '/eye/' + uidAnn) == null && LA.watchers().length === 0, 'switching to Ben stops watching Ann');
  ok(BC.unpack(seenB.filter(Boolean).pop()).board.join('') === gb.board.join('') && LC.watching() === uidBen, 'Cara now sees Ben’s game');
  mark = server.log.length;
  LA.move(BA.pack(ga, step(ga)));
  await settle(40);
  ok(server.log.slice(mark).every((u) => !Object.keys(u).some((k) => k.indexOf(LIVE + '/g/' + uidAnn) === 0)), 'Ann’s moves stop being sent once nobody watches her');
  // the database keeps everyone honest
  ok((await write(ben, { [LIVE + '/on/' + uidAnn]: { at: 1 } })) !== true, 'nobody can say someone else is playing');
  ok((await write(ben, { [LIVE + '/g/' + uidAnn]: BA.pack(gb) })) !== true, 'nobody can fake someone else’s game');
  ok((await write(ben, { [LIVE + '/eye/' + uidAnn + '/' + uidCara]: 1 })) !== true, 'nobody can watch in someone else’s name');
  ok((await write(ben, { [LIVE + '/g/' + uidBen]: { b: 'x', h: '-', s: 1, m: 1 } })) !== true && (await write(ben, { [LIVE + '/g/' + uidBen + '/zz']: 1 })) !== true, 'broken or padded game messages are refused');
  ok((await raw(outsider, LIVE + '/on')).ok === false && (await raw(outsider, LIVE + '/g/' + uidBen)).ok === false, 'outsiders can’t see who’s playing or watch');
  ok((await write(outsider, { [LIVE + '/on/' + outsider.S.state.uid]: { at: 1 } })) !== true, 'outsiders can’t join in');
  // Ben's game ends: Cara sees the final board, and he's no longer "playing"
  gb.over = true; LB.over(BA.pack(gb));
  await settle(60);
  ok(!LC.isPlaying(uidBen) && LC.playing().map((x) => x.uid).join() === uidAnn && BC.unpack(seenB[seenB.length - 1]).over === true, 'Ben’s game ends: Cara sees the final board; only Ann is still playing');
  // Ann closes the game: nothing of hers stays
  LA.quit();
  await settle(60);
  ok(getAt(server.data, LIVE + '/on/' + uidAnn) == null && getAt(server.data, LIVE + '/g/' + uidAnn) == null && LC.playing().length === 0, 'Ann closes the game: she’s gone from the list, her game from the database');
  // phones that drop off without saying goodbye: the server tidies up after them
  const gb2 = BA.newGame(); LB.play(BA.pack(gb2));
  await settle(60);
  LC.watch(uidBen, (v) => seenB.push(v));
  await settle(80);
  ok(LB.watchers().join() === uidCara && getAt(server.data, LIVE + '/g/' + uidBen + '/m') === 0, 'Cara watches Ben’s new game');
  cara.fb.setConnected(false);
  await settle(60);
  ok(getAt(server.data, LIVE + '/eye/' + uidBen) == null && LB.watchers().length === 0, 'Cara’s phone drops: she stops counting as a viewer');
  ben.fb.setConnected(false);
  await settle(60);
  ok(getAt(server.data, LIVE + '/on/' + uidBen) == null && getAt(server.data, LIVE + '/g/' + uidBen) == null && LA.playing().length === 0, 'Ben’s phone drops: no ghost "playing" left for the family');
  ben.fb.setConnected(true); cara.fb.setConnected(true);
  await settle(120);
  ok(LA.playing().map((x) => x.uid).join() === uidBen && LB.watchers().join() === uidCara && getAt(server.data, LIVE + '/g/' + uidBen) != null, 'both come back online: Ben is playing again and Cara is watching again');
  LC.unwatch(); LB.quit();
  await settle(80);
  ok(getAt(server.data, LIVE) == null, 'everyone done: nothing at all is left in the database');

  /* ---------------- 16. two copies of one account never wipe each other out (the 2.21 fix) ----------------
     Before 2.21 a phone stamped its own changes "newest" by the clock, so an old copy reopened (Safari next
     to the home-screen app, another phone) that changed anything before the cloud's copy arrived replaced
     newer pets, plants and records everywhere — and two phones used offline kept only their own records. */
  console.log('16. an old copy reopened, and two phones offline: nothing is lost');
  const W1 = phone(server, 'w-app');
  await W1.C.signUp('will@example.com', 'secret-321', { name: 'Will', avatar: AV('spiky') });
  await settle();
  await W1.C.createFamily('The Fatt Family');
  await settle(120);
  const uidW = W1.S.state.uid;
  const w2Store = storage();
  const W2 = phone(server, 'w-safari', w2Store);
  await W2.C.signIn('will@example.com', 'secret-321');
  await settle(160);
  W2.fb.setConnected(false); server.clients.delete(W2.fb); // Safari closed for a while
  const wpl = W1.S.me().play;
  wpl.lucky = { day: W1.S.dayNow(), stock: ['egg', 'seed', 'egg', 'seed', 'treat', 'tonic'], sold: [] };
  wpl.pts = 2000; W1.S.save();
  const wEgg = W1.S.buyLucky(0), wSeed = W1.S.buyLucky(1);
  const spend = (P, note) => P.S.addTxn({ type: 'expense', day: P.FF.today(), amt: 9, cur: 'MYR', acct: P.S.me().pf.accounts[0].id, cat: 'food', note });
  spend(W1, 'nasi lemak'); spend(W1, 'roti canai'); spend(W1, 'kopi');
  await settle(160);
  const pubW = () => { const d = JSON.parse(getAt(server.data, 'famfi/m/' + uidW + '/pub')).d; d.yard = d.yard || { pets: [], plants: [] }; return d; };
  const privW = () => JSON.parse(getAt(server.data, 'famfi/m/' + uidW + '/priv')).d;
  ok(wEgg.pet && wSeed.plant && pubW().yard.pets.length === 1 && pubW().yard.plants.length === 1 && privW().pf.txns.length === 3, 'the app: a pet, a plant and 3 records saved to the cloud');
  // Safari reopens with its old copy and records something before the cloud's copy arrives
  const W2b = phone(server, 'w-safari', w2Store);
  spend(W2b, 'teh tarik');
  await W2b.C.resume();
  await settle(240);
  const notesOf = (P) => P.S.me().pf.txns.map((t) => t.note).sort().join(', ');
  ok(pubW().yard.pets.some((x) => x.id === wEgg.pet.id) && pubW().yard.plants.some((x) => x.id === wSeed.plant.id), 'the old copy didn’t wipe out the pet and the plant in the cloud');
  ok(privW().pf.txns.length === 4 && notesOf(W2b) === 'kopi, nasi lemak, roti canai, teh tarik', 'records from both copies kept: ' + notesOf(W2b));
  ok(notesOf(W1) === 'kopi, nasi lemak, roti canai, teh tarik' && W1.S.yardOf(W1.S.me()).pets.length === 1 && W1.S.yardOf(W1.S.me()).plants.length === 1, 'and the app shows all of it too');
  // both offline, each records something, then both come back
  W1.fb.setConnected(false); W2b.fb.setConnected(false); await settle(40);
  spend(W1, 'offline A'); await settle(5); spend(W2b, 'offline B'); await settle(40);
  W1.fb.setConnected(true); await settle(240);
  W2b.fb.setConnected(true); await settle(320);
  const offl = (P) => P.S.me().pf.txns.filter((t) => /^offline/.test(t.note)).map((t) => t.note).sort().join(' + ');
  ok(offl(W1) === 'offline A + offline B' && offl(W2b) === 'offline A + offline B' && privW().pf.txns.length === 6, 'two phones used offline: both records on both phones (' + offl(W1) + ')');
  // the same, with both phones saving in the very same millisecond (each copy knows its own writes by its id)
  W1.fb.setConnected(false); W2b.fb.setConnected(false); await settle(40);
  const D1 = vm.runInContext('Date', W1.ctx), D2 = vm.runInContext('Date', W2b.ctx); // each phone's own clock
  const T = Date.now() + 5000, now1 = D1.now, now2 = D2.now;
  D1.now = () => T; D2.now = () => T;
  spend(W1, 'same ms A'); spend(W2b, 'same ms B');
  D1.now = now1; D2.now = now2;
  await settle(40);
  W1.fb.setConnected(true); await settle(240);
  W2b.fb.setConnected(true); await settle(320);
  const same = (P) => P.S.me().pf.txns.filter((t) => /^same ms/.test(t.note)).map((t) => t.note).sort().join(' + ');
  ok(same(W1) === 'same ms A + same ms B' && same(W2b) === 'same ms A + same ms B', 'two phones saving in the same millisecond: both records kept (' + same(W1) + ')');
  // ordinary deletes and sales still reach the other copy (no conflict, so nothing is merged back)
  W1.S.deleteTxn(W1.S.me().pf.txns.find((t) => t.note === 'kopi').id);
  W1.S.sellPlant(wSeed.plant.id);
  await settle(240);
  ok(!W2b.S.me().pf.txns.some((t) => t.note === 'kopi') && W2b.S.yardOf(W2b.S.me()).plants.length === 0 && pubW().yard.plants.length === 0, 'a deleted record and a sold plant are gone on the other copy too');
  // an automatic dividend found on both copies counts once
  const W1s = W1.S.me().pf, ref = 'div:KO:' + (W1.FF.today() - 3);
  W1.fb.setConnected(false); W2b.fb.setConnected(false); await settle(40);
  W1s.txns.push({ id: W1.FF.uid('t'), type: 'dividend', day: W1.FF.today(), sym: 'KO', amt: 5, cur: 'USD', acct: W1s.accounts[0].id, ref, auto: true, ts: Date.now() }); W1.S.save();
  const W2s = W2b.S.me().pf; W2s.txns.push({ id: W2b.FF.uid('t'), type: 'dividend', day: W2b.FF.today(), sym: 'KO', amt: 5, cur: 'USD', acct: W2s.accounts[0].id, ref, auto: true, ts: Date.now() }); W2b.S.save();
  await settle(40);
  W1.fb.setConnected(true); await settle(240); W2b.fb.setConnected(true); await settle(320);
  ok(privW().pf.txns.filter((t) => t.ref === ref).length === 1 && W1.S.me().pf.txns.filter((t) => t.ref === ref).length === 1, 'the same automatic dividend found on both copies is kept once');

  /* ---------------- 17. a new device gets ALL of the profile (the 2.23 fix) ----------------
     Before 2.23 signing in on a new device (a MacBook) left the yard, the Block Blast scores and the
     game progress (gems, streak, bag) behind — and the tidy-up then took the shop pets and decorations
     off the house — so the new device's first save wiped all of them for every phone. */
  console.log('17. signing in on a new device brings everything, and wipes nothing');
  const N1 = phone(server, 'n-iphone');
  await N1.C.signUp('nur@example.com', 'secret-777', { name: 'Nur', avatar: AV('bob') });
  await settle();
  await N1.C.createFamily('Nur’s Family');
  await settle(120);
  const uidN = N1.S.state.uid, npl = N1.S.me().play;
  npl.lucky = { day: N1.S.dayNow(), stock: ['egg', 'seed', 'egg', 'seed', 'treat', 'tonic'], sold: [] };
  npl.pts = 2000; N1.S.save();
  N1.S.buyLucky(0); N1.S.buyLucky(1); N1.S.blastFinish(8420); N1.S.buyItem('bunny'); N1.S.buyItem('lanterns');
  spend(N1, 'lunch');
  await settle(160);
  const snapOf = (P) => { const m = P.S.me(), y = P.S.yardOf(m), h = m.house || {}; return { pets: y.pets.length, plants: y.plants.length, best: P.S.bbOf(m).best, gems: (m.play || {}).pts | 0, shopPets: (h.pets || []).join(), deco: JSON.stringify(h.deco || {}) }; };
  const want = snapOf(N1);
  ok(want.pets === 1 && want.plants === 1 && want.best === 8420 && want.shopPets === 'bunny' && /lanterns/.test(want.deco), 'the iPhone: a pet, a plant, a Block Blast best, a shop pet and a decoration');
  const cloudBefore = {}; ['pub', 'priv'].forEach((k) => { cloudBefore[k] = JSON.parse(getAt(server.data, 'famfi/m/' + uidN + '/' + k)).d; });
  const N2 = phone(server, 'n-macbook');
  await N2.C.signIn('nur@example.com', 'secret-777');
  await settle(200);
  ok(JSON.stringify(snapOf(N2)) === JSON.stringify(want), 'the new device has all of it right after signing in: ' + JSON.stringify(snapOf(N2)));
  const docsNow = N2.C._.docsOf(N2.S.me(), N2.S.state);
  ['pub', 'priv'].forEach((k) => {
    const inCloud = JSON.parse(getAt(server.data, 'famfi/m/' + uidN + '/' + k)).d;
    ok(JSON.stringify(docsNow[k]) === JSON.stringify(cloudBefore[k]), 'its copy of “' + k + '” is exactly what the cloud had before it signed in — no field left behind');
    ok(JSON.stringify(inCloud) === JSON.stringify(cloudBefore[k]), 'and just signing in changed nothing in the cloud’s “' + k + '”');
  });
  N2.S.setPref('sound', false); spend(N2, 'kopi');
  await settle(240);
  ok(JSON.stringify(snapOf(N1)) === JSON.stringify(Object.assign({}, want, { gems: snapOf(N1).gems })) && snapOf(N1).gems === want.gems, 'after the new device saves, the iPhone still has everything: ' + JSON.stringify(snapOf(N1)));
  ok(N1.S.me().pf.txns.map((t) => t.note).sort().join() === 'kopi,lunch', 'and both records');

  /* ---------------- 18. family helpers (2.25): record for a family member who lets you ---------------- */
  console.log('18. family helpers: recording for each other, through their own phone');
  const H = phone(server, 'hana');
  await H.C.signUp('hana@example.com', 'secret-h1', { name: 'Hana', avatar: AV('long') });
  await settle();
  const fH = await H.C.createFamily('Hana’s House');
  await settle(120);
  const Iv = phone(server, 'ivan'), Jo = phone(server, 'jo');
  await Iv.C.signUp('ivan@example.com', 'secret-i1', { name: 'Ivan', avatar: AV('short') });
  await Jo.C.signUp('jo@example.com', 'secret-j1', { name: 'Jo', avatar: AV('bob') });
  await settle();
  await Iv.C.joinFamily(H.S.family().code); await settle(120);
  await Jo.C.joinFamily(H.S.family().code); await settle(160);
  const uidH = H.S.state.uid, uidIv = Iv.S.state.uid, uidJo = Jo.S.state.uid;
  const hBank = H.S.addAccount({ name: 'Maybank', kind: 'bank', cur: 'MYR' }, 2000);
  const hCash = H.S.addAccount({ name: 'Wallet', kind: 'cash', cur: 'MYR' }, 100);
  await settle(160);
  const HELP = 'famfi/f/' + fH.id + '/help';
  const hTx = (P, note) => P.S.member(uidH).pf.txns.find((t) => t.note === note);
  ok(H.S.helpOf(H.S.me()) && getAt(server.data, 'famfi/m/' + uidH + '/share/help') === true, 'Hana lets her family help (the default: nothing made private)');
  ok(Iv.S.canHelp(uidH) && Jo.S.canHelp(uidH) && !Iv.S.canHelp(uidIv), 'Ivan and Jo may record for Hana (and nobody “helps” themselves)');
  const gems0 = H.S.me().play ? H.S.me().play.pts : 0;
  const add1 = { k: 'add', tx: { id: Iv.FF.uid('t'), type: 'expense', day: Iv.FF.today(), amt: 45.5, cur: 'MYR', acct: hBank.id, cat: 'groceries', note: 'Groceries for Hana' } };
  const h1 = Iv.S.helpEdit(uidH, add1);
  ok(h1 && h1.undo && h1.undo.k === 'del' && h1.undo.id === add1.tx.id, 'Ivan records Hana’s groceries (and gets an Undo)');
  await settle(240);
  const got1 = H.S.me().pf.txns.find((t) => t.id === add1.tx.id);
  ok(got1 && got1.by === uidIv && got1.amt === 45.5 && got1.cat === 'groceries', 'it lands in Hana’s own records, marked as Ivan’s');
  ok(getAt(server.data, HELP) == null, 'and the mailbox is empty again');
  ok(hTx(Iv, 'Groceries for Hana') && !hTx(Iv, 'Groceries for Hana')._pending && hTx(Jo, 'Groceries for Hana'), 'Ivan and Jo see it in her records');
  ok(JSON.parse(getAt(server.data, 'famfi/m/' + uidH + '/priv')).d.pf.txns.some((t) => t.id === add1.tx.id), 'Hana’s private copy has it (her phone saved it)');
  ok((H.S.me().play ? H.S.me().play.pts : 0) === gems0, 'no gems for records someone else made');
  // Hana is offline: the change waits, everyone sees it waiting, then it lands
  H.fb.setConnected(false); await settle(40);
  const h2 = Iv.S.helpEdit(uidH, { k: 'edit', tx: Object.assign({}, add1.tx, { amt: 50 }) });
  await settle(120);
  ok(h2 && h2.undo.k === 'edit' && h2.undo.tx.amt === 45.5, 'Ivan fixes the amount (Undo would put back 45.50)');
  ok(Object.keys(getAt(server.data, HELP + '/' + uidH) || {}).length === 1, 'Hana’s phone is off: the change waits in her mailbox');
  ok(hTx(Iv, 'Groceries for Hana').amt === 50 && hTx(Iv, 'Groceries for Hana')._pending, 'Ivan sees it, marked as waiting for Hana’s phone');
  ok(hTx(Jo, 'Groceries for Hana').amt === 50 && hTx(Jo, 'Groceries for Hana')._pending, 'Jo sees the same');
  ok(H.S.me().pf.txns.find((t) => t.id === add1.tx.id).amt === 45.5, 'Hana’s own records are unchanged until her phone takes it in');
  H.fb.setConnected(true); await settle(320);
  ok(H.S.me().pf.txns.find((t) => t.id === add1.tx.id).amt === 50 && getAt(server.data, HELP) == null, 'Hana’s phone comes back: the fix is in her records, the mailbox empty');
  ok(hTx(Iv, 'Groceries for Hana').amt === 50 && !hTx(Iv, 'Groceries for Hana')._pending, 'and it no longer shows as waiting');
  // a balance, a delete, an undo
  Jo.S.helpEdit(uidH, { k: 'bal', id: Jo.FF.uid('t'), acct: hCash.id, v: 64.2 });
  await settle(240);
  near2(H.FF.ledger.accountCash(H.S.me().pf, H.S.me().pf.accounts.find((a) => a.id === hCash.id)), 64.2, 0.001, 'Jo sets Hana’s wallet to RM 64.20');
  const delR = Iv.S.helpEdit(uidH, { k: 'del', id: add1.tx.id });
  await settle(240);
  ok(!H.S.me().pf.txns.some((t) => t.id === add1.tx.id) && delR.undo.k === 'add', 'Ivan deletes the groceries record');
  Iv.S.helpEdit(uidH, delR.undo);
  await settle(240);
  ok(H.S.me().pf.txns.some((t) => t.id === add1.tx.id && t.amt === 50), '…and Undo brings it back');
  ok(Iv.S.helpEdit(uidH, { k: 'del', id: 'nope' }) === null && Iv.S.helpEdit(uidH, { k: 'add', tx: { id: 'x1', type: 'expense', day: Iv.FF.today(), amt: -5, cur: 'MYR', acct: hBank.id, cat: 'food' } }) === null, 'changes that would do nothing (or are wrong) aren’t sent');
  // Ivan records while offline; the family snapshot that arrives first doesn't lose it
  Iv.fb.setConnected(false); await settle(40);
  Iv.S.helpEdit(uidH, { k: 'add', tx: { id: Iv.FF.uid('t'), type: 'income', day: Iv.FF.today(), amt: 300, cur: 'MYR', acct: hBank.id, cat: 'giftIn', note: 'Ang pow' } });
  Iv.fb.setConnected(true); await settle(320);
  ok(H.S.me().pf.txns.some((t) => t.note === 'Ang pow' && t.by === uidIv), 'something recorded offline arrives once the helper is back online');
  // Hana edits a record Ivan made: it's hers again
  const angpow = H.S.me().pf.txns.find((t) => t.note === 'Ang pow');
  H.S.updateTxn(angpow.id, { amt: 288 });
  ok(!H.S.me().pf.txns.find((t) => t.id === angpow.id).by, 'once Hana changes it herself, it’s no longer “recorded by Ivan”');
  await settle(160);
  // Hana has two phones online: both take the change in, and it lands once
  const H2 = phone(server, 'hana-ipad');
  await H2.C.signIn('hana@example.com', 'secret-h1');
  await settle(240);
  const twin = { k: 'add', tx: { id: Iv.FF.uid('t'), type: 'expense', day: Iv.FF.today(), amt: 12.3, cur: 'MYR', acct: hBank.id, cat: 'transport', note: 'Grab home' } };
  Iv.S.helpEdit(uidH, twin);
  await settle(400);
  const cnt = (P) => P.S.me().pf.txns.filter((t) => t.id === twin.tx.id).length;
  ok(cnt(H) === 1 && cnt(H2) === 1 && JSON.parse(getAt(server.data, 'famfi/m/' + uidH + '/priv')).d.pf.txns.filter((t) => t.id === twin.tx.id).length === 1 && getAt(server.data, HELP) == null, 'both of Hana’s phones take it in: one record on each, one in the cloud, mailbox empty');
  H2.fb.setConnected(false); server.clients.delete(H2.fb);
  // the database keeps it honest
  const rawOp = (o) => ({ by: uidJo, at: Date.now(), o: JSON.stringify(o) });
  ok((await write(Jo, { [HELP + '/' + uidH + '/f1']: { by: uidIv, at: 1, o: '{"k":"del","id":"x"}' } })) !== true, 'nobody can leave a change in someone else’s name');
  ok((await write(Jo, { [HELP + '/' + uidJo + '/f2']: rawOp({ k: 'del', id: 'x' }) })) !== true, 'nobody can fill their own mailbox');
  ok((await write(outsider, { [HELP + '/' + uidH + '/f3']: { by: outsider.S.state.uid, at: 1, o: '{"k":"del","id":"x"}' } })) !== true, 'outsiders can’t leave changes');
  ok((await write(Jo, { [HELP + '/' + uidH + '/f4']: Object.assign(rawOp({ k: 'del', id: 'x' }), { extra: 1 }) })) !== true && (await write(Jo, { [HELP + '/' + uidH + '/f5']: { by: uidJo, at: 1, o: 'x'.repeat(1600) } })) !== true, 'padded or oversized changes are refused');
  // a broken change from an old or buggy phone: Hana's phone ignores it and tidies up
  const n0 = H.S.me().pf.txns.length;
  ok((await write(Jo, { [HELP + '/' + uidH + '/f6']: rawOp({ k: 'add', tx: { id: 'bad1', type: 'buy', day: Jo.FF.today(), q: 1, p: 1, cur: 'USD', acct: 'nowhere' } }) })) === true, 'a family member can leave any change in the mailbox…');
  await settle(240);
  ok(H.S.me().pf.txns.length === n0 && getAt(server.data, HELP) == null, '…but Hana’s phone only takes in sensible ones (this one was ignored and removed)');
  // Hana stops letting the family help
  H.S.setHelp(false);
  await settle(240);
  ok(getAt(server.data, 'famfi/m/' + uidH + '/share/help') === false && !Iv.S.canHelp(uidH), 'Hana turns family help off: Ivan can’t record for her any more');
  ok((await write(Jo, { [HELP + '/' + uidH + '/f7']: rawOp({ k: 'del', id: 'x' }) })) !== true, 'and the database refuses changes for her');
  // a change made just before Ivan's phone heard about it: refused, and he's told
  const refused = [];
  Iv.FF.on('help-refused', (e) => refused.push(e.id));
  const ivM = Iv.S.member(uidH); ivM.help = true; // his phone hasn't heard yet
  Iv.fb.setConnected(false); await settle(20);
  Iv.S.helpEdit(uidH, { k: 'add', tx: { id: Iv.FF.uid('t'), type: 'expense', day: Iv.FF.today(), amt: 9, cur: 'MYR', acct: hBank.id, cat: 'food', note: 'Too late' } });
  Iv.fb.setConnected(true); await settle(320);
  ok(refused.join() === uidH && !H.S.me().pf.txns.some((t) => t.note === 'Too late') && !Iv.S.pendingFor(uidH).length, 'a change made just as she turned help off is refused — Ivan is told, nothing is left waiting');
  ok(Iv.S.state.sync && !Iv.S.state.sync.priv.dirty, 'and it never holds up his own syncing');

  /* ---------------- 19. the chat beside a live Block Blast game ---------------- */
  console.log('19. Block Blast chat: the player and the people watching');
  const CHAT = LIVE + '/chat/' + uidAnn;
  const gc = BA.newGame();
  LA.chatReset(); LA.play(BA.pack(gc));
  await settle(80);
  const chatA = [], chatC = [];
  ann.FF.on('live', (e) => { if (e.k === 'chat') chatA.push(e.fresh.length); });
  cara.FF.on('live', (e) => { if (e.k === 'chat') chatC.push(e.fresh.length); });
  LC.watch(uidAnn, () => {});
  await settle(80);
  ok(LC.chatRoom() === uidAnn && LA.chatRoom() === uidAnn, 'Cara watching Ann: they share Ann’s chat');
  ok(await LC.say('  Nice   move!  '), 'Cara says something');
  await settle(60);
  ok(LA.chat().map((x) => x.t).join() === 'Nice move!' && LA.chat()[0].u === uidCara, 'Ann sees it, from Cara (spaces tidied)');
  ok(await LC.react('🔥'), 'Cara sends an emoji');
  await settle(60);
  ok(LA.chat().some((x) => x.e === '🔥' && x.u === uidCara) && chatA.reduce((a, b) => a + b, 0) === 2, 'Ann gets the emoji too — each message is news exactly once');
  ok(await LA.say('Thanks! 😄'), 'Ann answers while playing');
  await settle(60);
  ok(LC.chat().map((x) => x.t || x.e).join() === 'Nice move!,🔥,Thanks! 😄', 'Cara sees the whole conversation in order');
  ok((await LB.say('hi')) === false && (await write(ben, { [CHAT + '/b1']: { u: uidBen, at: 1, t: 'hi' } })) !== true, 'Ben isn’t watching Ann: he can’t talk in her chat');
  ok((await write(cara, { [CHAT + '/c1']: { u: uidAnn, at: 1, t: 'fake' } })) !== true, 'nobody can talk in someone else’s name');
  ok((await write(cara, { [CHAT + '/c2']: { u: uidCara, at: 1, t: 'x'.repeat(141) } })) !== true && (await write(cara, { [CHAT + '/c3']: { u: uidCara, at: 1, t: 'a', e: '🔥' } })) !== true && (await write(cara, { [CHAT + '/c4']: { u: uidCara, at: 1, t: 'a', z: 1 } })) !== true, 'too long, mixed or padded messages are refused');
  ok((await write(cara, { [CHAT + '/' + LA.chat()[0].id]: null })) !== true, 'only Ann can tidy her chat away');
  ok((await raw(outsider, CHAT)).ok === false, 'outsiders can’t read the chat');
  // a long, chatty game: Ann's phone keeps it short
  for (let k = 0; k < 52; k++) await LC.react('👏');
  await settle(120);
  const keptN = Object.keys(getAt(server.data, CHAT) || {}).length;
  ok(keptN <= 50 && LA.chat().length <= 40, 'a long chat is trimmed to the latest messages (' + keptN + ' kept)');
  // Ann closes the game: no more messages; a new game screen starts a clean chat
  LA.quit(); await settle(60);
  ok((await LC.say('still there?')) === false, 'once Ann has left the game, the chat takes no more messages');
  LC.unwatch(); await settle(40);
  LA.chatReset(); await settle(40);
  ok(getAt(server.data, CHAT) == null && getAt(server.data, LIVE) == null, 'Ann opens the game again: last time’s chat is gone, nothing is left behind');

  /* ---------------- 20. Family Finance 3: bills, savings goals and the watchlist ----------------
     They live in the person's own settings: private, on every phone of theirs — and a phone that
     still runs FamFi 2.25 carries them along untouched instead of wiping them. */
  console.log('20. bills and savings goals: private, on all your phones, safe next to FamFi 2.25');
  const F1 = phone(server, 'f-iphone');
  await F1.C.signUp('fay@example.com', 'secret-808', { name: 'Fay', avatar: AV('long') });
  await settle();
  const famF = await F1.C.createFamily('The Lim Family');
  await settle(120);
  const uidF = F1.S.state.uid, codeF = F1.S.family().code;
  const bankF = F1.S.addAccount({ name: 'Bank', kind: 'bank', cur: 'MYR' }, 4000).id;
  const billF = F1.S.addBill({ type: 'expense', name: 'Secret hobby club', amt: 88, cur: 'MYR', cat: 'fun', acct: bankF, every: 'month', day0: F1.FF.today() + 40 });
  const goalF = F1.S.addSaving({ name: 'Surprise ring', target: 9000, start: 500 });
  F1.S.toggleWatch('TSLA');
  await settle(200);
  const docF = (k) => JSON.parse(getAt(server.data, 'famfi/m/' + uidF + '/' + k)).d;
  ok(docF('priv').prefs.x.bills.length === 1 && docF('priv').prefs.x.goals.length === 1 && docF('priv').prefs.x.watch[0] === 'TSLA', 'saved to the cloud, in the private document');
  ok(!/Secret hobby|Surprise ring/.test(getAt(server.data, 'famfi/m/' + uidF + '/pub')) && !/Secret hobby|Surprise ring/.test(getAt(server.data, 'famfi/m/' + uidF + '/money')), 'nothing about them in what the family receives');
  const F2 = phone(server, 'f-ipad');
  await F2.C.signIn('fay@example.com', 'secret-808');
  await settle(240);
  ok(F2.S.extras().bills[0].name === 'Secret hobby club' && F2.S.extras().goals[0].name === 'Surprise ring' && F2.S.extras().watch.join() === 'TSLA', 'a second device of hers has them right after signing in');
  ok(JSON.stringify(F2.C._.docsOf(F2.S.me(), F2.S.state).priv) === JSON.stringify(docF('priv')), 'and just looking changed nothing');
  // family: her brother joins — he gets her house and her balances, never her bills or goals
  const Bro = phone(server, 'f-bro');
  await Bro.C.signUp('bro@example.com', 'secret-909', { name: 'Ben', avatar: AV('short') });
  await settle();
  await Bro.C.joinFamily(codeF);
  await settle(200);
  ok(Bro.S.member(uidF) && Bro.S.member(uidF).name === 'Fay' && !(Bro.S.member(uidF).prefs || {}).x && !/Secret hobby|Surprise ring/.test(JSON.stringify(Bro.S.member(uidF))), 'her brother’s phone never receives them');
  ok(Bro.S.extras().bills.length === 0 && Bro.S.extras(Bro.S.member(uidF)).bills.length === 0, 'reading someone else’s gives an empty list (and no error)');
  // a phone still on FamFi 2.25 signs in, records lunch, changes a setting
  const Old = phone(server, 'f-oldphone', null, OLD_FILES);
  await Old.C.signIn('fay@example.com', 'secret-808');
  await settle(240);
  ok(Old.S.mode() === 'cloud' && Old.S.me().pf.accounts.some((a) => a.id === bankF) && !Old.S.extras, 'the old phone signs in and sees her records (it knows nothing of bills)');
  Old.S.addTxn({ type: 'expense', day: Old.FF.today(), amt: 12, cur: 'MYR', acct: bankF, cat: 'food', note: 'old-phone lunch' });
  Old.S.setPref('sound', false);
  await settle(280);
  ok(docF('priv').pf.txns.some((t) => t.note === 'old-phone lunch') && docF('priv').prefs.sound === false, 'what the old phone did reached the cloud');
  ok(docF('priv').prefs.x && docF('priv').prefs.x.bills.length === 1 && docF('priv').prefs.x.goals[0].puts.length === 1, 'and the bill and the goal are still there');
  ok(F1.S.me().pf.txns.some((t) => t.note === 'old-phone lunch') && F1.S.extras().bills.length === 1 && F1.S.extras().goals.length === 1, 'the new phone shows the lunch, the bill and the goal');
  // the old phone and a new one both change things while offline
  Old.fb.setConnected(false); F1.fb.setConnected(false); await settle(40);
  Old.S.addTxn({ type: 'expense', day: Old.FF.today(), amt: 5, cur: 'MYR', acct: bankF, cat: 'food', note: 'old offline kopi' });
  F1.S.addBill({ type: 'expense', name: 'Gym', amt: 99, cur: 'MYR', cat: 'health', acct: bankF, every: 'month', day0: F1.FF.today() + 9 });
  F1.S.putSaving(goalF.id, 250);
  await settle(40);
  F1.fb.setConnected(true); await settle(240);
  Old.fb.setConnected(true); await settle(320);
  ok(docF('priv').prefs.x.bills.length === 2 && docF('priv').prefs.x.goals[0].puts.length === 2 && docF('priv').pf.txns.some((t) => t.note === 'old offline kopi'), 'old and new both offline, then back: the kopi, both bills and the saving all kept');
  ok(F1.S.extras().bills.length === 2 && F1.S.me().pf.txns.some((t) => t.note === 'old offline kopi'), 'on the new phone too');
  // two new phones offline: a bill added on one, a goal on the other
  F1.fb.setConnected(false); F2.fb.setConnected(false); await settle(40);
  F1.S.addBill({ type: 'income', name: 'Salary', amt: 5200, cur: 'MYR', cat: 'salary', acct: bankF, every: 'month', day0: F1.FF.today() + 15 });
  await settle(5);
  F2.S.addSaving({ name: 'Bike', target: 1200 });
  F2.S.toggleWatch('NVDA');
  await settle(40);
  F1.fb.setConnected(true); await settle(240);
  F2.fb.setConnected(true); await settle(320);
  const sig = (P) => P.S.extras().bills.map((b) => b.name).sort().join() + ' | ' + P.S.extras().goals.map((g) => g.name).sort().join() + ' | ' + P.S.extras().watch.slice().sort().join();
  ok(sig(F1) === 'Gym,Salary,Secret hobby club | Bike,Surprise ring | NVDA,TSLA' && sig(F2) === sig(F1), 'two phones offline: both phones end with everything (' + sig(F2) + ')');
  // the same bill comes due while both phones are offline: each writes it, the family of records keeps one
  F1.fb.setConnected(false); F2.fb.setConnected(false); await settle(40);
  const dueDay = F1.FF.today() + 9;
  F1.FF.todayOverride = dueDay; F2.FF.todayOverride = dueDay;
  const w1 = F1.S.runBills(), w2 = F2.S.runBills();
  ok(w1.length === 1 && w2.length === 1 && w1[0].ref === w2[0].ref && w1[0].id !== w2[0].id, 'offline, each phone writes today’s gym payment');
  await settle(40);
  F1.fb.setConnected(true); await settle(240);
  F2.fb.setConnected(true); await settle(320);
  const gymOn = (list) => list.filter((t) => t.ref === w1[0].ref).length;
  ok(gymOn(docF('priv').pf.txns) === 1 && gymOn(F1.S.me().pf.txns) === 1 && gymOn(F2.S.me().pf.txns) === 1, 'back online: one gym payment, not two — in the cloud and on both phones');
  ok(F1.S.runBills().length === 0 && F2.S.runBills().length === 0, 'and neither writes it again');
  F1.FF.todayOverride = null; F2.FF.todayOverride = null;
  // an ordinary delete still travels (no conflict → nothing merged back)
  F1.S.deleteBill(billF.id);
  await settle(240);
  ok(!F2.S.extras().bills.some((b) => b.id === billF.id) && docF('priv').prefs.x.bills.length === 2, 'deleting a bill on one phone removes it on the other');
  // a backup made on one phone, restored on another, reaches the cloud whole
  const fileF = JSON.parse(JSON.stringify(F1.S.backup()));
  F2.S.addTxn({ type: 'expense', day: F2.FF.today(), amt: 700, cur: 'MYR', acct: bankF, cat: 'shopping', note: 'oops' });
  await settle(200);
  ok(F2.S.restoreBackup(fileF) === true, 'backup restored on the iPad');
  await settle(240);
  ok(!docF('priv').pf.txns.some((t) => t.note === 'oops') && !F1.S.me().pf.txns.some((t) => t.note === 'oops') && docF('priv').prefs.x.goals.length === 2, 'the restored records are what every phone and the cloud now have');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
