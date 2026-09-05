import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from '../sim/harness.ts';
import { withDistrictFraction } from '../sim/sweeps.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** SIM-BRIEF Part 5: "If it's over about 40%, players aren't fighting each
 *  other and the game is solitaire in parallel." The floor on CONTEST is the
 *  complement of that ceiling on walkovers. */
const TARGET = 60;

/** Share of race-slots drawing declarations from more than one player.
 *
 *  Contest is a RATIO — cards per player over eligible races per player — so it
 *  is measured along both of its terms: `hand` is the numerator, and the
 *  district supply kept by `withDistrictFraction` is the denominator, since a
 *  declaration is gated on holding a district card in the state (`eligible`
 *  in engine/rules/elections.ts).
 *
 *  Config is `tuned` as shipped, including its 16-year cap; only the start year
 *  moves, to keep the era-ordered seven-pack talon in step with the calendar. */
function contested(hand: number, districtFraction: number, packs = ['1932', '1964', '1976', '1992', '2008', '2016', '2024'], seeds = sample(40)): number {
  const base = loadConfig('tuned.json');
  const cards = withDistrictFraction(loadPacks(packs), districtFraction, 3);
  const cfg = { ...base, hand: { ...base.hand, base: hand }, game: { ...base.game, startYear: 1932 } };
  let share = 0;
  for (let i = 0; i < seeds; i++) {
    share += playOne(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg as never, 1060000 + i).contestedSlotShare;
  }
  return (100 * share) / seeds;
}

export const finding: Finding = {
  id: 'contest-ratio',
  dependsOn: [],
  question:
    'What actually sets the contest rate, and does the shipped tuning reach the level SIM-BRIEF '
    + 'asks for -- with the district-to-candidate ratio (DECISIONS.md open question 4) as the other '
    + 'lever?',

  headline:
    'Contest is a ratio and both of its terms move it, but neither term reaches the target from '
    + 'inside the shipped tuning. Contest rises monotonically with hand size — 35.8% at hand 8, '
    + '42.9% at 16, 51.2% at 24 — and falls monotonically as district supply rises, from 46.8% at a '
    + 'sixteenth of the districts to 34.9% at all of them, because a district card is what makes a '
    + 'race eligible and more eligible races spread the same cards thinner. Every point measured is '
    + "below SIM-BRIEF's 60% floor: there is simply more board than there are cards to put on it, "
    + 'so players farm their own territory.',
  stampedAt: '2026-09-05T04:41:35Z',
  stampedOn: '218542b',

  predicate(): Claim[] {
    // the hand sweep and the district sweep cross at hand 16, districts 0.15,
    // which is therefore one claim serving both orderings
    // hf7y/american-cycle#91: is the crossing point itself a property of
    // which era-pack list ran it, same config/agents/seeds, four eras?
    const balancePoint = contested(16, 0.15, BALANCE_PACKS);
    return [
      { name: 'hand 8, districts 0.15', value: contested(8, 0.15), stamped: 37.84, tolerance: 3, unit: '%' },
      { name: 'hand 16, districts 0.15', value: contested(16, 0.15), stamped: 47.72, tolerance: 3, unit: '%' },
      { name: 'hand 24, districts 0.15', value: contested(24, 0.15), stamped: 56, tolerance: 3, unit: '%' },
      { name: 'hand 16, districts 0.06', value: contested(16, 0.06), stamped: 48.9, tolerance: 3, unit: '%' },
      { name: 'hand 16, districts 0.40', value: contested(16, 0.4), stamped: 44.48, tolerance: 3, unit: '%' },
      { name: 'hand 16, districts 1.00', value: contested(16, 1), stamped: 32.75, tolerance: 3, unit: '%' },
      { name: 'hand 16, districts 0.15, BALANCE_PACKS', value: balancePoint, stamped: 47.65, tolerance: 3, unit: '%' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const rising = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]);
    const byHand = rising([v('hand 8, districts 0.15'), v('hand 16, districts 0.15'), v('hand 24, districts 0.15')]);
    const bySupply = rising([v('hand 16, districts 1.00'), v('hand 16, districts 0.40'),
                             v('hand 16, districts 0.15'), v('hand 16, districts 0.06')]);
    const short = c.filter((x) => x.value < TARGET).length;
    const deck = deckSensitivity([
      { pool: 'all-seven', value: v('hand 16, districts 0.15') },
      { pool: 'four-pack', value: v('hand 16, districts 0.15, BALANCE_PACKS') },
    ]);
    return [
      byHand ? 'contest rises monotonically with hand size' : 'contest is NOT monotone in hand size',
      bySupply ? 'and falls monotonically as district supply rises' : 'and is NOT monotone in district supply',
      short === c.length ? `every configuration is short of the ${TARGET}% target` : `${c.length - short} of ${c.length} configurations reach ${TARGET}%`,
      deck.sensitive
        ? `and the crossing point is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['all-seven'].toFixed(1)}% all-seven vs ${deck.byPool['four-pack'].toFixed(1)}% four-pack`
        : 'and the crossing point held stable between the all-seven and four-pack decks (hf7y/american-cycle#91)',
    ].join('; ');
  },
};
