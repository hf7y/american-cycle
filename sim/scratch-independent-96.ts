/** hf7y/american-cycle#96, acceptance item 5: does letting a primary loser
 *  re-declare as an independent move `contestedSlotShare` or general-round
 *  contest? `Base.declareIndependent` (sim/agents.ts) gates on the same
 *  -4 bound `withdraw` uses, but only for an incumbent (`myModifiers` carries
 *  an `incumbency` line) -- a narrow, real-case-shaped condition, so the
 *  question is whether it fires often enough to register.
 *
 *  Same toggle isolated two ways: the shipped pool as built (the hook live)
 *  against a wrapped pool where `declareIndependent` is forced off, so a
 *  primary loser always returns to hand as before #96. */
import { loadConfig, loadPacks, BALANCE_PACKS } from './harness.ts';
import { AGENTS } from './agents.ts';
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import type { Config, Agent } from '../engine/game.ts';

const N = Number(process.argv[2] ?? 300);
const cards = loadPacks(BALANCE_PACKS);
const POOL = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const cfg: Config = loadConfig('tuned.json');

function neverIndependent(a: Agent): Agent {
  return new Proxy(a, { get(t, p) { return p === 'declareIndependent' ? (() => false) : (t as never)[p]; } });
}

function measure(n: number, wrap: (a: Agent) => Agent) {
  let raceSlots = 0, contestedSlots = 0, generals = 0, contestedGenerals = 0, independentRuns = 0;
  for (let i = 0; i < n; i++) {
    const seed = 96000 + i;
    const rng = new RNG(seed);
    const order = POOL.map((_, k) => POOL[(k + i) % POOL.length]);
    const g = new Game(order.map((name) => wrap(new AGENTS[name](cfg, rng))), cards, cfg, seed);
    const r = g.run();
    contestedSlots += r.contestedSlotShare; raceSlots++;
    for (const e of r.events) {
      if (e.round !== 'general') continue;
      generals++;
      if (e.sides.length > 1) contestedGenerals++;
      if (e.sides.some((s) => s.party === 'I')) independentRuns++;
    }
  }
  return {
    contestedSlotShare: 100 * contestedSlots / raceSlots,
    generalContestShare: 100 * contestedGenerals / generals,
    independentGeneralRuns: independentRuns,
  };
}

console.log(`n=${N} per cell, pool ${POOL.join(',')}, tuned.json\n`);
for (const [label, wrap] of [
  ['#96 live (Base.declareIndependent as shipped)', (a: Agent) => a],
  ['#96 forced off (primary loser always returns to hand)', neverIndependent],
] as const) {
  const m = measure(N, wrap);
  console.log(label);
  console.log(`  contestedSlotShare: ${m.contestedSlotShare.toFixed(2)}%`);
  console.log(`  general-round contest share: ${m.generalContestShare.toFixed(2)}%`);
  console.log(`  general races with an independent side: ${m.independentGeneralRuns}`);
  console.log('');
}
