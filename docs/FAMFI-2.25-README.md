# 🏡 FamFi — family finance, in a cosy village

A gamified, beginner-friendly family money app built as an **iOS home-screen web app**
(PWA, portrait only). Every family member is a house in a Hay Day-style village.
**Everyday money comes first** (Wallet-by-BudgetBakers style: accounts, spending,
income, transfers, budgets); **the stock tracker is the strong second feature**
(Portseido style: returns, holdings, automatic dividends). The family's shared assets
live in the village **Town Hall**.

- **App:** `index.html` · **Design board:** `design.html` (principles, design system,
  village art kit, and every screen running live in EN / 简体中文 / ไทย, light & dark)
- No build step — plain JS + CSS + generated SVG art. Accounts and shared families use the
  the `sea-monoploy` Firebase project (Auth + Realtime Database), loaded on demand from Google's CDN.

## Run locally

```
python3 FamFi/tests/devserver.py 8644      # no-cache dev server → http://localhost:8644
```

(`.claude/launch.json` has a `famfi` config for the preview pane.) Add `?nosw` while
developing to skip the service worker. **`/tests/two-phones.html`** runs two (or more) FamFi
phones side by side against an in-memory database that enforces the real
`database.rules.json` — sign up on one, create a family, join from the other.
**Never test sign-up against the live site** — it creates real accounts. Screens can be opened directly for review with
`?shot=<name>&lang=en|zh|th&theme=light|dark` (memory-only demo data — see the list in
`js/app.js → shot()`).

## What's in it

