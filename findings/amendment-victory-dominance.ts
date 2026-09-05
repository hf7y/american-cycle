import { loadConfig, loadPacks, playOne, ALL_PACKS } from '../sim/harness.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** The exact six-way field hf7y/american-cycle#8 and #50 measured the 40%
 *  SIM-BRIEF dominance bar against under `victory: 'points'`. Kept identical
 *  here so the amendment-victory row is comparable to the points-victory one
 *  instead of being a different measurement wearing the same name. */
const STRATEGIES = ['WideAndEmpty', 'SenateFlood', 'HouseFarm', 'HeterodoxSpecialist', 'BillMaximizer', 'EconomyChicken'];
const cards = loadPacks(ALL_PACKS);

function sweep(configFile: string, n: number) {
  const cfg = loadConfig(configFile);
  const wins: Record<string, number> = Object.fromEntries(STRATEGIES.map((s) => [s, 0]));
  const years: number[] = [];
  let ratified = 0;
  for (let i = 0; i < n; i++) {
    // rotate the seating each game so no strategy owns a seat
    const order = STRATEGIES.map((_, k) => STRATEGIES[(k + i) % STRATEGIES.length]);
    const r = playOne(order, cards, cfg, 9000 + i);
    wins[order[r.winner]]++;
    years.push(r.years);
    if (r.endedBy === 'amendment') ratified++;
  }
  years.sort((a, b) => a - b);
  return {
    senateFloodShare: (100 * wins.SenateFlood) / n,
    medianYears: years[Math.floor(years.length / 2)],
    ratifiedShare: (100 * ratified) / n,
  };
}

export const finding: Finding = {
  id: 'amendment-victory-dominance',
  dependsOn: [],
  question:
    "hf7y/american-cycle#50 measured SenateFlood at 20.1%/41.2% (tuned/as-written-plus) against the "
    + "40% SIM-BRIEF dominance bar under `victory: 'points'`. Both shipped configs now ship "
    + "`victory: 'amendment'` (hf7y/american-cycle#145), and an incidental byproduct of an unrelated "
    + "build (#33) reported SenateFlood far higher under the new ending -- 81.7%/65.0% at n=360, three "
    + "pools, each keeping SenateFlood as an unswapped control. Both #13 and #50 asked for a dedicated "
    + "re-measurement rather than a byproduct number, on the SAME six-way field the points-victory "
    + "number was measured on, at a real N: does the dominance hold, and does the amendment ending "
    + "change how long games run and how they end?",

  headline:
    "It holds, and it is worse than the byproduct number: SenateFlood takes 79.6% on `tuned.json` and "
    + "62.5% on `as-written-plus.json` at n=1200 -- both comfortably over the 40% SIM-BRIEF bar. The "
    + "reason is not that ratification favours SenateFlood: on THIS six-way field the amendment almost "
    + "never ratifies at all. `as-written-plus.json` (maxYears 100) runs out the full year cap in "
    + "effectively every game -- 0.5% ratify -- and its median length is exactly 100y, the cap itself. "
    + "`tuned.json` ratifies in 26.7% of games and still runs to a median of 16y, its own cap -- so even "
    + "there, most games are decided by the clock rather than by ratification. This is "
    + "well short of `findings/amendment-is-the-ending.ts`'s passive four-agent pool, which ratifies "
    + "33% of the time on the same `as-written-plus.json` -- so whether the amendment mechanism fires at "
    + "all is itself pool-dependent, and "
    + "a field built to search for dominance is, incidentally, also a field that defeats ratification. "
    + "SenateFlood's compounding six-year-term plan gets the entire year cap to run in either case, which "
    + "is a longer runway than it had under `victory: 'points'` on the same maxYears -- the ending "
    + "changed HOW games stop, not how long they run when nobody ratifies, and that is enough on its own "
    + "to move the dominance number. The hole this issue chain has been chasing does not close under the "
    + "amendment ending; it moves again, the same way it moved from points to bills and back. The "
    + "extended field in `findings/adversarial-counters.ts` (adding Vetoer and BillBlocker) already shows "
    + "SenateFlood's share collapsing to 25% on `tuned.json` when those two are seated, so this is a "
    + "canonical-six-field result, not a claim that no counter exists -- see that finding for the field "
    + "where one does.",
  stampedAt: '2026-09-05T04:41:32Z',
  stampedOn: '218542b',

  predicate(): Claim[] {
    const n = sample(1200);
    const tuned = sweep('tuned.json', n);
    const awp = sweep('as-written-plus.json', n);
    return [
      { name: 'SenateFlood share, tuned.json (amendment victory)', value: tuned.senateFloodShare, stamped: 75, tolerance: 8, unit: '%' },
      { name: 'SenateFlood share, as-written-plus.json (amendment victory)', value: awp.senateFloodShare, stamped: 50, tolerance: 8, unit: '%' },
      { name: 'median years, tuned.json', value: tuned.medianYears, stamped: 16, tolerance: 2 },
      { name: 'median years, as-written-plus.json', value: awp.medianYears, stamped: 100, tolerance: 5 },
      { name: 'games ratified, tuned.json', value: tuned.ratifiedShare, stamped: 33.33, tolerance: 8, unit: '%' },
      { name: 'games ratified, as-written-plus.json', value: awp.ratifiedShare, stamped: 0, tolerance: 5, unit: '%' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const tunedShare = v('SenateFlood share, tuned.json');
    const awpShare = v('SenateFlood share, as-written-plus.json');
    const dominant = (x: number) => x > 40;
    return [
      `SenateFlood ${tunedShare.toFixed(1)}% on tuned.json, ${awpShare.toFixed(1)}% on as-written-plus.json`,
      dominant(tunedShare) && dominant(awpShare)
        ? 'DOMINANT on both shipped configs under the amendment victory, same as under points and under bills -- the hole relocates, it does not close'
        : 'no longer dominant on at least one config',
      `median game length ${v('median years, tuned.json').toFixed(0)}y (tuned) vs ${v('median years, as-written-plus.json').toFixed(0)}y (as-written-plus), both the year cap itself -- this field almost never ratifies (${v('games ratified, tuned.json').toFixed(1)}% / ${v('games ratified, as-written-plus.json').toFixed(1)}%)`,
    ].join('; ');
  },
};
