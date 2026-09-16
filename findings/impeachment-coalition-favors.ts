import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from '../sim/harness.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#37's own 2026-09-16 comment names the remaining gap
 *  once Dealmaker (repays a favour already on the books) and RunawayBrake
 *  (reacts to a rival's score) both shipped: "coalition-building for
 *  impeachment, beyond the arithmetic Impeacher/VPBackstab already do."
 *  Those two move on a loose party headcount -- Impeacher at 50% Senate
 *  opposition, VPBackstab at 25% ownership -- neither of which is the real
 *  2/3 `impeachThreshold` the vote itself needs. `Whip` predicts the actual
 *  threshold, counting opposition-party senators plus same-party senators
 *  who owe it a favour on the same public ledger `Dealmaker` reads, and only
 *  moves when that prediction clears 2/3. Swapping it in -- one seat, then
 *  every seat -- on a table built to generate both bill-vote favours and
 *  Senate presence is the direct test of whether counting more carefully
 *  produces more successful removals than the two blunt agents already
 *  ship. */
const SEEDS = sample(150);

function measure(agents: string[], cards: Card[], cfg: Config) {
  let impeachments = 0, gamesWithOne = 0;
  for (let i = 0; i < SEEDS; i++) {
    const r = playOne(agents, cards, cfg, 1070400 + i);
    impeachments += r.impeachments;
    if (r.impeachments > 0) gamesWithOne++;
  }
  return { mean: impeachments / SEEDS, share: gamesWithOne / SEEDS };
}

const ARITHMETIC = ['Impeacher', 'VPBackstab', 'Greedy', 'BillAuthor'];
const ONE_SEAT = ['Whip', 'VPBackstab', 'Greedy', 'BillAuthor'];
const ALL_WHIP = ['Whip', 'Whip', 'Whip', 'Whip'];

export const finding: Finding = {
  id: 'impeachment-coalition-favors',
  dependsOn: [],
  question:
    "hf7y/american-cycle#37: does an agent that predicts the real 2/3 Senate threshold -- opposition-party seats "
    + "plus same-party seats it is owed a favour by, on Dealmaker's own public ledger -- before moving to impeach "
    + 'produce MORE successful removals than Impeacher (moves at 50% opposition) and VPBackstab (25% ownership), '
    + 'neither of which checks the threshold it is actually trying to clear?',

  headline:
    'THE OPPOSITE: COUNTING CAREFULLY REMOVES FEWER PRESIDENTS, NOT MORE. Swapping Impeacher for `Whip` in a '
    + "four-seat table (VPBackstab, Greedy, BillAuthor filling the rest) drops successful impeachments from 0.59 "
    + "to 0.40 a game (share of games with at least one: 42.0% -> 32.0%); a table that is all `Whip` all but stops "
    + "impeaching entirely, 0.007 a game (0.7% of games). The two blunt agents' loose triggers (50% opposition, "
    + "25% ownership) fire on arithmetic well short of the real 2/3 bar, and enough of those long-shot attempts "
    + "still land -- opposition strength swings year to year, and a mover fires again next Congress if it fails. "
    + "`Whip` only moves when its own count already clears 2/3, which this table's favour ledger rarely supplies on "
    + "top of raw party opposition: a same-party senator has to have specifically taken a yes vote from the mover's "
    + "bill before, not merely exist. Precision costs opportunities the blunt agents take anyway and sometimes win.",
  stampedAt: '2026-09-16T07:40:00Z',
  stampedOn: 'ad53033',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(BALANCE_PACKS);
    const arith = measure(ARITHMETIC, cards, cfg);
    const oneSeat = measure(ONE_SEAT, cards, cfg);
    const allWhip = measure(ALL_WHIP, cards, cfg);
    return [
      { name: 'arithmetic movers (Impeacher/VPBackstab): impeachments a game', value: arith.mean, stamped: 0.587, tolerance: 0.3 },
      { name: 'arithmetic movers: share of games with an impeachment', value: arith.share, stamped: 0.42, tolerance: 0.2, unit: 'share of games' },
      { name: 'one Whip seat (replacing Impeacher): impeachments a game', value: oneSeat.mean, stamped: 0.4, tolerance: 0.3 },
      { name: 'one Whip seat: share of games with an impeachment', value: oneSeat.share, stamped: 0.32, tolerance: 0.2, unit: 'share of games' },
      { name: 'every seat Whip: impeachments a game', value: allWhip.mean, stamped: 0.007, tolerance: 0.1 },
      { name: 'every seat Whip: share of games with an impeachment', value: allWhip.share, stamped: 0.007, tolerance: 0.1, unit: 'share of games' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const pp = (x: number) => `${(100 * x).toFixed(1)}%`;
    const arithMean = v('arithmetic movers (Impeacher/VPBackstab): impeachments a game');
    const oneSeatMean = v('one Whip seat (replacing Impeacher): impeachments a game');
    const allWhipMean = v('every seat Whip: impeachments a game');
    return [
      `impeachments a game: ${arithMean.toFixed(2)} arithmetic baseline, ${oneSeatMean.toFixed(2)} one Whip seat, ${allWhipMean.toFixed(2)} every seat Whip`,
      `share of games with one: ${pp(v('arithmetic movers: share of games with an impeachment'))} baseline, `
        + `${pp(v('one Whip seat: share of games with an impeachment'))} one seat, ${pp(v('every seat Whip: share of games with an impeachment'))} every seat`,
      allWhipMean < arithMean && oneSeatMean < arithMean
        ? 'a table that predicts the real threshold before moving removes presidents LESS often than the two blunt '
          + 'agents already shipped -- coalition precision is a brake here, not an accelerant'
        : 'predicting the real threshold before moving did not reduce successful removals at this table',
    ].join('; ');
  },
};
