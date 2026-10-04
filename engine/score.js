// Scoring on a 1–5 scale: reverse-keying, scale means, z vs norms, percentile,
// SEM and 90% CI, and reliable differences between scales. Pure functions, no I/O.

export const Z90 = 1.645;
export const MIN_COVERAGE = 0.8; // share of a scale's items that must be answered to score it

export const isAnswer = (v) => Number.isInteger(v) && v >= 1 && v <= 5;

export function reverseKey(r, keyed) {
  if (keyed !== 1 && keyed !== -1) throw new RangeError(`keyed must be +1 or -1, got ${keyed}`);
  return keyed === 1 ? r : 6 - r;
}

function checkAlpha(alpha) {
  if (!(alpha > 0 && alpha < 1)) throw new RangeError(`alpha must be in (0,1), got ${alpha}`);
}

// Abramowitz & Stegun 7.1.26, |error| < 1.5e-7.
export function normalCdf(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-x * x);
  return 0.5 * (1 + Math.sign(z) * erf);
}

// Clamped to [0.1, 99.9] so the engine never claims "0th" or "100th".
export const percentileFromZ = (z) => Math.min(99.9, Math.max(0.1, normalCdf(z) * 100));

/**
 * @param {Array<{id:string, scale:string, keyed:1|-1}>} items
 * @param {Record<string, number|null|undefined>} responses  item id -> 1..5
 */
export function scoreScales(items, responses, { minCoverage = MIN_COVERAGE } = {}) {
  const out = {};
  for (const { id, scale, keyed } of items) {
    const s = (out[scale] ??= { mean: null, sum: 0, answered: 0, total: 0, missing: [], invalid: [] });
    const r = responses[id];
    s.total += 1;
    if (r == null) s.missing.push(id);
    else if (!isAnswer(r)) s.invalid.push(id);
    else { s.sum += reverseKey(r, keyed); s.answered += 1; }
  }
  for (const s of Object.values(out)) {
    if (s.answered > 0 && s.answered / s.total >= minCoverage) s.mean = s.sum / s.answered;
    delete s.sum;
  }
  return out;
}

/**
 * Observed score ± 1.645·SEM, SEM = SD·√(1−α), clipped to 1–5 and carried through
 * to z and percentile so the UI always renders a band.
 */
export function standardize(mean, { mean: mu, sd, alpha }) {
  if (mean == null) return null;
  if (!(sd > 0)) throw new RangeError(`sd must be > 0, got ${sd}`);
  checkAlpha(alpha);
  const sem = sd * Math.sqrt(1 - alpha);
  const toZ = (x) => (x - mu) / sd;
  const lo = Math.max(1, mean - Z90 * sem);
  const hi = Math.min(5, mean + Z90 * sem);
  return {
    raw: mean,
    rawCI90: [lo, hi],
    sem,
    z: toZ(mean),
    zCI90: [toZ(lo), toZ(hi)],
    percentile: percentileFromZ(toZ(mean)),
    percentileCI90: [percentileFromZ(toZ(lo)), percentileFromZ(toZ(hi))],
    percentileMethod: 'normal-approximation',
  };
}

// Scales without a norm keep raw means only.
export function scoreProfile(items, responses, norms, opts) {
  const out = scoreScales(items, responses, opts);
  for (const [scale, s] of Object.entries(out)) {
    s.standardized = norms[scale] ? standardize(s.mean, norms[scale]) : null;
  }
  return out;
}

// Reliable difference in z units, so scales with different norm SDs compare:
// reliable iff |zA − zB| > 1.645·√(2 − αA − αB).
export function reliableDifference(zA, zB, alphaA, alphaB) {
  checkAlpha(alphaA);
  checkAlpha(alphaB);
  if (zA == null || zB == null) return { diff: null, threshold: null, reliable: false };
  const threshold = Z90 * Math.sqrt(2 - alphaA - alphaB);
  const diff = zA - zB;
  return { diff, threshold, reliable: Math.abs(diff) > threshold };
}
