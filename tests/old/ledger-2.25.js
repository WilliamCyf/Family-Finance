/* ============================================================
   FamFi — ledger.js
   Everyday money, Wallet-style — the main feature — next to the
   investment tracker (calc.js). Pure functions (runs in jsc tests):
   • account kinds and spending / income categories
   • records: expense · income · transfer · adjust (balance update)
   • views: investments only (Return, Dividend) and what family
     members may see (balances, never what you spent it on)
   • per-account balances, the month in numbers, budgets
   • the family Town Hall's shared assets
   • automatic US dividends, after the 30% US withholding tax
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const C = () => FF.calc, D = () => FF.data;
  const r2 = FF.round2;

  /* ---------- accounts ---------- */
  const KINDS = {
    cash: { icon: '💵', color: '#2F9A4C' }, bank: { icon: '🏦', color: '#3D7FD1' }, ewallet: { icon: '📱', color: '#2A9D8F' },
    savings: { icon: '🐷', color: '#E66FA0' }, credit: { icon: '💳', color: '#E0563F' }, broker: { icon: '📈', color: '#8A5BC7', invest: true },
    crypto: { icon: '🪙', color: '#F08A3C', invest: true }, retire: { icon: '🛡️', color: '#5D6B7E' }, loan: { icon: '🧾', color: '#B0413E' },
    other: { icon: '💼', color: '#B07A45' }
  };
  const KIND_ORDER = ['cash', 'bank', 'ewallet', 'savings', 'credit', 'broker', 'crypto', 'retire', 'loan', 'other'];
  const kindOf = (acc) => KINDS[acc && acc.kind] || KINDS.other;
  const TRADES = { buy: 1, sell: 1, dividend: 1 };
  /* investment accounts: brokerage / crypto, or anything that holds stocks */
  function investIds(pf) {
    const ids = {};
    (pf.accounts || []).forEach((a) => { if (kindOf(a).invest) ids[a.id] = true; });
    (pf.txns || []).forEach((t) => { if (TRADES[t.type] && t.acct) ids[t.acct] = true; });
    return ids;
  }
  const isInvest = (pf, acc) => !!investIds(pf)[acc.id];

  /* ---------- categories (Wallet-style; ids are stable, names are translated) ---------- */
  const EXPENSE = [['food', '🍜', '#E9AE2E'], ['groceries', '🛒', '#2F9A4C'], ['shopping', '🛍️', '#C2477A'], ['housing', '🏠', '#B07A45'], ['bills', '💡', '#F08A3C'],
    ['transport', '🚗', '#3D7FD1'], ['health', '💊', '#2A9D8F'], ['education', '📚', '#5D6B7E'], ['family', '🧸', '#E66FA0'], ['fun', '🎬', '#8A5BC7'],
    ['travel', '✈️', '#1F9AC0'], ['gifts', '🎁', '#E0563F'], ['insurance', '🛡️', '#79A7D3'], ['fees', '🏧', '#9B5E3C'], ['other', '🧺', '#8C8577']]
    .map((c) => ({ id: c[0], icon: c[1], color: c[2], kind: 'expense' }));
  const INCOME = [['salary', '💼', '#2F9A4C'], ['bonus', '🎉', '#E9AE2E'], ['business', '🏪', '#3D7FD1'], ['interest', '🌱', '#2A9D8F'],
    ['rental', '🏘️', '#B07A45'], ['giftIn', '🎁', '#E66FA0'], ['refund', '↩️', '#8A5BC7'], ['otherIn', '💰', '#8C8577']]
    .map((c) => ({ id: c[0], icon: c[1], color: c[2], kind: 'income' }));
  const CAT = {};
  EXPENSE.concat(INCOME).forEach((c) => { CAT[c.id] = c; });
  const catOf = (id) => CAT[id] || CAT.other;
  const OLD_CATS = { home: 'housing', saving: 'other' }; // the first budget's groups → today's categories

  /* ---------- views ----------
     ids: the accounts to look at. A transfer that leaves the view becomes money taken out
     (or put in) for the side that stays — exactly how the investment maths wants it. With
     `share`, everyday details (categories, notes) are dropped: only amounts remain. */
  function view(pf, ids, share) {
    const txns = [];
    (pf.txns || []).forEach((t) => {
      if (t.type === 'transfer') {
        const a = !!ids[t.acct], b = !!ids[t.to];
        if (a && b) txns.push(share ? plain(t) : t);
        else if (a) txns.push({ id: t.id, type: 'withdraw', day: t.day, amt: t.amt, cur: t.cur, acct: t.acct, ts: t.ts, via: 'transfer' });
        else if (b) txns.push({ id: t.id, type: 'deposit', day: t.day, amt: t.toAmt != null ? t.toAmt : t.amt, cur: t.toCur || t.cur, acct: t.to, ts: t.ts, via: 'transfer' });
        return;
      }
      if (t.type === 'opening') {
        const parts = (t.parts || []).filter((p) => ids[p.acct]);
        if (parts.length) txns.push(Object.assign({}, t, { parts }));
        return;
      }
      if (!t.acct || !ids[t.acct]) return;
      if (share && (t.type === 'expense' || t.type === 'income' || t.type === 'adjust')) {
        const out = t.type === 'expense' || (t.type === 'adjust' && t.amt < 0);
        txns.push({ id: t.id, type: out ? 'withdraw' : 'deposit', day: t.day, amt: Math.abs(t.amt), cur: t.cur, acct: t.acct, ts: t.ts });
        return;
      }
      txns.push(share ? plain(t) : t);
    });
    return Object.assign({}, pf, { accounts: (pf.accounts || []).filter((a) => ids[a.id]), txns });
  }
  function plain(t) { const o = Object.assign({}, t); delete o.note; delete o.cat; return o; }
  const investView = (pf) => view(pf, investIds(pf));
  const accountView = (pf, id) => { const ids = {}; ids[id] = true; return view(pf, ids); };
  /* what family members may receive: investments as they are, every everyday account as a
     single balance — never what anything was spent on */
  function shareView(pf, day) {
    day = day == null ? FF.today() : day;
    const inv = investIds(pf);
    const v = view(pf, inv, true);
    const cash = C().cashByAccount(pf);
    v.accounts = (pf.accounts || []).map((a) => { const o = { id: a.id, kind: a.kind, cur: a.cur }; if (a.name) o.name = a.name; if (a.nameKey) o.nameKey = a.nameKey; return o; });
    (pf.accounts || []).forEach((a) => { if (!inv[a.id]) v.txns.push({ id: 'bal_' + a.id, type: 'adjust', day, amt: r2(cash[a.id] || 0), cur: a.cur, acct: a.id, ts: 0 }); });
    delete v.divSkip;
    v.share = true;
    return v;
  }

  /* ---------- balances ---------- */
  /* an account's worth in its own currency (cash + anything it holds) */
  function accountValue(pf, acc, day) { return C().summary(accountView(pf, acc.id), acc.cur, day).value; }
  /* just the money in it — any stocks it holds follow the market, not your records */
  function accountCash(pf, acc, day) { return C().summary(accountView(pf, acc.id), acc.cur, day).cash; }
  /* everyday accounts first (budgeting comes first), then investments; otherwise in the order added */
  function accounts(pf, base, day) {
    const inv = investIds(pf);
    return (pf.accounts || []).map((a, i) => {
      const value = accountValue(pf, a, day);
      return { acc: a, value, base: value * D().fx(a.cur, base), invest: !!inv[a.id], i };
    }).sort((x, y) => (x.invest - y.invest) || x.i - y.i);
  }

  /* ---------- the month in numbers ---------- */
  function monthStats(pf, base, y, m) {
    const from = FF.monthStart(y, m), to = FF.monthEnd(y, m);
    let income = 0, expense = 0, n = 0;
    const cats = {};
    (pf.txns || []).forEach((t) => {
      if (t.day < from || t.day > to || (t.type !== 'expense' && t.type !== 'income')) return;
      const v = t.amt * D().fx(t.cur, base, t.day);
      n++;
      if (t.type === 'income') { income += v; return; }
      expense += v;
      const c = CAT[t.cat] ? t.cat : 'other';
      cats[c] = (cats[c] || 0) + v;
    });
    const byCat = Object.keys(cats).map((c) => ({ cat: catOf(c), amt: cats[c], pct: expense > 0 ? cats[c] / expense : 0 })).sort((a, b) => b.amt - a.amt);
    return { from, to, income, expense, net: income - expense, byCat, n };
  }
  /* newest first, everything that happened (for "recent" lists) */
  const recent = (pf, n, filter) => (pf.txns || []).filter((t) => t.type !== 'opening' && (!filter || filter(t))).sort((a, b) => b.day - a.day || (b.ts || 0) - (a.ts || 0)).slice(0, n || 9999);

  /* ---------- budgets ----------
     { id, name, amt, cur, period: 'month' | 'week', cats: [] = all spending, accts: [] = all accounts } */
  function periodRange(period, day) {
    if (period === 'week') { const from = FF.weekOf(day) * 7 - 3; return { from, to: from + 6 }; }
    const p = FF.ymd(day);
    return { from: FF.monthStart(p.y, p.m), to: FF.monthEnd(p.y, p.m) };
  }
  function budgetProgress(b, pf, day) {
    day = day == null ? FF.today() : day;
    const r = periodRange(b.period, day);
    let spent = 0;
    const cats = b.cats && b.cats.length ? b.cats : null, accts = b.accts && b.accts.length ? b.accts : null;
    (pf.txns || []).forEach((t) => {
      if (t.type !== 'expense' || t.day < r.from || t.day > r.to) return;
      if (cats && cats.indexOf(CAT[t.cat] ? t.cat : 'other') === -1) return;
      if (accts && accts.indexOf(t.acct) === -1) return;
      spent += t.amt * D().fx(t.cur, b.cur, t.day);
    });
    const total = r.to - r.from + 1, elapsed = FF.clamp(day - r.from + 1, 1, total), daysLeft = Math.max(0, r.to - day + 1);
    const left = b.amt - spent, pct = b.amt > 0 ? spent / b.amt : 0, projected = (spent / elapsed) * total;
    // "heading for…" only once a third of the period has passed (rent on the 1st isn't a trend)
    const status = pct > 1 + 1e-9 ? 'over' : pct >= 0.85 ? 'close' : projected > b.amt * 1.05 && elapsed / total >= 0.33 ? 'risk' : 'ok';
    return { from: r.from, to: r.to, spent, left, pct, daysLeft, perDay: daysLeft > 0 ? Math.max(0, left) / daysLeft : 0, projected, status };
  }
  /* a month in which every monthly budget held (and something was actually logged) */
  function stayedOnBudgets(pf, budgets, y, m) {
    const mb = (budgets || []).filter((b) => b.period !== 'week');
    if (!mb.length) return false;
    const end = FF.monthEnd(y, m);
    if (!(pf.txns || []).some((t) => t.type === 'expense' && t.day >= FF.monthStart(y, m) && t.day <= end)) return false;
    return mb.every((b) => budgetProgress(b, pf, end).pct <= 1 + 1e-9);
  }
  /* the first version kept a separate list of "spends" and per-group limits: fold them into
     records (not tied to an account, so no balance changes) and budgets */
  function upgradeBudget(m) {
    if (!m || !m.budget || m.budgets) return false;
    const b = m.budget, base = (m.pf && m.pf.base) || 'MYR';
    (b.spends || []).forEach((sp) => {
      if (m.pf.txns.some((t) => t.id === sp.id)) return;
      m.pf.txns.push({ id: sp.id, type: 'expense', day: sp.day, amt: r2(sp.amt), cur: base, acct: null, cat: OLD_CATS[sp.cat] || (CAT[sp.cat] ? sp.cat : 'other'), note: sp.note || '', ts: sp.ts || sp.day * FF.DAY_MS });
    });
    m.budgets = b.on ? (b.cats || []).filter((c) => c.limit > 0).map((c) => ({ id: 'b_' + c.id, name: c.name || '', amt: c.limit, cur: base, period: 'month', cats: [OLD_CATS[c.id] || (CAT[c.id] ? c.id : 'other')], ts: 0 })) : [];
    delete m.budget;
    return true;
  }

  /* ---------- the Town Hall: family assets anyone in the family can update ----------
     hall: { name, accounts: { id: { name, kind, cur, entries: { id: { t: 'set' | 'add', amt, day, note, by, ts } } } } } */
  const HALL_KINDS = { fund: '📊', property: '🏡', savings: '🐷', business: '🏪', gold: '🪙', vehicle: '🚙', other: '💼' };
  const entriesOf = (a) => Object.keys((a && a.entries) || {}).map((id) => Object.assign({ id }, a.entries[id])).sort((x, y) => x.day - y.day || (x.ts || 0) - (y.ts || 0));
  function hallBalance(a, day) {
    let v = 0;
    entriesOf(a).forEach((e) => { if (day != null && e.day > day) return; v = e.t === 'set' ? +e.amt : v + (+e.amt); });
    return r2(v);
  }
  function hallTotal(hall, base, day) {
    if (!hall || !hall.accounts) return 0;
    return FF.sum(Object.keys(hall.accounts).map((id) => hall.accounts[id]), (a) => hallBalance(a, day) * D().fx(a.cur, base));
  }
  /* newest changes across all hall accounts */
  function hallActivity(hall, n) {
    const out = [];
    Object.keys((hall && hall.accounts) || {}).forEach((aid) => {
      const a = hall.accounts[aid];
      let v = 0;
      entriesOf(a).forEach((e) => { const before = v; v = e.t === 'set' ? +e.amt : v + (+e.amt); out.push(Object.assign({ aid, acc: a, before, after: v }, e)); });
    });
    return out.sort((x, y) => y.day - x.day || (y.ts || 0) - (x.ts || 0)).slice(0, n || 20);
  }

  /* ---------- automatic US dividends ----------
     events: { SYM: [{ ex, dps }] } — the ex-dividend day and the cash per share (market.js
     works these out from real prices). Whoever held shares at the close before the ex-date
     receives qty × dps, less the US withholding tax (30% for Malaysia — no tax treaty),
     on the pay day. Records are made once (ref) and never again if deleted (divSkip). */
  const DIV_TAX = 0.3;
  const taxOf = (pf) => (pf && pf.divTax != null ? pf.divTax : DIV_TAX);
  function payDayFor(sym, ex) {
    const a = D().asset(sym);
    if (a && a.dv && a.dv.m) {
      for (let d = ex + 1; d <= ex + 60; d++) {
        const p = FF.ymd(d);
        if (a.dv.m.indexOf(p.m) !== -1 && p.d === Math.min(a.dv.d, FF.daysInMonth(p.y, p.m))) return d;
      }
    }
    return ex + 14; // typical gap for US payers
  }
  function holdingAccount(pf, sym, day) {
    const buys = (pf.txns || []).filter((t) => t.sym === sym && t.type === 'buy' && t.acct).sort((a, b) => a.day - b.day);
    const before = buys.filter((t) => t.day <= day);
    const pick = before[before.length - 1] || buys[0];
    if (pick) return pick.acct;
    const inv = Object.keys(investIds(pf));
    return inv[0] || ((pf.accounts || [])[0] || {}).id;
  }
  function dividendPlan(pf, events, day) {
    day = day == null ? FF.today() : day;
    const inv = investView(pf), rate = taxOf(pf), skip = pf.divSkip || [];
    const out = { add: [], coming: [] };
    Object.keys(events || {}).forEach((sym) => {
      const a = D().asset(sym);
      if (!a || a.t === 'crypto') return;
      (events[sym] || []).forEach((e) => {
        if (!(e.dps > 0)) return;
        const q = C().qtyOn(inv, sym, e.ex - 1);
        if (!(q > 1e-9)) return;
        const ref = 'div:' + sym + ':' + FF.iso(e.ex);
        if (skip.indexOf(ref) !== -1 || (pf.txns || []).some((t) => t.ref === ref)) return;
        const pay = payDayFor(sym, e.ex);
        // already written down by hand around then
        if ((pf.txns || []).some((t) => t.type === 'dividend' && t.sym === sym && !t.auto && Math.abs(t.day - pay) <= 12)) return;
        const gross = r2(q * e.dps);
        const rec = { type: 'dividend', day: pay, sym, amt: r2(gross * (1 - rate)), gross, tax: rate, dps: e.dps, q, ex: e.ex, cur: a.c, acct: holdingAccount(pf, sym, e.ex), ref, auto: true };
        if (pay <= day) out.add.push(rec); else out.coming.push(rec);
      });
    });
    out.add.sort((x, y) => x.day - y.day);
    out.coming.sort((x, y) => x.day - y.day);
    return out;
  }
  /* the Dividend calendar: received · coming (known, after tax) · estimated (from the usual
     yield and schedule, after tax) */
  function dividendItems(pf, base, from, to, events, day) {
    day = day == null ? FF.today() : day;
    const inv = investView(pf), rate = taxOf(pf);
    const items = C().received(inv, base, from, to).map((x) => Object.assign(x, { status: 'received', auto: !!(x.tx && x.tx.auto) }));
    const plan = dividendPlan(pf, events, day);
    plan.coming.forEach((p) => { if (p.day >= from && p.day <= to) items.push({ day: p.day, sym: p.sym, a: D().asset(p.sym), amt: p.amt, cur: p.cur, base: p.amt * D().fx(p.cur, base), status: 'coming' }); });
    const known = (pf.txns || []).filter((t) => t.type === 'dividend').map((t) => [t.sym, t.day]).concat(plan.coming.map((p) => [p.sym, p.day]));
    C().projected(inv, base, Math.max(from, day + 1), to).forEach((p) => {
      if (known.some((k) => k[0] === p.sym && Math.abs(k[1] - p.day) <= 25)) return;
      const amt = r2(p.amt * (1 - rate));
      items.push({ day: p.day, sym: p.sym, a: p.a, amt, cur: p.cur, base: amt * D().fx(p.cur, base), status: 'estimated' });
    });
    return items.sort((a, b) => a.day - b.day);
  }

  /* ---------- family help (v2.25) ----------
     Someone who lets their family help (Menu → Privacy → Family helpers) can have a family
     member add or fix an everyday record, delete one, or set an account's balance for them.
     Each change travels as an "op"; the owner's own phone applies it to their records — checked
     here first, so nothing malformed ever lands in anyone's records. Applying an op a second
     time changes nothing (a re-sent op, or one already in the records, is skipped).
       { k: 'add',  tx }            a new record (expense · income · transfer; adjust = an Undo)
       { k: 'edit', tx }            the record tx.id, replaced by tx (everyday records only)
       { k: 'del',  id }            the record id gone (everyday records and balance updates)
       { k: 'bal',  id, acct, v }   "the money in this account is v now": one adjustment, id */
  const HELP_TYPES = { expense: 1, income: 1, transfer: 1 };
  const HELP_DEL = { expense: 1, income: 1, transfer: 1, adjust: 1 };
  const okId = (x) => typeof x === 'string' && x.length > 0 && x.length <= 32;
  const okAmt = (v) => typeof v === 'number' && isFinite(v) && v > 0 && v < 1e12;
  /* a record from someone else, made safe: the right fields, real accounts, sensible values */
  function helpTx(pf, tx, today) {
    if (!pf || !tx || typeof tx !== 'object' || !okId(tx.id)) return null;
    const acc = (id) => (pf.accounts || []).find((a) => a.id === id);
    const day = Math.round(+tx.day);
    if (!isFinite(day) || day > today + 1 || day < today - 3660) return null;
    const from = acc(tx.acct);
    if (!from) return null;
    const out = { id: tx.id, type: tx.type, day, acct: from.id };
    if (tx.type === 'adjust') { // only ever to bring back a balance update (Undo of a delete)
      const amt = +tx.amt;
      if (!isFinite(amt) || FF.isZero(amt) || Math.abs(amt) >= 1e12) return null;
      out.amt = r2(amt); out.cur = from.cur;
      if (tx.start === true) out.start = true;
    } else {
      if (!HELP_TYPES[tx.type] || !okAmt(+tx.amt)) return null;
      out.amt = r2(+tx.amt);
      if (tx.type === 'transfer') {
        const to = acc(tx.to);
        if (!to || to.id === from.id) return null;
        out.to = to.id; out.cur = from.cur;
        if (from.cur !== to.cur) { if (!okAmt(+tx.toAmt)) return null; out.toAmt = r2(+tx.toAmt); out.toCur = to.cur; }
      } else {
        if (D().DISPLAY_CURRENCIES.indexOf(tx.cur) === -1) return null;
        const c = CAT[tx.cat];
        if (!c || c.kind !== tx.type) return null;
        out.cur = tx.cur; out.cat = c.id;
      }
    }
    if (tx.note != null && tx.note !== '') {
      if (typeof tx.note !== 'string') return null;
      const n = tx.note.trim().slice(0, 60);
      if (n) out.note = n;
    }
    return out;
  }
  /* apply one op to these records (changed in place) → did anything change? by: who made it */
  function applyHelpOp(pf, op, by, today, now) {
    if (!pf || !Array.isArray(pf.txns) || !op || typeof op !== 'object') return false;
    const at = (id) => pf.txns.findIndex((x) => x.id === id);
    if (op.k === 'add') {
      const tx = helpTx(pf, op.tx, today);
      if (!tx || at(tx.id) !== -1) return false;
      tx.ts = now;
      if (by) tx.by = by;
      pf.txns.push(tx);
      return true;
    }
    if (op.k === 'edit') {
      const i = at(op.tx && op.tx.id);
      if (i === -1 || !HELP_TYPES[pf.txns[i].type]) return false;
      const tx = helpTx(pf, op.tx, today);
      if (!tx || !HELP_TYPES[tx.type]) return false;
      const old = pf.txns[i];
      tx.ts = old.ts || now;
      if (by) tx.by = by;
      const same = (a, b) => ['type', 'day', 'amt', 'cur', 'acct', 'cat', 'note', 'to', 'toAmt', 'toCur', 'by'].every((k) => (a[k] == null ? null : a[k]) === (b[k] == null ? null : b[k]));
      if (same(old, tx)) return false;
      pf.txns[i] = tx;
      return true;
    }
    if (op.k === 'del') {
      const i = at(op.id);
      if (i === -1 || !HELP_DEL[pf.txns[i].type] || pf.txns[i].start) return false; // a starting balance stays (set the balance instead)
      pf.txns.splice(i, 1);
      return true;
    }
    if (op.k === 'bal') {
      const acc = (pf.accounts || []).find((a) => a.id === op.acct);
      if (!acc || isInvest(pf, acc) || !okId(op.id) || at(op.id) !== -1) return false;
      const v = +op.v;
      if (!isFinite(v) || Math.abs(v) >= 1e12) return false;
      const delta = r2(v - accountCash(pf, acc));
      if (FF.isZero(delta)) return false;
      const tx = { id: op.id, type: 'adjust', day: today, amt: delta, cur: acc.cur, acct: acc.id, ts: now };
      if (by) tx.by = by;
      pf.txns.push(tx);
      return true;
    }
    return false;
  }
  /* the op that puts things back as they are now (the "Undo" in the toast) — worked out before
     the op is applied */
  function helpUndo(pf, op) {
    if (!op) return null;
    if (op.k === 'add') return op.tx && okId(op.tx.id) ? { k: 'del', id: op.tx.id } : null;
    if (op.k === 'bal') return { k: 'del', id: op.id };
    const old = (pf.txns || []).find((x) => x.id === (op.k === 'edit' ? op.tx && op.tx.id : op.id));
    if (!old) return null;
    const copy = JSON.parse(JSON.stringify(old));
    delete copy.by; delete copy.ts; delete copy._pending;
    return op.k === 'edit' ? { k: 'edit', tx: copy } : op.k === 'del' ? { k: 'add', tx: copy } : null;
  }

  FF.ledger = {
    KINDS, KIND_ORDER, kindOf, investIds, isInvest, EXPENSE, INCOME, CAT, catOf, OLD_CATS,
    view, investView, accountView, shareView, accountValue, accountCash, accounts, monthStats, recent,
    periodRange, budgetProgress, stayedOnBudgets, upgradeBudget,
    HALL_KINDS, entriesOf, hallBalance, hallTotal, hallActivity,
    DIV_TAX, taxOf, payDayFor, holdingAccount, dividendPlan, dividendItems,
    HELP_TYPES, HELP_DEL, helpTx, applyHelpOp, helpUndo
  };
})(typeof window !== 'undefined' ? window : this);