| Area | Highlights |
|---|---|
| Accounts & real families | Email + password accounts (Firebase Auth), sign in on any phone, password reset. A family has a random invite code (`TAN-4K7QX`) and link; joining shows the family's name first. Everything a family shares — members, houses, goals, village layout, pets — syncs live. Owner can remove members (the code changes) or make a new code; anyone can leave (ownership passes on; the last one out deletes the family); delete-my-account removes all FamFi data. Works offline and catches up. |
| Family village | Pan/pinch map (since v2.24 buildings can go anywhere on the island's grass — the top and sides too — not just a central rectangle), **6 house levels by total wealth** (cottage → RM 50k → 100k → 300k → 500k → the RM 1 million golden mansion with twin turrets), customisable isometric houses, floating tags (photo · name · total, privacy-aware), long-press edit mode (jiggle, drag, snap-to-grid, green/red footprint), Family Goals stand + poster, roaming animals with personalities that never block taps, visit-a-member with zoom-into-the-door transition and a big Exit |
| Everyday money (main) | **Home**: your money today → account tiles (cash, bank, e-wallet, savings, credit card, brokerage, crypto, EPF, loan — each with its balance; tap for its page: balance trend, quick add, “update balance”, records) → Spent / Received / Move money → budgets → this month (money in vs out, where it went) → recent records → investments → **where your money is** (holdings + cash pie, all money / investments only). **Records**: “I spent / I received / I moved money” with amount, currency (your base first), 15 spending + 8 income categories, account, date, note; moving money between currencies asks what arrived (today's rate pre-filled). Every record can be edited: **tap it** (Home → Recent, Manage → Records, an account's page) and it opens straight in the editor — fix a typo in the note, the amount, category, account or date, or delete it (tap twice; Undo in the toast). Opening balances, adjustments and automatic dividends show their details first. **Budgets**: monthly or weekly, all spending or chosen categories, with a “where you should be by now” marker, per-day allowance and an early “heading for…” warning |
| Investments (second) | **Return** (investments only: period picker, value vs money-in chart, where the gain came from, every holding) · **Dividend**: US dividends **added automatically after 30% US withholding tax** (rate editable), coming soon, received-automatically list, calendar (received / coming / estimated), by month · Bought / Sold with live prices, 115 built-in tickers + any US stock via live search, CSV import |
| Town Hall | A family building (built from a plot in the village) holding assets that belong to everyone — unit trust/ASB, land, family savings, business, gold, vehicle — each with a value history (update value / add / take out). Anyone can rename it; its total shows on top of the building |
| Automatic dividends | The free data plans have no dividend lists, so FamFi works them out from Twelve Data's dividend-adjusted vs as-traded prices: on each ex-day the adjustment steps by exactly one dividend (adjusted = close × P/(P+D)) → dividend = P × (1/step − 1), matching declared amounts to the cent (KO $0.51 / $0.53, AAPL $0.25 / $0.26). Glitches are smoothed against neighbouring dividends; splits ignored. Shares held at the close before the ex-day count; pay day comes from the stock's usual schedule. Added once (never re-added if deleted), never doubled with one you typed |
| Live market data | 115 built-in US stocks & ETFs (names in EN / 中文 / ไทย, incl. SpaceX SPCX, Reddit, TSMC, Micron, Grab, Sea, memory/chip ETFs) **plus any other US-listed stock or ETF via live search** (Finnhub symbol lookup; a looked-up stock is saved with the portfolio so the whole family sees it): live quotes from Finnhub + daily history from Twelve Data; crypto via CoinGecko; exchange rates + history from the European Central Bank. All straight from the browser, cached on the device (opens instantly, works offline); every price is tagged Live / Market closed / Last close / Demo |
| Currency-aware returns | Money put in converts at the rate on its own day, holdings at today's rate, so a ringgit or baht investor sees the real effect of the USD move — shown as its own "From the exchange rate" line |
| Finish Setup | Before/after preview, opening-balance adjustment spread over purchase dates so history stays right, never counts as profit/loss, logged + undoable |
| Budget | Optional monthly budget: what's left, per-day allowance, spending groups |
| Gems, daily gift & Shop | **Daily gift** with a streak (10–20 gems a day, 60 on day 7 of each week, +150 monthly chest every 30th day; a streak shield protects one missed day); +5 for the first record each day; +100 for a month inside your budgets; badge gems by tier. **Shop**: 15 decorations in four spots (roof · front door · garden · sky — lucky cat, fairy lights, koi pond, wau kite, rainbow…) and 8 exclusive pets (bunny → baby dragon) that live around your house and follow it when you move it; try-on preview on your own house. Paced on purpose: the whole shop is over a year of every-day play. Gems reward habits, never wealth. Gems stay private (your own phones); your family sees the decorations and pets. Auto-opens once a day |
| Block Blast arcade | A neon arcade building in every family's village (move it like any house; its tag shows the family's top player). Tap it for a full-screen **Block Blast**: 8×8 board, three pieces at a time, drag to place — like the original, the piece jumps above your finger and **moves 1.6× faster than it**, so a short, relaxed swipe reaches every corner (Menu → Block speed: follow finger · original · extra fast); it snaps to the nearest free spot (forgiving by ~¾ cell) and a tap never drops a piece by accident, clear rows and columns, combos that survive two misses, all-clear bonus, "Good / Great / Excellent / Amazing / Unbelievable" praise, screen shake, sparkles and confetti. **1 gem per 300 points, no daily limit**; badges at 5,000 (silver) and 20,000 (gold). **Family ranking** (this week · all time). Quit anytime with ✕ — the game is saved on the phone and continues where you left off |
| Lucky Market | A market stall in every village (move it like any building). **Six stalls a day**, different every day (the same on all your phones), each sells once: **pet eggs** (gacha: common 62 % · rare 26 % · epic 9.5 % · legendary 2.5 %; a golden egg is never common) hatch one of 8 pets — chick, hamster, frog, otter, koala, kitsune, unicorn, phoenix — that sit by your house; feed them once a day when hungry or thirsty and they grow up (12 days) and become majestic (30 days: more tails, wings, a crown and a glow); keep any form you've unlocked; sell any time. **Seed packets** grow anywhere on the map (drag in edit mode): water once a day — sprout, leaves, bud, and on day 9 a bloom of 7 kinds up to the golden money tree; older blooms sell for more. **Molotov**: a family member's house burns for a day (a joke, nothing breaks). **Growth tonic**, **pet treat**, and now and then an **exclusive decoration** (lucky clover, golden bells, fireworks). Room for 4 pets and 6 plants. **Fishing at the pond**: five casts a day — stop the needle in the green (gold centre = rarer fish), 2–22 gems a catch |
| Daily spin (v2.24) | A wooden wheel button beside your gems (red dot while today's spin waits). **One free spin a day**, eight slices of the same size — each exactly 1 in 8, and the sheet says so: 5 · 10 · 15 · 5 · 10 · 40 gems, a growth tonic or a pet treat (about 11 gems a day on average). The prize is decided and saved the moment you tap Spin (closing mid-spin can't re-roll it); the wheel is a still picture the GPU turns for ~4 s, ticks scheduled on the sound chip |
| The Mystery Man (v2.24) | An old fellow napping in the village grass — straw hat over his eyes, white beard, chewing a stalk of wheat (move him like any building). Tap him: a **true, timeless fact** (countries and their flags, Malaysia, planet Earth, space, science, animals, your body, money, history — 102 of them in each language), then a 4-answer quiz on it (shuffled every time) and why it's so. **2 gems per right answer, the first 10 a day**; after that he keeps teaching for fun. He picks facts you haven't answered yet (synced across your phones) and never two of a kind in a row. Facts load only when he talks (`js/facts-<lang>.js`) and are cached for offline |
| Family helpers (v2.25) | Tap a family member's house: if they let the family help, it says “🤝 You can help” and their Home gets **Record for Mum** (spent · received · moved), their accounts open (**set the balance**, add to one), any everyday record of theirs opens to fix or delete, and a **Records** tab lists everything (filters, categories). Their own phone takes each change in — they see “✍️ Mum” on the record and a toast; until then it shows as “waiting for their phone”. Undo works on their records too. Trades, automatic dividends and starting balances stay theirs. One switch in Privacy (on unless you made something private); a one-time “New: family helpers” explains it |
| Block Blast chat (v2.25) | The player and everyone watching them share a little chat. Watchers get a bar under the board — 👏 🔥 😂 ❤️ and “Say something…”; the player taps the audience pill (👁 3 💬, with a count of unread messages). Emoji float up the right edge on everyone's screen (also the player's, without opening anything); messages show in the pill (player) or a short feed (watchers); the chat panel has the conversation, quick replies (“Thanks! 😄”, “Nice move! 👏”) and all eight emoji, and stays above the iPhone keyboard. Nothing is drawn on the game canvas and nothing covers the board, so the game plays exactly the same. The room lives only while the game is live (database rules), only the player and their watchers listen, the player keeps it to the last 40 messages, and it starts clean each time the game opens. Floating emoji are capped (bursts go up as one, “🔥 ×3”; at most four at a time and six per 10 s) — measured in WebKit: ~0 ms/s when quiet, ~11 for a message every 4 s, ~17 for normal bursts, ≤ ~30 even under constant spam |
| Gamification | House levels, weekly logging streak, **28 badges in four tiers** (bronze first steps → silver/gold habits, Block Blast scores, fishing and raising a pet → diamond: a 365-day streak, 365 logging days, RM 1 million), animals unlock with family progress, level-up celebration — nothing rewards trading more |
| Languages | English, 简体中文, ไทย — instant switch, remembered per user, Intl money/number/date formatting per locale (Thai Buddhist calendar, Chinese 万), labels auto-fit instead of truncating, user-typed content never translated |
| Accessibility | Dynamic Type + A/A+/A++, 44pt targets, ▲/▼ + spoken words for gains/losses, Calm motion (follows iOS Reduce Motion), light & dark |

