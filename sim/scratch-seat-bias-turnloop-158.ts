/** hf7y/american-cycle#158 acceptance item 2: "seat-order bias vs #55's
 *  numbers, since one-at-a-time placement loads that axis." Same method as
 *  #171/#179's post-fix check (sim/scratch-cycleoffset-fix-171.ts): tuned.json,
 *  ALL_PACKS, Greedy self-play, seatBias() from sim/roundrobin.ts. N=800
 *  (SE ~0.7-1.7pp) rather than #171's n=2000 -- this branch's declare-round
 *  cost (#286) makes n=2000 across five table sizes too slow for one run;
 *  n=800 matches #55's own first-pass power and clears the 3pp bar's SE at
 *  the low end.
 *
 *  as-written-plus.json is not measured here: its 100-year games take ~17s
 *  each on this branch (#288's unbounded district growth), which would put
 *  this script at several hours. tuned.json's 16-year games are the
 *  practical instrument until #288 is ruled on.
 *
 *  node sim/scratch-seat-bias-turnloop-158.ts
 */
import { seatBias } from './roundrobin.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';

const N = 800;
const cards = loadPacks(ALL_PACKS);
const cfg = loadConfig('tuned.json');
const devOf = (b: number[], players: number) => 100 * Math.max(...b.map((x) => Math.abs(x - 1 / players)));
const fmt = (b: number[]) => b.map((x) => (100 * x).toFixed(2) + '%').join('  ');

console.log(`turn-loop-redesign-158, tuned.json, ALL_PACKS, Greedy self-play, n=${N}\n`);
for (const p of [2, 3, 4, 5, 6]) {
  const se = 100 * Math.sqrt((1 / p) * (1 - 1 / p) / N);
  const b = seatBias('Greedy', p, cards, cfg, N);
  const dev = devOf(b, p);
  console.log(`${p}p (SE ${se.toFixed(2)}pp)  ${fmt(b)}  max dev ${dev.toFixed(2)}pp${dev > 3 ? '  OVER BAR' : ''}`);
}
