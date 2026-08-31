/** The game — design doc §7's annual tick, wired to the rule modules.
 *
 *  Players are not parties. A player is a faction holding cards of both
 *  parties (§13: "a skilled player runs one party hot and pivots to the other
 *  in the recession year"), so score is per player and party is per card.
 *
 *  The board starts empty and fills as seats are won. Chamber majorities are
 *  computed over HELD seats only, which is what makes a legislature possible
 *  at all when a table of four holds thirty seats between them.
 */
import type {
  CandidateCard, Card, DistrictCard, Office, Party, RaceEvent, Seat,
} from './types/index.ts';
import { RNG } from './rules/rng.ts';
import { Wave } from './rules/resolution.ts';
import * as lean from './rules/lean.ts';
import * as econ from './rules/economy.ts';
import * as leg from './rules/legislature.ts';
import {
  buildModifiers, eligible, runRace, withdrawalView,
  type Declaration, type RaceContext, type WithdrawalView,
} from './rules/elections.ts';
import { STATES, BY_CODE, senateUp, governorUp, electors, type StateDef } from './states.ts';

export interface Config {
  name: string;
  hand: { base: number; bonusPresident: number; bonusSenator: number; bonusGovernor: number; bonusRepresentative: number };
  resolution: { incumbency: number; identityBonus: number; tieBreak: string };
  national: { strongEconomy: number; recession: number; midtermPenalty: number; coattailsWith: number; coattailsAgainst: number };
  endorsements: { president: number; governorInState: number; senator: number };
  primaryGeneral: { extremistPrimary: number; extremistGeneral: number; heterodoxPrimaryPenalty: number; crossBenchPrimaryPenalty: number };
  lean: lean.LeanConfig;
  economy: econ.EconomyConfig;
  legislature: leg.LegislatureConfig;
  draft: { packSize: number; districtsPerPack: number; refillToHandSize: boolean };
  game: { startYear: number; maxYears: number; victory: string; deckOutEnds: boolean };
}

export interface PlayerState {
  id: number;
  name: string;
  hand: Card[];
  districts: DistrictCard[];
  score: number;
  /** cards tapped to endorse this cycle; untap at cycle start (§9) */
  tapped: Set<string>;
}

export interface GameView {
  year: number;
  isElectionYear: boolean;
  isMidterm: boolean;
  isPresidentialYear: boolean;
  economy: econ.Economy;
  lean: lean.Lean;
  seats: Seat[];
  players: PlayerState[];
  me: number;
  presidentParty?: Party;
}

export interface Agent {
  name: string;
  /** Which races to enter. §8: declaration is sequential around the table, so
   *  `pending` carries the pegs already on the board -- visible as contested
   *  races, with the cards still face down. Counter-declaring is the
   *  counterplay to spreading thin. */
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[];
  /** §8: decided on incomplete information, by construction */
  withdraw(v: WithdrawalView): boolean;
  /** the omnibill's single number, 1..6, negative for austerity */
  proposeG(v: GameView): number;
  voteBill(v: GameView, g: number, seat: Seat): boolean;
  veto(v: GameView, g: number): boolean;
}

export type UiRequest =
  | { kind: 'declare'; year: number; open: OpenRace[] }
  | { kind: 'withdraw'; year: number; round: 'primary' | 'general';
      view: WithdrawalView; race: { office: Office; state: string; slot?: number; cardName: string } }
  | { kind: 'bill'; year: number; isAuthor: boolean; votes: boolean };

export interface UiAnswer { declarations?: Declaration[]; withdraw?: boolean; g?: number; yes?: boolean }

const raceKeyOf = (d: { office: Office; state: string; slot?: number }) => `${d.office}|${d.state}|${d.slot ?? ''}`;
const sameRace = (a: { office: Office; state: string; slot?: number }, b: { office: Office; state: string; slot?: number }) =>
  raceKeyOf(a) === raceKeyOf(b);

export interface OpenRace { office: Office; state: string; slot?: number; incumbent?: Seat }
/** A peg on the board: the race is contested, the card is not visible. */
export interface PendingPeg { player: number; office: Office; state: string; slot?: number; party?: Party }

