/* ============================================================
   FamFi — screens-sage.js
   The Mystery Man (the old fellow napping in the village grass,
   hat over his eyes, chewing a stalk of wheat). Tap him and he
   tells you something true — a country and its flag, a planet, an
   animal, your own body, how money grows — then asks you about it.

   1. The story: a picture (a flag or an emoji), a title, a few lines.
   2. The quiz: one question, four answers (shuffled every time).
   3. The answer: right or not, and why it's so.
   A right answer wins 2 gems — the first 10 right answers a day
   (play.js has the rules). After that he keeps teaching, for fun.

   The facts (js/facts-<lang>.js, ~100 per language) load only the
   first time he talks, in your language. He picks one you haven't
   answered yet (your answers sync, so not on any of your phones),
   and never two of the same kind in a row.

   Light on the phone: still pictures and text; nothing animates
   while you read (a little pop when you answer, that's all).
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, Pl = () => FF.play;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const ui = () => FF.ui;
  const num = (n) => FF.i18n.num(n, 0);
  const CAT_EMO = { earth: '🌍', world: '🏳️', my: '🇲🇾', science: '🔬', space: '🚀', animals: '🐾', body: '🫀', money: '💰', history: '📜' };
  const HELLOS = 5;
  const LETTERS = ['A', 'B', 'C', 'D'];

  let api = null;
  const sess = { streak: 0, lastCat: null }; // this visit's run of right answers (not saved)

  /* ---------- the facts, loaded once per language ---------- */
  const loading = {};
  function loadFacts(l) {
    if (FF.FACTS && FF.FACTS[l]) return Promise.resolve(FF.FACTS[l]);
    if (loading[l]) return loading[l];
    return (loading[l] = new Promise((res, rej) => {
      const en = document.querySelector('script[src*="strings-en.js"]');
      const q = en && en.getAttribute('src').indexOf('?') !== -1 ? en.getAttribute('src').slice(en.getAttribute('src').indexOf('?')) : '';
      const s = document.createElement('script');
      s.src = 'js/facts-' + l + '.js' + q;
      s.onload = () => { delete loading[l]; if (FF.FACTS && FF.FACTS[l]) res(FF.FACTS[l]); else rej(new Error('empty')); };
      s.onerror = () => { delete loading[l]; s.remove(); rej(new Error('offline')); };
      document.head.appendChild(s);
    }));
  }
  /* the next fact: one you haven't answered yet, not the same kind as the last one; when you've
     answered them all, one of those you answered longest ago */
  function pick(list) {
    const today = S().sageToday(), seen = today ? today.seen : [];
    let pool = list.filter((f) => seen.indexOf(f[0]) === -1);
    if (!pool.length) pool = list.slice().sort((a, b) => seen.indexOf(b[0]) - seen.indexOf(a[0])).slice(0, Math.max(1, Math.floor(list.length / 4)));
    const other = pool.filter((f) => f[1] !== sess.lastCat);
    const from = other.length ? other : pool;
    return from[Math.floor(Math.random() * from.length)];
  }
  function shuffle(n) {
    const a = []; for (let k = 0; k < n; k++) a.push(k);
    for (let k = n - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); const x = a[k]; a[k] = a[j]; a[j] = x; }
    return a;
  }
  const isFlag = (s) => /^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(s);

  /* ---------- the sheet ---------- */
  function open() {
    if ((api && !api.closing) || !S().me()) return; // (a sheet closed by closeAllSheets never hears onClose)
    const st = { phase: 'load', fact: null, order: null, pick: null, res: null, hello: 1 + Math.floor(Math.random() * HELLOS), lang: FF.i18n.lang };
    api = ui().openSheet({
      className: 'sage-sheet', label: t('sage.name'), state: st,
      render: () => render(st),
      onRender: (body, a) => wire(body, a, st),
      onClose: () => { api = null; }
    });
    ui().sfx.pop();
    next(st);
  }
  function next(st) {
    st.phase = st.fact ? st.phase : 'load';
    loadFacts(st.lang).then((list) => {
      if (!api || api.closing) return;
      st.fact = pick(list); st.order = shuffle(4); st.pick = null; st.res = null; st.phase = 'story';
      sess.lastCat = st.fact[1];
      api.render();
      api.body.scrollTop = 0;
    }, () => { if (!api || api.closing) return; st.phase = 'fail'; api.render(); });
  }

  function hero(st) {
    const p = S().playOf(), today = S().sageToday(), left = Math.max(0, Pl().SAGE.DAILY - today.n) * Pl().SAGE.GEMS;
    let say;
    if (st.phase === 'quiz') say = t('sage.quiz');
    else if (st.phase === 'answer') say = st.res && st.res.ok ? t('sage.right') + (sess.streak >= 2 ? ' ' + t('sage.streak', { n: sess.streak }) : '') : t('sage.wrong');
    else if (st.phase === 'fail') say = t('sage.failT');
    else if (st.phase === 'load') say = t('sage.loading');
    else say = t('sage.hello.' + st.hello);
    return '<div class="sg-hero"><span class="sg-face' + (st.phase === 'answer' && st.res && st.res.ok ? ' happy' : '') + '">' + FF.art.sageFace(68) + '</span>' +
      '<div class="sg-say' + (st.phase === 'answer' ? (st.res && st.res.ok ? ' good' : ' bad') : '') + '"><b>' + esc(say) + '</b></div>' +
      '<span class="dg-bal sg-bal" data-gem-bal title="' + esc(left ? t('sage.left', { n: left }) : t('sage.leftNone')) + '">' + FF.art.gem(18) + '<b class="num">' + num(p.pts) + '</b></span></div>';
  }
  function render(st) {
    const f = st.fact;
    let h = '<div class="sheet-head"><span class="sh-spacer"></span><h2>❓ ' + t('sage.name') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>';
    h += hero(st);
    if (st.phase === 'load') {
      h += '<div class="sg-card wait" aria-busy="true"><span class="nw-bar"></span><span class="nw-bar"></span><span class="nw-bar short"></span></div>';
      return h;
    }
    if (st.phase === 'fail') {
      h += '<div class="sg-card empty"><span class="sg-big" aria-hidden="true">💤</span><p>' + t('sage.failB') + '</p></div>';
      h += '<button type="button" class="btn btn-primary btn-block btn-lg" data-retry>' + ic('refresh', 18) + t('sage.retry') + '</button>';
      return h;
    }
    const cat = '<span class="sg-cat">' + CAT_EMO[f[1]] + ' ' + t('sage.cat.' + f[1]) + '</span>';
    if (st.phase === 'story') {
      h += '<article class="sg-card">' + cat + '<span class="sg-big' + (isFlag(f[2]) ? ' flag' : '') + '" aria-hidden="true">' + f[2] + '</span>' +
        '<h3 class="sg-title">' + esc(f[3]) + '</h3><p class="sg-text">' + esc(f[4]) + '</p></article>';
      h += '<button type="button" class="btn btn-sun btn-block btn-lg" data-quiz>' + t('sage.next') + ' ' + ic('chevR', 18) + '</button>';
      h += foot();
      return h;
    }
    // the quiz, and the answer
    const done = !!st.res;
    h += '<div class="sg-card quiz">' + cat + '<h3 class="sg-q">' + esc(f[5]) + '</h3><div class="sg-opts" role="group" aria-label="' + esc(f[5]) + '">';
    st.order.forEach((k, n) => {
      let cls = 'sg-opt';
      if (st.phase === 'answer') cls += k === 0 ? ' right' : k === st.pick ? ' wrong' : ' dim';
      h += '<button type="button" class="' + cls + '" data-opt="' + k + '"' + (st.phase === 'answer' ? ' disabled' : '') + '><span class="sg-l" aria-hidden="true">' + (st.phase === 'answer' && k === 0 ? '✓' : st.phase === 'answer' && k === st.pick ? '✕' : LETTERS[n]) + '</span><span class="sg-o">' + esc(f[6][k]) + '</span></button>';
    });
    h += '</div></div>';
    if (st.phase === 'answer' && done) {
      const r = st.res;
      h += '<div class="sg-why' + (r.ok ? ' good' : '') + '">' + (r.ok ? '' : '<b>' + esc(t('sage.answer', { a: f[6][0] })) + '</b>') + '<span>💡 ' + esc(f[7]) + '</span></div>';
      if (r.gems) h += '<p class="sg-won">' + FF.art.gem(18) + '<b>' + t('sage.won', { n: r.gems }) + '</b></p>';
      if (r.gems && r.left === 0) h += '<p class="hint sg-cap">🎉 <span>' + t('sage.capHit', { n: Pl().SAGE.DAILY * Pl().SAGE.GEMS }) + '</span></p>';
      h += '<button type="button" class="btn btn-sun btn-block btn-lg" data-again>' + t('sage.again') + '</button><button type="button" class="btn btn-soft btn-block" data-close>' + t('sage.done') + '</button>';
    }
    if (st.phase === 'quiz') h += foot();
    return h;
  }
  function foot() {
    const today = S().sageToday(), left = Math.max(0, Pl().SAGE.DAILY - today.n) * Pl().SAGE.GEMS;
    // the first time: how it works; after that, what's left today and how much you've learned
    if (!today.asked) return '<p class="hint sg-foot"><span>' + FF.art.gem(14) + ' ' + t('sage.rule') + '</span></p>';
    return '<p class="hint sg-foot"><span>' + FF.art.gem(14) + ' ' + (left ? t('sage.left', { n: left }) : t('sage.leftNone')) + ' · ' + t('sage.learned', { n: today.right }) + '</span></p>';
  }

  function wire(body, a, st) {
    body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => a.close()));
    const retry = body.querySelector('[data-retry]');
    if (retry) retry.addEventListener('click', () => { st.phase = 'load'; a.render(); next(st); });
    const quiz = body.querySelector('[data-quiz]');
    if (quiz) quiz.addEventListener('click', () => { ui().sfx.tap(); st.phase = 'quiz'; a.render(); a.body.scrollTop = 0; });
    const again = body.querySelector('[data-again]');
    if (again) again.addEventListener('click', () => { ui().sfx.pop(); st.hello = 1 + Math.floor(Math.random() * HELLOS); next(st); });
    body.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => answer(a, st, +b.dataset.opt, b)));
  }
  function answer(a, st, k, btn) {
    if (st.phase !== 'quiz') return;
    const right = k === 0, before = S().playOf().pts;
    const r = S().sageAnswer(st.fact[0], right);
    if (!r) return;
    st.pick = k; st.phase = 'answer'; st.res = Object.assign({}, r, { ok: right }); // ok: this answer was right (r.right counts all your right answers)
    sess.streak = right ? sess.streak + 1 : 0;
    const from = btn.getBoundingClientRect();
    a.render();
    if (right) {
      ui().haptic(); ui().sfx.chime();
      if (r.gems) {
        const bal = a.body.querySelector('[data-gem-bal]'), el = bal && bal.querySelector('b');
        const fmt = (x) => num(Math.round(x)), key = 'gems-sage-' + before;
        if (el) { ui().countUp(el, before, fmt, key); ui().countUp(el, before + r.gems, fmt, key); }
        const ghost = { getBoundingClientRect: () => from }; // the answer you tapped (now redrawn)
        ui().coinBurst(ghost, bal, 4, () => ui().sfx.coin());
        if (r.left === 0) setTimeout(() => ui().confetti({ n: 90 }), 300);
      }
    } else ui().sfx.bbBack();
    const why = a.body.querySelector('.sg-why');
    if (why && why.scrollIntoView) why.scrollIntoView({ block: 'nearest', behavior: ui().reduced() ? 'auto' : 'smooth' });
  }

  FF.sageUI = { open, loadFacts };
})(window);
