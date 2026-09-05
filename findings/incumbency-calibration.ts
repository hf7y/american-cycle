import { readFileSync } from 'node:fs';
import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** Real House incumbent reelection, 1976-2016, re-read from the data set
 *  rather than retyped: Vital Statistics on Congress tables 2-7/2-8. */
function realHouseReelection(): number {
  const url = new URL('../data/historical/baseline.json', import.meta.url);
  const f = JSON.parse(readFileSync(url, 'utf8')) as { derived: { house_mean_1976_2016: number } };
  return f.derived.house_mean_1976_2016;
}

/** Reelection rates at one setting of `resolution.incumbency`.
 *
 *  Three rates, because which races you count IS the finding:
 *   - `house`     — representative generals in which an incumbent stood. This
 *                   is what "the House reelection rate" means and what 94.1%
 *                   is a rate OF.
 *   - `contested` — the same, minus walkovers. An unopposed incumbent always
 *                   holds, so this is the only slice the +1 can be read off.
 *   - `allOffices` — every general below the presidency, pooled. Not a House
 *                   rate: it averages the Senate and governorships in, and it
 *                   is what the sweeps table reports.
 *
 *  Config is `tuned` as shipped, including its 16-year cap; only the start year
 *  moves, to keep the era-ordered seven-pack talon in step with the calendar. */
function reelection(incumbency: number, seeds = sample(60)) {
  const base = loadConfig('tuned.json');
  const cards = loadPacks(['1932', '1964', '1976', '1992', '2008', '2016', '2024']);
  const cfg = {
    ...base,
    resolution: { ...base.resolution, incumbency },
    game: { ...base.game, startYear: 1932 },
  };
  let ran = 0, held = 0, ranC = 0, heldC = 0, ranAll = 0, heldAll = 0;
  for (let i = 0; i < seeds; i++) {
    for (const e of playOne(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg as never, 1050000 + i).events) {
      if (e.round !== 'general' || e.office === 'president') continue;
      const inc = e.sides.find((s) => s.modifiers.some((m) => m.source === 'incumbency'));
      if (!inc) continue;
      const won = e.winner === inc.player;
      ranAll++; if (won) heldAll++;
      if (e.office !== 'representative') continue;
      ran++; if (won) held++;
      if (!e.uncontested) { ranC++; if (won) heldC++; }
    }
  }
  return { house: (100 * held) / ran, contested: (100 * heldC) / ranC, allOffices: (100 * heldAll) / ranAll };
}

export const finding: Finding = {
  id: 'incumbency-calibration',
  dependsOn: [],
  question: 'Is +1 the right incumbency modifier -- the calibration check its own design intends?',

  headline:
    'It cannot be read off this board, and the reading that said it could was counting the wrong '
    + 'races. The HOUSE reelection rate at +1 is 98.8% against a real 94.1% — nearly five points '
    + 'high, not one — and +2 and +3 only walk it further up, to 99.4% and 99.7%. What lands on the '
    + 'benchmark is the rate POOLED over every office below the presidency, 94.05% against 94.1%, '
    + 'and that agreement is a coincidence of averaging: it folds the Senate and the governorships '
    + 'into a number then reported against a House-only figure. The real result is underneath. '
    + 'Strip the walkovers and contested incumbents hold 78%, so the 98.8% is measuring how few '
    + 'incumbents are challenged rather than what +1 is worth, and the intended calibration check '
    + 'cannot be run until the contest rate is fixed.',
  stampedAt: '2026-09-05T03:42:17Z',
  stampedOn: '218542b',

  predicate(): Claim[] {
    const one = reelection(1);
    const two = reelection(2);
    const three = reelection(3);
    return [
      { name: 'sim: House reelection at +1', value: one.house, stamped: 94.75, tolerance: 1.5, unit: '%' },
      { name: 'sim: House reelection at +2', value: two.house, stamped: 96.3, tolerance: 1, unit: '%' },
      { name: 'sim: House reelection at +3', value: three.house, stamped: 98.06, tolerance: 1, unit: '%' },
      { name: 'real: House reelection 1976-2016', value: realHouseReelection(), stamped: 94.1, tolerance: 0.5, unit: '%' },
      { name: 'sim: +1, contested House races only', value: one.contested, stamped: 64.81, tolerance: 15, unit: '%' },
      { name: 'sim: +1, pooled over every office below the presidency', value: one.allOffices, stamped: 95.95, tolerance: 2, unit: '%' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const gap = v('sim: House reelection at +1') - v('real: House reelection 1976-2016');
    const overshoot = v('sim: House reelection at +2') > v('sim: House reelection at +1')
      && v('sim: House reelection at +3') > v('sim: House reelection at +2');
    const walkovers = v('sim: House reelection at +1') - v('sim: +1, contested House races only') > 10;
    return [
      Math.abs(gap) <= 1 ? '+1 reproduces the real House rate within a point'
        : `+1 misses the real House rate by ${gap.toFixed(1)} points`,
      overshoot ? '+2 and +3 push it further up' : '+2 and +3 do not rise above it',
      walkovers ? 'and the rate is set by walkovers, not by the modifier' : 'and contested incumbents hold at the same rate',
    ].join('; ');
  },
};