export interface GameResult {
  seed: number;
  config: string;
  years: number;
  scores: number[];
  winner: number;
  leadChanges: number;
  /** year at which the eventual winner first took the lead and kept it */
  determinationYear: number;
  events: RaceEvent[];
  billsPassed: number;
  billsAttempted: number;
  crossBenchVotes: number;
  impeachments: number;
  rateRises: number;
  finalLean: lean.Lean;
  uncontestedShare: number;
  /** share of race-slots that drew declarations from more than one player */
  contestedSlotShare: number;
  decisionCounts: number[];
  seatsByOffice: Record<Office, number>;
}

export class Game {
  cfg: Config; rng: RNG; players: PlayerState[]; seats: Seat[] = [];
  leanMap: lean.Lean = {}; economy: econ.Economy;
  year: number; talon: Card[] = []; discard: Card[] = []; eraQueue: Card[][] = [];
  president?: { player: number; cardId: string; party: Party; since: number };
  events: RaceEvent[] = [];
  log: string[] = [];
  stats = { billsPassed: 0, billsAttempted: 0, crossBench: 0, impeachments: 0, rateRises: 0,
            decisions: [] as number[],
            /** race-slots offered, and those drawing declarations from >1 player.
             *  Counting "uncontested generals" instead undercounts badly: a race
             *  several players crowd in one party resolves as a contested PRIMARY
             *  and a one-candidate general. */
            raceSlots: 0, contestedSlots: 0 };
  private agents: Agent[];
  private scoreHistory: number[][] = [];

  constructor(agents: Agent[], cards: Card[], cfg: Config, seed: number) {
    this.cfg = cfg; this.rng = new RNG(seed); this.agents = agents;
    this.year = cfg.game.startYear;
    this.economy = econ.newEconomy(cfg.economy);
    this.players = agents.map((a, i) => ({ id: i, name: a.name, hand: [], districts: [], score: 0, tapped: new Set() }));
    for (const s of STATES) this.leanMap[s.code] = 0;
    // §14: "refill packs draw from later years", so a game beginning in 1976
    // is playing 2010s cards by year ten. The talon is therefore era-ordered,
    // not shuffled together: each era is shuffled within itself and they are
    // consumed oldest first. This also concentrates presence early, when the
    // pool is one era's ~24 states rather than four eras' fifty.
    const eras = [...new Set(cards.map((c) => c.era))].sort((a, b) => a - b);
    this.eraQueue = eras.map((e) => this.rng.shuffle(cards.filter((c) => c.era === e)));
    this.talon = this.eraQueue.shift() ?? [];
    this.deal();
  }

  /** §6/§11: the office bonuses are per OFFICE HELD, not per seat. The doc's
   *  own arithmetic fixes this -- "base 12 with president +2 is a 17% edge"
   *  is 2/12, a one-off. Read per seat, a player holding twenty Senate seats
   *  draws thirty-two cards a cycle, which both runs away and exhausts the
   *  talon: game length collapsed from 24 years to 7 before this was fixed. */
  private handSize(p: PlayerState): number {
    const h = this.cfg.hand;
    const holds = (o: Office) => this.seats.some((s) => s.holder?.player === p.id && s.office === o);
    return h.base
      + (holds('president') ? h.bonusPresident : 0)
      + (holds('senator') ? h.bonusSenator : 0)
      + (holds('governor') ? h.bonusGovernor : 0)
      + (holds('representative') ? h.bonusRepresentative : 0);
  }

  private draw(p: PlayerState, n: number): void {
    for (let i = 0; i < n; i++) {
      if (!this.talon.length) {
        // The next era enters play before the discard is recycled -- that is
        // what puts 2010s districts under 1970s politicians (§14).
        if (this.eraQueue.length) this.talon = this.eraQueue.shift()!;
        else if (this.discard.length) { this.talon = this.rng.shuffle(this.discard); this.discard = []; }
        else return;                                 // §14: the deck-out ending
      }
      const c = this.talon.pop()!;
      if (c.kind === 'district') p.districts.push(c); else p.hand.push(c);
    }
  }

  private deal(): void {
    // Same reasoning as refill(): a fixed sweep favours the low seats whenever
    // the pack cannot cover the table.
    for (const p of this.players) this.draw(p, this.handSize(p));
  }

  /** total cards held: candidates in hand plus districts in play */
  held(p: PlayerState): number { return p.hand.length + p.districts.length; }

