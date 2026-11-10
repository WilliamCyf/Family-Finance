/* ============================================================
   FamFi — screens-spin.js
   The daily spin: a wooden button beside your gems in the village
   (a red dot while today's spin waits) opens a prize wheel.

   Fair, and it says so: eight slices of the same size, each one
   exactly as likely (the rules live in play.js). The prize is
   decided — and saved — the moment you tap Spin, so closing the
   app mid-spin can't re-roll it; the wheel then just shows it.

   Light on the phone: the wheel is a still picture inside a box
   the GPU turns (one CSS transition, ~4 s, then nothing runs);
   the ticks are scheduled on the sound chip, not with timers.
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
  const reduced = () => ui().reduced();

  const COLORS = ['#FF6B5B', '#FFC23D', '#3DB2E8', '#7BC86C', '#FF8FC1', '#8A5BC7', '#F5A04A', '#2F8F46'];
  const DARK = ['#C2453A', '#C98A12', '#1F6FA8', '#4E9A43', '#D95C93', '#5E3A99', '#C4741F', '#1E6B33'];
  const DUR = 4200, TURNS = 5;
  const EASE = [0.12, 0.72, 0.18, 1]; // a quick start, a long slow finish (the CSS curve below, and the ticks)
  const f1 = (n) => Math.round(n * 10) / 10;
  const pt = (deg, r) => { const a = (deg * Math.PI) / 180; return f1(r * Math.sin(a)) + ' ' + f1(-r * Math.cos(a)); };

  let held = 0; // gems already won but not yet shown on the wheel (the village's gem pill waits for it)
  let api = null;

  /* what a slice shows: its art and a short label */
  function prizeArt(pr, size) { return pr.k === 'gems' ? FF.art.gem(size) : FF.art.lkItem(pr.id, size + 6); }
  const prizeName = (pr) => (pr.k === 'gems' ? t('spin.gems', { n: pr.n }) : t('lk.i.' + pr.id));

  /* the wheel: slice i covers i·45°…(i+1)·45° clockwise from the top */
  function wheelSvg(win) {
    const R = 92;
    let s = '<circle r="99" fill="#7A4E28"/><circle r="95" fill="#FFF3D2"/>';
    Pl().SPIN.forEach((pr, i) => {
      const a0 = i * 45, a1 = a0 + 45, mid = a0 + 22.5;
      s += '<path d="M0 0L' + pt(a0, R) + 'A' + R + ' ' + R + ' 0 0 1 ' + pt(a1, R) + 'Z" fill="' + COLORS[i] + '" stroke="#FFF7E8" stroke-width="2"/>';
      s += '<path d="M0 0L' + pt(a0 + 3, R - 6) + 'A' + (R - 6) + ' ' + (R - 6) + ' 0 0 1 ' + pt(a1 - 3, R - 6) + 'Z" fill="#FFFFFF" opacity=".12"/>';
      const big = pr.k === 'gems' && pr.n >= 40;
      s += '<g transform="rotate(' + mid + ') translate(0 -60)">';
      if (big) s += '<circle r="25" fill="#FFF3B0" opacity=".55"/>';
      s += '<g transform="translate(' + (pr.k === 'gems' ? -12 : -15) + ' ' + (pr.k === 'gems' ? -24 : -26) + ')">' + prizeArt(pr, pr.k === 'gems' ? 24 : 24) + '</g>';
      if (pr.k === 'gems') s += '<text y="17" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="' + (big ? 19 : 16) + '" fill="#FFFFFF" stroke="' + DARK[i] + '" stroke-width="3.2" paint-order="stroke" stroke-linejoin="round">' + pr.n + '</text>';
      s += '</g>';
    });
    // the little lights around the rim
    for (let k = 0; k < 16; k++) s += '<circle cx="' + pt(k * 22.5 + 11.25, 97).split(' ')[0] + '" cy="' + pt(k * 22.5 + 11.25, 97).split(' ')[1] + '" r="2.4" fill="' + (k % 2 ? '#FFE27A' : '#FFFFFF') + '"/>';
    if (win != null) {
      const a0 = win * 45, a1 = a0 + 45;
      s += '<path d="M0 0L' + pt(a0, R) + 'A' + R + ' ' + R + ' 0 0 1 ' + pt(a1, R) + 'Z" fill="#FFFFFF" fill-opacity=".18" stroke="#FFFFFF" stroke-width="4.5" stroke-linejoin="round"/>';
    }
    s += '<circle r="19" fill="#7A4E28"/><circle r="15" fill="#FFC23D" stroke="#FFF3D2" stroke-width="2"/><path d="M0 -8l2.4 5 5.4.6-4 3.7 1.1 5.3L0 3.9l-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill="#FFF7E8"/>';
    return '<svg viewBox="-100 -100 200 200" width="100%" height="100%" aria-hidden="true">' + s + '</svg>';
  }
  /* the HUD button's little wheel (a still picture) */
  function miniWheel(size) {
    let s = '';
    for (let i = 0; i < 8; i++) s += '<path d="M0 0L' + pt(i * 45, 11) + 'A11 11 0 0 1 ' + pt(i * 45 + 45, 11) + 'Z" fill="' + COLORS[i] + '"/>';
    s += '<circle r="11.5" fill="none" stroke="#FFF7E8" stroke-width="1.6"/><circle r="3.2" fill="#FFF7E8"/><path d="M-3 -14.5h6l-3 5z" fill="#E0463A" stroke="#FFF7E8" stroke-width="1" stroke-linejoin="round"/>';
    return '<svg viewBox="-14 -15.5 28 28" width="' + size + '" height="' + size + '" aria-hidden="true">' + s + '</svg>';
  }
  function hudBtn() {
    const st = S().spinToday();
    return '<button type="button" class="wood-btn spin-btn' + (st.done ? '' : ' ready') + '" data-hud="spin" aria-label="' + esc(t('spin.open')) + '"><span class="spin-mini">' + miniWheel(30) + '</span>' + (st.done ? '' : '<i class="gp-dot" aria-hidden="true"></i>') + '</button>';
  }

  /* when the wheel's boundaries pass the pointer: CSS cubic-bezier timing, solved numerically */
  function bezier(x1, y1, x2, y2) {
    const N = 120, xs = [], ys = [];
    for (let k = 0; k <= N; k++) {
      const s = k / N, u = 1 - s;
      xs.push(3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s);
      ys.push(3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s);
    }
    return (p) => { // progress p → time fraction
      for (let k = 1; k <= N; k++) if (ys[k] >= p) { const f = (p - ys[k - 1]) / ((ys[k] - ys[k - 1]) || 1); return xs[k - 1] + f * (xs[k] - xs[k - 1]); }
      return 1;
    };
  }
  const timeAt = bezier(EASE[0], EASE[1], EASE[2], EASE[3]);
  function ticks(from, to, dur) {
    const span = to - from;
    let last = -1;
    for (let a = Math.ceil(from / 45) * 45; a < to; a += 45) {
      const ms = timeAt((a - from) / span) * dur;
      if (ms - last < 55) continue; // the fast start: no buzzing
      last = ms;
      ui().sfx.tick(ms / 1000, 0.6 + 0.4 * (ms / dur));
    }
  }

  function hoursLeft() {
    const now = new Date(), mid = new Date(now);
    mid.setHours(24, 0, 0, 0);
    return Math.ceil((mid - now) / 36e5);
  }

  function open() {
    if ((api && !api.closing) || !S().me()) return; // (a sheet closed by closeAllSheets never hears onClose)
    const st0 = S().spinToday();
    const st = { spinning: false, res: null, angle: st0.done && st0.i != null ? -(st0.i * 45 + 22.5) : -22.5 };
    api = ui().openSheet({
      className: 'spin-sheet', label: t('spin.title'), state: st,
      render: () => {
        const p = S().playOf(), now = S().spinToday();
        const win = st.spinning ? null : st.res ? st.res.i : now.done ? now.i : null;
        let h = '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('spin.title') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '"' + (st.spinning ? ' disabled' : '') + '>' + ic('close', 22) + '</button></div>';
        h += '<div class="sw-top"><p class="sw-lead">' + t('spin.lead') + '</p><span class="dg-bal" data-gem-bal>' + FF.art.gem(20) + '<b class="num">' + num(p.pts - held) + '</b></span></div>';
        h += '<div class="sw-stage"><div class="sw-pointer" aria-hidden="true"></div><div class="sw-wheel" style="transform:rotate(' + st.angle + 'deg)">' + wheelSvg(win) + '</div></div>';
        if (st.spinning) {
          h += '<button type="button" class="btn btn-sun btn-block btn-lg" disabled>' + t('spin.spinning') + '</button>';
        } else if (st.res || now.done) {
          const pr = st.res ? st.res.prize : Pl().SPIN[now.i] || null;
          if (pr) {
            const big = pr.k === 'gems' && pr.n >= 40;
            h += '<div class="sw-prize' + (big ? ' big' : '') + (st.res ? ' fresh' : '') + '"><span class="sw-prize-art">' + prizeArt(pr, 34) + '</span><span class="row-main"><b class="sw-prize-t">' +
              (st.res ? (big ? t('spin.jackpot') : t('spin.nice')) + ' ' : '') + esc(st.res ? prizeName(pr) : t('spin.result', { prize: prizeName(pr) })) + '</b>' +
              '<span class="row-s">' + (pr.k === 'item' ? t('spin.inBag') + ' · ' + t('lk.i.' + pr.id + '.b') : '') + '</span></span></div>';
          }
          const hl = hoursLeft();
          h += '<p class="sw-next">' + ic('clock', 16) + '<span>' + (hl <= 1 ? t('spin.nextSoon') : t('spin.nextH', { n: hl })) + '</span></p>';
          h += '<button type="button" class="btn btn-primary btn-block btn-lg" data-close>' + t('common.done') + '</button>';
        } else {
          h += '<button type="button" class="btn btn-sun btn-block btn-lg spin-go" data-spin><span aria-hidden="true">🎡</span>' + t('spin.go') + '</button>';
        }
        return h;
      },
      onRender: (body, a) => {
        body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => a.close()));
        const go = body.querySelector('[data-spin]');
        if (go) go.addEventListener('click', () => spin(body, a, st));
      },
      onClose: () => {
        api = null;
        if (held) { held = 0; FF.app.refresh(); }
      }
    });
    ui().sfx.pop();
  }

  function spin(body, a, st) {
    if (st.spinning) return;
    const r = S().spinWheel();
    if (!r.ok) { a.render(); return; }
    st.spinning = true; st.res = r;
    held = r.prize.k === 'gems' ? r.prize.n : 0;
    FF.app.refresh(); // the gem pill keeps its old number until the wheel stops
    a.opts.dismissible = false;
    a.render(); // the wheel at its start, the button "spinning"
    const wheel = a.body.querySelector('.sw-wheel');
    const from = st.angle;
    const to = Math.ceil(from / 360) * 360 + 360 * TURNS - (r.i * 45 + 22.5) + (Math.random() - 0.5) * 2 * 15;
    const dur = reduced() ? 700 : DUR;
    st.angle = to;
    ui().haptic();
    wheel.style.transition = 'transform ' + dur + 'ms cubic-bezier(' + EASE.join(',') + ')';
    void wheel.offsetWidth;
    wheel.style.transform = 'rotate(' + f1(to) + 'deg)';
    if (!reduced()) ticks(from, to, dur);
    setTimeout(() => land(a, st), dur + 80);
  }

  function land(a, st) {
    const r = st.res, before = S().playOf().pts - held;
    held = 0;
    if (api !== a || a.closing) { FF.app.refresh(); return; } // closed meanwhile: the prize is saved either way
    st.spinning = false;
    a.opts.dismissible = true;
    a.render();
    FF.app.refresh();
    const big = r.prize.k === 'gems' && r.prize.n >= 40;
    if (r.prize.k === 'gems') {
      const bal = a.body.querySelector('[data-gem-bal]');
      ui().sfx.coin();
      ui().coinBurst(a.body.querySelector('.sw-pointer'), bal, Math.min(14, 4 + Math.round(r.prize.n / 4)), () => ui().sfx.chime());
      const fmt = (x) => num(Math.round(x)), key = 'gems-spin-' + before;
      ui().countUp(bal.querySelector('b'), before, fmt, key); // from the old balance…
      ui().countUp(bal.querySelector('b'), before + r.prize.n, fmt, key); // …up to the new one
    } else ui().sfx.chime();
    ui().haptic();
    if (big) { ui().sfx.success(); setTimeout(() => ui().confetti({ n: 140 }), 200); }
  }

  FF.spinUI = { open, hudBtn, held: () => held };
})(window);
