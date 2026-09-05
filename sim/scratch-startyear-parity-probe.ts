import { seatBias } from './roundrobin.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import type { Config } from '../engine/game.ts';

const cards = loadPacks(ALL_PACKS);
const base = loadConfig('tuned.json');
const N = 2000;

for (const startYear of [1976, 1978, 1980, 1982]) {
  const cfg: Config = { ...base, game: { ...base.game, startYear } };
  const b = seatBias('Greedy', 2, cards, cfg, N);
  const dev = 100 * Math.max(...b.map((x) => Math.abs(x - 0.5)));
  console.log(`startYear=${startYear} floor/2 parity=${Math.floor(startYear / 2) % 2}  `,
    b.map((x) => (100 * x).toFixed(2) + '%').join('  '), 'dev', dev.toFixed(2) + 'pp');
}
