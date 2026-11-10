/* FamFi — keys for live US stock prices (both have free plans).
   Copy this file to js/config.js and paste your keys between the quotes.

   • Finnhub — live US prices (real-time, 60 calls/min free)
       sign up: https://finnhub.io/register  → Dashboard → API key
   • Twelve Data — past daily prices for charts and returns (800 credits/day free)
       sign up: https://twelvedata.com/register → API keys

   These keys ship inside the web app, so anyone who opens FamFi could see them.
   That's normal for free browser keys — the worst case is someone using up the
   free quota. Never put a paid or private key here. */
window.FF_CONFIG = {
  finnhubKey: '',
  twelveDataKey: ''
};
