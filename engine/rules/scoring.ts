/** Board scoring — v0.2 item 1, and the change everything else depends on.
 *
 *  THERE IS NO ACCUMULATOR. Score is a function of the board as it stands, so
 *  it can go down without any decay rule anywhere: there is nothing to decay
 *  because there is nothing accumulated. That dissolves the monotone-score
 *  problem at the root — 100% of player-score series never fell at v0.1.2,
 *  which is what made the second half of every game an arithmetically
 *  irreversible lead running out the clock.
 *
 *  It also makes "I passed forty bills and they were all repealed" read
 *  correctly, as a wasted career.
 *
 *  Consequence worth stating: seats need no separate scoring guard. Under
 *  board scoring a player who wins by holding everything has won
 *  legitimately — seats are means, and they are counted because they are
 *  still held, not because they were once won.
 */
import type { Amendment, Card, DistrictCard, EnactedBill, IdentityTag, Office, Party, Seat } from '../types/index.ts';
import type { Lean } from './lean.ts';

export interface ScoringConfig {
  /** bills you authored that are still on the books */
  billOnBooks: number;
  /** per lean counter, in states you hold the leading bloc of the leaning party */
  leanCounter: number;
  /** politicians still in office */
  office: Record<Office, number>;
  /** per district or politician you hold matching a ratified amendment's tags */
  amendmentMatch: number;
  /** districts played, and candidates held in hand */
  districtPlayed: number;
  cardInHand: number;
}

export interface BoardView {
  seats: readonly Seat[];
  lean: Lean;
  bills: readonly EnactedBill[];
  amendments: readonly Amendment[];
  players: readonly { id: number; hand: readonly Card[]; districts: readonly DistrictCard[] }[];
  identitiesOf: (cardId: string) => IdentityTag[] | undefined;
}

/** Which player, if any, owns a state's lean. The board is a map of factions,
 *  not of parties, so a leaning state credits whoever holds the largest bloc
 *  of the party it leans toward. A tie credits nobody: two factions splitting
 *  a state have not settled it. */
function leanOwner(b: BoardView, state: string, party: Party): number | undefined {
  const tally = new Map<number, number>();
  for (const s of b.seats) {
    if (s.state !== state || s.holder?.party !== party) continue;
    tally.set(s.holder.player, (tally.get(s.holder.player) ?? 0) + 1);
  }
  let best: number | undefined, n = 0, tied = false;
  for (const [p, c] of tally) {
    if (c > n) { n = c; best = p; tied = false; } else if (c === n) tied = true;
  }
  return tied ? undefined : best;
}

export function boardScores(cfg: ScoringConfig, b: BoardView): number[] {
  const out = b.players.map(() => 0);

  // Anything repealed, reversed or unseated scores zero — which is the rule,
  // not an exception to it.
  for (const bill of b.bills) {
    if (bill.repealedIn === undefined && out[bill.author] !== undefined) out[bill.author] += cfg.billOnBooks;
  }

  for (const s of b.seats) {
    if (!s.holder) continue;
    out[s.holder.player] += cfg.office[s.office] ?? 0;
  }

  for (const [state, v] of Object.entries(b.lean)) {
    if (!v) continue;
    const owner = leanOwner(b, state, v > 0 ? 'R' : 'D');
    if (owner !== undefined) out[owner] += cfg.leanCounter * Math.abs(v);
  }

  // v0.2 item 3: shared victory with degrees. The proposer gets no premium
  // over the ratifiers; everyone scores what the new constitution is worth to
  // the board they actually hold.
  for (const a of b.amendments) {
    if (a.ratifiedIn === undefined) continue;
    const want = new Set(a.tags);
    for (const s of b.seats) {
      if (!s.holder) continue;
      const ids = b.identitiesOf(s.holder.cardId);
      if (ids?.some((t) => want.has(t))) out[s.holder.player] += cfg.amendmentMatch;
    }
    for (const p of b.players) {
      for (const d of p.districts) if (d.demographics.some((t) => want.has(t))) out[p.id] += cfg.amendmentMatch;
    }
  }

  for (const p of b.players) {
    out[p.id] += cfg.districtPlayed * p.districts.length;
    out[p.id] += cfg.cardInHand * p.hand.filter((c) => c.kind === 'candidate').length;
  }

  return out;
}
