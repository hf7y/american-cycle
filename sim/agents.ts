/** Scripted agents. The first three measure skill signal; the rest are the
 *  strategies SIM-BRIEF asks to be tested for dominance. Each also doubles
 *  as an opponent personality in the app. */
import type { Agent, GameView, OpenRace, PendingPeg, Config, VPOffer } from '../engine/game.ts';
import type { Declaration, WithdrawalView } from '../engine/rules/elections.ts';
import { buildModifiers, eligible, homeDistrict } from '../engine/rules/elections.ts';
import type { CandidateCard, IdentityTag, Office, Party, Seat } from '../engine/types/index.ts';
import { RNG } from '../engine/rules/rng.ts';
import * as tags from '../engine/rules/tags.ts';

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
      // A district is identified BY ITS NUMBER, not just its state. Matching
      // on state alone let
      // whichever card `find` reached first supply the synergy and the
      // demographics for a House race in a different district entirely.
      const district = r.office === 'representative'
        ? me.districts.find((d) => d.state === r.state && d.number === r.slot)
        : me.districts.find((d) => d.state === r.state);
      const d: Declaration = { player: v.me, card, district, office: r.office, state: r.state, slot: r.slot,
        incumbent: r.incumbent?.holder?.cardId === card.id };
      const ctx = {
        year: v.year, office: r.office, state: r.state, slot: r.slot,
        lean: v.lean[r.state] ?? 0, isMidterm: v.isMidterm, isPresidentialYear: v.isPresidentialYear,
        presidentParty: v.presidentParty,
        economyMod: 0,
      };
      let edge: number;
      if (r.office === 'president') {
        // The presidency is not run in a place, so its stack cannot be read off
        // one board square. It is fifty state races, so value it by the mean
        // edge across the states this player actually holds -- otherwise the
        // office scores 0 against a House seat's +5 and no agent ever runs.
        const states = [...new Set(me.districts.map((x) => x.state))];
        const each = states.map((st) => {
          const sctx = { ...ctx, state: st, lean: v.lean[st] ?? 0 };
          const sd = { ...d, state: st, district: homeDistrict(me.districts, st) };
          return buildModifiers(sd, sctx, 'general', cfg.resolution, cfg.national, cfg.primaryGeneral)
            .reduce((n, m) => n + m.pips, 0);
        });
        edge = each.length ? each.reduce((n, x) => n + x, 0) / each.length : 0;
      } else {
        edge = buildModifiers(d, ctx, 'general', cfg.resolution, cfg.national, cfg.primaryGeneral)
          .reduce((n, m) => n + m.pips, 0);
      }
      out.push({ d, office: r.office, edge });
    }
  }
  return out;
}

const raceKey = (r: { office: Office; state: string; slot?: number }) => `${r.office}|${r.state}|${r.slot ?? ''}`;

/** Denial: contesting a race someone else has declared costs a real card
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

/** v0.2 item 4: how close a bill must sit to the districts you represent
 *  before you carry it. Agent policy, not a rule, so it lives here and not in
 *  a config -- but it is the single number that decides whether a bloc
 *  concentrated in one tag region is cheap to legislate for, so it was chosen
 *  by measurement rather than taste.
 *
 *  Set-overlap distance, so 0.5 is "every tag in common" and 0.75 is "at
 *  least one". Passage rate over a mixed table at the 60% Senate threshold:
 *  0.50 -> 2.2%, 0.60 -> 15.7%, 0.75 -> 81.3%, 0.90 -> 91.5%. The stamped
 *  pre-tag figure is 12% (findings/bill-passage-is-the-table.ts), and passage
 *  scarcity is the table's central tension rather than a bug to tune out, so
 *  0.6 is the setting that adds a position to the vote without also deleting
 *  the 60% threshold's whole effect. */
const VOTE_AT_DISTANCE = 0.6;

const byEdge = (a: Option, b: Option) => b.edge - a.edge;

