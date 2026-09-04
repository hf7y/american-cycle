/** Scratch: hf7y/american-cycle#42's ask -- `assignEndorsements()` gave the
 *  presidency exactly one endorsement per cycle across fifty states (one
 *  seat = one endorser entry), with no separate knob for how many races an
 *  officeholder can back. `Config.endorsements.presidentCount` now exists
 *  (engine/game.ts) and defaults to 1, unchanged from shipped behaviour.
 *
 *  #42's falsifier: sweep the presidency at 1/3/5/10 and check whether
 *  raising the count concentrates declarations in low-|lean| (battleground)
 *  states. Every primary modifier stack carries a `state lean` entry with
 *  `pips: Math.abs(lean)` when lean is nonzero and favours that party
 *  (elections.ts:174), and an `endorsements` entry when that side drew one
 *  (elections.ts:215) -- so a race's pre-dice |lean| and whether it was
 *  endorsed both come straight off `GameResult.events` with no engine
 *  instrumentation needed.
 *
 *  node sim/scratch-president-endorsement-count.ts
 */
import { loadConfig, loadPacks, playOne, ALL_PACKS } from './harness.ts';
import type { Config } from '../engine/game.ts';

const N = 400;
const cards = loadPacks(ALL_PACKS);
const base = loadConfig('tuned.json');

function leanOf(side: { modifiers: { source: string; pips: number }[] }) {
  return side.modifiers.find((m) => m.source === 'state lean')?.pips ?? 0;
}
function endorsed(side: { modifiers: { source: string; pips: number }[] }) {
  return side.modifiers.some((m) => m.source === 'endorsements');
}

console.log(`presidency endorsement-count sweep, n=${N} games each, packs=${ALL_PACKS.join(',')}\n`);
console.log('count  endorsed primaries/game  mean |lean| endorsed  mean |lean| all primaries  mean |lean| non-endorsed');

for (const count of [1, 3, 5, 10]) {
  const cfg: Config = { ...base, endorsements: { ...base.endorsements, presidentCount: count } };
  let endorsedLean = 0, endorsedN = 0;
  let allLean = 0, allN = 0;
  let nonEndorsedLean = 0, nonEndorsedN = 0;
  let endorsedRaceCount = 0;

  for (let i = 0; i < N; i++) {
    const r = playOne(['Greedy', 'Greedy', 'Greedy', 'Greedy'], cards, cfg, 700000 + count * 1000 + i);
    for (const ev of r.events) {
      // primaries only -- endorsements are primary-only by design (game.ts:1008)
      if (ev.round !== 'primary') continue;
      for (const side of ev.sides) {
        const l = Math.abs(leanOf(side));
        allLean += l; allN++;
        if (endorsed(side)) { endorsedLean += l; endorsedN++; endorsedRaceCount++; }
        else { nonEndorsedLean += l; nonEndorsedN++; }
      }
    }
  }
  const fmt = (sum: number, n: number) => (n ? (sum / n).toFixed(2) : 'n/a');
  console.log(`${count.toString().padStart(5)}  ${(endorsedRaceCount / N).toFixed(2).padStart(22)}  ${fmt(endorsedLean, endorsedN).padStart(19)}  ${fmt(allLean, allN).padStart(23)}  ${fmt(nonEndorsedLean, nonEndorsedN).padStart(21)}`);
}
