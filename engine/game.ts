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
import { STATES, BY_CODE, senateUp, governorUp, electors, DC_ELECTORS, type StateDef } from './states.ts';

export interface Config {
  name: string;
  hand: { base: number; bonusPresident: number; bonusSenator: number; bonusGovernor: number; bonusRepresentative: number };
  resolution: { incumbency: number; identityBonus: number; tieBreak: string };
  national: { strongEconomy: number; recession: number; midtermPenalty: number; coattailsWith: number; coattailsAgainst: number };
  endorsements: { president: number; governorInState: number; senator: number };
  primaryGeneral: { extremistPrimary: number; extremistGeneral: number; heterodoxPrimaryPenalty: number; crossBenchPrimaryPenalty: number; billCounterPips: number; crossBenchGeneral: number };
  lean: lean.LeanConfig;
  economy: econ.EconomyConfig;
  legislature: leg.LegislatureConfig & {
    /** §7 runs the omnibill every year. 'biennial' runs it only in election
     *  years, which empties the odd year and effectively makes the game a
     *  two-year cycle. */
    billFrequency?: 'annual' | 'biennial';
  };
  draft: { packSize: number; districtsPerPack: number; refillToHandSize: boolean };
  game: { startYear: number; maxYears: number; victory: string; deckOutEnds: boolean; billTarget?: number;
          /** diagnostic only: §16 names hand size, endorsements and capture as
           *  the three stacking feedback loops. Hand size is cleared (F18);
           *  this switches the other two off so each can be isolated. Not a
           *  rules option -- both default on. */
          captureEnabled?: boolean;
          /** §7 puts every election in an even year, but §2 asks the board to
           *  carry a real per-state gubernatorial table -- and KY, LA, MS, NJ
           *  and VA elect in odd years. As written those races are computed and
           *  never run: 1,039 governor races resolved in even years and 0 in
           *  odd. Enabling this runs them, which also opens a strategic line
           *  §11 implies but §7 forecloses: win a governorship in a year with
           *  no other race competing for your declarations, then carry
           *  incumbency upward into the next even-year Senate run. */
          oddYearGovernors?: boolean };
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
  /** §12: impeachment replaces the omnibill for the year, so wanting it is a
   *  decision taken instead of legislating, not alongside it. */
  moveImpeach?(v: GameView): boolean;
  voteImpeach?(v: GameView, seat: Seat): boolean;
  /** §6: "Standard pack-pass draft: take one, pass the rest." Given a pack,
   *  return the card to take. Omit for the default heuristic. */
  draftPick?(v: GameView, pack: Card[]): Card | undefined;
  /** §11: the VP's real function is as a bargaining chip during the
   *  nomination. Any player may offer a card to any ticket. */
  offerVP?(v: GameView, nominee: { player: number; party: Party }): CandidateCard | undefined;
  pickVP?(v: GameView, offers: VPOffer[]): VPOffer | undefined;
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

export interface VPOffer { from: number; card: CandidateCard }
/** §11: a second card on the ticket. It does not score and is not consumed on
 *  a loss. `from` is who supplied it -- on succession THAT player scores, which
 *  is the whole of the VP backstab. */
export interface VicePresident { cardId: string; card: CandidateCard; from: number }

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
  /** score by player, one row per year -- the runaway metrics in SIM-BRIEF §2
   *  are cross-game curves over this, not per-game summaries. */
  scoreHistory: number[][];
  seatsByOffice: Record<Office, number>;
}

export class Game {
  cfg: Config; rng: RNG; players: PlayerState[]; seats: Seat[] = [];
  leanMap: lean.Lean = {}; economy: econ.Economy;
  year: number; talon: Card[] = []; discard: Card[] = []; eraQueue: Card[][] = [];
  president?: { player: number; cardId: string; party: Party; since: number };
  vicePresident?: VicePresident;
  /** §12: impeached presidents leave the game entirely -- the only permanent removal. */
  expelled = new Set<string>();
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

  /** Every candidate by id, so a seated member can be handed back to their
   *  player when the term runs out. Seats store a cardId, not the card. */
  private cardById = new Map<string, CandidateCard>();

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
    for (const c of cards) if (c.kind === 'candidate') this.cardById.set(c.id, c);
    this.draft();
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

