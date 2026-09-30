// Pure numeric helpers. No I/O.

export const Z90 = 1.645;

// Abramowitz & Stegun 7.1.26 erf approximation, |error| < 1.5e-7.
export function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// Percentile in [0.1, 99.9] so the UI never claims "0th" or "100th".
export function percentileFromZ(z) {
  const p = normalCdf(z) * 100;
  return Math.min(99.9, Math.max(0.1, p));
}

export function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

export function assertAlpha(alpha) {
  if (typeof alpha !== 'number' || !(alpha > 0 && alpha < 1)) {
    throw new RangeError(`alpha must be in (0,1), got ${alpha}`);
  }
}
