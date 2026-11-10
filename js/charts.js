/* ============================================================
   FamFi — charts.js
   Small, calm SVG charts: value-vs-money-in line with touch
   scrubbing, the allocation donut, 12-month dividend bars.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const f1 = (n) => Math.round(n * 10) / 10;

  /* categorical colours — fixed per key so a colour always means the same thing */
  const COLORS = {
    stock: '#3D8FD6', etf: '#2F9A4C', crypto: '#8A5BC7', cash: '#E9AE2E',
    banks: '#3D8FD6', tech: '#8A5BC7', energy: '#E0563F', utilities: '#E9AE2E', health: '#2A9D8F', consumer: '#C2477A', telecom: '#5D6B7E',
    property: '#B07A45', broad: '#2F9A4C', bonds: '#79A7D3', gold: '#C9A227', transport: '#F08A3C',
    MYR: '#2F9A4C', USD: '#3D8FD6', SGD: '#E0563F', THB: '#8A5BC7'
  };
  const color = (k, i) => COLORS[k] || ['#2F9A4C', '#3D8FD6', '#E9AE2E', '#E0563F', '#8A5BC7', '#2A9D8F'][i % 6];

  /* ---------- value vs money-in line chart ---------- */
  function line(el, pts, o) {
    o = o || {};
    const W = 340, H = o.height || 170, pad = { t: 14, r: 8, b: 26, l: 8 };
    if (!pts.length) { el.innerHTML = ''; return; }
    const vals = pts.map((p) => p.value).concat(o.noContrib ? [] : pts.map((p) => p.contrib));
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1) { hi += 1; lo -= 1; }
    const span = hi - lo;
    lo -= span * 0.08; hi += span * 0.08;
    const x = (i) => pad.l + (i / Math.max(1, pts.length - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
    const path = (key) => pts.map((p, i) => (i ? 'L' : 'M') + f1(x(i)) + ' ' + f1(y(p[key]))).join('');
    const area = path('value') + 'L' + f1(x(pts.length - 1)) + ' ' + (H - pad.b) + 'L' + f1(x(0)) + ' ' + (H - pad.b) + 'Z';
    const gid = 'lg' + Math.random().toString(36).slice(2, 7);
    const grid = [0.25, 0.5, 0.75].map((q) => '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + f1(pad.t + q * (H - pad.t - pad.b)) + '" y2="' + f1(pad.t + q * (H - pad.t - pad.b)) + '" class="ch-grid"/>').join('');
    el.innerHTML = '<div class="chart-wrap"><svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + FF.esc(o.label || '') + '">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--chart-1)" stop-opacity=".28"/><stop offset="1" stop-color="var(--chart-1)" stop-opacity="0"/></linearGradient></defs>' +
      grid + '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      (o.noContrib ? '' : '<path d="' + path('contrib') + '" class="ch-contrib' + (o.solid2 ? ' solid' : '') + '" vector-effect="non-scaling-stroke"/>') +
      '<path d="' + path('value') + '" class="ch-value" vector-effect="non-scaling-stroke"/>' +
      '</svg><div class="ch-dot"></div><div class="ch-line"></div><div class="ch-tip"></div>' +
      '<div class="ch-axis"><span>' + FF.i18n.dateShort(pts[0].day) + '</span><span>' + FF.i18n.dateShort(pts[pts.length - 1].day) + '</span></div></div>';
    const wrap = el.querySelector('.chart-wrap');
    const dot = el.querySelector('.ch-dot'), ln = el.querySelector('.ch-line'), tip = el.querySelector('.ch-tip');
    const show = (clientX) => {
      const r = wrap.getBoundingClientRect();
      const fx = FF.clamp((clientX - r.left) / r.width, 0, 1);
      const i = Math.round(fx * (pts.length - 1));
      const p = pts[i];
      const px = (x(i) / W) * r.width, py = (y(p.value) / H) * (r.height - 0) * (H / H);
      const svgH = el.querySelector('svg').getBoundingClientRect().height;
      dot.style.transform = 'translate(' + px + 'px,' + (py * svgH / H) + 'px)';
      ln.style.transform = 'translateX(' + px + 'px)';
      tip.innerHTML = '<b>' + FF.i18n.money(p.value, o.cur) + '</b><span>' + FF.i18n.date(p.day) + '</span>' + (o.noContrib ? '' : '<span class="tip-in">' + (o.inLabel || FF.i18n.t('ret.chart.in')) + ' ' + FF.i18n.money(p.contrib, o.cur, { whole: true }) + '</span>');
      const tw = tip.offsetWidth;
      tip.style.transform = 'translateX(' + FF.clamp(px - tw / 2, 0, r.width - tw) + 'px)';
      wrap.classList.add('scrub');
    };
    const hide = () => wrap.classList.remove('scrub');
    wrap.addEventListener('pointerdown', (e) => { wrap.setPointerCapture(e.pointerId); show(e.clientX); });
    wrap.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || wrap.hasPointerCapture(e.pointerId)) show(e.clientX); });
    wrap.addEventListener('pointerup', hide);
    wrap.addEventListener('pointercancel', hide);
    wrap.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  }

  /* ---------- donut ---------- */
  function donut(slices, o) {
    o = o || {};
    const size = o.size || 200, th = o.thickness || 30, r = size / 2 - th / 2 - 2, c = size / 2;
    const total = FF.sum(slices, (s) => s.value) || 1;
    let a0 = -Math.PI / 2;
    const gap = slices.length > 1 ? 0.025 : 0;
    const arcs = slices.map((s, i) => {
      const frac = s.value / total;
      const a1 = a0 + frac * Math.PI * 2;
      const s0 = a0 + gap / 2, s1 = Math.max(s0 + 0.001, a1 - gap / 2);
      const large = s1 - s0 > Math.PI ? 1 : 0;
      const p0 = [c + r * Math.cos(s0), c + r * Math.sin(s0)], p1 = [c + r * Math.cos(s1), c + r * Math.sin(s1)];
      const d = frac >= 0.999 ? 'M' + c + ' ' + (c - r) + 'a' + r + ' ' + r + ' 0 1 1 -0.01 0' : 'M' + f1(p0[0]) + ' ' + f1(p0[1]) + 'A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + f1(p1[0]) + ' ' + f1(p1[1]);
      a0 = a1;
      return '<path class="dn-arc" pathLength="100" data-k="' + FF.esc(s.key) + '" d="' + d + '" stroke="' + (s.color || color(s.key, i)) + '" stroke-width="' + th + '" fill="none" style="--d:' + (i * 70) + 'ms"/>';
    }).join('');
    return '<svg class="donut" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + FF.esc(o.label || '') + '"><circle cx="' + c + '" cy="' + c + '" r="' + r + '" stroke="var(--track)" stroke-width="' + th + '" fill="none"/>' + arcs + '</svg>';
  }

  /* ---------- 12 bars (dividends by month) ---------- */
  function bars(months, o) {
    o = o || {};
    const W = 340, H = 96, pad = 4, bw = (W - pad * 2) / 12;
    const max = Math.max.apply(null, months.map((m) => m.received + m.expected).concat([1]));
    let s = '';
    months.forEach((m, i) => {
      const x = pad + i * bw + bw * 0.18, w = bw * 0.64;
      const hr = (m.received / max) * (H - 22), he = (m.expected / max) * (H - 22);
      const base = H - 16;
      if (hr > 0) s += '<rect x="' + f1(x) + '" y="' + f1(base - hr) + '" width="' + f1(w) + '" height="' + f1(hr) + '" rx="3" class="bar-got"/>';
      if (he > 0) s += '<rect x="' + f1(x) + '" y="' + f1(base - hr - he) + '" width="' + f1(w) + '" height="' + f1(he) + '" rx="3" class="bar-exp"/>';
      if (hr + he <= 0) s += '<rect x="' + f1(x) + '" y="' + (base - 2) + '" width="' + f1(w) + '" height="2" rx="1" class="bar-none"/>';
      s += '<text x="' + f1(x + w / 2) + '" y="' + (H - 3) + '" text-anchor="middle" class="bar-l' + (m.m === o.current ? ' cur' : '') + '">' + FF.esc(FF.i18n.monthNarrow(m.m)) + '</text>';
    });
    return '<svg class="bars" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + FF.esc(o.label || '') + '">' + s + '</svg>';
  }

  /* ============================================================
     Family Finance 3 — more small pictures. All of them are drawn
     once and then left alone: nothing in them moves by itself.
     ============================================================ */
  const uid = (p) => p + Math.random().toString(36).slice(2, 8);
  /* a soft curve through points (each bend is rounded at the mid-points, so it never overshoots) */
  function smooth(P) {
    if (P.length < 3) return P.map((p, i) => (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1])).join('');
    let d = 'M' + f1(P[0][0]) + ' ' + f1(P[0][1]);
    for (let i = 1; i < P.length - 1; i++) d += 'Q' + f1(P[i][0]) + ' ' + f1(P[i][1]) + ' ' + f1((P[i][0] + P[i + 1][0]) / 2) + ' ' + f1((P[i][1] + P[i + 1][1]) / 2);
    const l = P[P.length - 1];
    return d + 'L' + f1(l[0]) + ' ' + f1(l[1]);
  }
  /* a tiny trend line: no axes, no touch — takes its colour from the text colour around it */
  function spark(vals, o) {
    o = o || {};
    const W = o.w || 160, H = o.h || 44, n = vals.length;
    if (n < 2) return '';
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const P = vals.map((v, i) => [(i / (n - 1)) * W, 4 + (1 - (v - lo) / (hi - lo)) * (H - 8)]);
    const d = smooth(P), g = uid('sp');
    return '<svg class="fz-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".34"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + d + 'L' + W + ' ' + H + 'L0 ' + H + 'Z" fill="url(#' + g + ')"/><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  }
  /* a progress ring: pct 0…1, starting at 12 o'clock. Drawn in once (a finite 0.9 s sweep), then still. */
  function ring(pct, o) {
    o = o || {};
    const size = o.size || 120, th = o.th || 12, r = size / 2 - th / 2 - 1, c = size / 2;
    const p = FF.clamp(isFinite(pct) ? pct : 0, 0, 1) * 100;
    return '<svg class="fz-ring" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + FF.esc(o.label || '') + '">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + f1(r) + '" stroke="' + (o.track || 'var(--track)') + '" stroke-width="' + th + '" fill="none"/>' +
      (p > 0.4 ? '<circle class="fz-ring-arc" pathLength="100" cx="' + c + '" cy="' + c + '" r="' + f1(r) + '" stroke="' + (o.color || 'var(--brand)') + '" stroke-width="' + th + '" fill="none" stroke-linecap="round" transform="rotate(-90 ' + c + ' ' + c + ')" style="stroke-dasharray:' + f1(Math.max(0.5, p - (p < 99.5 ? 0 : 0))) + ' 100"/>' : '') + '</svg>';
  }
  /* money in (green) and money out (coral) side by side, month by month; tap a month (data-i) */
  function flow(months, o) {
    o = o || {};
    const W = 340, H = o.height || 150, top = 10, base = H - 22, n = months.length, gw = W / n;
    const max = Math.max.apply(null, months.map((m) => Math.max(m.income, m.expense)).concat([1]));
    const bw = Math.min(16, gw * 0.3), gap = Math.min(4, gw * 0.06);
    let s = '';
    [0.5, 1].forEach((q) => { const y = f1(base - q * (base - top)); s += '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" class="ch-grid"/>'; });
    months.forEach((m, i) => {
      const cx = gw * i + gw / 2;
      const hi = (m.income / max) * (base - top), he = (m.expense / max) * (base - top);
      if (o.sel === i) s += '<rect x="' + f1(gw * i + 2) + '" y="2" width="' + f1(gw - 4) + '" height="' + (H - 4) + '" rx="10" class="fz-flow-sel"/>';
      s += '<rect x="' + f1(cx - bw - gap / 2) + '" y="' + f1(base - Math.max(hi, m.income > 0 ? 2 : 0)) + '" width="' + f1(bw) + '" height="' + f1(Math.max(hi, m.income > 0 ? 2 : 0)) + '" rx="' + f1(Math.min(4, bw / 2)) + '" class="fz-flow-in"/>';
      s += '<rect x="' + f1(cx + gap / 2) + '" y="' + f1(base - Math.max(he, m.expense > 0 ? 2 : 0)) + '" width="' + f1(bw) + '" height="' + f1(Math.max(he, m.expense > 0 ? 2 : 0)) + '" rx="' + f1(Math.min(4, bw / 2)) + '" class="fz-flow-out"/>';
      if (m.income <= 0 && m.expense <= 0) s += '<rect x="' + f1(cx - bw) + '" y="' + (base - 2) + '" width="' + f1(bw * 2) + '" height="2" rx="1" class="bar-none"/>';
      s += '<text x="' + f1(cx) + '" y="' + (H - 6) + '" text-anchor="middle" class="bar-l' + (i === n - 1 ? ' cur' : '') + '">' + FF.esc(n > 8 ? FF.i18n.monthNarrow(m.m) : FF.i18n.monthShort(m.m)) + '</text>';
      if (o.tap) s += '<rect x="' + f1(gw * i) + '" y="0" width="' + f1(gw) + '" height="' + H + '" fill="transparent" data-i="' + i + '" class="fz-flow-hit"/>';
    });
    return '<svg class="fz-flow" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + FF.esc(o.label || '') + '">' + s + '</svg>';
  }
  /* a line with yearly points (planner tools): value and what you paid in, with the area between
     them shaded — the shaded part is what growth added */
  function grow(series, o) {
    o = o || {};
    const W = 340, H = o.height || 170, pad = { t: 12, r: 6, b: 22, l: 6 }, n = series.length;
    if (n < 2) return '';
    const key2 = o.key2 || 'paid';
    const hi = Math.max.apply(null, series.map((p) => Math.max(p.value, p[key2] || 0)).concat([1])) * 1.06;
    const x = (i) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r), y = (v) => pad.t + (1 - v / hi) * (H - pad.t - pad.b);
    const line = (k) => series.map((p, i) => (i ? 'L' : 'M') + f1(x(i)) + ' ' + f1(y(p[k] || 0))).join('');
    const g = uid('gw');
    const between = line('value') + series.slice().reverse().map((p, i) => 'L' + f1(x(n - 1 - i)) + ' ' + f1(y(p[key2] || 0))).join('') + 'Z';
    const under = line(key2) + 'L' + f1(x(n - 1)) + ' ' + (H - pad.b) + 'L' + f1(x(0)) + ' ' + (H - pad.b) + 'Z';
    const first = series[0], last = series[n - 1];
    return '<svg class="fz-grow" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + FF.esc(o.label || '') + '"><defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--chart-1)" stop-opacity=".42"/><stop offset="1" stop-color="var(--chart-1)" stop-opacity=".12"/></linearGradient></defs>' +
      [0.33, 0.66].map((q) => '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + f1(pad.t + q * (H - pad.t - pad.b)) + '" y2="' + f1(pad.t + q * (H - pad.t - pad.b)) + '" class="ch-grid"/>').join('') +
      (o.single ? '' : '<path d="' + under + '" class="fz-grow-paid"/>') + '<path d="' + (o.single ? line('value') + 'L' + f1(x(n - 1)) + ' ' + (H - pad.b) + 'L' + f1(x(0)) + ' ' + (H - pad.b) + 'Z' : between) + '" fill="url(#' + g + ')"/>' +
      (o.single ? '' : '<path d="' + line(key2) + '" class="ch-contrib" vector-effect="non-scaling-stroke"/>') + '<path d="' + line('value') + '" class="ch-value" vector-effect="non-scaling-stroke"/>' +
      (o.target != null && o.target <= hi ? '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + f1(y(o.target)) + '" y2="' + f1(y(o.target)) + '" class="fz-grow-target"/>' : '') +
      '<circle cx="' + f1(x(n - 1)) + '" cy="' + f1(y(last.value)) + '" r="4.5" class="fz-grow-dot"/>' +
      '<text x="' + pad.l + '" y="' + (H - 5) + '" class="bar-l">' + FF.esc(o.x0 != null ? o.x0 : String(first.year)) + '</text><text x="' + (W - pad.r) + '" y="' + (H - 5) + '" text-anchor="end" class="bar-l cur">' + FF.esc(o.x1 != null ? o.x1 : String(last.year)) + '</text></svg>';
  }
  /* a stepped line for "the next 30 days": the balance after each bill and pay day, lowest point marked */
  function steps(pts, o) {
    o = o || {};
    const W = 340, H = o.height || 120, pad = { t: 14, r: 8, b: 20, l: 8 };
    if (pts.length < 2) return '';
    const d0 = pts[0].day, d1 = pts[pts.length - 1].day;
    let lo = Math.min.apply(null, pts.map((p) => p.bal).concat([0])), hi = Math.max.apply(null, pts.map((p) => p.bal).concat([1]));
    const span = hi - lo || 1; hi += span * 0.1; lo -= span * 0.06;
    const x = (d) => pad.l + ((d - d0) / Math.max(1, d1 - d0)) * (W - pad.l - pad.r), y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
    let d = 'M' + f1(x(d0)) + ' ' + f1(y(pts[0].bal));
    for (let i = 1; i < pts.length; i++) d += 'L' + f1(x(pts[i].day)) + ' ' + f1(y(pts[i - 1].bal)) + 'L' + f1(x(pts[i].day)) + ' ' + f1(y(pts[i].bal));
    const g = uid('st'), zero = y(0);
    return '<svg class="fz-steps" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + FF.esc(o.label || '') + '"><defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--chart-2)" stop-opacity=".26"/><stop offset="1" stop-color="var(--chart-2)" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + d + 'L' + f1(x(d1)) + ' ' + (H - pad.b) + 'L' + f1(x(d0)) + ' ' + (H - pad.b) + 'Z" fill="url(#' + g + ')"/>' +
      (lo < 0 ? '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + f1(zero) + '" y2="' + f1(zero) + '" class="fz-steps-zero"/>' : '') +
      '<path d="' + d + '" class="fz-steps-line" vector-effect="non-scaling-stroke"/>' +
      (o.low ? '<circle cx="' + f1(x(o.low.day)) + '" cy="' + f1(y(o.low.bal)) + '" r="5" class="fz-steps-low"/>' : '') +
      '<text x="' + pad.l + '" y="' + (H - 4) + '" class="bar-l">' + FF.esc(FF.i18n.dateShort(d0)) + '</text><text x="' + (W - pad.r) + '" y="' + (H - 4) + '" text-anchor="end" class="bar-l">' + FF.esc(FF.i18n.dateShort(d1)) + '</text></svg>';
  }

  FF.charts = { line, donut, bars, color, COLORS, smooth, spark, ring, flow, grow, steps };
})(window);
