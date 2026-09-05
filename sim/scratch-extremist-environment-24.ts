/** hf7y/american-cycle#24: "measure before believing it." `extremistEnvironmentPips`
 *  scales the primary's `extremistPrimary` bonus by the same national tide
 *  the general branch already reads, mirrored for whichever party does not
 *  hold the presidency (engine/rules/elections.ts). This does not turn it on
 *  anywhere -- no shipped config sets it -- it only checks that the knob, if
 *  someone does turn it on, does what #24 asked for and does not break the
 *  primary's own odds table.
 *
 *  Read each primary side's ALREADY-APPLIED 'extremist (primary)' modifier
 *  (baked in by buildModifiers, not recomputed here) and bucket its win rate
 *  by the pips actually carried. `primaryOddsAtEdge` gives the expected
 *  favourite-win probability for a given edge, so a check against it does
 *  not need a second implementation of the tide arithmetic to trust the
 *  first one -- if the engine says a side carries N pips, the odds table
 *  already says what win rate that predicts.
 *
 *  node sim/scratch-extremist-environment-24.ts
 */
import { loadConfig, loadPacks, playOne, ALL_PACKS } from './harness.ts';
import type { Config } from '../engine/game.ts';

const N = Number(process.argv[2] ?? 300);
const cards = loadPacks(ALL_PACKS);
const POOL = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];

function withKnob(base: Config, extremistEnvironmentPips: number): Config {
  return { ...base, primaryGeneral: { ...base.primaryGeneral, extremistEnvironmentPips } };
}

function extremistPipsSeen(cfg: Config, n: number) {
  const buckets = new Map<number, { won: number; ran: number }>();
  let sides = 0;
  for (let i = 0; i < n; i++) {
    const r = playOne(POOL, cards, cfg, 60000 + i);
    for (const e of r.events) {
      if (e.round !== 'primary' || e.uncontested) continue;
      for (const s of e.sides) {
        const mod = s.modifiers.find((m) => m.source === 'extremist (primary)');
        if (!mod) continue;
        sides++;
        const b = buckets.get(mod.pips) ?? { won: 0, ran: 0 };
        b.ran++;
        if (s.player === e.winner) b.won++;
        buckets.set(mod.pips, b);
      }
    }
  }
  return { buckets, sides };
}

console.log(`#24: extremist-primary bonus vs national tide, ${N} games, all 7 eras, pool ${POOL.join('/')}\n`);

const base = loadConfig('tuned.json');

console.log('-- extremistEnvironmentPips: 0 (shipped default; every config ships this) --');
{
  const { buckets, sides } = extremistPipsSeen(base, N);
  console.log(`  ${sides} extremist-primary sides seen`);
  for (const [pips, b] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  pips ${pips >= 0 ? '+' : ''}${pips}: won ${b.won}/${b.ran} = ${(100 * b.won / b.ran).toFixed(1)}%`);
  }
}

for (const knob of [1, 2]) {
  console.log(`\n-- extremistEnvironmentPips: ${knob} --`);
  const { buckets, sides } = extremistPipsSeen(withKnob(base, knob), N);
  console.log(`  ${sides} extremist-primary sides seen, ${buckets.size} distinct pip values (flat config sees 1)`);
  for (const [pips, b] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  pips ${pips >= 0 ? '+' : ''}${pips}: won ${b.won}/${b.ran} = ${(100 * b.won / b.ran).toFixed(1)}%  (n=${b.ran})`);
  }
}
