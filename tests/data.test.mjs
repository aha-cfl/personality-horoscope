// Integrity checks for whatever /data files exist. Data files are added in step 2b
// (after ipip.ori.org is reachable); until then only the validator self-tests run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validateSources, validateItems, validateNorms, findBannedLanguage } from '../engine/schema.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url)));
const has = (p) => existsSync(new URL(`../data/${p}`, import.meta.url));

test('validator rejects bad records', () => {
  assert.ok(validateSources([{ id: 's', authors: 'x', year: 1, title: 't', verified: 'yes' }]).length);
  assert.ok(validateSources([{ id: 's', authors: 'x', year: 1, title: 't', verified: false, doi: 'bad' }]).length);
  assert.ok(validateItems([{ id: 'i', keyed: 0 }], new Set()).length);
  assert.ok(validateNorms({ X: { sd: 0, alpha: 1 } }, ['X'], new Set()).length);
  assert.deepEqual(findBannedLanguage(['a profile of tendencies']), []);
  assert.equal(findBannedLanguage(['may diagnose', 'a disorder', 'symptom of x']).length, 3);
});

test('data files are internally consistent', { skip: !has('sources.json') && 'no data yet' }, () => {
  const sources = load('sources.json');
  assert.deepEqual(validateSources(sources), []);
  const ids = new Set(sources.map((s) => s.id));
  if (has('items.bfas.json')) {
    const items = load('items.bfas.json');
    assert.deepEqual(validateItems(items, ids), []);
    assert.equal(items.length, 100);
    const perAspect = {};
    for (const it of items) perAspect[it.scale] = (perAspect[it.scale] ?? 0) + 1;
    assert.equal(Object.keys(perAspect).length, 10);
    for (const n of Object.values(perAspect)) assert.equal(n, 10);
    if (has('norms.json')) assert.deepEqual(validateNorms(load('norms.json'), Object.keys(perAspect), ids), []);
  }
});
