/** The omnibill — design doc §12. One bill a year, a single number G, a House
 *  majority and 60% of the Senate, a veto, and an impeachment that replaces the
 *  bill outright. Scoring is by yes-vote, doubled for the majority party, which
 *  is what makes this a cooperation game with a defection option. */
import type { Party, Seat } from '../types/index.ts';
import type { RNG } from './rng.ts';

/** Thresholds are fractions, and two-thirds of nine is not representable.
 *  Every threshold comparison goes through this so a chamber that exactly
 *  meets a bar is never rejected by floating point. */
const EPS = 1e-9;
const atLeast = (part: number, whole: number, frac: number) => whole > 0 && part / whole >= frac - EPS;
const moreThan = (part: number, whole: number, frac: number) => whole > 0 && part / whole > frac + EPS;

export interface LegislatureConfig {
  houseMajority: number;
  senatePassage: number;
  vetoOverride: number;
  impeachThreshold: number;
  scorePerYesVote: number;
  majorityMultiplier: number;
  reactionGoodOnRollAtLeast: number;
}

export interface Vote { player: number; party: Party; office: 'senator' | 'representative'; yes: boolean; }

export interface BillOutcome {
  g: number;
  passed: boolean;
  vetoed: boolean;
  overridden: boolean;
  houseYes: number; houseTotal: number;
  senateYes: number; senateTotal: number;
  reaction?: number;
  reactionGood?: boolean;
  scores: Record<number, number>;
  crossBenched: number;
}

export function chambers(seats: Seat[]) {
  const house = seats.filter((s) => s.office === 'representative' && s.holder);
  const senate = seats.filter((s) => s.office === 'senator' && s.holder);
  return { house, senate };
}

export function majorityParty(seats: Seat[], office: 'senator' | 'representative'): Party | undefined {
  const held = seats.filter((s) => s.office === office && s.holder);
  const tally = new Map<Party, number>();
  for (const s of held) tally.set(s.holder!.party, (tally.get(s.holder!.party) ?? 0) + 1);
  let best: Party | undefined, n = 0;
  for (const [p, c] of tally) if (c > n) { n = c; best = p; }
  return best;
}

/** §12: authorship goes to the player holding the largest bloc of the majority
 *  party in the House. */
export function author(seats: Seat[]): number | undefined {
  const maj = majorityParty(seats, 'representative');
  if (!maj) return undefined;
  const tally = new Map<number, number>();
  for (const s of seats) {
    if (s.office !== 'representative' || !s.holder || s.holder.party !== maj) continue;
    tally.set(s.holder.player, (tally.get(s.holder.player) ?? 0) + 1);
  }
  let best: number | undefined, n = 0;
  for (const [p, c] of tally) if (c > n) { n = c; best = p; }
  return best;
}

export function tallyBill(
  cfg: LegislatureConfig, seats: Seat[], votes: Vote[], g: number,
  president: { player: number; party: Party } | undefined,
  vetoes: boolean, overrideVotes: { house: number; senate: number } | undefined,
  rng: RNG,
): BillOutcome {
  const { house, senate } = chambers(seats);
  const houseYes = votes.filter((v) => v.office === 'representative' && v.yes).length;
  const senateYes = votes.filter((v) => v.office === 'senator' && v.yes).length;

  const carriedHouse = moreThan(houseYes, house.length, cfg.houseMajority);
  // The 60% Senate threshold is what makes cross-benching structurally
  // necessary rather than optional (§12).
  const carriedSenate = atLeast(senateYes, senate.length, cfg.senatePassage);
  let passed = carriedHouse && carriedSenate;

  let overridden = false;
  const vetoed = passed && vetoes;
  if (vetoed) {
    passed = false;
    if (overrideVotes && house.length && senate.length) {
      overridden = atLeast(overrideVotes.house, house.length, cfg.vetoOverride)
        && atLeast(overrideVotes.senate, senate.length, cfg.vetoOverride);
      if (overridden) passed = true;
    }
  }

  const scores: Record<number, number> = {};
  let reaction: number | undefined, reactionGood: boolean | undefined;
  if (passed) {
    // §7: the reaction rolls immediately on passage, long before the national die.
    reaction = rng.d6();
    reactionGood = reaction >= cfg.reactionGoodOnRollAtLeast;
    const majH = majorityParty(seats, 'representative');
    const majS = majorityParty(seats, 'senator');
    for (const v of votes) {
      if (!v.yes) continue;
      const maj = v.office === 'representative' ? majH : majS;
      const mult = v.party === maj ? cfg.majorityMultiplier : 1;
      scores[v.player] = (scores[v.player] ?? 0) + cfg.scorePerYesVote * mult;
    }
  }

  const majH = majorityParty(seats, 'representative');
  const majS = majorityParty(seats, 'senator');
  const crossBenched = votes.filter((v) => {
    const maj = v.office === 'representative' ? majH : majS;
    return v.yes && v.party !== maj;
  }).length;

  return {
    g, passed, vetoed, overridden,
    houseYes, houseTotal: house.length, senateYes, senateTotal: senate.length,
    reaction, reactionGood, scores, crossBenched,
  };
}

/** §12: impeachment replaces the omnibill for the year. Two-thirds of the
 *  Senate, and an impeached president leaves the game entirely -- the only
 *  permanent removal in the design. */
export function impeach(cfg: LegislatureConfig, seats: Seat[], yesVotes: number): boolean {
  const { senate } = chambers(seats);
  return atLeast(yesVotes, senate.length, cfg.impeachThreshold);
}