  private openRaces(): OpenRace[] {
    const out: OpenRace[] = [];
    const y = this.year;
    if (y % 4 === 0) out.push({ office: 'president', state: 'US' });
    for (const s of STATES) {
      for (const cls of senateUp(s, y)) {
        out.push({ office: 'senator', state: s.code, slot: cls, incumbent: this.seatFor('senator', s.code, cls) });
      }
      if (governorUp(s, y)) out.push({ office: 'governor', state: s.code, incumbent: this.seatFor('governor', s.code) });
    }
    // §2: the board prints no districts. A House race therefore exists only
    // where a district CARD is in play -- the House map IS the set of drafted
    // districts, which is also what makes §15's capture coherent (you take the
    // seat by taking the card). Opening all 435 seats instead leaves the map so
    // sparse that players never meet, and the game becomes solitaire.
    const inPlay = new Map<string, { state: string; number: number }>();
    for (const p of this.players) for (const d of p.districts) inPlay.set(d.id, d);
    for (const d of inPlay.values()) {
      out.push({ office: 'representative', state: d.state, slot: d.number,
                 incumbent: this.seatFor('representative', d.state, d.number) });
    }
    return out;
  }

  private seatFor(office: Office, state: string, slot?: number): Seat | undefined {
    return this.seats.find((s) => s.office === office && s.state === state && s.slot === slot && s.holder);
  }

  private view(me: number): GameView {
    return {
      year: this.year,
      isElectionYear: this.year % 2 === 0,
      isMidterm: this.year % 4 === 2,
      isPresidentialYear: this.year % 4 === 0,
      economy: this.economy, lean: this.leanMap, seats: this.seats,
      players: this.players, me, presidentParty: this.president?.party,
    };
  }

  // ---- §7 step 2-3: the omnibill -------------------------------------------
  private omnibill(human = -1, humanG?: number, humanYes?: boolean): void {
    const authorId = leg.author(this.seats);
    if (authorId === undefined) return;
    this.stats.billsAttempted++;
    const proposed = authorId === human && humanG !== undefined
      ? humanG : this.agents[authorId].proposeG(this.view(authorId));
    const g = clampInt(proposed, this.cfg.economy.gMin, this.cfg.economy.gMax);

    const votes: leg.Vote[] = [];
    for (const s of this.seats) {
      if (!s.holder || (s.office !== 'senator' && s.office !== 'representative')) continue;
      const yes = s.holder.player === human && humanYes !== undefined
        ? humanYes : this.agents[s.holder.player].voteBill(this.view(s.holder.player), g, s);
      votes.push({ player: s.holder.player, party: s.holder.party, office: s.office, yes });
    }

    const pres = this.president;
    const wouldPass = leg.tallyBill(this.cfg.legislature, this.seats, votes, g, pres, false, undefined, this.rng);
    const vetoes = !!pres && wouldPass.passed && this.agents[pres.player].veto(this.view(pres.player), g);
    const override = vetoes
      ? { house: votes.filter((v) => v.office === 'representative' && v.yes).length,
          senate: votes.filter((v) => v.office === 'senator' && v.yes).length }
      : undefined;

    const out = leg.tallyBill(this.cfg.legislature, this.seats, votes, g, pres, vetoes, override, this.rng);
    this.stats.crossBench += out.crossBenched;
    if (out.passed) {
      this.stats.billsPassed++;
      for (const [p, n] of Object.entries(out.scores)) this.players[Number(p)].score += n;
      econ.spend(this.economy, this.cfg.economy, g);
      this.log.push(`${this.year}: omnibill G${g} passed ${out.houseYes}/${out.houseTotal} H, ${out.senateYes}/${out.senateTotal} S`);
    } else {
      this.log.push(`${this.year}: omnibill G${g} ${out.vetoed ? 'vetoed' : 'failed'}`);
    }
  }

  // ---- §7 steps 6-9: the elections -----------------------------------------
  private elections(): void {
    const wave = new Wave(this.rng);
    const open = this.openRaces();
    const decls: Declaration[] = [];
    const pending: PendingPeg[] = [];
    // §8: sequential around the table, and the order rotates each cycle so
    // going last is not a permanent tax.
    const order = this.players.map((_, i) => (i + (this.year / 2)) % this.players.length);
    for (const i of order) {
      const mine = this.agents[i].declare(this.view(i), open, pending);
      this.stats.decisions.push(mine.length);
      for (const d of mine) {
        const p = this.players[i];
        if (!p.hand.some((c) => c.kind === 'candidate' && c.id === d.card.id)) continue;
        if (d.office !== 'president' && !eligible(d.card, d.state, p.districts)) continue;
        decls.push({ ...d, player: i });
        pending.push({ player: i, office: d.office, state: d.state, slot: d.slot, party: d.card.party });
      }
    }
    this.resolveDeclared(decls, wave, -1);
  }

