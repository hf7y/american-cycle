import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const SEEDS = sample(120);

/** Same methodology as `vote-trading-changes-passage.ts`'s own `measure`. */
function measure(agents: string[], cards: Card[], cfg: Config) {
  let passed = 0, attempted = 0, cross = 0;
  for (let i = 0; i < SEEDS; i++) {
    const r = playOne(agents, cards, cfg, 1050400 + i);
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
    "hf7y/american-cycle#37: `Horsetrader` prices the VP slot on the same debt `Dealmaker` already tracks on the "
    + 'bill ledger -- does seating it, one seat then every seat, on the exact table '
    + '`vote-trading-changes-passage.ts` used for `Dealmaker`, move passage and cross-bench volume the same '
    + 'direction a second reciprocity channel would predict, or does spending a card on a ticket instead of a '
    + 'declared race cut the other way?',

  headline:
    'IT CUTS THE OTHER WAY AT SCALE. Same four-seat table and pack list `vote-trading-changes-passage.ts` used '
    + "(that finding's own baseline has since drifted from Dealmaker's stamped 41.8% to 46.8% here -- #105 landed "
    + "generalLoserReturns on by default between the two runs, which is this repo's own STALE-is-information "
    + 'convention working as intended, not a discrepancy). One `Horsetrader` seat barely moves it, 46.8% -> 47.5%, '
    + 'inside noise, the same shape one `Dealmaker` seat showed. Seating all four does NOT repeat '
    + "Dealmaker's every-seat gain: passage FALLS to 41.6% and cross-bench volume falls with it, 16.8 -> 15.0. The "
    + 'mechanism is not the same shape -- `offerVP` spends a real candidate card out of the offering hand onto a '
    + "rival's ticket, so a table that trades VP slots on top of votes is a table with fewer of its own candidates "
    + 'left to declare into House and Senate races that could have authored or voted a bill, and that supply cost '
    + "outweighs the extra yes-votes the same ledger buys. `Dealmaker`'s ledger was free to run on top of ordinary "
    + "declaring; `Horsetrader`'s second channel is not.",
  stampedAt: '2026-09-16T07:00:00Z',
  stampedOn: '45897fe',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(['1976', '1992', '2008', '2016']);
    const mixed = measure(MIXED, cards, cfg);
    const oneSeat = measure(ONE_SEAT, cards, cfg);
    const allHorsetraders = measure(ALL_HORSETRADERS, cards, cfg);
    return [
      { name: 'mixed table (no Horsetrader): bills pass', value: mixed.pass, stamped: 0.468, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'mixed table: cross-bench votes a game', value: mixed.cross, stamped: 16.8, tolerance: 6 },
      { name: 'one Horsetrader seat: bills pass', value: oneSeat.pass, stamped: 0.475, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'one Horsetrader seat: cross-bench votes a game', value: oneSeat.cross, stamped: 17.0, tolerance: 6 },
      { name: 'every seat Horsetrader: bills pass', value: allHorsetraders.pass, stamped: 0.416, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'every seat Horsetrader: cross-bench votes a game', value: allHorsetraders.cross, stamped: 15.0, tolerance: 6 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const pp = (x: number) => `${(100 * x).toFixed(1)}%`;
    const baseline = v('mixed table (no Horsetrader): bills pass');
    const every = v('every seat Horsetrader: bills pass');
    const passFell = every < baseline - 0.02;
    const crossFell = v('every seat Horsetrader: cross-bench votes a game') < v('mixed table: cross-bench votes a game');
    return [
      `passage: ${pp(baseline)} baseline, ${pp(v('one Horsetrader seat: bills pass'))} one seat, ${pp(every)} every seat`,
      `cross-bench votes a game: ${v('mixed table: cross-bench votes a game').toFixed(1)} baseline, `
        + `${v('one Horsetrader seat: cross-bench votes a game').toFixed(1)} one seat, `
        + `${v('every seat Horsetrader: cross-bench votes a game').toFixed(1)} every seat`,
      passFell
        ? (crossFell
          ? "a table that trades tickets passes FEWER bills on fewer cross-bench votes -- spending candidate cards on VP offers costs more declared seats than the ledger's extra yes-votes buy back"
          : 'a table that trades tickets passes fewer bills despite cross-bench volume not falling')
        : 'seating Horsetrader does not move passage at this table size',
      "not the same shape Dealmaker's own finding measured -- the VP channel is not free the way a post-hoc bill-vote ledger is",
    ].join('; ');
  },
};
