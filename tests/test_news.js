/* FamFi — the News mailbox (news.js): feeds in the shapes the real newsrooms send them, a fake
   network, and the rules: plain text out whatever comes in, only real web links, nothing older
   than 3 days, no repeats, no long runs from one paper, Malaysia stories on the Malaysia tab,
   a source that fails doesn't empty the board, and nothing is fetched twice within 20 minutes.
   Run: node FamFi/tests/test_news.js        (V=1 to see every check) */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; if (process.env.V) console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

function phone(fetchImpl) {
  const mem = new Map();
  const ctx = { console, setTimeout, clearTimeout, Promise, localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) }, fetch: fetchImpl };
  ctx.window = ctx;
  vm.createContext(ctx);
  ['js/core.js', 'js/news.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  return { N: ctx.FF.news, store: mem };
}

/* ---------- feeds as the newsrooms really send them (shortened) ---------- */
const NOW = Date.parse('2026-10-08T02:00:00Z');
const cnaItem = (title, desc, when, img, slug) => '<item>\n  <title>' + title + '</title>\n  <link>https://www.channelnewsasia.com/asia/' + slug + '</link>\n    <description>' + desc + '</description>\n  <pubDate>' + when + '</pubDate>\n    <guid isPermaLink="false">https://www.channelnewsasia.com/asia/' + slug + '</guid>\n    <category>Asia</category>\n    <media:thumbnail url="' + img + '"/>\n</item>';
const CNA_ASIA = '<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>CNA</title><image><title>CNA logo</title><url>https://x/logo.png</url></image>' +
  cnaItem('All schools in Johor to close for two days amid worsening haze', 'Schools across Johor will shut on Thursday and Friday as air quality worsens, the state government said.', 'Thu, 08 Oct 2026 08:30:00 +0800', 'https://dam.mediacorp.sg/image/upload/johor.jpg?itok=a&amp;b=1', 'johor-haze-schools-1') +
  cnaItem('Bangkok braces for more flooding as Chao Phraya river rises', 'Residents in low-lying districts were told to move valuables to higher ground.', 'Thu, 08 Oct 2026 07:10:00 +0800', 'https://dam.mediacorp.sg/image/upload/bkk.jpg', 'bangkok-flood-2') +
  cnaItem('Indonesia haze: Hotspots surge in Riau as dry season drags on', 'Satellite data showed more than 300 hotspots.', 'Wed, 07 Oct 2026 21:00:00 +0800', 'https://dam.mediacorp.sg/image/upload/riau.jpg', 'riau-hotspots-3') +
  cnaItem('Old story that should not show', 'Too old.', 'Sat, 03 Oct 2026 08:00:00 +0800', 'https://dam.mediacorp.sg/x.jpg', 'old-4') +
  '</channel></rss>';
const CNA_WORLD = '<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>' + cnaItem('Evicted pensioner who sparked Spain housing protests dies: Tenant union', 'She was 85.', 'Thu, 08 Oct 2026 05:46:00 +0800', 'https://dam.mediacorp.sg/image/upload/spain.jpg', 'spain-5') + '</channel></rss>';
const MW = '<rss xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><item><title><![CDATA[Rising yields are quietly crashing the stock market&#x2019;s earlier winners]]></title><link>https://www.marketwatch.com/story/yields-1</link>' +
  '<description><![CDATA[<p>Investors are <b>dumping</b> last year&rsquo;s darlings &amp; buying cash.</p><script>alert(1)</script>]]></description><pubDate>Wed, 07 Oct 2026 22:32:00 GMT</pubDate>' +
  '<media:content url="https://images.mktw.net/clip.mp4" type="video/mp4"/><enclosure url="https://images.mktw.net/chart.jpg" type="image/jpeg" length="1"/></item>' +
  '<item><title>A sneaky link that must be dropped</title><link>javascript:alert(1)</link><description>x</description><pubDate>Wed, 07 Oct 2026 22:00:00 GMT</pubDate></item>' +
  '<item><title>Stocks rally to a record high as chip makers jump</title><link>http://www.marketwatch.com/story/rally-2</link><description>The S&amp;P 500 rose 1%.</description><pubDate>Wed, 07 Oct 2026 21:00:00 GMT</pubDate><media:thumbnail url="http://images.mktw.net/rally.jpg"/></item></channel></rss>';
