/** hf7y/american-cycle#171/#55: after `cycleOffset` (engine/game.ts), a
 *  per-game random phase on the declare/refill rotation, re-measure seat
 *  bias at every table size to check the fix actually closes the gap
 *  instead of just moving it. n=2000 (SE ~1.1-2.0pp), tuned.json, ALL_PACKS.
 *
 *  node sim/scratch-cycleoffset-fix-171.ts
 */
import { seatBias } from './roundrobin.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';

const N = 2000;
const cards = loadPacks(ALL_PACKS);
const cfg = loadConfig('tuned.json');
const devOf = (b: number[], players: number) => 100 * Math.max(...b.map((x) => Math.abs(x - 1 / players)));
const fmt = (b: number[]) => b.map((x) => (100 * x).toFixed(2) + '%').join('  ');

console.log(`tuned.json, ALL_PACKS, Greedy self-play, n=${N}\n`);
for (const p of [2, 3, 4, 5, 6]) {
  const se = 100 * Math.sqrt((1 / p) * (1 - 1 / p) / N);
  const b = seatBias('Greedy', p, cards, cfg, N);
  const dev = devOf(b, p);
  console.log(`${p}p (SE ${se.toFixed(2)}pp)  ${fmt(b)}  max dev ${dev.toFixed(2)}pp${dev > 3 ? '  OVER BAR' : ''}`);
}
