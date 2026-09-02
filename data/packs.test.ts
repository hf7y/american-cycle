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
        // outside the panel's 1976-2018 range: bound against the era's own apportionment
        const st = BY_CODE[c.state];
        assert.ok(st, `${file}: ${c.id} -- unknown state ${c.state}`);
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