  /** Everything after declaration: primaries, generals, seating, capture and
   *  the lean pushes. Shared by the headless tick and the interactive one so
   *  the rules exist exactly once. */
  private resolveDeclared(decls: Declaration[], wave: Wave, human: number): void {
    const presidential = decls.filter((d) => d.office === 'president');
    const presidentialWinner = presidential.length ? this.presidentialRace(presidential, wave, human) : undefined;

    const byRace = new Map<string, Declaration[]>();
    for (const d of decls) {
      if (d.office === 'president') continue;
      const k = raceKeyOf(d);
      if (!byRace.has(k)) byRace.set(k, []);
      byRace.get(k)!.push(d);
    }
    for (const [, group] of byRace) {
      this.stats.raceSlots++;
      if (new Set(group.map((d) => d.player)).size > 1) this.stats.contestedSlots++;
    }

    const results: { ev: RaceEvent; won: Declaration }[] = [];
    for (const [key, group] of byRace) {
      const [office, state, slotStr] = key.split('|');
      const slot = slotStr ? Number(slotStr) : undefined;
      const incumbent = this.seatFor(office as Office, state, slot);
      const ctx = this.raceContext(office as Office, state, slot, presidentialWinner);

      const nominees = this.runPrimaries(group, ctx, wave, human);
      if (!nominees.length) continue;
      for (const d of nominees) d.incumbent = !!incumbent && incumbent.holder!.cardId === d.card.id;

      const out = runRace({
        ctx, round: 'general', declarations: nominees, wave, rng: this.rng,
        res: this.cfg.resolution, nat: this.cfg.national, pg: this.cfg.primaryGeneral,
        decide: (p, v) => this.decideWithdraw(p, v, nominees, human),
      });
      for (const w of out.withdrawnCards) this.returnToHand(w);
      if (!out.event) continue;
      this.events.push(out.event);

      const won = nominees.find((d) => d.player === out.event!.winner)!;
      results.push({ ev: out.event, won });
      for (const d of nominees) if (d.player !== out.event.winner) this.discardCard(d);
      this.seat(office as Office, state, slot, won);
      if (office === 'representative') this.capture(won, state);
    }

    this.pushLean(results);
  }

  /** The human's withdrawal answers were collected before any die was drawn;
   *  everyone else asks their agent. */
  private decideWithdraw(p: number, v: WithdrawalView, group: Declaration[], human: number): boolean {
    if (p === human) {
      const mine = group.find((d) => d.player === human);
      if (mine) return this.humanWithdrawals.get(raceKeyOf(mine) + '|' + mine.card.id) ?? false;
      return false;
    }
    return this.agents[p].withdraw(v);
  }

  private raceContext(office: Office, state: string, slot: number | undefined, presidentialWinner?: Party): RaceContext {
    return {
      year: this.year, office, state, slot,
      lean: this.leanMap[state] ?? 0,
      isMidterm: this.year % 4 === 2,
      isPresidentialYear: this.year % 4 === 0,
      presidentParty: this.president?.party,
      economyMod: econ.economyModifier(this.economy, this.cfg.economy, this.cfg.national.strongEconomy, this.cfg.national.recession),
      presidentialWinner,
    };
  }

