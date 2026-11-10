/* Family Finance — runs the engine tests (tests/test_calc.js) with Node.
   The engine files are plain scripts with no DOM, so they are loaded one after
   another into one fresh JS "context" (a sandbox with its own global object),
   exactly as the browser loads them with <script> tags.
   Run from anywhere:  node tests/run_engine.js            (all engine tests)
                       node tests/run_engine.js tests/test_books.js   (one file)   */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENGINE = ['js/core.js', 'js/data.js', 'js/calc.js', 'js/ledger.js', 'js/play.js', 'js/lucky.js', 'js/blast.js', 'js/grid.js', 'js/store.js', 'js/market.js'];
// engine files added by Family Finance (loaded only if they exist, so this runner works at every step)
const EXTRA = ['js/books.js', 'js/plan.js', 'js/insights.js', 'js/recur.js'];
const tests = process.argv.slice(2);
if (!tests.length) tests.push('tests/test_calc.js');

let failed = false;
tests.forEach((testFile) => {
  const ctx = { console, setTimeout, clearTimeout, Intl, Date, Math, JSON };
  ctx.print = (...a) => {
    const line = a.join(' ');
    if (/^\s*✗/.test(line) || / [1-9]\d* failed/.test(line)) failed = true;
    console.log(line);
  };
  ctx.load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f.replace(/^FamFi\//, '')), 'utf8'), ctx, { filename: f });
  vm.createContext(ctx);
  ENGINE.concat(EXTRA.filter((f) => fs.existsSync(path.join(ROOT, f)))).forEach((f) => ctx.load(f));
  ctx.load(testFile);
});
process.exit(failed ? 1 : 0);
