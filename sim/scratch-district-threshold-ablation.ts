/** Scratch: hf7y/american-cycle#87's deferred decision -- whether
 *  `defaultPick`'s hardcoded `4` (the distinct-state spread a player wants
 *  before a district stops being worth drafting) should become a config
 *  field, wired to the already-declared-but-dead `draft.districtsPerPack`.
 *
 *  Now wired (engine/game.ts). This sweeps the threshold to check what each
 *  shipped config's already-declared value (3 or 5, never tuned because the
 *  field was never read) actually does, so shipping them is a decision on
 *  evidence rather than an accident of a dead default.
 *
 *  node sim/scratch-district-threshold-ablation.ts
 */
import { Game, type Config } from '../engine/game.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { AGENTS } from './agents.ts';
import { RNG } from '../engine/rules/rng.ts';

const cards = loadPacks(ALL_PACKS);
// No agent overrides draftPick (sim/agents.ts) -- defaultPick decides every
// draft in every game regardless of agent pool, so a plain 4-Greedy table is
// as representative as any other for this specific question.
const POOL = ['Greedy', 'Greedy', 'Greedy', 'Greedy'];
const SEEDS = 40;

function run(cfg: Config) {
  let districtsPerPlayer = 0, houseRaces = 0, years = 0;
  for (let i = 0; i < SEEDS; i++) {
    const seed = 9_000_000 + i;
    const rng = new RNG(seed);
    const agents = POOL.map((n) => new AGENTS[n](cfg, rng));
    const g = new Game(agents, cards, cfg, seed);
    const r = g.run();
    districtsPerPlayer += g.players.reduce((s, p) => s + p.districts.length, 0) / g.players.length;
    houseRaces += r.events.filter((e) => e.office === 'representative' && e.round === 'general').length;
    years += r.years;
  }
  return {
    meanDistrictsPerPlayer: districtsPerPlayer / SEEDS,
    meanHouseRaces: houseRaces / SEEDS,
    meanYears: years / SEEDS,
  };
}

const CONFIGS = ['tuned.json', 'as-written-plus.json'];
const GOALS = [2, 3, 4, 5, 6, 8, 12];

for (const name of CONFIGS) {
  const base = loadConfig(name);
  console.log(`\n${name} (shipped districtsPerPack: ${base.draft.districtsPerPack}, packSize: ${base.draft.packSize})`);
  console.log('goal'.padStart(5), 'districts/player'.padStart(18), 'House races'.padStart(13), 'years'.padStart(8));
  for (const goal of GOALS) {
    const cfg: Config = { ...base, draft: { ...base.draft, districtsPerPack: goal } };
    const r = run(cfg);
    console.log(
      String(goal).padStart(5),
      r.meanDistrictsPerPlayer.toFixed(2).padStart(18),
      r.meanHouseRaces.toFixed(1).padStart(13),
      r.meanYears.toFixed(1).padStart(8),
    );
  }
}
