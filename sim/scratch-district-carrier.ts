/** SCRATCH probe — how should a district carry its partisanship? Research only.
 *  Ships no rule, edits no engine file and no config.
 *
 *  b8ec0eb measured the thing to be carried: stable district partisanship is
 *  56.4% of the variance in two-party House share, 89.4% of it WITHIN state,
 *  and knowing which way a district leans is worth +5.0 pips over all contested
 *  races / +4.0 over open seats, calibrated on win rates against the general's dice.
 *  Three candidate carriers, priced here on one population:
 *
 *    A  a printed party lean            — the ceiling, and frozen across eras
 *    B  an era-keyed demographics table — fitted here per era from the panel
 *    C  emergent from play (district-card capture on a win) — no printed value, no table
 *    D  the identity bonus already shipped — demographics x the era's own
 *       candidate pool, which needs no table and no new field
 *
 *  POPULATION (findings/incumbency-calibration.ts). Everything below is priced on Q: contested general
 *  elections 1976-2018 whose district-era both survives the >=3-elections rule
 *  and matches a district CARD in the pack of that era. 167 of the 258 cards
 *  match; the 1932, 1964 and 2024 packs fall outside the panel entirely. Q is
 *  narrower than b8ec0eb's P1, so the A row is re-derived on Q and every other
 *  row is compared against THAT, never against the published +5.0/+4.0.
 *
 *  The two-way FE estimator is copied from sim/district-partisanship.ts rather
 *  than imported: that module runs its whole report at import time.
 *
 *  node sim/scratch-district-carrier.ts [--games 200] [--config as-written-plus.json]
 */
import { readFileSync } from 'node:fs';
import { loadConfig, loadPacks, playOne } from './harness.ts';
import type { Card, DistrictCard, IdentityTag, Party, RaceEvent } from '../engine/types/index.ts';

const PANEL = new URL('../data/historical/house_district_panel.json', import.meta.url);

interface Row { year: number; state: string; district: number; dem: number; rep: number; inc: number }
interface Obs { y: number; inc: number; unit: string; year: number; loo: number }

const mean = (a: number[]) => a.reduce((x, z) => x + z, 0) / a.length;
const vr = (a: number[]) => { const m = mean(a); return mean(a.map((z) => (z - m) * (z - m))); };
const cv = (a: number[], b: number[]) => { const ma = mean(a), mb = mean(b); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); return s / a.length; };
const corr = (a: number[], b: number[]) => cv(a, b) / Math.sqrt(vr(a) * vr(b));
const f2 = (x: number) => x.toFixed(2);

/** Redistricting eras — a district number is only the same place inside one. */
const era = (y: number) => (y <= 1980 ? 'A' : y <= 1990 ? 'B' : y <= 2000 ? 'C' : y <= 2010 ? 'D' : 'E');
/** Which panel era each card pack's district numbers belong to. */
const PACK_ERA: Record<number, string> = { 1976: 'A', 1992: 'C', 2008: 'D', 2016: 'E' };

// ---------------------------------------------------------------- estimator

function fit(obs: { y: number; inc: number; unit: string; year: number }[]) {
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
  return { beta, base: mu + am, a, g, byUnit };
}

/** 3d6 vs 3d6, ties split — the general odds table (engine/rules/resolution.ts). */
function odds(edge: number): number {
  const p = new Map<number, number>();
  for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) for (let k = 1; k <= 6; k++) { const s = i + j + k; p.set(s, (p.get(s) ?? 0) + 1 / 216); }
  let w = 0, t = 0;
  for (const [x, px] of p) for (const [y, py] of p) { const d = x + edge - y; if (d > 0) w += px * py; else if (d === 0) t += px * py; }
  return 100 * (w + t / 2);
}
const edgeFor = (target: number) => { for (let e = 0; e <= 20; e += 0.01) if (odds(e) >= target) return e; return 20; };

// ------------------------------------------------------------------- carriers

