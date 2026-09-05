/** SCRATCH — #16's remaining half: the House/Senate incumbency magnitudes,
 *  re-derived against #93's effective-competitiveness band instead of the
 *  naive uncontested rate the original +4/+1 proposal used. Research only;
 *  ships no config, no test. Run: node sim/scratch-incumbency-magnitude-16.ts
 */
import { readFileSync } from 'node:fs';
import { oddsAtEdge } from '../engine/rules/resolution.ts';
import { effectiveCompetitiveness } from '../tracks/history.ts';

const baseline = JSON.parse(
  readFileSync(new URL('../data/historical/baseline.json', import.meta.url), 'utf8'),
) as { derived: { house_mean_1976_2016: number; senate_mean_1976_2016: number } };

const realHouse = baseline.derived.house_mean_1976_2016;
const realSenate = baseline.derived.senate_mean_1976_2016;

/** Smallest integer pip edge whose exact win probability clears `target`,
 *  the same rounding #16's own table used (93.2% -> 7, 80.6% -> 4: both are
 *  the first edge at or above the target, not the nearest). */
function edgeFor(targetPct: number): number {
  for (let e = 0; e <= 15; e++) if (100 * oddsAtEdge(e) >= targetPct) return e;
  return 15;
}

console.log('House overall real reelection:', realHouse, '  Senate:', realSenate);
console.log();
console.log('Naive correction (uncontested 13.6%, #16 original — invalidated by #93):');
{
  const eff = 13.6;
  const contested = (realHouse - eff) / (100 - eff) * 100;
  console.log(`  House contested-survival target ${contested.toFixed(1)}%  -> edge ${edgeFor(contested)}`);
}
console.log();
console.log("Corrected against #93's effective-competitiveness band (House side only --");
console.log(' no Senate district panel exists to run the same correction there):');
for (const pp of [40, 30, 20]) {
  const { share } = effectiveCompetitiveness(pp);
  const eff = share * 100;
  const contested = (realHouse - eff) / (100 - eff) * 100;
  console.log(`  >=${pp}pp band ${eff.toFixed(1)}%  -> House contested-survival target ${contested.toFixed(1)}%  -> edge ${edgeFor(contested)}`);
}
console.log();
console.log('Chosen: the >=20pp row, #93\'s own bolded headline figure.');
const eff20Pct = effectiveCompetitiveness(20).share * 100;
const houseContested = (realHouse - eff20Pct) / (100 - eff20Pct) * 100;
const houseEdge = edgeFor(houseContested);
console.log(`  House: contested-survival target ${houseContested.toFixed(1)}%  -> ${houseEdge} pips`);
console.log("  Senate: no panel to correct directly. Preserve #16's ROBUST finding --");
console.log('  the ~3-pip House/Senate gap -- rather than reuse the House-specific band as a Senate proxy.');
console.log(`  Senate: ${houseEdge} - 3 = ${houseEdge - 3} pips`);
console.log();
console.log('Sanity check against real Senate rate, for the record only (no panel backs this):', realSenate);
