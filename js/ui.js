/* ============================================================
   FamFi — ui.js
   DOM helpers + the shared interaction kit: bottom sheets,
   toasts (with Undo), tap-to-learn popovers, confetti, coin
   bursts, count-ups, sounds, haptics, auto-fit text.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.prototype.slice.call((el || document).querySelectorAll(sel));
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);

  const reduced = () => document.documentElement.classList.contains('reduce-motion');

  /* ---------------- money / delta helpers (UI flavour) ---------------- */
  function delta(v, o) {
    o = o || {};
    const eps = o.pct ? 0.00005 : 0.004;
    const up = v > eps, down = v < -eps;
    const cls = up ? 'up' : down ? 'down' : 'flat';
    const arrow = up ? ic('up', o.size || 14) : down ? ic('down', o.size || 14) : '';
    const word = up ? t('a11y.up') : down ? t('a11y.down') : t('a11y.flat');
    const txt = o.pct ? FF.i18n.pct(v, { sign: true }) : FF.i18n.money(v, o.cur, { sign: true, whole: o.whole });
    return '<span class="delta ' + cls + (o.pill ? ' pill' : '') + '" aria-label="' + FF.esc(word + ' ' + txt.replace(/^[+−-]/, '')) + '">' + arrow + '<span>' + txt + '</span></span>';
  }

  /* ---------------- sheets ---------------- */
  const sheets = [];
  function openSheet(o) {
    const rootEl = $('#sheet-root');
    const layer = document.createElement('div');
    layer.className = 'sheet-layer';
    layer.innerHTML = '<div class="sheet-backdrop"></div><section class="sheet ' + (o.className || '') + '" role="dialog" aria-modal="true"' + (o.label ? ' aria-label="' + FF.esc(o.label) + '"' : '') + '><div class="sheet-grab" aria-hidden="true"><span></span></div><div class="sheet-body"></div></section>';
    rootEl.appendChild(layer);
    const sheet = $('.sheet', layer), body = $('.sheet-body', layer);
    const api = {
      layer, sheet, body, opts: o, state: o.state || {},
      render() {
        const html = typeof o.render === 'function' ? o.render(api) : o.render;
        body.innerHTML = html;
        if (o.onRender) o.onRender(body, api);
        fitAll(body);
      },
      close(silent) { closeSheet(api, silent); }
    };
    api.render();
    sheets.push(api);
    document.documentElement.classList.add('has-sheet');
    // animate in
    requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('open')));
    $('.sheet-backdrop', layer).addEventListener('click', () => { if (o.dismissible !== false) api.close(); });
    dragToDismiss(api);
    if (o.onOpen) setTimeout(() => o.onOpen(body, api), 30);
    const first = $('[autofocus]', body);
    if (first && !o.noFocus) setTimeout(() => first.focus({ preventScroll: true }), 380);
    return api;
  }
  function closeSheet(api, silent) {
    if (!api || api.closing) return;
    api.closing = true;
    api.layer.classList.remove('open');
    api.layer.classList.add('closing');
    const i = sheets.indexOf(api);
    if (i !== -1) sheets.splice(i, 1);
    if (!sheets.length) document.documentElement.classList.remove('has-sheet');
    setTimeout(() => api.layer.remove(), reduced() ? 160 : 360);
    if (!silent && api.opts.onClose) api.opts.onClose(api);
  }
  const closeAllSheets = () => sheets.slice().forEach((s) => closeSheet(s, true));
  const topSheet = () => sheets[sheets.length - 1];
  function dragToDismiss(api) {
    const sheet = api.sheet;
    let y0 = null, dy = 0, t0 = 0, scroller = null;
    sheet.addEventListener('pointerdown', (e) => {
      if (api.opts.dismissible === false) return;
      const onHandle = e.target.closest('.sheet-grab, .sheet-head');
      scroller = api.body;
      if (!onHandle && scroller.scrollTop > 0) return;
      if (e.target.closest('input, textarea, select, button, a, [data-act], .no-drag')) return;
      y0 = e.clientY; dy = 0; t0 = performance.now();
      sheet.setPointerCapture(e.pointerId);
    });
    sheet.addEventListener('pointermove', (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.clientY - y0);
      if (dy > 4) { sheet.style.transition = 'none'; sheet.style.transform = 'translateY(' + dy + 'px)'; }
    });
    const end = () => {
      if (y0 == null) return;
      const v = dy / Math.max(1, performance.now() - t0);
      sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 120 || (dy > 40 && v > 0.6)) api.close();
      y0 = null;
    };
    sheet.addEventListener('pointerup', end);
    sheet.addEventListener('pointercancel', end);
  }

  /* ---------------- toasts ---------------- */
  let toastTimer = null;
  function toast(msg, o) {
    o = o || {};
    const rootEl = $('#toast-root');
    rootEl.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'toast ' + (o.tone || '');
    el.setAttribute('role', 'status');
    el.innerHTML = (o.icon ? '<span class="toast-ic">' + (o.icon.length > 2 && o.icon[0] !== '<' ? ic(o.icon, 20) : o.icon) + '</span>' : '') + '<span class="toast-msg">' + msg + '</span>' +
      (o.action ? '<button class="toast-act" type="button">' + (o.actionIcon ? ic(o.actionIcon, 16) : '') + FF.esc(o.action) + '</button>' : '');
    rootEl.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const kill = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); };
    if (o.action) $('.toast-act', el).addEventListener('click', () => { kill(); o.onAction && o.onAction(); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(kill, o.duration || (o.action ? 6500 : 3200));
    return kill;
  }

  /* ---------------- tap-to-learn popovers ---------------- */
  let pop = null;
  function closePop() { if (pop) { const p = pop; pop = null; p.classList.remove('show'); setTimeout(() => p.remove(), 200); } }
  function learn(key, anchor) {
    if (pop && pop.dataset.key === key) { closePop(); return; }
    closePop();
    const el = document.createElement('div');
    el.className = 'popover';
    el.dataset.key = key;
    el.setAttribute('role', 'dialog');
    el.innerHTML = '<div class="pop-arrow"></div><div class="pop-title">' + ic('sparkle', 16) + '<span>' + t('learn.' + key + '.t') + '</span></div><p>' + t('learn.' + key + '.b') + '</p><button class="pop-ok" type="button">' + t('common.gotIt') + '</button>';
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    const pw = Math.min(300, window.innerWidth - 32);
    el.style.width = pw + 'px';
    const ph = el.offsetHeight;
    let x = r.left + r.width / 2 - pw / 2;
    x = FF.clamp(x, 16, window.innerWidth - pw - 16);
    const below = r.bottom + ph + 16 < window.innerHeight - 90;
    const y = below ? r.bottom + 10 : r.top - ph - 10;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.classList.add(below ? 'below' : 'above');
    $('.pop-arrow', el).style.left = FF.clamp(r.left + r.width / 2 - x - 8, 14, pw - 30) + 'px';
    $('.pop-ok', el).addEventListener('click', closePop);
    pop = el;
    requestAnimationFrame(() => el.classList.add('show'));
    sfx.tap();
  }
  document.addEventListener('pointerdown', (e) => { if (pop && !e.target.closest('.popover') && !e.target.closest('[data-learn]')) closePop(); }, true);
  document.addEventListener('scroll', closePop, true);

  /* ---------------- confetti (canvas) ---------------- */
  let confettiRaf = null;
  function confetti(o) {
    o = o || {};
    if (reduced()) { pulseCheck(); return; }
    const c = $('#fx-canvas');
    c.style.display = 'block'; // only on screen while confetti falls (an idle full-screen layer still costs every frame)
    const ctx = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#FFC23D', '#E0563F', '#3E9B55', '#3D7FD1', '#E66FA0', '#8A5BC7', '#FFFFFF'];
    const ox = o.x != null ? o.x : innerWidth / 2, oy = o.y != null ? o.y : innerHeight * 0.4;
    const parts = [];
    const n = o.n || 110;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
      const sp = 5 + Math.random() * 8;
      parts.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, r: 3 + Math.random() * 4, c: colors[k % colors.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, shape: k % 3, life: 0 });
    }
    cancelAnimationFrame(confettiRaf);
    const t0 = performance.now();
    const step = (now) => {
      const el = now - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.vy += 0.22; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0, 1 - el / 1900);
        ctx.fillStyle = p.c;
        if (p.shape === 0) ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6, 0, 6.3); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r * 0.8, p.r * 0.6); ctx.lineTo(-p.r * 0.8, p.r * 0.6); ctx.fill(); }
        ctx.restore();
      });
      if (el < 2000) confettiRaf = requestAnimationFrame(step);
      else { c.width = 0; c.height = 0; c.style.display = 'none'; confettiRaf = null; } // free its memory too
    };
    confettiRaf = requestAnimationFrame(step);
  }
  function pulseCheck() {
    const el = document.createElement('div');
    el.className = 'pulse-check';
    el.innerHTML = ic('check', 40);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  /* ---------------- coin burst (dividend harvest) ---------------- */
  function coinBurst(fromEl, toEl, n, done) {
    const a = fromEl.getBoundingClientRect();
    const b = toEl ? toEl.getBoundingClientRect() : { left: innerWidth / 2, top: 60, width: 0, height: 0 };
    if (reduced()) { done && done(); return; }
    const count = n || 9;
    let left = count;
    for (let k = 0; k < count; k++) {
      const c = document.createElement('div');
      c.className = 'coin-fly';
      document.body.appendChild(c);
      const sx = a.left + a.width / 2 + (Math.random() - 0.5) * 40, sy = a.top + a.height / 2;
      const ex = b.left + b.width / 2, ey = b.top + b.height / 2;
      const mx = (sx + ex) / 2 + (Math.random() - 0.5) * 160, my = Math.min(sy, ey) - 80 - Math.random() * 80;
      const anim = c.animate([
        { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.4)', opacity: 0 },
        { transform: 'translate(' + sx + 'px,' + (sy - 30) + 'px) scale(1.1)', opacity: 1, offset: 0.15 },
        { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1)', opacity: 1, offset: 0.55 },
        { transform: 'translate(' + ex + 'px,' + ey + 'px) scale(.5)', opacity: 0.2 }
      ], { duration: 900 + k * 45, easing: 'cubic-bezier(.45,.05,.4,1)', delay: k * 55, fill: 'forwards' });
      anim.onfinish = () => { c.remove(); if (k % 3 === 0) sfx.coin(); if (--left === 0 && done) done(); };
    }
  }

  /* ---------------- count-up for big numbers ---------------- */
  const lastShown = {};
  function countUp(el, to, fmt, key) {
    if (!el) return;
    const from = lastShown[key] != null ? lastShown[key] : to;
    lastShown[key] = to;
    if (reduced() || Math.abs(from - to) < 0.005) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 650;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = fmt(from);
    requestAnimationFrame(step);
  }

  /* ---------------- auto-fit text (labels never truncate) ---------------- */
  function fitAll(rootEl) {
    $$('[data-fit]', rootEl).forEach((el) => {
      el.style.fontSize = '';
      const min = +(el.dataset.fit || 11);
      let size = parseFloat(getComputedStyle(el).fontSize);
      let guard = 20;
      while (el.scrollWidth > el.clientWidth + 0.5 && size > min && guard--) { size -= 0.5; el.style.fontSize = size + 'px'; }
    });
    // keep sibling labels in one control the same size
    $$('.seg, .cust-tabs, .opt-row, .decor-grid, .cat-grid', rootEl).forEach((g) => {
      const items = $$('[data-fit]', g);
      if (items.length < 2) return;
      const sizes = items.map((x) => parseFloat(getComputedStyle(x).fontSize));
      const m = Math.min.apply(null, sizes);
      if (sizes.some((v) => v !== m)) items.forEach((x) => { x.style.fontSize = m + 'px'; });
    });
  }

  /* ---------------- haptics (iOS 18 switch trick, vibrate elsewhere) ----------------
     (Off for anyone who switched them off before the Menu setting was removed in 2.18.) */
  const buzzOn = () => !FF.shot && !(FF.store && FF.store.prefs().haptics === false);
  // Android only vibrates after the person has touched the page (and complains otherwise)
  const mayVibrate = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  function haptic() { if (buzzOn()) tap(8); }
  /* a stronger buzz: n quick taps `gap` ms apart (iOS has one kind of tap — a burst of them reads
     as a rumble; Android gets the same rhythm as a vibration pattern). The first tap happens at
     once, inside the touch that caused it. */
  function buzz(n, gap, ms) {
    if (!buzzOn() || !(n > 0)) return;
    if (navigator.vibrate) {
      if (!mayVibrate()) return;
      const pat = [];
      for (let k = 0; k < n; k++) { if (k) pat.push(Math.max(12, gap - ms)); pat.push(ms); }
      try { navigator.vibrate(pat); } catch (e) { /* no vibration */ }
      return;
    }
    tap(ms);
    for (let k = 1; k < n; k++) setTimeout(() => tap(ms), k * gap);
  }
  function tap(ms) {
    try {
      if (navigator.vibrate) { if (mayVibrate()) navigator.vibrate(ms); return; }
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute('switch', '');
      label.appendChild(input);
      document.head.appendChild(label);
      label.click();
      document.head.removeChild(label);
    } catch (e) { /* no haptics */ }
  }

  /* ---------------- sounds (tiny WebAudio synth, no files) ---------------- */
  let ac = null;
  const soundOn = () => FF.store && FF.store.prefs().sound !== false && !FF.shot;
  function ctx() {
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); }
    if (ac.state !== 'running') ac.resume().catch(() => {});
    return ac;
  }
  /* The sound chip rests a few seconds after the last sound: a running AudioContext keeps the
     phone's audio hardware busy — and warm — even while it only plays silence. */
  let restT = null, endAt = 0;
  function rest(at) {
    if (!ac) return;
    endAt = Math.max(endAt, at || 0);
    clearTimeout(restT);
    restT = setTimeout(() => { if (ac.state === 'running' && ac.currentTime >= endAt) ac.suspend().catch(() => {}); }, Math.max(0, endAt - ac.currentTime) * 1000 + 4000);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && ac && ac.state === 'running') { clearTimeout(restT); ac.suspend().catch(() => {}); } });
  function tone(freq, dur, o) {
    if (!soundOn()) return;
    const a = ctx(); if (!a) return;
    o = o || {};
    const t0 = a.currentTime + (o.delay || 0);
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    if (o.vib) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = o.vib; lg.gain.value = freq * 0.04; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + dur); }
    const vol = (o.vol || 0.16);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.filter) { const f = a.createBiquadFilter(); f.type = o.filter; f.frequency.value = o.ff || 1000; f.Q.value = o.q || 1; osc.connect(f); node = f; }
    node.connect(g); g.connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
    rest(t0 + dur + 0.05);
  }
  const sfx = {
    unlock() { if (soundOn() && ctx()) rest(0); },
    tap() { tone(820, 0.05, { vol: 0.05 }); },
    pop() { tone(320, 0.11, { to: 980, vol: 0.14 }); },
    snap() { tone(520, 0.06, { type: 'triangle', vol: 0.1 }); tone(780, 0.05, { type: 'triangle', vol: 0.06, delay: 0.04 }); },
    chime() { [1046, 1318, 1568].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); },
    success() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.26, { type: 'triangle', vol: 0.09, delay: i * 0.08 })); },
    coin() { tone(1320, 0.07, { type: 'square', vol: 0.03 }); tone(1760, 0.14, { type: 'square', vol: 0.03, delay: 0.06 }); },
    // a message in the Block Blast chat: two soft notes
    chat() { tone(990, 0.07, { vol: 0.055 }); tone(1480, 0.09, { vol: 0.045, delay: 0.06 }); },
    // the prize wheel's tick, scheduled ahead on the sound chip (no timers); v: 0…1 loudness
    tick(delay, v) { tone(1650, 0.028, { type: 'triangle', vol: 0.05 * (v == null ? 1 : v), delay }); },
    whoosh() { tone(200, 0.3, { to: 900, type: 'sawtooth', vol: 0.03, filter: 'bandpass', ff: 800 }); },
    // Block Blast
    bbPick() { tone(660, 0.05, { to: 880, type: 'triangle', vol: 0.05 }); },
    bbDrop() { tone(190, 0.09, { to: 120, type: 'square', vol: 0.06, filter: 'lowpass', ff: 900 }); tone(520, 0.05, { type: 'triangle', vol: 0.04, delay: 0.02 }); },
    bbBack() { tone(300, 0.08, { to: 220, type: 'triangle', vol: 0.04 }); },
    bbClear(lines, combo) {
      const base = 523 * Math.pow(1.06, Math.min(combo || 1, 12) - 1);
      const n = Math.min(3 + (lines || 1), 7);
      for (let k = 0; k < n; k++) tone(base * Math.pow(1.26, k), 0.16, { type: 'triangle', vol: 0.08, delay: k * 0.055 });
      tone(base / 2, 0.25, { type: 'sine', vol: 0.07 });
    },
    bbAllClear() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); },
    bbOver() { [523, 440, 349, 262].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.08, delay: i * 0.16 })); },
    stamp() { tone(140, 0.12, { to: 70, type: 'square', vol: 0.08, filter: 'lowpass', ff: 600 }); },
    animal(kind) {
      switch (kind) {
        case 'chicken': [0, 0.09, 0.2].forEach((d, i) => tone(900 - i * 90, 0.08, { to: 600 - i * 60, type: 'square', vol: 0.04, delay: d, filter: 'lowpass', ff: 2200 })); break;
        case 'chick': [0, 0.13].forEach((d) => tone(1900, 0.09, { to: 2500, vol: 0.06, delay: d })); break;
        case 'puppy': [0, 0.17].forEach((d) => tone(230, 0.11, { to: 150, type: 'sawtooth', vol: 0.09, delay: d, filter: 'lowpass', ff: 700 })); break;
        case 'cat': tone(520, 0.42, { to: 430, vol: 0.09, vib: 7 }); tone(700, 0.2, { to: 560, vol: 0.05, delay: 0.05 }); break;
        case 'duck': [0, 0.16].forEach((d) => tone(340, 0.12, { to: 260, type: 'sawtooth', vol: 0.07, delay: d, filter: 'bandpass', ff: 1300, q: 3 })); break;
        case 'pig': tone(190, 0.16, { to: 130, type: 'square', vol: 0.07, filter: 'lowpass', ff: 650 }); tone(170, 0.14, { to: 120, type: 'square', vol: 0.06, delay: 0.2, filter: 'lowpass', ff: 650 }); break;
        case 'bunny': [0, 0.1].forEach((d) => tone(1500, 0.06, { to: 1800, vol: 0.05, delay: d })); break;
        case 'shiba': [0, 0.15].forEach((d) => tone(380, 0.09, { to: 260, type: 'sawtooth', vol: 0.08, delay: d, filter: 'lowpass', ff: 1100 })); break;
        case 'penguin': tone(700, 0.18, { to: 520, type: 'square', vol: 0.05, filter: 'bandpass', ff: 1400, q: 2 }); tone(760, 0.12, { to: 600, type: 'square', vol: 0.04, delay: 0.2, filter: 'bandpass', ff: 1400, q: 2 }); break;
        case 'redpanda': [0, 0.08, 0.16].forEach((d) => tone(1300, 0.06, { to: 1100, vol: 0.05, delay: d })); break;
        case 'capybara': tone(260, 0.3, { to: 240, vol: 0.07, vib: 12 }); break;
        case 'tapir': tone(1600, 0.22, { to: 1900, vol: 0.05, vib: 9 }); break;
        case 'fox': tone(900, 0.12, { to: 1300, type: 'triangle', vol: 0.08 }); tone(1100, 0.1, { to: 800, type: 'triangle', vol: 0.06, delay: 0.14 }); break;
        case 'dragon': tone(180, 0.3, { to: 320, type: 'sawtooth', vol: 0.06, filter: 'lowpass', ff: 900 }); tone(1600, 0.16, { to: 2400, vol: 0.04, delay: 0.3 }); break;
        default: tone(600, 0.1);
      }
    }
  };

  /* ---------------- misc ---------------- */
  function skeleton(lines) {
    return lines.map((l) => '<div class="sk" style="height:' + l[0] + 'px;width:' + (l[1] || '100%') + ';' + (l[2] || '') + '"></div>').join('');
  }
  function segmented(name, opts, val, cls) {
    return '<div class="seg ' + (cls || '') + '" role="tablist" data-seg="' + name + '">' + opts.map((o) => '<button type="button" role="tab" class="seg-b' + (o.v === val ? ' on' : '') + '" aria-selected="' + (o.v === val) + '" data-v="' + o.v + '"><span data-fit="11">' + o.l + '</span></button>').join('') + '</div>';
  }
  function toggle(on, attrs) { return '<button type="button" class="switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + !!on + '" ' + (attrs || '') + '><span></span></button>'; }
  function learnBtn(key, label) { return '<button type="button" class="learn" data-learn="' + key + '" aria-label="' + FF.esc(t('a11y.whatIs') + ' ' + (label || t('learn.' + key + '.t'))) + '">' + ic('info', 16) + '</button>'; }
  function assetLogo(a, size) {
    const s = size || 40;
    const crypto = a && a.t === 'crypto';
    return '<span class="logo' + (crypto ? ' crypto' : '') + '" style="--lc:' + FF.data.logoColor(a) + ';width:' + s + 'px;height:' + s + 'px;font-size:' + Math.round(s * (FF.data.monogram(a).length > 2 ? 0.3 : 0.36)) + 'px">' + FF.esc(FF.data.monogram(a)) + '</span>';
  }

  FF.ui = { $, $$, delta, openSheet, closeSheet, closeAllSheets, topSheet, sheets, toast, learn, closePop, confetti, pulseCheck, coinBurst, countUp, fitAll, haptic, buzz, sfx, skeleton, segmented, toggle, learnBtn, assetLogo, reduced };
})(window);
