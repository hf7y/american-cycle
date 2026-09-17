import { loadConfig, loadPacks, BALANCE_PACKS } from './harness.ts';
import { duel } from './roundrobin.ts';
import { seeds as sample } from '../findings/sample.ts';

const cfg = loadConfig('tuned.json');
const cards = loadPacks(BALANCE_PACKS);
const n = sample(300);
const w = 100 * duel('RunningMate', 'Greedy', cards, cfg, n);
console.log(`RunningMate win rate vs Greedy, 1v1, n=${n}: ${w.toFixed(1)}%`);