## Files

```
index.html  design.html  manifest.webmanifest  sw.js
css/  tokens.css (design tokens) · app.css · village.css · design.css
js/   core · data (market catalogue) · calc (portfolio maths) · ledger (everyday money, views,
      budgets, Town Hall, automatic dividends) · grid (village land)
      play (gems, daily gift, shop catalogue, badge tiers) · blast (Block Blast rules) · lucky (Lucky Market, pets, plants, fishing) · store (state, demo families, actions)
      · cloud (accounts + family sync) · fb-config
      · market (live prices) · i18n + strings-en/zh/th
      art (houses, scenery, icons, the arcade) · art-shop (gems, decorations, pets) · art-lucky (market, eggs, 8 pets × 3 forms, plants, fish)
      · art-news (the mailbox) · art-sage (the Mystery Man) · facts-en/zh/th (his facts, loaded on demand)
      · ui (sheets, toasts, tooltips, confetti, sound, haptics)
      charts · screens-money · screens-manage · screens-menu · screens-family · screens-hall
      · screens-shop (shop, daily gift, house levels) · screens-blast (the Block Blast game) · screens-lucky (market, pets, plants, fishing)
      · screens-news · screens-spin (the daily spin) · screens-sage (the Mystery Man's stories and quiz)
      · screens-help (family helpers: a member's Records tab, their accounts, the toasts and intro)
      village (map engine) · app (router, tabs, prefs, shot mode) · design (board)
icons/  app icon, maskable icon, iPhone launch screens
tests/  test_calc.js (jsc engine tests) · test_cloud.js + fakebase.js (multi-phone sync and
        database-rules tests, Node) · two-phones.html · check_strings.py · devserver.py
```

