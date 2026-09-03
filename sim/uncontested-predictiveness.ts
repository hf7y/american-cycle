/** Does an uncontested House race predict subsequent partisan movement? (#103)
 *
 *  #10 provisionally scored a walkover's lean push at zero, pending this
 *  measurement: does "uncontested" in this engine carry the information §10
 *  credits it with -- a party stopped fielding candidates because the state
 *  moved -- or is it a recruitment/incumbency-scare-off artefact with no
 *  bearing on where the district goes next? #93 supplies the threshold band
 *  ("uncontested" widened from the bare unopposed flag to unopposed-or-margin)
 *  so the answer is reported across all four points, not one number picked to
 *  imply a single right answer.
 *
 *  Design: classify each district-year as a WALKOVER (effectively
 *  uncompetitive at a given pp threshold) or CONTESTED. For n = 1, 2, 3
 *  cycles later, read the two-party vote-share movement, in the direction of
 *  the race's own winner, in that SAME district (state-district, scoped to
 *  one redistricting era -- a district number is only the same place inside
 *  one, per district-partisanship.ts). Compare walkover districts against
 *  contested districts at a MATCHED starting lean: the district's own
 *  leave-one-out mean share across its era's OTHER contested races, folded
 *  toward the winner's own party, binned into 5-point strata so the
 *  comparison holds the district's starting partisanship constant instead of
 *  conflating "walkovers happen in lopsided districts" with "walkovers
 *  predict movement".
 *
 *  Effect size is reported in share points. This repo's settled scale (1 pip
 *  = 2 margin points, DECISIONS.md; restated in district-partisanship.ts's
 *  header) makes one point of two-party vote SHARE exactly one pip, so no
 *  further conversion is a claim -- the number below already is one.
 *
 *  node sim/uncontested-predictiveness.ts
 */
import { readFileSync } from 'node:fs';
import { RNG } from '../engine/rules/rng.ts';

const PANEL = 'data/historical/house_district_panel.json';
const BOOT_SEED = 1;
const BOOT_ITERS = 2000;

interface Row { year: number; state: string; district: number; dem: number; rep: number; inc: number }
interface Obs { unit: string; year: number; baseline: number; bin: number; futureShare: number; walk: Map<number, boolean> }

const era = (y: number) => (y <= 1980 ? 'A' : y <= 1990 ? 'B' : y <= 2000 ? 'C' : y <= 2010 ? 'D' : 'E');
const unit = (r: Row) => `${r.state}-${r.district}|${era(r.year)}`;
const mean = (a: number[]) => a.reduce((x, z) => x + z, 0) / a.length;
const share = (r: Row) => (100 * r.dem) / (r.dem + r.rep);
const margin = (r: Row) => (100 * Math.abs(r.dem - r.rep)) / (r.dem + r.rep);
const isWalkover = (r: Row, pp: number) => r.dem === 0 || r.rep === 0 || margin(r) >= pp;
const f2 = (x: number) => x.toFixed(2);

const THRESHOLDS: [number, string][] = [[100, 'unopposed only'], [40, 'unopposed or >=40pp'], [30, 'unopposed or >=30pp'], [20, 'unopposed or >=20pp']];
const BIN_WIDTH = 5;
const binOf = (leanTowardWinner: number) => Math.min(9, Math.max(0, Math.floor((leanTowardWinner - 50) / BIN_WIDTH)));

/** Stratified effect: mean(movement | walkover, bin) - mean(movement | contested, bin),
 *  weighted by the walkover group's own bin counts -- effect on the walkover
 *  population, holding starting lean constant (an ATT-style estimator). */
function stratifiedEffect(obs: Obs[], pp: number): { effect: number; nWalk: number; nCont: number } {
  const bins = new Map<number, { walk: number[]; cont: number[] }>();
  for (const o of obs) {
    if (!bins.has(o.bin)) bins.set(o.bin, { walk: [], cont: [] });
    const move = o.futureShare - o.baseline;
    (o.walk.get(pp) ? bins.get(o.bin)!.walk : bins.get(o.bin)!.cont).push(move);
  }
  let num = 0, den = 0, nWalk = 0, nCont = 0;
  for (const { walk, cont } of bins.values()) {
    nWalk += walk.length; nCont += cont.length;
    if (!walk.length || !cont.length) continue;
    num += walk.length * (mean(walk) - mean(cont));
    den += walk.length;
  }
  return { effect: den ? num / den : NaN, nWalk, nCont };
}

/** Cluster bootstrap over district-era units -- races within a unit share a
 *  district, so resampling races directly would understate the SE. */
