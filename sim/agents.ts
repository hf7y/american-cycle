/** Scripted agents. The first three measure skill signal; the rest are the
 *  strategies SIM-BRIEF §2 asks to be tested for dominance. Each also doubles
 *  as an opponent personality in the app. */
import type { Agent, GameView, OpenRace, PendingPeg, Config } from '../engine/game.ts';
import type { Declaration, WithdrawalView } from '../engine/rules/elections.ts';
import { buildModifiers, eligible } from '../engine/rules/elections.ts';
import type { CandidateCard, Office, Seat } from '../engine/types/index.ts';
import { RNG } from '../engine/rules/rng.ts';

export interface AgentCtx { cfg: Config; rng: RNG }

interface Option { d: Declaration; edge: number; office: Office }

/** Every legal declaration this player could make, with its modifier edge.
 *  Agents differ only in how they score and cap this list. */
export function options(v: GameView, open: OpenRace[], cfg: Config): Option[] {
  const me = v.players[v.me];
  const cands = me.hand.filter((c) => c.kind === 'candidate') as (CandidateCard & { kind: 'candidate' })[];
  const out: Option[] = [];
  for (const r of open) {
    for (const card of cands) {
      if (r.office !== 'president' && !eligible(card, r.state, me.districts)) continue;
      const district = me.districts.find((d) => d.state === r.state);
      const d: Declaration = { player: v.me, card, district, office: r.office, state: r.state, slot: r.slot,
        incumbent: r.incumbent?.holder?.cardId === card.id };
      const ctx = {
        year: v.year, office: r.office, state: r.state, slot: r.slot,
        lean: v.lean[r.state] ?? 0, isMidterm: v.isMidterm, isPresidentialYear: v.isPresidentialYear,
        presidentParty: v.presidentParty,
        economyMod: 0,
      };
      const mods = buildModifiers(d, ctx, 'general', cfg.resolution, cfg.national, cfg.primaryGeneral);
      out.push({ d, office: r.office, edge: mods.reduce((n, m) => n + m.pips, 0) });
    }
  }
  return out;
}

const raceKey = (r: { office: Office; state: string; slot?: number }) => `${r.office}|${r.state}|${r.slot ?? ''}`;

/** §8: denial. Contesting a race someone else has declared costs a real card
 *  against someone who may have spent nothing -- which is the asymmetry that
 *  makes district gating necessary. An agent that never does this plays
 *  solitaire. */
export function counterDeclare(
  opts: Option[], pending: PendingPeg[], me: number, appetite: number,
): Option[] {
  const contested = new Set(pending.filter((p) => p.player !== me).map(raceKey));
  return opts.map((o) => contested.has(raceKey(o.d)) ? { ...o, edge: o.edge + appetite } : o);
}

/** One card can only run once; one race is worth entering once. */
function pickDistinct(opts: Option[], limit: number): Declaration[] {
  const usedCards = new Set<string>(), usedRaces = new Set<string>();
  const out: Declaration[] = [];
  for (const o of opts) {
    const rk = `${o.d.office}|${o.d.state}|${o.d.slot ?? ''}`;
    if (usedCards.has(o.d.card.id) || usedRaces.has(rk)) continue;
    usedCards.add(o.d.card.id); usedRaces.add(rk);
    out.push(o.d);
    if (out.length >= limit) break;
  }
  return out;
}

const byEdge = (a: Option, b: Option) => b.edge - a.edge;

abstract class Base implements Agent {
  name: string; cfg: Config; rng: RNG;
  constructor(name: string, cfg: Config, rng: RNG) { this.name = name; this.cfg = cfg; this.rng = rng; }
  abstract declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[];
  /** Default: pull out only when the visible arithmetic is clearly against you.
   *  The dice are unknowable here by construction (§8). */
  withdraw(v: WithdrawalView): boolean {
    return v.contenders > 0 && v.myModifierTotal <= -4;
  }
  proposeG(_v: GameView): number { return 3; }
  voteBill(v: GameView, _g: number, seat: Seat): boolean {
    return seat.holder?.party === this.majority(v);
  }
  veto(_v: GameView, _g: number): boolean { return false; }
  protected majority(v: GameView): string | undefined {
    const t = new Map<string, number>();
    for (const s of v.seats) if (s.holder) t.set(s.holder.party, (t.get(s.holder.party) ?? 0) + 1);
    let best: string | undefined, n = 0;
    for (const [p, c] of t) if (c > n) { n = c; best = p; }
    return best;
  }
  protected budget(v: GameView): number { return v.players[v.me].hand.length; }
}

export class RandomAgent extends Base {
  declare(v: GameView, open: OpenRace[], _pending: PendingPeg[]): Declaration[] {
    const o = options(v, open, this.cfg);
    return pickDistinct(this.rng.shuffle(o), this.budget(v));
  }
  withdraw(): boolean { return false; }
  proposeG(): number { return 1 + this.rng.int(6); }
  voteBill(): boolean { return this.rng.bool(); }
}

/** SIM-BRIEF's headline number: greedy takes the highest-edge race available. */
export class GreedyAgent extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2);
    return pickDistinct(o.sort(byEdge), this.budget(v));
  }
}

