/** How much of a House result is the DISTRICT? — the pip value of a party match.
 *
 *  The engine's settled scale fixes 1 pip = 2 points of margin (DECISIONS.md).
 *  A district's Democratic share of the two-party vote is half its margin, so
 *  **one point of two-party vote share is exactly one pip** and every number
 *  below is printed in share points. Multiply by 2 for margin.
 *
 *  `data/historical/house_margins.json` is a flat array of absolute margins
 *  with no district, year or party attached, so none of this is computable
 *  from it. The panel this reads keeps the identifiers; its provenance and the
 *  exact transform are recorded in its own `source` and `transform` blocks.
 *
 *  Decomposition: dem two-party share ~ district-era FE + year FE + incumbency,
 *  estimated by alternating projections. District identity is scoped to a
 *  redistricting era (1976-80, 1982-90, 1992-2000, 2002-10, 2012-18) because a
 *  district number means a different place on each new map.
 *
 *  Three numbers are reported for the district effect because the in-sample one
 *  is wrong: with only 3-5 elections per district-era, Var(FE) carries the
 *  residual's sampling variance. The split-half covariance is unbiased, and the
 *  leave-one-out effect is what an honest prediction of an unseen race gets.
 *
 *  node sim/district-partisanship.ts
 *  node sim/district-partisanship.ts --build <path-to-MEDSL-1976-2018-house.csv>
 */
import { readFileSync, writeFileSync } from 'node:fs';

export const PANEL = 'data/historical/house_district_panel.json';
const PRES = 'data/historical/pres_state_panel.json';

export interface Row { year: number; state: string; district: number; dem: number; rep: number; inc: number }
export interface Obs { y: number; inc: number; unit: string; year: number; row: Row }

// ---------------------------------------------------------------- panel build

/** Minimal RFC4180 reader; the MEDSL file quotes fields that contain commas. */
function parseCsv(t: string): string[][] {
  const rows: string[][] = [];
  let f = '', row: string[] = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); f = ''; rows.push(row); row = []; }
    else if (c !== '\r') f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const DEM = new Set(['democrat', 'democratic-farmer-labor', 'democratic-npl']);

function build(csvPath: string): void {
  const raw = parseCsv(readFileSync(csvPath, 'utf8'));
  const hdr = raw[0];
  const ix: Record<string, number> = Object.fromEntries(hdr.map((h, i) => [h, i]));
  interface Cand { votes: number; parties: Set<string> }
  interface Race { year: number; st: string; dist: number; cands: Map<string, Cand> }
  const races = new Map<string, Race>();
  for (const r of raw.slice(1)) {
    if (r.length !== hdr.length) continue;
    if (r[ix.stage] !== 'gen' || r[ix.special] === 'TRUE') continue;
    const key = `${r[ix.year]}|${r[ix.state_po]}|${r[ix.district]}`;
    let g = races.get(key);
    if (!g) { g = { year: +r[ix.year], st: r[ix.state_po], dist: +r[ix.district], cands: new Map() }; races.set(key, g); }
    // Fusion states report the same nominee once per ballot line; the codebook
    // says to aggregate across lines, so candidates are keyed by name.
    const name = (r[ix.candidate] ?? '').trim().toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ');
    let c = g.cands.get(name);
    if (!c) { c = { votes: 0, parties: new Set() }; g.cands.set(name, c); }
    c.votes += Number(r[ix.candidatevotes]) || 0;
    c.parties.add(r[ix.party]);
  }
  interface Agg { year: number; st: string; dist: number; dem: number; rep: number; dName: string | null; rName: string | null; winner: string | null }
  const all: Agg[] = [];
  for (const g of races.values()) {
    const top = (want: 'D' | 'R') => [...g.cands.entries()]
      .filter(([, c]) => c.votes > 0 && (want === 'D' ? [...c.parties].some((p) => DEM.has(p)) : c.parties.has('republican')))
      .sort((a, b) => b[1].votes - a[1].votes);
    const ds = top('D'), rs = top('R');
    const winner = [...g.cands.entries()].sort((a, b) => b[1].votes - a[1].votes)[0];
    all.push({
      year: g.year, st: g.st, dist: g.dist,
      dem: ds.reduce((a, [, c]) => a + c.votes, 0), rep: rs.reduce((a, [, c]) => a + c.votes, 0),
      dName: ds[0]?.[0] ?? null, rName: rs[0]?.[0] ?? null, winner: winner ? winner[0] : null,
    });
  }
  all.sort((a, b) => a.year - b.year || a.st.localeCompare(b.st) || a.dist - b.dist);
  const wins = new Map<string, Set<string>>();
  for (const g of all) {
    if (!g.winner) continue;
    const k = `${g.st}|${g.year}`;
    if (!wins.has(k)) wins.set(k, new Set());
    wins.get(k)!.add(g.winner);
  }
  const rows = all.map((g) => {
    // Matching state-wide rather than district-wide absorbs redistricting and
    // members who move seats; it misses winners of special elections.
    const prev = wins.get(`${g.st}|${g.year - 2}`) ?? new Set<string>();
    const dI = g.dName !== null && prev.has(g.dName), rI = g.rName !== null && prev.has(g.rName);
    return [g.year, g.st, g.dist, g.dem, g.rep, dI && rI ? 0 : dI ? 1 : rI ? -1 : 0];
  });
  const panel = JSON.parse(readFileSync(PANEL, 'utf8'));
  panel.rows = rows;
  writeFileSync(PANEL, JSON.stringify(panel, null, 1).replace(/\n\s+(-?\d)/g, ' $1').replace(/\n\s+\]/g, ' ]'));
  console.log(`rebuilt ${PANEL}: ${rows.length} district-year rows`);
}

