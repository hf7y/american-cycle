// Scratch probe for hf7y/american-cycle#105 levers B and C, the two levers
// left after #206 measured lever A (pushKeyedOn:'surprise') alone as
// insufficient. Same shape as scratch-lever-a.ts: not wired into anything,
// not committed as a finding, seeds/config/agents held identical across arms
// so only the lever under test differs.
import { loadConfig, loadPacks, playOne, ALL_PACKS } from './harness.ts';

function run(flags: { pushKeyedOn?: 'surprise'; generalLoserReturns?: boolean; contestCapture?: boolean }, seeds: number) {
  const base = loadConfig('tuned.json');
  const cards = loadPacks(ALL_PACKS);
  const cfg = {
    ...base,
    game: { ...base.game, startYear: 1932, generalLoserReturns: flags.generalLoserReturns, contestCapture: flags.contestCapture },
    lean: { ...base.lean, ...(flags.pushKeyedOn ? { pushKeyedOn: flags.pushKeyedOn } : {}) },
  };
  let generals = 0, walkovers = 0, safe40 = 0, contestedShareSum = 0;
  for (let i = 0; i < seeds; i++) {
    const r = playOne(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg as never, 2040000 + i);
    contestedShareSum += r.contestedSlotShare;
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
    contestedSlotShare: contestedShareSum / seeds,
  };
}

const seeds = Number(process.argv[2] ?? 60);
const arms: Record<string, { pushKeyedOn?: 'surprise'; generalLoserReturns?: boolean; contestCapture?: boolean }> = {
  'baseline (all levers off)': {},
  'A alone (pushKeyedOn: surprise)': { pushKeyedOn: 'surprise' },
  'B alone (generalLoserReturns)': { generalLoserReturns: true },
  'C alone (contestCapture)': { contestCapture: true },
  'B+C': { generalLoserReturns: true, contestCapture: true },
  'A+B+C': { pushKeyedOn: 'surprise', generalLoserReturns: true, contestCapture: true },
};
for (const [name, flags] of Object.entries(arms)) {
  console.log(name.padEnd(32), run(flags, seeds));
}
