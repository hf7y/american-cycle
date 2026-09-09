import { loadConfig, loadPacks, BALANCE_PACKS } from '../sim/harness.ts';
import { runawayMetrics } from '../sim/roundrobin.ts';
import type { Config } from '../engine/game.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** #84's own ruling: "a fourth arm with both on is worth running only after
 *  the three are in, and only to check they are not redundant." #237
 *  (positional shock) and #242 (strain-scaled backfire) are both in now --
 *  neither alone reached the healthy band, both saturate at one of the same
 *  two attractor values (0.625/0.875) #237 first named. This is that fourth
 *  arm.
 *
 *  Same `Impeacher`-seated pool as #242, not the canonical C7 pool #237 used
 *  alone: backfire never fires under the canonical pool at all, so pairing it
 *  with a pool that can't trigger it would silently test the positional arm
 *  alone a second time. Every point below is therefore re-measured against
 *  this pool's own baseline and positional-alone reading, not #237's file --
 *  the two files' determination numbers are not comparable across pools (see
 *  `impeachment-backfire-strain.ts`'s own note on this). */
const AGENTS = ['Greedy', 'Lookahead', 'Impeacher', 'HeterodoxSpecialist'];
const SEEDS = Array.from({ length: sample(200) }, (_, i) => 1030400 + i);
const HEALTHY_LOW = 0.75, HEALTHY_HIGH = 0.85;
const inBand = (x: number) => x >= HEALTHY_LOW && x <= HEALTHY_HIGH;