// ------------------------------------------------------------------ estimator

export const mean = (a: number[]) => a.reduce((x, z) => x + z, 0) / a.length;
const vr = (a: number[]) => { const m = mean(a); return mean(a.map((z) => (z - m) * (z - m))); };
const cv = (a: number[], b: number[]) => { const ma = mean(a), mb = mean(b); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); return s / a.length; };
const f2 = (x: number) => x.toFixed(2);

/** Redistricting eras. A district number is only the same place inside one. */
export const era = (y: number) => (y <= 1980 ? 'A' : y <= 1990 ? 'B' : y <= 2000 ? 'C' : y <= 2010 ? 'D' : 'E');

export interface Fit {
  beta: number; base: number;
  a: Map<string, number>; g: Map<number, number>;
  byUnit: Map<string, number[]>; nYears: number;
}

export function fit(obs: Obs[]): Fit {
  const byUnit = new Map<string, number[]>(), byYear = new Map<number, number[]>();
  obs.forEach((o, i) => {
    if (!byUnit.has(o.unit)) byUnit.set(o.unit, []);
    byUnit.get(o.unit)!.push(i);
    if (!byYear.has(o.year)) byYear.set(o.year, []);
    byYear.get(o.year)!.push(i);
  });
  const demean = (v: number[]) => {
    const x = v.slice();
    for (let it = 0; it < 500; it++) {
      let worst = 0;
      for (const ii of byUnit.values()) { const m = mean(ii.map((i) => x[i])); worst = Math.max(worst, Math.abs(m)); for (const i of ii) x[i] -= m; }
      for (const ii of byYear.values()) { const m = mean(ii.map((i) => x[i])); worst = Math.max(worst, Math.abs(m)); for (const i of ii) x[i] -= m; }
      if (worst < 1e-10) break;
    }
    return x;
  };
  const yt = demean(obs.map((o) => o.y)), it = demean(obs.map((o) => o.inc));
  let num = 0, den = 0;
  for (let i = 0; i < obs.length; i++) { num += yt[i] * it[i]; den += it[i] * it[i]; }
  const beta = num / den;

  const ys = obs.map((o) => o.y - beta * o.inc);
  const mu = mean(ys);
  const a = new Map([...byUnit.keys()].map((k) => [k, 0]));
  const g = new Map([...byYear.keys()].map((k) => [k, 0]));
  for (let it2 = 0; it2 < 3000; it2++) {
    let worst = 0;
    for (const [k, ii] of byUnit) { const m = mean(ii.map((i) => ys[i] - mu - g.get(obs[i].year)!)); worst = Math.max(worst, Math.abs(m - a.get(k)!)); a.set(k, m); }
    for (const [k, ii] of byYear) { const m = mean(ii.map((i) => ys[i] - mu - a.get(obs[i].unit)!)); worst = Math.max(worst, Math.abs(m - g.get(k)!)); g.set(k, m); }
    const gm = mean([...g.values()]);
    for (const k of g.keys()) g.set(k, g.get(k)! - gm);
    for (const k of a.keys()) a.set(k, a.get(k)! + gm);
    if (worst < 1e-11) break;
  }
  const am = mean(obs.map((o) => a.get(o.unit)!));
  for (const k of a.keys()) a.set(k, a.get(k)! - am);
  return { beta, base: mu + am, a, g, byUnit, nYears: byYear.size };
}

