/** Parameter sweeps — SIM-BRIEF Part 4. Each holds the rest at baseline. */
import { loadConfig, loadPacks, playOne, summarise, BALANCE_PACKS } from './harness.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';

export function contestRate(seeds: number[], agents: string[], cards: Card[], cfg: Config) {
  let n = 0, c = 0, seats = 0, hand = 0, games = 0, lean = 0, leanN = 0, realigned = 0;
  const results = [];
  for (const s of seeds) {
    const r = playOne(agents, cards, cfg, s);
    results.push(r);
    n += 1; c += r.contestedSlotShare;
    seats += Object.values(r.seatsByOffice).reduce((a, b) => a + b, 0);
    games++;
    for (const v of Object.values(r.finalLean)) { lean += Math.abs(v); leanN++; if (Math.abs(v) >= 4) realigned++; }
  }
  void hand;
  const sum = summarise(results, agents);
  return {
    contested: n ? c / n : 0, races: results[0] ? results.reduce((a2, x) => a2 + x.events.length, 0) / games : 0, seats: seats / games,
    meanAbsLean: leanN ? lean / leanN : 0, realigned: realigned / games,
    years: sum.meanYears, winRate: sum.winRate, upset: sum.upsetRate,
    bills: sum.billPassRate, decisions: sum.meanDecisions,
  };
}

/** Keep every candidate; keep only `frac` of the district cards. Sweeps the
 *  district-to-candidate ratio, which sets map fill rate and turn density
 *  (DECISIONS.md's open question 4). */
export function withDistrictFraction(cards: Card[], frac: number, seed: number): Card[] {
  const cand = cards.filter((c) => c.kind === 'candidate');
  const dist = cards.filter((c) => c.kind === 'district');
  // deterministic stride, so a sweep point is reproducible
  const keep = dist.filter((_, i) => (i * 9301 + seed) % 1000 < frac * 1000);
  return [...cand, ...keep];
}

if (import.meta.filename === process.argv[1]) {
  const cfg = loadConfig('baseline.json');
  const all = loadPacks(BALANCE_PACKS);
  const seeds = Array.from({ length: 12 }, (_, i) => 700 + i);
  const agents = ['Greedy', 'Lookahead', 'Greedy', 'HouseFarm'];

  console.log('districts  ratio   contested  races/g  seats/g  absLean  realign  years');
  for (const frac of [1.0, 0.6, 0.4, 0.25, 0.15, 0.08]) {
    const cards = withDistrictFraction(all, frac, 3);
    const nd = cards.filter((c) => c.kind === 'district').length;
    const nc = cards.filter((c) => c.kind === 'candidate').length;
    const r = contestRate(seeds, agents, cards, cfg);
    console.log(
      String(nd).padStart(9),
      (nd / (nd + nc)).toFixed(2).padStart(6),
      (100 * r.contested).toFixed(0).padStart(10) + '%',
      r.races.toFixed(0).padStart(8),
      r.seats.toFixed(0).padStart(8),
      r.meanAbsLean.toFixed(2).padStart(8),
      r.realigned.toFixed(1).padStart(8),
      r.years.toFixed(0).padStart(6),
    );
  }
}
