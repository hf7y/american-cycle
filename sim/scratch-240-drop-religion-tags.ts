/** hf7y/american-cycle#240: mechanical half of dropping catholic/evangelical/
 *  jewish (failed Holm-corrected significance, sim/tag-significance.ts) from
 *  every card's identities/demographics/identityWeights/provenance. One-shot
 *  migration script, not a tool to keep -- run once, then trash it.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const DROP = new Set(['catholic', 'evangelical', 'jewish']);
const PACKS = ['1932', '1964', '1976', '1992', '2008', '2016', '2024'];

let touchedCards = 0, touchedFields = 0;

for (const p of PACKS) {
  const path = new URL(`../data/pack-${p}.json`, import.meta.url);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  for (const card of data.cards) {
    let touched = false;
    for (const listField of ['identities', 'demographics']) {
      if (Array.isArray(card[listField])) {
        const before = card[listField].length;
        card[listField] = card[listField].filter((t: string) => !DROP.has(t));
        if (card[listField].length !== before) { touched = true; touchedFields++; }
      }
    }
    for (const objField of ['identityWeights', 'provenance']) {
      if (card[objField] && typeof card[objField] === 'object') {
        for (const k of Object.keys(card[objField])) {
          if (DROP.has(k)) { delete card[objField][k]; touched = true; touchedFields++; }
        }
        if (Object.keys(card[objField]).length === 0) delete card[objField];
      }
    }
    if (touched) touchedCards++;
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  // pack files on disk have no trailing newline; match that exactly
  const buf = readFileSync(path, 'utf8');
  writeFileSync(path, buf.replace(/\n$/, ''));
  console.log(`${p}: rewritten`);
}

console.log(`\n${touchedCards} cards touched, ${touchedFields} fields changed`);
