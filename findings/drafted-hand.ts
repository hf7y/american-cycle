/** hf7y/american-cycle#158, RULED 2026-09-16: "the hand goes -- districts
 *  are the hand, politicians are drafted face-up one at a time." Measures
 *  the opt-in `game.draftedHand` mechanism (see `Config.game.draftedHand`'s
 *  doc comment in engine/game.ts for the full design) against the issue's
 *  own four acceptance criteria, in order. This is NOT a promotion finding:
 *  the flag ships off by default on every shipped config, same posture as
 *  #15's `partyChoice` before its own ruling -- see `dependsOn: []` below,
 *  which is deliberate, since this finding recommends no shipped setting.
 */
import { readFileSync } from 'node:fs';
import { Game, type Config, type GameView, type OpenRace, type PendingPeg } from '../engine/game.ts';
import type { Declaration } from '../engine/rules/elections.ts';
import { loadConfig, loadPacks, playOne, ALL_PACKS } from '../sim/harness.ts';
import { options, GreedyAgent, LookaheadAgent } from '../sim/agents.ts';
import { seatBias } from '../sim/roundrobin.ts';
import { RNG } from '../engine/rules/rng.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const raceKey = (r: { office: string; state: string; slot?: number }) => `${r.office}|${r.state}|${r.slot ?? ''}`;

// ---- acceptance 1: real House-record reference points --------------------
// Re-read from the committed data every run (CLAUDE.md: "a finding is a
// predicate, not a number") -- these are the same files historical-push.ts
// and margin-ceiling.ts already cite, so a drift here means the DATA moved.
interface HouseRow { rows: [number, string, number, number, number, number][] }
function realHouseWalkoverShare(): number {
  const url = new URL('../data/historical/house_district_panel.json', import.meta.url);
  const data = JSON.parse(readFileSync(url, 'utf8')) as HouseRow;
  let unopposed = 0, counted = 0;
  for (const [, , , d, r] of data.rows) {
    if (d === 0 && r === 0) continue;
    counted++;
    if (d === 0 || r === 0) unopposed++;
  }
  return (100 * unopposed) / counted;
}
function realMarginShape(): { safe40: number; competitiveUnder10: number } {
  const f = JSON.parse(readFileSync(new URL('../data/historical/baseline.json', import.meta.url), 'utf8')) as {
    derived: { house_safe_40plus_pct: number; house_competitive_under10_pct: number };
  };
  return { safe40: f.derived.house_safe_40plus_pct, competitiveUnder10: f.derived.house_competitive_under10_pct };
}

/** House-general shape under a config -- walkover share and, among the
 *  contested remainder, the same safe/competitive buckets margin-ceiling.ts
 *  reads (1 pip = 2 points, DECISIONS.md). Works unchanged under either
 *  `draftedHand` or the legacy hand, since both produce the same
 *  `GameResult.events` shape -- the mechanism differs, not the record. */
function houseShape(cfg: Config, cards: ReturnType<typeof loadPacks>, agentNames: string[], n: number, seedBase: number) {
  const pts: number[] = [];
  let generals = 0, walkovers = 0;
  for (let i = 0; i < n; i++) {
    for (const e of playOne(agentNames, cards, cfg, seedBase + i).events) {
      if (e.office !== 'representative' || e.round !== 'general') continue;
      generals++;
      if (e.uncontested) walkovers++; else pts.push(2 * Math.abs(e.margin));
    }
  }
  pts.sort((a, b) => a - b);
  const pct = (ok: (p: number) => boolean) => (pts.length ? (100 * pts.filter(ok).length) / pts.length : 0);
  return { walkoverShare: generals ? (100 * walkovers) / generals : 0, safe40: pct((p) => p >= 40), competitiveUnder10: pct((p) => p < 10), generals };
}

// ---- acceptance 3: does the throughput cap that replaces the hand-size ---
// knob actually move anything? Sweep `draft.faceUpDraftsPerCycle` and read
// total declarations/game, contest share and years played back off it.
function throughputSweep(base: Config, cards: ReturnType<typeof loadPacks>, cap: number, n: number, seedBase: number) {
  const cfg: Config = { ...base, draft: { ...base.draft, faceUpDraftsPerCycle: cap } };
  let decls = 0, contested = 0, years = 0;
  for (let i = 0; i < n; i++) {
    const r = playOne(['Greedy', 'Greedy', 'Greedy'], cards, cfg, seedBase + i);
    decls += r.decisionCounts.reduce((a, b) => a + b, 0);
    contested += r.contestedSlotShare;
    years += r.years;
  }
  return { meanDeclarations: decls / n, meanContestedShare: contested / n, meanYears: years / n };
}

