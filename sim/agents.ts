/** Scripted agents. The first three measure skill signal; the rest are the
 *  strategies SIM-BRIEF asks to be tested for dominance. Each also doubles
 *  as an opponent personality in the app. */
import type { Agent, GameView, OpenRace, PendingPeg, Config, VPOffer, VPGrant } from '../engine/game.ts';
import type { Declaration, WithdrawalView } from '../engine/rules/elections.ts';
import { buildModifiers, eligible, homeDistrict } from '../engine/rules/elections.ts';
import type { CandidateCard, EnactedBill, IdentityTag, Office, Party, Seat } from '../engine/types/index.ts';
import type { Vote } from '../engine/rules/legislature.ts';
import { RNG } from '../engine/rules/rng.ts';
import * as tags from '../engine/rules/tags.ts';
import { economyModifier } from '../engine/rules/economy.ts';

export interface AgentCtx { cfg: Config; rng: RNG }

interface Option { d: Declaration; edge: number; office: Office }

/** hf7y/american-cycle#15: what party a card could run under, once
 *  `game.partyChoice` opens the question at all. Unset/'printed' returns the
 *  card unchanged -- one variant, no bonus, byte-identical to the mechanism
 *  before this issue. The two open arms return BOTH labels as competing
 *  options rather than picking one here: `options` scores each independently
 *  and `pickDistinct` (below) keeps only the higher-edge one per physical
 *  card, so no agent needs to know party choice exists -- the same
 *  highest-edge-wins policy every agent already runs makes the pick. `'I'`
 *  cards (the sore-loser conversion `game.ts`'s `runPrimaries` already does)
 *  are left alone; free choice is a D/R question. */
function partyVariants(card: CandidateCard, cfg: Config): { card: CandidateCard; bonus: number }[] {
  const mode = cfg.game.partyChoice;
  if (!mode || mode === 'printed' || card.party === 'I') return [{ card, bonus: 0 }];
  const flipped: CandidateCard = { ...card, party: card.party === 'R' ? 'D' : 'R' };
  const printedBonus = mode === 'printedAffinity' ? (cfg.primaryGeneral.printedPartyPips ?? 0) : 0;
  return [{ card, bonus: printedBonus }, { card: flipped, bonus: 0 }];
}

/** hf7y/american-cycle#158: declaration is now round-by-round (`declareRounds`
 *  in engine/game.ts), so every active agent calls `declare` -- and therefore
 *  `options` -- once per ROUND rather than once per cycle. `options`'s result
 *  depends only on a player's own hand and districts, the fixed `open` race
 *  list for the cycle, and `cfg` -- NOT on `pending`, which is threaded
 *  through `counterDeclare` separately -- and neither hand nor districts
 *  mutate during the declare phase (a card leaves the hand only at
 *  resolution, after every round has run). So the expensive part (looping
 *  every hand card against every open race, building modifiers for each) is
 *  identical on every round for a given player and is safe to compute once
 *  per player per cycle. `open` is a fresh array built once per cycle
 *  (`Game.openRaces()`) and never mutated afterward, so its identity is
 *  exactly the right cache key -- a `WeakMap` keyed on it needs no explicit
 *  invalidation and cannot leak across games or cycles. Without this, a
 *  16-round cycle recomputed the same board-wide scan sixteen times per
 *  player; measured on `tuned.json`, this cut a representative game from
 *  ~9.5s to well under 1s with byte-identical output (the cache changes
 *  nothing about WHAT is computed, only how often). */
const optionsCache = new WeakMap<OpenRace[], Map<number, Option[]>>();

/** Every legal declaration this player could make, with its modifier edge.
 *  Agents differ only in how they score and cap this list. */
export function options(v: GameView, open: OpenRace[], cfg: Config): Option[] {
  let byPlayer = optionsCache.get(open);
  const cached = byPlayer?.get(v.me);
  if (cached) return cached;
  const out = computeOptions(v, open, cfg);
  if (!byPlayer) { byPlayer = new Map(); optionsCache.set(open, byPlayer); }
  byPlayer.set(v.me, out);
  return out;
}

