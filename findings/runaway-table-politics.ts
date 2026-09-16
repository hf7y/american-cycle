import { loadConfig, loadPacks, BALANCE_PACKS } from '../sim/harness.ts';
import { runawayMetrics } from '../sim/roundrobin.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#37: DECISIONS.md's five "untestable by simulation"
 *  items include "table politics against a runaway leader" on the theory
 *  that no scripted agent treats a rival's score as an input at all.
 *  `runaway-both-brakes.ts` (#84) already tried the other kind of brake --
 *  mechanical config knobs (economy shocks, backfire scaling) -- and neither
 *  alone nor paired moved determination out of the 0.875 attractor. This
 *  finding is the agent-side counterpart: `RunawayBrake` (#37) is a scripted
 *  agent that DOES read a rival's score, contests the leader's own held
 *  seats, blocks every bill while a leader exists, and moves to remove the
 *  leader specifically once they hold the presidency. Swapping it into the
 *  `runaway-no-brake.ts` baseline pool, one seat at a time and then at every
 *  seat, is the direct test of whether the table (rather than the rules)
 *  supplies the brake SIM-BRIEF asks for. */
const BASELINE = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const ONE_SEAT = ['Greedy', 'Lookahead', 'SenateFlood', 'RunawayBrake'];
const STACKED = ['RunawayBrake', 'RunawayBrake', 'RunawayBrake', 'RunawayBrake'];
const SEEDS = Array.from({ length: sample(200) }, (_, i) => 1030400 + i);
const HEALTHY_LOW = 0.75, HEALTHY_HIGH = 0.85;
const inBand = (x: number) => x >= HEALTHY_LOW && x <= HEALTHY_HIGH;

export const finding: Finding = {
  id: 'runaway-table-politics',
  dependsOn: [],
  question:
    "DECISIONS.md rules \"table politics against a runaway leader\" untestable by simulation because no agent reads "
    + "a rival's score. Does seating `RunawayBrake` -- one seat, then every seat -- move determination point and "
    + 'comeback rate toward the healthy 75-85% band, where #84\'s mechanical config brakes could not?',

  headline:
    'ONE SEAT DOES NOTHING; EVERY SEAT LANDS ON THE SAME ATTRACTOR #84\'S MECHANICAL BRAKES ALREADY FOUND. Under '
    + 'this pool (BALANCE_PACKS, tuned.json) the baseline itself already sits at the healthy band\'s low edge -- '
    + '75.0% determination, a different starting point than SIM-BRIEF\'s originally-diagnosed early lock-in, and '
    + 'evidence the engine has moved since runaway-no-brake.ts\'s 62.5%/63% stamps on the same pool and cards '
    + '(that finding will read STALE, not this one). Swapping one of four seats for RunawayBrake changes nothing '
    + 'measurable: determination holds at 75.0%, comeback 6.5% -> 6.0%, within noise. Making every seat '
    + 'RunawayBrake -- the ceiling case, a table that is ALL watchdog -- pushes determination to 87.5%, past the '
    + "band's 85% top, and comeback falls further to 5.5%: the opposite of a brake, not a fix. 87.5% is the exact "
    + "same value runaway-both-brakes.ts's positional-shock and strain-scaled-backfire arms landed on independent "
    + 'of each other and of mechanism -- three unrelated interventions (two mechanical, one agent-side) converging '
    + "on the identical figure is itself evidence for #244's own suspicion that determination's 1/16-year "
    + 'quantization is narrower than the band it is graded against, not evidence that any of the three interventions '
    + "individually did something. Table politics as modelled here (contest the leader's seats, block every bill, "
    + "impeach on sight) is not the missing brake either -- at minimum, not the version of it that reads a rival's "
    + 'score at declare/vote/impeach time without also being able to negotiate or trade, which is the harder, '
    + 'still-untestable half DECISIONS.md actually names.',
  stampedAt: '2026-09-16T02:32:04Z',
  stampedOn: '4221c88',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(BALANCE_PACKS);
    const run = (agents: string[]) => runawayMetrics(SEEDS, agents, cards, cfg);

    const base = run(BASELINE);
    const oneSeat = run(ONE_SEAT);
    const stacked = run(STACKED);

    return [
      { name: 'baseline (no RunawayBrake): determination', value: base.determination, stamped: 0.75, tolerance: 0.15, unit: 'fraction of game length' },
      { name: 'baseline: comeback', value: base.comeback, stamped: 0.065, tolerance: 0.05, unit: 'share of games' },
      { name: 'one RunawayBrake seat: determination', value: oneSeat.determination, stamped: 0.75, tolerance: 0.15, unit: 'fraction of game length' },
      { name: 'one RunawayBrake seat: comeback', value: oneSeat.comeback, stamped: 0.06, tolerance: 0.05, unit: 'share of games' },
      { name: 'every seat RunawayBrake: determination', value: stacked.determination, stamped: 0.875, tolerance: 0.1, unit: 'fraction of game length' },
      { name: 'every seat RunawayBrake: comeback', value: stacked.comeback, stamped: 0.055, tolerance: 0.05, unit: 'share of games' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const points = [
      { label: 'baseline', det: v('baseline (no RunawayBrake): determination'), cb: v('baseline: comeback') },
      { label: 'one seat', det: v('one RunawayBrake seat: determination'), cb: v('one RunawayBrake seat: comeback') },
      { label: 'every seat', det: v('every seat RunawayBrake: determination'), cb: v('every seat RunawayBrake: comeback') },
    ];
    const landed = points.filter((p) => inBand(p.det));
    return [
      `determination: ${points.map((p) => `${(100 * p.det).toFixed(1)}% (${p.label})`).join(', ')}`,
      landed.length
        ? `${landed.length} of ${points.length} points land inside the healthy 75-85% band (${landed.map((p) => p.label).join(', ')})`
        : 'none of the points measured lands inside the healthy 75-85% band',
      `comeback: ${points.map((p) => `${(100 * p.cb).toFixed(1)}% (${p.label})`).join(', ')}`,
      points[2].det !== points[0].det || points[1].det !== points[0].det
        ? 'seating an agent that reads a rival\'s score moves the number -- the table, not only the rules, is a lever on this metric'
        : 'seating RunawayBrake does not move the number at all -- table politics as modelled here is not the missing brake either',
    ].join('; ');
  },
};
