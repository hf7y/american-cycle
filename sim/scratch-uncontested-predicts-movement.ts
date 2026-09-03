/** Scratch: hf7y/american-cycle#103 -- does an uncontested race predict where
 *  a district is going, or nothing at all?
 *
 *  #10 scales a lean push by how decisively a race was won and was ruled
 *  PROVISIONALLY ZERO on the walkover case pending this measurement: crediting
 *  a walkover with a push assumes a party stopped fielding candidates because
 *  the state moved, and the alternative is that it is a recruitment/filing
 *  artefact carrying no information. #93 is the precondition this inherits --
 *  an engine walkover and the returns' unopposed flag are not the same
 *  quantity, so the historical class tested here is *effective
 *  uncompetitiveness* (unopposed, or a margin so lopsided nobody seriously
 *  contested it), at #93's own threshold band, not the bare unopposed rate.
 *
 *  METHOD. Reuses the exact "surprise persistence" framework
 *  `findings/historical-push.ts` already established and #10's ruling already
 *  cites: a district's SURPRISE is its two-party Democratic share, minus the
 *  national share that year (the LEVEL), minus its own average deviation over
 *  the redistricting era it sits in (the district's own norm -- the "current
 *  partisanship" match). MOVEMENT is next-cycle surprise minus this-cycle
 *  surprise. Regressing movement on this-cycle surprise gives a PERSISTENCE
 *  slope: -1 is the exact null for i.i.d. noise (no information carries
 *  forward), values above -1 mean an over-performance persists, below -1
 *  would mean it overshoots.
 *
 *  This is computed twice per horizon and threshold: once restricted to
 *  district-years classified "effectively uncontested" AT THE EARLIER YEAR,
 *  once restricted to the contested remainder -- both populations already
 *  matched on current partisanship by construction, since the persistence
 *  slope conditions on the district's own surprise level rather than
 *  comparing raw magnitudes (which would be confounded: an uncontested race
 *  is, almost by definition, one with a large current surprise already).
 *
 *  Districts that are unopposed have degenerate raw shares (0 or 100), which
 *  is a ballot-line artefact, not a preference -- so shares are Gelman-King
 *  imputed at 75/25 (winner/loser) EVERYWHERE, matching the P2 population
 *  already used in sim/district-partisanship.ts, so a district's own
 *  uncontested years still contribute a plausible surprise level rather than
 *  pinning it to a wall.
 *
 *  node sim/scratch-uncontested-predicts-movement.ts
 */
import { readFileSync } from 'node:fs';
import { PANEL, era, mean, type Row } from './district-partisanship.ts';

const panel = JSON.parse(readFileSync(new URL(`../${PANEL}`, import.meta.url), 'utf8')) as {
  rows: [number, string, number, number, number, number][];
};
const rows: Row[] = panel.rows.map(([year, state, district, dem, rep, inc]) => ({ year, state, district, dem, rep, inc }));

const unit = (r: Row) => `${r.state}-${r.district}|${era(r.year)}`;
/** undefined for the (rare) row with zero votes on both sides -- no data. */
const margin = (r: Row) => (r.dem + r.rep === 0 ? undefined : (100 * Math.abs(r.dem - r.rep)) / (r.dem + r.rep));
/** Gelman-King stand-in for a race nobody bothered to contest: not a 100-0
 *  district, one nobody ran against the incumbent's expected 75-25. */
const imputedShare = (r: Row) => (r.rep === 0 ? 75 : r.dem === 0 ? 25 : (100 * r.dem) / (r.dem + r.rep));

/** #93's own band: "unopposed", "unopposed or margin >= 40/30/20pp". 100 is
 *  exactly the unopposed row -- a one-sided race has margin defined as
 *  exactly 100, so >=100 selects only that. */
const THRESHOLDS = [100, 40, 30, 20];

function slope(xs: number[], ys: number[]): number {
  const n = xs.length, mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return sxy / sxx;
}

