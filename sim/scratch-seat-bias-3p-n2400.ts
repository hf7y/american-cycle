/** Scratch: hf7y/american-cycle#55's own falsifiable next step -- re-run
 *  3-player seat bias at n=2400 (SE 0.96pp) on both shipped configs, before
 *  anyone touches declaration order. #55 found seat 0 pinned at 28% against
 *  a 33.3% fair share at n=800 on both `tuned` and `as-written-plus`,
 *  identical to three decimal places across independent runs -- too
 *  consistent to be n=800's own 1.67pp sampling noise, but not yet measured
 *  at an N that isolates it from that noise with room to spare.
 *
 *  node sim/scratch-seat-bias-3p-n2400.ts
 */
import { seatBias } from './roundrobin.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';

const N = 2400;
const cards = loadPacks(ALL_PACKS);
const seFor = (n: number, players: number) => 100 * Math.sqrt((1 / players) * (1 - 1 / players) / n);

console.log(`3-player seat bias, n=${N} (SE ${seFor(N, 3).toFixed(2)}pp on a 33.3% fair share, 3pp bar)\n`);
for (const name of ['tuned.json', 'as-written-plus.json']) {
  const cfg = loadConfig(name);
  const b = seatBias('Greedy', 3, cards, cfg, N);
  const dev = Math.max(...b.map((x) => Math.abs(x - 1 / 3)));
  console.log(`  ${name.padEnd(22)} ${b.map((x) => (100 * x).toFixed(1) + '%').join('  ')}  max deviation ${(100 * dev).toFixed(2)}pp`);
}

// F25's own account: an ablation with capture disabled dropped the bias from
// its own figure to 2.7pp, so capture stayed in the causal path even after
// the ordering fix. Re-run the same ablation at n=2400 to see whether it
// still explains any of what's left.
console.log(`\ncapture-disabled ablation (game.captureEnabled: false), n=${N}\n`);
for (const name of ['tuned.json', 'as-written-plus.json']) {
  const base = loadConfig(name);
  const cfg = { ...base, game: { ...base.game, captureEnabled: false } };
  const b = seatBias('Greedy', 3, cards, cfg, N);
  const dev = Math.max(...b.map((x) => Math.abs(x - 1 / 3)));
  console.log(`  ${name.padEnd(22)} ${b.map((x) => (100 * x).toFixed(1) + '%').join('  ')}  max deviation ${(100 * dev).toFixed(2)}pp`);
}
