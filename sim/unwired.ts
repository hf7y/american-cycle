/** hf7y/american-cycle#43: a value computed and then discarded is not
 *  evidence of a dead rule -- it can be a missing clause upstream that never
 *  reads it. This is a FINDING tool, not a fix: it lists candidates for a
 *  human (or the next agent) to read and, if genuinely dead, park as its own
 *  issue. It never deletes anything, and it always exits 0.
 *
 *  Two sweeps:
 *
 *  1. INTERFACE FIELDS -- for each field of a curated set of data-carrier
 *     interfaces (RaceEvent, Side, Declaration, EnactedBill, and the inline
 *     object groups of Config), count `.fieldName` property-access
 *     occurrences anywhere in engine/ or sim/ OUTSIDE the file that declares
 *     the interface. Zero means nothing was seen reading it back -- the
 *     shape a discarded-modifiers-stack bug takes when read the other way.
 *
 *     Scope: Config fields declared inline in engine/game.ts. Sub-configs
 *     imported from other modules (lean.LeanConfig, econ.EconomyConfig,
 *     leg.LegislatureConfig, ScoringConfig, amend.AmendmentConfig) are out of
 *     scope -- resolving those needs the same walk over each of their own
 *     files, which is more machinery than this pass is worth.
 *
 *  2. CARD EFFECT KINDS -- for each literal in EffectType, checks whether any
 *     card in data/pack-*.json actually carries it (produced) and whether
 *     any engine rule dispatches on it as a string literal (consumed). A
 *     kind with zero of either is a printed rule nobody can trigger, or a
 *     handler nobody's cards reach.
 *
 *  This is a heuristic, not a type checker: property-access counting misses
 *  destructured reads (`const { fieldName } = event`), and a string literal
 *  can be built dynamically rather than written out. Both directions of
 *  error are acceptable for a candidate list a human reads before acting.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFiles(rel));
    else if (entry.name.endsWith('.ts')) out.push(rel);
  }
  return out;
}

const SOURCE_FILES = [...listTsFiles('engine'), ...listTsFiles('sim')];
const fileText = new Map<string, string>();
for (const f of SOURCE_FILES) fileText.set(f, readFileSync(join(root, f), 'utf8'));

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
}

/** Finds `(export )?interface NAME {` and returns the text between its
 *  matching braces, tracking depth so nested `{}` don't end it early. */
function interfaceBody(src: string, name: string): string | null {
  const m = src.match(new RegExp(`(?:export\\s+)?interface\\s+${name}\\b[^{]*\\{`));
  if (!m || m.index === undefined) return null;
  let i = m.index + m[0].length, depth = 1;
  const start = i;
  while (depth > 0 && i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(start, i - 1);
}

/** Splits an interface (or nested object type) body on top-level `;`,
 *  respecting brace/paren/bracket depth so a nested object's own fields
 *  don't get split as if they were siblings. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0, cur = '';
  for (const ch of body) {
    if ('{(['.includes(ch)) depth++;
    if ('})]'.includes(ch)) depth--;
    if (ch === ';' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** Flattens field NAMES out of an interface body, recursing into any nested
 *  `{ ... }` object type (inline sub-objects, arrays of them, and `X & {
 *  ... }` intersections) so `sides: { player: number; ... }[]`  yields
 *  `player` alongside `sides` itself. */
function extractFieldNames(body: string, out: string[] = []): string[] {
  for (const raw of splitTopLevel(body)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\??\s*:\s*([\s\S]*)$/);
    if (!m) continue;
    const [, fname, type] = m;
    out.push(fname);
    const brace = type.indexOf('{');
    if (brace !== -1) {
      let depth = 1, j = brace + 1;
      while (depth > 0 && j < type.length) {
        if (type[j] === '{') depth++;
        else if (type[j] === '}') depth--;
        j++;
      }
      extractFieldNames(type.slice(brace + 1, j - 1), out);
    }
  }
  return out;
}

function propertyAccessCount(fieldName: string, excludeFile: string): number {
  const re = new RegExp(`\\.${fieldName}\\b`, 'g');
  let n = 0;
  for (const [f, text] of fileText) {
    if (f === excludeFile) continue;
    n += (stripComments(text).match(re) ?? []).length;
  }
  return n;
}

interface Target { file: string; interfaceName: string; skip?: string[] }
const TARGETS: Target[] = [
  { file: 'engine/types/index.ts', interfaceName: 'RaceEvent' },
  { file: 'engine/rules/resolution.ts', interfaceName: 'Side' },
  { file: 'engine/rules/elections.ts', interfaceName: 'Declaration' },
  { file: 'engine/types/index.ts', interfaceName: 'EnactedBill' },
  // player/cardId/party/state/office/year etc. are structural identifiers
  // used everywhere as keys and joins, not "consumed" by a rule as such --
  // flagging them would be 100% noise, so they're excluded rather than left
  // to drown the real hits.
  {
    file: 'engine/game.ts', interfaceName: 'Config',
    skip: ['name', 'player', 'cardId', 'party', 'state', 'office', 'year', 'slot'],
  },
];

let hits = 0;

console.log('=== interface fields with no .field read outside their own file ===\n');
for (const t of TARGETS) {
  const src = stripComments(fileText.get(t.file) ?? readFileSync(join(root, t.file), 'utf8'));
  const body = interfaceBody(src, t.interfaceName);
  if (!body) { console.log(`  (skipped: could not locate interface ${t.interfaceName} in ${t.file})`); continue; }
  const fields = [...new Set(extractFieldNames(body))].filter((f) => !(t.skip ?? []).includes(f));
  for (const f of fields) {
    const n = propertyAccessCount(f, t.file);
    if (n === 0) { console.log(`  ${t.interfaceName}.${f}  (${t.file})`); hits++; }
  }
}
if (!hits) console.log('  none found');

console.log('\n=== card effect kinds: produced by a card? consumed by a rule? ===\n');
const typesSrc = stripComments(fileText.get('engine/types/index.ts')!);
const effectTypeMatch = typesSrc.match(/type EffectType\s*=([\s\S]*?);/);
const kinds = effectTypeMatch
  ? [...effectTypeMatch[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  : [];

const dataDir = 'data';
const packFiles = readdirSync(join(root, dataDir)).filter((f) => f.startsWith('pack-') && f.endsWith('.json'));
const packText = packFiles.map((f) => readFileSync(join(root, dataDir, f), 'utf8')).join('\n');
let effectHits = 0;
for (const kind of kinds) {
  const produced = new RegExp(`"${kind}"`).test(packText);
  const consumed = SOURCE_FILES
    .filter((f) => f !== 'engine/types/index.ts')
    .some((f) => new RegExp(`'${kind}'`).test(fileText.get(f)!));
  if (!produced || !consumed) {
    console.log(`  ${kind}  --  produced by a card: ${produced}   dispatched by a rule: ${consumed}`);
    effectHits++;
  }
}
if (!effectHits) console.log('  every EffectType kind is both printed on a card and dispatched');

console.log(`\n${hits + effectHits} candidate${hits + effectHits === 1 ? '' : 's'} found. `
  + 'Each is a lead, not a verdict -- read the producing and (non-)consuming '
  + 'sites before parking an issue on it.');