/** 3d6 vs 3d6, ties split — the general odds table (engine/rules/resolution.ts). */
function odds(edge: number): number {
  const p = new Map<number, number>();
  for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) for (let k = 1; k <= 6; k++) { const s = i + j + k; p.set(s, (p.get(s) ?? 0) + 1 / 216); }
  let w = 0, t = 0;
  for (const [x, px] of p) for (const [y, py] of p) { const d = x + edge - y; if (d > 0) w += px * py; else if (d === 0) t += px * py; }
  return 100 * (w + t / 2);
}
/** Smallest edge in pips whose win probability, from the odds table above, reaches `target`. */
const edgeFor = (target: number) => { for (let e = 0; e <= 20; e += 0.01) if (odds(e) >= target) return e; return 20; };

// -------------------------------------------------------------------- reports

function decompose(label: string, obs: Obs[]): Fit {
  const r = fit(obs);
  const incBar = mean(obs.map((o) => o.inc));
  const c = obs.map((o) => ({
    d: r.a.get(o.unit)!, s: r.g.get(o.year)!, k: r.beta * (o.inc - incBar),
    e: o.y - r.base - r.a.get(o.unit)! - r.g.get(o.year)! - r.beta * (o.inc - incBar),
    y: o.y, n: r.byUnit.get(o.unit)!.length,
  }));
  const vy = vr(c.map((x) => x.y));
  const vd = vr(c.map((x) => x.d)), vs = vr(c.map((x) => x.s)), vk = vr(c.map((x) => x.k)), ve = vr(c.map((x) => x.e));
  const cdk = cv(c.map((x) => x.d), c.map((x) => x.k));
  const nParams = r.byUnit.size + r.nYears;
  const sig2 = ve * obs.length / (obs.length - nParams);
  const vdCorr = vd - sig2 * mean(c.map((x) => 1 / x.n));
  const pct = (v: number) => `${(100 * v / vy).toFixed(1)}%`;
  console.log(`\n=== ${label} ===`);
  console.log(`N=${obs.length}  district-eras=${r.byUnit.size}  years=${r.nYears}  Var(y)=${f2(vy)}  SD(y)=${f2(Math.sqrt(vy))} share pts`);
  console.log(`  district (stable partisanship) ${pct(vd)}  SD ${f2(Math.sqrt(vd))}   bias-corrected ${pct(vdCorr)}  SD ${f2(Math.sqrt(Math.max(0, vdCorr)))}`);
  console.log(`  national swing (year FE)       ${pct(vs)}  SD ${f2(Math.sqrt(vs))}`);
  console.log(`  incumbency                     ${pct(vk)}  beta ${f2(r.beta)} share pts = ${f2(2 * r.beta)} margin pts = ${f2(r.beta)} pips`);
  console.log(`  residual (candidate, local)    ${pct(ve)}  SD ${f2(Math.sqrt(ve))}`);
  console.log(`  2*cov(district, incumbency)    ${pct(2 * cdk)}   -- incumbents sit in districts that already favour them`);
  // Split-half: two independent noisy reads of the same district, so their
  // covariance estimates Var(alpha) with no sampling variance in it.
  const halves: number[][] = [];
  for (const ii of r.byUnit.values()) {
    if (ii.length < 4) continue;
    const dev = ii.map((i) => obs[i].y - r.base - r.g.get(obs[i].year)! - r.beta * (obs[i].inc - incBar));
    const A = dev.filter((_, j) => j % 2 === 0), B = dev.filter((_, j) => j % 2 === 1);
    halves.push([mean(A), mean(B)]);
  }
  const sc = cv(halves.map((h) => h[0]), halves.map((h) => h[1]));
  console.log(`  split-half unbiased Var(district) = ${f2(sc)} over ${halves.length} district-eras  =>  SD ${f2(Math.sqrt(Math.max(0, sc)))} share pts`);
  const abs = [...r.a.values()].map(Math.abs).sort((x, y) => x - y);
  const q = (p: number) => abs[Math.floor(p * (abs.length - 1))];
  console.log(`  |district effect| over district-eras: mean ${f2(mean(abs))}  p25 ${f2(q(0.25))}  p50 ${f2(q(0.5))}  p75 ${f2(q(0.75))}  p90 ${f2(q(0.9))}`);
  console.log(`  year effects (share pts, + = D): ` + [...r.g.entries()].sort((x, y) => x[0] - y[0]).map(([y, v]) => `${y}:${v.toFixed(1)}`).join(' '));
  return r;
}

