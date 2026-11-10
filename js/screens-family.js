/* ============================================================
   FamFi — screens-family.js
   Splash + sign-up + create/join family, invite sheet, Family
   Goals poster, house customiser, visit-a-member view.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, C = () => FF.calc;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const ui = () => FF.ui;
  const A = FF.actions = FF.actions || {};

  /* ===================================================== AVATAR PICKER */
  function avatarPicker(cur) {
    return '<div class="avatar-pick" role="radiogroup" aria-label="' + esc(t('signup.avatar')) + '">' + FF.art.AVATAR_PRESETS.map((a, i) => {
      const on = cur && cur.kind !== 'photo' && cur.style === a.style && cur.bg === a.bg;
      return '<button type="button" class="ap' + (on ? ' on' : '') + '" data-av="' + i + '" role="radio" aria-checked="' + on + '">' + FF.art.avatar(a, 52) + '</button>';
    }).join('') + '<label class="ap ap-photo' + (cur && cur.kind === 'photo' ? ' on' : '') + '">' + ic('camera', 22) + '<span>' + t('signup.photo') + '</span><input type="file" accept="image/*" data-photo></label></div>';
  }
  function mountAvatarPicker(body, st, rerender) {
    body.querySelectorAll('[data-av]').forEach((b) => b.addEventListener('click', () => { st.avatar = Object.assign({ kind: 'illus' }, FF.art.AVATAR_PRESETS[+b.dataset.av]); ui().sfx.tap(); rerender(); }));
    const f = body.querySelector('[data-photo]');
    if (f) f.addEventListener('change', () => {
      const file = f.files && f.files[0];
      if (!file) return;
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = 160, cv = document.createElement('canvas');
        cv.width = cv.height = s;
        const ctx = cv.getContext('2d');
        const k = Math.max(s / img.width, s / img.height);
        ctx.drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k);
        st.avatar = { kind: 'photo', data: cv.toDataURL('image/jpeg', 0.82) };
        URL.revokeObjectURL(url);
        rerender();
      };
      img.src = url;
    });
  }

  /* ===================================================== ONBOARDING */
  const flow = { step: 'welcome', st: {} };
  function vignette() {
    const looks = S().LOOKS;
    const h = (k, lv, x, y, s) => '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' + FF.art.house(Object.assign({ plate: '' }, looks[k].house), lv, { still: true }).replace('<svg', '<svg x="-96" y="-228"') + '</g>';
    return '<svg class="vignette" viewBox="0 0 360 230" aria-hidden="true"><ellipse cx="180" cy="196" rx="176" ry="38" fill="#9BD167"/><ellipse cx="180" cy="192" rx="160" ry="30" fill="#A8D977"/>' +
      h('mum', 3, 112, 178, 0.62) + h('dad', 4, 250, 176, 0.6) + h('me', 2, 180, 212, 0.62) +
      '<g transform="translate(286 198) scale(.7)">' + FF.art.animal('chicken').replace('<svg', '<svg x="-24" y="-44"') + '</g><g transform="translate(68 208) scale(.75)">' + FF.art.animal('puppy').replace('<svg', '<svg x="-24" y="-44"') + '</g></svg>';
  }
  const CLOUD_ERR = {
    'auth/email-already-in-use': 'signup.err.exists', 'auth/invalid-email': 'signup.err.email', 'auth/missing-email': 'signup.err.email',
    'auth/weak-password': 'signup.err.pw', 'auth/missing-password': 'signup.err.pw',
    'auth/wrong-password': 'signin.err.wrong', 'auth/user-not-found': 'signin.err.wrong', 'auth/invalid-credential': 'signin.err.wrong', 'auth/invalid-login-credentials': 'signin.err.wrong',
    'auth/too-many-requests': 'err.tooMany', 'auth/network-request-failed': 'err.offline', offline: 'err.offline', timeout: 'err.offline', 'no-config': 'err.offline',
    'not-found': 'join.notFound', 'signed-out': 'signin.again'
  };
  function errHtml(e) {
    const k = CLOUD_ERR[e && e.code] || 'err.generic';
    return esc(t(k)) + (k === 'signup.err.exists' ? ' <button type="button" class="link-btn" data-flow="signin">' + t('welcome.signInBtn') + '</button>' : '');
  }
  /* run a cloud action with the button showing it's working; errors land in the form */
  async function busy(el, btnSel, fn) {
    const btn = el.querySelector(btnSel), err = el.querySelector('.form-err');
    if (!btn || btn.disabled) return;
    btn.disabled = true; btn.classList.add('busy'); btn.setAttribute('aria-busy', 'true');
    if (err) err.textContent = '';
    try { await fn(); } catch (e) {
      console.warn('FamFi:', e && (e.code || e.message));
      if (err && document.body.contains(err)) err.innerHTML = errHtml(e);
      ui().haptic();
    } finally { btn.disabled = false; btn.classList.remove('busy'); btn.removeAttribute('aria-busy'); }
  }
  const validEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  const pwField = (id, auto, ph) => '<label class="field"><span class="f-l">' + t('signup.password') + '</span><div class="pw"><input id="' + id + '" type="password" autocomplete="' + auto + '" placeholder="' + esc(ph) + '"><button type="button" class="icon-btn" data-pw="' + id + '" aria-label="' + esc(t('signup.show')) + '">' + ic('eye', 20) + '</button></div></label>';
  const emailField = (id, v) => '<label class="field"><span class="f-l">' + t('signup.email') + '</span><input id="' + id + '" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="you@example.com" value="' + esc(v || '') + '"></label>';
  const alt = (q, flowTo, label) => '<p class="flow-alt">' + q + ' <button type="button" class="link-btn" data-flow="' + flowTo + '">' + label + '</button></p>';

  function renderFlow() {
    const el = document.getElementById('flow');
    if (!el._ffBound) { el._ffBound = true; el.addEventListener('click', onFlowClick); }
    const st = flow.st;
    const langChip = '<button type="button" class="lang-pill" data-act="language" aria-label="' + esc(t('menu.language')) + '">' + ic('globe', 18) + '<span lang="' + FF.i18n.lang + '">' + FF.i18n.NATIVE[FF.i18n.lang] + '</span></button>';
    const back = (to) => '<button type="button" class="icon-btn flow-back" data-flow="' + to + '" aria-label="' + esc(t('common.back')) + '">' + ic('chevL', 24) + '</button>';
    const fam = S().family();
    let h = '';
    switch (flow.step) {
      case 'welcome':
        h = '<div class="flow-top"><span></span>' + langChip + '</div><div class="welcome-art">' + vignette() + '</div>' +
          '<div class="flow-body"><div class="brand-row">' + FF.art.logo(56) + '<span class="wordmark">Fam<span>Fi</span></span></div><h1 class="flow-title">' + t('welcome.t') + '</h1><p class="flow-sub">' + t('welcome.b') + '</p>' +
          '<ul class="perks"><li>' + ic('house', 20) + t('welcome.p1') + '</li><li>' + ic('trend', 20) + t('welcome.p2') + '</li><li>' + ic('shield', 20) + t('welcome.p3') + '</li></ul></div>' +
          '<div class="flow-actions"><button type="button" class="btn btn-primary btn-block btn-lg" data-flow="signup" data-then="">' + t('welcome.create') + '</button><button type="button" class="btn btn-soft btn-block btn-lg" data-flow="signup" data-then="join">' + ic('userPlus', 20) + t('welcome.haveCode') + '</button><button type="button" class="btn btn-ghost btn-block" data-act="demo">' + ic('sparkle', 18) + t('welcome.demo') + '</button>' +
          alt(t('welcome.signIn'), 'signin', t('welcome.signInBtn')) + '</div>';
        break;
      case 'upgrade': // made before accounts existed
        h = '<div class="flow-top"><span></span>' + langChip + '</div><div class="welcome-art">' + vignette() + '</div>' +
          '<div class="flow-body"><h1 class="flow-title">' + t('upgrade.t') + '</h1><p class="flow-sub">' + t('upgrade.b') + '</p>' +
          '<ul class="perks"><li>' + ic('users', 20) + t('upgrade.p1') + '</li><li>' + ic('shield', 20) + t('upgrade.p2') + '</li></ul></div>' +
          '<div class="flow-actions"><button type="button" class="btn btn-primary btn-block btn-lg" data-flow="signup">' + t('welcome.create') + '</button><button type="button" class="btn btn-soft btn-block btn-lg" data-flow="signin">' + t('upgrade.have') + '</button></div>';
        break;
      case 'signup':
        st.avatar = st.avatar || Object.assign({ kind: 'illus' }, FF.art.AVATAR_PRESETS[0]);
        h = '<div class="flow-top">' + back(st.legacy ? 'upgrade' : 'welcome') + langChip + '</div><div class="flow-body"><div class="step-pill">' + t('flow.step', { n: 1, total: 3 }) + '</div><h1 class="flow-title">' + t('signup.t') + '</h1><p class="flow-sub">' + t(st.legacy ? 'upgrade.keep' : 'signup.b') + '</p>' +
          '<div class="center su-avatar">' + FF.art.avatar(st.avatar, 88) + '</div>' + avatarPicker(st.avatar) +
          '<div class="form"><label class="field"><span class="f-l">' + t('signup.name') + '</span><input id="su-name" maxlength="20" autocomplete="nickname" placeholder="' + esc(t('signup.namePh')) + '" value="' + esc(st.name || '') + '"></label>' +
          emailField('su-email', st.email) + pwField('su-pw', 'new-password', t('signup.pwPh')) +
          '<p class="hint">' + ic('shield', 14) + '<span>' + t('signup.cloud') + '</span></p></div><p class="form-err" id="su-err" role="alert"></p></div>' +
          '<div class="flow-actions"><button type="button" class="btn btn-primary btn-block btn-lg" id="su-go">' + t('common.continue') + '</button>' + alt(t('welcome.signIn'), 'signin', t('welcome.signInBtn')) + '</div>';
        break;
      case 'signin':
        h = '<div class="flow-top">' + (st.again ? '<span></span>' : back(st.legacy ? 'upgrade' : 'welcome')) + langChip + '</div><div class="flow-body"><h1 class="flow-title">' + t('signin.t') + '</h1><p class="flow-sub">' + t(st.again ? 'signin.again' : 'signin.b') + '</p>' +
          '<div class="form">' + emailField('si-email', st.email) + pwField('si-pw', 'current-password', '') +
          '<button type="button" class="link-btn" id="si-forgot">' + t('signin.forgot') + '</button></div><p class="form-err" id="si-err" role="alert"></p></div>' +
          '<div class="flow-actions"><button type="button" class="btn btn-primary btn-block btn-lg" id="si-go">' + t('signin.cta') + '</button>' +
          (st.again ? '<p class="flow-alt"><button type="button" class="link-btn" data-act="sign-out-now">' + t('signin.other') + '</button></p>' : alt(t('signin.noAccount'), 'signup', t('signin.create'))) + '</div>';
        break;
      case 'profile': // signed in, but this account has no FamFi profile yet
        st.avatar = st.avatar || Object.assign({ kind: 'illus' }, FF.art.AVATAR_PRESETS[0]);
        h = '<div class="flow-top"><span></span>' + langChip + '</div><div class="flow-body"><div class="step-pill">' + t('flow.step', { n: 1, total: 3 }) + '</div><h1 class="flow-title">' + t('signup.t') + '</h1><p class="flow-sub">' + t('profile.b') + '</p>' +
          '<div class="center su-avatar">' + FF.art.avatar(st.avatar, 88) + '</div>' + avatarPicker(st.avatar) +
          '<div class="form"><label class="field"><span class="f-l">' + t('signup.name') + '</span><input id="pf-name" maxlength="20" autocomplete="nickname" placeholder="' + esc(t('signup.namePh')) + '" value="' + esc(st.name || '') + '"></label></div><p class="form-err" id="pf-err" role="alert"></p></div>' +
          '<div class="flow-actions"><button type="button" class="btn btn-primary btn-block btn-lg" id="pf-go">' + t('common.continue') + '</button></div>';
        break;
      case 'choice':
        h = '<div class="flow-top"><span></span>' + langChip + '</div><div class="flow-body"><div class="step-pill">' + t('flow.step', { n: 2, total: 3 }) + '</div><h1 class="flow-title">' + t('choice.t', { name: esc(S().me().name) }) + '</h1><p class="flow-sub">' + t('choice.b') + '</p>' +
          '<button type="button" class="big-choice" data-flow="create"><span class="bc-art">' + FF.art.emptyArt('village', 84) + '</span><span class="row-main"><span class="row-t">' + t('choice.create') + '</span><span class="row-s">' + t('choice.createS') + '</span></span>' + ic('chevR', 20) + '</button>' +
          '<button type="button" class="big-choice" data-flow="join"><span class="bc-art code-art">' + ic('userPlus', 36) + '</span><span class="row-main"><span class="row-t">' + t('choice.join') + '</span><span class="row-s">' + t('choice.joinS') + '</span></span>' + ic('chevR', 20) + '</button></div>' +
          (S().mode() === 'cloud' ? '<div class="flow-actions"><p class="flow-alt">' + t('choice.signedIn', { email: '<b>' + esc(S().me().email) + '</b>' }) + ' <button type="button" class="link-btn" data-act="sign-out-now">' + t('menu.signOut') + '</button></p></div>' : '');
        break;
      case 'create':
        h = '<div class="flow-top">' + back('choice') + langChip + '</div><div class="flow-body"><div class="step-pill">' + t('flow.step', { n: 3, total: 3 }) + '</div><h1 class="flow-title">' + t('create.t') + '</h1><p class="flow-sub">' + t('create.b') + '</p>' +
          '<div class="sign-preview"><span class="sp-board" id="cr-prev">' + esc(st.fam || t('create.ph')) + '</span><span class="sp-post"></span></div>' +
          '<div class="form"><label class="field"><span class="f-l">' + t('family.name') + '</span><input id="cr-name" maxlength="28" placeholder="' + esc(t('create.ph')) + '" value="' + esc(st.fam || '') + '"></label><p class="hint">' + ic('info', 14) + t('create.hint') + '</p></div><p class="form-err" id="cr-err" role="alert"></p></div>' +
          '<div class="flow-actions"><button type="button" class="btn btn-primary btn-block btn-lg" id="cr-go">' + ic('house', 20) + t('create.cta') + '</button></div>';
        break;
      case 'join': {
        const top = '<div class="flow-top">' + back(S().me() ? (fam ? 'close' : 'choice') : 'welcome') + langChip + '</div>';
        const pill = fam ? '' : '<div class="step-pill">' + t('flow.step', { n: 3, total: 3 }) + '</div>';
        const warn = fam ? '<p class="hint warn">' + ic('info', 14) + '<span>' + t('join.switch', { family: '<b>' + esc(fam.name) + '</b>' }) + '</span></p>' : '';
        if (st.found) {
          h = top + '<div class="flow-body">' + pill + '<h1 class="flow-title">' + t('join.found') + '</h1>' +
            '<div class="join-found"><span class="jf-art">' + FF.art.emptyArt('village', 72) + '</span><span class="row-main"><b class="jf-name">' + esc(st.found.n) + '</b><span class="row-s code">' + esc(st.code) + '</span></span></div>' +
            '<p class="flow-sub">' + t('join.foundB') + '</p>' + warn + '<p class="form-err center" id="jn-err" role="alert"></p></div>' +
            '<div class="flow-actions"><button type="button" class="btn btn-primary btn-block btn-lg" id="jn-move">' + ic('house', 20) + t('join.cta') + '</button><button type="button" class="btn btn-ghost btn-block" id="jn-other">' + t('join.other') + '</button></div>';
        } else {
          h = top + '<div class="flow-body">' + pill + '<h1 class="flow-title">' + t('join.t') + '</h1><p class="flow-sub">' + t('join.b') + '</p>' +
            '<label class="code-input"><input id="jn-code" maxlength="9" autocapitalize="characters" autocomplete="one-time-code" spellcheck="false" placeholder="ABC-12345" value="' + esc(st.code || '') + '" aria-label="' + esc(t('invite.code')) + '"></label>' +
            warn + '<p class="form-err center" id="jn-err" role="alert"></p></div>' +
            '<div class="flow-actions"><button type="button" class="btn btn-primary btn-block btn-lg" id="jn-find">' + t('join.find') + '</button></div>';
        }
        break;
      }
    }
    el.innerHTML = '<div class="flow-screen step-' + flow.step + '">' + h + '</div>';
    ui().fitAll(el);
    mountFlow(el);
  }
  function goFlow(step) { flow.step = step; renderFlow(); const s = document.querySelector('#flow .flow-screen'); if (s) s.classList.add('enter'); }
  function onFlowClick(e) {
    const b = e.target.closest('[data-flow]');
    if (!b || b.disabled) return;
    const st = flow.st;
    // keep what was typed when hopping between sign up and sign in
    const em = document.querySelector('#flow #su-email, #flow #si-email');
    if (em && em.value.trim()) st.email = em.value.trim();
    const nm = document.querySelector('#flow #su-name');
    if (nm) st.name = nm.value;
    if (b.hasAttribute('data-then')) st.then = b.dataset.then || null;
    ui().sfx.tap();
    if (b.dataset.flow === 'close') { st.found = null; FF.app.finishOnboarding({}); return; }
    goFlow(b.dataset.flow);
  }
  function afterAuth() {
    const st = flow.st;
    FF.app.adoptPrefs();
    st.legacy = false; st.again = false;
    if (st.then === 'join') goFlow('join');
    else if (S().family()) FF.app.finishOnboarding({});
    else goFlow('choice');
  }
  function mountFlow(el) {
    const st = flow.st;
    el.querySelectorAll('[data-pw]').forEach((b) => b.addEventListener('click', () => { const i = el.querySelector('#' + b.dataset.pw); i.type = i.type === 'password' ? 'text' : 'password'; }));
    const err = (msg) => { const e = el.querySelector('.form-err'); e.textContent = msg; ui().haptic(); };
    if (flow.step === 'signup') {
      mountAvatarPicker(el, st, () => { st.name = el.querySelector('#su-name').value; st.email = el.querySelector('#su-email').value; renderFlow(); });
      el.querySelector('#su-go').addEventListener('click', () => {
        const name = el.querySelector('#su-name').value.trim();
        const email = el.querySelector('#su-email').value.trim();
        const pw = el.querySelector('#su-pw').value;
        if (!name) { err(t('signup.err.name')); el.querySelector('#su-name').focus(); return; }
        if (!email) { err(t('signup.err.emailReq')); el.querySelector('#su-email').focus(); return; }
        if (!validEmail(email)) { err(t('signup.err.email')); el.querySelector('#su-email').focus(); return; }
        if (pw.length < 8) { err(t('signup.err.pw')); el.querySelector('#su-pw').focus(); return; }
        st.name = name; st.email = email;
        busy(el, '#su-go', async () => {
          await FF.cloud.signUp(email, pw, { name, avatar: st.avatar }, { legacy: !!st.legacy });
          ui().sfx.pop();
          afterAuth();
        });
      });
    }
    if (flow.step === 'signin') {
      el.querySelector('#si-go').addEventListener('click', () => {
        const email = el.querySelector('#si-email').value.trim();
        const pw = el.querySelector('#si-pw').value;
        if (!validEmail(email)) { err(t('signup.err.email')); el.querySelector('#si-email').focus(); return; }
        if (!pw) { err(t('signin.err.wrong')); el.querySelector('#si-pw').focus(); return; }
        st.email = email;
        busy(el, '#si-go', async () => {
          const r = await FF.cloud.signIn(email, pw);
          if (!r.profile) {
            // an account without a FamFi profile yet (or records made on this phone before accounts)
            if (S().mode() === 'legacy') { const m = S().me(); await FF.cloud.completeProfile({ name: m.name, avatar: m.avatar }, { legacy: true }); afterAuth(); }
            else goFlow('profile');
            return;
          }
          ui().sfx.pop();
          afterAuth();
        });
      });
      el.querySelector('#si-forgot').addEventListener('click', () => {
        const email = el.querySelector('#si-email').value.trim();
        if (!validEmail(email)) { err(t('signin.err.needEmail')); el.querySelector('#si-email').focus(); return; }
        const sent = () => ui().toast(t('signin.resetSent', { email: '<b>' + esc(email) + '</b>' }), { icon: 'check', tone: 'success', duration: 7000 });
        busy(el, '#si-forgot', async () => {
          try { await FF.cloud.resetPassword(email, FF.i18n.lang); } catch (e) { if (e && e.code === 'auth/user-not-found') { sent(); return; } throw e; }
          sent();
        });
      });
    }
    if (flow.step === 'profile') {
      mountAvatarPicker(el, st, () => { st.name = el.querySelector('#pf-name').value; renderFlow(); });
      el.querySelector('#pf-go').addEventListener('click', () => {
        const name = el.querySelector('#pf-name').value.trim();
        if (!name) { err(t('signup.err.name')); el.querySelector('#pf-name').focus(); return; }
        busy(el, '#pf-go', async () => { await FF.cloud.completeProfile({ name, avatar: st.avatar }); ui().sfx.pop(); afterAuth(); });
      });
    }
    if (flow.step === 'create') {
      const inp = el.querySelector('#cr-name');
      inp.addEventListener('input', () => { st.fam = inp.value; el.querySelector('#cr-prev').textContent = inp.value || t('create.ph'); });
      el.querySelector('#cr-go').addEventListener('click', () => {
        const v = inp.value.trim();
        if (!v) { err(t('create.err')); inp.focus(); return; }
        if (S().mode() !== 'cloud') { S().createFamily(v); FF.app.finishOnboarding({ newVillage: true }); return; }
        busy(el, '#cr-go', async () => { await FF.cloud.createFamily(v); FF.app.finishOnboarding({ newVillage: true }); });
      });
    }
    if (flow.step === 'join' && !st.found) {
      const inp = el.querySelector('#jn-code');
      inp.addEventListener('input', () => {
        let v = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
        inp.value = v; st.code = v;
      });
      el.querySelector('#jn-find').addEventListener('click', () => {
        const code = S().normalizeCode(inp.value);
        if (!code) { err(t('join.err')); return; }
        st.code = code;
        if (!S().me() || S().mode() !== 'cloud') { st.then = 'join'; goFlow(S().me() && S().mode() === 'legacy' ? 'upgrade' : 'signup'); return; }
        busy(el, '#jn-find', async () => {
          const info = await FF.cloud.lookup(code);
          if (!info) { const e = new Error('not-found'); e.code = 'not-found'; throw e; }
          const f = S().family();
          if (f && f.id === info.f) { st.code = ''; FF.app.finishOnboarding({}); ui().toast(t('join.already', { family: '<b>' + esc(f.name) + '</b>' }), { icon: '🏡' }); return; }
          st.found = info;
          renderFlow();
        });
      });
    }
    if (flow.step === 'join' && st.found) {
      el.querySelector('#jn-other').addEventListener('click', () => { st.found = null; st.code = ''; renderFlow(); });
      el.querySelector('#jn-move').addEventListener('click', () => busy(el, '#jn-move', async () => {
        await FF.cloud.joinFamily(st.code);
        st.found = null; st.code = ''; st.then = null;
        FF.app.clearJoinLink();
        FF.app.finishOnboarding({ joined: true });
      }));
    }
  }

  /* ===================================================== INVITE */
  function inviteLink(code) {
    const base = location.origin + location.pathname.replace(/[^/]*$/, '');
    return base + '?join=' + encodeURIComponent(code.replace(/-/g, ''));
  }
  function openInvite() {
    const f = S().family();
    if (!f) return;
    if (f.demo) { openDemoInvite(); return; }
    const link = inviteLink(f.code);
    ui().openSheet({
      className: 'invite-sheet', label: t('invite.t'),
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('invite.t') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<p class="lead center">' + t('invite.b') + '</p>' +
        '<div class="invite-code"><span class="row-s">' + t('invite.code') + '</span><b class="code">' + esc(f.code) + '</b><button type="button" class="btn btn-soft btn-sm" data-copy="' + esc(f.code) + '">' + ic('copy', 16) + t('invite.copyCode') + '</button></div>' +
        '<div class="link-box"><span class="lb-url">' + esc(link.replace(/^https?:\/\//, '')) + '</span></div>' +
        '<button type="button" class="btn btn-primary btn-block btn-lg" id="inv-share">' + ic('share', 20) + t('invite.share') + '</button>' +
        '<div class="who-here"><span class="row-s">' + t('invite.here') + '</span><div class="avatars">' + S().familyMembers().map((m) => FF.art.avatar(m.avatar, 36)).join('') + '<span class="av-plus">' + ic('plus', 18) + '</span></div></div>' +
        '<p class="hint">' + ic('shield', 14) + '<span>' + t('invite.safe') + '</span></p>',
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        body.querySelector('[data-copy]').addEventListener('click', (e) => copy(e.currentTarget.dataset.copy));
        body.querySelector('#inv-share').addEventListener('click', () => {
          const text = t('invite.msg', { family: f.name, code: f.code });
          if (navigator.share) navigator.share({ title: 'FamFi', text, url: link }).catch(() => {});
          else copy(link);
        });
      }
    });
  }
  /* the sample family isn't real: nothing to share — show what joining looks like instead */
  function openDemoInvite() {
    ui().openSheet({
      className: 'invite-sheet', label: t('invite.t'),
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('invite.t') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<p class="lead center">' + t('invite.demoOnly') + '</p>' +
        '<button type="button" class="btn btn-primary btn-block btn-lg" id="inv-real">' + ic('userPlus', 20) + t('invite.createReal') + '</button>' +
        '<div class="demo-box"><span class="chip">' + t('common.demo') + '</span><p>' + t('invite.demoB') + '</p><button type="button" class="btn btn-soft btn-block" id="inv-sim">' + ic('sparkle', 18) + t('invite.demoBtn') + '</button></div>',
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        body.querySelector('#inv-real').addEventListener('click', () => { api.close(true); FF.app.leaveDemo('signup'); });
        body.querySelector('#inv-sim').addEventListener('click', () => {
          api.close(true);
          FF.app.go('family');
          setTimeout(() => S().simulateJoin(), 450);
        });
      }
    });
  }
  function copy(text) {
    const done = () => ui().toast(t('invite.copied'), { icon: 'copy', tone: 'success' });
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else done();
  }

  /* ===================================================== FAMILY GOALS */
  const SUGGEST = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
  const goalsState = { edit: false };
  function goalsHtml() {
    const f = S().family();
    const goals = f.goals;
    const done = goals.filter((g) => g.done).length;
    const year = FF.ymd(FF.today()).y;
    let h = '<div class="poster"><div class="poster-pins"><i></i><i></i></div><div class="poster-head"><span class="poster-kicker">' + ic('target', 16) + t('goals.kicker') + '</span><h2 class="poster-title">' + t('goals.title', { year: FF.i18n.year(year) }) + '</h2>';
    if (goals.length) h += '<div class="poster-progress"><div class="meter sun"><span style="width:' + (goals.length ? done / goals.length * 100 : 0).toFixed(1) + '%"></span></div><span class="pp-t">' + t('goals.progress', { done, total: goals.length }) + '</span></div>';
    if (goals.length && done === goals.length) h += '<div class="ribbon">' + t('goals.allDone') + '</div>';
    h += '</div>';
    if (!goals.length) {
      h += '<div class="empty in-poster">' + FF.art.emptyArt('poster', 120) + '<h3>' + t('goals.empty.t') + '</h3><p>' + t('goals.empty.b') + '</p></div>';
      h += '<div class="chips center">' + SUGGEST.slice(0, 4).map((k) => '<button type="button" class="chip-btn" data-suggest="' + esc(t('goals.s.' + k)) + '">' + ic('plus', 14) + t('goals.s.' + k) + '</button>').join('') + '</div>';
    } else {
      h += '<ul class="goal-list">' + goals.map((g) => {
        const by = S().member(g.done ? g.done.by : g.by);
        const meta = g.done ? t('goals.tickedBy', { name: by ? esc(by.name) : '?', date: FF.i18n.dateShort(g.done.day) }) : t('goals.addedBy', { name: by ? esc(by.name) : '?' });
        return '<li class="goal' + (g.done ? ' done' : '') + '" data-id="' + g.id + '"><button type="button" class="g-check" data-tick="' + g.id + '" role="checkbox" aria-checked="' + !!g.done + '" aria-label="' + esc(g.text) + '"><span class="g-box">' + ic('check', 22) + '</span></button>' +
          '<div class="g-main"><span class="g-text">' + esc(g.text) + '</span><span class="g-meta">' + (by ? FF.art.avatar(by.avatar, 20) : '') + meta + '</span></div>' +
          (g.done ? '<span class="stamp" aria-hidden="true">' + t('goals.stamp') + '</span>' : '') +
          (goalsState.edit ? '<button type="button" class="icon-btn g-del" data-del="' + g.id + '" aria-label="' + esc(t('common.delete')) + '">' + ic('trash', 18) + '</button>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    h += '</div>';
    return h;
  }
  let goalsSheet = null;
  function openGoals() {
    goalsSheet = ui().openSheet({
      className: 'sheet-tall goals-sheet', label: t('goals.title', { year: FF.ymd(FF.today()).y }),
      render: () => '<div class="sheet-head"><button type="button" class="btn btn-ghost btn-sm" data-edit>' + (goalsState.edit ? t('common.done') : t('common.edit')) + '</button><h2>' + t('goals.sheetT') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div id="goals-body">' + goalsHtml() + '</div><p class="hint center">' + ic('users', 14) + t('goals.anyone') + '</p>' +
        '<button type="button" class="btn btn-primary btn-block btn-lg" data-add-goal>' + ic('plus', 20) + t('goals.add') + '</button>',
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        body.querySelector('[data-edit]').addEventListener('click', () => { goalsState.edit = !goalsState.edit; api.render(); });
        body.querySelector('[data-add-goal]').addEventListener('click', () => openAddGoal());
        body.addEventListener('click', onGoalClick);
      },
      onClose: () => { goalsSheet = null; goalsState.edit = false; }
    });
  }
  function onGoalClick(e) {
    const tick = e.target.closest('[data-tick]');
    const del = e.target.closest('[data-del]');
    const sug = e.target.closest('[data-suggest]');
    if (sug) { addGoal(sug.dataset.suggest); return; }
    if (del) { const g = S().deleteGoal(del.dataset.del); refreshGoals(); ui().toast(t('goals.deleted'), { icon: 'trash', action: t('common.undo'), onAction: () => { S().restoreGoal(g); refreshGoals(); } }); return; }
    if (!tick) return;
    const id = tick.dataset.tick;
    const res = S().toggleGoal(id);
    ui().haptic();
    if (res.g && res.g.done) {
      const r = tick.getBoundingClientRect();
      ui().sfx.stamp(); setTimeout(() => ui().sfx.success(), 120);
      refreshGoals(id);
      ui().confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, n: 90 });
      const f = S().family();
      if (f.goals.every((g) => g.done)) setTimeout(() => { ui().confetti({ n: 160 }); ui().toast(t('goals.allDoneToast'), { icon: '🏆', tone: 'success' }); }, 500);
      setTimeout(() => FF.app.celebrate(res), 700);
    } else {
      ui().sfx.tap();
      refreshGoals();
      ui().toast(t('goals.redo'), { icon: 'undo' });
    }
  }
  function refreshGoals(justTicked) {
    if (!goalsSheet) return;
    const host = goalsSheet.body.querySelector('#goals-body');
    host.innerHTML = goalsHtml();
    if (justTicked) { const li = host.querySelector('[data-id="' + justTicked + '"]'); if (li) li.classList.add('just'); }
  }
  function addGoal(text) {
    const g = S().addGoal(text);
    ui().sfx.pop();
    refreshGoals();
    const li = goalsSheet && goalsSheet.body.querySelector('[data-id="' + g.id + '"]');
    if (li) { li.classList.add('pinned'); li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
  function openAddGoal() {
    ui().openSheet({
      label: t('goals.add'),
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('goals.add') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div class="form"><label class="field"><span class="f-l">' + t('goals.what') + '</span><textarea id="goal-text" rows="2" maxlength="80" placeholder="' + esc(t('goals.ph')) + '" autofocus></textarea><span class="f-hint" id="goal-count">0/80</span></label></div>' +
        '<h3 class="sub-h">' + t('goals.ideas') + '</h3><div class="chips">' + SUGGEST.map((k) => '<button type="button" class="chip-btn" data-idea="' + esc(t('goals.s.' + k)) + '">' + t('goals.s.' + k) + '</button>').join('') + '</div>' +
        '<p class="hint">' + ic('info', 14) + t('goals.ownWords') + '</p><button type="button" class="btn btn-primary btn-block btn-lg" id="goal-go">' + ic('plus', 20) + t('goals.pin') + '</button>',
      onRender: (body, api) => {
        body.querySelector('[data-close]').addEventListener('click', () => api.close());
        const ta = body.querySelector('#goal-text');
        const cnt = () => { body.querySelector('#goal-count').textContent = ta.value.length + '/80'; };
        ta.addEventListener('input', cnt);
        body.querySelectorAll('[data-idea]').forEach((b) => b.addEventListener('click', () => { ta.value = b.dataset.idea; cnt(); ta.focus(); }));
        body.querySelector('#goal-go').addEventListener('click', () => {
          const v = ta.value.trim();
          if (!v) { ta.focus(); ui().haptic(); return; }
          api.close(true);
          addGoal(v);
        });
      }
    });
  }

  /* ===================================================== HOUSE CUSTOMISER */
  const ROOF_COLORS = ['#E0563F', '#3D7FD1', '#3E9B55', '#8A5BC7', '#F08A3C', '#2A9D8F', '#9B5E3C', '#E66FA0', '#5D6B7E', '#E8B032'];
  const WALL_COLORS = ['#FFF1D6', '#FBFBF7', '#FFE28A', '#CDEFD2', '#CFE6FB', '#FFD9BE', '#E4D6FA', '#EED9B4', '#BFD8B2', '#F9D0D6'];
  const DOOR_COLORS = ['#8A5A30', '#C8412F', '#2F7D4A', '#2E5FA8', '#E3A520', '#3A3530', '#2A9D8F', '#E66FA0'];
  const DECOR = [{ k: 'flowers', e: '🌷' }, { k: 'fence', e: '🪵' }, { k: 'mailbox', e: '📮' }, { k: 'lantern', e: '🏮' }, { k: 'bench', e: '🪑' }, { k: 'bush', e: '🌳' }, { k: 'fountain', e: '⛲', lv: 4 }];
  const EMBLEMS = ['star', 'heart', 'leaf', 'paw', 'moon', 'flower'];
  function openCustomizer(memberId) {
    const m = S().member(memberId);
    const lv = levelOf(m);
    const st = { tab: 'roof', h: JSON.parse(JSON.stringify(m.house)) };
    const sw = (key, colors) => '<div class="swatches">' + colors.map((c) => '<button type="button" class="swatch-btn' + (st.h[key] === c ? ' on' : '') + '" data-color="' + key + '|' + c + '" style="--c:' + c + '" aria-label="' + c + '"></button>').join('') + '</div>';
    const opt = (key, vals) => '<div class="opt-row">' + vals.map((v) => '<button type="button" class="opt' + (st.h[key] === v ? ' on' : '') + '" data-opt="' + key + '|' + v + '"><span data-fit="11">' + t('cust.' + key + '.' + v) + '</span></button>').join('') + '</div>';
    const panel = () => {
      switch (st.tab) {
        case 'roof': return '<h3 class="sub-h">' + t('cust.style') + '</h3>' + opt('roof', ['gable', 'hip', 'steep']) + '<h3 class="sub-h">' + t('cust.color') + '</h3>' + sw('roofColor', ROOF_COLORS);
        case 'walls': return '<h3 class="sub-h">' + t('cust.material') + '</h3>' + opt('wall', ['plaster', 'wood', 'brick']) + '<h3 class="sub-h">' + t('cust.color') + '</h3>' + sw('wallColor', WALL_COLORS);
        case 'door': return '<h3 class="sub-h">' + t('cust.style') + '</h3>' + opt('door', ['arch', 'square', 'round']) + '<h3 class="sub-h">' + t('cust.color') + '</h3>' + sw('doorColor', DOOR_COLORS);
        case 'flag': return '<div class="set-row"><span class="row-main"><span class="row-t">' + t('cust.flagOn') + '</span></span>' + ui().toggle(st.h.flag && st.h.flag.on, 'data-flagon aria-label="' + esc(t('cust.flagOn')) + '"') + '</div>' +
          '<h3 class="sub-h">' + t('cust.color') + '</h3><div class="swatches">' + ROOF_COLORS.concat(['#FFC23D']).map((c) => '<button type="button" class="swatch-btn' + (st.h.flag && st.h.flag.color === c ? ' on' : '') + '" data-flagc="' + c + '" style="--c:' + c + '" aria-label="' + c + '"></button>').join('') + '</div>' +
          '<h3 class="sub-h">' + t('cust.emblem') + '</h3><div class="opt-row emblems">' + EMBLEMS.map((e) => '<button type="button" class="opt' + (st.h.flag && st.h.flag.emblem === e ? ' on' : '') + '" data-emb="' + e + '" aria-label="' + e + '"><svg viewBox="-6 -6 12 12" width="26" height="26">' + FF.art.emblem(e, 0, 0, 1, 'currentColor') + '</svg></button>').join('') + '</div>';
        case 'garden': return '<div class="decor-grid">' + DECOR.map((d) => { const locked = d.lv && lv < d.lv; const on = (st.h.decor || []).indexOf(d.k) !== -1; return '<button type="button" class="decor' + (on ? ' on' : '') + (locked ? ' locked' : '') + '" data-decor="' + d.k + '"' + (locked ? ' aria-disabled="true"' : '') + '><span class="d-emo">' + d.e + '</span><span data-fit="10">' + t('cust.decor.' + d.k) + '</span>' + (locked ? '<span class="d-lock">' + ic('lock', 12) + t('level.n', { n: d.lv }) + '</span>' : '<span class="d-check">' + ic('check', 12) + '</span>') + '</button>'; }).join('') + '</div>' +
          '<button type="button" class="btn btn-soft btn-block shop-link" data-shop>' + FF.art.gem(18) + t('cust.moreShop') + '</button>';
        default: return '<label class="field"><span class="f-l">' + t('cust.plate') + '</span><input id="cust-plate" maxlength="18" value="' + esc(st.h.plate || '') + '" placeholder="' + esc(t('cust.platePh')) + '"></label><p class="hint">' + ic('info', 14) + t('cust.plateHint') + '</p>';
      }
    };
    const preview = () => '<div class="cust-stage">' + FF.art.houseHtml(st.h, lv) + '</div>';
    ui().openSheet({
      className: 'sheet-tall cust-sheet', label: t('cust.title'), state: st,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><h2>' + t('cust.title') + '</h2><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div id="cust-prev">' + preview() + '</div><div class="lvl-chip">' + ic('star', 14) + t('level.n', { n: lv }) + ' · ' + t('level.name.' + lv) + '</div>' +
        '<div class="cust-tabs" role="tablist">' + ['roof', 'walls', 'door', 'flag', 'garden', 'sign'].map((k) => '<button type="button" role="tab" class="ct' + (st.tab === k ? ' on' : '') + '" data-tab="' + k + '" aria-selected="' + (st.tab === k) + '"><span class="ct-emo">' + { roof: '🏠', walls: '🧱', door: '🚪', flag: '🚩', garden: '🌷', sign: '🪧' }[k] + '</span><span data-fit="10">' + t('cust.tab.' + k) + '</span></button>').join('') + '</div>' +
        '<div class="cust-panel">' + panel() + '</div>' +
        '<div class="btn-row"><button type="button" class="btn btn-ghost" data-close>' + t('common.cancel') + '</button><button type="button" class="btn btn-primary" id="cust-go">' + ic('check', 18) + t('cust.save') + '</button></div>',
      onRender: (body, api) => {
        const upd = () => { body.querySelector('#cust-prev').innerHTML = preview(); };
        body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
        body.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.tab; ui().sfx.tap(); api.render(); }));
        body.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => { const p = b.dataset.color.split('|'); st.h[p[0]] = p[1]; body.querySelectorAll('[data-color^="' + p[0] + '|"]').forEach((x) => x.classList.toggle('on', x === b)); ui().sfx.tap(); upd(); }));
        body.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => { const p = b.dataset.opt.split('|'); st.h[p[0]] = p[1]; body.querySelectorAll('[data-opt^="' + p[0] + '|"]').forEach((x) => x.classList.toggle('on', x === b)); ui().sfx.tap(); upd(); }));
        const fo = body.querySelector('[data-flagon]');
        if (fo) fo.addEventListener('click', () => { st.h.flag = Object.assign({ color: '#FFC23D', emblem: 'star' }, st.h.flag, { on: !(st.h.flag && st.h.flag.on) }); fo.classList.toggle('on', st.h.flag.on); upd(); });
        body.querySelectorAll('[data-flagc]').forEach((b) => b.addEventListener('click', () => { st.h.flag = Object.assign({ on: true, emblem: 'star' }, st.h.flag, { color: b.dataset.flagc, on: true }); api.render(); }));
        body.querySelectorAll('[data-emb]').forEach((b) => b.addEventListener('click', () => { st.h.flag = Object.assign({ on: true, color: '#FFC23D' }, st.h.flag, { emblem: b.dataset.emb, on: true }); api.render(); }));
        body.querySelectorAll('[data-decor]').forEach((b) => b.addEventListener('click', () => {
          if (b.classList.contains('locked')) { ui().toast(t('cust.locked', { n: 4 }), { icon: 'lock' }); return; }
          const d = st.h.decor || (st.h.decor = []); const i = d.indexOf(b.dataset.decor);
          if (i === -1) d.push(b.dataset.decor); else d.splice(i, 1);
          b.classList.toggle('on'); ui().sfx.tap(); upd();
        }));
        const sl = body.querySelector('[data-shop]');
        if (sl) sl.addEventListener('click', () => { api.close(); FF.app.go('home'); setTimeout(() => FF.app.push('shop'), 60); });
        const pl = body.querySelector('#cust-plate');
        if (pl) pl.addEventListener('input', () => { st.h.plate = pl.value; upd(); });
        body.querySelector('#cust-go').addEventListener('click', () => {
          S().setHouse(memberId, st.h); api.close(true); ui().sfx.chime(); ui().haptic();
          ui().toast(t('cust.saved'), { icon: '🏡', tone: 'success' });
          FF.village && FF.village.bounce(memberId);
        });
      }
    });
  }
  const levelOf = (m) => S().levelOf(m);
  /* their daily-gift streak, while it's alive */
  function streakChip(m) {
    const p = m.id === S().state.meId ? S().playOf(m) : m.play || null; // (family members' gems stay private: only streak + day are shared)
    const n = p ? FF.play.streakNow(p, S().dayNow()) : m.streak && m.streak.d >= S().dayNow() - 1 ? m.streak.n : 0;
    return n ? ' <span class="chip chip-fire">🔥 ' + t('daily.streak', { n, count: n }) + '</span>' : '';
  }
  /* what level a viewer sees (private net worth → a neutral level 2) */
  function visibleLevel(m, viewerId) { return S().canSee(viewerId, m.id, 'netWorth') ? levelOf(m) : 2; }

  /* ===================================================== VISIT */
  const HELP_TABS = ['home', 'records', 'return', 'div'];
  const VISIT_TABS = ['home', 'return', 'div'];
  function visitHtml(v) {
    const m = S().member(v.id);
    const viewer = v.viewer || S().state.meId;
    const preview = v.id === S().state.meId && viewer !== S().state.meId;
    // they let their family help (v2.25): their records are open to me, to add to and fix
    const help = !preview && viewer === S().state.meId && S().canHelp(v.id);
    const ctx = { id: v.id, ro: true, viewer, inVisit: true, help };
    const tabs = help ? HELP_TABS : VISIT_TABS;
    if (tabs.indexOf(v.tab) === -1) v.tab = 'home';
    const viewerM = S().member(viewer);
    let body = '';
    if (v.loading) body = '<div class="sk-wrap">' + ui().skeleton([[18, '40%', 'margin:6px 0 10px'], [46, '72%'], [18, '56%', 'margin:10px 0 18px'], [96, '100%', 'border-radius:22px;margin-bottom:14px'], [64, '100%', 'border-radius:18px;margin-bottom:10px'], [64, '100%', 'border-radius:18px;margin-bottom:10px'], [64, '100%', 'border-radius:18px']]) + '</div>';
    else body = { home: FF.money.home, records: FF.helpUI.records, return: FF.money.ret, div: FF.money.div }[v.tab](ctx);
    const chip = help ? '<span class="chip chip-help">🤝 ' + t('help.chip') + '</span>' : '<span class="chip chip-view">' + ic('eye', 14) + t('visit.viewOnly') + '</span>';
    return '<div class="visit-top"><button type="button" class="exit-pill" data-act="exit-visit">' + ic('exit', 20) + '<span>' + t('visit.exit') + '</span></button>' + chip + '</div>' +
      '<header class="visit-head">' + FF.art.avatar(m.avatar, 60) + '<div class="row-main"><span class="kicker">' + (preview ? t('visit.previewAs', { name: esc(viewerM.name) }) : t('visit.visiting')) + '</span><h1 class="scr-title">' + t('visit.house', { name: esc(m.name) }) + '</h1><span class="chip">' + ic('star', 12) + t('level.n', { n: visibleLevel(m, viewer) }) + ' · ' + esc(m.house.plate || '') + '</span>' + streakChip(m) + '</div></header>' +
      ui().segmented('visit', tabs.map((k) => ({ v: k, l: t(k === 'records' ? 'man.tab.records' : 'tab.' + k) })), v.tab, 'seg-visit') +
      '<div class="visit-body">' + body + '</div>';
  }


  Object.assign(A, {
    invite: () => openInvite(),
    goals: () => openGoals(),
    customize: (el) => openCustomizer(el.dataset.id || S().state.meId),
    'create-family': () => FF.app.startFlow('create'),
    demo: () => FF.app.startDemo()
  });

  FF.family = { renderFlow, goFlow, flow, openInvite, openGoals, refreshGoals, openCustomizer, levelOf, visibleLevel, visitHtml, VISIT_TABS, avatarPicker, mountAvatarPicker, inviteLink };
})(window);
