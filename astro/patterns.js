// Chart geometry: signs, elements, modalities, aspects, stelliums, chart ruler,
// dignities, and named aspect patterns. Pure functions, no I/O.
// Output is geometry only. Interpretation lives in content templates (tier C),
// and nothing here reads or writes personality-measurement data.
//
// Input chart: { bodies: { sun: 143.2, ... }, angles?: { asc, mc }, houses?: { sun: 1, ... } }
// Longitudes are tropical ecliptic degrees, 0 = 0° Aries.

export const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const ELEMENTS = ['fire', 'earth', 'air', 'water'];
const MODALITIES = ['cardinal', 'fixed', 'mutable'];

export const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

// Orb conventions vary by school; these are common modern defaults, overridable.
export const ASPECTS = {
  conjunction: { angle: 0, orb: 8 },
  sextile: { angle: 60, orb: 5 },
  square: { angle: 90, orb: 7 },
  trine: { angle: 120, orb: 8 },
  quincunx: { angle: 150, orb: 3 },
  opposition: { angle: 180, orb: 8 },
};

// Traditional rulers, with modern co-rulers for Scorpio, Aquarius, Pisces.
const RULERS = {
  aries: ['mars'], taurus: ['venus'], gemini: ['mercury'], cancer: ['moon'], leo: ['sun'],
  virgo: ['mercury'], libra: ['venus'], scorpio: ['mars', 'pluto'], sagittarius: ['jupiter'],
  capricorn: ['saturn'], aquarius: ['saturn', 'uranus'], pisces: ['jupiter', 'neptune'],
};
const EXALTATION = { sun: 'aries', moon: 'taurus', mercury: 'virgo', venus: 'pisces', mars: 'capricorn', jupiter: 'cancer', saturn: 'libra' };

const norm = (lon) => ((lon % 360) + 360) % 360;
const opposite = (sign) => SIGNS[(SIGNS.indexOf(sign) + 6) % 12];

export function signOf(lon) {
  const i = Math.floor(norm(lon) / 30);
  return { sign: SIGNS[i], degree: norm(lon) - i * 30, element: ELEMENTS[i % 4], modality: MODALITIES[i % 3] };
}

// Shortest angular distance, 0..180.
export const separation = (a, b) => {
  const d = Math.abs(norm(a) - norm(b));
  return d > 180 ? 360 - d : d;
};

function points(chart, includeAngles) {
  const pts = Object.entries(chart.bodies);
  if (includeAngles && chart.angles) pts.push(...Object.entries(chart.angles));
  return pts;
}

export function balance(chart, { includeAngles = true } = {}) {
  const element = Object.fromEntries(ELEMENTS.map((e) => [e, []]));
  const modality = Object.fromEntries(MODALITIES.map((m) => [m, []]));
  for (const [name, lon] of points(chart, includeAngles)) {
    const s = signOf(lon);
    element[s.element].push(name);
    modality[s.modality].push(name);
  }
  return { element, modality, missingElements: ELEMENTS.filter((e) => !element[e].length) };
}

// Every pair within orb of a defined aspect, tightest-first per pair.
export function findAspects(chart, { aspects = ASPECTS, includeAngles = false } = {}) {
  const pts = points(chart, includeAngles);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const sep = separation(pts[i][1], pts[j][1]);
      for (const [type, { angle, orb }] of Object.entries(aspects)) {
        const off = Math.abs(sep - angle);
        if (off <= orb) out.push({ a: pts[i][0], b: pts[j][0], type, orb: off });
      }
    }
  }
  return out;
}

export function stelliums(chart, { min = 3 } = {}) {
  const group = (keyOf) => {
    const g = {};
    for (const [name, lon] of Object.entries(chart.bodies)) {
      const k = keyOf(name, lon);
      if (k != null) (g[k] ??= []).push(name);
    }
    return Object.entries(g).filter(([, v]) => v.length >= min).map(([key, bodies]) => ({ key, bodies }));
  };
  return {
    bySign: group((_, lon) => signOf(lon).sign),
    byHouse: chart.houses ? group((name) => chart.houses[name]) : [],
  };
}

export function dignity(planet, lon) {
  const { sign } = signOf(lon);
  if (RULERS[sign].includes(planet)) return 'domicile';
  if (EXALTATION[planet] === sign) return 'exaltation';
  if (RULERS[opposite(sign)].includes(planet)) return 'detriment';
  if (EXALTATION[planet] && opposite(EXALTATION[planet]) === sign) return 'fall';
  return null;
}

