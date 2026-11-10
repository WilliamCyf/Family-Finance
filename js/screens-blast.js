/* ============================================================
   FamFi — screens-blast.js
   Block Blast, played from the arcade in the village.

   One <canvas> draws the board, the three pieces, the piece in
   your finger, the clears and the sparkles. It only draws when
   something changes (your finger moves, an animation runs) and
   sleeps otherwise — no work at all while you think, or while you
   hold a piece still. Everything is pre-drawn and then only copied:
   blocks once per colour and size, the board with its blocks once
   per move, the lifted piece (with its soft shadow) once per pick-up,
   each "Great!" once. A frame is a handful of image copies.

   Dragging works like the original: the piece jumps up above your
   finger and then moves faster than it (1.6× by default — Menu →
   Block speed), so a short, relaxed swipe reaches every corner of
   the board while your finger stays near the bottom.
   The score, best, buttons and the end-of-game card are plain
   HTML on top (sharp text, easy taps).

   Rules: blast.js · gems + family ranking: store.blastFinish().
   A game in progress is saved on this phone after every move:
   quit any time, it continues next time.

   Watching live: while family members play, the arcade offers to
   watch them. The same screen then replays each of their moves
   as it arrives (the piece glides from their tray, lines break,
   words pop) — nothing to touch, nothing drawn between moves.
   Moves are only sent while someone watches (cloud.js "live").
   Lines breaking buzz the phone (Menu → Vibration).

   Chatting (v2.25): the player and everyone watching them share a
   little chat. Watchers get a bar at the bottom — four emoji and
   "Say something…"; the player taps the audience pill (👁 2 💬).
   Emoji float up the right edge, messages show in the pill (the
   player) or in a short feed (watchers) — never a thing to tap
   over the board, nothing drawn on the canvas, so the game plays
   exactly the same. Floating emoji are a few HTML boxes moved by
   the GPU (at most 12 at once), and the chat costs nothing at all
   while nobody's watching.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const B = FF.blastCore, S = () => FF.store;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const ui = () => FF.ui;
  const num = (n) => FF.i18n.num(n, 0);
  const N = B.N;
  const NS = root.FAMFI_NS || '';

  /* the palette: vivid gems on a deep-blue board */
  const COL = [null, '#FF4D5E', '#FF9F1C', '#FFD23F', '#3DDC84', '#2EC4F1', '#4D7CFE', '#A66CFF'];
  const PRAISE_COL = { good: ['#9BFF6A', '#2DBE4E'], great: ['#7FE3FF', '#2B8CFF'], excellent: ['#E3B6FF', '#8F4DFF'], amazing: ['#FFE27A', '#FF7A1A'], unbelievable: ['#FFB3E1', '#FF2E8B'] };

  let el = null, cv = null, ctx = null;
  let g = null;                      // the game (blast.js)
  let W = 0, H = 0, dpr = 1, L = {};  // size + layout
  let spr = {};                      // pre-drawn blocks: spr[size][color]
  let boardImg = null;               // the empty board, pre-drawn
  let drag = null, raf = null, dirty = false;
  let fx = [];                       // timed effects (pops, clears, words, deals, returns)
  let parts = [];                    // sparkles
  let shake = 0, shakeT = 0, lastTm = 0;
  let boardVer = 0, boardCache = null; // the board + its blocks as one picture, redrawn when the board changes
  let cvRect = null;                     // the canvas position, measured once per touch
  let shownScore = 0, scoreEl = null, bestEl = null;
  let overState = null;              // game over: { t0 } while the board greys out
  let busy = false;                  // between a game ending and its card
  let unbanked = false;              // a finished game whose score hasn't been counted yet
  let watchUid = null;               // watching this family member play (null: my own game)
  let flight = null, landTimer = null, joinTimer = null, awayTimer = null, waitKind = null, eyeTimer = null, offLive = null;
  let chatOpen = false, readId = '', lastSay = 0, reacts = [];   // the chat beside a live game
  const now = () => performance.now();
  const reduced = () => ui().reduced();
  const saveKey = () => 'famfi.bb' + NS + '.' + (S().state.meId || 'x');
  let fakeLive = null; // design-board shots only: a pretend family watching (app.js)
  const LV = () => fakeLive || (FF.cloud && FF.cloud.live && S().mode() === 'cloud' ? FF.cloud.live : null);
  const memberOf = (uid) => S().member(uid) || { name: '', avatar: null };

  /* ===================================================== OPEN / CLOSE */
  function open(o) {
    if (el) return;
    o = o || {};
    watchUid = o.watch || null;
    const who = watchUid ? memberOf(watchUid) : null;
    el = document.createElement('div');
    el.className = 'blast' + (watchUid ? ' watching' : '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', watchUid ? t('bb.watchingA', { name: who.name }) : t('bb.name'));
    el.innerHTML = '<canvas class="bb-cv" aria-label="' + esc(t('bb.boardA')) + '"></canvas>' +
      (watchUid
        ? '<header class="bb-top"><button type="button" class="bb-btn" data-bb="quit" aria-label="' + esc(t('bb.quit')) + '">' + ic('close', 24) + '</button>' +
          '<div class="bb-who">' + FF.art.avatar(who.avatar, 34) + '<span class="bb-who-n">' + esc(who.name) + '</span><span class="bb-live">' + t('bb.live') + '</span></div>' +
          '<button type="button" class="bb-eyes" data-bb="chat" hidden></button>' +
          '<button type="button" class="bb-btn" data-bb="others" aria-label="' + esc(t('bb.watchOther')) + '">' + ic('users', 22) + '</button></header>'
        : '<header class="bb-top"><button type="button" class="bb-btn" data-bb="quit" aria-label="' + esc(t('bb.quit')) + '">' + ic('close', 24) + '</button>' +
          '<div class="bb-best"><span aria-hidden="true">👑</span><b class="num" id="bb-best">0</b></div>' +
          '<button type="button" class="bb-eyes" data-bb="chat" hidden aria-live="polite"></button>' +
          '<button type="button" class="bb-btn" data-bb="rank" aria-label="' + esc(t('bb.ranking')) + '"><span aria-hidden="true">🏆</span></button>' +
          '<button type="button" class="bb-btn" data-bb="menu" aria-label="' + esc(t('bb.menu')) + '">' + ic('dots', 22) + '</button></header>') +
      '<div class="bb-score num" id="bb-score" aria-live="polite">0</div>' +
      '<div class="bb-hint" hidden><span class="bb-hand" aria-hidden="true">👆</span><span>' + t('bb.hint') + '</span></div>' +
      '<div class="bb-wait" hidden></div>' +
      '<div class="bb-over" hidden></div>' +
      '<div class="bb-feed" aria-live="polite"></div><div class="bb-floats" aria-hidden="true"></div>' +
      (watchUid && LV() ? chatBarHtml() : '') +
      '<div class="bb-chatp" hidden></div>';
    const app = document.getElementById('app');
    app.appendChild(el);
    app.scrollTop = 0;
    if (o.from) { el.style.setProperty('--ox', o.from.x + 'px'); el.style.setProperty('--oy', o.from.y + 'px'); }
    document.documentElement.classList.add('in-game');
    if (FF.village) { FF.village.hide(); FF.village.cover(true, 450); } // asleep once the game has zoomed in
    cv = el.querySelector('.bb-cv');
    ctx = cv.getContext('2d', { alpha: true });
    scoreEl = el.querySelector('#bb-score'); bestEl = el.querySelector('#bb-best');
    el.addEventListener('click', onClick);
    if (!watchUid) { // a watcher only watches
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onUp);
    }
    el.addEventListener('touchmove', (e) => { if (!e.target.closest('.bbc-list, .bbc-quick, .bbc-emo')) e.preventDefault(); }, { passive: false }); // no page bounce under a drag (the chat still scrolls)
    window.addEventListener('resize', onResize);
    offLive = FF.on('live', onLive);
    if (watchUid) { startWatch(); return; }
    // the game: continue where you left off, or a new one
    g = load() || B.newGame();
    boardVer++;
    fx = []; parts = []; drag = null; overState = null; busy = false; unbanked = false;
    shownScore = g.score;
    layout();
    showBest();
    scoreEl.textContent = num(g.score);
    dealFx();
    const firstTime = !S().bbOf(S().me()).games && !g.moves;
    el.querySelector('.bb-hint').hidden = !firstTime;
    requestAnimationFrame(() => el && el.classList.add('open'));
    ui().sfx.whoosh();
    chatReset();
    if (g.over) setTimeout(() => endGame(), 400);
    else livePlay();
    draw();
  }
  /* o.next: another game screen opens straight after (the village stays asleep) */
  function close(o) {
    if (!el) return;
    if (!watchUid) {
      const r = bank(); // quit during the game-over moment: the game still counts
      if (r && r.gems) ui().toast(t('bb.banked', { n: r.gems }), { icon: FF.art.gem(20), tone: 'success' });
      save();
    }
    const lv = LV();
    if (lv) { if (watchUid) lv.unwatch(); else lv.quit(); }
    if (offLive) { offLive(); offLive = null; }
    clearTimeout(landTimer); clearTimeout(joinTimer); clearTimeout(awayTimer); clearTimeout(eyeTimer); flight = null; waitKind = null;
    closeChat(true);
    clearTimeout(floatTimer); floatTimer = null; floatPend = [];
    watchUid = null;
    ui().closeAllSheets();
    const e = el;
    el = null; cv = null; ctx = null;
    cancelAnimationFrame(raf); raf = null;
    window.removeEventListener('resize', onResize);
    e.classList.remove('open');
    e.classList.add('closing');
    setTimeout(() => e.remove(), reduced() ? 0 : 320);
    if (o && o.next) return;
    document.documentElement.classList.remove('in-game');
    ui().sfx.whoosh();
    if (FF.village) { FF.village.cover(false); if (FF.app.tab === 'family') { FF.village.show(); FF.village.render(); } }
  }
  function onResize() { if (!el) return; layout(); draw(); }

  /* ===================================================== SAVE / LOAD (this phone only) */
  function save() {
    if (!g || g.watch) return; // someone else's game is never saved here
    try {
      if (g.over || (!g.moves && !g.score)) localStorage.removeItem(saveKey());
      else localStorage.setItem(saveKey(), JSON.stringify({ v: 1, board: g.board, hand: g.hand, score: g.score, combo: g.combo, miss: g.miss, moves: g.moves, clears: g.clears }));
    } catch (e) { /* storage full or private mode: the game just won't resume */ }
  }
  function load() { try { return B.restore(JSON.parse(localStorage.getItem(saveKey()))); } catch (e) { return null; } }
  const hasSaved = () => { try { return !!localStorage.getItem(saveKey()); } catch (e) { return false; } };

  /* ===================================================== LAYOUT + PRE-DRAWN BLOCKS */
  function layout() {
    // layout size (the opening zoom mustn't shrink the board); never 0 — a hidden window would break the maths
    W = el.clientWidth || window.innerWidth || 375; H = el.clientHeight || window.innerHeight || 667;
    dpr = Math.min(2, window.devicePixelRatio || 1); // 2× is crisp for blocks; 3× would be 2.25× the pixels to fill every frame
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
    const sab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
    const top = sat + 128, bottom = sab + 14 + (el.querySelector('.bb-chatbar') ? 62 : 0);
    const cell = Math.max(12, Math.floor(Math.min((W - 26) / 8, (H - top - bottom - 30) / 10.4, 58)));
    const bw = cell * N;
    const pad = Math.max(5, Math.round(cell * 0.13)), tc = Math.round(cell * 0.56);
    // board + tray sit in the middle of the space below the header (tall phones get breathing room)
    const groupH = bw + pad * 2 + 22 + tc * 5.4, room = H - bottom - top - 8;
    const by = Math.round(top + 8 + Math.max(0, (room - groupH) * 0.42));
    L = { cell, bw, bx: Math.round((W - bw) / 2), by, pad, tc };
    L.ty = L.by + bw + L.pad + 22 + L.tc * 2.6;           // the tray's centre line, just under the board
    scoreEl.style.top = Math.max(sat + 56, by - 92) + 'px';
    L.slots = [0, 1, 2].map((k) => ({ x: W * (k * 2 + 1) / 6, y: L.ty, w: W / 3, h: L.tc * 5.2 }));
    spr = {};
    [cell, L.tc].forEach((size) => { spr[size] = COL.map((c, i) => (i ? block(size, c) : null)); spr[size].grey = block(size, '#7C86A8'); });
    boardImg = boardBg();
    boardCache = null;
  }
  function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr); const x = c.getContext('2d'); x.scale(dpr, dpr); return [c, x]; }
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const ch = (v) => Math.round(Math.max(0, Math.min(255, f < 1 ? v * f : v + (255 - v) * (f - 1)))); return 'rgb(' + ch(n >> 16) + ',' + ch((n >> 8) & 255) + ',' + ch(n & 255) + ')'; };
  /* one jewel block: bevelled edges, a soft face and a glint */
  function block(size, hex) {
    const [c, x] = canvasOf(size, size);
    const s = size, e = Math.max(2, s * 0.14), r = Math.max(2, s * 0.12);
    x.save();
    rr(x, 0.5, 0.5, s - 1, s - 1, r); x.clip();
    x.fillStyle = hex; x.fillRect(0, 0, s, s);
    // bevel: light top + left, dark bottom + right
    x.fillStyle = shade(hex, 1.42); x.beginPath(); x.moveTo(0, 0); x.lineTo(s, 0); x.lineTo(s - e, e); x.lineTo(e, e); x.closePath(); x.fill();
    x.fillStyle = shade(hex, 1.22); x.beginPath(); x.moveTo(0, 0); x.lineTo(e, e); x.lineTo(e, s - e); x.lineTo(0, s); x.closePath(); x.fill();
    x.fillStyle = shade(hex, 0.62); x.beginPath(); x.moveTo(0, s); x.lineTo(e, s - e); x.lineTo(s - e, s - e); x.lineTo(s, s); x.closePath(); x.fill();
    x.fillStyle = shade(hex, 0.78); x.beginPath(); x.moveTo(s, 0); x.lineTo(s, s); x.lineTo(s - e, s - e); x.lineTo(s - e, e); x.closePath(); x.fill();
    const gr = x.createLinearGradient(0, e, 0, s - e); gr.addColorStop(0, shade(hex, 1.12)); gr.addColorStop(1, shade(hex, 0.92));
    x.fillStyle = gr; x.fillRect(e, e, s - e * 2, s - e * 2);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(e + s * 0.16, e + s * 0.13, s * 0.11, s * 0.06, -0.6, 0, Math.PI * 2); x.fill();
    x.restore();
    return c;
  }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function boardBg() {
    const p = L.pad, size = L.bw + p * 2;
    const [c, x] = canvasOf(size, size);
    rr(x, 0, 0, size, size, Math.max(10, L.cell * 0.28)); x.fillStyle = '#16204A'; x.fill();
    x.strokeStyle = 'rgba(120,150,255,.25)'; x.lineWidth = 2; x.stroke();
    for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
      rr(x, p + q * L.cell + 1.5, p + r * L.cell + 1.5, L.cell - 3, L.cell - 3, Math.max(3, L.cell * 0.1));
      x.fillStyle = '#1F2B5E'; x.fill();
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(p + q * L.cell + 2, p + r * L.cell + L.cell - 5, L.cell - 4, 2.5);
    }
    return c;
  }

  /* ===================================================== DRAWING (only while something moves) */
  function draw() { dirty = true; if (!raf) raf = requestAnimationFrame(frame); }
  function frame(tm) {
    raf = null;
    if (!el || !ctx) return;
    const busyFx = render(tm);
    if (busyFx || dirty === 'again') raf = requestAnimationFrame(frame); // a piece held still costs nothing
    dirty = false;
  }
  function render(tm) {
    const c = ctx, cell = L.cell;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    let live = false;
    // a little shake for big clears
    if (shake && tm - shakeT < 260) { const k = (1 - (tm - shakeT) / 260) * shake; c.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k); live = true; } else shake = 0;
    // where the dragged piece would land, and which lines it would clear (shown in its colour) —
    // worked out when the piece snaps to a new spot, not on every frame
    const ghost = drag && drag.ok ? drag.ghost : null, glow = drag && drag.ok ? drag.glow : null;
    let pops = null;
    for (let k = 0; k < fx.length; k++) if (fx[k].k === 'pop') { pops = pops || {}; fx[k].cells.forEach((i) => { pops[i] = fx[k]; }); }
    const greyUpTo = overState ? Math.floor((tm - overState.t0) / 55) : -1;
    if (pops || overState) {
      // blocks popping in or greying out: one by one
      c.drawImage(boardImg, L.bx - L.pad, L.by - L.pad, L.bw + L.pad * 2, L.bw + L.pad * 2);
      for (let i = 0; i < N * N; i++) {
        const v = g.board[i];
        if (!v) continue;
        const r = (i / N) | 0, q = i % N;
        let img = spr[cell][glow && glow[i] ? drag.p.color : v];
        if (overState && (N - 1 - r) * N + q < greyUpTo * 1.5) img = spr[cell].grey;
        const x = L.bx + q * cell, y = L.by + r * cell;
        const pf = pops && pops[i];
        if (pf) { const k = Math.min(1, (tm - pf.t0) / 170); const s = 1 + 0.16 * Math.sin(k * Math.PI); drawScaled(img, x, y, cell, s); live = live || k < 1; }
        else c.drawImage(img, x, y, cell, cell);
      }
    } else {
      // the usual case: the board with its blocks is one picture
      if (!boardCache || boardCache.ver !== boardVer || boardCache.g !== g || boardCache.m !== g.moves) paintBoard();
      c.drawImage(boardCache.cv, L.bx - L.pad, L.by - L.pad, L.bw + L.pad * 2, L.bw + L.pad * 2);
      if (glow) for (let i = 0; i < N * N; i++) if (glow[i] && g.board[i]) c.drawImage(spr[cell][drag.p.color], L.bx + (i % N) * cell, L.by + ((i / N) | 0) * cell, cell, cell);
    }
    if (ghost) { c.globalAlpha = 0.42; const img = spr[cell][drag.p.color]; for (let k = 0; k < ghost.length; k++) c.drawImage(img, L.bx + (ghost[k] % N) * cell, L.by + ((ghost[k] / N) | 0) * cell, cell, cell); c.globalAlpha = 1; }
    if (overState) live = live || greyUpTo * 1.5 < N * N;
    // effects: clears, words, deals, a piece flying back
    for (let k = fx.length - 1; k >= 0; k--) {
      const f = fx[k], age = tm - f.t0;
      if (age < 0) { live = true; continue; }
      if (age > f.dur) { fx.splice(k, 1); continue; }
      live = true;
      const p = age / f.dur;
      if (f.k === 'fly') continue; // drawn over the tray, below
      if (f.k === 'clear') {
        f.cells.forEach((cl) => {
          const d = Math.max(0, p - cl.delay);
          if (d >= 1) return;
          const x = L.bx + (cl.i % N) * cell, y = L.by + ((cl.i / N) | 0) * cell;
          const s = d < 0.25 ? 1 + d * 0.5 : 1.12 * (1 - (d - 0.25) / 0.75);
          drawScaled(spr[cell][cl.color], x, y, cell, Math.max(0.01, s));
          if (d < 0.35) { c.globalAlpha = (0.35 - d) * 2.2; c.fillStyle = '#FFFFFF'; c.fillRect(x + 2, y + 2, cell - 4, cell - 4); c.globalAlpha = 1; }
          if (!cl.burst && d > 0.2) { cl.burst = true; burst(x + cell / 2, y + cell / 2, COL[cl.color], 4); }
        });
      } else if (f.k === 'word') drawWord(f, p);
      else if (f.k === 'pts') {
        if (!f.img) f.img = textSprite('+' + num(f.n), '800 ' + Math.round(cell * 0.46) + 'px Fredoka, Nunito, sans-serif', 4, 'rgba(15,20,60,.7)', ['#FFFFFF', '#FFFFFF']);
        c.globalAlpha = Math.min(1, (1 - p) * 2);
        c.drawImage(f.img.cv, f.x - f.img.w / 2, f.y - p * cell * 0.9 - f.img.h * 0.62, f.img.w, f.img.h);
        c.globalAlpha = 1;
      }
    }
    // the tray
    g.hand.forEach((pc, k) => {
      if (!pc || (drag && drag.slot === k)) return;
      const sl = L.slots[k];
      let oy = 0, a = 1;
      const deal = fx.find((f) => f.k === 'deal' && f.slot === k);
      if (deal) { const p = Math.max(0, Math.min(1, (tm - deal.t0) / deal.dur)); const e = 1 - Math.pow(1 - p, 3); oy = (1 - e) * L.tc * 3; a = e; }
      const back = fx.find((f) => f.k === 'back' && f.slot === k);
      if (back) return; // drawn by the flight below
      c.globalAlpha = a * (fitsNow(k) ? 1 : 0.35);
      drawPiece(pc, sl.x, sl.y + oy, L.tc);
      c.globalAlpha = 1;
    });
    fx.forEach((f) => {
      if (f.k === 'back') {
        const p = Math.min(1, (tm - f.t0) / f.dur), e = 1 - Math.pow(1 - p, 3);
        const sl = L.slots[f.slot], size = f.size + (L.tc - f.size) * e;
        drawPiece(g.hand[f.slot], f.x + (sl.x - f.x) * e, f.y + (sl.y - f.y) * e, size);
      } else if (f.k === 'fly') { // watching: their piece glides from the tray to where they put it
        const p = Math.min(1, Math.max(0, (tm - f.t0) / f.dur)), e = 1 - Math.pow(1 - p, 3);
        const sh = B.SHAPES[f.pc.id], sl = L.slots[f.slot];
        const tx = L.bx + (f.c + sh.cols / 2) * cell, ty = L.by + (f.r + sh.rows / 2) * cell;
        drawPiece(f.pc, sl.x + (tx - sl.x) * e, sl.y + (ty - sl.y) * e - Math.sin(p * Math.PI) * cell * 0.7, L.tc + (cell - L.tc) * e);
      }
    });
    // sparkles (moved by time, so 60 Hz and 120 Hz screens look the same)
    const step = Math.max(0, Math.min(3, (tm - (lastTm || tm)) / 16.67));
    lastTm = tm;
    if (parts.length) {
      live = true;
      for (let k = parts.length - 1; k >= 0; k--) {
        const s = parts[k];
        s.vy += 0.42 * step; s.x += s.vx * step; s.y += s.vy * step; s.life -= step;
        if (s.life <= 0) { parts.splice(k, 1); continue; }
        c.globalAlpha = Math.min(1, s.life / 18); c.fillStyle = s.c;
        c.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
      }
      c.globalAlpha = 1;
    }
    // the piece in your finger, a little above it so you can see where it goes
    if (drag) {
      // it grows from its tray size to full size as it lifts (~0.1 s)
      const lp = Math.min(1, (tm - drag.t0) / 110), k = drag.k0 + (1 - drag.k0) * (1 - Math.pow(1 - lp, 3));
      const sp = drag.sprite, dw = sp.w * k, dh = sp.h * k;
      c.drawImage(sp.cv, drag.px - dw / 2, drag.py - dh / 2, dw, dh);
      if (lp < 1) live = true;
    }
    // the score counts up
    if (Math.round(shownScore) !== g.score) {
      shownScore += Math.max(1, (g.score - shownScore) * 0.18);
      if (shownScore > g.score) shownScore = g.score;
      scoreEl.textContent = num(Math.round(shownScore));
      live = true;
    }
    return live;
  }
  let fitMemo = { m: -1, ok: [] };
  function fitsNow(k) {
    if (fitMemo.m !== g.moves || fitMemo.g !== g) fitMemo = { m: g.moves, g, ok: g.hand.map((p) => !!p && B.canPlace(g.board, p.id)) };
    return fitMemo.ok[k];
  }
  function drawScaled(img, x, y, size, s) {
    const d = (size * s - size) / 2;
    ctx.drawImage(img, x - d, y - d, size * s, size * s);
  }
  /* a piece centred on (cx, cy) with cells of `size` px */
  function drawPiece(pc, cx, cy, size) {
    const sh = B.SHAPES[pc.id], img = spr[size > L.tc + 0.5 ? L.cell : L.tc][pc.color]; // pre-drawn blocks, scaled
    const w = sh.cols * size, h = sh.rows * size, x0 = cx - w / 2, y0 = cy - h / 2;
    sh.cells.forEach((q) => ctx.drawImage(img, x0 + q[1] * size, y0 + q[0] * size, size, size));
  }
  function drawWord(f, p) {
    if (!f.img) f.img = textSprite(f.text, '700 ' + Math.round(f.size) + 'px Fredoka, Nunito, sans-serif', f.size * 0.2, 'rgba(20,16,70,.85)', f.col);
    const s = p < 0.12 ? 0.4 + (p / 0.12) * 0.8 : p < 0.22 ? 1.2 - ((p - 0.12) / 0.1) * 0.2 : 1;
    const y = f.y - p * L.cell * 0.6, dw = f.img.w * s, dh = f.img.h * s;
    ctx.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 1;
    ctx.drawImage(f.img.cv, f.x - dw / 2, y - dh / 2, dw, dh);
    ctx.globalAlpha = 1;
  }
  /* outlined, gradient-filled text drawn once into a little picture (text is slow to draw every frame) */
  function textSprite(text, font, lw, stroke, col) {
    ctx.font = font;
    const fs = parseFloat(font.split(' ')[1]) || 20;
    const w = Math.ceil(ctx.measureText(text).width + lw * 2 + 8), h = Math.ceil(fs * 1.45 + lw * 2);
    const [cv2, x] = canvasOf(w, h);
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = lw; x.strokeStyle = stroke; x.strokeText(text, w / 2, h / 2);
    const gr = x.createLinearGradient(0, h / 2 - fs / 2, 0, h / 2 + fs / 2); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
    x.fillStyle = gr; x.fillText(text, w / 2, h / 2);
    return { cv: cv2, w, h };
  }
  /* the board and the blocks on it, as one picture (redrawn only after a move) */
  function paintBoard() {
    const p = L.pad, size = L.bw + p * 2, cell = L.cell;
    if (!boardCache) { const [cv2, x] = canvasOf(size, size); boardCache = { cv: cv2, x }; }
    const x = boardCache.x;
    x.clearRect(0, 0, size, size);
    x.drawImage(boardImg, 0, 0, size, size);
    for (let i = 0; i < N * N; i++) if (g.board[i]) x.drawImage(spr[cell][g.board[i]], p + (i % N) * cell, p + ((i / N) | 0) * cell, cell, cell);
    boardCache.ver = boardVer; boardCache.g = g; boardCache.m = g.moves;
  }
  /* the piece in your finger, with its soft shadow, drawn once when you pick it up
     (a blurred shadow is one of the slowest things to draw — never every frame) */
  function liftSprite(pc) {
    const sh = B.SHAPES[pc.id], cell = L.cell, w = sh.cols * cell, h = sh.rows * cell, pad = 24;
    const [flat, fx2] = canvasOf(w, h);
    sh.cells.forEach((q) => fx2.drawImage(spr[cell][pc.color], q[1] * cell, q[0] * cell, cell, cell));
    const [cv2, x] = canvasOf(w + pad * 2, h + pad * 2);
    x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 10 * dpr; x.shadowOffsetY = 6 * dpr;
    x.drawImage(flat, pad, pad, w, h);
    return { cv: cv2, w: w + pad * 2, h: h + pad * 2 };
  }
  function burst(x, y, color, n) {
    if (reduced()) return;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 4.5;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3.5, s: 3 + Math.random() * 4, c: color, life: 26 + Math.random() * 16 });
    }
    if (parts.length > 260) parts.splice(0, parts.length - 260);
  }
  function dealFx() {
    const t0 = now();
    g.hand.forEach((p, k) => { if (p) fx.push({ k: 'deal', slot: k, t0: t0 + k * 70, dur: 300 }); });
    draw();
  }
  function showBest() {
    if (!bestEl) return;
    const b = S().bbOf(S().me()).best;
    bestEl.textContent = num(Math.max(b, g ? g.score : 0));
  }

  /* ===================================================== INPUT: pick up · drag · drop */
  function slotAt(x, y) {
    for (let k = 0; k < 3; k++) { const s = L.slots[k]; if (g.hand[k] && Math.abs(x - s.x) < s.w / 2 && Math.abs(y - s.y) < s.h / 2) return k; }
    return -1;
  }
  /* how much faster than your finger the piece moves (Menu → Block speed) */
  const SPEEDS = [1, 1.6, 2.1];
  const speed = () => { const v = +S().device().bbSpeed; return SPEEDS.indexOf(v) !== -1 ? v : 1.6; };
  function onDown(e) {
    if (!g || g.over || busy || drag || watchUid) return;
    cvRect = cv.getBoundingClientRect();
    const x = e.clientX - cvRect.left, y = e.clientY - cvRect.top;
    const k = slotAt(x, y);
    if (k < 0) return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
    const pc = g.hand[k], sh = B.SHAPES[pc.id], cell = L.cell;
    // the piece jumps up so its bottom edge sits a cell above your finger (never hidden under it)
    drag = {
      slot: k, p: pc, id: e.pointerId, x0: x, y0: y, ax: x, ay: y - cell - (sh.rows * cell) / 2, gain: speed(),
      px: x, py: 0, k0: L.tc / cell, t0: now(), sprite: liftSprite(pc), ok: false, r: -9, c: -9, ghost: null, glow: null, moved: false
    };
    fx = fx.filter((f) => !(f.k === 'back' && f.slot === k));
    const hint = el.querySelector('.bb-hint'); if (hint && !hint.hidden) hint.hidden = true;
    ui().sfx.bbPick();
    move(x, y);
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    move(e.clientX - cvRect.left, e.clientY - cvRect.top);
  }
  /* the piece moves `gain` times as far as your finger; it lands on the nearest spot where it
     fits — and if it's almost over a free spot (within ~¾ of a cell) it takes that one */
  function move(x, y) {
    const d = drag, sh = B.SHAPES[d.p.id], cell = L.cell, w = sh.cols * cell, h = sh.rows * cell;
    if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > 9) d.moved = true;
    d.px = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, d.ax + (x - d.x0) * d.gain));
    d.py = Math.max(h / 2 + 2, Math.min(H - h / 2 - 2, d.ay + (y - d.y0) * d.gain));
    const fc = (d.px - w / 2 - L.bx) / cell, fr = (d.py - h / 2 - L.by) / cell;
    let r = Math.round(fr), c = Math.round(fc), ok = B.fits(g.board, d.p.id, r, c);
    if (!ok) {
      let best = 0.75 * 0.75;
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const rr = a ? Math.ceil(fr) : Math.floor(fr), cc = b ? Math.ceil(fc) : Math.floor(fc);
        const dd = (fr - rr) * (fr - rr) + (fc - cc) * (fc - cc);
        if (dd < best && B.fits(g.board, d.p.id, rr, cc)) { best = dd; r = rr; c = cc; ok = true; }
      }
    }
    if (ok !== d.ok || r !== d.r || c !== d.c) {
      d.ok = ok; d.r = r; d.c = c;
      d.ghost = ok ? sh.cells.map((q) => (r + q[0]) * N + c + q[1]) : null;
      d.glow = null;
      if (ok) {
        const wl = B.wouldClear(g.board, d.p.id, r, c);
        if (wl.rows.length || wl.cols.length) {
          d.glow = new Uint8Array(N * N);
          wl.rows.forEach((rr) => { for (let q = 0; q < N; q++) d.glow[rr * N + q] = 1; });
          wl.cols.forEach((q) => { for (let rr = 0; rr < N; rr++) d.glow[rr * N + q] = 1; });
        }
      }
    }
    draw();
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    // a tap (no drag) never drops a piece by accident: it goes back
    if (d.ok && d.moved && e.type === 'pointerup') drop(d);
    else { fx.push({ k: 'back', slot: d.slot, t0: now(), dur: 170, x: d.px, y: d.py, size: L.cell }); if (d.moved) ui().sfx.bbBack(); draw(); }
  }
  function drop(d) {
    const res = B.place(g, d.slot, d.r, d.c);
    if (!res) return;
    boardVer++;
    const t0 = now(), cell = L.cell;
    const placed = B.SHAPES[d.p.id].cells.map((q) => (d.r + q[0]) * N + d.c + q[1]);
    fx.push({ k: 'pop', cells: placed, t0, dur: 170 });
    const cx = L.bx + (d.c + B.SHAPES[d.p.id].cols / 2) * cell, cy = L.by + (d.r + B.SHAPES[d.p.id].rows / 2) * cell;
    if (res.nl) {
      clearFx(res.cleared, d.r, d.c, res.nl, res.combo, res.allClear, t0);
      // blocks breaking: a buzz you feel, stronger for more lines, a combo, an all clear (Menu → Vibration)
      if (res.allClear) ui().buzz(6, 75, 40); else ui().buzz(Math.min(5, 1 + res.nl + (res.combo >= 3 ? 1 : 0)), 55, 28);
    } else { ui().haptic(); ui().sfx.bbDrop(); }
    fx.push({ k: 'pts', n: res.pts, x: cx, y: cy, t0: t0 + 40, dur: 750 });
    if (res.dealt) setTimeout(() => { if (el) dealFx(); }, res.nl ? 260 : 120);
    if (g.score > (+bestEl.textContent.replace(/[^\d]/g, '') || 0)) bestEl.textContent = num(g.score);
    save();
    const lv = LV(); // family members watching see the move (nothing is sent if nobody is)
    if (lv) { if (res.over) lv.over(B.pack(g, res)); else lv.move(B.pack(g, res)); }
    draw();
    if (res.over) { busy = true; setTimeout(() => endGame(), res.nl ? 900 : 500); }
  }

  /* lines breaking: cells vanish in a wave from where the piece landed, a word pops (shared by
     your own moves and the ones you watch) */
  function clearFx(cleared, r, c, nl, combo, allClear, t0) {
    const cell = L.cell;
    const cells = cleared.map((cl) => ({ i: cl.i, color: cl.color, delay: Math.min(0.45, Math.hypot((cl.i % N) - (c + 1), ((cl.i / N) | 0) - (r + 1)) * 0.045) }));
    fx.push({ k: 'clear', cells, t0, dur: 520 });
    ui().sfx.bbClear(nl, combo);
    if ((nl >= 3 || combo >= 4) && !reduced()) { shake = Math.min(10, 3 + nl * 1.6); shakeT = t0; }
    const praise = B.praiseFor(nl), midY = L.by + L.bw * 0.42;
    fx.push({ k: 'word', text: t('bb.p.' + praise), col: PRAISE_COL[praise] || PRAISE_COL.good, x: W / 2, y: midY, size: cell * (0.95 + Math.min(0.45, nl * 0.12)), t0: t0 + 60, dur: 1000 });
    if (combo >= 2) fx.push({ k: 'word', text: t('bb.combo', { n: combo }), col: ['#FFFFFF', '#FFD23F'], x: W / 2, y: midY + cell * 1.15, size: cell * 0.62, t0: t0 + 180, dur: 950 });
    if (allClear) {
      fx.push({ k: 'word', text: t('bb.allClear'), col: ['#FFF3B0', '#FFB300'], x: W / 2, y: midY - cell * 1.25, size: cell * 1.05, t0: t0 + 300, dur: 1400 });
      ui().sfx.bbAllClear();
      setTimeout(() => ui().confetti({ n: 140 }), 300);
    }
  }

  /* ===================================================== GAME OVER */
  function bank() {
    if (!unbanked) return null;
    unbanked = false;
    const r = S().blastFinish(g.score);
    g.over = true;
    save();
    return r;
  }
  function endGame() {
    if (!el) return;
    busy = true; unbanked = true;
    overState = { t0: now() };
    ui().sfx.bbOver();
    draw();
    setTimeout(() => { if (!el) return; const r = bank(); if (r) showCard(r); }, reduced() ? 200 : 1300);
  }
  function showCard(r) {
    const box = el.querySelector('.bb-over');
    box.innerHTML = '<div class="bb-card' + (r.newBest ? ' best' : '') + '">' +
      '<div class="bb-card-t">' + (r.newBest ? '<span class="bb-ribbon">' + t('bb.newBest') + '</span>' : t('bb.noSpace')) + '</div>' +
      '<div class="bb-final num">' + num(r.score) + '</div>' +
      '<div class="bb-sub">👑 ' + t('bb.best', { n: num(r.best) }) + '</div>' +
      '<div class="bb-gems">' + (r.gems ? '<span class="bb-gem-n">+' + r.gems + FF.art.gem(26) + '</span>' : '<span class="bb-gem-n zero">+0' + FF.art.gem(22) + '</span>') +
      '<span class="bb-gem-s">' + t('bb.gemRule', { per: num(FF.play.BLAST.PER), today: r.today }) + '</span></div>' +
      (r.rank ? '<div class="bb-rankline">🏆 ' + t('bb.rankWeek', { n: r.rank }) + '</div>' : '') +
      '<button type="button" class="btn btn-sun btn-block btn-lg" data-bb="again">' + ic('refresh', 20) + t('bb.again') + '</button>' +
      '<div class="bb-card-row"><button type="button" class="btn btn-soft" data-bb="rank">🏆 ' + t('bb.ranking') + '</button><button type="button" class="btn btn-ghost bb-ghost" data-bb="quit">' + t('bb.toVillage') + '</button></div></div>';
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('show'));
    if (r.newBest) { ui().sfx.success(); ui().confetti({ n: 160 }); }
    else if (r.gems) ui().sfx.coin();
    if (r.badges && r.badges.length) setTimeout(() => FF.app.celebrate({ badges: r.badges }), 1200);
  }
  function newGame() {
    // a game in progress counts as finished (its score still earns its gems)
    if (g && !g.over && (g.moves || g.score)) S().blastFinish(g.score);
    g = B.newGame();
    boardVer++;
    fx = []; parts = []; drag = null; overState = null; busy = false; unbanked = false; shownScore = 0;
    scoreEl.textContent = '0';
    showBest();
    const box = el.querySelector('.bb-over'); box.classList.remove('show'); box.hidden = true; box.innerHTML = '';
    save();
    dealFx();
    ui().sfx.pop();
    livePlay();
  }

  /* ===================================================== MENU · RANKING */
  function onClick(e) {
    const em = e.target.closest('[data-bbe]');
    if (em) { react(em.dataset.bbe, em); return; }
    const b = e.target.closest('[data-bb]');
    if (!b) return;
    ui().sfx.tap();
    const k = b.dataset.bb;
    if (k === 'quit') close();
    else if (k === 'others') openPick({});
    else if (k === 'playmine') playMine();
    else if (k === 'again') newGame();
    else if (k === 'rank') openRanking();
    else if (k === 'menu') openMenu();
    else if (k === 'chat') openChat();
  }
  function openMenu() {
    ui().openSheet({
      label: t('bb.menu'),
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('bb.name') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div class="list-card bb-menu">' +
        '<button type="button" class="row" data-m="resume"><span class="cat-emo sm" aria-hidden="true">▶️</span><span class="row-main"><span class="row-t">' + t('bb.resume') + '</span></span></button>' +
        '<button type="button" class="row" data-m="new"><span class="cat-emo sm" aria-hidden="true">🔄</span><span class="row-main"><span class="row-t">' + t('bb.newGame') + '</span><span class="row-s">' + t('bb.newGameB') + '</span></span></button>' +
        (LV() ? '<button type="button" class="row" data-m="watch"><span class="cat-emo sm" aria-hidden="true">👀</span><span class="row-main"><span class="row-t">' + t('bb.watchMenu') + '</span><span class="row-s">' + (livePlayers().length ? t('bb.watchMenuN', { n: livePlayers().length }) : t('bb.nobodyLive')) + '</span></span></button>' : '') +
        '<button type="button" class="row" data-m="how"><span class="cat-emo sm" aria-hidden="true">💡</span><span class="row-main"><span class="row-t">' + t('bb.how') + '</span></span></button>' +
        '<button type="button" class="row" data-m="quit"><span class="cat-emo sm" aria-hidden="true">🏡</span><span class="row-main"><span class="row-t">' + t('bb.toVillage') + '</span><span class="row-s">' + t('bb.savedNote') + '</span></span></button></div>' +
        '<div class="bb-speed"><h3 class="sub-h">' + t('bb.speed') + '</h3>' + ui().segmented('bbspeed', [{ v: '1', l: t('bb.speed1') }, { v: '1.6', l: t('bb.speed2') }, { v: '2.1', l: t('bb.speed3') }], String(speed())) +
        '<p class="hint">' + ic('info', 14) + '<span>' + t('bb.speedHint') + '</span></p></div>',
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        const seg = body.querySelector('[data-seg="bbspeed"]');
        if (seg) seg.addEventListener('click', (e) => {
          const b = e.target.closest('.seg-b');
          if (!b) return;
          S().setDevice({ bbSpeed: +b.dataset.v });
          seg.querySelectorAll('.seg-b').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
          ui().sfx.tap();
        });
        body.querySelectorAll('[data-m]').forEach((x) => x.addEventListener('click', () => {
          const m = x.dataset.m;
          api.close(true);
          if (m === 'new') newGame();
          else if (m === 'watch') openPick({});
          else if (m === 'how') openHow();
          else if (m === 'quit') close();
        }));
      }
    });
  }
  function openHow() {
    ui().openSheet({
      label: t('bb.how'),
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('bb.how') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<ol class="bb-how">' + ['h1', 'h2', 'h3', 'h4', 'h5'].map((k) => '<li>' + t('bb.' + k, { per: num(FF.play.BLAST.PER) }) + '</li>').join('') + '</ol>' +
        '<button type="button" class="btn btn-primary btn-block" data-close>' + t('common.gotIt') + '</button>',
      onRender: (body, api) => body.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', () => api.close()))
    });
  }
  let rankTab = 'week';
  function openRanking() {
    ui().openSheet({
      className: 'sheet-tall', label: t('bb.ranking'),
      render: () => {
        const me = S().state.meId, list = S().blastBoard(rankTab);
        const medal = ['🥇', '🥈', '🥉'];
        const mine = S().bbOf(S().me());
        let h = '<div class="sheet-head"><span class="sh-spacer"></span><h2>🏆 ' + t('bb.ranking') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>';
        h += ui().segmented('bbrank', [{ v: 'week', l: t('bb.thisWeek') }, { v: 'all', l: t('bb.allTime') }], rankTab);
        h += '<div class="list-card bb-ranks">' + list.map((x, i) => {
          const played = x.v > 0;
          return '<div class="row static bb-rank-row' + (x.m.id === me ? ' me' : '') + '"><span class="bb-pos">' + (played ? (medal[i] || '#' + (i + 1)) : '–') + '</span>' + FF.art.avatar(x.m.avatar, 40) +
            '<span class="row-main"><span class="row-t">' + esc(x.m.name) + (x.m.id === me ? ' <span class="chip chip-brand">' + t('common.you') + '</span>' : '') + '</span>' +
            '<span class="row-s">' + (played ? t('bb.gamesN', { n: x.games, count: x.games }) : t('bb.notYet')) + '</span></span>' +
            '<span class="bb-pts num">' + (played ? num(x.v) : '') + '</span></div>';
        }).join('') + '</div>';
        h += '<p class="hint">' + ic('info', 14) + '<span>' + t('bb.rankNote', { games: mine.games, best: num(mine.best) }) + '</span></p>';
        return h;
      },
      onRender: (body, api) => {
        body.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', () => api.close()));
        const seg = body.querySelector('[data-seg="bbrank"]');
        if (seg) seg.addEventListener('click', (e) => { const b = e.target.closest('.seg-b'); if (!b || b.dataset.v === rankTab) return; rankTab = b.dataset.v; ui().sfx.tap(); api.render(); });
      }
    });
  }

  /* ===================================================== LIVE: PLAYING FOR AN AUDIENCE */
  /* I'm playing: the family sees it (and anyone watching gets the game as it is) */
  function livePlay() { const lv = LV(); if (lv && el && !watchUid && g && !g.over) lv.play(B.pack(g)); }
  const livePlayers = () => (LV() ? LV().playing() : []);
  function onLive(e) {
    if (!el) return;
    if (e.k === 'chat') { onChat(e.fresh || []); return; }
    if (!watchUid) { if (e.k === 'eyes') eyesMine(e.fresh || []); return; }
    if (e.k === 'viewers') eyesTheirs();
    if (e.k === 'on') {
      const on = () => LV() && LV().isPlaying(watchUid);
      clearTimeout(awayTimer);
      // they've put the game down — unless their final board is on its way (it can arrive a moment later)
      if (!on() && !g.over && waitKind !== 'away') awayTimer = setTimeout(() => { if (el && watchUid && !on() && !g.over) showWait('away'); }, 900);
      else if (on() && waitKind === 'away') showWait('join'); // they're back: their game comes next
    }
  }
  /* who's watching me: a little eye with a count — and their name, the moment they start. It's
     also the way into the chat (💬, with a count of messages not read yet) */
  function eyesMine(fresh) {
    const box = el.querySelector('.bb-eyes');
    if (!box) return;
    const ids = LV() ? LV().watchers() : [];
    box.hidden = !ids.length;
    if (!ids.length) { box.classList.remove('hi'); if (chatOpen) closeChat(); return; }
    pill(box, ids.length);
    const names = fresh.filter((u) => ids.indexOf(u) !== -1).map((u) => memberOf(u).name).filter(Boolean);
    if (names.length) pillNote(names.length === 1 ? t('bb.isWatching', { name: names[0] }) : t('bb.viewersA', { n: names.length }), 3000);
  }
  function eyesTheirs() {
    const box = el.querySelector('.bb-eyes');
    const n = LV() ? LV().viewers().length : 0;
    box.hidden = !n;
    pill(box, n);
  }
  function pill(box, n) {
    const u = watchUid ? 0 : unread(); // watchers see the count on their "Say something…" button
    // a note showing right now ("Mum: nice!") stays through the redraw
    const was = box.classList.contains('hi') && box.querySelector('.bb-eyes-who');
    box.innerHTML = ic('eye', 18) + '<b class="num">' + n + '</b>' + (LV() && LV().chatRoom() ? '<span class="bb-chat-ic" aria-hidden="true">💬</span>' : '') +
      (was ? '<span class="bb-eyes-who">' + esc(was.textContent) + '</span>' : '') + (u ? '<i class="bb-unread num">' + (u > 9 ? '9+' : u) + '</i>' : '');
    box.setAttribute('aria-label', t('bb.viewersA', { n }) + ' · ' + t('chat.open') + (u ? ' · ' + t('chat.unreadA', { n: u }) : ''));
  }
  /* a few words in the pill for a moment ("Mum is watching", or a message) */
  function pillNote(text, ms) {
    const box = el && el.querySelector('.bb-eyes');
    if (!box || box.hidden) return;
    let w = box.querySelector('.bb-eyes-who');
    if (!w) { w = document.createElement('span'); w.className = 'bb-eyes-who'; const b = box.querySelector('.bb-unread'); box.insertBefore(w, b || null); }
    w.textContent = text;
    box.classList.add('hi');
    // the pill borrows the best score's place for a moment (squeezed, they'd overlap)
    const top = el.querySelector('.bb-top');
    if (top) top.classList.add('noting');
    clearTimeout(eyeTimer);
    eyeTimer = setTimeout(() => { if (top) top.classList.remove('noting'); if (!box.isConnected) return; box.classList.remove('hi'); const x = box.querySelector('.bb-eyes-who'); if (x) x.remove(); }, ms || 3000);
  }
  const refreshPill = () => { if (!el) return; if (watchUid) eyesTheirs(); else if (LV()) { const box = el.querySelector('.bb-eyes'); if (box && !box.hidden) pill(box, LV().watchers().length); } };

  /* ===================================================== LIVE: THE CHAT
     Words and emoji between the player and the people watching (cloud.js keeps the room). */
  const EMOJI = ['👏', '🔥', '😮', '😂', '❤️', '🎉', '💪', '😱'];
  const BAR_EMOJI = ['👏', '🔥', '😂', '❤️']; // the watchers' bar keeps room for “Say something…” (all eight are in the chat)
  /* Anything moving on screen makes the phone draw every frame (measured in WebKit: ~90 ms of work
     a second, against ~0 for the game at rest) — so emoji go up sparingly: what arrives within
     half a second rises as one (🔥 ×3), for 1.5 s, never more than four at a time and six in any
     ten seconds (a flood waits and then goes up as one, with its count; the chat has them all). */
  const FLOAT_GAP = 500, MAX_FLOATS = 4, FLOAT_BURST = 6, FLOAT_WINDOW = 10000;
  let floatPend = [], floatTimer = null, floatLast = 0, floatTimes = [];
  const chatMsgs = () => (LV() ? LV().chat() : []);
  const okEmoji = (e) => EMOJI.indexOf(e) !== -1;
  const isMine = (x) => x.u === S().state.meId;
  function unread() { return chatMsgs().filter((x) => x.t && !isMine(x) && x.id > readId).length; }
  function chatBarHtml() {
    return '<div class="bb-chatbar">' + BAR_EMOJI.map((e) => '<button type="button" class="bb-emo" data-bbe="' + e + '" aria-label="' + esc(t('chat.react', { emoji: e })) + '">' + e + '</button>').join('') +
      '<button type="button" class="bb-say" data-bb="chat"><span class="bb-say-t">' + t('chat.say') + '</span><i class="bb-unread num" hidden></i></button></div>';
  }
  /* new messages arrived (cloud.js says which are new: the first look at a room is history) */
  function onChat(fresh) {
    if (!el) return;
    let words = 0;
    fresh.forEach((x) => {
      if (x.e) { if (okEmoji(x.e)) floatEmoji(x.e, isMine(x)); return; }
      if (isMine(x)) return;
      words++;
      if (chatOpen) return;
      if (watchUid) feed(x); else pillNote(memberOf(x.u).name + ': ' + x.t, 4500);
    });
    if (words && !chatOpen) ui().sfx.chat();
    if (chatOpen) { renderChatSoon(); return; }
    if (!words) return; // only emoji: nothing to count (no redraw for each one)
    refreshPill();
    const badge = el.querySelector('.bb-say .bb-unread');
    if (badge) { const u = unread(); badge.hidden = !u; badge.textContent = u > 9 ? '9+' : u; }
  }
  const lastId = () => { const m = chatMsgs(); return m.length ? m[m.length - 1].id : readId; };
  /* watchers: the latest few messages, bottom-left, fading after a while */
  function feed(x) {
    const box = el.querySelector('.bb-feed');
    if (!box) return;
    const m = memberOf(x.u), b = document.createElement('div');
    b.className = 'bb-bubble';
    b.innerHTML = FF.art.avatar(m.avatar, 22) + '<span><b>' + esc(m.name) + '</b> ' + esc(x.t) + '</span>';
    box.appendChild(b);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 400); }, 7000);
  }
  /* an emoji drifts up the right edge — HTML moved by the GPU, never drawn on the canvas */
  function floatEmoji(e, mine) {
    if (!el || chatOpen || document.hidden) return; // the open chat shows them in the list
    floatPend.push({ e, mine });
    if (floatPend.length > 99) floatPend.splice(0, floatPend.length - 99);
    if (!floatTimer) pumpFloats();
  }
  function pumpFloats() {
    floatTimer = null;
    if (!el || !floatPend.length) { floatPend = []; return; }
    const now2 = performance.now();
    floatTimes = floatTimes.filter((x) => now2 - x < FLOAT_WINDOW);
    const wait = Math.max(floatLast + FLOAT_GAP - now2, floatTimes.length >= FLOAT_BURST ? floatTimes[0] + FLOAT_WINDOW - now2 : 0);
    if (wait > 0) { floatTimer = setTimeout(pumpFloats, wait); return; }
    const box = el.querySelector('.bb-floats');
    if (!box) return;
    if (box.children.length >= MAX_FLOATS) { floatTimer = setTimeout(pumpFloats, FLOAT_GAP); return; }
    const batch = floatPend, last = batch[batch.length - 1];
    floatPend = [];
    floatLast = now2;
    floatTimes.push(now2);
    const f = document.createElement('span');
    f.className = 'bb-float' + (last.mine ? ' mine' : '');
    f.innerHTML = last.e + (batch.length > 1 ? '<b>×' + batch.length + '</b>' : '');
    if (!reduced()) f.style.setProperty('--fx', Math.round((Math.random() - 0.5) * 24) + 'px');
    box.appendChild(f);
    const gone = () => f.remove();
    f.addEventListener('animationend', gone);
    setTimeout(gone, 2200); // in case the animation never runs (hidden, reduced motion)
  }
  /* send an emoji (a few a second at most — a burst still looks like a burst) */
  function react(e, btn) {
    if (!okEmoji(e) || !LV()) return;
    const now2 = Date.now();
    reacts = reacts.filter((x) => now2 - x < 4000);
    if (reacts.length >= 8 || (reacts.length && now2 - reacts[reacts.length - 1] < 220)) { if (btn) shakeBtn(btn); return; }
    reacts.push(now2);
    if (btn) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    ui().haptic();
    LV().react(e).then((ok) => { if (!ok && el) chatTrouble(); });
  }
  function shakeBtn(b) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); }
  function say(text) {
    const v = String(text || '').trim();
    if (!v || !LV()) return false;
    const now2 = Date.now();
    if (now2 - lastSay < 700) return false;
    lastSay = now2;
    LV().say(v).then((ok) => { if (!ok && el) chatTrouble(); });
    ui().sfx.tap();
    return true;
  }
  function chatTrouble() {
    const away = watchUid && !(LV() && (LV().isPlaying(watchUid) || g.over));
    ui().toast(away ? t('chat.left', { name: esc(memberOf(watchUid).name) }) : t('chat.failed'), { icon: 'info' });
  }

  /* the chat panel: the conversation, quick words, emoji and a box to type in. It sits at the
     bottom (above the keyboard while typing); the board stays in view above it. */
  let vvOff = null;
  function openChat() {
    if (!el || !LV() || !LV().chatRoom()) return;
    const p = el.querySelector('.bb-chatp');
    if (!p) return;
    chatOpen = true;
    readId = lastId();
    const quick = watchUid ? ['w1', 'w2', 'w3'] : ['p1', 'p2', 'p3'];
    p.innerHTML = '<div class="bbc-head"><b>💬 ' + t('chat.title') + '</b><span class="bbc-who"></span><button type="button" class="bbc-x" data-bbc="close" aria-label="' + esc(t('common.close')) + '">' + ic('close', 20) + '</button></div>' +
      '<div class="bbc-list" role="log" aria-live="polite"></div>' +
      '<div class="bbc-quick">' + quick.map((k) => '<button type="button" class="bbc-chip" data-bbq="' + esc(t('chat.quick.' + k)) + '">' + esc(t('chat.quick.' + k)) + '</button>').join('') + '</div>' +
      '<div class="bbc-emo">' + EMOJI.map((e) => '<button type="button" class="bb-emo sm" data-bbe="' + e + '" aria-label="' + esc(t('chat.react', { emoji: e })) + '">' + e + '</button>').join('') + '</div>' +
      '<form class="bbc-form" autocomplete="off"><input class="bbc-in" maxlength="140" enterkeyhint="send" autocomplete="off" autocorrect="on" placeholder="' + esc(t('chat.placeholder')) + '" aria-label="' + esc(t('chat.placeholder')) + '"><button type="submit" class="bbc-send" aria-label="' + esc(t('chat.send')) + '">' + ic('chevR', 22) + '</button></form>';
    p.hidden = false;
    el.classList.add('chatting');
    p.querySelector('[data-bbc="close"]').addEventListener('click', () => { ui().sfx.tap(); closeChat(); });
    p.querySelectorAll('[data-bbq]').forEach((b) => b.addEventListener('click', () => { if (say(b.dataset.bbq)) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } }));
    const form = p.querySelector('.bbc-form'), inp = p.querySelector('.bbc-in');
    form.addEventListener('submit', (e) => { e.preventDefault(); if (say(inp.value)) inp.value = ''; });
    // keep the panel above the iPhone keyboard (the visual viewport shrinks when it opens)
    const vv = root.visualViewport;
    if (vv && !vvOff) {
      const fit = () => { if (el) el.style.setProperty('--kb', Math.max(0, Math.round(root.innerHeight - vv.height - vv.offsetTop)) + 'px'); };
      vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
      vvOff = () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); vvOff = null; if (el) el.style.removeProperty('--kb'); };
    }
    renderChat(true);
    refreshPill();
    const badge = el.querySelector('.bb-say .bb-unread');
    if (badge) badge.hidden = true;
    ui().sfx.pop();
  }
  function closeChat(silent) {
    if (vvOff) vvOff();
    clearTimeout(chatDraw); chatDraw = null;
    if (!el) { chatOpen = false; return; }
    const p = el.querySelector('.bb-chatp');
    if (p) { const i = p.querySelector('.bbc-in'); if (i) i.blur(); p.hidden = true; p.innerHTML = ''; }
    el.classList.remove('chatting');
    if (chatOpen) readId = lastId();
    chatOpen = false;
    if (!silent) refreshPill();
  }
  /* the open chat redraws at most every 120 ms, however fast messages come */
  let chatDraw = null;
  function renderChatSoon() { if (!chatDraw) chatDraw = setTimeout(() => { chatDraw = null; if (chatOpen && el) { readId = lastId(); renderChat(true); } }, 120); }
  function renderChat(toEnd) {
    const p = el && el.querySelector('.bb-chatp');
    if (!p || p.hidden) return;
    const list = p.querySelector('.bbc-list'), msgs = chatMsgs().filter((x) => x.t || okEmoji(x.e));
    const room = LV().chatRoom(), ppl = [room].concat(LV()[watchUid ? 'viewers' : 'watchers']().filter((u) => u !== room)).slice(0, 5);
    p.querySelector('.bbc-who').innerHTML = ppl.map((u) => FF.art.avatar(memberOf(u).avatar, 22)).join('');
    const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    list.innerHTML = msgs.length ? msgs.map(msgHtml).join('') : '<p class="bbc-empty">' + esc(watchUid ? t('chat.emptyWatcher', { name: memberOf(watchUid).name }) : t('chat.emptyPlayer')) + '</p>';
    if (toEnd || atEnd) list.scrollTop = list.scrollHeight;
  }
  function msgHtml(x) {
    const mine = isMine(x), m = memberOf(x.u), av = mine ? '' : FF.art.avatar(m.avatar, 26);
    if (x.e) return '<div class="bbm emo' + (mine ? ' mine' : '') + '">' + av + '<span class="bbm-e">' + x.e + '</span></div>';
    return '<div class="bbm' + (mine ? ' mine' : '') + '">' + av + '<div class="bbm-b">' + (mine ? '' : '<b>' + esc(m.name) + '</b>') + '<span>' + esc(x.t) + '</span></div></div>';
  }
  /* the player's own room starts clean each time the game screen opens */
  function chatReset() { const lv = LV(); if (lv && !watchUid) { lv.chatReset(); readId = ''; } }

  /* ===================================================== LIVE: WATCHING SOMEONE PLAY */
  function startWatch() {
    g = { board: new Array(N * N).fill(0), hand: [null, null, null], score: 0, combo: 0, moves: -1, over: false, watch: true };
    boardVer++;
    fx = []; parts = []; drag = null; overState = null; busy = false; unbanked = false; flight = null;
    shownScore = 0;
    layout();
    scoreEl.textContent = '0';
    requestAnimationFrame(() => el && el.classList.add('open'));
    ui().sfx.whoosh();
    showWait('join');
    const lv = LV();
    if (!lv || !lv.watch(watchUid, onWatched)) showWait('away');
    clearTimeout(joinTimer);
    joinTimer = setTimeout(() => { if (el && watchUid && g.moves < 0) showWait('away'); }, 7000); // nothing came: they're not really there
    draw();
  }
  function onWatched(raw) {
    if (!el || !watchUid) return;
    const s = B.unpack(raw);
    if (!s) { if (!(LV() && LV().isPlaying(watchUid)) && !g.over) showWait('away'); return; }
    if (waitKind) hideWait();
    replay(s);
  }
  /* a move arrived: if it follows on from what's on screen, play it (glide → land → break),
     otherwise just show where the game is now */
  function replay(s) {
    if (flight) land(); // the next move came before the last one landed: land that one now
    const prev = g;
    if (prev.moves >= 0 && s.moves < prev.moves) newRound(s);
    const l = s.last, next = l && prev.moves >= 0 && s.moves === prev.moves + 1 && prev.hand[l.slot] && prev.hand[l.slot].id === l.id;
    if (!next || reduced()) { show(s, prev, !!next); return; }
    const hand = prev.hand.slice(), pc = hand[l.slot];
    hand[l.slot] = null;
    g = Object.assign({}, prev, { hand });
    flight = { s, prev };
    fx.push({ k: 'fly', pc, slot: l.slot, r: l.r, c: l.c, t0: now(), dur: 300 });
    landTimer = setTimeout(land, 300);
    draw();
  }
  function land() {
    clearTimeout(landTimer);
    const f = flight;
    flight = null;
    fx = fx.filter((x) => x.k !== 'fly');
    if (f && el) show(f.s, f.prev, true);
  }
  /* put a game on screen; `played`: it's exactly one move on from `prev`, so show that move */
  function show(s, prev, played) {
    const t0 = now(), cell = L.cell;
    g = { board: s.board, hand: s.hand, score: s.score, combo: s.combo, moves: s.moves, over: s.over, watch: true };
    boardVer++;
    if (played && s.last) {
      const l = s.last, sh = B.SHAPES[l.id], before = prev.board.slice();
      const placed = sh.cells.map((q) => (l.r + q[0]) * N + l.c + q[1]);
      placed.forEach((i) => { before[i] = l.color; });
      const cleared = [];
      for (let i = 0; i < N * N; i++) if (before[i] && !s.board[i]) cleared.push({ i, color: before[i] });
      const stay = placed.filter((i) => s.board[i]);
      if (stay.length) fx.push({ k: 'pop', cells: stay, t0, dur: 170 });
      if (cleared.length) clearFx(cleared, l.r, l.c, Math.max(1, l.nl), s.combo, l.allClear, t0);
      else ui().sfx.bbDrop();
      if (s.score > prev.score) fx.push({ k: 'pts', n: s.score - prev.score, x: L.bx + (l.c + sh.cols / 2) * cell, y: L.by + (l.r + sh.rows / 2) * cell, t0: t0 + 40, dur: 750 });
    } else shownScore = s.score; // a jump, not a move: no counting up
    const key = (h) => h.map((p) => (p ? p.id + p.color : '-')).join();
    if (s.hand.every(Boolean) && key(s.hand) !== key(prev.hand) && (!played || prev.hand.filter(Boolean).length <= 1)) setTimeout(() => { if (el) dealFx(); }, played ? 200 : 0);
    if (s.over && !prev.over) theyFinished();
    draw();
  }
  /* they started again (or the game we had was an old one) */
  function newRound(s) {
    overState = null; busy = false;
    const box = el.querySelector('.bb-over'); box.classList.remove('show'); box.hidden = true; box.innerHTML = '';
    if (s.moves <= 1) fx.push({ k: 'word', text: t('bb.newGameThey', { name: memberOf(watchUid).name }), col: ['#FFFFFF', '#BFD3FF'], x: W / 2, y: L.by + L.bw * 0.42, size: L.cell * 0.6, t0: now() + 100, dur: 1600 });
  }
  function theyFinished() {
    busy = true;
    overState = { t0: now() };
    ui().sfx.bbOver();
    setTimeout(() => {
      if (!el || !watchUid || !g.over) return;
      const m = memberOf(watchUid), best = Math.max(S().bbOf(m).best || 0, g.score);
      const box = el.querySelector('.bb-over');
      box.innerHTML = '<div class="bb-card' + (g.score && g.score >= best ? ' best' : '') + '"><div class="bb-card-t">' + esc(t('bb.theyScored', { name: m.name })) + '</div>' +
        '<div class="bb-final num">' + num(g.score) + '</div><div class="bb-sub">👑 ' + t('bb.best', { n: num(best) }) + '</div>' + watchButtons() + '</div>';
      box.hidden = false;
      requestAnimationFrame(() => box.classList.add('show'));
    }, reduced() ? 200 : 1300);
  }
  /* what to do next, from a watching screen: someone else · my own game · back to the village */
  function watchButtons() {
    const others = livePlayers().filter((x) => x.uid !== watchUid).length;
    return (others ? '<button type="button" class="btn btn-sun btn-block btn-lg" data-bb="others">' + ic('eye', 20) + t('bb.watchOther') + '</button>' : '') +
      '<div class="bb-card-row"><button type="button" class="btn btn-soft" data-bb="playmine">🧩 ' + t('bb.playMine') + '</button><button type="button" class="btn btn-ghost bb-ghost" data-bb="quit">' + t('bb.toVillage') + '</button></div>';
  }
  function showWait(kind) {
    if (!el) return;
    waitKind = kind;
    const m = memberOf(watchUid), box = el.querySelector('.bb-wait');
    box.innerHTML = '<div class="bb-wait-card ' + kind + '">' + FF.art.avatar(m.avatar, 56) +
      '<b>' + esc(t(kind === 'join' ? 'bb.joining' : 'bb.away', { name: m.name })) + '</b>' +
      (kind === 'join' ? '<span class="bb-dots" aria-hidden="true"><i></i><i></i><i></i></span>' : '<span class="bb-wait-s">' + t('bb.awayB') + '</span>' + watchButtons()) + '</div>';
    box.hidden = false;
  }
  function hideWait() { waitKind = null; clearTimeout(joinTimer); const box = el && el.querySelector('.bb-wait'); if (box) { box.hidden = true; box.innerHTML = ''; } }

  /* ===================================================== CHOOSING: PLAY OR WATCH */
  /* the arcade: straight into your game — or, while family members are playing, a choice */
  function openArcade(o) { if (livePlayers().length) openPick({ from: o && o.from, arcade: true }); else open(o); }
  function openPick(o) {
    o = o || {};
    let off = null;
    ui().openSheet({
      className: 'bb-pick', label: t('bb.watchT'),
      render: () => {
        const list = livePlayers().filter((x) => x.uid !== watchUid), lv = LV();
        let h = '<div class="sheet-head"><span class="sh-spacer"></span><h2>🧩 ' + t('bb.name') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>';
        if (!el || watchUid) h += '<button type="button" class="btn btn-sun btn-block btn-lg" data-pick-play>▶ ' + t(hasSaved() ? 'bb.resume' : 'bb.playMine') + '</button>';
        h += '<h3 class="sub-h bb-pick-h"><span class="bb-live">' + t('bb.live') + '</span>' + t('bb.watchLead') + '</h3>';
        h += list.length ? '<div class="list-card bb-live-list">' + list.map((x) => {
          const m = memberOf(x.uid), mins = Math.max(0, Math.floor(((lv ? lv.now() : Date.now()) - x.at) / 60000));
          return '<button type="button" class="row bb-live-row" data-watch="' + esc(x.uid) + '">' + FF.art.avatar(m.avatar, 44) +
            '<span class="row-main"><span class="row-t">' + esc(m.name) + '</span><span class="row-s">' + (mins < 1 ? t('bb.justStarted') : t('bb.playingFor', { n: mins })) + '</span></span>' +
            '<span class="bb-watch-chip">' + ic('eye', 16) + t('bb.watchBtn') + '</span></button>';
        }).join('') + '</div>' : '<p class="muted center pad">' + t('bb.nobodyLive') + '</p>';
        return h;
      },
      onRender: (body, api) => {
        body.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', () => api.close()));
        const pl = body.querySelector('[data-pick-play]');
        if (pl) pl.addEventListener('click', () => { api.close(true); playMine(o.from); });
        body.querySelectorAll('[data-watch]').forEach((x) => x.addEventListener('click', () => { api.close(true); watchMember(x.dataset.watch, o.from); }));
        // the list follows who starts and stops playing while it's open
        if (!off) off = FF.on('live', (e) => { if (!document.body.contains(body)) { off(); off = null; } else if (e.k === 'on') api.render(); });
      }
    });
  }
  function watchMember(uid, from) {
    if (el && watchUid === uid) return;
    ui().sfx.tap();
    if (el) { close({ next: true }); open({ watch: uid }); } else open({ watch: uid, from });
  }
  function playMine(from) {
    if (el && !watchUid) return;
    if (el) { close({ next: true }); open({}); } else open({ from });
  }

  // a game in progress keeps its place if the app is closed or sent to the background — and
  // while the app is away you're neither "playing" nor "watching" for the family
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      save();
      const lv = LV();
      if (el && chatOpen) closeChat(true);
      if (lv && el) { if (watchUid) lv.unwatch(); else lv.quit(); }
    } else if (el) {
      if (watchUid) { const lv = LV(); if (lv) lv.watch(watchUid, onWatched); } else livePlay();
    }
  });

  // the page going away altogether (closed, reloaded): leave nothing behind for the family
  root.addEventListener('pagehide', () => { const lv = LV(); if (lv && el) { if (watchUid) lv.unwatch(); else lv.quit(); } });

  FF.blast = { open, close, openArcade, openPick, livePlayers, get isOpen() { return !!el; }, get watching() { return watchUid; }, hasSaved, openRanking, openChat, _fakeLive: (o) => { fakeLive = o; },
    _perf: { render: (tm) => render(tm || now()), get game() { return g; }, set game(v) { g = v; boardVer++; }, touch: () => { boardVer++; }, layout: () => L } };
})(window);
