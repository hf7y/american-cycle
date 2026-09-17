import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const SEEDS = sample(120);

/** Same methodology as `vote-trading-changes-passage.ts`'s own `measure`,
 *  same seed base and agent-list shape, so the two are directly comparable:
 *  one seat then every seat, on the same four-seat table. */
function measure(agents: string[], cards: Card[], cfg: Config) {
  let passed = 0, attempted = 0, cross = 0;
  for (let i = 0; i < SEEDS; i++) {
    const r = playOne(agents, cards, cfg, 1050400 + i);
    passed += r.billsPassed; attempted += r.billsAttempted; cross += r.crossBenchVotes;
  }
  return { pass: attempted ? passed / attempted : 0, cross: cross / SEEDS };
}

const MIXED = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const ONE_SEAT = ['Bandwagon', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const ALL_BANDWAGON = ['Bandwagon', 'Bandwagon', 'Bandwagon', 'Bandwagon'];

export const finding: Finding = {
  id: 'bandwagon-momentum-changes-passage',
  dependsOn: [],
  question:
    "hf7y/american-cycle#37: `vote-trading-changes-passage.ts` measured `Dealmaker`'s cross-YEAR favour ledger "
    + "against the same table this finding uses. `Bandwagon` (#263/#272's roll call) is a different channel -- "
    + 'real-time same-party momentum WITHIN one roll, not a ledger settled after the fact -- and can push a vote '
    + "either direction, not only toward yes. Does seating it -- one seat, then every seat, on the exact table "
    + "vote-trading-changes-passage.ts used -- move passage the way herd behaviour would predict, and does it "
    + 'change cross-bench volume the same way a favour ledger did (crossings falling, substituted by the ledger) '
    + 'or a different way?',

  headline:
    'PASSAGE RISES LIKE DEALMAKER; CROSS-BENCH VOTES RISE TOO, THE OPPOSITE OF DEALMAKER. On the same four-seat '
    + 'table and pack list `vote-trading-changes-passage.ts` used (passage there has since drifted further -- this '
    + 'run reads 46.8% on the current engine, itself already off that finding\'s 41.8%-54.5% span, so read this '
    + "headline's shape rather than its absolute levels against that finding), one `Bandwagon` seat moves passage "
    + '46.8% -> 51.3% and cross-bench votes a game 16.8 -> 19.8, both up together. Seating all four moves passage '
    + 'further to 55.2%, with cross-bench holding elevated at 18.6 rather than falling back toward baseline. '
    + "Dealmaker's mechanism SUBSTITUTES a repaid favour for a raw ideological crossing (cross-bench fell as "
    + "passage rose); Bandwagon's does the opposite -- it AMPLIFIES whichever way a chamber's party bloc is "
    + 'already breaking, which raises passage by turning marginal fence-sitters into pile-on crossings rather than '
    + 'by replacing them with a settled debt. Two mechanisms that both make DECISIONS.md\'s "negotiation before '
    + 'the bill vote" gap agent-reachable move the same headline number in opposite directions on the metric that '
    + 'was supposed to distinguish trading from crossing -- cross-bench volume alone does not tell them apart.',
  stampedAt: '2026-09-17T10:45:00Z',
  stampedOn: '988f38c',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(['1976', '1992', '2008', '2016']);
    const mixed = measure(MIXED, cards, cfg);
    const oneSeat = measure(ONE_SEAT, cards, cfg);
    const allBandwagon = measure(ALL_BANDWAGON, cards, cfg);
    return [
      { name: 'mixed table (no Bandwagon): bills pass', value: mixed.pass, stamped: 0.468, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'mixed table: cross-bench votes a game', value: mixed.cross, stamped: 16.8, tolerance: 6 },
      { name: 'one Bandwagon seat: bills pass', value: oneSeat.pass, stamped: 0.513, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'one Bandwagon seat: cross-bench votes a game', value: oneSeat.cross, stamped: 19.8, tolerance: 6 },
      { name: 'every seat Bandwagon: bills pass', value: allBandwagon.pass, stamped: 0.552, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'every seat Bandwagon: cross-bench votes a game', value: allBandwagon.cross, stamped: 18.6, tolerance: 6 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const pp = (x: number) => `${(100 * x).toFixed(1)}%`;
    const passMoved = Math.abs(v('every seat Bandwagon: bills pass') - v('mixed table (no Bandwagon): bills pass')) > 0.05;
    const crossRose = v('every seat Bandwagon: cross-bench votes a game') > v('mixed table: cross-bench votes a game');
    return [
      `passage: ${pp(v('mixed table (no Bandwagon): bills pass'))} baseline, `
        + `${pp(v('one Bandwagon seat: bills pass'))} one seat, ${pp(v('every seat Bandwagon: bills pass'))} every seat`,
      `cross-bench votes a game: ${v('mixed table: cross-bench votes a game').toFixed(1)} baseline, `
        + `${v('one Bandwagon seat: cross-bench votes a game').toFixed(1)} one seat, `
        + `${v('every seat Bandwagon: cross-bench votes a game').toFixed(1)} every seat`,
      passMoved
        ? (crossRose
          ? 'a table with momentum passes more bills on MORE raw cross-bench votes -- amplification, not substitution'
          : 'a table with momentum passes more bills on fewer cross-bench votes -- reads like substitution instead, unlike this headline\'s stamp')
        : 'seating Bandwagon does not move passage at this table size',
    ].join('; ');
  },
};
