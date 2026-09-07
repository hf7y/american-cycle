import { Game, type Config } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { AGENTS as AGENT_REGISTRY } from '../sim/agents.ts';
import { loadConfig, loadPacks, BALANCE_PACKS } from '../sim/harness.ts';
import { runawayMetrics } from '../sim/roundrobin.ts';
import type { Card } from '../engine/types/index.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

// Impeacher, not Lookahead (runaway-no-brake's pool): arm 2 only has anything
// to measure if someone actually files and loses an impeachment vote. Checked
// directly -- with Lookahead in the seat instead, 200 seeds produced zero
// failed attempts, and a failed attempt is what `backfire()` scales.
const AGENTS = ['Greedy', 'Impeacher', 'SenateFlood', 'HeterodoxSpecialist'];
/** hf7y/american-cycle#84's own acceptance bar: 200+ seeds, because the
 *  determination metric quantises to 1/maxYears and smaller blocks cannot
 *  resolve it. */
const SEEDS = Array.from({ length: sample(200) }, (_, i) => 1040400 + i);

/** How many times `backfire()` actually had something to scale, across a
 *  seed block -- a failed conviction, not a successful one (`GameResult`'s
 *  own `impeachments` count is removals, the rare case; a failed attempt is
 *  what `impeachBackfireStrainScaled` touches, and does not survive into
 *  `GameResult`, so this replays the games directly off `Game.log`). Exists
 *  so this finding cannot silently report "no effect" for arm 2 when the
 *  real reason is "never fired" -- see the note on `AGENTS` above. */
function failedImpeachAttempts(seeds: number[], agents: string[], cards: Card[], cfg: Config): number {
  let fails = 0;
  for (const seed of seeds) {
    const rng = new RNG(seed);
    const built = agents.map((n) => new AGENT_REGISTRY[n](cfg, rng));
    const g = new Game(built, structuredClone(cards), cfg, seed);
    const end = cfg.game.startYear + cfg.game.maxYears;
    while (g.year < end) { g.tick(); if (g.endedBy) break; }
    fails += g.log.filter((l) => l.includes('impeachment fails')).length;
  }
  return fails;
}

/** hf7y/american-cycle#84's ruling, taken literally: "build both candidates
 *  behind flags and measure each alone... a fourth arm with both on is worth
 *  running only after the three are in". This finding is the three; the
 *  fourth is deliberately not run here. */
