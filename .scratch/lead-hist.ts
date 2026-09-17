import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from '../sim/harness.ts';
import { seeds as sample } from '../findings/sample.ts';

const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const SEEDS = Array.from({ length: sample(120) }, (_, i) => 1030400 + i);
const cfg = loadConfig('tuned.json');
const cards = loadPacks(BALANCE_PACKS);

let total = 0, onCycle = 0, games = 0, lastOnCycle = 0;
const residues = [0, 0, 0, 0];
const lastResidues = [0, 0, 0, 0];

for (const seed of SEEDS) {
  const r = playOne(AGENTS, cards, cfg, seed);
  const h = r.scoreHistory;
  if (h.length < 2) continue;
  games++;
  let prev = -1, lastChangeRow = -1;
  h.forEach((row, i) => {
    const lead = row.indexOf(Math.max(...row));
    if (prev !== -1 && lead !== prev) {
      total++;
      residues[i % 4]++;
      if (i % 4 === 0) onCycle++;
      lastChangeRow = i;
    }
    prev = lead;
  });
  if (lastChangeRow >= 0) {
    lastResidues[lastChangeRow % 4]++;
    if (lastChangeRow % 4 === 0) lastOnCycle++;
  }
}

console.log('games', games, 'total lead changes', total);
console.log('presidential-row (i%4==0) share of ALL lead changes:', (onCycle/total).toFixed(3));
console.log('residue histogram of ALL lead changes (row%4):', residues);
console.log('residue histogram of LAST lead change per game (row%4):', lastResidues);
console.log('presidential-row share of LAST lead change:', (lastOnCycle/games).toFixed(3));

const detHist: Record<number, number> = {};
for (const seed of SEEDS) {
  const r = playOne(AGENTS, cards, cfg, seed);
  detHist[r.determinationYear] = (detHist[r.determinationYear] ?? 0) + 1;
}
console.log('determinationYear histogram:', detHist);
