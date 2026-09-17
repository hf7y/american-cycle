/** #240 -- RULED 2026-09-16 by @hf7y: no hand-built classification. A tag is
 *  kept only if it is statistically significant, decided by one model of
 *  district two-party share on the real MEDSL panel, every candidate tag
 *  entered together, coefficient significant with district-clustered errors
 *  and a multiple-comparison correction, effect sizes reported next to
 *  p-values. This file is that model, stated below before it is run.
 *
 *  MODEL: y_it = alpha_year(t) + beta*inc_it + sum_k gamma_k*tag_k,i + eps_it
 *    y     -- two-party Dem vote share, share points (contested races only,
 *             same population sim/district-partisanship.ts calls P1).
 *    i     -- a district-era unit: one card in the pack matching that
 *             election's redistricting era, keyed by state+number+era.
 *    t     -- election year. alpha_year absorbs the national swing.
 *    inc   -- incumbency (+1 D incumbent, -1 R, 0 open/both), a control,
 *             not a candidate for the correction below.
 *    tag_k,i -- 0/1, whether the district's card carries that identity tag
 *             in `demographics` for its era (engine/rules/tags.ts's TAGS,
 *             the vocabulary currently shipped or hand-assigned).
 *  Estimated by Frisch-Waugh: y, inc and every tag_k demeaned within year,
 *  then one multivariate OLS on the residualised variables -- algebraically
 *  identical to fitting year dummies directly, cheaper to invert.
 *  ERRORS: cluster-robust (CR1 sandwich, small-sample corrected) clustered
 *  by district-era unit. A district contributes 3-5 correlated elections in
 *  its era, not independent draws (Moulton problem) -- plain OLS SEs would
 *  overstate precision, which is exactly why the ruling asks for clustering
 *  rather than IID errors.
 *  CORRECTION: Holm-Bonferroni step-down across the tag coefficients only
 *  (incumbency is a control). ALPHA = 0.05.
 *
 *  CANDIDATES ACTUALLY TESTED: the 11 tags in engine/rules/tags.ts's TAGS,
 *  joined at district-era grain from the cards' own demographics.
 *
 *  NOT TESTED HERE -- Zach's ruling also named the six USRC religious
 *  traditions this vocabulary has no slot for (mainline, black-protestant,
 *  orthodox, LDS, other, unaffiliated). No district-era covariate exists for
 *  them that joins to this panel: sim/district-religion.ts's county data is
 *  2020-vintage, reachable only through #239's crosswalk to 118th Congress
 *  lines, and house_district_panel.json's last year is 2018 -- the panel
 *  never observes an election on that map. Testing those six needs either
 *  historical religious-adherence data on 1976-2018 district lines or
 *  2022/2024 MEDSL returns on 118th Congress lines; neither is in this repo.
 *  Filed as a follow-up rather than joined on a map that doesn't match.
 *
 *  ERA COVERAGE: a district-era unit needs both a panel year and a pack.
 *  Packs exist for 1976 (era A, 1976-80), 1992 (era C, 1992-2000), 2008
 *  (era D, 2002-10) and 2016 (era E, 2012-18). Era B (1982-90) has no pack
 *  and is skipped -- no card demographics exist for it. Packs 1932 and 1964
 *  predate the panel entirely; pack-2024 uses 118th Congress lines the
 *  panel never reaches (same map mismatch as the religion gap above) -- both
 *  excluded from the join, not just unused.
 *
 *  node sim/tag-significance.ts
 */
import { readFileSync } from 'node:fs';
import { TAGS } from '../engine/rules/tags.ts';
import type { IdentityTag } from '../engine/types/index.ts';

const PANEL = 'data/historical/house_district_panel.json';
const ALPHA = 0.05;

interface Row { year: number; state: string; district: number; dem: number; rep: number; inc: number }

function loadPanel(): Row[] {
  const panel = JSON.parse(readFileSync(PANEL, 'utf8')) as { rows: [number, string, number, number, number, number][] };
  return panel.rows.map(([year, state, district, dem, rep, inc]) => ({ year, state, district, dem, rep, inc }));
}

const era = (y: number) => (y <= 1980 ? 'A' : y <= 1990 ? 'B' : y <= 2000 ? 'C' : y <= 2010 ? 'D' : 'E');
const PACK_FOR_ERA: Record<string, string> = {
  A: 'data/pack-1976.json', C: 'data/pack-1992.json', D: 'data/pack-2008.json', E: 'data/pack-2016.json',
};

interface DistrictCard { kind: string; state: string; number: number; era: number; demographics: IdentityTag[] }

const packCache = new Map<string, DistrictCard[]>();
function cardsFor(path: string): DistrictCard[] {
  const cached = packCache.get(path);
  if (cached) return cached;
  const d = JSON.parse(readFileSync(path, 'utf8'));
  const all = Array.isArray(d) ? d : d.cards;
  const cards: DistrictCard[] = all.filter((c: { kind: string }) => c.kind === 'district');
  packCache.set(path, cards);
  return cards;
}

