/** The Skowronek checks: does american-cycle produce political time?
 *
 *  These are DESIGN TARGETS, not regressions. Most are expected to fail on the
 *  current build and are meant to keep failing until the design changes. This
 *  suite is never wired into `npm test` or the blocking CI job — it is invoked
 *  by hand, `npm run skowronek`, and it reports.
 *
 *  TWO RULES CARRIED FROM THE REPO, both of which shape the code below.
 *
 *  1. hf7y/american-cycle#22: a check that passes while stamping an unhealthy
 *     number is worse than no check. So `Check` has no bare boolean. Every
 *     check carries its measures — value, n, standard error — and the verdict
 *     is rendered NEXT TO them, never instead of them.
 *
 *  2. No "the game cannot do X" without a control showing the measurement
 *     could have detected X. Since this build reports structural absence rather
 *     than scoring a proxy settlement, that rule is met by POSITIVE CONTROLS on
 *     the instruments: a detector is fed a synthetic case it must fire on
 *     before its silence on real runs is reported as a fact about the game.
 *     See `controls()`.
 */
import type { RunObs, YearObs } from './observe.ts';
import {
  BILL_CORPUS_ABSENT, BILL_POSITION_ABSENT, COMPASS, dist, norm, type Position,
} from './position.ts';

// ------------------------------------------------------------- preconditions

/** What a quadrant needs to exist before it can be detected at all. */
export type Precondition =
  | 'BILL_CORPUS'          // enacted bills persist as a body of law
  | 'BILL_POSITION'        // a bill is a point in compass space
  | 'SETTLEMENT_FORMATION' // a durable settlement position exists at all
  | 'SETTLEMENT_MOVEMENT'  // legislation can move that position
  | 'STRAIN_RISE'          // settlement and country can diverge, and do
  | 'POWER_CONCENTRATION'  // a player holds sustained power
  | 'EFFICACY_DROP';       // efficacy can fall to ~0 while power is held

export interface PreconditionState {
  id: Precondition;
  /** met, absent, or absent-by-construction (no run can change it) */
  status: 'MET' | 'ABSENT' | 'ABSENT_BY_CONSTRUCTION';
  /** the measured basis, or the code citation for a construction-level absence */
  why: string;
  /** the control that shows this verdict is about the game, not the instrument */
  control?: string;
}

export const QUADRANT_NEEDS: Record<string, Precondition[]> = {
  ARTICULATION: ['SETTLEMENT_FORMATION', 'BILL_POSITION', 'SETTLEMENT_MOVEMENT', 'POWER_CONCENTRATION'],
  PREEMPTION: ['SETTLEMENT_FORMATION', 'BILL_CORPUS', 'BILL_POSITION', 'POWER_CONCENTRATION'],
  RECONSTRUCTION: ['SETTLEMENT_FORMATION', 'SETTLEMENT_MOVEMENT', 'BILL_POSITION', 'STRAIN_RISE', 'POWER_CONCENTRATION'],
  DISJUNCTION: ['SETTLEMENT_FORMATION', 'BILL_POSITION', 'SETTLEMENT_MOVEMENT', 'STRAIN_RISE', 'EFFICACY_DROP', 'POWER_CONCENTRATION'],
};

// ---------------------------------------------------------------- statistics

export interface Measure { value: number; n: number; se: number; unit?: string }

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function measure(xs: number[], unit?: string): Measure {
  const n = xs.length;
  if (!n) return { value: NaN, n: 0, se: NaN, unit };
  const m = mean(xs);
  if (n < 2) return { value: m, n, se: NaN, unit };
  const v = xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (n - 1);
  return { value: m, n, se: Math.sqrt(v / n), unit };
}

/** Variance ratio at lag k. 1 ⇒ random walk, <1 ⇒ mean-reverting,
 *  >1 ⇒ trending/persistent. This is the test for "does a settlement FORM, or
 *  does the position just wander" — era check 1. */
