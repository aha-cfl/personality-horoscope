import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reverseKey, scoreScales, standardize, scoreProfile, reliableDifference, normalCdf, percentileFromZ,
} from '../engine/score.js';
import { longestRun, buildBalancedPairs, acquiescenceIndex, validityReport } from '../engine/validity.js';
import { items, norms, fill } from './fixtures/synthetic.js';

const close = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('reverse keying on 1–5', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((r) => reverseKey(r, -1)), [5, 4, 3, 2, 1]);
  assert.deepEqual([1, 2, 3, 4, 5].map((r) => reverseKey(r, 1)), [1, 2, 3, 4, 5]);
  assert.throws(() => reverseKey(3, 0), RangeError);
});

test('normal CDF known values', () => {
  close(normalCdf(0), 0.5, 1e-7);
  close(normalCdf(1.645), 0.95, 1e-3);
  close(normalCdf(-1.96), 0.025, 1e-3);
  assert.equal(percentileFromZ(10), 99.9);
  assert.equal(percentileFromZ(-10), 0.1);
});

test('known-answer fixture: means, z, SEM, 90% CI', () => {
  const resp = { A1: 5, A2: 1, A3: 4, A4: 2, B1: 2, B2: 3, B3: 4, B4: 5 };
  const p = scoreProfile(items, resp, norms);
  assert.equal(p.A.mean, 4.5);
  assert.equal(p.B.mean, 2.0);

  const a = p.A.standardized;
  close(a.z, 3);
  close(a.sem, 0.2); // 0.5·√(1−.84)
  close(a.rawCI90[0], 4.5 - 0.329);
  close(a.rawCI90[1], 4.5 + 0.329);

  const b = p.B.standardized;
  close(b.z, -1.875);
  close(b.sem, 0.4); // 0.8·√(1−.75)
  close(b.rawCI90[0], 2 - 0.658);
  close(b.rawCI90[1], 2 + 0.658);
  assert.ok(b.percentileCI90[0] < b.percentile && b.percentile < b.percentileCI90[1]);
});

test('CI is clipped to the response range', () => {
  const s = standardize(5, norms.A);
  assert.equal(s.rawCI90[1], 5);
  close(s.rawCI90[0], 5 - 0.329);
  const t = standardize(1, norms.A);
  assert.equal(t.rawCI90[0], 1);
});

test('reliable difference uses z metric and √(2−α1−α2)', () => {
  const r = reliableDifference(3, -1.875, 0.84, 0.75);
  close(r.threshold, 1.645 * Math.sqrt(0.41));
  assert.equal(r.reliable, true);
  assert.equal(reliableDifference(0.5, 0, 0.84, 0.75).reliable, false);
  assert.equal(reliableDifference(null, 0, 0.84, 0.75).reliable, false);
  assert.throws(() => reliableDifference(0, 0, 1, 0.8), RangeError);
});

test('edge: all 1s → balanced scales land on midpoint, nay-saying flagged', () => {
  const resp = fill(1);
  const s = scoreScales(items, resp);
  assert.equal(s.A.mean, 3);
  assert.equal(s.B.mean, 3);
  assert.equal(acquiescenceIndex(buildBalancedPairs(items), resp), -2);
  const v = validityReport({ items, responses: resp, options: { longStringMax: 8 } });
  const codes = v.flags.map((f) => f.code);
  assert.ok(codes.includes('NAY_SAYING'));
  assert.ok(codes.includes('LONG_STRING'));
});

test('edge: all 5s → acquiescence flagged, scores still produced', () => {
  const resp = fill(5);
  const p = scoreProfile(items, resp, norms);
  assert.equal(p.A.mean, 3);
  assert.ok(p.A.standardized);
  const v = validityReport({ items, responses: resp });
  assert.ok(v.flags.some((f) => f.code === 'ACQUIESCENCE'));
  assert.equal(v.indices.acquiescence, 2);
});

test('edge: missing items and coverage threshold', () => {
  const resp = { ...fill(3), A1: null };
  assert.equal(scoreScales(items, resp).A.mean, null); // 3/4 < 0.8
  assert.equal(scoreScales(items, resp, { minCoverage: 0.75 }).A.mean, 3);
  assert.deepEqual(scoreScales(items, resp).A.missing, ['A1']);
  assert.equal(scoreProfile(items, resp, norms).A.standardized, null);
  const v = validityReport({ items, responses: resp });
  assert.ok(v.flags.some((f) => f.code === 'INCOMPLETE'));
});

test('edge: out-of-range and non-integer answers are treated as invalid, not scored', () => {
  const resp = { ...fill(3), B1: 6, B2: 0, B3: 2.5 };
  const s = scoreScales(items, resp);
  assert.deepEqual(s.B.invalid, ['B1', 'B2', 'B3']);
  assert.equal(s.B.mean, null);
});

test('edge: no responses at all', () => {
  const p = scoreProfile(items, {}, norms);
  assert.equal(p.A.mean, null);
  const v = validityReport({ items, responses: {} });
  assert.equal(v.indices.acquiescence, null);
  assert.equal(v.indices.longestRun, 0);
});

test('long-string run resets on missing answers', () => {
  const order = ['A1', 'A2', 'A3', 'A4'];
  assert.equal(longestRun(order, { A1: 2, A2: 2, A3: 2, A4: 2 }), 4);
  assert.equal(longestRun(order, { A1: 2, A2: 2, A3: null, A4: 2 }), 2);
});

test('attention items: flag, never block', () => {
  const attentionItems = [{ id: 'ATT1', expected: 2 }, { id: 'ATT2', expected: 4 }];
  const resp = { ...fill(3), ATT1: 2, ATT2: 1 };
  const v = validityReport({ items, attentionItems, responses: resp });
  const f = v.flags.find((x) => x.code === 'ATTENTION');
  assert.equal(f.value, 1);
  assert.equal(f.severity, 'info');
  assert.ok(scoreProfile(items, resp, norms).A.standardized);
});

test('validity messages use no clinical wording', async () => {
  const { findBannedLanguage } = await import('../engine/schema.js');
  const v = validityReport({
    items,
    attentionItems: [{ id: 'X', expected: 1 }],
    responses: { ...fill(5), X: 5 },
    options: { longStringMax: 2 },
  });
  assert.deepEqual(findBannedLanguage(v.flags.map((f) => f.message)), []);
});
