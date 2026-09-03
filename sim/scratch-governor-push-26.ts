/** hf7y/american-cycle#26: does lean.governorPushes = 'with-lean' move
 *  realignment, map saturation, or the governorship's winner-advantage ratio,
 *  now that #17 (resignToRun) and #23 (oddYearGovernors) both ship on every
 *  config? Sequenced behind both landing (they did, hf7y/american-cycle#141);
 *  this is the measurement the ruling authorised.
 *
 *  Three configs, same 'never'-vs-'with-lean' toggle isolated three ways:
 *  1. tuned.json as shipped (governorPushes: never) -- the baseline.
 *  2. a clone of tuned with ONLY governorPushes flipped to 'with-lean' --
 *     isolates the lever #26 asks about from every other knob.
 *  3. the committed governors-push.json, which also carries
 *     districtsPerPack: 5 against tuned's 3 -- #133 already swept that field
 *     end-to-end and found it moves nothing (sim/scratch-district-threshold-
 *     ablation.ts), so this row exists to confirm the committed config
 *     reproduces (2) rather than to re-litigate that null result.
 */
import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from './harness.ts';
import { AGENTS } from './agents.ts';
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import type { Config } from '../engine/game.ts';
import type { Office } from '../engine/types/index.ts';

const N = Number(process.argv[2] ?? 150);
const cards = loadPacks(BALANCE_PACKS);

function withLean(base: Config): Config {
  return { ...base, lean: { ...base.lean, governorPushes: 'with-lean' } };
}

function summariseLean(cfg: Config, n: number) {
  let realigned = 0, absLean = 0, leanN = 0;
  for (let i = 0; i < n; i++) {
    const r = playOne(['Greedy', 'Lookahead', 'SenateFlood', 'Launchpad'], cards, cfg, 20000 + i);
    for (const v of Object.values(r.finalLean)) {
      absLean += Math.abs(v); leanN++;
      if (Math.abs(v) >= 4) realigned++;
    }
  }
  return { realignedPerGame: realigned / n, meanAbsLean: leanN ? absLean / leanN : 0 };
}

// what-wins.ts's own method: build the Game directly so g.seats (who holds
// what) is readable after run(), which GameResult alone does not carry.
const OFFICES: Office[] = ['senator', 'representative', 'governor', 'president'];
const POOL = ['Greedy', 'Lookahead', 'SenateFlood', 'Launchpad'];

function seatsByOutcome(cfg: Config, n: number) {
  const winner: Record<string, number> = {};
  const rest: Record<string, number> = {};
  for (const o of OFFICES) { winner[o] = 0; rest[o] = 0; }
  for (let i = 0; i < n; i++) {
    const seed = 21000 + i;
    const rng = new RNG(seed);
    const order = POOL.map((_, k) => POOL[(k + i) % POOL.length]);
    const g = new Game(order.map((name) => new AGENTS[name](cfg, rng)), cards, cfg, seed);
    const r = g.run();
    for (const s of g.seats) {
      if (!s.holder) continue;
      (s.holder.player === r.winner ? winner : rest)[s.office]++;
    }
  }
  const losers = POOL.length - 1;
  return Object.fromEntries(OFFICES.map((o) => {
    const per = rest[o] / (n * losers);
    return [o, { winner: winner[o] / n, rest: per, ratio: per ? winner[o] / n / per : NaN }];
  })) as Record<Office, { winner: number; rest: number; ratio: number }>;
}

const tuned = loadConfig('tuned.json');

console.log(`n=${N} per cell, pool ${POOL.join(',')}, packs ${BALANCE_PACKS.join(',')}\n`);

for (const [label, cfg] of [
  ['tuned (never)', tuned],
  ['tuned + governorPushes=with-lean, isolated', withLean(tuned)],
  ['tuned + districtsPerPack:5 only (governorPushes still never)',
    { ...tuned, draft: { ...tuned.draft, districtsPerPack: 5 } }],
  ['governors-push.json (with-lean + districtsPerPack:5, as shipped)', loadConfig('governors-push.json')],
] as const) {
  const lean = summariseLean(cfg, N);
  const seats = seatsByOutcome(cfg, N);
  console.log(`${label}`);
  console.log(`  realigned states/game: ${lean.realignedPerGame.toFixed(2)}   mean |lean|: ${lean.meanAbsLean.toFixed(2)}`);
  console.log(`  winner-advantage ratio -- governor: ${seats.governor.ratio.toFixed(2)}x  senate: ${seats.senator.ratio.toFixed(2)}x  president: ${seats.president.ratio.toFixed(2)}x  house: ${seats.representative.ratio.toFixed(2)}x`);
  console.log('');
}
