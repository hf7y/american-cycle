import { readFileSync } from 'node:fs';
import { loadConfig } from '../sim/harness.ts';
import { oddsAtEdge } from '../engine/rules/resolution.ts';
import { effectiveCompetitiveness } from '../tracks/history.ts';
import type { Claim, Finding } from './types.ts';

/** Real House incumbent reelection, 1976-2016, re-read rather than retyped --
 *  same source as findings/incumbency-calibration.ts. */
function realHouseReelection(): number {
  const url = new URL('../data/historical/baseline.json', import.meta.url);
  const f = JSON.parse(readFileSync(url, 'utf8')) as { derived: { house_mean_1976_2016: number } };
  return f.derived.house_mean_1976_2016;
}

/** hf7y/american-cycle#91's deck-sensitivity axis does not apply here: every
 *  claim below is either read from `data/historical/baseline.json` or from
 *  `tuned.json` as shipped, and none of them plays a game or loads a card
 *  pool. There is nothing for a second era-pack pool to move. */

/** Smallest integer pip edge whose exact win probability clears `targetPct` --
 *  the same rounding hf7y/american-cycle#16's own table used (93.2% -> 7 pips,
 *  80.6% -> 4 pips: the first edge AT OR ABOVE the target, not the nearest). */
function edgeFor(targetPct: number): number {
  for (let e = 0; e <= 15; e++) if (100 * oddsAtEdge(e) >= targetPct) return e;
  return 15;
}

export const finding: Finding = {
  id: 'incumbency-magnitude',
  dependsOn: ['tuned.json'],
  question:
    "hf7y/american-cycle#16, its remaining half: #11 fixed the pip-scale ceiling and #93 replaced "
    + "the naive uncontested-rate population with effective competitiveness. Re-derived against both, "
    + 'what are the House and Senate incumbency levels?',

  headline:
    "#16's own +4/+1 proposal used the naive 13.6% uncontested rate to back a contested-incumbent "
    + 'target of 93.2% (7 pips) out of the real 94.1% House reelection rate. #93 replaced that '
    + "population: at the >=20pp effective-competitiveness band (72.3%), the target falls to 78.7% "
    + '-- 4 pips, not 7. There is no Senate district panel to run the same correction on the Senate '
    + "side, so the Senate level carries #16's own ROBUST finding forward instead of guessing a second "
    + 'population correction: the ~3-pip House/Senate gap. House 4, Senate 1 -- direction and gap both '
    + 'preserved, magnitude corrected. Shipped as resolution.incumbencyHouse/incumbencySenate in all '
    + 'nine configs (tuned.json checked here).',
  stampedAt: '2026-09-05T04:37:10Z',
  stampedOn: '218542b',

  predicate(): Claim[] {
    const realHouse = realHouseReelection();
    const eff = effectiveCompetitiveness(20).share * 100;
    const contestedTarget = ((realHouse - eff) / (100 - eff)) * 100;
    const houseEdge = edgeFor(contestedTarget);
    const senateEdge = houseEdge - 3;
    const cfg = loadConfig('tuned.json');
    return [
      { name: 'real: House incumbent reelection 1976-2016', value: realHouse, stamped: 94.1, tolerance: 0.5, unit: '%' },
      { name: "real: effective competitiveness, >=20pp (#93's band)", value: eff, stamped: 72.3, tolerance: 0.5, unit: '%' },
      { name: 'derived: House contested-incumbent-survival target', value: contestedTarget, stamped: 78.7, tolerance: 1, unit: '%' },
      { name: 'derived: House incumbency edge', value: houseEdge, stamped: 4, tolerance: 0, unit: 'pips' },
      { name: 'derived: Senate incumbency edge', value: senateEdge, stamped: 1, tolerance: 0, unit: 'pips' },
      { name: 'tuned.json ships the derived House edge', value: cfg.resolution.incumbencyHouse ?? -1, stamped: 4, tolerance: 0 },
      { name: 'tuned.json ships the derived Senate edge', value: cfg.resolution.incumbencySenate ?? -1, stamped: 1, tolerance: 0 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const corrected = v('derived: House incumbency edge') < 7;
    const shipped = v('tuned.json ships the derived House edge') === v('derived: House incumbency edge')
      && v('tuned.json ships the derived Senate edge') === v('derived: Senate incumbency edge');
    return [
      corrected
        ? "the effective-competitiveness correction lowers the House target below #16's own naive 7-pip proposal"
        : 'the correction no longer lowers the House target -- the underlying data moved',
      shipped ? 'and the shipped config matches this derivation' : 'BUT the shipped config no longer matches this derivation',
    ].join('; ');
  },
};
