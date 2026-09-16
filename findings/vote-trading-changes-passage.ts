import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const SEEDS = sample(120);

/** Passage rate and cross-bench volume for one table, same methodology as
 *  `bill-passage-is-the-table.ts`'s own `measure`. */
function measure(agents: string[], cards: Card[], cfg: Config) {
  let passed = 0, attempted = 0, cross = 0;
  for (let i = 0; i < SEEDS; i++) {
    const r = playOne(agents, cards, cfg, 1050400 + i);
    passed += r.billsPassed; attempted += r.billsAttempted; cross += r.crossBenchVotes;
  }
  return { pass: attempted ? passed / attempted : 0, cross: cross / SEEDS };
}

const MIXED = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const ONE_SEAT = ['Dealmaker', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const ALL_DEALMAKERS = ['Dealmaker', 'Dealmaker', 'Dealmaker', 'Dealmaker'];

export const finding: Finding = {
  id: 'vote-trading-changes-passage',
  dependsOn: [],
  question:
    "hf7y/american-cycle#37: `bill-passage-is-the-table.ts` closes on \"no agent here can negotiate, offer "
    + 'anything or remember a favour\" -- true when it was stamped, no longer true once `Dealmaker` exists. '
    + 'Does seating it -- one seat, then every seat, on the exact table that closing line was measured against -- '
    + 'move passage the way real cross-bench substitution would predict: more bills passing on fewer raw '
    + 'cross-bench votes, because a repaid favour buys a yes that ideology alone would have refused?',

  headline:
    'ONE SEAT BARELY MOVES IT; EVERY SEAT DOES, AND ON FEWER CROSS-BENCH VOTES, NOT MORE. On the same four-seat '
    + 'table and pack list `bill-passage-is-the-table.ts` used (passage there has since drifted from its own 15% '
    + 'stamp to 41.8% on the current engine -- that finding will read STALE, not this one), one `Dealmaker` seat '
    + 'moves passage 41.8% -> 43.4%, inside noise. Seating all four moves it to 54.5% -- a real gain -- while '
    + 'cross-bench votes a game FALL, 16.4 -> 12.6, rather than rise. That is the mechanism working as designed: a '
    + 'ledger entry lets a player who already helped someone collect a yes vote on fit alone would have refused, '
    + 'substituting a repaid favour for a raw ideological crossing rather than adding to it. One seat has too few '
    + 'reciprocal partners to build a balance worth collecting on; a table that is all Dealmaker is the ceiling '
    + 'case, same shape as `runaway-table-politics.ts`\'s own one-seat/every-seat split for #37\'s other agent.',
  stampedAt: '2026-09-16T05:00:00Z',
  stampedOn: '4221c88',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(['1976', '1992', '2008', '2016']);
    const mixed = measure(MIXED, cards, cfg);
    const oneSeat = measure(ONE_SEAT, cards, cfg);
    const allDealmakers = measure(ALL_DEALMAKERS, cards, cfg);
    return [
      { name: 'mixed table (no Dealmaker): bills pass', value: mixed.pass, stamped: 0.418, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'mixed table: cross-bench votes a game', value: mixed.cross, stamped: 16.4, tolerance: 6 },
      { name: 'one Dealmaker seat: bills pass', value: oneSeat.pass, stamped: 0.434, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'one Dealmaker seat: cross-bench votes a game', value: oneSeat.cross, stamped: 16.6, tolerance: 6 },
      { name: 'every seat Dealmaker: bills pass', value: allDealmakers.pass, stamped: 0.545, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'every seat Dealmaker: cross-bench votes a game', value: allDealmakers.cross, stamped: 12.6, tolerance: 6 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const pp = (x: number) => `${(100 * x).toFixed(1)}%`;
    const passMoved = Math.abs(v('every seat Dealmaker: bills pass') - v('mixed table (no Dealmaker): bills pass')) > 0.05;
    const crossFell = v('every seat Dealmaker: cross-bench votes a game') < v('mixed table: cross-bench votes a game');
    return [
      `passage: ${pp(v('mixed table (no Dealmaker): bills pass'))} baseline, `
        + `${pp(v('one Dealmaker seat: bills pass'))} one seat, ${pp(v('every seat Dealmaker: bills pass'))} every seat`,
      `cross-bench votes a game: ${v('mixed table: cross-bench votes a game').toFixed(1)} baseline, `
        + `${v('one Dealmaker seat: cross-bench votes a game').toFixed(1)} one seat, `
        + `${v('every seat Dealmaker: cross-bench votes a game').toFixed(1)} every seat`,
      passMoved
        ? (crossFell
          ? 'a table that can trade passes more bills on fewer raw cross-bench votes -- favours substitute for crossings rather than adding to them'
          : 'a table that can trade passes more bills, but cross-bench volume did not fall -- trading added to crossings rather than replacing them')
        : 'seating Dealmaker does not move passage at this table size',
    ].join('; ');
  },
};
