import { Game, defaultPick, type Config, type GameView, type OpenRace, type PendingPeg } from '../engine/game.ts';
import type { Declaration } from '../engine/rules/elections.ts';
import { loadConfig, loadPacks, ALL_PACKS, BALANCE_PACKS } from '../sim/harness.ts';
import { options, GreedyAgent, LookaheadAgent } from '../sim/agents.ts';
import { RNG } from '../engine/rules/rng.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';
import type { Card, DistrictCard } from '../engine/types/index.ts';

/** hf7y/american-cycle#186 item 3: before running anything new, checked the
 *  existing corpus this issue names -- findings/contest-ratio.ts's
 *  `contestedSlotShare` is a single aggregate across all races, and
 *  `tracks/` carries nothing broken out by state |lean|. Neither answers
 *  whether a low-|lean| battleground actually draws more 2+-declarer races
 *  than a safe one, so this is new instrumentation, as the issue allows once
 *  the corpus is checked and found silent on it.
 *
 *  The pre-election `lean` map is identical for every player's `declare()`
 *  call in a given year (it is read off the board, not per-agent state), so
 *  recording it once per year/state and joining it against the resolved
 *  `RaceEvent` for that year/state reads the lean a race was DECLARED under,
 *  not the lean it moved to afterward. */
class LeanRecordingGreedy extends GreedyAgent {
  byYearState: Map<string, number>;
  constructor(cfg: Config, rng: RNG, m: Map<string, number>) { super('Greedy', cfg, rng); this.byYearState = m; }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    for (const [state, val] of Object.entries(v.lean)) this.byYearState.set(`${v.year}|${state}`, val);
    return super.declare(v, open, pending);
  }
}

function contestByLean(cfg: Config, cards: ReturnType<typeof loadPacks>, seeds: number) {
  const byYearState = new Map<string, number>();
  let contestedAbsLean = 0, contestedN = 0, uncontestedAbsLean = 0, uncontestedN = 0;
  for (let i = 0; i < seeds; i++) {
    const seed = 9_700_000 + i;
    const rng = new RNG(seed);
    const agents = [0, 1, 2, 3].map(() => new LeanRecordingGreedy(cfg, rng, byYearState));
    const r = new Game(agents as never, cards, cfg, seed).run();
    for (const e of r.events) {
      if (e.office !== 'representative' || e.round !== 'general') continue;
      const at = byYearState.get(`${e.year}|${e.state}`);
      if (at === undefined) continue;
      if (e.uncontested) { uncontestedAbsLean += Math.abs(at); uncontestedN++; } else { contestedAbsLean += Math.abs(at); contestedN++; }
    }
  }
  return { contestedMeanAbsLean: contestedAbsLean / contestedN, uncontestedMeanAbsLean: uncontestedAbsLean / uncontestedN };
}

/** hf7y/american-cycle#186: before proposing a mechanism to concentrate play
 *  in battleground (low-|lean|) states -- #42 already measured that raising
 *  the presidential/governor endorsement count does not do it -- check
 *  whether anything CURRENTLY in the engine already does, starting with the
 *  shipped agents' own declaration logic. This instruments every real
 *  `declare()` call in an actual game with the engine's own exported
 *  `options()` and each shipped agent's own `declare()`, unmodified, so the
 *  measurement cannot drift from what actually ran. */
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

