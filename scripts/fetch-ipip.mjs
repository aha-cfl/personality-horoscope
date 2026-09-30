// Archive IPIP source pages verbatim: raw HTML + sha256 + retrieval time.
// Parsing into /data/items.*.json is a separate step that reads only these archives,
// so every shipped item is traceable to a hashed copy of the page it came from.
//
// URLs below are candidates; each must return 200 and be inspected before its
// parser is written. A non-200 is reported and the script exits non-zero.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const PAGES = {
  bfas: 'https://ipip.ori.org/BFASKeys.htm',
  ipip_neo_120: 'https://ipip.ori.org/30FacetNEO-PI-RItems.htm',
};

const outDir = new URL('../data/raw/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const manifest = {};
let failed = false;
for (const [key, url] of Object.entries(PAGES)) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    const sha256 = createHash('sha256').update(body).digest('hex');
    writeFileSync(new URL(`${key}.html`, outDir), body);
    manifest[key] = { url, sha256, bytes: body.length, retrieved_at: new Date().toISOString() };
    console.log(`ok   ${key} ${body.length}B ${sha256.slice(0, 12)}`);
  } catch (e) {
    failed = true;
    console.error(`FAIL ${key} ${url}: ${e.cause?.message ?? e.message}`);
  }
}
writeFileSync(new URL('manifest.json', outDir), JSON.stringify(manifest, null, 2) + '\n');
process.exit(failed ? 1 : 0);
