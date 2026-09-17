import { loadConfig, loadPacks, playOne, ALL_PACKS } from './harness.ts';

const cfg = loadConfig('tuned.json');
const cards = loadPacks(ALL_PACKS);
console.time('game');
const r = playOne(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg, 42);
console.timeEnd('game');
console.log(JSON.stringify({
  years: r.years, winner: r.winner, scores: r.scores, uncontestedShare: r.uncontestedShare,
  contestedSlotShare: r.contestedSlotShare, decisionCounts: r.decisionCounts.slice(0, 20),
  events: r.events.length,
}, null, 2));
