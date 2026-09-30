// Scoring: reverse-keying, scale means, z vs norms, percentile, SEM and 90% CI.
// All computation is local; nothing here touches the network or storage.

import { Z90, percentileFromZ, clamp, assertAlpha } from './stats.js';

export const LIKERT = Object.freeze({ min: 1, max: 5 });
// A scale is scored only if at least this share of its items were answered.
export const DEFAULT_MIN_COVERAGE = 0.8;

export function isValidResponse(v, scale = LIKERT) {
  return Number.isInteger(v) && v >= scale.min && v <= scale.max;
}

export function reverseKey(response, keyed, scale = LIKERT) {
  if (keyed === 1) return response;
  if (keyed === -1) return scale.min + scale.max - response;
  throw new RangeError(`keyed must be +1 or -1, got ${keyed}`);
}

/**
 * @param {Array<{id:string, scale:string, keyed:1|-1}>} items
 * @param {Record<string, number|null|undefined>} responses  item id -> 1..5
 * @returns {Record<string, {mean:number|null, answered:number, total:number, missing:string[], invalid:string[]}>}
 */
export function scoreScales(items, responses, { minCoverage = DEFAULT_MIN_COVERAGE, likert = LIKERT } = {}) {
  const acc = {};
  for (const item of items) {
    const s = (acc[item.scale] ??= { sum: 0, answered: 0, total: 0, missing: [], invalid: [] });
    s.total += 1;
    const r = responses[item.id];
    if (r === null || r === undefined) {
      s.missing.push(item.id);
    } else if (!isValidResponse(r, likert)) {
      s.invalid.push(item.id);
    } else {
      s.sum += reverseKey(r, item.keyed, likert);
      s.answered += 1;
    }
  }
  const out = {};
  for (const [scale, s] of Object.entries(acc)) {
    const enough = s.answered > 0 && s.answered / s.total >= minCoverage;
    out[scale] = {
      mean: enough ? s.sum / s.answered : null,
      answered: s.answered,
      total: s.total,
      missing: s.missing,
      invalid: s.invalid,
    };
  }
  return out;
}

/**
 * Standardize a raw scale mean against a norm row.
 * The CI is the observed score ± 1.645·SEM, SEM = SD·√(1−α). It is clipped to the
 * response range and carried through to z and percentile so the UI renders a band.
 */
export function standardize(mean, norm, { likert = LIKERT } = {}) {
  if (mean === null || mean === undefined) return null;
  const { mean: mu, sd, alpha } = norm;
  if (!(sd > 0)) throw new RangeError(`sd must be > 0, got ${sd}`);
  assertAlpha(alpha);
  const sem = sd * Math.sqrt(1 - alpha);
  const half = Z90 * sem;
  const lo = clamp(mean - half, likert.min, likert.max);
  const hi = clamp(mean + half, likert.min, likert.max);
  const z = (mean - mu) / sd;
  const zLo = (lo - mu) / sd;
  const zHi = (hi - mu) / sd;
  return {
    raw: mean,
    rawCI90: [lo, hi],
    sem,
    z,
    zCI90: [zLo, zHi],
    percentile: percentileFromZ(z),
    percentileCI90: [percentileFromZ(zLo), percentileFromZ(zHi)],
    percentileMethod: 'normal-approximation',
  };
}

/**
 * Score every scale that has a norm. Scales without a norm keep raw means only.
 */
export function scoreProfile(items, responses, norms, opts = {}) {
  const raw = scoreScales(items, responses, opts);
  const out = {};
  for (const [scale, r] of Object.entries(raw)) {
    const norm = norms[scale];
    out[scale] = { ...r, standardized: norm ? standardize(r.mean, norm, opts) : null };
  }
  return out;
}
