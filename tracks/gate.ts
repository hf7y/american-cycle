/** THE MOVEMENT GATE — hf7y/american-cycle#147.
 *
 *  v0.2's release gates ask whether the INSTRUMENT works: tracks emit,
 *  findings re-derive, the bundle reproduces, CI is green. None of them asks
 *  whether the READING moved toward the record. This is that gate: a FROZEN
 *  set of Track rows, each required to move CLOSER to its `historical`
 *  figure by more than noise between two numbers files, or the gate fails.
 *
 *  The machinery is `sim/tracks.ts --diff`'s own pairing (same `item.id` +
 *  measure `name` across two files, `historical` read off either side) —
 *  this module only adds a required direction and a minimum size to it.
 *
 *  THREE PROPERTIES, so this does not repeat the failure it exists to fix
 *  (#147's own text):
 *
 *  1. THE ROW SET IS FROZEN BEFORE THE WORK IT GRADES, and committed here —
 *     not assembled after seeing which rows moved. Choosing rows after
 *     seeing the diff is the `authored-here` problem one level up.
 *  2. `n/a` FAILS THE GATE, it does not pass it. A row neither side could
 *     measure is not evidence of movement.
 *  3. CLOSER BY EPSILON IS NOT CLOSER. Movement is graded as a fraction of
 *     the REMAINING gap to the record, not an absolute — rows sit on very
 *     different scales (a 0-1 share against a 0-100pp gap), and an absolute
 *     bar would let a small-scale row clear on a rounding error while a
 *     large-scale one needed real work.
 *
 *  ROWS DELIBERATELY LEFT OUT, AND WHY — read before adding one back:
 *
 *  - `D5-realignment-lag` is CLOCK-BOUND: a 16-year game cannot complete a
 *    32-year lag, so requiring movement there requires the clock to run
 *    longer, not the rule to improve. #147's own text names this exclusion.
 *  - `B1-race-resolution`'s walkover-share row carries NO `historical` field
 *    BY DESIGN as of #93 — the raw engine walkover share and the real
 *    unopposed rate are not like-for-like (an engine walkover is an empty
 *    ballot line; the returns run a sacrificial candidate who loses 80-20
 *    and never produce one), so pairing them the way #147's own worked
 *    example does would reintroduce the exact error #93 removed. #147 cited
 *    B1 as a candidate before that field was pulled; it no longer applies to
 *    the current build, and re-choosing a replacement is #147's call, not
 *    this file's.
 *
 *  THE FROZEN SET BELOW IS THEREFORE PROVISIONAL, NOT A RULING: it is every
 *  row in the current build that (a) carries a `historical` figure on the
 *  same measure `--diff` already pairs, and (b) is not clock-bound. #147
 *  asked for the set to be argued, not assumed — this is what's mechanically
 *  available to argue over, not a claim that these three rows are the right
 *  ones to freeze.
 */
import type { Measure } from './types.ts';

export interface NumbersFile {
  tag?: string;
  config?: string;
  items: { id: string; measures?: Measure[] }[];
}

export interface GateRow {
  id: string;
  measure: string;
  /** Minimum improvement, as a fraction of `|before - historical|`, required
   *  to count as real movement rather than noise. */
  minFraction: number;
}

/** 10%: requires a row to close at least a tenth of its remaining distance
 *  to the record between two tags. Authored here, not derived — picked to
 *  sit well above the noise floor #147 itself measured (its own cited
 *  example, a walkover share CLOSER by 0.003 against an 0.83 gap, is 0.36%
 *  of the gap: two orders of magnitude below this) without demanding full
 *  closure, which no single release is likely to produce on any one row. */
export const DEFAULT_MIN_FRACTION = 0.10;

export const FROZEN_GATE_ROWS: GateRow[] = [
  { id: 'D1-midterm-loss', measure: "president's party loses seat share at the midterm", minFraction: DEFAULT_MIN_FRACTION },
  { id: 'C3-cross-office-divergence', measure: 'mean gap', minFraction: DEFAULT_MIN_FRACTION },
  { id: 'C3-cross-office-divergence', measure: 'share of state-cycles above 69pp', minFraction: DEFAULT_MIN_FRACTION },
  { id: 'D7-wave-reversal', measure: 'lag-1 autocorrelation of the national House seat-share swing', minFraction: DEFAULT_MIN_FRACTION },
  { id: 'D7-wave-reversal', measure: 'reversal rate after a swing of >=5.75pp', minFraction: DEFAULT_MIN_FRACTION },
];

export interface GateRowResult {
  id: string;
  measure: string;
  before?: number;
  after?: number;
  historical?: number;
  status: 'CLOSER' | 'FURTHER' | 'UNMOVED' | 'MISSING';
  requiredFraction: number;
  actualFraction?: number;
  pass: boolean;
  note: string;
}

export interface GateResult {
  rows: GateRowResult[];
  pass: boolean;
}

function findMeasure(file: NumbersFile, id: string, name: string): Measure | undefined {
  return file.items.find((x) => x.id === id)?.measures?.find((m) => m.name === name);
}

export function gate(before: NumbersFile, after: NumbersFile, rows: GateRow[] = FROZEN_GATE_ROWS): GateResult {
  const results = rows.map((row): GateRowResult => {
    const b = findMeasure(before, row.id, row.measure);
    const a = findMeasure(after, row.id, row.measure);
    // The historical figure is a property of the item, not of either build
    // (see sim/tracks.ts --diff), so either side may supply it.
    const h = a?.historical ?? b?.historical;
    if (b?.value === undefined || a?.value === undefined || h === undefined) {
      return {
        id: row.id, measure: row.measure, before: b?.value, after: a?.value, historical: h,
        status: 'MISSING', requiredFraction: row.minFraction, pass: false,
        note: 'not measurable on both sides (or no historical figure to grade against) — fails, does not pass by omission',
      };
    }
    const gapBefore = Math.abs(b.value - h);
    const gapAfter = Math.abs(a.value - h);
    const closedBy = gapBefore - gapAfter;
    const status: GateRowResult['status'] = closedBy > 0 ? 'CLOSER' : closedBy < 0 ? 'FURTHER' : 'UNMOVED';
    const actualFraction = gapBefore > 0 ? closedBy / gapBefore : 0;
    const pass = status === 'CLOSER' && actualFraction >= row.minFraction;
    return {
      id: row.id, measure: row.measure, before: b.value, after: a.value, historical: h,
      status, requiredFraction: row.minFraction, actualFraction, pass,
      note: pass
        ? `closed ${(100 * actualFraction).toFixed(1)}% of the gap to the record (>= ${(100 * row.minFraction).toFixed(0)}% required)`
        : status === 'CLOSER'
          ? `closed only ${(100 * actualFraction).toFixed(1)}% of the gap — below the ${(100 * row.minFraction).toFixed(0)}% floor, noise wearing a verdict`
          : `moved ${status.toLowerCase()} the record, not closer`,
    };
  });
  return { rows: results, pass: results.length > 0 && results.every((r) => r.pass) };
}
