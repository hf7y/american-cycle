import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** The SHIPPED setting, read from disk rather than restated here. A config that
 *  a finding recommends must be checked by that finding, or the two drift and
 *  the config becomes a hardcoded opinion with no predicate behind it. */
function shippedPushTable(): number[] {
  const cfg = loadConfig('as-written-plus.json');
  return cfg.lean.pushByMargin.map((r) => r.push);
}

const P = (a: number, b: number, c: number) =>
  [{ maxPips: 1, push: a }, { maxPips: 3, push: b }, { maxPips: 99, push: c }];

/** mean |lean| and durable-realignment count for one decay/push pairing */
function measure(over: Record<string, unknown>, seeds = sample(50)) {
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
  dependsOn: ['as-written-plus.json'],
  question:
    'Can annual decay be balanced by raising push values, or is that limited by the 3d6 design? '
    + '(§7, §10, §16 open question 1)',

  headline:
    'Yes, and it makes §7\'s LITERAL reading the best configuration measured. Annual decay with the '
    + 'push table raised +2 to 2/3/4 realigns 13.8 states a game against the shipped baseline\'s 5.8, '
    + 'pins nothing at the ±8 cap against 3.5, and — because §7 also runs the omnibill every year — '
    + 'passes 7.3 bills a game against 3.1. Biennial decay was never the fix; it was a workaround for '
    + 'a push table too small to outrun an annual −2, and it costs half the legislative layer and '
    + 'saturates the map. The 3d6 design does not limit any of this: the dice fix how OFTEN each push '
    + 'tier fires, not what a tier is worth. Shipped as as-written-plus.json.',
  stampedAt: '2026-08-31T10:30:00Z',
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
      { name: 'annual 2/3/4: mean absolute lean', value: plus2.meanAbs, stamped: 2.18, tolerance: 0.7 },
      { name: 'biennial 0/1/2: mean absolute lean', value: biennial.meanAbs, stamped: 1.17, tolerance: 0.5 },
      // The shipped config must still BE the setting this finding recommends.
      // If as-written-plus.json is edited away from 2/3/4 the finding goes
      // stale, which is the point: the config cannot outlive its evidence.
      { name: 'as-written-plus.json still ships the recommended push table', value: shippedPushTable().reduce((a, b) => a + b, 0), stamped: 9, tolerance: 0 },
      { name: 'as-written-plus.json still ships annual decay', value: loadConfig('as-written-plus.json').lean.decayFrequency === 'annual' ? 1 : 0, stamped: 1, tolerance: 0 },
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
      by('annual 2/3/4: mean absolute') > by('biennial 0/1/2: mean absolute')
        ? "so §7's literal annual decay is the better setting, not the broken one"
        : 'though biennial still moves the map further',
      by('as-written-plus.json still ships the recommended') === 9
        ? 'and the shipped config still matches this evidence'
        : 'BUT the shipped config no longer matches this evidence',
    ].join('; ');
  },
};
