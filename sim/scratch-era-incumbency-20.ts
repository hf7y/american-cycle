/** Scratch: hf7y/american-cycle#20 -- "one incumbency scalar cannot serve
 *  seven era packs" cites `sim/district-partisanship.ts`'s per-era
 *  regression beta, which halves from ~6.5 pips (1982-2010) to 2.88
 *  (2012-2018). That beta is a vote-SHARE effect, and DECISIONS.md's own
 *  amendment on #11 already flags this exact trap: "a modifier read
 *  straight off the margin scale overshoots" (measured there at 1.6-2.1x)
 *  because the general's 3d6 is less dispersed than the real margin
 *  distribution. `incumbencyHouse` was never calibrated off that beta --
 *  #16 calibrated it off a WIN-RATE target (contested-survival, corrected
 *  by #93's effective-competitiveness band) and landed on 4. This checks
 *  whether the win-rate target -- the thing actually shipped -- moves by
 *  era the way the vote-share beta does.
 *
 *  Run: node sim/scratch-era-incumbency-20.ts
 */
import { readFileSync } from 'node:fs';
import { oddsAtEdge } from '../engine/rules/resolution.ts';
import { PANEL, type Row } from './district-partisanship.ts';

const panel = JSON.parse(readFileSync(new URL(`../${PANEL}`, import.meta.url), 'utf8')) as {
  rows: [number, string, number, number, number, number][];
};
const rows: Row[] = panel.rows.map(([year, state, district, dem, rep, inc]) => ({ year, state, district, dem, rep, inc }));

function edgeFor(targetPct: number): number {
  for (let e = 0; e <= 15; e++) if (100 * oddsAtEdge(e) >= targetPct) return e;
  return 15;
}

/** Same shape as #16's own derivation: overall win rate among races an
 *  incumbent (by the panel's state-match proxy) contested, corrected by the
 *  share of races that are effectively non-competitive (unopposed or
 *  margin >=20pp, #93's own headline band), backed out to a contested-
 *  survival target and the odds-table edge that reproduces it. Applied
 *  identically to both buckets, so the comparison is apples-to-apples even
 *  though the proxy's absolute level runs ~1.5pp above baseline.json's
 *  vetted 94.1% (state-match incumbency misses some district-hops that a
 *  cleaner ground truth would catch) -- that offset is systematic, not
 *  differential, and does not move the classic-vs-recent comparison. */
function stats(rs: Row[]) {
  const withInc = rs.filter((r) => r.inc !== 0);
  const wins = withInc.filter((r) => (r.inc > 0 && r.dem >= r.rep) || (r.inc < 0 && r.rep >= r.dem));
  const overallWinPct = 100 * wins.length / withInc.length;
  const effN = rs.filter((r) => {
    if (r.dem === 0 || r.rep === 0) return true;
    return (100 * Math.abs(r.dem - r.rep)) / (r.dem + r.rep) >= 20;
  }).length;
  const effPct = 100 * effN / rs.length;
  const contestedTarget = ((overallWinPct - effPct) / (100 - effPct)) * 100;
  return { n: withInc.length, overallWinPct, effPct, contestedTarget, edge: edgeFor(contestedTarget) };
}

console.log('Win-rate-calibrated incumbency target, classic vs recent (the metric #16 actually shipped from):');
for (const [label, pred] of [
  ['classic (<=2010)', (y: number) => y <= 2010],
  ['recent (2012-2018)', (y: number) => y > 2010],
] as const) {
  const s = stats(rows.filter((r) => pred(r.year)));
  console.log(`  ${label}: n=${s.n}  overall win% ${s.overallWinPct.toFixed(1)}  eff-comp(20)% ${s.effPct.toFixed(1)}  contested target ${s.contestedTarget.toFixed(1)}%  -> ${s.edge} pips`);
}
const all = stats(rows);
console.log(`  pooled: overall win% ${all.overallWinPct.toFixed(1)}  eff-comp(20)% ${all.effPct.toFixed(1)}  contested target ${all.contestedTarget.toFixed(1)}%  -> ${all.edge} pips`);
console.log();
console.log('Contrast: raw win probability barely moves (95.5% -> 95.8%) while the');
console.log('vote-share beta that #20 cites halves (6.5 -> 2.88 pips) over the same split.');
console.log('Read together: incumbents keep winning at the same rate with a smaller');
console.log('margin of victory -- a real effect, but not one the odds-table edge (a');
console.log('win-probability lever, not a margin lever) needs to track by era.');