function computeOptions(v: GameView, open: OpenRace[], cfg: Config): Option[] {
  const me = v.players[v.me];
  const cands = me.hand.filter((c) => c.kind === 'candidate') as (CandidateCard & { kind: 'candidate' })[];
  const out: Option[] = [];
  for (const r of open) {
    for (const card of cands) {
      const house = cfg.game.districtLevelEligibility && r.office === 'representative' ? r.slot : undefined;
      if (r.office !== 'president' && !eligible(card, r.state, me.districts, house)) continue;
      // A district is identified BY ITS NUMBER, not just its state. Matching
      // on state alone let whichever card `find` reached first supply the
      // demographics for a House race in a different district entirely.
      //
      // #40: identity match keys on the district card IN PLAY in this race's
      // slot, whoever holds it -- a House seat has exactly one such card, and
      // it prices the race whether the declaring player owns it or not.
      // `eligible` above is the separate entry gate (you may only enter where
      // you hold presence); this is what the race is worth once you are in
      // it. Senate/governor default to the player's OWN first-found holding;
      // #106 change 3 (`statewideFitSums`) instead sums fit across every
      // district card any player has in play in the state.
      const statewide = cfg.game.statewideFitSums
        && (r.office === 'senator' || r.office === 'governor')
        ? v.players.flatMap((p) => p.districts).filter((dd) => dd.state === r.state)
        : undefined;
      const district = r.office === 'representative'
        ? v.players.flatMap((p) => p.districts).find((d) => d.state === r.state && d.number === r.slot)
        : statewide ? undefined : me.districts.find((d) => d.state === r.state);
      for (const { card: pcard, bonus } of partyVariants(card, cfg)) {
        const d: Declaration = { player: v.me, card: pcard, district, districts: statewide, office: r.office, state: r.state, slot: r.slot,
          incumbent: r.incumbent?.holder?.cardId === card.id };
        const ctx = {
          year: v.year, office: r.office, state: r.state, slot: r.slot,
          lean: v.lean[r.state] ?? 0, isMidterm: v.isMidterm, isPresidentialYear: v.isPresidentialYear,
          presidentParty: v.presidentParty,
          // Was a stub 0 -- an agent could see everything else in RaceContext
          // but not the economy, though it is a visible board track and
          // `v.economy` already carries it. #39, ruled 2026-09-02: "a visible
          // track agents cannot read is a bug unless someone says otherwise."
          economyMod: economyModifier(v.economy, cfg.economy, cfg.national.strongEconomy, cfg.national.recession),
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
        out.push({ d, office: r.office, edge: edge + bonus });
      }
    }
  }
  return out;
}

const raceKey = (r: { office: Office; state: string; slot?: number }) => `${r.office}|${r.state}|${r.slot ?? ''}`;

/** hf7y/american-cycle#158/#286: like `optionsCache` above, `pending` is the
 *  SAME array for the whole of one cycle's `declareRounds` (engine/game.ts)
 *  -- only ever grown by `.push()`, never reassigned -- so its identity is
 *  just as safe a cache key. Without this, `counterDeclare` rebuilt a
 *  per-race-key Set from the FULL `pending` array on every one of a cycle's
 *  P*R declare calls, an O(P*R^2) scan of string-keyed Set work that stacks
 *  on top of the per-round redesign (#158) `optionsCache` already answers
 *  for the (pending-independent) `options` half. This tracks each race's
 *  declaring players incrementally instead, processing only the pegs pushed
 *  since the last call. */
interface PendingIndex { seen: number; byRace: Map<string, Set<number>> }
const pendingCache = new WeakMap<PendingPeg[], PendingIndex>();

/** Every race some player other than `me` has declared into this round. */
function contestedFor(pending: PendingPeg[], me: number): Set<string> {
  let idx = pendingCache.get(pending);
  if (!idx) { idx = { seen: 0, byRace: new Map() }; pendingCache.set(pending, idx); }
  for (; idx.seen < pending.length; idx.seen++) {
    const p = pending[idx.seen];
    const k = raceKey(p);
    let players = idx.byRace.get(k);
    if (!players) { players = new Set(); idx.byRace.set(k, players); }
    players.add(p.player);
  }
  const out = new Set<string>();
  for (const [k, players] of idx.byRace) if (players.size > 1 || !players.has(me)) out.add(k);
  return out;
}

/** Denial: contesting a race someone else has declared costs a real card
 *  against someone who may have spent nothing -- which is the asymmetry that
 *  makes district gating necessary. An agent that never does this plays
 *  solitaire. */
/** `appetite`: a flat edge bonus for a race a rival already committed to, so
 *  contesting reads as attractive rather than agents only ever taking open
 *  seats and leaving walkovers to accumulate. Unprinted magnitude (#87);
 *  every caller uses 2 except `HouseFarm` and `BillAuthor`'s 3, which is the
 *  same bump their office-specific sort already gives their target office,
 *  applied a second time to specifically prioritise CONTESTING it over an
 *  uncontested race elsewhere. */
export function counterDeclare(
  opts: Option[], pending: PendingPeg[], me: number, appetite: number,
): Option[] {
  const contested = contestedFor(pending, me);
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
   *  any die is rolled (see elections.ts, elections.test.ts).
   *
   *  -4 is unprinted (#87), chosen off DECISIONS.md's own odds table: a +4
   *  edge already wins 82.5% of generals and 94.4% of primaries, so a -4
   *  modifier total reads as a fight worth conceding before the dice, not
   *  merely an uphill one. */
  withdraw(v: WithdrawalView): boolean {
    return v.contenders > 0 && v.myModifierTotal <= -4;
  }
  /** hf7y/american-cycle#96: Lieberman 2006, Murkowski 2010 -- both were
   *  sitting incumbents facing a real primary fight, not challengers with no
   *  base to run on. `myModifiers` carries an `incumbency` line only for a
   *  card that already holds the seat (elections.ts:208), and the same -4
   *  bound `withdraw` uses marks a primary as genuinely contested rather
   *  than already lost. */
  declareIndependent(v: WithdrawalView): boolean {
    return v.contenders > 0 && v.myModifierTotal > -4
      && v.myModifiers.some((m) => m.source === 'incumbency');
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
  // Keyed on `open` identity, exactly like `optionsCache` above, and safe for
  // the same reason: `_pending` is unused below (this agent never reacts to
  // what anyone else has declared this cycle), so the shuffled order cannot
  // legitimately change from one round to the next. Before this cache, every
  // round `declareRounds` called `declare` on this agent re-shuffled the
  // full options list from scratch -- an O(options) `RNG.shuffle` on every
  // round of every cycle instead of once per cycle, which both re-inflated
  // the per-round cost `optionsCache` was added to kill and burned an amount
  // of RNG entropy that scaled with round count, shifting every roll after
  // it for the rest of the game.
  private shuffleCache = new WeakMap<OpenRace[], Option[]>();
  declare(v: GameView, open: OpenRace[], _pending: PendingPeg[]): Declaration[] {
    let order = this.shuffleCache.get(open);
    if (!order) {
      order = this.rng.shuffle([...options(v, open, this.cfg)]);
      this.shuffleCache.set(open, order);
    }
    return pickDistinct(order, this.budget(v));
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
      //
      // 0.045 linearises DECISIONS.md's general-election odds table (edge +1
      // = 59.2%, +4 = 82.5%, +6 = 92.1%) around its own slope -- unprinted
      // (#87), and cheap on purpose: this is a planning heuristic picking
      // between open races, not a resolver, so it undershoots at high edge
      // rather than reproducing the table's curve exactly.
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

/** hf7y/american-cycle#33: the board is 76-92% walkovers (#77) and #10 asks
 *  what that does to lean. This agent tries to find out by farming it on
 *  purpose -- never counter-declares, and drops any option someone else has
 *  already committed to THIS phase rather than merely deprioritising it. */
export class WalkoverFarmer extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const contested = new Set(pending.map(raceKey));
    const o = options(v, open, this.cfg).filter((x) => !contested.has(raceKey(x.d)));
    return pickDistinct(o.sort(byEdge), this.budget(v));
  }
  withdraw(v: WithdrawalView): boolean { return v.contenders > 0; }
}

/** hf7y/american-cycle#33: stack every positive-feedback loop this engine
 *  has on purpose, in one agent, rather than the one-loop-at-a-time agents
 *  above -- incumbency (defend everything held), the Launchpad stepping
 *  stone (odd-year governor to Senate), coattails (hold the presidency),
 *  and bill-authorship scoring (House seats, always vote yes, veto against
 *  a hostile chamber). F22 says the only brake on runaway is table
 *  politics; this is the agent that tests whether the rules supply one. */
export class RunawayMaximiser extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const heldAny = new Set(v.seats.filter((s) => s.holder?.player === v.me).map((s) => s.holder!.cardId));
    const heldGov = new Set(v.seats.filter((s) => s.office === 'governor' && s.holder?.player === v.me)
      .map((s) => s.holder!.cardId));
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2).map((x) => {
      let bonus = 0;
      if (heldAny.has(x.d.card.id)) bonus += 6;                          // defend every seat you hold
      if (x.office === 'governor' && v.year % 2 !== 0) bonus += 6;       // odd-year governorships: cheap ground
      if (x.office === 'senator' && heldGov.has(x.d.card.id)) bonus += 6; // step a sitting governor up
      if (x.office === 'representative') bonus += 4;                     // House seats author bills
      if (x.office === 'president') bonus += 3;                          // coattails compound while you hold it
      return { ...x, edge: x.edge + bonus };
    });
    return pickDistinct(o.sort(byEdge), this.budget(v) + 2);
  }
  voteBill(): boolean { return true; }
  proposeG(): number { return this.cfg.economy.gMax; }
  veto(v: GameView, _g: number): boolean {
    const pres = v.seats.find((s) => s.office === 'president' && s.holder);
    return pres?.holder?.player === v.me;
  }
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
        : x.d.districts
          ? x.d.districts.reduce((n, dd) => n + x.d.card.identities.filter((i) => dd.demographics.includes(i)).length, 0)
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
  // `fedCheck` (engine/rules/economy.ts) fires when 2d6 rolls <= accumulatedG:
  // 58.3% of rolls clear 7, 72.2% clear 8. Unprinted (#87); 7 and 8 are where
  // that curve stops being "probably fine" and start being "probably not" --
  // this agent stops PROPOSING growth right at the pivot and stops VOTING for
  // it one pip later, since a vote it doesn't control needs less margin.
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

/** hf7y/american-cycle#75: `Base.veto` only presses the veto under split
 *  government, so no shipped agent had ever exercised it -- a rule §12 writes
 *  at length went unmeasured. This agent chases the presidency and vetoes
 *  unconditionally while it holds the pen, which is the specimen #75 measured
 *  beating the whole old six-agent field. */
export class Vetoer extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2);
    const pres = o.filter((x) => x.office === 'president').sort(byEdge);
    return pickDistinct([...pres, ...o.filter((x) => x.office !== 'president').sort(byEdge)], this.budget(v));
  }
  veto(v: GameView, _g: number): boolean {
    const pres = v.seats.find((s) => s.office === 'president' && s.holder);
    return pres?.holder?.player === v.me;
  }
}

