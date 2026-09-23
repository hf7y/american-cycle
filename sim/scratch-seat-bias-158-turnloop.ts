/** #158/#285 acceptance item 2: seat-order bias vs #55's numbers, re-measured
 *  under declareRounds. Mirrors findings/balance-metrics.ts's own method
 *  (BALANCE_PACKS, tuned.json, Greedy, n=1000) so the result is directly
 *  comparable to that finding's stamped pre-#158 baseline:
 *  { 2: 1.3, 3: 3.03, 4: 1.0, 5: 2.7, 6: 1.13 }, plus 3p/ALL_PACKS: 2.53. */
import { loadConfig, loadPacks, ALL_PACKS, BALANCE_PACKS } from './harness.ts';
import { seatBias } from './roundrobin.ts';

const cfg = loadConfig('tuned.json');
const cards = loadPacks(BALANCE_PACKS);
const n = 1000;
const PLAYER_COUNTS = [2, 3, 4, 5, 6] as const;
const stampedBias: Record<(typeof PLAYER_COUNTS)[number], number> = { 2: 1.3, 3: 3.03, 4: 1.0, 5: 2.7, 6: 1.13 };

console.log(`seat bias, declareRounds mechanic, BALANCE_PACKS, tuned.json, n=${n}`);
for (const p of PLAYER_COUNTS) {
  const b = seatBias('Greedy', p, cards, cfg, n);
  const dev = 100 * Math.max(...b.map((x) => Math.abs(x - 1 / p)));
  console.log(`  ${p}p: ${b.map((x) => (100 * x).toFixed(1) + '%').join(' ')}  max deviation ${dev.toFixed(2)}pp  (stamped ${stampedBias[p]}pp)`);
}

const cardsAll = loadPacks(ALL_PACKS);
const b3all = seatBias('Greedy', 3, cardsAll, cfg, n);
const dev3all = 100 * Math.max(...b3all.map((x) => Math.abs(x - 1 / 3)));
console.log(`  3p ALL_PACKS: ${b3all.map((x) => (100 * x).toFixed(1) + '%').join(' ')}  max deviation ${dev3all.toFixed(2)}pp  (stamped 2.53pp)`);