// Ruler of the Ascendant sign (traditional ruler first).
export function chartRuler(chart) {
  if (chart.angles?.asc == null) return null;
  const ascSign = signOf(chart.angles.asc).sign;
  const planet = RULERS[ascSign][0];
  const lon = chart.bodies[planet];
  return {
    planet,
    ascSign,
    sign: lon == null ? null : signOf(lon).sign,
    house: chart.houses?.[planet] ?? null,
    dignity: lon == null ? null : dignity(planet, lon),
  };
}

// ---- named patterns, built from the aspect list ----

function aspectIndex(list) {
  const idx = new Map();
  for (const { a, b, type } of list) {
    idx.set(`${a}|${b}|${type}`, true);
    idx.set(`${b}|${a}|${type}`, true);
  }
  return (a, b, type) => idx.has(`${a}|${b}|${type}`);
}

const combos3 = (xs) => xs.flatMap((a, i) => xs.slice(i + 1).flatMap((b, j) => xs.slice(i + j + 2).map((c) => [a, b, c])));

export function findPatterns(chart, opts = {}) {
  const list = findAspects(chart, opts);
  const has = aspectIndex(list);
  const names = [...new Set(list.flatMap((x) => [x.a, x.b]))];
  const lonOf = (n) => chart.bodies[n] ?? chart.angles?.[n];
  const out = [];

  // Grand trine: three mutual trines.
  const grandTrines = combos3(names).filter(([a, b, c]) => has(a, b, 'trine') && has(b, c, 'trine') && has(a, c, 'trine'));
  for (const members of grandTrines) {
    const els = new Set(members.map((m) => signOf(lonOf(m)).element));
    out.push({ type: 'grand-trine', members, element: els.size === 1 ? [...els][0] : null });
  }

  // T-square: an opposition whose ends both square a third point (the apex).
  const oppositions = list.filter((x) => x.type === 'opposition');
  for (const { a, b } of oppositions) {
    for (const apex of names) {
      if (apex !== a && apex !== b && has(apex, a, 'square') && has(apex, b, 'square')) {
        const apexSign = signOf(lonOf(apex)).sign;
        out.push({
          type: 't-square',
          members: [a, b, apex],
          apex,
          modality: signOf(lonOf(apex)).modality,
          emptyLegSign: opposite(apexSign),
        });
      }
    }
  }

  // Grand cross: two oppositions whose four ends all square each other.
  for (let i = 0; i < oppositions.length; i++) {
    for (let j = i + 1; j < oppositions.length; j++) {
      const [p, q] = [oppositions[i], oppositions[j]];
      const four = [p.a, p.b, q.a, q.b];
      if (new Set(four).size === 4 && [p.a, p.b].every((x) => has(x, q.a, 'square') && has(x, q.b, 'square'))) {
        out.push({ type: 'grand-cross', members: four });
      }
    }
  }

  // Yod: two points in sextile, both quincunx a third (the apex).
  for (const { a, b } of list.filter((x) => x.type === 'sextile')) {
    for (const apex of names) {
      if (apex !== a && apex !== b && has(apex, a, 'quincunx') && has(apex, b, 'quincunx')) {
        out.push({ type: 'yod', members: [a, b, apex], apex });
      }
    }
  }

  // Kite: a grand trine plus a point opposite one vertex and sextile the other two.
  for (const gt of grandTrines) {
    for (const head of gt) {
      const others = gt.filter((x) => x !== head);
      for (const tail of names) {
        if (!gt.includes(tail) && has(tail, head, 'opposition') && others.every((o) => has(tail, o, 'sextile'))) {
          out.push({ type: 'kite', members: [...gt, tail], head, tail });
        }
      }
    }
  }

  return out;
}

export function analyzeChart(chart, opts = {}) {
  const placements = Object.fromEntries(
    Object.entries(chart.bodies).map(([name, lon]) => [
      name,
      { ...signOf(lon), house: chart.houses?.[name] ?? null, dignity: PLANETS.includes(name) ? dignity(name, lon) : null },
    ]),
  );
  return {
    placements,
    angles: chart.angles ? Object.fromEntries(Object.entries(chart.angles).map(([k, v]) => [k, signOf(v)])) : null,
    balance: balance(chart, opts),
    aspects: findAspects(chart, opts),
    stelliums: stelliums(chart, opts),
    chartRuler: chartRuler(chart),
    patterns: findPatterns(chart, opts),
  };
}