function main(): void {
  const argv = process.argv.slice(2);
  const bi = argv.indexOf('--build');
  if (bi >= 0) { build(argv[bi + 1]); return; }

  const panel = JSON.parse(readFileSync(PANEL, 'utf8')) as { rows: [number, string, number, number, number, number][] };
  const rows: Row[] = panel.rows.map(([year, state, district, dem, rep, inc]) => ({ year, state, district, dem, rep, inc }));
  const unit = (r: Row) => `${r.state}-${r.district}|${era(r.year)}`;

  const contested = rows.filter((r) => r.dem > 0 && r.rep > 0);
  const both = rows.filter((r) => r.dem + r.rep > 0);
  console.log(`panel: ${rows.length} district-year general elections 1976-2018`);
  console.log(`  contested (both a D and an R on the ballot): ${contested.length} (${(100 * contested.length / rows.length).toFixed(1)}%)`);
  console.log(`  uncontested: ${rows.length - contested.length} (${(100 * (rows.length - contested.length) / rows.length).toFixed(1)}%)`);
  console.log(`  an incumbent is on the ballot in ${rows.filter((r) => r.inc !== 0).length} (${(100 * rows.filter((r) => r.inc !== 0).length / rows.length).toFixed(1)}%)`);
  console.log('\nUnits: share points of the two-party Democratic vote. 1 share pt = 2 margin pts = 1 pip.');

  // A district-era with one or two elections cannot separate its own effect
  // from the races it is fitted to, so the FE populations require three.
  const keep = (pop: Row[]) => { const n = new Map<string, number>(); for (const r of pop) n.set(unit(r), (n.get(unit(r)) ?? 0) + 1); return pop.filter((r) => n.get(unit(r))! >= 3); };
  const mk = (pop: Row[], y: (r: Row) => number): Obs[] => pop.map((r) => ({ y: y(r), inc: r.inc, unit: unit(r), year: r.year, row: r }));

  const share = (r: Row) => 100 * r.dem / (r.dem + r.rep);
  const P1 = mk(keep(contested), share);
  decompose('P1  contested races only  (the headline population)', P1);
  // Gelman-King style: an uncontested seat is not a 100-0 district, it is a
  // district nobody bothered to contest. 75/25 is the conventional stand-in.
  decompose('P2  every race, uncontested imputed at 75/25', mk(keep(both), (r) => (r.rep === 0 ? 75 : r.dem === 0 ? 25 : share(r))));
  decompose('P3  every race, uncontested taken at its raw 100/0  (an upper bound, not a measurement)', mk(keep(both), share));

  // ---- is the state enough? split the district effect into state and rest
  const r1 = fit(P1);
  const eff = [...r1.a.entries()].map(([u, v]) => ({ st: u.slice(0, 2), v }));
  const stMean = new Map<string, number>();
  for (const st of new Set(eff.map((e) => e.st))) stMean.set(st, mean(eff.filter((e) => e.st === st).map((e) => e.v)));
  const between = eff.map((e) => stMean.get(e.st)!), within = eff.map((e) => e.v - stMean.get(e.st)!);
  console.log(`\n=== is the STATE enough? (district effects from P1) ===`);
  console.log(`  state component  ${(100 * vr(between) / vr(eff.map((e) => e.v))).toFixed(1)}% of the district effect, SD ${f2(Math.sqrt(vr(between)))} share pts`);
  console.log(`  within-state     ${(100 * vr(within) / vr(eff.map((e) => e.v))).toFixed(1)}% of the district effect, SD ${f2(Math.sqrt(vr(within)))} share pts`);

  // ---- leave-one-out: what a printed number can honestly predict
  const incBar = mean(P1.map((o) => o.inc));
  for (const o of P1) {
    const ii = r1.byUnit.get(o.unit)!;
    const resid = o.y - r1.base - r1.g.get(o.year)! - r1.beta * o.inc;
    (o as Obs & { loo: number }).loo = (r1.a.get(o.unit)! * ii.length - resid) / (ii.length - 1);
  }
  const loo = P1 as (Obs & { loo: number })[];
  const open = loo.filter((o) => o.inc === 0);
  const winRate = (rs: (Obs & { loo: number })[]) => 100 * rs.filter((o) => (o.loo > 0) === (o.y > 50)).length / rs.length;
  console.log(`\n=== the pip value of a party match ===`);
  console.log(`  mean |district effect| over races: ${f2(mean(loo.map((o) => Math.abs(r1.a.get(o.unit)!))))} share pts = ${f2(2 * mean(loo.map((o) => Math.abs(r1.a.get(o.unit)!))))} margin pts`);
  const looResid = (rs: (Obs & { loo: number })[]) => Math.sqrt(vr(rs.map((o) => o.y - r1.base - r1.g.get(o.year)! - r1.beta * (o.inc - incBar) - o.loo)));
  console.log(`  out-of-sample dispersion around the fundamentals: all contested ${f2(looResid(loo))} pips, open seats ${f2(looResid(open))} pips`);
  console.log(`  the general's dice give 4.18. Reality is ${(looResid(loo) / 4.18).toFixed(2)}-${(looResid(open) / 4.18).toFixed(2)}x noisier, so a modifier read straight off the margin scale overshoots by that factor.`);
  console.log(`\n  bucket by |leave-one-out district effect|; "pips" is the odds-table edge that reproduces the observed win rate`);
  console.log(`  ${'population'.padEnd(22)}${'mean |effect|'.padEnd(15)}${'n'.padEnd(7)}win%   pips`);
  const bucket = (v: number) => { const x = Math.abs(v); return x < 2 ? 0 : x < 5 ? 2 : x < 10 ? 5 : x < 15 ? 10 : x < 20 ? 15 : 20; };
  for (const [lab, rs] of [['all contested', loo], ['open seats only', open]] as [string, (Obs & { loo: number })[]][]) {
    console.log(`  ${lab}  (${rs.length} races) overall win ${winRate(rs).toFixed(1)}% -> +${edgeFor(winRate(rs)).toFixed(1)} pips`);
    const bs = new Map<number, (Obs & { loo: number })[]>();
    for (const o of rs) { const k = bucket(o.loo); if (!bs.has(k)) bs.set(k, []); bs.get(k)!.push(o); }
    for (const k of [...bs.keys()].sort((x, y) => x - y)) {
      const b = bs.get(k)!;
      console.log(`    ${('|effect| ' + k + '+').padEnd(20)}${f2(mean(b.map((o) => Math.abs(o.loo)))).padEnd(15)}${String(b.length).padEnd(7)}${winRate(b).toFixed(1)}%  +${edgeFor(winRate(b)).toFixed(1)}`);
    }
  }

  // ---- loyalty vs lean: does a state vote its House the way it votes for president?
  loyalty(rows);

  // ---- has the party match got bigger? one fit per redistricting era
  console.log(`\n=== has a party match got bigger? one fit per redistricting era (contested only) ===`);
  for (const e of ['A', 'B', 'C', 'D', 'E']) {
    const pop = keep(contested.filter((r) => era(r.year) === e));
    if (pop.length < 100) continue;
    const rr = fit(mk(pop, share));
    const abs = [...rr.a.values()].map(Math.abs);
    const yrs = [...new Set(pop.map((r) => r.year))].sort();
    console.log(`  ${e} ${yrs[0]}-${yrs[yrs.length - 1]}: mean |district effect| ${f2(mean(abs))} share pts,  SD ${f2(Math.sqrt(vr([...rr.a.values()])))},  incumbency ${f2(rr.beta)} pips,  share of district-eras under 5 pts ${(100 * abs.filter((x) => x < 5).length / abs.length).toFixed(0)}%`);
  }
}

