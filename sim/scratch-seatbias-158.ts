import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { seatBias } from './roundrobin.ts';

const cfg = loadConfig('tuned.json');
const cards = loadPacks(ALL_PACKS);
// #55's own bar is 3pp; n=2000 matches #171's closing N (SE ~0.9pp) so this
// run is directly comparable to #171's numbers rather than an underpowered
// re-read (n=800's SE ~1.6pp wasn't tight enough to separate 3.71pp from
// noise at 3-player, per #158's 2026-09-22 status comment).
for (const p of [2, 3, 4, 5, 6]) {
  const t0 = Date.now();
  const w = seatBias('Greedy', p, cards, cfg, 2000);
  const fair = 1 / p;
  const dev = Math.max(...w.map((x) => Math.abs(x - fair))) * 100;
  console.log(p, 'players:', w.map((x) => (x * 100).toFixed(1) + '%').join(' / '), 'max dev', dev.toFixed(2) + 'pp',
    `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