/** hf7y/american-cycle#75's second counter: SenateFlood's declare policy
 *  (Senate seats first) paired with a permanent no vote, which denies the
 *  60% cloture threshold outright rather than merely under-supplying it. */
export class BillBlocker extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2);
    const sen = o.filter((x) => x.office === 'senator').sort(byEdge);
    return pickDistinct([...sen, ...o.filter((x) => x.office !== 'senator').sort(byEdge)], this.budget(v));
  }
  voteBill(): boolean { return false; }
}

/** hf7y/american-cycle#37: the plank of DECISIONS.md's "untestable by
 *  simulation" table politics list that RunawayBrake (#255/#257, reacting to
 *  a rival's SCORE) and VPBackstab (reacting to a rival's TICKET) both leave
 *  untouched -- an agent that trades. At the time this was written the bill
 *  vote was simultaneous and secret, so no agent could see another's vote
 *  before casting its own; #263/#272 later opened that channel (see
 *  `Bandwagon`, below), but `favor` predates it and deliberately does not use
 *  it -- this is the CROSS-YEAR ledger. `v.bills` already names who authored
 *  each passed bill, and (`EnactedBill.yesVoters`) who voted for it, so
 *  trading here means paying forward a favour already on the books from a
 *  prior year, not reading the current roll in progress. */
