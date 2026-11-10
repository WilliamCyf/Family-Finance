/* ============================================================
   FamFi — i18n.js
   Three languages (English default, 简体中文, ไทย). Instant
   switching: t() reads the live language, screens re-render.
   Money, numbers and dates use Intl with each language's locale
   (Thai dates use the Buddhist calendar, as Thai users expect).
   Dictionaries live in strings-*.js.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;
  const LANGS = ['en', 'zh', 'th'];
  const LOCALE = { en: 'en-MY', zh: 'zh-CN', th: 'th-TH' };
  const NATIVE = { en: 'English', zh: '简体中文', th: 'ไทย' };
  const HTML_LANG = { en: 'en', zh: 'zh-Hans', th: 'th' };
  let lang = 'en';
  const S = () => FF.STRINGS || {};

  function t(key, vars) {
    const d = S()[lang] || {}, en = S().en || {};
    let s;
    if (vars && vars.n != null) {
      const pk = key + (Number(vars.n) === 1 ? '_one' : '_other');
      s = d[pk] != null ? d[pk] : d[key] != null ? d[key] : en[pk];
    }
    if (s == null) s = d[key] != null ? d[key] : en[key] != null ? en[key] : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }
  const has = (key) => (S()[lang] || {})[key] != null || (S().en || {})[key] != null;
  /* Only the language in use is loaded when the app starts (English is always there, as the
     fallback); another comes the moment someone picks it — from the phone's copy, so it works
     offline too. (All three were parsed on every start: ~185 KB of words never shown.) */
  const loading = {};
  function ensure(l) {
    if (S()[l] || LANGS.indexOf(l) === -1 || typeof document === 'undefined') return Promise.resolve();
    if (loading[l]) return loading[l];
    return (loading[l] = new Promise((res) => {
      const en = document.querySelector('script[src*="strings-en.js"]');
      const s = document.createElement('script');
      s.src = en ? en.getAttribute('src').replace('strings-en.js', 'strings-' + l + '.js') : 'js/strings-' + l + '.js';
      s.onload = s.onerror = () => { delete loading[l]; res(); }; // if it can't load, English stands in
      document.head.appendChild(s);
    }));
  }

  const nf = {};
  function fmt(opts) {
    const k = lang + JSON.stringify(opts);
    return nf[k] || (nf[k] = new Intl.NumberFormat(LOCALE[lang], opts));
  }
  /* money in a currency; o: {sign, whole, compact, cur} */
  function money(v, cur, o) {
    o = o || {};
    cur = cur || (FF.store && FF.store.me() ? FF.store.me().pf.base : 'MYR');
    if (!isFinite(v)) v = 0;
    if (Math.abs(v) < 0.005) v = 0;
    const opts = { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' };
    if (o.compact && Math.abs(v) >= 10000) { opts.notation = 'compact'; opts.maximumFractionDigits = 1; opts.minimumFractionDigits = 0; }
    else if (o.whole) { opts.maximumFractionDigits = 0; opts.minimumFractionDigits = 0; }
    else { opts.minimumFractionDigits = 2; opts.maximumFractionDigits = 2; }
    if (o.sign) opts.signDisplay = 'exceptZero';
    return fmt(opts).format(v).replace(/-/g, '−').replace(/\s/g, '\u00A0');
  }
  function pct(v, o) {
    o = o || {};
    const dp = o.dp != null ? o.dp : (Math.abs(v) > 0 && Math.abs(v) < 0.001 ? 2 : 1);
    const opts = { style: 'percent', minimumFractionDigits: dp, maximumFractionDigits: dp };
    if (o.sign) opts.signDisplay = 'exceptZero';
    return fmt(opts).format(isFinite(v) ? v : 0).replace(/-/g, '−');
  }
  function num(v, maxFrac) { return fmt({ maximumFractionDigits: maxFrac == null ? 2 : maxFrac }).format(v); }
  function qty(v) { return fmt({ maximumFractionDigits: Math.abs(v) < 1 ? 6 : Math.abs(v) < 100 ? 4 : 2 }).format(v); }
  function price(v, cur, decimals) {
    const dp = decimals != null ? decimals : v >= 1 ? 2 : 4;
    return fmt({ style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: dp }).format(v);
  }
  const df = {};
  function dtf(opts) { const k = lang + JSON.stringify(opts); return df[k] || (df[k] = new Intl.DateTimeFormat(LOCALE[lang], opts)); }
  const date = (day) => dtf({ day: 'numeric', month: 'short', year: 'numeric' }).format(FF.dayToDate(day));
  const dateShort = (day) => dtf({ day: 'numeric', month: 'short' }).format(FF.dayToDate(day));
  const dateLong = (day) => dtf({ weekday: 'long', day: 'numeric', month: 'long' }).format(FF.dayToDate(day));
  const monthYear = (y, m) => dtf({ month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 15));
  const monthShort = (m) => dtf({ month: 'short' }).format(new Date(2026, m - 1, 15));
  const monthNarrow = (m) => (lang === 'en' ? dtf({ month: 'narrow' }).format(new Date(2026, m - 1, 15)) : lang === 'zh' ? m + '' : dtf({ month: 'short' }).format(new Date(2026, m - 1, 15)).replace('.', '').slice(0, 2));
  const year = (y) => dtf({ year: 'numeric' }).format(new Date(y, 5, 15));
  const weekdaysNarrow = () => { const out = []; for (let k = 0; k < 7; k++) out.push(dtf({ weekday: lang === 'en' ? 'narrow' : 'short' }).format(new Date(2026, 5, 1 + k))); return out; }; // 2026-06-01 is a Monday
  const time = (d) => dtf({ hour: 'numeric', minute: '2-digit' }).format(d);

  function setLang(l) {
    if (LANGS.indexOf(l) === -1) l = 'en';
    lang = l;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = HTML_LANG[l];
      document.documentElement.dataset.lang = l;
    }
  }

  FF.i18n = {
    LANGS, LOCALE, NATIVE, get lang() { return lang; }, setLang, ensure, t, has,
    money, pct, num, qty, price, date, dateShort, dateLong, monthYear, monthShort, monthNarrow, year, weekdaysNarrow, time
  };
})(typeof window !== 'undefined' ? window : this);
