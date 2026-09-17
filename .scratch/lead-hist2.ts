import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from '../sim/harness.ts';
import { seeds as sample } from '../findings/sample.ts';

const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const SEEDS = Array.from({ length: sample(120) }, (_, i) => 1030400 + i);
const cfg = loadConfig('tuned.json');
const cards = loadPacks(BALANCE_PACKS);

const runs = SEEDS.map((s) => playOne(AGENTS, cards, cfg, s)).filter((r) => r.scoreHistory.length > 1);
const maxLen = Math.max(...runs.map((r) => r.scoreHistory.length));
const curve: number[] = [];
for (let y = 0; y < maxLen; y++) {
  let n = 0, hit = 0;
  for (const r of runs) {
    const row = r.scoreHistory[y];
    if (!row) continue;
    n++;
    const best = Math.max(...row);
    if (row[r.winner] === best) hit++;
  }
  if (n) curve.push(hit / n);
}
console.log('curve (row -> share leader=winner):');
curve.forEach((v, i) => console.log(`  row ${i} (calendar year ${1976 + i}, presidential=${i % 4 === 0}): ${v.toFixed(3)}`));
const idx = curve.findIndex((x) => x > 0.8);
console.log('idx crossing 0.8:', idx, 'determination:', idx / curve.length);
