import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import { withDistrictFraction } from '../sim/sweeps.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

function measure(players: number, hand: number, frac: number, uncontestedPush: number, seeds = sample(40)) {
  const base = loadConfig('tuned.json');
  const all = loadPacks(['1932', '1964', '1976', '1992', '2008', '2016', '2024']);
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
    + 'an uncontested win pushes? (§10, and §16 on district-to-candidate ratio)',

  headline:
    'They are ALTERNATIVES, not complements. Raising contest to 64% produces realignment (6.1 states a '
    + 'game) with the walkover rule OFF, matching what the walkover rule alone achieves at low contest '
    + '(6.5). Doing both gives 15.1, which is realignment as background noise. Contest is the better '
    + 'lever because the same change also moves decision density, dead turns, the midterm brake and '
    + 'heterodoxy, none of which the walkover rule touches.',
  stampedAt: '2026-08-31T09:45:00Z',
  stampedOn: 'f0bbaca',

  predicate(): Claim[] {
    const lowOff = measure(4, 16, 1.0, 0);
    const highOff = measure(6, 24, 0.06, 0);
    const lowOn = measure(4, 16, 1.0, 1);
    const highOn = measure(6, 24, 0.06, 1);
    return [
      { name: 'low contest, walkover off: contested share', value: lowOff.contested, stamped: 0.28, tolerance: 0.10, unit: 'share' },
      { name: 'low contest, walkover off: states realigned', value: lowOff.fourPerGame, stamped: 0.2, tolerance: 1.0 },
      { name: 'high contest, walkover off: contested share', value: highOff.contested, stamped: 0.64, tolerance: 0.12, unit: 'share' },
      { name: 'high contest, walkover off: states realigned', value: highOff.fourPerGame, stamped: 6.1, tolerance: 3.0 },
      { name: 'low contest, walkover on: states realigned', value: lowOn.fourPerGame, stamped: 6.5, tolerance: 3.0 },
      { name: 'both: states realigned', value: highOn.fourPerGame, stamped: 15.1, tolerance: 5.0 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const contestWorks = v('high contest, walkover off: states') >= 3;
    const walkoverWorks = v('low contest, walkover on: states') >= 3;
    const bothExcessive = v('both: states') > v('high contest, walkover off: states') * 1.8;
    return [
      contestWorks ? 'contest alone realigns the map' : 'contest alone does NOT realign the map',
      walkoverWorks ? 'the walkover rule alone also does' : 'the walkover rule alone does not',
      bothExcessive ? 'and together they overshoot' : 'and together they do not overshoot',
    ].join('; ');
  },
};
