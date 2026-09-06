/** hf7y/american-cycle#200: "mathematically eliminated" has no definition
 *  that survives contact with `engine/rules/scoring.ts`'s own header comment
 *  -- THERE IS NO ACCUMULATOR, so recapturing the whole board is always
 *  structurally possible until the clock runs out, and a guessed definition
 *  (remaining-ceiling vs. current leader, or a hand-picked pip threshold)
 *  would be exactly the kind of number this repo's `§N` rule warns against:
 *  a rule stated once and never re-derived.
 *
 *  So this measures instead of guessing. From a corpus of played games, take
 *  the single largest one-year score swing ANY player ever achieved
 *  (`maxSingleYearGain`) as the most generous possible one-year ceiling, and
 *  call a player ELIMINATED at year y if even that best-ever swing, repeated
 *  every remaining year, could not close the gap to the year-y leader. This
 *  is eliminated relative to observed play, not relative to a formal model of
 *  every scoring rule, but it is internally consistent by construction: no
 *  player in the same corpus can ever be flagged eliminated and then recover
 *  (a recovery would require a single-year gain bigger than the corpus max
 *  that defines the bound), so the sanity check is that no winner is ever
 *  flagged before their own last year.
 *
 *  node sim/elimination.ts [config] [games]
 */
import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from './harness.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';

export interface EliminationResult {
  maxSingleYearGain: number;
  playerYears: number;
  eliminatedPlayerYears: number;
  /** eliminated player-years that still went on to win -- should be 0; a
   *  positive count means the bound above is unsound, not that a comeback
   *  happened. */
  unsoundCount: number;
  /** of the games where SOMEONE was eliminated before the final year, how
   *  many years before the end elimination first fired, as a share of that
   *  game's length -- 0 means only the literal last year, matching option
   *  1's own conceded weakness in #200. */
  firstEliminationShare: number[];
  gamesWithEarlyElimination: number; // elimination firing with >1 year still left to play
  games: number;
}

function run(agentNames: string[], cards: Card[], cfg: Config, seeds: number[]): EliminationResult {
  const results = seeds.map((s) => playOne(agentNames, cards, cfg, s)).filter((r) => r.scoreHistory.length > 1);

  let maxSingleYearGain = 0;
  for (const r of results) {
    const h = r.scoreHistory;
    for (let y = 1; y < h.length; y++) {
      for (let p = 0; p < h[y].length; p++) maxSingleYearGain = Math.max(maxSingleYearGain, h[y][p] - h[y - 1][p]);
    }
  }

  let playerYears = 0, eliminatedPlayerYears = 0, unsoundCount = 0, gamesWithEarlyElimination = 0;
  const firstEliminationShare: number[] = [];

  for (const r of results) {
    const h = r.scoreHistory;
    const total = h.length;
    let firstElim: number | undefined;
    for (let y = 0; y < total; y++) {
      const row = h[y];
      const leader = Math.max(...row);
      const yearsRemaining = total - 1 - y;
      for (let p = 0; p < row.length; p++) {
        playerYears++;
        const ceiling = row[p] + yearsRemaining * maxSingleYearGain;
        if (ceiling < leader) {
          eliminatedPlayerYears++;
          if (p === r.winner) unsoundCount++;
          if (firstElim === undefined) firstElim = y;
        }
      }
    }
    if (firstElim !== undefined) {
      firstEliminationShare.push(firstElim / (total - 1 || 1));
      if (total - 1 - firstElim > 1) gamesWithEarlyElimination++;
    }
  }

  return {
    maxSingleYearGain, playerYears, eliminatedPlayerYears, unsoundCount,
    firstEliminationShare, gamesWithEarlyElimination, games: results.length,
  };
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

if (import.meta.filename === process.argv[1]) {
  const cfg = loadConfig(process.argv[2] ?? 'tuned.json');
  const cards = loadPacks(BALANCE_PACKS);
  const N = Number(process.argv[3] ?? 300);
  console.log(`config ${cfg.name}, ${N} games, packs ${BALANCE_PACKS.join(',')}\n`);

  console.log('== 1. typical table: Greedy, Lookahead, SenateFlood, HeterodoxSpecialist ==');
  {
    const seeds = Array.from({ length: N }, (_, i) => 700000 + i);
    const m = run(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg, seeds);
    console.log(`  largest single-year score swing observed anywhere in the corpus: ${m.maxSingleYearGain.toFixed(1)} pips`);
    console.log(`  player-years sampled: ${m.playerYears}`);
    console.log(`  player-years flagged ELIMINATED (cannot close the gap even at that best-ever swing, every remaining year): ${m.eliminatedPlayerYears} (${(100 * m.eliminatedPlayerYears / m.playerYears).toFixed(2)}%)`);
    console.log(`  unsound flags (an eliminated player-year that still won): ${m.unsoundCount}  [must be 0]`);
    console.log(`  games with at least one player ever flagged: ${m.firstEliminationShare.length}/${m.games} (${(100 * m.firstEliminationShare.length / m.games).toFixed(1)}%)`);
    console.log(`  of those, mean first-elimination point: ${(100 * mean(m.firstEliminationShare)).toFixed(0)}% of the way through the game`);
    console.log(`  games where elimination fires with MORE than one year still to play (a player genuinely "sits through" a hopeless stretch, not just the final tick): ${m.gamesWithEarlyElimination}/${m.games} (${(100 * m.gamesWithEarlyElimination / m.games).toFixed(1)}%)`);
  }

  console.log('\n== 2. solitaire context: Greedy (human proxy) 1v1 against #205\'s three fair opponents ==');
  for (const opp of ['HeterodoxSpecialist', 'EconomyChicken', 'Vetoer']) {
    const seeds = Array.from({ length: N }, (_, i) => 710000 + i);
    const m = run(['Greedy', opp], cards, cfg, seeds);
    console.log(`  vs ${opp}: player-years ${m.playerYears}, eliminated ${(100 * m.eliminatedPlayerYears / m.playerYears).toFixed(2)}%, games ever flagged ${(100 * m.firstEliminationShare.length / m.games).toFixed(1)}%, unsound ${m.unsoundCount}`);
  }
}
