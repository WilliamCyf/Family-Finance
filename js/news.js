/* ============================================================
   FamFi — news.js
   The News mailbox in the village: what's happening in the world,
   in Malaysia and in the markets — told by real newsrooms, never
   written by FamFi. Every story is a newsroom's own headline, its
   own short summary and photo, the time it was published and a
   link to the full story on its own site.

   Where it comes from (each newsroom's public RSS feed):
     World     CNA World · CNA Asia (not Malaysia) · BBC World
     Malaysia  Malay Mail · Free Malaysia Today · CNA Asia (Malaysia)
     Markets   Malay Mail Money · CNA Business · MarketWatch · CNBC
   CNA, MarketWatch and CNBC let a web app read their feeds directly.
   BBC, Malay Mail and FMT don't, so those come through rss2json.com
   (a free service that re-serves a public feed as JSON). If a
   source is down, the others still fill the board.

   Cost: nothing until the mailbox is opened; then just the tab you
   look at (its feeds in parallel, tens of KB), kept on the phone
   for 20 minutes. No timers, no polling. The parsing below needs no
   DOM, so it runs in the jsc tests.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;

  const CNA = (cat) => 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=' + cat;
  const SOURCES = {
    cnaWorld: { name: 'CNA', tint: '#C8102E', rss: CNA(6311) },
    cnaAsia: { name: 'CNA', tint: '#C8102E', rss: CNA(6511) },
    cnaBiz: { name: 'CNA', tint: '#C8102E', rss: CNA(6936) },
    bbc: { name: 'BBC News', tint: '#A8000F', via: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    mm: { name: 'Malay Mail', tint: '#1D4E9E', via: 'https://www.malaymail.com/feed/rss/malaysia' },
    mmMoney: { name: 'Malay Mail', tint: '#1D4E9E', via: 'https://www.malaymail.com/feed/rss/money' },
    fmt: { name: 'FMT', tint: '#0B6E4F', via: 'https://www.freemalaysiatoday.com/category/nation/feed/' },
    mw: { name: 'MarketWatch', tint: '#2E7D32', rss: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
    cnbc: { name: 'CNBC', tint: '#005594', rss: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258' }
  };
  const R2J = 'https://api.rss2json.com/v1/api.json?rss_url=';
  // a story is about Malaysia if it names it, its people, places, parties or institutions
  const MY = /\b(malaysia|malaysians?|kuala lumpur|putrajaya|anwar|johor|selangor|penang|sabah|sarawak|melaka|malacca|kedah|kelantan|terengganu|perak|pahang|perlis|negeri sembilan|labuan|madani|ringgit|bursa malaysia|petronas|bank negara|umno|pakatan|perikatan|barisan nasional|bersatu|dewan rakyat|agong|muhyiddin|mahathir|zahid)\b/i;
  // CNA's business feed carries tech and company news too: the Markets tab keeps the money stories
  const FIN = /\b(stocks?|shares?|markets?|bursa|ringgit|dollar|yen|yuan|euro|currenc\w*|oil|crude|gold|banks?|banking|rates?|inflation|profits?|earnings|revenue|economy|economic|gdp|growth|trade|tariffs?|exports?|ipo|bonds?|yields?|investors?|investment|funds?|prices?|sales|deals?|mergers?|acquisitions?|billion|million|crypto|bitcoin|fed|central bank|recession|debt|budget|tax)\b/i;
  const TABS = {
    world: [{ s: 'cnaWorld' }, { s: 'cnaAsia', skip: MY }, { s: 'bbc' }],
    my: [{ s: 'mm' }, { s: 'fmt' }, { s: 'cnaAsia', keep: MY }],
    market: [{ s: 'mmMoney' }, { s: 'cnaBiz', keep: FIN }, { s: 'mw' }, { s: 'cnbc' }]
  };
  const TAB_IDS = ['world', 'my', 'market'];
  const MAX_AGE = 3 * 864e5;   // older than 3 days isn't news any more
  const KEEP = 30;             // stories per tab
  const FRESH = 20 * 6e4;      // a feed is kept on the phone this long before asking again
  const WAIT = 9000;           // a newsroom that takes longer is skipped this time

  /* ---------- text: whatever the feed sends, plain words come out ---------- */
  const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—', middot: '·', bull: '•', eacute: 'é', copy: '©', trade: '™', reg: '®', pound: '£', euro: '€', yen: '¥', cent: '¢', deg: '°', times: '×' };
  function decode(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
      }
      const v = NAMED[e.toLowerCase()];
      return v != null ? v : m;
    });
  }
  /* CDATA unwrapped, entities decoded, HTML tags dropped, spaces tidied */
  function text(s) {
    let x = String(s == null ? '' : s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    x = decode(x);
    x = x.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ');
    return decode(x).replace(/\s+/g, ' ').trim();
  }

  /* ---------- an RSS 2.0 feed → raw stories ---------- */
  function tagOf(it, name) {
    const m = it.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
    return m ? m[1] : '';
  }
  function attrOf(it, name, attr, ok) {
    const re = new RegExp('<' + name + '\\b([^>]*)>', 'gi');
    let m;
    while ((m = re.exec(it))) {
      const v = m[1].match(new RegExp('\\b' + attr + '\\s*=\\s*"([^"]*)"', 'i'));
      if (v && (!ok || ok(m[1]))) return decode(v[1]);
    }
    return '';
  }
  const isImage = (a) => !/\b(type|medium)\s*=\s*"(?!image)/i.test(a); // untyped, or typed as an image
  function parseRSS(xml) {
    return String(xml || '').split(/<item[\s>]/i).slice(1).map((raw) => {
      const it = raw.split(/<\/item>/i)[0];
      return {
        title: text(tagOf(it, 'title')),
        url: text(tagOf(it, 'link')) || text(tagOf(it, 'guid')),
        sum: text(tagOf(it, 'description')),
        at: Date.parse(text(tagOf(it, 'pubDate')) || text(tagOf(it, 'dc:date'))),
        img: attrOf(it, 'media:thumbnail', 'url') || attrOf(it, 'media:content', 'url', isImage) || attrOf(it, 'enclosure', 'url', isImage)
      };
    });
  }
  /* …and rss2json's JSON (its times are UTC, written "2026-10-07 21:40:24") */
  function parseR2J(o) {
    if (!o || o.status !== 'ok' || !Array.isArray(o.items)) return [];
    return o.items.map((x) => {
      const enc = x.enclosure && typeof x.enclosure === 'object' ? x.enclosure : {};
      const when = String(x.pubDate || '');
      return {
        title: text(x.title),
        url: String(x.link || x.guid || '').trim(),
        sum: text(x.description || x.content),
        at: /^\d{4}-\d\d-\d\d \d\d:\d\d(:\d\d)?$/.test(when) ? Date.parse(when.replace(' ', 'T') + 'Z') : Date.parse(when),
        img: String(x.thumbnail || (enc.link && isImage(' type="' + (enc.type || '') + '"') ? enc.link : '') || '')
      };
    });
  }

  /* ---------- a raw story → one we'll show (or null: not shown) ---------- */
  const web = (u) => (/^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : '');
  function clean(raw, src, now) {
    const title = raw && raw.title, url = web(String((raw && raw.url) || '').trim());
    if (!title || title.length < 8 || !url || !(raw.at > 0)) return null;
    if (raw.at < now - MAX_AGE || raw.at > now + 36e5) return null;
    let img = web(String(raw.img || '').trim()).replace(/^http:/i, 'https:');
    if (/^https:\/\/ichef\.bbci\.co\.uk\//.test(img)) img = img.replace(/\/standard\/\d+\//, '/standard/480/'); // the BBC feed's photo is tiny: ask for a sharper one
    let sum = raw.sum && raw.sum.toLowerCase() !== title.toLowerCase() ? raw.sum : '';
    if (sum.length > 300) sum = sum.slice(0, 300).replace(/\s+\S*$/, '') + '…';
    return { id: FF.hash(url).toString(36), title: title.length > 200 ? title.slice(0, 200).replace(/\s+\S*$/, '') + '…' : title, sum, url, img, at: raw.at, src };
  }

  /* ---------- several newsrooms → one board: newest first, no repeats, no long runs from one paper ---------- */
  const sameKey = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 48);
  const brand = (x) => (SOURCES[x.src] ? SOURCES[x.src].name : x.src);
  // two papers telling the same story in their own words: most of the headline's real words match
  const SMALL = /^(that|this|with|from|over|after|amid|says|said|will|have|been|their|they|into|about|what|when|more|than|year|years|first|last|next|week|today|tomorrow|news)$/;
  // (compared by their first five letters, so "evicted" and "eviction", "Spain" and "Spanish"… almost, match)
  const words = (t) => t.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !SMALL.test(w)).map((w) => w.slice(0, 5));
  function alike(a, b) {
    let n = 0;
    a.forEach((w) => { if (b.indexOf(w) !== -1) n++; });
    return n >= 4 && n / Math.min(a.length, b.length) >= 0.6;
  }
  function merge(lists, limit) {
    const seen = {}, all = [];
    lists.forEach((l) => l.forEach((x) => {
      const k = sameKey(x.title), w = words(x.title);
      if (seen['u' + x.url] || seen['t' + k] || all.some((y) => alike(w, y.w))) return;
      seen['u' + x.url] = seen['t' + k] = 1;
      all.push(Object.assign({}, x, { w }));
    }));
    all.forEach((x) => { delete x.w; });
    all.sort((a, b) => b.at - a.at);
    const out = [], held = [];
    const fits = (x) => !(out.length >= 2 && brand(out[out.length - 1]) === brand(x) && brand(out[out.length - 2]) === brand(x));
    all.forEach((x) => {
      for (let i = 0; i < held.length; i++) if (fits(held[i])) { out.push(held.splice(i, 1)[0]); i = -1; }
      if (fits(x)) out.push(x); else held.push(x);
    });
    held.forEach((x) => out.push(x));
    return out.slice(0, limit || KEEP);
  }

  /* ---------- a little picture for what a story is about (decoration only; the words are the newsroom's) ---------- */
  const TOPICS = [
    [/\bflood/i, '🌊'], [/\bhaze\b|smog|air quality/i, '🌫️'], [/typhoon|cyclone|hurricane|tropical storm|storm surge|thunderstorm/i, '🌀'], [/earthquake|\bquake|tsunami|volcan/i, '🌋'],
    [/wildfire|\bfires?\b|\bblaze/i, '🔥'], [/heatwave|heat wave|drought/i, '☀️'],
    [/election|\bpolls?\b|\bvote|ballot/i, '🗳️'], [/\bbudget\b/i, '💰'], [/\btax(es)?\b|\bsst\b|\bgst\b/i, '🧾'],
    [/inflation|interest rate|central bank|bank negara|\bfed\b|federal reserve/i, '🏦'], [/ringgit|dollar|\byen\b|\beuro\b|currenc/i, '💱'],
    [/\boil\b|crude|petrol|\bfuel|opec/i, '🛢️'], [/\bgold\b/i, '🥇'], [/bitcoin|crypto/i, '🪙'],
    [/\b(stocks?|shares|bursa|wall street|nasdaq|s&p|dow|markets?|index|yields?)\b[^.]*\b(fall|falls|fell|drop|drops|slump|slumps|tumble|tumbles|retreat|retreats|slip|slips|sink|sinks|lower|losses|weigh|weighs|crash)\b/i, '📉'],
    [/\b(stocks?|shares|bursa|wall street|nasdaq|s&p|dow jones|ipo|earnings|profits?|rally|record high)\b/i, '📈'],
    [/\bai\b|artificial intelligence|\bchips?\b|semiconductor|\btech\b/i, '🤖'], [/formula 1|formula one|\bf1\b|grand prix/i, '🏎️'],
    [/football|fifa|world cup|badminton|olympic|\bsports?\b|\bmatch\b/i, '⚽'], [/health|hospital|virus|disease|vaccine|dengue|covid|\bflu\b/i, '🩺'],
    [/school|student|education|university|teacher|exam/i, '🏫'], [/court|trial|judge|verdict|\bjail|prison|lawsuit/i, '⚖️'], [/police|arrest|crime|scam|fraud|smuggl/i, '🚓'],
    [/\btrade\b|tariff|export|import/i, '🚢'], [/flight|airline|airport|travel|touris|\bvisa\b/i, '✈️'],
    [/cost of living|prices?\b|subsid|voucher|cash aid|rahmah|\baid\b/i, '🛒'], [/housing|property|\brent\b|homes?\b/i, '🏠'],
    [/climate|environment|emission|forest|wildlife/i, '🌱'], [/\bwar\b|military|missile|troops|ceasefire|attack|conflict/i, '🕊️']
  ];
  const TAB_ICON = { world: '🌏', my: '🇲🇾', market: '📊' };
  function topic(x, tab) {
    for (let k = 0; k < TOPICS.length; k++) if (TOPICS[k][0].test(x.title)) return TOPICS[k][1];
    return TAB_ICON[tab] || '📰';
  }

  /* ---------- fetching (kept on the phone for 20 minutes) ---------- */
  const LS = 'famfi.news.';
  const mem = {}, inflight = {};
  function stored(s) {
    if (mem[s]) return mem[s];
    try { const o = JSON.parse(root.localStorage.getItem(LS + s)); if (o && Array.isArray(o.items) && o.at > 0) return (mem[s] = o); } catch (e) { /* none */ }
    return null;
  }
  function store(s, items, at) {
    mem[s] = { at, items };
    try { root.localStorage.setItem(LS + s, JSON.stringify(mem[s])); } catch (e) { /* full: it just won't be kept */ }
  }
  async function fetchSource(s, fetchFn, now, force) {
    const src = SOURCES[s];
    const url = src.rss || R2J + encodeURIComponent(src.via);
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, WAIT);
    try {
      const r = await fetchFn(url, { signal: ctl ? ctl.signal : undefined, credentials: 'omit', cache: force ? 'no-cache' : 'default' });
      if (!r || !r.ok) throw new Error('http ' + (r && r.status));
      const raw = src.rss ? parseRSS(await r.text()) : parseR2J(await r.json());
      if (!raw.length) throw new Error('empty');
      const items = raw.map((x) => clean(x, s, now)).filter(Boolean);
      store(s, items, now);
      return items;
    } finally { clearTimeout(timer); }
  }
  const shown = (p, items, now) => items.filter((x) => x.at > now - MAX_AGE && (p.keep ? p.keep.test(x.title + ' ' + x.sum) : p.skip ? !p.skip.test(x.title + ' ' + x.sum) : true));
  /* what's on the phone already, straight away (maybe old) — for an instant first look */
  function peek(tab, now) {
    now = now || Date.now();
    const parts = TABS[tab] || [];
    let at = Infinity;
    const lists = parts.map((p) => { const c = stored(p.s); if (!c) return []; at = Math.min(at, c.at); return shown(p, c.items, now); });
    return { items: merge(lists), at: at === Infinity ? 0 : at, fresh: parts.every((p) => { const c = stored(p.s); return c && now - c.at < FRESH; }) };
  }
  /* a tab's stories: kept ones while fresh, otherwise asked for again (opts.force: always ask).
     Never throws — a source that fails is counted, and its last copy (if any) is used. */
  async function load(tab, opts) {
    opts = opts || {};
    const now = opts.now || Date.now(), fetchFn = opts.fetch || ((u, o) => root.fetch(u, o));
    const parts = TABS[tab] || [];
    let failed = 0, at = now;
    const lists = await Promise.all(parts.map(async (p) => {
      const c = stored(p.s);
      if (c && !opts.force && now - c.at < FRESH) { at = Math.min(at, c.at); return shown(p, c.items, now); }
      try {
        const job = inflight[p.s] || (inflight[p.s] = fetchSource(p.s, fetchFn, now, opts.force).finally(() => { delete inflight[p.s]; }));
        return shown(p, await job, now);
      } catch (e) {
        failed++;
        if (!c) return [];
        at = Math.min(at, c.at);
        return shown(p, c.items, now);
      }
    }));
    return { items: merge(lists), at, failed, total: parts.length };
  }
  const sourcesOf = (tab) => (TABS[tab] || []).map((p) => SOURCES[p.s].name).filter((n, i, a) => a.indexOf(n) === i);

  FF.news = { SOURCES, TABS, TAB_IDS, MY, FRESH, MAX_AGE, decode, text, parseRSS, parseR2J, clean, merge, topic, brand, peek, load, sourcesOf, _forget: () => { Object.keys(mem).forEach((k) => delete mem[k]); } };
})(typeof window !== 'undefined' ? window : this);
