/** hf7y/american-cycle#39's falsifier, run once as part of wiring the fix.
 *
 *  `options()` (sim/agents.ts) priced every general-round race with
 *  `economyMod: 0` no matter what the board showed -- a stub, not a gate:
 *  `GameView.economy` was already there, nothing read it. Fixed by calling
 *  the same `economyModifier` the engine itself uses for the *actual* race
 *  (engine/game.ts:1139).
 *
 *  The issue asks a second question before deciding whether phased polling
 *  (hf7y/american-cycle#44) is still worth building: **do declarations
 *  actually move now that agents can see the economy?** If they do, the
 *  wave is emergent from information already on the board and #44 buys
 *  nothing. If they do not, seeing the economy changed no behaviour and a
 *  knowable wave is a separate, unaddressed question.
 *
 *  Measures the president's-party share of general-round declaration
 *  slots, bucketed by the economy state actually in force when those
 *  declarations were made (`this.economy` right after `tick()`'s econ.walk,
 *  before that tick's elections -- see engine/game.ts `tick()`, steps 4-6).
 *
 *  node sim/scratch-economy-visibility.ts [games-per-config]
 */
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { AGENTS } from './agents.ts';
import { Game, type Config } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { economyModifier } from '../engine/rules/economy.ts';
import type { Party } from '../engine/types/index.ts';

const POOL = ['Greedy', 'Lookahead', 'Greedy', 'Lookahead'];
const PACKS = ALL_PACKS;

interface Bucket { presParty: number; total: number }

function run(cfg: Config, games: number, seed0: number): Record<'recession' | 'neutral' | 'boom', Bucket> {
  const cards = loadPacks(PACKS);
  const buckets = {
    recession: { presParty: 0, total: 0 },
    neutral: { presParty: 0, total: 0 },
    boom: { presParty: 0, total: 0 },
  };
  for (let i = 0; i < games; i++) {
    const seed = seed0 + i;
    const rng = new RNG(seed);
    const g = new Game(POOL.map((n) => new AGENTS[n](cfg, rng)), cards, cfg, seed);
    const end = cfg.game.startYear + cfg.game.maxYears;
    let seen = 0;
    while (g.year < end) {
      const presParty: Party | undefined = g.president?.party;
      g.tick();
      const mod = economyModifier(g.economy, cfg.economy, cfg.national.strongEconomy, cfg.national.recession);
      const key = mod < 0 ? 'recession' : mod > 0 ? 'boom' : 'neutral';
      for (; seen < g.events.length; seen++) {
        const ev = g.events[seen];
        if (ev.round !== 'general' || ev.office === 'president' || !presParty) continue;
        for (const s of ev.sides) {
          buckets[key].total++;
          if (s.party === presParty) buckets[key].presParty++;
        }
      }
      if (cfg.game.deckOutEnds && !g.talon.length && !g.discard.length
        && !(g as unknown as { eraQueue: unknown[] }).eraQueue.length) break;
    }
  }
  return buckets;
}

const pct = (x: number) => `${(100 * x).toFixed(2)}%`;

function main(): void {
  const games = Number(process.argv[2] ?? 80);
  for (const path of ['as-written-plus.json', 'tuned.json']) {
    const cfg = loadConfig(path);
    const b = run(cfg, games, 5500000);
    console.log(`# ${cfg.name} -- ${games} games, pool [${POOL.join(', ')}]`);
    console.log('economy state   slots   president-party share');
    for (const key of ['recession', 'neutral', 'boom'] as const) {
      const { presParty, total } = b[key];
      console.log(`  ${key.padEnd(12)} ${String(total).padStart(6)}   ${total ? pct(presParty / total) : 'n/a'}`);
    }
    console.log();
  }
}

if (import.meta.filename === process.argv[1]) main();
