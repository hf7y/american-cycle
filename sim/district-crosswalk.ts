/** #164's county-grain religion sourcing (US Religion Census / ARDA) needs a
 *  county -> congressional-district map before any of it can become a tag --
 *  districts split counties, so a county-grain adherence share cannot be
 *  read onto a district directly. That crosswalk was flagged "tractable,
 *  unattempted" on #164 (2026-09-07): OpenICPSR's population-weighted
 *  county<->CD crosswalk sits behind a Cloudflare challenge (no automated
 *  fetch), and MABLE/Geocorr looked like an interactive, session-bound form.
 *
 *  It isn't. Geocorr's form posts GET, not POST, to a stateless CGI broker,
 *  and every field -- including the ones a browser would send empty -- has
 *  to be present or the SAS macro backing it aborts on an unresolved
 *  `&longitude`/`&latitude` symbol. Once all fields are sent (empty ones
 *  included), a plain `curl -G` against `/cgi-bin/broker` returns a
 *  ready-to-download CSV, no session or key involved:
 *
 *  curl -s -G "https://mcdc.missouri.edu/cgi-bin/broker" \
 *    --data-urlencode "_PROGRAM=apps.geocorr2022.sas" \
 *    --data-urlencode "_SERVICE=MCDC_long" --data-urlencode "_debug=0" \
 *    --data-urlencode "state=Al01" [...one per state, 50 states, no DC/PR] \
 *    --data-urlencode "g1_=county" --data-urlencode "g2_=cd118" \
 *    --data-urlencode "wtvar=pop20" --data-urlencode "nozerob=1" \
 *    --data-urlencode "fileout=1" --data-urlencode "filefmt=csv" \
 *    --data-urlencode "lstfmt=html" --data-urlencode "title=" \
 *    --data-urlencode "counties=" --data-urlencode "metros=" \
 *    --data-urlencode "places=" --data-urlencode "oropt=" \
 *    --data-urlencode "latitude=" --data-urlencode "longitude=" \
 *    --data-urlencode "distance=" --data-urlencode "kiloms=0" \
 *    --data-urlencode "locname="
 *
 *  The response's body links a `/temp/geocorr2022_<job>.csv` -- fetch that
 *  URL and hand it to --build below.
 *
 *  This file closes the crosswalk half only. The other half #164 named --
 *  which of ~200 US Religion Census denomination names count as `catholic`,
 *  `evangelical` or `jewish` -- is a classification-scheme judgment call
 *  (RELTRAD or otherwise), not a mechanical pull, and stays open on #164.
 *
 *  node sim/district-crosswalk.ts --build <geocorr2022-cd118.csv>
 *  node sim/district-crosswalk.ts                    -- coverage report
 */
import { readFileSync, writeFileSync } from 'node:fs';

export const PANEL = 'data/historical/county_to_cd118_crosswalk.json';

interface Row { state: string; countyFips: string; countyName: string; cd118: string; pop20: number; afact: number }

/** Minimal RFC4180 reader; Geocorr quotes every field and pads afact with a
 *  trailing space. */
function parseCsv(t: string): string[][] {
  const rows: string[][] = [];
  let f = '', row: string[] = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); f = ''; rows.push(row); row = []; }
    else if (c !== '\r') f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

function build(csvPath: string): void {
  const raw = parseCsv(readFileSync(csvPath, 'utf8'));
  const hdr = raw[0];
  const ix: Record<string, number> = Object.fromEntries(hdr.map((h, i) => [h.trim(), i]));
  const rows: Row[] = [];
  for (const f of raw.slice(2)) {
    if (f.length < hdr.length) continue;
    const pop20 = Number(f[ix.pop20]), afact = Number(f[ix.afact]);
    if (!Number.isFinite(pop20) || !Number.isFinite(afact)) continue;
    rows.push({
      state: f[ix.stab].trim(),
      countyFips: f[ix.county].trim(),
      countyName: f[ix.CountyName].trim(),
      cd118: f[ix.cd118].trim(),
      pop20,
      afact,
    });
  }
  rows.sort((a, b) => a.countyFips.localeCompare(b.countyFips) || a.cd118.localeCompare(b.cd118));
  const panel = {
    note: 'County->CD118 crosswalk for #164\'s religion-tag sourcing programme. Not a tag itself -- see this file\'s header for what still blocks turning county-grain adherence data into catholic/evangelical/jewish.',
    source: {
      dataset: 'Missouri Census Data Center, Geocorr 2022 (geographic correspondence engine), version 1.9',
      geography: 'county -> congressional district, 118th Congress (matches era 2024)',
      weightingVariable: '2020 Census population',
      url: 'https://mcdc.missouri.edu/applications/geocorr2022.html',
      endpoint: 'https://mcdc.missouri.edu/cgi-bin/broker (stateless GET, see this file\'s header for the exact query)',
      retrieved: '2026-09-07',
    },
    transform: [
      'One row per (county, cd118) pair a county is split across; afact is the share of the county\'s 2020 population in that district.',
      'A county entirely inside one district has a single row with afact=1; a split county has one row per district summing to 1.',
    ],
    columns: ['state', 'countyFips', 'countyName', 'cd118', 'pop20', 'afact'],
    rows: rows.map((r) => [r.state, r.countyFips, r.countyName, r.cd118, r.pop20, r.afact]),
  };
  writeFileSync(PANEL, JSON.stringify(panel, null, 1).replace(/\n\s+(-?"|\d)/g, ' $1').replace(/\n\s+\]/g, ' ]'));
  console.log(`rebuilt ${PANEL}: ${rows.length} county-district rows`);
}

function report(): void {
  const panel = JSON.parse(readFileSync(PANEL, 'utf8')) as { rows: [string, string, string, string, number, number][] };
  const rows: Row[] = panel.rows.map(([state, countyFips, countyName, cd118, pop20, afact]) => ({ state, countyFips, countyName, cd118, pop20, afact }));
  const counties = new Set(rows.map((r) => r.countyFips));
  const byCounty = new Map<string, Row[]>();
  for (const r of rows) byCounty.set(r.countyFips, [...(byCounty.get(r.countyFips) ?? []), r]);
  const split = [...byCounty.values()].filter((rs) => rs.length > 1);
  const districts = new Set(rows.map((r) => `${r.state}-${r.cd118}`));
  console.log(`${rows.length} rows, ${counties.size} counties, ${districts.size} congressional districts (118th Congress)`);
  console.log(`${split.length} counties split across more than one district (${(100 * split.length / counties.size).toFixed(1)}%)`);
  const badAfact = [...byCounty.values()].filter((rs) => Math.abs(rs.reduce((s, r) => s + r.afact, 0) - 1) > 0.001);
  console.log(`afact sums to 1 per county: ${badAfact.length === 0 ? 'yes, all ' + counties.size : `NO -- ${badAfact.length} counties off`}`);
}

function main(): void {
  const argv = process.argv.slice(2);
  const bi = argv.indexOf('--build');
  if (bi >= 0) { build(argv[bi + 1]); return; }
  report();
}

main();