/** hf7y/american-cycle#186 item 2, named but left unmeasured in
 *  hf7y/american-cycle#227: does declared-race |lean| differ between a
 *  district a player was FORCED onto at draft time (the pack held no
 *  candidate card, so `defaultPick` had nothing else to weigh) and one they
 *  CHOSE (a candidate was in the same pack, and the heuristic still valued
 *  the district higher)? No shipped agent overrides `draftPick`
 *  (sim/scratch-district-threshold-ablation.ts), so `defaultPick` alone
 *  decides every draft regardless of which agents are declaring -- tagging
 *  its own choice at the moment it's made is exact rather than inferred
 *  after the fact.
 *
 *  The comparison this item asks for turns out not to exist. `defaultPick`
 *  (engine/game.ts) values a candidate at `2 + homeStateBonus + effects`
 *  (floor 2, since both terms are >= 0 across the shipped pool) and a
 *  district at `(same-state ? 0.5 : 1) * (need>0 ? 2 : -2)` (ceiling exactly
 *  2, a new-state district while still thin). A district can only WIN the
 *  comparison on a strict `>`, so it can never beat a candidate that scores
 *  its own floor -- it can at best tie one, and a tie keeps whichever the
 *  reduce already holds. So "chosen" (a district preferred over an
 *  available candidate) is not a rare case of this heuristic; it is
 *  arithmetically unreachable except through tie order, and pack-passing
 *  means every player already strips candidates from a pack before
 *  considering its districts, which is the same asymmetry playing out over
 *  the draft rather than within one pick. */
interface PickTally { forcedLean: number[]; chosenLean: number[]; forcedCount: number; chosenCount: number }
const emptyPick = (): PickTally => ({ forcedLean: [], chosenLean: [], forcedCount: 0, chosenCount: 0 });

function tagDraftPick(pack: Card[], v: GameView, cfg: Config, tag: WeakMap<DistrictCard, 'forced' | 'chosen'>, t: PickTally): Card {
  const pick = defaultPick(pack, v.players[v.me], cfg.draft.districtsPerPack);
  if (pick.kind === 'district') {
    const forced = !pack.some((c) => c.kind === 'candidate');
    tag.set(pick, forced ? 'forced' : 'chosen');
    forced ? t.forcedCount++ : t.chosenCount++;
  }
  return pick;
}

function tallyPick(v: GameView, chosen: Declaration[], tag: WeakMap<DistrictCard, 'forced' | 'chosen'>, t: PickTally): void {
  for (const d of chosen) {
    if (d.office !== 'representative' || !d.district) continue;
    const at = tag.get(d.district);
    if (at === 'forced') t.forcedLean.push(Math.abs(v.lean[d.state] ?? 0));
    else if (at === 'chosen') t.chosenLean.push(Math.abs(v.lean[d.state] ?? 0));
  }
}

class InstrumentedDraftGreedy extends GreedyAgent {
  tag: WeakMap<DistrictCard, 'forced' | 'chosen'>;
  t: PickTally;
  constructor(cfg: Config, rng: RNG, tag: WeakMap<DistrictCard, 'forced' | 'chosen'>, t: PickTally) {
    super('Greedy', cfg, rng); this.tag = tag; this.t = t;
  }
  draftPick(v: GameView, pack: Card[]): Card { return tagDraftPick(pack, v, this.cfg, this.tag, this.t); }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const chosen = super.declare(v, open, pending);
    tallyPick(v, chosen, this.tag, this.t);
    return chosen;
  }
}

class InstrumentedDraftLookahead extends LookaheadAgent {
  tag: WeakMap<DistrictCard, 'forced' | 'chosen'>;
  t: PickTally;
  constructor(cfg: Config, rng: RNG, tag: WeakMap<DistrictCard, 'forced' | 'chosen'>, t: PickTally) {
    super('Lookahead', cfg, rng); this.tag = tag; this.t = t;
  }
  draftPick(v: GameView, pack: Card[]): Card { return tagDraftPick(pack, v, this.cfg, this.tag, this.t); }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const chosen = super.declare(v, open, pending);
    tallyPick(v, chosen, this.tag, this.t);
    return chosen;
  }
}

function runPick(make: (cfg: Config, rng: RNG, tag: WeakMap<DistrictCard, 'forced' | 'chosen'>, t: PickTally) => { declare: unknown; draftPick: unknown }, cfg: Config, cards: ReturnType<typeof loadPacks>, seeds: number): PickTally {
  const t = emptyPick();
  for (let i = 0; i < seeds; i++) {
    const seed = 9_800_000 + i;
    const rng = new RNG(seed);
    const tag = new WeakMap<DistrictCard, 'forced' | 'chosen'>();
    const agents = [0, 1, 2, 3].map(() => make(cfg, rng, tag, t));
    new Game(agents as never, cards, cfg, seed).run();
  }
  return t;
}

