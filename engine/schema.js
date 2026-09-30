// Structural checks for /data files. Returns a list of error strings; empty means valid.

const BANNED = /\b(diagnos\w*|disorders?|symptoms? of)\b/i;

export function validateSources(sources) {
  const errs = [];
  const ids = new Set();
  for (const s of sources) {
    if (!s.id) errs.push('source missing id');
    if (ids.has(s.id)) errs.push(`duplicate source id ${s.id}`);
    ids.add(s.id);
    if (typeof s.verified !== 'boolean') errs.push(`${s.id}: verified must be boolean`);
    if (s.verified && !(s.doi || s.url)) errs.push(`${s.id}: verified source needs doi or url`);
    if (s.doi && !/^10\.\d{4,9}\/\S+$/.test(s.doi)) errs.push(`${s.id}: malformed DOI ${s.doi}`);
    for (const k of ['authors', 'year', 'title']) if (!s[k]) errs.push(`${s.id}: missing ${k}`);
  }
  return errs;
}

export function validateItems(items, sourceIds) {
  const errs = [];
  const ids = new Set();
  for (const it of items) {
    if (ids.has(it.id)) errs.push(`duplicate item id ${it.id}`);
    ids.add(it.id);
    for (const k of ['id', 'text', 'scale', 'domain', 'instrument', 'source_id']) {
      if (!it[k]) errs.push(`${it.id}: missing ${k}`);
    }
    if (!(it.aspect || it.facet)) errs.push(`${it.id}: needs aspect or facet`);
    if (it.keyed !== 1 && it.keyed !== -1) errs.push(`${it.id}: keyed must be +1/-1`);
    if (it.source_id && !sourceIds.has(it.source_id)) errs.push(`${it.id}: unknown source_id ${it.source_id}`);
  }
  return errs;
}

export function validateNorms(norms, scales, sourceIds) {
  const errs = [];
  for (const scale of scales) {
    const n = norms[scale];
    if (!n) { errs.push(`no norm for scale ${scale}`); continue; }
    if (!(n.sd > 0)) errs.push(`${scale}: sd must be > 0`);
    if (!(n.alpha > 0 && n.alpha < 1)) errs.push(`${scale}: alpha must be in (0,1)`);
    if (!(n.n > 0)) errs.push(`${scale}: n must be > 0`);
    if (!n.sample_desc) errs.push(`${scale}: missing sample_desc`);
    if (!sourceIds.has(n.source_id)) errs.push(`${scale}: unknown source_id ${n.source_id}`);
  }
  return errs;
}

// Rule 4: no clinical wording in any user-facing string.
export function findBannedLanguage(strings) {
  return strings.filter((s) => BANNED.test(s));
}