  /** §11: nomination is a national primary, so only two cards reach the general
   *  regardless of table size. The general then runs state by state -- which is
   *  what produces the states carried that the honeymoon counter needs, and
   *  what makes the map worth holding. */
  private presidentialRace(declarations: Declaration[], wave: Wave, human = -1): Party | undefined {
    const natCtx = this.raceContext('president', 'US', undefined);
    const nominees = this.runPrimaries(declarations, natCtx, wave, human);
    if (!nominees.length) return undefined;

    const tally = new Map<number, number>();
    const carried = new Map<Party, string[]>();
    for (const st of STATES) {
      const ctx = this.raceContext('president', st.code, undefined);
      const out = runRace({
        ctx, round: 'general', declarations: nominees, wave, rng: this.rng,
        res: this.cfg.resolution, nat: this.cfg.national, pg: this.cfg.primaryGeneral,
        decide: () => false,   // the ticket is committed; you cannot withdraw a state at a time
      });
      if (!out.event) continue;
      this.events.push(out.event);
      const won = nominees.find((d) => d.player === out.event!.winner)!;
      tally.set(won.player, (tally.get(won.player) ?? 0) + electors(st, this.year));
      const list = carried.get(won.card.party) ?? [];
      list.push(st.code);
      carried.set(won.card.party, list);
    }
    if (!tally.size) return undefined;

    let best = -1, bestEV = -1;
    for (const [player, ev] of tally) if (ev > bestEV) { bestEV = ev; best = player; }
    const winner = nominees.find((d) => d.player === best)!;
    for (const d of nominees) if (d.player !== best) this.discardCard(d);
    this.seat('president', 'US', undefined, winner);
    this.log.push(`${this.year}: ${winner.card.name} (${winner.card.party}) wins with ${bestEV} electoral votes`);

    // §10: the honeymoon. One counter in every state carried, removed at the
    // next decay -- so the incoming party enters the midterm with a fleeting
    // map advantage immediately before the -2 lands on them.
    lean.honeymoon(this.leanMap, this.cfg.lean, carried.get(winner.card.party) ?? [], winner.card.party);
    return winner.card.party;
  }

  private runPrimaries(group: Declaration[], ctx: RaceContext, wave: Wave, human = -1): Declaration[] {
    const byParty = new Map<Party, Declaration[]>();
    for (const d of group) {
      if (!byParty.has(d.card.party)) byParty.set(d.card.party, []);
      byParty.get(d.card.party)!.push(d);
    }
    const winners: Declaration[] = [];
    for (const [party, cands] of byParty) {
      if (party === 'I') { winners.push(...cands); continue; }  // §9: independents skip the primary
      if (cands.length === 1) { winners.push(cands[0]); continue; }
      const out = runRace({
        ctx, round: 'primary', declarations: cands, wave, rng: this.rng,
        res: this.cfg.resolution, nat: this.cfg.national, pg: this.cfg.primaryGeneral,
        decide: (p, v) => this.decideWithdraw(p, v, cands, human),
      });
      for (const w of out.withdrawnCards) this.returnToHand(w);
      if (!out.event) continue;
      this.events.push(out.event);
      const w = cands.find((d) => d.player === out.event!.winner);
      if (w) winners.push(w);
      // §8: primary loss returns the card to hand. Cheap to enter; the cost is
      // that you revealed it.
      for (const d of cands) if (d.player !== out.event!.winner) this.returnToHand(d);
    }
    return winners;
  }

  private pushLean(results: { ev: RaceEvent; won: Declaration }[]): void {
    const byState = new Map<string, { office: Office; party: Party; margin: number }[]>();
    for (const r of results) {
      const st = r.ev.state;
      if (st === 'US') continue;
      if (!byState.has(st)) byState.set(st, []);
      byState.get(st)!.push({ office: r.ev.office, party: r.won.card.party, margin: r.ev.margin });
    }
    for (const [st, races] of byState) {
      const top = lean.nationalizedRace(races);
      if (!top) continue;
      lean.applyPush(this.leanMap, this.cfg.lean, st, top.party, top.office, top.margin);
    }
  }

  private seat(office: Office, state: string, slot: number | undefined, d: Declaration): void {
    const existing = this.seats.find((s) => s.office === office && s.state === state && s.slot === slot);
    const holder = { cardId: d.card.id, player: d.player, party: d.card.party, since: this.year };
    if (existing) existing.holder = holder;
    else this.seats.push({ office, state, slot, senateClass: office === 'senator' ? (slot as 1 | 2 | 3) : undefined, holder });
    if (office === 'president') this.president = { ...holder };
    const p = this.players[d.player];
    p.hand = p.hand.filter((c) => !(c.kind === 'candidate' && c.id === d.card.id));
    p.score += office === 'president' ? 5 : office === 'senator' ? 3 : office === 'governor' ? 2 : 1;
  }