export function varianceRatio(xs: number[], k: number): number {
  if (xs.length < k + 2) return NaN;
  const d1: number[] = [], dk: number[] = [];
  for (let i = 1; i < xs.length; i++) d1.push(xs[i] - xs[i - 1]);
  for (let i = k; i < xs.length; i++) dk.push(xs[i] - xs[i - k]);
  const varOf = (a: number[]) => {
    const m = mean(a);
    return a.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, a.length - 1);
  };
  const v1 = varOf(d1);
  if (!(v1 > 0)) return NaN;
  return varOf(dk) / (k * v1);
}

/** Maximal runs of constant sign with magnitude at or above `threshold`.
 *  A "regime" is a stretch where the polity is durably displaced to one side;
 *  a sign flip or a drop back inside the deadband ends it. */
export function regimeRuns(xs: number[], threshold: number): number[] {
  const runs: number[] = [];
  let cur = 0, s = 0;
  for (const x of xs) {
    const sx = Math.abs(x) >= threshold ? Math.sign(x) : 0;
    if (sx !== 0 && sx === s) { cur++; continue; }
    if (cur) runs.push(cur);
    cur = sx !== 0 ? 1 : 0;
    s = sx;
  }
  if (cur) runs.push(cur);
  return runs;
}

export function crossings(xs: number[], threshold: number): number {
  let n = 0, s = 0;
  for (const x of xs) {
    const sx = Math.abs(x) >= threshold ? Math.sign(x) : s;
    if (s !== 0 && sx !== 0 && sx !== s) n++;
    if (sx !== 0) s = sx;
  }
  return n;
}

/** The country-position series of one run, as scalars along axis 0. At n>1
 *  axes this becomes signed projection onto the principal axis; it is the one
 *  place the suite assumes a 1-D reading and it is isolated here on purpose. */
export const countrySeries = (run: RunObs): number[] =>
  run.years.map((y) => (y.country ? y.country[0] : 0));

/** Displacement of the polity from its own baseline. NOT strain: strain is the
 *  distance between a SETTLEMENT and the country, and this build has no
 *  settlement object to be the other end of that measurement. Reported because
 *  it is the closest live quantity, and labelled so it is never read as strain. */
export const countryDrift = (run: RunObs): number[] =>
  run.years.map((y) => (y.country ? norm(y.country) : 0));

// ------------------------------------------------------------- power windows

export interface PowerWindow {
  player: number; from: number; to: number; meanPower: number; meanPowerNoPres: number; heldPresidency: boolean;
}

/** Contiguous stretches where one player's power scalar stays at or above
 *  `floor` for at least `minYears`. These are the units the quadrant detectors
 *  would classify — "each contiguous window of held power" in the spec. */
export function powerWindows(run: RunObs, floor: number, minYears: number, noPres = false): PowerWindow[] {
  const out: PowerWindow[] = [];
  const nP = run.agents.length;
  for (let p = 0; p < nP; p++) {
    let start = -1;
    const vals: number[] = [];
    const push = (endIdx: number) => {
      if (start >= 0 && vals.length >= minYears) {
        const ys = run.years.slice(start, endIdx + 1);
        out.push({
          player: p,
          from: ys[0].year,
          to: ys[ys.length - 1].year,
          meanPower: mean(ys.map((y) => y.power[p])),
          meanPowerNoPres: mean(ys.map((y) => y.powerNoPres[p])),
          heldPresidency: ys.some((y) => y.presidentPlayer === p),
        });
      }
      start = -1; vals.length = 0;
    };
    run.years.forEach((y, i) => {
      const v = noPres ? y.powerNoPres[p] : y.power[p];
      if (v >= floor) { if (start < 0) start = i; vals.push(v); }
      else push(i - 1);
    });
    push(run.years.length - 1);
  }
  return out;
}

// -------------------------------------------------------------------- checks

export interface Check {
  id: string;
  question: string;
  measures: Record<string, Measure>;
  /** HEALTHY / UNHEALTHY are only ever rendered beside the measures above.
   *  BLOCKED means a precondition is missing and nothing was measured. */
  verdict: 'HEALTHY' | 'UNHEALTHY' | 'BLOCKED';
  note: string;
  blockedBy?: Precondition[];
}

