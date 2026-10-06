# personality-horoscope

Astrology chart reader + firewalled personality-measurement module. Educational, not clinical.

## Layout
- `engine/` — `score.js` (scoring, CIs, reliable differences), `validity.js` (answer-pattern flags), `schema.js` (data validators). Pure functions, no I/O.
- `data/` — items, norms, sources, content (added once sources are fetched and verified).
- `scripts/fetch-ipip.mjs` — archives IPIP pages verbatim (raw HTML + sha256) into `data/raw/`.
- `astro/` — `patterns.js`: chart geometry (signs, elements, aspects, stelliums, chart ruler, dignities, grand trine / T-square / grand cross / yod / kite). Geometry only; no interpretation, no imports from `engine/`.
- `ui/` — page sources; `npm run build` inlines `/engine` into `dist/*.html` (single files, open by double-click).
- `tests/` — `npm test` (node:test). `tests/fixtures/` holds synthetic items only.

## Scoring conventions
- Reverse key: `6 − r` on 1–5. Scale score = mean of keyed responses; scored only if ≥80% answered.
- SEM = SD·√(1−α); 90% band = score ± 1.645·SEM, clipped to 1–5, carried to z and percentile.
- Percentiles use a normal approximation unless empirical norms exist (labelled in output).
- Reliable difference in z units: |zA − zB| > 1.645·√(2 − αA − αB).
- Validity: long-string run, acquiescence over balanced +/− pairs, attention items. Flags only; never blocks.
  Thresholds are heuristics (options in `engine/validity.js`), not published cut-offs.

## Fetching sources
Behind the agent proxy: `NODE_USE_ENV_PROXY=1 npm run fetch:ipip`.
