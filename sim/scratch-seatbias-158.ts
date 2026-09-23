import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { seatBias } from './roundrobin.ts';

const cfg = loadConfig('tuned.json');
const cards = loadPacks(ALL_PACKS);
// #55's own bar is 3pp. n=800 (SE ~1.6pp) was underpowered to distinguish
// this branch's numbers from #171's closing n=2000 pass (SE ~0.9pp) --
// 3p read 3.71pp, over the bar, but not clearly outside noise at n=800.
// Re-run at #171's own n=2000 for a clean answer.
for (const p of [2, 3, 4, 5, 6]) {
  const t0 = Date.now();
  const w = seatBias('Greedy', p, cards, cfg, 2000);
  const fair = 1 / p;
  const dev = Math.max(...w.map((x) => Math.abs(x - fair))) * 100;
  console.log(p, 'players:', w.map((x) => (x * 100).toFixed(1) + '%').join(' / '), 'max dev', dev.toFixed(2) + 'pp',
    `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
