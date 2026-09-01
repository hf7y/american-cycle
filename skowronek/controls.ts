/** Controls, and the precondition ledger they justify.
 *
 *  The rule this file exists to satisfy: do not conclude the game cannot
 *  produce something without a control showing the measurement could have
 *  detected it. A silent detector is ambiguous between "the game never does
 *  this" and "my instrument is broken", and only the second is my fault.
 *
 *  Two kinds of control here.
 *
 *  POSITIVE CONTROL ON AN INSTRUMENT (C1, C3) — feed the detector a case it
 *  MUST fire on. The synthetic regime in C1 is a settlement by construction:
 *  if `varianceRatio` and `regimeRuns` cannot see it there, their silence on
 *  real runs says nothing about the engine.
 *
 *  BEHAVIOURAL CONTROL (C2) — the spec's own disjunction control, applied one
 *  level up. To tell CANNOT ACT from CHOOSES NOT TO ACT, re-run the same seeds
 *  with a pool that maximises bills passed and never declines to act. If the
 *  maximiser passes far more bills and the settlement position still does not
 *  move, the constraint is structural. `BillMaximizer` already ships in
 *  sim/agents.ts, so this control needed no new agent.
 */
import { RNG } from '../engine/rules/rng.ts';
import type { RunObs } from './observe.ts';
import {
  measure, mean, powerWindows, regimeRuns, varianceRatio,
  REGIME_THRESHOLD, type Check, type PreconditionState,
} from './checks.ts';
import { BILL_CORPUS_ABSENT, BILL_POSITION_ABSENT } from './position.ts';

/** C1 — the formation/duration instrument, on three series with known answers. */
export function syntheticControl(): { check: Check; passed: boolean } {
  const n = 40;
  const regime = Array.from({ length: n }, (_, i) => (i < n / 2 ? 2 : -2));
  const rng = new RNG(20260901);
  const walk: number[] = []; let w = 0;
  for (let i = 0; i < n; i++) { w += rng.d6() <= 3 ? -1 : 1; walk.push(w); }
  const noise: number[] = [];
  for (let i = 0; i < n; i++) noise.push(rng.d6() <= 3 ? -1 : 1);

  const longest = (xs: number[]) => Math.max(0, ...regimeRuns(xs, REGIME_THRESHOLD));
  const m = {
    'synthetic regime: longest run': { value: longest(regime), n: 1, se: 0, unit: 'years' },
    'synthetic regime: variance ratio': { value: varianceRatio(regime, 4), n: 1, se: 0 },
    'random walk: longest run': { value: longest(walk), n: 1, se: 0, unit: 'years' },
    'random walk: variance ratio': { value: varianceRatio(walk, 4), n: 1, se: 0 },
    'white noise: longest run': { value: longest(noise), n: 1, se: 0, unit: 'years' },
    'white noise: variance ratio': { value: varianceRatio(noise, 4), n: 1, se: 0 },
  };
  // WHAT THIS CONTROL ACTUALLY ESTABLISHED, and it is not what was assumed:
  // a step-function regime has variance ratio ~1, the SAME as a random walk,
  // because its first differences are zero everywhere but the one break. So VR
  // cannot identify a settlement -- it separates mean-reversion (noise, VR well
  // below 1) from a walk, and nothing more. Persistence has to be read off RUN
  // LENGTH, which is why `settlement-formation` keys on runs and reports VR as
  // description only. Had C1 not been run, VR would have been the headline
  // criterion and every formation verdict in this suite would have been junk.
  const passed = m['synthetic regime: longest run'].value >= 15
    && m['synthetic regime: longest run'].value > m['white noise: longest run'].value
    && m['white noise: variance ratio'].value < 1;
  return {
    passed,
    check: {
      id: 'control-instrument-liveness',
      question: 'C1: can the formation detector see a settlement that is there by construction?',
      measures: m,
      verdict: passed ? 'HEALTHY' : 'UNHEALTHY',
      note: passed
        ? 'Run length separates a built 20-year regime from white noise (20y vs a handful), and the variance '
          + 'ratio correctly marks noise as mean-reverting. NOTE the caveat this control surfaced: the step '
          + 'regime scores VR 0.99 and the random walk 1.10, so VR does NOT distinguish a settlement from a '
          + 'walk. Persistence is read from run length; VR is reported as description only.'
        : 'THE INSTRUMENT IS BROKEN. Every formation and duration number in this report is uninterpretable; '
          + 'fix this before reading anything else.',
    },
  };
}

