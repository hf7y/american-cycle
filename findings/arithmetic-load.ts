import { loadConfig, loadPacks, playOne, ALL_PACKS, BALANCE_PACKS } from '../sim/harness.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** SIM-BRIEF Part 3's "arithmetic load" (hf7y/american-cycle#53): "Distribution
 *  of modifier-stack depth per race. The design promises mental math. If the
 *  median race stacks 7 modifiers, it doesn't." Never measured -- there was no
 *  print-only instrument to promote, unlike #187/#188's predecessors, because
 *  `RaceEvent.sides[].modifiers` already carries everything this needs
 *  straight off `GameResult.events`. */
const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const SEED_BASE = 800000;

function depths(agents: string[], cards: ReturnType<typeof loadPacks>, cfg: ReturnType<typeof loadConfig>, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = playOne(agents, cards, cfg, SEED_BASE + i);
    for (const ev of r.events) for (const s of ev.sides) out.push(s.modifiers.length);
  }
  return out;
}

function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(q * (s.length - 1))];
}

export const finding: Finding = {
  id: 'arithmetic-load',
  dependsOn: [],
  question:
    "SIM-BRIEF Part 3 asks for the distribution of modifier-stack depth per race -- how many modifier "
    + "lines a player adds up to resolve one side of one race -- and names its own failure example: "
    + '"if the median race stacks 7 modifiers, it doesn\'t" promise mental math. Nothing has measured it. '
    + 'Does the shipped tuned.json clear that bar?',

  headline:
    'It clears the bar with room: median modifier-stack depth is 3, p90 is 5, and the observed maximum '
    + "across 53,594 resolved sides is 10 -- nowhere near SIM-BRIEF's own 7-modifier failure example at "
    + 'the median. The tail is thin (p90 only two above the median), so this is not a case of a healthy '
    + 'median hiding a bad tail the way board load did in `feel-metrics.ts`. The shape holds between the '
    + 'four-era and all-seven-era pools -- median and max are identical, p90 shifts by exactly one '
    + '(5 vs 6).',
  stampedAt: '2026-09-05T16:47:49Z',
  stampedOn: 'ce205c9',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const n = sample(80);

    const d = depths(AGENTS, loadPacks(BALANCE_PACKS), cfg, n);
    // hf7y/american-cycle#91: is the stack depth itself a property of which
    // era-pack list ran it, same config/agents/seeds, all seven eras?
    const dAll = depths(AGENTS, loadPacks(ALL_PACKS), cfg, n);

    return [
      { name: 'modifier-stack depth: median', value: quantile(d, 0.5), stamped: 3, tolerance: 1 },
      { name: 'modifier-stack depth: p90', value: quantile(d, 0.9), stamped: 5, tolerance: 1 },
      { name: 'modifier-stack depth: max', value: Math.max(...d), stamped: 10, tolerance: 3 },
      { name: 'modifier-stack depth: median, ALL_PACKS', value: quantile(dAll, 0.5), stamped: 3, tolerance: 1 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const median = v('modifier-stack depth: median');
    const p90 = v('modifier-stack depth: p90');
    const max = v('modifier-stack depth: max');
    const deck = deckSensitivity([
      { pool: 'four-pack', value: median },
      { pool: 'all-seven', value: v('modifier-stack depth: median, ALL_PACKS') },
    ]);
    return [
      median >= 7
        ? `median modifier-stack depth is ${median.toFixed(0)}, at or past SIM-BRIEF's own 7-modifier failure example -- mental math has failed`
        : `median modifier-stack depth is ${median.toFixed(0)}, well clear of SIM-BRIEF's 7-modifier failure example`,
      `p90 is ${p90.toFixed(0)} and the observed max is ${max.toFixed(0)}`,
      deck.sensitive
        ? `and modifier-stack depth is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['four-pack'].toFixed(0)} four-pack vs ${deck.byPool['all-seven'].toFixed(0)} all-seven`
        : 'and modifier-stack depth held stable between the four-pack and all-seven decks (hf7y/american-cycle#91)',
    ].join('; ');
  },
};
