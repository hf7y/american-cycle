/** hf7y/american-cycle#158 acceptance item 2: re-measure seat-order bias
 *  against #55's numbers (findings/balance-metrics.ts's stampedBias) under
 *  this branch's one-at-a-time declareRounds mechanic, using the exact same
 *  measurement (sim/roundrobin.ts's seatBias, tuned.json, BALANCE_PACKS,
 *  Greedy self-play) so the comparison is apples to apples.
 *
 *  node sim/scratch-seat-bias-turn-loop-158.ts
 */
import { seatBias } from './roundrobin.ts';
import { loadConfig, loadPacks, BALANCE_PACKS } from './harness.ts';

const N = 1000;
const cards = loadPacks(BALANCE_PACKS);
const cfg = loadConfig('tuned.json');
const devOf = (b: number[], players: number) => 100 * Math.max(...b.map((x) => Math.abs(x - 1 / players)));
const fmt = (b: number[]) => b.map((x) => (100 * x).toFixed(2) + '%').join('  ');
const stamped: Record<number, number> = { 2: 1.3, 3: 3.03, 4: 1.0, 5: 2.7, 6: 1.13 };

console.log(`tuned.json, BALANCE_PACKS, Greedy self-play, n=${N} -- vs #55's stamped max deviation\n`);
for (const p of [2, 3, 4, 5, 6]) {
  const se = 100 * Math.sqrt((1 / p) * (1 - 1 / p) / N);
  const b = seatBias('Greedy', p, cards, cfg, N);
  const dev = devOf(b, p);
  const delta = dev - stamped[p];
  console.log(`${p}p (SE ${se.toFixed(2)}pp)  ${fmt(b)}  max dev ${dev.toFixed(2)}pp  stamped ${stamped[p]}pp  delta ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}pp${dev > 3 ? '  OVER BAR' : ''}`);
}
