/** Scratch: hf7y/american-cycle#158's own ruling, acceptance item 2 --
 *  "seat-order bias measured against #55's numbers, since one-at-a-time
 *  placement loads that axis." #55/#171 were already fixed by randomizing
 *  the declare/refill rotation's phase per game (`cycleOffset`, PR #179),
 *  which this redesign inherits unchanged (`declareRounds`'s `order` and
 *  `draftCandidates`'s refill rotation both still add it) -- this measures
 *  whether that fix still holds once declaration is one-at-a-time and
 *  candidates are drafted face-up in snake order, rather than assuming it
 *  does.
 *
 *  Same shape as PR #179's own re-measurement and
 *  scratch-seat-bias-2456p-ablation.ts's ablation grid: all-Greedy self-play,
 *  ALL_PACKS, tuned.json, per #55/#171's 3pp bar.
 *
 *  node sim/scratch-seat-bias-turn-loop-158.ts
 */
import { seatBias } from './roundrobin.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';

const N = Number(process.argv[2] ?? 600);
const cards = loadPacks(ALL_PACKS);
const cfg = loadConfig('tuned.json');
const seFor = (players: number) => 100 * Math.sqrt((1 / players) * (1 - 1 / players) / N);
const devOf = (b: number[], players: number) => 100 * Math.max(...b.map((x) => Math.abs(x - 1 / players)));
const fmt = (b: number[]) => b.map((x) => (100 * x).toFixed(1) + '%').join('  ');

console.log(`turn-loop-redesign-158, all-Greedy, ALL_PACKS, tuned.json, n=${N}\n`);
for (const p of [2, 3, 4, 5, 6]) {
  const b = seatBias('Greedy', p, cards, cfg, N);
  const dev = devOf(b, p);
  console.log(`  ${p}p (SE ${seFor(p).toFixed(2)}pp, bar 3pp): ${fmt(b)}  max dev ${dev.toFixed(2)}pp${dev > 3 ? '  OVER BAR' : ''}`);
}
