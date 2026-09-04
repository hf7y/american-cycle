import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** The passive pool #145 measured against: nobody here is chasing bills, so
 *  the amendment (or the year cap) has to close the game on its own. */
const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const SEEDS = Array.from({ length: sample(120) }, (_, i) => 1050400 + i);

export const finding: Finding = {
  id: 'amendment-is-the-ending',
  dependsOn: ['as-written-plus.json'],
  question:
    'hf7y/american-cycle#145 ruled: scoring stays points (as v0.2 already reads the board), bills stop '
    + 'being a count to a target and become points among other points via `scoring.billOnBooks`, and the '
    + 'amendment is the ending. That reverses `as-written-plus.json`\'s prior `victory: \'bills\'` wiring. '
    + 'Before the ruling can move from "recorded" to "settled" in DECISIONS.md, #145 named one thing to '
    + 'check first: does the game still reliably terminate on a pool that is not chasing the amendment, or '
    + 'does removing the bill-count target just trade one runaway clock for an unbounded one?',

  headline:
    'It terminates, and the amendment is doing real work: on the passive pool at maxYears:100, the '
    + 'amendment ends the game outright in a plurality of runs, deck-out essentially never fires (the talon '
    + 'regrows from circulation faster than it empties, exactly as the no-cap amendment already found), and '
    + 'the 100-year cap remains a real backstop rather than a formality -- a meaningful share of games still '
    + 'hit it. No game reported `endedBy: \'bills\'`, confirming the old target is gone, not just unreachable.',
  stampedAt: '2026-09-04T04:15:53Z',
  stampedOn: '87449f6',

  predicate(): Claim[] {
    const cfg = loadConfig('as-written-plus.json');
    const cards = loadPacks(['1976', '1992', '2008', '2016']);
    let amendment = 0, deckOut = 0, ranOutOfYears = 0, oldBillTarget = 0;
    for (const seed of SEEDS) {
      const r = playOne(AGENTS, cards, cfg, seed);
      if (r.endedBy === 'amendment') amendment++;
      else if (r.endedBy === 'deckOut') deckOut++;
      else if (r.endedBy === undefined) ranOutOfYears++;
      else oldBillTarget++;
    }
    const n = SEEDS.length;
    return [
      { name: 'as-written-plus.json ships amendment as the ending', value: cfg.game.victory === 'amendment' ? 1 : 0, stamped: 1, tolerance: 0 },
      { name: 'passive pool: games ended by amendment ratification', value: amendment / n, stamped: 0.57, tolerance: 0.12, unit: 'share' },
      { name: 'passive pool: games ended by deck-out', value: deckOut / n, stamped: 0, tolerance: 0.03, unit: 'share' },
      { name: 'passive pool: games that ran out the 100-year cap', value: ranOutOfYears / n, stamped: 0.42, tolerance: 0.12, unit: 'share' },
      { name: 'passive pool: games ended by the old bill target', value: oldBillTarget / n, stamped: 0, tolerance: 0, unit: 'share' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const amendment = v('passive pool: games ended by amendment');
    const deckOut = v('passive pool: games ended by deck-out');
    const ranOut = v('passive pool: games that ran out');
    const oldTarget = v('passive pool: games ended by the old bill target');
    return [
      `amendment ends ${(amendment * 100).toFixed(0)}% of games`,
      deckOut < 0.05 ? 'deck-out essentially never fires, matching the no-cap amendment' : `deck-out fires in ${(deckOut * 100).toFixed(0)}%, more than expected`,
      `the 100-year cap still binds ${(ranOut * 100).toFixed(0)}% of the time, so it remains a real backstop, not a formality`,
      oldTarget === 0 ? 'and no game ends on the retired bill target' : `and ${(oldTarget * 100).toFixed(0)}% still end on the retired bill target -- the config change did not take`,
    ].join('; ');
  },
};
