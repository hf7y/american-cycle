/** #164 part 3: source what the census actually has, for the districts whose
 *  map it still matches.
 *
 *  The ruling named census ACS as the first source for "urban/rural
 *  classification, farming-occupation share, manufacturing/union density,
 *  race and Hispanic origin" and flagged religion as unreachable this way.
 *  Checked against the actual ACS table catalog, only two of those five hold
 *  up as clean congressional-district pulls:
 *
 *    race (`black`)        -- table B02001, clean CD-level estimate
 *    Hispanic origin       -- table B03003, clean CD-level estimate
 *    urban/rural           -- NOT an ACS table. It is a decennial-census
 *                              block classification aggregated up, a
 *                              different pipeline this file does not build.
 *    union / manufacturing -- union membership is a CPS/BLS series with no
 *                              congressional-district release. Manufacturing
 *                              employment share IS an ACS industry table,
 *                              but "union" and "manufacturing" are not the
 *                              same thing and the existing tag is `union`.
 *    farm                  -- table C24030's agriculture/forestry/fishing/
 *                              hunting occupation share IS a clean CD-level
 *                              pull, but checked against the pack's own 8
 *                              hand-assigned `farm` districts it does not
 *                              separate them from the 22 that aren't: MN-8
 *                              (tagged) sits at 1.58%, below four untagged
 *                              districts (NC-1 1.98%, WA-3 1.84%, AK-1
 *                              1.77%, TX-34 1.69%), and OR-5/IA-3 (tagged,
 *                              2.49%/2.45%) sit below untagged ME-2 (3.34%).
 *                              No threshold reproduces the existing calls.
 *                              Modern farm employment is too small a share
 *                              of any district's workforce, tagged or not,
 *                              to carry what `farm` is actually meant to
 *                              flag -- a land-use/cultural character an
 *                              occupation share doesn't measure. Left
 *                              hand-assigned; a land-use source (USDA
 *                              Census of Agriculture, county-level, would
 *                              need a county-to-CD crosswalk) is a
 *                              different, bigger pipeline, not this table.
 *    catholic/evangelical/
 *    jewish                -- confirmed unreachable; the census does not
 *                              collect religion, by law.
 *
 *  So this sources `black` and `hispanic` only. `cuban` is Hispanic-origin
 *  detail (table B03001) but the margin of error on a single Hispanic
 *  subgroup at congressional-district grain is large enough, in a
 *  district-sized population, to not be a "clean" pull the way the top-line
 *  aggregate is -- left hand-assigned.
 *
 *  Grain: ACS 5-Year 2018-2022, 118th Congress district lines -- the vintage
 *  that matches era 2024's map. It does NOT match any other era: 1976 and
 *  1992 would need the decennial census by CD (a bigger, different build);
 *  1932 and 1964 predate CD-level federal survey data entirely and are not
 *  reachable this way. Applying this file to eras other than 2024 would be
 *  applying today's district lines to a map that no longer describes them.
 *
 *  node sim/district-demographics.ts --build <b02001.dat> <b03003.dat>
 *  node sim/district-demographics.ts                    -- coverage + threshold report
 *  node sim/district-demographics.ts --apply-era 2024    -- rewrite that pack in place
 */
import { readFileSync, writeFileSync } from 'node:fs';

export const PANEL = 'data/historical/acs_district_demographics.json';

const FIPS: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY',
};

/** Calibrated to reproduce the existing hand-assigned tags at their own
 *  boundary rather than invented cold: every district already carrying
 *  `black` sits at 29.8%+ Black share; every district already carrying
 *  `hispanic` sits at 21.8%+ Hispanic share. 25% and 20% sit just under
 *  each, so the census slice agrees with the hand-assigned calls it can
 *  check and adds the two disagreements plainly (see the --apply-era
 *  report): FL-27 gains `hispanic` alongside its existing `cuban`, and
 *  PA-7/NY-4 gain `hispanic` where nobody had tagged it by hand. */
export const BLACK_THRESHOLD = 25;
export const HISPANIC_THRESHOLD = 20;

interface Row { state: string; district: number; totalPop: number; black: number; hispanic: number }

function parseDat(text: string): Map<string, string[]> {
  const lines = text.split('\n').filter((l) => l.length);
  const rows = new Map<string, string[]>();
  for (const line of lines.slice(1)) {
    const f = line.split('|');
    rows.set(f[0], f);
  }
  return rows;
}

function districtKey(geoId: string): { st: string; dist: number } | null {
  if (!geoId.startsWith('5001800US')) return null;
  const code = geoId.slice(9);
  const st = FIPS[code.slice(0, 2)];
  const dist = code.slice(2);
  if (!st || !/^\d+$/.test(dist)) return null;
  return { st, dist: Number(dist) };
}

