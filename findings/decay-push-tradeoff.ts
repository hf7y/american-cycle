import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import type { Claim, Finding } from './types.ts';

const P = (a: number, b: number, c: number) =>
  [{ maxPips: 1, push: a }, { maxPips: 3, push: b }, { maxPips: 99, push: c }];

/** mean |lean| and durable-realignment count for one decay/push pairing */
function measure(over: Record<string, unknown>, seeds = 50) {
  const base = loadConfig('tuned.json');
  const cards = loadPacks(['1932', '1964', '1976', '1992', '2008', '2016', '2024']);
  const cfg = {
    ...base,
    game: { ...base.game, startYear: 1932, maxYears: 60, victory: 'points' },
    lean: { ...base.lean, uncontestedPush: 1, ...over },
  };
  let abs = 0, n = 0, four = 0, cap = 0, games = 0;
  for (let i = 0; i < seeds; i++) {
    const r = playOne(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg as never, 1010000 + i);
    games++;
    for (const v of Object.values(r.finalLean)) {
      abs += Math.abs(v); n++;
      if (Math.abs(v) >= 4) four++;
      if (Math.abs(v) >= 8) cap++;
    }
  }
  return { meanAbs: abs / n, fourPerGame: four / games, cappedPerGame: cap / games };
}

export const finding: Finding = {
  id: 'decay-push-tradeoff',
  question:
    'Can annual decay be balanced by raising push values, or is that limited by the 3d6 design? '
    + '(§7, §10, §16 open question 1)',

  headline:
    'Yes, and annual decay with pushes raised +2 produces a BETTER map than biennial: more states '
    + 'realign (14.0 vs 6.7 a game) and none pins at the ±8 cap (0.0 vs 3.7), because annual decay '
    + 'keeps pulling back so a state must keep being won to stay realigned. The 3d6 design does not '
    + 'limit this — the dice fix how OFTEN each push tier fires, not what a tier is worth.',
  stampedAt: '2026-08-31T09:40:00Z',
  stampedOn: 'phase1-engine',

  predicate(): Claim[] {
    const biennial = measure({ decayFrequency: 'biennial' });
    const annual = measure({ decayFrequency: 'annual' });
    const plus2 = measure({ decayFrequency: 'annual', pushByMargin: P(2, 3, 4) });
    return [
      { name: 'biennial 0/1/2: states realigned per game', value: biennial.fourPerGame, stamped: 6.7, tolerance: 2.0 },
      { name: 'biennial 0/1/2: states pinned at the cap', value: biennial.cappedPerGame, stamped: 3.7, tolerance: 2.0 },
      { name: 'annual 0/1/2: states realigned per game', value: annual.fourPerGame, stamped: 0.0, tolerance: 0.5 },
      { name: 'annual 2/3/4: states realigned per game', value: plus2.fourPerGame, stamped: 14.0, tolerance: 4.0 },
      { name: 'annual 2/3/4: states pinned at the cap', value: plus2.cappedPerGame, stamped: 0.0, tolerance: 0.5 },
    ];
  },

  verdict(c: Claim[]): string {
    const by = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const rescued = by('annual 2/3/4: states realigned') > by('annual 0/1/2: states realigned') + 2;
    const beatsBiennial = by('annual 2/3/4: states realigned') > by('biennial 0/1/2: states realigned');
    const noSaturation = by('annual 2/3/4: states pinned') < by('biennial 0/1/2: states pinned');
    return [
      rescued ? 'raising pushes rescues annual decay' : 'raising pushes does NOT rescue annual decay',
      beatsBiennial ? 'and realigns more than biennial' : 'but realigns less than biennial',
      noSaturation ? 'without saturating the cap' : 'and saturates the cap as biennial does',
    ].join('; ');
  },
};
