/* ============================================================
   FamFi — screens-manage.js
   Manage tab, "Add a trade" flow, holding detail page,
   transaction sheet, accounts, currency, CSV import.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, C = () => FF.calc, D = () => FF.data;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const M = (v, o) => FF.i18n.money(v, o && o.cur, o);
  const ui = () => FF.ui;
  const A = FF.actions = FF.actions || {};

  /* app-made default names follow the language; names people typed never change */
  const accName = (acc) => acc.name || (acc.nameKey ? t(acc.nameKey) : acc.id);

  const Lg = () => FF.ledger;
  /* whose records: mine, or (family helpers, v2.25) the family member I'm recording for */
  const pfFor = (who) => ((who && S().member(who)) || S().me()).pf;
  const accById = (id, pf) => (pf || S().me().pf).accounts.find((a) => a.id === id);
  const accLabel = (id, pf) => { const a = accById(id, pf); return a ? accName(a) : t('acct.none'); };
  const nameOf = (id) => { const m = id && S().member(id); return m ? m.name : t('help.someone'); };

  /* ---------- record words ---------- */
  function txInfo(tx, base, acctId, pf) {
    const a = tx.sym ? D().asset(tx.sym) : null;
    const name = a ? D().displayName(a, FF.i18n.lang) : '';
    switch (tx.type) {
      // what was paid / received, without a + or −: stock records never move an account's cash
      case 'buy': return { icon: 'bag', tone: 'buy', title: t('tx.bought', { q: FF.i18n.qty(tx.q), name: esc(name) }), amt: tx.q * tx.p + (tx.fee || 0), cur: tx.cur, a, neutral: true };
      case 'sell': return { icon: 'tag', tone: 'sell', title: t('tx.sold', { q: FF.i18n.qty(tx.q), name: esc(name) }), amt: tx.q * tx.p - (tx.fee || 0), cur: tx.cur, a, neutral: true };
      case 'dividend': return { icon: 'dividend', tone: 'div', title: t('tx.dividend', { name: esc(name) }), amt: tx.amt, cur: tx.cur, a };
      case 'deposit': return { icon: 'cashIn', tone: 'cash', title: t('tx.deposit'), amt: tx.amt, cur: tx.cur };
      case 'withdraw': return { icon: 'cashOut', tone: 'cash', title: t('tx.withdraw'), amt: -tx.amt, cur: tx.cur };
      case 'opening': return { icon: 'sparkle', tone: 'opening', title: t('tx.opening'), amt: tx.total != null ? tx.total : FF.sum(tx.parts || [], (p) => p.amt * D().fx(p.cur, base)), cur: base };
      case 'expense': case 'income': {
        const c = Lg().catOf(tx.cat || (tx.type === 'income' ? 'otherIn' : 'other'));
        return { emo: c.icon, color: c.color, title: tx.note ? esc(tx.note) : t('cat.' + c.id), cat: t('cat.' + c.id), amt: tx.type === 'income' ? tx.amt : -tx.amt, cur: tx.cur };
      }
      case 'transfer': {
        const into = acctId && acctId === tx.to;
        const amt = acctId ? (into ? (tx.toAmt != null ? tx.toAmt : tx.amt) : -tx.amt) : tx.amt;
        return { emo: '🔁', color: '#5D6B7E', title: t('tx.transfer', { from: esc(accLabel(tx.acct, pf)), to: esc(accLabel(tx.to, pf)) }), amt, cur: acctId && into ? (tx.toCur || tx.cur) : tx.cur, neutral: !acctId };
      }
      case 'adjust': return { emo: tx.start ? '🏁' : '⚖️', color: '#8C8577', title: tx.note ? esc(tx.note) : t(tx.start ? 'tx.startBal' : 'tx.adjust'), amt: tx.amt, cur: tx.cur };
      default: return { icon: 'dots', title: esc(String(tx.type)), amt: 0, cur: base };
    }
  }
  /* one line in any list of records (Home "Recent", Records, an account's page).
     o: { pf, who } — someone else's records (family helpers): their accounts, and a tap opens
     the record for them. A record a family member made says so ("✍️ Mum"); one still on its
     way to its owner's phone says that too. */
  function recordRow(tx, base, acctId, o) {
    o = o || {};
    const i = txInfo(tx, base, acctId, o.pf);
    const lead = i.emo ? '<span class="tx-ic emo" style="--c:' + i.color + '" aria-hidden="true">' + i.emo + '</span>' : '<span class="tx-ic ' + (i.tone || '') + '">' + ic(i.icon, 20) + '</span>';
    const bits = [];
    if (tx.type === 'expense' || tx.type === 'income') { if (tx.note) bits.push(i.cat); bits.push(tx.acct ? esc(accLabel(tx.acct, o.pf)) : t('acct.none')); }
    else if (tx.type !== 'transfer' && tx.acct && !acctId) bits.push(esc(accLabel(tx.acct, o.pf)));
    if (tx.auto) bits.push(t('div.auto'));
    if (tx._pending) bits.push('<span class="tx-wait">⏳ ' + esc(t('help.waiting')) + '</span>');
    else if (tx.by && tx.by !== o.who) bits.push('<span class="tx-by">✍️ ' + esc(tx.by === S().state.meId ? t('common.you') : nameOf(tx.by)) + '</span>');
    const cls = i.neutral ? '' : i.amt > 0 ? 'pos' : i.amt < 0 ? 'neg' : '';
    const act = o.who ? 'data-act="help-tx" data-who="' + esc(o.who) + '"' : 'data-act="tx"';
    return '<button type="button" class="row tx-row' + (tx._pending ? ' pending' : '') + '" ' + act + ' data-id="' + tx.id + '">' + lead + '<span class="row-main"><span class="row-t">' + i.title + '</span><span class="row-s">' + bits.join(' · ') + '</span></span>' +
      '<span class="row-end"><span class="row-v num ' + cls + '">' + FF.i18n.money(i.amt, i.cur, { sign: !i.neutral }) + '</span><span class="row-s">' + FF.i18n.dateShort(tx.day) + '</span></span></button>';
  }
  const txRow = (tx, base) => recordRow(tx, base);
  /* records grouped by day, newest first, each day with what came in / went out */
  function dayGroups(list, base, acctId, o) {
    let h = '', day = null;
    const sumDay = (d) => FF.sum(list.filter((x) => x.day === d && (x.type === 'expense' || x.type === 'income')), (x) => (x.type === 'income' ? 1 : -1) * x.amt * D().fx(x.cur, base, x.day));
    list.forEach((tx) => {
      if (tx.day !== day) {
        if (day != null) h += '</section>';
        day = tx.day;
        const net = sumDay(day);
        const label = day === FF.today() ? t('common.today') : day === FF.today() - 1 ? t('common.yesterday') : FF.i18n.date(day);
        h += '<div class="day-head"><span>' + label + '</span>' + (FF.isZero(net) ? '' : '<span class="num ' + (net > 0 ? 'pos' : '') + '">' + M(net, { cur: base, sign: true }) + '</span>') + '</div><section class="card list-card">';
      }
      h += recordRow(tx, base, acctId, o);
    });
    return h + (day != null ? '</section>' : '');
  }

  /* ===================================================== MANAGE TAB */
  const manState = { tab: 'records' };
  const recState = { filter: 'all', cat: null, n: 80 };
  const REC_FILTERS = {
    all: () => true, spend: (x) => x.type === 'expense', income: (x) => x.type === 'income', transfer: (x) => x.type === 'transfer' || x.type === 'adjust',
    invest: (x) => ['buy', 'sell', 'dividend', 'deposit', 'withdraw', 'opening'].indexOf(x.type) !== -1
  };
  function manage(ctx) {
    const m = S().me(), pf = m.pf, base = pf.base;
    let h = FF.money.header(t('man.title'));
    h += ui().segmented('man', ['records', 'accounts', 'holdings', 'currency'].map((k) => ({ v: k, l: t('man.tab.' + k) })), manState.tab);
    if (manState.tab === 'records') {
      h += '<div class="chips filter-chips" role="group">' + Object.keys(REC_FILTERS).map((k) => '<button type="button" class="chip-btn' + (recState.filter === k && !recState.cat ? ' on' : '') + '" data-rf="' + k + '">' + t('rec.f.' + k) + '</button>').join('') +
        (recState.cat ? '<button type="button" class="chip-btn on" data-rcat-clear>' + Lg().catOf(recState.cat).icon + ' ' + t('cat.' + recState.cat) + ' ' + ic('close', 12) + '</button>' : '') + '</div>';
      const f = recState.cat ? (x) => (x.type === 'expense' || x.type === 'income') && (x.cat || 'other') === recState.cat : REC_FILTERS[recState.filter] || REC_FILTERS.all;
      const all = Lg().recent(pf, 100000, f);
      if (!all.length) h += '<div class="empty small">' + FF.art.emptyArt('sprout', 96) + '<p>' + t('man.noTx') + '</p><button type="button" class="btn btn-primary" data-act="add-trade">' + ic('plus', 18) + t('home.add') + '</button></div>';
      if (all.length) h += '<p class="tap-hint">' + ic('edit', 14) + '<span>' + t('rec.tapEdit') + '</span></p>';
      h += dayGroups(all.slice(0, recState.n), base);
      if (all.length > recState.n) h += '<button type="button" class="btn btn-ghost btn-block" data-rmore>' + t('rec.more', { n: all.length - recState.n }) + '</button>';
    } else if (manState.tab === 'accounts') {
      const accts = Lg().accounts(pf, base);
      h += '<section class="card list-card">' + accts.map((x) => {
        const k = Lg().kindOf(x.acc);
        return '<button type="button" class="row" data-act="account" data-id="' + x.acc.id + '"><span class="tx-ic emo" style="--c:' + k.color + '" aria-hidden="true">' + k.icon + '</span><span class="row-main"><span class="row-t">' + esc(accName(x.acc)) + '</span><span class="row-s">' + t('acct.kind.' + (x.acc.kind || 'other')) + ' · ' + x.acc.cur + '</span></span><span class="row-end"><span class="row-v num' + (x.value < -0.004 ? ' neg' : '') + '">' + M(x.value, { cur: x.acc.cur }) + '</span>' + (x.acc.cur !== base ? '<span class="row-s num">≈ ' + M(x.base, { cur: base, whole: true }) + '</span>' : '') + '</span>' + ic('chevR', 18) + '</button>';
      }).join('') + '</section><button type="button" class="btn btn-soft btn-block" data-act="add-account">' + ic('plus', 18) + t('acct.add') + '</button>';
    } else if (manState.tab === 'holdings') {
      const s = C().summary(Lg().investView(pf), base);
      h += '<section class="card list-card">' + (s.holdings.length ? s.holdings.map((x) => FF.money.holdingRow(x, base)).join('') : '<p class="muted center pad">' + t('man.noHoldings') + '</p>') + '</section>';
      h += '<div class="btn-stack"><button type="button" class="btn btn-primary btn-block" data-act="add-trade" data-type="buy">' + ic('plus', 18) + t('ret.addBuy') + '</button><button type="button" class="btn btn-soft btn-block" data-act="csv">' + ic('file', 18) + t('csv.title') + '</button></div>';
    } else {
      h += '<section class="card"><div class="card-head"><h2>' + t('cur.showIn') + '</h2>' + ui().learnBtn('currency') + '</div><div class="radio-list">' + D().DISPLAY_CURRENCIES.map((c) => '<button type="button" class="radio' + (c === base ? ' on' : '') + '" data-act="set-base" data-cur="' + c + '" role="radio" aria-checked="' + (c === base) + '"><span class="cur-badge">' + FF.i18n.money(0, c, { whole: true }).replace(/[0-9\s]/g, '') + '</span><span class="row-main"><span class="row-t">' + t('cur.' + c) + '</span><span class="row-s">' + c + '</span></span><span class="radio-dot">' + ic('check', 16) + '</span></button>').join('') + '</div></section>';
      const fi = D().fxInfo;
      const fxNote = !fi.live ? t('cur.note') : t(fi.src === 'ecb' ? 'cur.noteEcb' : 'cur.noteEr', { date: fi.date ? FF.i18n.date(FF.fromISO(fi.date)) : '' });
      h += '<section class="card"><div class="card-head"><h2>' + t('cur.rates') + '</h2>' + (fi.live ? '<span class="src-tag live"><i></i>' + t('cur.live') + '</span>' : '<span class="src-tag demo">' + t('common.demo') + '</span>') + '</div><dl class="kv">' + ['USD', 'SGD', 'THB', 'MYR'].filter((c) => c !== base).map((c) => '<div><dt>1 ' + c + '</dt><dd class="num">' + FF.i18n.price(D().fx(c, base), base, 4) + '</dd></div>').join('') + '</dl><p class="hint">' + ic('info', 14) + '<span>' + fxNote + '</span></p></section>';
    }
    return h;
  }
  function afterManage(el) {
    const seg = el.querySelector('[data-seg="man"]');
    if (seg) seg.addEventListener('click', (e) => { const b = e.target.closest('.seg-b'); if (!b) return; manState.tab = b.dataset.v; ui().sfx.tap(); FF.app.refresh(true); });
    el.querySelectorAll('[data-rf]').forEach((b) => b.addEventListener('click', () => { recState.filter = b.dataset.rf; recState.cat = null; recState.n = 80; ui().sfx.tap(); FF.app.refresh(true); }));
    const cc = el.querySelector('[data-rcat-clear]');
    if (cc) cc.addEventListener('click', () => { recState.cat = null; ui().sfx.tap(); FF.app.refresh(true); });
    const more = el.querySelector('[data-rmore]');
    if (more) more.addEventListener('click', () => { recState.n += 120; FF.app.refresh(true); });
  }

  /* ===================================================== ADD A TRADE */
  const EVERYDAY = { expense: 1, income: 1, transfer: 1 };
  const TYPE_GROUPS = [
    ['everyday', [{ v: 'expense', emo: '🧾' }, { v: 'income', emo: '💰' }, { v: 'transfer', emo: '🔁' }]],
    ['investing', [{ v: 'buy', icon: 'bag' }, { v: 'sell', icon: 'tag' }, { v: 'dividend', icon: 'dividend' }]]
  ];
  /* preset: { type, sym, acct } — or { edit: record } to change one. preset.who: a family member
     I'm recording for (family helpers): their accounts, everyday records only, and the change
     goes to them (store.helpEdit) */
  function openTrade(preset) {
    preset = preset || {};
    const pf = pfFor(preset.who);
    const ed = preset.edit;
    const st = Object.assign({ step: 'type', type: null, sym: null, q: '', p: '', fee: '', day: FF.today(), acct: null, amt: '', query: '', cur: pf.base, note: '', cat: null, acctFixed: !!preset.acct }, preset);
    if (ed) {
      Object.assign(st, { type: ed.type, sym: ed.sym || null, q: ed.q != null ? String(ed.q) : '', p: ed.p != null ? String(ed.p) : '', fee: ed.fee ? String(ed.fee) : '', day: ed.day, acct: ed.acct, amt: ed.amt != null ? String(ed.amt) : '', cur: ed.cur || pf.base, note: ed.note || '', cat: ed.cat || null, to: ed.to || null, toAmt: ed.toAmt != null ? String(ed.toAmt) : '', editId: ed.id, fromDetail: true, step: 'details' });
    } else if (st.type && EVERYDAY[st.type]) { st.step = 'details'; prepMoney(st); }
    else if (st.type && !st.sym && (st.type === 'deposit' || st.type === 'withdraw')) st.step = 'details';
    else if (st.type && !st.sym) st.step = 'asset';
    else if (st.type && st.sym) st.step = 'details';
    if (!st.acct) st.acct = (pf.accounts[0] || {}).id;
    if (st.sym && !ed) prefill(st);
    return ui().openSheet({ className: 'sheet-tall trade-sheet' + (st.who ? ' help-sheet' : ''), label: st.who ? t('help.recordFor', { name: nameOf(st.who) }) : t('trade.title'), state: st, render: renderTrade, onRender: mountTrade });
  }
  /* what you own of the asset on a day — not counting the record being edited (so a sale you
     are fixing doesn't count against itself) */
  function ownedFor(st, day) {
    const pf = pfFor(st.who);
    return C().qtyOn(st.editId ? Object.assign({}, pf, { txns: pf.txns.filter((x) => x.id !== st.editId) }) : pf, st.sym, day);
  }
  /* editing a record: Delete sits under Save (tap twice, and there's Undo) */
  const delBtn = (st) => (st.editId ? '<button type="button" class="btn btn-danger-soft btn-block" id="rec-del">' + ic('trash', 18) + '<span>' + t('tx.delete') + '</span></button>' : '');
  function mountDelete(body, api) {
    const del = body.querySelector('#rec-del');
    if (!del) return;
    del.addEventListener('click', () => {
      if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.innerHTML = ic('trash', 18) + '<span>' + t('tx.deleteSure') + '</span>'; ui().haptic(); return; }
      if (api.state.who) { api.close(true); helpChange(api.state.who, { k: 'del', id: api.state.editId }, 'help.deleted', 'trash'); return; }
      const snap = S().snapshot();
      S().deleteTxn(api.state.editId); api.close(true);
      ui().toast(t('tx.deleted'), { icon: 'trash', action: t('common.undo'), actionIcon: 'undo', onAction: () => S().restore(snap) });
    });
  }
  /* send a change to a family member's records, say so, offer Undo (the opposite change) */
  function helpChange(who, op, msg, icon) {
    const r = S().helpEdit(who, op);
    if (!r) { ui().toast(t('help.nothing'), { icon: 'info' }); return null; }
    ui().sfx.pop(); ui().haptic();
    ui().toast(t(msg, { name: '<b>' + esc(nameOf(who)) + '</b>' }), { icon, tone: 'success', action: r.undo ? t('common.undo') : null, actionIcon: 'undo', onAction: () => { if (r.undo && S().helpEdit(who, r.undo)) ui().toast(t('common.undone'), { icon: 'undo' }); } });
    return r;
  }
  /* everyday records: sensible starting choices (the account you used last for this) */
  function prepMoney(st) {
    const pf = pfFor(st.who);
    const last = Lg().recent(pf, 1, (x) => x.type === st.type)[0];
    const everyday = pf.accounts.filter((a) => !Lg().isInvest(pf, a));
    if (!st.acct || !accById(st.acct, pf)) st.acct = (last && last.acct && accById(last.acct, pf) ? last.acct : (everyday[0] || pf.accounts[0] || {}).id);
    if (st.type === 'transfer') {
      if (!st.to || st.to === st.acct || !accById(st.to, pf)) st.to = (last && last.to && last.to !== st.acct && accById(last.to, pf) ? last.to : (pf.accounts.find((a) => a.id !== st.acct) || {}).id) || null;
      st.cur = (accById(st.acct, pf) || {}).cur || pf.base;
    }
  }
  function prefill(st) {
    const a = D().asset(st.sym);
    if (!a) return;
    if (st.type === 'buy' || st.type === 'sell') {
      // with a live feed, wait for the real price rather than suggest a placeholder
      if (!st.p) { st.pAuto = true; st.p = D().isLive(st.sym) || !FF.market.keys().fh ? String(D().price(st.sym, st.day)) : ''; }
    }
    if (st.type === 'dividend' && !st.amt) {
      const pf = S().me().pf;
      const proj = C().projected(pf, pf.base, st.day - 120, st.day).filter((x) => x.sym === st.sym).pop();
      if (proj) { st.amt = String(proj.amt); st.day = proj.day; }
    }
    const pf = S().me().pf;
    const prev = pf.txns.find((x) => x.sym === st.sym && x.acct);
    if (prev) st.acct = prev.acct;
    else { const match = pf.accounts.find((acc) => acc.cur === a.c) || pf.accounts.find((acc) => a.t === 'crypto' && acc.kind === 'crypto'); if (match) st.acct = match.id; }
  }
  function renderTrade(api) {
    const st = api.state, pf = pfFor(st.who);
    const back = '<button type="button" class="icon-btn" data-step-back aria-label="' + esc(t('common.back')) + '">' + ic('chevL', 22) + '</button>';
    const close = '<button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button>';
    if (st.step === 'type') {
      // for someone else: everyday money only (their investments are theirs to record)
      return '<div class="sheet-head">' + '<span class="sh-spacer"></span><h2>' + (st.who ? t('help.recordFor', { name: esc(nameOf(st.who)) }) : t('trade.title')) + '</h2>' + close + '</div>' + (st.who ? helpBanner(st.who) : '') +
        TYPE_GROUPS.filter((g) => !st.who || g[0] === 'everyday').map((g) => '<h3 class="sub-h">' + t('trade.group.' + g[0]) + '</h3><div class="type-grid">' + g[1].map((x) => '<button type="button" class="type-tile t-' + x.v + '" data-type="' + x.v + '"><span class="tt-ic">' + (x.emo ? '<span class="tt-emo" aria-hidden="true">' + x.emo + '</span>' : ic(x.icon, 26)) + '</span><span class="tt-t" data-fit="12">' + t('trade.' + x.v) + '</span><span class="tt-s">' + t('trade.' + x.v + 'S') + '</span></button>').join('') + '</div>').join('');
    }
    if (EVERYDAY[st.type]) return renderMoney(api, back, close);
    if (st.step === 'asset') {
      const owned = C().summary(pf, pf.base).holdings;
      const onlyOwned = st.type === 'sell' || st.type === 'dividend';
      let list = '';
      if (st.query) {
        const res = D().search(st.query, [pf.base]).filter((a) => !onlyOwned || owned.some((h) => h.sym === a.s));
        const more = onlyOwned ? '' : remoteHtml(st, res);
        list = res.map((a) => assetRow(a, pf)).join('') + more;
        if (!res.length && !more) list = '<div class="empty small"><p>' + t('trade.noResults', { q: esc(st.query) }) + '</p></div>';
      } else {
        if (owned.length) list += '<h3 class="sub-h">' + t('trade.yours') + '</h3>' + owned.map((hh) => assetRow(hh.a, pf, hh.qty)).join('');
        if (!onlyOwned) list += '<h3 class="sub-h">' + t('trade.popular') + '</h3><div class="chips">' + (D().POPULAR[pf.base] || D().POPULAR.MYR).map((sym) => { const a = D().asset(sym); return '<button type="button" class="chip-btn" data-sym="' + sym + '">' + ui().assetLogo(a, 22) + esc(D().displayName(a, FF.i18n.lang)) + '</button>'; }).join('') + '</div>';
      }
      return '<div class="sheet-head">' + back + '<h2>' + t(st.type === 'sell' ? 'trade.whichSell' : st.type === 'dividend' ? 'trade.whichDiv' : 'trade.whichBuy') + '</h2>' + close + '</div>' +
        '<label class="search"><span class="search-ic">' + ic('search', 20) + '</span><input type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="' + esc(t('trade.searchPh')) + '" value="' + esc(st.query) + '" id="trade-q" autofocus aria-label="' + esc(t('trade.searchPh')) + '"></label>' +
        '<div class="asset-list" id="asset-list">' + list + '</div>';
    }
    // details
    const a = st.sym ? D().asset(st.sym) : null;
    if (a) FF.market.focus(a.s);
    const isCash = st.type === 'deposit' || st.type === 'withdraw';
    let f = '<div class="sheet-head">' + (st.fromDetail ? '<span class="sh-spacer"></span>' : back) + '<h2>' + t(st.editId ? 'rec.editT' : 'trade.' + st.type) + '</h2>' + close + '</div>';
    if (a) f += '<div class="asset-head">' + ui().assetLogo(a, 48) + '<div class="row-main"><span class="row-t">' + esc(D().displayName(a, FF.i18n.lang)) + '</span><span class="row-s">' + esc(a.s) + ' · ' + esc(a.x) + ' · ' + t('type.' + a.t) + '</span></div><div class="row-end"><span class="row-v num" id="ah-price">' + FF.i18n.price(D().price(a.s, FF.today()), a.c) + '</span><span class="row-s" id="ah-src">' + FF.money.sourceTag(a.s).replace(/<span class="src-time">.*?<\/span>/, '') + '</span></div></div>';
    f += '<div class="form">';
    if (st.type === 'buy' || st.type === 'sell') {
      const owned = ownedFor(st, FF.today());
      f += '<label class="field"><span class="f-l">' + t(a.t === 'crypto' ? 'trade.howManyCoins' : 'trade.howMany') + '</span><div class="stepper"><button type="button" class="icon-btn" data-q="-1" aria-label="−">' + ic('minus', 20) + '</button><input id="f-q" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(st.q) + '"><button type="button" class="icon-btn" data-q="1" aria-label="+">' + ic('plus', 20) + '</button></div>' + (st.type === 'sell' ? '<span class="f-hint">' + t('trade.youOwn', { n: FF.i18n.qty(owned) }) + ' <button type="button" class="link" data-all>' + t('trade.sellAll') + '</button></span>' : '') + '</label>';
      f += '<label class="field"><span class="f-l">' + t(st.type === 'buy' ? 'trade.pricePaid' : 'trade.priceSold') + ' (' + a.c + ')' + ui().learnBtn('price') + '</span><input id="f-p" inputmode="decimal" autocomplete="off" placeholder="' + esc(st.p ? '' : t('trade.gettingPrice')) + '" value="' + esc(st.p) + '"><span class="f-hint"><button type="button" class="link" data-dayprice>' + t('trade.useDayPrice') + '</button></span></label>';
    } else {
      if (isCash) f += '<div class="field"><span class="f-l">' + t('acct.cur') + '</span><div class="chips" role="radiogroup" aria-label="' + esc(t('acct.cur')) + '">' + cashCurrencies(pf.base).map((c) => '<button type="button" class="chip-btn' + (c === st.cur ? ' on' : '') + '" data-cur="' + c + '" role="radio" aria-checked="' + (c === st.cur) + '">' + c + '</button>').join('') + '</div></div>';
      f += '<label class="field"><span class="f-l">' + t(st.type === 'dividend' ? 'trade.amountGot' : 'trade.amount') + ' <span id="f-cur">(' + (a ? a.c : st.cur) + ')</span></span><input id="f-amt" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' + esc(st.amt) + '"' + (isCash ? ' autofocus' : '') + '></label>';
    }
    f += '<label class="field"><span class="f-l">' + t('trade.date') + '</span><input id="f-day" type="date" max="' + FF.iso(FF.today()) + '" value="' + FF.iso(st.day) + '"></label>';
    if (pf.accounts.length > 1) f += '<div class="field"><span class="f-l">' + t('trade.account') + '</span><div class="chips">' + pf.accounts.map((acc) => '<button type="button" class="chip-btn' + (acc.id === st.acct ? ' on' : '') + '" data-acct="' + acc.id + '">' + esc(accName(acc)) + ' · ' + acc.cur + '</button>').join('') + '</div></div>';
    if (st.type === 'buy' || st.type === 'sell') f += '<details class="more"><summary>' + t('trade.more') + ic('chevD', 16) + '</summary><label class="field"><span class="f-l">' + t('trade.fee') + ' (' + a.c + ')' + ui().learnBtn('fees') + '</span><input id="f-fee" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' + esc(st.fee) + '"></label></details>';
    f += '</div><p class="summary" id="trade-sum" aria-live="polite"></p><p class="form-err" id="trade-err" role="alert"></p>';
    f += '<button type="button" class="btn btn-primary btn-block btn-lg" id="trade-go">' + ic('check', 20) + '<span>' + t(st.editId ? 'rec.saveEdit' : 'trade.cta.' + st.type) + '</span></button>' + delBtn(st);
    // stock records only track investments: say so where it matters (money coming back to you)
    if (st.type === 'sell' || st.type === 'dividend') f += '<p class="hint center">' + ic('info', 14) + '<span>' + t('trade.cashNote') + '</span></p>';
    return f;
  }
  /* ===================================================== EVERYDAY MONEY: spent · received · moved */
  const CURS = FF.data.DISPLAY_CURRENCIES;
  const curList = (first) => [first].concat(CURS.filter((c) => c !== first));
  function acctChips(attr, sel, exclude, pf) {
    pf = pf || S().me().pf;
    return '<div class="chips acct-chips">' + Lg().accounts(pf, pf.base).map((x) => x.acc).filter((a) => a.id !== exclude).map((a) => { const k = Lg().kindOf(a); return '<button type="button" class="chip-btn' + (a.id === sel ? ' on' : '') + '" ' + attr + '="' + a.id + '"><span aria-hidden="true">' + k.icon + '</span>' + esc(accName(a)) + (a.cur !== pf.base ? ' · ' + a.cur : '') + '</button>'; }).join('') + '</div>';
  }
  /* "these are Mum's records — she'll see it was you" */
  const helpBanner = (who) => { const m = S().member(who); return '<div class="help-banner">' + FF.art.avatar(m && m.avatar, 30) + '<span>' + t('help.banner', { name: '<b>' + esc(nameOf(who)) + '</b>' }) + '</span></div>'; };
  function renderMoney(api, back, close) {
    const st = api.state, pf = pfFor(st.who);
    const tr = st.type === 'transfer';
    const from = accById(st.acct, pf), to = accById(st.to, pf);
    const cross = tr && from && to && from.cur !== to.cur;
    const title = st.editId ? t('rec.editT') : st.who ? t('help.t.' + st.type, { name: esc(nameOf(st.who)) }) : t('trade.' + st.type);
    let f = '<div class="sheet-head">' + (st.editId ? '<span class="sh-spacer"></span>' : back) + '<h2>' + title + '</h2>' + close + '</div>';
    if (st.who) f += helpBanner(st.who);
    f += '<label class="amt-wrap t-' + st.type + '"><span class="amt-cur" id="m-cur">' + (tr && from ? from.cur : st.cur) + '</span><input id="m-amt" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' + esc(st.amt) + '" aria-label="' + esc(t('trade.amount')) + '"></label>';
    if (!tr) f += '<div class="chips cur-chips" role="radiogroup" aria-label="' + esc(t('acct.cur')) + '">' + curList(pf.base).map((c) => '<button type="button" class="chip-btn sm' + (c === st.cur ? ' on' : '') + '" data-mcur="' + c + '" role="radio" aria-checked="' + (c === st.cur) + '">' + c + '</button>').join('') + '</div>';
    f += '<div class="form">';
    if (tr) {
      f += '<div class="field"><span class="f-l">' + t('rec.from') + '</span>' + acctChips('data-from', st.acct, null, pf) + '</div>';
      f += '<div class="field"><span class="f-l">' + t('rec.to') + '</span>' + (pf.accounts.length > 1 ? acctChips('data-to', st.to, st.acct, pf) : '<p class="hint">' + ic('info', 14) + '<span>' + t('rec.needTwo') + '</span></p>') + '</div>';
      if (cross) f += '<label class="field"><span class="f-l">' + t('rec.received', { cur: to.cur }) + '</span><input id="m-toamt" inputmode="decimal" autocomplete="off" value="' + esc(st.toAmt || '') + '" placeholder="0.00"><span class="f-hint">' + t('rec.rateHint', { rate: FF.i18n.price(D().fx(from.cur, to.cur), to.cur, 4), from: from.cur }) + '</span></label>';
    } else {
      const cats = st.type === 'income' ? Lg().INCOME : Lg().EXPENSE;
      f += '<div class="field"><span class="f-l">' + t('rec.category') + '</span><div class="cat-grid">' + cats.map((c) => '<button type="button" class="cat-btn' + (c.id === st.cat ? ' on' : '') + '" data-mcat="' + c.id + '" style="--c:' + c.color + '"><span class="cb-ic" aria-hidden="true">' + c.icon + '</span><span class="cb-n">' + t('cat.' + c.id) + '</span></button>').join('') + '</div></div>';
      f += '<div class="field"><span class="f-l">' + t(st.type === 'income' ? 'rec.into' : 'rec.paidFrom') + '</span>' + acctChips('data-macct', st.acct, null, pf) + '</div>';
    }
    f += '<div class="field-row"><label class="field"><span class="f-l">' + t('trade.date') + '</span><input id="m-day" type="date" max="' + FF.iso(FF.today()) + '" value="' + FF.iso(st.day) + '"></label></div>';
    f += '<label class="field"><span class="f-l">' + t('rec.note') + '</span><input id="m-note" maxlength="60" autocomplete="off" placeholder="' + esc(t('rec.notePh.' + st.type)) + '" value="' + esc(st.note || '') + '"></label>';
    f += '</div><p class="summary" id="m-sum" aria-live="polite"></p><p class="form-err" id="m-err" role="alert"></p>';
    f += '<button type="button" class="btn btn-primary btn-block btn-lg" id="m-go">' + ic('check', 20) + '<span>' + t(st.editId ? 'rec.saveEdit' : 'rec.save.' + st.type) + '</span></button>' + delBtn(st);
    return f;
  }
  function mountMoney(body, api) {
    const st = api.state, pf = pfFor(st.who);
    const accById2 = (id) => accById(id, pf);
    const $ = (q) => body.querySelector(q);
    const keep = () => { if ($('#m-amt')) st.amt = $('#m-amt').value; if ($('#m-note')) st.note = $('#m-note').value; if ($('#m-toamt')) st.toAmt = $('#m-toamt').value; const d = FF.fromISO($('#m-day').value); if (d != null) st.day = Math.min(d, FF.today()); };
    const rerender = () => { keep(); api.render(); };
    const autoTo = () => {
      const from = accById2(st.acct), to = accById2(st.to);
      if (!from || !to || from.cur === to.cur || st.toEdited) return;
      const v = num(st.amt);
      st.toAmt = v > 0 ? String(FF.round2(v * D().fx(from.cur, to.cur))) : '';
      if ($('#m-toamt')) $('#m-toamt').value = st.toAmt;
    };
    const update = () => {
      keep();
      if (st.type === 'transfer') autoTo();
      const v = num(st.amt);
      let s = '';
      if (v > 0) {
        if (st.type === 'transfer') { const from = accById2(st.acct), to = accById2(st.to); if (from && to) s = t('rec.sum.transfer', { amount: '<b>' + FF.i18n.money(v, from.cur) + '</b>', from: esc(accName(from)), to: esc(accName(to)) }); }
        else s = t('rec.sum.' + st.type, { amount: '<b>' + FF.i18n.money(v, st.cur) + '</b>', cat: st.cat ? t('cat.' + st.cat) : '…', acct: esc(accLabel(st.acct, pf)) });
      }
      $('#m-sum').innerHTML = s;
      $('#m-err').textContent = '';
    };
    body.querySelectorAll('input').forEach((i) => i.addEventListener('input', update));
    $('#m-day').addEventListener('change', update);
    if ($('#m-toamt')) $('#m-toamt').addEventListener('input', () => { st.toEdited = true; update(); });
    body.querySelectorAll('[data-mcur]').forEach((b) => b.addEventListener('click', () => { st.cur = b.dataset.mcur; body.querySelectorAll('[data-mcur]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); $('#m-cur').textContent = st.cur; ui().sfx.tap(); update(); }));
    body.querySelectorAll('[data-mcat]').forEach((b) => b.addEventListener('click', () => { st.cat = b.dataset.mcat; body.querySelectorAll('[data-mcat]').forEach((x) => x.classList.toggle('on', x === b)); ui().sfx.tap(); ui().haptic(); update(); }));
    body.querySelectorAll('[data-macct]').forEach((b) => b.addEventListener('click', () => { st.acct = b.dataset.macct; body.querySelectorAll('[data-macct]').forEach((x) => x.classList.toggle('on', x === b)); ui().sfx.tap(); update(); }));
    body.querySelectorAll('[data-from]').forEach((b) => b.addEventListener('click', () => { st.acct = b.dataset.from; if (st.to === st.acct) st.to = (pf.accounts.find((a) => a.id !== st.acct) || {}).id; st.cur = (accById2(st.acct) || {}).cur; st.toEdited = false; ui().sfx.tap(); rerender(); }));
    body.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', () => { st.to = b.dataset.to; st.toEdited = false; ui().sfx.tap(); rerender(); }));
    $('#m-go').addEventListener('click', () => submitMoney(api));
    mountDelete(body, api);
    update();
    if (!st.amt && !FF.shot) setTimeout(() => $('#m-amt') && $('#m-amt').focus({ preventScroll: true }), 380);
  }
  function submitMoney(api) {
    const st = api.state, pf = pfFor(st.who);
    const err = (k) => { const e = api.body.querySelector('#m-err'); e.textContent = t(k); ui().haptic(); e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); };
    const v = num(st.amt);
    if (!(v > 0)) return err('trade.err.amt');
    let tx;
    if (st.type === 'transfer') {
      const from = accById(st.acct, pf), to = accById(st.to, pf);
      if (!from || !to || from.id === to.id) return err('rec.err.accounts');
      tx = { type: 'transfer', day: st.day, amt: v, cur: from.cur, acct: from.id, to: to.id, note: (st.note || '').trim() };
      if (from.cur !== to.cur) { const tv = num(st.toAmt); if (!(tv > 0)) return err('rec.err.toAmt'); tx.toAmt = tv; tx.toCur = to.cur; } else { tx.toAmt = undefined; tx.toCur = undefined; }
    } else {
      if (!st.cat) return err('rec.err.cat');
      if (!accById(st.acct, pf)) return err('rec.err.accounts');
      tx = { type: st.type, day: st.day, amt: v, cur: st.cur, acct: st.acct, cat: st.cat, note: (st.note || '').trim() };
    }
    if (st.who) { // a family member's records: the change goes to them
      ['toAmt', 'toCur', 'note'].forEach((k) => { if (tx[k] === undefined || tx[k] === '') delete tx[k]; });
      const op = st.editId ? { k: 'edit', tx: Object.assign({ id: st.editId }, tx) } : { k: 'add', tx: Object.assign({ id: FF.uid('t') }, tx) };
      api.close(true);
      helpChange(st.who, op, st.editId ? 'help.updated' : 'help.added', st.type === 'transfer' ? '🔁' : st.editId ? 'check' : Lg().catOf(st.cat).icon);
      return;
    }
    const snap = S().snapshot();
    api.close(true);
    ui().sfx.pop(); ui().haptic();
    if (st.editId) { S().updateTxn(st.editId, tx); ui().toast(t('rec.saved'), { icon: 'check', tone: 'success', action: t('common.undo'), actionIcon: 'undo', onAction: () => S().restore(snap) }); return; }
    const res = S().addTxn(tx);
    const i = txInfo(res.tx, S().me().pf.base);
    ui().toast(t('rec.done.' + st.type, { what: i.title, amount: '<b>' + FF.i18n.money(v, tx.cur) + '</b>' }), { icon: tx.type === 'transfer' ? '🔁' : i.emo, tone: 'success', action: t('common.undo'), actionIcon: 'undo', onAction: () => { S().restore(snap); ui().toast(t('common.undone'), { icon: 'undo' }); } });
    FF.app.celebrate(res);
  }

  /* with a live feed, never show a placeholder price as if it were real (crypto is always live) */
  const knownPrice = (a) => D().isLive(a.s) || !FF.market.keys().fh;
  /* "More from the US market": any US stock / ETF beyond the built-in list (Finnhub lookup) */
  const canLookUp = () => !!(FF.market.keys().fh);
  function remoteHtml(st, local) {
    const q = st.query.trim();
    if (q.length < 2 || !canLookUp()) return '';
    const r = st.remote || {};
    const head = '<h3 class="sub-h">' + ic('globe', 14) + t('trade.moreUS') + '</h3>';
    if (r.q !== q || r.loading) return head + '<p class="muted pad search-wait" role="status">' + t('trade.searchingUS') + '</p>';
    const known = {};
    local.forEach((a) => { known[a.s] = 1; });
    const rows = (r.list || []).filter((x) => !known[x.s] && !D().asset(x.s));
    if (!rows.length) return '';
    return head + rows.map((x) => '<button type="button" class="row" data-remote="' + esc(x.s) + '" data-n="' + esc(x.n) + '" data-t="' + x.t + '">' + ui().assetLogo({ s: x.s, n: x.n, t: x.t }, 40) +
      '<span class="row-main"><span class="row-t">' + esc(x.n) + '</span><span class="row-s">' + esc(x.s) + ' · ' + t('trade.usMarket') + '</span></span><span class="row-end"><span class="type-chip t-' + x.t + '">' + t('type.' + x.t + 'Short') + '</span><span class="row-s">' + ic('plus', 14) + '</span></span></button>').join('');
  }
  /* currencies cash can be added / taken out in — yours ("Show my money in") first */
  const CASH_CURS = FF.data.DISPLAY_CURRENCIES;
  const cashCurrencies = (base) => [base].concat(CASH_CURS.filter((c) => c !== base));
  function assetRow(a, pf, q) {
    return '<button type="button" class="row" data-sym="' + a.s + '">' + ui().assetLogo(a, 40) + '<span class="row-main"><span class="row-t">' + esc(D().displayName(a, FF.i18n.lang)) + '</span><span class="row-s">' + esc(a.s) + ' · ' + esc(a.x) + '</span></span><span class="row-end"><span class="type-chip t-' + a.t + '">' + t('type.' + a.t + 'Short') + '</span>' + (q != null ? '<span class="row-s">' + FF.i18n.qty(q) + '</span>' : knownPrice(a) ? '<span class="row-s num">' + FF.i18n.price(D().price(a.s, FF.today()), a.c) + '</span>' : '') + '</span></button>';
  }
  const num = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  function mountTrade(body, api) {
    const st = api.state;
    const go = (step) => { st.step = step; api.render(); };
    body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
    const bk = body.querySelector('[data-step-back]');
    if (bk) bk.addEventListener('click', () => { if (st.step === 'details') { if (st.type === 'deposit' || st.type === 'withdraw' || EVERYDAY[st.type]) go('type'); else go('asset'); } else go('type'); });
    if (st.step === 'type') {
      body.querySelectorAll('.type-tile').forEach((b) => b.addEventListener('click', () => {
        st.type = b.dataset.type; ui().sfx.tap();
        // the account so far is only a stand-in (the first one, often the brokerage) unless the
        // caller chose it: start from the one usually used for this, like the quick buttons do
        if (EVERYDAY[st.type]) { if (!st.acctFixed) st.acct = null; prepMoney(st); go('details'); } else go(st.type === 'deposit' || st.type === 'withdraw' ? 'details' : 'asset');
      }));
      return;
    }
    if (EVERYDAY[st.type]) { mountMoney(body, api); return; }
    if (st.step === 'asset') {
      const q = body.querySelector('#trade-q');
      const repaint = () => {
        const list = body.querySelector('#asset-list');
        if (!list || !document.body.contains(list)) return;
        const tmp = document.createElement('div');
        tmp.innerHTML = renderTrade(api);
        list.innerHTML = tmp.querySelector('#asset-list').innerHTML;
      };
      // look further than the built-in list, a moment after typing stops
      const lookUp = () => {
        clearTimeout(st.remoteTimer);
        const qq = st.query.trim();
        if (st.type === 'sell' || st.type === 'dividend' || qq.length < 2 || !canLookUp()) return;
        if (st.remote && st.remote.q === qq && !st.remote.loading) return;
        st.remoteTimer = setTimeout(async () => {
          st.remote = { q: qq, loading: true };
          let list = [];
          try { list = await FF.market.searchUS(qq); } catch (e) { list = []; }
          if (st.query.trim() !== qq) return;
          st.remote = { q: qq, list };
          repaint();
        }, 350);
      };
      q.addEventListener('input', () => {
        st.query = q.value;
        const pos = q.selectionStart;
        repaint();
        q.setSelectionRange(pos, pos);
        lookUp();
      });
      lookUp();
      body.addEventListener('click', async (e) => {
        const r = e.target.closest('[data-remote]');
        if (r) {
          if (r.classList.contains('busy')) return;
          r.classList.add('busy'); r.setAttribute('aria-busy', 'true');
          try {
            const a = await FF.market.addUS(r.dataset.remote, { n: r.dataset.n, t: r.dataset.t });
            if (!api.body || !document.body.contains(api.body)) return;
            st.sym = a.s; st.p = ''; st.amt = '';
            prefill(st); ui().sfx.tap(); go('details');
          } catch (err) {
            r.classList.remove('busy'); r.removeAttribute('aria-busy');
            ui().toast(t('trade.addFailed'), { icon: 'info' });
          }
          return;
        }
        const b = e.target.closest('[data-sym]');
        if (!b) return;
        st.sym = b.dataset.sym; st.p = ''; st.amt = '';
        prefill(st); ui().sfx.tap(); go('details');
      });
      return;
    }
    // details
    const $ = (id) => body.querySelector(id);
    const a = st.sym ? D().asset(st.sym) : null;
    const update = () => {
      if ($('#f-q')) st.q = $('#f-q').value;
      if ($('#f-p')) st.p = $('#f-p').value;
      if ($('#f-fee')) st.fee = $('#f-fee').value;
      if ($('#f-amt')) st.amt = $('#f-amt').value;
      const d = FF.fromISO($('#f-day').value);
      if (d != null) st.day = Math.min(d, FF.today());
      let s = '';
      if (st.type === 'buy' || st.type === 'sell') {
        const q = num(st.q), p = num(st.p), fee = num(st.fee);
        if (q > 0 && p > 0) s = t('trade.sum.' + st.type, { q: FF.i18n.qty(q), name: esc(D().displayName(a, FF.i18n.lang)), total: '<b>' + FF.i18n.money(st.type === 'buy' ? q * p + fee : q * p - fee, a.c) + '</b>' });
      } else if (num(st.amt) > 0) s = t('trade.sum.' + st.type, { total: '<b>' + FF.i18n.money(num(st.amt), a ? a.c : st.cur) + '</b>', name: a ? esc(D().displayName(a, FF.i18n.lang)) : '' });
      $('#trade-sum').innerHTML = s;
      $('#trade-err').textContent = '';
    };
    body.querySelectorAll('input').forEach((i) => i.addEventListener('input', update));
    $('#f-day').addEventListener('change', () => { update(); });
    body.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      const step = a && a.t === 'crypto' ? 0.01 : a && a.c === 'USD' ? 1 : 100;
      const v = Math.max(0, FF.round2(num($('#f-q').value) + step * +b.dataset.q));
      $('#f-q').value = v ? String(v) : ''; ui().sfx.tap(); update();
    }));
    const all = body.querySelector('[data-all]');
    if (all) all.addEventListener('click', (e) => { e.preventDefault(); $('#f-q').value = String(ownedFor(st, st.day)); update(); });
    const dp = body.querySelector('[data-dayprice]');
    if (dp) dp.addEventListener('click', (e) => {
      e.preventDefault(); update();
      if (FF.market.keys().fh && !D().isLive(st.sym)) { $('#f-p').value = ''; $('#f-p').placeholder = t('trade.gettingPrice'); update(); return; } // filled in when it arrives
      $('#f-p').value = String(D().price(st.sym, st.day)); update();
    });
    body.querySelectorAll('[data-acct]').forEach((b) => b.addEventListener('click', () => { st.acct = b.dataset.acct; body.querySelectorAll('[data-acct]').forEach((x) => x.classList.toggle('on', x === b)); }));
    body.querySelectorAll('[data-cur]').forEach((b) => b.addEventListener('click', () => {
      st.cur = b.dataset.cur;
      body.querySelectorAll('[data-cur]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
      $('#f-cur').textContent = '(' + st.cur + ')';
      ui().sfx.tap(); update();
    }));
    $('#trade-go').addEventListener('click', () => submitTrade(api));
    mountDelete(body, api);
    if ($('#f-p')) $('#f-p').addEventListener('input', () => { st.pAuto = false; });
    if (dp) dp.addEventListener('click', () => { st.pAuto = true; });
    // when the real price arrives, show it — and use it, unless they typed their own
    if (a && !st.offMarket) {
      st.offMarket = FF.on('market', () => {
        if (!document.body.contains(body) || st.step !== 'details') { st.offMarket(); st.offMarket = null; return; }
        const hp = body.querySelector('#ah-price'), hs = body.querySelector('#ah-src');
        if (hp) hp.textContent = FF.i18n.price(D().price(a.s, FF.today()), a.c);
        if (hs) hs.innerHTML = FF.money.sourceTag(a.s).replace(/<span class="src-time">.*?<\/span>/, '');
        const fp = body.querySelector('#f-p');
        if (fp && st.pAuto && D().isLive(a.s) && document.activeElement !== fp) { fp.value = String(D().price(a.s, st.day)); fp.placeholder = ''; update(); }
      });
    }
    update();
    if ((st.type === 'buy' || st.type === 'sell') && !st.q && !FF.shot) setTimeout(() => $('#f-q') && $('#f-q').focus({ preventScroll: true }), 380);
  }
  function submitTrade(api) {
    const st = api.state;
    const err = (k) => { const e = api.body.querySelector('#trade-err'); e.textContent = t(k); ui().haptic(); e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); };
    const me = S().me(), pf = me.pf;
    const a = st.sym ? D().asset(st.sym) : null;
    let tx;
    if (st.type === 'buy' || st.type === 'sell') {
      const q = num(st.q), p = num(st.p), fee = num(st.fee);
      if (!(q > 0)) return err('trade.err.q');
      if (!(p > 0)) return err('trade.err.p');
      if (st.type === 'sell' && q > ownedFor(st, st.day) + 1e-9) return err('trade.err.tooMany');
      tx = { type: st.type, day: st.day, sym: st.sym, q, p, fee, cur: a.c, acct: st.acct };
    } else {
      const amt = num(st.amt);
      if (!(amt > 0)) return err('trade.err.amt');
      tx = { type: st.type, day: st.day, amt, cur: a ? a.c : st.cur, acct: st.acct };
      if (a) tx.sym = st.sym;
    }
    const snap = S().snapshot();
    if (st.editId) {
      if (tx.type === 'dividend' && !a) delete tx.sym;
      S().updateTxn(st.editId, tx);
      api.close(true); ui().sfx.pop();
      ui().toast(t('rec.saved'), { icon: 'check', tone: 'success', action: t('common.undo'), actionIcon: 'undo', onAction: () => S().restore(snap) });
      return;
    }
    const res = S().addTxn(tx);
    api.close(true);
    ui().sfx.pop();
    ui().haptic();
    const i = txInfo(res.tx, pf.base);
    ui().toast(t('trade.done', { what: i.title }), { icon: 'check', tone: 'success', action: t('common.undo'), actionIcon: 'undo', onAction: () => { S().restore(snap); ui().toast(t('common.undone'), { icon: 'undo' }); } });
    FF.app.celebrate(res);
    FF.app.flash('[data-sym="' + st.sym + '"]');
  }

  /* ===================================================== TRANSACTION SHEET */
  const EDITABLE = { expense: 1, income: 1, transfer: 1, buy: 1, sell: 1, dividend: 1, deposit: 1, withdraw: 1 };
  /* tap a record: anything you typed opens straight in the editor (fix a typo in one tap);
     opening balances, adjustments and automatic dividends show their details first */
  function openTx(id, opts) {
    opts = opts || {};
    const who = opts.who || null, pf = pfFor(who);
    const tx = pf.txns.find((x) => x.id === id);
    if (!tx) return;
    if (!who && !S().device().editHint) S().setDevice({ editHint: 1 }); // they've found it: Home stops showing the hint
    // someone else's records: everyday ones open for a fix, balance updates can go, the rest is theirs
    const canEdit = who ? !!Lg().HELP_TYPES[tx.type] : !!EDITABLE[tx.type];
    const canDel = who ? !!Lg().HELP_DEL[tx.type] && !tx.start : true;
    if (canEdit && !tx.auto && !opts.details) { openTrade({ edit: tx, who }); return; }
    const i = txInfo(tx, pf.base, null, pf);
    const acc = pf.accounts.find((a) => a.id === tx.acct);
    ui().openSheet({
      className: 'tx-sheet', label: i.title,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('tx.title') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div class="tx-hero">' + (i.emo ? '<span class="tx-ic big emo" style="--c:' + i.color + '" aria-hidden="true">' + i.emo + '</span>' : '<span class="tx-ic big ' + (i.tone || '') + '">' + ic(i.icon, 28) + '</span>') + '<h3>' + i.title + '</h3><div class="tx-amt num">' + FF.i18n.money(i.amt, i.cur, { sign: !i.neutral }) + '</div></div>' +
        (tx.type === 'opening' ? '<p class="lead">' + t('tx.openingExplain') + '</p>' : '') +
        '<dl class="kv">' + '<div><dt>' + t('trade.date') + '</dt><dd>' + FF.i18n.date(tx.day) + '</dd></div>' +
        (tx.cat ? '<div><dt>' + t('rec.category') + '</dt><dd>' + Lg().catOf(tx.cat).icon + ' ' + t('cat.' + tx.cat) + '</dd></div>' : '') +
        (tx.note && (tx.type === 'expense' || tx.type === 'income' || tx.type === 'transfer' || tx.type === 'adjust') ? '<div><dt>' + t('rec.note') + '</dt><dd>' + esc(tx.note) + '</dd></div>' : '') +
        (tx.type === 'transfer' ? '<div><dt>' + t('rec.from') + '</dt><dd>' + esc(accLabel(tx.acct, pf)) + '</dd></div><div><dt>' + t('rec.to') + '</dt><dd>' + esc(accLabel(tx.to, pf)) + (tx.toAmt != null ? ' · ' + FF.i18n.money(tx.toAmt, tx.toCur) : '') + '</dd></div>' : '') +
        (tx.type === 'dividend' && tx.gross ? '<div><dt>' + t('div.gross') + '</dt><dd class="num">' + FF.i18n.money(tx.gross, tx.cur) + '</dd></div><div><dt>' + t('div.taxTaken', { pct: FF.i18n.pct(tx.tax || 0, { dp: 0 }) }) + '</dt><dd class="num">−' + FF.i18n.money(FF.round2(tx.gross - tx.amt), tx.cur) + '</dd></div>' : '') +
        (tx.q ? '<div><dt>' + t('tx.qty') + '</dt><dd class="num">' + FF.i18n.qty(tx.q) + '</dd></div><div><dt>' + t('tx.price') + '</dt><dd class="num">' + FF.i18n.price(tx.p, tx.cur) + '</dd></div>' : '') +
        (tx.fee ? '<div><dt>' + t('trade.fee') + '</dt><dd class="num">' + FF.i18n.money(tx.fee, tx.cur) + '</dd></div>' : '') +
        (acc && tx.type !== 'transfer' ? '<div><dt>' + t('trade.account') + '</dt><dd>' + esc(accName(acc)) + '</dd></div>' : '') +
        (tx.type === 'opening' ? '<div><dt>' + t('tx.parts') + '</dt><dd>' + t('tx.partsN', { n: (tx.parts || []).length }) + '</dd></div>' : '') +
        (tx.by ? '<div><dt>' + t('help.recordedBy') + '</dt><dd>✍️ ' + esc(tx.by === S().state.meId ? t('common.you') : nameOf(tx.by)) + '</dd></div>' : '') +
        '</dl>' +
        (tx._pending ? '<p class="hint">⏳ <span>' + t('help.waitingLong', { name: esc(nameOf(who)) }) + '</span></p>' : '') +
        (tx.auto ? '<p class="hint">' + ic('info', 14) + '<span>' + t('div.autoNote') + '</span></p>' : '') +
        (canEdit ? '<button type="button" class="btn btn-soft btn-block" id="tx-edit">' + ic('edit', 18) + t('common.edit') + '</button>' : '') +
        (canDel ? '<button type="button" class="btn btn-danger-soft btn-block" id="tx-del">' + ic('trash', 18) + t('tx.delete') + '</button>' : '') +
        (who && !canDel ? '<p class="hint center">' + ic('lock', 14) + '<span>' + t('help.theirsOnly', { name: esc(nameOf(who)) }) + '</span></p>' : ''),
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        const del = body.querySelector('#tx-del');
        if (del) del.addEventListener('click', () => {
          if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.innerHTML = ic('trash', 18) + t('tx.deleteSure'); ui().haptic(); return; }
          if (who) { api.close(true); helpChange(who, { k: 'del', id: tx.id }, 'help.deleted', 'trash'); return; }
          const snap = S().snapshot();
          S().deleteTxn(tx.id); api.close(true);
          ui().toast(t('tx.deleted'), { icon: 'trash', action: t('common.undo'), actionIcon: 'undo', onAction: () => S().restore(snap) });
        });
        const ed = body.querySelector('#tx-edit');
        if (ed) ed.addEventListener('click', () => { api.close(true); openTrade({ edit: tx, who }); });
      }
    });
  }

  /* ===================================================== HOLDING PAGE */
  function holdingPage(params) {
    FF.market.focus(params.sym);
    const ctx = params.ctx || { id: S().state.meId };
    const m = S().member(ctx.id), pf = m.pf, base = pf.base;
    const a = D().asset(params.sym);
    const s = C().summary(pf, base);
    const hh = s.holdings.find((x) => x.sym === params.sym);
    const today = FF.today();
    let h = '<div class="hold-hero">' + ui().assetLogo(a, 64) + '<div><h1 class="scr-title">' + esc(D().displayName(a, FF.i18n.lang)) + '</h1><p class="scr-sub">' + esc(a.s) + (a.code ? ' (' + esc(a.code) + ')' : '') + ' · ' + esc(a.x) + '</p><span class="type-chip t-' + a.t + '">' + t('type.' + a.t) + '</span>' + ui().learnBtn(a.t) + '</div></div>';
    if (hh) {
      h += '<section class="answer-card ' + (hh.gain >= 0 ? 'up' : 'down') + '"><div class="ans-kicker">' + t(ctx.ro ? 'hold.ownThey' : 'hold.own', { n: FF.i18n.qty(hh.qty), name: esc(m.name), unit: t('units.' + (a.t === 'crypto' ? 'coinsWord' : 'sharesWord'), { n: hh.qty }) }) + '</div><div class="ans-num num"><span>' + M(hh.value, { cur: base }) + '</span></div><div class="ans-sub">' + ui().delta(hh.gain, { cur: base }) + ' · ' + FF.i18n.pct(hh.gainPct, { sign: true }) + ' ' + t('hold.sinceBought') + '</div></section>';
      h += '<section class="card"><dl class="kv">' +
        '<div><dt>' + t('hold.avg') + ui().learnBtn('avgCost') + '</dt><dd class="num">' + FF.i18n.price(hh.avg, a.c) + '</dd></div>' +
        '<div><dt>' + t('hold.now') + '</dt><dd class="num">' + FF.i18n.price(hh.px, a.c) + ' ' + ui().delta(hh.dayPct, { pct: true, size: 12 }) + '</dd></div>' +
        '<div><dt>' + t('hold.weight') + '</dt><dd class="num">' + FF.i18n.pct(hh.weight) + '</dd></div>' +
        (a.dv ? '<div><dt>' + t('hold.yield') + ui().learnBtn('yield') + '</dt><dd class="num">' + FF.i18n.pct(a.dv.y) + '</dd></div>' : '') +
        '<div><dt>' + t('hold.divGot') + '</dt><dd class="num">' + M(hh.divs, { cur: base }) + '</dd></div></dl></section>';
    } else h += '<p class="muted center pad">' + t('hold.none') + '</p>';
    h += '<section class="card"><div class="card-head"><h2>' + t('hold.priceYear') + '</h2><span class="muted num">' + FF.i18n.price(D().price(a.s, today), a.c) + '</span></div><div class="src-line">' + FF.money.sourceTag(a.s) + '</div><div class="chart-host" id="hold-chart"></div></section>';
    if (!ctx.ro) {
      const txs = pf.txns.filter((x) => x.sym === a.s).sort((x, y) => y.day - x.day);
      if (txs.length) h += '<h3 class="group-h">' + t('hold.activity') + '</h3><section class="card list-card">' + txs.map((x) => txRow(x, base)).join('') + '</section>';
      h += '<div class="btn-row sticky-actions"><button type="button" class="btn btn-primary" data-act="add-trade" data-type="buy" data-sym="' + a.s + '">' + ic('bag', 18) + t('hold.buyMore') + '</button>' + (hh ? '<button type="button" class="btn btn-soft" data-act="add-trade" data-type="sell" data-sym="' + a.s + '">' + ic('tag', 18) + t('hold.sellSome') + '</button>' : '') + '</div>';
    }
    return h;
  }
  function afterHolding(el, params) {
    const a = D().asset(params.sym);
    const today = FF.today();
    const pts = [];
    for (let d = today - 365; d <= today; d += 3) pts.push({ day: d, value: D().price(a.s, d), contrib: 0 });
    if (pts[pts.length - 1].day !== today) pts.push({ day: today, value: D().price(a.s, today), contrib: 0 });
    FF.charts.line(el.querySelector('#hold-chart'), pts, { cur: a.c, noContrib: true, height: 150, label: t('hold.priceYear') });
  }

  /* ===================================================== ACCOUNTS / CURRENCY / CSV */
  /* ===================================================== ONE ACCOUNT */
  function accountPage(p) {
    const pf = S().me().pf, base = pf.base;
    const acc = accById(p.id);
    if (!acc) return '<p class="muted center pad">' + t('acct.gone') + '</p>';
    const k = Lg().kindOf(acc), v = Lg().accountValue(pf, acc), invest = Lg().isInvest(pf, acc);
    let h = '<section class="acct-hero" style="--c:' + k.color + '"><span class="ah-ic" aria-hidden="true">' + k.icon + '</span><div class="row-main"><span class="row-s">' + t('acct.kind.' + (acc.kind || 'other')) + ' · ' + acc.cur + '</span><b class="ah-v num' + (v < -0.004 ? ' neg' : '') + '">' + M(v, { cur: acc.cur }) + '</b>' + (acc.cur !== base ? '<span class="row-s num">≈ ' + M(v * D().fx(acc.cur, base), { cur: base }) + '</span>' : '') + '</div>' +
      '<button type="button" class="icon-btn" data-act="acct-edit" data-id="' + acc.id + '" aria-label="' + esc(t('acct.edit')) + '">' + ic('edit', 20) + '</button></section>';
    h += '<div class="quick-row">' + [['expense', '🧾'], ['income', '💰'], ['transfer', '🔁']].map((q) => '<button type="button" class="quick q-' + q[0] + '" data-act="add-trade" data-type="' + q[0] + '" data-acct="' + acc.id + '"><span class="q-ic" aria-hidden="true">' + q[1] + '</span><span class="q-t" data-fit="12">' + t('quick.' + q[0]) + '</span></button>').join('') + '</div>';
    h += '<button type="button" class="btn btn-soft btn-block" data-act="acct-adjust" data-id="' + acc.id + '">⚖️ ' + t('acct.adjust') + '</button>';
    h += '<section class="card"><div class="card-head"><h2>' + t('acct.trend') + '</h2></div><div class="chart-host" id="acct-chart"></div></section>';
    if (invest) {
      const s = C().summary(Lg().accountView(pf, acc.id), base);
      if (s.count) h += '<section class="card list-card"><div class="card-head"><h2>' + t('acct.holds') + '</h2></div>' + s.holdings.map((x) => FF.money.holdingRow(x, base)).join('') + '</section>';
    }
    const recs = Lg().recent(pf, 200, (x) => x.acct === acc.id || x.to === acc.id || (x.parts || []).some((q) => q.acct === acc.id));
    h += '<h3 class="group-h">' + t('acct.records') + '</h3>' + (recs.length ? dayGroups(recs, base, acc.id) : '<p class="muted center pad">' + t('man.noTx') + '</p>');
    return h;
  }
  function afterAccount(el, p) {
    const pf = S().me().pf, acc = accById(p.id);
    const host = el.querySelector('#acct-chart');
    if (!acc || !host) return;
    const T = FF.today(), v = Lg().accountView(pf, acc.id);
    const from = Math.max(T - 90, Math.min(T - 7, C().firstDay(v) - 1));
    FF.charts.line(host, C().history(v, acc.cur, from, T, 90), { cur: acc.cur, noContrib: true, height: 130, label: t('acct.trend') });
  }
  /* "what's the balance really?" — one adjustment makes the app match the bank */
  function openAdjust(id, who) {
    const pf = pfFor(who), acc = accById(id, pf);
    if (!acc) return;
    const cur = Lg().accountCash(pf, acc);
    const holds = C().summary(Lg().accountView(pf, acc.id), acc.cur).count > 0;
    ui().openSheet({
      label: t('acct.adjust'),
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('acct.adjust') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        (who ? helpBanner(who) : '') +
        '<p class="lead">' + t('acct.adjustB', { name: '<b>' + esc(accName(acc)) + '</b>' }) + '</p>' +
        '<label class="amt-wrap"><span class="amt-cur">' + acc.cur + '</span><input id="adj-v" inputmode="decimal" autocomplete="off" value="' + FF.round2(cur) + '" aria-label="' + esc(t('acct.adjust')) + '"></label>' +
        (holds ? '<p class="hint">' + ic('info', 14) + '<span>' + t('acct.adjustStocks') + '</span></p>' : '') +
        '<p class="summary" id="adj-sum"></p><button type="button" class="btn btn-primary btn-block btn-lg" id="adj-go">' + t('common.save') + '</button>',
      onRender: (b, api) => {
        const inp = b.querySelector('#adj-v');
        const upd = () => { const d = FF.round2(num(inp.value) - cur); b.querySelector('#adj-sum').innerHTML = FF.isZero(d) ? '' : t('acct.adjustSum', { amount: '<b>' + FF.i18n.money(d, acc.cur, { sign: true }) + '</b>' }); };
        inp.addEventListener('input', upd);
        b.querySelector('[data-close]').addEventListener('click', () => api.close());
        b.querySelector('#adj-go').addEventListener('click', () => {
          if (who) { api.close(true); helpChange(who, { k: 'bal', id: FF.uid('t'), acct: id, v: FF.round2(num(inp.value)) }, 'help.balanced', '⚖️'); return; }
          const snap = S().snapshot();
          const tx = S().adjustBalance(id, num(inp.value), t('tx.adjust'));
          api.close(true);
          if (tx) ui().toast(t('acct.adjusted'), { icon: '⚖️', tone: 'success', action: t('common.undo'), actionIcon: 'undo', onAction: () => S().restore(snap) });
        });
        setTimeout(() => { inp.focus(); inp.select(); }, 350);
      }
    });
  }
  /* tap an account: rename it, change its type / currency, or delete it */
  function openAccount(id) {
    const pf = S().me().pf;
    const acc = pf.accounts.find((a) => a.id === id);
    if (!acc) return;
    const st = { name: accName(acc), kind: acc.kind || 'broker', cur: acc.cur };
    const only = pf.accounts.length < 2;
    ui().openSheet({
      label: t('acct.edit'), state: st,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('acct.edit') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div class="form"><label class="field"><span class="f-l">' + t('acct.name') + '</span><input id="acc-name" maxlength="28" value="' + esc(st.name) + '" placeholder="' + esc(t('acct.namePh')) + '"></label>' +
        kindChips(st.kind) +
        '<div class="field"><span class="f-l">' + t('acct.cur') + '</span><div class="chips">' + FF.data.DISPLAY_CURRENCIES.map((c) => '<button type="button" class="chip-btn' + (c === st.cur ? ' on' : '') + '" data-cur="' + c + '">' + c + '</button>').join('') + '</div></div></div>' +
        '<p class="form-err" id="acc-err" role="alert"></p><button type="button" class="btn btn-primary btn-block btn-lg" id="acc-go">' + t('common.save') + '</button>' +
        (only ? '<p class="hint center">' + ic('info', 14) + '<span>' + t('acct.onlyOne') + '</span></p>' : '<button type="button" class="btn btn-danger-soft btn-block" id="acc-del">' + ic('trash', 18) + t('acct.delete') + '</button>'),
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        body.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { st.kind = b.dataset.kind; body.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('on', x === b)); }));
        body.querySelectorAll('[data-cur]').forEach((b) => b.addEventListener('click', () => { st.cur = b.dataset.cur; body.querySelectorAll('[data-cur]').forEach((x) => x.classList.toggle('on', x === b)); }));
        body.querySelector('#acc-go').addEventListener('click', () => {
          const name = body.querySelector('#acc-name').value.trim();
          if (!name) { body.querySelector('#acc-err').textContent = t('acct.err'); ui().haptic(); return; }
          const patch = { kind: st.kind, cur: st.cur };
          if (name !== accName(acc)) patch.name = name;
          S().updateAccount(id, patch);
          api.close(true); ui().toast(t('acct.saved'), { icon: 'check', tone: 'success' });
        });
        const del = body.querySelector('#acc-del');
        if (del) del.addEventListener('click', () => { api.close(true); confirmDeleteAccount(id); });
      }
    });
  }
  function confirmDeleteAccount(id) {
    const pf = S().me().pf;
    const acc = pf.accounts.find((a) => a.id === id);
    const others = pf.accounts.filter((a) => a.id !== id);
    if (!acc || !others.length) return;
    const n = S().accountRecords(pf, id);
    const st = { to: others[0].id };
    ui().openSheet({
      label: t('acct.deleteT', { name: accName(acc) }), state: st,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('acct.deleteT', { name: esc(accName(acc)) }) + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<p class="lead">' + (n ? t('acct.deleteMove', { n, count: n }) : t('acct.deleteEmpty')) + '</p>' +
        (n ? '<div class="field"><span class="f-l">' + t('acct.moveTo') + '</span><div class="chips">' + others.map((o) => '<button type="button" class="chip-btn' + (o.id === st.to ? ' on' : '') + '" data-to="' + o.id + '">' + esc(accName(o)) + ' · ' + o.cur + '</button>').join('') + '</div></div>' : '') +
        '<button type="button" class="btn btn-danger btn-block btn-lg" id="acc-del-go">' + ic('trash', 18) + t('acct.deleteCta') + '</button><button type="button" class="btn btn-ghost btn-block" data-close>' + t('common.cancel') + '</button>',
      onRender: (body, api) => {
        body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
        body.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', () => { st.to = b.dataset.to; body.querySelectorAll('[data-to]').forEach((x) => x.classList.toggle('on', x === b)); ui().sfx.tap(); }));
        body.querySelector('#acc-del-go').addEventListener('click', () => {
          const name = accName(acc);
          const snap = S().snapshot();
          if (!S().removeAccount(id, st.to)) return;
          const pg = FF.app.state.pages[FF.app.state.pages.length - 1];
          if (pg && pg.id === 'account' && pg.p.id === id) FF.app.pop();
          api.close(true); ui().haptic();
          ui().toast(t('acct.deleted', { name: '<b>' + esc(name) + '</b>' }), { icon: 'trash', action: t('common.undo'), actionIcon: 'undo', duration: 6000, onAction: () => { S().restore(snap); ui().toast(t('common.undone'), { icon: 'undo' }); } });
        });
      }
    });
  }
  const kindChips = (sel) => '<div class="field"><span class="f-l">' + t('acct.kind') + '</span><div class="chips kind-chips">' + Lg().KIND_ORDER.map((k) => '<button type="button" class="chip-btn' + (k === sel ? ' on' : '') + '" data-kind="' + k + '"><span aria-hidden="true">' + Lg().KINDS[k].icon + '</span>' + t('acct.kind.' + k) + '</button>').join('') + '</div></div>';
  function openAddAccount() {
    const st = { name: '', kind: 'bank', cur: S().me().pf.base };
    ui().openSheet({
      label: t('acct.add'), state: st,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('acct.add') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div class="form"><label class="field"><span class="f-l">' + t('acct.name') + '</span><input id="acc-name" maxlength="28" placeholder="' + esc(t('acct.namePh')) + '" autofocus></label>' +
        kindChips(st.kind) +
        '<label class="field"><span class="f-l">' + t('acct.start') + '</span><input id="acc-start" inputmode="decimal" autocomplete="off" placeholder="0.00"><span class="f-hint">' + t('acct.startHint') + '</span></label>' +
        '<div class="field"><span class="f-l">' + t('acct.cur') + '</span><div class="chips">' + FF.data.DISPLAY_CURRENCIES.map((c) => '<button type="button" class="chip-btn' + (c === st.cur ? ' on' : '') + '" data-cur="' + c + '">' + c + '</button>').join('') + '</div></div></div>' +
        '<p class="form-err" id="acc-err" role="alert"></p><button type="button" class="btn btn-primary btn-block btn-lg" id="acc-go">' + t('acct.save') + '</button>',
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        body.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { st.kind = b.dataset.kind; body.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('on', x === b)); }));
        body.querySelectorAll('[data-cur]').forEach((b) => b.addEventListener('click', () => { st.cur = b.dataset.cur; body.querySelectorAll('[data-cur]').forEach((x) => x.classList.toggle('on', x === b)); }));
        body.querySelector('#acc-go').addEventListener('click', () => {
          const name = body.querySelector('#acc-name').value.trim();
          if (!name) { body.querySelector('#acc-err').textContent = t('acct.err'); return; }
          const acc = S().addAccount({ name, kind: st.kind, cur: st.cur }, num(body.querySelector('#acc-start').value));
          api.close(true); ui().toast(t('acct.added', { name: esc(name) }), { icon: Lg().KINDS[st.kind].icon, tone: 'success', action: t('common.view'), onAction: () => FF.app.push('account', { id: acc.id }) });
        });
      }
    });
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return { rows: [], bad: 0 };
    const head = lines[0].toLowerCase().split(',').map((s) => s.trim());
    const idx = (k) => head.indexOf(k);
    const hasHead = idx('date') !== -1;
    const cols = hasHead ? { date: idx('date'), type: idx('type'), symbol: idx('symbol'), quantity: idx('quantity'), price: idx('price'), fee: idx('fee'), amount: idx('amount') } : { date: 0, type: 1, symbol: 2, quantity: 3, price: 4, fee: 5, amount: 6 };
    const rows = [];
    let bad = 0;
    const pf = S().me().pf;
    lines.slice(hasHead ? 1 : 0).forEach((l) => {
      const c = l.split(',').map((s) => s.trim());
      const day = FF.fromISO(c[cols.date]);
      const type = String(c[cols.type] || '').toLowerCase();
      const sym = String(c[cols.symbol] || '').toUpperCase();
      const a = D().asset(sym) || D().search(sym)[0];
      if (day == null || day > FF.today()) { bad++; return; }
      if ((type === 'buy' || type === 'sell') && a) {
        const q = num(c[cols.quantity]), p = num(c[cols.price]) || D().price(a.s, day);
        if (!(q > 0)) { bad++; return; }
        const acc = pf.accounts.find((x) => x.cur === a.c) || pf.accounts[0];
        rows.push({ type, day, sym: a.s, q, p, fee: num(cols.fee >= 0 ? c[cols.fee] : 0), cur: a.c, acct: acc.id });
      } else if (type === 'dividend' && a) {
        const amt = num(cols.amount >= 0 ? c[cols.amount] : c[cols.price]);
        if (!(amt > 0)) { bad++; return; }
        rows.push({ type, day, sym: a.s, amt, cur: a.c, acct: pf.accounts[0].id });
      } else bad++;
    });
    return { rows, bad };
  }
  function openCSV() {
    const st = { parsed: null };
    ui().openSheet({
      className: 'sheet-tall', label: t('csv.title'), state: st,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('csv.title') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<p class="lead">' + t('csv.lead') + '</p><pre class="code">date,type,symbol,quantity,price,fee\n2025-03-14,buy,AAPL,10,212.50,0\n2025-06-02,buy,VOO,2,520.10,0\n2025-08-14,dividend,AAPL,,,\n</pre>' +
        '<p class="hint">' + t('csv.types') + '</p>' +
        (st.parsed ? '<div class="csv-result">' + ic('check', 20) + '<span>' + t('csv.found', { n: st.parsed.rows.length }) + (st.parsed.bad ? ' · ' + t('csv.skipped', { n: st.parsed.bad }) : '') + '</span></div>' +
          '<button type="button" class="btn btn-primary btn-block btn-lg" id="csv-go"' + (st.parsed.rows.length ? '' : ' disabled') + '>' + t('csv.import', { n: st.parsed.rows.length }) + '</button>' :
          '<label class="btn btn-primary btn-block btn-lg file-btn">' + ic('file', 20) + t('csv.choose') + '<input type="file" accept=".csv,text/csv" id="csv-file"></label>'),
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        const f = body.querySelector('#csv-file');
        if (f) f.addEventListener('change', () => {
          const file = f.files && f.files[0];
          if (!file) return;
          const rd = new FileReader();
          rd.onload = () => { st.parsed = parseCSV(String(rd.result)); api.render(); };
          rd.readAsText(file);
        });
        const go = body.querySelector('#csv-go');
        if (go) go.addEventListener('click', () => {
          const snap = S().snapshot();
          S().importTxns(st.parsed.rows);
          api.close(true);
          ui().toast(t('csv.done', { n: st.parsed.rows.length }), { icon: 'check', tone: 'success', action: t('common.undo'), onAction: () => S().restore(snap) });
        });
      }
    });
  }

  /* ---------- actions ---------- */
  Object.assign(A, {
    'add-trade': (el) => openTrade({ type: el.dataset.type || null, sym: el.dataset.sym || null, acct: el.dataset.acct || null, fromDetail: !!el.dataset.sym }),
    tx: (el) => openTx(el.dataset.id),
    holding: (el) => FF.app.push('holding', { sym: el.dataset.sym, ctx: el.dataset.ro ? FF.app.visitCtx() : null }),
    'add-account': () => openAddAccount(),
    account: (el) => FF.app.push('account', { id: el.dataset.id }),
    'acct-edit': (el) => openAccount(el.dataset.id),
    'acct-adjust': (el) => openAdjust(el.dataset.id),
    // family helpers: the same sheets, for a family member's records
    'help-add': (el) => openTrade({ type: el.dataset.type || null, acct: el.dataset.acct || null, who: el.dataset.who }),
    'help-tx': (el) => openTx(el.dataset.id, { who: el.dataset.who }),
    'help-adjust': (el) => openAdjust(el.dataset.id, el.dataset.who),
    'manage-seg': (el) => { manState.tab = el.dataset.seg; if (el.dataset.seg === 'records') { recState.filter = 'all'; recState.cat = null; } FF.app.go('manage'); },
    'cat-records': (el) => { manState.tab = 'records'; recState.cat = el.dataset.cat; FF.app.go('manage'); },
    'set-base': (el) => { S().setBase(el.dataset.cur); ui().sfx.tap(); ui().toast(t('cur.changed', { cur: t('cur.' + el.dataset.cur) }), { icon: 'check' }); },
    csv: () => openCSV()
  });

  FF.manage = { manage, afterManage, openTrade, openTx, holdingPage, afterHolding, txInfo, recordRow, dayGroups, parseCSV, accountPage, afterAccount, openAdjust, openAddAccount, accName, manState, recState, REC_FILTERS, helpChange, helpBanner };
})(window);
