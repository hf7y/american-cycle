/** #158 acceptance item 4 (added via #252): forced vs chosen declarations and
 *  their |lean|, re-measured under the one-at-a-time declare round on
 *  turn-loop-redesign-158. Same classification #252 used on the old batch
 *  draft (branch forced-pick-lean-186, PR #229, InstrumentedGreedy/
 *  InstrumentedLookahead): a declared race is FORCED when the declaring
 *  player's hand holds exactly one eligible candidate card for it (deduped by
 *  card id, party variants don't add a second candidate), CHOSEN when it
 *  holds two or more. Wraps GreedyAgent/LookaheadAgent rather than
 *  reimplementing declare(): classifies whichever entry declareRounds will
 *  actually pick (first card/race this player hasn't already used this
 *  cycle), mirroring engine/game.ts's own uc/ur bookkeeping exactly since
 *  that bookkeeping is deterministic and per-player.
 *
 *  node sim/scratch-forced-chosen-lean-158.ts
 */
import { loadConfig, loadPacks, ALL_PACKS, arg } from './harness.ts';
import { GreedyAgent, LookaheadAgent } from './agents.ts';
import { eligible } from '../engine/rules/elections.ts';
import { Game, type GameView, type OpenRace, type PendingPeg, type Config } from '../engine/game.ts';
import type { Declaration } from '../engine/rules/elections.ts';
import type { CandidateCard } from '../engine/types/index.ts';
import { RNG } from '../engine/rules/rng.ts';

const tally = { forced: 0, chosen: 0, forcedLean: 0, chosenLean: 0 };

function classifyPick(v: GameView, open: OpenRace[], mine: Declaration[], uc: Set<string>, ur: Set<string>): void {
  const me = v.players[v.me];
  for (const d of mine) {
    const rk = `${d.office}|${d.state}|${d.slot ?? ''}`;
    if (uc.has(d.card.id) || ur.has(rk)) continue;
    const r = open.find((o) => o.office === d.office && o.state === d.state && (o.slot ?? '') === (d.slot ?? ''));
    if (r) {
      const cands = me.hand.filter((c) => c.kind === 'candidate') as (CandidateCard & { kind: 'candidate' })[];
      const houseSlot = r.office === 'representative' ? r.slot : undefined;
      const n = r.office === 'president'
        ? cands.length
        : cands.filter((c) => eligible(c, r.state, me.districts, houseSlot)).length;
      const lean = Math.abs(v.lean[r.state] ?? 0);
      if (n <= 1) { tally.forced++; tally.forcedLean += lean; } else { tally.chosen++; tally.chosenLean += lean; }
    }
    uc.add(d.card.id); ur.add(rk);
    break;
  }
}

class InstrumentedGreedy extends GreedyAgent {
  private uc = new Set<string>(); private ur = new Set<string>(); private lastYear = -1;
  constructor(cfg: Config, rng: RNG) { super('Greedy', cfg, rng); }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    if (v.year !== this.lastYear) { this.lastYear = v.year; this.uc.clear(); this.ur.clear(); }
    const mine = super.declare(v, open, pending);
    classifyPick(v, open, mine, this.uc, this.ur);
    return mine;
  }
}

class InstrumentedLookahead extends LookaheadAgent {
  private uc = new Set<string>(); private ur = new Set<string>(); private lastYear = -1;
  constructor(cfg: Config, rng: RNG) { super('Lookahead', cfg, rng); }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    if (v.year !== this.lastYear) { this.lastYear = v.year; this.uc.clear(); this.ur.clear(); }
    const mine = super.declare(v, open, pending);
    classifyPick(v, open, mine, this.uc, this.ur);
    return mine;
  }
}

const n = Number(arg('--seeds', '40'));
const cfg = loadConfig('tuned.json');
const cards = loadPacks(ALL_PACKS);

console.time('probe');
for (let i = 0; i < n; i++) {
  const rng = new RNG(6000 + i);
  const agents = [new InstrumentedGreedy(cfg, rng), new InstrumentedLookahead(cfg, rng), new InstrumentedGreedy(cfg, rng), new InstrumentedLookahead(cfg, rng)];
  const g = new Game(agents, cards, cfg, 6000 + i);
  g.run();
}
console.timeEnd('probe');

const total = tally.forced + tally.chosen;
console.log(JSON.stringify({
  seeds: n,
  forced: tally.forced,
  chosen: tally.chosen,
  forcedShare: total ? tally.forced / total : 0,
  meanForcedLean: tally.forced ? tally.forcedLean / tally.forced : 0,
  meanChosenLean: tally.chosen ? tally.chosenLean / tally.chosen : 0,
}, null, 2));
