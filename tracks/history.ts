/** The historical column — figures DERIVED from the committed returns, never
 *  typed in.
 *
 *  WHY DERIVED. A number quoted into a test is true on the day it is written
 *  and silently false afterwards, which is the whole reason `findings/` re-runs
 *  its predicates. The same applies harder here: a Track D bar quoted from
 *  memory is a bar nobody can check. Everything below is computed from
 *  `data/historical/`, so these are as much a guard on the datasets as on the
 *  engine, and they cannot rot by tuning.
 *
 *  WHAT IS AND IS NOT IN RANGE. `house_district_panel` covers 1976-2018 and
 *  `pres_state_panel` 1976-2016. Claims about 1947-1975 -- the Deep South's
 *  0% Republican years, the 1964 and 1972 gaps -- are OUTSIDE both, and are
 *  marked as such rather than silently extrapolated.
 */
import { readFileSync } from 'node:fs';

const panel = (f: string): { columns: string[]; rows: (string | number)[][] } =>
  JSON.parse(readFileSync(new URL(`../data/historical/${f}`, import.meta.url), 'utf8'));

const HOUSE = panel('house_district_panel.json').rows as [number, string, number, number, number, number][];
const PRES = panel('pres_state_panel.json').rows as [number, string, number, number][];

/** The five states the design doc's cross-office table tracks: Goldwater's
 *  1964 sweep outside Arizona. */
export const DEEP_SOUTH = ['AL', 'GA', 'LA', 'MS', 'SC'];

/** House seats won, by (year, state), as [D, R]. A race with no votes on one
 *  side is still a seat won; a race with none on either is not in the data. */
function seatsByYearState(): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>();
  for (const [y, st, , d, r] of HOUSE) {
    if (d + r === 0) continue;
    const k = `${y}|${st}`;
    const cur = m.get(k) ?? [0, 0];
    cur[d > r ? 0 : 1]++;
    m.set(k, cur);
  }
  return m;
}

/** The party carrying each state at the top of the ticket. */
function topOfTicket(): Map<string, 'D' | 'R'> {
  return new Map(PRES.map(([y, st, d, r]) => [`${y}|${st}`, d > r ? 'D' : 'R'] as const));
}

/** Wilson score interval, which is the right one at n=11 -- the normal
 *  approximation puts the upper bound above 1 and would read as "no ceiling". */
