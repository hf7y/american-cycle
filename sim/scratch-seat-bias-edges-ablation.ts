/** hf7y/american-cycle#171's own ask: #55 ran the pending-list-visibility and
 *  capture-disabled ablations for the 3-player table only, and found the
 *  bias there traces to the open `pending` list (RandomAgent, which never
 *  reads it, comes back byte-identical with it hidden; Greedy's bias
 *  collapses to noise). #171's `sim/edges.ts` sweep shows 2, 4, 5 and 6
 *  players are ALSO over the 3pp bar -- this re-runs both ablations at
 *  those four sizes to check whether the same channel explains them, or
 *  whether 4p/6p (not simple even/odd splits per #171) need their own
 *  account. n=2000 (SE 0.83-1.12pp across these four sizes) on `tuned.json`,
 *  matching the N #171 itself asked for.
 *
 *  node sim/scratch-seat-bias-edges-ablation.ts
 */
import { RNG } from '../engine/rules/rng.ts';
import { Game, type Config, type GameView, type OpenRace, type PendingPeg, type Agent } from '../engine/game.ts';
import type { Declaration } from '../engine/rules/elections.ts';
import { GreedyAgent } from './agents.ts';
import { seatBias } from './roundrobin.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';

// Same channel #55 toggled: Greedy scores a pending-list race higher
// (`counterDeclare`'s appetite bonus) once someone else has already staked
// it. Hiding the list makes every declaration behave as if it were first.
class GreedyPendingHidden extends GreedyAgent {
  constructor(cfg: Config, rng: RNG) { super('GreedyPendingHidden', cfg, rng); }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    void pending;
    return super.declare(v, open, []);
  }
}

function seatBiasCustom(
  makeAgent: (cfg: Config, rng: RNG) => Agent, players: number, cards: ReturnType<typeof loadPacks>, cfg: Config, n: number,
) {
  const wins = new Array(players).fill(0);
  for (let i = 0; i < n; i++) {
    const seed = 8000 + i;
    const rng = new RNG(seed);
    const agents = Array.from({ length: players }, () => makeAgent(cfg, rng));
    const g = new Game(agents, cards, cfg, seed);
    const r = g.run();
    wins[r.winner]++;
  }
  return wins.map((w) => w / n);
}

const N = 2000;
const cards = loadPacks(ALL_PACKS);
const cfg = loadConfig('tuned.json');
const SIZES = [2, 4, 5, 6];
const seFor = (players: number) => 100 * Math.sqrt((1 / players) * (1 - 1 / players) / N);
const devOf = (b: number[], players: number) => 100 * Math.max(...b.map((x) => Math.abs(x - 1 / players)));
const fmt = (b: number[]) => b.map((x) => (100 * x).toFixed(1) + '%').join('  ');

console.log(`#171's four sizes, both of #55's ablations, tuned.json, n=${N}\n`);

for (const p of SIZES) {
  const se = seFor(p);
  console.log(`-- ${p}p (SE ${se.toFixed(2)}pp, bar 3pp) --`);

  const base = seatBias('Greedy', p, cards, cfg, N);
  const baseDev = devOf(base, p);
  console.log(`  baseline          ${fmt(base)}  max dev ${baseDev.toFixed(2)}pp${baseDev > 3 ? '  OVER BAR' : ''}`);

  const hidden = seatBiasCustom((c, r) => new GreedyPendingHidden(c, r), p, cards, cfg, N);
  const hiddenDev = devOf(hidden, p);
  console.log(`  pending hidden    ${fmt(hidden)}  max dev ${hiddenDev.toFixed(2)}pp${hiddenDev > 3 ? '  OVER BAR' : ''}`);

  const noCapture: Config = { ...cfg, game: { ...cfg.game, captureEnabled: false } };
  const capOff = seatBias('Greedy', p, cards, noCapture, N);
  const capOffDev = devOf(capOff, p);
  console.log(`  capture disabled  ${fmt(capOff)}  max dev ${capOffDev.toFixed(2)}pp${capOffDev > 3 ? '  OVER BAR' : ''}`);
  console.log('');
}