abstract class Base implements Agent {
  name: string; cfg: Config; rng: RNG;
  constructor(name: string, cfg: Config, rng: RNG) { this.name = name; this.cfg = cfg; this.rng = rng; }
  abstract declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[];
  /** Default: pull out only when the visible arithmetic is clearly against you.
   *  The dice are unknowable here by construction -- withdrawal closes before
   *  any die is rolled (see elections.ts, elections.test.ts). */
  withdraw(v: WithdrawalView): boolean {
    return v.contenders > 0 && v.myModifierTotal <= -4;
  }
  proposeG(_v: GameView): number { return 3; }
  /** v0.2 item 4: a politician votes by DISTANCE, not by label.
   *
   *  This is the whole of coalition synergy. A bloc concentrated in one tag
   *  region finds most of its members close to most of its bills and passes
   *  them cheaply and reliably; a diverse one has to buy every vote. It is
   *  also why a conservative-coalition Democrat falls out with no party-loyalty
   *  variable anywhere -- the D votes with the bill that fits their districts,
   *  and the label is not consulted.
   *
   *  Party is the FALLBACK, for the case the typed absence exists to catch:
   *  no tags on the bill or none in the district is not distance 0. */
  voteBill(v: GameView, _g: number, seat: Seat, billTags?: readonly IdentityTag[]): boolean {
    const home = tags.stateposition(v.players.flatMap((p) => p.districts), seat.state);
    const d = billTags ? tags.distance(tags.weights(billTags), home) : undefined;
    if (d === undefined) return seat.holder?.party === this.majority(v);
    return d <= VOTE_AT_DISTANCE;
  }
  /** Vetoing makes most sense when a midterm has handed the opposition the
   *  majority -- the president chooses between everyone gaining, rivals
   *  gaining more, and nobody gaining while he owns the stagnation. Every agent
   *  returned false, so the veto had never been exercised once. */
  veto(v: GameView, _g: number): boolean {
    const pres = v.seats.find((s) => s.office === 'president' && s.holder);
    if (pres?.holder?.player !== v.me) return false;
    // Refuse when the chamber that scores from this is not yours: yes-voters
    // score doubled for the majority party, so a bill under split government
    // pays your rivals more than it pays you.
    const maj = this.majority(v);
    return !!maj && maj !== pres.holder.party;
  }
  protected majority(v: GameView): string | undefined {
    const t = new Map<string, number>();
    for (const s of v.seats) if (s.holder) t.set(s.holder.party, (t.get(s.holder.party) ?? 0) + 1);
    let best: string | undefined, n = 0;
    for (const [p, c] of t) if (c > n) { n = c; best = p; }
    return best;
  }
  protected budget(v: GameView): number { return v.players[v.me].hand.length; }
  /** A VP costs nothing and adds a home-state bonus, so a ticket takes the
   *  best one offered. Whether accepting a RIVAL's card is wise is exactly
   *  what VPBackstab exists to find out. */
  pickVP(_v: GameView, offers: VPOffer[]): VPOffer | undefined {
    return offers.reduce((b, o) => (o.card.homeStateBonus > b.card.homeStateBonus ? o : b), offers[0]);
  }
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

/** Draft only off-brand candidates for hostile states.
 *
 *  Off-brandness used to be a printed `heterodox` tag. It is now DERIVED: a
 *  candidate is off-brand where their identities match the district they would
 *  run in while the state's lean points against their party -- which is what
 *  the tag was labelling, and unlike the tag it is era-dependent. The same
 *  card reads heterodox in a state that has drifted away from it and perfectly
 *  orthodox in one that has not. */
export class HeterodoxSpecialist extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2).map((x) => {
      const lean = v.lean[x.d.state] ?? 0;
      const against = Math.sign(lean) === (x.d.card.party === 'R' ? -1 : 1);
      const fit = x.d.district
        ? x.d.card.identities.filter((i) => x.d.district!.demographics.includes(i)).length
        : 0;
      const local = fit > 0 || x.d.card.homeState === x.d.state;
      return { ...x, edge: x.edge + (local && against ? 6 : local ? 2 : 0) };
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

/** Chases the PEN, which is a different game from chasing yes-votes.
 *
 *  A passed bill credits its author to the largest bloc of the majority House
 *  party (`legislature.author`), and `victory: 'bills'` counts those credits -- so a
 *  bills victory is won on House seats of one party. But `billsBy` only
 *  increments ON PASSAGE, and passage needs a House majority AND 60% of the
 *  Senate. So this wants the House to author and enough Senate to clear
 *  cloture: authorship is a House problem, cloture is a Senate one.
 *
 *  Kept separate from BillMaximizer deliberately. That agent optimises
 *  yes-votes and majority status, which is what SIM-BRIEF describes and what
 *  `bill-passage-is-the-table` measures as "a table willing to pass bills".
 *  Folding the two into one slot silently changed that finding. */
export class BillAuthor extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const maj = this.houseMajority(v);
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 3).map((x) => ({
      ...x,
      edge: x.edge
        + (x.office === 'representative' ? 6 : 0)
        // a House seat outside the majority party authors nothing
        + (maj && x.office === 'representative' && x.d.card.party === maj ? 3 : 0)
        + (x.office === 'senator' ? 3 : 0),
    }));
    return pickDistinct(o.sort(byEdge), this.budget(v) + 2);
  }
  /** The HOUSE majority, which is what authorship reads. `Base.majority`
   *  tallies every seat in every chamber, so it answers a different question. */
  private houseMajority(v: GameView): string | undefined {
    const t = new Map<string, number>();
    for (const s of v.seats) {
      if (s.office !== 'representative' || !s.holder) continue;
      t.set(s.holder.party, (t.get(s.holder.party) ?? 0) + 1);
    }
    let best: string | undefined, n = 0;
    for (const [p, c] of t) if (c > n) { n = c; best = p; }
    return best;
  }
  voteBill(): boolean { return true; }
  proposeG(): number { return 4; }
}