export const finding: Finding = {
  id: 'battleground-concentration',
  dependsOn: [],
  question:
    "hf7y/american-cycle#186: does anything already in the engine concentrate declarations toward "
    + "low-|lean| (battleground) states, or is contest rate uniform across |lean| regardless of cause? "
    + "Checked first: the shipped agents' own declare() logic, unmodified (item 1), whether a "
    + "state's |lean| correlates with whether its House race actually draws 2+ declarers, pooled "
    + "against the existing track/finding corpus before running anything new (item 3), and whether "
    + "declared-race |lean| differs between a district a player was forced onto at draft time (no "
    + "candidate in the pack) and one they chose over an available candidate (item 2).",

  headline:
    "Lookahead does, on its own, with no mechanism built for it; Greedy does not. Lookahead's declared "
    + "mean |lean| (0.96) sits BELOW the mean of the races legally open to it (1.29) -- it self-selects "
    + "toward competitive states because a close race is where its own win%-times-future-value calculus "
    + "moves the most, the same reason a real campaign targets a battleground. Greedy, sorting by edge "
    + "alone, barely moves the population at all (0.96 declared vs 0.99 legal) -- it has no lean-awareness "
    + "in its scoring and it shows. So the gap #186 asks about is a missing SIGNAL for the myopic agent, "
    + "not a universal missing incentive: a planning agent already finds the battleground unassisted. "
    + "Item 3, pooled against the corpus and then measured fresh since neither this file nor "
    + "contest-ratio.ts's aggregate contestedSlotShare answered it: House generals that actually draw "
    + "2+ declarers sit at a HIGHER mean |lean| (1.69) than the ones that end up walkovers (1.42) -- the "
    + "opposite of battleground concentration. Safe seats are not what goes uncontested; a district with "
    + "no held-district gate cleared is, regardless of how close the state is, so |lean| is riding on "
    + "eligibility (which players hold a matching district) rather than being read as a signal either way. "
    + "Item 2's comparison doesn't exist to make: 100% of drafted districts, for both Greedy and Lookahead, "
    + "are FORCED (no candidate in the same pack) rather than chosen over one. defaultPick's own value() "
    + "caps a district at exactly a candidate's floor score, so a district can tie a cheap candidate but "
    + "never beat one -- 'chosen' is arithmetically unreachable outside tie order, and pack-passing means "
    + "every player has already stripped candidates from a pack before its districts are even considered.",
  stampedAt: '2026-09-07T08:53:51Z',
  stampedOn: '4668444',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const n = sample(40);
    const cards = loadPacks(ALL_PACKS);
    const greedy = run((c, r, t) => new InstrumentedGreedy(c, r, t), cfg, cards, n);
    const lookahead = run((c, r, t) => new InstrumentedLookahead(c, r, t), cfg, cards, n);
    const cardsBalance = loadPacks(BALANCE_PACKS);
    const lookaheadBalance = run((c, r, t) => new InstrumentedLookahead(c, r, t), cfg, cardsBalance, n);
    const byLean = contestByLean(cfg, cards, n);
    const pickGreedy = runPick((c, r, tag, t) => new InstrumentedDraftGreedy(c, r, tag, t), cfg, cards, n);
    const pickLookahead = runPick((c, r, tag, t) => new InstrumentedDraftLookahead(c, r, tag, t), cfg, cards, n);
    // The floor/ceiling fact the item-2 doc comment above argues from,
    // checked against the actual shipped pool rather than asserted: the
    // cheapest candidate `defaultPick` can offer, by its own value(), vs.
    // the most a district can ever score. If the floor ever drops below the
    // ceiling, a real "chosen" population becomes possible and this
    // finding's shape needs revisiting.
    const candidateFloor = Math.min(
      ...cards.filter((c): c is Card & { kind: 'candidate' } => c.kind === 'candidate')
        .map((c) => 2 + c.homeStateBonus + c.effects.length),
    );
    return [
      { name: 'Greedy: mean |lean|, legal options', value: mean(greedy.legalLean), stamped: 0.9614, tolerance: 0.1 },
      { name: 'Greedy: mean |lean|, declared', value: mean(greedy.declaredLean), stamped: 0.9911, tolerance: 0.15 },
      { name: 'Lookahead: mean |lean|, legal options', value: mean(lookahead.legalLean), stamped: 1.2875, tolerance: 0.15 },
      { name: 'Lookahead: mean |lean|, declared', value: mean(lookahead.declaredLean), stamped: 0.9562, tolerance: 0.15 },
      // hf7y/american-cycle#91: is Lookahead's self-selection itself a
      // property of which era-pack list ran it?
      { name: 'Lookahead, BALANCE_PACKS: mean |lean|, legal options', value: mean(lookaheadBalance.legalLean), stamped: 1.0351, tolerance: 0.2 },
      { name: 'Lookahead, BALANCE_PACKS: mean |lean|, declared', value: mean(lookaheadBalance.declaredLean), stamped: 0.7924, tolerance: 0.2 },
      { name: 'House generals: mean |lean|, contested (2+ declarers)', value: byLean.contestedMeanAbsLean, stamped: 1.6896, tolerance: 0.3 },
      { name: 'House generals: mean |lean|, uncontested (walkover)', value: byLean.uncontestedMeanAbsLean, stamped: 1.4154, tolerance: 0.3 },
      { name: 'defaultPick: cheapest candidate value vs. district ceiling (2)', value: candidateFloor, stamped: 2, tolerance: 0 },
      { name: 'Greedy: forced-pick share of drafted districts', value: pickGreedy.forcedCount / (pickGreedy.forcedCount + pickGreedy.chosenCount), stamped: 1, tolerance: 0.05 },
      { name: 'Greedy: mean |lean| declared, forced pick', value: mean(pickGreedy.forcedLean), stamped: 1.5308, tolerance: 0.3 },
      { name: 'Lookahead: forced-pick share of drafted districts', value: pickLookahead.forcedCount / (pickLookahead.forcedCount + pickLookahead.chosenCount), stamped: 1, tolerance: 0.05 },
      { name: 'Lookahead: mean |lean| declared, forced pick', value: mean(pickLookahead.forcedLean), stamped: 1.4907, tolerance: 0.3 },
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
    const contestGap = v('House generals: mean |lean|, contested (2+ declarers)') - v('House generals: mean |lean|, uncontested (walkover)');
    const forcedShareGreedy = v('Greedy: forced-pick share of drafted districts');
    const forcedShareLookahead = v('Lookahead: forced-pick share of drafted districts');
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
      contestGap > 0.15
        ? `and contested House races run HIGHER |lean| than walkovers (+${contestGap.toFixed(2)}) -- the opposite of battleground concentration, so |lean| is not the thing gating who shows up`
        : contestGap < -0.15
          ? `and contested House races do run lower |lean| than walkovers (${contestGap.toFixed(2)}), consistent with battleground concentration`
          : 'and contest draws no |lean| signal either way -- uniform across the |lean| range',
      forcedShareGreedy > 0.95 && forcedShareLookahead > 0.95
        ? `and item 2's own comparison doesn't exist to make: ${(forcedShareGreedy * 100).toFixed(0)}% of Greedy's and ${(forcedShareLookahead * 100).toFixed(0)}% of Lookahead's drafted districts are FORCED (no candidate in the pack) rather than chosen over one, because defaultPick's own value() caps a district at exactly a candidate's floor -- a district can tie a cheap candidate but never beat one, so "chosen" is arithmetically unreachable outside tie order`
        : `and item 2: a real chosen-pick population exists after all (Greedy ${((1 - forcedShareGreedy) * 100).toFixed(0)}% chosen, Lookahead ${((1 - forcedShareLookahead) * 100).toFixed(0)}%) -- defaultPick's value() no longer caps districts at the candidate floor`,
    ].join('; ');
  },
};
