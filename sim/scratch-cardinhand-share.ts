/** Scratch: hf7y/american-cycle#85 -- "scoring.cardInHand: 1 is a large
 *  near-constant... 1 may be too high to leave the rest of the epilogue
 *  legible." Measure cardInHand's actual share of a player's final score to
 *  decide, rather than reason about it from the base-hand-size arithmetic
 *  alone (16 base + office bonuses is an upper bound on hand size, not a
 *  measurement of cards actually held as CANDIDATES at game end -- districts
 *  and spent/withdrawn candidates don't count toward this term).
 *
 *  node sim/scratch-cardinhand-share.ts
 */
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { AGENTS } from './agents.ts';
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { boardScores, type BoardView } from '../engine/rules/scoring.ts';

const cfg = loadConfig('tuned.json');
const cards = loadPacks(ALL_PACKS);
const POOL = ['Greedy', 'Lookahead', 'SenateFlood', 'HouseFarm'];
const SEEDS = 80;

let totalScore = 0, totalCardInHand = 0, n = 0;
let maxShare = 0;

for (let i = 0; i < SEEDS; i++) {
  const seed = 7_700_000 + i;
  const rng = new RNG(seed);
  const order = POOL.map((_, k) => POOL[(k + i) % POOL.length]);
  const g = new Game(order.map((name) => new AGENTS[name](cfg, rng)), cards, cfg, seed);
  g.run();

  const b: BoardView = {
    seats: g.seats, lean: g.leanMap, bills: g.bills, amendments: g.amendments,
    players: g.players,
    identitiesOf: (id) => g.cardById.get(id)?.identities,
  };
  const totals = boardScores(cfg.scoring, b);

  g.players.forEach((p, idx) => {
    const cardInHandTerm = cfg.scoring.cardInHand * p.hand.filter((c) => c.kind === 'candidate').length;
    const total = totals[idx];
    if (total <= 0) return;                 // a score of 0 has no meaningful share
    totalScore += total;
    totalCardInHand += cardInHandTerm;
    n++;
    maxShare = Math.max(maxShare, cardInHandTerm / total);
  });
}

console.log(`pool: ${POOL.join(',')}, ${SEEDS} seeds x ${POOL.length} players = ${n} player-scores`);
console.log(`mean total score:        ${(totalScore / n).toFixed(2)}`);
console.log(`mean cardInHand term:     ${(totalCardInHand / n).toFixed(2)}`);
console.log(`cardInHand share of mean total: ${((totalCardInHand / totalScore) * 100).toFixed(1)}%`);
console.log(`largest single-player share seen: ${(maxShare * 100).toFixed(1)}%`);