function favor(me: number, other: number, bills: readonly EnactedBill[]): number {
  let f = 0;
  for (const b of bills) {
    if (b.author === me && b.yesVoters?.includes(other)) f += 1;
    if (b.author === other && b.yesVoters?.includes(me)) f -= 1;
  }
  return f;
}

export class Dealmaker extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    return pickDistinct(counterDeclare(options(v, open, this.cfg), pending, v.me, 2).sort(byEdge), this.budget(v));
  }
  /** A bill that already fits needs no trade. One that does not still gets a
   *  yes when its author is in this agent's debt -- `favor` is positive only
   *  when `authorId` has voted yes on a bill THIS agent authored more often
   *  than this agent has returned the favour, so repaying it can only ever
   *  clear a real balance, never manufacture one on a stranger. Nothing here
   *  ever forgives a balance except a vote actually cast the other way, so an
   *  author who takes the vote and never reciprocates simply never earns a
   *  second one -- the whole of "remember who reneged" is that the ledger
   *  has no eraser. */
  voteBill(v: GameView, g: number, seat: Seat, billTags?: readonly IdentityTag[], authorId?: number): boolean {
    if (super.voteBill(v, g, seat, billTags)) return true;
    if (authorId === undefined || authorId === v.me) return false;
    return favor(v.me, authorId, v.bills) > 0;
  }
}

