/* ============================================================
   FamFi — Firebase web config (the "sea-monoploy" project:
   Auth + Realtime Database, Singapore). Web configs are public by
   design — access is controlled by database.rules.json.
   ============================================================ */
window.FAMFI_FIREBASE = {
  apiKey: 'AIzaSyCHFgihE2kzHB-v9fPJD_AQpCCmEu1oqxI',
  authDomain: 'sea-monoploy.firebaseapp.com',
  databaseURL: 'https://sea-monoploy-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'sea-monoploy',
  appId: '1:775386946384:web:bcbe85cdd44b5740deaa55'
};
/* Local testing only (never on the live site):
   • tests/two-phones.html — several phones in one page sharing an in-memory database
     that enforces database.rules.json (?fake=<name>, inside that page's iframes)
   • the Firebase emulators — http://localhost:8644/?emu=1, remembered until ?emu=0 */
(function () {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  const fake = new URLSearchParams(location.search).get('fake');
  if (fake && window.parent !== window && window.parent.FAKE_SERVER) {
    window.FAMFI_NS = '.' + fake;
    window.firebase = window.parent.FakeBase.makeFirebase(window.parent.FAKE_SERVER, fake).firebase;
    return;
  }
  try {
    const q = new URLSearchParams(location.search).get('emu');
    if (q != null) sessionStorage.setItem('famfi.emu', q);
    if (sessionStorage.getItem('famfi.emu') === '1') window.FAMFI_FIREBASE.emulator = { auth: 'http://127.0.0.1:9099', host: '127.0.0.1', dbPort: 9000 };
  } catch (e) { /* storage blocked */ }
})();
