/** hf7y/american-cycle#158 acceptance item 2: re-measure seat bias under the
 *  dealt-districts / face-up snake draft / one-at-a-time declare mechanic and
 *  check it against #55/#171's 3pp bar and cycleOffset fix, which this
 *  branch's `draftCandidates`/`declareRounds` order both still apply
 *  (engine/game.ts:1419, :2068). One-at-a-time placement loads the seat-order
 *  axis more than the old batch declare did (#158's own flag), so this is
 *  the check that the existing fix still holds rather than an assumption
 *  that it does.
 *
 *  N is far lower than `scratch-cycleoffset-fix-171.ts`'s n=2000: #286
 *  measured this branch at ~15-25x main's per-game cost, so n=2000 here
 *  would be the cost of n=30000-50000 on main. 3p gets the most power
 *  (it's the historically worst case); the rest are a lower-power sweep.
 *
 *  node sim/scratch-seat-bias-draft-158.ts
 */
import { seatBias } from './roundrobin.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';

const cards = loadPacks(ALL_PACKS);
const cfg = loadConfig('tuned.json');
const devOf = (b: number[], players: number) => 100 * Math.max(...b.map((x) => Math.abs(x - 1 / players)));
const fmt = (b: number[]) => b.map((x) => (100 * x).toFixed(2) + '%').join('  ');

const plan: [number, number][] = [[3, 300], [2, 150], [4, 150], [5, 150], [6, 150]];

console.log(`turn-loop-redesign-158, tuned.json, ALL_PACKS, Greedy self-play\n`);
for (const [p, N] of plan) {
  const se = 100 * Math.sqrt((1 / p) * (1 - 1 / p) / N);
  const t0 = Date.now();
  const b = seatBias('Greedy', p, cards, cfg, N);
  const dev = devOf(b, p);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`${p}p (n=${N}, SE ${se.toFixed(2)}pp, ${secs}s)  ${fmt(b)}  max dev ${dev.toFixed(2)}pp${dev > 3 ? '  OVER BAR' : ''}`);
}