export const finding: Finding = {
  id: 'runaway-both-brakes',
  dependsOn: [],
  question:
    "hf7y/american-cycle#84's ruling: run a fourth arm with both #237's positional shock and #242's "
    + 'strain-scaled backfire on, once each solo arm is measured, "only to check they are not redundant." '
    + 'Both are in and neither alone reached the healthy band. Does pairing them move C7-runaway-bars into '
    + '0.75-0.85 with comeback above zero, on 200+ seeds, under the Impeacher-seated pool both arms need to '
    + 'be tested at all?',

  headline:
    "REDUNDANT, NOT ADDITIVE -- PAIRING LANDS ON THE SAME TWO POINTS EITHER ARM ALONE ALREADY DID, NEVER "
    + 'BETWEEN THEM, AND NEVER INSIDE THE BAND. Under the Impeacher-seated pool (needed for the backfire arm '
    + 'to fire at all), the baseline with both brakes off already reads 0.875 -- not #237/#242\'s shared 0.625 '
    + 'baseline, because swapping SenateFlood for Impeacher is itself not a neutral change to this metric. '
    + 'Positional alone (shipped magnitude) on this pool also reads 0.875, not the 0.625 it read under the '
    + 'canonical pool -- so on THIS pool positional-alone is already indistinguishable from baseline. Backfire '
    + 'alone (strain-scaled, shipped magnitude) reads 0.875, matching #242 exactly. Both on together, at '
    + 'shipped magnitudes: 0.875. Both on with positional pushed to #237\'s high point (14 @ d6<=4, the one '
    + 'setting that moved anything under the canonical pool): still 0.875. Every point measured on this pool, '
    + 'brakes on or off, alone or paired, is the same value to four decimal places. Comeback stays positive '
    + 'throughout (3-6%), so that half of the bar was never the obstacle. This settles the question #84\'s '
    + 'ruling asked: the two arms are not redundant with each other in the sense of cancelling or compounding '
    + '-- they are redundant with DOING NOTHING, on this pool, because something about seating an agent that '
    + 'actually attempts impeachment already pins determination at the top attractor before either brake is '
    + 'switched on. Re-deriving the determination metric itself, or asking why swapping one of four agents '
    + 'moves a metric supposedly about the whole field\'s dynamics, is the shared next step -- not a third '
    + 'brake shape, and not further sweeping of these two.',
  stampedAt: '2026-09-08T18:00:00Z',
  stampedOn: 'a3c5196',

  predicate(): Claim[] {
    const base = loadConfig('tuned.json');
    const cards = loadPacks(BALANCE_PACKS);
    const run = (cfg: Config) => runawayMetrics(SEEDS, AGENTS, cards, cfg);

    const off = run(base);

    const positionalOnly: Config = { ...base, economy: { ...base.economy, shockPositional: true } };
    const posOnly = run(positionalOnly);

    const backfireOnly: Config = { ...base, legislature: { ...base.legislature, impeachBackfireStrainScaled: true } };
    const backOnly = run(backfireOnly);

    const bothShipped: Config = {
      ...base,
      economy: { ...base.economy, shockPositional: true },
      legislature: { ...base.legislature, impeachBackfireStrainScaled: true },
    };
    const bothAtShipped = run(bothShipped);

    const bothHigh: Config = {
      ...base,
      economy: { ...base.economy, shockPositional: true, shockPips: 14, shockOnRollAtMost: 4 },
      legislature: { ...base.legislature, impeachBackfireStrainScaled: true },
    };
    const bothAtHigh = run(bothHigh);

    return [
      { name: 'both off (baseline, Impeacher-seated pool): determination', value: off.determination, stamped: 0.875, tolerance: 0.1, unit: 'fraction of game length' },
      { name: 'both off: comeback', value: off.comeback, stamped: 0.045, tolerance: 0.05, unit: 'share of games' },
      { name: 'positional only, shipped magnitude: determination', value: posOnly.determination, stamped: 0.875, tolerance: 0.1, unit: 'fraction of game length' },
      { name: 'positional only: comeback', value: posOnly.comeback, stamped: 0.045, tolerance: 0.05, unit: 'share of games' },
      { name: 'backfire only, strain-scaled shipped magnitude: determination', value: backOnly.determination, stamped: 0.875, tolerance: 0.1, unit: 'fraction of game length' },
      { name: 'backfire only: comeback', value: backOnly.comeback, stamped: 0.045, tolerance: 0.05, unit: 'share of games' },
      { name: 'both on, shipped magnitudes: determination', value: bothAtShipped.determination, stamped: 0.875, tolerance: 0.1, unit: 'fraction of game length' },
      { name: 'both on, shipped magnitudes: comeback', value: bothAtShipped.comeback, stamped: 0.045, tolerance: 0.05, unit: 'share of games' },
      { name: 'both on, positional at high point (14 @ d6<=4): determination', value: bothAtHigh.determination, stamped: 0.875, tolerance: 0.1, unit: 'fraction of game length' },
      { name: 'both on, positional at high point: comeback', value: bothAtHigh.comeback, stamped: 0.045, tolerance: 0.05, unit: 'share of games' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const points = [
      { label: 'both off', det: v('both off (baseline, Impeacher-seated pool): determination'), cb: v('both off: comeback') },
      { label: 'positional only', det: v('positional only, shipped magnitude: determination'), cb: v('positional only: comeback') },
      { label: 'backfire only', det: v('backfire only, strain-scaled shipped magnitude: determination'), cb: v('backfire only: comeback') },
      { label: 'both on, shipped', det: v('both on, shipped magnitudes: determination'), cb: v('both on, shipped magnitudes: comeback') },
      { label: 'both on, positional high', det: v('both on, positional at high point (14 @ d6<=4): determination'), cb: v('both on, positional at high point: comeback') },
    ];
    const landed = points.filter((p) => inBand(p.det));
    const spread = Math.max(...points.map((p) => p.det)) - Math.min(...points.map((p) => p.det));
    const allComeback = points.every((p) => p.cb > 0);
    return [
      spread < 0.01
        ? `every point measured -- both brakes off, either alone, or both together at two magnitude pairs -- reads the identical `
          + `${(100 * points[0].det).toFixed(1)}% on this pool (spread ${spread.toFixed(4)})`
        : `pairing moves the number: spread of ${spread.toFixed(4)} across ${points.map((p) => `${(100 * p.det).toFixed(1)}% (${p.label})`).join(', ')}`,
      landed.length
        ? `${landed.length} of ${points.length} points land inside the healthy 75-85% band (${landed.map((p) => p.label).join(', ')}) -- #84's acceptance bar is met`
        : "none of the points measured lands inside the healthy 75-85% band -- #84's acceptance bar is not met by pairing either",
      allComeback
        ? 'and comeback stays above zero at every point measured'
        : 'and at least one point measured has zero comeback',
      spread < 0.01 && points[0].det === points[3].det
        ? 'so the two arms are redundant with each other on this pool, but not because they cancel or compound -- the Impeacher-seated baseline itself already sits where both arms land, brakes on or off'
        : 'so pairing does not simply reproduce the baseline the way it does under other pools',
    ].join('; ');
  },
};