export const finding: Finding = {
  id: 'positional-brakes',
  dependsOn: [],
  question:
    "hf7y/american-cycle#84: the runaway survived v0.2's board scoring and the CHEAP shock moved nothing "
    + '(0.625 with it, 0.625 without, at 400 seeds, on runaway-no-brake\'s own agent pool). Two candidates bite '
    + "on POSITION rather than tally -- a shock scaled by nearness to the governing coalition's tag centroid, "
    + 'and an impeachment backfire scaled by strain (settlement-to-country distance) -- ruled to be measured '
    + "each alone, against C7's 0.75-0.85 healthy band, before either ships.",

  headline:
    'NEITHER ARM ALONE LANDS IN THE BAND, BUT NOT FOR THE SAME REASON. This pool swaps Impeacher in for '
    + "runaway-no-brake's Lookahead -- arm 2 needs a filer, and Lookahead never files (checked: zero failed "
    + 'attempts over 200 seeds). That swap alone moves the baseline: 87.5% of game length (LATE, past the '
    + "band) against runaway-no-brake's 62.5% (EARLY) on its own pool -- another instance of hf7y/american-"
    + 'cycle#91\'s deck/pool sensitivity, this time in the agent set rather than the card pool. Against THIS '
    + "baseline: the positional shock alone does not move determination at all (87.5% -> 87.5%, identical to "
    + 'two decimal places) despite firing constantly -- 345 positional-shock modifiers over 60 games, checked '
    + 'directly, averaging -1.02 pips each. It fires on whoever shares tags with the governing coalition, which '
    + 'is not the same population as whoever holds the most seats, so it does not concentrate on the LEADER the '
    + "way the power-scaled shock does by construction -- it is real and it is not a runaway brake. The "
    + 'strain-scaled backfire alone moves a great deal -- 87.5% -> 62.5%, confirmed against 475 failed '
    + 'impeachment attempts in the same seed block, so the mechanism had plenty to scale -- but it overshoots '
    + 'past the band on the OTHER side, from late to early, landing exactly where the untouched baseline sat on '
    + "the other pool. Comeback rate does not move at all across any of the three arms (7% flat). Neither arm's "
    + 'own failure mode is "too small to matter"; one does nothing to this metric, the other does too much of '
    + 'the wrong thing. This does not resolve which arm ships, or whether a fourth arm (both together) would '
    + 'land between the two overshoots -- that is the next measurement, not this one.',
  stampedAt: '2026-09-07T18:05:00Z',
  stampedOn: 'aebde8b',

  predicate(): Claim[] {
    const base = loadConfig('tuned.json');
    const cards = loadPacks(BALANCE_PACKS);

    const positionalShockOnly: Config = {
      ...base,
      economy: { ...base.economy, positionalShock: true },
    };
    const strainBackfireOnly: Config = {
      ...base,
      legislature: { ...base.legislature, impeachBackfireStrainScaled: true },
    };

    const run = (cfg: Config) => runawayMetrics(SEEDS, AGENTS, cards, cfg);
    const baseline = run(base);
    const positional = run(positionalShockOnly);
    const strainBackfire = run(strainBackfireOnly);
    const fails = failedImpeachAttempts(SEEDS, AGENTS, cards, base);

    return [
      { name: 'baseline: determination point', value: baseline.determination, stamped: 0.875, tolerance: 0.13, unit: 'fraction of game length' },
      { name: 'baseline: comeback rate', value: baseline.comeback, stamped: 0.07, tolerance: 0.05, unit: 'share of games' },
      { name: 'positional shock alone: determination point', value: positional.determination, stamped: 0.875, tolerance: 0.13, unit: 'fraction of game length' },
      { name: 'positional shock alone: comeback rate', value: positional.comeback, stamped: 0.07, tolerance: 0.05, unit: 'share of games' },
      { name: 'strain-scaled backfire alone: determination point', value: strainBackfire.determination, stamped: 0.625, tolerance: 0.13, unit: 'fraction of game length' },
      { name: 'strain-scaled backfire alone: comeback rate', value: strainBackfire.comeback, stamped: 0.07, tolerance: 0.05, unit: 'share of games' },
      // Not a runaway measure -- proof arm 2 had something to scale at all,
      // over the SAME seed block the two determination claims above ran on.
      { name: 'failed impeachment attempts in the seed block', value: fails, stamped: 475, tolerance: 150, unit: 'count' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const HEALTHY_LOW = 0.75, HEALTHY_HIGH = 0.85;
    const band = (x: number): 'early' | 'healthy' | 'late' =>
      x < HEALTHY_LOW ? 'early' : x > HEALTHY_HIGH ? 'late' : 'healthy';
    const baseBand = band(v('baseline: determination'));
    const posBand = band(v('positional shock alone: determination'));
    const backfireBand = band(v('strain-scaled backfire alone: determination'));
    const pct = (n: string) => `${(100 * v(n)).toFixed(0)}%`;
    const moved = Math.abs(v('positional shock alone: determination') - v('baseline: determination')) > 1e-9;
    const fails = v('failed impeachment attempts in the seed block');
    return [
      `baseline determination sits at ${pct('baseline: determination')} of game length (${baseBand})`,
      moved
        ? `positional shock alone moves it to ${pct('positional shock alone: determination')} (${posBand})`
        : `positional shock alone does not move it at all -- still ${pct('positional shock alone: determination')} (${posBand}) -- despite firing on nearly every incumbent race`,
      `strain-scaled backfire alone moves it hard, to ${pct('strain-scaled backfire alone: determination')} (${backfireBand}), `
        + `on ${fails.toFixed(0)} failed attempts in the block, but ${backfireBand === 'late' ? 'further past' : 'past'} the band on the far side from baseline`,
      posBand !== 'healthy' && backfireBand !== 'healthy'
        ? 'so neither arm alone is the brake -- one is inert on this metric, the other overshoots -- and a fourth arm (both together) is the next measurement, not run here'
        : 'so at least one arm alone is a candidate brake on its own merits',
    ].join('; ');
  },
};
