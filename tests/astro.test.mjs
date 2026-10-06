import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signOf, separation, balance, findAspects, stelliums, dignity, chartRuler, findPatterns, analyzeChart,
} from '../astro/patterns.js';
import { chart } from './fixtures/chart-sample.js';

const types = (ps, t) => ps.filter((p) => p.type === t);
const same = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

test('signOf: boundaries, wrap, element and modality', () => {
  assert.deepEqual(signOf(0), { sign: 'aries', degree: 0, element: 'fire', modality: 'cardinal' });
  assert.equal(signOf(29.999).sign, 'aries');
  assert.equal(signOf(30).sign, 'taurus');
  assert.equal(signOf(359).sign, 'pisces');
  assert.equal(signOf(-1).sign, 'pisces');
  assert.equal(signOf(360).sign, 'aries');
  assert.deepEqual([signOf(140).element, signOf(140).modality], ['fire', 'fixed']);
  assert.deepEqual([signOf(160).element, signOf(160).modality], ['earth', 'mutable']);
});

test('separation wraps across 0° Aries', () => {
  assert.equal(separation(355, 5), 10);
  assert.equal(separation(10, 190), 180);
  assert.equal(separation(0, 270), 90);
});

test('aspects: within orb, out-of-sign allowed, outside orb rejected', () => {
  const asp = findAspects({ bodies: { sun: 29, moon: 31 } });
  assert.equal(asp[0].type, 'conjunction'); // Aries/Taurus, 2° apart
  assert.equal(findAspects({ bodies: { sun: 0, moon: 99 } }).length, 0); // square orb 7 < 9
  const sq = findAspects({ bodies: { sun: 143, saturn: 60 } });
  assert.equal(sq[0].type, 'square');
  assert.equal(sq[0].orb, 7);
});

test('dignities', () => {
  assert.equal(dignity('sun', 143), 'domicile'); // Leo
  assert.equal(dignity('venus', 160), 'fall'); // Virgo
  assert.equal(dignity('jupiter', 68), 'detriment'); // Gemini
  assert.equal(dignity('sun', 5), 'exaltation'); // Aries
  assert.equal(dignity('mars', 125), null); // Leo
  assert.equal(dignity('saturn', 125), 'detriment'); // Leo opposes Aquarius
});

test('sample chart: balance with angles', () => {
  const b = balance(chart);
  same(b.element.fire, ['sun', 'moon', 'mercury', 'mars', 'pluto', 'asc', 'mc']);
  same(b.element.air, ['jupiter', 'saturn', 'uranus', 'neptune']);
  same(b.element.earth, ['venus']);
  same(b.missingElements, ['water']);
});

test('sample chart: stelliums and chart ruler', () => {
  const s = stelliums(chart);
  assert.equal(s.bySign.length, 1);
  assert.equal(s.bySign[0].key, 'leo');
  same(s.bySign[0].bodies, ['sun', 'mercury', 'mars']);
  assert.equal(s.byHouse[0].key, '1');
  assert.deepEqual(chartRuler(chart), { planet: 'sun', ascSign: 'leo', sign: 'leo', house: 1, dignity: 'domicile' });
});

test('sample chart: reproduces the listed aspects', () => {
  const asp = findAspects(chart);
  const has = (a, b, t) => asp.some((x) => x.type === t && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
  const listed = [
    ['sun', 'mercury', 'conjunction'], ['sun', 'saturn', 'square'], ['sun', 'uranus', 'opposition'],
    ['moon', 'mars', 'trine'], ['moon', 'saturn', 'sextile'], ['moon', 'neptune', 'sextile'], ['moon', 'pluto', 'trine'],
    ['mercury', 'uranus', 'opposition'], ['venus', 'jupiter', 'square'], ['venus', 'pluto', 'square'],
    ['mars', 'jupiter', 'sextile'], ['mars', 'neptune', 'opposition'], ['mars', 'pluto', 'trine'],
    ['jupiter', 'neptune', 'trine'], ['jupiter', 'pluto', 'opposition'], ['saturn', 'neptune', 'trine'],
  ];
  for (const [a, b, t] of listed) assert.ok(has(a, b, t), `${a} ${t} ${b}`);
});

test('sample chart: fire grand trine, mutable T-square on Venus, two kites', () => {
  const p = findPatterns(chart);

  const gt = types(p, 'grand-trine');
  assert.equal(gt.length, 1);
  same(gt[0].members, ['moon', 'mars', 'pluto']);
  assert.equal(gt[0].element, 'fire');

  const ts = types(p, 't-square');
  assert.equal(ts.length, 1);
  assert.equal(ts[0].apex, 'venus');
  same(ts[0].members, ['jupiter', 'pluto', 'venus']);
  assert.equal(ts[0].modality, 'mutable');
  assert.equal(ts[0].emptyLegSign, 'pisces');

  // Two kites: Neptune opposite Mars, and Jupiter opposite Pluto (Jupiter sextiles Moon at 3° orb
  // and Mars at 3° in this sample; that Moon–Jupiter sextile is not in the source list).
  const kites = types(p, 'kite').map((k) => `${k.head}/${k.tail}`).sort();
  assert.deepEqual(kites, ['mars/neptune', 'pluto/jupiter']);

  assert.equal(types(p, 'grand-cross').length, 0);
  assert.equal(types(p, 'yod').length, 0);
});

test('synthetic grand cross and yod', () => {
  const cross = findPatterns({ bodies: { sun: 0, moon: 90, mars: 180, venus: 270 } });
  assert.equal(types(cross, 'grand-cross').length, 1);
  assert.equal(types(cross, 't-square').length, 4); // every cross contains four T-squares

  const yod = findPatterns({ bodies: { sun: 0, moon: 60, mars: 210 } });
  assert.equal(types(yod, 'yod').length, 1);
  assert.equal(types(yod, 'yod')[0].apex, 'mars');
});

test('analyzeChart without houses or angles degrades cleanly', () => {
  const r = analyzeChart({ bodies: { sun: 10, moon: 130 } });
  assert.equal(r.chartRuler, null);
  assert.equal(r.angles, null);
  assert.deepEqual(r.stelliums.byHouse, []);
  assert.equal(r.placements.sun.house, null);
});
