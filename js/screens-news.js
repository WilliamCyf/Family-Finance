/* ============================================================
   FamFi — screens-news.js
   The News mailbox, opened: a wooden notice board of paper posters,
   Hay Day style. Three tabs — World · Malaysia · Markets. The top
   story is a big poster with a ribbon; the rest are pinned notes,
   each with its photo, the newsroom and how long ago.

   Tap a poster for a quick read: the newsroom's own headline and
   summary, then "Read the full story" opens it on their site. FamFi
   never writes or rewrites the news (news.js has the sources).
   Reading three stories a day earns a few gems.

   Light on the phone: only the tab you look at is fetched (kept 20
   minutes); photos load as you scroll to them; the posters are
   still pictures (no animations running); a story you read is
   remembered on this phone only.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const S = () => FF.store, NW = () => FF.news;
  const t = (k, v) => FF.i18n.t(k, v);
  const ic = (n, s) => FF.art.icon(n, s);
  const esc = FF.esc;
  const ui = () => FF.ui;
  const TAB_EMO = { world: '🌏', my: '🇲🇾', market: '📈' };
  const PINS = ['#E0463A', '#3D7FD1', '#F2B632', '#2F9A4C'];
  const st = { tab: 'world', data: {}, busy: {}, el: null, scroll: {}, want: null }; // scroll: where you were in each tab; want: where a still-loading tab should land

  /* stories read on this phone (just for the "Read" stamp — not synced) */
  const READ_KEY = 'famfi.newsRead';
  let readList = null;
  function reads() { if (!readList) { try { readList = JSON.parse(localStorage.getItem(READ_KEY)) || []; } catch (e) { readList = []; } } return readList; }
  function markRead(id) {
    const r = reads();
    if (r.indexOf(id) !== -1) return;
    r.unshift(id);
    if (r.length > 300) r.length = 300;
    try { localStorage.setItem(READ_KEY, JSON.stringify(r)); } catch (e) { /* fine */ }
  }

  /* when you last opened the mailbox (on this phone): its flag is up again after 3 hours */
  let seenNow = 0;
  const lastSeen = () => Math.max(seenNow, +S().device().newsSeen || 0);
  function open() {
    seenNow = Date.now();
    S().setDevice({ newsSeen: seenNow }); // the mailbox's flag goes down
    FF.app.push('news');
  }
  const live = () => !!(st.el && document.body.contains(st.el));
  const dataOf = (tab) => st.data[tab] || (st.data[tab] = Object.assign({ failed: 0, total: 0 }, NW().peek(tab)));
  const srcOf = (x) => NW().SOURCES[x.src] || { name: x.src, tint: '#8C8577' };

  /* ---------- words for time ---------- */
  function ago(at) {
    const m = Math.max(0, Math.round((Date.now() - at) / 6e4));
    if (m < 2) return t('news.now');
    if (m < 60) return t('news.mins', { n: m });
    const h = Math.round(m / 60);
    if (h < 24) return t('news.hrs', { n: h });
    return t('news.days', { n: Math.round(h / 24) });
  }
  const LOCALE = { en: 'en-MY', zh: 'zh-CN', th: 'th-TH' };
  const when = (at) => { try { return new Date(at).toLocaleString(LOCALE[FF.i18n.lang] || 'en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  const clock = (at) => { try { return new Date(at).toLocaleTimeString(LOCALE[FF.i18n.lang] || 'en-MY', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };

  /* ---------- the page ---------- */
  function page() {
    return '<div class="nw">' +
      '<div class="nw-board"><div class="nw-sign"><span>📰 ' + t('news.boardT') + '</span></div><p class="nw-lead">' + t('news.lead') + '</p><div id="nw-goal">' + goalHtml() + '</div></div>' +
      '<div class="nw-tabs" role="tablist" aria-label="' + esc(t('news.name')) + '">' + NW().TAB_IDS.map((k) => '<button type="button" class="nw-tab' + (k === st.tab ? ' on' : '') + '" role="tab" aria-selected="' + (k === st.tab) + '" data-nw-tab="' + k + '"><span aria-hidden="true">' + TAB_EMO[k] + '</span>' + t('news.tab.' + k) + '</button>').join('') + '</div>' +
      '<div class="nw-status" id="nw-status">' + statusHtml() + '</div>' +
      '<div class="nw-list" id="nw-list">' + listHtml() + '</div>' +
      '<p class="nw-credit">' + ic('info', 14) + '<span>' + t('news.credit') + '</span></p></div>';
  }
  function goalHtml() {
    const today = S().newsToday(), G = FF.play.NEWS;
    return '<div class="nw-goal' + (today.done ? ' done' : '') + '"><span aria-hidden="true">' + (today.done ? '✅' : '📖') + '</span><b class="num">' + today.n + '/' + G.GOAL + '</b><span>' + t(today.done ? 'news.goalDone' : 'news.goal', { goal: G.GOAL, gems: G.GEMS }) + '</span>' + FF.art.gem(16) + '</div>';
  }
  function statusHtml() {
    const d = dataOf(st.tab), busy = st.busy[st.tab];
    const btn = '<button type="button" class="nw-refresh" data-nw-refresh aria-label="' + esc(t('news.refresh')) + '"' + (busy ? ' disabled' : '') + '>' + ic('refresh', 18) + '</button>';
    if (busy && !d.items.length) return '<span>' + t('news.loading') + '</span>' + btn;
    let s = d.at ? t('news.updated', { time: clock(d.at) }) : '';
    if (d.failed) s += (s ? ' · ' : '') + t('news.someFailed', { n: d.failed });
    return '<span>' + (busy ? t('news.loading') : s) + '</span>' + btn;
  }
  function listHtml() {
    const d = dataOf(st.tab);
    if (!d.items.length) {
      if (st.busy[st.tab] || !st.data[st.tab].tried) return [0, 1, 2].map((k) => '<div class="nw-poster wait t' + k + '" aria-hidden="true"><span class="nw-pin" style="--p:' + PINS[k] + '"></span><span class="nw-bar"></span><span class="nw-bar short"></span></div>').join('');
      const off = d.failed && d.failed >= d.total;
      return '<div class="nw-poster empty"><span class="nw-pin" style="--p:' + PINS[0] + '"></span><span class="nw-empty-emo" aria-hidden="true">' + (off ? '📭' : '🗞️') + '</span><b>' + t(off ? 'news.offT' : 'news.emptyT') + '</b><span>' + t(off ? 'news.offB' : 'news.emptyB') + '</span>' +
        '<span class="btn btn-sun" data-nw-refresh role="button" tabindex="0">' + ic('refresh', 18) + t('news.retry') + '</span></div>';
    }
    return d.items.map(poster).join('');
  }
  function poster(x, k) {
    const src = srcOf(x), read = reads().indexOf(x.id) !== -1, emo = NW().topic(x, st.tab);
    const pin = '<span class="nw-pin" style="--p:' + PINS[k % PINS.length] + '"></span>';
    const meta = '<span class="nw-meta"><span class="nw-src" style="--c:' + src.tint + '">' + esc(src.name) + '</span><span class="nw-ago">' + ago(x.at) + '</span></span>';
    const img = x.img ? '<img src="' + esc(x.img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '';
    const stamp = read ? '<span class="nw-stamp">' + t('news.read') + '</span>' : '';
    if (k === 0) {
      return '<button type="button" class="nw-poster hero' + (read ? ' read' : '') + '" data-nw-id="' + x.id + '">' + pin + '<span class="nw-ribbon">' + t('news.top') + '</span>' +
        '<span class="nw-photo' + (img ? '' : ' noimg') + '">' + img + '<span class="nw-emo-big" aria-hidden="true">' + emo + '</span></span>' +
        '<span class="nw-h">' + esc(x.title) + '</span>' + (x.sum ? '<span class="nw-sum">' + esc(x.sum) + '</span>' : '') + meta + stamp + '</button>';
    }
    return '<button type="button" class="nw-poster t' + (k % 3) + (read ? ' read' : '') + '" data-nw-id="' + x.id + '">' + pin +
      '<span class="nw-txt"><span class="nw-h"><span class="nw-emo" aria-hidden="true">' + emo + '</span>' + esc(x.title) + '</span>' + meta + '</span>' +
      '<span class="nw-thumb' + (img ? '' : ' noimg') + '">' + img + '<span class="nw-emo-big" aria-hidden="true">' + emo + '</span></span>' + stamp + '</button>';
  }
  function paint() {
    if (!live()) return;
    const $ = (s) => st.el.querySelector(s);
    $('#nw-status').innerHTML = statusHtml();
    $('#nw-list').innerHTML = listHtml();
    $('#nw-goal').innerHTML = goalHtml();
    st.el.querySelectorAll('.nw-tab').forEach((b) => { const on = b.dataset.nwTab === st.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  }

  /* ---------- fetching: the tab you're on, when what's kept is older than 20 minutes ---------- */
  async function ensure(tab, force) {
    if (st.busy[tab]) return;
    const d = dataOf(tab);
    if (!force && d.tried && Date.now() - d.at < NW().FRESH) return;
    if (!force && d.fresh && d.items.length) { d.tried = true; return; }
    st.busy[tab] = true;
    if (tab === st.tab) paint();
    const res = await NW().load(tab, { force });
    st.busy[tab] = false;
    st.data[tab] = Object.assign(res, { tried: true });
    if (tab === st.tab) { paint(); settle(); }
    if (force && tab === st.tab && live()) ui().toast(res.failed >= res.total ? t('news.offT') : t('news.updated', { time: clock(res.at) }), { icon: res.failed >= res.total ? 'info' : 'check' });
  }

  function settle() {
    const w = st.want;
    if (!w || w.tab !== st.tab || !live()) return;
    st.want = null;
    const body = st.el.querySelector('.page-body');
    if (body) body.scrollTop = w.top;
  }

  function after(el) {
    if (st.el !== el) { st.scroll = {}; st.want = null; } // a fresh visit starts every tab at the top
    st.el = el;
    el.addEventListener('click', onClick);
    // a photo that won't load: the poster shows its picture-word instead
    el.addEventListener('error', (e) => { const im = e.target; if (im && im.tagName === 'IMG') { const box = im.parentNode; if (box) box.classList.add('noimg'); im.remove(); } }, true);
    ensure(st.tab, false);
  }
  function onClick(e) {
    const tb = e.target.closest('[data-nw-tab]');
    if (tb) {
      if (tb.dataset.nwTab === st.tab) return;
      // each tab keeps its own place: leaving one remembers where you were in it; a tab you
      // haven't scrolled yet opens at its first story (just under the tabs, which stay in view)
      const body = st.el.querySelector('.page-body');
      const was = body ? body.scrollTop : 0;
      st.scroll[st.tab] = st.want && st.want.tab === st.tab ? st.want.top : was; // left before it loaded: where it was going
      st.tab = tb.dataset.nwTab;
      st.want = null;
      ui().sfx.tap();
      paint();
      if (body) {
        const saved = st.scroll[st.tab], status = st.el.querySelector('#nw-status'), tabs = st.el.querySelector('.nw-tabs');
        const listTop = status && tabs ? Math.max(0, status.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - tabs.offsetHeight - 4) : 0;
        const top = saved != null ? saved : Math.min(was, listTop);
        body.scrollTop = top;
        // still fetching (the page is too short to get there yet): land there when its stories arrive
        if (body.scrollTop < top - 1) st.want = { tab: st.tab, top };
      }
      ensure(st.tab, false);
      return;
    }
    if (e.target.closest('[data-nw-refresh]')) { ui().sfx.tap(); ensure(st.tab, true); return; }
    const p = e.target.closest('[data-nw-id]');
    if (p) openStory(p.dataset.nwId, p);
  }

  /* ---------- a quick read: the newsroom's own words, then their site for the whole story ---------- */
  function openStory(id, posterEl) {
    const x = dataOf(st.tab).items.find((y) => y.id === id);
    if (!x) return;
    ui().sfx.tap();
    const src = srcOf(x), emo = NW().topic(x, st.tab);
    markRead(x.id);
    const res = S().newsRead(x.id);
    ui().openSheet({
      className: 'nw-sheet', label: x.title,
      render: () => '<div class="sheet-head"><span class="sh-spacer"></span><span class="nw-sheet-src"><span class="nw-src" style="--c:' + src.tint + '">' + esc(src.name) + '</span><span class="nw-ago">' + ago(x.at) + '</span></span><button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + ic('close', 22) + '</button></div>' +
        '<div class="nw-big' + (x.img ? '' : ' noimg') + '">' + (x.img ? '<img src="' + esc(x.img) + '" alt="" decoding="async" referrerpolicy="no-referrer">' : '') + '<span class="nw-emo-big" aria-hidden="true">' + emo + '</span></div>' +
        '<h2 class="nw-title">' + esc(x.title) + '</h2>' +
        (x.sum ? '<p class="nw-body">' + esc(x.sum) + '</p>' : '<p class="nw-body muted">' + t('news.noSum', { src: esc(src.name) }) + '</p>') +
        '<a class="btn btn-primary btn-block btn-lg nw-go" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + t('news.readFull', { src: esc(src.name) }) + ic('external', 18) + '</a>' +
        (navigator.share ? '<button type="button" class="btn btn-soft btn-block" data-nw-share>' + ic('share', 18) + t('news.share') + '</button>' : '') +
        '<p class="hint nw-from">' + ic('info', 14) + '<span>' + t('news.fromSrc', { src: esc(src.name), time: esc(when(x.at)) }) + '</span></p>',
      onRender: (body, api) => {
        body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
        const im = body.querySelector('.nw-big img');
        if (im) im.addEventListener('error', () => { im.parentNode.classList.add('noimg'); im.remove(); });
        const sh = body.querySelector('[data-nw-share]');
        if (sh) sh.addEventListener('click', () => { navigator.share({ title: x.title, text: x.title + ' — ' + src.name, url: x.url }).catch(() => {}); });
      }
    });
    // the poster gets its "Read" stamp; the goal moves on
    if (posterEl && !posterEl.classList.contains('read')) { posterEl.classList.add('read'); posterEl.insertAdjacentHTML('beforeend', '<span class="nw-stamp">' + t('news.read') + '</span>'); }
    if (live()) st.el.querySelector('#nw-goal').innerHTML = goalHtml();
    if (res && res.gems) {
      setTimeout(() => { ui().sfx.coin(); ui().toast(t('news.earned', { goal: FF.play.NEWS.GOAL, n: res.gems }) + ' ' + FF.art.gem(16), { tone: 'success', icon: '📰' }); }, 450);
    }
  }

  FF.newsUI = { open, page, after, ago, lastSeen };
})(window);
