"""Checks every i18n key used in the code exists in all three dictionaries.
Run: python3 tests/check_strings.py"""
import re, glob, sys, os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
def keys_of(path):
    s = open(path, encoding='utf-8').read()
    return set(re.findall(r"'([a-zA-Z0-9_.]+)':\s*'", s))
code = ''.join(open(p, encoding='utf-8').read() for p in glob.glob('js/*.js') if 'strings-' not in p)
static = set(k for k in re.findall(r"\bt\('([a-zA-Z0-9_.]+)'", code) if not k.endswith('.'))
literals = set(re.findall(r"'([a-z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+)'", code))
dyn = {
  'tab': ['family','home','return','alloc','div','manage','menu'],
  'period': ['1m','3m','ytd','1y','all'], 'ret.period': ['1m','3m','ytd','1y','all'],
  'type': ['stock','etf','crypto','cash','stockShort','etfShort','cryptoShort'],
  'sector': ['banks','tech','energy','utilities','health','consumer','telecom','property','broad','bonds','gold','transport','crypto','other'],
  'cur': ['MYR','USD','SGD','THB'], 'alloc.by': ['type','sector','currency'],
  'man.tab': ['records','holdings','accounts','currency'],
  'trade': ['buy','sell','dividend','deposit','withdraw','buyS','sellS','dividendS','depositS','withdrawS','expense','income','transfer','expenseS','incomeS','transferS'],
  'trade.cta': ['buy','sell','dividend','deposit','withdraw'], 'trade.sum': ['buy','sell','dividend','deposit','withdraw'],
  'privacy.sec': ['netWorth','holdings','returns','dividends'], 'privacy.mode': ['family','some','me'], 'privacy.modeSub': ['family','some','me'],
  'privacy.lockedBody': ['netWorth','holdings','returns','dividends'], 'level.name': ['1','2','3','4','5','6'],
  'cat': ['food','groceries','shopping','housing','bills','transport','health','education','family','fun','travel','gifts','insurance','fees','other','salary','bonus','business','interest','rental','giftIn','refund','otherIn'],
  'acct.kind': ['cash','bank','ewallet','savings','credit','broker','crypto','retire','loan','other'], 'hall.kind': ['fund','property','savings','business','gold','vehicle','other'],
  'rec.f': ['all','spend','income','transfer','invest'], 'trade.group': ['everyday','investing'], 'quick': ['expense','income','transfer'],
  'rec.save': ['expense','income','transfer'], 'rec.sum': ['expense','income','transfer'], 'rec.done': ['expense','income','transfer'], 'rec.notePh': ['expense','income','transfer'],
  'div.status': ['received','coming','estimated'], 'cust.roof': ['gable','hip','steep'], 'cust.wall': ['plaster','wood','brick'], 'cust.door': ['arch','square','round'],
  'cust.tab': ['roof','walls','door','flag','garden','sign'], 'cust.decor': ['flowers','fence','mailbox','lantern','bench','bush','fountain'],
  'goals.s': ['g1','g2','g3','g4','g5','g6'], 'lang': ['en','zh','th'],
  'shop.slot': ['roof','door','yard','sky'], 'shop.r': ['common','rare','epic','legendary'], 'shop.tab': ['deco','pets'],
  'badges.tier': ['bronze','silver','gold','diamond'], 'bb.p': ['good','great','excellent','amazing','unbelievable'],
  'bb': ['h1','h2','h3','h4','h5'],
  # the Lucky Market (lucky.js / screens-lucky.js)
  'lk.i': ['egg','goldegg','seed','rareseed','molotov','tonic','treat'] + [x + '.b' for x in ['egg','goldegg','seed','rareseed','molotov','tonic','treat']],
  'lp': ['chick','hamster','frog','otter','koala','kitsune','unicorn','phoenix'], 'lp.form': ['0','1','2'],
  'lpl': ['sunflower','tulip','rose','lavender','bonsai','crystal','moneytree'], 'lpl.stage': ['0','1','2','3','4'],
  'lf.fish': ['minnow','carp','koi','goldkoi','pearl'], 'lf': ['perfect','good','miss'],
  # the News mailbox (news.js / screens-news.js)
  'news.tab': ['world','my','market'],
  # the Mystery Man (screens-sage.js)
  # the Block Blast chat (screens-blast.js)
  'chat.quick': ['p1','p2','p3','w1','w2','w3'],
  'help.t': ['expense','income','transfer'],
  'sage.cat': ['earth','world','my','science','space','animals','body','money','history'], 'sage.hello': ['1','2','3','4','5'],
}
DECOR = ['wreath','lanterns','luckycat','nest','lights','roofcat','vane','gnome','birdbath','pumpkins','snowman','koi','kite','balloon','rainbow','clover','goldbell','fireworks']
XPETS = ['bunny','shiba','penguin','redpanda','capybara','tapir','fox','dragon']
BADGES = ['first_holding','setup_done','first_dividend','diversified','on_budget','streak_4','team_player','village_builder',
  'checkin_30','logger_100','budget_3','saver_20','div_12','house_3','decorator','checkin_100','budget_6','saver_3','house_5','collector','checkin_365','logger_365','millionaire',
  'bb_5k','bb_20k','green_thumb','angler','pet_majestic']
need = set(static)
for pre, items in dyn.items():
    for i in items: need.add(pre + '.' + i)
for b in BADGES:
    need |= {'badge.'+b, 'badge.'+b+'.how'}
for d in DECOR:
    need |= {'deco.'+d, 'deco.'+d+'.b'}
for p in XPETS:
    need |= {'xpet.%s.%s' % (p, k) for k in ['name','bio','say1','say2','say3']}
for p in ['chicken','chick','puppy','cat','duck','pig']:
    need |= {'pet.%s.%s' % (p, k) for k in ['name','bio','how','say1','say2','say3']}
for k in ['what','prices','safe','who','stocks','family','offline','install']:
    need |= {'help.%s.q' % k, 'help.%s.a' % k}
for k in ['netWorth','gain','invested','moneyIn','cash','return','priceGrowth','dividend','fees','diversify','stock','etf','crypto','currency','price','avgCost','yield']:
    need |= {'learn.%s.t' % k, 'learn.%s.b' % k}
bad = 0
for lang in ['en','zh','th']:
    if not os.path.exists('js/strings-%s.js' % lang): print(lang, 'MISSING FILE'); bad += 1; continue
    have = keys_of('js/strings-%s.js' % lang)
    base = {k.rsplit('_',1)[0] if k.endswith(('_one','_other')) else k for k in have}
    missing = sorted(k for k in need if k not in have and k not in base)
    extra = sorted(k for k in base if k not in need and k not in literals) if lang == 'en' else []
    if lang != 'en':
        en = keys_of('js/strings-en.js')
        norm = lambda k: k.rsplit('_', 1)[0] if k.endswith(('_one', '_other')) else k
        missing += sorted(norm(k) for k in en if k not in have and norm(k) not in have and norm(k) not in base)
    print(lang, 'keys:', len(have), 'missing:', len(set(missing)))
    for k in sorted(set(missing)): print('   -', k)
    if extra: print('   unused in code (ok if intentional):', ', '.join(extra))
    bad += len(set(missing))
sys.exit(1 if bad else 0)
