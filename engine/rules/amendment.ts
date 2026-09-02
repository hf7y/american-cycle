/** The constitutional amendment — v0.2 item 3, the only earned ending.
 *
 *  WHY THIS AND NOT A SCORING TWEAK. The thresholds do the anti-runaway work
 *  for free. Two-thirds of the states to call a convention, three-quarters to
 *  ratify; thirteen states block. A narrow leader can never close alone and a
 *  minority always has a wall. That is structural in a way no catch-up rule
 *  is, and it is the reason the runaway diagnosis is answered here rather than
 *  by a decay on the score.
 *
 *  THE DECK IS THE GOAL DECK. An amendment carries demographic content drawn
 *  from the existing tag vocabulary, so it is a contract, a win condition and
 *  a rules change in one object. No separate Ticket-to-Ride contract deck.
 *
 *  FAILURE MUST BE POSSIBLE AND MUST REARRANGE POSITIONS. The ERA is the
 *  model — 35 of 38, and then rescissions. `rescind` is why the ratification
 *  window is a phase other players act in rather than a countdown.
 *
 *  Resolution uses machinery the engine already has: the governorship,
 *  district cards, and partisan lean on a state, against a die.
 */
import type { IdentityTag } from '../types/index.ts';
import type { RNG } from './rng.ts';

export interface AmendmentConfig {
  /** off leaves v0.1's endings in force, which is how the two are compared */
  enabled: boolean;
  /** Article V: two-thirds to call, three-quarters to ratify */
  callFraction: number;
  ratifyFraction: number;
  /** how long ratification stays open. Others act during this window — it is
   *  the last-shot phase where everyone not winning tries to find thirteen
   *  states. */
  windowYears: number;
  /** How many d6 the state check rolls.
   *
   *  ONE DIE CANNOT BE CALIBRATED. A flat d6 moves the per-state probability
   *  in sixths, and that compounds: across fifty states and a multi-year
   *  window, the ratification rate jumps 0.49 -> 0.92 between two adjacent
   *  integer targets, with nothing in between. The record puts ratification
   *  given proposal at 71% postwar (5 of 7) and 82% all-time (27 of 33), and
   *  neither is reachable on one die at any setting. Two dice give a bell
   *  rather than a step and land on it. The engine rolls 2d6 for the Fed and
   *  3d6 for a race; a flat single die was the odd one out. */
  dice: number;
  /** the state check: pips + the dice must reach `target` */
  target: number;
  /** the same check for an opponent PULLING a state back, and deliberately a
   *  harder one. Ratifying is the default motion once a convention sits;
   *  rescinding is the exceptional act, and the record says so -- five states
   *  rescinded the ERA against thirty-five that ratified. Set equal to
   *  `target` to make the two symmetric, which pins ratification below the
   *  three-quarters bar for ever. */
  rescindTarget: number;
  governorPips: number;
  districtPips: number;
  leanPips: number;
  /** how many tags an amendment carries */
  tagsPerAmendment: number;
  /** flat lean push in every state that ratified, when the window closes
   *  short. A failed amendment rearranges the map; it does not merely expire. */
  failurePush: number;
}

/** Everything the check may read about one state, so the rule is a pure
 *  function of the board and can be unit-tested without a game. */
export interface StateStanding {
  /** does the mover hold this state's governorship? */
  governor: boolean;
  /** district cards the mover holds here whose demographics touch the
   *  amendment's tags */
  matchingDistricts: number;
  /** lean counters running the mover's way in this state, unsigned */
  leanWith: number;
}

export const supportPips = (cfg: AmendmentConfig, s: StateStanding): number =>
  (s.governor ? cfg.governorPips : 0)
  + cfg.districtPips * s.matchingDistricts
  + cfg.leanPips * s.leanWith;

/** One state, one die. Governors become meaningful here, which they currently
 *  are not: they never push lean because they never top §10's priority
 *  ordering, so the convention is the first thing the office is for. */
export function stateBacks(cfg: AmendmentConfig, s: StateStanding, rng: RNG, target = cfg.target): boolean {
  let roll = 0;
  for (let i = 0; i < cfg.dice; i++) roll += rng.d6();
  return supportPips(cfg, s) + roll >= target;
}

export const needed = (fraction: number, states: number): number => Math.ceil(fraction * states);

/** Article V's blocking minority, reported because it is the anti-runaway
 *  claim: thirteen of fifty. */
export const blockers = (cfg: AmendmentConfig, states: number): number =>
  states - needed(cfg.ratifyFraction, states) + 1;

export const overlaps = (tags: readonly IdentityTag[], demographics: readonly IdentityTag[]): boolean =>
  tags.some((t) => demographics.includes(t));
