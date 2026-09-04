import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from '../sim/harness.ts';
import { feelMetrics, quantile } from '../sim/feel.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** SIM-BRIEF Part 3 and Part 5's feel bands (hf7y/american-cycle#34), promoted
 *  from sim/feel.ts's print-only instrument to a guarded predicate -- the same
 *  drift that let #49's swinginess claim move 2.5pp -> 4.5pp unnoticed applies
 *  to every metric here, because none of them was asserted anywhere. */
const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const SEED_BASE = 300000;

export const finding: Finding = {
  id: 'feel-metrics',
  dependsOn: [],
  question:
    "SIM-BRIEF's feel bands -- decision density, dead turns, board load, uncontested share -- "
    + 'are measured by sim/feel.ts but nothing fails when any of them leaves its band. Do they hold, '
    + 'on the shipped tuned.json?',

  headline:
    "Two of four bands fail on tuned.json. Decision density's median (46 legal races per player-turn) "
    + "sits far past SIM-BRIEF's own paralysis line of 25 -- turns with zero legal moves are 0.0%, so "
    + 'the excess is choice, not deadlock. Board load stays under the 200-token failure line at the '
    + 'median (72) and p90 (119) but its peak (257) crosses it. Uncontested share is 54.5%, well past '
    + "the ~40% line SIM-BRIEF reads as \"players are not fighting each other\" -- consistent with "
    + '#77/#21: most of the real fight is in the primary, which this share does not count.',
  stampedAt: '2026-09-03T20:30:53-05:00',
  stampedOn: '6a8e8c1',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(BALANCE_PACKS);
    const n = sample(40);
    const seeds = Array.from({ length: n }, (_, i) => SEED_BASE + i);
    const m = feelMetrics(seeds, AGENTS, cards, cfg);

    let uncontested = 0;
    for (const seed of seeds) uncontested += playOne(AGENTS, cards, cfg, seed).uncontestedShare;

    return [
      { name: 'decision density: median legal races/player-turn', value: quantile(m.legal, 0.5), stamped: 46, tolerance: 8 },
      { name: 'decision density: turns with no legal move', value: 100 * m.deadTurnShare, stamped: 0, tolerance: 2, unit: '%' },
      { name: 'board load: median tokens', value: quantile(m.tokens, 0.5), stamped: 72, tolerance: 15 },
      { name: 'board load: p90 tokens', value: quantile(m.tokens, 0.9), stamped: 119, tolerance: 30 },
      { name: 'board load: peak tokens', value: Math.max(...m.tokens), stamped: 257, tolerance: 60 },
      { name: 'uncontested share', value: 100 * uncontested / n, stamped: 54.49, tolerance: 5, unit: '%' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const densityMedian = v('decision density: median legal races/player-turn');
    const deadTurns = v('decision density: turns with no legal move');
    const peak = v('board load: peak tokens');
    const uncontested = v('uncontested share');
    return [
      densityMedian > 25
        ? `decision density's median is ${densityMedian.toFixed(0)}, past SIM-BRIEF's paralysis line of 25`
        : densityMedian < 4
          ? `decision density's median is ${densityMedian.toFixed(0)}, below SIM-BRIEF's automatic line of 4`
          : "decision density sits inside SIM-BRIEF's healthy 4-25 band",
      deadTurns > 1
        ? `and ${deadTurns.toFixed(1)}% of turns have no legal move`
        : 'and turns with no legal move are near zero',
      peak > 200
        ? `board load's peak (${peak.toFixed(0)}) crosses the 200-token failure line, though the median and p90 do not`
        : "board load stays under SIM-BRIEF's 200-token failure line throughout",
      uncontested > 40
        ? `and ${uncontested.toFixed(1)}% of races are uncontested, past the ~40% line where players are reading as not fighting each other`
        : 'and uncontested share stays under the ~40% line',
    ].join('; ');
  },
};
