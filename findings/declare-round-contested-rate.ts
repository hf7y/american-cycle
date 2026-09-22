import { readFileSync } from 'node:fs';
import { loadConfig, loadPacks, playOne, ALL_PACKS } from '../sim/harness.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#158 acceptance item 1: "the contested rate is an
 *  emergent number (play stops when everyone passes), measured against the
 *  real House record's 13.9% walkovers and its bimodal margin distribution."
 *
 *  Same shape as `margin-ceiling.ts`'s `simMargins()` and the informal probe
 *  posted on #158 (2026-09-20T06:43): 40 seeds, ALL_PACKS, startYear 1932,
 *  Greedy/Lookahead/SenateFlood/HeterodoxSpecialist, reading real House
 *  generals straight off `GameResult.events`. That probe deliberately did not
 *  land as a `findings/` file (a concurrent session was mid-flight on
 *  acceptance item 2 against the same commit chain); this formalizes it. */
function declareRoundContest(seeds = sample(40)) {
  const base = loadConfig('tuned.json');
  const cards = loadPacks(ALL_PACKS);
  const cfg = { ...base, game: { ...base.game, startYear: 1932 } };
  let generals = 0, walkovers = 0;
  const bins = [0, 0, 0, 0, 0]; // 0-10, 10-20, 20-30, 30-40, 40+ pts
  for (let i = 0; i < seeds; i++) {
    for (const e of playOne(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg as never, 1070000 + i).events) {
      if (e.office !== 'representative' || e.round !== 'general') continue;
      generals++;
      if (e.uncontested) { walkovers++; continue; }
      const pts = 2 * Math.abs(e.margin);
      if (pts < 10) bins[0]++;
      else if (pts < 20) bins[1]++;
      else if (pts < 30) bins[2]++;
      else if (pts < 40) bins[3]++;
      else bins[4]++;
    }
  }
  const contested = generals - walkovers;
  return {
    walkoverShare: (100 * walkovers) / generals,
    under10: (100 * bins[0]) / contested,
    safe40plus: (100 * bins[4]) / contested,
  };
}

/** The real share of House district-years fielding only one party's
 *  candidate -- same source and definition `historical-push.ts` already
 *  checks (`house_district_panel.json`, dem/rep at indices 3/4), re-derived
 *  here rather than imported so this finding stands on its own data read. */
function realUnopposedShare() {
  const url = new URL('../data/historical/house_district_panel.json', import.meta.url);
  const rows = (JSON.parse(readFileSync(url, 'utf8')) as { rows: [number, string, number, number, number, number][] }).rows;
  const unopposed = rows.filter(([, , , d, r]) => d === 0 || r === 0).length;
  return (100 * unopposed) / rows.length;
}

export const finding: Finding = {
  id: 'declare-round-contested-rate',
  dependsOn: [],
  question:
    "hf7y/american-cycle#158 acceptance item 1: is the contested rate under dealt districts + face-up "
    + 'snake draft + one-at-a-time declare rounds an emergent number that moves toward the real House '
    + "record's 13.9% walkovers and its bimodal margin distribution, now that the shared hand no longer "
    + 'caps how many districts and candidates compete for the same slots?',

  headline:
    'It moves in the right direction and by a real amount, and closes almost none of the gap. Declare '
    + "rounds cut House walkover share from the pre-#158 mechanic's stamped 90.5% (margin-ceiling.ts) to "
    + '79.9%, a 10.6 point drop off a 76.6-point gap to the real 13.9% -- confirming #158\'s own prediction '
    + 'that removing hand-vs-district competition for slots structurally admits more candidates. The '
    + "margin distribution's SHAPE is untouched: contested races still land in the same monotonically "
    + 'decaying, unimodal blob margin-ceiling.ts already diagnosed on the old mechanic (47.3% of contested '
    + 'races under 10pts, only 0.4% at 40pts+), with essentially no safe-seat cluster among contested '
    + 'races. Expected, not a regression -- #158 changes who enters a race, not how a race\'s margin is '
    + 'rolled (still modifier stack + 3d6-3d6 at 1 pip = 2 points), so margin-ceiling.ts\'s separate, '
    + 'still-open question is untouched by this issue\'s scope.',
  stampedAt: '2026-09-22T03:45:07Z',
  stampedOn: '0034d91',

  predicate(): Claim[] {
    const sim = declareRoundContest();
    return [
      { name: 'sim: House generals, walkover share (declare-round mechanic)', value: sim.walkoverShare, stamped: 79.9, tolerance: 5, unit: '%' },
      { name: 'sim: contested House margins, under 10pts (declare-round mechanic)', value: sim.under10, tolerance: 6, stamped: 47.3, unit: '%' },
      { name: 'sim: contested House margins, 40pts+ (declare-round mechanic)', value: sim.safe40plus, stamped: 0.4, tolerance: 3, unit: '%' },
      { name: 'real: House district-years unopposed', value: realUnopposedShare(), stamped: 13.907, tolerance: 0.01, unit: '%' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const walkover = v('sim: House generals, walkover share (declare-round mechanic)');
    const real = v('real: House district-years unopposed');
    const under10 = v('sim: contested House margins, under 10pts (declare-round mechanic)');
    const safe = v('sim: contested House margins, 40pts+ (declare-round mechanic)');
    const OLD_MECHANIC_WALKOVER = 90.5; // margin-ceiling.ts's stamped pre-#158 figure
    const moved = OLD_MECHANIC_WALKOVER - walkover;
    const stillFar = walkover > 2 * real;
    const stillUnimodal = safe < under10 / 5;
    return [
      `walkover share moved ${moved.toFixed(1)}pp toward the real record (${walkover.toFixed(1)}% now vs ${OLD_MECHANIC_WALKOVER}% pre-#158, against a real ${real.toFixed(1)}%)`,
      stillFar
        ? `but still more than double the real rate, so the gap is cut, not closed`
        : `and is now within 2x the real rate`,
      stillUnimodal
        ? `the contested-margin shape is still the same unimodal blob margin-ceiling.ts flagged on the old mechanic (${under10.toFixed(1)}% under 10pts vs only ${safe.toFixed(1)}% at 40pts+), a dice/modifier-stack question this issue's mechanism does not touch`
        : 'the contested-margin shape now shows a real safe-seat cluster, unlike the old mechanic',
    ].join('; ');
  },
};
