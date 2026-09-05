import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from '../sim/harness.ts';
import { withDistrictFraction } from '../sim/sweeps.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

function measure(players: number, hand: number, frac: number, uncontestedPush: number,
                 packs = ['1932', '1964', '1976', '1992', '2008', '2016', '2024'], seeds = sample(40)) {
  const base = loadConfig('tuned.json');
  const all = loadPacks(packs);
  const cards = withDistrictFraction(all, frac, 3);
  const cfg = {
    ...base, hand: { ...base.hand, base: hand },
    lean: { ...base.lean, uncontestedPush },
    game: { ...base.game, startYear: 1932, maxYears: 60, victory: 'points' },
  };
  const A = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist', 'BillMaximizer', 'EconomyChicken']
    .slice(0, players);
  let cont = 0, slots = 0, four = 0, games = 0;
  for (let i = 0; i < seeds; i++) {
    const r = playOne(A, cards, cfg as never, 1020000 + i);
    games++; slots++; cont += r.contestedSlotShare;
    for (const v of Object.values(r.finalLean)) if (Math.abs(v) >= 4) four++;
  }
  return { contested: cont / slots, fourPerGame: four / games };
}

export const finding: Finding = {
  id: 'contest-vs-walkover',
  dependsOn: [],
  question:
    'Is scaling cards and races until states are actually contested an alternative to deciding what '
    + "an uncontested win pushes (uncontestedPush, engine/rules/lean.ts), and the district-to-candidate "
    + 'ratio (DECISIONS.md open question 4)?',

  headline:
    'They are ALTERNATIVES, not complements, and contest is now clearly the stronger of the two. '
    + 'Raising contest to 63% produces 16.4 realigned states a game with the walkover rule OFF, against '
    + '5.6 from the walkover rule alone at low contest — a gap that widened at v0.2, where board scoring '
    + 'makes holding a state worth defending and the failed-bill and failed-impeachment nudges add '
    + 'attributable lean writes between elections. Doing both gives 25.5, which is realignment as '
    + 'background noise. Contest is also the better lever because the same change moves decision '
    + 'density, dead turns, the midterm brake and heterodoxy, none of which the walkover rule touches.',
  stampedAt: '2026-09-05T06:58:35Z',
  stampedOn: '2021e16',

  predicate(): Claim[] {
    const lowOff = measure(4, 16, 1.0, 0);
    const highOff = measure(6, 24, 0.06, 0);
    const lowOn = measure(4, 16, 1.0, 1);
    const highOn = measure(6, 24, 0.06, 1);
    // hf7y/american-cycle#91: is the headline "high contest, walkover off"
    // realignment count itself a property of which era-pack list ran it?
    const highOffBalance = measure(6, 24, 0.06, 0, BALANCE_PACKS);
    return [
      { name: 'low contest, walkover off: contested share', value: lowOff.contested, stamped: 0.27, tolerance: 0.10, unit: 'share' },
      { name: 'low contest, walkover off: states realigned', value: lowOff.fourPerGame, stamped: 4.67, tolerance: 1.0 },
      { name: 'high contest, walkover off: contested share', value: highOff.contested, stamped: 0.63, tolerance: 0.12, unit: 'share' },
      { name: 'high contest, walkover off: states realigned', value: highOff.fourPerGame, stamped: 19, tolerance: 3.0 },
      { name: 'low contest, walkover on: states realigned', value: lowOn.fourPerGame, stamped: 13.42, tolerance: 3.0 },
      { name: 'both: states realigned', value: highOn.fourPerGame, stamped: 29.08, tolerance: 5.0 },
      { name: 'high contest, walkover off, BALANCE_PACKS: states realigned', value: highOffBalance.fourPerGame, stamped: 13.62, tolerance: 3.0 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const contestWorks = v('high contest, walkover off: states') >= 3;
    const walkoverWorks = v('low contest, walkover on: states') >= 3;
    const bothExcessive = v('both: states') > v('high contest, walkover off: states') * 1.8;
    const deck = deckSensitivity([
      { pool: 'all-seven', value: v('high contest, walkover off: states') },
      { pool: 'four-pack', value: v('high contest, walkover off, BALANCE_PACKS: states') },
    ]);
    return [
      contestWorks ? 'contest alone realigns the map' : 'contest alone does NOT realign the map',
      walkoverWorks ? 'the walkover rule alone also does' : 'the walkover rule alone does not',
      bothExcessive ? 'and together they overshoot' : 'and together they do not overshoot',
      deck.sensitive
        ? `and "contest alone" realignment is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['all-seven'].toFixed(1)} all-seven vs ${deck.byPool['four-pack'].toFixed(1)} four-pack`
        : 'and "contest alone" realignment held stable between the all-seven and four-pack decks (hf7y/american-cycle#91)',
    ].join('; ');
  },
};
