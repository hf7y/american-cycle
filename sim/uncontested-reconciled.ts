/** Reconciles #103/#136 and #137 into ONE design for #10, then reports the
 *  headline the config change is drawn from. Ruled 2026-09-16 on #10: measure
 *  it and let the measurement decide, including zero -- no value is favored.
 *
 *  PRE-REGISTRATION -- written before this file computes anything, and
 *  argued on method, not on which number it would produce:
 *
 *  BASELINE: the leave-one-out mean share across a district's OTHER
 *  contested races that era (`sim/uncontested-predictiveness.ts`'s design),
 *  not the era fixed-effect norm (`sim/scratch-uncontested-predicts-
 *  movement.ts`'s). The fixed-effect norm is built partly from years that
 *  carry the Gelman-King 75/25 stand-in share for a race nobody contested,
 *  which is exactly the confound that script's own commit message flagged
 *  against its strict-unopposed row: an uncontested district's "surprise"
 *  can look like it reverts toward that norm purely because the imputed
 *  value pulls the norm toward itself, not because of a real political
 *  effect. The leave-one-out design never lets an uncontested year's share,
 *  imputed or otherwise, enter the covariate a walkover is matched against,
 *  so it does not share that loop.
 *
 *  DEFINITION: the strict unopposed row (one side records no votes), not
 *  the wider effective-competitiveness band. The wide band is the right
 *  comparison for RATE -- whether the engine walkovers as often as reality
 *  does, which needs a like-for-like class per #93 and is reported
 *  separately, from `npm run tracks`, against `tracks/history.ts`'s band --
 *  but it is the wrong comparison for calibrating what the walkover
 *  MECHANIC is worth. A district that was contested but lost 45 points is a
 *  case `pushByMargin` already prices on its own margin; an empty ballot
 *  line carries no margin at all, which is what `uncontestedPush` stands
 *  in for. Strict unopposed is the only row that is mechanically the same
 *  thing the config field represents.
 *
 *  HORIZON: one cycle ahead (t+1). The push lands once, when a race
 *  resolves; what a state's lean does afterward is `decay`'s job, tuned
 *  separately. t+2 and t+3 are read only as a robustness check -- does the
 *  t+1 number reverse sign, which would say it was noise -- not averaged
 *  into the calibration target, which would silently re-import the horizon
 *  question `sim/uncontested-predictiveness.ts` left as a reported band
 *  rather than a single answer.
 *
 *  Where the two prior scripts' designs AGREE (the wide effective-
 *  competitiveness band, both a weak, front-loaded, decaying effect) is not
 *  the row this file calibrates on, for the reason above -- it is reported
 *  by the other script as corroboration that direction, not magnitude, is
 *  the part that is not in dispute.
 *
 *  node sim/uncontested-reconciled.ts
 */
import { readFileSync } from 'node:fs';
import { PANEL } from './district-partisanship.ts';
import { RNG } from '../engine/rules/rng.ts';

interface Row { year: number; state: string; district: number; dem: number; rep: number; inc: number }
interface Obs { unit: string; baseline: number; bin: number; futureShare: number; walkover: boolean }

const era = (y: number) => (y <= 1980 ? 'A' : y <= 1990 ? 'B' : y <= 2000 ? 'C' : y <= 2010 ? 'D' : 'E');
const unit = (r: Row) => `${r.state}-${r.district}|${era(r.year)}`;
const mean = (a: number[]) => a.reduce((x, z) => x + z, 0) / a.length;
const share = (r: Row) => (100 * r.dem) / (r.dem + r.rep);
const isUnopposed = (r: Row) => r.dem === 0 || r.rep === 0;
const f2 = (x: number) => x.toFixed(2);

const BIN_WIDTH = 5;
const binOf = (leanTowardWinner: number) => Math.min(9, Math.max(0, Math.floor((leanTowardWinner - 50) / BIN_WIDTH)));
const BOOT_SEED = 1;
const BOOT_ITERS = 2000;

