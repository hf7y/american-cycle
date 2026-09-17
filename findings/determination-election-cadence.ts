import { loadConfig, loadPacks, BALANCE_PACKS } from '../sim/harness.ts';
import { leadershipCadence, runawayMetrics } from '../sim/roundrobin.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
// Same pool, seed block and config as runaway-no-brake.ts, so this reads as
// a decomposition of that finding's own baseline rather than a fresh sample.
const SEEDS = Array.from({ length: sample(120) }, (_, i) => 1030400 + i);

export const finding: Finding = {
  id: 'determination-election-cadence',
  dependsOn: [],
  question:
    "hf7y/american-cycle#244's ruling: three independent #84 brake sweeps (#237, #242, #243) each landed on "
    + 'determination = 10/16 or 14/16 and nothing between, and the working hypothesis was that the score lead '
    + 'only changes hands at presidential elections, so the metric steps once per 4-year presidential cycle. '
    + 'Verify: histogram the year of every lead change (not just the last). Does it cluster at presidential years?',

  headline:
    'NO -- the lead changes hands on every election-year residue, and the ruling\'s own premise ("the lead only '
    + 'changes hands at presidential elections") is false on the code before it is false on the data: '
    + '`isElectionYear` (engine/game.ts:236-238) fires every even year (President/Senate-class/House) AND on '
    + 'row%4 in {1,3} whenever `oddYearGovernors` puts some state\'s governor up, which tuned.json always does -- '
    + 'so every row in scoreHistory is an election year for SOME office, not one row in four. Measured on the '
    + 'same 120-seed baseline runaway-no-brake.ts uses: presidential rows (row%4==0) carry only 29.9% of all '
    + 'lead changes and 27.1% of the LAST lead change per game -- barely above the 25% a uniform spread across '
    + 'four residues would give, i.e. presidential years are not even mildly special. The dominant residue is '
    + 'row%4==2 -- MIDTERM years -- at 41.8% of all changes and 39.3% of last changes. That has a named cause, '
    + 'not a guessed one: `nat.midtermPenalty` (elections.ts:285,320, -2 pips, tuned.json) applies to every '
    + 'race simultaneously on `ctx.isMidterm` (game.ts:668, `this.year % 4 === 2`), so a midterm year moves the '
    + 'WHOLE board at once the way no single presidential race does. Odd years (residues 1 and 3, governors '
    + 'only, no federal race and no national modifier) split the remaining ~28% unevenly (12.8% / 15.5%), '
    + "which is consistent with fewer states having a governor up in one odd-year slot than the other under "
    + "this engine's rotation. Per the ruling's own branch: hypothesis rejected, so no band redefinition and no "
    + 'restamp of the #84 arms follows from this finding alone -- the 10/16-vs-14/16 clustering those three '
    + 'sweeps hit is better explained by which specific configs happened to be swept than by a strict 4-year '
    + 'gate on the metric. Separately, and worth flagging on #84: the shipped baseline (incumbency ON, no '
    + 'ablation) now measures determination 0.875 at full 120-seed precision, not the 0.63 runaway-no-brake.ts '
    + 'has stamped since 2026-09-05 -- the engine has moved enough on its own (identityWeights rollout #19, '
    + 'roll-call votes #263, and other churn since) that runaway-no-brake.ts is due a fresh look independent of '
    + 'this finding\'s own question.',
  stampedAt: '2026-09-17T00:00:00Z',
  stampedOn: '988f38c',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(BALANCE_PACKS);
    const cadence = leadershipCadence(SEEDS, AGENTS, cards, cfg);
    const runaway = runawayMetrics(SEEDS, AGENTS, cards, cfg);
    return [
      { name: 'presidential-row share of all lead changes', value: cadence.presidentialShareOfAllChanges, stamped: 0.299, tolerance: 0.05, unit: 'share' },
      { name: 'presidential-row share of last lead change', value: cadence.presidentialShareOfLastChange, stamped: 0.271, tolerance: 0.06, unit: 'share' },
      { name: 'midterm-row share of all lead changes', value: cadence.totalChanges ? cadence.residueChanges[2] / cadence.totalChanges : 0, stamped: 0.418, tolerance: 0.06, unit: 'share' },
      { name: 'midterm-row share of last lead change', value: cadence.gamesWithChange ? cadence.residueLastChange[2] / cadence.gamesWithChange : 0, stamped: 0.393, tolerance: 0.07, unit: 'share' },
      { name: 'baseline: determination point, full precision', value: runaway.determination, stamped: 0.875, tolerance: 0.07, unit: 'fraction of game length' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const presLast = v('presidential-row share of last lead change');
    const midLast = v('midterm-row share of last lead change');
    const clustersOnPresidential = presLast > 0.6;
    return [
      clustersOnPresidential
        ? `lead changes DO cluster on presidential rows (${(100 * presLast).toFixed(0)}% of last changes) -- the `
          + 'presidential-cycle hypothesis holds; restate C7 in presidential cycles per the ruling'
        : `lead changes do NOT cluster on presidential rows (only ${(100 * presLast).toFixed(0)}% of last changes, `
          + 'close to the 25% four residues would give by chance)',
      `midterm rows carry the largest share instead (${(100 * midLast).toFixed(0)}% of last changes), consistent `
        + "with midtermPenalty's simultaneous national swing rather than any single office's own cycle",
      `baseline determination now measures ${v('baseline: determination point, full precision').toFixed(3)} at full `
        + 'precision, against runaway-no-brake.ts\'s 0.63 stamp -- that finding is independently due for a look',
    ].join('; ');
  },
};