/** hf7y/american-cycle#37: DECISIONS.md names "table politics against a
 *  runaway leader" as one of five things ruled untestable by simulation,
 *  because every agent above optimises its own score and none of them treat
 *  a RIVAL's score as an input at all. This one does. Once a rival is
 *  clearly ahead of the rest of the field, it stops scoring for itself on
 *  three axes and starts spending against that rival specifically:
 *  contesting the leader's own held seats first, denying every bill outright
 *  regardless of tag fit, and moving to remove the leader the moment they
 *  hold the presidency. `RunawayMaximiser`'s own comment asks whether the
 *  RULES alone supply a brake; this is the agent that asks whether the TABLE
 *  does. */
export class RunawayBrake extends Base {
  /** +6 matches this file's other single-pickup bonuses (defend a held seat,
   *  step a governor to Senate): a leader must clear the rest of the field's
   *  average by a full pickup, not by whatever happens to be left in hands
   *  after one uneven declare round. Unprinted (#87). */
  private static readonly RUNAWAY_MARGIN = 6;
  /** The rival with the highest score, but only once they clear the REST of
   *  the field's average by the margin above -- a two-player gap the third
   *  and fourth players have already closed is not a runaway, it is noise. */
  protected leader(v: GameView): number | undefined {
    const others = v.players.map((p, i) => ({ i, score: p.score })).filter((s) => s.i !== v.me);
    if (others.length < 2) return undefined;
    const top = others.reduce((b, s) => (s.score > b.score ? s : b), others[0]);
    const rest = others.filter((s) => s.i !== top.i);
    const restMean = rest.reduce((n, s) => n + s.score, 0) / rest.length;
    return top.score - restMean >= RunawayBrake.RUNAWAY_MARGIN ? top.i : undefined;
  }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const leader = this.leader(v);
    const held = leader === undefined ? new Set<string>()
      : new Set(v.seats.filter((s) => s.holder?.player === leader)
        .map((s) => raceKey({ office: s.office, state: s.state, slot: s.slot })));
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2)
      .map((x) => (held.has(raceKey(x.d)) ? { ...x, edge: x.edge + 6 } : x));
    return pickDistinct(o.sort(byEdge), this.budget(v));
  }
  /** No bill clears while a rival is running away -- the table denies the
   *  leader's chamber a win regardless of what the bill actually does, which
   *  is the blunt, deniable form real coalition obstruction takes. Absent a
   *  leader, votes exactly as every other agent above does. */
  voteBill(v: GameView, g: number, seat: Seat, billTags?: readonly IdentityTag[]): boolean {
    return this.leader(v) === undefined ? super.voteBill(v, g, seat, billTags) : false;
  }
  moveImpeach(v: GameView): boolean {
    const leader = this.leader(v);
    const pres = v.seats.find((s) => s.office === 'president' && s.holder);
    if (leader === undefined || !pres || pres.holder!.player !== leader) return false;
    const senate = v.seats.filter((s) => s.office === 'senator' && s.holder);
    const against = senate.filter((s) => s.holder!.party !== pres.holder!.party).length;
    return senate.length > 0 && against / senate.length >= 0.5;
  }
  voteImpeach(v: GameView, seat: Seat): boolean {
    const leader = this.leader(v);
    const pres = v.seats.find((s) => s.office === 'president' && s.holder);
    return leader !== undefined && !!pres && pres.holder!.player === leader && seat.holder?.party !== pres.holder!.party;
  }
}

