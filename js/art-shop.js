/* ============================================================
   FamFi — art-shop.js
   Shop art: gems 💎 (the shop's currency), the 15 house
   decorations (roof · door · yard · sky) and the 8 exclusive pets,
   plus houseHtml() — a house with its decorations and pets as one
   HTML block for previews.

   Each decoration is drawn as one or more small layers placed
   on the house's anchor points (from art.house meta). In the
   village every layer is its own element, so anything that moves
   (a waving lucky cat, a bobbing balloon) animates on the GPU
   without repainting the house.
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
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const OUT_L = [-0.894, 0.447];
  const eye = (x, y, r) => '<g class="eo">' + circ(x, y, r || 1.4, '#2B2A26') + circ(x + 0.45, y - 0.45, 0.45, '#fff') + '</g><path class="ec" d="M' + (x - 1.5) + ' ' + y + 'q1.5 1.2 3 0" stroke="#2B2A26" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
  const sleepyEye = (x, y) => '<path d="M' + f1(x - 1.6) + ' ' + f1(y) + 'q1.6 1.3 3.2 0" stroke="#2B2A26" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
  /* a layer: local drawing (w×h) whose point (ax, ay) sits on house point p */
  const L = (id, p, w, h, ax, ay, inner, o) => Object.assign({ id, x: p[0] - ax, y: p[1] - ay, w, h, inner }, o || {});

  /* =========================================================
     GEMS — the shop's currency
     ========================================================= */
  function gem(size, cls) {
    const s = size || 18;
    return '<svg class="gem-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true">' +
      '<path d="M6.5 3.5h11l4 5.6L12 21 2.5 9.1z" fill="#3DB2E8" stroke="#1F6FA8" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M6.5 3.5h11l4 5.6h-19z" fill="#8FE0FF"/><path d="M9 9.1l3-5.6 3 5.6z" fill="#D2F4FF"/>' +
      '<path d="M2.5 9.1H9L12 21z" fill="#2B9AD6"/><path d="M15 9.1h6.5L12 21z" fill="#1E80BE"/><path d="M9 9.1h6L12 21z" fill="#5CC8F2"/>' +
      '<path d="M6.5 3.5h11l4 5.6L12 21 2.5 9.1z" fill="none" stroke="#1F6FA8" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M18.4 1.2l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="#FFFFFF"/></svg>';
  }
  /* one pumpkin (the garden's pumpkin patch) */
  function pumpkin(x, y, k, c) {
    const o = P(c || '#F08A3C'), od = P(A.shade(c || '#F08A3C', 0.72)), ol = P(A.shade(c || '#F08A3C', 1.15));
    return ell(x, y - 6 * k, 9 * k, 6.5 * k, o, ' stroke="' + od + '" stroke-width="' + f1(k) + '"') +
      ell(x, y - 6 * k, 4.5 * k, 6.3 * k, 'none', ' stroke="' + od + '" stroke-width="' + f1(0.9 * k) + '"') + ell(x - 4.5 * k, y - 8 * k, 2 * k, 2.6 * k, ol, ' opacity=".8"') +
      path('M' + f1(x) + ' ' + f1(y - 12 * k) + 'q' + f1(1 * k) + ' ' + f1(-4 * k) + ' ' + f1(3.5 * k) + ' ' + f1(-4.5 * k), 'none', ' stroke="' + P('#5E7D2E') + '" stroke-width="' + f1(1.8 * k) + '" stroke-linecap="round"');
  }

  /* =========================================================
     DECORATIONS — draw(id, a) → [layers]; a = house anchors
     ========================================================= */
  const DRAW = {
    /* ---- door ---- */
    wreath(a) {
      const p = a.lf(a.door.s, a.door.h * 0.62);
      let s = '<g transform="matrix(1 .5 0 1 9 9)">';
      for (let q = 0; q < 12; q++) { const t = (q / 12) * Math.PI * 2; s += ell(Math.cos(t) * 4.6, Math.sin(t) * 4.6, 2.2, 1.4, P(q % 2 ? '#3E9B55' : '#5DBB6A'), ' transform="rotate(' + Math.round(t * 57.3 + 90) + ' ' + f1(Math.cos(t) * 4.6) + ' ' + f1(Math.sin(t) * 4.6) + ')"'); }
      [[-3.4, -3], [3.6, -2.2], [0.4, 4.4], [-4.4, 2]].forEach((b, i) => { s += circ(b[0], b[1], 1.1, P(i % 2 ? '#FF7AA2' : '#E0463A')); });
      s += path('M-2.6 5.6l2.6-1.6 2.6 1.6-1 2.6L0 6.4l-1.6 1.8z', P('#FF7AA2')) + '</g>';
      return [L('wreath', p, 18, 22, 9, 9, s)];
    },
    lanterns(a) {
      const one = (k) => {
        let s = '';
        if (A.night) s += circ(8, 13, 11, 'url(#ff-glow)', ' opacity=".9"');
        s += path('M8 0v4', 'none', ' stroke="' + P('#3D3A36') + '" stroke-width="1"');
        s += '<g class="dk-swing">' + rect(5, 4, 6, 1.8, 0.8, P('#E8B032')) + ell(8, 11, 5.2, 6.2, P(A.night ? '#FF6B4A' : '#E0463A'), ' stroke="' + P('#A52A1E') + '" stroke-width=".8"') +
          path('M8 5c-3 2-3 10 0 12M8 5c3 2 3 10 0 12', 'none', ' stroke="' + P('#A52A1E') + '" stroke-width=".7" fill="none" opacity=".7"') + ell(6.4, 9.4, 1.2, 2.4, '#FFFFFF', ' opacity=".35"') +
          rect(5, 16.6, 6, 1.8, 0.8, P('#E8B032')) + path('M8 18.4v3', 'none', ' stroke="' + P('#E8B032') + '" stroke-width="1.4"') + path('M6.6 21.4h2.8l-.5 3h-1.8z', P('#E8B032')) + '</g>';
        return s;
      };
      const l = a.lf(a.door.d0 - 4.5, a.door.h + 4), r = a.lf(a.door.d0 + a.door.w + 4.5, a.door.h + 4);
      return [L('lanterns', l, 16, 26, 8, 0, one(0), { cls: 'dk-lantern' }), L('lanterns', r, 16, 26, 8, 0, one(1), { cls: 'dk-lantern dk-late' })];
    },
    luckycat(a) {
      const p = lerp2(a.lf(a.door.d0 - 8, 0), [a.lf(a.door.d0 - 8, 0)[0] + OUT_L[0] * 9, a.lf(a.door.d0 - 8, 0)[1] + OUT_L[1] * 9], 1);
      const w = P('#FFFDF6'), ln = P('#D9CFC0');
      let s = ell(11, 25, 8, 2, 'rgba(30,40,10,.22)');
      s += ell(11, 19, 7.4, 6.4, w, ' stroke="' + ln + '" stroke-width=".8"') + ell(14, 18, 2.4, 2.6, P('#F2A65A'), ' opacity=".9"');
      s += path('M5 9l1-5 3.6 3zM17 9l-1-5-3.6 3z', w, ' stroke="' + ln + '" stroke-width=".8"') + path('M5.8 8l.6-2.6 1.8 1.6zM16.2 8l-.6-2.6-1.8 1.6z', P('#FFB3C7'));
      s += circ(11, 11, 6.4, w, ' stroke="' + ln + '" stroke-width=".8"') + ell(7.6, 9.4, 2.2, 2, P('#2B2A26'), ' opacity=".85"');
      s += path('M8.2 11.4q1.2 1 2.4 0M11.6 11.4q1.2 1 2.4 0', 'none', ' stroke="#2B2A26" stroke-width="1" fill="none" stroke-linecap="round"');
      s += circ(11.1, 13, 0.7, P('#FF8FA0')) + circ(7.6, 13.4, 1.2, P('#FFB3C7'), ' opacity=".7"') + circ(14.6, 13.4, 1.2, P('#FFB3C7'), ' opacity=".7"');
      s += path('M5.6 16.2q5.4 2.4 10.8 0', 'none', ' stroke="' + P('#E0463A') + '" stroke-width="1.6" fill="none"') + circ(11, 17.6, 1.4, P('#FFC23D'), ' stroke="' + P('#C98A12') + '" stroke-width=".5"');
      s += rect(7.4, 20, 7.2, 4.6, 1, P('#FFC23D'), ' stroke="' + P('#C98A12') + '" stroke-width=".6"') + path('M9 22.3h4', 'none', ' stroke="' + P('#C98A12') + '" stroke-width=".7"');
      s += '<g class="dk-wave" style="transform-origin:17px 16px">' + ell(18.6, 10.5, 2.4, 4.4, w, ' stroke="' + ln + '" stroke-width=".8"') + circ(18.6, 6.8, 2.2, w, ' stroke="' + ln + '" stroke-width=".8"') + '</g>';
      return [L('luckycat', p, 24, 28, 11, 25, s)];
    },
    /* ---- roof ---- */
    nest(a) {
      const p = lerp2(a.ridge[0], a.ridge[1], 0.3);
      let s = path('M2 12q9 6 18 0l-1.6-3h-14.8z', P('#9B6B43'), ' stroke="' + P('#6E4628') + '" stroke-width=".8"');
      s += path('M3 10.4q8 3 16 0M4 12q7 2.6 14 0', 'none', ' stroke="' + P('#C99260') + '" stroke-width=".7" fill="none"');
      s += '<g class="dk-bob">' + circ(8, 7.6, 3.2, P('#7FC8F2')) + path('M10.6 7.2l2.2.6-2.2.8z', P('#F7A928')) + circ(8.9, 6.8, 0.65, '#2B2A26') + '</g>';
      s += '<g class="dk-bob dk-late">' + circ(14.2, 8, 2.8, P('#FFD84D')) + path('M16.6 7.8l2 .5-2 .7z', P('#F7A928')) + circ(15, 7.3, 0.6, '#2B2A26') + '</g>';
      return [L('nest', p, 22, 15, 11, 12.5, s)];
    },
    lights(a) {
      const pts = [a.eaveL, a.eaveF, a.eaveR].map((q) => [q[0], q[1] + 2.5]);
      const x0 = Math.min.apply(null, pts.map((q) => q[0])) - 6, y0 = Math.min.apply(null, pts.map((q) => q[1])) - 4;
      const w = Math.max.apply(null, pts.map((q) => q[0])) + 6 - x0, h = Math.max.apply(null, pts.map((q) => q[1])) + 10 - y0;
      const loc = (q) => [q[0] - x0, q[1] - y0];
      let wire = '', ga = '', gb = '';
      const cols = ['#FFD84D', '#FF7AA2', '#7FE0D0', '#FF9F43', '#B98CFF'];
      let k = 0;
      for (let seg = 0; seg < 2; seg++) {
        const s0 = loc(pts[seg]), s1 = loc(pts[seg + 1]);
        const n = Math.max(4, Math.round(Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) / 7));
        for (let q = 0; q < n; q++) {
          const p0 = lerp2(s0, s1, q / n), p1 = lerp2(s0, s1, (q + 1) / n);
          wire += 'M' + f1(p0[0]) + ' ' + f1(p0[1]) + 'Q' + f1((p0[0] + p1[0]) / 2) + ' ' + f1((p0[1] + p1[1]) / 2 + 2.6) + ' ' + f1(p1[0]) + ' ' + f1(p1[1]);
          const b = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + 2.2];
          const c = cols[k % cols.length];
          const bulb = (A.night ? circ(b[0], b[1] + 1.6, 3.6, c, ' opacity=".35"') : '') + ell(b[0], b[1] + 1.6, 1.3, 1.7, P(c)) + rect(b[0] - 0.8, b[1] - 0.4, 1.6, 1, 0.3, P('#5B5A55'));
          if (k % 2) gb += bulb; else ga += bulb;
          k++;
        }
      }
      const s = '<path d="' + wire + '" stroke="' + P('#3D4A3A') + '" stroke-width=".8" fill="none"/><g class="dk-tw">' + ga + '</g><g class="dk-tw dk-late">' + gb + '</g>';
      return [{ id: 'lights', x: x0, y: y0, w, h, inner: s }];
    },
    roofcat(a) {
      const top = lerp2(a.ridge[0], a.ridge[1], 0.42), eave = lerp2(a.eaveF, a.eaveR, 0.42);
      const p = lerp2(top, eave, 0.28);
      const fur = P('#F2A65A'), furD = P('#D9803A'), wh = P('#FFF6EA');
      let s = '<g class="dk-tail" style="transform-origin:5px 10px">' + path('M5 10c-4 1-5 6-3 9', 'none', ' stroke="' + furD + '" stroke-width="3" fill="none" stroke-linecap="round"') + '</g>';
      s += ell(13, 10, 9, 4.6, fur, ' stroke="' + furD + '" stroke-width=".7"') + path('M9 6.2v3M12.6 5.6v3.2M16 6v3', 'none', ' stroke="' + furD + '" stroke-width="1.1" stroke-linecap="round"');
      s += ell(20, 13, 3.6, 1.6, wh);
      s += circ(23, 8.4, 4.6, fur, ' stroke="' + furD + '" stroke-width=".7"') + path('M19.6 5.6l.6-3.6 2.6 2.4zM24.6 4.2l2.6-2.2.6 3.6z', fur) + ell(24.6, 10, 2.2, 1.5, wh);
      s += sleepyEye(22, 8.4) + sleepyEye(25.6, 8.2) + circ(24.8, 9.6, 0.5, P('#FF8FA0'));
      s += '<g class="dk-zz"><text x="27" y="2" font-size="5" font-weight="900" fill="#FFFFFF" stroke="' + P('#5B6B88') + '" stroke-width=".4" font-family="Fredoka, sans-serif">z</text></g>';
      return [L('roofcat', p, 32, 20, 14, 13, s)];
    },
    vane(a) {
      const p = lerp2(a.ridge[0], a.ridge[1], 0.42);
      const gold = P('#E8B032'), goldD = P('#B9852A'), goldL = P('#FFE27A');
      let s = path('M12 34V12', 'none', ' stroke="' + P('#5B4A3A') + '" stroke-width="1.6"') + circ(12, 33.5, 2, P('#5B4A3A'));
      s += path('M4 20h16M12 16v8', 'none', ' stroke="' + goldD + '" stroke-width="1"') + '<text x="20.6" y="21.6" font-size="4" font-weight="900" fill="' + goldD + '" font-family="Fredoka, sans-serif">E</text>';
      s += '<g class="dk-spin" style="transform-origin:12px 10px">' + path('M5 12l2-3.2 1.6 1.6 3-4.4 4.2 1.4 1-3.4 2.2 2.4-1.2 1.4 1.8 2.6-2.8.4-1.6 3.4H8.6z', gold, ' stroke="' + goldD + '" stroke-width=".8" stroke-linejoin="round"') +
        path('M14 4.4l.8-2.2 1.4 1.6z', P('#E0463A')) + circ(15.8, 6, 0.6, '#2B2A26') + path('M6 11.4h9', 'none', ' stroke="' + goldL + '" stroke-width=".8"') + '</g>';
      return [L('vane', p, 26, 36, 12, 33.5, s)];
    },
    /* ---- yard ---- */
    gnome(a) {
      let s = ell(8, 21, 6.4, 1.8, 'rgba(30,40,10,.22)');
      s += rect(4.4, 17.4, 3, 3.6, 1, P('#6E4628')) + rect(8.6, 17.4, 3, 3.6, 1, P('#6E4628'));
      s += path('M3.6 18c0-5 1.6-8 4.4-8s4.4 3 4.4 8z', P('#3D7FD1')) + rect(3.6, 14.4, 8.8, 1.6, 0.5, P('#8A5A30'));
      s += path('M4.4 11c0 4 1.6 6.6 3.6 6.6s3.6-2.6 3.6-6.6z', P('#FFFFFF'), ' stroke="' + P('#E2DCD2') + '" stroke-width=".5"');
      s += circ(8, 9.4, 2.8, P('#F6C8A6')) + circ(8, 10.4, 1.2, P('#F0A88A')) + circ(6.8, 8.8, 0.5, '#2B2A26') + circ(9.2, 8.8, 0.5, '#2B2A26');
      s += path('M4.6 8.4C5 3.6 7.6 0 10.6 0.6 9 3 11.6 5.8 11.6 8.4z', P('#E0463A')) + circ(10.8, 0.9, 1, P('#FFF'));
      s += path('M13 21v-5', 'none', ' stroke="' + P('#FFF4E0') + '" stroke-width="1.6"') + path('M10.6 16.4a2.6 2 0 0 1 5 0z', P('#E0463A')) + circ(12.4, 15.4, 0.5, '#fff') + circ(14, 15.8, 0.45, '#fff');
      return [L('gnome', a.yard, 18, 23, 8, 21, s)];
    },
    birdbath(a) {
      const st = P('#D7D0C2'), sd = P('#ADA492');
      let s = ell(11, 21, 8, 2, 'rgba(30,40,10,.22)');
      s += ell(11, 20.4, 5, 1.6, sd) + path('M9.4 20V12h3.2v8z', st) + path('M11 12V20', 'none', ' stroke="' + sd + '" stroke-width=".6"');
      s += ell(11, 11.6, 9.4, 3.4, sd) + ell(11, 10.8, 9.4, 3.4, st) + ell(11, 10.6, 7.6, 2.4, A.night ? '#4C7FB8' : P('#7FD3F2'));
      s += ell(9, 10, 2.4, 0.6, '#FFFFFF', ' opacity=".6"');
      s += '<g class="dk-hop">' + ell(17, 6.6, 3, 2.4, P('#FF8A4C')) + circ(19.2, 4.8, 1.9, P('#FF8A4C')) + path('M20.8 4.6l1.6.4-1.6.6z', P('#F7C23D')) + circ(19.6, 4.4, 0.45, '#2B2A26') + path('M15 6.2l-2.4-.6 1.8 2z', P('#D9632A')) + path('M16.6 8.6v1.6M18 8.6v1.6', 'none', ' stroke="' + P('#C9772A') + '" stroke-width=".6"') + '</g>';
      return [L('birdbath', a.yard, 24, 23, 11, 21, s)];
    },
    pumpkins(a) {
      let s = ell(14, 15, 12, 2.4, 'rgba(30,40,10,.22)');
      s += path('M2 14q6-5 11-1t13-1', 'none', ' stroke="' + P('#5E9A3C') + '" stroke-width="1.2" fill="none"') + ell(4, 12, 3.4, 1.8, P('#6BAA40')) + ell(24, 11.4, 3.2, 1.6, P('#6BAA40'));
      s += pumpkin(19.5, 15.6, 0.62, '#F7A531') + pumpkin(10, 16, 0.78) + pumpkin(15.6, 17.4, 0.5, '#E86A2A');
      return [L('pumpkins', a.yard, 28, 19, 14, 15, s)];
    },
    snowman(a) {
      let s = ell(9, 24, 7.4, 1.9, 'rgba(30,40,10,.2)');
      s += circ(9, 18.6, 6, P('#FFFFFF'), ' stroke="' + P('#C9DDEB') + '" stroke-width=".8"') + circ(9, 9.6, 4.6, P('#FFFFFF'), ' stroke="' + P('#C9DDEB') + '" stroke-width=".8"');
      s += path('M4.6 12.6q4.4 2.4 8.8 0l.4 2q-4.8 2.2-9.6 0z', P('#E0563F')) + rect(11, 13, 2.2, 4.6, 0.8, P('#E0563F'), ' transform="rotate(12 12 13)"');
      s += rect(5, 4.4, 8, 1.8, 0.6, P('#2B2A26')) + rect(6.2, 0, 5.6, 5, 0.6, P('#2B2A26')) + rect(6.2, 3, 5.6, 1, 0, P('#E0563F'));
      s += circ(7.6, 8.8, 0.6, '#2B2A26') + circ(10.4, 8.8, 0.6, '#2B2A26') + path('M9 10l3.6 1-3.6.6z', P('#F08A3C'));
      s += path('M3.4 17l-3-3M14.6 17l3.2-3.4', 'none', ' stroke="' + P('#7A5236') + '" stroke-width="1" stroke-linecap="round"');
      return [L('snowman', a.yard, 18, 26, 9, 24, s)];
    },
    koi(a) {
      const water = A.night ? 'url(#ff-water-n)' : 'url(#ff-water)';
      let s = ell(17, 10, 16.5, 7.6, P('#C9C2B5'), ' stroke="' + P('#A39B8C') + '" stroke-width=".8"');
      for (let q = 0; q < 9; q++) { const t = (q / 9) * Math.PI * 2; s += ell(17 + Math.cos(t) * 15, 10 + Math.sin(t) * 6.6, 3, 2, P(q % 2 ? '#D9D2C6' : '#C4BCAE'), ' stroke="' + P('#A39B8C') + '" stroke-width=".5"'); }
      s += ell(17, 10, 12.6, 5, water) + ell(13, 8, 5, 1.2, '#FFFFFF', ' opacity=".4"');
      // the two koi circle the pond's middle (17, 10) on a ring squashed to .42 (layerHtml builds it)
      s += '<g class="dk-orbit" data-orbit="17 10 .42">' +
        '<g transform="translate(6.5 0) rotate(90)">' + ell(0, 0, 3.4, 1.4, P('#F08A3C')) + path('M-3.2 0l-2.2-1.4v2.8z', P('#F08A3C')) + '</g>' +
        '<g transform="translate(-6.5 0) rotate(-90)">' + ell(0, 0, 3.4, 1.4, P('#FFFFFF')) + circ(1, 0, 0.9, P('#E0463A')) + path('M-3.2 0l-2.2-1.4v2.8z', P('#FFFFFF')) + '</g></g>';
      s += path('M24 12.6m4 0a4 2.2 0 1 1 -1.4 -2l-2.6 2z', P('#5DB04C'), ' stroke="' + P('#3E8A35') + '" stroke-width=".6"');
      return [L('koi', [a.yard[0] - 2, a.yard[1]], 34, 20, 17, 12, s)];
    },
    /* ---- sky ---- */
    kite(a) {
      const ky = Math.max(a.top + 36, -158);
      const top = [80, ky], ground = [56, 4];
      const w = 40, h = ground[1] - top[1] + 26;
      const x0 = 50, y0 = top[1] - 20;
      const kx = top[0] - x0, kyl = top[1] - y0;
      let s = path('M' + f1(ground[0] - x0) + ' ' + f1(ground[1] - y0) + 'Q' + f1(kx - 16) + ' ' + f1((kyl + ground[1] - y0) / 2) + ' ' + f1(kx) + ' ' + f1(kyl + 6), 'none', ' stroke="' + P('#FFFFFF') + '" stroke-width=".7" fill="none" opacity=".9"');
      s += '<g transform="translate(' + f1(kx) + ' ' + f1(kyl) + ') rotate(10)">';
      // wau bulan: wide top wings, slim waist, crescent-moon tail
      s += path('M-15-8Q0-17 15-8Q8-5 2-5L2 0Q12 2 13 9Q6 4 0 10Q-6 4-13 9Q-12 2-2 0L-2-5Q-8-5-15-8z', P('#E0463A'), ' stroke="' + P('#8E2A1E') + '" stroke-width=".8" stroke-linejoin="round"');
      s += path('M-10-8Q0-13 10-8Q5-6 0-6Q-5-6-10-8z', P('#FFC23D'));
      s += path('M-8 6Q0 1 8 6Q4 4.6 0 7Q-4 4.6-8 6z', P('#2A9D8F'));
      s += circ(0, -2, 1.6, P('#FFC23D')) + path('M0-15v-4M-4-18q4 2 8 0', 'none', ' stroke="' + P('#8E2A1E') + '" stroke-width=".7" fill="none"');
      s += '</g>';
      // a ribbon tail
      s += path('M' + f1(kx + 2) + ' ' + f1(kyl + 10) + 'q-3 6 1 10t-1 10', 'none', ' stroke="' + P('#FFC23D') + '" stroke-width="1.2" fill="none" stroke-linecap="round"');
      return [{ id: 'kite', x: x0, y: y0, w, h, inner: s, cls: 'dk-sky', origin: f1(ground[0] - x0) + 'px ' + f1(ground[1] - y0) + 'px' }];
    },
    balloon(a) {
      const by = Math.max(a.top + 24, -170);
      const p = [-78, by];
      const cols = ['#E0563F', '#FFC23D', '#2A9D8F', '#FFC23D', '#E0563F'];
      let s = '';
      const cx = 15, cy = 15;
      s += path('M' + cx + ' 1C' + (cx + 15) + ' 1 ' + (cx + 15) + ' 22 ' + (cx + 4) + ' 30h-8C' + (cx - 15) + ' 22 ' + (cx - 15) + ' 1 ' + cx + ' 1z', P(cols[0]), ' stroke="' + P('#8E2A1E') + '" stroke-width=".8"');
      [[-8.6, 1], [-3, 2], [3, 3]].forEach((sg, i) => { s += path('M' + cx + ' 1C' + f1(cx + sg[0] - 1) + ' 3 ' + f1(cx + sg[0] - 2) + ' 22 ' + f1(cx + sg[0] * 0.4 - 1.4) + ' 30h' + f1(2.8 + Math.abs(sg[0]) * 0.1) + 'C' + f1(cx + sg[0] * 0.8 + 3) + ' 22 ' + f1(cx + sg[0] + 4) + ' 3 ' + cx + ' 1z', P(cols[sg[1]])); });
      s += ell(cx - 6, 10, 2.2, 5, '#FFFFFF', ' opacity=".35"');
      s += path('M' + (cx - 4) + ' 30l1.6 6M' + (cx + 4) + ' 30l-1.6 6', 'none', ' stroke="' + P('#7A5236') + '" stroke-width=".7"');
      s += rect(cx - 3.6, 36, 7.2, 5.4, 1.2, P('#B9824E'), ' stroke="' + P('#7A5236') + '" stroke-width=".7"') + path('M' + (cx - 3.6) + ' 38h7.2', 'none', ' stroke="' + P('#7A5236') + '" stroke-width=".6"');
      return [L('balloon', p, 30, 42, 15, 21, s, { cls: 'dk-sky' })];
    },
    rainbow(a) {
      const peak = Math.max(a.top + 6, -186), base = 2;
      const rx = 88, ry = base - peak;
      const cols = ['#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#4DABF7', '#9775FA'];
      const x0 = -100, y0 = peak - 10, w = 200, h = base - y0 + 8;
      let s = '';
      cols.forEach((c, i) => {
        const r1 = rx - i * 4.4, r2 = ry - i * 4.4;
        s += '<path d="M' + f1(-r1 - x0) + ' ' + f1(base - y0) + 'A' + f1(r1) + ' ' + f1(r2) + ' 0 0 1 ' + f1(r1 - x0) + ' ' + f1(base - y0) + '" stroke="' + P(c) + '" stroke-width="4.6" fill="none" opacity=".8"/>';
      });
      const cloud = (x, y) => circ(x - 6, y, 5.4, '#FFFFFF') + circ(x + 1, y - 3, 6.4, '#FFFFFF') + circ(x + 8, y + 0.6, 5, '#FFFFFF') + ell(x + 1, y + 3.4, 12, 3.6, '#FFFFFF');
      s += '<g opacity="' + (A.night ? 0.55 : 0.95) + '">' + cloud(-rx + 6 - x0, base - y0 - 2) + cloud(rx - 6 - x0, base - y0 - 2) + '</g>';
      return [{ id: 'rainbow', x: x0, y: y0, w, h, inner: s, back: true, cls: 'dk-glow' }];
    }
  };
  /* all layers for a house's decorations (deco: {slot: id}) */
  function decoLayers(deco, meta) {
    const a = meta && meta.a;
    if (!a) return [];
    const out = [];
    FF.play.SLOTS.forEach((slot) => {
      const id = deco && deco[slot];
      if (id && DRAW[id]) DRAW[id](a).forEach((l) => out.push(l));
    });
    return out;
  }
  /* A decoration's moving bits (a waving paw, bobbing birds, a hopping bird, a turning vane,
     a swishing tail, circling koi) each become their own little box laid over the picture, in
     drawing order, and the box moves — never a part inside the drawing: on iPhone a part moving
     inside an SVG makes WebKit redo the whole screen every frame (measured ≈ 300 ms of work a
     second for one bobbing bird; moving a box is done by the graphics chip, ≈ nothing).
     Twinkling lights stay inside: they only change twice a cycle. */
  const PART = /<g class="(dk-(?:wave|bob|tail|zz|spin|hop|orbit)\b[^"]*)"(?: style="transform-origin:([^"]*)")?(?: data-orbit="([^"]*)")?>/;
  function splitParts(inner) {
    const out = [];
    let rest = inner;
    for (let m = PART.exec(rest); m; m = PART.exec(rest)) {
      const tags = /<g\b|<\/g>/g;
      tags.lastIndex = m.index;
      let depth = 0, end = -1;
      for (let x = tags.exec(rest); x; x = tags.exec(rest)) {
        depth += x[0] === '</g>' ? -1 : 1;
        if (!depth) { end = x.index; break; }
      }
      if (end < 0) break;
      out.push({ s: rest.slice(0, m.index) }, { cls: m[1], origin: m[2] || '', orbit: m[3] || '', s: rest.slice(m.index + m[0].length, end) });
      rest = rest.slice(end + 4);
    }
    out.push({ s: rest });
    return out.filter((p) => p.cls || p.s.trim());
  }
  /* one layer as HTML, positioned inside a house box whose (0,0) is at (ox, oy) */
  function layerHtml(l, ox, oy) {
    const w = f1(l.w), h = f1(l.h);
    const pic = (s) => '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' + s + '</svg>';
    const body = splitParts(l.inner).map((p) => {
      if (!p.cls) return pic(p.s);
      if (p.orbit) { // circling around (x, y) on a squashed ring: a still box for the ring, the turning box inside it
        const o = p.orbit.split(' ');
        return '<div class="dk-ring" style="transform:translate(' + o[0] + 'px,' + o[1] + 'px) scale(1,' + o[2] + ')"><div class="dk-part ' + p.cls + '">' +
          '<svg viewBox="-14 -14 28 28" width="28" height="28" aria-hidden="true">' + p.s + '</svg></div></div>';
      }
      return '<div class="dk-part ' + p.cls + '"' + (p.origin ? ' style="transform-origin:' + p.origin + '"' : '') + '>' + pic(p.s) + '</div>';
    }).join('');
    return '<div class="dk dk-' + l.id + (l.cls ? ' ' + l.cls : '') + '" style="left:' + f1(l.x + ox) + 'px;top:' + f1(l.y + oy) + 'px;width:' + w + 'px;height:' + h + 'px' + (l.origin ? ';transform-origin:' + l.origin : '') + '">' + body + '</div>';
  }

  /* =========================================================
     EXCLUSIVE PETS — side view facing right, 48×48, feet ≈ y44
     (same parts as the village animals so the same moves work:
     .an-legs .leg.l1/.l2 · .an-head · .an-tail · .wing)
     ========================================================= */
  const PETS = {
    bunny: () =>
      '<g class="an-tail">' + circ(9.6, 31.6, 3.8, '#FFFFFF', ' stroke="#E6DDE6" stroke-width=".8"') + '</g>' +
      '<g class="an-legs"><ellipse class="leg l2" cx="14.6" cy="42.6" rx="5.2" ry="2.3" fill="#EFE7EF"/></g>' +
      ell(20.5, 34.5, 11.4, 8.6, '#FFFFFF', ' stroke="#E6DDE6" stroke-width=".9"') + ell(14.8, 35.4, 6.2, 6.4, '#F8F3F8') +
      '<g class="an-legs"><ellipse class="leg l1" cx="27.6" cy="42.8" rx="3.2" ry="2" fill="#FFFFFF" stroke="#E6DDE6" stroke-width=".6"/></g>' +
      '<g class="an-head">' +
      path('M26.4 19.4c-3.6-5.6-4-12.6-1.2-14.6 2.8 1.4 4.6 8 3.8 14.4z', '#FFFFFF', ' stroke="#E6DDE6" stroke-width=".8"') +
      path('M30.4 18.2c-.8-6.4 1-13 4.2-13.8 2 2.4 1.4 9-1.8 14.4z', '#FFFFFF', ' stroke="#E6DDE6" stroke-width=".8"') + path('M31.6 16.4c-.2-4.6 1-9 2.8-9.8 1 1.8.6 6.2-1.4 10z', '#FFC7D6') +
      circ(31.4, 24.6, 8.4, '#FFFFFF', ' stroke="#E6DDE6" stroke-width=".9"') + eye(34.4, 23.4, 1.5) + circ(34.6, 27.6, 1.9, '#FFB3C7', ' opacity=".7"') +
      path('M39.4 25.6l-1.8 1.1.2-1.8z', '#FF8FA8') + path('M38 27.6q-1 1.4-2.4.6', 'none', ' stroke="#C9A3B1" stroke-width=".7" fill="none"') + '</g>',
    shiba: () =>
      '<g class="an-tail">' + path('M10.6 25c-5-1.4-5.6-9-.6-10 4.6-.8 5.6 4.6 2.2 6', 'none', ' stroke="#E08A3E" stroke-width="4.4" fill="none" stroke-linecap="round"') + path('M10.6 22.6c-2.4-1-2.6-4.6-.4-5.2', 'none', ' stroke="#FFF1DC" stroke-width="1.6" fill="none" stroke-linecap="round"') + '</g>' +
      '<g class="an-legs"><rect class="leg l2" x="12.6" y="32" width="4.6" height="12" rx="2.3" fill="#D8823A"/><rect class="leg l1" x="27" y="32" width="4.6" height="12" rx="2.3" fill="#D8823A"/></g>' +
      rect(9, 22, 26.6, 15, 7.5, '#EB9B50') + ell(22, 34, 9.4, 3.2, '#FFF1DC') +
      '<g class="an-legs"><rect class="leg l1" x="16" y="33" width="4.6" height="11" rx="2.3" fill="#EB9B50"/><rect class="leg l2" x="30.4" y="33" width="4.6" height="11" rx="2.3" fill="#EB9B50"/><rect class="leg l1" x="16" y="40" width="4.6" height="4" rx="2" fill="#FFF1DC"/><rect class="leg l2" x="30.4" y="40" width="4.6" height="4" rx="2" fill="#FFF1DC"/></g>' +
      '<g class="an-head">' + path('M28 13.4l1.4-8 5.6 5.4zM36 10.6l5.6-4.4.4 8z', '#EB9B50') + path('M29.6 11.6l.8-4 2.8 2.8zM37.6 10.4l2.8-2.2.2 4z', '#FFF1DC') +
      circ(34.4, 18, 8.6, '#EB9B50') + ell(39.6, 21.6, 5.2, 3.8, '#FFF1DC') + ell(31, 21, 3.6, 2.6, '#FFF1DC') + ell(43.6, 20.2, 1.8, 1.4, '#2B2A26') +
      eye(36.6, 16.4, 1.5) + ell(35.2, 13.4, 1.2, 0.8, '#FFF1DC') + circ(36.2, 20.6, 1.6, '#FF9C9C', ' opacity=".55"') + path('M40.4 23.8c1 1.6 2.6 1.4 3-.2', 'none', ' stroke="#8A4A2A" stroke-width=".8" fill="none"') +
      path('M27.4 25.4c3 1.8 6.8 1.8 9.6-.2l-1 3.6c-2.6 1-5.6 1-8-.4z', '#E0463A') + '</g>',
    penguin: () =>
      '<g class="an-legs"><ellipse class="leg l1" cx="19.4" cy="43.4" rx="3.4" ry="1.6" fill="#F7A531"/><ellipse class="leg l2" cx="26.6" cy="43.4" rx="3.4" ry="1.6" fill="#F7A531"/></g>' +
      '<g class="pg-body">' + ell(22.6, 29, 10.6, 13.6, '#2E3A52') + ell(25.4, 31.4, 7.4, 10.8, '#FFFFFF') + ell(25.4, 39, 6, 3, '#F3EFE8') +
      '<g class="wing" style="transform-origin:16px 26px">' + path('M17 25c-5 3-6.6 9-5.4 12.6 3-1.2 6-5 6.6-11z', '#26314A') + '</g>' +
      '<g class="an-head">' + ell(25.6, 19, 7.4, 6.6, '#2E3A52') + ell(28.4, 20.4, 4.6, 4.2, '#FFFFFF') + eye(29.4, 18.6, 1.4) + circ(29.6, 22, 1.5, '#FFB3C7', ' opacity=".7"') +
      path('M33 19.6l4.4 1.2-4.4 1.6z', '#F7A531') + path('M22 13c1-2.4 3-2.8 4.4-1.6', 'none', ' stroke="#2E3A52" stroke-width="1.4" fill="none" stroke-linecap="round"') + '</g></g>',
    redpanda: () =>
      '<g class="an-tail">' + path('M12 28c-6 0-9.6-6-8-12', 'none', ' stroke="#C8552B" stroke-width="7.4" fill="none" stroke-linecap="round"') +
      path('M11.2 27.6c-2-.2-3.4-.8-4.6-2M6.6 23.2c-1-1.6-1.6-3-1.8-4.6', 'none', ' stroke="#EDA266" stroke-width="2.4" fill="none" stroke-linecap="round"') + '</g>' +
      '<g class="an-legs"><rect class="leg l2" x="13" y="33" width="4.4" height="11" rx="2.2" fill="#3D2620"/><rect class="leg l1" x="27" y="33" width="4.4" height="11" rx="2.2" fill="#3D2620"/></g>' +
      rect(10, 23.6, 24.6, 13.6, 6.8, '#C8552B') + ell(22, 35.4, 9, 2.4, '#5A2E20', ' opacity=".55"') +
      '<g class="an-legs"><rect class="leg l1" x="16" y="34" width="4.4" height="10" rx="2.2" fill="#4A2C22"/><rect class="leg l2" x="30" y="34" width="4.4" height="10" rx="2.2" fill="#4A2C22"/></g>' +
      '<g class="an-head">' + path('M27 17.4l1.4-8 6.4 4.6z', '#C8552B') + path('M28.7 15.6l.8-4.4 3.6 2.6z', '#FFFFFF') + path('M36.6 13l6.6-3.8.2 7.6z', '#C8552B') + path('M38.4 12.6l3.8-2.1.1 4.4z', '#FFFFFF') +
      circ(34.6, 19.6, 8.4, '#D7643A') + ell(39.4, 22.8, 4.8, 3.6, '#FFFFFF') + ell(31.8, 16, 2.6, 1.8, '#FFFFFF') + ell(38.4, 15.6, 2.4, 1.6, '#FFFFFF') +
      path('M33.4 20.4c-.4 2-1.6 3.4-3 4', 'none', ' stroke="#8E3518" stroke-width="1.4" fill="none" stroke-linecap="round"') + eye(35.2, 18.6, 1.4) + ell(43.8, 21.6, 1.6, 1.2, '#2B2A26') +
      path('M41.2 24.6c.8 1 2 1 2.6 0', 'none', ' stroke="#8E3518" stroke-width=".7" fill="none"') + '</g>',
    capybara: () =>
      '<g class="an-legs"><rect class="leg l2" x="12" y="35" width="5" height="9" rx="2.4" fill="#8A5E36"/><rect class="leg l1" x="28" y="35" width="5" height="9" rx="2.4" fill="#8A5E36"/></g>' +
      ell(21.6, 30.6, 15.2, 10.4, '#B07D4E') + path('M8 28c2-7 12-10 22-8', 'none', ' stroke="#946437" stroke-width="2.4" fill="none" opacity=".5" stroke-linecap="round"') +
      '<g class="an-legs"><rect class="leg l1" x="15.6" y="36" width="5" height="8" rx="2.4" fill="#9A6A3E"/><rect class="leg l2" x="31.4" y="36" width="5" height="8" rx="2.4" fill="#9A6A3E"/></g>' +
      '<g class="an-head">' + path('M29 16c4-4 12-3.6 15 1.4 2 3.4 1.6 9-1.4 10.4-4 1.8-11 .8-13.6-2.6z', '#B98654', ' stroke="#8A5E36" stroke-width=".8"') +
      circ(31.4, 15.2, 2.4, '#8A5E36') + sleepyEye(36, 19.2) + ell(43.6, 21.4, 1, 0.8, '#5B3A20') + path('M41 26q1.6 1 3 0', 'none', ' stroke="#6E4628" stroke-width=".8" fill="none"') +
      circ(38.4, 23.4, 1.6, '#E8A07A', ' opacity=".5"') +
      '<g class="cp-yuzu">' + circ(36.6, 11.4, 3.6, '#FFB534', ' stroke="#E08A12" stroke-width=".7"') + path('M36.6 7.8q1.4-2.4 3.6-1.6-1 2-3.6 1.6z', '#5DB04C') + circ(35.4, 10.4, 0.9, '#FFE27A', ' opacity=".9"') + '</g></g>',
    tapir: () =>
      '<g class="an-legs"><rect class="leg l2" x="12.4" y="34" width="4.8" height="10" rx="2.4" fill="#3E2A1F"/><rect class="leg l1" x="27.4" y="34" width="4.8" height="10" rx="2.4" fill="#3E2A1F"/></g>' +
      ell(22, 29.6, 14.4, 9.6, '#5B3B2A') +
      path('M10 25q6-3 12 0M12 30q6-3 12 0M10.6 34.4q6-2.4 12 0M22 24q6-2.4 11 .4M24.4 29.6q5-2.4 10 .4', 'none', ' stroke="#F2E2C6" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".95"') +
      [[16, 27.4], [27, 27], [18.6, 32.4], [29.4, 32.4], [13.4, 29.4]].map((d) => ell(d[0], d[1], 1.2, 0.8, '#F2E2C6')).join('') +
      '<g class="an-legs"><rect class="leg l1" x="15.6" y="35" width="4.8" height="9" rx="2.4" fill="#4A3326"/><rect class="leg l2" x="30.6" y="35" width="4.8" height="9" rx="2.4" fill="#4A3326"/></g>' +
      '<g class="an-head">' + circ(31.4, 15.8, 3, '#5B3B2A') + circ(31.4, 15.8, 1.6, '#F2E2C6') +
      path('M28 22c0-6 5-8.6 9.6-7 3 1 4.6 4 4.6 7 2 .4 3.6 1.8 3.4 4-1 .6-2.6.2-3.6-.8-2.2 3-7.6 3.6-11 1.4-2-1.4-3-2.6-3-4.6z', '#5B3B2A') +
      path('M31 19q3-2 6 0', 'none', ' stroke="#F2E2C6" stroke-width="1.4" fill="none" stroke-linecap="round"') + eye(36.4, 21, 1.4) + circ(38.4, 24.6, 1.6, '#E8A07A', ' opacity=".45"') + '</g>',
    fox: () =>
      '<g class="an-tail">' + path('M12 28C4 30 1 22 4 16c3 4 7 5 10 6', '#F08A3C', ' stroke="#C8651E" stroke-width=".8"') + path('M4 16c-1.4 2.6-1.6 5.4-.4 8 1.2-2.4 1.4-5 .4-8z', '#FFFFFF') + '</g>' +
      '<g class="an-legs"><rect class="leg l2" x="13" y="33" width="4" height="11" rx="2" fill="#3A2A22"/><rect class="leg l1" x="27" y="33" width="4" height="11" rx="2" fill="#3A2A22"/></g>' +
      rect(10, 23.6, 24.4, 12.8, 6.4, '#F08A3C') + ell(28.6, 31.6, 5, 4.4, '#FFFFFF') +
      '<g class="an-legs"><rect class="leg l1" x="16" y="34" width="4" height="10" rx="2" fill="#3A2A22"/><rect class="leg l2" x="30" y="34" width="4" height="10" rx="2" fill="#3A2A22"/></g>' +
      '<g class="an-head">' + path('M28.4 14.6l.8-9.4 6.2 6.8zM36.4 11.6l6-7.2 .6 9.4z', '#F08A3C', ' stroke="#C8651E" stroke-width=".7"') + path('M29.8 11.6l.4-4.6 3 3.4zM37.8 10.8l3-3.6.4 4.6z', '#3A2A22') +
      path('M27 19c0-5.6 3.8-8.6 8-8.6s7.6 3 7.6 6.6c2.6 1 4 2.6 4 4.2-2 1.6-6 2.4-10.4 2.2-5-.2-9.2-1.8-9.2-4.4z', '#F08A3C') +
      path('M30 21.4c3.4 1.6 8.6 1.8 16.2 0-2 2.4-6.4 3.8-10.2 3.6-3.2-.2-5.4-1.4-6-3.6z', '#FFFFFF') + eye(36.4, 16.8, 1.45) + circ(46.2, 20.8, 1.3, '#2B2A26') + circ(34.6, 20.4, 1.5, '#FF9C9C', ' opacity=".5"') + '</g>',
    dragon: () =>
      '<g class="dr-fly">' +
      '<g class="wing" style="transform-origin:19px 22px">' + path('M19 23C13 13 6 11 2 13c3 2 4 5 3 8 3-1 6 0 7 3 2-2 5-2 7-1z', '#B79CF5', ' stroke="#8B6CD8" stroke-width=".9" stroke-linejoin="round"') + path('M18 22c-4-5-9-7-13-7M15 23c-2-3-5-4-8-3', 'none', ' stroke="#8B6CD8" stroke-width=".7" fill="none"') + '</g>' +
      '<g class="an-tail">' + path('M11 31c-5 1-8-1-9-4 2 .6 4 .4 5-1', 'none', ' stroke="#6CC79A" stroke-width="4" fill="none" stroke-linecap="round"') + path('M1 25.4l3.6-1-1 3.6z', '#FF9FC0') + '</g>' +
      '<g class="an-legs"><rect class="leg l2" x="14" y="33" width="4.4" height="6" rx="2.2" fill="#5DB88A"/><rect class="leg l1" x="25.6" y="33" width="4.4" height="6" rx="2.2" fill="#5DB88A"/></g>' +
      ell(21.6, 29, 11, 8.6, '#7DD3A8') + path('M15 34c4 2.4 9 2.4 13 0-.4-5-2-9-6.4-9.6-4.2.6-6.2 4.6-6.6 9.6z', '#FFF2C8') +
      path('M17 30.4h9M16.4 33h10.4', 'none', ' stroke="#F1D98E" stroke-width=".8"') +
      path('M13 22.4l2-3 1.4 2.6 2-3.2 1.4 3', '#FF9FC0') +
      '<g class="an-legs"><rect class="leg l1" x="18" y="34" width="4.4" height="6" rx="2.2" fill="#7DD3A8"/><rect class="leg l2" x="28.6" y="34" width="4.4" height="6" rx="2.2" fill="#7DD3A8"/></g>' +
      '<g class="an-head">' + path('M29.4 9.6l1-4.4 2 3.4zM35.4 8.6l2.6-3.8.6 4.4z', '#FFF2C8') + circ(33.6, 16.4, 8.6, '#7DD3A8') + ell(39.6, 19.6, 5.4, 4, '#94DDB7') +
      circ(42.6, 18.4, 0.8, '#3E8A66') + eye(35.4, 14.6, 1.7) + circ(34.6, 19.4, 1.7, '#FF9FC0', ' opacity=".6"') + path('M38.6 22.4q2 1.4 3.8 0', 'none', ' stroke="#3E8A66" stroke-width=".8" fill="none"') +
      '<g class="dr-puff">' + circ(47, 19, 1.6, '#FFC23D') + circ(48.6, 17.6, 1.1, '#FF8A4C') + '</g></g></g>'
  };
  const PET_FLY = { dragon: true };
  function xpet(id) {
    return '<svg class="an-svg" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">' + ell(24, 44.4, 11, 2.8, 'rgba(30,40,10,.22)', ' class="an-shadow"') + '<g class="an-bob">' + (PETS[id] ? PETS[id]() : '') + '</g></svg>';
  }

  /* =========================================================
     A house with its decorations (and, if asked, its pets) as HTML
     ========================================================= */
  function houseHtml(h, lv, o) {
    o = o || {};
    const meta = {};
    const vb = A.HOUSE_VB;
    const svg = A.house(h, lv, { meta, still: o.still });
    const ls = decoLayers(FF.play.shownDeco(h), meta);
    const ox = -vb.x, oy = -vb.y;
    let html = '<div class="hz' + (o.still ? ' still' : '') + '" style="width:' + vb.w + 'px;height:' + vb.h + 'px">';
    ls.filter((l) => l.back).forEach((l) => { html += layerHtml(l, ox, oy); });
    html += svg;
    ls.filter((l) => !l.back).forEach((l) => { html += layerHtml(l, ox, oy); });
    if (o.pets) {
      const spots = [[44, 30], [-40, 34], [70, 12]];
      FF.play.shownPets(h).forEach((id, i) => {
        const sz = (FF.play.item(id) || {}).size || 40, p = spots[i];
        html += '<div class="sp animal xpet an-' + id + ' idle' + (PET_FLY[id] ? ' flyer' : '') + (i === 1 ? ' left' : '') + '" style="left:' + f1(p[0] + ox - sz / 2) + 'px;top:' + f1(p[1] + oy - sz * 0.93) + 'px;width:' + sz + 'px;height:' + sz + 'px"><div class="an-flip">' + xpet(id) + '</div></div>';
      });
    }
    return html + '</div>';
  }
  /* a decoration on its own (shop cards), on a little piece of roof or wall when that's where it goes */
  function decoThumb(id) {
    const it = FF.play.item(id);
    if (!it || !DRAW[id]) return '';
    // a stand-in house: just enough anchors to place each item the way it sits on a real one
    const lf = (s, t) => [-14 + s, 6 + s * 0.5 - t];
    const a = { lf, door: { s: 12, h: 19, d0: 6, w: 12 }, ridge: [[-14, -12], [14, -26]], eaveL: [-28, 2], eaveF: [0, 16], eaveR: [28, 2], yard: [0, 14], top: it.slot === 'sky' ? -60 : -30 };
    const ls = DRAW[id](a);
    const pts = (arr) => arr.map((q) => f1(q[0]) + ',' + f1(q[1])).join(' ');
    let base = null;
    if (it.slot === 'roof') {
      base = '<polygon points="' + pts([a.eaveL, a.eaveF, a.ridge[0]]) + '" fill="' + P('#F0806A') + '" stroke="' + P('#9E3524') + '" stroke-width="1"/>' +
        '<polygon points="' + pts([a.eaveF, a.eaveR, a.ridge[1], a.ridge[0]]) + '" fill="' + P('#E0563F') + '" stroke="' + P('#9E3524') + '" stroke-width="1"/>' +
        '<line x1="' + a.ridge[0][0] + '" y1="' + a.ridge[0][1] + '" x2="' + a.ridge[1][0] + '" y2="' + a.ridge[1][1] + '" stroke="' + P('#F7A08E') + '" stroke-width="2"/>';
    } else if (it.slot === 'door') {
      const d = a.door;
      base = '<polygon points="' + pts([lf(-4, 0), lf(34, 0), lf(34, 30), lf(-4, 30)]) + '" fill="' + P('#FFF1D6') + '" stroke="' + P('#5B3B22') + '" stroke-width="1"/>' +
        '<polygon points="' + pts([lf(d.d0, 0), lf(d.d0 + d.w, 0), lf(d.d0 + d.w, d.h), lf(d.d0, d.h)]) + '" fill="' + P('#2F7D4A') + '" stroke="' + P('#1F5A34') + '" stroke-width=".8"/>';
    }
    const all = ls.slice();
    if (base) all.unshift({ id: 'base', x: -40, y: -40, w: 80, h: 70, inner: '<g transform="translate(40 40)">' + base + '</g>' });
    const xs = ls.map((l) => l.x), ys = ls.map((l) => l.y), xe = ls.map((l) => l.x + l.w), ye = ls.map((l) => l.y + l.h);
    // the base sets the frame for roof/door items; free-standing items frame themselves
    const lo = (arr) => Math.min.apply(null, arr), hi = (arr) => Math.max.apply(null, arr);
    const frame = base ? [Math.min(-30, lo(xs)), Math.min(-28, lo(ys)), Math.max(30, hi(xe)), Math.max(20, hi(ye))] : [lo(xs), lo(ys), hi(xe), hi(ye)];
    const x0 = frame[0], y0 = frame[1], x1 = frame[2], y1 = frame[3];
    const k = Math.min(2.2, 64 / (x1 - x0), 58 / (y1 - y0));
    const inner = all.map((l) => layerHtml(l, -x0, -y0)).join('');
    return '<div class="dthumb dt-' + it.slot + '"><div class="dt-in" style="width:' + f1(x1 - x0) + 'px;height:' + f1(y1 - y0) + 'px;transform:scale(' + k.toFixed(3) + ') translate(-50%,-50%)">' + inner + '</div></div>';
  }

  Object.assign(A, { gem, decoLayers, layerHtml, xpet, PET_FLY, houseHtml, decoThumb, DECO_DRAW: DRAW });
})(typeof window !== 'undefined' ? window : this);
