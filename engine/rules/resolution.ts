/** Election resolution, with three labeled dice: national, state, candidate.
 *
 *  HOW THE DICE ARE WIRED, and why. The spread is fixed: the difference
 *  between two 3d6 rolls has a standard deviation of 4.18 pips, and Zach
 *  confirmed the dice are correct (resolution.test.ts guards this as the
 *  foundation the rest of the game sits on). That only holds if each SIDE
 *  rolls its own three dice — six in a race. "Same value for every race in
 *  the cycle" is therefore per PARTY, not per race: a party rolls one
 *  national die for the cycle and reuses it across all its races, and one
 *  state die per state. Within a race the two sides hold different values so
 *  nothing cancels; across races a party's results are correlated, which is
 *  exactly what a wave is. Rolling one shared national die per race would
 *  cancel it out entirely and collapse the spread to 2.42 pips, breaking the
 *  odds table.
 */
import type { DiceRoll, Modifier, Party, RaceEvent, Round, Office } from '../types/index.ts';
import type { RNG } from './rng.ts';

export interface Side {
  player: number;
  cardId: string;
  party: Party;
  modifiers: Modifier[];
}

/** A primary shares its national and state die between both sides (same
 *  party, same state), so they cancel and only the candidate die decides it.
 *  A flat 1d6 candidate die made every gap of 6+ pips mathematically
 *  unbeatable (hf7y/american-cycle#94) -- 354 of 354 measured favourites at
 *  that gap won. 2d6 widens the swing from 5 to 10 so no modifier gap is
 *  certain, mirroring the precedent in `amendment.ts`'s state check. */
export const PRIMARY_CANDIDATE_DICE = 2;
export const GENERAL_CANDIDATE_DICE = 1;

/** A cycle's dice, drawn once and reused so waves correlate across races. */
export class Wave {
  private national = new Map<Party, number>();
  private state = new Map<string, number>();
  private rng: RNG;
  /** Counts dice actually drawn. The withdrawal-window test asserts this is
   *  still zero when the window closes -- BUILD-BRIEF calls that the single
   *  most important rule in the game and the easiest to implement wrong. */
  rolls = 0;
  constructor(rng: RNG) { this.rng = rng; }
  nationalDie(p: Party): number {
    if (!this.national.has(p)) { this.national.set(p, this.rng.d6()); this.rolls++; }
    return this.national.get(p)!;
  }
  stateDie(p: Party, st: string): number {
    const k = `${p}:${st}`;
    if (!this.state.has(k)) { this.state.set(k, this.rng.d6()); this.rolls++; }
    return this.state.get(k)!;
  }
  roll(p: Party, st: string, rng: RNG, round: Round): DiceRoll {
    const n = this.nationalDie(p), st2 = this.stateDie(p, st);
    const n6 = round === 'primary' ? PRIMARY_CANDIDATE_DICE : GENERAL_CANDIDATE_DICE;
    let candidate = 0;
    for (let i = 0; i < n6; i++) candidate += rng.d6();
    this.rolls += n6;
    return { national: n, state: st2, candidate };
  }
}

export function modifierTotal(s: Side): number {
  return s.modifiers.reduce((n, m) => n + m.pips, 0);
}

export interface ResolveArgs {
  year: number; round: Round; office: Office; state: string; slot?: number;
  sides: Side[]; wave: Wave; rng: RNG;
}

export function resolveRace(a: ResolveArgs): RaceEvent {
  const scored = a.sides.map((s) => {
    const dice = a.wave.roll(s.party, a.state, a.rng, a.round);
    const mt = modifierTotal(s);
    return {
      player: s.player, cardId: s.cardId, party: s.party, dice,
      modifiers: s.modifiers, modifierTotal: mt,
      total: dice.national + dice.state + dice.candidate + mt,
    };
  });

  const uncontested = scored.length === 1;
  // A player who fields nobody loses; uncontested is an auto-win.
  const ranked = [...scored].sort((x, y) => y.total - x.total);
  let winner = ranked[0].player;
  // Ties break evenly, a coin flip -- the rule that makes edge 0 exactly
  // 50%. hf7y/american-cycle#153: this was also a config field nobody read;
  // the field is gone, the rule stays, stated here instead.
  if (ranked.length > 1 && ranked[0].total === ranked[1].total) {
    winner = a.rng.bool() ? ranked[0].player : ranked[1].player;
  }
  const margin = ranked.length > 1 ? ranked[0].total - ranked[1].total : 0;

  const byMods = [...scored].sort((x, y) => y.modifierTotal - x.modifierTotal);
  const zeroDiceWinner = byMods[0].player;

  return {
    year: a.year, round: a.round, office: a.office, state: a.state, slot: a.slot,
    sides: scored, winner, margin,
    zeroDiceWinner,
    upset: !uncontested && winner !== zeroDiceWinner,
    uncontested,
  };
}

/** Distribution of the sum of `n` d6, index = sum, value = ways to roll it. */
function diceSumCounts(n: number): number[] {
  let dist = [1];
  for (let d = 0; d < n; d++) {
    const next: number[] = new Array(dist.length + 6).fill(0);
    for (let s = 0; s < dist.length; s++) for (let f = 1; f <= 6; f++) next[s + f] += dist[s];
    dist = next;
  }
  return dist;
}

/** Exact win probability at a given pip edge for an n-dice-a-side contest,
 *  ties broken evenly. */
function oddsAtEdgeForDice(edge: number, dice: number): number {
  const d = diceSumCounts(dice);
  const total = 6 ** dice;
  let win = 0, tie = 0;
  for (let a = 0; a < d.length; a++) {
    for (let b = 0; b < d.length; b++) {
      const w = d[a] * d[b];
      if (a + edge > b) win += w; else if (a + edge === b) tie += w;
    }
  }
  return (win + tie / 2) / (total * total);
}

/** Exact win probability at a given pip edge, 3d6 vs 3d6 (a general), ties
 *  broken evenly. resolution.test.ts asserts against this table as the
 *  foundation the rest of the game sits on. */
export function oddsAtEdge(edge: number): number {
  return oddsAtEdgeForDice(edge, GENERAL_CANDIDATE_DICE + 2);
}

/** Exact win probability at a given pip edge in a primary. National and
 *  state dice are shared between both sides (same party, same state) and
 *  cancel, so this is the candidate dice alone -- see
 *  hf7y/american-cycle#94. */
export function primaryOddsAtEdge(edge: number): number {
  return oddsAtEdgeForDice(edge, PRIMARY_CANDIDATE_DICE);
}
