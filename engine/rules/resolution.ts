/** Election resolution — design doc §9, with the three labeled dice of §4.
 *
 *  HOW THE DICE ARE WIRED, and why. §3 fixes the spread: "the difference
 *  between two 3d6 rolls has a standard deviation of 4.18 pips", and Zach
 *  confirmed the dice are correct. That only holds if each SIDE rolls its own
 *  three dice — six in a race. §4's "same value for every race in the cycle"
 *  is therefore per PARTY, not per race: a party rolls one national die for
 *  the cycle and reuses it across all its races, and one state die per state.
 *  Within a race the two sides hold different values so nothing cancels;
 *  across races a party's results are correlated, which is exactly what a wave
 *  is. Rolling one shared national die per race would cancel it out entirely
 *  and collapse the spread to 2.42 pips, breaking the odds table.
 */
import type { DiceRoll, Modifier, Party, RaceEvent, Round, Office } from '../types/index.ts';
import type { RNG } from './rng.ts';

export interface Side {
  player: number;
  cardId: string;
  party: Party;
  modifiers: Modifier[];
}

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
  roll(p: Party, st: string, rng: RNG): DiceRoll {
    const n = this.nationalDie(p), st2 = this.stateDie(p, st);
    this.rolls++;
    return { national: n, state: st2, candidate: rng.d6() };
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
    const dice = a.wave.roll(s.party, a.state, a.rng);
    const mt = modifierTotal(s);
    return {
      player: s.player, cardId: s.cardId, party: s.party, dice,
      modifiers: s.modifiers, modifierTotal: mt,
      total: dice.national + dice.state + dice.candidate + mt,
    };
  });

  const uncontested = scored.length === 1;
  // §8: a player who fields nobody loses; uncontested is an auto-win.
  const ranked = [...scored].sort((x, y) => y.total - x.total);
  let winner = ranked[0].player;
  // Ties: the doc says only "higher total wins". Placeholder = even break,
  // which is what makes edge 0 exactly 50%. Flagged in DECISIONS.md as open.
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

/** Exact win probability at a given pip edge, 3d6 vs 3d6, ties broken evenly.
 *  This is the table in §3 and the foundation test asserts against it. */
export function oddsAtEdge(edge: number): number {
  const d3: number[] = new Array(19).fill(0);
  for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) for (let k = 1; k <= 6; k++) d3[i + j + k]++;
  let win = 0, tie = 0;
  for (let a = 3; a <= 18; a++) {
    for (let b = 3; b <= 18; b++) {
      const w = d3[a] * d3[b];
      if (a + edge > b) win += w; else if (a + edge === b) tie += w;
    }
  }
  return (win + tie / 2) / (216 * 216);
}
