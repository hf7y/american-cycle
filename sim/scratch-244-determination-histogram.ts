/** hf7y/american-cycle#244: histogram the year of the last lead change
 *  (per-game GameResult.determinationYear) across seeds, to check Zach's
 *  working hypothesis that the score lead only changes hands at presidential
 *  elections. Throwaway verification script, not a finding -- run once,
 *  report on the issue, delete.
 */
import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from './harness.ts';

const cfg = loadConfig('tuned.json');
const cards = loadPacks(BALANCE_PACKS);
const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const N = Number(process.argv[2] ?? 400);

const startYear = cfg.game.startYear;
console.log(`startYear=${startYear} (isPresidentialYear = year %4 === 0 -> ${startYear % 4 === 0}), maxYears=${cfg.game.maxYears}, N=${N}`);

const byYear: Record<number, number> = {};
const byPhase: Record<number, number> = {}; // determinationYear mod 4
let total = 0;

for (let i = 0; i < N; i++) {
  const r = playOne(AGENTS, cards, cfg, 4400000 + i);
  const dy = r.determinationYear;
  byYear[dy] = (byYear[dy] ?? 0) + 1;
  byPhase[dy % 4] = (byPhase[dy % 4] ?? 0) + 1;
  total++;
}

console.log('\ndeterminationYear histogram (year offset from startYear, 0..maxYears):');
for (const y of Object.keys(byYear).map(Number).sort((a, b) => a - b)) {
  const calYear = startYear + y;
  const pres = calYear % 4 === 0;
  const pct = (100 * byYear[y] / total).toFixed(1);
  console.log(`  y=${String(y).padStart(2)} (${calYear}${pres ? ' PRES' : '     '}): ${'#'.repeat(Math.round(byYear[y] / total * 100))} ${byYear[y]} (${pct}%)`);
}

console.log('\nby (determinationYear mod 4) -- 0 means it lands on a presidential-year offset:');
for (const p of [0, 1, 2, 3]) {
  const pct = (100 * (byPhase[p] ?? 0) / total).toFixed(1);
  console.log(`  mod4=${p}: ${byPhase[p] ?? 0} (${pct}%)`);
}

const presShare = (byPhase[0] ?? 0) / total;
console.log(`\npresidential-offset share (mod4=0 only): ${(100 * presShare).toFixed(1)}% (uniform null would be 25%)`);

const evenShare = ((byPhase[0] ?? 0) + (byPhase[2] ?? 0)) / total;
console.log(`even-year share (mod4=0 or 2, i.e. any House election year): ${(100 * evenShare).toFixed(1)}% (uniform null would be 50%)`);