export function wilson(k: number, n: number, z = 1.96): { p: number; lo: number; hi: number } {
  const p = k / n, z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/** D1. Did the president's party lose House seat SHARE at each midterm?
 *
 *  Share rather than seat count, because apportionment moves. The president's
 *  party by year is the one input that is not in the panel; it is a matter of
 *  public record and is listed rather than inferred. */
const PRESIDENT_PARTY: Record<number, 'D' | 'R'> = {
  1977: 'D', 1978: 'D', 1979: 'D', 1980: 'D',
  1981: 'R', 1982: 'R', 1983: 'R', 1984: 'R', 1985: 'R', 1986: 'R', 1987: 'R', 1988: 'R',
  1989: 'R', 1990: 'R', 1991: 'R', 1992: 'R',
  1993: 'D', 1994: 'D', 1995: 'D', 1996: 'D', 1997: 'D', 1998: 'D', 1999: 'D', 2000: 'D',
  2001: 'R', 2002: 'R', 2003: 'R', 2004: 'R', 2005: 'R', 2006: 'R', 2007: 'R', 2008: 'R',
  2009: 'D', 2010: 'D', 2011: 'D', 2012: 'D', 2013: 'D', 2014: 'D', 2015: 'D', 2016: 'D',
  2017: 'R', 2018: 'R',
};

export function midtermLoss(): { rate: number; lost: number; n: number; lo: number; hi: number; exceptions: number[] } {
  const national = new Map<number, [number, number]>();
  for (const [y, , , d, r] of HOUSE) {
    if (d + r === 0) continue;
    const cur = national.get(y) ?? [0, 0];
    cur[d > r ? 0 : 1]++;
    national.set(y, cur);
  }
  const years = [...national.keys()].sort((a, b) => a - b);
  let lost = 0, n = 0;
  const exceptions: number[] = [];
  years.forEach((y, i) => {
    if (y % 4 !== 2 || i === 0) return;
    const p = PRESIDENT_PARTY[y];
    if (!p) return;
    const idx = p === 'D' ? 0 : 1;
    const prev = national.get(years[i - 1])!, now = national.get(y)!;
    const before = prev[idx] / (prev[0] + prev[1]);
    const after = now[idx] / (now[0] + now[1]);
    n++;
    if (after < before) lost++; else exceptions.push(y);
  });
  return { ...wilson(lost, n), rate: lost / n, lost, n, exceptions };
}

/** C3. The cross-office gap, as the test program's SPEC defines it: the
 *  top-of-ticket party's share of that state's House seats, subtracted from
 *  100.
 *
 *  NOTE A DISCREPANCY IN THE SOURCE. The test program's prose defines GAP that
 *  way, but its worked table is keyed on the REPUBLICAN share in every row —
 *  which is a different quantity the moment the top of the ticket flips. On
 *  1976 the two disagree completely: spec-consistent gives 24.9pp, R-keyed
 *  gives 75.1pp, and only the R-keyed reading supports the table's "reversed"
 *  note. Both are computed below; the engine measures the spec version, so
 *  that is the one used as a bar. */
export function crossOfficeGap(): {
  allStatesMean: number; deepSouthMean: number; shareAbove69: number;
  deepSouthRKeyed: { year: number; gap: number }[];
} {
  const seats = seatsByYearState(), top = topOfTicket();
  const gaps: number[] = [], ds: number[] = [];
  const rKeyed: { year: number; gap: number }[] = [];
  const years = [...new Set(PRES.map(([y]) => y))].sort((a, b) => a - b);
  for (const y of years) {
    let dsR = 0, dsN = 0;
    for (const [k, h] of seats) {
      const [yy, st] = k.split('|');
      if (Number(yy) !== y) continue;
      const p = top.get(k);
      if (!p || h[0] + h[1] === 0) continue;
      const gap = 100 - (100 * h[p === 'D' ? 0 : 1]) / (h[0] + h[1]);
      gaps.push(gap);
      if (DEEP_SOUTH.includes(st)) {
        ds.push(gap);
        dsR += (100 * h[1]) / (h[0] + h[1]); dsN++;
      }
    }
    if (dsN) rKeyed.push({ year: y, gap: 100 - dsR / dsN });
  }
  return {
    allStatesMean: gaps.reduce((a, b) => a + b, 0) / gaps.length,
    deepSouthMean: ds.reduce((a, b) => a + b, 0) / ds.length,
    shareAbove69: gaps.filter((g) => g >= 69).length / gaps.length,
    deepSouthRKeyed: rKeyed,
  };
}

/** B1. A House race with no votes recorded on one side was unopposed. This is
 *  the only like-for-like comparison the engine's walkover share has, and it
 *  must be taken against HOUSE GENERALS alone -- the engine's own figure is
 *  over every event, primaries and fifty presidential state races included. */
export function unopposedHouseShare(): { share: number; n: number } {
  const n = HOUSE.length;
  return { share: HOUSE.filter(([, , , d, r]) => d === 0 || r === 0).length / n, n };
}

/** B1 (#93). A House race with no votes recorded on one side is the ONLY
 *  like-for-like counterpart the engine's raw walkover share has -- but
 *  reality also runs a sacrificial candidate who loses 80-20, which the
 *  panel's vote counts show as contested and the engine's empty-ballot-line
 *  model cannot produce at all. Effective competitiveness widens "safe" from
 *  strictly-unopposed to a margin threshold, so the reader sees a band
 *  instead of one number picked to imply a single right answer. `pp` is a
 *  parameter, not a constant, because the honest reporting is the band across
 *  several thresholds, not one row. */
export function effectiveCompetitiveness(pp: number): { share: number; n: number } {
  const margins = HOUSE.map(([, , , d, r]) => (d + r === 0 ? undefined : (100 * Math.abs(d - r)) / (d + r)))
    .filter((m): m is number => m !== undefined);
  return { share: margins.filter((m) => m >= pp).length / margins.length, n: margins.length };
}

/** D5. Deep South Republican share of House seats, per cycle. The realignment
 *  this measures BEGINS before the panel: 0% Republican 1947-1963 and 18.9% in
 *  1965 are outside it, so what the data can show is the second half — the
 *  three decades it took to convert a presidential lean into a delegation. */
export function deepSouthRShare(): { year: number; share: number }[] {
  const seats = seatsByYearState();
  const out: { year: number; share: number }[] = [];
  const years = [...new Set(HOUSE.map(([y]) => y))].sort((a, b) => a - b);
  for (const y of years) {
    let d = 0, r = 0;
    for (const st of DEEP_SOUTH) {
      const h = seats.get(`${y}|${st}`);
      if (h) { d += h[0]; r += h[1]; }
    }
    if (d + r) out.push({ year: y, share: (100 * r) / (d + r) });
  }
  return out;
}

/** The first cycle at which the Deep South delegation went majority-R, and how
 *  long that was after the presidential lean turned. The lean turned in 1964
 *  (Goldwater carried all five), which predates the panel, so the lag is
 *  measured from that documented date to a cycle the data does show. */
export function realignmentLagYears(): { leanTurned: number; seatsFlipped?: number; lagYears?: number } {
  const flip = deepSouthRShare().find((x) => x.share > 50);
  return { leanTurned: 1964, seatsFlipped: flip?.year, lagYears: flip ? flip.year - 1964 : undefined };
}
