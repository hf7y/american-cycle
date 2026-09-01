import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import { runawayMetrics } from '../sim/roundrobin.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
/** SIM-BRIEF's determination point is the first year the current leader is the
 *  eventual winner in more than 80% of games, as a fraction of game length. On
 *  a 16-year game that quantises to 1/16, and across six independent 120-game
 *  seed blocks it moved between 0.50 and 0.63 with the engine held still. The
 *  tolerances below are +/-0.2 — three years — which is wider than that jitter
 *  and still narrower than the gap to the healthy band. */
const SEEDS = Array.from({ length: sample(120) }, (_, i) => 1030400 + i);

/** Share of player-score series that never fall over a whole game.
 *
 *  This is the load-bearing measurement. A brake on a leader has to be able to
 *  take points away, or reduce the rate at which they arrive below the field's.
 *  If every score is monotonic and accrual is roughly steady, a player ahead at
 *  the midpoint cannot be caught, and the early determination point is not
 *  evidence of a feedback loop at all -- it is what monotonic scoring looks
 *  like.
 */
function monotonicShare(cards: Card[], cfg: Config): number {
  let series = 0, never = 0;
  for (const seed of SEEDS) {
    const h = playOne(AGENTS, cards, cfg, seed).scoreHistory;
    for (let p = 0; p < (h[0]?.length ?? 0); p++) {
      series++;
      let fell = false;
      for (let y = 1; y < h.length; y++) if (h[y][p] < h[y - 1][p]) { fell = true; break; }
      if (!fell) never++;
    }
  }
  return series ? never / series : 0;
}

export const finding: Finding = {
  id: 'runaway-no-brake',
  dependsOn: [],
  question:
    'Whether the leader runs away. Hand size, endorsements and capture are three stacking '
    + 'positive-feedback loops; the intended brakes are the midterm penalty, recession and other '
    + 'players ganging up. Verify those are sufficient. (§16)',

  headline:
    'There is no mechanical brake. The determination point sits at 44% of game length against '
    + "SIM-BRIEF's healthy 75-85%, and the comeback rate is 1%. But the three named loops are not "
    + 'the cause: switching off endorsements, capture or the office hand bonuses each leaves '
    + 'determination at 50%, still far below the healthy band and no better than leaving them on. '
    + 'The cause is that 100% of player-score series never decrease. Nothing in the design can take '
    + 'a point away, so a leader at the midpoint cannot be caught by anyone accruing at a similar '
    + 'rate — and the only brake left is the one this simulator cannot test, which is the table '
    + 'ganging up. Recommend a human playtest before adding any catch-up mechanic.',
  stampedAt: '2026-08-31T12:00:00Z',
  stampedOn: 'f0bbaca',

  predicate(): Claim[] {
    const base = loadConfig('tuned.json');
    const cards = loadPacks(['1976', '1992', '2008', '2016']);
    // §16's three suspects, isolated one at a time.
    const noEndorsements: Config = { ...base, endorsements: { ...base.endorsements, president: 0, governorInState: 0 } };
    const noCapture: Config = { ...base, game: { ...base.game, captureEnabled: false } };
    const noHandBonus: Config = {
      ...base,
      hand: { ...base.hand, bonusPresident: 0, bonusSenator: 0, bonusGovernor: 0, bonusRepresentative: 0 },
    };
    const run = (cfg: Config) => runawayMetrics(SEEDS, AGENTS, cards, cfg);
    const on = run(base);
    return [
      { name: 'baseline: determination point', value: on.determination, stamped: 0.44, tolerance: 0.2, unit: 'fraction of game length' },
      { name: 'baseline: comeback rate', value: on.comeback, stamped: 0.01, tolerance: 0.03, unit: 'share of games' },
      { name: 'baseline: player-scores that never decrease', value: monotonicShare(cards, base), stamped: 1, tolerance: 0.02, unit: 'share of series' },
      { name: 'endorsements off: determination point', value: run(noEndorsements).determination, stamped: 0.5, tolerance: 0.2, unit: 'fraction of game length' },
      { name: 'capture off: determination point', value: run(noCapture).determination, stamped: 0.5, tolerance: 0.2, unit: 'fraction of game length' },
      { name: 'hand bonuses off: determination point', value: run(noHandBonus).determination, stamped: 0.5, tolerance: 0.2, unit: 'fraction of game length' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    // SIM-BRIEF §2: healthy is 75-85% of the way through.
    const HEALTHY = 0.75;
    const early = v('baseline: determination') < HEALTHY;
    const switches = ['endorsements off', 'capture off', 'hand bonuses off'].map(v);
    const noneBrakes = switches.every((x) => x < HEALTHY);
    const monotonic = v('baseline: player-scores') >= 0.99;
    return [
      early
        ? `the leader is settled at ${(100 * v('baseline: determination')).toFixed(0)}% of game length, below the healthy 75-85%`
        : 'determination sits inside the healthy 75-85% band',
      noneBrakes
        ? 'and none of §16\'s three loops is the cause — switching each off leaves it below the band'
        : 'and switching one of §16\'s three loops off restores a healthy determination point',
      monotonic
        ? 'because no score can ever fall: the brake would have to be the table'
        : 'and scores can now fall, so a mechanical brake exists',
    ].join('; ');
  },
};
