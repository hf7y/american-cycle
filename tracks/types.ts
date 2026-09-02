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
 *
 *  NOTHING HERE MAY IMPORT A MODULE THAT POSTDATES THE OLDEST BUILD IT
 *  RUNS AGAINST, and nothing may read a `GameResult` field without asking
 *  whether this build has one. That is not defensive style, it is the whole
 *  premise: a suite pinned to the build it was written on cannot produce a
 *  before-and-after, which is the one thing a baseline is for. `probe`
 *  answers what the build under test can be asked; `TrackItem.needs`
 *  declares what an item requires; the runner reports NOT MEASURABLE, which
 *  is a different fact from NOT RUN and from RED.
 */
import type { GameResult } from '../engine/game.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';

/** WHERE A PASSING THRESHOLD CAME FROM.
 *
 *  Not decoration. A green against a bar somebody else set is evidence; a
 *  green against a bar the author drew after seeing the data is a scoreboard
 *  drawn around where the ball landed. Both belong in the suite -- an
 *  authored bar is still better than no bar -- but they are not the same
 *  claim and a reader cannot tell them apart from the number.
 *
 *  WEAKEST LINK. A compound threshold takes the provenance of its weaker
 *  half: an item whose first bar is quoted from the brief and whose second is
 *  a number the author picked is `authored-here`, because passing it still
 *  requires clearing something nobody external asked for. */
export type Oracle =
  /** the repo's own simulation brief, quoted */
  | 'SIM-BRIEF'
  /** the v0.2 build doc or the test program, quoted */
  | 'design-doc'
  /** the postwar record, as a figure rather than as a direction */
  | 'historical-record'
  /** set in tracks/, by whoever wrote the item, after seeing the data */
  | 'authored-here';

export interface Measure {
  name: string;
  value: number;
  unit?: string;
  /** sample size behind the value, where one exists */
  n?: number;
  /** What the real record does, in the same unit, DERIVED from
   *  `data/historical/` rather than quoted. Present only where a like-for-like
   *  comparison exists — and "like-for-like" is the hard part, not the
   *  arithmetic. The engine's walkover share counts primaries and fifty
   *  presidential state races; the returns count House generals. Comparing
   *  those two would manufacture a gap out of a definition. */
  historical?: number;
  /** Why this comparison is fair, or what it is not. Required wherever
   *  `historical` is, because a bare second number invites the reader to
   *  subtract two things that are not the same quantity. */
  historicalNote?: string;
}

/** What the build under test can be asked. Detected from a played result and
 *  the config in force, never from a version string -- a worktree has no
 *  version, and the fields are the thing that actually matters. */
export interface Capabilities {
  /** `GameResult.bills`: the enacted-bill corpus, with a repeal (v0.2 item 2) */
  corpus: boolean;
  /** `GameResult.endedBy` and `.amendments`: an ending that is not the clock (item 3) */
  ending: boolean;
  /** the impeachment backfire, shutdown blame and economic shock knobs (items 7-9) */
  backfireShutdownShock: boolean;
  /** `GameResult.shutdownBlame`: which party was blamed, and whether it held a
   *  chamber. Item 8's direction cannot be tested without the second half. */
  shutdownBlame: boolean;
}

export const CAPABILITY_NOTE: Record<keyof Capabilities, string> = {
  corpus: 'GameResult.bills — this build counts bills passed and discards them, so there is no corpus to read',
  ending: 'GameResult.endedBy — this build has no ending but the year cap, so "ends by condition" is 0 by construction',
  backfireShutdownShock: 'legislature.impeachBackfirePips / shutdownPips / economy.shockOnRollAtMost — the rules are not in this build',
  shutdownBlame: 'GameResult.shutdownBlame — this build does not record who was blamed for a failed bill',
};

/** Ask the build, do not assume it. A result object and a config are enough. */
export function probe(r: Record<string, unknown>, cfg: Record<string, any>): Capabilities {
  return {
    corpus: Array.isArray(r.bills),
    ending: 'endedBy' in r && Array.isArray(r.amendments),
    backfireShutdownShock: cfg.legislature?.impeachBackfirePips !== undefined
      || cfg.legislature?.shutdownPips !== undefined
      || cfg.economy?.shockOnRollAtMost !== undefined,
    shutdownBlame: Array.isArray(r.shutdownBlame),
  };
}

/** Set-overlap distance over tag sets, 0 identical and 1 disjoint.
 *
 *  DELIBERATELY A SECOND COPY of `engine/rules/tags.ts`'s `distance`, because
 *  that module postdates v0.1.2 and importing it would make this whole file
 *  unloadable on the build it most needs to measure. The two are held together
 *  by `tracks/overlap.test.ts`, which fails if they ever disagree. Returns
 *  undefined when either side is empty: that is "not asked", not agreement. */
export function overlapDistance(a: readonly string[], b: readonly string[]): number | undefined {
  if (!a.length || !b.length) return undefined;
  const wa = new Map<string, number>(), wb = new Map<string, number>();
  for (const t of a) wa.set(t, (wa.get(t) ?? 0) + 1 / a.length);
  for (const t of b) wb.set(t, (wb.get(t) ?? 0) + 1 / b.length);
  let overlap = 0;
  for (const [t, v] of wa) overlap += Math.min(v, wb.get(t) ?? 0);
  return 1 - overlap;
}

export interface TrackCtx {
  cards: Card[];
  cfg: Config;
  can: Capabilities;
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
  /** What this item needs the build to have. Unmet means NOT MEASURABLE,
   *  which is neither a pass nor a failure nor a decision not to build:
   *  it is the older build being asked a question it has no answer to. */
  needs?: (keyof Capabilities)[];
  run?(ctx: TrackCtx): Measure[] | Promise<Measure[]>;
  /** Where this item's passing threshold comes from. Required wherever
   *  `accept` is, because a verdict without a provenance is not readable. */
  oracle?: Oracle;
  /** Set when the MEASURED VALUE, not the bar, depends on a knob somebody
   *  tuned to reach it. A green here says the dial is where it was put, which
   *  is a much weaker claim than a green on an emergent number. */
  calibrated?: string;
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