/** hf7y/american-cycle#37's own 2026-09-16 comment names the remaining gap
 *  once Dealmaker (repays a favour already on the books) and RunawayBrake
 *  (reacts to a rival's score) both shipped: "coalition-building for
 *  impeachment, beyond the arithmetic Impeacher/VPBackstab already do."
 *  Those two move/vote on raw Senate party count alone. This one reads the
 *  same favour ledger Dealmaker introduced -- `EnactedBill.yesVoters`, a
 *  counter already on the board, not a new channel -- to both size up a
 *  coalition before moving and to actually cross party lines paying down a
 *  debt when the vote comes. */
export class Whip extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2).map((x) => ({
      ...x, edge: x.edge + (x.office === 'representative' ? 6 : x.office === 'senator' ? 3 : 0),
    }));
    return pickDistinct(o.sort(byEdge), this.budget(v) + 2);
  }
  voteBill(v: GameView, g: number, seat: Seat, billTags?: readonly IdentityTag[], authorId?: number): boolean {
    if (super.voteBill(v, g, seat, billTags)) return true;
    if (authorId === undefined || authorId === v.me) return false;
    return favor(v.me, authorId, v.bills) > 0;
  }
  proposeG(): number { return 4; }
  /** Moves only once a coalition that actually clears `impeachThreshold` is
   *  there: every senator opposed to the president on party, plus every
   *  senator who owes THIS agent a favour regardless of party -- a real
   *  prediction against the 2/3 the vote itself needs, not the looser
   *  50%/25% thresholds Impeacher and VPBackstab settle for. */
  moveImpeach(v: GameView): boolean {
    const pres = v.seats.find((s) => s.office === 'president' && s.holder);
    if (!pres || pres.holder!.player === v.me) return false;
    const senate = v.seats.filter((s) => s.office === 'senator' && s.holder);
    if (!senate.length) return false;
    const predictedYes = senate.filter((s) =>
      s.holder!.party !== pres.holder!.party || favor(s.holder!.player, v.me, v.bills) > 0).length;
    return predictedYes / senate.length >= this.cfg.legislature.impeachThreshold;
  }
  /** Opposition-party senators vote as every other agent's default does.
   *  A same-party senator crosses when it owes ANYONE a favour it has
   *  never repaid -- the debtor side of exactly the prediction
   *  `moveImpeach` made, since a vote is cast without knowing who moved. */
  voteImpeach(v: GameView, seat: Seat): boolean {
    const pres = v.seats.find((s) => s.office === 'president' && s.holder);
    if (!pres) return false;
    if (seat.holder!.party !== pres.holder!.party) return true;
    const me = seat.holder!.player;
    return v.players.some((_, other) => other !== me && favor(me, other, v.bills) > 0);
  }
}

/** hf7y/american-cycle#37: the roll call itself (#263, merged as #272) is the
 *  channel "negotiation before the bill vote" was blocked on -- DECISIONS.md
 *  said no agent could see another's vote before casting its own, and that is
 *  no longer true. `voteBill`'s `votesSoFar` argument carries every vote
 *  already cast this roll, in `leg.rollCall`'s fixed House-then-Senate,
 *  alphabetical-by-state order. This is the first agent that reads it: not a
 *  favour struck in advance (there is still no channel to negotiate an offer
 *  on, only to observe one already cast), but the real-time version of what a
 *  whip does on the floor -- watch how the caucus is breaking and fall in
 *  line, exactly the "no channel" DECISIONS.md described until #272.
 *
 *  Momentum only overrides a district vote fit alone leaves undecided or
 *  would flip; it needs a real signal (a few votes cast) before it will act,
 *  and a mixed signal (between `BREAK_AT` and `JOIN_AT`) falls back to fit
 *  like every other agent. Because the roll call has a fixed order, the same
 *  seat can now vote differently on the identical bill depending only on when
 *  it is called -- called first, there is no momentum yet and it votes its
 *  district; called last, in the Senate, it has seen the entire House and
 *  most of the Senate before it decides. */