const CNBC = '<rss><channel><item><title>Inflation fears on the rise as one-year outlook in Fed survey hits highest level since May</title><link>https://www.cnbc.com/2026/10/07/fed-survey.html</link><description>Consumers expect prices to keep rising.</description><pubDate>Wed, 07 Oct 2026 18:44:36 GMT</pubDate></item></channel></rss>';
const CNA_BIZ = '<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>' + cnaItem('Samsung Q3 profit jumps nearly nine-fold as AI memory boom lifts chip earnings', '', 'Thu, 08 Oct 2026 06:53:36 +0800', 'https://dam.mediacorp.sg/image/upload/samsung.jpg', 'samsung-6') + '</channel></rss>';
const r2j = (title, items) => JSON.stringify({ status: 'ok', feed: { title }, items });
const MM = r2j('Malay Mail - Malaysia', [
  { title: 'Minimum wage debate: What workers want, what employers say and what comes next', pubDate: '2026-10-07 23:00:00', link: 'https://www.malaymail.com/news/malaysia/2026/10/08/minimum-wage/1', thumbnail: 'https://www.malaymail.com/mw.jpg', description: '<p>KUALA LUMPUR, Oct 8 — The debate&#8230;</p>', enclosure: {} },
  { title: 'Haze: All Johor schools to close for two days starting tomorrow', pubDate: '2026-10-07 12:19:03', link: 'https://www.malaymail.com/news/malaysia/2026/10/07/haze-johor/2', thumbnail: '', description: 'JOHOR BAHRU, Oct 7 — All schools…', enclosure: { link: 'https://www.malaymail.com/haze.jpg', type: 'image/jpeg' } }
]);
const MM_MONEY = r2j('Malay Mail - Money', [{ title: 'Bursa Malaysia retreats as higher US yields and crude oil prices weigh on sentiment', pubDate: '2026-10-07 10:52:34', link: 'https://www.malaymail.com/news/money/2026/10/07/bursa/3', thumbnail: 'https://www.malaymail.com/bursa.jpg', description: 'KUALA LUMPUR, Oct 7 — Bursa Malaysia…', enclosure: {} }]);
const FMT = r2j('FMT', [{ title: 'RM100 book vouchers for students to be credited from next week, says ministry', pubDate: '2026-10-08 01:30:00', link: 'https://www.freemalaysiatoday.com/category/nation/2026/10/08/vouchers/', thumbnail: 'https://media.freemalaysiatoday.com/v.jpg', description: 'PETALING JAYA: Students will receive…', enclosure: {} }]);
const BBC = r2j('BBC News', [{ title: 'Israelis mourn 7 October attack victims three years after deadly Hamas raid', pubDate: '2026-10-07 20:27:03', link: 'https://www.bbc.com/news/articles/x1', thumbnail: 'https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/abc.jpg', description: 'Memorials were held across the country.', enclosure: {} }]);

/* ---------- a fake network: which URL answers what, and a log of every request ---------- */
function network(over) {
  const log = [], down = Object.assign({}, over && over.down);
  const fetchImpl = (url) => {
    log.push(url);
    const ans = (body, json) => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body), json: () => Promise.resolve(JSON.parse(body)) });
    const r2 = url.indexOf('api.rss2json.com') !== -1 ? decodeURIComponent(url.split('rss_url=')[1]) : '';
    const key = r2 || url;
    if (Object.keys(down).some((d) => (url + ' ' + key).indexOf(d) !== -1)) return Promise.resolve({ ok: false, status: 503 });
    if (key.indexOf('category=6511') !== -1) return ans(CNA_ASIA);
    if (key.indexOf('category=6311') !== -1) return ans(CNA_WORLD);
    if (key.indexOf('category=6936') !== -1) return ans(CNA_BIZ);
    if (key.indexOf('dowjones') !== -1) return ans(MW);
    if (key.indexOf('cnbc') !== -1) return ans(CNBC);
    if (key.indexOf('malaymail.com/feed/rss/malaysia') !== -1) return ans(MM);
    if (key.indexOf('malaymail.com/feed/rss/money') !== -1) return ans(MM_MONEY);
    if (key.indexOf('freemalaysiatoday') !== -1) return ans(FMT);
    if (key.indexOf('bbci') !== -1) return ans(BBC);
    return Promise.resolve({ ok: false, status: 404 });
  };
  return { fetchImpl, log, down };
}