/** Historical reference: a Skowronek regime cycle runs roughly 30-40 years. */
export const CYCLE_YEARS_LOW = 30;
export const CYCLE_YEARS_HIGH = 40;
/** Deadband, in lean counters, below which the polity counts as sitting at its
 *  own baseline. Reported alongside a sensitivity sweep so it is not a magic number. */
export const REGIME_THRESHOLD = 0.25;

export function eraChecks(runs: RunObs[], maxYears: number): Check[] {
  const series = runs.map(countrySeries);
  const drift = runs.map(countryDrift);

  // 1 — do settlements form at all?
  const vr = series.map((s) => varianceRatio(s, 4)).filter((x) => Number.isFinite(x));
  const meanAbs = drift.map((d) => mean(d));
  const peak = drift.map((d) => Math.max(...d, 0));
  const cross = runs.map((r, i) => crossings(series[i], REGIME_THRESHOLD) / Math.max(1, r.years.length) * 10);
  // Share of years the polity sits outside the deadband, and the longest
  // unbroken stretch on one side. C1 established that the variance ratio
  // CANNOT carry this judgement -- a step-function settlement scores VR ~1,
  // indistinguishable from a random walk -- so persistence is read from run
  // length and VR is reported as description only.
  const displaced = runs.map((r, i) => drift[i].filter((d) => d >= REGIME_THRESHOLD).length / Math.max(1, r.years.length));
  const longestRun = runs.map((r, i) => Math.max(0, ...regimeRuns(series[i], REGIME_THRESHOLD)));
  const formation: Check = {
    id: 'settlement-formation',
    question: 'Do settlements form at all, or does the country position random-walk with no persistent regime?',
    measures: {
      'mean |country position|': measure(meanAbs, 'lean counters'),
      'peak |country position|': measure(peak, 'lean counters'),
      'years displaced beyond deadband': measure(displaced, 'share'),
      'longest unbroken run on one side': measure(longestRun, 'years'),
      'variance ratio at lag 4 (descriptive)': measure(vr, '1 = random walk'),
      'sign crossings per decade': measure(cross, 'per 10y'),
    },
    verdict: mean(displaced) >= 0.5 && mean(longestRun) >= 8 ? 'HEALTHY' : 'UNHEALTHY',
    note: 'A settlement that forms holds the polity off its own baseline for most of the game and in long '
      + `unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the ${CYCLE_YEARS_LOW}-year `
      + 'historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a '
      + 'regime — and every downstream quadrant then measures nothing. Variance ratio is printed for '
      + 'description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it '
      + 'cannot be the criterion.',
  };

  // 2 — regime duration
  const runsAll = runs.flatMap((r, i) => regimeRuns(series[i], REGIME_THRESHOLD));
  const longest = runs.map((r, i) => Math.max(0, ...regimeRuns(series[i], REGIME_THRESHOLD)));
  const gameLen = runs.map((r) => r.years.length);
  const duration: Check = {
    id: 'regime-duration',
    question: `Do regimes last a cycle? Historical reference is ${CYCLE_YEARS_LOW}-${CYCLE_YEARS_HIGH} years.`,
    measures: {
      'mean regime run': measure(runsAll, 'years'),
      'longest regime per game': measure(longest, 'years'),
      'game length': measure(gameLen, 'years'),
      'config year cap': { value: maxYears, n: runs.length, se: 0, unit: 'years' },
    },
    verdict: mean(longest) >= CYCLE_YEARS_LOW ? 'HEALTHY' : 'UNHEALTHY',
    note: maxYears < CYCLE_YEARS_LOW
      ? `PRECONDITION FAILURE, not a result: the year cap is ${maxYears}, so a ${CYCLE_YEARS_LOW}-year regime `
        + 'cannot be observed in this config however the engine behaves. Read the quadrant table below as '
        + 'undefined rather than negative for this config.'
      : `The cap (${maxYears}y) admits at least one full cycle, so a short mean run here is a fact about the `
        + 'engine and not about the clock.',
  };

  // 4 — constraint on opponents
  const transitions: number[] = [], within: number[] = [];
  for (const r of runs) {
    for (let i = 1; i < r.years.length; i++) {
      const a = r.years[i - 1], b = r.years[i];
      if (!a.country || !b.country) continue;
      const d = dist(a.country, b.country);
      if (a.presidentParty && b.presidentParty && a.presidentParty !== b.presidentParty) transitions.push(d);
      else within.push(d);
    }
  }
  const constraint: Check = {
    id: 'constraint-on-opponents',
    question: 'When power changes hands to the other party, does the settlement position hold?',
    measures: {
      'country move on party turnover': measure(transitions, 'lean counters/yr'),
      'country move within a party': measure(within, 'lean counters/yr'),
      'excess move on turnover': {
        value: mean(transitions) - mean(within), n: transitions.length,
        se: Math.hypot(measure(transitions).se, measure(within).se), unit: 'lean counters/yr',
      },
    },
    verdict: Number.isFinite(mean(transitions)) && mean(transitions) <= mean(within) * 1.5 ? 'HEALTHY' : 'UNHEALTHY',
    note: 'A settlement nobody has to govern inside is not a settlement. If turnover moves the position much '
      + 'more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no '
      + 'settlement object, this measures the POLITY moving, not a settlement resisting — it cannot '
      + 'distinguish "the settlement constrained them" from "there was nothing there to move".',
  };

  // 5 — presidency dependence
  const wWith = runs.flatMap((r) => powerWindows(r, 0.4, 3, false));
  const wNo = runs.flatMap((r) => powerWindows(r, 0.4, 3, true));
  const presDep: Check = {
    id: 'presidency-dependence',
    question: 'Which of this is reachable with the presidency removed from the power scalar?',
    measures: {
      'sustained power windows (with presidency)': measure(runs.map((r) => powerWindows(r, 0.4, 3, false).length), 'per game'),
      'sustained power windows (no presidency)': measure(runs.map((r) => powerWindows(r, 0.4, 3, true).length), 'per game'),
      'mean power in window (with)': measure(wWith.map((w) => w.meanPower)),
      'mean power in window (no presidency)': measure(wNo.map((w) => w.meanPowerNoPres)),
      'windows that held the presidency': measure(wWith.map((w) => (w.heldPresidency ? 1 : 0)), 'share'),
    },
    verdict: wNo.length > 0 ? 'HEALTHY' : 'UNHEALTHY',
    note: 'Power windows that survive dropping the presidency term are the ones a quadrant could be reached '
      + 'from without winning the White House. Zero here would mean every Skowronek category in this game is '
      + 'a presidential category.',
  };

  return [formation, duration, constraint, presDep];
}

/** Era check 3 — quadrant coverage. Reported as reachability, because a share
 *  of zero out of zero classifiable windows is not evidence of anything. */
export function quadrantCoverage(runs: RunObs[], pre: PreconditionState[]): Check[] {
  const byId = new Map(pre.map((p) => [p.id, p]));
  const windows = runs.flatMap((r) => powerWindows(r, 0.4, 3, false)).length;
  return Object.entries(QUADRANT_NEEDS).map(([q, needs]) => {
    const missing = needs.filter((n) => byId.get(n)?.status !== 'MET');
    return {
      id: `quadrant-${q.toLowerCase()}`,
      question: `Is ${q} reachable?`,
      measures: {
        'classifiable power windows': { value: windows, n: runs.length, se: 0, unit: 'windows' },
        'windows classified as this quadrant': { value: missing.length ? NaN : 0, n: runs.length, se: NaN },
      },
      verdict: missing.length ? 'BLOCKED' : 'UNHEALTHY',
      blockedBy: missing,
      note: missing.length
        ? `Never evaluated: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing, so no window `
          + 'could be classified either way. This is an undefined, not a zero.'
        : 'Preconditions met and no window matched.',
    } as Check;
  });
}