export class Bandwagon extends Base {
  /** Fewer than this many same-party votes cast so far reads as one early
   *  holdout, not momentum. Unprinted (#87). */
  private static readonly MIN_SIGNAL = 2;
  private static readonly JOIN_AT = 0.7;
  private static readonly BREAK_AT = 0.3;
  private momentum(party: Party, votesSoFar: readonly Vote[]): boolean | undefined {
    const mine = votesSoFar.filter((x) => x.party === party);
    if (mine.length < Bandwagon.MIN_SIGNAL) return undefined;
    const yesShare = mine.filter((x) => x.yes).length / mine.length;
    if (yesShare >= Bandwagon.JOIN_AT) return true;
    if (yesShare <= Bandwagon.BREAK_AT) return false;
    return undefined;
  }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    const o = counterDeclare(options(v, open, this.cfg), pending, v.me, 2);
    return pickDistinct(o.sort(byEdge), this.budget(v));
  }
  voteBill(v: GameView, g: number, seat: Seat, billTags?: readonly IdentityTag[], authorId?: number,
    votesSoFar?: readonly Vote[]): boolean {
    const m = seat.holder && votesSoFar ? this.momentum(seat.holder.party, votesSoFar) : undefined;
    return m !== undefined ? m : super.voteBill(v, g, seat, billTags);
  }
}

/** hf7y/american-cycle#37's own 2026-09-16 comment named the three items
 *  DECISIONS.md's "untestable by simulation" list still had open -- negotiation
 *  before the bill vote, VP horse-trading beyond `VPBackstab`, naming the
 *  omnibill -- and called all three "genuinely blocked" by the same wall:
 *  voting is simultaneous and secret, so no agent can see or signal another
 *  before casting its own vote. That is true of the bill vote. It is not true
 *  of the VP pick in the same way: `offerVP` IS answered blind, same as a
 *  vote, but the ticket it produces is a public fact afterward -- `VPGrant`
 *  (`engine/game.ts`) is that fact, recorded the moment a ticket is chosen,
 *  exactly parallel to how `EnactedBill.yesVoters` records a bill's result
 *  after a vote nobody could see coming. Dealmaker and Whip already trade on
 *  the bill-vote version of this same shape -- "a public post-hoc ledger
 *  rather than pre-vote negotiation" is how #37's own comment described that
 *  trade counting as reaching its list item. This is the identical trade,
 *  on the channel that item's comment said was blocked but was actually just
 *  unrecorded. */
/** Same sign convention `favor` (above) already established: positive means
 *  ME -- a grant received and not yet repaid is a debt THIS agent carries,
 *  same as a yes vote taken and not yet returned. `g.to === me` is the
 *  receiving side of a grant, so it is the `+= 1` (mirrors `b.author === me`
 *  above, the receiving side of a vote); `g.from === me` is this agent
 *  having ALREADY given, which is `-= 1`, the credit it is owed. */
function vpFavor(me: number, other: number, vpGrants: readonly VPGrant[]): number {
  let f = 0;
  for (const g of vpGrants) {
    if (g.to === me && g.from === other) f += 1;
    if (g.to === other && g.from === me) f -= 1;
  }
  return f;
}