/** LOYALTY vs LEAN. Both sides are expressed the way engine/rules/lean.ts tracks lean: as a
 *  deviation from the national two-party D share, in share points. The gap is
 *  how much more Democratic a state votes for its House than for president —
 *  the ancestral identification the design doc's Robert Byrd case is about.
 *  Votes are aggregated, not averaged over districts, so a state whose House
 *  delegation contains an independent (Vermont) reads spuriously Republican;
 *  the regional aggregates below are not affected. */
function loyalty(house: Row[]): void {
  const pres = JSON.parse(readFileSync(PRES, 'utf8')) as { rows: [number, string, number, number][] };
  const pv = new Map(pres.rows.map(([y, st, d, r]) => [`${st}|${y}`, { d, r }]));
  const years = [...new Set(pres.rows.map((r) => r[0]))].sort();
  const dev = (sel: Set<string> | null) => {
    const out = new Map<number, { h: number; p: number }>();
    for (const y of years) {
      const hs = house.filter((r) => r.year === y && (sel === null || sel.has(r.state)));
      const hAll = house.filter((r) => r.year === y);
      const ps = pres.rows.filter((r) => r[0] === y && (sel === null || sel.has(r[1])));
      const pAll = pres.rows.filter((r) => r[0] === y);
      const sh = (d: number, r: number) => 100 * d / (d + r);
      out.set(y, {
        h: sh(hs.reduce((a, r) => a + r.dem, 0), hs.reduce((a, r) => a + r.rep, 0)) - sh(hAll.reduce((a, r) => a + r.dem, 0), hAll.reduce((a, r) => a + r.rep, 0)),
        p: sh(ps.reduce((a, r) => a + r[2], 0), ps.reduce((a, r) => a + r[3], 0)) - sh(pAll.reduce((a, r) => a + r[2], 0), pAll.reduce((a, r) => a + r[3], 0)),
      });
    }
    return out;
  };
  console.log(`\n=== loyalty vs lean: House deviation minus presidential deviation, share points (= pips) ===`);
  const regions: [string, string[]][] = [
    ['South', ['AL', 'AR', 'FL', 'GA', 'LA', 'MS', 'NC', 'SC', 'TN', 'TX', 'VA']],
    ['Appalachia (WV KY TN)', ['WV', 'KY', 'TN']],
    ['West Virginia', ['WV']],
    ['Kentucky', ['KY']],
    ['everywhere else', [...new Set(house.map((r) => r.state))].filter((s) => !['AL', 'AR', 'FL', 'GA', 'LA', 'MS', 'NC', 'SC', 'TN', 'TX', 'VA', 'WV', 'KY'].includes(s))],
  ];
  console.log(`  ${'region'.padEnd(24)}${years.map((y) => String(y).padStart(7)).join('')}`);
  for (const [name, sts] of regions) {
    const d = dev(new Set(sts));
    const cross = (ys: number[], pick: (y: number) => number) => { let prev: number | null = null; for (const y of ys) { const v = pick(y); if (prev !== null && prev > 0 && v <= 0) return y; prev = v; } return null; };
    // The House crossing is read off every election, not just presidential ones.
    const sel = new Set(sts);
    const hAllYears = [...new Set(house.map((r) => r.year))].sort();
    const hDev = (y: number) => {
      const sh = (rs: Row[]) => 100 * rs.reduce((a, r) => a + r.dem, 0) / rs.reduce((a, r) => a + r.dem + r.rep, 0);
      return sh(house.filter((r) => r.year === y && sel.has(r.state))) - sh(house.filter((r) => r.year === y));
    };
    console.log(`  ${(name + ' HOUSE').padEnd(24)}${years.map((y) => d.get(y)!.h.toFixed(1).padStart(7)).join('')}`);
    console.log(`  ${(name + ' PRES').padEnd(24)}${years.map((y) => d.get(y)!.p.toFixed(1).padStart(7)).join('')}`);
    console.log(`  ${(name + ' GAP').padEnd(24)}${years.map((y) => (d.get(y)!.h - d.get(y)!.p).toFixed(1).padStart(7)).join('')}   D edge lost: pres ${cross(years, (y) => d.get(y)!.p) ?? '-'}, House ${cross(hAllYears, hDev) ?? '-'}`);
  }
  // persistence of the state-level gap
  const states = [...new Set(house.map((r) => r.state))].filter((s) => pv.has(`${s}|1976`));
  const gap = new Map<string, number>();
  for (const st of states) { const d = dev(new Set([st])); for (const y of years) gap.set(`${st}|${y}`, d.get(y)!.h - d.get(y)!.p); }
  console.log(`\n  the gap is slow: correlation of a state's gap with its own gap k presidential cycles later`);
  for (let k = 1; k <= 6; k++) {
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i + k < years.length; i++) for (const st of states) { const a = gap.get(`${st}|${years[i]}`)!, b = gap.get(`${st}|${years[i + k]}`)!; xs.push(a); ys.push(b); }
    console.log(`    ${k} cycles (${4 * k} yrs): r = ${(cv(xs, ys) / Math.sqrt(vr(xs) * vr(ys))).toFixed(2)}  n=${xs.length}`);
  }
  const sds = years.map((y) => Math.sqrt(vr(states.map((st) => gap.get(`${st}|${y}`)!))));
  console.log(`  SD of the gap across states, by year: ${years.map((y, i) => `${y}:${sds[i].toFixed(1)}`).join(' ')}`);
}

if (import.meta.filename === process.argv[1]) main();
