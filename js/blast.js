/* ============================================================
   FamFi — blast.js
   Block Blast rules (no DOM — runs in the jsc tests):
   an 8×8 board, three pieces at a time, drag one onto the board
   where it fits (no rotating), fill a whole row or column to
   clear it. Clearing on moves close together builds a combo;
   emptying the whole board is an "all clear". The game ends
   when none of the pieces left in hand fits anywhere.
   Every hand dealt is FAIR: some order and spots place all
   three pieces (counting the lines cleared on the way), so a
   new hand is never a game over you couldn't have avoided.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const N = 8;
  const COLORS = 7; // 1…7 (0 = empty)

  /* every piece, as [row, col] cells — rotations are separate pieces, like the original */
  const raw = {
    o1: ['#'],
    i2h: ['##'], i2v: ['#', '#'], i3h: ['###'], i3v: ['#', '#', '#'], i4h: ['####'], i4v: ['#', '#', '#', '#'], i5h: ['#####'], i5v: ['#', '#', '#', '#', '#'],
    o2: ['##', '##'], o3: ['###', '###', '###'], r23: ['###', '###'], r32: ['##', '##', '##'],
    c3a: ['##', '#.'], c3b: ['##', '.#'], c3c: ['#.', '##'], c3d: ['.#', '##'],
    l4a: ['#.', '#.', '##'], l4b: ['.#', '.#', '##'], l4c: ['##', '#.', '#.'], l4d: ['##', '.#', '.#'],
    l4e: ['###', '#..'], l4f: ['###', '..#'], l4g: ['#..', '###'], l4h: ['..#', '###'],
    t4a: ['###', '.#.'], t4b: ['.#.', '###'], t4c: ['#.', '##', '#.'], t4d: ['.#', '##', '.#'],
    s4a: ['.##', '##.'], s4b: ['##.', '.##'], s4c: ['#.', '##', '.#'], s4d: ['.#', '##', '#.'],
    c5a: ['#..', '#..', '###'], c5b: ['..#', '..#', '###'], c5c: ['###', '#..', '#..'], c5d: ['###', '..#', '..#']
  };
  const SHAPES = {};
  Object.keys(raw).forEach((id) => {
    const cells = [];
    raw[id].forEach((row, r) => row.split('').forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
    SHAPES[id] = { id, cells, rows: raw[id].length, cols: raw[id][0].length };
  });
  /* how often each family of piece comes up (big ones are rarer) */
  const WEIGHT = { o1: 3, i2: 6, i3: 6, i4: 4, i5: 2, o2: 6, o3: 2, r2: 3, c3: 5, l4: 3, t4: 3, s4: 2, c5: 2 };
  const famOf = (id) => (id[0] === 'i' ? id.slice(0, 2) : id[0] === 'r' ? 'r2' : id.replace(/[a-h]$/, ''));
  const POOL = [];
  Object.keys(SHAPES).forEach((id) => {
    const fam = famOf(id), n = Object.keys(SHAPES).filter((x) => famOf(x) === fam).length;
    POOL.push({ id, w: WEIGHT[fam] / n });
  });
  const POOL_W = POOL.reduce((a, x) => a + x.w, 0);

  /* ---------- the board ---------- */
  const at = (b, r, c) => b[r * N + c];
  function fits(b, shape, r, c) {
    const s = typeof shape === 'string' ? SHAPES[shape] : shape;
    if (r < 0 || c < 0 || r + s.rows > N || c + s.cols > N) return false;
    for (let k = 0; k < s.cells.length; k++) if (b[(r + s.cells[k][0]) * N + c + s.cells[k][1]]) return false;
    return true;
  }
  function spots(b, shape) {
    const s = SHAPES[shape], out = [];
    for (let r = 0; r <= N - s.rows; r++) for (let c = 0; c <= N - s.cols; c++) if (fits(b, s, r, c)) out.push([r, c]);
    return out;
  }
  const canPlace = (b, shape) => spots(b, shape).length > 0;
  /* the rows and columns that would be full with this piece placed at r, c */
  function wouldClear(b, shape, r, c) {
    const s = SHAPES[shape], t = b.slice();
    s.cells.forEach((q) => { t[(r + q[0]) * N + c + q[1]] = 1; });
    return fullLines(t);
  }
  function fullLines(b) {
    const rows = [], cols = [];
    for (let r = 0; r < N; r++) { let f = true; for (let c = 0; c < N; c++) if (!b[r * N + c]) { f = false; break; } if (f) rows.push(r); }
    for (let c = 0; c < N; c++) { let f = true; for (let r = 0; r < N; r++) if (!b[r * N + c]) { f = false; break; } if (f) cols.push(c); }
    return { rows, cols };
  }

  /* ---------- fair hands ----------
     The board as two 32-bit halves (rows 0–3 and rows 4–7), so "does it fit here" is two ANDs
     and a whole hand can be checked in well under a millisecond. Each piece knows the mask of
     every spot it could take (s.mask, pairs of lo/hi) and where that is (s.at, pairs of r/c). */
  const ROWM = [0, 1, 2, 3].map((r) => (0xFF << (r * 8)) | 0);
  const COLM = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => (0x01010101 << c) | 0);
  Object.keys(SHAPES).forEach((id) => {
    const s = SHAPES[id], mask = [], spot = [];
    for (let r = 0; r <= N - s.rows; r++) for (let c = 0; c <= N - s.cols; c++) {
      let lo = 0, hi = 0;
      s.cells.forEach((q) => { const i = (r + q[0]) * N + c + q[1]; if (i < 32) lo |= 1 << i; else hi |= 1 << (i - 32); });
      mask.push(lo, hi); spot.push(r, c);
    }
    s.mask = Int32Array.from(mask); s.at = spot;
  });
  let bLo = 0, bHi = 0; // results of bits() and settle() (no garbage in the inner loop)
  function bits(b) { bLo = 0; bHi = 0; for (let i = 0; i < 32; i++) { if (b[i]) bLo |= 1 << i; if (b[i + 32]) bHi |= 1 << i; } }
  /* clear every full row and column, exactly like place() does */
  function settle(lo, hi) {
    let kl = 0, kh = 0;
    for (let r = 0; r < 4; r++) { const m = ROWM[r]; if ((lo & m) === m) kl |= m; if ((hi & m) === m) kh |= m; }
    for (let c = 0; c < N; c++) { const m = COLM[c]; if ((lo & m) === m && (hi & m) === m) { kl |= m; kh |= m; } }
    bLo = lo & ~kl; bHi = hi & ~kh;
  }
  const fitsSomewhere = (lo, hi, m) => { for (let i = 0; i < m.length; i += 2) if ((lo & m[i]) === 0 && (hi & m[i + 1]) === 0) return true; return false; };
  /* depth-first: try each piece still in hand (the same shape only once) on each free spot,
     clear lines, carry on with the rest. `budget.n` counts spots looked at; past 0 it gives up */
  function search(lo, hi, ids, left, path, budget) {
    for (let k = 0; k < ids.length; k++) {
      if (!(left & (1 << k))) continue;
      const id = ids[k];
      let dup = false;
      for (let j = 0; j < k; j++) if ((left & (1 << j)) && ids[j] === id) { dup = true; break; }
      if (dup) continue;
      const rest = left & ~(1 << k), m = SHAPES[id].mask;
      for (let i = 0; i < m.length; i += 2) {
        if (--budget.n < 0) return false;
        const a = m[i], b = m[i + 1];
        if ((lo & a) !== 0 || (hi & b) !== 0) continue;
        path.push(k, i >> 1);
        if (!rest) return true;
        settle(lo | a, hi | b);
        if (search(bLo, bHi, ids, rest, path, budget)) return true;
        path.length -= 2;
        if (budget.n < 0) return false;
      }
    }
    return false;
  }
  /* one way to place every piece in `hand` (ids, or hand objects; empty slots skipped):
     [[slot, r, c], …] in the order to play them — or null if there's no way (or the budget ran out) */
  function solve(board, hand, budget) {
    const ids = hand.map((x) => (x && typeof x === 'object' ? x.id : x));
    let left = 0;
    ids.forEach((id, k) => { if (id) left |= 1 << k; });
    if (!left) return [];
    bits(board);
    const path = [];
    if (!search(bLo, bHi, ids, left, path, budget || { n: Infinity })) return null;
    const out = [];
    for (let k = 0; k < path.length; k += 2) { const at = SHAPES[ids[path[k]]].at, i = path[k + 1] * 2; out.push([path[k], at[i], at[i + 1]]); }
    return out;
  }

  /* ---------- scoring ---------- */
  const LINE_PTS = [0, 10, 30, 60, 100, 150, 210, 280, 360]; // 1, 2, 3 … lines cleared at once
  const ALL_CLEAR = 300;
  const COMBO_KEEP = 3; // the combo survives up to 2 placements without a clear (3 in a row ends it)
  const PRAISE = ['', 'good', 'great', 'excellent', 'amazing', 'unbelievable'];

  /* ---------- a game ---------- */
  function newGame(rng) {
    const g = { board: new Array(N * N).fill(0), hand: [null, null, null], score: 0, combo: 0, miss: 0, moves: 0, clears: 0, over: false };
    deal(g, rng || Math.random);
    return g;
  }
  function pick(rng) {
    let x = rng() * POOL_W;
    for (let k = 0; k < POOL.length; k++) { x -= POOL[k].w; if (x <= 0) return POOL[k].id; }
    return POOL[POOL.length - 1].id;
  }
  const filled = (b) => b.reduce((a, v) => a + (v ? 1 : 0), 0);
  /* a random piece; a crowded board re-rolls some of the big ones */
  function pickFor(crowd, rng) {
    const id = pick(rng);
    return crowd > 0.5 && SHAPES[id].cells.length >= 5 && rng() < (crowd - 0.4) * 1.6 ? pick(rng) : id;
  }
  /* the fallback that can't fail: each piece is chosen among those that fit after the ones before
     it have gone down (and their lines cleared). A single block always fits — once full lines
     clear, every row still has a gap — so three choices always exist. */
  function fairHand(board, crowd, rng) {
    bits(board);
    let lo = bLo, hi = bHi;
    const out = [];
    for (let k = 0; k < 3; k++) {
      const opts = [];
      let tot = 0;
      POOL.forEach((p) => {
        const s = SHAPES[p.id];
        if (!fitsSomewhere(lo, hi, s.mask)) return;
        const w = crowd > 0.5 && s.cells.length >= 5 ? p.w * 0.4 : p.w;
        opts.push(p.id, w); tot += w;
      });
      let id = opts.length ? opts[opts.length - 2] : 'o1';
      let x = rng() * tot;
      for (let i = 0; i < opts.length; i += 2) { x -= opts[i + 1]; if (x <= 0) { id = opts[i]; break; } }
      const m = SHAPES[id].mask, free = [];
      for (let i = 0; i < m.length; i += 2) if ((lo & m[i]) === 0 && (hi & m[i + 1]) === 0) free.push(i);
      if (free.length) { const i = free[Math.floor(rng() * free.length)]; settle(lo | m[i], hi | m[i + 1]); lo = bLo; hi = bHi; }
      out.push(id);
    }
    for (let i = 2; i > 0; i--) { const j = Math.floor(rng() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; } // not always in play order
    return out;
  }
  /* three new pieces — always a fair hand: some order and spots place all three, counting the
     lines cleared on the way, so a deal is never a game over you couldn't avoid. Otherwise it's
     random like the original: big pieces are rarer (more so on a crowded board), and a crowded
     board prefers hands where two pieces fit straight away. The checking has a fixed budget
     (a few ms at most on a phone); if random hands keep failing, fairHand() builds one. */
  const DEAL_TRIES = 40, DEAL_WORK = 250000;
  function deal(g, rng) {
    rng = rng || Math.random;
    const crowd = filled(g.board) / (N * N);
    const budget = { n: DEAL_WORK };
    let hand = null, spare = null;
    for (let tries = 0; tries < DEAL_TRIES && budget.n > 0 && !hand; tries++) {
      const h = [pickFor(crowd, rng), pickFor(crowd, rng), pickFor(crowd, rng)];
      if (!solve(g.board, h, budget)) continue; // no way to place all three (or out of budget): not this one
      if (crowd <= 0.55 || h.filter((id) => canPlace(g.board, id)).length >= 2) hand = h;
      else if (!spare) spare = h;
    }
    hand = hand || spare || fairHand(g.board, crowd, rng);
    g.hand = hand.map((id) => ({ id, color: 1 + Math.floor(rng() * COLORS) }));
    g.over = !g.hand.some((p) => canPlace(g.board, p.id));
    return g.hand;
  }
  /* place hand[slot] at r, c. Returns what happened (for the animations), or null if it can't go there */
  function place(g, slot, r, c, rng) {
    const p = g.hand[slot];
    if (!p || g.over || !fits(g.board, p.id, r, c)) return null;
    const s = SHAPES[p.id];
    s.cells.forEach((q) => { g.board[(r + q[0]) * N + c + q[1]] = p.color; });
    g.hand[slot] = null;
    g.moves++;
    let pts = s.cells.length;
    const lines = fullLines(g.board), nl = lines.rows.length + lines.cols.length;
    const cleared = [];
    if (nl) {
      const kill = {};
      lines.rows.forEach((rr) => { for (let cc = 0; cc < N; cc++) kill[rr * N + cc] = 1; });
      lines.cols.forEach((cc) => { for (let rr = 0; rr < N; rr++) kill[rr * N + cc] = 1; });
      Object.keys(kill).forEach((i) => { cleared.push({ i: +i, color: g.board[i] }); g.board[i] = 0; });
      g.combo++;
      g.miss = 0;
      g.clears += nl;
      pts += LINE_PTS[Math.min(nl, LINE_PTS.length - 1)] * g.combo;
    } else {
      g.miss++;
      if (g.miss >= COMBO_KEEP) g.combo = 0;
    }
    const allClear = nl > 0 && filled(g.board) === 0;
    if (allClear) pts += ALL_CLEAR;
    g.score += pts;
    let dealt = false;
    if (g.hand.every((x) => !x)) { deal(g, rng); dealt = true; }
    g.over = !g.hand.some((x) => x && canPlace(g.board, x.id));
    return { slot, r, c, piece: p, pts, lines, nl, cleared, combo: g.combo, allClear, dealt, over: g.over, praise: PRAISE[Math.min(nl, PRAISE.length - 1)] };
  }
  /* ---------- a game as a tiny message, for family members watching live ----------
     b: the 64 cells as digits (0 empty, 1–7 colours) · h: the hand as "id.colour", "-" for a used
     slot · s score · c combo · m moves · o over · l: the move that led here (slot, piece, spot,
     colour, lines cleared, all clear) so the watcher's screen can replay it. ~150 bytes. */
  function pack(g, last) {
    const o = { b: g.board.join(''), h: g.hand.map((p) => (p ? p.id + '.' + p.color : '-')).join(','), s: g.score, c: g.combo, m: g.moves, o: !!g.over };
    if (last && last.piece) o.l = { j: last.slot, i: last.piece.id, r: last.r, c: last.c, k: last.piece.color, n: last.nl || 0, a: !!last.allClear };
    return o;
  }
  /* …and back again, trusting nothing (it came from another phone) */
  function unpack(o) {
    if (!o || typeof o.b !== 'string' || o.b.length !== N * N || typeof o.h !== 'string') return null;
    const board = [];
    for (let i = 0; i < N * N; i++) { const v = o.b.charCodeAt(i) - 48; board.push(v >= 0 && v <= COLORS ? v : 0); }
    const hs = o.h.split(',');
    if (hs.length !== 3) return null;
    const hand = hs.map((x) => { const p = x.split('.'); return SHAPES[p[0]] ? { id: p[0], color: FF.clamp(parseInt(p[1], 10) || 1, 1, COLORS) } : null; });
    const whole = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0);
    const out = { board, hand, score: whole(o.s), combo: whole(o.c), moves: whole(o.m), over: o.o === true, at: whole(o.at), last: null };
    const l = o.l, sh = l && SHAPES[l.i];
    if (sh && [0, 1, 2].indexOf(l.j) !== -1 && l.r >= 0 && l.c >= 0 && l.r + sh.rows <= N && l.c + sh.cols <= N) {
      out.last = { slot: l.j, id: l.i, r: l.r | 0, c: l.c | 0, color: FF.clamp(l.k | 0, 1, COLORS), nl: Math.min(whole(l.n), 2 * N), allClear: l.a === true };
    }
    return out;
  }
  const praiseFor = (nl) => PRAISE[Math.min(nl, PRAISE.length - 1)];

  /* a game saved to the phone, checked before it's trusted */
  function restore(o) {
    if (!o || !Array.isArray(o.board) || o.board.length !== N * N || !Array.isArray(o.hand) || o.hand.length !== 3) return null;
    if (o.hand.some((p) => p && !SHAPES[p.id])) return null;
    const g = { board: o.board.map((v) => (v >= 0 && v <= COLORS ? v | 0 : 0)), hand: o.hand.map((p) => (p ? { id: p.id, color: FF.clamp(p.color | 0, 1, COLORS) } : null)), score: Math.max(0, o.score | 0), combo: o.combo | 0, miss: o.miss | 0, moves: o.moves | 0, clears: o.clears | 0, over: false };
    if (g.hand.every((x) => !x)) deal(g);
    // a whole hand that can't all go down was dealt before hands were checked: swap it for a fair one
    else if (g.hand.every((x) => x) && !solve(g.board, g.hand)) deal(g);
    g.over = !g.hand.some((x) => x && canPlace(g.board, x.id));
    return g;
  }

  FF.blastCore = { N, COLORS, SHAPES, POOL, LINE_PTS, ALL_CLEAR, COMBO_KEEP, DEAL_WORK, at, fits, spots, canPlace, wouldClear, fullLines, solve, fairHand, newGame, deal, place, restore, filled, pack, unpack, praiseFor };
})(typeof window !== 'undefined' ? window : this);
