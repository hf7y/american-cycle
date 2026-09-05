/** State lean. Signed pips: positive = R, negative = D,
 *  counters cancelling on placement, which is what a signed integer is.
 *  Neutral is the state's own baseline, not purple: the board tracks
 *  deviation only, exactly as Cook PVI does. */
import type { Office, Party } from '../types/index.ts';

export type Lean = Record<string, number>;

export interface LeanConfig {
  pushByMargin: { maxPips: number; push: number }[];
  decayPerTick: number;
  /** 'annual' removes a counter every year, 'biennial' only in election years,
   *  'annual-stochastic' every year with probability 1/2 -- the same EXPECTED
   *  drift as biennial, with more variance. Whether expectation or variance is
   *  what matters for realignment is an empirical question, not an obvious one. */
  decayFrequency: 'annual' | 'biennial' | 'annual-stochastic';
  governorPushes: 'never' | 'with-lean';
  honeymoonCounter: number;
  maxLean: number;
  /** The push scales by how decisively the race was won, and that leaves open
   *  what a walkover does -- a race nobody contested has no margin at all.
   *  0 reads it as "a race nobody tested tells you nothing"; 1 reads running
   *  unopposed as itself decisive. The gap is real either way (hf7y/american-cycle#10, still open). */
  uncontestedPush?: number;
  /** The nationalisation ordering, as data rather than a constant, so the
   *  claim that the Senate's lean push is what makes it dominant can be
   *  tested by moving the House above it. Default is `PRIORITY`, below. */
  priority?: Office[];
  /** hf7y/american-cycle#51, RULED 2026-09-02: real returns key next-cycle
   *  movement on SURPRISE -- how far a result beat what the state's own
   *  standing lean already predicted -- not on the race's raw margin. A safe
   *  state posts the same blowout every cycle because it is safe, not because
   *  anything moved, and keying on raw margin charges it the top push
   *  forever, which is the most likely cause of the pinning-at-the-cap
   *  `as-written-plus.json` already notes. `'surprise'` isolates the part of
   *  the margin that is NEW information; omitted/`'margin'` keeps the shipped
   *  behaviour.
   *
   *  Not the default yet. A fixed, unvarying margin every cycle -- exactly
   *  what `lean.test.ts`'s "sustained blowouts must produce a durable lean"
   *  fixture holds constant to isolate the decay/push arithmetic -- reads as
   *  zero surprise after the first cycle under this key, so that invariant
   *  and this ruling assert opposite things about the identical fixture.
   *  Real play never holds marginPips exactly constant (dice vary every
   *  cycle), so the conflict is in the test's abstraction, not necessarily in
   *  play -- but resolving which invariant wins is the call #51 is still
   *  waiting on, not something to pick silently by flipping the default. */
  pushKeyedOn?: 'margin' | 'surprise';
}

export function sign(p: Party): number { return p === 'R' ? 1 : p === 'D' ? -1 : 0; }

export function pushForMargin(cfg: LeanConfig, marginPips: number): number {
  for (const row of cfg.pushByMargin) if (marginPips <= row.maxPips) return row.push;
  return cfg.pushByMargin[cfg.pushByMargin.length - 1].push;
}

/** The most nationalized race on the ballot pushes. Governors never reach
 *  the top of this ordering in an election year, which is why they never push
 *  -- the exclusion falls out of the priority rule rather than being asserted. */
const PRIORITY: Office[] = ['president', 'senator', 'representative', 'governor'];

export function nationalizedRace<T extends { office: Office }>(races: T[], order: Office[] = PRIORITY): T | undefined {
  for (const office of order) {
    const hit = races.filter((r) => r.office === office);
    if (hit.length) return hit[0];
  }
  return undefined;
}

export function applyPush(
  lean: Lean, cfg: LeanConfig, state: string, winner: Party, office: Office, marginPips: number,
): number {
  const cur = lean[state] ?? 0;
  if (office === 'governor') {
    if (cfg.governorPushes === 'never') return 0;
    // 'with-lean': a governor pushes only when winning WITH the existing lean,
    // never against it ("the alternative under test" -- see lean.test.ts).
    if (cur === 0 || Math.sign(cur) !== sign(winner)) return 0;
  }
  // `elections.ts` already bakes `cur`'s own magnitude into the favoured
  // side's modifier total (the "state lean" modifier), so subtracting the
  // signed contribution back out isolates the part of marginPips that is new
  // information -- see `pushKeyedOn` above. Floored at zero: a result BELOW
  // what the lean predicted is itself informative (#51 measured real returns
  // reverting there), but there is no calibrated pip magnitude for that yet
  // -- hf7y/american-cycle#11 declined to fix a pips<->real-points mapping --
  // so it reads as "no new information" rather than pushing on a guess.
  const keyed = cfg.pushKeyedOn === 'surprise' ? Math.max(0, marginPips - sign(winner) * cur) : marginPips;
  const push = pushForMargin(cfg, keyed) * sign(winner);
  lean[state] = clampLean(cur + push, cfg.maxLean);
  return lean[state] - cur;
}

/** A FLAT move, unscaled by any margin — v0.2 items 7 and 8.
 *
 *  `applyPush` prices an election result and therefore scales with how
 *  decisively it was won. A backfire is not an election result: the historical
 *  warrant for the impeachment penalty is chronological rather than
 *  correlational (the 1998 midterm preceded the Senate vote by three months),
 *  so there is no margin to be proportional to and inventing one would be
 *  fitting a curve to n=4. Flat is the version the evidence supports.
 *  Scaling by strain between the impeaching coalition and the country is the
 *  right refinement and is v0.3: it needs bill positions to have a magnitude,
 *  which nothing records. */
export function nudge(lean: Lean, cfg: LeanConfig, state: string, party: Party, pips: number): number {
  if (!pips) return 0;
  const before = lean[state] ?? 0;
  lean[state] = clampLean(before + pips * sign(party), cfg.maxLean);
  return lean[state] - before;
}

/** Decay removes one counter from every state, toward zero. It happens at
 *  the top of the year, so the board players see when they declare is already
 *  decayed -- and pushes land later, on election night. */
export function decay(lean: Lean, cfg: LeanConfig, year: number, rng?: { bool(): boolean }): void {
  if (cfg.decayFrequency === 'biennial' && year % 2 !== 0) return;
  if (cfg.decayFrequency === 'annual-stochastic' && rng && !rng.bool()) return;
  for (const st of Object.keys(lean)) {
    const v = lean[st];
    if (v === 0) continue;
    lean[st] = v > 0 ? Math.max(0, v - cfg.decayPerTick) : Math.min(0, v + cfg.decayPerTick);
  }
}

/** The honeymoon: a newly elected president places one counter in every state
 *  carried. Removed at the next decay, so the incoming party enters the midterm
 *  with a fleeting map advantage immediately before the -2 lands on them. */
export function honeymoon(lean: Lean, cfg: LeanConfig, carried: string[], party: Party): void {
  for (const st of carried) lean[st] = clampLean((lean[st] ?? 0) + cfg.honeymoonCounter * sign(party), cfg.maxLean);
}

function clampLean(v: number, max: number): number { return Math.max(-max, Math.min(max, v)); }
