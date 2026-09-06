/** hf7y/american-cycle#106 acceptance item 1: the three changes behind
 *  separate flags, each measured ALONE against contested-slot share,
 *  races-legal-per-player, and the walkover rate -- #77's 45.6 races legal
 *  per player (42% of the board) and #40's 9.7% contested baseline.
 *
 *  "Races legal per player" is instrumented the way #77 describes doing it:
 *  inside `declare()`, before any card is chosen, counting open House races
 *  this player holds presence for via the same `eligible()` the engine
 *  itself gates on -- so `districtLevelEligibility` moves this number by
 *  construction, and the other two flags are the control showing it does
 *  not move for a reason unrelated to eligibility.
 *
 *  node sim/scratch-106-district-changes.ts [games-per-cell]
 */
import { loadConfig, loadPacks, BALANCE_PACKS } from './harness.ts';
import { AGENTS } from './agents.ts';
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { eligible } from '../engine/rules/elections.ts';
import type { Config, Agent, GameView, OpenRace, PendingPeg } from '../engine/game.ts';
import type { Declaration } from '../engine/rules/elections.ts';

const N = Number(process.argv[2] ?? 150);
const SEED_BASE = Number(process.env.SEED_BASE ?? 106000);
const cards = loadPacks(BALANCE_PACKS);
const POOL = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];

function instrumented(a: Agent, cfg: Config, legalCounts: number[]): Agent {
  return new Proxy(a, {
    get(t, p) {
      if (p === 'declare') {
        return (v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] => {
          const me = v.players[v.me];
          const house = open.filter((r) => r.office === 'representative');
          const legal = house.filter((r) => {
            const gate = cfg.game.districtLevelEligibility ? r.slot : undefined;
            return me.hand.some((c) => c.kind === 'candidate' && eligible(c, r.state, me.districts, gate));
          });
          legalCounts.push(legal.length);
          return a.declare(v, open, pending);
        };
      }
      return (t as never)[p];
    },
  });
}

function measure(n: number, cfg: Config) {
  let raceSlots = 0, contestedSlots = 0, uncontested = 0, events = 0;
  const legalCounts: number[] = [];
  for (let i = 0; i < n; i++) {
    const seed = SEED_BASE + i;
    const rng = new RNG(seed);
    const order = POOL.map((_, k) => POOL[(k + i) % POOL.length]);
    const agents = order.map((name) => instrumented(new AGENTS[name](cfg, rng), cfg, legalCounts));
    const g = new Game(agents, cards, cfg, seed);
    const r = g.run();
    contestedSlots += r.contestedSlotShare; raceSlots++;
    uncontested += r.uncontestedShare; events++;
  }
  return {
    contestedSlotShare: 100 * contestedSlots / raceSlots,
    uncontestedShare: 100 * uncontested / events,
    racesLegalPerPlayer: legalCounts.reduce((a, b) => a + b, 0) / legalCounts.length,
  };
}

const baseline: Config = loadConfig('tuned.json');
const cells: [string, Config][] = [
  ['baseline (all three flags off)', baseline],
  ['#106 change 1 alone: districtLevelEligibility', { ...baseline, game: { ...baseline.game, districtLevelEligibility: true } }],
  ['#106 change 3 alone: statewideFitSums', { ...baseline, game: { ...baseline.game, statewideFitSums: true } }],
  ['#106 change 4 alone: districtSupersession', { ...baseline, game: { ...baseline.game, districtSupersession: true } }],
  ['#106 all three together', {
    ...baseline,
    game: { ...baseline.game, districtLevelEligibility: true, statewideFitSums: true, districtSupersession: true },
  }],
];

console.log(`n=${N} per cell, pool ${POOL.join(',')}, tuned.json, ${BALANCE_PACKS.join('/')}`);
console.log('#77 baseline (pre-#106, tuned): 45.6 +-0.33 races legal per player, 42% of the board');
console.log('#40 baseline (pre-#106, tuned): 9.7% of general races contested\n');
for (const [label, cfg] of cells) {
  const m = measure(N, cfg);
  console.log(label);
  console.log(`  contestedSlotShare: ${m.contestedSlotShare.toFixed(2)}%`);
  console.log(`  uncontestedShare (walkover rate): ${m.uncontestedShare.toFixed(2)}%`);
  console.log(`  races legal per player-declare-call (House only): ${m.racesLegalPerPlayer.toFixed(2)}`);
  console.log('');
}
