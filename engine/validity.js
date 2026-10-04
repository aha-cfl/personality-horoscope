// Response-validity indicators. They flag; they never block scoring.
// Thresholds are heuristics exposed as options, not published cut-offs.

import { isAnswer } from './score.js';

export const DEFAULTS = Object.freeze({
  longStringMax: 10, // flag a run of identical consecutive answers at or above this length
  acquiescenceAbs: 1.0, // flag |index| at or above this (range −2..+2)
});

// Longest run of identical consecutive answers; a skipped item breaks the run.
export function longestRun(order, responses) {
  let best = 0, run = 0, prev = null;
  for (const id of order) {
    const r = responses[id] ?? null;
    run = r !== null && r === prev ? run + 1 : r === null ? 0 : 1;
    prev = r;
    best = Math.max(best, run);
  }
  return best;
}

// Pair each +keyed item with a −keyed item of the same scale, in list order.
export function buildBalancedPairs(items) {
  const byScale = {};
  for (const it of items) ((byScale[it.scale] ??= { 1: [], [-1]: [] })[it.keyed]).push(it.id);
  return Object.values(byScale).flatMap((s) => s[1].slice(0, s[-1].length).map((id, i) => [id, s[-1][i]]));
}

// Mean raw (un-reversed) answer over complete pairs, minus the midpoint 3.
// > 0 agrees regardless of content; < 0 disagrees regardless. null if no complete pair.
export function acquiescenceIndex(pairs, responses) {
  const means = pairs
    .filter(([a, b]) => isAnswer(responses[a]) && isAnswer(responses[b]))
    .map(([a, b]) => (responses[a] + responses[b]) / 2);
  return means.length ? means.reduce((x, y) => x + y) / means.length - 3 : null;
}

export function validityReport({ items, order = items.map((i) => i.id), attentionItems = [], responses, options = {} }) {
  const o = { ...DEFAULTS, ...options };
  const flags = [];
  const flag = (code, severity, value, message) => flags.push({ code, severity, value, message });

  const run = longestRun(order, responses);
  if (run >= o.longStringMax) {
    flag('LONG_STRING', 'caution', run,
      `${run} identical answers in a row. Scores may reflect answering pattern more than item content.`);
  }

  const acq = acquiescenceIndex(buildBalancedPairs(items), responses);
  if (acq !== null && Math.abs(acq) >= o.acquiescenceAbs) {
    const verb = acq > 0 ? 'agree' : 'disagree';
    flag(acq > 0 ? 'ACQUIESCENCE' : 'NAY_SAYING', 'caution', acq,
      `Tendency to ${verb} with statements and their opposites. Scale scores may be pulled toward the middle.`);
  }

  const failed = attentionItems.filter((a) => responses[a.id] != null && responses[a.id] !== a.expected).map((a) => a.id);
  if (failed.length) {
    flag('ATTENTION', failed.length === attentionItems.length ? 'caution' : 'info', failed.length,
      `${failed.length} of ${attentionItems.length} attention check(s) answered differently than instructed.`);
  }

  const unanswered = items.filter((i) => !isAnswer(responses[i.id])).length;
  if (unanswered) flag('INCOMPLETE', 'info', unanswered, `${unanswered} item(s) unanswered or out of range.`);

  return { flags, indices: { longestRun: run, acquiescence: acq, attentionFailed: failed } };
}