// national two-party House vote share each year, from the REAL vote totals --
// an uncontested race still casts real votes and belongs in this denominator.
const byYear = new Map<number, { d: number; r: number }>();
for (const row of rows) {
  const c = byYear.get(row.year) ?? { d: 0, r: 0 };
  c.d += row.dem; c.r += row.rep;
  byYear.set(row.year, c);
}
const nationalShare = (y: number) => { const c = byYear.get(y)!; return (100 * c.d) / (c.d + c.r); };

interface Point { year: number; unit: string; dev: number; marginAtT: number | undefined }
const withData = rows.filter((r) => r.dem + r.rep > 0);
const points: Point[] = withData.map((r) => ({ year: r.year, unit: unit(r), dev: imputedShare(r) - nationalShare(r.year), marginAtT: margin(r) }));

const byUnit = new Map<string, Point[]>();
for (const p of points) { if (!byUnit.has(p.unit)) byUnit.set(p.unit, []); byUnit.get(p.unit)!.push(p); }
for (const ps of byUnit.values()) ps.sort((a, b) => a.year - b.year);

interface Pair { d0: number; move: number; surpriseD0: number; surpriseMove: number; marginAtT: number }
function pairsAtHorizon(k: number): Pair[] {
  const out: Pair[] = [];
  for (const ps of byUnit.values()) {
    if (ps.length < 3) continue; // same 3-observation floor district-partisanship.ts uses to trust a unit's own norm
    const norm = mean(ps.map((p) => p.dev));
    const byYearInUnit = new Map(ps.map((p) => [p.year, p]));
    for (const t of ps) {
      if (t.marginAtT === undefined) continue;
      const fut = byYearInUnit.get(t.year + 2 * k);
      if (!fut) continue;
      out.push({
        d0: t.dev, move: fut.dev - t.dev,
        surpriseD0: t.dev - norm, surpriseMove: fut.dev - t.dev,
        marginAtT: t.marginAtT,
      });
    }
  }
  return out;
}

console.log('#103: does an uncontested (or effectively uncontested) race predict subsequent district movement?');
console.log(`${withData.length} district-year general elections with recorded votes, 1976-2018 (district-eras with < 3 observations excluded from the persistence fit, matching sim/district-partisanship.ts)`);
console.log('\nPersistence slope of next-cycle surprise-movement on this-cycle surprise. -1 is the exact null (no information carries forward, matching findings/historical-push.ts\'s calibration); above -1 means the surprise persists.\n');

for (const k of [1, 2, 3]) {
  const pairs = pairsAtHorizon(k);
  console.log(`--- ${k} cycle${k > 1 ? 's' : ''} ahead (${2 * k} years), n=${pairs.length} pairs ---`);
  for (const T of THRESHOLDS) {
    const label = T === 100 ? 'unopposed' : `unopposed or margin>=${T}pp`;
    const eff = pairs.filter((p) => p.marginAtT >= T);
    const cont = pairs.filter((p) => p.marginAtT < T);
    if (eff.length < 20 || cont.length < 20) { console.log(`  ${label.padEnd(24)} too few pairs (n=${eff.length} vs ${cont.length}) -- skipped`); continue; }
    const slopeEff = slope(eff.map((p) => p.surpriseD0), eff.map((p) => p.surpriseMove));
    const slopeCont = slope(cont.map((p) => p.surpriseD0), cont.map((p) => p.surpriseMove));
    // growth: does the surprise get MORE extreme (compounds, >0) or revert
    // toward the district's own norm (<0)? Plain share points = pips.
    const growth = (rs: Pair[]) => mean(rs.map((p) => Math.abs(p.surpriseD0 + p.surpriseMove) - Math.abs(p.surpriseD0)));
    const gEff = growth(eff), gCont = growth(cont);
    console.log(`  ${label.padEnd(24)} n=${String(eff.length).padStart(5)}/${String(cont.length).padStart(5)}  slope ${slopeEff.toFixed(3).padStart(7)} vs ${slopeCont.toFixed(3).padStart(7)}  (delta from contested ${(slopeEff - slopeCont).toFixed(3)})   mean growth ${gEff.toFixed(2).padStart(6)} vs ${gCont.toFixed(2).padStart(6)} pips  (delta ${(gEff - gCont).toFixed(2)} pips)`);
  }
}