/** Values a seat by what it pays over the terms it will be held, not just this
 *  cycle -- which is what "planning" means when terms are staggered. */
export class LookaheadAgent extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const term: Record<Office, number> = { president: 4, senator: 6, governor: 4, representative: 2 };
    const hand: Record<Office, number> = {
      president: this.cfg.hand.bonusPresident, senator: this.cfg.hand.bonusSenator,
      governor: this.cfg.hand.bonusGovernor, representative: this.cfg.hand.bonusRepresentative,
    };
    const scored = counterDeclare(options(v, open, this.cfg), pending, v.me, 2).map((o) => {
      const pts = o.office === 'president' ? 5 : o.office === 'senator' ? 3 : o.office === 'governor' ? 2 : 1;
      // future value = points and hand size over the term, discounted by the
      // chance of actually winning it
      const win = 0.5 + 0.045 * o.edge;
      const value = win * (pts + term[o.office] * (hand[o.office] + (o.office === 'representative' ? 0.5 : 0)));
      return { ...o, edge: value };
    });
    return pickDistinct(scored.sort(byEdge), this.budget(v));
  }
}

/** Declare everywhere cheap, contest nothing. District gating is supposed to
 *  have killed this; SIM-BRIEF asks to confirm it stays dead. */
export class WideAndEmpty extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = options(v, open, this.cfg).filter((x) => x.office === 'representative');
    void pending;   // WideAndEmpty contests nothing, by definition
    return pickDistinct(o.sort((a, b) => a.edge - b.edge), v.players[v.me].hand.length);
  }
  withdraw(v: WithdrawalView): boolean { return v.contenders > 0; }
}

export class SenateFlood extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2);
    const sen = o.filter((x) => x.office === 'senator').sort(byEdge);
    return pickDistinct([...sen, ...o.filter((x) => x.office !== 'senator').sort(byEdge)], this.budget(v));
  }
}

export class HouseFarm extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 3);
    const house = o.filter((x) => x.office === 'representative').sort(byEdge);
    return pickDistinct([...house, ...o.filter((x) => x.office !== 'representative').sort(byEdge)], this.budget(v) + 2);
  }
}

/** Draft only off-brand candidates for hostile states. */
export class HeterodoxSpecialist extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2).map((x) => {
      const het = x.d.card.effects.some((e) => e.type === 'heterodox');
      const hostile = Math.sign(v.lean[x.d.state] ?? 0) === (x.d.card.party === 'R' ? -1 : 1);
      return { ...x, edge: x.edge + (het && hostile ? 6 : het ? 2 : 0) };
    });
    return pickDistinct(o.sort(byEdge), this.budget(v));
  }
}

export class BillMaximizer extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2).map((x) => ({
      ...x, edge: x.edge + (x.office === 'representative' || x.office === 'senator' ? 4 : 0),
    }));
    return pickDistinct(o.sort(byEdge), this.budget(v));
  }
  voteBill(): boolean { return true; }         // every yes-vote scores
  proposeG(): number { return 4; }
}

export class Impeacher extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2).map((x) => ({ ...x, edge: x.edge + (x.office === 'senator' ? 6 : 0) }));
    return pickDistinct(o.sort(byEdge), this.budget(v));
  }
}

/** Spend hot, get your candidate into position, be out of the way before the
 *  reckoning (§13). */
export class EconomyChicken extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    return pickDistinct(counterDeclare(options(v, open, this.cfg), pending, v.me, 2).sort(byEdge), this.budget(v));
  }
  proposeG(v: GameView): number {
    return v.economy.accumulatedG >= 7 ? this.cfg.economy.gMin : this.cfg.economy.gMax;
  }
  voteBill(v: GameView, g: number): boolean { return g > 0 ? v.economy.accumulatedG < 8 : true; }
}

export const AGENTS: Record<string, new (cfg: Config, rng: RNG) => Agent> = {
  Random: class extends RandomAgent { constructor(c: Config, r: RNG) { super('Random', c, r); } },
  Greedy: class extends GreedyAgent { constructor(c: Config, r: RNG) { super('Greedy', c, r); } },
  Lookahead: class extends LookaheadAgent { constructor(c: Config, r: RNG) { super('Lookahead', c, r); } },
  WideAndEmpty: class extends WideAndEmpty { constructor(c: Config, r: RNG) { super('WideAndEmpty', c, r); } },
  SenateFlood: class extends SenateFlood { constructor(c: Config, r: RNG) { super('SenateFlood', c, r); } },
  HouseFarm: class extends HouseFarm { constructor(c: Config, r: RNG) { super('HouseFarm', c, r); } },
  HeterodoxSpecialist: class extends HeterodoxSpecialist { constructor(c: Config, r: RNG) { super('HeterodoxSpecialist', c, r); } },
  BillMaximizer: class extends BillMaximizer { constructor(c: Config, r: RNG) { super('BillMaximizer', c, r); } },
  Impeacher: class extends Impeacher { constructor(c: Config, r: RNG) { super('Impeacher', c, r); } },
  EconomyChicken: class extends EconomyChicken { constructor(c: Config, r: RNG) { super('EconomyChicken', c, r); } },
};