/** A carrier scores a district-era: positive = leans D, the sign convention of
 *  the panel's `y` (Democratic share of the two-party vote). `p` is the
 *  probability the carrier points at D, so a stochastic carrier (C) is priced
 *  on its own dispersion rather than on a point estimate of it. */
type Carrier = (unit: string) => { pD: number } | undefined;
const sure = (v: number): { pD: number } => ({ pD: v > 0 ? 1 : v < 0 ? 0 : 0.5 });

/** Win rate of a carrier over a population, then the odds-table edge that
 *  reproduces it — the same calibration b8ec0eb used, so the numbers are
 *  comparable. */
function price(pop: Obs[], c: Carrier): { n: number; win: number; pips: number } {
  let n = 0, w = 0;
  for (const o of pop) {
    const s = c(o.unit);
    if (!s) continue;
    n++;
    w += o.y > 50 ? s.pD : 1 - s.pD;
  }
  const win = n ? 100 * w / n : 0;
  return { n, win, pips: edgeFor(win) };
}

// ------------------------------------------------------------------ the sim

/** Per game, per district, the House generals it held, in order. `party` is
 *  the generous reading of C; `player` is the literal one — capturing a
 *  district moves the CARD to the winning player, and a player is not a
 *  party. */
interface Held { party: Party; player: number; contested: boolean }
function holdHistories(games: number, agents: string[], cfg: ReturnType<typeof loadConfig>, cards: Card[]) {
  const out: { unit: string; seq: Held[] }[] = [];
  const perGame: { districts: number; generals: number; uncontested: number; years: number }[] = [];
  /** Where a district-partisanship modifier could actually bite. A party-keyed
   *  one (A, B) cancels in a primary, both sides being the same party; the
   *  identity bonus (D) does not, and a primary is 1d6 vs 1d6. */
  const bite = { gen: 0, genContested: 0, genCrossParty: 0, pri: 0, priContested: 0, priIdentityDiffers: 0, genIdentityDiffers: 0 };
  const idPips = (s: RaceEvent['sides'][number]) => s.modifiers.filter((m) => m.source.startsWith('identity')).reduce((n, m) => n + m.pips, 0);
  for (let i = 0; i < games; i++) {
    const r = playOne(agents, cards, cfg, 1000 + i);
    const by = new Map<string, Held[]>();
    let unc = 0, gen = 0;
    for (const e of r.events) {
      if (e.office !== 'representative') continue;
      if (e.round === 'primary') {
        bite.pri++;
        if (!e.uncontested) { bite.priContested++; if (new Set(e.sides.map(idPips)).size > 1) bite.priIdentityDiffers++; }
        continue;
      }
      gen++;
      bite.gen++;
      if (e.uncontested) unc++;
      else {
        bite.genContested++;
        if (new Set(e.sides.map((s) => s.party)).size > 1) bite.genCrossParty++;
        if (new Set(e.sides.map(idPips)).size > 1) bite.genIdentityDiffers++;
      }
      const k = `${e.state}-${e.slot}`;
      if (!by.has(k)) by.set(k, []);
      by.get(k)!.push({ party: e.sides.find((s) => s.player === e.winner)!.party, player: e.winner, contested: !e.uncontested });
    }
    perGame.push({ districts: by.size, generals: gen, uncontested: unc, years: r.years });
    for (const [k, seq] of by) out.push({ unit: k, seq });
  }
  return { out, perGame, bite };
}

