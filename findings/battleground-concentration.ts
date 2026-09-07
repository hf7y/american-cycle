import { Game, type Config, type GameView, type OpenRace, type PendingPeg } from '../engine/game.ts';
import type { Declaration } from '../engine/rules/elections.ts';
import { loadConfig, loadPacks, ALL_PACKS, BALANCE_PACKS } from '../sim/harness.ts';
import { options, GreedyAgent, LookaheadAgent } from '../sim/agents.ts';
import { RNG } from '../engine/rules/rng.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#186: before proposing a mechanism to concentrate play
 *  in battleground (low-|lean|) states -- #42 already measured that raising
 *  the presidential/governor endorsement count does not do it -- check
 *  whether anything CURRENTLY in the engine already does, starting with the
 *  shipped agents' own declaration logic. This instruments every real
 *  `declare()` call in an actual game with the engine's own exported
 *  `options()` and each shipped agent's own `declare()`, unmodified, so the
 *  measurement cannot drift from what actually ran.
 *
 *  Item 2 (this file's second measurement): #132 found that a want-slot can
 *  be filled from a pack containing only one eligible card, forcing a
 *  "choice" that was never really available. A declared race is FORCED the
 *  same way -- `options()` names exactly one distinct candidate card
 *  eligible for that race -- or CHOSEN, when more than one card could have
 *  run there and the agent's own scoring picked among them. Party variants
 *  of the same card (`partyVariants`) are not distinct choices, so cards are
 *  deduped by id before counting. */
interface Tally { legalLean: number[]; declaredLean: number[]; forcedLean: number[]; chosenLean: number[] }
const empty = (): Tally => ({ legalLean: [], declaredLean: [], forcedLean: [], chosenLean: [] });

const raceKey = (o: { office: string; state: string; slot?: number }) => `${o.office}|${o.state}|${o.slot ?? ''}`;

function instrument(v: GameView, open: OpenRace[], cfg: Config, chosen: Declaration[], t: Tally): void {
  const opts = options(v, open, cfg);
  const cardsByRace = new Map<string, Set<string>>();
  for (const o of opts) {
    t.legalLean.push(Math.abs(v.lean[o.d.state] ?? 0));
    const k = raceKey(o.d);
    (cardsByRace.get(k) ?? cardsByRace.set(k, new Set()).get(k)!).add(o.d.card.id);
  }
  for (const d of chosen) {
    const lean = Math.abs(v.lean[d.state] ?? 0);
    t.declaredLean.push(lean);
    const distinctCards = cardsByRace.get(raceKey(d))?.size ?? 1;
    (distinctCards <= 1 ? t.forcedLean : t.chosenLean).push(lean);
  }
}

class InstrumentedGreedy extends GreedyAgent {
  t: Tally;
  constructor(cfg: Config, rng: RNG, t: Tally) { super('Greedy', cfg, rng); this.t = t; }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const chosen = super.declare(v, open, pending);
    instrument(v, open, this.cfg, chosen, this.t);
    return chosen;
  }
}

class InstrumentedLookahead extends LookaheadAgent {
  t: Tally;
  constructor(cfg: Config, rng: RNG, t: Tally) { super('Lookahead', cfg, rng); this.t = t; }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const chosen = super.declare(v, open, pending);
    instrument(v, open, this.cfg, chosen, this.t);
    return chosen;
  }
}