/** C2 — does ANY non-electoral mechanism write to the settlement board?
 *
 *  This replaces a pool-swap comparison that could not answer the question. An
 *  all-BillMaximizer pool passes ~6x the bills, but it also declares, withdraws
 *  and votes differently, so any difference in the board confounds "bills moved
 *  it" with "they played elections differently" — and the RNG stream diverges
 *  the moment passage differs, so even the same seed is not the same game.
 *
 *  This test needs no second pool and has no confound. §7 gates races on
 *  `isElectionYear`. In a NON-election year no race resolves, so the only lean
 *  writer that can run is `decay`, which moves every state strictly toward zero
 *  (engine/rules/lean.ts). Therefore |lean[state]| must be non-increasing that
 *  year. If |lean| never rises in a non-election year — while bills are passing
 *  in those same years — then nothing legislative writes to the board.
 *
 *  The positive control is the same detector on election years, where pushes
 *  and the honeymoon DO add counters. If it fires there and is silent in
 *  non-election years, its silence is a fact about the engine and not about the
 *  instrument. Both halves are measured on the same runs.
 */
export function leanWriterControl(runs: RunObs[]): { check: Check; movementDetected: boolean } {
  const EPS = 1e-9;
  let electionYears = 0, offYears = 0, electionRises = 0, offRises = 0;
  const offBills: number[] = [], offBillYears: number[] = [];

  for (const r of runs) {
    let bills = 0, byears = 0;
    for (let i = 1; i < r.years.length; i++) {
      const prev = r.years[i - 1], cur = r.years[i];
      let rose = 0;
      for (const st of Object.keys(cur.lean)) {
        if (Math.abs(cur.lean[st]) > Math.abs(prev.lean[st] ?? 0) + EPS) rose++;
      }
      if (cur.isElection) { electionYears++; electionRises += rose; }
      else {
        offYears++; offRises += rose;
        bills += cur.billsPassedCum - prev.billsPassedCum;
        if (cur.isBill) byears++;
      }
    }
    offBills.push(bills); offBillYears.push(byears);
  }

  const detectorLive = electionRises > 0;
  const movementDetected = offRises > 0;

  return {
    movementDetected,
    check: {
      id: 'control-non-electoral-lean-writer',
      question: 'C2: in a year with no election, can anything — legislation included — add lean to the board?',
      measures: {
        'state-years |lean| rose, election years': { value: electionRises, n: electionYears, se: 0, unit: 'state-years' },
        'state-years |lean| rose, NON-election years': { value: offRises, n: offYears, se: 0, unit: 'state-years' },
        'bills passed in non-election years': measure(offBills, 'per game'),
        'non-election bill years per game': measure(offBillYears, 'years'),
      },
      verdict: movementDetected ? 'HEALTHY' : 'UNHEALTHY',
      note: !detectorLive
        ? 'THE DETECTOR IS DEAD: |lean| never rose even in an election year, so its silence off-season proves '
          + 'nothing. Do not read C2.'
        : movementDetected
          ? 'Lean rises in years with no election, so some non-electoral mechanism writes to the board and a '
            + 'legislative settlement channel is at least possible.'
          : 'The detector fires in election years and is silent in every non-election year, while bills pass '
            + 'in those same years. So legislation cannot write to the settlement board at all: lean is '
            + 'election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, '
            + 'not of any agent\'s choices — no pool, however maximising, can move it.',
    },
  };
}

