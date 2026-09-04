/** Card data is unverified input, not code the type checker can see into --
 *  #89 found a district that never existed (`FL-18` in `pack-1976.json`,
 *  eighteen years before Florida had eighteen districts) sitting undetected
 *  because nothing checked pack data at all. These four checks are what
 *  would have caught it, plus the id-collision and stale-prose classes of
 *  the same defect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TAGS } from '../engine/rules/tags.ts';
import { BY_CODE, seatsIn } from '../engine/states.ts';
import type { Card } from '../engine/types/index.ts';

const dataDir = new URL('./', import.meta.url);
const packFiles = readdirSync(dataDir).filter((f) => /^pack-\d+\.json$/.test(f));

interface Pack { name: string; era: number; note?: string; cards: Card[] }
const loadPack = (f: string): Pack => JSON.parse(readFileSync(new URL(f, dataDir), 'utf8'));
const packs = packFiles.map((f) => ({ file: f, pack: loadPack(f) }));

// ---------------------------------------------------------- the panel

const panel = JSON.parse(readFileSync(new URL('historical/house_district_panel.json', dataDir), 'utf8')) as
  { columns: string[]; rows: (string | number)[][] };
const [yi, si, di] = ['year', 'state', 'district'].map((c) => panel.columns.indexOf(c));
const panelYears = new Set(panel.rows.map((r) => r[yi] as number));
const validDistricts = new Map<string, Set<number>>();
for (const r of panel.rows) {
  const key = `${r[yi]}|${r[si]}`;
  if (!validDistricts.has(key)) validDistricts.set(key, new Set());
  validDistricts.get(key)!.add(r[di] as number);
}

test('every district card exists in the apportionment for its era', () => {
  for (const { file, pack } of packs) {
    for (const c of pack.cards) {
      if (c.kind !== 'district') continue;
      if (panelYears.has(c.era)) {
        // in range: the panel names every district that was actually contested
        const valid = validDistricts.get(`${c.era}|${c.state}`);
        assert.ok(valid && valid.has(c.number),
          `${file}: ${c.id} -- ${c.state} has no district ${c.number} in the ${c.era} panel` +
          (valid ? ` (has ${[...valid].sort((a, b) => a - b).join(',')})` : ' (no rows for that state/year at all)'));
      } else {
        // outside the panel's 1976-2018 range: bound against the era's own apportionment,
        // but only for the window seatsIn actually models. It knows two censuses, 1970 and
        // 2010, each holding as the floor/ceiling for every year before/after it -- so 1932
        // gets compared against the 1970 count (a state that has been *shrinking* its
        // delegation all century makes that too low: PA-30 in 1932 was real, PA had 34
        // seats then, not the 25 of 1970) and 2024 gets compared against the 2010 count with
        // no knowledge of the 2020 reapportionment (too low for a *gaining* state: CO-8 in
        // 2024 is real, CO has 8 seats now, not the 7 of 2010). Both are #89's own table
        // calling 1932/1964/2024 "unverifiable from committed data" -- seatsIn can bound
        // only the [1972, 2022) window between the two censuses it actually has.
        const st = BY_CODE[c.state];
        assert.ok(st, `${file}: ${c.id} -- unknown state ${c.state}`);
        const censuses = Object.keys(st.seats).map(Number).sort((a, b) => a - b);
        const earliestModelled = censuses[0] + 2;
        const nextCensusEffective = censuses[censuses.length - 1] + 10 + 2;
        if (c.era < earliestModelled || c.era >= nextCensusEffective) continue;
        const seats = seatsIn(st, c.era);
        assert.ok(c.number >= 1 && c.number <= seats,
          `${file}: ${c.id} -- ${c.state} district ${c.number} exceeds its ${c.era} apportionment of ${seats} seats`);
      }
    }
  }
});

// ---------------------------------------------------------- ids

test('card ids are unique across every pack', () => {
  const seen = new Map<string, string>();
  for (const { file, pack } of packs) {
    for (const c of pack.cards) {
      const owner = seen.get(c.id);
      assert.ok(!owner, `id ${c.id} appears in both ${owner} and ${file}`);
      seen.set(c.id, file);
    }
  }
});

test('card ids are suffixed with their own era', () => {
  for (const { file, pack } of packs) {
    for (const c of pack.cards) {
      assert.ok(c.id.endsWith(`-${c.era}`), `${file}: ${c.id} is not suffixed with its era (${c.era})`);
    }
  }
});

// ---------------------------------------------------------- tags

test('identities and demographics carry only live IdentityTag values', () => {
  for (const { file, pack } of packs) {
    for (const c of pack.cards) {
      const tags = c.kind === 'candidate' ? c.identities : c.demographics;
      for (const t of tags) assert.ok((TAGS as readonly string[]).includes(t), `${file}: ${c.id} carries unknown tag "${t}"`);
    }
  }
});

// #41: a signed weight only ever fires through `identities`, so a weight
// keyed on a tag the card does not carry, or on a tag outside the live
// vocabulary, is dead data nobody would notice was wrong.
test('identityWeights keys are live tags the card actually carries', () => {
  for (const { file, pack } of packs) {
    for (const c of pack.cards) {
      if (c.kind !== 'candidate' || !c.identityWeights) continue;
      for (const t of Object.keys(c.identityWeights)) {
        assert.ok((TAGS as readonly string[]).includes(t), `${file}: ${c.id} weights unknown tag "${t}"`);
        assert.ok(c.identities.includes(t as never), `${file}: ${c.id} weights "${t}" but does not carry it in identities`);
      }
    }
  }
});

// ---------------------------------------------------------- stale prose

// #89: pack notes sold a printed `heterodox` tag two commits after it was
// removed from IdentityTag and became a derived quantity (sim/agents.ts).
// A keyword deny-list is cheap and catches the next one same as this one.
const CUT_MECHANIC_KEYWORDS = ['heterodox'];

test('no pack note, card note or belief names a cut mechanic', () => {
  for (const { file, pack } of packs) {
    const texts: [string, string | undefined][] = [[file, pack.note]];
    for (const c of pack.cards) texts.push([c.id, c.kind === 'candidate' ? c.belief : c.note]);
    for (const [where, text] of texts) {
      if (!text) continue;
      for (const kw of CUT_MECHANIC_KEYWORDS) {
        assert.ok(!text.toLowerCase().includes(kw), `${where}: "${text}" names the cut mechanic "${kw}"`);
      }
    }
  }
});
