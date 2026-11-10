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
      (o.noContrib ? '' : '<path d="' + path('contrib') + '" class="ch-contrib" vector-effect="non-scaling-stroke"/>') +
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
      tip.innerHTML = '<b>' + FF.i18n.money(p.value, o.cur) + '</b><span>' + FF.i18n.date(p.day) + '</span>' + (o.noContrib ? '' : '<span class="tip-in">' + FF.i18n.t('ret.chart.in') + ' ' + FF.i18n.money(p.contrib, o.cur, { whole: true }) + '</span>');
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

  FF.charts = { line, donut, bars, color, COLORS };
})(window);
