/* ============================================================
   FamFi — art-sage.js
   The Mystery Man: an old fellow lying back in the grass on a hay
   pillow — one knee up, a hand on his belly, his straw hat tipped
   over his face, a white beard poking out and a stalk of wheat in
   his mouth. A still picture; only the wheat stalk (its own little
   box, never anything inside an SVG) sways now and then as he chews.
   Also his portrait for the quiz: a wink under the hat brim.
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
  const stroke = (c, w) => ' stroke="' + c + '" stroke-width="' + (w || 0.8) + '"';
  const line = (d, c, w) => path(d, 'none', ' stroke="' + c + '" stroke-width="' + (w || 1) + '" fill="none" stroke-linecap="round" stroke-linejoin="round"');
  const limb = (d, c, w, ln) => line(d, ln, w + 2.4) + line(d, c, w); // a thick outlined arm or leg
  const svg = (inner, w, h, cls, size) => '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 ' + w + ' ' + h + '" width="' + (size || w) + '" height="' + (size ? f1(size * h / w) : h) + '" aria-hidden="true">' + inner + '</svg>';

  /* the wheat stalk: drawn from its bottom-left corner (the mouth) up and to the right */
  function wheat(w, h) {
    const ln = P('#B88A2A'), g = P('#EAC04E'), gd = P('#D6A436');
    let s = line('M2 ' + (h - 2) + 'Q' + f1(w * 0.45) + ' ' + f1(h * 0.62) + ' ' + f1(w * 0.78) + ' ' + f1(h * 0.24), ln, 1.5);
    // the ear of grain: little seeds in pairs along the tip
    const tip = [[0.62, 0.42], [0.69, 0.34], [0.76, 0.27], [0.83, 0.2], [0.9, 0.12]];
    tip.forEach((t, k) => {
      const x = w * t[0], y = h * t[1], r = 3.1 - k * 0.25;
      s += ell(x - 2.2, y - 0.6, r, 1.7, k % 2 ? gd : g, ' transform="rotate(-62 ' + f1(x - 2.2) + ' ' + f1(y - 0.6) + ')"' + stroke(ln, 0.5));
      s += ell(x + 1.6, y + 1.6, r, 1.7, k % 2 ? g : gd, ' transform="rotate(-20 ' + f1(x + 1.6) + ' ' + f1(y + 1.6) + ')"' + stroke(ln, 0.5));
    });
    s += line('M' + f1(w * 0.9) + ' ' + f1(h * 0.12) + 'l4 -5M' + f1(w * 0.92) + ' ' + f1(h * 0.15) + 'l6 -2', ln, 0.7); // whiskers
    return s;
  }

  /* the village sprite. The wheat is returned separately (o.wheat: [x, y, w, h] in the sprite's
     own px) so the village can sway it as a box. */
  function sageMan() {
    const w = 150, h = 106, cx = 75, base = 94;
    const ln = P('#4A3426'), skin = P('#F2C29B'), skinD = P('#E2A97F');
    const shirt = P('#D65A4A'), shirtD = P('#B5443A'), denim = P('#3F6FB5'), denimD = P('#335C99'), denimL = P('#6C95D6');
    const boot = P('#7A4A2A'), bootD = P('#4E2E18'), straw = P('#EDBE52'), strawL = P('#F6D677'), strawD = P('#B8923A');
    const beard = P('#F1EFEA'), beardD = P('#BDB7AA');
    let s = ell(cx + 4, base + 3, 68, 11, 'url(#ff-shadow)');
    // his patch of grass, a few blades and two flowers
    s += ell(cx + 1, base - 1, 64, 10, P('#79C267')) + ell(cx - 10, base - 3, 36, 5.5, P('#94D47F'));
    s += line('M12 ' + (base - 1) + 'l-3 -7M15 ' + (base - 1) + 'l1 -6M136 ' + (base - 1) + 'l2 -7M139 ' + base + 'l4 -5', P('#5DA84E'), 1.3);
    s += circ(134, base + 2, 2.7, P('#FFD45A')) + circ(134, base + 2, 1.1, P('#F08A3C'));
    s += circ(18, base + 4, 2.5, P('#FF8FA8')) + circ(18, base + 4, 1, P('#FFF4F6'));
    // the hay pillow
    s += ell(25, base - 7, 18, 7.5, straw, stroke(strawD, 1.1));
    s += line('M12 ' + (base - 8) + 'l7 -2M22 ' + (base - 3) + 'l9 -3M30 ' + (base - 10) + 'l8 1M16 ' + (base - 4) + 'l5 1', strawD, 0.8);
    // the leg lying flat (behind), its boot toes-up
    s += limb('M88 85L126 86', denimD, 11, ln);
    s += path('M124 92V80Q124 73 131 73Q138 73 138 80L139 89Q139 92 135 92Z', boot, stroke(ln, 1.2)) + line('M124 90H139', bootD, 1.6);
    // the arm behind his head
    s += limb('M44 76L39 57L22 70', shirtD, 7.5, ln);
    // his body: a plaid shirt and dungarees
    s += rect(36, 71, 58, 21, 10.5, shirt, stroke(ln, 1.3));
    s += line('M47 72v19M57 72v19', shirtD, 1.1) + line('M38 80h20', shirtD, 1.1);
    s += path('M60 71.6H84Q94 71.6 94 82V91.4H60Z', denim, stroke(ln, 1.1));
    s += rect(66, 76, 14, 8, 2, denimD) + line('M60 74L45 75', denim, 3.4) + circ(61, 74.5, 1.7, P('#F2D27A'), stroke(ln, 0.5));
    // the raised knee (in front), a patch on it, its boot flat on the grass
    s += limb('M88 83L106 58L117 86', denim, 11.5, ln);
    s += rect(100, 60, 8, 7, 1.5, denimL, stroke(denimD, 0.8) + ' transform="rotate(32 104 63.5)"');
    s += path('M110 93V85Q110 80 116 80L123 82Q131 84 131 89V93Z', boot, stroke(ln, 1.2)) + line('M110 92H131', bootD, 1.6);
    // a hand resting on his belly
    s += limb('M50 77L57 88L70 80', shirt, 7.5, ln) + circ(71.5, 79, 4.2, skin, stroke(ln, 1));
    // his head on the pillow (seen side-on: face to the sky, chin towards us… under the hat)
    s += circ(27, 75, 12.5, skin, stroke(ln, 1.3)) + ell(23, 77, 3, 4, skinD);
    // the white beard poking out from under the brim
    s += ell(38.5, 71, 7, 6, beard, stroke(beardD, 1)) + ell(42.5, 74.5, 5, 4.5, beard, stroke(beardD, 1)) + ell(38, 74, 4, 3.4, beard);
    // the straw hat tipped over his face
    s += ell(29, 62.5, 21, 5.5, straw, stroke(strawD, 1.2) + ' transform="rotate(-12 29 62.5)"');
    s += path('M17 62Q16 45 29 44Q42 44 42 57Z', straw, stroke(strawD, 1.2));
    s += path('M17.6 58Q29 52.5 41.6 53.6L42 57.4Q29 56.6 17.4 62Z', P('#C2453A'));
    s += line('M22 49q5 -2 12 -1M20 54q-1 -4 2 -7M36 47q4 3 5 8', strawL, 0.9) + line('M12 66q8 -4 17 -5M33 60q6 -2 12 -4', strawD, 0.7);
    // an open book face-down on the grass beside him
    s += path('M84 ' + (base + 4) + 'L95 ' + (base - 2) + 'L106 ' + (base + 4) + 'L95 ' + (base + 6) + 'Z', P('#3E7CB1'), stroke(ln, 1));
    s += line('M85.5 ' + (base + 5) + 'L95 ' + (base + 7.4) + 'L104.5 ' + (base + 5), P('#FFFDF5'), 1.5) + line('M95 ' + (base - 2) + 'V' + (base + 6), P('#2E5F8A'), 0.9);
    if (A.night) s += circ(48, 70, 34, 'url(#ff-glow)', ' opacity=".22"');
    const wh = [40, 34, 34, 34]; // the wheat: from the corner of his mouth (40, 68)
    return { svg: svg(s, w, h, 'sage-svg'), w, h, ax: cx, ay: base, sign: [50, 14, 50, 16], wheat: wh, wheatSvg: svg(wheat(wh[2], wh[3]), wh[2], wh[3], 'sage-wheat-svg') };
  }

  /* his portrait (the quiz): straw hat, bushy white brows, a wink, a big beard and his wheat */
  function sageFace(size) {
    const ln = '#4A3426', skin = '#F2C29B', straw = '#EDBE52', strawD = '#B8923A', beard = '#F4F2EE', beardD = '#C9C3B6';
    let s = circ(50, 54, 46, '#FFE9B0');
    s += path('M12 100Q14 77 50 75Q86 77 88 100Z', '#D65A4A', stroke(ln, 1.4));
    s += line('M30 82v18M70 82v18', '#3F6FB5', 6) + circ(30, 86, 2, '#F2D27A') + circ(70, 86, 2, '#F2D27A');
    s += circ(29, 58, 5.5, skin, stroke(ln, 1.2)) + circ(71, 58, 5.5, skin, stroke(ln, 1.2));
    s += circ(50, 56, 21, skin, stroke(ln, 1.4));
    // the beard (a soft cloud under the chin)
    s += path('M30 63Q27 80 38 86Q44 92 50 89Q56 92 62 86Q73 80 70 63Q62 72 50 72Q38 72 30 63Z', beard, stroke(beardD, 1.3));
    s += line('M40 78q3 4 2 8M50 80v6M60 78q-3 4 -2 8', beardD, 1);
    // the face: a wink, a twinkle, a round nose, rosy cheeks, a moustache and a grin
    s += line('M37.5 55q4.5 -3.6 9 0', ln, 2) + circ(60, 54.5, 2.9, '#2B2A26') + circ(61, 53.4, 1, '#FFFFFF');
    s += line('M36 48.5q5 -4 11 -1.5M54 47q6 -2.6 11 1.5', '#E9E5DC', 4.2) + line('M36 48.5q5 -4 11 -1.5M54 47q6 -2.6 11 1.5', beardD, 0.8);
    s += ell(36.5, 62, 4, 2.6, '#FF8FA8', ' opacity=".6"') + ell(63.5, 62, 4, 2.6, '#FF8FA8', ' opacity=".6"');
    s += ell(50, 61.5, 5.2, 4.4, '#E8A882', stroke(ln, 1));
    s += path('M50 66.5Q43 62.5 36.5 68Q44 71.5 50 68.5Q56 71.5 63.5 68Q57 62.5 50 66.5Z', beard, stroke(beardD, 1));
    s += line('M45.5 71.5q4.5 2.6 9 0', ln, 1.4);
    // the wheat from the corner of his mouth
    s += '<g transform="translate(54 47)">' + wheat(34, 26) + '</g>';
    // the straw hat
    s += ell(50, 38, 39, 8.5, straw, stroke(strawD, 1.4));
    s += path('M29 38Q28 13 50 13Q72 13 71 38Z', straw, stroke(strawD, 1.4));
    s += path('M29.3 32.5Q50 26.5 70.7 32.5L71 37.6Q50 31.8 29 37.6Z', '#C2453A');
    s += line('M37 21q6 -4 14 -4M33 29q0 -6 3 -10M63 18q5 4 6 11', '#F6D677', 1.1) + line('M15 41q12 4 24 4M61 45q12 -1 23 -5', strawD, 0.8);
    return svg(s, 100, 100, 'sage-face', size || 72);
  }

  A.sageMan = sageMan;
  A.sageFace = sageFace;
})(window);