  /** §15: winning a House seat transfers the district card to the winner. */
  private capture(won: Declaration, state: string): void {
    for (const p of this.players) {
      if (p.id === won.player) continue;
      const i = p.districts.findIndex((d) => d.state === state);
      if (i >= 0) { this.players[won.player].districts.push(p.districts.splice(i, 1)[0]); return; }
    }
  }

  private returnToHand(d: Declaration): void {
    const p = this.players[d.player];
    if (!p.hand.some((c) => c.kind === 'candidate' && c.id === d.card.id)) {
      p.hand.push({ kind: 'candidate', ...d.card });
    }
  }

  private discardCard(d: Declaration): void {
    const p = this.players[d.player];
    p.hand = p.hand.filter((c) => !(c.kind === 'candidate' && c.id === d.card.id));
    this.discard.push({ kind: 'candidate', ...d.card });
  }

  /** The interactive tick. Identical rules to `tick()`, but it yields at the
   *  two moments a human must act: choosing declarations, and the withdrawal
   *  window. Written as a generator so the UI can drive the engine without the
   *  engine knowing a UI exists, and without a second copy of the rules.
   *
   *  The withdrawal yield happens BEFORE any die is drawn -- the same ordering
   *  `runRace` enforces for the agents (§8). */
  *interactiveTick(human: number): Generator<UiRequest, void, UiAnswer> {
    for (const p of this.players) p.tapped.clear();
    this.omnibillInteractive(human, yield* this.askBill(human));
    const fed = econ.fedCheck(this.economy, this.cfg.economy, this.rng);
    if (fed.rateRise) { this.stats.rateRises++; this.log.push(`${this.year}: the Fed tightens`); }
    econ.walk(this.economy, this.cfg.economy, this.rng);
    lean.decay(this.leanMap, this.cfg.lean, this.year);

    if (this.year % 2 === 0) {
      const open = this.openRaces();
      const answer = yield { kind: 'declare', year: this.year, open };
      this.humanDeclarations = answer.declarations ?? [];
      yield* this.electionsInteractive(human);
      this.refill();
    }
    this.scoreHistory.push(this.players.map((p) => p.score));
    this.year++;
  }

  private humanDeclarations: Declaration[] = [];
  private humanWithdrawals = new Map<string, boolean>();

  private *askBill(human: number): Generator<UiRequest, { g?: number; yes?: boolean }, UiAnswer> {
    const authorId = leg.author(this.seats);
    if (authorId === undefined) return {};
    const holdsSeat = this.seats.some((s) => s.holder?.player === human && (s.office === 'senator' || s.office === 'representative'));
    if (authorId !== human && !holdsSeat) return {};
    const a = yield { kind: 'bill', year: this.year, isAuthor: authorId === human, votes: holdsSeat };
    return { g: a.g, yes: a.yes };
  }

  private omnibillInteractive(human: number, a: { g?: number; yes?: boolean }): void {
    this.omnibill(human, a.g, a.yes);
  }

  private *electionsInteractive(human: number): Generator<UiRequest, void, UiAnswer> {
    // Collect every declaration first, so the human can see the pegs go down.
    const wave = new Wave(this.rng);
    const open = this.openRaces();
    const decls: Declaration[] = [];
    const pending: PendingPeg[] = [];
    const order = this.players.map((_, i) => (i + (this.year / 2)) % this.players.length);
    for (const i of order) {
      const mine = i === human ? this.humanDeclarations : this.agents[i].declare(this.view(i), open, pending);
      this.stats.decisions.push(mine.length);
      for (const d of mine) {
        const p = this.players[i];
        if (!p.hand.some((c) => c.kind === 'candidate' && c.id === d.card.id)) continue;
        if (d.office !== 'president' && !eligible(d.card, d.state, p.districts)) continue;
        decls.push({ ...d, player: i });
        pending.push({ player: i, office: d.office, state: d.state, slot: d.slot, party: d.card.party });
      }
    }

    // The withdrawal window, before any die is drawn.
    this.humanWithdrawals.clear();
    const mineContested = decls.filter((d) => d.player === human)
      .map((d) => ({ d, others: decls.filter((o) => o !== d && sameRace(o, d)) }))
      .filter((x) => x.others.length > 0);
    for (const { d, others } of mineContested) {
      const ctx = this.raceContext(d.office, d.state, d.slot);
      const round = others.some((o) => o.card.party === d.card.party) ? 'primary' : 'general';
      const mods = buildModifiers(d, ctx, round, this.cfg.resolution, this.cfg.national, this.cfg.primaryGeneral);
      const a = yield {
        kind: 'withdraw', year: this.year, round,
        view: withdrawalView(d, mods, round, ctx, others),
        race: { office: d.office, state: d.state, slot: d.slot, cardName: d.card.name },
      };
      this.humanWithdrawals.set(raceKeyOf(d) + '|' + d.card.id, !!a.withdraw);
    }

    this.resolveDeclared(decls, wave, human);
  }