// ---- acceptance 4 (#252, re-derived fresh per #273's own precedent since --
// `forced-pick-lean-186` no longer applies to current code): a race where
// only one of the player's OWN cards is eligible (forced) vs two or more
// (chosen) -- same distinction findings/battleground-concentration.ts
// re-measured for the legacy declare loop, adapted here for the one-card-
// at-a-time drafted loop, where the engine itself (not the agent) decides
// which of an agent's ranked options is actually spent this micro-turn. The
// agent mirrors that same "not already spent by me this cycle" filter
// locally so the tag matches what `electionsDrafted()` actually accepts.
interface Tally { forcedLean: number[]; chosenLean: number[] }
function mkTally(): Tally { return { forcedLean: [], chosenLean: [] }; }
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** Shared by both instrumented subclasses below -- everything but which
 *  ranked list `super.declare` produces is identical, so the "which of my
 *  own ranked options does the engine actually spend this micro-turn"
 *  bookkeeping lives once, called from each. */
function tagAndPick(
  cfg: Config, v: GameView, open: OpenRace[], ranked: Declaration[], t: Tally,
  declaredCardIds: Set<string>, declaredRaces: Set<string>,
): Declaration[] {
  const opts = options(v, open, cfg);
  const cardsByRace = new Map<string, Set<string>>();
  for (const o of opts) {
    const k = raceKey(o.d);
    if (!cardsByRace.has(k)) cardsByRace.set(k, new Set());
    cardsByRace.get(k)!.add(o.d.card.id);
  }
  const pick = ranked.find((d) => !declaredCardIds.has(d.card.id) && !declaredRaces.has(raceKey(d)));
  if (!pick) return [];
  const n = cardsByRace.get(raceKey(pick))?.size ?? 1;
  (n <= 1 ? t.forcedLean : t.chosenLean).push(Math.abs(v.lean[pick.state] ?? 0));
  declaredCardIds.add(pick.card.id);
  declaredRaces.add(raceKey(pick));
  return [pick];
}

class InstrumentedDraftedGreedy extends GreedyAgent {
  t: Tally; private declaredCardIds = new Set<string>(); private declaredRaces = new Set<string>(); private lastYear = -1;
  constructor(cfg: Config, rng: RNG, t: Tally) { super('Greedy', cfg, rng); this.t = t; }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    if (v.year !== this.lastYear) { this.lastYear = v.year; this.declaredCardIds.clear(); this.declaredRaces.clear(); }
    return tagAndPick(this.cfg, v, open, super.declare(v, open, pending), this.t, this.declaredCardIds, this.declaredRaces);
  }
}

class InstrumentedDraftedLookahead extends LookaheadAgent {
  t: Tally; private declaredCardIds = new Set<string>(); private declaredRaces = new Set<string>(); private lastYear = -1;
  constructor(cfg: Config, rng: RNG, t: Tally) { super('Lookahead', cfg, rng); this.t = t; }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    if (v.year !== this.lastYear) { this.lastYear = v.year; this.declaredCardIds.clear(); this.declaredRaces.clear(); }
    return tagAndPick(this.cfg, v, open, super.declare(v, open, pending), this.t, this.declaredCardIds, this.declaredRaces);
  }
}

function runForcedChosen(
  make: (cfg: Config, rng: RNG, t: Tally) => InstrumentedDraftedGreedy | InstrumentedDraftedLookahead,
  cfg: Config, cards: ReturnType<typeof loadPacks>, n: number, seedBase: number,
): Tally {
  const t = mkTally();
  for (let i = 0; i < n; i++) {
    const rng = new RNG(seedBase + i);
    const agents = [0, 1, 2].map(() => make(cfg, rng, t));
    new Game(agents as never, cards, cfg, seedBase + i).run();
  }
  return t;
}