async function main() {
  console.log('1. reading feeds: plain words out, whatever comes in');
  {
    const { N } = phone(() => Promise.reject(new Error('no network')));
    const cna = N.parseRSS(CNA_ASIA);
    ok(cna.length === 4 && cna[0].title === 'All schools in Johor to close for two days amid worsening haze', 'CNA: every story read (and the channel logo isn’t one)');
    ok(cna[0].url === 'https://www.channelnewsasia.com/asia/johor-haze-schools-1' && cna[0].at === Date.parse('2026-10-08T00:30:00Z'), 'CNA: link and time (Malaysia time, +0800) read right');
    ok(cna[0].img === 'https://dam.mediacorp.sg/image/upload/johor.jpg?itok=a&b=1', 'CNA: the photo, with &amp; decoded in its address');
    const mw = N.parseRSS(MW);
    ok(mw[0].title === 'Rising yields are quietly crashing the stock market’s earlier winners', 'CDATA unwrapped, &#x2019; becomes ’');
    ok(mw[0].sum === 'Investors are dumping last year’s darlings & buying cash.', 'HTML and a <script> in a summary become plain words');
    ok(mw[0].img === 'https://images.mktw.net/chart.jpg', 'a video attachment is skipped for the photo; the image one is used');
    const raw = N.parseR2J(JSON.parse(MM));
    ok(raw.length === 2 && raw[0].at === Date.parse('2026-10-07T23:00:00Z') && raw[0].sum === 'KUALA LUMPUR, Oct 8 — The debate…', 'rss2json: time is UTC (7 am in KL), summary as plain words');
    ok(raw[1].img === 'https://www.malaymail.com/haze.jpg', 'rss2json: a photo from the attachment when there’s no thumbnail');
    ok(N.parseR2J({ status: 'error', message: 'quota' }).length === 0 && N.parseR2J(null).length === 0 && N.parseRSS('<html>Not a feed</html>').length === 0, 'an error page or junk gives no stories (never a crash)');
  }

  console.log('2. what gets shown');
  {
    const { N } = phone(() => Promise.reject(new Error('no network')));
    const mw = N.parseRSS(MW).map((x) => N.clean(x, 'mw', NOW));
    ok(mw[1] === null, 'a javascript: link is never shown');
    ok(mw[2] && mw[2].url === 'http://www.marketwatch.com/story/rally-2' && mw[2].img === 'https://images.mktw.net/rally.jpg', 'an http photo is fetched over https');
    const cna = N.parseRSS(CNA_ASIA).map((x) => N.clean(x, 'cnaAsia', NOW));
    ok(cna[3] === null, 'a story older than 3 days isn’t shown');
    ok(N.clean({ title: 'From the future', url: 'https://a.b/c', at: NOW + 5 * 36e5 }, 'mw', NOW) === null && N.clean({ title: 'Short', url: 'https://a.b/c', at: NOW }, 'mw', NOW) === null, 'no stories from the future or with no real headline');
    const bbc = N.clean(N.parseR2J(JSON.parse(BBC))[0], 'bbc', NOW);
    ok(bbc.img === 'https://ichef.bbci.co.uk/ace/standard/480/cpsprodpb/abc.jpg', 'the BBC’s tiny feed photo is swapped for a sharper size');
    ok(typeof cna[0].id === 'string' && cna[0].id === N.clean(N.parseRSS(CNA_ASIA)[0], 'cnaAsia', NOW).id, 'a story keeps the same id every time');
    const long = N.clean({ title: 'A headline long enough', url: 'https://a.b/c', at: NOW, sum: 'word '.repeat(120) }, 'mw', NOW);
    ok(long.sum.length <= 301 && /…$/.test(long.sum), 'a long summary is cut at a word, with …');
    ok(N.MY.test('All schools in Johor to close') && N.MY.test('Anwar unveils Budget') && !N.MY.test('Bangkok braces for more flooding') && !N.MY.test('Indonesia haze hotspots'), 'Malaysia stories are told apart (Johor, Anwar: yes; Bangkok, Riau: no)');
    ok(N.topic({ title: 'Bangkok braces for more flooding' }, 'world') === '🌊' && N.topic({ title: 'Indonesia haze: hotspots surge' }, 'world') === '🌫️', 'a flood gets 🌊, haze 🌫️');
    ok(N.topic({ title: 'Bursa Malaysia retreats as higher US yields weigh' }, 'market') === '📉' && N.topic({ title: 'Stocks rally to a record high' }, 'market') === '📈', 'markets down 📉, up 📈');
    ok(N.topic({ title: 'Something else entirely happened' }, 'my') === '🇲🇾', 'otherwise the tab’s own picture');
  }

  console.log('3. one board from several newsrooms');
  {
    const { N } = phone(() => Promise.reject(new Error('no network')));
    const mk = (src, n, t0) => Array.from({ length: n }, (_, k) => ({ id: src + k, title: 'Story number ' + k + ' from ' + src, url: 'https://' + src + '.example/' + k, at: t0 - k * 6e4, src, sum: '', img: '' }));
    const board = N.merge([mk('cnaWorld', 8, NOW), mk('bbc', 3, NOW - 30e3)]);
    let run = 1, worst = 1;
    for (let k = 1; k < board.length; k++) { run = N.brand(board[k]) === N.brand(board[k - 1]) ? run + 1 : 1; worst = Math.max(worst, run); }
    ok(board.length === 11, 'every story kept');
    ok(board.slice(0, 7).filter((x) => x.src === 'bbc').length === 3, 'a paper with fewer stories still gets near the top');
    const dup = N.merge([[{ id: 'a', title: 'Haze: All Johor schools to close', url: 'https://x/1', at: NOW, src: 'mm' }], [{ id: 'b', title: 'Haze — all Johor schools to close!', url: 'https://y/2', at: NOW - 1, src: 'fmt' }, { id: 'c', title: 'Same link', url: 'https://x/1', at: NOW - 2, src: 'fmt' }]]);
    ok(dup.length === 1, 'the same story from two papers (or the same link twice) shows once');
    const two = N.merge([[{ id: 'a', title: 'All schools in Johor to close for two days amid worsening haze', url: 'https://cna/1', at: NOW, src: 'cnaAsia' }], [{ id: 'b', title: 'Haze: All Johor schools to close for two days starting tomorrow', url: 'https://mm/2', at: NOW - 1, src: 'mm' }, { id: 'c', title: 'Johor floods: two days of heavy rain close roads in Muar', url: 'https://mm/3', at: NOW - 2, src: 'mm' }]]);
    ok(two.length === 2 && two[0].id === 'a' && two[1].id === 'c', 'the same event in different words shows once — a different Johor story still shows');
    const spain = N.merge([[{ id: 'a', title: 'Evicted pensioner who sparked Spain housing protests dies: Tenant union', url: 'https://cna/9', at: NOW, src: 'cnaWorld' }], [{ id: 'b', title: 'Spanish pensioner whose eviction sparked nationwide protests dies, union says', url: 'https://bbc/9', at: NOW - 1, src: 'bbc' }]]);
    ok(spain.length === 1, 'CNA’s and the BBC’s reports on the same event (evicted / eviction) show once');
    ok(N.MY.test('Commentary: UMNO’s dark September') && !N.MY.test('French PM denies police ordered to confront student protesters'), 'a story about UMNO is a Malaysia story');
    ok(N.merge([mk('cnaWorld', 60, NOW)]).length === 30, 'at most 30 stories a tab');
    const sorted = N.merge([mk('mw', 3, NOW - 1e6), mk('cnbc', 3, NOW)]);
    ok(sorted[0].src === 'cnbc' && sorted[0].at === NOW, 'newest first');
  }

  console.log('4. fetching: the tab you open, kept 20 minutes, a failing source doesn’t empty it');
  {
    const net = network();
    const { N, store } = phone(net.fetchImpl);
    let r = await N.load('world', { now: NOW });
    ok(r.failed === 0 && r.total === 3, 'World: CNA World, CNA Asia and BBC all answered');
    ok(r.items.some((x) => /Bangkok/.test(x.title)) && r.items.some((x) => /Spain/.test(x.title)) && r.items.some((x) => /Israelis/.test(x.title)), 'World shows Bangkok floods, Spain and the BBC story');
    ok(!r.items.some((x) => /Johor/.test(x.title)), 'the Johor story isn’t on the World tab…');
    ok(net.log.filter((u) => u.indexOf('rss2json') !== -1).length === 1 && net.log.some((u) => u.indexOf('channelnewsasia.com') !== -1 && u.indexOf('rss2json') === -1), 'CNA is read directly; only the BBC goes through rss2json');
    const before = net.log.length;
    r = await N.load('my', { now: NOW + 60e3 });
    ok(r.items.some((x) => /Johor/.test(x.title)) && r.items.some((x) => /vouchers/.test(x.title)) && r.items.some((x) => /Minimum wage/.test(x.title)), '…it’s on the Malaysia tab, with Malay Mail and FMT');
    ok(r.items.filter((x) => /Johor/i.test(x.title)).length === 1, 'CNA’s and Malay Mail’s Johor haze stories show once');
    ok(!net.log.slice(before).some((u) => u.indexOf('category=6511') !== -1), 'CNA Asia isn’t fetched again for the Malaysia tab (kept from a minute ago)');
    ok(store.has('famfi.news.cnaAsia') && JSON.parse(store.get('famfi.news.cnaAsia')).items.length === 3, 'feeds are kept on the phone');
    const n0 = net.log.length;
    await N.load('world', { now: NOW + 10 * 60e3 });
    ok(net.log.length === n0, 'opening World again within 20 minutes fetches nothing');
    await N.load('world', { now: NOW + 10 * 60e3, force: true });
    ok(net.log.length === n0 + 3, 'the refresh button asks every World newsroom again');
    await N.load('world', { now: NOW + 25 * 60e3 });
    ok(net.log.length === n0 + 3, '…and that resets the 20 minutes');
    await N.load('world', { now: NOW + 31 * 60e3 });
    ok(net.log.length === n0 + 6, 'after 20 minutes, opening it asks again');
    const pk = N.peek('market', NOW);
    ok(pk.items.length === 0 && !pk.fresh, 'a tab never opened has nothing kept');
    r = await N.load('market', { now: NOW });
    ok(r.items.length === 5 && r.items.some((x) => /Bursa/.test(x.title)) && r.items.some((x) => /Samsung/.test(x.title)) && r.items.some((x) => /Inflation/.test(x.title)), 'Markets: Malay Mail Money (Bursa), CNA Business, MarketWatch and CNBC');
    ok(N.peek('market', NOW + 60e3).items.length === 5 && N.peek('market', NOW + 60e3).fresh, '…and the next look is instant, from the phone');
  }
  {
    const net = network({ down: { 'rss2json': 1 } });
    const { N } = phone(net.fetchImpl);
    const r = await N.load('my', { now: NOW });
    ok(r.failed === 2 && r.total === 3 && r.items.length === 1 && /Johor/.test(r.items[0].title), 'rss2json down: Malaysia still shows CNA’s Malaysia stories');
    const net2 = network({ down: { 'channelnewsasia': 1, 'rss2json': 1 } });
    const p2 = phone(net2.fetchImpl);
    const r2 = await p2.N.load('world', { now: NOW });
    ok(r2.failed === 3 && r2.items.length === 0, 'everything down: nothing shown, no crash (the screen says so)');
  }
  {
    const net = network();
    const { N } = phone(net.fetchImpl);
    await N.load('world', { now: NOW });
    const net2 = network({ down: { 'channelnewsasia': 1, 'rss2json': 1 } });
    const p = phone(net.fetchImpl);
    await p.N.load('world', { now: NOW });
    // same phone, the network goes away 30 minutes later: the stories it had stay up
    const cached = phone(net2.fetchImpl);
    p.store.forEach((v, k) => cached.store.set(k, v));
    const r = await cached.N.load('world', { now: NOW + 30 * 60e3 });
    ok(r.failed === 3 && r.items.length === 4 && r.at === NOW, 'offline later: all 4 stories it had stay up, with the time they were fetched');
  }
  {
    // two tabs opened at once share the CNA Asia request
    const net = network();
    const { N } = phone(net.fetchImpl);
    await Promise.all([N.load('world', { now: NOW }), N.load('my', { now: NOW })]);
    ok(net.log.filter((u) => u.indexOf('category=6511') !== -1).length === 1, 'two tabs at once: CNA Asia is fetched once');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
