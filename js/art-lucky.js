/* ============================================================
   FamFi — art-lucky.js
   Art for the Lucky Market (lucky.js): the market building, the
   eggs, seed packets and bag items, eight hatchable pets in three
   forms each, plants from seed to bloom (seven kinds), the pond's
   fish and three exclusive decorations.

   Everything here is a still picture: in the village a pet or a
   plant costs nothing while you look at it (no drawn-in
   animations that the phone would repaint every frame). Rarity
   shows in the art — a legendary pet or plant glows.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const A = FF.art;
  const P = (h) => A.P(h);
  const f1 = (n) => Math.round(n * 10) / 10;
  const circ = (x, y, r, fill, extra) => '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(r) + '" fill="' + fill + '"' + (extra || '') + '/>';
  const ell = (x, y, rx, ry, fill, extra) => '<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(rx) + '" ry="' + f1(ry) + '" fill="' + fill + '"' + (extra || '') + '/>';
  const path = (d, fill, extra) => '<path d="' + d + '" fill="' + fill + '"' + (extra || '') + '/>';
  const rect = (x, y, w, h, rx, fill, extra) => '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="' + rx + '" fill="' + fill + '"' + (extra || '') + '/>';
  const pts = (arr) => arr.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ');
  const poly = (arr, fill, stroke, sw, extra) => '<polygon points="' + pts(arr) + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 1) + '" stroke-linejoin="round"' : '') + (extra || '') + '/>';
  const stroke = (c, w) => ' stroke="' + c + '" stroke-width="' + (w || 0.8) + '"';
  const line = (d, c, w) => path(d, 'none', ' stroke="' + c + '" stroke-width="' + (w || 1) + '" fill="none" stroke-linecap="round" stroke-linejoin="round"');
  const svg = (inner, w, h, cls, size) => '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 ' + w + ' ' + h + '" width="' + (size ? f1(size * w / Math.max(w, h)) : w) + '" height="' + (size ? f1(size * h / Math.max(w, h)) : h) + '" aria-hidden="true">' + inner + '</svg>';
  const eye = (x, y, r) => circ(x, y, r || 1.6, '#2B2A26') + circ(x + (r || 1.6) * 0.35, y - (r || 1.6) * 0.38, (r || 1.6) * 0.38, '#FFFFFF');
  const blush = (x, y, r) => ell(x, y, r || 2, (r || 2) * 0.62, '#FF8FA8', ' opacity=".55"');
  const star = (x, y, r, fill) => path('M' + f1(x) + ' ' + f1(y - r) + 'l' + f1(r * 0.3) + ' ' + f1(r * 0.7) + ' ' + f1(r * 0.7) + ' ' + f1(r * 0.3) + '-' + f1(r * 0.7) + ' ' + f1(r * 0.3) + '-' + f1(r * 0.3) + ' ' + f1(r * 0.7) + '-' + f1(r * 0.3) + '-' + f1(r * 0.7) + '-' + f1(r * 0.7) + '-' + f1(r * 0.3) + ' ' + f1(r * 0.7) + '-' + f1(r * 0.3) + 'z', fill);
  const TIER_GLOW = { common: null, rare: '#7FC8FF', epic: '#C79BFF', legendary: '#FFD45A' };

  /* =========================================================
     THE MARKET — a little iso shop with a striped awning, crates
     of eggs and seed packets and a four-leaf-clover sign
     ========================================================= */
  function market() {
    const cx = 100, cy = 168, W = 60, Hh = 30, wh = 46;
    const L0 = [cx - W, cy], F0 = [cx, cy + Hh], R0 = [cx + W, cy], B0 = [cx, cy - Hh];
    const up = (p, t) => [p[0], p[1] - t];
    const lf = (s, t) => [cx - W + s, cy + s * 0.5 - t];           // along the left (front-left) wall
    const rf = (s, t) => [cx + s, cy + Hh - s * 0.5 - t];          // along the right (front-right) wall
    const ln = P('#5A3A22');
    let s = ell(cx + 10, cy + 16, W + 40, Hh + 22, 'url(#ff-shadow)');
    // a little cobbled forecourt
    s += poly([[cx - W - 24, cy + 4], [cx, cy + Hh + 16], [cx + W + 24, cy + 4], [cx, cy - Hh - 10]], P('#D9C9A8'), P('#B9A47E'), 1);
    for (let k = 0; k < 9; k++) { const u = (k % 3 - 1) * 0.32, v = (Math.floor(k / 3) - 1) * 0.32; s += ell(cx + (u - v) * (W + 18), cy + 4 + (u + v) * (Hh + 10), 6, 3, P('#CDBB96'), ' opacity=".8"'); }
    // walls: warm wood planks
    s += poly([L0, F0, up(F0, wh), up(L0, wh)], P('#E8B27A'), ln, 1.2);
    s += poly([F0, R0, up(R0, wh), up(F0, wh)], P('#D29A62'), ln, 1.2);
    for (let k = 1; k < 4; k++) { s += line('M' + pts([lf(0, wh * k / 4), lf(W, wh * k / 4)]).replace(' ', 'L'), P('#C98E55'), 0.8); s += line('M' + pts([rf(0, wh * k / 4), rf(W, wh * k / 4)]).replace(' ', 'L'), P('#B97E48'), 0.8); }
    // left wall: a round window with a clover
    const wc = lf(W * 0.5, wh * 0.56);
    s += ell(wc[0], wc[1], 11, 12, P('#FFF4D6'), stroke(ln, 1.2)) + ell(wc[0], wc[1], 8, 9, P('#BFE9F7'));
    [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]].forEach((d) => { s += circ(wc[0] + d[0], wc[1] + d[1], 2.8, P('#4DB25A')); });
    s += line('M' + f1(wc[0]) + ' ' + f1(wc[1] + 2) + 'q1 4 3 6', P('#2F8A3F'), 1);
    // right wall: the counter, open to the street
    s += poly([rf(6, 6), rf(54, 6), rf(54, 30), rf(6, 30)], P('#6B3F22'));
    s += poly([rf(4, 6), rf(56, 6), rf(56, 11), rf(4, 11)], P('#F2C48B'), ln, 1);
    // on the counter: a basket of eggs, seed packets, a jar
    const bk = rf(16, 12);
    s += ell(bk[0], bk[1] + 1, 8, 3.6, P('#B07A45')) + ell(bk[0] - 3, bk[1] - 2.4, 2.6, 3.2, P('#FFF6E6'), stroke(P('#E8D7B8'), 0.5)) + ell(bk[0] + 2.4, bk[1] - 2.8, 2.6, 3.2, P('#FFE27A'), stroke(P('#E0B93A'), 0.5)) + ell(bk[0] - 0.2, bk[1] - 4.6, 2.4, 3, P('#BFE3FF'), stroke(P('#8FC0E8'), 0.5));
    const sp = rf(32, 13);
    s += poly([[sp[0] - 4, sp[1] + 2], [sp[0] + 2, sp[1] - 1], [sp[0] + 2, sp[1] - 11], [sp[0] - 4, sp[1] - 8]], P('#C9A66A'), ln, 0.6) + circ(sp[0] - 1, sp[1] - 5, 1.6, P('#4DB25A'));
    s += poly([[sp[0] + 3, sp[1] - 1], [sp[0] + 9, sp[1] - 4], [sp[0] + 9, sp[1] - 14], [sp[0] + 3, sp[1] - 11]], P('#9E7BE0'), ln, 0.6) + star(sp[0] + 6, sp[1] - 8, 2, P('#FFE27A'));
    const jr = rf(46, 13);
    s += rect(jr[0] - 3.4, jr[1] - 9, 6.8, 9, 2, P('#9FE3D6'), stroke(P('#5BAE9E'), 0.6)) + rect(jr[0] - 3.6, jr[1] - 10.6, 7.2, 2, 1, P('#E0463A'));
    // the striped awning over the counter
    const a0 = rf(0, wh + 2), a1 = rf(W, wh + 2), a2 = rf(W + 6, wh - 14), a3 = rf(-4, wh - 14);
    const stripes = 6;
    for (let k = 0; k < stripes; k++) {
      const t0 = k / stripes, t1 = (k + 1) / stripes, mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      s += poly([mix(a0, a1, t0), mix(a0, a1, t1), mix(a3, a2, t1), mix(a3, a2, t0)], P(k % 2 ? '#FFFFFF' : '#3FA65A'));
    }
    s += poly([a0, a1, a2, a3], 'none', ln, 1.1);
    for (let k = 0; k <= stripes; k++) { const t = k / stripes, p = [a3[0] + (a2[0] - a3[0]) * t, a3[1] + (a2[1] - a3[1]) * t]; s += path('M' + f1(p[0] - 4) + ' ' + f1(p[1]) + 'a4 4 0 0 0 8 0', P(k % 2 ? '#FFFFFF' : '#3FA65A'), stroke(ln, 0.6)); }
    // roof
    const k = 1.07, C = [cx, cy - wh];
    const sc = (p) => [C[0] + (p[0] - C[0]) * k, C[1] + (p[1] - C[1]) * k];
    const Lr = sc(up(L0, wh)), Fr = sc(up(F0, wh)), Rr = sc(up(R0, wh)), Br = sc(up(B0, wh));
    s += poly([Lr, Fr, Rr, Br], P('#E0563F'), ln, 1.2) + poly([Lr, Fr, up(Fr, 5), up(Lr, 5)], P('#F07A5E'), ln, 1) + poly([Fr, Rr, up(Rr, 5), up(Fr, 5)], P('#C9452F'), ln, 1);
    // the sign: a big four-leaf clover on a gold ring
    const sx = cx - 8, sy = cy - wh - 52;
    s += line('M' + f1(sx) + ' ' + f1(sy + 24) + 'L' + f1(sx) + ' ' + f1(cy - wh - 4), P('#5A3A22'), 3);
    s += circ(sx, sy, 24, P('#FFD45A'), stroke(P('#C98A12'), 2)) + circ(sx, sy, 19.5, P('#2F8A3F'));
    [[-6, -6, -45], [6, -6, 45], [-6, 6, 45], [6, 6, -45]].forEach((d) => { s += '<g transform="rotate(' + d[2] + ' ' + f1(sx + d[0]) + ' ' + f1(sy + d[1]) + ')">' + ell(sx + d[0], sy + d[1], 7.4, 6, P('#7BD36B')) + '</g>'; });
    s += circ(sx, sy, 2.6, P('#FFD45A')) + line('M' + f1(sx + 1) + ' ' + f1(sy + 3) + 'q3 7 8 10', P('#7BD36B'), 2);
    s += star(sx + 15, sy - 15, 3, '#FFFFFF') + star(sx - 16, sy + 13, 2.2, '#FFF6C2');
    // a lantern on the corner
    const lp = up(F0, wh - 4);
    s += line('M' + f1(lp[0] + 4) + ' ' + f1(lp[1]) + 'v6', P('#3D3A36'), 1) + ell(lp[0] + 4, lp[1] + 11, 4.4, 5.4, P(A.night ? '#FFB23D' : '#F07A3C'), stroke(P('#A8481E'), 0.7));
    if (A.night) s += circ(lp[0] + 4, lp[1] + 11, 11, 'url(#ff-glow)', ' opacity=".9"');
    const w = 200, h = 214;
    return { svg: svg(s, w, h, 'lucky-svg'), w, h, ax: cx, ay: cy, sign: [sx - 24, sy - 24, 48, 48] };
  }

  /* =========================================================
     ITEMS — eggs, seed packets and the bag (48×48)
     ========================================================= */
  const ITEM = {
    egg: () => ell(24, 27, 13, 16, '#FFF6E6', stroke('#E2CFAE', 1)) + ell(18, 21, 3, 2.2, '#8FD3A8') + ell(29, 30, 3.6, 2.6, '#7FC8FF') + ell(21, 36, 2.4, 1.8, '#FFB3C7') + ell(30, 18, 2, 1.5, '#FFD45A') + ell(18.6, 18, 2.4, 4.4, '#FFFFFF', ' opacity=".7" transform="rotate(-20 18.6 18)"'),
    goldegg: () => circ(24, 27, 21, '#FFE9A8', ' opacity=".55"') + ell(24, 27, 13, 16, '#FFC93D', stroke('#C98A12', 1.2)) + path('M12 25q6-4 12 0t12 0', 'none', stroke('#E8A21A', 1.6)) + path('M12 31q6-4 12 0t12 0', 'none', stroke('#FFE27A', 1.4)) + ell(18.6, 18, 2.4, 4.4, '#FFFFFF', ' opacity=".8" transform="rotate(-20 18.6 18)"') + star(35, 12, 3.4, '#FFFFFF') + star(11, 38, 2.4, '#FFFFFF'),
    seed: () => rect(11, 9, 26, 32, 3, '#E9D3A8', stroke('#B48A52', 1)) + rect(11, 9, 26, 6, 2, '#C9A66A') + ell(24, 33, 7, 2, '#8A5A33') + line('M24 33v-9', '#3E9B55', 1.6) + ell(20.4, 25, 3.6, 2, '#5DBB6A', ' transform="rotate(-25 20.4 25)"') + ell(27.6, 23, 3.6, 2, '#5DBB6A', ' transform="rotate(25 27.6 23)"'),
    rareseed: () => circ(24, 25, 21, '#E6D6FF', ' opacity=".6"') + rect(11, 9, 26, 32, 3, '#9E7BE0', stroke('#6B4BB8', 1)) + rect(11, 9, 26, 6, 2, '#7B58C8') + ell(24, 33, 7, 2, '#6B4BB8') + line('M24 33v-9', '#BFF0C8', 1.6) + ell(20.4, 25, 3.6, 2, '#D6FFE0', ' transform="rotate(-25 20.4 25)"') + ell(27.6, 23, 3.6, 2, '#D6FFE0', ' transform="rotate(25 27.6 23)"') + star(31, 17, 3, '#FFE27A') + star(16, 37, 2, '#FFFFFF'),
    molotov: () => path('M19 20h10v4c4 2 6 6 6 11v6a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3v-6c0-5 2-9 6-11z', '#5DAA6A', stroke('#2F6A3A', 1)) + rect(18.6, 15, 10.8, 6, 1.4, '#3E7D48') + path('M14 33h20v6H14z', '#E8DCC4', ' opacity=".85"') + path('M21 15c-2-3 0-6 3-6s5 3 3 6', '#E9D3A8', stroke('#B48A52', 0.8)) +
      path('M24 9c-4-3-2-7 1-8-1 3 3 3 2 6 2-1 3-3 2-5 3 3 2 8-2 9-1 0-2-1-3-2z', '#FF8A3C') + path('M24.6 8.4c-1.6-1.4-.8-3.4.6-4 0 1.6 1.6 1.6 1 3.4z', '#FFD45A') + ell(17.6, 30, 1.6, 4, '#FFFFFF', ' opacity=".35"'),
    tonic: () => path('M20 10h8v8c6 2 10 7 10 13a14 14 0 0 1-28 0c0-6 4-11 10-13z', '#D9F2FF', stroke('#6FA8C8', 1)) + path('M11.4 31a12.6 12.6 0 0 0 25.2 0c0-2-.4-3-1-4H12.4c-.6 1-1 2-1 4z', '#4DC38A') + rect(18.6, 7, 10.8, 4, 1.4, '#B07A45') +
      ell(24, 31, 5, 3, '#2F9A62', ' opacity=".5"') + path('M24 34c-3-3-1-8 4-8 0 4-2 7-4 8z', '#BFF0C8') + ell(17, 22, 1.6, 4, '#FFFFFF', ' opacity=".6"') + circ(30, 36, 1.2, '#FFFFFF', ' opacity=".8"') + circ(19, 38, 0.9, '#FFFFFF', ' opacity=".8"'),
    treat: () => path('M10 20a5 5 0 1 1 7-4h14a5 5 0 1 1 7 4 5 5 0 1 1-7 4H17a5 5 0 1 1-7-4z', '#F0C58A', stroke('#B98345', 1)) + circ(19, 20, 1.2, '#B98345') + circ(24, 18.4, 1.2, '#B98345') + circ(29, 20, 1.2, '#B98345') +
      path('M14 30h20l-2 10H16z', '#FF8FA8', stroke('#D9587A', 1)) + path('M14 30h20', 'none', stroke('#FFFFFF', 1.4)) + circ(24, 35, 2, '#FFFFFF', ' opacity=".7"')
  };
  const itemArt = (id, size) => svg(ITEM[id] ? ITEM[id]() : '', 48, 48, 'lk-item', size || 48);

  /* =========================================================
     PETS — sitting, facing you, 48×48 (feet ≈ y44). Three forms:
     0 baby · 1 grown (an accessory) · 2 majestic (a crown, a glow
     and — for the rare ones — more tails, wings or flames)
     ========================================================= */
  const aura = (c, r) => circ(24, 27, r || 22, c, ' opacity=".22"') + circ(24, 27, (r || 22) * 0.74, c, ' opacity=".22"');
  const crown = (x, y, s) => { s = s || 1; return path('M' + f1(x - 6 * s) + ' ' + f1(y) + 'l' + f1(-1 * s) + ' ' + f1(-6 * s) + ' ' + f1(4 * s) + ' ' + f1(3 * s) + ' ' + f1(3 * s) + ' ' + f1(-5 * s) + ' ' + f1(3 * s) + ' ' + f1(5 * s) + ' ' + f1(4 * s) + ' ' + f1(-3 * s) + ' ' + f1(-1 * s) + ' ' + f1(6 * s) + 'z', '#FFD45A', stroke('#C98A12', 0.7)) + circ(x, y - 2.4 * s, 1.1 * s, '#E0463A') + circ(x - 4 * s, y - 1.6 * s, 0.7 * s, '#7FC8FF') + circ(x + 4 * s, y - 1.6 * s, 0.7 * s, '#7FC8FF'); };
  const bandana = (x, y, c) => path('M' + f1(x - 8) + ' ' + f1(y - 1.6) + 'q8 3 16 0l-1.4 2.6q-6.6 2-13.2 0z', c, stroke(A.shade(c, 0.7), 0.5)) + path('M' + f1(x - 2) + ' ' + f1(y + 1) + 'l2 5.4 2-5.4z', c, stroke(A.shade(c, 0.7), 0.5));
  const sparkles = (c) => star(8, 12, 2.2, c || '#FFFFFF') + star(41, 16, 1.8, c || '#FFFFFF') + star(39, 40, 1.6, c || '#FFFFFF') + star(7, 36, 1.4, c || '#FFFFFF');
  const ground = () => ell(24, 44.6, 12, 2.6, 'rgba(30,40,10,.22)');
  const PETS = {
    chick: (f) => {
      let s = ground();
      s += ell(19.5, 43.4, 3, 1.4, '#F7A531') + ell(28.5, 43.4, 3, 1.4, '#F7A531');
      s += circ(24, 31, 12.4, '#FFD54A', stroke('#E3A72A', 0.9)) + ell(24, 35, 8, 6.4, '#FFE58A');
      s += ell(12.6, 33, 3.2, 5.2, '#FFC93A', ' transform="rotate(25 12.6 33)"') + ell(35.4, 33, 3.2, 5.2, '#FFC93A', ' transform="rotate(-25 35.4 33)"');
      s += path('M21 19.6c0-3 2-4.6 3-4.6s1 2.4 0 3.6c1.4-2 3.6-2.2 4-1-1 .6-2.4 1.6-3 3.2', '#FFD54A', stroke('#E3A72A', 0.7));
      s += eye(19.6, 28, 1.7) + eye(28.4, 28, 1.7) + path('M22 31l2-1.6 2 1.6-2 2z', '#F7A531', stroke('#D9851A', 0.5)) + blush(16.4, 32) + blush(31.6, 32);
      if (f >= 1) s += bandana(24, 37.6, '#3D7FD1');
      if (f >= 2) s += crown(24, 18.6, 0.9);
      return s;
    },
    hamster: (f) => {
      let s = ground();
      s += circ(14.4, 20.4, 4.4, '#E89A52', stroke('#C47A38', 0.7)) + circ(14.4, 20.4, 2.4, '#FFB3C7') + circ(33.6, 20.4, 4.4, '#E89A52', stroke('#C47A38', 0.7)) + circ(33.6, 20.4, 2.4, '#FFB3C7');
      s += ell(24, 32, 13.4, 12, '#F2B66B', stroke('#C47A38', 0.9)) + ell(24, 36, 8.6, 7.6, '#FFF3DF');
      s += circ(15.4, 32.6, 4.2, '#FFE2C2') + circ(32.6, 32.6, 4.2, '#FFE2C2');
      s += eye(19.6, 28, 1.6) + eye(28.4, 28, 1.6) + ell(24, 31, 1.4, 1, '#FF8FA8') + path('M22.6 32.6q1.4 1.2 2.8 0', 'none', stroke('#8A5A30', 0.6) + ' fill="none"') + blush(16, 31.4, 1.8) + blush(32, 31.4, 1.8);
      s += ell(21, 38.6, 2.2, 1.8, '#F2B66B') + ell(27, 38.6, 2.2, 1.8, '#F2B66B') + ell(24, 37.4, 2, 3, '#5B3A20') + ell(23.4, 36.6, 0.6, 1.2, '#FFFFFF', ' opacity=".5"');
      if (f >= 1) s += path('M13 23q-3-6 2-8 2 4 1 7z', '#E0463A') + circ(13.6, 18.4, 1.4, '#FFFFFF');
      if (f >= 2) s += crown(24, 21.6, 0.9);
      return s;
    },
    frog: (f) => {
      let s = ground();
      s += ell(15, 42.6, 4.6, 2, '#5AAE3C') + ell(33, 42.6, 4.6, 2, '#5AAE3C');
      s += ell(24, 34, 14.6, 10, '#6CC24A', stroke('#3F8A2A', 0.9)) + ell(24, 38, 9.4, 5.4, '#B8E68A');
      s += circ(16, 24.6, 5.8, '#6CC24A', stroke('#3F8A2A', 0.8)) + circ(32, 24.6, 5.8, '#6CC24A', stroke('#3F8A2A', 0.8)) + circ(16, 24.6, 3.6, '#FFFFFF') + circ(32, 24.6, 3.6, '#FFFFFF') + eye(16.6, 25, 2) + eye(31.4, 25, 2);
      s += path('M16.4 32.4q7.6 5.6 15.2 0', 'none', stroke('#2F6A1F', 1) + ' fill="none" stroke-linecap="round"') + blush(13.6, 31.6, 2.2) + blush(34.4, 31.6, 2.2);
      if (f >= 1) s += ell(24, 19.4, 9, 2.6, '#4DA05A', stroke('#2F7A3A', 0.6)) + path('M24 17l3-2 1 3z', '#FF8FB0');
      if (f >= 2) s += crown(24, 18, 1);
      return s;
    },
    otter: (f) => {
      let s = ground();
      s += path('M34 40c6 0 9-4 8-9', 'none', stroke('#7A4E2E', 4.4) + ' fill="none" stroke-linecap="round"');
      s += ell(24, 33, 10.6, 11.4, '#8B5E3C', stroke('#5E3B22', 0.8)) + ell(24, 35.6, 6.6, 8, '#E8C9A4');
      s += circ(16.6, 17.6, 2.8, '#8B5E3C') + circ(31.4, 17.6, 2.8, '#8B5E3C') + circ(24, 22.6, 9.4, '#8B5E3C', stroke('#5E3B22', 0.8)) + ell(24, 26.6, 6, 4.2, '#F1DCC0');
      s += eye(20, 21.6, 1.6) + eye(28, 21.6, 1.6) + ell(24, 24.6, 2, 1.4, '#3B2A20') + path('M22 27.4q2 1.4 4 0', 'none', stroke('#5E3B22', 0.7) + ' fill="none"') + line('M17 25.6l-4-1M17 27l-4 .6M31 25.6l4-1M31 27l4 .6', '#E8D7C2', 0.5);
      s += ell(24, 35.4, 4.6, 3.2, '#FFB3C7', stroke('#E07A9A', 0.6)) + line('M21 35.4q3-2 6 0M21.6 36.8q2.4-1.4 4.8 0', '#E07A9A', 0.5) + ell(19.4, 35, 2.4, 2, '#8B5E3C') + ell(28.6, 35, 2.4, 2, '#8B5E3C');
      if (f >= 1) s += bandana(24, 30.6, '#E0463A');
      if (f >= 2) s += crown(24, 14.4, 0.9);
      return s;
    },
    koala: (f) => {
      let s = ground();
      s += ell(24, 35, 11.6, 10, '#A5ADB8', stroke('#7D8794', 0.8)) + ell(24, 37.4, 7, 6.4, '#E4E7EC');
      s += circ(13, 18.4, 6.4, '#A5ADB8', stroke('#7D8794', 0.8)) + circ(13, 18.4, 3.8, '#F4F4F6') + circ(35, 18.4, 6.4, '#A5ADB8', stroke('#7D8794', 0.8)) + circ(35, 18.4, 3.8, '#F4F4F6');
      s += circ(24, 23.4, 10.4, '#A5ADB8', stroke('#7D8794', 0.8)) + eye(19.4, 22, 1.6) + eye(28.6, 22, 1.6) + ell(24, 25.6, 3, 3.8, '#3B3F4A') + ell(23, 24.4, 0.8, 1.2, '#FFFFFF', ' opacity=".4"') + blush(16.6, 27, 1.8) + blush(31.4, 27, 1.8);
      s += path('M30 33c4-4 9-3 9-3-1 4-5 6-9 3z', '#6BBF59', stroke('#3E8A3A', 0.6)) + line('M30 33l9-3', '#3E8A3A', 0.5) + ell(29, 35, 2.6, 2.2, '#A5ADB8');
      if (f >= 1) s += path('M17 31q7 3 14 0l-.6 2.4q-6.4 2-12.8 0z', '#FFD45A', stroke('#C98A12', 0.4)) + circ(24, 33.6, 1.4, '#E0463A');
      if (f >= 2) s += crown(24, 13.4, 0.9);
      return s;
    },
    kitsune: (f) => {
      let s = f >= 2 ? aura('#9FD9FF', 23) : '';
      s += ground();
      // tails fan out behind: one, three, nine
      const n = f >= 2 ? 9 : f >= 1 ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const a = n === 1 ? 35 : -70 + (140 * k) / (n - 1);
        s += '<g transform="rotate(' + f1(a) + ' 24 36)">' + path('M24 36c-4-6-5-15-1-21 4 5 5 14 1 21z', '#FFFFFF', stroke('#E2D8E8', 0.6)) + path('M23 16c1 2 2 4 1 6-1-2-2-3-1-6z', '#FF6F91') + '</g>';
      }
      if (f >= 2) [[8, 20], [40, 22], [10, 34], [38, 36]].forEach((p) => { s += circ(p[0], p[1], 2.6, '#7FD8FF', ' opacity=".9"') + circ(p[0], p[1], 1.2, '#FFFFFF'); });
      s += ell(24, 35, 9.6, 9.6, '#FFFFFF', stroke('#E2D8E8', 0.8)) + ell(24, 38, 5.4, 6, '#FFF5F8');
      s += path('M15.6 17l1.4-9 6 7z', '#FFFFFF', stroke('#E2D8E8', 0.7)) + path('M17 15l.8-4.6 3 3.6z', '#FF6F91') + path('M32.4 17l-1.4-9-6 7z', '#FFFFFF', stroke('#E2D8E8', 0.7)) + path('M31 15l-.8-4.6-3 3.6z', '#FF6F91');
      s += circ(24, 23.4, 9, '#FFFFFF', stroke('#E2D8E8', 0.8)) + path('M22.4 17q1.6-2.4 3.2 0-1.6 2-3.2 0z', '#FF4D6D');
      s += path('M18 22.6q2 1.6 4 0', 'none', stroke('#2B2A26', 1.1) + ' fill="none" stroke-linecap="round"') + path('M26 22.6q2 1.6 4 0', 'none', stroke('#2B2A26', 1.1) + ' fill="none" stroke-linecap="round"') + ell(24, 26.4, 1.4, 1, '#2B2A26') + blush(17.4, 26, 1.8) + blush(30.6, 26, 1.8) + path('M16 25l-3 .6M32 25l3 .6', 'none', stroke('#FF6F91', 0.8));
      if (f >= 1) s += path('M17 31.6q7 3 14 0', 'none', stroke('#FF4D6D', 1.6) + ' fill="none"') + circ(24, 33.8, 1.8, '#FFD45A', stroke('#C98A12', 0.4));
      if (f >= 2) s += crown(24, 14, 0.85) + sparkles('#BFEFFF');
      return s;
    },
    unicorn: (f) => {
      let s = f >= 2 ? aura('#F5B8FF', 23) : '';
      if (f >= 2) s += path('M14 30C4 24 2 14 6 10c3 6 8 9 12 12zM34 30c10-6 12-16 8-20-3 6-8 9-12 12z', '#FFFFFF', stroke('#D9C6F2', 0.8)) + path('M8 14c2 5 5 8 9 10M40 14c-2 5-5 8-9 10', 'none', stroke('#E8C8FF', 1) + ' fill="none"');
      s += ground();
      s += path('M14 38c-6 2-9-2-8-6 2 2 4 1 5-1', 'none', stroke('#B98CFF', 3) + ' fill="none" stroke-linecap="round"') + path('M13 36c-4 1-6-1-6-3', 'none', stroke('#7FC8FF', 1.6) + ' fill="none" stroke-linecap="round"');
      s += ell(24, 35.6, 11, 9, '#FFFFFF', stroke('#E5DDF2', 0.8)) + ell(18.6, 43, 2.6, 1.6, '#C9B7E6') + ell(29.4, 43, 2.6, 1.6, '#C9B7E6');
      s += circ(25, 22.4, 8.6, '#FFFFFF', stroke('#E5DDF2', 0.8)) + ell(28, 26.4, 5.2, 3.8, '#FFE8F0');
      s += path('M18 16c-4 2-5 8-3 12 1-3 2-5 4-6-1 3 0 6 2 7 0-4 1-7 3-9z', '#FF9ED8') + path('M19 14c-2 1-3 4-2 6 2-2 4-3 6-3z', '#B98CFF') + path('M16 22c-2 3-1 7 1 9 0-3 1-5 2-6z', '#7FC8FF');
      s += path('M22.6 14.6l1.2-10.6 3.4 10z', '#FFD45A', stroke('#C98A12', 0.6)) + line('M23.4 11.6l3-1M23.8 8.4l2.2-.8', '#C98A12', 0.6);
      s += path('M30 16.4l2.6-4.6 1 5z', '#FFFFFF', stroke('#E5DDF2', 0.6)) + eye(27.8, 21.6, 1.7) + ell(30.4, 26.8, 0.8, 0.6, '#C9A3B1') + blush(25, 25.6, 1.7);
      if (f >= 1) [[19, 15.4, '#FF9ED8'], [22, 13.2, '#FFE27A'], [25.6, 13.6, '#9FE3B0']].forEach((d) => { s += circ(d[0], d[1], 1.8, d[2], stroke('#FFFFFF', 0.5)); });
      if (f >= 2) s += sparkles('#FFE7FF');
      return s;
    },
    phoenix: (f) => {
      let s = aura('#FFC85A', f >= 2 ? 23 : 18);
      if (f >= 2) s += circ(24, 12, 9, 'none', stroke('#FFD45A', 1.6) + ' opacity=".9"') + path('M14 30C2 26-1 14 3 8c3 7 9 10 13 13zM34 30c12-4 15-16 11-22-3 7-9 10-13 13z', '#FF5A36', stroke('#C9311E', 0.7)) + path('M12 26C5 22 4 16 6 12c2 5 6 8 9 9zM36 26c7-4 8-10 6-14-2 5-6 8-9 9z', '#FFC23D');
      s += ground();
      const tl = f >= 1 ? 1.25 : 1;
      s += path('M20 40c-4 6-12 6-15 2 5 0 8-2 9-5', '#FF8A3C', stroke('#C9311E', 0.6)) + path('M28 40c4 6 12 6 15 2-5 0-8-2-9-5', '#FF8A3C', stroke('#C9311E', 0.6));
      s += path('M24 40c0 ' + f1(6 * tl) + '-3 ' + f1(8 * tl) + '-5 ' + f1(9 * tl) + ' 1-3 1-5 0-7M24 40c0 ' + f1(6 * tl) + ' 3 ' + f1(8 * tl) + ' 5 ' + f1(9 * tl) + '-1-3-1-5 0-7', '#FFC23D', stroke('#E07A1A', 0.6));
      s += ell(24, 32, 10, 11, '#FF5A36', stroke('#C9311E', 0.8)) + ell(24, 35, 6.4, 7.4, '#FFC23D');
      s += ell(14.6, 32, 3.6, 7.4, '#E8402A', ' transform="rotate(14 14.6 32)"') + ell(33.4, 32, 3.6, 7.4, '#E8402A', ' transform="rotate(-14 33.4 32)"');
      const ch = f >= 1 ? 1.35 : 1;
      s += path('M24 16c-3-' + f1(5 * ch) + '-1-' + f1(8 * ch) + ' 1-' + f1(9 * ch) + ' 0 3 2 4 2 6 1-2 3-3 4-6 1 4 0 7-3 9z', '#FFC23D', stroke('#E07A1A', 0.6)) + path('M22 15c-3-2-4-5-3-8 1 3 3 4 4 5z', '#FF8A3C');
      s += circ(24, 21, 7.6, '#FF7A3D', stroke('#C9311E', 0.8)) + eye(21, 20.4, 1.6) + eye(27, 20.4, 1.6) + path('M22 23.4l2 3 2-3z', '#FFD45A', stroke('#C98A12', 0.5)) + blush(18.6, 23.4, 1.6) + blush(29.4, 23.4, 1.6);
      if (f >= 2) s += sparkles('#FFF3B0');
      return s;
    }
  };
  /* a pet as an <svg> (size = the box it fills; the forms grow) */
  function pet(sp, form, size) {
    const k = FF.lucky ? FF.lucky.FORM_SCALE[form || 0] : 1;
    const s = (size || 48) * k;
    return svg(PETS[sp] ? PETS[sp](form || 0) : '', 48, 48, 'lk-pet', s);
  }

  /* =========================================================
     PLANTS — 48×60, the soil mound at the bottom
     ========================================================= */
  const mound = () => ell(24, 55, 13, 4.2, '#8A5A33') + ell(24, 54, 11, 3, '#A06B3E') + circ(18, 53.6, 0.8, '#7A4A28') + circ(29, 54.4, 0.7, '#7A4A28');
  const leaf = (x, y, rot, len, c) => '<g transform="rotate(' + rot + ' ' + f1(x) + ' ' + f1(y) + ')">' + path('M' + f1(x) + ' ' + f1(y) + 'q' + f1(len * 0.5) + ' ' + f1(-len * 0.45) + ' ' + f1(len) + ' 0q' + f1(-len * 0.5) + ' ' + f1(len * 0.45) + ' ' + f1(-len) + ' 0z', c || '#5DBB6A', stroke('#3E8A3A', 0.5)) + '</g>';
  const STAGES = [
    () => mound() + line('M30 54V44', '#B48A52', 1.4) + rect(27, 40, 8, 5, 1, '#F3E3C2', stroke('#B48A52', 0.6)) + circ(31, 42.4, 1.2, '#5DBB6A') + ell(22, 53, 2, 1.2, '#C9A66A'),
    () => mound() + line('M24 54v-7', '#4E9A3C', 1.6) + leaf(24, 47, -160, 6.4) + leaf(24, 47, -20, 6.4),
    () => mound() + line('M24 54V38', '#4E9A3C', 1.8) + leaf(24, 49, -160, 8) + leaf(24, 46, -20, 8) + leaf(24, 42, -150, 7) + leaf(24, 39, -30, 7),
    () => mound() + line('M24 54V26', '#4E9A3C', 2) + leaf(24, 50, -160, 9) + leaf(24, 46, -20, 9) + leaf(24, 41, -150, 8) + leaf(24, 37, -30, 8) +
      path('M24 27c-4-2-4-9 0-12 4 3 4 10 0 12z', '#7CC46A', stroke('#3E8A3A', 0.6)) + path('M24 16c-1.4 1-1.6 3-1 4 1-1 2-1 2 0 .6-1.4.4-3-1-4z', '#FF9ED8')
  ];
  const BLOOMS = {
    sunflower: () => mound() + line('M24 54V18', '#4E9A3C', 2.4) + leaf(24, 46, -160, 10) + leaf(24, 40, -20, 10) + leaf(24, 32, -155, 8) +
      Array.from({ length: 14 }, (_, k) => '<g transform="rotate(' + (k * 360 / 14) + ' 24 15)">' + ell(24, 6.6, 2.6, 5.4, '#FFD13A', stroke('#E0A21A', 0.4)) + '</g>').join('') + circ(24, 15, 6, '#7A4A28') + circ(24, 15, 4.4, '#8A5A33') + [[22, 13], [26, 14], [23, 17], [25.6, 17]].map((p) => circ(p[0], p[1], 0.7, '#5B3A20')).join('') + circ(22, 13, 1, '#FFFFFF', ' opacity=".3"'),
    tulip: () => {
      const one = (x, top, c, lean) => line('M' + x + ' 54Q' + (x + lean) + ' ' + ((54 + top) / 2) + ' ' + (x + lean) + ' ' + top, '#4E9A3C', 1.6) + path('M' + f1(x + lean - 5) + ' ' + f1(top - 6) + 'c0 6 2 8 5 8s5-2 5-8l-2.4 2.4-2.6-3.4-2.6 3.4z', c, stroke(A.shade(c, 0.7), 0.6)) + ell(x + lean - 2, top - 3, 0.8, 2, '#FFFFFF', ' opacity=".4"');
      return mound() + leaf(19, 52, -130, 9) + leaf(29, 52, -50, 9) + one(17, 30, '#FF6B7A', -2) + one(30, 26, '#FFD45A', 1) + one(24, 20, '#FF8FD0', 0);
    },
    rose: () => {
      let s = mound() + circ(15, 44, 7, '#3E8A3A') + circ(33, 44, 7, '#3E8A3A') + circ(24, 38, 9, '#4E9A3C') + circ(17, 34, 6, '#5DBB6A') + circ(31, 35, 6, '#5DBB6A') + circ(24, 29, 6, '#5DBB6A');
      [[17, 32], [31, 33], [24, 26], [24, 40], [13, 43], [35, 43]].forEach((p, i) => { const c = i % 2 ? '#E8394A' : '#FF5A6E'; s += circ(p[0], p[1], 3.6, c, stroke('#A81E2E', 0.5)) + path('M' + f1(p[0] - 1.6) + ' ' + f1(p[1]) + 'a1.8 1.8 0 1 1 3.2 .6', 'none', stroke('#A81E2E', 0.5) + ' fill="none"'); });
      return s;
    },
    lavender: () => {
      let s = mound() + leaf(18, 53, -120, 10, '#7FB08A') + leaf(30, 53, -60, 10, '#7FB08A') + leaf(24, 52, -95, 9, '#8FC09A');
      [[16, 24, -4], [20, 18, -2], [24, 14, 0], [28, 18, 2], [32, 24, 4]].forEach((d) => {
        s += line('M' + d[0] + ' 53Q' + (d[0] + d[2] * 0.5) + ' ' + ((53 + d[1]) / 2) + ' ' + (d[0] + d[2]) + ' ' + d[1], '#6E9A5A', 1.2);
        for (let k = 0; k < 7; k++) s += ell(d[0] + d[2] + (k % 2 ? 1 : -1), d[1] + k * 2.6, 1.6, 1.4, k % 3 ? '#9E7BE0' : '#B898F0');
      });
      return s;
    },
    bonsai: () => mound() + path('M23 54c0-6 4-8 2-14s-6-6-4-12c1 3 4 4 6 2', 'none', stroke('#7A4A28', 3.4) + ' fill="none" stroke-linecap="round"') + path('M25 40c4-2 8-2 10-6', 'none', stroke('#7A4A28', 2.2) + ' fill="none" stroke-linecap="round"') +
      [[14, 26, 7], [23, 20, 8], [32, 24, 7], [36, 33, 6], [18, 33, 5], [27, 28, 6]].map((c) => circ(c[0], c[1], c[2], '#FFB7CE', stroke('#F28AAE', 0.5))).join('') +
      [[12, 24], [20, 17], [26, 19], [33, 22], [37, 31], [16, 31], [28, 27]].map((p) => circ(p[0], p[1], 1.2, '#FFFFFF', ' opacity=".8"')).join('') + ell(10, 46, 1.6, 1, '#FFB7CE') + ell(38, 50, 1.4, 0.9, '#FFB7CE'),
    crystal: () => {
      let s = circ(24, 26, 20, '#BFEFFF', ' opacity=".3"') + mound() + line('M24 54V30', '#7FC8E8', 2) + leaf(24, 48, -160, 9, '#9FE3F7') + leaf(24, 43, -20, 9, '#9FE3F7');
      [[-50, '#CFF6FF'], [-20, '#A8E8FF'], [10, '#CFF6FF'], [40, '#A8E8FF'], [70, '#E6FBFF']].forEach((d) => { s += '<g transform="rotate(' + d[0] + ' 24 28)">' + poly([[24, 28], [21, 18], [24, 10], [27, 18]], d[1], '#5FB8D8', 0.6, ' opacity=".92"') + '</g>'; });
      return s + circ(24, 27, 3, '#FFFFFF') + star(12, 14, 2.4, '#FFFFFF') + star(37, 12, 2, '#FFFFFF') + star(38, 34, 1.6, '#E6FBFF');
    },
    moneytree: () => {
      let s = circ(24, 24, 22, '#FFE27A', ' opacity=".28"') + circ(24, 24, 16, '#FFE27A', ' opacity=".25"') + mound();
      s += path('M22 54c1-8-2-14 0-22M26 54c-1-8 2-14 0-22', 'none', stroke('#B07A2A', 3) + ' fill="none" stroke-linecap="round"') + path('M24 36c-4-2-7-6-8-10M24 34c4-2 7-6 8-10', 'none', stroke('#B07A2A', 2) + ' fill="none" stroke-linecap="round"');
      [[14, 24, 7], [24, 17, 8], [34, 24, 7], [19, 30, 5], [29, 30, 5]].forEach((c) => { s += circ(c[0], c[1], c[2], '#4DB25A', stroke('#2F8A3F', 0.5)); });
      [[12, 21], [17, 26], [22, 13], [27, 19], [31, 14], [35, 22], [24, 26], [29, 29], [18, 31], [37, 27]].forEach((p) => { s += circ(p[0], p[1], 2.4, '#FFD13A', stroke('#C98A12', 0.6)) + circ(p[0], p[1], 1.2, 'none', stroke('#E0A21A', 0.4)); });
      return s + path('M24 4l3 3-3 4-3-4z', '#7FD8FF', stroke('#3D9ACB', 0.6)) + star(10, 10, 2.4, '#FFFFFF') + star(39, 8, 2, '#FFFFFF') + star(41, 32, 1.6, '#FFF6C2');
    }
  };
  /* a plant as an <svg>: its stage (0…3), or its bloom (4) */
  function plant(pl, size) {
    const st = FF.lucky.stage(pl);
    const inner = st >= 4 ? (BLOOMS[pl.sp] || BLOOMS.sunflower)() : STAGES[Math.min(st, 3)]();
    return svg(inner, 48, 60, 'lk-plant', size || 60);
  }
  const bloomArt = (sp, size) => svg((BLOOMS[sp] || BLOOMS.sunflower)(), 48, 60, 'lk-plant', size || 60);

  /* =========================================================
     FISH — 48×28, swimming right
     ========================================================= */
  const fishBody = (c, belly, fin, extra) => path('M6 14L1 7v14z', fin, stroke(A.shade(fin, 0.75), 0.6)) + ell(22, 14, 17, 9, c, stroke(A.shade(c, 0.72), 0.8)) + ell(24, 17.6, 12, 4.4, belly) + path('M18 6c3-4 8-4 10 0z', fin) + (extra || '') + eye(33, 12, 1.8) + path('M38 16q1.6 1 3 0', 'none', stroke('#2B2A26', 0.6) + ' fill="none"');
  const FISH = {
    minnow: () => '<g transform="translate(6 3) scale(.78)">' + fishBody('#9EC9E8', '#E6F3FB', '#7FB2D8') + '</g>',
    carp: () => fishBody('#C8913E', '#F2D8A8', '#A8712A', path('M14 10q4 4 0 8M20 9q4 5 0 10', 'none', stroke('#A8712A', 0.6) + ' fill="none" opacity=".6"')),
    koi: () => fishBody('#FFFFFF', '#FFF6EC', '#FF8A4C', ell(16, 11, 5, 3.4, '#FF6B3A') + ell(27, 15, 4, 3, '#FF6B3A') + ell(21, 18, 2.6, 1.8, '#2B2A26', ' opacity=".7"')),
    goldkoi: () => circ(22, 14, 15, '#FFE27A', ' opacity=".35"') + fishBody('#FFC93D', '#FFF0B8', '#F0A21A', path('M12 10q6-3 14 0', 'none', stroke('#FFFFFF', 1.2) + ' opacity=".7"')) + star(40, 4, 2.4, '#FFFFFF'),
    pearl: () => circ(22, 14, 16, '#F5D6FF', ' opacity=".4"') + path('M6 14C-2 4 0 0 2 2c2 2 3 6 6 9zM6 14C-2 24 0 28 2 26c2-2 3-6 6-9z', '#FFD9F2', stroke('#E8A8D8', 0.5)) + fishBody('#FFF4FB', '#FFFFFF', '#F7C8EC', path('M15 22c2 4 6 5 9 4', 'none', stroke('#F7C8EC', 1.4) + ' fill="none"')) + circ(24, 4, 3, '#FFFFFF', stroke('#E8D8F0', 0.6)) + circ(23, 3, 1, '#FFFFFF')
  };
  const fish = (sp, size) => svg(FISH[sp] ? FISH[sp]() : '', 48, 28, 'lk-fish', size || 48);
  /* the pond sign in the village: a little post with a fish */
  function pondSign() {
    let s = ell(16, 41, 9, 2.4, 'rgba(30,40,10,.22)') + rect(14.6, 18, 2.8, 23, 1, P('#8A5A30'));
    s += rect(4, 8, 24, 13, 3, P('#F3E3C2'), stroke(P('#8A5A30'), 1)) + '<g transform="translate(6 9.4) scale(.42)">' + fishBody(P('#FF8A4C'), P('#FFE0C8'), P('#E86A2A')) + '</g>';
    return { svg: svg(s, 32, 44, 'pond-svg'), w: 32, h: 44, ax: 16, ay: 41 };
  }

  /* =========================================================
     EXCLUSIVE DECORATIONS (Lucky Market only) — still pictures
     ========================================================= */
  const L = (id, p, w, h, ax, ay, inner, o) => Object.assign({ id, x: p[0] - ax, y: p[1] - ay, w, h, inner }, o || {});
  A.DECO_DRAW = A.DECO_DRAW || {}; // (art-shop.js normally made it; never let one missing file break this one)
  Object.assign(A.DECO_DRAW, {
    clover(a) {
      let s = ell(12, 30, 9, 2.4, 'rgba(30,40,10,.22)') + path('M5 22h14l-2 8H7z', P('#C98A12'), stroke(P('#8A5A12'), 0.7)) + rect(4, 20, 16, 3, 1, P('#FFD45A'), stroke(P('#C98A12'), 0.6));
      s += line('M12 20v-5', P('#3E8A3A'), 1.6);
      [[-4, -4, -45], [4, -4, 45], [-4, 4, 45], [4, 4, -45]].forEach((d) => { s += '<g transform="rotate(' + d[2] + ' ' + f1(12 + d[0]) + ' ' + f1(11 + d[1]) + ')">' + ell(12 + d[0], 11 + d[1], 5.4, 4.4, P('#5DBB6A'), stroke(P('#3E8A3A'), 0.5)) + '</g>'; });
      s += circ(12, 11, 1.6, P('#FFD45A')) + star(20, 3, 1.8, '#FFFFFF');
      return [L('clover', [a.yard[0] - 22, a.yard[1]], 24, 32, 12, 30, s)];
    },
    goldbell(a) {
      const p = a.lf(a.door.d0 + a.door.w / 2, a.door.h + 3);
      let s = path('M2 4q10 6 20 0', 'none', stroke(P('#E0463A'), 2.2) + ' fill="none" stroke-linecap="round"');
      [[6, 7], [12, 9.4], [18, 7]].forEach((b, i) => { s += line('M' + b[0] + ' ' + (b[1] - 3) + 'v3', P('#C98A12'), 0.8) + path('M' + f1(b[0] - 3.4) + ' ' + f1(b[1] + 6) + 'c0-4 1.4-6 3.4-6s3.4 2 3.4 6z', P('#FFD13A'), stroke(P('#C98A12'), 0.6)) + circ(b[0], b[1] + 6.6, 1, P('#C98A12')) + ell(b[0] - 1.2, b[1] + 3, 0.6, 1.4, '#FFFFFF', ' opacity=".6"'); });
      s += path('M10 4l2 2 2-2-2-1.4z', P('#E0463A'));
      return [L('goldbell', p, 24, 18, 12, 4, s)];
    },
    fireworks(a) {
      const top = Math.max(a.top + 10, -170);
      let s = '';
      const burst = (x, y, r, c1, c2) => { let o = ''; for (let k = 0; k < 12; k++) { const t = (k / 12) * Math.PI * 2; o += line('M' + f1(x + Math.cos(t) * r * 0.3) + ' ' + f1(y + Math.sin(t) * r * 0.3) + 'L' + f1(x + Math.cos(t) * r) + ' ' + f1(y + Math.sin(t) * r), k % 2 ? c1 : c2, 1.4); o += circ(x + Math.cos(t) * (r + 2), y + Math.sin(t) * (r + 2), 1, k % 2 ? c2 : c1); } return o + circ(x, y, 1.6, '#FFFFFF'); };
      s += burst(18, 18, 14, P('#FF6FAE'), P('#FFD45A')) + burst(50, 12, 10, P('#7FD8FF'), P('#FFFFFF')) + burst(42, 34, 8, P('#B98CFF'), P('#FFD45A'));
      s += line('M18 34v12', P('#FFD45A'), 0.8) + line('M50 24v8', P('#7FD8FF'), 0.6);
      return [{ id: 'fireworks', x: -34, y: top - 30, w: 68, h: 52, inner: s }]; // still (no swaying layer)
    }
  });

  Object.assign(A, { luckyMarket: market, lkItem: itemArt, lkPet: pet, lkPlant: plant, lkBloom: bloomArt, lkFish: fish, pondSign, TIER_GLOW });
})(typeof window !== 'undefined' ? window : this);
