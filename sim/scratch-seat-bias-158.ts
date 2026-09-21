/** #158 acceptance item 2: seat-order bias, re-measured against
 *  findings/balance-metrics.ts's stamped SIM-BRIEF bar (no seat >3pp off a
 *  fair share) now that declarations go down one at a time around the table
 *  instead of as a simultaneous batch -- the mechanic #158's own body
 *  flagged as loading the seat-order axis. Same `seatBias()` instrument
 *  balance-metrics.ts uses, at a cut sample size (a smoke run, not a
 *  restamp): FINDINGS_SEEDS-style override via --n, default well below the
 *  1000-game stamp because of #286's ~16x per-game slowdown on this branch.
 *
 *  node sim/scratch-seat-bias-158.ts [--n 100]
 */
import { loadConfig, loadPacks, BALANCE_PACKS, arg } from './harness.ts';
import { seatBias } from './roundrobin.ts';

const PLAYER_COUNTS = [2, 3, 4, 5, 6] as const;
const stampedBias: Record<(typeof PLAYER_COUNTS)[number], number> = { 2: 1.3, 3: 3.03, 4: 1.0, 5: 2.7, 6: 1.13 };

const n = Number(arg('--n', '100'));
const cfg = loadConfig('tuned.json');
const cards = loadPacks(BALANCE_PACKS);

console.time('probe');
const out: Record<number, { dev: number; stamped: number; wins: number[] }> = {};
for (const p of PLAYER_COUNTS) {
  const wins = seatBias('Greedy', p, cards, cfg, n);
  const dev = 100 * Math.max(...wins.map((x) => Math.abs(x - 1 / p)));
  out[p] = { dev, stamped: stampedBias[p], wins };
  console.log(`${p}p: max deviation ${dev.toFixed(2)}pp (stamped ${stampedBias[p]}pp)`, wins.map((w) => (100 * w).toFixed(1)));
}
console.timeEnd('probe');
console.log(JSON.stringify({ n, out }, null, 2));
