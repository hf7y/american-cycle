/** THE COMPASS — the one file to change when the game grows more axes.
 *
 *  Skowronek's two axes (affiliated/opposed, resilient/vulnerable) are both
 *  DISTANCES. A distance needs a space, and the space is what this file
 *  defines. Everything downstream — strain, affiliation, efficacy, all four
 *  quadrant detectors — is written against `Compass` and the vector helpers
 *  below, and never against `lean` directly. Swapping n=1 partisan lean for a
 *  2- or 3-axis compass is a change to `LEAN_COMPASS` and nothing else.
 *
 *  A position is `number[]`, length `dim`. Not a scalar, even at n=1, so that
 *  no caller can quietly do arithmetic that stops working at n=2.
 *
 *  THE ABSENCE IS TYPED. `bill()` returns `Position | undefined`, and today it
 *  returns undefined for every bill on every config. That is not a stub: it is
 *  the finding. See `BILL_POSITION_ABSENT` for why, and `Precondition` in
 *  checks.ts for what it costs. Encoding it in the return type is what stops a
 *  detector from silently scoring 0 when it should be scoring "not asked".
 */
import type { Party, Seat } from '../engine/types/index.ts';
import type { Lean } from '../engine/rules/lean.ts';
import { BY_CODE, seatsIn } from '../engine/states.ts';

/** A point in compass space. Length is always `Compass.dim`. */
export type Position = number[];

/** Everything a compass may read to place something. */
export interface Board { lean: Lean; year: number }

/** A bill as the engine actually records it: one signed magnitude and the
 *  coalition that carried it. Deliberately the WHOLE record — if a compass
 *  cannot place a bill from this, nothing in the engine can. */
export interface BillRecord {
  year: number;
  g: number;
  author?: number;
  authorParty?: Party;
  yesByParty: Record<Party, number>;
}

export interface Compass {
  readonly name: string;
  readonly dim: number;
  readonly axes: string[];
  /** undefined ⇒ this artefact carries no position in this compass. */
  bill(b: BillRecord): Position | undefined;
  politician(seat: Seat, board: Board): Position | undefined;
  district(state: string, board: Board): Position | undefined;
  /** seat-weighted centroid of the districts, i.e. the polity being governed */
  country(board: Board): Position | undefined;
}

// ------------------------------------------------------------------ vectors

export const zero = (n: number): Position => new Array(n).fill(0);
export const sub = (a: Position, b: Position): Position => a.map((v, i) => v - b[i]);
export const norm = (a: Position): number => Math.sqrt(a.reduce((s, v) => s + v * v, 0));
export const dist = (a: Position, b: Position): number => norm(sub(a, b));
export const scale = (a: Position, k: number): Position => a.map((v) => v * k);

/** Weighted centroid. Returns undefined on an empty or zero-weight set, which
 *  is a different thing from the origin and must not collapse to it. */
export function centroid(points: Position[], weights?: number[]): Position | undefined {
  if (!points.length) return undefined;
  const w = weights ?? points.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return undefined;
  const out = zero(points[0].length);
  points.forEach((p, i) => p.forEach((v, d) => { out[d] += v * w[i]; }));
  return out.map((v) => v / total);
}

// ------------------------------------------------------- the n=1 lean compass

export const sign = (p: Party): number => (p === 'R' ? 1 : p === 'D' ? -1 : 0);

/** Why `bill()` is undefined on this engine, recorded once so every report can
 *  quote the same reason rather than paraphrasing it four times.
 *
 *  A bill is `{ g: number }` — engine/rules/legislature.ts, `BillOutcome`. `g`
 *  is a SPENDING magnitude (config `economy.gMin..gMax`, −3..6 on
 *  as-written-plus), consumed only by `economy.spend`. engine/rules/economy.ts
 *  states the design intent outright: "There is deliberately no second
 *  ideological axis." So `g` is not commensurable with the partisan axis this
 *  compass measures — it is not a position in this space, or in any other the
 *  engine defines. */
export const BILL_POSITION_ABSENT =
  'a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any '
  + 'axis the engine defines; engine/rules/economy.ts: "There is deliberately no second '
  + 'ideological axis."';

/** Why there is no corpus to take a centroid OF, independent of position. */
export const BILL_CORPUS_ABSENT =
  'passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, '
  + 'no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a '
  + 'single scalar the Fed decays.';

/** Partisan lean, n=1, R positive, in lean-counter units.
 *
 *  DISTRICT — `lean[state]`. §10: the board tracks DEVIATION from the state's
 *  own baseline, exactly as Cook PVI does, so 0 is that state's normal and not
 *  "purple". Districts proper carry no position: `DistrictCard` is
 *  {id, state, number, era, demographics, synergy} with no partisan field, so
 *  state is the finest granularity the engine actually has.
 *
 *  COUNTRY — districts weighted by `seatsIn(state, year)`, the apportionment in
 *  force that year. Because lean is a deviation, a country position near 0 is
 *  the polity sitting at its own baseline.
 *
 *  POLITICIAN — party sign. A CandidateCard carries no ideology score; the one
 *  ideological marker it has is the `extremist` effect (§9's primary bonus and
 *  general penalty), so an extremist is placed at twice the distance from
 *  centre as a regular. Units are NOT lean counters, which is why every
 *  affiliation figure downstream is normalized before it is compared. */
export const LEAN_COMPASS: Compass = {
  name: 'partisan-lean',
  dim: 1,
  axes: ['partisan (R+)'],

  bill: () => undefined,

  politician(seat, _board) {
    if (!seat.holder) return undefined;
    return [sign(seat.holder.party)];
  },

  district(state, board) {
    return [board.lean[state] ?? 0];
  },

  country(board) {
    const states = Object.keys(board.lean);
    if (!states.length) return undefined;
    const pts: Position[] = [], w: number[] = [];
    for (const st of states) {
      const def = BY_CODE[st];
      if (!def) continue;
      pts.push([board.lean[st] ?? 0]);
      w.push(seatsIn(def, board.year));
    }
    return centroid(pts, w);
  },
};

/** The compass in force. One assignment; change it and the whole suite moves. */
export const COMPASS: Compass = LEAN_COMPASS;