/** Builds a Senate bloc and moves to remove whoever holds the presidency.
 *  Impeachment prices the coup in the currency everyone is accumulating: it
 *  costs the year's scoring. Whether that is a sufficient brake is what this
 *  measures. */
export class Impeacher extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2).map((x) => ({ ...x, edge: x.edge + (x.office === 'senator' ? 6 : 0) }));
    return pickDistinct(o.sort(byEdge), this.budget(v));
  }
  moveImpeach(v: GameView): boolean {
    const pres = v.seats.find((s) => s.office === 'president' && s.holder);
    // never move against your own, and only when the arithmetic is there
    if (!pres || pres.holder!.player === v.me) return false;
    const senate = v.seats.filter((s) => s.office === 'senator' && s.holder);
    const against = senate.filter((s) => s.holder!.party !== pres.holder!.party).length;
    return senate.length > 0 && against / senate.length >= 0.5;
  }
  voteImpeach(v: GameView, seat: Seat): boolean {
    const pres = v.seats.find((s) => s.office === 'president' && s.holder);
    return !!pres && seat.holder?.party !== pres.holder!.party;
  }
}

/** SIM-BRIEF names this one explicitly: place your VP on a rival's ticket, then
 *  join a coalition to impeach him, and the presidency falls to you. The design
 *  accepted it on the theory that impeachment's party penalty is a sufficient
 *  brake; the brief asks that the theory be tested rather than trusted. */
export class VPBackstab extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2)
      .map((x) => ({ ...x, edge: x.edge + (x.office === 'senator' ? 5 : 0) }));
    return pickDistinct(o.sort(byEdge), this.budget(v));
  }
  /** Offer to anyone but yourself, and offer your best card: it is not consumed
   *  on a loss, so the only cost is the tempo. */
  offerVP(v: GameView, nominee: { player: number; party: Party }): CandidateCard | undefined {
    if (nominee.player === v.me) return undefined;
    const hand = v.players[v.me].hand.filter((c) => c.kind === 'candidate') as CandidateCard[];
    if (!hand.length) return undefined;
    return hand.reduce((best, c) => (c.homeStateBonus > best.homeStateBonus ? c : best), hand[0]);
  }
  pickVP(_v: GameView, offers: VPOffer[]): VPOffer | undefined { return offers[0]; }
  moveImpeach(v: GameView): boolean {
    const pres = v.seats.find((s) => s.office === 'president' && s.holder);
    if (!pres || pres.holder!.player === v.me) return false;
    const senate = v.seats.filter((s) => s.office === 'senator' && s.holder);
    return senate.length > 0
      && senate.filter((s) => s.holder!.player === v.me).length / senate.length >= 0.25;
  }
  voteImpeach(): boolean { return true; }
}

/** Spend hot, get your candidate into position, be out of the way before the
 *  reckoning (see engine/rules/economy.ts). */
export class EconomyChicken extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    return pickDistinct(counterDeclare(options(v, open, this.cfg), pending, v.me, 2).sort(byEdge), this.budget(v));
  }
  proposeG(v: GameView): number {
    return v.economy.accumulatedG >= 7 ? this.cfg.economy.gMin : this.cfg.economy.gMax;
  }
  voteBill(v: GameView, g: number): boolean { return g > 0 ? v.economy.accumulatedG < 8 : true; }
}

/** Zach's line, made explicit so it can be measured rather than assumed: take
 *  the governorships nobody is competing for -- KY, LA, MS, NJ and VA elect in
 *  ODD years, when no Senate class is up and no House term expires, so a
 *  declaration there is uncontested by construction -- then run those same
 *  cards for Senate, where the stepping-stone bonus (see
 *  engine/rules/elections.ts) carries a governor's incumbency upward.
 *
 *  Whether the line pays is an empirical question. Every other agent leaves it
 *  on the table: enabling odd-year races raised governorships held by 45% and
 *  moved Senate races carrying an incumbent by nothing at all. */
export class Launchpad extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const held = new Set(v.seats.filter((s) => s.office === 'governor' && s.holder?.player === v.me)
      .map((s) => s.holder!.cardId));
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2).map((x) => {
      // an odd year carries governorships alone: cheap ground
      if (x.office === 'governor') return { ...x, edge: x.edge + (v.year % 2 !== 0 ? 8 : 3) };
      // and step a sitting governor up, which is where the incumbency lands
      if (x.office === 'senator' && held.has(x.d.card.id)) return { ...x, edge: x.edge + 6 };
      return x;
    });
    return pickDistinct(o.sort(byEdge), this.budget(v));
  }
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
  VPBackstab: class extends VPBackstab { constructor(c: Config, r: RNG) { super('VPBackstab', c, r); } },
  Launchpad: class extends Launchpad { constructor(c: Config, r: RNG) { super('Launchpad', c, r); } },
  EconomyChicken: class extends EconomyChicken { constructor(c: Config, r: RNG) { super('EconomyChicken', c, r); } },
  BillAuthor: class extends BillAuthor { constructor(c: Config, r: RNG) { super('BillAuthor', c, r); } },
};
