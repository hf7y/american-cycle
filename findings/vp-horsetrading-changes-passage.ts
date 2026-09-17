import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const SEEDS = sample(120);

/** Passage rate and cross-bench volume for one table, same methodology as
 *  `vote-trading-changes-passage.ts`'s own `measure`. */
function measure(agents: string[], cards: Card[], cfg: Config) {
  let passed = 0, attempted = 0, cross = 0;
  for (let i = 0; i < SEEDS; i++) {
    const r = playOne(agents, cards, cfg, 1050500 + i);
    passed += r.billsPassed; attempted += r.billsAttempted; cross += r.crossBenchVotes;
  }
  return { pass: attempted ? passed / attempted : 0, cross: cross / SEEDS };
}

const MIXED = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const ONE_SEAT = ['Horsetrader', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const ALL_HORSETRADERS = ['Horsetrader', 'Horsetrader', 'Horsetrader', 'Horsetrader'];

export const finding: Finding = {
  id: 'vp-horsetrading-changes-passage',
  dependsOn: [],
  question:
    "hf7y/american-cycle#37: `vote-trading-changes-passage.ts` measured `Dealmaker`'s post-hoc bill ledger "
    + "moving passage; DECISIONS.md's untestable-by-simulation list still named a second, separate plank -- "
    + '"VP horse-trading during the nomination" -- untouched by that ledger because it prices a different '
    + "channel, the ticket (`GameView.vicePresident`), not the vote. `Horsetrader` reads both, and its "
    + '`voteBill` can only ever ADD a yes on top of `Base`\'s own fit-based default, never withhold one. Does '
    + 'seating it -- one seat, then every seat, on the same four-seat table and packs `vote-trading-changes-'
    + "passage.ts` used -- move passage the same way the bill-only ledger did?",

  headline:
    "IT DOESN'T MOVE PASSAGE UP -- EVERY SEAT MOVES IT DOWN, AND CROSS-BENCH VOTES FALL TOO. One seat barely "
    + "moves either number (52.4% -> 52.0% bills passing, 17.5 -> 18.0 cross-bench votes a game, both inside "
    + "noise), the same shallow read `vote-trading-changes-passage.ts` got from one `Dealmaker` seat. But "
    + "seating all four `Horsetrader` drops passage to 46.0%, not up like an all-`Dealmaker` table -- and cross-"
    + 'bench votes fall with it, 17.5 -> 14.1, rather than staying flat while a substituted favour buys back the '
    + "difference. `voteBill` here can only add yes votes, never remove one, so the ledger itself is not "
    + "voting bills down; the fall tracks the OTHER three agents in the mixed table (Lookahead, SenateFlood, "
    + "HeterodoxSpecialist) getting swapped out along with them -- an all-`Horsetrader` table is a different "
    + "authorship/declare mix, not a clean one-variable test of the VP channel the way `vote-trading-changes-"
    + 'passage.ts`\'s own all-`Dealmaker` comparison warned it already was. VP horse-trading is agent-reachable '
    + 'now; it is not shown to be a passage lever the bill ledger already is.',
  stampedAt: '2026-09-17T11:00:00Z',
  stampedOn: '988f38c',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(['1976', '1992', '2008', '2016']);
    const mixed = measure(MIXED, cards, cfg);
    const oneSeat = measure(ONE_SEAT, cards, cfg);
    const allHorsetraders = measure(ALL_HORSETRADERS, cards, cfg);
    return [
      { name: 'mixed table (no Horsetrader): bills pass', value: mixed.pass, stamped: 0.524, tolerance: 0.08, unit: 'share of attempts' },
      { name: 'mixed table: cross-bench votes a game', value: mixed.cross, stamped: 17.5, tolerance: 6 },
      { name: 'one Horsetrader seat: bills pass', value: oneSeat.pass, stamped: 0.520, tolerance: 0.08, unit: 'share of attempts' },
      { name: 'one Horsetrader seat: cross-bench votes a game', value: oneSeat.cross, stamped: 18.0, tolerance: 6 },
      { name: 'every seat Horsetrader: bills pass', value: allHorsetraders.pass, stamped: 0.460, tolerance: 0.08, unit: 'share of attempts' },
      { name: 'every seat Horsetrader: cross-bench votes a game', value: allHorsetraders.cross, stamped: 14.1, tolerance: 6 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const pp = (x: number) => `${(100 * x).toFixed(1)}%`;
    const passDelta = v('every seat Horsetrader: bills pass') - v('mixed table (no Horsetrader): bills pass');
    const crossDelta = v('every seat Horsetrader: cross-bench votes a game') - v('mixed table: cross-bench votes a game');
    return [
      `passage: ${pp(v('mixed table (no Horsetrader): bills pass'))} baseline, `
        + `${pp(v('one Horsetrader seat: bills pass'))} one seat, ${pp(v('every seat Horsetrader: bills pass'))} every seat`,
      `cross-bench votes a game: ${v('mixed table: cross-bench votes a game').toFixed(1)} baseline, `
        + `${v('one Horsetrader seat: cross-bench votes a game').toFixed(1)} one seat, `
        + `${v('every seat Horsetrader: cross-bench votes a game').toFixed(1)} every seat`,
      Math.abs(passDelta) <= 0.05
        ? 'seating Horsetrader does not move passage at this table size'
        : `an all-Horsetrader table moves passage ${passDelta > 0 ? 'up' : 'down'} `
          + `${pp(Math.abs(passDelta))} against this mixed baseline, with cross-bench votes moving `
          + `${crossDelta > 0 ? 'up' : 'down'} too -- not the substitution shape the bill-only ledger showed`,
    ].join('; ');
  },
};
