/* ============================================================
   FamFi — art.js
   Every illustration is generated SVG (no image assets):
   icons, avatars, isometric houses, animals, scenery, the
   Family Goals stand, the village ground and the app logo.
   Night mode (dark theme) re-tints everything via paint().
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const esc = FF.esc;

  /* ---------------- colour helpers ---------------- */
  const hex2rgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(FF.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  const shade = (h, f) => (f < 1 ? mix(h, '#2A1D12', 1 - f) : mix(h, '#FFFFFF', Math.min(1, (f - 1) * 1.6)));
  let night = false;
  const P = (h) => (night ? mix(mix(h, '#1C2652', 0.5), '#000000', 0.08) : h);

  /* ---------------- geometry helpers ---------------- */
  const f1 = (n) => Math.round(n * 10) / 10;
  const pts = (arr) => arr.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ');
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const poly = (arr, fill, stroke, sw, extra) => '<polygon points="' + pts(arr) + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 1.2) + '" stroke-linejoin="round"' : '') + (extra || '') + '/>';
  const line = (a, b, stroke, sw, extra) => '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '" stroke="' + stroke + '" stroke-width="' + (sw || 1) + '" stroke-linecap="round"' + (extra || '') + '/>';
  const circ = (x, y, r, fill, extra) => '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(r) + '" fill="' + fill + '"' + (extra || '') + '/>';
  const ell = (x, y, rx, ry, fill, extra) => '<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(rx) + '" ry="' + f1(ry) + '" fill="' + fill + '"' + (extra || '') + '/>';

  /* ---------------- shared gradients (installed once per page) ---------------- */
  function defs() { return '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + defsInner() + '</defs></svg>'; }
  function defsInner() {
    return '<radialGradient id="ff-shadow"><stop offset="0" stop-color="#1d2a10" stop-opacity=".34"/><stop offset=".6" stop-color="#1d2a10" stop-opacity=".16"/><stop offset="1" stop-color="#1d2a10" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="ff-glow"><stop offset="0" stop-color="#FFE59A" stop-opacity=".95"/><stop offset=".45" stop-color="#FFC94D" stop-opacity=".35"/><stop offset="1" stop-color="#FFB627" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="ff-light" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#C9EC92" stop-opacity=".75"/><stop offset="1" stop-color="#C9EC92" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="ff-dark" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#5E9E3A" stop-opacity=".45"/><stop offset="1" stop-color="#5E9E3A" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="ff-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FD3F2"/><stop offset="1" stop-color="#3A9ED8"/></linearGradient>' +
      '<linearGradient id="ff-water-n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E5D8C"/><stop offset="1" stop-color="#1B3866"/></linearGradient>' +
      '<linearGradient id="ff-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD3FF"/><stop offset="1" stop-color="#D9F4FF"/></linearGradient>' +
      '<linearGradient id="ff-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE27A"/><stop offset=".55" stop-color="#FFC23D"/><stop offset="1" stop-color="#E89A12"/></linearGradient>' +
      '';
  }

  /* =========================================================
     ICONS — 24×24, 2px rounded strokes (currentColor)
     ========================================================= */
  const ICONS = {
    wallet: '<path d="M19 7.5V6a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 6.5"/><path d="M4 6.5V17a3 3 0 0 0 3 3h12a1 1 0 0 0 1-1v-9.5a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 6.5z"/><circle cx="16" cy="14" r="1.3" fill="currentColor" stroke="none"/>',
    trend: '<path d="M3.5 17l5.5-5.5 4 4 7.5-7.5"/><path d="M15 8h5.5v5.5"/>',
    pie: '<path d="M11 4.1A8.5 8.5 0 1 0 19.9 13H11z"/><path d="M14 3.2a8 8 0 0 1 6.8 6.8H14z"/>',
    sprout: '<path d="M12 21v-8"/><path d="M12 13c0-4.4 2.8-7.5 7.5-7.5 0 4.7-3 7.5-7.5 7.5z"/><path d="M12 15c0-3.3-2.3-5.8-6-5.8 0 3.6 2.6 5.8 6 5.8z"/>',
    dividend: '<circle cx="12" cy="15.3" r="5.7"/><path d="M12 9.6V6.5"/><path d="M12 7.2c0-2.3 1.6-3.9 4.2-3.9 0 2.4-1.7 3.9-4.2 3.9z"/><path d="M12 8c0-1.8-1.3-3.1-3.4-3.1 0 1.9 1.4 3.1 3.4 3.1z"/><path d="M10.4 15.3h3.2"/>',
    sliders: '<path d="M4 7h9M18 7h2M4 17h3M11 17h9"/><circle cx="15.5" cy="7" r="2.3"/><circle cx="8.5" cy="17" r="2.3"/>',
    grid: '<rect x="4" y="4" width="6.6" height="6.6" rx="2"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="2"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="2"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.4 2.6 3.7 5.6 3.7 9s-1.3 6.4-3.7 9c-2.4-2.6-3.7-5.6-3.7-9S9.6 5.6 12 3z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    chevR: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>', chevL: '<path d="M14.5 5.5L8 12l6.5 6.5"/>', chevD: '<path d="M5.5 9.5L12 16l6.5-6.5"/>', chevU: '<path d="M5.5 14.5L12 8l6.5 6.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2"/><circle cx="12" cy="7.9" r="1.15" fill="currentColor" stroke="none"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.7v.4"/><circle cx="12" cy="17" r="1.15" fill="currentColor" stroke="none"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.3 10.5V8a3.7 3.7 0 0 1 7.4 0v2.5"/><path d="M12 14.3v2.4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    users: '<circle cx="9" cy="8.5" r="3.6"/><path d="M2.5 19.8a6.5 6.5 0 0 1 13 0"/><path d="M15.8 5.1a3.6 3.6 0 0 1 0 6.8M18.2 13.8a6.5 6.5 0 0 1 3.3 6"/>',
    userPlus: '<circle cx="9.5" cy="8" r="4"/><path d="M2.5 20.5a7 7 0 0 1 14 0"/><path d="M19 7.5v6M16 10.5h6"/>',
    share: '<path d="M12 3.5v11.5"/><path d="M8 7.5l4-4 4 4"/><path d="M6 11H5.5A1.5 1.5 0 0 0 4 12.5v6A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-6a1.5 1.5 0 0 0-1.5-1.5H18"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.6"/><path d="M15.5 8.5V6.2A2.2 2.2 0 0 0 13.3 4H6.2A2.2 2.2 0 0 0 4 6.2v7.1a2.2 2.2 0 0 0 2.2 2.2h2.3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    cash: '<rect x="2.5" y="6" width="19" height="12" rx="2.6"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.6v4.8M18 9.6v4.8"/>',
    cashIn: '<rect x="2.5" y="9" width="19" height="11" rx="2.6"/><circle cx="12" cy="14.5" r="2.2"/><path d="M12 2.8v3.8M10 4.7l2 2 2-2"/>',
    cashOut: '<rect x="2.5" y="9" width="19" height="11" rx="2.6"/><circle cx="12" cy="14.5" r="2.2"/><path d="M12 6.6V2.8M10 4.7l2-2 2 2"/>',
    hammer: '<path d="M13.6 10.4l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4l8.3-8.3"/><path d="M9.4 6.6l4.2-3.6 7.4 7.4-3.6 4.2z"/>',
    brush: '<path d="M14.5 4.5l5 5-7.3 7.3-5-5z"/><path d="M7.2 11.8L5 14c-1.8 1.8-1.4 4.3-2 6 1.7-.6 4.2-.2 6-2l2.2-2.2"/>',
    exit: '<path d="M13.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4.5"/><path d="M9.5 8l-4 4 4 4"/><path d="M5.5 12H15"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.6A8 8 0 0 1 9.4 4a8 8 0 1 0 10.6 10.6z"/>',
    textSize: '<path d="M3.5 18.5L8.5 6l5 12.5M5.4 14h6.2"/><path d="M15 18.5l3-7.5 3 7.5M16 16h4"/>',
    motion: '<path d="M3 8.5h11a3 3 0 1 0-3-3"/><path d="M3 12.5h15.5a3 3 0 1 1-3 3"/><path d="M3 16.5h7"/>',
    sound: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.6a7.6 7.6 0 0 1 0 10.8"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    vibrate: '<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M11 17.2h2M4.8 8.5v7M2 10.5v3M19.2 8.5v7M22 10.5v3"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 1.9-1 1.4-2.1-.6-1.2.2-2.4 1.6-2.4h2a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z"/><circle cx="7.8" cy="11" r="1.3" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7.3" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="7.8" r="1.3" fill="currentColor" stroke="none"/>',
    logout: '<path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"/><path d="M15 8l4 4-4 4M9 12h10"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    flag: '<path d="M5.5 21V4"/><path d="M5.5 4.5h11l-2 4 2 4h-11"/>',
    leaf: '<path d="M5 19.5C5 11 10 5 20 5c0 10-6 15-14.5 15"/><path d="M5 19.5l7.5-7.5"/>',
    paw: '<ellipse cx="6.5" cy="11" rx="1.9" ry="2.3"/><ellipse cx="10.2" cy="6.8" rx="1.9" ry="2.4"/><ellipse cx="14.8" cy="6.8" rx="1.9" ry="2.4"/><ellipse cx="18.3" cy="11" rx="1.9" ry="2.3"/><path d="M8.3 17.6c0-2.6 1.9-5 4.2-5s4.2 2.4 4.2 5c0 1.6-1.2 2.6-2.6 2.6-.7 0-1.1-.4-1.6-.4s-.9.4-1.6.4c-1.4 0-2.6-1-2.6-2.6z"/>',
    medal: '<circle cx="12" cy="14.5" r="5.5"/><path d="M8.6 10L6 3h4.2L12 7l1.8-4H18l-2.6 7"/><path d="M12 12v5"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 17.5v-6M9.5 14l2.5-2.5 2.5 2.5"/>',
    refresh: '<path d="M20 11.5a8 8 0 1 0-2.4 5.6"/><path d="M20 4.5v7h-7"/>',
    up: '<path d="M12 19V5.5M6 11.5l6-6 6 6"/>', down: '<path d="M12 5v13.5M6 12.5l6 6 6-6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    basket: '<path d="M3 10h18l-1.8 8.6a2.2 2.2 0 0 1-2.1 1.8H6.9a2.2 2.2 0 0 1-2.1-1.8z"/><path d="M8 10l3.3-6M16 10l-3.3-6"/><path d="M9 13.5v3.5M12 13.5v3.5M15 13.5v3.5"/>',
    sparkle: '<path d="M12 3c.7 4.3 2.7 6.3 7 7-4.3.7-6.3 2.7-7 7-.7-4.3-2.7-6.3-7-7 4.3-.7 6.3-2.7 7-7z"/><path d="M19 15.5c.3 1.7 1 2.4 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.1 2.2-.8 2.5-2.5z"/>',
    camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.5-2h4.6l1.5 2h1.7A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
    bag: '<path d="M5.5 8h13l-1 12h-11z"/><path d="M9 8V6.6a3 3 0 0 1 6 0V8"/>',
    tag: '<path d="M3.5 12.3V4.8A1.3 1.3 0 0 1 4.8 3.5h7.5l8.2 8.2a1.3 1.3 0 0 1 0 1.8l-7 7a1.3 1.3 0 0 1-1.8 0z"/><circle cx="8.2" cy="8.2" r="1.6"/>',
    bank: '<path d="M3 9.5L12 4l9 5.5"/><path d="M5.5 10.5v7M10 10.5v7M14 10.5v7M18.5 10.5v7M3.5 20h17"/>',
    coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7"/><path d="M9.5 15.7c.7 1.1 3 1.8 5.5 1.8 3 0 5.5-1.1 5.5-2.5v-4c0-1.4-2.5-2.5-5.5-2.5"/>',
    house: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.6v10h12v-10"/><path d="M10 19.6v-5h4v5"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 18.5v1.5M20 14v1.5"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.8" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.8" cy="17.5" r="1.2" fill="currentColor" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1.2"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5M12 8.5v12"/><path d="M12 8.5C10.5 5 6.5 4.5 6.8 7c.2 1.4 2.6 1.5 5.2 1.5zM12 8.5c1.5-3.5 5.5-4 5.2-1.5-.2 1.4-2.6 1.5-5.2 1.5z"/>',
    dots: '<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    move: '<path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>',
    focus: '<path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3"/><circle cx="12" cy="12" r="2.5"/>'
  };
  function icon(name, size, extra) {
    const s = size || 22;
    return '<svg class="ic ic-' + name + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + (ICONS[name] || '') + '</svg>';
  }
  /* the signature Family tab icon: a tiny coloured village (always in colour) */
  function familyIcon(size) {
    const s = size || 26;
    return '<svg class="ic ic-family" width="' + s + '" height="' + s + '" viewBox="0 0 28 28" aria-hidden="true">' +
      '<ellipse cx="14" cy="24" rx="12.5" ry="2.6" fill="#8DC85A"/>' +
      '<path d="M3.5 14.5L9 9.3l5.5 5.2v8.6h-11z" fill="#FFE8C2" stroke="#7A4A26" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M2.4 15.2L9 8.4l6.6 6.8" fill="none" stroke="#E0563F" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="7.4" y="17.6" width="3.3" height="5.5" rx="1.6" fill="#8A5A30"/>' +
      '<path d="M13.6 12.8l6-5.8 6 5.8v10.3h-12z" fill="#FFF6E3" stroke="#7A4A26" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M12.4 13.6l7.2-7.3 7.2 7.3" fill="none" stroke="#3D7FD1" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="17.7" y="15.2" width="3.8" height="3.6" rx=".8" fill="#9FD6F2" stroke="#7A4A26" stroke-width=".9"/>' +
      '<circle cx="23.3" cy="4.3" r="2.3" fill="#FFC23D"/></svg>';
  }

  /* =========================================================
     AVATARS (illustrated) — or a photo
     ========================================================= */
  const AVATAR_PRESETS = [
    { style: 'spiky', skin: '#F1C7A0', hair: '#2B2320', bg: '#CFEBC9', shirt: '#2F8F46' },
    { style: 'long', skin: '#F4CDAA', hair: '#3A2A22', bg: '#FFD9E2', shirt: '#E66FA0' },
    { style: 'short', skin: '#E9B98F', hair: '#1F1A17', bg: '#CFE6FB', shirt: '#3D7FD1', glasses: true },
    { style: 'bun', skin: '#F0C9A6', hair: '#C9C5C0', bg: '#E8DDFB', shirt: '#8A5BC7', glasses: true },
    { style: 'bob', skin: '#F6D2B0', hair: '#4A2E22', bg: '#FFEFB0', shirt: '#2A9D8F' },
    { style: 'curly', skin: '#B9825A', hair: '#2A1A12', bg: '#FFE0C2', shirt: '#F08A3C' },
    { style: 'bald', skin: '#E6B48C', hair: '#D8D3CC', bg: '#D7F0EC', shirt: '#5D6B7E', glasses: true },
    { style: 'long', skin: '#8D5B3C', hair: '#1A120D', bg: '#E2F0C9', shirt: '#C2477A' }
  ];
  function avatar(av, size) {
    const s = size || 40;
    if (av && av.kind === 'photo' && av.data) return '<span class="avatar photo" style="width:' + s + 'px;height:' + s + 'px"><img src="' + esc(av.data) + '" alt=""></span>';
    av = Object.assign({}, AVATAR_PRESETS[0], av || {});
    const id = 'av' + FF.hash(JSON.stringify(av) + s).toString(36);
    const hair = av.hair, skin = av.skin, sk2 = shade(skin, 0.86);
    let back = '', front = '';
    switch (av.style) {
      case 'long':
        back = '<path d="M16.5 31C15.5 16 24 12.5 32 12.5S48.5 16 47.5 31L49 52c-5 2.5-29 2.5-34 0z" fill="' + hair + '"/>';
        front = '<path d="M19 29c0-10 6-14 13-14s13 4 13 14c-4.5-4-9.5-7-15-8-3.5 2.5-7.5 5-11 8z" fill="' + hair + '"/>';
        break;
      case 'bun':
        back = '<circle cx="32" cy="13" r="6.5" fill="' + hair + '"/><path d="M18.5 30c-.5-11 6-15 13.5-15s14 4 13.5 15z" fill="' + hair + '"/>';
        front = '<path d="M19.5 29c0-9 5.5-13 12.5-13s12.5 4 12.5 13c-2.5-5.5-7-7.5-12.5-7.5S22 23.5 19.5 29z" fill="' + hair + '"/>';
        break;
      case 'bob':
        back = '<path d="M17.5 33c-1.5-15 6.5-18.5 14.5-18.5S48 18 46.5 33c-.5 7-3 9-5 9H22.5c-2 0-4.5-2-5-9z" fill="' + hair + '"/>';
        front = '<path d="M19 27.5c0-8 5.5-12 13-12s13 4 13 12z" fill="' + hair + '"/>';
        break;
      case 'curly':
        front = [[22, 20, 5.5], [28, 16, 6], [35, 15.5, 6], [41.5, 19, 5.5], [44.5, 25, 4.5], [19.5, 25.5, 4.5]].map((c) => circ(c[0], c[1], c[2], hair)).join('');
        break;
      case 'bald':
        front = '<path d="M19 30c-1-4 0-7 2.5-8.5M45 30c1-4 0-7-2.5-8.5" stroke="' + hair + '" stroke-width="4" stroke-linecap="round" fill="none"/>';
        break;
      case 'short':
        front = '<path d="M19.5 28.5C18 18.5 25 15 32 15s14 3.5 12.5 13.5c-3.5-6-8.5-7-13.5-7-5 0-9 2-11.5 7z" fill="' + hair + '"/>';
        break;
      default: // spiky
        front = '<path d="M19 28c-1.5-10 4.5-14.5 13-14.5s14.5 4.5 13 14.5l-3-5.5-3 3-3-5-3 4-3-5-3 4.5-3-4-2 3.5z" fill="' + hair + '"/>';
    }
    const glasses = av.glasses ? '<g fill="none" stroke="#3B3530" stroke-width="1.5"><circle cx="27" cy="31.3" r="4.2"/><circle cx="37" cy="31.3" r="4.2"/><path d="M31.2 31h1.6"/></g>' : '';
    return '<span class="avatar" style="width:' + s + 'px;height:' + s + 'px"><svg viewBox="0 0 64 64" width="' + s + '" height="' + s + '" aria-hidden="true"><defs><clipPath id="' + id + '"><circle cx="32" cy="32" r="32"/></clipPath></defs><g clip-path="url(#' + id + ')">' +
      '<rect width="64" height="64" fill="' + av.bg + '"/>' +
      '<circle cx="50" cy="12" r="9" fill="#fff" opacity=".35"/>' +
      back +
      '<path d="M10 66c1.5-12 11-18 22-18s20.5 6 22 18z" fill="' + av.shirt + '"/>' +
      '<path d="M27 41h10v8.5c-3 2-7 2-10 0z" fill="' + sk2 + '"/>' +
      circ(18.6, 31.5, 3, skin) + circ(45.4, 31.5, 3, skin) +
      circ(32, 30, 13.4, skin) +
      front +
      '<circle cx="27" cy="31.3" r="1.7" fill="#2B2A26"/><circle cx="37" cy="31.3" r="1.7" fill="#2B2A26"/>' +
      '<circle cx="27.6" cy="30.7" r=".55" fill="#fff"/><circle cx="37.6" cy="30.7" r=".55" fill="#fff"/>' +
      '<ellipse cx="23.8" cy="35.6" rx="2.4" ry="1.5" fill="#FF8C8C" opacity=".4"/><ellipse cx="40.2" cy="35.6" rx="2.4" ry="1.5" fill="#FF8C8C" opacity=".4"/>' +
      '<path d="M28.5 36.3q3.5 3 7 0" fill="none" stroke="#7A3E2E" stroke-width="1.6" stroke-linecap="round"/>' +
      glasses + '</g></svg></span>';
  }

  /* =========================================================
     HOUSE — isometric, customisable, grows with level 1–6
     (1 cottage · 2 snug home · 3 family house · 4 two storeys ·
     5 manor with a turret · 6 the golden mansion). Same 3×3 plot.
     Anchor (0,0) = centre of its 3×3-tile garden.
     ========================================================= */
  const HOUSE_VB = { x: -96, y: -228, w: 192, h: 272 };
  const OUT_L = [-0.894, 0.447], OUT_R = [0.894, 0.447]; // outward normals of the two visible walls (screen)

  function emblem(kind, x, y, s, color) {
    const c = color || '#fff';
    switch (kind) {
      case 'heart': return '<path transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + s + ')" d="M0 3C-3-0.5-4.5-3-2.5-4.3-1.2-5.1 0-4 0-3c0-1 1.2-2.1 2.5-1.3C4.5-3 3-.5 0 3z" fill="' + c + '"/>';
      case 'leaf': return '<path transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + s + ')" d="M-3.5 3C-3.5-1.5-0.5-4 4-4c0 4.5-3 7-7.5 7z" fill="' + c + '"/>';
      case 'paw': return '<g transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + s + ')" fill="' + c + '"><ellipse cx="0" cy="1.6" rx="2.4" ry="2"/><circle cx="-2.8" cy="-1.4" r="1.1"/><circle cx="-1" cy="-3.2" r="1.1"/><circle cx="1.2" cy="-3.2" r="1.1"/><circle cx="3" cy="-1.4" r="1.1"/></g>';
      case 'moon': return '<path transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + s + ')" d="M1.5-4A4.3 4.3 0 1 0 4 3 3.6 3.6 0 0 1 1.5-4z" fill="' + c + '"/>';
      case 'flower': return '<g transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + s + ')" fill="' + c + '"><circle cx="0" cy="-2.4" r="1.7"/><circle cx="2.3" cy="-.7" r="1.7"/><circle cx="1.4" cy="2" r="1.7"/><circle cx="-1.4" cy="2" r="1.7"/><circle cx="-2.3" cy="-.7" r="1.7"/><circle cx="0" cy="0" r="1.2" fill="#FFC23D"/></g>';
      default: return '<path transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + s + ')" d="M0-4.2l1.2 2.6 2.8.3-2.1 1.9.6 2.8L0 2l-2.5 1.4.6-2.8-2.1-1.9 2.8-.3z" fill="' + c + '"/>';
    }
  }

  function flowerDot(x, y, color, r) {
    r = r || 1.6;
    return circ(x, y - r * 0.4, r, P(color)) + circ(x, y - r * 0.4, r * 0.42, P('#FFE27A'));
  }

  function house(h, level, o) {
    o = o || {};
    h = h || {};
    const lv = FF.clamp(level || 1, 1, 6);
    const grand = lv >= 6;
    const roofKind = h.roof || 'gable';
    const steep = roofKind === 'steep';
    const W = [0, 42, 46, 48, 50, 52, 52][lv];
    const Hh = W / 2;
    let wh = [0, 38, 42, 48, 76, 80, 84][lv];
    if (steep) wh = Math.round(wh * 0.86);
    let rh = (steep ? 1.7 : 1) * (25 + lv * 2);
    if (roofKind === 'hip') rh *= 0.82;
    const cx = 0, cy = -6;
    const decor = h.decor || [];
    const has = (d) => decor.indexOf(d) !== -1;

    const wallC = h.wallColor || '#FFF1D6', roofC = h.roofColor || '#E0563F', doorC = h.doorColor || '#8A5A30';
    const wall = P(wallC), wallS = P(shade(wallC, 0.82)), wallLn = P(shade(wallC, 0.6));
    const roof = P(roofC), roofLt = P(shade(roofC, 1.16)), roofLn = P(shade(roofC, 0.55)), roofD = P(shade(roofC, 0.8));
    const door = P(doorC), doorD = P(shade(doorC, 0.66));
    const trim = P('#FFFCF4'), trimS = P('#E9E1D0');
    const glass = night ? '#FFD36B' : '#A9DDF5', glassLn = night ? '#E7A83A' : '#7DBFE0';
    const outline = P('#5B3B22');

    // ground corners & roof geometry
    const L0 = [cx - W, cy], F0 = [cx, cy + Hh], R0 = [cx + W, cy], B0 = [cx, cy - Hh];
    const up = (p, t) => [p[0], p[1] - t];
    const Lu = up(L0, wh), Fu = up(F0, wh), Ru = up(R0, wh), Bu = up(B0, wh);
    const C = [cx, cy - wh];
    const P1 = [cx - W / 2, cy + Hh / 2 - wh - rh], P2 = [cx + W / 2, cy - Hh / 2 - wh - rh];
    const M = [cx, cy - wh - rh];
    const k = steep ? 1.2 : 1.16;
    const sc = (p, c) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k];
    const Lr = sc(Lu, C), Fr = sc(Fu, C), Rr = sc(Ru, C), Br = sc(Bu, C);
    // face-local transforms: (s along wall, t up)
    const lf = (s, t) => [cx - W + s, cy + s * 0.5 - t];
    const rf = (s, t) => [cx + s, cy + Hh - s * 0.5 - t];
    const LF = 'matrix(1,0.5,0,-1,' + f1(cx - W) + ',' + f1(cy) + ')';
    const RF = 'matrix(1,-0.5,0,-1,' + f1(cx) + ',' + f1(cy + Hh) + ')';

    let out = '';
    // ---- shadow + garden plot ----
    out += ell(cx + 18, cy + 14, W + 30, Hh + 16, 'url(#ff-shadow)');
    const plot = [[-70, 2], [0, 37], [70, 2], [0, -33]];
    out += poly(plot, P('#9BD167'), P('#9BD167'), 10, ' class="h-plot"');
    out += poly([[-62, 2], [0, 33], [62, 2], [0, -29]], P('#A8D977'));
    // back decor (behind the house)
    if (has('bush')) out += bush(-50, -18) + bush(52, -16, true);

    // ---- turrets (level 5: one behind on the right · level 6: a golden pair) ----
    const gold = P('#E8B032'), goldD = P('#B9852A'), goldL = P('#FFE27A');
    const turret = (tx, ty, tr, th, flagC) => {
      let t = '<rect x="' + f1(tx - tr) + '" y="' + f1(ty - th) + '" width="' + tr * 2 + '" height="' + th + '" fill="' + wall + '"/>' +
        '<rect x="' + f1(tx) + '" y="' + f1(ty - th) + '" width="' + tr + '" height="' + th + '" fill="' + wallS + '"/>' +
        ell(tx, ty, tr, tr / 2, wallS) +
        '<rect x="' + f1(tx - 3.5) + '" y="' + f1(ty - th + 12) + '" width="7" height="10" rx="3.5" fill="' + glass + '" stroke="' + (grand ? gold : trim) + '" stroke-width="1.5"/>';
      if (grand) t += '<rect x="' + f1(tx - tr) + '" y="' + f1(ty - th + 2) + '" width="' + tr * 2 + '" height="2.4" fill="' + gold + '"/>' + '<rect x="' + f1(tx - 3.5) + '" y="' + f1(ty - th + 34) + '" width="7" height="10" rx="3.5" fill="' + glass + '" stroke="' + gold + '" stroke-width="1.5"/>';
      t += poly([[tx - tr - 4, ty - th], [tx + tr + 4, ty - th], [tx, ty - th - 34]], roof, roofLn, 1.2) +
        poly([[tx, ty - th], [tx + tr + 4, ty - th], [tx, ty - th - 34]], roofD) +
        ell(tx, ty - th, tr + 4, 3.5, grand ? gold : roofD) +
        line([tx, ty - th - 34], [tx, ty - th - 46], grand ? goldD : P('#6B4A2E'), 1.4);
      if (grand) t += circ(tx, ty - th - 34, 2.4, gold, ' stroke="' + goldD + '" stroke-width=".7"');
      t += '<path class="flag-wave" style="transform-origin:' + f1(tx) + 'px ' + f1(ty - th - 44) + 'px" d="M' + f1(tx) + ' ' + f1(ty - th - 46) + 'l9 2.2-9 2.4z" fill="' + P(flagC) + '"/>';
      return t;
    };
    const flagCol = h.flag && h.flag.color || '#FFC23D';
    if (grand) out += turret(cx - W * 0.66, cy - Hh * 0.62, 12, wh + 22, '#E0463A');
    if (lv >= 5) out += turret(cx + W * 0.66, cy - Hh * 0.62, 14, wh + 30, flagCol);

    // ---- foundation ----
    const fd = 5, Wf = W + 2.5;
    const fL = [cx - Wf, cy], fF = [cx, cy + Wf / 2], fR = [cx + Wf, cy];
    out += poly([fL, fF, up(fF, fd), up(fL, fd)], P('#CFC6B5'), P('#A39A8A'), 1) + poly([fF, fR, up(fR, fd), up(fF, fd)], P('#B5AC9B'), P('#A39A8A'), 1);

    // ---- walls ----
    out += poly([L0, F0, Fu, Lu], wall, outline, 1.3) + poly([F0, R0, Ru, Fu], wallS, outline, 1.3);
    // textures
    let tex = '';
    const texture = (w, hh) => {
      let s = '';
      if (h.wall === 'wood') for (let t = 6; t < hh - 1; t += 6) s += line([1, t], [w - 1, t], wallLn, 0.7, ' opacity=".45"');
      else if (h.wall === 'brick') for (let t = 5.5, r = 0; t < hh - 1; t += 5.5, r++) {
        s += line([1, t], [w - 1, t], wallLn, 0.6, ' opacity=".4"');
        for (let x = (r % 2 ? 4 : 8.5); x < w - 2; x += 9) s += line([x, t], [x, t + 5.5], wallLn, 0.6, ' opacity=".35"');
      } else s += '<rect x="0" y="0" width="' + w + '" height="5" fill="' + wallLn + '" opacity=".14"/>' + circ(w * 0.3, hh * 0.6, 0.9, wallLn, ' opacity=".25"') + circ(w * 0.75, hh * 0.35, 0.8, wallLn, ' opacity=".25"');
      return s;
    };
    tex += '<g transform="' + LF + '">' + texture(W, wh) + '</g><g transform="' + RF + '">' + texture(W, wh) + '</g>';
    if (lv >= 4) tex += '<g transform="' + LF + '">' + line([0, wh / 2], [W, wh / 2], trimS, 2) + '</g><g transform="' + RF + '">' + line([0, wh / 2], [W, wh / 2], trimS, 2) + '</g>';
    out += tex;

    // ---- windows (right wall) ----
    const win = (s, t, ww, hh2, shutters) => {
      let w = '';
      if (night) w += '<ellipse cx="' + f1(s) + '" cy="' + f1(t + hh2 / 2) + '" rx="' + (ww + 6) + '" ry="' + (hh2 + 4) + '" fill="url(#ff-glow)" opacity=".75"/>';
      if (shutters) w += '<rect x="' + f1(s - ww / 2 - 5) + '" y="' + f1(t) + '" width="4" height="' + hh2 + '" rx="1" fill="' + door + '"/><rect x="' + f1(s + ww / 2 + 1) + '" y="' + f1(t) + '" width="4" height="' + hh2 + '" rx="1" fill="' + door + '"/>';
      w += '<rect x="' + f1(s - ww / 2 - 1.4) + '" y="' + f1(t - 1.4) + '" width="' + f1(ww + 2.8) + '" height="' + f1(hh2 + 2.8) + '" rx="1.6" fill="' + trim + '"/>';
      w += '<rect x="' + f1(s - ww / 2) + '" y="' + f1(t) + '" width="' + ww + '" height="' + hh2 + '" rx="1" fill="' + glass + '"/>';
      if (!night) w += '<path d="M' + f1(s - ww / 2 + 1.5) + ' ' + f1(t + 2) + 'l' + f1(ww * 0.45) + ' ' + f1(hh2 * 0.7) + '" stroke="#fff" stroke-width="1.6" opacity=".55"/>';
      w += line([s, t], [s, t + hh2], trim, 1.2) + line([s - ww / 2, t + hh2 / 2], [s + ww / 2, t + hh2 / 2], trim, 1.2);
      w += '<rect x="' + f1(s - ww / 2 - 2.5) + '" y="' + f1(t - 3) + '" width="' + f1(ww + 5) + '" height="2.2" rx="1" fill="' + trimS + '"/>';
      if (has('flowers')) w += '<rect x="' + f1(s - ww / 2 - 1.5) + '" y="' + f1(t - 5.5) + '" width="' + f1(ww + 3) + '" height="3" rx="1" fill="' + P('#9B6B43') + '"/>';
      return w;
    };
    const ww = lv <= 1 ? 11 : 12, whh = lv <= 1 ? 11 : 13;
    let rw = '';
    const rows = lv >= 4 ? [12, wh / 2 + 10] : [lv <= 1 ? 13 : 15];
    const cols = lv <= 1 ? [W / 2] : [W * 0.3, W * 0.72];
    rows.forEach((t) => cols.forEach((s) => { rw += win(s, t, ww, whh, lv >= 3); }));
    out += '<g transform="' + RF + '">' + rw + '</g>';
    // flower boxes need upright flowers: draw in world space
    if (has('flowers')) rows.forEach((t) => cols.forEach((s) => {
      const p = rf(s, t - 4);
      [-4, 0, 4].forEach((dx, i) => { out += flowerDot(p[0] + dx * 0.9, p[1] - dx * -0.45 - 1.5, ['#FF7AA2', '#FFFFFF', '#FF9F43'][i], 1.4); });
    }));

    // ---- door (left wall) ----
    const dw = 13 + lv, dh = Math.min(wh - 8, 22 + lv * 1.6);
    const sd = W * 0.55, d0 = sd - dw / 2;
    let dr = '';
    if (h.door === 'round') {
      const r = Math.min(dw * 0.62, dh / 2);
      dr += circ(sd, r + 0.5, r + 1.8, trim) + circ(sd, r + 0.5, r, door) + line([sd, 1], [sd, 2 * r], doorD, 0.8, ' opacity=".6"') + circ(sd + r * 0.45, r + 0.5, 1.1, P('#FFD45A'));
    } else if (h.door === 'square') {
      dr += '<rect x="' + f1(d0 - 1.6) + '" y="0" width="' + f1(dw + 3.2) + '" height="' + f1(dh + 1.6) + '" fill="' + trim + '"/>' +
        '<rect x="' + f1(d0) + '" y="0" width="' + dw + '" height="' + f1(dh) + '" fill="' + door + '"/>' +
        '<rect x="' + f1(d0 + 2.5) + '" y="' + f1(dh - 7) + '" width="' + f1(dw - 5) + '" height="4.5" rx="1" fill="' + glass + '"/>' +
        '<rect x="' + f1(d0 + 2.5) + '" y="3" width="' + f1(dw - 5) + '" height="' + f1(dh - 13) + '" rx="1" fill="none" stroke="' + doorD + '" stroke-width=".9"/>' +
        circ(d0 + dw - 3, dh * 0.45, 1.1, P('#FFD45A'));
    } else {
      const r = dw / 2, top = dh - r;
      const arch = (x0, w, y1, rr) => 'M' + f1(x0) + ' 0 L' + f1(x0) + ' ' + f1(y1) + ' A' + f1(rr) + ' ' + f1(rr) + ' 0 0 0 ' + f1(x0 + w) + ' ' + f1(y1) + ' L' + f1(x0 + w) + ' 0 Z';
      dr += '<path d="' + arch(d0 - 1.7, dw + 3.4, top, r + 1.7) + '" fill="' + trim + '"/><path d="' + arch(d0, dw, top, r) + '" fill="' + door + '"/>' +
        line([d0 + dw * 0.33, 1], [d0 + dw * 0.33, dh - 2], doorD, 0.8, ' opacity=".55"') + line([d0 + dw * 0.66, 1], [d0 + dw * 0.66, dh - 2], doorD, 0.8, ' opacity=".55"') +
        circ(d0 + dw - 3, dh * 0.42, 1.1, P('#FFD45A'));
    }
    // upper-floor windows above the door (level 4+)
    if (lv >= 4) dr += win(W * 0.28, wh / 2 + 10, ww, whh, true) + win(W * 0.74, wh / 2 + 10, ww, whh, true);
    else if (lv >= 2) dr += win(W * 0.2, 15, 9, 11, false);
    out += '<g transform="' + LF + '">' + dr + '</g>';
    // awning over the door (level 3–5) · a columned porch with a golden pediment (level 6)
    if (grand) {
      const out8 = mul(OUT_L, 10);
      const c1 = add(lf(d0 - 4, 0), out8), c2 = add(lf(d0 + dw + 4, 0), out8);
      const ph = dh + 9;
      [c1, c2].forEach((c) => {
        out += '<rect x="' + f1(c[0] - 2.2) + '" y="' + f1(c[1] - ph) + '" width="4.4" height="' + f1(ph) + '" fill="' + trim + '" stroke="' + P('#BFB4A0') + '" stroke-width=".8"/>' +
          '<rect x="' + f1(c[0] - 3.2) + '" y="' + f1(c[1] - ph - 1.6) + '" width="6.4" height="2.4" rx=".6" fill="' + gold + '"/><rect x="' + f1(c[0] - 3) + '" y="' + f1(c[1] - 1.8) + '" width="6" height="2" rx=".6" fill="' + P('#E2DACA') + '"/>';
      });
      const a1 = [c1[0] - 4, c1[1] - ph - 1.6], a2 = [c2[0] + 4, c2[1] - ph - 1.6];
      const b1 = add(lf(d0 - 6, dh + 8), [0, 0]), b2 = add(lf(d0 + dw + 6, dh + 8), [0, 0]);
      out += poly([a1, a2, b2, b1], P('#FFF8EA'), P('#BFB4A0'), 0.8);
      const apex = lerp2(a1, a2, 0.5);
      out += poly([a1, a2, [apex[0], apex[1] - 9]], P('#FFF8EA'), gold, 1.2) + circ(apex[0], apex[1] - 3.6, 1.8, gold);
    } else if (lv >= 3) {
      const a1 = lf(d0 - 3, dh + 5), a2 = lf(d0 + dw + 3, dh + 5);
      const o = mul(OUT_L, 8);
      const b1 = add(add(a1, o), [0, 3]), b2 = add(add(a2, o), [0, 3]);
      out += poly([a1, a2, b2, b1], roof, roofLn, 1);
      for (let q = 1; q < 4; q++) out += line(lerp2(a1, a2, q / 4), lerp2(b1, b2, q / 4), roofLt, 1.6, ' opacity=".9"');
    }
    // wall lamp
    if (has('lantern')) {
      const p = lf(d0 + dw + 5.5, dh - 3);
      if (night) out += circ(p[0], p[1] + 3, 16, 'url(#ff-glow)');
      out += line(p, add(p, [-3, -2]), P('#3D3A36'), 1.2) + '<rect x="' + f1(p[0] - 2.2) + '" y="' + f1(p[1] - 0.5) + '" width="4.4" height="6" rx="1.3" fill="' + (night ? '#FFE07A' : P('#FFE9A8')) + '" stroke="' + P('#3D3A36') + '" stroke-width="1"/>';
    }
    // door step
    const D = lf(sd, 0);
    const st1 = add(lf(sd - dw / 2 - 1, 0), [0, 0]), st2 = add(lf(sd + dw / 2 + 1, 0), [0, 0]);
    out += poly([st1, st2, add(st2, mul(OUT_L, 4.5)), add(st1, mul(OUT_L, 4.5))], P('#D8CFBE'), P('#ADA390'), 0.9);

    // ---- gable wall (gable / steep) ----
    const isHip = roofKind === 'hip';
    if (!isHip) {
      out += poly([Lu, Fu, P1], wall, outline, 1.3);
      if (h.wall === 'wood') for (let q = 1; q < 4; q++) out += '<g transform="' + LF + '" opacity=".4">' + line([W * q / 8, wh + rh * q / 4 * 0.9], [W - W * q / 8, wh + rh * q / 4 * 0.9], wallLn, 0.7) + '</g>';
      if (lv >= 3) {
        const gw = lf(W / 2, wh + rh * 0.38);
        if (night) out += circ(gw[0], gw[1], 9, 'url(#ff-glow)');
        out += circ(gw[0], gw[1], 5.2, trim) + circ(gw[0], gw[1], 3.8, glass) + line([gw[0] - 3.8, gw[1]], [gw[0] + 3.8, gw[1]], trim, 1) + line([gw[0], gw[1] - 3.8], [gw[0], gw[1] + 3.8], trim, 1);
      }
    }

    // ---- roof ----
    let rr = '';
    if (isHip) {
      const H1 = sc(lerp2(M, P1, 0.4), M), H2 = sc(lerp2(M, P2, 0.4), M);
      rr += poly([Lr, Br, H2, H1], roofLt, roofLn, 1.3);
      rr += poly([Lr, Fr, H1], P(shade(roofC, 1.05)), roofLn, 1.3);
      rr += poly([Fr, Rr, H2, H1], roof, roofLn, 1.3);
      for (let q = 1; q < 5; q++) rr += line(lerp2(Fr, H1, q / 5), lerp2(Rr, H2, q / 5), roofLn, 0.8, ' opacity=".35"');
      for (let q = 1; q < 4; q++) rr += line(lerp2(Lr, H1, q / 4), lerp2(Fr, H1, q / 4), roofLn, 0.8, ' opacity=".3"');
      rr += line(H1, H2, P(shade(roofC, 1.3)), 2.6);
      out += rr;
      var ridgeEnd = H2, ridgeA = H1;
    } else {
      const Q1 = sc(P1, M), Q2 = sc(P2, M);
      rr += poly([Lr, Br, Q2, Q1], roofLt, roofLn, 1.3);
      rr += poly([Fr, Rr, Q2, Q1], roof, roofLn, 1.3);
      for (let q = 1; q < 5; q++) {
        const a = lerp2(Fr, Q1, q / 5), b = lerp2(Rr, Q2, q / 5);
        rr += line(a, b, roofLn, 0.8, ' opacity=".35"');
        const n = 6;
        for (let m = 0; m < n; m++) { const t0 = (m + (q % 2 ? 0.5 : 0)) / n; if (t0 > 0.02 && t0 < 0.98) { const p0 = lerp2(a, b, t0); const p1 = lerp2(lerp2(Fr, Q1, (q - 1) / 5), lerp2(Rr, Q2, (q - 1) / 5), t0); rr += line(p0, p1, roofLn, 0.6, ' opacity=".22"'); } }
      }
      rr += line(lerp2(Lr, Q1, 0.02), Q1, roofLn, 1.6) + line(Fr, Q1, P(shade(roofC, 0.65)), 1.6);
      rr += line(Q1, Q2, P(shade(roofC, 1.3)), 2.6);
      out += rr;
      var ridgeEnd = Q2, ridgeA = Q1; // eslint-disable-line no-redeclare
    }

    if (grand) {
      out += line(Lr, Fr, gold, 1.8) + line(Fr, Rr, goldD, 1.8) + line(ridgeA, ridgeEnd, gold, 3.2);
      out += circ(ridgeA[0], ridgeA[1], 2.6, gold, ' stroke="' + goldD + '" stroke-width=".7"') + circ(ridgeEnd[0], ridgeEnd[1], 2.6, gold, ' stroke="' + goldD + '" stroke-width=".7"');
    }
    // ---- chimney + smoke (level 2+) ----
    if (lv >= 2) {
      const Q = lerp2(lerp2(ridgeA, ridgeEnd, 0.74), lerp2(Fr, Rr, 0.74), 0.34);
      const cw = 5.5, chH = 15;
      const l = [Q[0] - cw, Q[1]], f = [Q[0], Q[1] + cw / 2], r = [Q[0] + cw, Q[1]], b = [Q[0], Q[1] - cw / 2];
      out += poly([l, f, up(f, chH), up(l, chH)], P('#C46A4E'), P('#7A3B28'), 1) + poly([f, r, up(r, chH), up(f, chH)], P('#9E4F38'), P('#7A3B28'), 1) +
        poly([up(l, chH), up(f, chH), up(r, chH), up(b, chH)], P('#5A2F22'), P('#7A3B28'), 1);
      if (o.meta) o.meta.chimney = [Q[0], Q[1] - chH - 4];
      if (!o.still && !o.split) {
        const sx = Q[0], sy = Q[1] - chH - 5;
        out += '<g class="smoke" fill="' + (night ? '#8E97B5' : '#FFFFFF') + '">' + circ(sx, sy, 3.4, 'inherit', ' class="s1"') + circ(sx + 2, sy - 3, 4, 'inherit', ' class="s2"') + circ(sx + 1, sy - 6, 4.6, 'inherit', ' class="s3"') + '</g>';
      }
    }

    // ---- flag ----
    if (h.flag && h.flag.on) {
      const base = ridgeEnd, top = [base[0], base[1] - 26];
      out += line(base, top, P('#6B4A2E'), 1.6) + circ(top[0], top[1] - 1, 1.8, P('#FFC23D'));
      if (o.meta) o.meta.flag = [top[0], top[1]];
    }
    if (h.flag && h.flag.on && !o.split) {
      const base = ridgeEnd, top = [base[0], base[1] - 26];
      const fc = P(h.flag.color || '#FFC23D');
      out += '<g class="flag-wave" style="transform-origin:' + f1(top[0]) + 'px ' + f1(top[1] + 6) + 'px"><path d="M' + f1(top[0]) + ' ' + f1(top[1] + 1) + 'c5-2.4 9 2.4 17-.6v11c-8 3-12-2-17 .6z" fill="' + fc + '" stroke="' + P(shade(h.flag.color || '#FFC23D', 0.6)) + '" stroke-width=".9"/>' +
        emblem(h.flag.emblem, top[0] + 8.5, top[1] + 6.4, 0.95, '#fff') + '</g>';
    }

    // ---- front garden ----
    // stepping stones from the door
    [9, 17, 25].forEach((d, i) => { const p = add(D, mul(OUT_L, d)); out += ell(p[0], p[1] + 1, 4.6 - i * 0.3, 2.3, P('#D9D1C1'), ' stroke="' + P('#B4AA97') + '" stroke-width=".8"'); });
    if (grand) [-1, 1].forEach((sgn) => {
      const p = add(add(D, mul(OUT_L, 21)), [0.894 * 9 * sgn, 0.447 * 9 * sgn]);
      if (night) out += circ(p[0], p[1] - 17, 12, 'url(#ff-glow)');
      out += line(p, add(p, [0, -14]), goldD, 1.4) + '<rect x="' + f1(p[0] - 2.2) + '" y="' + f1(p[1] - 19.5) + '" width="4.4" height="5.6" rx="1.2" fill="' + (night ? '#FFE07A' : P('#FFF2C4')) + '" stroke="' + gold + '" stroke-width="1"/>' + poly([[p[0] - 3, p[1] - 19.5], [p[0] + 3, p[1] - 19.5], [p[0], p[1] - 22.5]], gold);
    });
    if (has('flowers')) {
      const a = rf(4, 0), b = rf(W - 4, 0);
      out += poly([a, b, add(b, mul(OUT_R, 7)), add(a, mul(OUT_R, 7))], P('#8E6140'), P('#7A5236'), 0.8);
      for (let q = 0; q < 7; q++) {
        const p = add(lerp2(a, b, (q + 0.5) / 7), mul(OUT_R, 3.5));
        out += line(p, add(p, [0, -4]), P('#4E9A3C'), 1) + flowerDot(p[0], p[1] - 4, ['#FF7AA2', '#FFD54A', '#FFFFFF', '#B98CFF', '#FF8A4C'][q % 5], 1.9);
      }
      if (!(h.deco && h.deco.yard)) [[-60, 4], [-55, 9], [-65, -1], [-50, 1]].forEach((p, i) => { out += line(p, add(p, [0, -4]), P('#4E9A3C'), 1) + flowerDot(p[0], p[1] - 4, ['#FF7AA2', '#FFD54A', '#B98CFF', '#FFFFFF'][i], 1.9); });
    }
    if (has('bench')) out += bench(52, 2, true);
    if (has('fountain')) out += fountain(30, 21);
    if (has('mailbox')) {
      const p = [9, 31];
      out += line(p, add(p, [0, -11]), P('#7A5236'), 2.2) + '<rect x="' + (p[0] - 5) + '" y="' + (p[1] - 17) + '" width="10" height="7" rx="3" fill="' + door + '" stroke="' + doorD + '" stroke-width="1"/>' +
        '<path d="M' + (p[0] + 3.5) + ' ' + (p[1] - 17) + 'v-5h3.5v2.2h-2" fill="' + P('#E0463A') + '"/>';
    }
    if (has('fence')) {
      const seg = (a, b, skipFrom, skipTo) => {
        let s = '';
        const n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7.5);
        const ptsF = [];
        for (let q = 0; q <= n; q++) { const t = q / n; if (t >= skipFrom && t <= skipTo) { ptsF.push(null); continue; } ptsF.push(lerp2(a, b, t)); }
        // rails
        let run = [];
        const flush = () => { if (run.length > 1) { const A = run[0], B = run[run.length - 1]; s += line(add(A, [0, -3]), add(B, [0, -3]), P('#D9C4A2'), 1.4) + line(add(A, [0, -6.5]), add(B, [0, -6.5]), P('#D9C4A2'), 1.4); } run = []; };
        ptsF.forEach((p) => { if (p) run.push(p); else flush(); });
        flush();
        ptsF.forEach((p) => { if (!p) return; s += '<path d="M' + f1(p[0] - 1.4) + ' ' + f1(p[1]) + 'v-8l1.4-1.8 1.4 1.8v8z" fill="' + P('#FFF7E8') + '" stroke="' + P('#BFA77F') + '" stroke-width=".7"/>'; });
        return s;
      };
      out += seg([-70, 2], [0, 37], 0.3, 0.56) + seg([0, 37], [70, 2], 2, 2);
    }
    // nameplate sign
    if (h.plate) {
      const txt = String(h.plate).slice(0, 18);
      const fs = txt.length > 12 ? 4.6 : 5.4;
      const wd = Math.max(22, txt.length * fs * 0.6 + 7);
      const p = [-24, 32];
      out += line(p, add(p, [0, -9]), P('#7A5236'), 1.8) +
        '<rect x="' + f1(p[0] - wd / 2) + '" y="' + f1(p[1] - 17) + '" width="' + f1(wd) + '" height="9" rx="2.6" fill="' + P('#C98F55') + '" stroke="' + P('#7A5236') + '" stroke-width=".9"/>' +
        '<text x="' + f1(p[0]) + '" y="' + f1(p[1] - 10.8) + '" text-anchor="middle" font-size="' + fs + '" font-weight="700" fill="' + P('#FFF7E8') + '" font-family="Fredoka, \'ZCOOL KuaiLe\', Mitr, sans-serif">' + esc(txt) + '</text>';
    }
    if (o.meta) {
      o.meta.top = Math.min(ridgeEnd[1] - (h.flag && h.flag.on ? 34 : 6), lv >= 5 ? cy - Hh * 0.62 - wh - 30 - 48 : 0);
      o.meta.door = lf(sd, 0);
      o.meta.grand = grand;
      // where shop decorations go (art-shop.js)
      o.meta.a = { lv, lf, ridge: [ridgeA, ridgeEnd], eaveL: Lr, eaveF: Fr, eaveR: Rr, door: { s: sd, w: dw, h: dh, d0 }, yard: [-57, 7], top: o.meta.top };
    }
    const vb = HOUSE_VB;
    return '<svg class="house-svg" viewBox="' + vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h + '" width="' + vb.w + '" height="' + vb.h + '" aria-hidden="true">' + out + '</svg>';
  }
  /* a waving flag drawn on its own layer (village animates it on the GPU) */
  function flagCloth(flag) {
    const fc = P(flag.color || '#FFC23D');
    return '<svg viewBox="0 -1 19 14" width="19" height="14" aria-hidden="true"><path d="M0 1c5-2.4 9 2.4 17-.6v11c-8 3-12-2-17 .6z" fill="' + fc + '" stroke="' + P(shade(flag.color || '#FFC23D', 0.6)) + '" stroke-width=".9"/>' + emblem(flag.emblem, 8.5, 6.4, 0.95, '#fff') + '</svg>';
  }
  // how tall a house is (for placing the floating tag above it)
  const houseTop = (lv, roofKind) => {
    const wh = [0, 38, 42, 48, 76, 80, 84][FF.clamp(lv || 1, 1, 6)] * (roofKind === 'steep' ? 0.86 : 1);
    const rh = (roofKind === 'steep' ? 1.7 : roofKind === 'hip' ? 0.82 : 1) * (25 + lv * 2);
    return wh + rh + (lv >= 5 ? 40 : 30) + 6;
  };

  function bush(x, y, flip) {
    const g = P('#5DA845'), g2 = P('#78C05A'), g3 = P('#94D36F');
    return ell(x + 3, y + 3, 13, 4, 'url(#ff-shadow)') + circ(x - 6, y - 4, 7, g) + circ(x + 6, y - 4, 7, g) + circ(x, y - 9, 8, g) +
      circ(x - 6, y - 6, 5, g2) + circ(x + 5, y - 7, 5, g2) + circ(x - 1, y - 11, 5, g2) + circ(x - 3, y - 12, 2.2, g3) +
      (flip ? '' : flowerDot(x + 4, y - 9, '#FF7AA2', 1.5) + flowerDot(x - 5, y - 5, '#FFFFFF', 1.4));
  }
  function bench(x, y) {
    const w = P('#B9824E'), wd = P('#8A5A30');
    const a = [x - 10, y - 5], b = [x + 6, y + 3];
    return line(add(a, [1, 0]), add(a, [1, 6]), wd, 1.6) + line(add(b, [-1, 0]), add(b, [-1, 6]), wd, 1.6) +
      poly([a, b, add(b, [4, -2]), add(a, [4, -2])], w, wd, 0.8) +
      poly([add(a, [4, -2]), add(b, [4, -2]), add(b, [4, -8]), add(a, [4, -8])], P('#C99260'), wd, 0.8);
  }
  function fountain(x, y) {
    const s = P('#D7D0C2'), sd = P('#ADA492'), w = night ? '#4C7FB8' : '#7FD3F2';
    return ell(x, y + 1, 11, 5.5, sd) + ell(x, y - 1, 11, 5.5, s) + ell(x, y - 1.3, 8.6, 4, w) +
      '<rect x="' + (x - 1.6) + '" y="' + (y - 11) + '" width="3.2" height="10" fill="' + s + '"/>' + ell(x, y - 11, 5, 2.2, s) + ell(x, y - 11.2, 3.6, 1.4, w) +
      '<path class="spray" d="M' + x + ' ' + (y - 12) + 'q-3-6-6 1M' + x + ' ' + (y - 12) + 'q3-6 6 1" stroke="' + w + '" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
  }

  /* =========================================================
     ANIMALS — side view facing right, 48×48, feet at y≈44
     ========================================================= */
  const eye = (x, y, r) => '<g class="eo">' + circ(x, y, r || 1.4, '#2B2A26') + circ(x + 0.45, y - 0.45, 0.45, '#fff') + '</g><path class="ec" d="M' + (x - 1.5) + ' ' + y + 'q1.5 1.2 3 0" stroke="#2B2A26" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
  const ANIMALS = {
    chicken: () =>
      '<g class="an-legs"><path class="leg l1" d="M21 36.5l-1 7.5m-2 0h4" stroke="#F4A42C" stroke-width="1.6" fill="none" stroke-linecap="round"/><path class="leg l2" d="M26 36.5l1 7.5m-2 0h4" stroke="#F4A42C" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>' +
      '<path d="M12 26C7 21 8 15 12 12.5c1.2 5 3 8.4 5.5 10.5z" fill="#FFFDF6" stroke="#E2D6BF" stroke-width="1"/>' +
      '<path d="M12 26c0-8 8-11 15-8 6 2.5 9 9 6 15-3 5-15 6-19 1-1.5-2-2-5-2-8z" fill="#FFFDF6" stroke="#E2D6BF" stroke-width="1"/>' +
      '<path class="wing" d="M16.5 26.5c3.5-4.5 10.5-4.5 12.5 0-2 5-10 6-12.5 0z" fill="#F1E6D0"/>' +
      '<g class="an-head">' + circ(31, 15.5, 6.6, '#FFFDF6', ' stroke="#E2D6BF" stroke-width="1"') +
      '<path d="M27 10.5c.5-3.6 3-3.6 3.5-1 .5-3 3.5-2.6 3 .5 2-1 3.6 1 1.5 2.6z" fill="#EE4B3B"/>' +
      '<path d="M37 14.3l4.6 1.6-4.6 1.8z" fill="#F7A928"/><path d="M36 18.2c1 3-1.5 3.5-1.4 1z" fill="#EE4B3B"/>' + eye(33.6, 14.4, 1.3) + circ(32.4, 17.8, 1.5, '#FFB3B3', ' opacity=".6"') + '</g>',
    chick: () =>
      '<g class="an-legs"><path class="leg l1" d="M22 38v6" stroke="#F4A42C" stroke-width="1.5" stroke-linecap="round"/><path class="leg l2" d="M26 38v6" stroke="#F4A42C" stroke-width="1.5" stroke-linecap="round"/></g>' +
      '<ellipse cx="24" cy="32" rx="9" ry="7.5" fill="#FFD84D"/><path class="wing" d="M19 31c2.5-2.5 6.5-2.5 7.5.5-2 3-6 3-7.5-.5z" fill="#F5C232"/>' +
      '<g class="an-head">' + circ(29.5, 23.5, 6, '#FFD84D') + '<path d="M28 18c0-2 1.6-2.6 2.4-1" stroke="#F5C232" stroke-width="1.4" fill="none"/><path d="M35 23l3.6 1.2-3.6 1.4z" fill="#F7A928"/>' + eye(31.6, 22.6, 1.15) + circ(30.6, 25.6, 1.3, '#FFB3B3', ' opacity=".6"') + '</g>',
    puppy: () =>
      '<g class="an-tail"><path d="M11 25c-4-3.5-4.5-8.5-1.5-11" stroke="#C98A4B" stroke-width="3.4" fill="none" stroke-linecap="round"/></g>' +
      '<g class="an-legs"><rect class="leg l2" x="13" y="32" width="4.4" height="12" rx="2.2" fill="#C98A4B"/><rect class="leg l1" x="27.5" y="32" width="4.4" height="12" rx="2.2" fill="#C98A4B"/></g>' +
      '<rect x="9.5" y="21.5" width="26" height="15" rx="7.5" fill="#E2A96A"/><ellipse cx="22" cy="33" rx="9" ry="3" fill="#F6D7AE" opacity=".8"/><ellipse cx="16.5" cy="25.5" rx="4.2" ry="3" fill="#C98A4B"/>' +
      '<g class="an-legs"><rect class="leg l1" x="16.5" y="33" width="4.4" height="11" rx="2.2" fill="#E2A96A"/><rect class="leg l2" x="30.5" y="33" width="4.4" height="11" rx="2.2" fill="#E2A96A"/></g>' +
      '<g class="an-head">' + circ(34, 17.5, 8.2, '#E2A96A') + '<ellipse cx="40.3" cy="20.6" rx="4.4" ry="3.3" fill="#F6D7AE"/><ellipse cx="43.6" cy="19.4" rx="1.7" ry="1.35" fill="#2B2A26"/>' +
      '<path d="M40.5 23.2c.8 1.8 2.6 1.8 3 .2" fill="#FF8FA0"/>' +
      '<path d="M27.6 11.5c-3.4 1-3.4 9.5.6 11.6 2.3-2.2 2.6-8.2-.6-11.6z" fill="#A8703C"/>' + eye(36.2, 16.2, 1.45) + circ(36.5, 20, 1.6, '#FF9C9C', ' opacity=".5"') +
      '<path d="M28.2 24.5c2.8 1.6 6.5 1.6 9 0" stroke="#E0463A" stroke-width="2.6" fill="none" stroke-linecap="round"/>' + circ(33, 26.4, 1.6, '#FFC23D') + '</g>',
    cat: () =>
      '<g class="pose-awake"><g class="an-tail"><path d="M12 29c-5.5-1.5-6.5-9.5-2.5-13.5" stroke="#E8964A" stroke-width="3.6" fill="none" stroke-linecap="round"/></g>' +
      '<g class="an-legs"><rect class="leg l2" x="13" y="33" width="3.6" height="11" rx="1.8" fill="#E8964A"/><rect class="leg l1" x="26" y="33" width="3.6" height="11" rx="1.8" fill="#E8964A"/></g>' +
      '<rect x="10" y="24" width="23" height="12.5" rx="6.2" fill="#F2A65A"/><path d="M16 24.5v4M20 24.2v4.6M24 24.5v4" stroke="#D9803A" stroke-width="1.6" stroke-linecap="round"/>' +
      '<g class="an-legs"><rect class="leg l1" x="16" y="34" width="3.6" height="10" rx="1.8" fill="#F2A65A"/><rect class="leg l2" x="29" y="34" width="3.6" height="10" rx="1.8" fill="#F2A65A"/></g>' +
      '<g class="an-head"><path d="M28.4 15l1.6-6.4 4.2 4.4zM35.4 12.8l4.4-4.2 1 6.4z" fill="#F2A65A"/><path d="M30 13.6l.8-3 1.9 2zM36.6 12.3l2.1-2 .5 3z" fill="#FFC7C7"/>' + circ(34.5, 19, 7.6, '#F2A65A') +
      '<path d="M31.5 12.5l1 3M35 11.6v3" stroke="#D9803A" stroke-width="1.3" stroke-linecap="round"/>' + eye(32.2, 18.6, 1.3) + eye(37.4, 18.6, 1.3) +
      '<path d="M34.3 21.2l1.2 1 1.1-1z" fill="#FF8FA0"/><path d="M38.5 22.4l5 -.8M38.5 23.6l5 .6M30.4 22.4l-5-.8M30.4 23.6l-5 .6" stroke="#B7703A" stroke-width=".6"/>' + '</g></g>' +
      '<g class="pose-sleep"><ellipse cx="24" cy="37" rx="14" ry="7.6" fill="#F2A65A"/><path d="M14 37.5v-3.5M19 37v-4.4M24 37v-4.6" stroke="#D9803A" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M10.5 39.5c4 5.5 20 5.5 26 .5" stroke="#E8964A" stroke-width="3.4" fill="none" stroke-linecap="round"/>' + circ(33, 34.5, 6.2, '#F2A65A') +
      '<path d="M28.6 30.5l1-4.6 3.2 3.2zM34.2 29.2l3.6-2.8.4 4.6z" fill="#F2A65A"/><path d="M30 35q1.4 1 2.8 0M34.2 35q1.4 1 2.8 0" stroke="#2B2A26" stroke-width="1" fill="none" stroke-linecap="round"/></g>',
    duck: () =>
      '<g class="an-legs"><path class="leg l1" d="M21 36.5v7m-2 0h4" stroke="#F59E2B" stroke-width="1.6" fill="none" stroke-linecap="round"/><path class="leg l2" d="M26 36.5v7m-2 0h4" stroke="#F59E2B" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>' +
      '<path d="M11 29c-1.5-3 0-5.5 2.5-6.5l2 4z" fill="#FFD84D"/><ellipse cx="22.5" cy="30.5" rx="11" ry="8" fill="#FFD84D"/><path class="wing" d="M15 29.5c3.5-3.5 9.5-3.5 11 0-3 4-9 4-11 0z" fill="#F5C232"/>' +
      '<g class="an-head">' + circ(31, 20.5, 6.6, '#FFD84D') + '<path d="M35.6 20.5c3.6-.8 6.4.4 6 2.4-1.4 1-4.6.9-6.4.1z" fill="#F59E2B"/>' + eye(32.8, 19, 1.3) + circ(31.4, 23, 1.4, '#FFB3B3', ' opacity=".55"') + '</g>' +
      '<g class="ripple-ring"><ellipse cx="23" cy="37.5" rx="15" ry="3.4" fill="none" stroke="#FFFFFF" stroke-width="1.4" opacity=".8"/></g>',
    pig: () =>
      '<g class="an-tail"><path d="M10.5 27c-3.4 0-3.4-4 0-3.6 2 .3 1.5 3.4-.6 2.6" stroke="#EE8FA4" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>' +
      '<g class="an-legs"><rect class="leg l2" x="14" y="34" width="4.4" height="10" rx="2" fill="#EE9AAE"/><rect class="leg l1" x="27" y="34" width="4.4" height="10" rx="2" fill="#EE9AAE"/></g>' +
      '<ellipse cx="23" cy="29.5" rx="13.5" ry="10" fill="#F9B8C4"/><rect x="18.5" y="20.6" width="7" height="2" rx="1" fill="#C9677D"/><circle cx="22" cy="18.3" r="2.6" fill="url(#ff-gold)" stroke="#C88A12" stroke-width=".6"/>' +
      '<g class="an-legs"><rect class="leg l1" x="17.5" y="35" width="4.4" height="9" rx="2" fill="#F9B8C4"/><rect class="leg l2" x="30.5" y="35" width="4.4" height="9" rx="2" fill="#F9B8C4"/></g>' +
      '<g class="an-head">' + circ(34.5, 25, 7.6, '#F9B8C4') + '<path d="M30 18.4l1.6-4.6 3.4 3.4z" fill="#EE9AAE"/>' + '<ellipse cx="41" cy="27" rx="3.6" ry="3" fill="#F48FA5"/>' + circ(40.2, 26.8, 0.75, '#B5536B') + circ(42, 26.8, 0.75, '#B5536B') + eye(36, 22.8, 1.3) + circ(35.4, 28.6, 1.6, '#FF7A94', ' opacity=".45"') + '</g>'
  };
  const ANIMAL_SIZE = { chicken: 34, chick: 22, puppy: 42, cat: 38, duck: 30, pig: 42 };
  function animal(kind) {
    return '<svg class="an-svg" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">' + ell(24, 44.4, 11, 2.8, 'rgba(30,40,10,.22)', ' class="an-shadow"') + '<g class="an-bob">' + (ANIMALS[kind] ? ANIMALS[kind]() : '') + '</g></svg>';
  }

  /* =========================================================
     SCENERY SPRITES — each returns {svg, w, h, ax, ay}
     ========================================================= */
  function tree(kind, seed) {
    const r = FF.rng(seed || 7);
    if (kind === 'pine') {
      const g1 = P('#2F7A43'), g2 = P('#3E9452'), g3 = P('#5BB06A');
      let s = ell(44, 122, 26, 7, 'url(#ff-shadow)') + '<rect x="36" y="100" width="8" height="22" rx="3" fill="' + P('#8B5A33') + '"/>';
      s += '<g class="sway" style="transform-origin:40px 118px">';
      [[40, 8, 30, 46], [40, 30, 36, 74], [40, 54, 42, 104]].forEach((t) => {
        const top = [t[0], t[1]], bl = [t[0] - t[2], t[3]], br = [t[0] + t[2], t[3]];
        s += '<path d="M' + top[0] + ' ' + top[1] + 'L' + br[0] + ' ' + br[1] + 'Q' + t[0] + ' ' + (t[3] + 7) + ' ' + bl[0] + ' ' + bl[1] + 'Z" fill="' + g1 + '" stroke="' + P('#246338') + '" stroke-width="1.2" stroke-linejoin="round"/>';
        s += '<path d="M' + top[0] + ' ' + top[1] + 'L' + (t[0] + 2) + ' ' + (t[3] + 4) + 'Q' + (t[0] - t[2] * 0.5) + ' ' + (t[3] + 4) + ' ' + bl[0] + ' ' + bl[1] + 'Z" fill="' + g2 + '"/>';
        s += '<path d="M' + (top[0] - 3) + ' ' + (top[1] + 10) + 'L' + (t[0] - t[2] * 0.55) + ' ' + (t[3] - 4) + '" stroke="' + g3 + '" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>';
      });
      s += '</g>';
      return { svg: wrap(s, 80, 130), w: 80, h: 130, ax: 40, ay: 120 };
    }
    if (kind === 'bush') {
      return { svg: wrap(bush(30, 40), 60, 46), w: 60, h: 46, ax: 30, ay: 40 };
    }
    const blossom = kind === 'blossom';
    const dark = P(blossom ? '#E77FA8' : '#4C9638'), mid = P(blossom ? '#F6A3C3' : '#63B04A'), lite = P(blossom ? '#FFD0E2' : '#8BD062');
    let s = ell(56, 112, 36, 9, 'url(#ff-shadow)');
    s += '<path d="M43 113c3-10 3-22 2-34h10c-1 12-1 24 2 34z" fill="' + P('#8B5A33') + '"/><path d="M50 113c1-10 1-22 1-34h4c-1 12-1 24 2 34z" fill="' + P('#734726') + '"/>';
    s += '<path d="M47 90c-5-4-9-4-12-8M53 88c4-4 8-5 11-9" stroke="' + P('#8B5A33') + '" stroke-width="3.5" stroke-linecap="round" fill="none"/>';
    s += '<g class="sway" style="transform-origin:50px 110px">';
    const blobs = [[50, 52, 30], [30, 62, 20], [70, 62, 20], [36, 40, 21], [64, 38, 21], [50, 27, 19], [50, 70, 18]];
    blobs.forEach((b) => { s += circ(b[0], b[1], b[2], dark); });
    blobs.forEach((b) => { s += circ(b[0] - 2.5, b[1] - 3.5, b[2] * 0.8, mid); });
    [[38, 32, 8], [56, 22, 7], [28, 54, 6], [62, 32, 5]].forEach((b) => { s += circ(b[0], b[1], b[2], lite, ' opacity=".9"'); });
    if (blossom) for (let q = 0; q < 10; q++) s += circ(26 + r() * 48, 26 + r() * 46, 1.6, P('#FFFFFF'), ' opacity=".9"');
    else for (let q = 0; q < 4; q++) s += circ(30 + r() * 40, 40 + r() * 34, 1.3, P('#3E7F2E'), ' opacity=".6"');
    s += '</g>';
    return { svg: wrap(s, 100, 120), w: 100, h: 120, ax: 50, ay: 112 };
  }
  const wrap = (inner, w, h, cls) => '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' + inner + '</svg>';

  function familyTree(label) {
    const dark = P('#3F8A30'), mid = P('#58A843'), lite = P('#82C95B'), bark = P('#8B5A33'), barkD = P('#6E4325');
    let s = ell(118, 232, 92, 18, 'url(#ff-shadow)');
    s += '<path d="M88 232c10-6 14-24 13-60l-2-36h30l-2 36c-1 36 3 54 13 60z" fill="' + bark + '"/>';
    s += '<path d="M110 230c3-12 4-34 3-58l-1-34h10l-1 34c-1 26 0 46 5 58z" fill="' + barkD + '" opacity=".55"/>';
    s += '<path d="M80 234c8-3 14-8 18-14M150 234c-8-3-12-8-16-14" stroke="' + bark + '" stroke-width="6" stroke-linecap="round" fill="none"/>';
    s += '<path transform="translate(112 182)" d="M0 5C-5 1-7-2-4.5-4.5-2.8-6 0-4.5 0-3c0-1.5 2.8-3 4.5-1.5C7-2 5 1 0 5z" fill="' + P('#C66A4A') + '"/>';
    // branch + swing
    s += '<path d="M126 132c14-4 30-6 48-4" stroke="' + bark + '" stroke-width="8" stroke-linecap="round" fill="none"/>';
    s += '<g class="swing" style="transform-origin:160px 130px">' + line([152, 130], [152, 192], P('#D9C4A2'), 1.6) + line([170, 130], [170, 192], P('#D9C4A2'), 1.6) +
      '<rect x="146" y="190" width="30" height="5" rx="2" fill="' + P('#C98F55') + '" stroke="' + P('#7A5236') + '" stroke-width="1"/></g>';
    s += '<g class="sway slow" style="transform-origin:115px 200px">';
    const blobs = [[115, 80, 56], [64, 100, 36], [166, 100, 36], [80, 60, 38], [150, 58, 38], [115, 36, 36], [92, 118, 30], [140, 118, 30]];
    blobs.forEach((b) => { s += circ(b[0], b[1], b[2], dark); });
    blobs.forEach((b) => { s += circ(b[0] - 4, b[1] - 6, b[2] * 0.82, mid); });
    [[92, 46, 14], [128, 30, 12], [62, 86, 10], [150, 54, 9], [108, 70, 8]].forEach((b) => { s += circ(b[0], b[1], b[2], lite, ' opacity=".9"'); });
    [[78, 92], [140, 80], [104, 52], [160, 108], [70, 112], [124, 106]].forEach((p) => { s += circ(p[0], p[1], 3.2, P('#FF7AA2')) + circ(p[0], p[1], 1.2, P('#FFE27A')); });
    s += '</g>';
    // little sign
    if (label) {
      const wd = Math.max(54, label.length * 7 + 14);
      s += line([62, 236], [62, 214], P('#7A5236'), 3) + '<rect x="' + f1(62 - wd / 2) + '" y="198" width="' + f1(wd) + '" height="17" rx="4" fill="' + P('#C98F55') + '" stroke="' + P('#7A5236') + '" stroke-width="1.4"/>' +
        '<text x="62" y="210.5" text-anchor="middle" font-size="10" font-weight="700" fill="' + P('#FFF7E8') + '" font-family="Fredoka, \'ZCOOL KuaiLe\', Mitr, sans-serif">' + esc(label) + '</text>';
    }
    return { svg: wrap(s, 230, 250), w: 230, h: 250, ax: 115, ay: 232 };
  }

  function windmill(o) {
    const wl = P('#FBF4E6'), ws = P('#E3D6BE'), st = P('#CFC6B5'), roof = P('#E0563F'), roofD = P('#B5402D'), wood = P('#B9824E'), woodD = P('#7A5236');
    let s = ell(74, 192, 50, 12, 'url(#ff-shadow)');
    s += poly([[38, 188], [70, 200], [70, 82], [48, 74]], wl, P('#B8A98E'), 1.4) + poly([[70, 200], [102, 188], [92, 74], [70, 82]], ws, P('#B8A98E'), 1.4);
    s += poly([[36, 186], [70, 198], [70, 190], [37, 179]], st, P('#A39A8A'), 1) + poly([[70, 198], [104, 186], [103, 179], [70, 190]], P('#B5AC9B'), P('#A39A8A'), 1);
    s += '<path d="M52 188v-20a7 7 0 0 1 14 3v24z" fill="' + P('#8A5A30') + '" stroke="' + woodD + '" stroke-width="1"/>';
    s += '<rect x="76" y="122" width="11" height="13" rx="2" fill="' + (night ? '#FFD36B' : '#A9DDF5') + '" stroke="' + P('#FFFCF4') + '" stroke-width="2" transform="skewY(-18) translate(0 26)"/>';
    s += '<path d="M44 78c4-22 16-34 27-34s23 12 27 34c-14 7-40 7-54 0z" fill="' + roof + '" stroke="' + roofD + '" stroke-width="1.4"/><path d="M71 44c11 0 23 12 27 34-6 3-14 4-22 4 4-12 3-26-5-38z" fill="' + roofD + '" opacity=".5"/>';
    if (o && o.noBlades) return { svg: wrap(s + circ(70, 66, 5.5, P('#8A5A30')), 140, 210), w: 140, h: 210, ax: 70, ay: 194, hub: [70, 66] };
    s += '<g class="blades" style="transform-origin:70px 66px">';
    for (let q = 0; q < 4; q++) {
      s += '<g transform="rotate(' + (q * 90 + 20) + ' 70 66)">' + line([70, 66], [70, 6], wood, 3) +
        '<rect x="71.5" y="9" width="13" height="46" rx="1.5" fill="' + P('#FFF6E6') + '" stroke="' + woodD + '" stroke-width="1.2"/>' +
        line([71.5, 20], [84.5, 20], woodD, 0.9) + line([71.5, 31], [84.5, 31], woodD, 0.9) + line([71.5, 42], [84.5, 42], woodD, 0.9) + line([78, 9], [78, 55], woodD, 0.9) + '</g>';
    }
    s += circ(70, 66, 5.5, P('#8A5A30')) + circ(70, 66, 2.2, P('#FFC23D')) + '</g>';
    return { svg: wrap(s, 140, 210), w: 140, h: 210, ax: 70, ay: 194 };
  }

  function windmillBlades() {
    const wood = P('#B9824E'), woodD = P('#7A5236');
    let s = '';
    for (let q = 0; q < 4; q++) {
      s += '<g transform="rotate(' + (q * 90 + 20) + ' 64 64)">' + line([64, 64], [64, 4], wood, 3) +
        '<rect x="65.5" y="7" width="13" height="46" rx="1.5" fill="' + P('#FFF6E6') + '" stroke="' + woodD + '" stroke-width="1.2"/>' +
        line([65.5, 18], [78.5, 18], woodD, 0.9) + line([65.5, 29], [78.5, 29], woodD, 0.9) + line([65.5, 40], [78.5, 40], woodD, 0.9) + line([72, 7], [72, 53], woodD, 0.9) + '</g>';
    }
    s += circ(64, 64, 5.5, P('#8A5A30')) + circ(64, 64, 2.2, P('#FFC23D'));
    return wrap(s, 128, 128);
  }
  function well() {
    const st = P('#CFC6B5'), sd = P('#A39A8A'), wood = P('#B9824E'), woodD = P('#7A5236'), roof = P('#E0563F');
    let s = ell(38, 74, 28, 7, 'url(#ff-shadow)');
    s += '<path d="M14 52v14a21 8 0 0 0 42 0V52" fill="' + st + '" stroke="' + sd + '" stroke-width="1.2"/>';
    for (let q = 0; q < 3; q++) s += '<path d="M14 ' + (57 + q * 4.5) + 'a21 8 0 0 0 42 0" fill="none" stroke="' + sd + '" stroke-width=".9" opacity=".7"/>';
    s += ell(35, 52, 21, 8, P('#E2DACB'), ' stroke="' + sd + '" stroke-width="1.2"') + ell(35, 52, 15.5, 5.2, night ? '#1B3866' : '#3A9ED8');
    s += line([18, 52], [18, 18], wood, 3.2) + line([52, 52], [52, 18], wood, 3.2) + line([16, 28], [54, 28], woodD, 2);
    s += poly([[10, 22], [35, 6], [60, 22], [60, 26], [35, 11], [10, 26]], roof, P('#B5402D'), 1.2);
    s += line([35, 28], [35, 40], P('#D9C4A2'), 1.2) + '<path d="M30 40h10l-1.4 7h-7.2z" fill="' + wood + '" stroke="' + woodD + '" stroke-width="1"/>';
    return { svg: wrap(s, 70, 82), w: 70, h: 82, ax: 35, ay: 72 };
  }

  function lamp() {
    let s = ell(13, 68, 8, 2.4, 'url(#ff-shadow)');
    if (night) s += circ(12, 14, 26, 'url(#ff-glow)', ' class="lamp-glow"');
    s += '<rect x="10.5" y="20" width="3" height="48" rx="1.5" fill="' + P('#3D3A36') + '"/><rect x="8" y="64" width="8" height="4" rx="1.5" fill="' + P('#3D3A36') + '"/>';
    s += '<path d="M6.5 9h11l-1.5 12h-8z" fill="' + (night ? '#FFE07A' : P('#FFF2C4')) + '" stroke="' + P('#3D3A36') + '" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 9l7-5 7 5z" fill="' + P('#3D3A36') + '"/>';
    return { svg: wrap(s, 24, 72, 'lamp'), w: 24, h: 72, ax: 12, ay: 68 };
  }
  function benchSprite() { return { svg: wrap(ell(26, 30, 20, 4, 'url(#ff-shadow)') + '<g transform="translate(22 26) scale(1.6)">' + bench(0, 0) + '</g>', 52, 36), w: 52, h: 36, ax: 26, ay: 30 }; }
  function signpost(top, bottom) {
    const wood = P('#C98F55'), woodD = P('#7A5236'), txt = P('#FFF7E8');
    const w1 = Math.max(56, top.length * 8 + 22), w2 = Math.max(56, bottom.length * 7 + 22);
    let s = ell(48, 90, 18, 4, 'url(#ff-shadow)') + line([48, 90], [48, 16], P('#8B5A33'), 5);
    s += '<path d="M' + (48 - w1 / 2) + ' 18h' + (w1 - 8) + 'l8 9-8 9h-' + (w1 - 8) + 'z" fill="' + wood + '" stroke="' + woodD + '" stroke-width="1.5" stroke-linejoin="round"/>';
    s += '<text x="' + (48 - 4) + '" y="31.5" text-anchor="middle" font-size="12" font-weight="700" fill="' + txt + '" font-family="Fredoka, sans-serif">' + esc(top) + '</text>';
    s += '<path d="M' + (48 + w2 / 2) + ' 44h-' + (w2 - 8) + 'l-8 8 8 8h' + (w2 - 8) + 'z" fill="' + P('#B9824E') + '" stroke="' + woodD + '" stroke-width="1.5" stroke-linejoin="round"/>';
    s += '<text x="' + (48 + 4) + '" y="56" text-anchor="middle" font-size="10" font-weight="700" fill="' + txt + '" font-family="Fredoka, \'ZCOOL KuaiLe\', Mitr, sans-serif">' + esc(bottom) + '</text>';
    return { svg: wrap(s, 96 + Math.max(0, w2 - 70), 96), w: 96 + Math.max(0, w2 - 70), h: 96, ax: 48, ay: 90 };
  }

  /* ---------------- the Family Goals stand ---------------- */
  function goalsStand(o) {
    o = o || {};
    const done = o.done || 0, total = o.total || 0;
    const wood = P('#C08A55'), woodS = P('#A06F40'), woodD = P('#6E4628'), cork = P('#D9A86C'), paper = P('#FFFBF0');
    const pct = total ? done / total : 0;
    let s = ell(80, 168, 64, 12, 'url(#ff-shadow)');
    // posts
    s += '<rect x="22" y="40" width="7" height="120" rx="2" fill="' + woodS + '" stroke="' + woodD + '" stroke-width="1"/><rect x="131" y="40" width="7" height="120" rx="2" fill="' + woodS + '" stroke="' + woodD + '" stroke-width="1"/>';
    // poster board
    s += '<rect x="30" y="44" width="100" height="78" rx="5" fill="' + cork + '" stroke="' + woodD + '" stroke-width="2"/>';
    for (let q = 0; q < 14; q++) s += circ(34 + (q * 37) % 92, 48 + (q * 23) % 70, 0.9, P('#B98448'));
    s += '<g transform="rotate(-2 80 82)"><rect x="40" y="50" width="80" height="66" rx="3" fill="' + paper + '" stroke="' + P('#E6DCC6') + '" stroke-width="1"/>';
    s += '<text x="80" y="64" text-anchor="middle" font-size="10.5" font-weight="700" fill="' + P('#7A4A26') + '" font-family="Fredoka, \'ZCOOL KuaiLe\', Mitr, sans-serif">' + esc(o.title || 'Goals') + '</text>';
    for (let q = 0; q < 4; q++) {
      const y = 74 + q * 9;
      const isDone = q < Math.round(pct * 4);
      s += '<rect x="46" y="' + (y - 3.5) + '" width="7" height="7" rx="2" fill="' + (isDone ? P('#3E9B55') : 'none') + '" stroke="' + P(isDone ? '#2F7D4A' : '#B8A88C') + '" stroke-width="1.1"/>';
      if (isDone) s += '<path d="M47.5 ' + y + 'l1.6 1.6 2.6-3" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
      s += line([57, y], [57 + 38 + (q * 13) % 18, y], P(isDone ? '#9BB59B' : '#C9BBA0'), 2.2);
    }
    s += '<rect x="46" y="108" width="68" height="5" rx="2.5" fill="' + P('#EFE6D2') + '"/><rect x="46" y="108" width="' + f1(68 * pct) + '" height="5" rx="2.5" fill="' + P('#FFC23D') + '"/>';
    s += '</g>';
    s += circ(44, 50, 2.4, P('#E0463A')) + circ(116, 50, 2.4, P('#3D7FD1'));
    if (total && done >= total) s += '<g transform="translate(118 112)">' + circ(0, 0, 11, P('#E0463A')) + circ(0, 0, 8, P('#FFC23D')) + '<path d="M-6 9l-3 12 6-4 2 6 2-12" fill="' + P('#E0463A') + '"/>' + emblem('star', 0, 0, 1.1, '#fff') + '</g>';
    // awning
    s += '<path d="M12 40l10-24h116l10 24z" fill="' + P('#FFF4E0') + '" stroke="' + woodD + '" stroke-width="1.6" stroke-linejoin="round"/>';
    for (let q = 0; q < 8; q += 2) s += poly([[12 + q * 17, 40], [22 + q * 14.5, 16], [22 + (q + 1) * 14.5, 16], [12 + (q + 1) * 17, 40]], P('#E0563F'));
    s += '<path d="M12 40l10-24h116l10 24z" fill="none" stroke="' + woodD + '" stroke-width="1.6" stroke-linejoin="round"/>';
    for (let q = 0; q < 8; q++) s += '<path d="M' + (12 + q * 17) + ' 40q8.5 10 17 0z" fill="' + P(q % 2 ? '#FFF4E0' : '#E0563F') + '" stroke="' + woodD + '" stroke-width="1.2" stroke-linejoin="round"/>';
    // counter (iso box)
    s += poly([[16, 136], [80, 156], [80, 168], [16, 148]], wood, woodD, 1.4) + poly([[80, 156], [144, 136], [144, 148], [80, 168]], woodS, woodD, 1.4);
    s += poly([[16, 136], [80, 116], [144, 136], [80, 156]], P('#D9A66B'), woodD, 1.4);
    s += line([20, 141], [80, 160], P('#9B6B43'), 0.8, ' opacity=".6"') + line([80, 160], [140, 141], P('#7A5236'), 0.8, ' opacity=".6"');
    // pot plant + pencil cup on the counter
    s += '<path d="M48 130h10l-1.5 8h-7z" fill="' + P('#C46A4E') + '"/>' + circ(50, 127, 4, P('#5DA845')) + circ(56, 126, 3.6, P('#78C05A')) + circ(53, 123, 3.4, P('#63B04A'));
    s += '<rect x="104" y="126" width="7" height="10" rx="1.5" fill="' + P('#3D7FD1') + '"/>' + line([106, 126], [104, 118], P('#FFC23D'), 1.8) + line([109, 126], [111, 119], P('#E0563F'), 1.8);
    return { svg: wrap(s, 160, 178, 'stand-svg'), w: 160, h: 178, ax: 80, ay: 160 };
  }

  /* =========================================================
     TOWN HALL — the family's shared building (+ its build plot)
     ========================================================= */
  function townHall(o) {
    o = o || {};
    const cx = 110, cy = 196, W = 74, Hh = 37, wh = 62;
    const wallC = '#F4E9D2', wall = P(wallC), wallS = P(shade(wallC, 0.83)), ln = P('#6B4A2E');
    const col = P('#FFFDF7'), colS = P('#E4DACA'), roof = P('#4E7BB5'), roofD = P(shade('#4E7BB5', 0.78)), roofL = P(shade('#4E7BB5', 1.12)), roofLn = P(shade('#4E7BB5', 0.55));
    const gold = P('#E8B032'), goldD = P('#B9852A');
    const glass = night ? '#FFD36B' : '#A9DDF5', glassLn = night ? '#E7A83A' : '#7DBFE0';
    const L0 = [cx - W, cy], F0 = [cx, cy + Hh], R0 = [cx + W, cy];
    const up = (p, t) => [p[0], p[1] - t];
    const lf = (sx, t) => [cx - W + sx, cy + sx * 0.5 - t];   // left face: sx along, t up
    const rf = (sx, t) => [cx + sx, cy + Hh - sx * 0.5 - t];  // right face
    let s = ell(cx + 16, cy + 18, W + 40, Hh + 22, 'url(#ff-shadow)');
    // stone plaza
    s += poly([[cx - W - 30, cy + 4], [cx, cy + Hh + 19], [cx + W + 30, cy + 4], [cx, cy - Hh - 11]], P('#D9D2C3'), P('#C2B9A6'), 1.2);
    for (let q = -3; q <= 3; q++) s += line([cx - W - 30 + 15 * (q + 3) * 0.95, cy + 4 + 7.5 * (q + 3) * 0.95], [cx + 15 * (q + 3) * 0.95 + 4, cy - Hh - 11 + 7.5 * (q + 3) * 0.95], P('#C9C1AF'), 0.7, ' opacity=".7"');
    // foundation + steps
    const fd = 7, Wf = W + 4;
    const fL = [cx - Wf, cy], fF = [cx, cy + Wf / 2], fR = [cx + Wf, cy];
    s += poly([fL, fF, up(fF, fd), up(fL, fd)], P('#CFC6B5'), P('#A39A8A'), 1) + poly([fF, fR, up(fR, fd), up(fF, fd)], P('#B5AC9B'), P('#A39A8A'), 1);
    for (let k = 0; k < 3; k++) {
      const a = lf(22 - k * 3, -k * 3 - 2), b = lf(54 + k * 3, -k * 3 - 2), d = 4 + k * 2;
      s += poly([[a[0] - d, a[1] + d * 0.5], [b[0] - d, b[1] + d * 0.5], [b[0] - d, b[1] + d * 0.5 + 3], [a[0] - d, a[1] + d * 0.5 + 3]], P(k % 2 ? '#E2DACA' : '#EDE6D8'), P('#B9B09E'), 0.8);
    }
    // back roof (behind the walls)
    const C = [cx, cy - wh], A = [cx, cy - wh - 36];
    const k = 1.13, sc = (p) => [C[0] + (p[0] - C[0]) * k, C[1] + (p[1] - C[1]) * k];
    const Lr = sc(up(L0, wh)), Fr = sc(up(F0, wh)), Rr = sc(up(R0, wh)), Br = sc([cx, cy - Hh - wh]);
    s += poly([Lr, Br, A], roofD, roofLn, 1.2) + poly([Br, Rr, A], roofD, roofLn, 1.2);
    // walls
    s += poly([L0, F0, up(F0, wh), up(L0, wh)], wall, ln, 1.3) + poly([F0, R0, up(R0, wh), up(F0, wh)], wallS, ln, 1.3);
    // right face: tall windows
    [12, 30, 48].forEach((x0) => {
      const a = rf(x0, 20), b = rf(x0 + 11, 20), c = rf(x0 + 11, 44), d = rf(x0, 44);
      s += poly([a, b, c, d], glass, P('#FFFCF4'), 1.6) + line(rf(x0 + 5.5, 20), rf(x0 + 5.5, 44), glassLn, 1) + poly([rf(x0 - 1.5, 47), rf(x0 + 12.5, 47), rf(x0 + 12.5, 50), rf(x0 - 1.5, 50)], P('#FFFCF4'));
    });
    // left face: door between columns
    s += poly([lf(31, 3), lf(45, 3), lf(45, 30), lf(31, 30)], P('#7A4A26'), P('#4E2F17'), 1.2) + line(lf(38, 3), lf(38, 30), P('#5C3820'), 1) + circ(lf(41, 16)[0], lf(41, 16)[1], 1.2, gold);
    // columns + capitals
    [8, 22, 50, 64].forEach((x0) => {
      s += poly([lf(x0, 2), lf(x0 + 6, 2), lf(x0 + 6, wh - 12), lf(x0, wh - 12)], col, P('#BFB4A0'), 1) + poly([lf(x0 + 4, 2), lf(x0 + 6, 2), lf(x0 + 6, wh - 12), lf(x0 + 4, wh - 12)], colS);
      s += poly([lf(x0 - 1.5, wh - 12), lf(x0 + 7.5, wh - 12), lf(x0 + 7.5, wh - 9), lf(x0 - 1.5, wh - 9)], col, P('#BFB4A0'), 0.8);
    });
    // entablature band + pediment with a clock
    s += poly([lf(-1, wh - 9), lf(W + 1, wh - 9), lf(W + 1, wh - 1), lf(-1, wh - 1)], P('#FFF8EA'), ln, 1);
    s += poly([lf(-3, wh - 1), lf(W + 3, wh - 1), lf(W / 2, wh + 20)], P('#FFF8EA'), ln, 1.3) + poly([lf(6, wh + 1.5), lf(W - 6, wh + 1.5), lf(W / 2, wh + 15)], P('#F1E6CF'));
    const ck = lf(W / 2, wh + 7.5);
    s += circ(ck[0], ck[1], 6, P('#FFFFFF'), ' stroke="' + goldD + '" stroke-width="1.6"') + line(ck, [ck[0], ck[1] - 3.8], ln, 1.1) + line(ck, [ck[0] + 2.8, ck[1] + 0.6], ln, 1.1);
    // front roof
    s += poly([Lr, Fr, A], roof, roofLn, 1.3) + poly([Fr, Rr, A], roofL, roofLn, 1.3);
    for (let q = 1; q < 5; q++) s += line([Lr[0] + (Fr[0] - Lr[0]) * q / 5, Lr[1] + (Fr[1] - Lr[1]) * q / 5], [A[0] + (Lr[0] - A[0]) * 0.15 + (Fr[0] - Lr[0]) * q / 5 * 0.15, A[1]], roofLn, 0.6, ' opacity=".35"');
    // cupola with a golden dome and flag
    const cpx = A[0], cpy = A[1] + 6;
    s += '<rect x="' + (cpx - 11) + '" y="' + (cpy - 24) + '" width="22" height="24" fill="' + wall + '" stroke="' + ln + '" stroke-width="1.2"/>' + '<rect x="' + cpx + '" y="' + (cpy - 24) + '" width="11" height="24" fill="' + wallS + '"/>';
    s += '<rect x="' + (cpx - 5) + '" y="' + (cpy - 19) + '" width="5" height="10" rx="2.5" fill="' + glass + '"/>' + '<rect x="' + (cpx + 2) + '" y="' + (cpy - 19) + '" width="5" height="10" rx="2.5" fill="' + glass + '" opacity=".8"/>';
    s += '<path d="M' + (cpx - 13) + ' ' + (cpy - 24) + 'Q' + cpx + ' ' + (cpy - 50) + ' ' + (cpx + 13) + ' ' + (cpy - 24) + 'z" fill="' + gold + '" stroke="' + goldD + '" stroke-width="1.2"/>';
    s += line([cpx, cpy - 37], [cpx, cpy - 56], P('#6B4A2E'), 1.4) + '<path class="flag-wave" style="transform-origin:' + cpx + 'px ' + (cpy - 54) + 'px" d="M' + cpx + ' ' + (cpy - 56) + 'l13 3-13 3.5z" fill="' + P(o.flag || '#E0563F') + '"/>';
    // little bunting flags on the roof corners
    [Lr, Rr].forEach((p, i) => { s += line(p, [p[0], p[1] - 12], P('#6B4A2E'), 1) + '<path d="M' + f1(p[0]) + ' ' + f1(p[1] - 12) + 'l' + (i ? 8 : -8) + ' 2 ' + (i ? -8 : 8) + ' 2.4z" fill="' + P(i ? '#FFC23D' : '#3E9B55') + '"/>'; });
    // planters
    [lf(-6, -6), rf(W + 4, -6)].forEach((p) => { s += '<rect x="' + f1(p[0] - 6) + '" y="' + f1(p[1] - 6) + '" width="12" height="7" rx="1.5" fill="' + P('#C46A4E') + '"/>' + circ(p[0] - 3, p[1] - 8, 4.2, P('#5DA845')) + circ(p[0] + 3, p[1] - 9, 4.4, P('#78C05A')) + circ(p[0] + 1, p[1] - 12, 3.4, P('#E66FA0')); });
    return { svg: wrap(s, 220, 250, 'hall-svg'), w: 220, h: 250, ax: cx, ay: cy, top: cy - wh - 36 - 70 };
  }
  /* an empty plot waiting for the family to build its hall */
  function buildSite() {
    const cx = 80, cy = 112;
    const wood = P('#C08A55'), woodD = P('#6E4628');
    let s = ell(cx + 6, cy + 10, 78, 30, 'url(#ff-shadow)');
    s += poly([[cx - 70, cy], [cx, cy + 35], [cx + 70, cy], [cx, cy - 35]], P('#E9CF9C'), P('#CDB07A'), 1.4);
    for (let q = 0; q < 9; q++) { const r = FF.rng(q + 5); s += circ(cx - 50 + r() * 100, cy - 20 + r() * 40, 1.6, P('#CDB07A')); }
    // fence posts around the plot
    [[-64, 0], [-40, 12], [-16, 24], [16, 24], [40, 12], [64, 0], [-40, -12], [40, -12]].forEach((d) => { s += '<rect x="' + (cx + d[0] - 2) + '" y="' + (cy + d[1] - 16) + '" width="4" height="16" rx="1" fill="' + wood + '" stroke="' + woodD + '" stroke-width=".8"/>'; });
    s += line([cx - 64, cy - 10], [cx - 16, cy + 14], wood, 2.2) + line([cx + 16, cy + 14], [cx + 64, cy - 10], wood, 2.2);
    // brick pile + cone
    for (let k = 0; k < 3; k++) for (let q = 0; q < 3 - k; q++) s += '<rect x="' + (cx + 18 + q * 9 + k * 4.5) + '" y="' + (cy - 8 - k * 5) + '" width="8" height="5" rx="1" fill="' + P('#C8553D') + '" stroke="' + P('#8E3A28') + '" stroke-width=".7"/>';
    s += '<path d="M' + (cx - 30) + ' ' + (cy + 6) + 'l6-16 6 16z" fill="' + P('#F08A3C') + '"/><rect x="' + (cx - 27) + '" y="' + (cy - 3) + '" width="6" height="2.6" fill="#fff"/>';
    // sign: a little hall on the board
    s += '<rect x="' + (cx - 3) + '" y="' + (cy - 70) + '" width="6" height="66" rx="1.5" fill="' + wood + '" stroke="' + woodD + '" stroke-width="1"/>';
    s += '<rect x="' + (cx - 30) + '" y="' + (cy - 84) + '" width="60" height="40" rx="5" fill="' + P('#FFFBF0') + '" stroke="' + woodD + '" stroke-width="1.6"/>';
    s += '<path d="M' + (cx - 14) + ' ' + (cy - 62) + 'h28M' + (cx - 11) + ' ' + (cy - 62) + 'v12M' + (cx - 4) + ' ' + (cy - 62) + 'v12M' + (cx + 4) + ' ' + (cy - 62) + 'v12M' + (cx + 11) + ' ' + (cy - 62) + 'v12M' + (cx - 15) + ' ' + (cy - 50) + 'h30" stroke="' + P('#4E7BB5') + '" stroke-width="2.2" stroke-linecap="round" fill="none"/>';
    s += poly([[cx - 16, cy - 63], [cx + 16, cy - 63], [cx, cy - 76]], P('#4E7BB5'));
    s += circ(cx + 21, cy - 76, 8, P('#3E9B55')) + '<path d="M' + (cx + 17) + ' ' + (cy - 76) + 'h8M' + (cx + 21) + ' ' + (cy - 80) + 'v8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>';
    return { svg: wrap(s, 160, 140, 'site-svg'), w: 160, h: 140, ax: cx, ay: cy };
  }

  /* =========================================================
     THE ARCADE — Block Blast's building (+ a neon sign that
     blinks on its own GPU layer in the village)
     ========================================================= */
  const BB_COLORS = ['#FF4D5E', '#FF9F1C', '#FFD23F', '#3DDC84', '#2EC4F1', '#4D7CFE', '#A66CFF'];
  /* a little isometric cube, s = half width, sitting on (x, y) */
  function isoCube(x, y, s, color) {
    const top = [[x, y - s * 1.5], [x + s, y - s], [x, y - s * 0.5], [x - s, y - s]];
    const left = [[x - s, y - s], [x, y - s * 0.5], [x, y + s * 0.5], [x - s, y]];
    const right = [[x, y - s * 0.5], [x + s, y - s], [x + s, y], [x, y + s * 0.5]];
    return poly(top, P(shade(color, 1.18)), P(shade(color, 0.6)), 0.8) + poly(left, P(color), P(shade(color, 0.6)), 0.8) + poly(right, P(shade(color, 0.78)), P(shade(color, 0.6)), 0.8) +
      line([x - s * 0.55, y - s * 1.0], [x - s * 0.1, y - s * 1.23], '#FFFFFF', 1, ' opacity=".55"');
  }
  function arcade(o) {
    o = o || {};
    const cx = 110, cy = 200, W = 66, Hh = 33, wh = 56;
    const wallC = '#6A4BC4', wall = P(wallC), wallS = P(shade(wallC, 0.78)), ln = P('#2E1C66');
    const roofC = P('#3D2A85'), trimC = P('#8F74E6');
    const glass = night ? '#7FE7FF' : '#A9E8FF';
    const L0 = [cx - W, cy], F0 = [cx, cy + Hh], R0 = [cx + W, cy], B0 = [cx, cy - Hh];
    const up = (p, t) => [p[0], p[1] - t];
    const lf = (sx, t) => [cx - W + sx, cy + sx * 0.5 - t];
    const rf = (sx, t) => [cx + sx, cy + Hh - sx * 0.5 - t];
    let s = ell(cx + 14, cy + 18, W + 44, Hh + 24, 'url(#ff-shadow)');
    // a playful tiled forecourt
    s += poly([[cx - W - 30, cy + 4], [cx, cy + Hh + 19], [cx + W + 30, cy + 4], [cx, cy - Hh - 11]], P('#2E9C9A'), P('#22807E'), 1.2);
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
      if ((a + b) % 2) continue;
      const u = (a - 2.5) / 6, v = (b - 2.5) / 6;
      const px = cx + (u - v) * (W + 30), py = cy + 4 + (u + v) * (Hh + 15) - 4;
      s += poly([[px - 9, py], [px, py + 4.5], [px + 9, py], [px, py - 4.5]], P(BB_COLORS[(a * 3 + b) % 7]), null, 0, ' opacity=".55"');
    }
    // foundation + walls
    const fd = 6, Wf = W + 3;
    s += poly([[cx - Wf, cy], [cx, cy + Wf / 2], up([cx, cy + Wf / 2], fd), up([cx - Wf, cy], fd)], P('#CFC6E6'), P('#9A8FC2'), 1) + poly([[cx, cy + Wf / 2], [cx + Wf, cy], up([cx + Wf, cy], fd), up([cx, cy + Wf / 2], fd)], P('#B3A8D6'), P('#9A8FC2'), 1);
    s += poly([L0, F0, up(F0, wh), up(L0, wh)], wall, ln, 1.3) + poly([F0, R0, up(R0, wh), up(F0, wh)], wallS, ln, 1.3);
    // stripes of colour along the bottom of the walls
    [0, 1, 2, 3, 4, 5, 6].forEach((k) => {
      s += poly([lf(k * 9.4, 4), lf(k * 9.4 + 9.4, 4), lf(k * 9.4 + 9.4, 9), lf(k * 9.4, 9)], P(BB_COLORS[k]), null, 0, ' opacity=".9"');
      s += poly([rf(k * 9.4, 4), rf(k * 9.4 + 9.4, 4), rf(k * 9.4 + 9.4, 9), rf(k * 9.4, 9)], P(shade(BB_COLORS[k], 0.85)), null, 0, ' opacity=".9"');
    });
    // right wall: a big game screen showing a board with blocks
    s += poly([rf(8, 16), rf(58, 16), rf(58, 48), rf(8, 48)], P('#1E2B59'), P('#FFFFFF'), 1.6);
    for (let a = 0; a < 6; a++) for (let b = 0; b < 4; b++) {
      if ((a * 7 + b * 3) % 5 === 0) continue;
      const x0 = 10.5 + a * 7.8, t0 = 18.5 + b * 7.3;
      s += poly([rf(x0, t0), rf(x0 + 6.6, t0), rf(x0 + 6.6, t0 + 6.2), rf(x0, t0 + 6.2)], P(BB_COLORS[(a + b * 2) % 7]));
    }
    if (night) s += poly([rf(8, 16), rf(58, 16), rf(58, 48), rf(8, 48)], 'url(#ff-glow)', null, 0, ' opacity=".35"');
    // left wall: glass doors with a neon frame
    s += poly([lf(18, 0), lf(48, 0), lf(48, 34), lf(18, 34)], P('#2B1B60'));
    s += poly([lf(20, 1), lf(32.5, 1), lf(32.5, 31), lf(20, 31)], glass, null, 0, ' opacity=".85"') + poly([lf(33.5, 1), lf(46, 1), lf(46, 31), lf(33.5, 31)], glass, null, 0, ' opacity=".85"');
    s += '<path d="M' + pts([lf(17, 0), lf(17, 35), lf(49, 35), lf(49, 0)]).replace(/ /g, 'L') + '" fill="none" stroke="' + (night ? '#7DF9FF' : '#2EC4F1') + '" stroke-width="2.4" stroke-linejoin="round"/>';
    s += line(lf(22, 18), lf(30, 22), '#FFFFFF', 1.4, ' opacity=".6"') + circ(lf(31.5, 15)[0], lf(31.5, 15)[1], 1.2, P('#FFD23F')) + circ(lf(35, 15)[0], lf(35, 15)[1], 1.2, P('#FFD23F'));
    // roof
    const k = 1.06, C = [cx, cy - wh];
    const sc = (p) => [C[0] + (p[0] - C[0]) * k, C[1] + (p[1] - C[1]) * k];
    const Lr = sc(up(L0, wh)), Fr = sc(up(F0, wh)), Rr = sc(up(R0, wh)), Br = sc(up(B0, wh));
    s += poly([Lr, Fr, Rr, Br], roofC, ln, 1.3);
    s += poly([Lr, Fr, up(Fr, 5), up(Lr, 5)], trimC, ln, 1) + poly([Fr, Rr, up(Rr, 5), up(Fr, 5)], P(shade('#8F74E6', 0.8)), ln, 1);
    // a stack of blocks on the roof
    s += isoCube(cx + 34, cy - wh - 4, 8, BB_COLORS[5]) + isoCube(cx + 46, cy - wh + 2, 8, BB_COLORS[0]) + isoCube(cx + 40, cy - wh - 13, 8, BB_COLORS[2]);
    // the sign
    const sx = cx - 74, sy = cy - wh - 66, sw = 120, sh = 46;
    s += line([cx - 40, cy - wh - 2], [cx - 40, sy + sh], P('#2E1C66'), 3) + line([cx - 4, cy - wh + 4], [cx - 4, sy + sh], P('#2E1C66'), 3);
    s += '<rect x="' + sx + '" y="' + sy + '" width="' + sw + '" height="' + sh + '" rx="10" fill="' + P('#1A1440') + '" stroke="' + P('#FF4FA3') + '" stroke-width="3"/>';
    for (let q = 0; q < 16; q++) { const t = q / 16; const bx = t < 0.5 ? sx + 6 + t * 2 * (sw - 12) : sx + 6 + (1 - t) * 2 * (sw - 12); const by = t < 0.5 ? sy + 2.5 : sy + sh - 2.5; s += circ(bx, by, 1.4, q % 2 ? P('#FFD23F') : '#FFFFFF'); }
    s += '<text x="' + (sx + sw / 2) + '" y="' + (sy + 20) + '" text-anchor="middle" font-size="15" font-weight="700" letter-spacing="1" fill="' + P('#7DF9FF') + '" font-family="Fredoka, Nunito, sans-serif">BLOCK</text>';
    s += '<text x="' + (sx + sw / 2) + '" y="' + (sy + 39) + '" text-anchor="middle" font-size="19" font-weight="700" letter-spacing="1.5" fill="' + P('#FFC23D') + '" stroke="' + P('#C2410C') + '" stroke-width=".8" font-family="Fredoka, Nunito, sans-serif">BLAST</text>';
    [[sx + 8, sy + 12, 0], [sx + 14, sy + 12, 3], [sx + 8, sy + 18, 4], [sx + sw - 14, sy + 30, 1], [sx + sw - 8, sy + 30, 6], [sx + sw - 8, sy + 36, 2]].forEach((b) => { s += '<rect x="' + b[0] + '" y="' + b[1] + '" width="5.4" height="5.4" rx="1" fill="' + P(BB_COLORS[b[2]]) + '"/>'; });
    // little block stacks on the forecourt
    s += isoCube(cx - W - 8, cy + 8, 7, BB_COLORS[3]) + isoCube(cx - W + 4, cy + 14, 7, BB_COLORS[1]) + isoCube(cx - W - 2, cy + 1, 7, BB_COLORS[6]);
    s += isoCube(cx + W + 8, cy + 10, 7, BB_COLORS[4]) + isoCube(cx + W - 2, cy + 16, 6, BB_COLORS[0]);
    return { svg: wrap(s, 220, 262, 'arcade-svg'), w: 220, h: 262, ax: cx, ay: cy, sign: [sx, sy, sw, sh] };
  }

  /* =========================================================
     GROUND — the big static village land (rendered once)
     ========================================================= */
  function ground(o) {
    o = o || {};
    const G = FF.grid;
    const W = G.W, H = G.H;
    const r = FF.rng(4242);
    const grass = P('#8DC85A'), grassD = P('#7AB94A'), tuft = P('#6BAA40'), tuftL = P('#A8D97A');
    const forest = P('#3C7A33'), forest2 = P('#4E9A3C'), forest3 = P('#66B04A'), forestL = P('#86C95E');
    // o.scale: a standalone copy (its own gradients) drawn once into a picture at that resolution
    const k = o.scale || 1;
    let s = '<svg ' + (o.scale ? 'xmlns="http://www.w3.org/2000/svg" ' : 'class="ground-svg" ') + 'viewBox="0 0 ' + W + ' ' + H + '" width="' + W * k + '" height="' + H * k + '" aria-hidden="true"><defs>' + (o.scale ? defsInner() : '') +
      '<pattern id="ff-tufts' + (night ? 'n' : '') + '" width="86" height="86" patternUnits="userSpaceOnUse">' +
      '<path d="M10 20l2-6 2 6M40 50l2.4-7 2 7M66 18l2-5 2 5M22 70l2-6 2 6M74 66l1.6-5 1.6 5" stroke="' + tuft + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      circ(52, 26, 1.4, tuftL) + circ(14, 46, 1.2, tuftL) + circ(78, 40, 1.2, tuftL) + circ(36, 80, 1.3, tuftL) + '</pattern>' +
      '<clipPath id="ff-landclip"><path d="' + landPath() + '"/></clipPath></defs>';
    // forest floor + land
    s += '<rect width="' + W + '" height="' + H + '" fill="' + P('#3A6E30') + '"/>';
    s += '<path d="' + landPath() + '" fill="' + grass + '"/>';
    s += '<g clip-path="url(#ff-landclip)">';
    s += '<rect width="' + W + '" height="' + H + '" fill="url(#ff-tufts' + (night ? 'n' : '') + ')"/>';
    // light & dark patches
    for (let q = 0; q < 16; q++) s += ell(80 + r() * 840, 160 + r() * 1240, 70 + r() * 110, 40 + r() * 60, night ? 'url(#ff-dark)' : 'url(#ff-light)', ' opacity="' + (night ? 0.5 : 0.65) + '"');
    for (let q = 0; q < 8; q++) s += ell(80 + r() * 840, 160 + r() * 1240, 60 + r() * 90, 36 + r() * 50, 'url(#ff-dark)', ' opacity=".55"');
    s += '<path d="' + landPath() + '" fill="none" stroke="' + grassD + '" stroke-width="46" opacity=".55"/>';
    // dirt paths
    const paths = [
      'M505 1520C520 1360 470 1160 505 950',
      'M455 790C390 690 330 610 285 560',
      'M555 790C640 690 720 590 780 500',
      'M565 905C625 980 655 1030 670 1072',
      'M445 905C390 980 335 1030 305 1060'
    ];
    paths.forEach((d) => { s += '<path d="' + d + '" fill="none" stroke="' + P('#C9A66A') + '" stroke-width="50" stroke-linecap="round"/>'; });
    paths.forEach((d) => { s += '<path d="' + d + '" fill="none" stroke="' + P('#E6C98E') + '" stroke-width="40" stroke-linecap="round"/>'; });
    paths.forEach((d) => { s += '<path d="' + d + '" fill="none" stroke="' + P('#F0D9A6') + '" stroke-width="14" stroke-linecap="round" stroke-dasharray="2 26" opacity=".9"/>'; });
    // plaza
    const PZ = G.PLAZA;
    s += ell(PZ.x, PZ.y + 4, PZ.r + 12, (PZ.r + 12) * 0.56, P('#C9A66A'));
    s += ell(PZ.x, PZ.y, PZ.r + 6, (PZ.r + 6) * 0.56, P('#DCCBAE'));
    for (let ring = 0; ring < 5; ring++) {
      const rr = (PZ.r - 8) * (1 - ring / 5);
      const n = Math.max(6, Math.round(rr / 6));
      for (let q = 0; q < n; q++) {
        const a = (q / n) * Math.PI * 2 + ring;
        s += ell(PZ.x + Math.cos(a) * rr, PZ.y + Math.sin(a) * rr * 0.56, 7.2, 4, P(ring % 2 ? '#E9DCC3' : '#E2D3B6'), ' stroke="' + P('#C7B594') + '" stroke-width=".8"');
      }
    }
    s += ell(PZ.x, PZ.y, 9, 5, P('#E9DCC3'), ' stroke="' + P('#C7B594') + '" stroke-width=".8"');
    // pond
    const PD = G.POND;
    s += ell(PD.x + 6, PD.y + 10, PD.rx + 18, PD.ry + 14, P('#C9B079'));
    s += '<path d="' + blob(PD.x, PD.y, PD.rx + 10, PD.ry + 8, 11, 0.07) + '" fill="' + P('#EBD6A2') + '"/>';
    s += '<path d="' + blob(PD.x, PD.y, PD.rx, PD.ry, 11, 0.06) + '" fill="url(#ff-water' + (night ? '-n' : '') + ')" stroke="' + P('#BFA36A') + '" stroke-width="3"/>';
    s += ell(PD.x - 40, PD.y - 30, 46, 10, '#FFFFFF', ' opacity="' + (night ? 0.12 : 0.35) + '"') + ell(PD.x + 50, PD.y - 18, 22, 5, '#FFFFFF', ' opacity="' + (night ? 0.1 : 0.3) + '"');
    [[PD.x - 70, PD.y + 20, 14], [PD.x + 60, PD.y + 30, 12], [PD.x + 92, PD.y - 10, 10], [PD.x - 20, PD.y + 44, 9]].forEach((l) => {
      s += '<path d="M' + l[0] + ' ' + l[1] + 'm' + l[2] + ' 0a' + l[2] + ' ' + (l[2] * 0.55) + ' 0 1 1 -4 -5l-' + (l[2] - 4) + ' 5z" fill="' + P('#5DB04C') + '" stroke="' + P('#3E8A35') + '" stroke-width="1"/>';
    });
    s += circ(PD.x + 60, PD.y + 25, 3.2, P('#FF9FC0')) + circ(PD.x + 60, PD.y + 25, 1.3, P('#FFE27A'));
    // reeds & stones around the pond
    [[PD.x - PD.rx + 8, PD.y - 20], [PD.x - PD.rx + 18, PD.y - 34], [PD.x + PD.rx - 14, PD.y + 26], [PD.x + PD.rx - 4, PD.y + 8]].forEach((p) => {
      for (let q = 0; q < 4; q++) s += line([p[0] + q * 4, p[1]], [p[0] + q * 4 + (q - 1.5) * 2, p[1] - 18 - q * 3], P('#4E8F38'), 2) ;
      s += ell(p[0] + 6, p[1] - 21, 2.2, 5, P('#8B5A33'));
    });
    [[PD.x - PD.rx - 2, PD.y + 26, 9], [PD.x + PD.rx - 30, PD.y - PD.ry + 2, 8], [PD.x + 20, PD.y + PD.ry + 6, 10]].forEach((p) => { s += ell(p[0], p[1], p[2], p[2] * 0.6, P('#C9C2B5'), ' stroke="' + P('#A39B8C') + '" stroke-width="1.2"') + ell(p[0] - 2, p[1] - 2, p[2] * 0.5, p[2] * 0.25, P('#E2DCD2')); });
    // flowers + tufts scattered (not on paths/plaza/pond)
    const onPath = (x, y) => (Math.abs(x - 505) < 48 && y > 900) || Math.hypot((x - PZ.x), (y - PZ.y) / 0.56) < PZ.r + 24 || Math.hypot((x - PD.x) / (PD.rx + 30), (y - PD.y) / (PD.ry + 30)) < 1;
    const colors = ['#FF7AA2', '#FFD54A', '#FFFFFF', '#B98CFF', '#FF8A4C', '#7FC8FF'];
    for (let q = 0; q < 170; q++) {
      const x = 80 + r() * 840, y = 170 + r() * 1240;
      if (onPath(x, y)) continue;
      const c = colors[Math.floor(r() * colors.length)];
      if (r() < 0.55) {
        for (let p = 0; p < 3; p++) { const fx = x + (r() - 0.5) * 14, fy = y + (r() - 0.5) * 8; s += line([fx, fy], [fx, fy - 4], P('#4E9A3C'), 1) + circ(fx, fy - 5, 2.2, P(c)) + circ(fx, fy - 5, 0.9, P('#FFE27A')); }
      } else s += '<path d="M' + f1(x) + ' ' + f1(y) + 'l2-7 2 7M' + f1(x + 4) + ' ' + f1(y) + 'l2.6-9 2 9M' + f1(x + 9) + ' ' + f1(y) + 'l1.6-6 1.6 6" stroke="' + P('#5E9E3A') + '" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    // rocks & mushrooms
    for (let q = 0; q < 14; q++) {
      const x = 90 + r() * 820, y = 180 + r() * 1220;
      if (onPath(x, y)) continue;
      if (q % 3 === 0) s += '<rect x="' + f1(x - 1) + '" y="' + f1(y - 6) + '" width="3" height="6" rx="1" fill="' + P('#FFF4E0') + '"/><path d="M' + f1(x - 5) + ' ' + f1(y - 5) + 'a5.5 4.4 0 0 1 11 0z" fill="' + P('#E0463A') + '"/>' + circ(x - 1.5, y - 7.4, 1, P('#FFFFFF')) + circ(x + 2, y - 6.2, 0.9, P('#FFFFFF'));
      else s += ell(x, y, 8 + r() * 6, 5 + r() * 3, P('#C9C2B5'), ' stroke="' + P('#A39B8C') + '" stroke-width="1.2"') + ell(x - 2, y - 2, 4, 2, P('#E2DCD2'));
    }
    s += '</g>';
    // forest ring around the land
    const ring = landPoints(2.5);
    const ringT = [];
    ring.forEach((p, i) => { if (i % 2 === 0) ringT.push(p); });
    [[1.0, forest], [0.82, forest2]].forEach((row, ri) => {
      ringT.forEach((p, i) => {
        const dir = [p[0] - W / 2, p[1] - H / 2];
        const len = Math.hypot(dir[0], dir[1]);
        const off = 44 + ri * -14 + (i % 3) * 6;
        const x = p[0] + (dir[0] / len) * off, y = p[1] + (dir[1] / len) * off;
        const rad = (ri ? 30 : 46) + ((i * 37) % 13);
        s += circ(x, y, rad, row[1]);
      });
    });
    ringT.forEach((p, i) => {
      const dir = [p[0] - W / 2, p[1] - H / 2];
      const len = Math.hypot(dir[0], dir[1]);
      const x = p[0] + (dir[0] / len) * 30, y = p[1] + (dir[1] / len) * 30;
      s += circ(x - 6, y - 8, 18 + (i % 4) * 3, forest3) + circ(x - 10, y - 14, 8, forestL, ' opacity=".9"');
    });
    s += '</svg>';
    return s;
  }
  const landPoints = (stepDeg) => FF.grid.landPoints(stepDeg);
  function landPath() {
    const p = landPoints(4);
    return 'M' + p.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') + 'Z';
  }
  function blob(cx, cy, rx, ry, n, wob) {
    const r = FF.rng(Math.round(cx * 7 + cy));
    const ptsB = [];
    for (let q = 0; q < n; q++) { const a = (q / n) * Math.PI * 2; const k = 1 + (r() - 0.5) * wob * 2; ptsB.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
    let d = 'M' + f1((ptsB[0][0] + ptsB[n - 1][0]) / 2) + ' ' + f1((ptsB[0][1] + ptsB[n - 1][1]) / 2);
    for (let q = 0; q < n; q++) { const p = ptsB[q], nx = ptsB[(q + 1) % n]; d += 'Q' + f1(p[0]) + ' ' + f1(p[1]) + ' ' + f1((p[0] + nx[0]) / 2) + ' ' + f1((p[1] + nx[1]) / 2); }
    return d + 'Z';
  }

  /* =========================================================
     LOGO / ILLUSTRATIONS
     ========================================================= */
  function logo(size, rounded) {
    const s = size || 96;
    return '<svg class="logo-svg" viewBox="0 0 120 120" width="' + s + '" height="' + s + '" aria-hidden="true">' +
      '<defs><linearGradient id="lg-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ED8FF"/><stop offset="1" stop-color="#E3F7FF"/></linearGradient>' +
      '<clipPath id="lg-clip"><rect width="120" height="120" rx="' + (rounded === false ? 0 : 27) + '"/></clipPath></defs>' +
      '<g clip-path="url(#lg-clip)"><rect width="120" height="120" fill="url(#lg-sky)"/>' +
      '<circle cx="92" cy="28" r="15" fill="url(#ff-gold)" stroke="#E89A12" stroke-width="2"/><circle cx="92" cy="28" r="10.5" fill="none" stroke="#E89A12" stroke-width="1.4" opacity=".55"/>' +
      '<path d="M92 35v-7" stroke="#FFF6D6" stroke-width="2.2" stroke-linecap="round"/><path d="M92 29c0-4.2 2.6-6.8 6.6-6.8 0 4.2-2.7 6.8-6.6 6.8z" fill="#FFF6D6"/><path d="M92 30.5c0-3-1.9-5-4.8-5 0 3 2 5 4.8 5z" fill="#FFF6D6"/>' +
      '<ellipse cx="30" cy="30" rx="14" ry="6" fill="#fff" opacity=".9"/><ellipse cx="40" cy="27" rx="10" ry="6" fill="#fff" opacity=".9"/>' +
      '<path d="M-10 92c20-14 46-16 70-10s50 4 70-6v50H-10z" fill="#7CC152"/><path d="M-10 102c26-10 56-10 80-4s40 2 60-4v40H-10z" fill="#5FAA3F"/>' +
      '<path d="M34 92V64l26-22 26 22v28z" fill="#FFF1D6" stroke="#6E4628" stroke-width="3.2" stroke-linejoin="round"/>' +
      '<path d="M28 66l32-28 32 28" fill="none" stroke="#E0563F" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M51 92V77a9 9 0 0 1 18 0v15z" fill="#8A5A30" stroke="#6E4628" stroke-width="2.6"/>' +
      '<path d="M60 82.5c-3.2-2.4-4.8-4.3-3.4-5.9 1-1.1 2.6-.6 3.4.6.8-1.2 2.4-1.7 3.4-.6 1.4 1.6-.2 3.5-3.4 5.9z" fill="#FFC23D"/>' +
      '<rect x="39" y="68" width="9" height="9" rx="2" fill="#A9DDF5" stroke="#6E4628" stroke-width="2.2"/><rect x="72" y="68" width="9" height="9" rx="2" fill="#A9DDF5" stroke="#6E4628" stroke-width="2.2"/>' +
      '<rect x="72" y="36" width="8" height="14" rx="1.5" fill="#C46A4E" stroke="#6E4628" stroke-width="2.4"/>' +
      '<path d="M18 96l2-6 2 6M98 98l2-7 2 7" stroke="#4E9A3C" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="24" cy="104" r="3" fill="#FF7AA2"/><circle cx="96" cy="106" r="3" fill="#FFD54A"/>' +
      '</g></svg>';
  }

  /* little illustrations for empty states */
  function emptyArt(kind, size) {
    const s = size || 140;
    let inner = '';
    if (kind === 'poster') {
      inner = '<rect x="30" y="18" width="80" height="96" rx="6" fill="#FFFBF0" stroke="#E6DCC6" stroke-width="2" transform="rotate(-4 70 66)"/><circle cx="70" cy="22" r="4" fill="#E0463A"/>' +
        '<path d="M48 54h44M48 70h36M48 86h40" stroke="#E6DCC6" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 9"/><path d="M95 98l14-14 6 6-14 14-8 2z" fill="#FFC23D" stroke="#B9824E" stroke-width="2" stroke-linejoin="round"/>';
    } else if (kind === 'basket') {
      inner = '<ellipse cx="70" cy="116" rx="44" ry="8" fill="#000" opacity=".08"/><path d="M28 64h84l-8 44a8 8 0 0 1-8 6H44a8 8 0 0 1-8-6z" fill="#D9A66B" stroke="#8A5A30" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M44 64c0-22 52-22 52 0" fill="none" stroke="#8A5A30" stroke-width="4"/><path d="M38 80h64M41 96h58" stroke="#B9824E" stroke-width="3"/>' +
        '<circle cx="60" cy="56" r="9" fill="url(#ff-gold)" stroke="#E89A12" stroke-width="2"/><circle cx="80" cy="58" r="7" fill="url(#ff-gold)" stroke="#E89A12" stroke-width="2"/>';
    } else if (kind === 'sprout') {
      inner = '<ellipse cx="70" cy="114" rx="40" ry="8" fill="#000" opacity=".08"/><path d="M46 92h48l-6 22H52z" fill="#C46A4E" stroke="#7A3B28" stroke-width="3" stroke-linejoin="round"/><rect x="42" y="84" width="56" height="10" rx="4" fill="#D97C5E" stroke="#7A3B28" stroke-width="3"/>' +
        '<path d="M70 84V52" stroke="#3E9B55" stroke-width="4" stroke-linecap="round"/><path d="M70 60c0-16 10-26 26-26 0 16-10 26-26 26z" fill="#63B04A" stroke="#3E8A35" stroke-width="3"/><path d="M70 66c0-12-8-20-21-20 0 13 8 20 21 20z" fill="#82C95B" stroke="#3E8A35" stroke-width="3"/>' +
        '<circle cx="104" cy="40" r="8" fill="url(#ff-gold)" stroke="#E89A12" stroke-width="2"/>';
    } else { // village / map
      inner = '<ellipse cx="70" cy="104" rx="60" ry="20" fill="#9BD167"/><ellipse cx="70" cy="100" rx="54" ry="16" fill="#A8D977"/>' +
        '<g transform="translate(70 100) scale(.42)">' + house({ roof: 'gable', roofColor: '#E0563F', wall: 'plaster', wallColor: '#FFF1D6', door: 'arch', doorColor: '#8A5A30', flag: { on: true, color: '#FFC23D', emblem: 'star' }, decor: ['flowers'] }, 2, { still: true }).replace('<svg', '<svg x="-96" y="-228"') + '</g>';
    }
    return '<svg viewBox="0 0 140 130" width="' + s + '" height="' + Math.round(s * 130 / 140) + '" aria-hidden="true">' + inner + '</svg>';
  }

  FF.art = {
    get night() { return night; }, set night(v) { night = !!v; },
    defs, defsInner, icon, ICONS, familyIcon, avatar, AVATAR_PRESETS, house, houseTop, HOUSE_VB, flagCloth, animal, ANIMAL_SIZE, tree, familyTree, windmill, windmillBlades, well, lamp, benchSprite, signpost, goalsStand, townHall, buildSite,
    ground, landPath, logo, emptyArt, arcade, BB_COLORS, emblem, mix, shade, P
  };
})(typeof window !== 'undefined' ? window : this);
