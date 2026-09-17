/** hf7y/american-cycle#240, RULED 2026-09-16 by @hf7y: no hand-built identity
 *  classification survives on taste. A tag (existing or candidate) is kept
 *  only if its coefficient is significant against the real MEDSL returns,
 *  with district-clustered errors and a multiple-comparison correction. This
 *  is a reusable tool, not a one-shot script -- it tests `engine/rules/tags
 *  .ts`'s CURRENT `TAGS`, whatever that is, so re-running it after a future
 *  vocabulary change re-derives the same audit rather than going stale.
 *
 *  First run (11-tag vocabulary, 2026-09-17): `catholic`, `evangelical` and
 *  `jewish` did not survive and were dropped from `IdentityTag` -- see
 *  hf7y/american-cycle#240's thread for the full table. `black` was the only
 *  tag to survive Holm correction; `hispanic`/`cuban`/`union`/`rural`/
 *  `suburban`/`urban`/`farm` also failed but were left in place pending a
 *  separate, wider-blast-radius decision (they feed #19's identityWeights
 *  rollout too) -- see the follow-up issue that thread links.
 *
 *  MODEL, STATED BEFORE RUNNING (per the ruling):
 *    dem_share_it = b0 + sum_k beta_k * tag_k(i) + gamma * incumbency_it
 *                   + year FE + e_it
 *  -- district-year rows (`i` = district-era unit, `t` = election year),
 *  contested races only, drawn from the same four MEDSL-matched packs and
 *  the same district-era join `findings/district-fit.ts` (#163) already
 *  validated (card era bucket <-> real district-era, cardKey's at-large
 *  fallback). Tag dummies are constant within a district-era, so unit fixed
 *  effects are NOT included -- they would be collinear with exactly the
 *  coefficients this model exists to estimate; year dummies alone absorb
 *  the national swing.
 *
 *  Standard errors: cluster-robust (CR1 sandwich, Stata-style small-sample
 *  correction), clustered by district-era -- the panel's repeated-measures
 *  unit -- not by raw district, since a district's era bucket is the level
 *  at which tags and the underlying place are fixed.
 *
 *  Correction: Holm-Bonferroni step-down, family-wise alpha = 0.05, over the
 *  tag coefficients only (year dummies and incumbency are controls, not
 *  candidates for the vocabulary, and are not part of the corrected family).
 *  Holm over Bonferroni because it is uniformly more powerful for the same
 *  guarantee; over Benjamini-Hochberg because this decision prunes the
 *  shipped vocabulary and should control the family-wise error rate, not the
 *  expected false-discovery proportion.
 *
 *  WALL, named rather than routed around: #240's candidate list also included
 *  USRC religious traditions this vocabulary never carried (Mainline, Black
 *  Protestant, Orthodox, LDS, other, unaffiliated). `data/historical/
 *  usrc_county_religion.json` and its crosswalk are both 118th-Congress-
 *  boundary (2022 redistricting, first used 2022) -- and the MEDSL panel this
 *  model regresses against ends in 2018, entirely on PRE-2022 maps across
 *  every one of its five redistricting eras. There is no year where the two
 *  sources describe the same district lines, so those six candidates cannot
 *  be joined to real returns without a fresh, era-matched geography pull (a
 *  different Census/Geocorr vintage per era) nothing here attempts.
 *
 *  node sim/tag-significance.ts
 */
import { readFileSync } from 'node:fs';
import { loadPacks } from './harness.ts';
import { era, mean } from './district-partisanship.ts';
import { TAGS } from '../engine/rules/tags.ts';
import type { DistrictCard, IdentityTag } from '../engine/types/index.ts';

const PANEL_PACKS = ['1976', '1992', '2008', '2016'];
const ALPHA = 0.05;

// ---------------------------------------------------------------- data join

interface Row { year: number; state: string; district: number; dem: number; rep: number; inc: number }

function panelRows(): Row[] {
  const p = JSON.parse(readFileSync(new URL('../data/historical/house_district_panel.json', import.meta.url), 'utf8'));
  return (p.rows as [number, string, number, number, number, number][])
    .map(([year, state, district, dem, rep, inc]) => ({ year, state, district, dem, rep, inc }));
}