function bootstrapSE(obs: Obs[], pp: number): number {
  const byU = new Map<string, Obs[]>();
  for (const o of obs) { if (!byU.has(o.unit)) byU.set(o.unit, []); byU.get(o.unit)!.push(o); }
  const units = [...byU.keys()];
  const rng = new RNG(BOOT_SEED);
  const draws: number[] = [];
  for (let b = 0; b < BOOT_ITERS; b++) {
    const sample: Obs[] = [];
    for (let i = 0; i < units.length; i++) sample.push(...byU.get(rng.pick(units))!);
    const e = stratifiedEffect(sample, pp);
    if (!Number.isNaN(e.effect)) draws.push(e.effect);
  }
  draws.sort((a, b) => a - b);
  if (!draws.length) return NaN;
  return (draws[Math.floor(0.975 * draws.length)] - draws[Math.floor(0.025 * draws.length)]) / (2 * 1.96);
}

function main(): void {
  const panel = JSON.parse(readFileSync(PANEL, 'utf8')) as { rows: [number, string, number, number, number, number][] };
  const all: Row[] = panel.rows.map(([year, state, district, dem, rep, inc]) => ({ year, state, district, dem, rep, inc }));
  const rows = all.filter((r) => r.dem + r.rep > 0);

  const byUnit = new Map<string, Row[]>();
  for (const r of rows) { const u = unit(r); if (!byUnit.has(u)) byUnit.set(u, []); byUnit.get(u)!.push(r); }
  for (const rs of byUnit.values()) rs.sort((a, b) => a.year - b.year);

  const contestedByUnit = new Map<string, Row[]>();
  for (const [u, rs] of byUnit) contestedByUnit.set(u, rs.filter((r) => r.dem > 0 && r.rep > 0));

  // leave-one-out baseline: a unit's mean D share across its OTHER contested
  // races this era, so the focal race can never leak into its own matching
  // covariate.
  const looBaseline = (u: string, focal: Row): number | undefined => {
    const cs = contestedByUnit.get(u)!.filter((r) => r !== focal);
    return cs.length ? mean(cs.map(share)) : undefined;
  };

  const byUnitYear = new Map<string, Row>();
  for (const r of rows) byUnitYear.set(`${unit(r)}|${r.year}`, r);

  console.log(`panel: ${rows.length} district-year races with a recorded vote on at least one side, 1976-2018`);
  console.log(`district-era units with >=1 contested race: ${[...contestedByUnit.values()].filter((v) => v.length).length}`);
  console.log(`\nQuestion: does a walkover at year t predict continued movement TOWARD its own`);
  console.log(`winner, n cycles later, beyond what a contested win at the SAME starting lean`);
  console.log(`already predicts? Movement is share points, which this repo's scale makes pips.\n`);

  const byHorizon = new Map<number, Obs[]>();
  for (const n of [1, 2, 3]) {
    const obs: Obs[] = [];
    for (const [u, rs] of byUnit) {
      for (const r of rs) {
        const base = looBaseline(u, r);
        if (base === undefined) continue;
        const winnerD = r.dem > r.rep;
        const leanTowardWinner = winnerD ? base : 100 - base;
        const future = byUnitYear.get(`${u}|${r.year + 2 * n}`);
        if (!future) continue;
        const walk = new Map<number, boolean>();
        for (const [pp] of THRESHOLDS) walk.set(pp, isWalkover(r, pp));
        obs.push({ unit: u, year: r.year, baseline: leanTowardWinner, bin: binOf(leanTowardWinner), futureShare: winnerD ? share(future) : 100 - share(future), walk });
      }
    }
    byHorizon.set(n, obs);
  }

  const summary: { label: string; pooled: number }[] = [];
  for (const [pp, label] of THRESHOLDS) {
    console.log(`=== threshold: ${label} ===`);
    console.log(`  horizon   n(walk)   n(cont)   effect (share pts = pips)   bootstrap SE     z`);
    const effects: number[] = [];
    for (const n of [1, 2, 3]) {
      const obs = byHorizon.get(n)!;
      const e = stratifiedEffect(obs, pp);
      const se = bootstrapSE(obs, pp);
      effects.push(e.effect);
      console.log(`  t+${n}       ${String(e.nWalk).padStart(6)}   ${String(e.nCont).padStart(6)}      ${f2(e.effect).padStart(8)}                  ${f2(se).padStart(6)}      ${(e.effect / se).toFixed(2)}`);
    }
    const pooled = mean(effects.filter((x) => !Number.isNaN(x)));
    summary.push({ label, pooled });
    console.log(`  mean across t+1..t+3: ${f2(pooled)} share pts = pips\n`);
  }

  console.log(`=== summary: pooled effect (share pts = pips) by threshold ===`);
  for (const s of summary) console.log(`  ${s.label.padEnd(24)} ${f2(s.pooled)}`);
}

main();
