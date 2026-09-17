import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const SEEDS = sample(120);

/** Same methodology as `vote-trading-changes-passage.ts`'s own `measure`,
 *  reused so the two are directly comparable. */
function measure(agents: string[], cards: Card[], cfg: Config) {
  let passed = 0, attempted = 0, cross = 0;
  for (let i = 0; i < SEEDS; i++) {
    const r = playOne(agents, cards, cfg, 1090400 + i);
    passed += r.billsPassed; attempted += r.billsAttempted; cross += r.crossBenchVotes;
  }
  return { pass: attempted ? passed / attempted : 0, cross: cross / SEEDS };
}

/** None of these four override `voteBill` or `offerVP` -- the same MIXED
 *  table `vote-trading-changes-passage.ts` used -- so seating `RunningMate`
 *  here isolates its OWN combined bill+VP ledger: no partner ever repays a
 *  favour back to it, only `RunningMate` itself pays one forward. */
const MIXED = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const ONE_SEAT = ['RunningMate', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const ALL_RUNNINGMATES = ['RunningMate', 'RunningMate', 'RunningMate', 'RunningMate'];

export const finding: Finding = {
  id: 'vp-grants-change-passage',
  dependsOn: [],
  question:
    "hf7y/american-cycle#37's own 2026-09-16 comment named VP horse-trading as still blocked by the same wall as "
    + 'bill-vote negotiation -- simultaneous, secret, no channel to signal on. `offerVP`/`pickVP` are answered '
    + 'blind, same as a vote, but the ticket that results is a public fact afterward (`VPGrant`), unrecorded until '
    + 'now -- the same shape `EnactedBill.yesVoters` already gave bill votes for `Dealmaker`. `RunningMate` trades '
    + 'on both channels combined: it withholds a VP offer from a nominee already in its debt, prefers a supplier it '
    + 'owes when picking a running mate, and repays either kind of debt with an off-fit yes vote. Seated against '
    + "partners that never override `voteBill`, does its OWN combined ledger move passage the way Dealmaker's "
    + 'bill-only one already does?',

  headline:
    'PASSAGE MOVES, BUT NOT ON THE SAME SHAPE AS DEALMAKER\'S BILL-ONLY LEDGER -- CROSS-BENCH RISES INSTEAD OF '
    + 'FALLING. One seat barely moves passage (43.5% -> 43.7%); seating all four raises it substantially, 43.5% -> '
    + '56.3%. But cross-bench votes a game RISE, 14.7 -> 17.8, the opposite of `vote-trading-changes-passage.ts`\'s '
    + "own finding for Dealmaker (a fall, 16.4 -> 12.6). The difference is the MIXED partners here: none overrides "
    + '`voteBill`, so a VP grant `RunningMate` hands out is never repaid back to it by the recipient -- only debts '
    + '`RunningMate` itself carries (a VP grant it received, or a bill vote taken by someone it owes) get repaid, '
    + 'and every one of those repayments is itself an off-fit, cross-party vote. With four independent RunningMate '
    + 'seats each accumulating and discharging its own debts against three non-reciprocating partners, those '
    + 'repayments ADD to the cross-bench count rather than substituting for an ideological crossing the way a '
    + 'mutual bill-vote ledger does. The channel this issue\'s own comment called "genuinely blocked" is not blocked '
    + '-- it moves passage by more than the bill-only channel does at this table size, just by a different '
    + 'mechanism than the one that channel uses.',
  stampedAt: '2026-09-16T14:20:00Z',
  stampedOn: '469c0ea',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(['1976', '1992', '2008', '2016']);
    const mixed = measure(MIXED, cards, cfg);
    const oneSeat = measure(ONE_SEAT, cards, cfg);
    const allSeats = measure(ALL_RUNNINGMATES, cards, cfg);
    return [
      { name: 'mixed table (no RunningMate): bills pass', value: mixed.pass, stamped: 0.4352, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'mixed table: cross-bench votes a game', value: mixed.cross, stamped: 14.68, tolerance: 6 },
      { name: 'one RunningMate seat: bills pass', value: oneSeat.pass, stamped: 0.4369, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'one RunningMate seat: cross-bench votes a game', value: oneSeat.cross, stamped: 14.8, tolerance: 6 },
      { name: 'every seat RunningMate: bills pass', value: allSeats.pass, stamped: 0.5634, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'every seat RunningMate: cross-bench votes a game', value: allSeats.cross, stamped: 17.77, tolerance: 6 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const pp = (x: number) => `${(100 * x).toFixed(1)}%`;
    const passMoved = Math.abs(v('every seat RunningMate: bills pass') - v('mixed table (no RunningMate): bills pass')) > 0.03;
    const crossFell = v('every seat RunningMate: cross-bench votes a game') < v('mixed table: cross-bench votes a game');
    return [
      `passage: ${pp(v('mixed table (no RunningMate): bills pass'))} baseline, `
        + `${pp(v('one RunningMate seat: bills pass'))} one seat, ${pp(v('every seat RunningMate: bills pass'))} every seat`,
      `cross-bench votes a game: ${v('mixed table: cross-bench votes a game').toFixed(1)} baseline, `
        + `${v('one RunningMate seat: cross-bench votes a game').toFixed(1)} one seat, `
        + `${v('every seat RunningMate: cross-bench votes a game').toFixed(1)} every seat`,
      passMoved
        ? (crossFell
          ? 'the combined bill+VP ledger passes more bills on fewer raw cross-bench votes -- the VP channel this '
            + "issue's own comment called blocked moves the same shape Dealmaker's bill-only channel already does"
          : 'passage moved but cross-bench volume did not fall -- the VP channel added to crossings rather than replacing them')
        : 'seating RunningMate does not move passage at this table size',
    ].join('; ');
  },
};