/** A state with exactly one district card in this pack is at-large -- its
 *  panel `district` code (0 for MEDSL at-large seats) does not need to
 *  match the card's own printed number, same convention
 *  sim/district-demographics.ts already uses for the ACS join. */
function matchCard(cards: DistrictCard[], state: string, district: number): DistrictCard | undefined {
  const inState = cards.filter((c) => c.state === state);
  if (inState.length === 1) return inState[0];
  return inState.find((c) => c.number === district);
}

interface Obs { y: number; inc: number; unit: string; year: number; tags: Set<IdentityTag> }

function buildObs(): { obs: Obs[]; matched: number; unmatched: number; noPackEra: number } {
  const rows = loadPanel().filter((r) => r.dem > 0 && r.rep > 0);
  const obs: Obs[] = [];
  let matched = 0, unmatched = 0, noPackEra = 0;
  for (const r of rows) {
    const e = era(r.year);
    const packPath = PACK_FOR_ERA[e];
    if (!packPath) { noPackEra++; continue; }
    const card = matchCard(cardsFor(packPath), r.state, r.district);
    if (!card) { unmatched++; continue; }
    matched++;
    obs.push({
      y: 100 * r.dem / (r.dem + r.rep), inc: r.inc, year: r.year,
      unit: `${card.state}-${card.number}|${card.era}`,
      tags: new Set(card.demographics),
    });
  }
  return { obs, matched, unmatched, noPackEra };
}

// ------------------------------------------------------------- linear algebra

function invert(a: number[][]): number[][] {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    if (Math.abs(m[piv][col]) < 1e-12) throw new Error(`design matrix is singular at column ${col} -- a tag is collinear with another or with incumbency`);
    [m[col], m[piv]] = [m[piv], m[col]];
    const p = m[col][col];
    for (let j = 0; j < 2 * n; j++) m[col][j] /= p;
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

// ------------------------------------------------------- t-distribution p-value

function gammaln(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - gammaln(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-tailed P(|T_df| > |t|). */
function tTestPValue(t: number, df: number): number {
  return betai(df / 2, 0.5, df / (df + t * t));
}

// ------------------------------------------------------------------ the model

interface Coef { name: string; beta: number; se: number; t: number; p: number }

function fitClustered(obs: Obs[], regressors: string[], tagOf: (o: Obs, r: string) => number): { coefs: Coef[]; df: number; n: number; g: number } {
  const byYear = new Map<number, number[]>();
  obs.forEach((o, i) => { if (!byYear.has(o.year)) byYear.set(o.year, []); byYear.get(o.year)!.push(i); });
  const demean = (v: number[]) => {
    const out = v.slice();
    for (const idx of byYear.values()) {
      const m = idx.reduce((s, i) => s + v[i], 0) / idx.length;
      for (const i of idx) out[i] -= m;
    }
    return out;
  };
  const yT = demean(obs.map((o) => o.y));
  const cols = regressors.map((r) => demean(obs.map((o) => tagOf(o, r))));
  const n = obs.length, k = regressors.length;

  const XtX = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) =>
    cols[a].reduce((s, _, i) => s + cols[a][i] * cols[b][i], 0)));
  const XtXinv = invert(XtX);
  const Xty = cols.map((col) => col.reduce((s, x, i) => s + x * yT[i], 0));
  const beta = matVec(XtXinv, Xty);

  const resid = yT.map((y, i) => y - cols.reduce((s, col, a) => s + col[i] * beta[a], 0));

  const byUnit = new Map<string, number[]>();
  obs.forEach((o, i) => { if (!byUnit.has(o.unit)) byUnit.set(o.unit, []); byUnit.get(o.unit)!.push(i); });
  const meat = Array.from({ length: k }, () => new Array(k).fill(0));
  for (const idx of byUnit.values()) {
    const s = new Array(k).fill(0);
    for (const i of idx) for (let a = 0; a < k; a++) s[a] += cols[a][i] * resid[i];
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) meat[a][b] += s[a] * s[b];
  }
  const g = byUnit.size;
  const dfResid = n - k;
  const correction = (g / (g - 1)) * ((n - 1) / dfResid);
  // Var = (X'X)^-1 * meat * (X'X)^-1, scaled by the small-sample correction.
  const bread = XtXinv;
  const varMat = matMul(matMul(bread, meat), bread).map((row) => row.map((x) => x * correction));

  const coefs: Coef[] = regressors.map((name, a) => {
    const se = Math.sqrt(Math.max(0, varMat[a][a]));
    const t = beta[a] / se;
    const p = tTestPValue(t, g - 1);
    return { name, beta: beta[a], se, t, p };
  });
  return { coefs, df: g - 1, n, g };
}

function matMul(a: number[][], b: number[][]): number[][] {
  return a.map((row) => b[0].map((_, j) => row.reduce((s, x, k2) => s + x * b[k2][j], 0)));
}

