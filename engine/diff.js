// Reliable-difference test between two scales.
// Works in z units so scales with different norm SDs are comparable:
// SE_diff(z) = √(2 − α1 − α2); reliable iff |zA − zB| > 1.645·SE_diff.
// (Equivalent to 1.645·SD·√(2−α1−α2) on a raw metric only when both SDs are equal.)

import { Z90, assertAlpha } from './stats.js';

export function reliableDifference(zA, zB, alphaA, alphaB, crit = Z90) {
  assertAlpha(alphaA);
  assertAlpha(alphaB);
  if (zA === null || zB === null || zA === undefined || zB === undefined) {
    return { diff: null, threshold: null, reliable: false };
  }
  const threshold = crit * Math.sqrt(2 - alphaA - alphaB);
  const diff = zA - zB;
  return { diff, threshold, reliable: Math.abs(diff) > threshold };
}
