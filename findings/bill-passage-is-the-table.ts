import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';
import type { Claim, Finding } from './types.ts';

const SEEDS = 120;

/** Passage rate and cross-bench volume for one table at one threshold. */
function measure(agents: string[], senatePassage: number, cards: Card[], base: Config) {
  const cfg: Config = { ...base, legislature: { ...base.legislature, senatePassage } };
  let passed = 0, attempted = 0, cross = 0;
  for (let i = 0; i < SEEDS; i++) {
    const r = playOne(agents, cards, cfg, 1040400 + i);
    passed += r.billsPassed; attempted += r.billsAttempted; cross += r.crossBenchVotes;
  }
  return { pass: attempted ? passed / attempted : 0, cross: cross / SEEDS };
}

const MIXED = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const WILLING = ['BillMaximizer', 'SenateFlood', 'Greedy', 'HeterodoxSpecialist'];
const ALL_IN = ['BillMaximizer', 'BillMaximizer', 'BillMaximizer', 'BillMaximizer'];

export const finding: Finding = {
  id: 'bill-passage-is-the-table',
  dependsOn: [],
  question:
    'Does the 60% Senate threshold stall the omnibill? §12 says the filibuster "means bills '
    + 'essentially cannot pass without cross-benching, which makes cooperation structurally '
    + 'necessary rather than optional." (§7, §12)',

  headline:
    'The threshold is not what sets passage — the table is. Holding senatePassage at 0.6 and '
    + 'changing only who is playing moves passage from 12% to 100%, an 88-point range, while '
    + 'sweeping the threshold 50/60/67 at a fixed table moves it 41% to 2%, a 39-point range. The '
    + 'wider lever is the players. Passage tracks cross-benching directly: 57 cross-bench votes a '
    + 'game at 12% passage, 346 at 100%. That is §12 working as written, not failing — the '
    + 'filibuster makes the bill depend on whether anyone will cross the aisle. Any passage figure '
    + 'quoted from this simulator is a property of its agent pool, because no agent here can '
    + 'negotiate, offer anything or remember a favour. Do not tune the threshold on it.',
  stampedAt: '2026-08-31T12:00:00Z',
  stampedOn: 'phase1-engine',

  predicate(): Claim[] {
    const base = loadConfig('tuned.json');
    const cards = loadPacks(['1976', '1992', '2008', '2016']);
    // three tables, one threshold
    const mixed = measure(MIXED, 0.6, cards, base);
    const willing = measure(WILLING, 0.6, cards, base);
    const allIn = measure(ALL_IN, 0.6, cards, base);
    // one table, three thresholds — `mixed` is this sweep's 0.6 row
    const cloture50 = measure(MIXED, 0.5, cards, base);
    const cloture67 = measure(MIXED, 2 / 3, cards, base);
    return [
      { name: 'mixed table at 60%: bills pass', value: mixed.pass, stamped: 0.12, tolerance: 0.07, unit: 'share of attempts' },
      { name: 'one BillMaximizer at 60%: bills pass', value: willing.pass, stamped: 0.67, tolerance: 0.12, unit: 'share of attempts' },
      { name: 'four BillMaximizers at 60%: bills pass', value: allIn.pass, stamped: 1, tolerance: 0.06, unit: 'share of attempts' },
      { name: 'mixed table at 50%: bills pass', value: cloture50.pass, stamped: 0.41, tolerance: 0.1, unit: 'share of attempts' },
      { name: 'mixed table at 67%: bills pass', value: cloture67.pass, stamped: 0.02, tolerance: 0.06, unit: 'share of attempts' },
      { name: 'mixed table: cross-bench votes a game', value: mixed.cross, stamped: 57.44, tolerance: 18 },
      { name: 'four BillMaximizers: cross-bench votes a game', value: allIn.cross, stamped: 346.28, tolerance: 60 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const table = [v('mixed table at 60%'), v('one BillMaximizer at 60%'), v('four BillMaximizers at 60%')];
    const threshold = [v('mixed table at 50%'), v('mixed table at 60%'), v('mixed table at 67%')];
    const tableRange = Math.max(...table) - Math.min(...table);
    const thresholdRange = Math.max(...threshold) - Math.min(...threshold);
    const pp = (x: number) => `${(100 * x).toFixed(0)}pp`;
    return [
      `changing the table moves passage ${pp(tableRange)}, the threshold ${pp(thresholdRange)}`,
      tableRange > thresholdRange
        ? 'so passage is set by who is at the table, not by the filibuster'
        : 'so the filibuster threshold is the larger lever after all',
      v('four BillMaximizers: cross-bench') > 2 * v('mixed table: cross-bench')
        ? 'and it runs on cross-benching, exactly as §12 intends'
        : 'and cross-benching does not track it',
    ].join('; ');
  },
};