/** Holm-Bonferroni step-down: sorted ascending, reject H_(i) while
 *  p_(i) <= alpha/(m-i+1) (1-indexed); the first failure stops rejection
 *  for it and everything ranked after it. */
function holm(coefs: Coef[], alpha: number): Map<string, { rank: number; threshold: number; survives: boolean }> {
  const sorted = [...coefs].sort((a, b) => a.p - b.p);
  const m = sorted.length;
  const out = new Map<string, { rank: number; threshold: number; survives: boolean }>();
  let stopped = false;
  sorted.forEach((c, i) => {
    const threshold = alpha / (m - i);
    const survives = !stopped && c.p <= threshold;
    if (!survives) stopped = true;
    out.set(c.name, { rank: i + 1, threshold, survives });
  });
  return out;
}

function main(): void {
  const { obs, matched, unmatched, noPackEra } = buildObs();
  console.log(`MODEL: y_it = alpha_year(t) + beta*inc_it + sum_k gamma_k*tag_k,i + eps_it`);
  console.log(`  y = two-party Dem share (share pts = pips), errors clustered by district-era unit, Holm-Bonferroni correction, ALPHA = ${ALPHA}\n`);
  console.log(`join: ${matched} district-year rows matched to a card, ${unmatched} unmatched (no card at that state+district in the era's pack), ${noPackEra} skipped (era B, no pack)`);

  const counts = new Map<IdentityTag, number>();
  for (const o of obs) for (const t of o.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const testable = TAGS.filter((t) => (counts.get(t) ?? 0) >= 3);
  const skipped = TAGS.filter((t) => !testable.includes(t));
  console.log(`tag coverage in the joined sample: ${TAGS.map((t) => `${t}=${counts.get(t) ?? 0}`).join(' ')}`);
  if (skipped.length) console.log(`excluded from the model (fewer than 3 matched rows carry it, cannot estimate a coefficient): ${skipped.join(', ')}`);

  // rural/suburban/urban are a near-exhaustive partition of the card set
  // (every district but a handful carries exactly one) -- entering all
  // three as separate dummies wastes a degree of freedom on a category
  // that is implied by the other two and inflates their standard errors
  // for it. 'urban' is dropped as the omitted reference category, same
  // correction any k-way partition needs; rural/suburban coefficients are
  // then read relative to urban, not in isolation.
  const REFERENCE_CATEGORY: IdentityTag = 'urban';
  const modelTags = testable.filter((t) => t !== REFERENCE_CATEGORY);
  if (testable.includes(REFERENCE_CATEGORY)) console.log(`'${REFERENCE_CATEGORY}' held out as the reference category for the rural/suburban/urban partition -- its coefficient is not estimated directly`);

  const regressors = ['inc', ...modelTags];
  const tagOf = (o: Obs, r: string) => (r === 'inc' ? o.inc : o.tags.has(r as IdentityTag) ? 1 : 0);
  const { coefs, df, n, g } = fitClustered(obs, regressors, tagOf);
  const tagCoefs = coefs.filter((c) => c.name !== 'inc');
  const decisions = holm(tagCoefs, ALPHA);

  console.log(`\nN=${n} district-year observations, G=${g} district-era clusters, df=${df}\n`);
  const incC = coefs.find((c) => c.name === 'inc')!;
  console.log(`  inc (control)  beta=${incC.beta.toFixed(2)}  se=${incC.se.toFixed(2)}  t=${incC.t.toFixed(2)}  p=${incC.p.toFixed(4)}`);
  console.log(`\n${'tag'.padEnd(12)}${'beta(pips)'.padStart(11)}${'se'.padStart(9)}${'t'.padStart(8)}${'p'.padStart(10)}${'holm-thresh'.padStart(13)}  verdict`);
  for (const c of [...tagCoefs].sort((a, b) => a.p - b.p)) {
    const d = decisions.get(c.name)!;
    console.log(
      `${c.name.padEnd(12)}${c.beta.toFixed(2).padStart(11)}${c.se.toFixed(2).padStart(9)}${c.t.toFixed(2).padStart(8)}` +
      `${c.p.toFixed(4).padStart(10)}${d.threshold.toFixed(4).padStart(13)}  ${d.survives ? 'SURVIVES' : 'fails'}`,
    );
  }
  const survivors = tagCoefs.filter((c) => decisions.get(c.name)!.survives).map((c) => c.name);
  const failures = tagCoefs.filter((c) => !decisions.get(c.name)!.survives).map((c) => c.name);
  console.log(`\nSURVIVES Holm-Bonferroni at alpha=${ALPHA}: ${survivors.length ? survivors.join(', ') : '(none)'}`);
  console.log(`fails (drop, not statistically distinguishable from noise once every other tag is controlled for): ${failures.length ? failures.join(', ') : '(none)'}`);
  if (skipped.length) console.log(`untested (too few matched cards to fit): ${skipped.join(', ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
