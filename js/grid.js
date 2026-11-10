/* ============================================================
   FamFi — grid.js
   The village land: isometric tile grid, landmarks, trees and
   "can a house go here?" rules. Shared by the store (placing new
   houses) and the village renderer.
   ============================================================ */
(function (root) {
  'use strict';
  const FF = root.FF;

  const W = 1000, H = 1500;      // world size in px (the bigger map was too heavy for iPhones)
  const SH = { x: 0, y: 0 };     // no shift: positions are the village's own
  const TW = 24, TH = 12;        // half tile width / height (tile = 48×24)
  const OX = 500, OY = 0;        // world position of tile corner (0,0)
  const FP = 3;                  // house footprint = 3×3 tiles

  const toWorld = (i, j) => ({ x: OX + (i - j) * TW, y: OY + (i + j) * TH });
  const toTile = (x, y) => { const a = (x - OX) / TW, b = (y - OY) / TH; return { i: (a + b) / 2, j: (b - a) / 2 }; };
  const center = (i, j) => toWorld(i + FP / 2, j + FP / 2);
  const snap = (x, y) => { const t = toTile(x, y); return { i: Math.round(t.i - FP / 2), j: Math.round(t.j - FP / 2) }; };
  /* every tile whose centre can land in the world */
  function tileRange() {
    const c = [toTile(0, 0), toTile(W, 0), toTile(0, H), toTile(W, H)];
    return { i0: Math.floor(Math.min.apply(null, c.map((p) => p.i))) - 2, i1: Math.ceil(Math.max.apply(null, c.map((p) => p.i))), j0: Math.floor(Math.min.apply(null, c.map((p) => p.j))) - 2, j1: Math.ceil(Math.max.apply(null, c.map((p) => p.j))) };
  }
  /* the land's outline: a rounded square (superellipse) with a gentle wobble */
  const LC = { x: W / 2, y: H / 2 + 20, ax: W / 2 - 40, ay: H / 2 - 70, n: 4.2 };
  function landPoints(stepDeg) {
    const out = [];
    for (let a = 0; a < 360; a += (stepDeg || 4)) {
      const t = (a * Math.PI) / 180;
      const c = Math.cos(t), s = Math.sin(t);
      const rr = Math.pow(Math.pow(Math.abs(c), LC.n) + Math.pow(Math.abs(s), LC.n), -1 / LC.n);
      const wob = 1 + 0.018 * Math.sin(a * 0.13 * 6) + 0.012 * Math.sin(a * 0.31 * 5);
      out.push([LC.x + LC.ax * rr * c * wob, LC.y + LC.ay * rr * s * wob]);
    }
    return out;
  }
  /* inside the land's outline, keeping mx / (top, bottom) margins (animals, pets) */
  function inside(x, y, mx, mt, mb) {
    const dx = (x - LC.x) / (LC.ax - (mx || 0));
    const dy = (y - LC.y) / (LC.ay - (y < LC.y ? (mt || 0) : (mb || 0)));
    return Math.pow(Math.abs(dx), LC.n) + Math.pow(Math.abs(dy), LC.n) < 1;
  }

  /* landmarks & scenery (world coords). r = keep-clear radius */
  const LANDMARKS = [
    { id: 'familyTree', kind: 'familyTree', x: 250, y: 500, r: 100 },
    { id: 'windmill', kind: 'windmill', x: 800, y: 440, r: 78 },
    { id: 'well', kind: 'well', x: 285, y: 1095, r: 48 },
    { id: 'sign', kind: 'signpost', x: 585, y: 1385, r: 30 },
    { id: 'lamp1', kind: 'lamp', x: 432, y: 760, r: 16 },
    { id: 'lamp2', kind: 'lamp', x: 598, y: 935, r: 16 },
    { id: 'lamp3', kind: 'lamp', x: 470, y: 1250, r: 16 },
    { id: 'bench1', kind: 'bench', x: 588, y: 1228, r: 26 },
    { id: 'bench2', kind: 'bench', x: 370, y: 590, r: 26 }
  ];
  const POND = { x: 725, y: 1145, rx: 150, ry: 82 };
  const PLAZA = { x: 505, y: 840, r: 112 };
  const TREES = [
    [118, 330, 'pine'], [205, 262, 'pine'], [352, 262, 'oak'], [520, 250, 'blossom'], [650, 300, 'pine'], [728, 238, 'oak'], [902, 318, 'pine'],
    [92, 640, 'oak'], [122, 820, 'pine'], [912, 640, 'oak'], [890, 800, 'blossom'],
    [100, 1010, 'oak'], [140, 1215, 'pine'], [905, 985, 'pine'], [915, 1330, 'oak'],
    [252, 1335, 'blossom'], [372, 1415, 'pine'], [686, 1405, 'oak'], [838, 1428, 'pine'],
    [438, 1175, 'bush'], [640, 580, 'bush'], [205, 820, 'bush'], [790, 720, 'bush'], [552, 1310, 'bush'], [300, 690, 'bush']
  ].map((t, k) => ({ id: 'tree' + k, kind: t[2], x: t[0], y: t[1], r: t[2] === 'bush' ? 22 : 32 }));

  function inWater(x, y, mx, my) {
    const px = (x - POND.x) / (POND.rx + (mx || 0)), py = (y - POND.y) / (POND.ry + (my || 0));
    return px * px + py * py < 1;
  }
  /* small: a plant (a little thing needs far less room around trees and the pond than a house).
     The keep-clear room around trees and landmarks is their own size plus 36 px (was 60: with the
     old rectangle below, only 275 of the island's 2,030 spots could take a building — now ~520). */
  function blockedAt(x, y, small) {
    if (small ? inWater(x, y, 22, 14) : inWater(x, y, 56, 40)) return true; // pond (with margin)
    const all = LANDMARKS.concat(TREES);
    for (let k = 0; k < all.length; k++) {
      const b = all[k];
      const dx = x - b.x, dy = (y - b.y) * 1.6; // iso: vertical distances count more
      if (dx * dx + dy * dy < Math.pow(b.r + (small ? 14 : 36), 2)) return true;
    }
    return false;
  }
  /* Where a thing's ground spot may sit: on the island's own outline, kept in by its size —
     side (half its width), top (its footprint; the camera can look a little past the map's top,
     so a roof there is still seen) and bottom. Before 2.24 a fixed rectangle (y 300–1330, x 150–850)
     cut off the whole top of the island and both sides. */
  const ROOM = { house: [84, 40, 50], big: [104, 48, 56], plant: [26, 16, 20] };
  const fits = (x, y, kind) => { const m = ROOM[kind] || ROOM.house; return inside(x, y, m[0], m[1], m[2]); };
  /* on the island at all (lenient — anything placed under the old rules counts; used to bring back
     only what is really off the land) */
  const inLand = (x, y) => inside(x, y, 40, 0, 20);
  /* what kind of thing an id is: a plant (one small tile), a big building, or a house-sized one */
  const kindOf = (id) => (id && id.indexOf('pl_') === 0 ? 'plant' : id === '_hall' || id === '_arcade' || id === '_lucky' ? 'big' : 'house');
  /* how many tiles apart two things must be (house art is wider than its footprint; the Town
     Hall, the arcade and the Lucky Market are about twice as wide; plants are small) */
  function gapOf(a, b) {
    if (a === 'plant' && b === 'plant') return 2;
    if (a === 'plant' || b === 'plant') return a === 'big' || b === 'big' ? 4 : 3;
    return FP + 1 + (a === 'big' || b === 'big' ? 2 : 0);
  }
  /* occupied: [{id, i, j}] (houses, buildings, plants). selfId is ignored for overlap. */
  function valid(i, j, occupied, selfId) {
    const c = center(i, j), me = kindOf(selfId);
    if (!fits(c.x, c.y, me)) return false;
    if (blockedAt(c.x, c.y, me === 'plant')) return false;
    for (let k = 0; k < occupied.length; k++) {
      const o = occupied[k];
      if (o.id === selfId) continue;
      const gap = gapOf(me, kindOf(o.id));
      if (Math.abs(o.i - i) < gap && Math.abs(o.j - j) < gap) return false;
    }
    return true;
  }
  function nearestFree(x, y, occupied, selfId) {
    const s = snap(x, y);
    const cands = [];
    for (let di = -14; di <= 14; di++) for (let dj = -14; dj <= 14; dj++) cands.push([di, dj]);
    cands.sort((a, b) => {
      const ca = center(s.i + a[0], s.j + a[1]), cb = center(s.i + b[0], s.j + b[1]);
      return Math.hypot(ca.x - x, (ca.y - y) * 1.4) - Math.hypot(cb.x - x, (cb.y - y) * 1.4);
    });
    for (let k = 0; k < cands.length; k++) {
      const i = s.i + cands[k][0], j = s.j + cands[k][1];
      if (valid(i, j, occupied, selfId)) return { i, j };
    }
    return s;
  }

  FF.grid = { W, H, SH, TW, TH, OX, OY, FP, LC, LANDMARKS, POND, PLAZA, TREES, toWorld, toTile, center, snap, tileRange, landPoints, inside, inLand, fits, inWater, valid, nearestFree, blockedAt, kindOf, HEADROOM: { top: 150, bottom: 70 } };
})(typeof window !== 'undefined' ? window : this);
