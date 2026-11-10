/* ============================================================
   FamFi — art-news.js
   The News mailbox: a red tin mailbox on a wooden post, a rolled
   newspaper poking out, a little "NEWS" plate — and its flag, up
   when there are stories you haven't seen yet. A still picture
   (nothing animates while you look at the village).
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
  const svg = (inner, w, h, cls) => '<svg class="' + cls + '" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' + inner + '</svg>';

  /* o.flag: the flag is up (fresh news) */
  function newsBox(o) {
    const up = !!(o && o.flag);
    const w = 120, h = 136, cx = 60, base = 124;
    const ln = P('#5A3A22'), red = P('#E0463A'), redD = P('#B5322A'), redL = P('#F26B5B');
    let s = ell(cx + 6, base + 2, 44, 11, 'url(#ff-shadow)');
    // a patch of grass at its foot, two little flowers and a pebble path
    s += ell(cx, base - 2, 30, 8, P('#79C267')) + ell(cx - 8, base - 4, 16, 4.6, P('#94D47F'));
    s += circ(cx - 24, base - 5, 2.8, P('#FFD45A')) + circ(cx - 24, base - 5, 1.1, P('#F08A3C'));
    s += circ(cx + 25, base - 6, 2.6, P('#FF8FA8')) + circ(cx + 25, base - 6, 1, P('#FFF4F6'));
    s += ell(cx + 14, base + 6, 5, 2.2, P('#D9C9A8')) + ell(cx + 26, base + 8, 3.6, 1.8, P('#D9C9A8'));
    // the wooden post and its crossbar
    s += rect(cx - 6, 76, 12, base - 74, 2, P('#B97E48'), stroke(ln, 1.2));
    s += line('M' + (cx - 2) + ' 82v36', P('#9E6A3A'), 0.8) + line('M' + (cx + 2.5) + ' 86v28', P('#9E6A3A'), 0.8);
    s += rect(cx - 19, 70, 38, 8, 2.4, P('#C98E55'), stroke(ln, 1.1)) + line('M' + (cx - 15) + ' 74h30', P('#B07A45'), 0.7);
    // the mailbox, side-on (the door at the front, on the left)
    const x0 = 18, x1 = 98, y0 = 30, y1 = 70, r = 18;
    s += path('M' + x0 + ' ' + y1 + 'V' + (y0 + r) + 'Q' + x0 + ' ' + y0 + ' ' + (x0 + r) + ' ' + y0 + 'H' + (x1 - r) + 'Q' + x1 + ' ' + y0 + ' ' + x1 + ' ' + (y0 + r) + 'V' + y1 + 'Z', red, stroke(ln, 1.4));
    s += path('M' + (x0 + 6) + ' ' + (y0 + 12) + 'Q' + (x0 + 8) + ' ' + (y0 + 5) + ' ' + (x0 + r + 2) + ' ' + (y0 + 4) + 'H' + (x1 - r - 4), 'none', ' stroke="' + redL + '" stroke-width="3" stroke-linecap="round"');
    s += rect(x0, y1 - 6, x1 - x0, 6, 0, redD);
    s += line('M' + (x0 + 30) + ' ' + (y0 + 1) + 'V' + (y1 - 1) + 'M' + (x0 + 56) + ' ' + (y0 + 1) + 'V' + (y1 - 1), redD, 1);
    // the door: a darker arch at the front, with a handle
    s += path('M' + (x0 - 4) + ' ' + (y1 + 1) + 'V' + (y0 + r + 1) + 'Q' + (x0 - 4) + ' ' + (y0 - 2) + ' ' + (x0 + 12) + ' ' + (y0 - 1) + 'V' + (y1 + 1) + 'Z', redD, stroke(ln, 1.3));
    s += rect(x0 - 1, y0 + 26, 5, 3, 1.4, P('#F2D27A'), stroke(ln, 0.6));
    // a rolled newspaper poking out of the door
    s += '<g transform="rotate(-14 ' + (x0 - 2) + ' ' + (y1 - 9) + ')">' + rect(x0 - 16, y1 - 15, 20, 11, 4.5, P('#FFFDF5'), stroke(P('#8C8577'), 0.9)) +
      line('M' + (x0 - 12) + ' ' + (y1 - 12) + 'h11M' + (x0 - 12) + ' ' + (y1 - 9) + 'h12M' + (x0 - 12) + ' ' + (y1 - 6.5) + 'h9', P('#9C978C'), 0.8) + ell(x0 - 16, y1 - 9.5, 2.4, 5.5, P('#ECE6D6'), stroke(P('#8C8577'), 0.8)) + '</g>';
    // the NEWS plate on its side
    s += rect(x0 + 24, y0 + 13, 46, 17, 4, P('#FFF4D6'), stroke(ln, 1.1));
    s += '<text x="' + (x0 + 47) + '" y="' + (y0 + 26) + '" text-anchor="middle" font-family="Fredoka, Nunito, Arial Rounded MT Bold, sans-serif" font-weight="700" font-size="12.5" letter-spacing="1" fill="' + P('#7A3A1E') + '">NEWS</text>';
    // rivets
    [[x0 + 18, y0 + 6], [x1 - 10, y0 + 8], [x0 + 18, y1 - 10], [x1 - 10, y1 - 10]].forEach((p) => { s += circ(p[0], p[1], 1.3, P('#F7B0A6')); });
    // the flag on the far side: up (fresh news) — or down, resting along the box under the plate
    const fx = x1 - 6;
    if (up) {
      const fy = y0 + 22;
      s += rect(fx - 1.6, y0 - 22, 3.2, 44, 1.4, P('#5B5752')) + path('M' + (fx + 1.6) + ' ' + (y0 - 22) + 'h17l-4 6.5 4 6.5h-17z', P('#FFD23F'), stroke(P('#C98A12'), 1)) + circ(fx + 9, y0 - 15.5, 2, P('#F08A3C'));
      s += circ(fx, fy, 2.6, P('#3D3A36'));
    } else {
      const fy = y1 - 9;
      s += rect(fx - 26, fy - 1.5, 26, 3, 1.4, P('#5B5752')) + path('M' + (fx - 26) + ' ' + (fy + 1.5) + 'v8l4-2.5-4-2.5', P('#FFD23F'), stroke(P('#C98A12'), 0.8));
      s += circ(fx, fy, 2.6, P('#3D3A36'));
    }
    if (A.night) s += circ(x0 + 47, y0 + 22, 28, 'url(#ff-glow)', ' opacity=".35"');
    return { svg: svg(s, w, h, 'news-svg'), w, h, ax: cx, ay: base, sign: [x0 + 24, y0 - (up ? 26 : 6), 46, 16] };
  }

  A.newsBox = newsBox;
})(window);