export class RunningMate extends Base {
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] {
    return pickDistinct(counterDeclare(options(v, open, this.cfg), pending, v.me, 2).sort(byEdge), this.budget(v));
  }
  /** Withhold from a nominee this agent has already given more to than it
   *  has gotten back -- combined favour negative, a debtor on both channels
   *  who has not repaid -- and offer everyone else its best card, including
   *  a clean slate: an offer is how a relationship on this ledger starts,
   *  the same way Dealmaker's first yes vote on a stranger's bill is unearned
   *  by construction. */
  offerVP(v: GameView, nominee: { player: number; party: Party }): CandidateCard | undefined {
    if (nominee.player === v.me) return undefined;
    if (favor(v.me, nominee.player, v.bills) + vpFavor(v.me, nominee.player, v.vpGrants) < 0) return undefined;
    const hand = v.players[v.me].hand.filter((c) => c.kind === 'candidate') as CandidateCard[];
    if (!hand.length) return undefined;
    return hand.reduce((best, c) => (c.homeStateBonus > best.homeStateBonus ? c : best), hand[0]);
  }
  /** Prefer whichever supplier this agent already owes the most -- taking
   *  their card is a visible, in-game way to favour a past benefactor, the
   *  same debt `voteBill` below repays with a vote -- over `Base`'s raw best
   *  card or `VPBackstab`'s arbitrary first offer. */
  pickVP(v: GameView, offers: VPOffer[]): VPOffer | undefined {
    const scored = (o: VPOffer) => favor(v.me, o.from, v.bills) + vpFavor(v.me, o.from, v.vpGrants);
    return offers.reduce((best, o) => {
      const s = scored(o), bs = scored(best);
      return s > bs || (s === bs && o.card.homeStateBonus > best.card.homeStateBonus) ? o : best;
    }, offers[0]);
  }
  /** Repays either half of the combined ledger: a bill-vote favour, exactly
   *  as Dealmaker/Whip already do, or a VP grant never paid back in a vote. */
  voteBill(v: GameView, g: number, seat: Seat, billTags?: readonly IdentityTag[], authorId?: number): boolean {
    if (super.voteBill(v, g, seat, billTags)) return true;
    if (authorId === undefined || authorId === v.me) return false;
    return favor(v.me, authorId, v.bills) + vpFavor(v.me, authorId, v.vpGrants) > 0;
  }
}

export const AGENTS: Record<string, new (cfg: Config, rng: RNG) => Agent> = {
  Random: class extends RandomAgent { constructor(c: Config, r: RNG) { super('Random', c, r); } },
  Greedy: class extends GreedyAgent { constructor(c: Config, r: RNG) { super('Greedy', c, r); } },
  Lookahead: class extends LookaheadAgent { constructor(c: Config, r: RNG) { super('Lookahead', c, r); } },
  WideAndEmpty: class extends WideAndEmpty { constructor(c: Config, r: RNG) { super('WideAndEmpty', c, r); } },
  WalkoverFarmer: class extends WalkoverFarmer { constructor(c: Config, r: RNG) { super('WalkoverFarmer', c, r); } },
  RunawayMaximiser: class extends RunawayMaximiser { constructor(c: Config, r: RNG) { super('RunawayMaximiser', c, r); } },
  SenateFlood: class extends SenateFlood { constructor(c: Config, r: RNG) { super('SenateFlood', c, r); } },
  HouseFarm: class extends HouseFarm { constructor(c: Config, r: RNG) { super('HouseFarm', c, r); } },
  HeterodoxSpecialist: class extends HeterodoxSpecialist { constructor(c: Config, r: RNG) { super('HeterodoxSpecialist', c, r); } },
  BillMaximizer: class extends BillMaximizer { constructor(c: Config, r: RNG) { super('BillMaximizer', c, r); } },
  Impeacher: class extends Impeacher { constructor(c: Config, r: RNG) { super('Impeacher', c, r); } },
  VPBackstab: class extends VPBackstab { constructor(c: Config, r: RNG) { super('VPBackstab', c, r); } },
  Launchpad: class extends Launchpad { constructor(c: Config, r: RNG) { super('Launchpad', c, r); } },
  EconomyChicken: class extends EconomyChicken { constructor(c: Config, r: RNG) { super('EconomyChicken', c, r); } },
  BillAuthor: class extends BillAuthor { constructor(c: Config, r: RNG) { super('BillAuthor', c, r); } },
  Vetoer: class extends Vetoer { constructor(c: Config, r: RNG) { super('Vetoer', c, r); } },
  BillBlocker: class extends BillBlocker { constructor(c: Config, r: RNG) { super('BillBlocker', c, r); } },
  Dealmaker: class extends Dealmaker { constructor(c: Config, r: RNG) { super('Dealmaker', c, r); } },
  RunawayBrake: class extends RunawayBrake { constructor(c: Config, r: RNG) { super('RunawayBrake', c, r); } },
  Whip: class extends Whip { constructor(c: Config, r: RNG) { super('Whip', c, r); } },
  Bandwagon: class extends Bandwagon { constructor(c: Config, r: RNG) { super('Bandwagon', c, r); } },
  RunningMate: class extends RunningMate { constructor(c: Config, r: RNG) { super('RunningMate', c, r); } },
};