  /** §6's draft: packs are dealt, each player takes one card and passes the
   *  rest, and the pass repeats until the packs are exhausted. Repeat until
   *  hands are full.
   *
   *  This replaces a random deal, and the difference is not cosmetic: dealing
   *  at random made the opening hand predict the winner at twice chance (F21),
   *  because nobody could correct a bad opening. A draft is exactly the
   *  mechanism that lets them. */
  private draft(): void {
    const size = this.cfg.draft.packSize;
    let guard = 0;
    while (this.players.some((p) => this.held(p) < this.handSize(p)) && guard++ < 40) {
      const packs: Card[][] = [];
      for (let i = 0; i < this.players.length; i++) {
        const pack: Card[] = [];
        for (let k = 0; k < size; k++) {
          const c = this.nextCard();
          if (!c) break;
          pack.push(c);
        }
        packs.push(pack);
      }
      if (packs.every((pk) => !pk.length)) return;      // pool exhausted

      while (packs.some((pk) => pk.length)) {
        const taken: (Card | undefined)[] = [];
        for (let i = 0; i < this.players.length; i++) {
          const pack = packs[i];
          if (!pack.length) { taken.push(undefined); continue; }
          const p = this.players[i];
          const want = this.held(p) < this.handSize(p);
          const pick = want
            ? (this.agents[i].draftPick?.(this.view(i), pack) ?? defaultPick(pack, p))
            : pack[0];
          const idx = pack.findIndex((c) => c === pick);
          taken.push(pack.splice(idx >= 0 ? idx : 0, 1)[0]);
        }
        taken.forEach((c, i) => {
          if (!c) return;
          const p = this.players[i];
          if (this.held(p) >= this.handSize(p)) { this.discard.push(c); return; }
          if (c.kind === 'district') p.districts.push(c); else p.hand.push(c);
        });
        // pass the remainder around the table
        packs.unshift(packs.pop()!);
      }
    }
  }

  /** Pull one card from the talon, advancing eras and reshuffling as §14 says. */
  private nextCard(): Card | undefined {
    if (!this.talon.length) {
      if (this.eraQueue.length) this.talon = this.eraQueue.shift()!;
      else if (this.discard.length) { this.talon = this.rng.shuffle(this.discard); this.discard = []; }
      else return undefined;
    }
    return this.talon.pop();
  }

  /** total cards held: candidates in hand plus districts in play */
  held(p: PlayerState): number { return p.hand.length + p.districts.length; }

  /** §11: seats are held for their real terms, and then the member may run
   *  again. Winning removed the card from hand and nothing put it back, so no
   *  politician had ever stood for re-election and the +1 incumbency modifier
   *  fired in exactly zero races -- which silently voided §16's "incumbency is
   *  a calibration check on +1". A member whose term is up returns to their
   *  player's hand and may be re-declared into the same seat, or run elsewhere. */
  private releaseExpiringTerms(open: OpenRace[]): void {
    for (const r of open) {
      const seat = this.seatFor(r.office, r.state, r.slot);
      if (!seat || !seat.holder) continue;
      const card = this.cardById.get(seat.holder.cardId);
      if (!card) continue;
      const p = this.players[seat.holder.player];
      if (!p.hand.some((c) => c.kind === 'candidate' && c.id === card.id)) {
        p.hand.push({ kind: 'candidate', ...card });
      }
    }
  }