function build(racePath: string, hispPath: string): void {
  const race = parseDat(readFileSync(racePath, 'utf8'));
  const hisp = parseDat(readFileSync(hispPath, 'utf8'));
  const rows: Row[] = [];
  for (const [geoId, f] of race) {
    const k = districtKey(geoId);
    if (!k) continue;
    const h = hisp.get(geoId);
    const totalPop = Number(f[1]), blackCount = Number(f[5]);
    const hispanicCount = h ? Number(h[5]) : NaN;
    if (!Number.isFinite(totalPop) || !totalPop || !Number.isFinite(blackCount) || !Number.isFinite(hispanicCount)) continue;
    rows.push({ state: k.st, district: k.dist, totalPop, black: 100 * blackCount / totalPop, hispanic: 100 * hispanicCount / totalPop });
  }
  rows.sort((a, b) => a.state.localeCompare(b.state) || a.district - b.district);
  const panel = {
    note: 'Evidence for #164 part 3, and the tag-assignment input for --apply-era. Only race and Hispanic origin are sourced here -- see this file\'s header for why urban/rural, union and religion are not.',
    source: {
      dataset: 'Census Bureau, American Community Survey 5-Year Estimates 2018-2022, table-based Summary File',
      tables: { B02001: 'RACE', B03003: 'HISPANIC OR LATINO ORIGIN' },
      geography: 'congressional district, 118th Congress (matches era 2024)',
      url: 'https://www2.census.gov/programs-surveys/acs/summary_file/2022/table-based-SF/data/5YRData/',
      files: ['acsdt5y2022-b02001.dat', 'acsdt5y2022-b03003.dat'],
      retrieved: '2026-09-07',
    },
    transform: [
      'Filter GEO_ID to the "5001800US" congressional-district summary level; drop non-numeric district codes (territorial/undefined slivers).',
      'black = 100 * B02001_E003 (Black or African American alone) / B02001_E001 (total population).',
      'hispanic = 100 * B03003_E003 (Hispanic or Latino) / B03003_E001 (total population).',
    ],
    columns: ['state', 'district', 'totalPop', 'black_pct', 'hispanic_pct'],
    rows: rows.map((r) => [r.state, r.district, r.totalPop, r.black, r.hispanic]),
  };
  writeFileSync(PANEL, JSON.stringify(panel, null, 1).replace(/\n\s+(-?\d)/g, ' $1').replace(/\n\s+\]/g, ' ]'));
  console.log(`rebuilt ${PANEL}: ${rows.length} congressional districts`);
}

function loadPanel(): Row[] {
  const panel = JSON.parse(readFileSync(PANEL, 'utf8')) as { rows: [string, number, number, number, number][] };
  return panel.rows.map(([state, district, totalPop, black, hispanic]) => ({ state, district, totalPop, black, hispanic }));
}

/** A state with exactly one congressional district is at-large -- its ACS
 *  code is "00" regardless of what number a pack gives that seat. */
function lookup(rows: Row[], byState: Map<string, Row[]>, state: string, district: number): Row | undefined {
  const inState = byState.get(state) ?? [];
  if (inState.length === 1) return inState[0];
  return inState.find((r) => r.district === district);
}

function applyEra(era: number): void {
  const rows = loadPanel();
  const byState = new Map<string, Row[]>();
  for (const r of rows) { if (!byState.has(r.state)) byState.set(r.state, []); byState.get(r.state)!.push(r); }

  const path = `data/pack-${era}.json`;
  const pack = JSON.parse(readFileSync(path, 'utf8'));
  const cards = Array.isArray(pack) ? pack : pack.cards;
  let matched = 0, unmatched = 0, added = 0;
  const notes: string[] = [];
  for (const c of cards) {
    if (c.kind !== 'district') continue;
    const row = lookup(rows, byState, c.state, c.number);
    if (!row) { unmatched++; notes.push(`  no ACS match: ${c.id}`); continue; }
    matched++;
    c.provenance = c.provenance ?? {};
    const wants: [string, number, number][] = [['black', row.black, BLACK_THRESHOLD], ['hispanic', row.hispanic, HISPANIC_THRESHOLD]];
    for (const [tag, share, threshold] of wants) {
      const qualifies = share >= threshold;
      const has = c.demographics.includes(tag);
      if (qualifies && !has) {
        c.demographics.push(tag);
        added++;
        notes.push(`  +${tag} ${c.id} (${share.toFixed(1)}% >= ${threshold}%)`);
      }
      if (qualifies || has) {
        c.provenance[tag] = { source: 'census-acs5yr-2022', vintage: '2022' };
      }
    }
  }
  writeFileSync(path, JSON.stringify(pack, null, 2) + '\n');
  console.log(`${path}: ${matched} districts matched, ${unmatched} unmatched, ${added} tags added`);
  for (const n of notes) console.log(n);
}

function report(): void {
  const rows = loadPanel();
  console.log(`panel: ${rows.length} congressional districts, ACS 5-Year 2018-2022`);
  for (const [label, threshold, field] of [['black', BLACK_THRESHOLD, 'black'], ['hispanic', HISPANIC_THRESHOLD, 'hispanic']] as const) {
    const qualifying = rows.filter((r) => r[field] >= threshold);
    console.log(`  ${label} >= ${threshold}%: ${qualifying.length} of ${rows.length} districts nationwide (${(100 * qualifying.length / rows.length).toFixed(1)}%)`);
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  const bi = argv.indexOf('--build');
  if (bi >= 0) { build(argv[bi + 1], argv[bi + 2]); return; }
  const ai = argv.indexOf('--apply-era');
  if (ai >= 0) { applyEra(Number(argv[ai + 1])); return; }
  report();
}

if (import.meta.url === `file://${process.argv[1]}`) main();
