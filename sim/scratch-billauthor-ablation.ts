/** Scratch: hf7y/american-cycle#66 item 2 -- BillAuthor and HouseFarm swap
 *  first/second place between `tuned` and `as-written-plus` under a bills
 *  victory with no cap. Ablate the fields that actually differ between the
 *  two configs, one at a time, to find which one flips the ordering.
 *
 *  node sim/scratch-billauthor-ablation.ts
 */
import { loadConfig, loadPacks, playOne, ALL_PACKS } from './harness.ts';

const cards = loadPacks(ALL_PACKS);
// A 4-agent table with Greedy/Lookahead never reproduced the ordering swap
// #66 reports -- BillAuthor stayed ahead of HouseFarm in every cell tried.
// This 3-way pool (the two chasers plus the third agent DECISIONS.md's
// collision paragraph names alongside them) is the smallest one that does.
const POOL = ['SenateFlood', 'HouseFarm', 'BillAuthor'];
const SEEDS = 80;

// A stalled table can circulate for tens of thousands of years (DECISIONS.md,
// "Amendment, 2026-09-01") -- holding that many events/log lines for 40 seeds
// at once is what OOM'd the first cut of this script. Capped, not "no cap":
// unfinished games are counted via endedShare, same as the amendment section
// did with its own 100/100000-year comparison.
const MAX_YEARS = 2000;

const IDX = { SenateFlood: 0, HouseFarm: 1, BillAuthor: 2 };

function run(cfg: unknown) {
  let winA = 0, winH = 0, winS = 0, ended = 0, years = 0;
  for (let i = 0; i < SEEDS; i++) {
    const r = playOne(POOL, cards, cfg as never, 5_000_000 + i);
    if (r.winner === IDX.BillAuthor) winA++;
    if (r.winner === IDX.HouseFarm) winH++;
    if (r.winner === IDX.SenateFlood) winS++;
    if (r.endedBy) ended++;
    years += r.years;
  }
  return {
    BillAuthor: winA / SEEDS, HouseFarm: winH / SEEDS, SenateFlood: winS / SEEDS,
    endedShare: ended / SEEDS, meanYears: years / SEEDS,
  };
}

const tuned = loadConfig('tuned.json');
const awp = loadConfig('as-written-plus.json');

// Normalise victory condition and length identically for every cell -- the
// question is which LEAN knob flips the ordering, not which config's own
// victory/length setting does.
const NORMALISE = { game: { ...tuned.game, victory: 'bills' as const, billTarget: 8, maxYears: MAX_YEARS } };

const base = { ...tuned, ...NORMALISE };
const target = { ...awp, ...NORMALISE };

const cells: Record<string, unknown> = {
  'tuned (base)': base,
  'as-written-plus (target)': target,
  '+ pushByMargin from awp': { ...base, lean: { ...base.lean, pushByMargin: awp.lean.pushByMargin } },
  '+ decayFrequency from awp': { ...base, lean: { ...base.lean, decayFrequency: awp.lean.decayFrequency } },
  '+ uncontestedPush from awp': { ...base, lean: { ...base.lean, uncontestedPush: awp.lean.uncontestedPush } },
  '+ billFrequency from awp': { ...base, legislature: { ...base.legislature, billFrequency: awp.legislature.billFrequency } },
};

console.log(`pool: ${POOL.join(',')}, ${SEEDS} seeds, victory=bills target=8 maxYears=${MAX_YEARS} (normalised)\n`);
for (const [name, cfg] of Object.entries(cells)) {
  const r = run(cfg);
  console.log(
    `${name.padEnd(28)} BillAuthor ${(r.BillAuthor * 100).toFixed(1).padStart(5)}%  `
    + `HouseFarm ${(r.HouseFarm * 100).toFixed(1).padStart(5)}%  `
    + `SenateFlood ${(r.SenateFlood * 100).toFixed(1).padStart(5)}%  `
    + `ended ${(r.endedShare * 100).toFixed(0)}%  meanYears ${r.meanYears.toFixed(0)}`,
  );
}
