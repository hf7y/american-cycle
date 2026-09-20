/** Scratch smoke test for hf7y/american-cycle#158's `draftedHand` mode --
 *  not a finding, just a manual sanity check while building it. */
import { Game, type Config } from '../engine/game.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { AGENTS } from './agents.ts';
import { RNG } from '../engine/rules/rng.ts';

const base = loadConfig('tuned.json');
const cfg: Config = { ...base, game: { ...base.game, draftedHand: true, maxYears: 20 } };
const cards = loadPacks(ALL_PACKS);

for (const seed of [1, 2, 3]) {
  const rng = new RNG(seed);
  const agents = ['Greedy', 'Lookahead', 'Random'].map((n) => new AGENTS[n](cfg, rng));
  const g = new Game(agents, structuredClone(cards), cfg, seed);
  const candsAtSetup = g.players.map((p) => p.hand.filter((c) => c.kind === 'candidate').length);
  const districtsAtSetup = g.players.map((p) => p.districts.length);
  const r = g.run();
  console.log(`seed ${seed}: candsAtSetup=${candsAtSetup} districtsAtSetup=${districtsAtSetup} years=${r.years} `
    + `events=${r.events.length} uncontestedShare=${r.uncontestedShare.toFixed(3)} `
    + `contestedSlotShare=${r.contestedSlotShare.toFixed(3)} decisions.length=${r.decisionCounts.length}`);
}