## Tests

```
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
$JSC FamFi/js/core.js FamFi/js/data.js FamFi/js/calc.js FamFi/js/ledger.js FamFi/js/play.js FamFi/js/lucky.js FamFi/js/blast.js FamFi/js/grid.js FamFi/js/store.js FamFi/js/market.js FamFi/tests/test_calc.js
python3 FamFi/tests/check_strings.py
node FamFi/tests/test_cloud.js
node FamFi/tests/test_market_pace.js   # how often prices are fetched (fake clock)
node FamFi/tests/test_news.js          # the News mailbox: feeds, filters, 20-minute keep
```

`test_cloud.js` runs several phones (separate JS contexts with the real `store.js` +
`cloud.js`) against one in-memory database that enforces the repo's real
`database.rules.json`: create → invite → join the *same* family, live goals / village /
renames, privacy enforced by the database, strangers and wrong codes refused, a second
phone, offline edits, expired sessions, remove / new code / rejoin / leave / ownership
hand-over, switching families, upgrading old local-only phones, demo isolation, and
deleting an account.

The engine tests cover the demo families in all three languages, Finish Setup (cash
becomes exactly 0, gain and 1-year return unchanged, history never negative, undo),
returns adding up, allocation, dividends, budget, streaks, goals and pet unlocks, the daily
gift (streaks, shields, monthly chest, pacing), buying / equipping / pet swaps, badge gems,
the six house levels, the village back at its first size (no biomes), and
houses left outside the map moving back in, and Block Blast (every piece, scoring, combos,
all clears, fair dealing, saved games, 150 random games played to the end, gems without a daily
cap, badges, the weekly / all-time ranking and the arcade's spot). The cloud test also checks
that scores reach the whole family while gems stay private, and that a moved arcade moves for
everyone.

## Smooth scrolling on phones (the village)

Measured with the same pan / pinch test before and after (Mac, median per finger move):

| | Drag step | Pinch-zoom step | Ground redraw |
|---|---|---|---|
| Before (the bigger biome map) | 1.19 ms | 56 ms | 68 ms of vector art |
| After | 0.02 ms | 0.25 ms | none (a picture) |

The four corner biomes have since been removed again (v2.3) and the village is back at its
first size (1000×1500): the biome weather alone was ~40 always-running animations, and the
bigger world was twice the pixels to keep on the phone's graphics chip.

How (village.js): the map moves at most once per screen refresh; the name tags' counter-zoom
lives on the tags layer and changes only when the zoom does (on the whole world it restyled
every house, tree and animal on every finger move); the ground is drawn once into a 2× picture
after the village appears (not mid-gesture), so pan and pinch never redraw its ~2,000 shapes;
the edit grid isn't painted while hidden. A frame-rate counter for real phones: Menu → tap the
version line 5 times.

## No warm iPhone — the v2.20 audit (measured in WebKit)

iPhone Safari is WebKit, so this audit measured WebKit itself: a tiny invisible 390×844 web view
on a Mac (Safari's engine), with the CPU time of WebKit's processes read from the system over
10 s of an idle screen. Chrome was used for the rest (tap-every-button, leak and timing tests).

The rule it found: **nothing may move inside an SVG picture.** One moving part inside a drawing
(a swinging leg, a bobbing bird) makes WebKit redo the whole screen every frame — ≈ 300 ms of
work a second, whether one part moves or fifty. Moving a *box* (a div, a whole `<svg>`) is done
by the graphics chip and costs almost nothing — 25 swaying trees together cost less than one leg.

| ms of work per second, idle (WebKit) | v2.19 | v2.20 |
|---|---|---|
| Family village | 450 | ≈ 110 (≈ 1 after 45 s untouched) |
| Shop · Pets tab · an item · a pet · level-up | 209 · 378 · 295 · 246 · 143 | 9 · 3 · 3 · 0 · 1 |
| Family Goals / Customize (over the village) | 446 / 418 | 48 / 106 |
| Home, Return, Dividends, Manage, Menu, News, game | 0–1 | 0–1 |

What changed:
- **Animals** move as a whole picture (a waddle, a peck, a look round, a breath, a float) instead
  of legs, heads and tails moving inside the drawing; the exclusive pets the same (the dragon
  hovers, its wings stay still).
- **Butterflies** squeeze their whole picture (wings opening and closing, seen from above).
- **Shop decorations** (lucky cat's paw, nest birds, roof cat's tail, weather vane, bath bird, koi):
  `art-shop.js` lifts each moving bit into its own little box laid over the picture, in drawing
  order — they look exactly as before (checked frame by frame). Twinkling lights stay inside: they
  only change twice a cycle.
- **Walking** is one transform animation per walk (Web Animations API) — no per-frame script.
  In Chrome the old per-frame loop made the browser rebuild the village's layers 60× a second
  (≈ 230 ms of work a second → 28); in WebKit it was cheap either way.
- **Dozing**: after 45 s with nobody touching the phone the wind drops — trees, smoke, butterflies
  and decorations pause and the animals stop wandering; any touch wakes it at once.
- **Calm motion** now costs nothing (the empty per-frame loop kept running: 18 → 0.4 ms/s).
- **Opening the app**: versioned files (`?v=`) come straight from the phone (service worker
  cache-first); only the page is asked for fresh, with the phone's copy after 3 s on a slow
  connection. A re-open made 43 server requests, now 2.
- **Languages**: only the one in use is loaded at start (English is always there as the
  fallback); the others load when picked — ~185 KB less to parse on every open.

## Block Blast (the arcade)

| Points | Gems |
|---|---|
| a block placed | 1 point per block |
| 1 · 2 · 3 · 4 · 5+ lines at once | 10 · 30 · 60 · 100 · 150+ points, × the combo |
| all clear (empty board) | +300 |
| every 300 points in a game | 1 gem (no daily limit since v2.8) |

Paced with a simulated careful player (looks ahead at all three pieces): half its games end
under ~1,500 points (5 gems), one in ten passes ~4,800 — so the daily 25 takes a few good games,
5,000 is a real achievement and 20,000 is rare. Pieces are dealt the kind way the original does
it: at least one of the three always fits when anything can, and a crowded board gets fewer
big pieces.

**Dragging like the original** (v2.4): the piece lifts so its bottom edge is a cell above your
finger, then moves `gain` × the finger's movement (1.6 by default). From the tray, the top-left
corner is 218–277 px of finger travel instead of 349–444 px, and the finger ends around row 5 —
for the middle rows it never leaves the tray area. Where it lands is worked out once per new spot
(the ghost and the lines that would clear, in the piece's colour), not every frame.

Smoothness: one canvas, redrawn only when something changes — it sleeps between moves and while
you hold a piece still. Everything is pre-drawn and only copied: blocks once per colour and size,
the board with its blocks once per move, the lifted piece with its soft shadow once per pick-up
(a blurred shadow redrawn every frame was the slowest thing in the game), every "Great!" once —
0.06 ms per drag frame and 0.07 ms per frame during a 4-line clear on a Mac (a phone has
16.7 ms). The canvas is drawn at 2× at most (an iPhone's 3× would be 2.25× the pixels on every
frame, for no visible gain on blocks).

**No warm phone** (v2.3): whatever covers the whole village — the game, a visit, a page like the
Town Hall — puts it to sleep once it has opened (`display: none`, so none of its ~100 animations
run and the animals stop); it wakes the moment the cover starts to go (a swipe-back included).
Before, the village kept animating unseen behind the game — 141 animations drawn every frame.
The sound chip also rests 4 s after the last sound (a running AudioContext keeps the phone's
audio hardware busy even in silence) and as soon as the app goes to the background.

The art and sounds are FamFi's own;
the name is a nod to the original game — rename the building before publishing beyond family.

**Snappier everywhere** (v2.4):

| What | Before | Now |
|---|---|---|
| Live-price dot, gift button, calendar coins, loading skeletons, legendary shine | animated a shadow / background — repainted every frame, forever | a ready-made layer that only fades or moves (GPU) |
| Floating tab bar, page headers | re-blurred what's under them every frame (over the village: always) | solid 96–97% colour — looks the same, costs nothing |
| Confetti canvas | stayed as an empty full-screen layer (≈5 MB) after the first confetti | on screen only while confetti falls, then freed |
| 15-second price check | redrew the whole Home screen every 15 s | redraws only when the status line would change |
| Saving prices | wrote years of price history to storage on every update | quotes at most once a minute (and when the app is put away); history at once |
| Block Blast drag frame | blurred shadow drawn block by block, every frame | one pre-drawn picture; nothing drawn while the finger rests |

## How often prices update (v2.6 – 2.7)

FamFi is for checking in on your money, not for watching tickers, so prices update calmly:

| When | What's fetched |
|---|---|
| You open the app, or come back to it | anything older than **15 minutes** |
| The app stays open | every price older than **an hour** (a check every 5 minutes, which usually finds nothing to do) |
| The US market opens (9:30 am New York) | the first prices of the day, at the next check |
| You're looking at or trading a stock / coin | that one, if older than **5 minutes** (for 10 minutes) |
| You tap **Update** next to the prices line on Home, or **pull down** on Home / Return / Dividend | everything, now (at most once a minute — free API limits) |
| The US market is shut (nights, weekends, holidays) and the closing prices are in | **no stock calls at all** until the next opening bell — those prices can't move (crypto, which trades 24/7, stays hourly) |
| A price service fails | it's tried again after 30 s, 2 min, 10 min, then hourly (a Wi-Fi blip heals in seconds; a service that's down isn't asked every 5 minutes) |
| The phone is offline | nothing is attempted; prices update when it's back online |

Before: own stocks every 30 s and the family's every 3 min while the US market was open (late
evening to early morning in Malaysia), crypto every 60 s around the clock (whether anyone held
any or not), and a check every 15 s. Each crypto refresh counted as "prices changed", so the
current screen (or the village) was rebuilt every minute, all day. Now a refresh that brings back
the same prices rebuilds nothing; the phone's radio wakes about once an hour instead of every
15–60 s. Measured with the fake-clock test: 8 hours with the app open and 13 stocks = 91 stock
calls and 8 crypto calls (before: up to 1,560 stock calls an hour and 480 crypto calls). The
status line says "Market open · prices from 10:41 pm" (no pulsing "Live" dot) and a weekday US
holiday still shows "Markets closed". The fake-clock test (`tests/test_market_pace.js`, 33 checks)
walks a whole week: a session (about one round of prices an hour), a night and a weekend (0 stock
calls), the opening bell, a weekday holiday, a service going down and coming back, and offline.

Not done, on purpose: one multi-ticker request instead of one per stock. Finnhub's free quote
endpoint takes one symbol per request; the requests go out together over one HTTP/2 connection
(one radio wake-up), so bundling would save nothing measurable — and Twelve Data's batch quotes
cost 1 credit per stock with an 8-a-minute limit, which a family's 13+ stocks would hit.

**Tab switches** (v2.7): a screen you've already seen is shown as it was if nothing it shows has
changed (records, prices, the family, language, settings, the day); before, every tap on a tab
rebuilt it from scratch (hundreds of elements, plus re-fitting labels). Switching back is about
twice as fast. **Nothing loops forever on screen any more** except spinners while something loads:
attention effects (the gem pill, ready dividends, the Shop's shine and streak flame, the gift glow)
play a few times and stop — a looping animation keeps the phone drawing 60 frames a second even
while you're only reading.


## The Lucky Market and the pond (v2.8)

| Item | Gems | What you get |
|---|---|---|
| Pet egg | 80 | a pet: common 62 % · rare 26 % · epic 9.5 % · legendary 2.5 % |
| Golden egg | 220 | rare 60 % · epic 30 % · legendary 10 % |
| Seed packet | 40 | a mystery plant (same odds as an egg) |
| Rare seed packet | 120 | rare 60 % · epic 30 % · legendary 10 % |
| Molotov | 15 | a house "on fire" for a day — visual only |
| Growth tonic · Pet treat | 20 | one extra day of growth · of feeding |
| Exclusive decorations | 260–420 | lucky clover · golden bells · fireworks (only ever sold here) |

Selling: a pet is worth 25 · 60 · 150 · 400 by rarity, ×1.8 grown, ×3.2 majestic; a plant
15 · 40 · 100 · 300 in bloom, up to double after 30 days (8 before it blooms). On average a pet
or plant sold straight away is worth less than its egg or seed, and more once you've raised it —
care pays (checked in the tests). Fishing: 5 casts a day; 2 · 4 · 8 · 20 gems by the fish's
rarity, +2 for a perfect stop — about 15 gems a day for a fair player.

**Smooth and cool by design** (the standing rule): pets, plants, the market and the pond sign are
still pictures — 0 running animations at rest (measured), no per-frame code, nothing on a timer;
taps only on what's drawn. The only motion is the flames on a house that's actually burning (4
GPU layers, paused off screen and while the map moves, like the rest of the village), finite
pops and wobbles, and the fishing needle — one GPU animation while you cast; its position comes
from the animation's own clock when you tap. Pan 0.02 ms and pinch 0.3 ms per step: unchanged.
Data: pets, plants and a Molotov live in the shared profile (`yard`), a plant's place on the map
is a family layout key (`pl_<id>`, deleted for everyone when sold); gems, the bag and the day's
stalls stay private.

## Market data

| What | Source | Key? | Notes |
|---|---|---|---|
| US stocks & ETFs — quotes + search | [Finnhub](https://finnhub.io) `/quote`, `/search`, `/stock/profile2` | free key | Real-time US quotes, straight from the browser — fetched **about once an hour** while the app is open (see *How often prices update* below), never more than the free 60 calls/min. |
| US stocks & ETFs — past prices | [Twelve Data](https://twelvedata.com) `/time_series` | free key | ~6 years of daily closes for charts and period returns, fetched once a day per stock in batches of 8 per minute (free: 8 credits/min, 800/day). |
| Crypto | CoinGecko public API | no | Only coins someone in the family holds; about once an hour. |
| Exchange rates | Frankfurter (European Central Bank); ExchangeRate-API fallback | no | Daily reference rates (checked every 12 h) + history, so past amounts convert at their own day's rate. |

**Keys:** copy `js/config.example.js` to `js/config.js` and paste both keys. `config.js` is
git-ignored but is deployed with the site (keys used in a browser are always visible to
visitors — fine for free keys; never put a paid key there). For a quick test without editing
files: `localStorage.setItem('famfi.keys', JSON.stringify({finnhubKey:'…', twelveDataKey:'…'}))`.
Without keys, stocks show labelled demo prices; with only Twelve Data, they show the last close.

Scope: the target audience invests in the **US market only**, so the catalogue is US stocks,
US ETFs and crypto. Older saved data with non-US assets is migrated on load (the demo family
is re-created; real users' records are set aside in `pf.retired`). Demo-family purchases are
re-priced to real closes once history arrives.

## Accounts & families (Firebase)

```
famfi/m/<uid>       fam (family id) · pub (profile) · money (what family may see: investments +
                    account balances — never categories, notes or budgets; with Family helpers on,
                    all records, marked share: 'full') · priv (everything: all records, budgets,
                    settings — only your own phones) · share { all, who, help }
famfi/f/<fid>       name · code · ownerId · created · members/<uid> · goals · layout · pets · hall
                    · help/<member>/<key> { by, at, o }  (changes the family recorded for someone)
famfi/codes/<code>  { f: <fid>, n: <family name> }
famfi/live/<fid>    on · g · eye (Block Blast live) · chat/<player>/<id> { u, at, t | e }
```

- The store stays local-first (instant, offline); `cloud.js` mirrors it. A person's own
  documents are stored whole as JSON `{ rev, by, d }` (`by`: which copy of the app wrote it);
  family data has many writers and is written key by key.
- **Two copies of one account never wipe each other out** (2.21). Each copy remembers the
  cloud version its data was built on (`base`) and sends nothing until it has seen the
  cloud's copy this session. If the cloud has a version this copy never saw *and* this copy
  changed things meanwhile (an old copy reopened — Safari next to the home-screen app, or
  another phone — or two phones used offline), the two are combined: the cloud's copy plus
  every record, account, budget, pet and plant added here (an automatic dividend found on
  both counts once). Before 2.21 the later clock simply won, so an old copy could replace
  newer pets, plants and records everywhere (`test_cloud.js` §16 reproduces it).
- **Rules** (`database.rules.json` at the hub root — deploy with
  `firebase deploy --only database`): only members read a family; joining needs the
  current code (the membership value must equal it); only the owner renames, changes the
  code, removes people or deletes the family; you only ever write your own documents.
  Your profile is readable by your family; your **money** only by family members you
  share at least one section with — hide every section from someone and the database
  refuses them your numbers. (Which *sections* a sharer sees is applied by the app.)
  Budgets and settings are never readable by anyone else.
- **Family helpers** (2.25): someone who lets their family help (on unless they say no — or
  have made anything private; Menu → Who can see my money) has their whole book in `money`,
  and family members may leave changes in their `help` mailbox: add / fix / delete an
  everyday record, or set an account's balance. Only the owner's own phone ever writes their
  records — it checks each change (`ledger.applyHelpOp`: real accounts, sensible values,
  everyday records only, never a trade or a starting balance), applies it (marked with who
  did it, "✍️ Mum"), then empties the mailbox once its records have reached the cloud. Until
  then everyone sees the change on top of their records ("waiting for their phone"). Applying
  a change twice changes nothing; the database refuses changes for anyone with help off
  (`share/help`), in someone else's name, or into your own mailbox; mailbox writes go on their
  own, so a refusal never holds up other syncing (`test_cloud.js` §18).
- Phones that used the old local-only version open on an "upgrade" screen: signing up
  carries their records into the new account (any data replaced by a sign-in is kept in
  `famfi.v1.backup`). The demo family never leaves the phone.
- Deleting a FamFi account removes everything: its data, its family membership (ownership
  passes on) and the sign-in itself. (Until 2026-10-06 the sign-in was shared with the
  repo's Monopoly and PushPal apps and was kept if they used it; both are retired.)

## Prototype notes

- When a source is unreachable, prices fall back to **deterministic demo data** stitched onto the last real prices, and the UI says so.
