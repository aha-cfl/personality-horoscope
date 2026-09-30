// SYNTHETIC test fixtures. Not personality items, never shipped, not loaded by the UI.
// Two 4-item scales, balanced keying, so expected values are hand-computable.

export const items = [
  { id: 'A1', scale: 'A', keyed: 1 },
  { id: 'A2', scale: 'A', keyed: -1 },
  { id: 'A3', scale: 'A', keyed: 1 },
  { id: 'A4', scale: 'A', keyed: -1 },
  { id: 'B1', scale: 'B', keyed: 1 },
  { id: 'B2', scale: 'B', keyed: 1 },
  { id: 'B3', scale: 'B', keyed: -1 },
  { id: 'B4', scale: 'B', keyed: -1 },
];

export const norms = {
  A: { mean: 3.0, sd: 0.5, alpha: 0.84 },
  B: { mean: 3.5, sd: 0.8, alpha: 0.75 },
};

export const fill = (v) => Object.fromEntries(items.map((i) => [i.id, v]));
