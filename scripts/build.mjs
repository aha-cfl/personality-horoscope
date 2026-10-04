// Inline /engine into each ui/*.html page at its /*ENGINE*/ marker → dist/*.html.
// Produces single files that open by double-click: no server, no network.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

// Order matters: validity.js uses isAnswer from score.js.
const engine = ['engine/score.js', 'engine/validity.js']
  .map((f) => `// ---- ${f} ----\n` + read(f).replace(/^import .*\n/gm, '').replace(/^export /gm, ''))
  .join('\n');

mkdirSync(new URL('dist/', root), { recursive: true });
for (const page of readdirSync(new URL('ui/', root)).filter((f) => f.endsWith('.html'))) {
  const html = read(`ui/${page}`);
  if (!html.includes('/*ENGINE*/')) throw new Error(`ui/${page} has no /*ENGINE*/ marker`);
  writeFileSync(new URL(`dist/${page}`, root), html.replace('/*ENGINE*/', () => engine));
  console.log(`built dist/${page}`);
}
