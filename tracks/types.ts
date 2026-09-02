/** The test program — four tracks, two oracles, one suite.
 *
 *  VALIDATION vs VERIFICATION. Verification asks whether the build does what
 *  the spec says; validation asks whether the spec describes politics. They
 *  have different oracles — the repo's own SIM-BRIEF bars versus the
 *  historical record — and mixing them is why "test v0.1.2" and "test against
 *  history" kept feeling like the same activity. Track C carries the first
 *  oracle, Track D the second.
 *
 *  TESTS ARE NOT PINNED TO BUILDS; BASELINES ARE. One suite lives on main and
 *  runs against any worktree. What gets frozen per tag is a NUMBERS FILE, and
 *  comparison is diffing two of them. A test written today can be re-run
 *  against v0.1.2 in a year, which is the whole reason this is not `findings/`
 *  — a finding carries its stamp inline and goes stale; a track carries none.
 *
 *  SEPARATE RECORDING FROM JUDGING. `runaway-no-brake` HOLDS while stamping a
 *  determination point of 0.50 against a 75-85% band, because a predicate that
 *  both measures and passes has to pick a tolerance, and a wide one hides
 *  staleness. Track B stamps a number without comment; Track C fails on it
 *  loudly. That is the same problem solved structurally rather than with
 *  another CI step.
 *
 *  TRACK C MUST NOT BLOCK. A test that should be red for six months needs
 *  somewhere to live; that is what makes acceptance-test-first possible.
 */
import type { GameResult } from '../engine/game.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';

export interface Measure {
  name: string;
  value: number;
  unit?: string;
  /** sample size behind the value, where one exists */
  n?: number;
}

export interface TrackCtx {
  cards: Card[];
  cfg: Config;
  configName: string;
  agents: string[];
  seeds: number[];
  /** the shared corpus: one run per seed on `cfg`, played once and reused */
  runs: GameResult[];
}

export interface TrackItem {
  id: string;
  /** B records and never fails. C and D judge, and neither blocks CI. */
  track: 'B' | 'C' | 'D';
  question: string;
  /** Set instead of `run` when an item is deliberately not built. NO SILENT
   *  CAPS: an item that bounds coverage or is skipped says so in the report,
   *  because silent omission reads as "covered everything" when it did not. */
  notRun?: string;
  run?(ctx: TrackCtx): Measure[] | Promise<Measure[]>;
  /** C and D only. B has no oracle by construction. */
  accept?(m: Measure[]): { pass: boolean; note: string };
}

export const pick = (m: Measure[], name: string): number =>
  m.find((x) => x.name === name)?.value ?? NaN;

export const share = (n: number, d: number): number => (d ? n / d : 0);

export function quantile(xs: number[], q: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
