/** Scratch: hf7y/american-cycle#171's ask -- #55 identified the channel behind
 *  3-player seat bias (declaration-order rotation via the open `pending`
 *  list, with capture partly but not wholly responsible) but only ever ran
 *  its ablations at 3 players. #171 found 2, 4, 5 and 6 players over the
 *  same 3pp bar and asked whether the same mechanism explains all of them.
 *
 *  Two ablations, both from #55's own comments:
 *   - pending-blind: a Greedy that never reads `pending` (isolates the
 *     counter-declare/ordering channel; #55 found this collapsed the 2p/3p
 *     bias to noise for Greedy, since Random -- which never reads pending
 *     either -- was untouched by it and still showed a residual gap).
 *   - capture-disabled: `game.captureEnabled: false`, already a shipped
 *     diagnostic switch (F25's ablation, re-run at n=2400 by #139 for 3p).
 *
 *  n=2400 per cell (SE ~0.9-1.4pp depending on player count, comfortably
 *  under the 3pp bar).
 *
 *  node sim/scratch-seat-bias-2456p-ablation.ts
 */
import { GreedyAgent } from './agents.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { Game, type Agent, type GameView, type OpenRace, type PendingPeg, type Config } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import type { Declaration } from '../engine/rules/elections.ts';
import type { Card } from '../engine/types/index.ts';

class GreedyPendingBlind extends GreedyAgent {
  declare(v: GameView, open: OpenRace[], _pending: PendingPeg[]): Declaration[] {
    return super.declare(v, open, []);
  }
}

function seatBiasWith(
  make: (cfg: Config, rng: RNG) => Agent,
  players: number,
  cards: Card[],
  cfg: Config,
  n: number,
  seedBase: number,
) {
  const wins = new Array(players).fill(0);
  for (let i = 0; i < n; i++) {
    const seed = seedBase + i;
    const rng = new RNG(seed);
    const agents = Array.from({ length: players }, () => make(cfg, rng));
    const r = new Game(agents, cards, cfg, seed).run();
    wins[r.winner]++;
  }
  return wins.map((w) => w / n);
}

const N = 2400;
const cards = loadPacks(ALL_PACKS);
const seFor = (players: number) => 100 * Math.sqrt((1 / players) * (1 - 1 / players) / N);
const devOf = (b: number[], players: number) => 100 * Math.max(...b.map((x) => Math.abs(x - 1 / players)));
const fmt = (b: number[]) => b.map((x) => (100 * x).toFixed(1) + '%').join('  ');

for (const configName of ['tuned.json', 'as-written-plus.json']) {
  console.log(`\n=== ${configName} ===`);
  for (const p of [2, 4, 5, 6]) {
    const cfg = loadConfig(configName);
    console.log(`\n  ${p}p (n=${N}, SE ${seFor(p).toFixed(2)}pp, bar 3pp)`);

    const asShipped = seatBiasWith((c, r) => new GreedyAgent('Greedy', c, r), p, cards, cfg, N, 400000 + p * 10000);
    console.log(`    as shipped        ${fmt(asShipped)}  max dev ${devOf(asShipped, p).toFixed(2)}pp`);

    const pendingBlind = seatBiasWith((c, r) => new GreedyPendingBlind('Greedy', c, r), p, cards, cfg, N, 410000 + p * 10000);
    console.log(`    pending hidden    ${fmt(pendingBlind)}  max dev ${devOf(pendingBlind, p).toFixed(2)}pp`);

    const noCapture: Config = { ...cfg, game: { ...cfg.game, captureEnabled: false } };
    const captureOff = seatBiasWith((c, r) => new GreedyAgent('Greedy', c, r), p, cards, noCapture, N, 420000 + p * 10000);
    console.log(`    capture disabled  ${fmt(captureOff)}  max dev ${devOf(captureOff, p).toFixed(2)}pp`);

    const both: Config = { ...cfg, game: { ...cfg.game, captureEnabled: false } };
    const bothOff = seatBiasWith((c, r) => new GreedyPendingBlind('Greedy', c, r), p, cards, both, N, 430000 + p * 10000);
    console.log(`    both disabled     ${fmt(bothOff)}  max dev ${devOf(bothOff, p).toFixed(2)}pp`);
  }
}