function run(make: (cfg: Config, rng: RNG, t: Tally) => { declare: unknown }, cfg: Config, cards: ReturnType<typeof loadPacks>, seeds: number): Tally {
  const t = empty();
  for (let i = 0; i < seeds; i++) {
    const seed = 9_600_000 + i;
    const rng = new RNG(seed);
    const agents = [0, 1, 2, 3].map(() => make(cfg, rng, t));
    new Game(agents as never, cards, cfg, seed).run();
  }
  return t;
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

export const finding: Finding = {
  id: 'battleground-concentration',
  dependsOn: [],
  question:
    "hf7y/american-cycle#186: does anything already in the engine concentrate declarations toward "
    + "low-|lean| (battleground) states, or is contest rate uniform across |lean| regardless of cause? "
    + "Checked first: the shipped agents' own declare() logic, unmodified (item 1). Item 2: per #132, "
    + "does a FORCED declaration (only one eligible card for that race) run at a different |lean| than "
    + "a CHOSEN one (the agent picked among two or more)?",

  headline:
    "Lookahead does, on its own, with no mechanism built for it; Greedy does not. Lookahead's declared "
    + "mean |lean| (0.96) sits BELOW the mean of the races legally open to it (1.29) -- it self-selects "
    + "toward competitive states because a close race is where its own win%-times-future-value calculus "
    + "moves the most, the same reason a real campaign targets a battleground. Greedy, sorting by edge "
    + "alone, barely moves the population at all (0.96 declared vs 0.99 legal) -- it has no lean-awareness "
    + "in its scoring and it shows. So the gap #186 asks about is a missing SIGNAL for the myopic agent, "
    + "not a universal missing incentive: a planning agent already finds the battleground unassisted. "
    + "Item 2 (#132) finds a second, unplanned source of the same effect: 32% of declared races are "
    + "FORCED (exactly one eligible card), and those forced picks run at far lower mean |lean| (0.60) "
    + "than the chosen two-thirds (1.68) -- card eligibility alone already pushes a third of all "
    + "declarations toward competitive states, before either agent's scoring runs at all.",
  stampedAt: '2026-09-05T19:00:00Z',
  stampedOn: 'd736a77',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const n = sample(40);
    const cards = loadPacks(ALL_PACKS);
    const greedy = run((c, r, t) => new InstrumentedGreedy(c, r, t), cfg, cards, n);
    const lookahead = run((c, r, t) => new InstrumentedLookahead(c, r, t), cfg, cards, n);
    const cardsBalance = loadPacks(BALANCE_PACKS);
    const lookaheadBalance = run((c, r, t) => new InstrumentedLookahead(c, r, t), cfg, cardsBalance, n);
    const forced = [...greedy.forcedLean, ...lookahead.forcedLean];
    const chosen = [...greedy.chosenLean, ...lookahead.chosenLean];
    return [
      { name: 'Greedy: mean |lean|, legal options', value: mean(greedy.legalLean), stamped: 0.9614, tolerance: 0.1 },
      { name: 'Greedy: mean |lean|, declared', value: mean(greedy.declaredLean), stamped: 0.9911, tolerance: 0.15 },
      { name: 'Lookahead: mean |lean|, legal options', value: mean(lookahead.legalLean), stamped: 1.2875, tolerance: 0.15 },
      { name: 'Lookahead: mean |lean|, declared', value: mean(lookahead.declaredLean), stamped: 0.9562, tolerance: 0.15 },
      // hf7y/american-cycle#91: is Lookahead's self-selection itself a
      // property of which era-pack list ran it?
      { name: 'Lookahead, BALANCE_PACKS: mean |lean|, legal options', value: mean(lookaheadBalance.legalLean), stamped: 1.0351, tolerance: 0.2 },
      { name: 'Lookahead, BALANCE_PACKS: mean |lean|, declared', value: mean(lookaheadBalance.declaredLean), stamped: 0.7924, tolerance: 0.2 },
      // Item 2 (#132): forced vs chosen, pooled across both shipped agents.
      { name: 'forced picks: mean |lean|', value: mean(forced), stamped: 0.6, tolerance: 0.15 },
      { name: 'chosen picks: mean |lean|', value: mean(chosen), stamped: 1.68, tolerance: 0.15 },
      { name: 'share of declared races that are forced', value: forced.length / (forced.length + chosen.length), stamped: 0.32, tolerance: 0.05 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const greedyGap = v('Greedy: mean |lean|, declared') - v('Greedy: mean |lean|, legal options');
    const lookGap = v('Lookahead: mean |lean|, declared') - v('Lookahead: mean |lean|, legal options');
    const lookGapBalance = v('Lookahead, BALANCE_PACKS: mean |lean|, declared') - v('Lookahead, BALANCE_PACKS: mean |lean|, legal options');
    const deck = deckSensitivity([
      { pool: 'all-seven', value: lookGap },
      { pool: 'four-pack', value: lookGapBalance },
    ]);
    return [
      Math.abs(greedyGap) < 0.15
        ? `Greedy is close to lean-blind (declared - legal = ${greedyGap.toFixed(2)})`
        : `Greedy shows a real |lean| tilt (declared - legal = ${greedyGap.toFixed(2)})`,
      lookGap < -0.15
        ? `Lookahead self-selects toward LOW |lean| unassisted (declared - legal = ${lookGap.toFixed(2)})`
        : 'Lookahead shows no strong self-selection either way',
      deck.sensitive
        ? `and the size of that self-selection is itself deck-sensitive (hf7y/american-cycle#91): ${lookGap.toFixed(2)} all-seven vs ${lookGapBalance.toFixed(2)} four-pack`
        : `and the direction holds on both decks (hf7y/american-cycle#91): ${lookGap.toFixed(2)} all-seven, ${lookGapBalance.toFixed(2)} four-pack`,
      'so the open question for #186 narrows to whether a myopic (Greedy-shaped) agent or player needs a lean signal added to its scoring, not whether the engine needs a new incentive mechanism',
      `separately, per hf7y/american-cycle#132: ${(v('share of declared races that are forced') * 100).toFixed(0)}% of declared races are FORCED (only one eligible card), and those run at much lower |lean| (${v('forced picks: mean |lean|').toFixed(2)}) than the chosen majority (${v('chosen picks: mean |lean|').toFixed(2)}) -- eligibility, not either agent's incentive, is already doing a third of the work #186 asks whether anything does`,
    ].join('; ');
  },
};
