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

/** Real Senate incumbent reelection, 1976-2016 (Vital Statistics on Congress,
 *  same source and window as the House figure above). */
function realSenateReelection(): number {
  const url = new URL('../data/historical/baseline.json', import.meta.url);
  const f = JSON.parse(readFileSync(url, 'utf8')) as { derived: { senate_mean_1976_2016: number } };
  return f.derived.senate_mean_1976_2016;
}

/** hf7y/american-cycle#53's Senate panel: the piece that was missing when this
 *  finding first shipped ("There is no Senate district panel to run the same
 *  correction on the Senate side"). Same margin definition as House's
 *  `effectiveCompetitiveness`, applied to `senate_panel.json`'s own races
 *  rather than to a borrowed House share -- Senate races are far less often a
 *  walkover than House ones, so the two shares are not interchangeable. */
function senateEffectiveCompetitiveness(pp: number): { share: number; n: number } {
  const url = new URL('../data/historical/senate_panel.json', import.meta.url);
  const f = JSON.parse(readFileSync(url, 'utf8')) as { rows: [number, string, number, number, string | null, string | null, number][] };
  const margins = f.rows
    .map(([, , d, r]) => (d + r === 0 ? undefined : (100 * Math.abs(d - r)) / (d + r)))
    .filter((m): m is number => m !== undefined);
  return { share: margins.filter((m) => m >= pp).length / margins.length, n: margins.length };
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
    + 'and now against #53\'s Senate panel, what are the House and Senate incumbency levels?',

  headline:
    "#16's own +4/+1 proposal used the naive 13.6% uncontested rate to back a contested-incumbent "
    + 'target of 93.2% (7 pips) out of the real 94.1% House reelection rate. #93 replaced that '
    + "population: at the >=20pp effective-competitiveness band (72.3%), the target falls to 78.7% "
    + "-- 4 pips, not 7. The Senate side no longer carries #16's placeholder -3 gap: #53's new "
    + '`senate_panel.json` (MEDSL Senate returns 1976-2018) gives its own effective-competitiveness '
    + 'share, 49.2% at >=20pp -- Senate races are walkovers far less often than House ones, so the '
    + "House share was never a valid stand-in. Applied to the real 83.2% Senate reelection rate (Vital "
    + 'Statistics, same source as House), the target is 66.9%, 2 pips -- not 1. House 4, Senate 2: the '
    + 'gap narrows from 3 pips to 2 once both sides are measured rather than one being assumed. Shipped '
    + 'as resolution.incumbencyHouse/incumbencySenate in all nine configs (tuned.json checked here).',
  stampedAt: '2026-09-05T21:30:00Z',
  stampedOn: '095ce3f',

  predicate(): Claim[] {
    const realHouse = realHouseReelection();
    const realSenate = realSenateReelection();
    const eff = effectiveCompetitiveness(20).share * 100;
    const effSenate = senateEffectiveCompetitiveness(20).share * 100;
    const contestedTarget = ((realHouse - eff) / (100 - eff)) * 100;
    const senateContestedTarget = ((realSenate - effSenate) / (100 - effSenate)) * 100;
    const houseEdge = edgeFor(contestedTarget);
    const senateEdge = edgeFor(senateContestedTarget);
    const cfg = loadConfig('tuned.json');
    return [
      { name: 'real: House incumbent reelection 1976-2016', value: realHouse, stamped: 94.1, tolerance: 0.5, unit: '%' },
      { name: 'real: Senate incumbent reelection 1976-2016', value: realSenate, stamped: 83.2, tolerance: 0.5, unit: '%' },
      { name: "real: effective competitiveness, >=20pp (#93's band)", value: eff, stamped: 72.3, tolerance: 0.5, unit: '%' },
      { name: 'real: Senate effective competitiveness, >=20pp', value: effSenate, stamped: 49.2, tolerance: 0.5, unit: '%' },
      { name: 'derived: House contested-incumbent-survival target', value: contestedTarget, stamped: 78.7, tolerance: 1, unit: '%' },
      { name: 'derived: Senate contested-incumbent-survival target', value: senateContestedTarget, stamped: 66.9, tolerance: 1, unit: '%' },
      { name: 'derived: House incumbency edge', value: houseEdge, stamped: 4, tolerance: 0, unit: 'pips' },
      { name: 'derived: Senate incumbency edge', value: senateEdge, stamped: 2, tolerance: 0, unit: 'pips' },
      { name: 'tuned.json ships the derived House edge', value: cfg.resolution.incumbencyHouse ?? -1, stamped: 4, tolerance: 0 },
      { name: 'tuned.json ships the derived Senate edge', value: cfg.resolution.incumbencySenate ?? -1, stamped: 2, tolerance: 0 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const corrected = v('derived: House incumbency edge') < 7;
    const gap = v('derived: House incumbency edge') - v('derived: Senate incumbency edge');
    const shipped = v('tuned.json ships the derived House edge') === v('derived: House incumbency edge')
      && v('tuned.json ships the derived Senate edge') === v('derived: Senate incumbency edge');
    return [
      corrected
        ? "the effective-competitiveness correction lowers the House target below #16's own naive 7-pip proposal"
        : 'the correction no longer lowers the House target -- the underlying data moved',
      `House/Senate edge gap now measures ${gap} pips on both sides' own data`,
      shipped ? 'and the shipped config matches this derivation' : 'BUT the shipped config no longer matches this derivation',
    ].join('; ');
  },
};