  /** §6: refill is a rotating draw-and-pass, not a fixed sweep. Refilling in
   *  seat order hands the low seats every card when the talon is short, which
   *  showed up as a persistent ~7% scoring advantage for seat 0 and a 22pp
   *  win-share gap -- entirely an artefact of the loop order, not the design.
   *
   *  §5: "presence is scarce and must be purchased in the draft", so hand size
   *  caps TOTAL cards held; a district you keep is a candidate you do not. */
  private refill(): void {
    const start = (this.year / 2) % this.players.length;
    for (let k = 0; k < this.players.length; k++) {
      const p = this.players[(start + k) % this.players.length];
      const want = this.handSize(p) - p.hand.length - p.districts.length;
      if (want > 0) this.draw(p, want);
    }
  }

  /** One annual tick — §7. */
  tick(): void {
    for (const p of this.players) p.tapped.clear();      // 1. action phase
    this.omnibill();                                     // 2-3. bill and reaction
    const fed = econ.fedCheck(this.economy, this.cfg.economy, this.rng);  // 4.
    if (fed.rateRise) this.stats.rateRises++;
    econ.walk(this.economy, this.cfg.economy, this.rng);
    lean.decay(this.leanMap, this.cfg.lean, this.year);  // 5.

    if (this.year % 2 === 0) {
      this.elections();                                  // 6-9.
      this.refill();
    }
    this.scoreHistory.push(this.players.map((p) => p.score));
    this.year++;
  }

  run(): GameResult {
    const end = this.cfg.game.startYear + this.cfg.game.maxYears;
    while (this.year < end) {
      this.tick();
      if (this.cfg.game.deckOutEnds && !this.talon.length && !this.discard.length && !this.eraQueue.length) break;
    }
    return this.result();
  }

  private result(): GameResult {
    const scores = this.players.map((p) => p.score);
    // Ties on final score are common between equally-skilled players, and
    // `indexOf` would hand every one of them to the lowest seat -- which reads
    // as a 25pp seat bias that is not in the game at all. The design does not
    // say how a tie resolves (§14's victory condition is still open), so the
    // placeholder is a coin flip, which at least measures nothing that is not
    // there.
    const best = Math.max(...scores);
    const tied = scores.map((s2, i) => ({ s2, i })).filter((x) => x.s2 === best);
    const winner = tied[this.rng.int(tied.length)].i;
    let leadChanges = 0, prev = -1, determination = 0;
    this.scoreHistory.forEach((row, i) => {
      const lead = row.indexOf(Math.max(...row));
      if (prev !== -1 && lead !== prev) leadChanges++;
      if (lead !== winner) determination = i + 1;
      prev = lead;
    });
    const seatsByOffice = { president: 0, senator: 0, governor: 0, representative: 0 } as Record<Office, number>;
    for (const s of this.seats) if (s.holder) seatsByOffice[s.office]++;
    const uncontested = this.events.filter((e) => e.uncontested).length;
    return {
      seed: 0, config: this.cfg.name, years: this.year - this.cfg.game.startYear,
      scores, winner, leadChanges,
      determinationYear: determination,
      events: this.events,
      billsPassed: this.stats.billsPassed, billsAttempted: this.stats.billsAttempted,
      crossBenchVotes: this.stats.crossBench, impeachments: this.stats.impeachments,
      rateRises: this.stats.rateRises, finalLean: this.leanMap,
      uncontestedShare: this.events.length ? uncontested / this.events.length : 0,
      contestedSlotShare: this.stats.raceSlots ? this.stats.contestedSlots / this.stats.raceSlots : 0,
      decisionCounts: this.stats.decisions, seatsByOffice,
    };
  }
}

function clampInt(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, Math.round(v))); }
export { STATES, BY_CODE, electors, type StateDef };
