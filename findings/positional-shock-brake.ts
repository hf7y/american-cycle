import { loadConfig, loadPacks, BALANCE_PACKS } from '../sim/harness.ts';
import { runawayMetrics } from '../sim/roundrobin.ts';
import type { Config } from '../engine/game.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
/** Same seed family as `runaway-no-brake.ts`, so the two findings' baselines
 *  are directly comparable rather than coincidentally close. */
const SEEDS = Array.from({ length: sample(200) }, (_, i) => 1030400 + i);
const HEALTHY_LOW = 0.75, HEALTHY_HIGH = 0.85;
const inBand = (x: number) => x >= HEALTHY_LOW && x <= HEALTHY_HIGH;

export const finding: Finding = {
  id: 'positional-shock-brake',
  dependsOn: [],
  question:
    'hf7y/american-cycle#84: the cheap shock (v0.2 item 9) was measured inert -- 0.625 determination with '
    + 'it or without it. #84 built the positional version its own comment deferred: an epicenter drawn from '
    + 'one currently-held seat, paying out incumbents by tag-space nearness rather than by seat count. Does '
    + 'it move C7-runaway-bars into the healthy 0.75-0.85 band, with comeback above zero, on 200+ seeds?',

  headline:
    'MOVES THE NUMBER, BUT ONTO THE SAME TWO POINTS INCUMBENCY ALREADY OCCUPIES, NEVER BETWEEN THEM. '
    + "Unlike the cheap shock, the positional reading is not inert: swapping `shockPositional` on at the shipped "
    + 'magnitude (2 pips, d6<=1) leaves determination at 0.625 (identical to cheap), but sweeping magnitude and '
    + 'frequency does move it -- 8 pips at d6<=4 still reads 0.625, 14 pips at the same frequency reads 0.875. '
    + 'A wider hand sweep over pips in 8..14 and frequency in d6<=3..5 (15 points, not all carried as claims '
    + 'here) never once landed inside 0.75-0.85: every point measured 0.625 or 0.875, the exact two values '
    + "hf7y/american-cycle#180's incumbency toggle already produces on and off. Blending a partial incumbency "
    + 'de-scale (0.1 to 0.85 of shipped, ten points) with a fixed positional shock did not find a middle value '
    + 'either -- same two-point spectrum, no third state. Comeback stayed above zero (3-5.5%) at every point '
    + 'measured, so that half of the acceptance bar is not the obstacle. Reads as this determination metric '
    + 'having (at least in the region explored) two attractors and no stable state between them on this build, '
    + 'not as a magnitude this session failed to find. #84 is not closed: the positional mechanism is real and '
    + 'distinct from the cheap one (see `game.test.ts`, `elections.test.ts`), and it is untried in combination '
    + 'with anything other than a flat incumbency de-scale -- a partial (not all-or-nothing) positional-only '
    + 'brake, or pairing it with the score-side fix hf7y/american-cycle#84 also floated (a decay proportional '
    + "to the leader's lead), is still open.",
  stampedAt: '2026-09-07T18:00:00Z',
  stampedOn: 'aebde8b',

  predicate(): Claim[] {
    const base = loadConfig('tuned.json');
    const cards = loadPacks(BALANCE_PACKS);
    const run = (cfg: Config) => runawayMetrics(SEEDS, AGENTS, cards, cfg);

    const cheap = run(base);
    const shipped: Config = { ...base, economy: { ...base.economy, shockPositional: true } };
    const posShipped = run(shipped);
    const low: Config = { ...base, economy: { ...base.economy, shockPositional: true, shockPips: 8, shockOnRollAtMost: 4 } };
    const posLow = run(low);
    const high: Config = { ...base, economy: { ...base.economy, shockPositional: true, shockPips: 14, shockOnRollAtMost: 4 } };
    const posHigh = run(high);

    return [
      { name: 'cheap shock (shipped magnitude): determination', value: cheap.determination, stamped: 0.625, tolerance: 0.1, unit: 'fraction of game length' },
      { name: 'cheap shock: comeback', value: cheap.comeback, stamped: 0.05, tolerance: 0.05, unit: 'share of games' },
      { name: 'positional shock, shipped magnitude (2 @ d6<=1): determination', value: posShipped.determination, stamped: 0.625, tolerance: 0.1, unit: 'fraction of game length' },
      { name: 'positional shock, shipped magnitude: comeback', value: posShipped.comeback, stamped: 0.03, tolerance: 0.05, unit: 'share of games' },
      { name: 'positional shock, low (8 @ d6<=4): determination', value: posLow.determination, stamped: 0.625, tolerance: 0.1, unit: 'fraction of game length' },
      { name: 'positional shock, low: comeback', value: posLow.comeback, stamped: 0.05, tolerance: 0.05, unit: 'share of games' },
      { name: 'positional shock, high (14 @ d6<=4): determination', value: posHigh.determination, stamped: 0.875, tolerance: 0.1, unit: 'fraction of game length' },
      { name: 'positional shock, high: comeback', value: posHigh.comeback, stamped: 0.055, tolerance: 0.05, unit: 'share of games' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const points = [
      { label: 'shipped magnitude', det: v('positional shock, shipped magnitude (') },
      { label: 'low (8 @ d6<=4)', det: v('positional shock, low (') },
      { label: 'high (14 @ d6<=4)', det: v('positional shock, high (') },
    ];
    const landed = points.filter((p) => inBand(p.det));
    const comebacks = [v('cheap shock: comeback'), v('positional shock, shipped magnitude: comeback'),
      v('positional shock, low: comeback'), v('positional shock, high: comeback')];
    const allComeback = comebacks.every((x) => x > 0);
    const moved = points.some((p) => p.det !== v('cheap shock ('));
    return [
      moved
        ? `positional scaling is not inert -- it reaches ${points.map((p) => `${(100 * p.det).toFixed(1)}% (${p.label})`).join(', ')}, `
          + `against ${(100 * v('cheap shock (')).toFixed(1)}% for the cheap shock at the same shipped magnitude`
        : 'positional scaling measured identical to the cheap shock at every point tried, same as the cheap shock alone was',
      landed.length
        ? `and ${landed.length} of ${points.length} points measured land inside the healthy 75-85% band (${landed.map((p) => p.label).join(', ')}) -- #84's acceptance bar is met`
        : 'but none of the points measured lands inside the healthy 75-85% band -- #84\'s acceptance bar is not met by this build',
      allComeback
        ? 'and comeback stays above zero at every point measured, so that half of the acceptance bar is not the blocker'
        : 'and at least one point measured has zero comeback, which is its own failure independent of the band',
    ].join('; ');
  },
};