function main(): void {
  const arg = (f: string, d: string) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
  const games = Number(arg('--games', '200'));
  const cfgName = arg('--config', 'as-written-plus.json');
  const agents = arg('--agents', 'Greedy,Lookahead,SenateFlood,HouseFarm').split(',');

  // ---- panel and the real district effects
  const panel = JSON.parse(readFileSync(PANEL, 'utf8')) as { rows: [number, string, number, number, number, number][] };
  const rows: Row[] = panel.rows.map(([year, state, district, dem, rep, inc]) => ({ year, state, district, dem, rep, inc }));
  const unitOf = (r: Row) => `${r.state}-${r.district}|${era(r.year)}`;
  const contested = rows.filter((r) => r.dem > 0 && r.rep > 0);
  const n = new Map<string, number>();
  for (const r of contested) n.set(unitOf(r), (n.get(unitOf(r)) ?? 0) + 1);
  const kept = contested.filter((r) => n.get(unitOf(r))! >= 3);
  const P1 = kept.map((r) => ({ y: 100 * r.dem / (r.dem + r.rep), inc: r.inc, unit: unitOf(r), year: r.year }));
  const f = fit(P1);
  const incBar = mean(P1.map((o) => o.inc));
  const obs: Obs[] = P1.map((o) => {
    const ii = f.byUnit.get(o.unit)!;
    const resid = o.y - f.base - f.g.get(o.year)! - f.beta * o.inc;
    return { ...o, loo: (f.a.get(o.unit)! * ii.length - resid) / (ii.length - 1) };
  });

  // ---- district cards, and which of them the panel can speak to
  const cardsByEra = new Map<number, Card[]>();
  for (const e of [1932, 1964, 1976, 1992, 2008, 2016, 2024]) cardsByEra.set(e, loadPacks([String(e)]));
  const districts: (DistrictCard & { unit: string })[] = [];
  const seenUnits = new Set(f.byUnit.keys());
  for (const [e, cs] of cardsByEra) {
    const le = PACK_ERA[e];
    for (const c of cs) {
      if (c.kind !== 'district' || !le) continue;
      const u = `${c.state}-${c.number}|${le}`;
      if (seenUnits.has(u)) districts.push({ ...c, unit: u });
    }
  }
  const matched = new Map(districts.map((d) => [d.unit, d]));
  const Q = obs.filter((o) => matched.has(o.unit));
  const Qopen = Q.filter((o) => o.inc === 0);
  const feOf = (u: string) => f.a.get(u)!;

  console.log(`=== the population, named ===`);
  console.log(`  panel contested, >=3 per district-era (b8ec0eb's P1): ${obs.length} races over ${f.byUnit.size} district-eras`);
  console.log(`  district cards: 258, of which ${districts.length} sit in a panel era (1932/1964/2024 have no panel)`);
  console.log(`  Q = races in a card-matched district-era: ${Q.length} races over ${matched.size} district-eras, ${Qopen.length} of them open seats`);

  // ---- A: the ceiling, re-derived on Q so every other row has a fair target
  const priceLoo = (pop: Obs[]) => { const w = 100 * pop.filter((o) => (o.loo > 0) === (o.y > 50)).length / pop.length; return { n: pop.length, win: w, pips: edgeFor(w) }; };
  const Afull = priceLoo(obs);
  /** In-sample effect: the district's whole record fitted and read back. Not
   *  honest as a prediction, but it bounds B — B is fitted TO these. */
  const Ain: Carrier = (u) => sure(feOf(u));

  // ---- B: an era-keyed demographics table, fitted from the panel, LOO by district
  const TAGS: IdentityTag[] = ['catholic', 'evangelical', 'jewish', 'black', 'hispanic', 'cuban', 'union', 'veteran', 'rural', 'suburban', 'urban', 'ivy', 'farm', 'business', 'academic'];
  const byEra = new Map<string, (DistrictCard & { unit: string })[]>();
  for (const d of districts) { const le = d.unit.split('|')[1]; if (!byEra.has(le)) byEra.set(le, []); byEra.get(le)!.push(d); }
  /** tag -> mean district effect over the era's cards carrying it, `drop` excluded. */
  const tagTable = (le: string, drop?: string) => {
    const pool = byEra.get(le)!.filter((d) => d.unit !== drop);
    const t = new Map<IdentityTag, { v: number; n: number }>();
    for (const tag of TAGS) {
      const hit = pool.filter((d) => d.demographics.includes(tag));
      if (hit.length) t.set(tag, { v: mean(hit.map((d) => feOf(d.unit))), n: hit.length });
    }
    return t;
  };
  const bPred = new Map<string, number>();
  for (const d of districts) {
    const t = tagTable(d.unit.split('|')[1], d.unit);
    const vs = d.demographics.map((g) => t.get(g)?.v).filter((v): v is number => v !== undefined);
    bPred.set(d.unit, vs.length ? mean(vs) : 0);
  }
  const B: Carrier = (u) => bPred.has(u) ? sure(bPred.get(u)!) : undefined;

  // ---- D: what the SHIPPED identity bonus already delivers. A district's
  // demographics meet the era's own candidate pool; the pool's tag-to-party
  // association is the era table, already printed, on the other side of the
  // match. No new field, no lookup.
  const dPred = new Map<string, number>();
  for (const d of districts) {
    const packEra = Number(Object.entries(PACK_ERA).find(([, v]) => v === d.unit.split('|')[1])![0]);
    const pool = (cardsByEra.get(packEra)!).filter((c) => c.kind === 'candidate' && c.party !== 'I');
    const fitScore = (party: Party) => {
      const side = pool.filter((c) => c.kind === 'candidate' && c.party === party);
      return side.length ? mean(side.map((c) => c.kind === 'candidate' ? c.identities.filter((i) => d.demographics.includes(i)).length : 0)) : 0;
    };
    // + = the district's demographics are met by more D candidates than R, in
    // units of identity-bonus pips (identityBonus is 1 in every shipped config).
    dPred.set(d.unit, fitScore('D') - fitScore('R'));
  }
  const D: Carrier = (u) => dPred.has(u) ? sure(dPred.get(u)!) : undefined;

  // ---- D-state: is the STATE enough? state mean effect, own district excluded
  const stPred = new Map<string, number>();
  for (const d of districts) {
    const st = d.unit.slice(0, 2), le = d.unit.split('|')[1];
    const sibs = [...f.byUnit.keys()].filter((u) => u.startsWith(`${st}-`) && u.endsWith(`|${le}`) && u !== d.unit);
    stPred.set(d.unit, sibs.length ? mean(sibs.map(feOf)) : 0);
  }
  const Dstate: Carrier = (u) => stPred.has(u) ? sure(stPred.get(u)!) : undefined;

  // ---- C: emergent from play
  const cfg = loadConfig(cfgName);
  // The era queue is consumed oldest first, so a 24-year game starting in
  // 1976 mostly plays 1932/1964/1976 districts and never reaches 2016 — which
  // is most of the panel-matched half of the pack. `--packs 1976,1992,2008,2016`
  // gives C its best case: every district it could be scored against is in the
  // pool. The default is the whole estate's default.
  const packs = arg('--packs', '1932,1964,1976,1992,2008,2016,2024').split(',');
  const all = loadPacks(packs);
  const t0 = Date.now();
  const { out: hist, perGame, bite } = holdHistories(games, agents, cfg, all);
  console.log(`\n=== C1. does C have anything to work with? (${games} games, ${cfgName}, ${agents.join(',')}, packs ${packs.join('/')}, ${((Date.now() - t0) / 1000).toFixed(0)}s) ===`);
  console.log(`  per game: ${f2(mean(perGame.map((g) => g.years)))} years, ${f2(mean(perGame.map((g) => g.districts)))} districts ever hold a House race, ${f2(mean(perGame.map((g) => g.generals)))} House generals`);
  console.log(`  of those generals ${(100 * mean(perGame.map((g) => g.generals ? g.uncontested / g.generals : 0))).toFixed(1)}% are walkovers`);
  const lens = hist.map((h) => h.seq.length).sort((a, b) => a - b);
  const q = (p: number) => lens[Math.floor(p * (lens.length - 1))];
  console.log(`  elections per district per game: n=${lens.length} mean ${f2(mean(lens))} p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)} max ${lens[lens.length - 1]}`);
  let pairs = 0, flips = 0, flipsContested = 0, playerFlips = 0;
  const runs: number[] = [];
  for (const h of hist) {
    let run = 1;
    for (let i = 1; i < h.seq.length; i++) {
      pairs++;
      if (h.seq[i].player !== h.seq[i - 1].player) playerFlips++;
      if (h.seq[i].party !== h.seq[i - 1].party) { flips++; if (h.seq[i].contested) flipsContested++; runs.push(run); run = 1; } else run++;
    }
    runs.push(run);
  }
  runs.sort((a, b) => a - b);
  const rq = (p: number) => runs[Math.floor(p * (runs.length - 1))];
  console.log(`  a seat changes PARTY between consecutive elections in ${flips}/${pairs} = ${(100 * flips / pairs).toFixed(1)}% of them; ${flipsContested} of those ${flips} flips were a contested general, the rest are the holder simply not standing`);
  console.log(`  it changes PLAYER (the literal capture reading — the card moves) in ${(100 * playerFlips / pairs).toFixed(1)}%`);
  console.log(`  consecutive holds by one party: mean ${f2(mean(runs))} p50 ${rq(0.5)} p90 ${rq(0.9)} max ${runs[runs.length - 1]}`);
  const oneParty = hist.filter((h) => new Set(h.seq.map((s) => s.party)).size === 1);
  console.log(`  districts that NEVER change party in a game: ${(100 * oneParty.length / hist.length).toFixed(1)}% (of which ${(100 * oneParty.filter((h) => h.seq.length === 1).length / oneParty.length).toFixed(0)}% held exactly one election)`);

  // hold history -> a carrier. `k` truncates it, which is the warm-up curve.
  const bare = (u: string) => u.split('|')[0];
  const cAt = (k: number): Carrier => {
    const tally = new Map<string, { d: number; n: number }>();
    for (const h of hist) {
      const seq = k > 0 ? h.seq.slice(0, k) : h.seq;
      if (!seq.length) continue;
      const d = seq.filter((s) => s.party === 'D').length;
      const maj = d * 2 === seq.length ? 0.5 : d * 2 > seq.length ? 1 : 0;
      const t = tally.get(h.unit) ?? { d: 0, n: 0 };
      t.d += maj; t.n++;
      tally.set(h.unit, t);
    }
    return (u) => { const t = tally.get(bare(u)); return t && t.n ? { pD: t.d / t.n } : undefined; };
  };
  const cFull = cAt(0), cFirst = cAt(1);

  console.log(`\n=== C2. does C track the real district? ===`);
  const covered = [...matched.keys()].filter((u) => cFull(u));
  console.log(`  card-matched district-eras that ever see a House race in the sim: ${covered.length}/${matched.size}`);
  const xs = covered.map((u) => cFull(u)!.pD), ys = covered.map(feOf);
  console.log(`  corr(share of sim games this district ends up majority-D, real district effect) = ${corr(xs, ys).toFixed(3)}  n=${covered.length}`);
  console.log(`  P(a game's hold history points at the district's REAL party) = ${(100 * mean(covered.map((u) => feOf(u) > 0 ? cFull(u)!.pD : 1 - cFull(u)!.pD))).toFixed(1)}%  (50% = carries nothing)`);
  console.log(`  ... using only the FIRST election held there: ${(100 * mean(covered.map((u) => feOf(u) > 0 ? cFirst(u)!.pD : 1 - cFirst(u)!.pD))).toFixed(1)}%`);
  console.log(`  sim House winners are ${(100 * mean(hist.flatMap((h) => h.seq).map((s) => s.party === 'D' ? 1 : 0))).toFixed(1)}% D; real winners in Q are ${(100 * mean(Q.map((o) => o.y > 50 ? 1 : 0))).toFixed(1)}% D — a carrier that always said "D" scores the latter`);

  // ---- the table. Two populations, because C only speaks for districts the
  // sim ever drafted into a House race: Q, and Q restricted to those. See findings/incumbency-calibration.ts.
  const Qc = Q.filter((o) => cFull(o.unit)), Qco = Qopen.filter((o) => cFull(o.unit));
  const zb = (u: string) => { const v = bPred.get(u); return v === undefined ? undefined : v / Math.sqrt(vr([...bPred.values()])); };
  const zd = (u: string) => { const v = dPred.get(u); return v === undefined ? undefined : v / Math.sqrt(vr([...dPred.values()])); };
  const BC: Carrier = (u) => { const b = zb(u), c = cFull(u); return b === undefined ? undefined : sure(b + (c ? 2 * (c.pD - 0.5) : 0)); };
  const DC: Carrier = (u) => { const d = zd(u), c = cFull(u); return d === undefined ? undefined : sure(d + (c ? 2 * (c.pD - 0.5) : 0)); };
  const carriers: [string, Carrier][] = [
    ['A  the district effect, in-sample (bounds B)', Ain],
    ['B  era-keyed demographics table (LOO)', B],
    ['D  shipped identity bonus, no new field', D],
    ['D- state only (own district excluded)', Dstate],
    ['C  emergent, full hold history', cFull],
    ['C  emergent, first election only', cFirst],
    ['B + C combined', BC],
    ['D + C combined', DC],
  ];
  const table = (label: string, pop: Obs[], popOpen: Obs[]) => {
    console.log(`\n=== the price of each carrier, on ${label} (win% = carrier points at the real winner; pips = odds-table edge reproducing it) ===`);
    console.log(`  ${'carrier'.padEnd(46)}${'n'.padStart(6)}${'win'.padStart(9)}${'pips'.padStart(7)}   ${'open'.padStart(7)}${'pips'.padStart(7)}`);
    const A = priceLoo(pop), Ao = priceLoo(popOpen);
    console.log(`  ${'A  printed lean, leave-one-out (the ceiling)'.padEnd(46)}${String(A.n).padStart(6)}${A.win.toFixed(1).padStart(8)}%${('+' + A.pips.toFixed(1)).padStart(7)}   ${Ao.win.toFixed(1).padStart(6)}%${('+' + Ao.pips.toFixed(1)).padStart(7)}`);
    for (const [lab, c] of carriers) {
      const r = price(pop, c), o = price(popOpen, c);
      console.log(`  ${lab.padEnd(46)}${String(r.n).padStart(6)}${r.win.toFixed(1).padStart(8)}%${('+' + r.pips.toFixed(1)).padStart(7)}   ${o.win.toFixed(1).padStart(6)}%${('+' + o.pips.toFixed(1)).padStart(7)}`);
    }
  };
  table(`Q — all ${matched.size} card-matched district-eras`, Q, Qopen);
  table(`Q∩C — only the ${covered.length} districts the sim actually plays, so C is compared like for like`, Qc, Qco);

  console.log(`\n  for reference, the same A row on b8ec0eb's full P1: ${Afull.n} races, ${Afull.win.toFixed(1)}% -> +${Afull.pips.toFixed(1)} pips`);
  const us = [...matched.keys()];
  console.log(`  correlations with the real district effect over ${matched.size} matched district-eras:`);
  console.log(`    B ${corr(us.map((u) => bPred.get(u)!), us.map(feOf)).toFixed(3)}   D ${corr(us.map((u) => dPred.get(u)!), us.map(feOf)).toFixed(3)}   state-only ${corr(us.map((u) => stPred.get(u)!), us.map(feOf)).toFixed(3)}`);

  // ---- the warm-up, priced
  console.log(`\n=== C3. the warm-up, in pips (on Q∩C) ===`);
  console.log(`  ${'hold history truncated to'.padEnd(30)}${'races'.padStart(7)}${'win'.padStart(8)}${'pips'.padStart(7)}`);
  for (const k of [1, 2, 3, 4, 6, 0]) {
    const r = price(Qc, cAt(k));
    console.log(`  ${(k === 0 ? 'all of it' : `${k} election${k > 1 ? 's' : ''}`).padEnd(30)}${String(r.n).padStart(7)}${r.win.toFixed(1).padStart(7)}%${('+' + r.pips.toFixed(1)).padStart(7)}`);
  }
  // How long before a district HAS k elections, given it is drafted at all.
  for (const k of [1, 2, 3, 4]) {
    console.log(`  share of district-games reaching ${k} election${k > 1 ? 's' : ''}: ${(100 * hist.filter((h) => h.seq.length >= k).length / hist.length).toFixed(1)}%`);
  }

  // ---- what C would deliver IF something seeded it: the pure learning curve
  console.log(`\n=== C4. the ceiling on C, if a seed existed. Majority of k elections, each decided by the odds table with a true edge s ===`);
  console.log(`  the number is 2p-1: the fraction of a printed value's pips that a k-election history delivers`);
  console.log(`  ${'s (pips)'.padEnd(10)}${'p(one)'.padStart(9)}${[1, 2, 3, 5, 7, 9].map((k) => `k=${k}`.padStart(9)).join('')}`);
  for (const s of [2, 4, 5, 8]) {
    const p1 = odds(s) / 100;
    const majority = (k: number) => {
      let acc = 0;
      for (let w = 0; w <= k; w++) {
        let c = 1;
        for (let i = 0; i < w; i++) c = c * (k - i) / (i + 1);
        const pr = c * Math.pow(p1, w) * Math.pow(1 - p1, k - w);
        acc += pr * (w * 2 > k ? 1 : w * 2 === k ? 0.5 : 0);
      }
      return acc;
    };
    console.log(`  ${String(s).padEnd(10)}${p1.toFixed(3).padStart(9)}${[1, 2, 3, 5, 7, 9].map((k) => (2 * majority(k) - 1).toFixed(3).padStart(9)).join('')}`);
  }

  // ---- where a carrier could bite at all
  const pc = (a: number, b: number) => `${(100 * a / b).toFixed(1)}%`;
  console.log(`\n=== C5. where a district-partisanship modifier can change a House result at all ===`);
  console.log(`  House GENERALS ${bite.gen}: contested ${bite.genContested} (${pc(bite.genContested, bite.gen)}), of which two different parties ${bite.genCrossParty}`);
  console.log(`  House PRIMARIES ${bite.pri}: contested ${bite.priContested} (${pc(bite.priContested, bite.pri)})`);
  console.log(`  a PARTY-KEYED carrier (A, B, or any printed district lean) cancels in a primary — both sides are the same party — so it can only`);
  console.log(`  ever decide the ${pc(bite.genCrossParty, bite.gen + bite.pri)} of House races that are cross-party contested generals.`);
  console.log(`  the identity bonus (D) separates the sides in ${bite.genIdentityDiffers} of ${bite.genContested} contested generals (${pc(bite.genIdentityDiffers, bite.genContested)})`);
  console.log(`  and in ${bite.priIdentityDiffers} of ${bite.priContested} contested PRIMARIES (${pc(bite.priIdentityDiffers, bite.priContested)}), where the noise floor is SD 2.42, not 4.18.`);

  // ---- the fitted table itself, because B's whole claim is that it realigns
  console.log(`\n=== B's table, fitted per era (district effect in share points = pips; + = D) ===`);
  console.log(`  ${'tag'.padEnd(13)}${['A 1976-80', 'C 1992-2000', 'D 2002-10', 'E 2012-18'].map((h) => h.padStart(14)).join('')}`);
  for (const tag of TAGS) {
    const cells = ['A', 'C', 'D', 'E'].map((le) => {
      const t = tagTable(le).get(tag);
      return t ? `${t.v >= 0 ? '+' : ''}${t.v.toFixed(1)} (${t.n})`.padStart(14) : '—'.padStart(14);
    });
    console.log(`  ${tag.padEnd(13)}${cells.join('')}`);
  }
}

main();