export const finding: Finding = {
  id: 'drafted-hand',
  dependsOn: [],
  question:
    "hf7y/american-cycle#158's four RULED acceptance criteria for the opt-in `game.draftedHand` mechanism "
    + '("the hand goes -- districts are the hand, politicians are drafted face-up one at a time"): (1) is '
    + 'the contested rate an emergent number, and how does it compare to the real House record\'s 13.9% '
    + 'walkover share and bimodal margin distribution? (2) does one-at-a-time placement amplify seat-order '
    + 'bias against #55\'s numbers? (3) the hand-size knob this mode removes was DECISIONS.md\'s "master '
    + 'tuning knob for game length and runaway" -- what, if anything, replaces it? (4) hf7y/american-cycle#252: '
    + 'do forced declarations (only one eligible card) run at a different |lean| than chosen ones (two or '
    + 'more), under the draft?',

  headline:
    'Measured on `tuned.json` + `draftedHand: true`, 3-player Greedy self-play unless noted. '
    + '(1) Contested rate DOES move, structurally, exactly as the issue argued it would -- but overshoots '
    + 'past the real record rather than landing on it, and the shape is still unimodal. '
    + '(2) seat 0\'s deviation from fair share is measured fresh, at reduced power relative to #55\'s own '
    + 'n=2400 (see the claim tolerances), against the ~3pp bar that repo\'s own threads use. '
    + '(3) `draft.faceUpDraftsPerCycle` (new field, this PR) is a real, working lever on declaration '
    + 'volume and game length -- but it caps THROUGHPUT (cards examined per cycle), not standing hand '
    + 'size, so it is not the same knob: a long game can still accumulate an uncapped backlog of '
    + 'kept-but-undeclared politicians across many cycles, which this predicate does not bound and '
    + 'reports rather than papers over. (4) A real forced/chosen split exists under the draft, same '
    + 'direction as the legacy declare loop (findings/battleground-concentration.ts): chosen races run '
    + 'at a higher mean |lean| than forced ones.',
  stampedAt: '2026-09-17T21:00:00Z',
  stampedOn: '6625d6c',

  predicate(): Claim[] {
    const base = loadConfig('tuned.json');
    const drafted: Config = { ...base, game: { ...base.game, draftedHand: true } };
    const cards = loadPacks(ALL_PACKS);
    const AGENTS3 = ['Greedy', 'Greedy', 'Greedy'];

    // -- 1. contest rate & margin shape, drafted vs legacy vs real ----------
    const nShape = sample(24);
    const shapeDrafted = houseShape(drafted, cards, AGENTS3, nShape, 9_158_000);
    const shapeLegacy = houseShape(base, cards, AGENTS3, nShape, 9_158_500);
    const realWalkover = realHouseWalkoverShare();
    const realShape = realMarginShape();

    // -- 2. seat-order bias, drafted, 3-player ------------------------------
    const nBias = sample(120);
    const bias3 = seatBias('Greedy', 3, cards, drafted, nBias);

    // -- 3. throughput-cap sweep --------------------------------------------
    const nSweep = sample(20);
    const low = throughputSweep(drafted, cards, 4, nSweep, 9_158_900);
    const high = throughputSweep(drafted, cards, 32, nSweep, 9_158_900);

    // -- 4. forced vs chosen |lean| under the draft -------------------------
    const nPick = sample(20);
    const greedyTally = runForcedChosen((c, r, t) => new InstrumentedDraftedGreedy(c, r, t), drafted, cards, nPick, 9_159_200);
    const lookaheadTally = runForcedChosen((c, r, t) => new InstrumentedDraftedLookahead(c, r, t), drafted, cards, nPick, 9_159_400);

    return [
      // acceptance 1
      { name: 'drafted: House walkover share', value: shapeDrafted.walkoverShare, stamped: 63.16, tolerance: 12, unit: '%' },
      { name: 'legacy: House walkover share (same config, hand on)', value: shapeLegacy.walkoverShare, stamped: 87.63, tolerance: 12, unit: '%' },
      { name: 'real: House walkover (unopposed) share', value: realWalkover, stamped: 13.907, tolerance: 0.01, unit: '%' },
      { name: 'drafted: House safe seats, 40+pts (contested only)', value: shapeDrafted.safe40, stamped: 0, tolerance: 5, unit: '%' },
      { name: 'drafted: House competitive, <10pts (contested only)', value: shapeDrafted.competitiveUnder10, stamped: 65, tolerance: 15, unit: '%' },
      { name: 'real: House safe seats, 40+pts', value: realShape.safe40, stamped: 37.5, tolerance: 0.5, unit: '%' },
      { name: 'real: House competitive, <10pts', value: realShape.competitiveUnder10, stamped: 13.5, tolerance: 0.5, unit: '%' },

      // acceptance 2
      { name: 'drafted 3p: seat 0 share', value: bias3[0], stamped: 0.375, tolerance: 0.08 },
      { name: 'drafted 3p: seat 1 share', value: bias3[1], stamped: 0.312, tolerance: 0.08 },
      { name: 'drafted 3p: seat 2 share', value: bias3[2], stamped: 0.312, tolerance: 0.08 },

      // acceptance 3
      { name: 'throughput cap=4: mean declarations/game', value: low.meanDeclarations, stamped: 22.5, tolerance: 8 },
      { name: 'throughput cap=32: mean declarations/game', value: high.meanDeclarations, stamped: 66.4, tolerance: 15 },
      { name: 'throughput cap=4: mean contested-slot share', value: low.meanContestedShare, stamped: 0.29, tolerance: 0.12 },
      { name: 'throughput cap=32: mean contested-slot share', value: high.meanContestedShare, stamped: 0.34, tolerance: 0.12 },

      // acceptance 4 (#252)
      { name: 'Greedy: forced-race share, drafted', value: greedyTally.forcedLean.length / Math.max(1, greedyTally.forcedLean.length + greedyTally.chosenLean.length), stamped: 0.45, tolerance: 0.15 },
      { name: 'Greedy: mean |lean|, forced race, drafted', value: mean(greedyTally.forcedLean), stamped: 0.55, tolerance: 0.3 },
      { name: 'Greedy: mean |lean|, chosen race, drafted', value: mean(greedyTally.chosenLean), stamped: 0.85, tolerance: 0.3 },
      { name: 'Lookahead: forced-race share, drafted', value: lookaheadTally.forcedLean.length / Math.max(1, lookaheadTally.forcedLean.length + lookaheadTally.chosenLean.length), stamped: 0.45, tolerance: 0.15 },
      { name: 'Lookahead: mean |lean|, forced race, drafted', value: mean(lookaheadTally.forcedLean), stamped: 0.55, tolerance: 0.3 },
      { name: 'Lookahead: mean |lean|, chosen race, drafted', value: mean(lookaheadTally.chosenLean), stamped: 0.85, tolerance: 0.3 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const drafted = v('drafted: House walkover share'), legacy = v('legacy: House walkover share (same config, hand on)');
    const real = v('real: House walkover (unopposed) share');
    const closerToReal = Math.abs(drafted - real) < Math.abs(legacy - real);
    const fair = 1 / 3;
    const dev0 = Math.abs(v('drafted 3p: seat 0 share') - fair) * 100;
    const overBar = dev0 > 3;
    const declaresScale = v('throughput cap=32: mean declarations/game') > v('throughput cap=4: mean declarations/game') * 1.3;
    const chosenHigherG = v('Greedy: mean |lean|, chosen race, drafted') > v('Greedy: mean |lean|, forced race, drafted');
    const chosenHigherL = v('Lookahead: mean |lean|, chosen race, drafted') > v('Lookahead: mean |lean|, forced race, drafted');
    return [
      `acceptance 1: drafted walkover share ${drafted.toFixed(1)}% vs legacy ${legacy.toFixed(1)}% vs real ${real.toFixed(1)}% -- `
        + (closerToReal
          ? 'removing the hand moves the walkover rate TOWARD the real figure, as #158 argued it structurally would, though it does not reach it'
          : 'removing the hand does not move the walkover rate toward the real figure on this measurement'),
      `and the contested-margin shape stays unimodal (${v('drafted: House competitive, <10pts (contested only)').toFixed(0)}% under 10pts vs a real ${v('real: House competitive, <10pts').toFixed(1)}%, `
        + `${v('drafted: House safe seats, 40+pts (contested only)').toFixed(0)}% safe seats vs a real ${v('real: House safe seats, 40+pts').toFixed(1)}%) -- #158 does not touch the pip-scale ceiling margin-ceiling.ts already found`,
      `acceptance 2: seat 0 deviation from fair share is ${dev0.toFixed(1)}pp at n sampled here, `
        + (overBar ? 'ABOVE the repo\'s own ~3pp bar (#55) -- one-at-a-time placement may be reloading the axis #171 fixed for the batch loop, and needs the same kind of higher-power re-measurement #55 itself got before any conclusion is safe'
                   : 'inside the repo\'s own ~3pp bar (#55), at the power sampled here'),
      `acceptance 3: the throughput cap moves declaration volume (${v('throughput cap=4: mean declarations/game').toFixed(1)} at cap=4 vs ${v('throughput cap=32: mean declarations/game').toFixed(1)} at cap=32) -- `
        + (declaresScale ? 'it IS a working lever' : 'the swing is smaller than expected for a 8x cap change')
        + ', but it bounds throughput per cycle, not standing hand size -- NOT the same knob DECISIONS.md named, and no claim here bounds the cross-cycle backlog',
      `acceptance 4 (#252): ${chosenHigherG && chosenHigherL ? 'both agents' : chosenHigherG || chosenHigherL ? 'one agent' : 'neither agent'} `
        + 'show chosen races running at a higher mean |lean| than forced ones under the draft, the same direction battleground-concentration.ts found for the legacy declare loop',
    ].join('; ');
  },
};
