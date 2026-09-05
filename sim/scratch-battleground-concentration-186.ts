/** Scratch: hf7y/american-cycle#186 -- before proposing a mechanism to
 *  concentrate play in battleground states, check whether the shipped
 *  declaration logic is lean-aware at all.
 *
 *  `GreedyAgent.declare` (sim/agents.ts) sorts every legal `Option` by
 *  `edge` DESCENDING and takes the top ones its budget allows. `edge` is the
 *  modifier stack total, which includes the 'state lean' term when it
 *  favours the declaring card's party (engine/rules/elections.ts's
 *  `buildModifiers`). The hypothesis going in: Greedy prefers the race where
 *  IT is most favoured, which correlates with high |lean| (a safe seat for
 *  its own side), not low |lean| (an actual battleground). This instruments
 *  every real `declare()` call in an actual game to check that, using the
 *  engine's own exported `options()` and each shipped agent's own
 *  `declare()`, unmodified -- so the instrumentation cannot drift from what
 *  actually ran.
 *
 *  node sim/scratch-battleground-concentration-186.ts
 */
import { Game, type Config, type GameView, type OpenRace, type PendingPeg } from '../engine/game.ts';
import type { Declaration } from '../engine/rules/elections.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { options, GreedyAgent, LookaheadAgent } from './agents.ts';
import { RNG } from '../engine/rules/rng.ts';

const cards = loadPacks(ALL_PACKS);
const SEEDS = 40;

interface Tally { legalLean: number[]; declaredLean: number[] }
const empty = (): Tally => ({ legalLean: [], declaredLean: [] });

class InstrumentedGreedy extends GreedyAgent {
  t: Tally;
  constructor(cfg: Config, rng: RNG, t: Tally) { super('Greedy', cfg, rng); this.t = t; }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    for (const o of options(v, open, this.cfg)) this.t.legalLean.push(Math.abs(v.lean[o.d.state] ?? 0));
    const chosen = super.declare(v, open, pending);
    for (const d of chosen) this.t.declaredLean.push(Math.abs(v.lean[d.state] ?? 0));
    return chosen;
  }
}

class InstrumentedLookahead extends LookaheadAgent {
  t: Tally;
  constructor(cfg: Config, rng: RNG, t: Tally) { super('Lookahead', cfg, rng); this.t = t; }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    for (const o of options(v, open, this.cfg)) this.t.legalLean.push(Math.abs(v.lean[o.d.state] ?? 0));
    const chosen = super.declare(v, open, pending);
    for (const d of chosen) this.t.declaredLean.push(Math.abs(v.lean[d.state] ?? 0));
    return chosen;
  }
}

function run(make: (cfg: Config, rng: RNG, t: Tally) => { declare: unknown }, cfg: Config): Tally {
  const t = empty();
  for (let i = 0; i < SEEDS; i++) {
    const seed = 9_600_000 + i;
    const rng = new RNG(seed);
    const agents = [0, 1, 2, 3].map(() => make(cfg, rng, t));
    new Game(agents as never, cards, cfg, seed).run();
  }
  return t;
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const bucket = (a: number[], lo: number, hi: number) => a.filter((x) => x >= lo && x < hi).length / a.length;

const cfg = loadConfig('tuned.json');
for (const [label, make] of [
  ['Greedy (highest edge first)', (c: Config, r: RNG, t: Tally) => new InstrumentedGreedy(c, r, t)],
  ['Lookahead (win% x future value)', (c: Config, r: RNG, t: Tally) => new InstrumentedLookahead(c, r, t)],
] as const) {
  const t = run(make, cfg);
  console.log(`\n${label} -- n legal=${t.legalLean.length} declared=${t.declaredLean.length}`);
  console.log(`  mean |lean|: legal options ${mean(t.legalLean).toFixed(2)}  declared ${mean(t.declaredLean).toFixed(2)}`);
  for (const [lo, hi] of [[0, 1], [1, 3], [3, 6], [6, 100]] as const) {
    console.log(`  |lean| ${lo}-${hi === 100 ? '+' : hi}: legal ${(100 * bucket(t.legalLean, lo, hi)).toFixed(1)}%`
      + `  declared ${(100 * bucket(t.declaredLean, lo, hi)).toFixed(1)}%`);
  }
}