  private openRaces(): OpenRace[] {
    const out: OpenRace[] = [];
    const y = this.year;
    // An odd year carries governorships and nothing else -- no Senate class is
    // up, no House term expires, and there is no presidential year.
    if (y % 2 !== 0) {
      for (const s of STATES) {
        if (governorUp(s, y)) out.push({ office: 'governor', state: s.code, incumbent: this.seatFor('governor', s.code) });
      }
      return out;
    }
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
    // ORDER MATTERS, and must not follow seat order. Agents sort options by
    // edge, Array.prototype.sort is stable, and ties therefore resolve to
    // whatever came first -- which was every district held by player 0. Their
    // seats drew the most declarations, so they lost them to capture most
    // often, and since districts are ballast (F21) being stripped was an
    // ADVANTAGE: seat 0 won 32% of five-player games against a 20% share.
    // Sorting by state and number makes the board's order a property of the
    // board rather than of the table.
    const houses = [...inPlay.values()].sort((a, b) =>
      a.state === b.state ? a.number - b.number : a.state.localeCompare(b.state));
    for (const d of houses) {
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

  /** §12: "Impeachment replaces the omnibill for that year. The same coalition
   *  capable of passing a bill can remove a president, but doing so costs the
   *  year's scoring." Two-thirds of the Senate. An impeached president leaves
   *  the game entirely -- not to the discard, out.
   *
   *  Returns true when the year's legislating was spent on this instead. */
  private impeachment(): boolean {
    const pres = this.president;
    if (!pres) return false;
    const movers = this.players.filter((_, i) => this.agents[i].moveImpeach?.(this.view(i)));
    if (!movers.length) return false;

    let yes = 0;
    const senate = this.seats.filter((s) => s.office === 'senator' && s.holder);
    for (const s of senate) {
      if (this.agents[s.holder!.player].voteImpeach?.(this.view(s.holder!.player), s)) yes++;
    }
    if (!leg.impeach(this.cfg.legislature, this.seats, yes)) {
      this.log.push(`${this.year}: impeachment fails, ${yes} of ${senate.length} in the Senate`);
      return true;                            // the year's slot is spent either way
    }

    this.stats.impeachments++;
    this.expelled.add(pres.cardId);
    const seat = this.seats.find((s) => s.office === 'president');
    const removedParty = pres.party;
    this.log.push(`${this.year}: the president is removed, ${yes} of ${senate.length}`);

    // §11: the VP succeeds, and the VP's ORIGINAL player scores -- which is
    // the entire point of putting your card on a rival's ticket.
    const vp = this.vicePresident;
    if (vp) {
      const holder = { cardId: vp.cardId, player: vp.from, party: vp.card.party, since: this.year };
      if (seat) seat.holder = holder;
      this.president = { ...holder };
      this.players[vp.from].score += 5;
      this.vicePresident = undefined;
      this.log.push(`${this.year}: ${vp.card.name} succeeds to the presidency`);
    } else {
      if (seat) seat.holder = undefined;
      this.president = undefined;
    }

    // §12: the pain goes to the party. The coalition that installed him is hit,
    // which is the brake the design bets on against the backstab.
    for (const s of this.seats) {
      if (s.holder?.party === removedParty) this.players[s.holder.player].score -= 1;
    }
    return true;
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
      votes.push({ player: s.holder.player, party: s.holder.party, office: s.office, yes, cardId: s.holder.cardId });
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
    // §12: "Voting places a counter on the card, coloured by the party in
    // power. Cross-bench votes therefore show as the opposite colour ... the
    // card's accumulated counters are simply read off at resolution."
    // Nothing recorded these, so the bill's electoral consequence never
    // reached a candidate and the cross-bench penalty never fired once.
    const majH = leg.majorityParty(this.seats, 'representative');
    const majS = leg.majorityParty(this.seats, 'senator');
    for (const v of votes) {
      const cardId = v.cardId;
      const rec = this.billCounters.get(cardId) ?? { record: 0, counters: {} };
      const maj = v.office === 'representative' ? majH : majS;
      // §12: "Voting places a counter on the card, coloured by the party in
      // power. Cross-bench votes therefore show as the opposite colour." The
      // colour was dropped and the count flattened to a boolean, so the
      // direction of a defection was unrecoverable and a serial cross-bencher
      // paid exactly what a one-time defector paid.
      if (v.yes && maj) rec.counters[maj] = (rec.counters[maj] ?? 0) + 1;
      // Only PASSAGE carries a consequence: §12 says a symbolic vote on a
      // failed bill earns heterodoxy credit but no points.
      if (v.yes && out.passed) rec.record += out.reactionGood ? 1 : -1;
      this.billCounters.set(cardId, rec);
    }

    if (out.passed) {
      this.stats.billsPassed++;
      this.billsBy[authorId] = (this.billsBy[authorId] ?? 0) + 1;
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
    this.releaseExpiringTerms(open);
    const decls: Declaration[] = [];
    const pending: PendingPeg[] = [];
    // §8: sequential around the table, and the order rotates each cycle so
    // going last is not a permanent tax.
    // Math.floor matters: in an ODD year `year / 2` is fractional, so the
    // rotation produced a fractional agent index and crashed the moment
    // odd-year governor races were allowed to run.
    const order = this.players.map((_, i) => (i + Math.floor(this.year / 2)) % this.players.length);
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

  /** §9: "Endorsement is a tap. A card taps to endorse and untaps at cycle
   *  start. Incumbents may endorse and run in the same cycle." A president
   *  endorses anywhere for +3; a governor endorses in their own state for +2.
   *  Endorsements are primary-only -- the general effect is coattails, already
   *  modelled, and a general endorsement would double-count.
   *
   *  The +3 is the single largest modifier in the game and had never been
   *  spent, because nothing ever assigned one. Each endorser backs the
   *  player's most contested primary, which is where an endorsement is worth
   *  having. */
  private assignEndorsements(decls: Declaration[]): void {
    const contenders = (d: Declaration) =>
      decls.filter((o) => o !== d && o.office === d.office && o.state === d.state
        && o.slot === d.slot && o.card.party === d.card.party).length;

    for (const p of this.players) {
      const endorsers: { pips: number; state?: string; cardId: string }[] = [];
      for (const seat of this.seats) {
        if (seat.holder?.player !== p.id) continue;
        if (p.tapped.has(seat.holder.cardId)) continue;
        if (seat.office === 'president') {
          endorsers.push({ pips: this.cfg.endorsements.president, cardId: seat.holder.cardId });
        } else if (seat.office === 'governor') {
          endorsers.push({ pips: this.cfg.endorsements.governorInState, state: seat.state, cardId: seat.holder.cardId });
        } else if (seat.office === 'senator') {
          // §9: "Senators do not endorse as a class, because most senators move
          // nothing. The exceptions are ideological validators with national
          // followings ... and those get printed text." That printed text is
          // the may_endorse effect, which no card carried and nothing read.
          const card = this.cardById.get(seat.holder.cardId);
          const e = card?.effects.find((x) => x.type === 'may_endorse');
          if (e) endorsers.push({ pips: e.pips ?? this.cfg.endorsements.senator, cardId: seat.holder.cardId });
        }
      }
      if (!endorsers.length) continue;
      const mine = decls.filter((d) => d.player === p.id)
        .sort((a, b) => contenders(b) - contenders(a));
      for (const e of endorsers) {
        const target = mine.find((d) => !d.endorsements && contenders(d) > 0
          && (!e.state || d.state === e.state));
        if (!target) continue;
        target.endorsements = (target.endorsements ?? 0) + e.pips;
        p.tapped.add(e.cardId);
      }
    }
  }

  /** Everything after declaration: primaries, generals, seating, capture and
   *  the lean pushes. Shared by the headless tick and the interactive one so
   *  the rules exist exactly once. */
  private resolveDeclared(decls: Declaration[], wave: Wave, human: number): void {
    this.assignEndorsements(decls);
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

      for (const d of group) this.readCounters(d);
      const nominees = this.runPrimaries(group, ctx, wave, human);
      if (!nominees.length) continue;
      // §11: "Governors ... carry incumbency into Senate and presidential
      // runs." Incumbency was granted only for holding THIS seat, so a sitting
      // governor stepping up ran as a challenger -- one of the four things the
      // office is supposed to be worth, unimplemented. Same shape as the
      // district clause that killed the presidency (F10).
      for (const d of nominees) {
        this.readCounters(d);
        const holdsThis = !!incumbent && incumbent.holder!.cardId === d.card.id;
        const isGovernor = (office === 'senator' || office === 'president')
          && this.seats.some((st) => st.office === 'governor' && st.holder?.cardId === d.card.id);
        d.incumbent = holdsThis || isGovernor;
      }

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
      if (office === 'representative' && this.cfg.game.captureEnabled !== false) this.capture(won, state, slot);
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

    // §11: the ticket is chosen before the general. Any player may offer a
    // card; the nominee decides. A card placed here is not consumed on a loss.
    const tickets = new Map<number, VicePresident>();
    for (const nom of nominees) {
      const offers: VPOffer[] = [];
      for (let i = 0; i < this.players.length; i++) {
        const card = this.agents[i].offerVP?.(this.view(i), { player: nom.player, party: nom.card.party });
        if (card && this.players[i].hand.some((c) => c.kind === 'candidate' && c.id === card.id)) {
          offers.push({ from: i, card });
        }
      }
      if (!offers.length) continue;
      const chosen = this.agents[nom.player].pickVP?.(this.view(nom.player), offers) ?? offers[0];
      tickets.set(nom.player, { cardId: chosen.card.id, card: chosen.card, from: chosen.from });
      const supplier = this.players[chosen.from];
      supplier.hand = supplier.hand.filter((c) => !(c.kind === 'candidate' && c.id === chosen.card.id));
    }

    const tally = new Map<number, number>();
    const carried = new Map<Party, string[]>();
    for (const st of STATES) {
      const ctx = this.raceContext('president', st.code, undefined);
      // §5: "A district card boosts House, Senate, governor, and presidential
      // runs in its state. It is an investment in a state, not just a seat."
      // The presidential general runs state by state, so each nominee reads
      // their own district for THIS state -- without which presence buys
      // nothing at the top of the ticket and no agent ever wants the office.
      const local = nominees.map((d) => {
        const vp = tickets.get(d.player);
        // §11: the VP "adds a home-state bonus in the general".
        const vpBonus = vp && vp.card.homeState === st.code
          ? [{ type: 'conditional' as const, pips: vp.card.homeStateBonus, note: `VP ${vp.card.name}` }]
          : [];
        return {
          ...d,
          card: vpBonus.length ? { ...d.card, effects: [...d.card.effects, ...vpBonus] } : d.card,
          district: this.players[d.player].districts.find((x) => x.state === st.code),
        };
      });
      const out = runRace({
        ctx, round: 'general', declarations: local, wave, rng: this.rng,
        res: this.cfg.resolution, nat: this.cfg.national, pg: this.cfg.primaryGeneral,
        decide: () => false,   // the ticket is committed; you cannot withdraw a state at a time
      });
      if (!out.event) continue;
      this.events.push(out.event);
      const won = nominees.find((d) => d.player === out.event!.winner)!;
      tally.set(won.player, (tally.get(won.player) ?? 0) + electors(st, this.year));
      // DC has no seats and never appears in STATES, but its three electors are
      // in the 538 total. Award them with Maryland, which is where they were
      // measured against before the 23rd Amendment and is close enough for a
      // board that prints no District of Columbia.
      if (st.code === 'MD') tally.set(won.player, (tally.get(won.player) ?? 0) + DC_ELECTORS);
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
    // §14's term counters, for the two- and three-term conditions.
    this.termsBy[best] = (this.termsBy[best] ?? 0) + 1;
    for (const p of this.players) {
      this.consecutiveBy[p.id] = p.id === best ? (this.consecutiveBy[p.id] ?? 0) + 1 : 0;
    }
    this.log.push(`${this.year}: ${winner.card.name} (${winner.card.party}) wins with ${bestEV} electoral votes`);

    // §10: the honeymoon. One counter in every state carried, removed at the
    // next decay -- so the incoming party enters the midterm with a fleeting
    // map advantage immediately before the -2 lands on them.
    lean.honeymoon(this.leanMap, this.cfg.lean, carried.get(winner.card.party) ?? [], winner.card.party);
    this.vicePresident = tickets.get(best);
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
      byState.get(st)!.push({ office: r.ev.office, party: r.won.card.party,
        margin: r.ev.uncontested ? (this.cfg.lean.uncontestedPush ?? 0) * 2 : r.ev.margin });
    }
    for (const [st, races] of byState) {
      const top = lean.nationalizedRace(races, this.cfg.lean.priority);
      if (!top) continue;
      lean.applyPush(this.leanMap, this.cfg.lean, st, top.party, top.office, top.margin);
    }
  }

  /** §11: "Governors appoint Senate vacancies, placing a card from hand with
   *  no election." A vacancy arises here the way it does in life: a sitting
   *  senator wins a different office and leaves the seat behind. The governor
   *  of that state fills it, which is the only route to a seat that never
   *  faces the voters. */
  private fillVacancy(state: string, slot: number | undefined): void {
    const gov = this.seats.find((s) => s.office === 'governor' && s.state === state && s.holder);
    if (!gov) return;
    const p = this.players[gov.holder!.player];
    const pick = p.hand.find((c) => c.kind === 'candidate') as (CandidateCard & { kind: 'candidate' }) | undefined;
    if (!pick) return;
    const seat = this.seats.find((s) => s.office === 'senator' && s.state === state && s.slot === slot);
    if (!seat) return;
    seat.holder = { cardId: pick.id, player: gov.holder!.player, party: pick.party, since: this.year };
    p.hand = p.hand.filter((c) => !(c.kind === 'candidate' && c.id === pick.id));
    p.score += 3;
    this.log.push(`${this.year}: the governor of ${state} appoints ${pick.name} to the Senate`);
  }

  private seat(office: Office, state: string, slot: number | undefined, d: Declaration): void {
    const existing = this.seats.find((s) => s.office === office && s.state === state && s.slot === slot);
    const holder = { cardId: d.card.id, player: d.player, party: d.card.party, since: this.year };
    if (existing) existing.holder = holder;
    else this.seats.push({ office, state, slot, senateClass: office === 'senator' ? (slot as 1 | 2 | 3) : undefined, holder });
    if (office === 'president') this.president = { ...holder };

    // A sitting senator who wins something else leaves a vacancy behind.
    const vacated = this.seats.find((s) => s.office === 'senator' && s.holder?.cardId === d.card.id
      && !(s.state === state && s.slot === slot));
    if (vacated) {
      const vs = vacated.state, vslot = vacated.slot;
      vacated.holder = undefined;
      this.fillVacancy(vs, vslot);
    }

    const p = this.players[d.player];
    p.hand = p.hand.filter((c) => !(c.kind === 'candidate' && c.id === d.card.id));
    p.score += office === 'president' ? 5 : office === 'senator' ? 3 : office === 'governor' ? 2 : 1;
  }

  /** §15: "Winning a seat transfers the district card to the winner." THE
   *  district — the one the race was fought over, identified by its number —
   *  not merely some card the winner's opponent happens to hold in that state.
   *
   *  Taking an arbitrary district from the first opponent in seat order was a
   *  real bias and not a cosmetic one. It robbed low seats systematically, and
   *  because districts are ballast rather than presence (F21 — hand size caps
   *  total cards, so every district crowds out a candidate), being robbed was
   *  an ADVANTAGE. Seat 0 scored 164 against seat 4's 143 and won 32% of
   *  five-player games against a 20% share, entirely from this. */
  private capture(won: Declaration, state: string, slot: number | undefined): void {
    if (slot === undefined) return;
    for (const p of this.players) {
      if (p.id === won.player) continue;
      const i = p.districts.findIndex((d) => d.state === state && d.number === slot);
      if (i >= 0) { this.players[won.player].districts.push(p.districts.splice(i, 1)[0]); return; }
    }
  }

  private returnToHand(d: Declaration): void {
    if (this.expelled.has(d.card.id)) return;      // §12: out, not discarded
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
    if (!this.impeachment()) this.omnibillInteractive(human, yield* this.askBill(human));
    const fed = econ.fedCheck(this.economy, this.cfg.economy, this.rng);
    if (fed.rateRise) { this.stats.rateRises++; this.log.push(`${this.year}: the Fed tightens`); }
    econ.walk(this.economy, this.cfg.economy, this.rng);
    lean.decay(this.leanMap, this.cfg.lean, this.year, this.rng);

    if (this.year % 2 === 0) {
      const open = this.openRaces();
      this.releaseExpiringTerms(open);
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
    // Math.floor matters: in an ODD year `year / 2` is fractional, so the
    // rotation produced a fractional agent index and crashed the moment
    // odd-year governor races were allowed to run.
    const order = this.players.map((_, i) => (i + Math.floor(this.year / 2)) % this.players.length);
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
    const start = Math.floor(this.year / 2) % this.players.length;
    for (let k = 0; k < this.players.length; k++) {
      const p = this.players[(start + k) % this.players.length];
      const want = this.handSize(p) - p.hand.length - p.districts.length;
      if (want > 0) this.draw(p, want);
    }
  }

  /** §14's victory conditions, which the doc lists as "under test" and §16
   *  leaves open. None were implemented, and the deck-out ending it names as
   *  the backstop is unreachable: §14 also has defeated politicians circulate
   *  back through the draft, and circulation wins -- cards in the talon and
   *  discard GROW from 79 to 273 over a hundred years, because the discard
   *  fills faster than hands and seats absorb. Without a real condition the
   *  game does not end at all.
   *
   *  Returns the winning player, or undefined to keep playing. */
  private victor(): number | undefined {
    const v = this.cfg.game.victory;
    if (v === 'bills' || v === 'parallel') {
      const target = this.cfg.game.billTarget ?? 8;
      for (const p of this.players) if (this.billsBy[p.id] >= target) return p.id;
    }
    if (v === 'two-terms' || v === 'three-terms' || v === 'parallel') {
      const need = v === 'three-terms' ? 3 : 2;
      for (const p of this.players) {
        if (v === 'three-terms' ? this.termsBy[p.id] >= need : this.consecutiveBy[p.id] >= need) return p.id;
      }
    }
    return undefined;
  }

  /** §12: "the card's accumulated counters are simply read off at
   *  resolution." Counters carry the colour of the party that was in power
   *  when the vote was cast, so a card's cross-bench counters are the ones
   *  whose colour is not its own party -- and which party they DO carry is
   *  the direction of the defection. */
  private readCounters(d: Declaration): void {
    const rec = this.billCounters.get(d.card.id);
    d.billRecord = rec?.record ?? 0;
    let cross = 0, toward: Party | undefined, most = 0;
    for (const [colour, n] of Object.entries(rec?.counters ?? {}) as [Party, number][]) {
      if (colour === d.card.party) continue;
      cross += n;
      if (n > most) { most = n; toward = colour; }
    }
    d.crossBench = cross;
    d.crossBenchToward = toward;
  }

  /** §12's card counters, by card id. */
  private billCounters = new Map<string, { record: number; counters: Partial<Record<Party, number>> }>();
  private billsBy: Record<number, number> = {};
  private termsBy: Record<number, number> = {};
  private consecutiveBy: Record<number, number> = {};

  /** One annual tick — §7. */
  tick(): void {
    for (const p of this.players) p.tapped.clear();      // 1. action phase
    const billYear = this.cfg.legislature.billFrequency !== 'biennial' || this.year % 2 === 0;
    if (billYear && !this.impeachment()) this.omnibill();   // 2-3. bill, or a removal instead
    const fed = econ.fedCheck(this.economy, this.cfg.economy, this.rng);  // 4.
    // Logged in BOTH paths. The interactive tick logged this and the headless
    // one did not, so a coverage sweep that reads the log reported the Fed as
    // a dead rule when it fires in 44% of games.
    if (fed.rateRise) { this.stats.rateRises++; this.log.push(`${this.year}: the Fed tightens`); }
    econ.walk(this.economy, this.cfg.economy, this.rng);
    lean.decay(this.leanMap, this.cfg.lean, this.year, this.rng);  // 5.

    const oddGovYear = this.cfg.game.oddYearGovernors === true && this.year % 2 !== 0
      && STATES.some((st) => governorUp(st, this.year));
    if (this.year % 2 === 0 || oddGovYear) {
      this.elections();                                  // 6-9.
      this.refill();
    }
    this.scoreHistory.push(this.players.map((p) => p.score));
    this.year++;
  }

  /** Set when a §14 victory condition fires, so the result can say which. */
  wonBy?: number;

  run(): GameResult {
    const end = this.cfg.game.startYear + this.cfg.game.maxYears;
    while (this.year < end) {
      this.tick();
      const v = this.victor();
      if (v !== undefined) { this.wonBy = v; break; }
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
    const winner = this.wonBy ?? tied[this.rng.int(tied.length)].i;
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
      scoreHistory: this.scoreHistory,
    };
  }
}

function clampInt(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, Math.round(v))); }

/** The default draft heuristic. Candidates are valued by home-state bonus and
 *  card text; districts only while a player is thin on presence, because
 *  holding many is measurably a liability (F21) -- hand size caps total cards,
 *  so every district crowds out someone to run. */
function defaultPick(pack: Card[], p: PlayerState): Card {
  const states = new Set(p.districts.map((d) => d.state));
  const value = (c: Card): number => {
    if (c.kind === 'district') {
      const need = Math.max(0, 4 - states.size);
      return (states.has(c.state) ? 0.5 : 1) * (need > 0 ? 2 + c.synergy : c.synergy - 2);
    }
    return 2 + c.homeStateBonus + c.effects.length;
  };
  return pack.reduce((best, c) => (value(c) > value(best) ? c : best), pack[0]);
}
export { STATES, BY_CODE, electors, type StateDef };
