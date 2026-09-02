/** Tag space — v0.2 items 4, 5 and 6.
 *
 *  `IdentityTag` already carried the game's only vocabulary of interest:
 *  fifteen values, on `CandidateCard.identities` and `DistrictCard.demographics`.
 *  Bills were the gap — the omnibill is a single spending magnitude G with no
 *  position at all, which is what `BILL_POSITION_ABSENT` records. Giving bills
 *  tags puts every artefact in the game into ONE space, and coalition synergy
 *  is then just distance in it: a bloc concentrated in one tag region passes
 *  bills cheaply, which is why the Conservative Coalition ran Congress from
 *  1937 to 1964 without being a party.
 *
 *  DISTANCE IS SET OVERLAP, NOT EUCLIDEAN. A position is a normalised weight
 *  vector so that a set and a centroid-of-sets are the same kind of object,
 *  and overlap is histogram intersection: for two sets of equal size k sharing
 *  j tags it returns exactly 1 - j/k. No compass, no axes, no extra token
 *  colours. `distance` is the one function to change if sets prove too coarse.
 *
 *  THE ABSENCE IS TYPED, as in skowronek/position.ts: `distance` returns
 *  undefined when either side carries no tags, because "no tags" is not
 *  "distance 0" and must never quietly read as agreement.
 */
import type { CandidateCard, IdentityTag, Party, Seat } from '../types/index.ts';

export const TAGS: readonly IdentityTag[] = [
  'catholic', 'evangelical', 'jewish', 'black', 'hispanic', 'cuban',
  'union', 'veteran', 'rural', 'suburban', 'urban', 'ivy',
  'farm', 'business', 'academic',
];
const INDEX = new Map(TAGS.map((t, i) => [t, i]));

/** A point in tag space: length `TAGS.length`, summing to 1, or all-zero for
 *  "carries no position". */
export type TagWeights = number[];

export const EMPTY: TagWeights = new Array(TAGS.length).fill(0);

export const isEmpty = (w: TagWeights): boolean => w.every((v) => v === 0);

export function weights(tags: readonly IdentityTag[]): TagWeights {
  const w = new Array(TAGS.length).fill(0);
  let n = 0;
  for (const t of tags) {
    const i = INDEX.get(t);
    if (i !== undefined) { w[i] += 1; n++; }
  }
  return n ? w.map((v) => v / n) : w;
}

/** Histogram intersection, so 0 is identical and 1 is disjoint. */
export function distance(a: TagWeights, b: TagWeights): number | undefined {
  if (isEmpty(a) || isEmpty(b)) return undefined;
  let overlap = 0;
  for (let i = 0; i < a.length; i++) overlap += Math.min(a[i], b[i]);
  return 1 - overlap;
}

/** Mean of the positions that HAVE one. An empty input is all-zero, which is
 *  "no position" and not the centre of the space. */
export function centroid(sets: readonly TagWeights[]): TagWeights {
  const live = sets.filter((s) => !isEmpty(s));
  if (!live.length) return [...EMPTY];
  const out = new Array(TAGS.length).fill(0);
  for (const s of live) for (let i = 0; i < s.length; i++) out[i] += s[i];
  return out.map((v) => v / live.length);
}

/** v0.2 item 5: a party's position is the centroid of its CURRENT
 *  officeholders' tags, and nothing else. The 1948 Democratic platform is
 *  whatever Democratic officeholders are tagged with, which included
 *  segregationists, because it did; in 1972 it is something else, because the
 *  officeholders changed. Era specificity for free, and nowhere does the code
 *  write down that Democrats are left.
 *
 *  This is also what makes a conservative-coalition Democrat fall out
 *  natively — a D whose tags fit a conservative district — with no seniority
 *  mechanic and no party-loyalty variable. */
export function partyPosition(
  seats: readonly Seat[], cardById: ReadonlyMap<string, CandidateCard>, party: Party,
): TagWeights {
  const sets: TagWeights[] = [];
  for (const s of seats) {
    if (s.holder?.party !== party) continue;
    const c = cardById.get(s.holder.cardId);
    if (c) sets.push(weights(c.identities));
  }
  return centroid(sets);
}

/** The tags actually on the board in one state: the demographics of every
 *  district card in play there. This is the finest granularity the engine has
 *  — `DistrictCard` carries demographics, states do not. */
export function stateposition(districts: readonly { state: string; demographics: IdentityTag[] }[], state: string): TagWeights {
  return centroid(districts.filter((d) => d.state === state).map((d) => weights(d.demographics)));
}
