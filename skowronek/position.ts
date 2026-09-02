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
 *  THE ABSENCE IS TYPED. `bill()` returns `Position | undefined`, and under
 *  `LEAN_COMPASS` it returns undefined for every bill on every config.
 *  Encoding it in the return type is what stops a detector from silently
 *  scoring 0 when it should be scoring "not asked".
 *
 *  v0.2 RESOLVED BOTH ABSENCES, and the way it did is why the typed return
 *  was worth having. `BILL_POSITION_ABSENT` and `BILL_CORPUS_ABSENT` are now
 *  historical: bills carry `IdentityTag[]` (v0.2 item 4) and go on the books
 *  with a repeal that takes them off again (item 2). `TAG_COMPASS` below is
 *  the compass that can read them, and swapping it in is one assignment --
 *  which is the claim this file was written to make good on.
 */
import type { CandidateCard, DistrictCard, IdentityTag, Party, Seat } from '../engine/types/index.ts';
import * as tagspace from '../engine/rules/tags.ts';
import type { Lean } from '../engine/rules/lean.ts';
import { BY_CODE, seatsIn } from '../engine/states.ts';

/** A point in compass space. Length is always `Compass.dim`. */
export type Position = number[];

/** Everything a compass may read to place something.
 *
 *  `cards` and `districts` are optional because LEAN_COMPASS does not need
 *  them. A compass that does returns undefined without them, which keeps the
 *  typed absence honest: a caller that forgot to supply them gets "not asked",
 *  never a fabricated 0. */
export interface Board {
  lean: Lean;
  year: number;
  cards?: ReadonlyMap<string, CandidateCard>;
  districts?: readonly DistrictCard[];
}

/** A bill as the engine actually records it: one signed magnitude and the
 *  coalition that carried it. Deliberately the WHOLE record — if a compass
 *  cannot place a bill from this, nothing in the engine can. */
export interface BillRecord {
  year: number;
  g: number;
  /** v0.2 item 4. Optional because a v0.1 record has none, which is exactly
   *  the case `TAG_COMPASS.bill` must return undefined for. */
  tags?: IdentityTag[];
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

/** Why `bill()` is undefined under LEAN_COMPASS, recorded once so every report
 *  can quote the same reason rather than paraphrasing it four times.
 *
 *  STILL TRUE OF THIS COMPASS, NO LONGER TRUE OF THE ENGINE. `g` remains a
 *  spending magnitude and remains incommensurable with the partisan axis; what
 *  changed at v0.2 is that a bill now ALSO carries `IdentityTag[]`, which is a
 *  position in a different space. `TAG_COMPASS` reads it. The two are separate
 *  compasses on purpose — projecting tags onto a partisan axis would be
 *  inventing a number, which is the thing this file exists to refuse. */
export const BILL_POSITION_ABSENT =
  'under the partisan-lean compass a bill is a single spending magnitude g '
  + '(economy.gMin..gMax), not a point on that axis; engine/rules/economy.ts: "There is '
  + 'deliberately no second ideological axis." v0.2 gave bills IdentityTag[] as well, '
  + 'which TAG_COMPASS reads — so this is a fact about LEAN_COMPASS, not about the engine.';

/** RESOLVED AT v0.2 (item 2). Kept because the reports quote it and because
 *  what it says about v0.1.2 is still what was true of v0.1.2. */
export const BILL_CORPUS_ABSENT =
  'RESOLVED at v0.2: Game.bills is the corpus and EnactedBill.repealedIn takes a bill off '
  + 'the books. Before that, passed bills were counted (GameResult.billsPassed) and discarded — '
  + 'no enacted-bill list, no repeal, no books — and the only trace legislation left was '
  + 'economy.accumulatedG, a single scalar the Fed decays.';

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

// ------------------------------------------------------------- the tag compass

/** v0.2's compass: the fifteen `IdentityTag`s, one axis each.
 *
 *  This is the one the settlement measurements were waiting on. Under
 *  LEAN_COMPASS `bill()` is undefined on every config, so every
 *  settlement-based detector scores "not asked" by construction; here a bill
 *  has a position, the corpus of bills still on the books has a centroid, and
 *  a settlement is something that can be dismantled — which is what makes
 *  disjunction reachable at all.
 *
 *  DISTANCE. The vector helpers above are Euclidean, and on normalised weight
 *  vectors that is a monotone transform of set overlap rather than the same
 *  number. `engine/rules/tags.ts` is where set overlap lives, and it is the
 *  function the ENGINE prices votes with; this compass exists so the same
 *  objects can be fed to detectors written against `Position`. Keep both, and
 *  change tags.ts if sets prove too coarse. */
export const TAG_COMPASS: Compass = {
  name: 'identity-tags',
  dim: tagspace.TAGS.length,
  axes: [...tagspace.TAGS],

  bill(b) {
    const w = tagspace.weights(b.tags ?? []);
    return tagspace.isEmpty(w) ? undefined : w;
  },

  politician(seat, board) {
    if (!seat.holder || !board.cards) return undefined;
    const c = board.cards.get(seat.holder.cardId);
    if (!c) return undefined;
    const w = tagspace.weights(c.identities);
    return tagspace.isEmpty(w) ? undefined : w;
  },

  district(state, board) {
    if (!board.districts) return undefined;
    const w = tagspace.stateposition(board.districts, state);
    return tagspace.isEmpty(w) ? undefined : w;
  },

  country(board) {
    if (!board.districts) return undefined;
    const states = [...new Set(board.districts.map((d) => d.state))];
    const pts: Position[] = [], w: number[] = [];
    for (const st of states) {
      const def = BY_CODE[st];
      const p = this.district(st, board);
      if (!def || !p) continue;
      pts.push(p);
      w.push(seatsIn(def, board.year));
    }
    return centroid(pts, w);
  },
};

/** The compass in force. One assignment; change it and the whole suite moves. */
export const COMPASS: Compass = LEAN_COMPASS;
