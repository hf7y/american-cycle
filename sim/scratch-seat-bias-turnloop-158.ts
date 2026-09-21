/** Scratch: hf7y/american-cycle#158 acceptance item 2 -- "seat-order bias
 *  measured against #55's numbers, since one-at-a-time placement loads that
 *  axis." #55/#171 settled the pre-#158 mechanic at a `cycleOffset` fix,
 *  3pp bar, n=2000 on `tuned.json`/`ALL_PACKS` (3p landed at 1.82pp). This
 *  branch keeps `cycleOffset` in `declareRounds`'s `order` and in
 *  `draftCandidates`'s snake direction (engine/game.ts), so the question is
 *  whether the new one-at-a-time declare loop and face-up snake draft
 *  reopen the gap the offset closed, not whether the offset is still wired.
 *
 *  node sim/scratch-seat-bias-turnloop-158.ts
 */
import { seatBias } from './roundrobin.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';

const N = 2000;
const cards = loadPacks(ALL_PACKS);
const cfg = loadConfig('tuned.json');
const seFor = (n: number, players: number) => 100 * Math.sqrt((1 / players) * (1 - 1 / players) / n);

console.log(`seat bias under the #158 turn loop, tuned.json, ALL_PACKS, n=${N} (3pp bar, all Greedy)\n`);
for (const p of [2, 3, 4, 5, 6]) {
  const b = seatBias('Greedy', p, cards, cfg, N);
  const dev = Math.max(...b.map((x) => Math.abs(x - 1 / p)));
  const se = seFor(N, p);
  console.log(`  ${p}p: ${b.map((x) => (100 * x).toFixed(1) + '%').join('  ')}  max deviation ${(100 * dev).toFixed(2)}pp (SE ${se.toFixed(2)}pp)${dev * 100 > 3 ? '  OVER BAR' : ''}`);
}
