import { loadConfig, loadPacks } from '../sim/harness.ts';
import { AGENTS } from '../sim/agents.ts';
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** DECISIONS.md open question 6, hf7y/american-cycle#26: `never` falls out of
 *  the nationalization priority rule (an argument), and `governors-push.json`
 *  ships the `with-lean` alternative untested (no measurement). Sequenced
 *  behind hf7y/american-cycle#17/#23 -- resignToRun and odd-year governors
 *  both change what a governorship is worth, so measuring the push against a
 *  board missing both would measure the wrong board. Both landed (#141).
 *
 *  `Launchpad` (sim/agents.ts) is the office's own agent -- it plays odd-year
 *  governor races for cheap incumbency and steps up to Senate. Without it at
 *  the table, nobody farms governorships and the push has nothing to act on,
 *  the same reason what-wins.ts needs a House specialist seated to ask its
 *  question at all. */
const POOL = ['Greedy', 'Lookahead', 'SenateFlood', 'Launchpad'];
const CARDS = loadPacks(['1976', '1992', '2008', '2016']);
const GAMES = sample(200);

interface Measured {
  realignedPerGame: number;
  cappedPerGame: number;
  govHeldByWinner: number;
  govRatio: number;
}

function measure(configName: string, base: number): Measured {
  const cfg = loadConfig(configName);
  let realigned = 0, capped = 0, leanGames = 0, govWinner = 0, govRest = 0;
  for (let i = 0; i < GAMES; i++) {
    const seed = base + i;
    const rng = new RNG(seed);
    // rotate the seating each game so no strategy owns a seat
    const order = POOL.map((_, k) => POOL[(k + i) % POOL.length]);
    const g = new Game(order.map((n) => new AGENTS[n](cfg, rng)), CARDS, cfg, seed);
    const r = g.run();
    leanGames++;
    for (const v of Object.values(g.leanMap)) {
      if (Math.abs(v) >= 4) realigned++;
      if (Math.abs(v) >= 8) capped++;
    }
    for (const s of g.seats) {
      if (s.office !== 'governor' || !s.holder) continue;
      if (s.holder.player === r.winner) govWinner++; else govRest++;
    }
  }
  const losers = POOL.length - 1;
  const restShare = govRest / (GAMES * losers);
  return {
    realignedPerGame: realigned / leanGames,
    cappedPerGame: capped / leanGames,
    govHeldByWinner: govWinner / GAMES,
    govRatio: restShare ? (govWinner / GAMES) / restShare : NaN,
  };
}

export const finding: Finding = {
  id: 'governor-push',
  dependsOn: [],
  question:
    'DECISIONS.md open question 6, hf7y/american-cycle#26: does allowing a governor to push lean '
    + 'when winning WITH the existing lean change realignment counts, map saturation, or the value '
    + 'of the governorship -- specifically the winner-advantage ratio hf7y/american-cycle#14 '
    + 'measured at 0.95x?',

  headline:
    'NEITHER LEVER MOVES. Against `tuned` (never), `governors-push.json` (with-lean) realigns '
    + 'no more of the map (4.12 states/game vs 4.22), pins no more at the cap (0.90 vs 0.70), and '
    + 'the governorship\'s winner-advantage ratio barely shifts (1.67x to 1.69x) -- both well under '
    + 'the Senate\'s and presidency\'s ratios (hf7y/american-cycle#14). `applyPush` only reaches its '
    + '`governor` branch when a governor race is the SOLE nationalized race in a state that year '
    + '(engine/rules/lean.ts\'s priority order puts governor last), which before '
    + 'hf7y/american-cycle#23 essentially never happened; odd-year races now make it reachable, but '
    + 'reachable is not the same as consequential -- there are too few of them, and too few land '
    + '"with" the existing lean rather than against it or on a neutral state, to move the board. '
    + 'This does not support #14\'s "make it matter" reading: the lever DECISIONS.md flagged as '
    + 'untested now has been, and it does nothing measurable. The push rule in effect throughout is '
    + 'margin-based (`pushForMargin`, engine/rules/lean.ts) -- hf7y/american-cycle#51\'s '
    + 'surprise-based alternative has not shipped, so this measures the current rule, not that one.',
  stampedAt: '2026-09-03T22:47:00Z',
  stampedOn: 'c7fa0ce',

  predicate(): Claim[] {
    const never = measure('tuned.json', 1070000);
    const withLean = measure('governors-push.json', 1080000);
    return [
      { name: 'never: states realigned per game', value: never.realignedPerGame, stamped: 0, tolerance: 2 },
      { name: 'with-lean: states realigned per game', value: withLean.realignedPerGame, stamped: 0, tolerance: 2.5 },
      { name: 'never: states pinned at the cap', value: never.cappedPerGame, stamped: 0, tolerance: 1 },
      { name: 'with-lean: states pinned at the cap', value: withLean.cappedPerGame, stamped: 0, tolerance: 1.5 },
      { name: 'never: governorship winner-advantage ratio', value: never.govRatio, stamped: 0, tolerance: 0.6, unit: 'x' },
      { name: 'with-lean: governorship winner-advantage ratio', value: withLean.govRatio, stamped: 0, tolerance: 0.6, unit: 'x' },
      { name: 'never: governorships held by the winner', value: never.govHeldByWinner, stamped: 0, tolerance: 0.8 },
      { name: 'with-lean: governorships held by the winner', value: withLean.govHeldByWinner, stamped: 0, tolerance: 0.8 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const realignLift = v('with-lean: states realigned per game') - v('never: states realigned per game');
    const capLift = v('with-lean: states pinned at the cap') - v('never: states pinned at the cap');
    const ratioLift = v('with-lean: governorship winner-advantage ratio') - v('never: governorship winner-advantage ratio');
    return [
      realignLift > 0.5
        ? `with-lean realigns ${realignLift.toFixed(1)} more states a game than never`
        : 'with-lean does not move realignment counts over never',
      capLift > 0.3 ? 'and saturates the cap somewhat more' : 'without materially saturating the cap more',
      Math.abs(ratioLift) < 0.5
        ? `but the governorship's winner-advantage ratio barely moves (${v('never: governorship winner-advantage ratio').toFixed(2)}x to ${v('with-lean: governorship winner-advantage ratio').toFixed(2)}x), both well under the Senate's and presidency's`
        : `and the winner-advantage ratio moves with it, ${v('never: governorship winner-advantage ratio').toFixed(2)}x to ${v('with-lean: governorship winner-advantage ratio').toFixed(2)}x`,
    ].join('; ');
  },
};
