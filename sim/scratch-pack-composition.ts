/** Scratch: hf7y/american-cycle#132 -- district holdings per player are flat
 *  across the whole `draft.districtsPerPack` sweep (#87's own follow-up
 *  finding). #132 names the first thing worth checking: `defaultPick`'s
 *  "best of what's in the pack" step can only prefer a candidate over a
 *  district if a candidate is actually IN the pack.
 *
 *  Instruments every real `defaultPick` call in an actual game (not a
 *  synthetic pack) by subclassing an agent that never overrides `draftPick`
 *  (see scratch-district-threshold-ablation.ts's own note: no shipped agent
 *  does, so `defaultPick` decides every draft regardless of pool) and
 *  wrapping it to log pack composition before calling the engine's own
 *  exported `defaultPick`, unmodified -- so the instrumentation cannot drift
 *  from what actually ran.
 *
 *  THE ANSWER IS BIGGER THAN THE FORCED/CHOSEN SPLIT. Forced picks (no
 *  candidate in the pack) do dominate -- 77-100% of every district pick,
 *  depending on the threshold -- but the total COUNT of district picks in a
 *  game is exactly 1073 at every threshold from 0 to 12 to 100, on both
 *  shipped configs. That is not the forced/chosen split settling toward a
 *  ceiling; it is invariant to the value function entirely, because
 *  `Game.draft`'s inner loop (`while (packs.some((pk) => pk.length))`) keeps
 *  passing packs around the table until every pack is fully empty -- every
 *  dealt card gets taken by SOMEONE within its round, forced or not, wanted
 *  or not (an unwanted pick still gets pushed to `discard`, but it still
 *  counts as a pick). `districtsPerPack` and any heuristic built on it can
 *  only decide WHO gets a given dealt district and whether it lands in a
 *  hand or a discard pile -- never whether it gets drafted at all, since the
 *  draft never leaves a card unclaimed. The number that actually sets map
 *  fill rate is upstream of the draft: how many district cards the era packs
 *  deal into circulation in the first place.
 *
 *  node sim/scratch-pack-composition.ts
 */
import { Game, defaultPick, type Config, type GameView } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { GreedyAgent } from './agents.ts';
import { RNG } from '../engine/rules/rng.ts';

const cards = loadPacks(ALL_PACKS);
const SEEDS = 40;

interface Tally { packs: number; districtsInPack: number; candidatesInPack: number; noCandidateInPack: number; districtPicks: number; forcedDistrictPicks: number; chosenDistrictPicks: number }
const empty = (): Tally => ({ packs: 0, districtsInPack: 0, candidatesInPack: 0, noCandidateInPack: 0, districtPicks: 0, forcedDistrictPicks: 0, chosenDistrictPicks: 0 });

class InstrumentedAgent extends GreedyAgent {
  t: Tally;
  constructor(cfg: Config, rng: RNG, t: Tally) { super('Greedy', cfg, rng); this.t = t; }
  draftPick(v: GameView, pack: Card[]): Card | undefined {
    const nDist = pack.filter((c) => c.kind === 'district').length;
    const nCand = pack.length - nDist;
    this.t.packs++;
    this.t.districtsInPack += nDist;
    this.t.candidatesInPack += nCand;
    if (nCand === 0 && nDist > 0) this.t.noCandidateInPack++;
    const pick = defaultPick(pack, v.players[v.me], this.cfg.draft.districtsPerPack);
    if (pick.kind === 'district') {
      this.t.districtPicks++;
      if (nCand === 0) this.t.forcedDistrictPicks++; else this.t.chosenDistrictPicks++;
    }
    return pick;
  }
}

function run(cfg: Config): Tally {
  const t = empty();
  for (let i = 0; i < SEEDS; i++) {
    const seed = 9_500_000 + i;
    const rng = new RNG(seed);
    const agents = [0, 1, 2, 3].map(() => new InstrumentedAgent(cfg, rng, t));
    new Game(agents, cards, cfg, seed).run();
  }
  return t;
}

const CONFIGS = ['tuned.json', 'as-written-plus.json'];
const GOALS = [0, 2, 3, 4, 5, 6, 8, 12];

for (const name of CONFIGS) {
  const base = loadConfig(name);
  console.log(`\n${name} (shipped districtsPerPack: ${base.draft.districtsPerPack}, packSize: ${base.draft.packSize})`);
  console.log(
    'goal'.padStart(5), 'packs'.padStart(7), 'mean dist/pack'.padStart(15), 'mean cand/pack'.padStart(15),
    'packs w/ 0 cand'.padStart(16), 'dist picks'.padStart(11), 'forced'.padStart(8), 'chosen'.padStart(8),
  );
  for (const goal of GOALS) {
    const cfg: Config = { ...base, draft: { ...base.draft, districtsPerPack: goal } };
    const t = run(cfg);
    console.log(
      String(goal).padStart(5),
      String(t.packs).padStart(7),
      (t.districtsInPack / t.packs).toFixed(2).padStart(15),
      (t.candidatesInPack / t.packs).toFixed(2).padStart(15),
      `${(100 * t.noCandidateInPack / t.packs).toFixed(1)}%`.padStart(16),
      String(t.districtPicks).padStart(11),
      `${(100 * t.forcedDistrictPicks / t.districtPicks).toFixed(1)}%`.padStart(8),
      `${(100 * t.chosenDistrictPicks / t.districtPicks).toFixed(1)}%`.padStart(8),
    );
  }
}
