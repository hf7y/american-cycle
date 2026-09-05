import { loadConfig, loadPacks, playOne, ALL_PACKS, BALANCE_PACKS } from '../sim/harness.ts';
import { runawayMetrics } from '../sim/roundrobin.ts';
import { deckSensitivity } from '../tracks/types.ts';
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
    + 'players ganging up. Verify those are sufficient.',

  headline:
    'DIAGNOSED, ACTED ON, THEN A NEW LOOP ARRIVED. At v0.1.2 the determination point sat at 44% of game '
    + "length against SIM-BRIEF's healthy 75-85%, and none of the three named loops was the cause: switching "
    + 'off endorsements, capture or the office hand bonuses each left it at 50%. The cause was that 100% of '
    + 'player-score series never decreased. v0.2 removed the accumulator instead: score is a pure function of '
    + 'the board, so anything repealed, reversed or unseated scores zero and a score CAN fall — monotone share '
    + 'went 1.00 -> 0.02 and determination 0.44 -> 0.63. Still short of the band, and hf7y/american-cycle#180 '
    + 'then shipped a per-office incumbency bonus (House +4 pips) that made it worse: determination is now '
    + '0.625, and the three original ablations no longer explain anything — endorsements off, capture off and '
    + 'hand bonuses off all land on the SAME 0.625, because incumbency now swamps all three. Switching '
    + 'incumbency off instead, holding everything else fixed, moves determination to 0.875 — PAST the '
    + "band's 85% top, not into it. Incumbency is now the dominant lever on this number, in either "
    + 'direction, but not a calibrated one: on, the leader locks in too early; off, the game never really '
    + 'settles. The leader-lock-in the baseline shows is currently coming from incumbency, a fourth stacking '
    + 'advantage this finding did not originally name, not from the three it was written to test. The '
    + 'exogenous shock built for v0.2 item 9 still does not close the gap on its own (0.625 with it, 0.625 '
    + 'without). Checked against hf7y/american-cycle#91: this determination figure held stable at 62.5% on '
    + "both the shipped all-seven-era pack and the four-era subset several balance scripts use — so #91's own "
    + "table (which found determination the most deck-sensitive stamped claim in the suite) does not describe "
    + 'this specific measurement on the current engine; it may have been specific to the pre-#180 config or a '
    + 'different agent set. tracks/c.ts C7 is the live acceptance test and is red.',
  stampedAt: '2026-09-05T09:40:00Z',
  stampedOn: '2ac936b',

  predicate(): Claim[] {
    const base = loadConfig('tuned.json');
    const cards = loadPacks(BALANCE_PACKS);
    const cardsAll = loadPacks(ALL_PACKS);
    // The three ORIGINAL suspect loops, isolated one at a time.
    const noEndorsements: Config = { ...base, endorsements: { ...base.endorsements, president: 0, governorInState: 0 } };
    const noCapture: Config = { ...base, game: { ...base.game, captureEnabled: false } };
    const noHandBonus: Config = {
      ...base,
      hand: { ...base.hand, bonusPresident: 0, bonusSenator: 0, bonusGovernor: 0, bonusRepresentative: 0 },
    };
    // A FOURTH, added by hf7y/american-cycle#180 after this finding was
    // first stamped: the per-office incumbency magnitudes it shipped.
    const noIncumbency: Config = {
      ...base,
      resolution: { ...base.resolution, incumbency: 0, incumbencyHouse: 0, incumbencySenate: 0, incumbencyPrimary: 0 },
    };
    const run = (cfg: Config, deck: Card[] = cards) => runawayMetrics(SEEDS, AGENTS, deck, cfg);
    const on = run(base);
    return [
      { name: 'baseline: determination point', value: on.determination, stamped: 0.63, tolerance: 0.2, unit: 'fraction of game length' },
      { name: 'baseline: comeback rate', value: on.comeback, stamped: 0.03, tolerance: 0.04, unit: 'share of games' },
      { name: 'baseline: player-scores that never decrease', value: monotonicShare(cards, base), stamped: 0, tolerance: 0.02, unit: 'share of series' },
      // hf7y/american-cycle#91: is the baseline determination point itself a
      // property of which era-pack list ran it, same config and seeds, four
      // packs (354 cards) against all seven (604)?
      { name: 'ALL_PACKS: baseline determination point', value: run(base, cardsAll).determination, stamped: 0.63, tolerance: 0.2, unit: 'fraction of game length' },
      { name: 'endorsements off: determination point', value: run(noEndorsements).determination, stamped: 0.63, tolerance: 0.2, unit: 'fraction of game length' },
      { name: 'capture off: determination point', value: run(noCapture).determination, stamped: 0.63, tolerance: 0.2, unit: 'fraction of game length' },
      { name: 'hand bonuses off: determination point', value: run(noHandBonus).determination, stamped: 0.63, tolerance: 0.2, unit: 'fraction of game length' },
      { name: 'incumbency off: determination point', value: run(noIncumbency).determination, stamped: 0.88, tolerance: 0.2, unit: 'fraction of game length' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    // SIM-BRIEF: healthy is 75-85% of the way through. Below is a runaway
    // (locked in early); above is a coin-flip that never settles (locked in
    // too late to have been a real contest at all) — both fail the bar, and
    // are not the same failure, so this reads all three bands rather than
    // just the lower one the original two-state check used.
    const HEALTHY_LOW = 0.75, HEALTHY_HIGH = 0.85;
    const bandOf = (x: number): 'early' | 'healthy' | 'late' =>
      x < HEALTHY_LOW ? 'early' : x > HEALTHY_HIGH ? 'late' : 'healthy';
    const baseBand = bandOf(v('baseline: determination'));
    const original = ['endorsements off', 'capture off', 'hand bonuses off'].map(v);
    const noneOfOriginalBrakes = original.every((x) => bandOf(x) !== 'healthy');
    const monotonic = v('baseline: player-scores') >= 0.99;
    const incumbencyBand = bandOf(v('incumbency off: determination'));
    const deck = deckSensitivity([
      { pool: 'four-pack', value: v('baseline: determination') },
      { pool: 'all-seven', value: v('ALL_PACKS: baseline determination') },
    ]);
    return [
      baseBand === 'healthy'
        ? 'determination sits inside the healthy 75-85% band'
        : `the leader is settled at ${(100 * v('baseline: determination')).toFixed(0)}% of game length, `
          + `${baseBand === 'early' ? 'below' : 'above'} the healthy 75-85%`,
      noneOfOriginalBrakes
        ? 'and none of the three original feedback loops is the cause — switching each off leaves it outside the band'
        : 'and switching one of the three original feedback loops off restores a healthy determination point',
      monotonic
        ? 'because no score can ever fall: the brake would have to be the table'
        : 'and scores can now fall, so a mechanical brake exists',
      incumbencyBand === 'healthy'
        ? `but incumbency (hf7y/american-cycle#180) is the cause the original three no longer are — switching it off alone `
          + `moves determination to ${(100 * v('incumbency off: determination')).toFixed(0)}%, inside the band`
        : incumbencyBand === 'late'
          ? `but incumbency (hf7y/american-cycle#180) is doing real work — switching it off alone overshoots PAST the band, `
            + `to ${(100 * v('incumbency off: determination')).toFixed(0)}%, so it is now the dominant lever on this number, just not a calibrated one`
          : 'and incumbency is not the cause either — switching it off still leaves determination below the band',
      deck.sensitive
        ? `and determination is itself deck-sensitive (hf7y/american-cycle#91): `
          + `${(100 * deck.byPool['four-pack']).toFixed(0)}% on the four-pack vs ${(100 * deck.byPool['all-seven']).toFixed(0)}% on all seven, `
          + `a ${(100 * deck.maxRelativeDeviation).toFixed(0)}% relative swing on the same config, agents and seeds`
        : 'and determination held stable between the four-pack and all-seven decks (hf7y/american-cycle#91), '
          + 'so this headline is not a property of which pack list ran it',
    ].join('; ');
  },
};