/** Same key and at-large fallback as `findings/district-fit.ts`'s `cardKey`,
 *  inverted to look a real panel row up against the card pool instead. */
function cardFor(row: Row, byKey: Map<string, DistrictCard>): DistrictCard | undefined {
  const bucket = era(row.year);
  const direct = byKey.get(`${row.state}-${row.district}|${bucket}`);
  if (direct) return direct;
  if (row.district === 0) return byKey.get(`${row.state}-1|${bucket}`);
  return undefined;
}

interface Obs { y: number; inc: number; year: number; cluster: string; tags: Set<IdentityTag> }

function buildSample(): Obs[] {
  const cards = loadPacks(PANEL_PACKS).filter((c) => c.kind === 'district') as (DistrictCard & { kind: 'district' })[];
  const byKey = new Map<string, DistrictCard>();
  for (const c of cards) byKey.set(`${c.state}-${c.number}|${era(c.era)}`, c);
  const contested = panelRows().filter((r) => r.dem > 0 && r.rep > 0);
  const obs: Obs[] = [];
  for (const r of contested) {
    const card = cardFor(r, byKey);
    if (!card) continue;
    obs.push({
      y: 100 * r.dem / (r.dem + r.rep), inc: r.inc, year: r.year,
      cluster: `${r.state}-${r.district}|${era(r.year)}`,
      tags: new Set(card.demographics),
    });
  }
  return obs;
}

// -------------------------------------------------------------------- OLS

function zeros(n: number): number[] { return new Array(n).fill(0); }
function zerosMat(r: number, c: number): number[][] { return Array.from({ length: r }, () => zeros(c)); }

function matInverse(a: number[][]): number[][] {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...zeros(n).map((_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    if (Math.abs(m[piv][col]) < 1e-12) throw new Error(`singular design matrix at column ${col} -- a tag is collinear with the year/incumbency controls`);
    [m[col], m[piv]] = [m[piv], m[col]];
    const pv = m[col][col];
    for (let j = 0; j < 2 * n; j++) m[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[col][j];
    }
  }
  return m.map((row) => row.slice(n));
}

function matVec(a: number[][], v: number[]): number[] {
  return a.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
}

interface Design { X: number[][]; y: number[]; names: string[]; clusters: string[] }

function design(obs: Obs[]): Design {
  const years = [...new Set(obs.map((o) => o.year))].sort((a, b) => a - b);
  const refYear = years[0];
  const yearCols = years.slice(1);
  const names = ['intercept', 'incumbency', ...yearCols.map((y) => `year:${y}`), ...TAGS.map((t) => `tag:${t}`)];
  const X = obs.map((o) => {
    const row = [1, o.inc, ...yearCols.map((y) => (o.year === y ? 1 : 0)), ...TAGS.map((t) => (o.tags.has(t) ? 1 : 0))];
    return row;
  });
  void refYear;
  return { X, y: obs.map((o) => o.y), names, clusters: obs.map((o) => o.cluster) };
}

interface Fit { beta: number[]; se: number[]; names: string[]; n: number; nClusters: number }

function fitClustered(d: Design): Fit {
  const { X, y, names, clusters } = d;
  const k = names.length, n = X.length;
  const XtX = zerosMat(k, k);
  const Xty = zeros(k);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const XtXinv = matInverse(XtX);
  const beta = matVec(XtXinv, Xty);

  // CR1 sandwich: sum over clusters of X_g' u_g u_g' X_g, sandwiched between
  // (X'X)^-1, with the Cameron-Gelbach-Miller small-sample factor.
  const byCluster = new Map<string, number[]>();
  clusters.forEach((c, i) => { if (!byCluster.has(c)) byCluster.set(c, []); byCluster.get(c)!.push(i); });
  const meat = zerosMat(k, k);
  for (const idx of byCluster.values()) {
    const score = zeros(k);
    for (const i of idx) {
      const yhat = X[i].reduce((s, x, a) => s + x * beta[a], 0);
      const u = y[i] - yhat;
      for (let a = 0; a < k; a++) score[a] += X[i][a] * u;
    }
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) meat[a][b] += score[a] * score[b];
  }
  const G = byCluster.size;
  const scale = (G / (G - 1)) * ((n - 1) / (n - k));
  // sandwich = XtXinv * meat * XtXinv
  const tmp = zerosMat(k, k);
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
    let s = 0; for (let c = 0; c < k; c++) s += XtXinv[a][c] * meat[c][b];
    tmp[a][b] = s;
  }
  const sandwich = zerosMat(k, k);
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
    let s = 0; for (let c = 0; c < k; c++) s += tmp[a][c] * XtXinv[c][b];
    sandwich[a][b] = s * scale;
  }
  const se = names.map((_, a) => Math.sqrt(Math.max(0, sandwich[a][a])));
  return { beta, se, names, n, nClusters: G };
}

