import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { seatBias } from './roundrobin.ts';

const cfg = loadConfig('tuned.json');
const cards = loadPacks(ALL_PACKS);
// #55's own bar is 3pp; n=800 gives SE ~1.6pp (matches #55's first-pass N).
// Full ALL_PACKS games run slower under #158's per-round declare loop than
// the old batch loop did, so 800 rather than #55's later n=2400 pass, to
// keep this within one run's wall-clock budget.
for (const p of [2, 3, 4, 5, 6]) {
  const t0 = Date.now();
  const w = seatBias('Greedy', p, cards, cfg, 800);
  const fair = 1 / p;
  const dev = Math.max(...w.map((x) => Math.abs(x - fair))) * 100;
  console.log(p, 'players:', w.map((x) => (x * 100).toFixed(1) + '%').join(' / '), 'max dev', dev.toFixed(2) + 'pp',
    `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
