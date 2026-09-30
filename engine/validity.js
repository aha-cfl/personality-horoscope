// Response-validity indicators. These flag; they never block scoring.
// Thresholds are heuristics exposed as options, not published cut-offs.

export const DEFAULTS = Object.freeze({
  longStringMax: 10, // flag a run of identical consecutive answers at or above this length
  acquiescenceAbs: 1.0, // flag |index| at or above this (index range −2..+2 on a 1–5 scale)
  midpoint: 3,
});

// Longest run of identical, consecutive, valid responses in administration order.
export function longestRun(order, responses) {
  let best = 0, run = 0, prev;
  for (const id of order) {
    const r = responses[id];
    if (r === null || r === undefined) { run = 0; prev = undefined; continue; }
    run = r === prev ? run + 1 : 1;
    prev = r;
    if (run > best) best = run;
  }
  return best;
}

// Pair each +keyed item with a −keyed item of the same scale, in list order.
// Unpaired leftovers are dropped so the set is exactly balanced.
export function buildBalancedPairs(items) {
  const byScale = {};
  for (const it of items) {
    const s = (byScale[it.scale] ??= { pos: [], neg: [] });
    (it.keyed === 1 ? s.pos : s.neg).push(it.id);
  }
  const pairs = [];
  for (const { pos, neg } of Object.values(byScale)) {
    const n = Math.min(pos.length, neg.length);
    for (let i = 0; i < n; i++) pairs.push([pos[i], neg[i]]);
  }
  return pairs;
}

// Mean of raw (un-reversed) responses over balanced pairs, minus the midpoint.
// > 0 agreeing regardless of content (yea-saying); < 0 nay-saying. null if no complete pair.
export function acquiescenceIndex(pairs, responses, midpoint = DEFAULTS.midpoint) {
  let sum = 0, n = 0;
  for (const [a, b] of pairs) {
    const ra = responses[a], rb = responses[b];
    if (!Number.isInteger(ra) || !Number.isInteger(rb)) continue;
    sum += (ra + rb) / 2;
    n += 1;
  }
  return n ? sum / n - midpoint : null;
}

/**
 * @param {Array<{id:string, expected:number}>} attentionItems
 */
export function attentionFailures(attentionItems, responses) {
  return attentionItems
    .filter((a) => responses[a.id] !== undefined && responses[a.id] !== null && responses[a.id] !== a.expected)
    .map((a) => a.id);
}

export function validityReport({ items, order, attentionItems = [], responses, options = {} }) {
  const o = { ...DEFAULTS, ...options };
  const flags = [];

  const run = longestRun(order ?? items.map((i) => i.id), responses);
  if (run >= o.longStringMax) {
    flags.push({
      code: 'LONG_STRING',
      severity: 'caution',
      value: run,
      message: `${run} identical answers in a row. Scores may reflect answering pattern more than item content.`,
    });
  }

  const acq = acquiescenceIndex(buildBalancedPairs(items), responses, o.midpoint);
  if (acq !== null && Math.abs(acq) >= o.acquiescenceAbs) {
    flags.push({
      code: acq > 0 ? 'ACQUIESCENCE' : 'NAY_SAYING',
      severity: 'caution',
      value: acq,
      message:
        acq > 0
          ? 'Tendency to agree with statements and their opposites. Scale scores may be pulled toward the middle.'
          : 'Tendency to disagree with statements and their opposites. Scale scores may be pulled toward the middle.',
    });
  }

  const failed = attentionFailures(attentionItems, responses);
  if (failed.length) {
    flags.push({
      code: 'ATTENTION',
      severity: failed.length === attentionItems.length ? 'caution' : 'info',
      value: failed.length,
      message: `${failed.length} of ${attentionItems.length} attention check(s) answered differently than instructed.`,
    });
  }

  const answered = items.filter((i) => Number.isInteger(responses[i.id])).length;
  if (answered < items.length) {
    flags.push({
      code: 'INCOMPLETE',
      severity: 'info',
      value: items.length - answered,
      message: `${items.length - answered} item(s) unanswered or out of range.`,
    });
  }

  return { flags, indices: { longestRun: run, acquiescence: acq, attentionFailed: failed } };
}