// ------------------------------------------------------------- inference

/** Abramowitz & Stegun 7.1.26, |error| < 1.5e-7 -- plenty for a p-value read
 *  off a plot, and this repo has no stats dependency to reach for instead. */
function erf(x: number): number {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return s * y;
}
function normalCdf(z: number): number { return 0.5 * (1 + erf(z / Math.SQRT2)); }
function twoSidedP(t: number): number { return 2 * (1 - normalCdf(Math.abs(t))); }

/** Holm-Bonferroni step-down, family-wise alpha. Returns which indices (into
 *  the original, unsorted array) reject the null. */
function holm(pValues: number[], alpha: number): boolean[] {
  const m = pValues.length;
  const order = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const reject = new Array(m).fill(false);
  for (let rank = 0; rank < m; rank++) {
    const { p, i } = order[rank];
    if (p <= alpha / (m - rank)) reject[i] = true;
    else break; // step-down: first failure stops further rejection
  }
  return reject;
}

// ------------------------------------------------------------------- main

function main(): void {
  const obs = buildSample();
  console.log(`sample: ${obs.length} contested district-year rows, ${new Set(obs.map((o) => o.cluster)).size} district-era clusters`);
  console.log(`model: dem_share ~ intercept + incumbency + year FE + [${TAGS.join(', ')}]`);
  console.log(`SEs: cluster-robust (CR1, Cameron-Gelbach-Miller small-sample correction), clustered by district-era`);
  console.log(`correction: Holm-Bonferroni step-down, family-wise alpha=${ALPHA}, over the ${TAGS.length} tag coefficients only\n`);

  const d = design(obs);
  const f = fitClustered(d);
  console.log(`N=${f.n}  clusters=${f.nClusters}  columns=${f.names.length}\n`);

  const tagIx = TAGS.map((t) => f.names.indexOf(`tag:${t}`));
  const tagP = tagIx.map((ix) => twoSidedP(f.beta[ix] / f.se[ix]));
  const rejected = holm(tagP, ALPHA);

  console.log(`${'tag'.padEnd(12)}${'coef(pips)'.padStart(12)}${'SE'.padStart(10)}${'t'.padStart(8)}${'p'.padStart(10)}${'holm-sig'.padStart(10)}`);
  TAGS.forEach((tag, j) => {
    const ix = tagIx[j];
    const t = f.beta[ix] / f.se[ix];
    console.log(`${tag.padEnd(12)}${f.beta[ix].toFixed(2).padStart(12)}${f.se[ix].toFixed(2).padStart(10)}${t.toFixed(2).padStart(8)}${tagP[j].toFixed(4).padStart(10)}${(rejected[j] ? 'YES' : 'no').padStart(10)}`);
  });

  const kept = TAGS.filter((_, j) => rejected[j]);
  const dropped = TAGS.filter((_, j) => !rejected[j]);
  console.log(`\nsignificant at Holm-corrected alpha=${ALPHA}: ${kept.length ? kept.join(', ') : '(none)'}`);
  console.log(`NOT significant: ${dropped.length ? dropped.join(', ') : '(none)'}`);
  void mean;
}

if (import.meta.filename === process.argv[1]) main();