/** C3 — is the power scalar non-degenerate? Otherwise "power never
 *  concentrated" would be a fact about the scalar, not about the game. */
export function powerControl(runs: RunObs[]): { check: Check; concentrated: boolean } {
  const maxPower = runs.map((r) => Math.max(0, ...r.years.flatMap((y) => y.power)));
  const windows = runs.map((r) => powerWindows(r, 0.4, 3, false).length);
  const spread = runs.map((r) => mean(r.years.map((y) => Math.max(...y.power) - Math.min(...y.power))));
  const concentrated = mean(windows) > 0;
  return {
    concentrated,
    check: {
      id: 'control-power-is-measurable',
      question: 'C3: does the power scalar vary and concentrate, so its silence would be a finding?',
      measures: {
        'peak power held': measure(maxPower, 'share of offices'),
        'sustained windows (>=0.4 for >=3y)': measure(windows, 'per game'),
        'mean spread across players': measure(spread),
      },
      verdict: concentrated ? 'HEALTHY' : 'UNHEALTHY',
      note: concentrated
        ? 'Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact '
          + 'about the quadrant and not about the scalar.'
        : 'No player ever holds sustained power by this scalar. Every quadrant is then unreachable for a '
          + 'reason upstream of any settlement: there is no tenure to classify.',
    },
  };
}

/** The ledger. Construction-level absences cite code; the rest cite a control. */
export function preconditions(
  formationHealthy: boolean, movementDetected: boolean, concentrated: boolean, instrumentLive: boolean,
): PreconditionState[] {
  return [
    {
      id: 'BILL_CORPUS',
      status: 'ABSENT_BY_CONSTRUCTION',
      why: BILL_CORPUS_ABSENT,
      control: 'none possible: no run can create a record the engine does not keep.',
    },
    {
      id: 'BILL_POSITION',
      status: 'ABSENT_BY_CONSTRUCTION',
      why: BILL_POSITION_ABSENT,
      control: 'none possible: no run can give a scalar a second dimension.',
    },
    {
      id: 'SETTLEMENT_FORMATION',
      status: formationHealthy ? 'MET' : 'ABSENT',
      why: formationHealthy
        ? 'the country position holds off baseline with a variance ratio above 1'
        : 'the country position random-walks around its own baseline; no persistent regime forms',
      control: instrumentLive
        ? 'C1: the detector fires on a synthetic 20-year regime and not on white noise.'
        : 'C1 FAILED — this verdict is not trustworthy.',
    },
    {
      id: 'SETTLEMENT_MOVEMENT',
      status: movementDetected ? 'MET' : 'ABSENT',
      why: movementDetected
        ? 'passing more bills moved the country position'
        : 'nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills '
          + 'were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts)',
      control: 'C2: |lean| rises in election years and never in non-election years, on the same runs.',
    },
    {
      id: 'STRAIN_RISE',
      status: 'ABSENT_BY_CONSTRUCTION',
      why: 'strain is the distance between a settlement and the country, and this build has no settlement '
        + 'object to be the far end of it. Downstream of BILL_CORPUS and BILL_POSITION.',
      control: 'none possible while the corpus is absent.',
    },
    {
      id: 'EFFICACY_DROP',
      status: 'ABSENT_BY_CONSTRUCTION',
      why: 'efficacy is bills moving the settlement toward the passer, per year of power. With no bill '
        + 'position it is undefined, and with SETTLEMENT_MOVEMENT absent it would be identically zero for '
        + 'every player in every year — which cannot distinguish a blocked leader from an effective one.',
      control: 'C2 shows the movement term is zero for every non-electoral mechanism in the rules.',
    },
    {
      id: 'POWER_CONCENTRATION',
      status: concentrated ? 'MET' : 'ABSENT',
      why: concentrated
        ? 'sustained power windows occur'
        : 'no player holds >=0.4 of offices for >=3 consecutive years',
      control: 'C3: the scalar varies across players and years.',
    },
  ];
}
