/* ============================================================
   FamFi — data.js
   Market catalogue (US stocks & ETFs + crypto; any other US stock
   can be added through live search), FX, and a deterministic seeded
   price history used until real prices arrive (the UI says so).
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;

  /* value of 1 unit of each currency in MYR. Starts as demo rates; market.js swaps in
     live rates (European Central Bank) as soon as they arrive. */
  const FX = { MYR: 1, USD: 4.21, SGD: 3.27, THB: 0.1305 };
  // no longer offered (nobody used them) — kept only so any old record still converts
  const RETIRED = { HKD: 0.541, CNY: 0.592 };
  const fxInfo = { live: false, src: 'demo', date: null };
  const DISPLAY_CURRENCIES = ['MYR', 'USD', 'SGD', 'THB'];
  /* daily history (European Central Bank, working days, forward-filled): FXH[c][day - d0] = MYR per unit */
  let FXH = null;
  function myrPer(c, day) {
    if (c === 'MYR') return 1;
    if (day != null && FXH && FXH.rates[c] && day < FXH.last) return FXH.rates[c][Math.max(0, day - FXH.d0)];
    return FX[c] || RETIRED[c] || 1;
  }
  /* rate to turn 1 unit of `from` into `to` — on a given day if `day` is passed (else today's) */
  const fx = (from, to, day) => (from === to ? 1 : myrPer(from, day) / myrPer(to, day));
  function setFX(perMYR, info) { // perMYR[c] = units of c for 1 MYR
    Object.keys(perMYR).forEach((c) => { if (perMYR[c] > 0 && FX[c] != null) FX[c] = 1 / perMYR[c]; });
    Object.assign(fxInfo, { live: true }, info || {});
  }
  /* series: [[day, {USD: 0.24, …}], …] sorted, values = units per 1 MYR */
  function setFXHistory(series) {
    if (!series || !series.length) { FXH = null; return; }
    const d0 = series[0][0], last = series[series.length - 1][0];
    const rates = {};
    Object.keys(FX).forEach((c) => { if (c !== 'MYR') rates[c] = new Float64Array(last - d0 + 1); });
    let k = 0, cur = series[0][1];
    for (let d = d0; d <= last; d++) {
      while (k < series.length && series[k][0] <= d) { cur = series[k][1]; k++; }
      Object.keys(rates).forEach((c) => { rates[c][d - d0] = cur[c] > 0 ? 1 / cur[c] : (FX[c] || 1); });
    }
    FXH = { d0, last, rates };
  }

  /* asset types & sectors (keys are translated in i18n) */
  const TYPES = ['stock', 'etf', 'crypto'];
  const SECTORS = ['banks', 'tech', 'energy', 'utilities', 'health', 'consumer', 'telecom', 'property', 'broad', 'bonds', 'gold', 'transport', 'crypto', 'other'];

  // daily drift / volatility defaults per kind
  const KIND = {
    stock: { mu: 0.00028, v: 0.014 },
    etf: { mu: 0.00032, v: 0.009 },
    crypto: { mu: 0.0007, v: 0.034 },
    bond: { mu: 0.00008, v: 0.0028 },
    gold: { mu: 0.00035, v: 0.009 }
  };

  /*  s: symbol  n: name  t: type  sec: sector  c: currency  x: market
      p: price at anchor  k: volatility kind  vm: vol multiplier
      dv: dividend {y: yield, m: pay months, d: pay day}
      al: search aliases (incl. Chinese / Thai)  nz/nt: localized names */
  const ASSETS = [
    // ---- US stocks ----
    { s: 'AAPL', n: 'Apple', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 333.69, dv: { y: 0.003, m: [2, 5, 8, 11], d: 14 }, al: ['苹果', 'แอปเปิล', 'iphone'], nz: '苹果', nt: 'แอปเปิล' },
    { s: 'MSFT', n: 'Microsoft', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 517.53, dv: { y: 0.0065, m: [3, 6, 9, 12], d: 12 }, al: ['微软', 'ไมโครซอฟท์'], nz: '微软', nt: 'ไมโครซอฟท์' },
    { s: 'NVDA', n: 'NVIDIA', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 233.95, vm: 1.9, al: ['英伟达', 'เอ็นวิเดีย'], nz: '英伟达', nt: 'เอ็นวิเดีย' },
    { s: 'GOOGL', n: 'Alphabet (Google)', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 343.5, vm: 1.2, dv: { y: 0.0025, m: [3, 6, 9, 12], d: 16 }, al: ['google', '谷歌', 'กูเกิล'], nz: '谷歌', nt: 'กูเกิล' },
    { s: 'AMZN', n: 'Amazon', t: 'stock', sec: 'consumer', c: 'USD', x: 'NASDAQ', p: 251.52, vm: 1.3, al: ['亚马逊', 'อเมซอน'], nz: '亚马逊', nt: 'อเมซอน' },
    { s: 'META', n: 'Meta Platforms', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 728.08, vm: 1.5, dv: { y: 0.003, m: [3, 6, 9, 12], d: 26 }, al: ['facebook', 'instagram', '脸书', 'เฟซบุ๊ก'] },
    { s: 'TSLA', n: 'Tesla', t: 'stock', sec: 'consumer', c: 'USD', x: 'NASDAQ', p: 370.59, vm: 2.4, al: ['特斯拉', 'เทสลา'], nz: '特斯拉', nt: 'เทสลา' },
    { s: 'AMD', n: 'Advanced Micro Devices', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 633.91, vm: 2.0, al: ['超威', 'เอเอ็มดี'], nz: '超威半导体' },
    { s: 'AVGO', n: 'Broadcom', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 355.14, vm: 1.6, dv: { y: 0.007, m: [3, 6, 9, 12], d: 30 }, al: ['博通', 'บรอดคอม'], nz: '博通' },
    { s: 'NFLX', n: 'Netflix', t: 'stock', sec: 'consumer', c: 'USD', x: 'NASDAQ', p: 67.06, vm: 1.6, al: ['网飞', 'เน็ตฟลิกซ์'], nz: '网飞', nt: 'เน็ตฟลิกซ์' },
    { s: 'COST', n: 'Costco', t: 'stock', sec: 'consumer', c: 'USD', x: 'NASDAQ', p: 920.65, vm: 0.8, dv: { y: 0.005, m: [2, 5, 8, 11], d: 14 }, al: ['好市多', 'คอสต์โก'], nz: '好市多' },
    { s: 'KO', n: 'Coca-Cola', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 85.65, vm: 0.6, dv: { y: 0.025, m: [4, 7, 10, 12], d: 1 }, al: ['coke', '可口可乐', 'โคคา'], nz: '可口可乐', nt: 'โคคา-โคล่า' },
    { s: 'PEP', n: 'PepsiCo', t: 'stock', sec: 'consumer', c: 'USD', x: 'NASDAQ', p: 125.89, vm: 0.6, dv: { y: 0.042, m: [1, 3, 6, 9], d: 30 }, al: ['pepsi', '百事', 'เป๊ปซี่'], nz: '百事' },
    { s: 'PG', n: 'Procter & Gamble', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 144.91, vm: 0.5, dv: { y: 0.028, m: [2, 5, 8, 11], d: 15 }, al: ['p&g', '宝洁', 'พีแอนด์จี'], nz: '宝洁' },
    { s: 'MCD', n: "McDonald's", t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 231.89, vm: 0.6, dv: { y: 0.03, m: [3, 6, 9, 12], d: 16 }, al: ['mcdonalds', '麦当劳', 'แมคโดนัลด์'], nz: '麦当劳', nt: 'แมคโดนัลด์' },
    { s: 'WMT', n: 'Walmart', t: 'stock', sec: 'consumer', c: 'USD', x: 'NASDAQ', p: 104.26, vm: 0.7, dv: { y: 0.009, m: [1, 4, 5, 9], d: 2 }, al: ['沃尔玛', 'วอลมาร์ต'], nz: '沃尔玛' },
    { s: 'DIS', n: 'Walt Disney', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 102.19, vm: 1.1, dv: { y: 0.01, m: [1, 7], d: 15 }, al: ['disney', '迪士尼', 'ดิสนีย์'], nz: '迪士尼', nt: 'ดิสนีย์' },
    { s: 'HD', n: 'Home Depot', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 282.85, vm: 0.8, dv: { y: 0.03, m: [3, 6, 9, 12], d: 18 }, al: ['家得宝'] },
    { s: 'JNJ', n: 'Johnson & Johnson', t: 'stock', sec: 'health', c: 'USD', x: 'NYSE', p: 256.03, vm: 0.6, dv: { y: 0.021, m: [3, 6, 9, 12], d: 9 }, al: ['强生', 'จอห์นสัน'], nz: '强生' },
    { s: 'UNH', n: 'UnitedHealth Group', t: 'stock', sec: 'health', c: 'USD', x: 'NYSE', p: 371.9, vm: 1.1, dv: { y: 0.024, m: [3, 6, 9, 12], d: 23 }, al: ['联合健康'] },
    { s: 'JPM', n: 'JPMorgan Chase', t: 'stock', sec: 'banks', c: 'USD', x: 'NYSE', p: 332.38, dv: { y: 0.018, m: [1, 4, 7, 10], d: 28 }, al: ['摩根大通', 'เจพีมอร์แกน'], nz: '摩根大通' },
    { s: 'V', n: 'Visa', t: 'stock', sec: 'banks', c: 'USD', x: 'NYSE', p: 360.66, vm: 0.8, dv: { y: 0.0075, m: [3, 6, 9, 12], d: 2 }, al: ['维萨', 'วีซ่า'] },
    { s: 'MA', n: 'Mastercard', t: 'stock', sec: 'banks', c: 'USD', x: 'NYSE', p: 552.26, vm: 0.8, dv: { y: 0.006, m: [2, 5, 8, 11], d: 9 }, al: ['万事达', 'มาสเตอร์การ์ด'] },
    { s: 'BRK.B', n: 'Berkshire Hathaway', t: 'stock', sec: 'banks', c: 'USD', x: 'NYSE', p: 502.65, vm: 0.6, al: ['berkshire', 'buffett', '伯克希尔', '巴菲特', 'บัฟเฟตต์'], nz: '伯克希尔·哈撒韦' },
    { s: 'XOM', n: 'Exxon Mobil', t: 'stock', sec: 'energy', c: 'USD', x: 'NYSE', p: 164.01, vm: 0.9, dv: { y: 0.028, m: [3, 6, 9, 12], d: 10 }, al: ['exxon', '埃克森美孚'] },
    { s: 'O', n: 'Realty Income', t: 'stock', sec: 'property', c: 'USD', x: 'NYSE', p: 54.13, vm: 0.7, dv: { y: 0.06, m: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], d: 15 }, al: ['monthly', 'reit', '房地产'] },
    // ---- US ETFs ----
    { s: 'VOO', n: 'Vanguard S&P 500 ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 707.54, dv: { y: 0.012, m: [3, 6, 9, 12], d: 27 }, al: ['s&p', 'sp500', '标普', '标普500', 'เอสแอนด์พี'], nz: '先锋标普500 ETF' },
    { s: 'SPY', n: 'SPDR S&P 500 ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 769.64, dv: { y: 0.012, m: [1, 4, 7, 10], d: 31 }, al: ['s&p', 'sp500', '标普'] },
    { s: 'VTI', n: 'Vanguard Total Stock Market ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 377.99, dv: { y: 0.012, m: [3, 6, 9, 12], d: 27 }, al: ['total market', '美国全市场', 'ทั้งตลาด'] },
    { s: 'VT', n: 'Vanguard Total World Stock ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 159.13, dv: { y: 0.018, m: [3, 6, 9, 12], d: 24 }, al: ['world', '全球', 'ทั่วโลก'], nz: '先锋全球股票 ETF' },
    { s: 'QQQ', n: 'Invesco QQQ (Nasdaq-100)', t: 'etf', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 749.58, vm: 1.4, dv: { y: 0.005, m: [3, 6, 9, 12], d: 30 }, al: ['nasdaq', '纳斯达克', 'แนสแด็ก'] },
    { s: 'SCHD', n: 'Schwab US Dividend Equity ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 32.72, dv: { y: 0.036, m: [3, 6, 9, 12], d: 25 }, al: ['dividend', '股息', 'ปันผล'] },
    { s: 'VYM', n: 'Vanguard High Dividend Yield ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 156.46, dv: { y: 0.026, m: [3, 6, 9, 12], d: 24 }, al: ['high dividend', '高股息', 'ปันผลสูง'] },
    { s: 'VNQ', n: 'Vanguard Real Estate ETF', t: 'etf', sec: 'property', c: 'USD', x: 'NYSE Arca', p: 89.5, dv: { y: 0.038, m: [3, 6, 9, 12], d: 26 }, al: ['reit', 'real estate', '房地产', 'อสังหา'] },
    { s: 'BND', n: 'Vanguard Total Bond ETF', t: 'etf', sec: 'bonds', c: 'USD', x: 'NASDAQ', p: 69.94, k: 'bond', dv: { y: 0.037, m: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], d: 5 }, al: ['bond', '债券', 'พันธบัตร'] },
    { s: 'GLD', n: 'SPDR Gold Shares', t: 'etf', sec: 'gold', c: 'USD', x: 'NYSE Arca', p: 380.14, k: 'gold', al: ['gold', '黄金', 'ทองคำ'] },
    // ---- more US stocks & ETFs (prices as of 2 Oct 2026) ----
    { s: 'RDDT', n: 'Reddit', t: 'stock', sec: 'tech', c: 'USD', x: 'NYSE', p: 147.86, vm: 2.2, al: ['reddit', '红迪', 'เรดดิต'], nt: 'เรดดิต' },
    { s: 'SPCX', n: 'SpaceX (Space Exploration Technologies)', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 158.96, vm: 2.2, al: ['spacex', 'space x', 'starlink', '太空探索', '星链', 'สเปซเอ็กซ์', 'สตาร์ลิงก์'], nz: 'SpaceX 太空探索', nt: 'สเปซเอ็กซ์' },
    { s: 'MU', n: 'Micron Technology', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 1074.89, vm: 2.0, dv: { y: 0.002, m: [1, 4, 7, 10], d: 15 }, al: ['micron', 'memory', 'dram', 'hbm', '美光', 'ไมครอน'], nz: '美光科技', nt: 'ไมครอน' },
    { s: 'INTC', n: 'Intel', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 119.33, vm: 1.8, al: ['英特尔', 'อินเทล'], nz: '英特尔', nt: 'อินเทล' },
    { s: 'TSM', n: 'Taiwan Semiconductor (TSMC)', t: 'stock', sec: 'tech', c: 'USD', x: 'NYSE', p: 472.78, vm: 1.5, dv: { y: 0.01, m: [1, 4, 7, 10], d: 10 }, al: ['tsmc', 'taiwan semiconductor', '台积电', '台積電', 'ทีเอสเอ็มซี'], nz: '台积电', nt: 'ทีเอสเอ็มซี' },
    { s: 'ARM', n: 'Arm Holdings', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 307.49, vm: 2.2, al: ['arm', '安谋', 'อาร์ม'] },
    { s: 'QCOM', n: 'Qualcomm', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 184.87, vm: 1.4, dv: { y: 0.021, m: [3, 6, 9, 12], d: 25 }, al: ['高通', 'ควอลคอมม์'], nz: '高通' },
    { s: 'ASML', n: 'ASML Holding', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 1867.31, vm: 1.5, al: ['阿斯麦', 'เอเอสเอ็มแอล'], nz: '阿斯麦' },
    { s: 'ORCL', n: 'Oracle', t: 'stock', sec: 'tech', c: 'USD', x: 'NYSE', p: 142.3, vm: 1.6, dv: { y: 0.008, m: [1, 4, 7, 10], d: 23 }, al: ['甲骨文', 'ออราเคิล'], nz: '甲骨文' },
    { s: 'CRM', n: 'Salesforce', t: 'stock', sec: 'tech', c: 'USD', x: 'NYSE', p: 234.69, vm: 1.3, al: ['赛富时', 'เซลส์ฟอร์ซ'], nz: '赛富时' },
    { s: 'ADBE', n: 'Adobe', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 237.69, vm: 1.3, al: ['photoshop', '奥多比', 'อะโดบี'], nz: '奥多比' },
    { s: 'PLTR', n: 'Palantir', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 188.75, vm: 2.6, al: ['palantir', '帕兰提尔', 'พาแลนเทียร์'] },
    { s: 'CRWD', n: 'CrowdStrike', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 270.04, vm: 1.8, al: ['crowdstrike', '网络安全', 'cybersecurity'] },
    { s: 'SNOW', n: 'Snowflake', t: 'stock', sec: 'tech', c: 'USD', x: 'NYSE', p: 341.04, vm: 2.0, al: ['snowflake', '雪花'] },
    { s: 'SHOP', n: 'Shopify', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 151.39, vm: 2.0, al: ['shopify', 'ช้อปปิฟาย'] },
    { s: 'MSTR', n: 'Strategy (MicroStrategy)', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 160.01, vm: 3.2, al: ['microstrategy', 'strategy', '微策略'] },
    { s: 'SMCI', n: 'Super Micro Computer', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 43.69, vm: 2.8, al: ['supermicro', '超微电脑'], nz: '超微电脑' },
    { s: 'DELL', n: 'Dell Technologies', t: 'stock', sec: 'tech', c: 'USD', x: 'NYSE', p: 562.52, vm: 1.6, al: ['戴尔', 'เดลล์'], nz: '戴尔' },
    { s: 'IBM', n: 'IBM', t: 'stock', sec: 'tech', c: 'USD', x: 'NYSE', p: 222.64, vm: 1.0, dv: { y: 0.026, m: [3, 6, 9, 12], d: 10 }, al: ['国际商业机器', 'ไอบีเอ็ม'] },
    { s: 'CSCO', n: 'Cisco Systems', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 112.2, vm: 0.9, dv: { y: 0.025, m: [1, 4, 7, 10], d: 22 }, al: ['cisco', '思科', 'ซิสโก้'], nz: '思科' },
    { s: 'UBER', n: 'Uber', t: 'stock', sec: 'transport', c: 'USD', x: 'NYSE', p: 68.11, vm: 1.6, al: ['优步', 'อูเบอร์'], nz: '优步', nt: 'อูเบอร์' },
    { s: 'ABNB', n: 'Airbnb', t: 'stock', sec: 'consumer', c: 'USD', x: 'NASDAQ', p: 162.43, vm: 1.6, al: ['爱彼迎', 'แอร์บีเอ็นบี'], nz: '爱彼迎' },
    { s: 'SPOT', n: 'Spotify', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 472.89, vm: 1.7, al: ['spotify', '声田', 'สปอติฟาย'] },
    { s: 'RBLX', n: 'Roblox', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 44.12, vm: 2.2, al: ['roblox', '罗布乐思', 'โรบล็อกซ์'] },
    { s: 'BABA', n: 'Alibaba', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 105.85, vm: 1.8, al: ['阿里巴巴', 'taobao', '淘宝', 'อาลีบาบา'], nz: '阿里巴巴', nt: 'อาลีบาบา' },
    { s: 'PDD', n: 'PDD Holdings (Temu, Pinduoduo)', t: 'stock', sec: 'consumer', c: 'USD', x: 'NASDAQ', p: 75.38, vm: 2.0, al: ['temu', 'pinduoduo', '拼多多', 'เทมู'], nz: '拼多多' },
    { s: 'JD', n: 'JD.com', t: 'stock', sec: 'consumer', c: 'USD', x: 'NASDAQ', p: 25.78, vm: 1.7, al: ['京东', 'jingdong'], nz: '京东' },
    { s: 'BIDU', n: 'Baidu', t: 'stock', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 84.32, vm: 1.7, al: ['百度', 'ไป่ตู้'], nz: '百度' },
    { s: 'NIO', n: 'NIO', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 3.37, vm: 3.0, al: ['蔚来', 'นีโอ'], nz: '蔚来' },
    { s: 'SE', n: 'Sea Limited (Shopee, Garena)', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 95.19, vm: 2.0, al: ['shopee', 'garena', 'sea', '冬海', 'ช้อปปี้'], nz: '冬海集团 (Shopee)', nt: 'ซี (ช้อปปี้)' },
    { s: 'GRAB', n: 'Grab Holdings', t: 'stock', sec: 'transport', c: 'USD', x: 'NASDAQ', p: 3.08, vm: 2.0, al: ['grab', '格步', 'แกร็บ'], nt: 'แกร็บ' },
    { s: 'PYPL', n: 'PayPal', t: 'stock', sec: 'banks', c: 'USD', x: 'NASDAQ', p: 52.8, vm: 1.6, al: ['paypal', '贝宝', 'เพย์พาล'], nz: '贝宝' },
    { s: 'COIN', n: 'Coinbase', t: 'stock', sec: 'banks', c: 'USD', x: 'NASDAQ', p: 183, vm: 3.0, al: ['coinbase', 'คอยน์เบส'] },
    { s: 'HOOD', n: 'Robinhood Markets', t: 'stock', sec: 'banks', c: 'USD', x: 'NASDAQ', p: 112.74, vm: 3.0, al: ['robinhood', 'โรบินฮู้ด'] },
    { s: 'SOFI', n: 'SoFi Technologies', t: 'stock', sec: 'banks', c: 'USD', x: 'NASDAQ', p: 15.77, vm: 2.6, al: ['sofi'] },
    { s: 'BAC', n: 'Bank of America', t: 'stock', sec: 'banks', c: 'USD', x: 'NYSE', p: 53.75, vm: 1.1, dv: { y: 0.023, m: [3, 6, 9, 12], d: 27 }, al: ['美国银行', 'แบงก์ออฟอเมริกา'], nz: '美国银行' },
    { s: 'GS', n: 'Goldman Sachs', t: 'stock', sec: 'banks', c: 'USD', x: 'NYSE', p: 902.56, vm: 1.2, dv: { y: 0.018, m: [3, 6, 9, 12], d: 28 }, al: ['高盛', 'โกลด์แมน'], nz: '高盛' },
    { s: 'AXP', n: 'American Express', t: 'stock', sec: 'banks', c: 'USD', x: 'NYSE', p: 302.78, vm: 1.1, dv: { y: 0.01, m: [2, 5, 8, 11], d: 10 }, al: ['amex', '美国运通', 'อเมริกันเอ็กซ์เพรส'], nz: '美国运通' },
    { s: 'NKE', n: 'Nike', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 33.87, vm: 1.3, dv: { y: 0.02, m: [1, 4, 7, 10], d: 1 }, al: ['耐克', 'ไนกี้'], nz: '耐克', nt: 'ไนกี้' },
    { s: 'SBUX', n: 'Starbucks', t: 'stock', sec: 'consumer', c: 'USD', x: 'NASDAQ', p: 94.71, vm: 1.1, dv: { y: 0.028, m: [2, 5, 8, 11], d: 28 }, al: ['星巴克', 'สตาร์บัคส์'], nz: '星巴克', nt: 'สตาร์บัคส์' },
    { s: 'TM', n: 'Toyota Motor', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 181.49, vm: 0.9, al: ['toyota', '丰田', 'โตโยต้า'], nz: '丰田汽车', nt: 'โตโยต้า' },
    { s: 'F', n: 'Ford Motor', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 12.1, vm: 1.3, dv: { y: 0.05, m: [3, 6, 9, 12], d: 1 }, al: ['ford', '福特', 'ฟอร์ด'], nz: '福特汽车', nt: 'ฟอร์ด' },
    { s: 'GM', n: 'General Motors', t: 'stock', sec: 'consumer', c: 'USD', x: 'NYSE', p: 78.27, vm: 1.3, dv: { y: 0.008, m: [3, 6, 9, 12], d: 20 }, al: ['通用汽车', 'เจเนอรัลมอเตอร์ส'], nz: '通用汽车' },
    { s: 'RIVN', n: 'Rivian Automotive', t: 'stock', sec: 'consumer', c: 'USD', x: 'NASDAQ', p: 14.3, vm: 2.8, al: ['rivian', 'ริเวียน'] },
    { s: 'LLY', n: 'Eli Lilly', t: 'stock', sec: 'health', c: 'USD', x: 'NYSE', p: 1142.85, vm: 1.2, dv: { y: 0.006, m: [3, 6, 9, 12], d: 10 }, al: ['lilly', '礼来', 'อีไล ลิลลี่'], nz: '礼来' },
    { s: 'NVO', n: 'Novo Nordisk', t: 'stock', sec: 'health', c: 'USD', x: 'NYSE', p: 37.32, vm: 1.6, al: ['novo', 'ozempic', 'wegovy', '诺和诺德', 'โนโว นอร์ดิสก์'], nz: '诺和诺德' },
    { s: 'PFE', n: 'Pfizer', t: 'stock', sec: 'health', c: 'USD', x: 'NYSE', p: 27.8, vm: 0.9, dv: { y: 0.065, m: [3, 6, 9, 12], d: 5 }, al: ['辉瑞', 'ไฟเซอร์'], nz: '辉瑞', nt: 'ไฟเซอร์' },
    { s: 'ABBV', n: 'AbbVie', t: 'stock', sec: 'health', c: 'USD', x: 'NYSE', p: 262.82, vm: 0.9, dv: { y: 0.028, m: [2, 5, 8, 11], d: 15 }, al: ['艾伯维', 'แอ๊บวี'], nz: '艾伯维' },
    { s: 'MRK', n: 'Merck & Co', t: 'stock', sec: 'health', c: 'USD', x: 'NYSE', p: 144.3, vm: 0.9, dv: { y: 0.035, m: [1, 4, 7, 10], d: 8 }, al: ['merck', 'msd', '默沙东', 'เมอร์ค'], nz: '默沙东' },
    { s: 'BA', n: 'Boeing', t: 'stock', sec: 'transport', c: 'USD', x: 'NYSE', p: 193.56, vm: 1.5, al: ['波音', 'โบอิ้ง'], nz: '波音', nt: 'โบอิ้ง' },
    { s: 'CAT', n: 'Caterpillar', t: 'stock', sec: 'transport', c: 'USD', x: 'NYSE', p: 845.42, vm: 1.2, dv: { y: 0.014, m: [2, 5, 8, 11], d: 20 }, al: ['卡特彼勒', 'แคทเทอร์พิลลาร์'], nz: '卡特彼勒' },
    { s: 'GE', n: 'GE Aerospace', t: 'stock', sec: 'transport', c: 'USD', x: 'NYSE', p: 309.56, vm: 1.3, dv: { y: 0.005, m: [1, 4, 7, 10], d: 25 }, al: ['general electric', '通用电气', 'จีอี'], nz: '通用电气航空' },
    { s: 'CVX', n: 'Chevron', t: 'stock', sec: 'energy', c: 'USD', x: 'NYSE', p: 206.69, vm: 0.9, dv: { y: 0.044, m: [3, 6, 9, 12], d: 10 }, al: ['雪佛龙', 'เชฟรอน'], nz: '雪佛龙', nt: 'เชฟรอน' },
    { s: 'T', n: 'AT&T', t: 'stock', sec: 'telecom', c: 'USD', x: 'NYSE', p: 24.3, vm: 0.8, dv: { y: 0.045, m: [2, 5, 8, 11], d: 1 }, al: ['att', 'at&t', '美国电话电报', 'เอทีแอนด์ที'] },
    { s: 'VZ', n: 'Verizon', t: 'stock', sec: 'telecom', c: 'USD', x: 'NYSE', p: 45.92, vm: 0.7, dv: { y: 0.06, m: [2, 5, 8, 11], d: 1 }, al: ['verizon', '威瑞森', 'เวอไรซอน'], nz: '威瑞森' },
    { s: 'DRAM', n: 'Roundhill Memory ETF', t: 'etf', sec: 'tech', c: 'USD', x: 'NYSE Arca', p: 61.78, vm: 2.4, al: ['dram', 'memory', 'hbm', '内存', '存储芯片', 'หน่วยความจำ'], nz: 'Roundhill 存储芯片 ETF' },
    { s: 'SMH', n: 'VanEck Semiconductor ETF', t: 'etf', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 630.6, vm: 2.0, dv: { y: 0.004, m: [12], d: 22 }, al: ['semiconductor', 'chips', '半导体', 'เซมิคอนดักเตอร์', 'ชิป'], nz: 'VanEck 半导体 ETF' },
    { s: 'SOXX', n: 'iShares Semiconductor ETF', t: 'etf', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 588.9, vm: 2.0, dv: { y: 0.006, m: [3, 6, 9, 12], d: 20 }, al: ['semiconductor', 'chips', '半导体', 'เซมิคอนดักเตอร์'], nz: 'iShares 半导体 ETF' },
    { s: 'VGT', n: 'Vanguard Information Technology ETF', t: 'etf', sec: 'tech', c: 'USD', x: 'NYSE Arca', p: 128.32, vm: 1.4, dv: { y: 0.005, m: [3, 6, 9, 12], d: 27 }, al: ['technology', '科技', 'เทคโนโลยี'], nz: '先锋信息科技 ETF' },
    { s: 'IVV', n: 'iShares Core S&P 500 ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 773.1, dv: { y: 0.012, m: [3, 6, 9, 12], d: 20 }, al: ['s&p', 'sp500', '标普', '标普500', 'เอสแอนด์พี'], nz: 'iShares 标普500 ETF' },
    { s: 'QQQM', n: 'Invesco Nasdaq 100 ETF', t: 'etf', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 308.69, vm: 1.4, dv: { y: 0.005, m: [3, 6, 9, 12], d: 30 }, al: ['nasdaq', 'nasdaq 100', '纳斯达克', 'แนสแด็ก'], nz: '纳斯达克100 ETF' },
    { s: 'DIA', n: 'SPDR Dow Jones Industrial Average ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 511.1, dv: { y: 0.015, m: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], d: 15 }, al: ['dow', 'dow jones', '道琼斯', 'ดาวโจนส์'], nz: '道琼斯 ETF' },
    { s: 'IWM', n: 'iShares Russell 2000 ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 281.52, vm: 1.4, dv: { y: 0.011, m: [3, 6, 9, 12], d: 20 }, al: ['russell', 'small cap', '罗素2000', '小盘股', 'หุ้นขนาดเล็ก'] },
    { s: 'VUG', n: 'Vanguard Growth ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 91.17, vm: 1.3, dv: { y: 0.005, m: [3, 6, 9, 12], d: 27 }, al: ['growth', '成长', 'หุ้นเติบโต'], nz: '先锋成长 ETF' },
    { s: 'VIG', n: 'Vanguard Dividend Appreciation ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 235.05, dv: { y: 0.017, m: [3, 6, 9, 12], d: 28 }, al: ['dividend growth', '股息增长', 'ปันผลเติบโต'], nz: '先锋股息增长 ETF' },
    { s: 'JEPI', n: 'JPMorgan Equity Premium Income ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 56.1, vm: 0.7, dv: { y: 0.075, m: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], d: 6 }, al: ['income', 'monthly', '月配息', 'รายได้', 'ปันผลรายเดือน'], nz: '摩根大通股票溢价收益 ETF' },
    { s: 'JEPQ', n: 'JPMorgan Nasdaq Equity Premium Income ETF', t: 'etf', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 61.04, vm: 1.0, dv: { y: 0.1, m: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], d: 6 }, al: ['income', 'monthly', 'nasdaq', '月配息', 'ปันผลรายเดือน'], nz: '摩根大通纳指溢价收益 ETF' },
    { s: 'VXUS', n: 'Vanguard Total International Stock ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NASDAQ', p: 85.43, dv: { y: 0.03, m: [3, 6, 9, 12], d: 26 }, al: ['international', 'world ex us', '国际', 'ต่างประเทศ'], nz: '先锋全球(除美国) ETF' },
    { s: 'VWO', n: 'Vanguard Emerging Markets ETF', t: 'etf', sec: 'broad', c: 'USD', x: 'NYSE Arca', p: 59.56, vm: 1.1, dv: { y: 0.03, m: [3, 6, 9, 12], d: 26 }, al: ['emerging', '新兴市场', 'ตลาดเกิดใหม่'], nz: '先锋新兴市场 ETF' },
    { s: 'ARKK', n: 'ARK Innovation ETF', t: 'etf', sec: 'tech', c: 'USD', x: 'NYSE Arca', p: 89.83, vm: 2.6, al: ['ark', 'cathie wood', '方舟', 'อาร์ค'], nz: 'ARK 创新 ETF' },
    { s: 'TQQQ', n: 'ProShares UltraPro QQQ (3× leveraged)', t: 'etf', sec: 'tech', c: 'USD', x: 'NASDAQ', p: 81.01, vm: 4.2, al: ['3x', 'leveraged', 'nasdaq', '三倍', 'ทริปเปิล'], nz: '三倍纳指 ETF' },
    { s: 'TLT', n: 'iShares 20+ Year Treasury Bond ETF', t: 'etf', sec: 'bonds', c: 'USD', x: 'NASDAQ', p: 77.48, k: 'bond', vm: 3.2, dv: { y: 0.043, m: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], d: 6 }, al: ['treasury', 'bond', '美国国债', 'พันธบัตรรัฐบาลสหรัฐ'], nz: '20年以上美国国债 ETF' },
    { s: 'SGOV', n: 'iShares 0-3 Month Treasury Bond ETF', t: 'etf', sec: 'bonds', c: 'USD', x: 'NYSE Arca', p: 100.44, k: 'bond', vm: 0.08, dv: { y: 0.04, m: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], d: 6 }, al: ['t-bill', 'treasury', 'cash', '短期国债', 'ตั๋วเงินคลัง'], nz: '0-3个月美国国债 ETF' },
    { s: 'IAU', n: 'iShares Gold Trust', t: 'etf', sec: 'gold', c: 'USD', x: 'NYSE Arca', p: 77.95, k: 'gold', al: ['gold', '黄金', 'ทองคำ'], nz: 'iShares 黄金' },
    { s: 'SLV', n: 'iShares Silver Trust', t: 'etf', sec: 'gold', c: 'USD', x: 'NYSE Arca', p: 54.74, k: 'gold', vm: 1.7, al: ['silver', '白银', 'เงิน (โลหะ)'], nz: 'iShares 白银' },
    { s: 'IBIT', n: 'iShares Bitcoin Trust ETF', t: 'etf', sec: 'crypto', c: 'USD', x: 'NASDAQ', p: 47.73, k: 'crypto', al: ['bitcoin etf', 'btc etf', '比特币ETF', 'บิตคอยน์ อีทีเอฟ'], nz: 'iShares 比特币 ETF' },
    // ---- Crypto (priced in USD) ----
    { s: 'BTC', n: 'Bitcoin', t: 'crypto', sec: 'crypto', c: 'USD', x: 'Crypto', p: 85272, k: 'crypto', al: ['比特币', 'บิตคอยน์'], nz: '比特币', nt: 'บิตคอยน์' },
    { s: 'ETH', n: 'Ethereum', t: 'crypto', sec: 'crypto', c: 'USD', x: 'Crypto', p: 2701, k: 'crypto', vm: 1.2, al: ['以太坊', 'อีเธอเรียม'], nz: '以太坊', nt: 'อีเธอเรียม' },
    { s: 'SOL', n: 'Solana', t: 'crypto', sec: 'crypto', c: 'USD', x: 'Crypto', p: 121.24, k: 'crypto', vm: 1.45, al: ['索拉纳', 'โซลานา'] }
  ];
  const BY = {};
  const COINGECKO = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana' };
  ASSETS.forEach((a) => {
    BY[a.s] = a;
    a.kind = a.k || (a.t === 'crypto' ? 'crypto' : a.t === 'etf' ? 'etf' : 'stock');
    // where live prices come from
    if (a.t === 'crypto') a.cg = COINGECKO[a.s];
  });

  /* a US stock / ETF found through live search (market.addUS) or saved with a portfolio.
     Only US-dollar stocks and ETFs — never replaces a built-in one. */
  function addAsset(def) {
    if (!def || !/^[A-Z]{1,5}(\.[A-Z])?$/.test(def.s || '')) return null;
    if (BY[def.s]) return BY[def.s];
    const a = { s: def.s, n: String(def.n || def.s).slice(0, 80), t: def.t === 'etf' ? 'etf' : 'stock', sec: SECTORS.indexOf(def.sec) !== -1 ? def.sec : 'other', c: 'USD', x: String(def.x || 'US').slice(0, 20), p: def.p > 0 ? +def.p : 1, al: [], custom: true };
    a.kind = a.t;
    ASSETS.push(a);
    BY[a.s] = a;
    return a;
  }
  /* what a portfolio keeps so other phones can show it */
  const assetDef = (a) => ({ s: a.s, n: a.n, t: a.t, sec: a.sec, x: a.x, p: a.p });

  /* ---------- deterministic price history ----------
     Anchored at a fixed day so history never "reshuffles" between visits. */
  const ANCHOR = FF.fromYMD(2026, 10, 1);
  const BACK = 2200, FWD = 1500;
  const cache = {};
  function series(sym) {
    if (cache[sym]) return cache[sym];
    const a = BY[sym];
    const kd = KIND[a.kind];
    const vol = kd.v * (a.vm || 1);
    const r = FF.rng(FF.hash('px:' + sym));
    const n = BACK + FWD;
    const px = new Float64Array(n + 1);
    px[BACK] = a.p;
    // slow-moving "regime" multiplier gives calm and bumpy stretches
    let regime = 1;
    for (let k = BACK; k > 0; k--) {
      regime = FF.clamp(regime + (r() - 0.5) * 0.08, 0.6, 1.6);
      px[k - 1] = px[k] / Math.exp(kd.mu + vol * regime * FF.gauss(r));
    }
    regime = 1;
    for (let k = BACK; k < n; k++) {
      regime = FF.clamp(regime + (r() - 0.5) * 0.08, 0.6, 1.6);
      px[k + 1] = px[k] * Math.exp(kd.mu + vol * regime * FF.gauss(r));
    }
    return (cache[sym] = { start: ANCHOR - BACK, px });
  }
  const tidy = (v) => (v >= 1 ? Math.round(v * 100) / 100 : Math.round(v * 10000) / 10000);
  function demoPrice(sym, day) {
    const s = series(sym);
    return s.px[FF.clamp(day - s.start, 0, s.px.length - 1)];
  }

  /* ---------- live market data (filled in by market.js) ----------
     LIVE[sym] = { d0, c: closes per calendar day from d0 (gaps forward-filled),
                   p: latest price, pc: previous session close, t: quote time (ms),
                   open: market open now, delayed: minutes, src } */
  const LIVE = {};
  function setLive(sym, L) {
    if (!BY[sym] || !L || !(L.p > 0)) return;
    if (L.c && L.c.length) L.join = L.c[0] / demoPrice(sym, L.d0); // stitches demo history onto real history
    LIVE[sym] = L;
  }
  const isLive = (sym) => !!LIVE[sym];
  const liveInfo = (sym) => LIVE[sym] || null;

  function price(sym, day) {
    if (!BY[sym]) return 0;
    const L = LIVE[sym];
    if (L) {
      if (day >= FF.today()) return L.p;
      if (L.c && L.c.length) {
        if (day >= L.d0) return L.c[Math.min(day - L.d0, L.c.length - 1)];
        return tidy(demoPrice(sym, day) * L.join);
      }
      return tidy(demoPrice(sym, day) * (L.p / demoPrice(sym, FF.today())));
    }
    return tidy(demoPrice(sym, day));
  }
  /* the close of the session before `day` (on weekends: Thursday→Friday move) */
  function prevPrice(sym, day) {
    const L = LIVE[sym];
    if (L && day >= FF.today() && L.pc > 0) return L.pc;
    return price(sym, day - 1);
  }
  const dayChangePct = (sym, day) => {
    const a = prevPrice(sym, day), b = price(sym, day);
    return a ? b / a - 1 : 0;
  };
  /* dividend per share per payment, from the latest price and the asset's yield */
  function dps(sym) {
    const a = BY[sym];
    if (!a || !a.dv) return 0;
    const p = LIVE[sym] ? LIVE[sym].p : a.p;
    return (p * a.dv.y) / a.dv.m.length;
  }

  /* ---------- dividends ---------- */
  // pay days for an asset in [from, to]
  function payDays(sym, from, to) {
    const a = BY[sym];
    if (!a || !a.dv) return [];
    const out = [];
    const s = FF.ymd(from), e = FF.ymd(to);
    let y = s.y, m = s.m;
    while (y < e.y || (y === e.y && m <= e.m)) {
      if (a.dv.m.indexOf(m) !== -1) {
        const d = FF.fromYMD(y, m, Math.min(a.dv.d, FF.daysInMonth(y, m)));
        if (d >= from && d <= to) out.push(d);
      }
      const nx = FF.addMonths(y, m, 1); y = nx.y; m = nx.m;
    }
    return out;
  }
  const EX_GAP = 21; // you must own it ~3 weeks before pay day ("ex-date")

  /* ---------- search ---------- */
  function norm(s) { return String(s || '').toLowerCase().replace(/[\s.\-_&()]/g, ''); }
  function search(q, prefer) {
    const nq = norm(q);
    if (!nq) return [];
    const scored = [];
    ASSETS.forEach((a) => {
      const fields = [a.s, a.code || '', a.n, a.nz || '', a.nt || ''].concat(a.al || []);
      let best = 0;
      fields.forEach((f, i) => {
        const nf = norm(f);
        if (!nf) return;
        if (nf === nq) best = Math.max(best, i === 0 ? 100 : 90);
        else if (nf.indexOf(nq) === 0) best = Math.max(best, i === 0 ? 80 : 70);
        else if (nf.indexOf(nq) !== -1) best = Math.max(best, 50);
      });
      if (best) scored.push({ a, score: best + (prefer && prefer.indexOf(a.c) !== -1 ? 5 : 0) });
    });
    scored.sort((x, y) => y.score - x.score || x.a.s.localeCompare(y.a.s));
    return scored.slice(0, 12).map((x) => x.a);
  }
  const POPULAR_US = ['VOO', 'AAPL', 'NVDA', 'MSFT', 'KO', 'BTC'];
  const POPULAR = { MYR: POPULAR_US, THB: POPULAR_US, USD: POPULAR_US, SGD: POPULAR_US, CNY: POPULAR_US };

  function displayName(a, lang) {
    if (!a) return '';
    if (lang === 'zh' && a.nz) return a.nz;
    if (lang === 'th' && a.nt) return a.nt;
    return a.n;
  }
  function monogram(a) {
    if (!a) return '?';
    const base = /^\d/.test(a.s) ? a.n : a.s;
    const clean = base.replace(/[^A-Za-z0-9]/g, '');
    return clean.slice(0, a.s.length <= 3 && !/^\d/.test(a.s) ? 3 : 2).toUpperCase();
  }
  const LOGO_COLORS = ['#2F8F46', '#3D7FD1', '#E0563F', '#8A5BC7', '#F08A3C', '#2A9D8F', '#C2477A', '#5D6B7E', '#B07A45', '#1F9AC0', '#D8A31A'];
  const logoColor = (a) => (a ? LOGO_COLORS[FF.hash(a.s) % LOGO_COLORS.length] : '#888');

  FF.data = { FX, fxInfo, setFX, setFXHistory, get hasFXHistory() { return !!FXH; }, DISPLAY_CURRENCIES, fx, TYPES, SECTORS, ASSETS, BY, asset: (s) => BY[s], addAsset, assetDef, price, prevPrice, dayChangePct, dps, demoPrice, setLive, isLive, liveInfo, LIVE, payDays, EX_GAP, search, POPULAR, displayName, monogram, logoColor };
})(typeof window !== 'undefined' ? window : this);
