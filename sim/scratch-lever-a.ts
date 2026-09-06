// Scratch probe for hf7y/american-cycle#105 acceptance item 4: "state
// explicitly if lever A alone is sufficient." Lever A rides on #51's
// pushKeyedOn:'surprise' with "no new mechanic" -- this checks whether
// merely enabling it moves the three acceptance metrics at all. Not wired
// into anything, not committed as a finding.
import { loadConfig, loadPacks, playOne, ALL_PACKS } from './harness.ts';

function run(pushKeyedOn: 'margin' | 'surprise' | undefined, seeds: number) {
  const base = loadConfig('tuned.json');
  const cards = loadPacks(ALL_PACKS);
  const cfg = {
    ...base,
    game: { ...base.game, startYear: 1932 },
    lean: { ...base.lean, ...(pushKeyedOn ? { pushKeyedOn } : {}) },
  };
  let generals = 0, walkovers = 0, safe40 = 0;
  for (let i = 0; i < seeds; i++) {
    const r = playOne(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg as never, 2030000 + i);
    for (const e of r.events) {
      if (e.office !== 'representative' || e.round !== 'general') continue;
      generals++;
      if (e.uncontested) { walkovers++; continue; }
      if (2 * Math.abs(e.margin) >= 40) safe40++;
    }
  }
  return {
    generals,
    walkoverShare: (100 * walkovers) / generals,
    contestedShare: (100 * (generals - walkovers)) / generals,
    safe40Share: (100 * safe40) / generals,
  };
}

const seeds = Number(process.argv[2] ?? 60);
const baseline = run(undefined, seeds);
const leverA = run('surprise', seeds);
console.log('baseline (pushKeyedOn: margin, i.e. shipped default):', baseline);
console.log('lever A  (pushKeyedOn: surprise):                    ', leverA);