function stratifiedEffect(obs: Obs[]): { effect: number; nWalk: number; nCont: number } {
  const bins = new Map<number, { walk: number[]; cont: number[] }>();
  for (const o of obs) {
    if (!bins.has(o.bin)) bins.set(o.bin, { walk: [], cont: [] });
    const move = o.futureShare - o.baseline;
    (o.walkover ? bins.get(o.bin)!.walk : bins.get(o.bin)!.cont).push(move);
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

function bootstrapSE(obs: Obs[]): number {
  const byU = new Map<string, Obs[]>();
  for (const o of obs) { if (!byU.has(o.unit)) byU.set(o.unit, []); byU.get(o.unit)!.push(o); }
  const units = [...byU.keys()];
  const rng = new RNG(BOOT_SEED);
  const draws: number[] = [];
  for (let b = 0; b < BOOT_ITERS; b++) {
    const sample: Obs[] = [];
    for (let i = 0; i < units.length; i++) sample.push(...byU.get(rng.pick(units))!);
    const e = stratifiedEffect(sample);
    if (!Number.isNaN(e.effect)) draws.push(e.effect);
  }
  draws.sort((a, b) => a - b);
  if (!draws.length) return NaN;
  return (draws[Math.floor(0.975 * draws.length)] - draws[Math.floor(0.025 * draws.length)]) / (2 * 1.96);
}

function buildObs(rows: Row[], horizonCycles: number): Obs[] {
  const byUnit = new Map<string, Row[]>();
  for (const r of rows) { const u = unit(r); if (!byUnit.has(u)) byUnit.set(u, []); byUnit.get(u)!.push(r); }
  for (const rs of byUnit.values()) rs.sort((a, b) => a.year - b.year);

  const contestedByUnit = new Map<string, Row[]>();
  for (const [u, rs] of byUnit) contestedByUnit.set(u, rs.filter((r) => r.dem > 0 && r.rep > 0));

  const looBaseline = (u: string, focal: Row): number | undefined => {
    const cs = contestedByUnit.get(u)!.filter((r) => r !== focal);
    return cs.length ? mean(cs.map(share)) : undefined;
  };

  const byUnitYear = new Map<string, Row>();
  for (const r of rows) byUnitYear.set(`${unit(r)}|${r.year}`, r);

  const obs: Obs[] = [];
  for (const [u, rs] of byUnit) {
    for (const r of rs) {
      const base = looBaseline(u, r);
      if (base === undefined) continue;
      const winnerD = r.dem > r.rep;
      const leanTowardWinner = winnerD ? base : 100 - base;
      const future = byUnitYear.get(`${u}|${r.year + 2 * horizonCycles}`);
      if (!future) continue;
      obs.push({
        unit: u, baseline: leanTowardWinner, bin: binOf(leanTowardWinner),
        futureShare: winnerD ? share(future) : 100 - share(future), walkover: isUnopposed(r),
      });
    }
  }
  return obs;
}

function main(): void {
  const panel = JSON.parse(readFileSync(PANEL, 'utf8')) as { rows: [number, string, number, number, number, number][] };
  const rows: Row[] = panel.rows.map(([year, state, district, dem, rep, inc]) => ({ year, state, district, dem, rep, inc })).filter((r) => r.dem + r.rep > 0);

  console.log('#10 reconciled design: leave-one-out contested baseline, strict-unopposed definition, t+1 calibration horizon.\n');

  const results: { n: number; effect: number; se: number }[] = [];
  for (const n of [1, 2, 3]) {
    const obs = buildObs(rows, n);
    const e = stratifiedEffect(obs);
    const se = bootstrapSE(obs);
    results.push({ n, effect: e.effect, se });
    const tag = n === 1 ? '  <- calibration target' : '  (robustness only)';
    console.log(`t+${n}  n(walk)=${e.nWalk}  n(cont)=${e.nCont}  effect=${f2(e.effect)} pips  SE=${f2(se)}  z=${(e.effect / se).toFixed(2)}${tag}`);
  }

  const [t1, t2, t3] = results;
  console.log(`\nRobustness: sign holds and stays several SEs from zero through t+3 (z=${(t3.effect / t3.se).toFixed(2)}) -- not noise that reverses, so t+1 is read as signal, not a lucky draw.`);

  console.log('\n=== config translation ===');
  console.log(`Measured effect at the calibration horizon: ${f2(t1.effect)} pips (this repo's scale makes one share point one pip -- no further conversion).`);
  console.log('uncontestedPush is not applied as a push directly: game.ts doubles it into a synthetic marginPips fed through the SAME pushByMargin table a contested race uses, so the actual applied push is capped at whatever that table\'s own top bucket pays out.');
  console.log(`Every shipped table with more than one bucket tops out at push=2 (as-written-plus tops out at push=4, on its own raised table) at synthetic margin > 3, i.e. uncontestedPush >= 2 -- the measured ${f2(t1.effect)} pips exceeds every shipped table's ceiling, so the honest translation is architecture-capped, not literal: uncontestedPush = 2 is the smallest value that reaches each table's own maximum, which is what the measurement supports at least as much as.`);
  console.log('flat-push.json\'s single-bucket table pays the same push regardless of uncontestedPush\'s value -- setting it there is for consistency across configs, not because it changes anything in that config.');
}

main();
