/** hf7y/american-cycle#171 and #55's converged open thread: the 2-player
 *  table sits at ~8.35pp over the 3pp bar on `ALL_PACKS`/`tuned.json`, and
 *  neither of #55's ablations (pending-list visibility, capture on/off)
 *  explains it -- hiding the pending list barely moves it, and disabling
 *  capture makes it WORSE, the opposite of the 3-player direction. This
 *  toggles the other config-driven subsystems one at a time, at n=2000
 *  (SE ~1.1pp), to find which channel actually carries the 2p effect.
 *
 *  node sim/scratch-seat-bias-2p-mechanism-171.ts
 */
import { seatBias } from './roundrobin.ts';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import type { Config } from '../engine/game.ts';

const N = 2000;
const P = 2;
const cards = loadPacks(ALL_PACKS);
const base = loadConfig('tuned.json');
const se = 100 * Math.sqrt(0.25 / N);
const devOf = (b: number[]) => 100 * Math.max(...b.map((x) => Math.abs(x - 0.5)));
const fmt = (b: number[]) => b.map((x) => (100 * x).toFixed(2) + '%').join('  ');

function run(label: string, cfg: Config) {
  const b = seatBias('Greedy', P, cards, cfg, N);
  const dev = devOf(b);
  console.log(`  ${label.padEnd(28)} ${fmt(b)}  max dev ${dev.toFixed(2)}pp${dev > 3 ? '  OVER BAR' : ''}`);
}

console.log(`2p, ALL_PACKS, tuned.json, n=${N} (SE ${se.toFixed(2)}pp, bar 3pp)\n`);

run('baseline', base);

run('endorsements off', {
  ...base,
  endorsements: { president: 0, governorInState: 0, senator: 0 },
});

run('national terms off', {
  ...base,
  national: { strongEconomy: 0, recession: 0, midtermPenalty: 0, coattailsWith: 0, coattailsAgainst: 0 },
});

run('extremist off', {
  ...base,
  primaryGeneral: { ...base.primaryGeneral, extremistPrimary: 0, extremistGeneral: 0 },
});

run('identityBonus off', {
  ...base,
  resolution: { ...base.resolution, identityBonus: 0 },
});

run('incumbency off (all)', {
  ...base,
  resolution: { ...base.resolution, incumbency: 0, incumbencyPrimary: 0, crossOfficeIncumbency: 0 },
});

run('lean push off', {
  ...base,
  lean: { ...base.lean, pushByMargin: base.lean.pushByMargin.map((x) => ({ ...x, push: 0 })), uncontestedPush: 0 },
});

run('capture off (from #55/#171)', {
  ...base,
  game: { ...base.game, captureEnabled: false },
});

run('endorsements + capture off', {
  ...base,
  endorsements: { president: 0, governorInState: 0, senator: 0 },
  game: { ...base.game, captureEnabled: false },
});
