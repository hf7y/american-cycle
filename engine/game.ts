/** The game — the annual tick, wired to the rule modules.
 *
 *  Players are not parties. A player is a faction holding cards of both
 *  parties -- a skilled player runs one party hot and pivots to the other
 *  in the recession year -- so score is per player and party is per card.
 *
 *  The board starts empty and fills as seats are won. Chamber majorities are
 *  computed over HELD seats only, which is what makes a legislature possible
 *  at all when a table of four holds thirty seats between them.
 */
import type {
  Amendment, CandidateCard, Card, DistrictCard, EnactedBill, IdentityTag,
  Office, Party, RaceEvent, Seat,
} from './types/index.ts';
import { RNG } from './rules/rng.ts';
import { Wave } from './rules/resolution.ts';
import * as lean from './rules/lean.ts';
import * as econ from './rules/economy.ts';
import * as leg from './rules/legislature.ts';
import * as amend from './rules/amendment.ts';
import * as tags from './rules/tags.ts';
import { boardScores, type BoardView, type ScoringConfig } from './rules/scoring.ts';
import {
  buildModifiers, eligible, homeDistrict, runRace, withdrawalView,
  type Declaration, type RaceContext, type WithdrawalView,
} from './rules/elections.ts';
import { STATES, BY_CODE, senateUp, governorUp, electors, DC_ELECTORS, type StateDef } from './states.ts';

export interface Config {
  name: string;
  hand: { base: number; bonusPresident: number; bonusSenator: number; bonusGovernor: number; bonusRepresentative: number };
  resolution: { incumbency: number; identityBonus: number; incumbencyPrimary: number; crossOfficeIncumbency: number; tieBreak: string;
                incumbencyHouse?: number; incumbencySenate?: number };
  national: { strongEconomy: number; recession: number; midtermPenalty: number; coattailsWith: number; coattailsAgainst: number };
  endorsements: { president: number; governorInState: number; senator: number };
  primaryGeneral: { extremistPrimary: number; extremistGeneral: number; crossBenchPrimaryPenalty: number; billCounterPips: number; crossBenchCap: number;
                    bruisingPrimaryMargin?: number };
  lean: lean.LeanConfig;
  economy: econ.EconomyConfig;
  legislature: leg.LegislatureConfig & {
    /** The omnibill runs every year by default. 'biennial' runs it only in
     *  election years, which empties the odd year and effectively makes the
     *  game a two-year cycle. See `isBillYear` and
     *  findings/odd-year-is-the-bill.ts. */
    billFrequency?: 'annual' | 'biennial';
  };
  draft: { packSize: number; districtsPerPack: number; refillToHandSize: boolean };
  /** v0.2 item 1. There is no running tally to configure: these are the
   *  weights the EPILOGUE reads off the board. */
  scoring: ScoringConfig;
  amendment: amend.AmendmentConfig;
  game: { startYear: number; maxYears: number; victory: Victory; deckOutEnds: boolean; billTarget?: number;
          /** diagnostic only: hand size, endorsements and capture are the
           *  three stacking feedback loops. Hand size is cleared;
           *  this switches the other two off so each can be isolated. Not a
           *  rules option -- both default on. */
          captureEnabled?: boolean;
          /** Elections default to every even year, but the board carries a
           *  real per-state gubernatorial table -- and KY, LA, MS, NJ and VA
           *  elect in odd years. Off by default those races are computed and
           *  never run: 1,039 governor races resolved in even years and 0 in
           *  odd. Enabling this runs them, which also opens a strategic line:
           *  win a governorship in a year with no other race competing for
           *  your declarations, then carry incumbency upward into the next
           *  even-year Senate run. See findings/odd-year-is-the-bill.ts. */
          oddYearGovernors?: boolean;
          /** may an office-holder stand for a different seat mid-term, vacating
           *  the one it holds the moment it declares? */
          resignToRun?: boolean };
}

export interface PlayerState {
  id: number;
  name: string;
  hand: Card[];
  districts: DistrictCard[];
  score: number;
  /** cards tapped to endorse this cycle; untap at cycle start */
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
  /** v0.2 item 2: the corpus. Repealed bills stay in the list with
   *  `repealedIn` set, because "what did you undo" is a decision input. */
  bills: readonly EnactedBill[];
  amendments: readonly Amendment[];
}

export interface Agent {
  name: string;
  /** Which races to enter. Declaration is sequential around the table, so
   *  `pending` carries the pegs already on the board -- visible as contested
   *  races, with the cards still face down. Counter-declaring is the
   *  counterplay to spreading thin. */
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[];
  /** Decided on incomplete information, by construction -- see
   *  engine/rules/elections.test.ts ("the withdrawal window closes before
   *  any die is rolled"). */
  withdraw(v: WithdrawalView): boolean;
  /** hf7y/american-cycle#96: Lieberman 2006 -- a card that is about to lose
   *  its own party's primary may commit, now, to run as an independent in
   *  the SAME race if it does. Decided on the same incomplete information as
   *  `withdraw` (no dice drawn, no primary result known yet), which is why it
   *  shares `WithdrawalView` rather than a result the card cannot see yet.
   *  Omit for the default: never take it. */
  declareIndependent?(v: WithdrawalView): boolean;
  /** the omnibill's single number, 1..6, negative for austerity */
  proposeG(v: GameView): number;
  /** v0.2 item 4: the bill's position. Omit for the default, which is the
   *  author's own coalition -- the tags their districts actually carry. */
  proposeTags?(v: GameView, books: readonly EnactedBill[]): IdentityTag[] | undefined;
  /** v0.2 item 2: repeal instead of legislating. Returns a bill id from
   *  `books`. Omit for the default heuristic. */
  proposeRepeal?(v: GameView, books: readonly EnactedBill[]): string | undefined;
  /** v0.2 item 3: call a constitutional convention, which spends the year's
   *  legislating exactly as impeachment does. Returns the amendment's tags.
   *  Omit for the default heuristic. */
  moveAmendment?(v: GameView, pending: Amendment | undefined): IdentityTag[] | undefined;
  /** Impeachment replaces the omnibill for the year, so wanting it is a
   *  decision taken instead of legislating, not alongside it. */
  moveImpeach?(v: GameView): boolean;
  voteImpeach?(v: GameView, seat: Seat): boolean;
  /** Standard pack-pass draft: take one, pass the rest. Given a pack,
   *  return the card to take. Omit for the default heuristic. */
  draftPick?(v: GameView, pack: Card[]): Card | undefined;
  /** The VP's real function is as a bargaining chip during the
   *  nomination. Any player may offer a card to any ticket. */
  offerVP?(v: GameView, nominee: { player: number; party: Party }): CandidateCard | undefined;
  pickVP?(v: GameView, offers: VPOffer[]): VPOffer | undefined;
  voteBill(v: GameView, g: number, seat: Seat, billTags?: readonly IdentityTag[]): boolean;
  veto(v: GameView, g: number): boolean;
}

export type UiRequest =
  | { kind: 'declare'; year: number; open: OpenRace[] }
  | { kind: 'withdraw'; year: number; round: 'primary' | 'general';
      view: WithdrawalView; race: { office: Office; state: string; slot?: number; cardName: string } }
  | { kind: 'independent'; year: number;
      view: WithdrawalView; race: { office: Office; state: string; slot?: number; cardName: string } }
  | { kind: 'bill'; year: number; isAuthor: boolean; votes: boolean };

export interface UiAnswer { declarations?: Declaration[]; withdraw?: boolean; independent?: boolean; g?: number; yes?: boolean }

/** The two year-gates, defined ONCE because they were written twice and drifted.
 *  `tick` billed biennially and ran odd-year governor races; `interactiveTick`
 *  billed every year and never ran an odd year. Same seed, same config, two
 *  different games -- which is the whole of #29. */
export const isBillYear = (cfg: Config, year: number): boolean =>
  cfg.legislature.billFrequency !== 'biennial' || year % 2 === 0;
export const isElectionYear = (cfg: Config, year: number): boolean =>
  year % 2 === 0
  || (cfg.game.oddYearGovernors === true && STATES.some((st) => governorUp(st, year)));

/** The endings a game can have. A union rather than `string` so a config
 *  cannot ship a misspelled condition that silently reads as "play to the
 *  cap" -- which is exactly what `victory: "points"` means here, and why a
 *  typo was invisible. 'points' names no ending: it plays out the year cap
 *  and the highest score wins, so `victorOf` returns undefined for it by
 *  design. */
export type Victory = 'points' | 'bills' | 'two-terms' | 'three-terms' | 'parallel' | 'amendment';

/** v0.2 item 3. 'amendment' is an ENDING, not a winner: ratification stops the
 *  clock and the epilogue decides who won. That is why it is not in
 *  `victorOf`, which answers "did a player win outright" -- the proposer gets
 *  no premium over the ratifiers, so there is nobody for it to return. The
 *  game ends and `GameResult.endedBy` records why. */

/** What `victorOf` needs to read. Structural, so `Game` satisfies it directly. */
export interface VictoryTally {
  billsBy: Record<number, number>;
  termsBy: Record<number, number>;
  consecutiveBy: Record<number, number>;
}

/** The victory conditions, defined ONCE and exported, for the same reason
 *  the two year gates above are (#48) -- and this one had already drifted.
 *
 *  It was a PRIVATE method reachable from `run()` alone, so the headless game
 *  ended on a victory and the browser, which drives `interactiveTick()`, played
 *  a game with no ending at all. That is #29's divergence in a fifth place, and
 *  the one place the parity test could not see because it compares ticks rather
 *  than the loop around them.
 *
 *  Returns the winning player, or undefined to keep playing. */
export function victorOf(
  cfg: Config, players: readonly { id: number }[], t: VictoryTally,
): number | undefined {
  const v = cfg.game.victory;
  if (v === 'bills' || v === 'parallel') {
    const target = cfg.game.billTarget ?? 8;
    for (const p of players) if ((t.billsBy[p.id] ?? 0) >= target) return p.id;
  }
  if (v === 'two-terms' || v === 'three-terms' || v === 'parallel') {
    const need = v === 'three-terms' ? 3 : 2;
    for (const p of players) {
      const held = v === 'three-terms' ? (t.termsBy[p.id] ?? 0) : (t.consecutiveBy[p.id] ?? 0);
      if (held >= need) return p.id;
    }
  }
  return undefined;
}

const raceKeyOf = (d: { office: Office; state: string; slot?: number }) => `${d.office}|${d.state}|${d.slot ?? ''}`;
const sameRace = (a: { office: Office; state: string; slot?: number }, b: { office: Office; state: string; slot?: number }) =>
  raceKeyOf(a) === raceKeyOf(b);

export interface VPOffer { from: number; card: CandidateCard }
/** A second card on the ticket. It does not score and is not consumed on
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
  /** The player a victory condition fired for, or undefined when the game
   *  simply ran out of years. `winner` is set either way, so without this a
   *  result cannot distinguish "someone won" from "time expired" -- which is
   *  exactly the question hf7y/american-cycle#13 has to answer, and a sweep
   *  reported 0% of games ending because it could not ask it. */
  wonBy?: number;
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
  /** score by player, one row per year -- the runaway metrics (see
   *  findings/runaway-no-brake.ts, sim/roundrobin.ts) are cross-game curves
   *  over this, not per-game summaries. */
  scoreHistory: number[][];
  seatsByOffice: Record<Office, number>;
  /** v0.2. `wonBy` says a PLAYER won outright; this says the game stopped for
   *  a reason other than the clock. An amendment ending sets `endedBy` and
   *  leaves `wonBy` undefined, because ratification is shared. Track C6
   *  ("games end by condition") reads this, not `wonBy`. */
  endedBy?: Victory | 'deckOut';
  bills: EnactedBill[];
  amendments: Amendment[];
  /** bills on the books at the epilogue, and those repealed along the way */
  billsOnBooks: number;
  billsRepealed: number;
  /** v0.2 item 8, recorded so the DIRECTION can be tested and not just the
   *  firing. The record says the party perceived as making the demand takes
   *  it, and in 1995 and 2013 that party held the congressional majority — so
   *  a rule that can only ever blame the minority has encoded incumbency by
   *  accident, and only `wasMajority` can tell the two apart. */
  shutdownBlame: { year: number; party: Party; wasMajority: boolean }[];
}

export class Game {
  cfg: Config; rng: RNG; players: PlayerState[]; seats: Seat[] = [];
  leanMap: lean.Lean = {}; economy: econ.Economy;
  year: number; talon: Card[] = []; discard: Card[] = []; eraQueue: Card[][] = [];
  president?: { player: number; cardId: string; party: Party; since: number };
  vicePresident?: VicePresident;
  /** Impeached presidents leave the game entirely -- the only permanent removal. */
  expelled = new Set<string>();
  events: RaceEvent[] = [];
  /** v0.2 item 2: the books. Public, because the epilogue and every detector
   *  in skowronek/ read it -- `BILL_CORPUS_ABSENT` was the note saying this
   *  did not exist. */
  bills: EnactedBill[] = [];
  amendments: Amendment[] = [];
  shutdownBlame: { year: number; party: Party; wasMajority: boolean }[] = [];
  log: string[] = [];
  stats = { billsPassed: 0, billsAttempted: 0, crossBench: 0, impeachments: 0, rateRises: 0,
            decisions: [] as number[],
            /** race-slots offered, and those drawing declarations from >1 player.
             *  Counting "uncontested generals" instead undercounts badly: a race
             *  several players crowd in one party resolves as a contested PRIMARY
             *  and a one-candidate general. */
            raceSlots: 0, contestedSlots: 0, billsRepealed: 0, shutdowns: 0, shocks: 0 };
  /** v0.2 item 6: off-position yes-votes, by card id. */
  private offDistrict = new Map<string, number>();
  /** v0.2 item 9: pips of shock in force this year, 0 in a quiet one. */
  private shockPips = 0;
  private agents: Agent[];
  private scoreHistory: number[][] = [];

  /** Every candidate by id, so a seated member can be handed back to their
   *  player when the term runs out. Seats store a cardId, not the card.
   *  Public for the same reason `seats` and `leanMap` are: skowronek/observe.ts
   *  drives its own year loop and TAG_COMPASS cannot place a politician
   *  without it. */
  cardById = new Map<string, CandidateCard>();

  constructor(agents: Agent[], cards: Card[], cfg: Config, seed: number) {
    this.cfg = cfg; this.rng = new RNG(seed); this.agents = agents;
    this.year = cfg.game.startYear;
    this.economy = econ.newEconomy(cfg.economy);
    this.players = agents.map((a, i) => ({ id: i, name: a.name, hand: [], districts: [], score: 0, tapped: new Set() }));
    for (const s of STATES) this.leanMap[s.code] = 0;
    // Refill packs draw from later years, so a game beginning in 1976
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

  /** The office bonuses are per OFFICE HELD, not per seat: "base 12 with
   *  president +2 is a 17% edge" only holds if it is 2/12, a one-off bonus
   *  rather than one paid per seat held. Read per seat, a player holding
   *  twenty Senate seats draws thirty-two cards a cycle, which both runs away
   *  and exhausts the talon: game length collapsed from 24 years to 7 before
   *  this was fixed. */
  private handSize(p: PlayerState): number {
    const h = this.cfg.hand;
    const holds = (o: Office) => this.seats.some((s) => s.holder?.player === p.id && s.office === o);
    return h.base
      + (holds('president') ? h.bonusPresident : 0)
      + (holds('senator') ? h.bonusSenator : 0)
      + (holds('governor') ? h.bonusGovernor : 0)
      + (holds('representative') ? h.bonusRepresentative : 0);
  }

  /** v0.2 item 1: the epilogue, evaluated every year so the curve exists.
   *  `PlayerState.score` is now a CACHE of a pure function of the board, not
   *  an accumulator -- which is the whole of why a score can now fall. */
  private rescore(): void {
    const b: BoardView = {
      seats: this.seats, lean: this.leanMap, bills: this.bills, amendments: this.amendments,
      players: this.players,
      identitiesOf: (id) => this.cardById.get(id)?.identities,
    };
    const out = boardScores(this.cfg.scoring, b);
    this.players.forEach((p, i) => { p.score = out[i]; });
  }

  /** A player's share of the seats actually held, over its fair share. 1 is an
   *  average faction; the shock is proportional to this. */
  private powerOf(player: number): number {
    const held = this.seats.filter((s) => s.holder);
    if (!held.length) return 1;
    const mine = held.filter((s) => s.holder!.player === player).length;
    return (mine / held.length) * this.players.length;
  }

  private draw(p: PlayerState, n: number): void {
    for (let i = 0; i < n; i++) {
      if (!this.talon.length) {
        // The next era enters play before the discard is recycled -- that is
        // what puts 2010s districts under 1970s politicians.
        if (this.eraQueue.length) this.talon = this.eraQueue.shift()!;
        else if (this.discard.length) { this.talon = this.rng.shuffle(this.discard); this.discard = []; }
        else return;                                 // the deck-out ending
      }
      const c = this.talon.pop()!;
      if (c.kind === 'district') p.districts.push(c); else p.hand.push(c);
    }
  }

  /** The draft: packs are dealt, each player takes one card and passes the
   *  rest, and the pass repeats until the packs are exhausted. Repeat until
   *  hands are full.
   *
   *  This replaces a random deal, and the difference is not cosmetic: dealing
   *  at random made the opening hand predict the winner at twice chance,
   *  because nobody could correct a bad opening. A draft is exactly the
   *  mechanism that lets them. */
  private draft(): void {
    const size = this.cfg.draft.packSize;
    let guard = 0;
    // 40 rounds is a stall guard, not a rule: one card is taken per pack per
    // round, so filling even the largest configured hand (well under 40 with
    // hand.base=16 plus office bonuses) finishes long before this fires. It
    // only bites if a config makes hands unfillable, in which case a game
    // that ends short of a full hand beats one that spins forever (#87).
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
            ? (this.agents[i].draftPick?.(this.view(i), pack) ?? defaultPick(pack, p, this.cfg.draft.districtsPerPack))
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

  /** Pull one card from the talon, advancing eras and reshuffling the discard
   *  the same way the constructor's initial deal does. */
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

  /** Seats are held for their real terms, and then the member may run
   *  again. Winning removed the card from hand and nothing put it back, so no
   *  politician had ever stood for re-election and the +1 incumbency modifier
   *  fired in exactly zero races -- which silently voided the incumbency
   *  calibration check on +1 (see findings/incumbency-calibration.ts). A
   *  member whose term is up returns to their player's hand and may be
   *  re-declared into the same seat, or run elsewhere. */
  /** The stepping-stone bonus only reaches cards that are IN HAND, and winning
   *  takes a card out of it. So an office-holder could reach for a higher one
   *  only in the single cycle its term was expiring -- which is close to the
   *  complement of real ambition, not an approximation of it: every sitting
   *  senator ever elected president ran mid-term, as did Wilson, Clinton and
   *  G.W. Bush. With `resignToRun`, a holder may stand for a different seat at
   *  any time, and vacates the one it holds the moment it declares. Losing
   *  costs the old seat too, which is the whole gamble. */
  private releaseHolders(): void {
    if (!this.cfg.game.resignToRun) return;
    for (const s of this.seats) {
      if (!s.holder || s.office === 'president') continue;
      const card = this.cardById.get(s.holder.cardId);
      if (!card) continue;
      const p = this.players[s.holder.player];
      if (!p.hand.some((c) => c.kind === 'candidate' && c.id === card.id)) {
        p.hand.push({ kind: 'candidate', ...card });
      }
    }
  }

  /** Declaring from a seat you hold vacates it NOW, before the primary. A
   *  member who gives up a safe seat and loses the nomination is simply out,
   *  which is the historical case and the reason the choice has teeth. */
  private vacateForRunners(decls: Declaration[]): void {
    if (!this.cfg.game.resignToRun) return;
    for (const d of decls) {
      for (const v of this.seats.filter((st) => st.holder?.cardId === d.card.id
        && !(st.office === d.office && st.state === d.state && st.slot === d.slot))) {
        const vo = v.office, vs = v.state, vslot = v.slot;
        // Record the office BEFORE the seat is cleared. Resigning to run
        // otherwise destroys the very credential the stepping-stone bonus is
        // trying to price, and the term collapsed from 23.2% of presidential
        // sides to 0.8%.
        if (vo !== 'president') d.heldOffice = vo;
        v.holder = undefined;
        this.log.push(`${this.year}: ${d.card.name} gives up ${vo === 'representative' ? 'a House seat' : `the ${vo}'s office`} in ${vs} to run`);
        if (vo === 'senator') this.fillVacancy(vs, vslot);
      }
    }
  }

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
    // The board prints no districts. A House race therefore exists only
    // where a district CARD is in play -- the House map IS the set of drafted
    // districts, which is also what makes `capture` (below) coherent (you take
    // the seat by taking the card). Opening all 435 seats instead leaves the
    // map so sparse that players never meet, and the game becomes solitaire.
    const inPlay = new Map<string, { state: string; number: number }>();
    for (const p of this.players) for (const d of p.districts) inPlay.set(d.id, d);
    // ORDER MATTERS, and must not follow seat order. Agents sort options by
    // edge, Array.prototype.sort is stable, and ties therefore resolve to
    // whatever came first -- which was every district held by player 0. Their
    // seats drew the most declarations, so they lost them to capture most
    // often, and since districts are ballast, being stripped was an
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
      // THE THIRD COPY. #48 unified this rule for tick() and interactiveTick()
      // and missed the view, which is what every agent reads. With
      // oddYearGovernors on, the engine ran elections in an odd year while
      // telling agents it was not one. The parity test cannot catch this:
      // both tick paths read the same view, so they stay identical while
      // both are wrong.
      isElectionYear: isElectionYear(this.cfg, this.year),
      isMidterm: this.year % 4 === 2,
      isPresidentialYear: this.year % 4 === 0,
      economy: this.economy, lean: this.leanMap, seats: this.seats,
      players: this.players, me, presidentParty: this.president?.party,
      bills: this.bills, amendments: this.amendments,
    };
  }

  /** Impeachment replaces the omnibill for that year: the same coalition
   *  capable of passing a bill can remove a president, but doing so costs the
   *  year's scoring. Two-thirds of the Senate (see
   *  engine/rules/legislature.test.ts, "impeachment needs two-thirds of the
   *  Senate"). An impeached president leaves the game entirely -- not to the
   *  discard, out.
   *
   *  Returns true when the year's legislating was spent on this instead. */
  private impeachment(): boolean {
    const pres = this.president;
    if (!pres) return false;
    const movers = this.players.filter((_, i) => this.agents[i].moveImpeach?.(this.view(i)));
    if (!movers.length) return false;

    const senate = this.seats.filter((s) => s.office === 'senator' && s.holder);
    // WHO voted, not how many. v0.1 kept a count, which is why nothing could
    // be made to fall on the people who voted for it.
    const forRemoval = senate.filter((s) =>
      this.agents[s.holder!.player].voteImpeach?.(this.view(s.holder!.player), s));
    const yes = forRemoval.length;
    if (!leg.impeach(this.cfg.legislature, this.seats, yes)) {
      this.backfire(forRemoval, pres.party);
      this.log.push(`${this.year}: impeachment fails, ${yes} of ${senate.length} in the Senate`);
      return true;                            // the year's slot is spent either way
    }

    this.stats.impeachments++;
    this.expelled.add(pres.cardId);
    const seat = this.seats.find((s) => s.office === 'president');
    const removedParty = pres.party;
    this.log.push(`${this.year}: the president is removed, ${yes} of ${senate.length}`);

    // The VP succeeds, and the VP's ORIGINAL player scores -- which is
    // the entire point of putting your card on a rival's ticket.
    const vp = this.vicePresident;
    if (vp) {
      const holder = { cardId: vp.cardId, player: vp.from, party: vp.card.party, since: this.year };
      if (seat) seat.holder = holder;
      this.president = { ...holder };
      this.vicePresident = undefined;
      this.log.push(`${this.year}: ${vp.card.name} succeeds to the presidency`);
    } else {
      if (seat) seat.holder = undefined;
      this.president = undefined;
    }

    // v0.1 docked a point from every seat of the removed president's party.
    // Under board scoring there is no tally to dock, and there does not need
    // to be one: the coalition that installed him has just lost the
    // presidency off its board, which IS the hit. Successful conviction pays
    // by removal alone -- no separate reward, and no separate penalty.
    void removedParty;
    return true;
  }

  /** Every district card in play, by state. The finest positional granularity
   *  the engine has: `DistrictCard` carries demographics, states do not. */
  private districtsInPlay(): DistrictCard[] {
    return this.players.flatMap((p) => p.districts);
  }

  /** The tag position of one player's own coalition -- the districts they
   *  hold. This is what "a bloc concentrated in one tag region" means
   *  concretely, and why such a bloc passes bills cheaply. */
  private playerPosition(player: number): tags.TagWeights {
    return tags.centroid(this.players[player].districts.map((d) => tags.weights(d.demographics)));
  }

  /** v0.2 item 4: what a bill is about, when the author does not say.
   *  The author's own districts -- the coalition they can actually pass. */
  private defaultBillTags(author: number): IdentityTag[] {
    const freq = new Map<IdentityTag, number>();
    for (const d of this.players[author].districts) {
      for (const t of d.demographics) freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1])
      .slice(0, this.cfg.legislature.tagsPerBill ?? 2).map(([t]) => t);
  }

  /** v0.2 item 2's default: repeal the furthest thing on the books that
   *  somebody else wrote. Deterministic, so a repeal is a consequence of the
   *  board rather than of a die -- and it fires only when the corpus actually
   *  contains something the author is at odds with. */
  private defaultRepeal(author: number): string | undefined {
    const mine = this.playerPosition(author);
    if (tags.isEmpty(mine)) return undefined;
    let worst: EnactedBill | undefined, far = this.cfg.legislature.repealAtDistance ?? 0.5;
    for (const b of this.bills) {
      if (b.repealedIn !== undefined || b.author === author) continue;
      const d = tags.distance(mine, tags.weights(b.tags));
      if (d !== undefined && d > far) { far = d; worst = b; }
    }
    return worst?.id;
  }

  // ---- v0.2 item 3: the convention -----------------------------------------

  /** One state's standing on one amendment, for one player. Governor,
   *  district cards, partisan lean -- the machinery that already exists. */
  private standing(a: { tags: IdentityTag[] }, player: number, state: string): amend.StateStanding {
    const gov = this.seats.find((s) => s.office === 'governor' && s.state === state && s.holder);
    const mine = this.seats.filter((s) => s.state === state && s.holder?.player === player);
    const leanV = this.leanMap[state] ?? 0;
    // Whose way the lean runs is a question about the player, and a player is
    // a faction of both parties: read it off the party they actually hold the
    // state with.
    const side = mine.filter((s) => s.holder!.party === (leanV > 0 ? 'R' : 'D')).length;
    return {
      governor: gov?.holder?.player === player,
      matchingDistricts: this.players[player].districts
        .filter((d) => d.state === state && amend.overlaps(a.tags, d.demographics)).length,
      leanWith: side > 0 ? Math.abs(leanV) : 0,
    };
  }

  /** The default mover: whoever holds most of the board, once the clock is
   *  past halfway. The leader is exactly who wants the game to stop -- and
   *  under Article V's thresholds the leader is exactly who cannot close
   *  alone, which is the anti-runaway claim doing its work rather than being
   *  asserted. */
  private defaultAmendmentTags(): { player: number; tags: IdentityTag[] } | undefined {
    const half = this.cfg.game.startYear + this.cfg.game.maxYears / 2;
    if (this.year < half) return undefined;
    const held = this.seats.filter((s) => s.holder);
    if (!held.length) return undefined;
    const tally = new Map<number, number>();
    for (const s of held) tally.set(s.holder!.player, (tally.get(s.holder!.player) ?? 0) + 1);
    let best = -1, n = 0;
    for (const [p, c] of tally) if (c > n) { n = c; best = p; }
    if (best < 0) return undefined;
    const t = this.defaultBillTags(best).slice(0, this.cfg.amendment.tagsPerAmendment);
    return t.length ? { player: best, tags: t } : undefined;
  }

  /** Calling a convention spends the year's legislating, exactly as
   *  impeachment does: wanting the ending is a decision taken INSTEAD of
   *  governing, not alongside it. Returns true when the year was spent. */
  private convention(): boolean {
    if (!this.cfg.amendment.enabled) return false;
    if (this.amendments.some((a) => a.ratifiedIn === undefined && a.failedIn === undefined)) return false;
    let move: { player: number; tags: IdentityTag[] } | undefined;
    for (let i = 0; i < this.players.length; i++) {
      const t = this.agents[i].moveAmendment?.(this.view(i), undefined);
      if (t?.length) { move = { player: i, tags: t }; break; }
    }
    move ??= this.defaultAmendmentTags();
    if (!move) return false;

    const cfg = this.cfg.amendment;
    const called = STATES.filter((st) => amend.stateBacks(cfg, this.standing(move!, move!.player, st.code), this.rng))
      .map((st) => st.code);
    if (called.length < amend.needed(cfg.callFraction, STATES.length)) {
      this.log.push(`${this.year}: the convention call fails, ${called.length} of ${STATES.length} states`);
      return true;
    }
    this.amendments.push({
      id: `a${this.year}`, proposer: move.player, tags: move.tags,
      calledIn: this.year, called, ratified: [], rescinded: [],
    });
    this.log.push(`${this.year}: a convention is called on [${move.tags.join(', ')}], ${called.length} states`);
    return true;
  }

  /** The ratification window. This runs EVERY year, bill year or not, because
   *  it is the states acting and not Congress -- and because the window is the
   *  last-shot phase in which everyone not winning tries to find thirteen
   *  states. Rescission is that counterplay: the ERA reached 35 of 38 and then
   *  went backwards. */
  private ratify(): void {
    const cfg = this.cfg.amendment;
    const a = this.amendments.find((x) => x.ratifiedIn === undefined && x.failedIn === undefined);
    if (!a || a.calledIn === this.year) return;

    const fresh: string[] = [];
    for (const st of STATES) {
      if (a.ratified.includes(st.code) || a.rescinded.includes(st.code)) continue;
      if (amend.stateBacks(cfg, this.standing(a, a.proposer, st.code), this.rng)) fresh.push(st.code);
    }

    // RESCISSION IS NOT SYMMETRIC WITH RATIFICATION, and both asymmetries are
    // the rule rather than a balance patch.
    //
    // WHERE: a state ratifies on its own lean and a die whether or not anyone
    // holds it; an opponent can only PULL a state they have a hold on -- the
    // governorship, a matching district, or the lean running their way.
    //
    // WHEN: once, as the state ratifies. The ERA's rescissions were one-time
    // acts and a rescinded state stayed out; re-litigating every state every
    // year instead is not a blocking minority, it is a permanent veto, and it
    // pins ratification at ~33 of the 38 needed for ever.
    for (const code of fresh) {
      let pulled = false;
      for (const other of this.players) {
        if (other.id === a.proposer || pulled) continue;
        const st = this.standing(a, other.id, code);
        if (amend.supportPips(cfg, st) > 0 && amend.stateBacks(cfg, st, this.rng, cfg.rescindTarget)) pulled = true;
      }
      (pulled ? a.rescinded : a.ratified).push(code);
    }

    if (a.ratified.length >= amend.needed(cfg.ratifyFraction, STATES.length)) {
      a.ratifiedIn = this.year;
      this.endedBy = 'amendment';
      this.log.push(`${this.year}: the amendment is ratified by ${a.ratified.length} states`);
      return;
    }
    if (this.year - a.calledIn >= cfg.windowYears) {
      a.failedIn = this.year;
      // Failure rearranges positions. The ERA is the model: 35 of 38, and the
      // states that ratified had still moved.
      for (const code of a.ratified) {
        const pty = (this.leanMap[code] ?? 0) >= 0 ? 'R' : 'D';
        lean.nudge(this.leanMap, this.cfg.lean, code, pty, cfg.failurePush);
      }
      this.log.push(`${this.year}: the amendment fails at ${a.ratified.length} of ${amend.needed(cfg.ratifyFraction, STATES.length)}`);
    }
  }

  /** v0.2 item 7: the failed conviction backfires, FLAT.
   *
   *  The warrant is chronological rather than correlational, which is what
   *  makes it trustworthy on n=4: the 1998 midterm was November 3, the House
   *  impeached in December, the Senate acquitted in February 1999. Republicans
   *  lost five seats in the first midterm since 1934 where the president's
   *  party gained, and the Speaker resigned within a week -- all before any
   *  conviction margin existed. The electorate punished the attempt, so there
   *  is no shortfall to scale by.
   *
   *  TWO-SIDED, because the failed attempt pays the target: Clinton hit 73%
   *  approval at the House vote, and Trump's highest ever rating came days
   *  after his first acquittal.
   *
   *  EVERYONE WHO VOTED TO IMPEACH EATS IT, not the filer -- filers are not
   *  tracked, and this makes impeachment a trap you can bait an opponent into. */
  private backfire(forRemoval: Seat[], targetParty: Party): void {
    const pips = this.cfg.legislature.impeachBackfirePips ?? 0;
    if (!pips) return;
    for (const s of forRemoval) lean.nudge(this.leanMap, this.cfg.lean, s.state, s.holder!.party, -pips);
    const target = new Set(this.seats.filter((s) => s.holder?.party === targetParty).map((s) => s.state));
    for (const st of target) lean.nudge(this.leanMap, this.cfg.lean, st, targetParty, pips);
  }

  // ---- annual tick step 2-3: the omnibill -----------------------------------
  private omnibill(human = -1, humanG?: number, humanYes?: boolean): void {
    const authorId = leg.author(this.seats);
    if (authorId === undefined) return;
    this.stats.billsAttempted++;
    const view = this.view(authorId);
    const repealId = this.agents[authorId].proposeRepeal
      ? this.agents[authorId].proposeRepeal!(view, this.bills)
      : this.defaultRepeal(authorId);
    const repealing = this.bills.find((b) => b.id === repealId && b.repealedIn === undefined);

    const proposed = authorId === human && humanG !== undefined
      ? humanG : this.agents[authorId].proposeG(view);
    // A repeal carries the bill it undoes: same position, opposite spending.
    const g = repealing ? -repealing.g
      : clampInt(proposed, this.cfg.economy.gMin, this.cfg.economy.gMax);
    const billTags = repealing ? repealing.tags
      : (this.agents[authorId].proposeTags?.(view, this.bills) ?? this.defaultBillTags(authorId));

    const votes: leg.Vote[] = [];
    for (const s of this.seats) {
      if (!s.holder || (s.office !== 'senator' && s.office !== 'representative')) continue;
      const yes = s.holder.player === human && humanYes !== undefined
        ? humanYes : this.agents[s.holder.player].voteBill(this.view(s.holder.player), g, s, billTags);
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
    // Voting places a counter on the card, coloured by the party in power.
    // Cross-bench votes therefore show as the opposite colour, and the card's
    // accumulated counters are simply read off at resolution (`readCounters`,
    // below; see findings/cross-bench-pricing.ts). Nothing recorded these, so
    // the bill's electoral consequence never reached a candidate and the
    // cross-bench penalty never fired once.
    const majH = leg.majorityParty(this.seats, 'representative');
    const majS = leg.majorityParty(this.seats, 'senator');
    for (const v of votes) {
      const cardId = v.cardId;
      const rec = this.billCounters.get(cardId) ?? { record: 0, counters: {} };
      const maj = v.office === 'representative' ? majH : majS;
      // Voting places a counter on the card, coloured by the party in power.
      // Cross-bench votes therefore show as the opposite colour. The colour
      // was dropped and the count flattened to a boolean, so the direction of
      // a defection was unrecoverable and a serial cross-bencher paid exactly
      // what a one-time defector paid.
      if (v.yes && maj) rec.counters[maj] = (rec.counters[maj] ?? 0) + 1;
      // Only PASSAGE carries a consequence: a symbolic vote on a failed bill
      // earns heterodoxy credit but no points. With the heterodox TAG cut,
      // that credit is no longer a mechanic -- only passage scores.
      if (v.yes && out.passed) rec.record += out.reactionGood ? 1 : -1;
      this.billCounters.set(cardId, rec);
    }

    // v0.2 item 6: heterodoxy, priced per vote. A yes cast on a bill far from
    // the tags of the districts you represent buys the bill and costs
    // competitiveness -- which is what makes concentration efficient and
    // fragile, and diversity expensive and durable.
    if (out.passed) {
      const bt = tags.weights(billTags);
      for (const v of votes) {
        if (!v.yes) continue;
        const seat = this.seats.find((st) => st.holder?.cardId === v.cardId);
        if (!seat) continue;
        const home = tags.stateposition(this.districtsInPlay(), seat.state);
        const dist = tags.distance(bt, home);
        if (dist !== undefined && dist > (this.cfg.legislature.offDistrictAtDistance ?? 0.5)) {
          this.offDistrict.set(v.cardId, (this.offDistrict.get(v.cardId) ?? 0) + 1);
        }
      }
    }

    if (out.passed) {
      this.stats.billsPassed++;
      this.billsBy[authorId] = (this.billsBy[authorId] ?? 0) + 1;
      // `out.scores` is still computed -- it is the record of who carried the
      // bill -- but nothing adds it to anyone. Passage is worth the bill's
      // place on the books, and only for as long as it stays there.
      econ.spend(this.economy, this.cfg.economy, g);
      if (repealing) {
        repealing.repealedIn = this.year;
        this.stats.billsRepealed++;
        this.log.push(`${this.year}: ${repealing.id} repealed, ${out.houseYes}/${out.houseTotal} H, ${out.senateYes}/${out.senateTotal} S`);
      } else {
        this.bills.push({ id: `b${this.year}-${this.bills.length}`, year: this.year, g, author: authorId, tags: billTags });
        this.log.push(`${this.year}: omnibill G${g} [${billTags.join(', ')}] passed ${out.houseYes}/${out.houseTotal} H, ${out.senateYes}/${out.senateTotal} S`);
      }
      // #78's ruling: a passed bill places a counter, toward the House
      // majority party, in every district ON THE TABLE (any player's) whose
      // demographics touch the bill's tags. Repeal carries the same tags as
      // what it undoes (line ~820), so when the majority has flipped between
      // the two passages this nets the earlier counters out -- with no
      // repeal-specific branch here, exactly as the ruling asked.
      const billPips = this.cfg.legislature.billLeanPips ?? 0;
      if (billPips && majH) {
        for (const d of this.districtsInPlay()) {
          if (amend.overlaps(billTags, d.demographics)) lean.nudge(this.leanMap, this.cfg.lean, d.state, majH, billPips);
        }
      }
    } else {
      this.shutdown(votes);
      this.log.push(`${this.year}: omnibill G${g} ${out.vetoed ? 'vetoed' : 'failed'}`);
    }
  }

  /** v0.2 item 8: nothing passes, and everyone takes a reputational hit
   *  weighted toward the party perceived as making the demand.
   *
   *  NOT weighted toward incumbents, and the record is why: 1995-96, 2013 and
   *  2018-19 all point the same way, and in 1995 and 2013 the blamed party
   *  held the congressional majority, so incumbency did not protect them. The
   *  capability check this was blocked on is satisfied -- `leg.Vote` carries
   *  player, party, office and yes/no, so the no-votes are attributable and
   *  the obstructing party is a fact rather than an inference.
   *
   *  The hit is a lean move, not a score dock, because under board scoring
   *  there is no tally to dock. */
  private shutdown(votes: leg.Vote[]): void {
    const pips = this.cfg.legislature.shutdownPips ?? 0;
    if (!pips) return;
    const noBy = new Map<Party, number>();
    for (const v of votes) if (!v.yes) noBy.set(v.party, (noBy.get(v.party) ?? 0) + 1);
    let blamed: Party | undefined, n = 0, tied = false;
    for (const [pty, c] of noBy) {
      if (c > n) { n = c; blamed = pty; tied = false; } else if (c === n) tied = true;
    }
    // A deadlock nobody owns blames nobody. Splitting the hit evenly would
    // make every failed bill a wash, which is the one outcome the record
    // never shows.
    if (!blamed || tied) return;
    this.stats.shutdowns++;
    const majH = leg.majorityParty(this.seats, 'representative');
    const majS = leg.majorityParty(this.seats, 'senator');
    this.shutdownBlame.push({ year: this.year, party: blamed, wasMajority: blamed === majH || blamed === majS });
    // WHERE the hit lands is the attribution, not the party register. Nudging
    // every state the blamed party holds a seat in makes a failed bill write
    // more lean than an election does -- ~6.5 failures a game across ~30
    // states against ~50 election pushes -- which inverts the rule that the
    // map moves because voters moved it. The no-voters' own states are the set the
    // `Vote` record actually supports.
    const states = new Set(votes.filter((v) => !v.yes && v.party === blamed)
      .map((v) => this.seats.find((s) => s.holder?.cardId === v.cardId)?.state)
      .filter((x): x is string => !!x));
    for (const st of states) lean.nudge(this.leanMap, this.cfg.lean, st, blamed, -pips);
    this.log.push(`${this.year}: the shutdown is blamed on ${blamed}, ${n} no-votes`);
  }

  // ---- annual tick steps 6-9: the elections ---------------------------------
  private elections(): void {
    const wave = new Wave(this.rng);
    const open = this.openRaces();
    this.releaseExpiringTerms(open);
    this.releaseHolders();
    const decls: Declaration[] = [];
    const pending: PendingPeg[] = [];
    // Declaration is sequential around the table, and the order rotates each
    // cycle so going last is not a permanent tax.
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
    this.vacateForRunners(decls);
    this.resolveDeclared(decls, wave, -1);
  }

  /** Endorsement is a tap: a card taps to endorse and untaps at cycle start.
   *  Incumbents may endorse and run in the same cycle. A president endorses
   *  anywhere for +3; a governor endorses in their own state for +2.
   *  Endorsements are primary-only -- the general effect is coattails, already
   *  modelled, and a general endorsement would double-count (see
   *  engine/rules/elections.test.ts).
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
          // Senators do not endorse as a class, because most senators move
          // nothing. The exceptions are ideological validators with national
          // followings, and those get printed text: the may_endorse effect,
          // which no card carried and nothing read.
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

      for (const d of group) { this.readCounters(d); this.readPosition(d); }
      const nominees = this.runPrimaries(group, ctx, wave, human);
      if (!nominees.length) continue;
      // Governors carry incumbency into Senate and presidential runs.
      // Incumbency was granted only for holding THIS seat, so a sitting
      // governor stepping up ran as a challenger -- one of the four things the
      // office is supposed to be worth, unimplemented. Same shape as the
      // district clause that killed the presidency.
      for (const d of nominees) {
        this.readCounters(d);
        this.readPosition(d);
        const holdsThis = !!incumbent && incumbent.holder!.cardId === d.card.id;
        // The stepping-stone bonus is priced once, by `crossOfficeIncumbency`,
        // for every combination of offices. This used to hand governor -> Senate a
        // BORROWED incumbency pip -- a different quantity wearing the same
        // name -- while governor -> president went through a table.
        d.incumbent = holdsThis;
        if (!d.heldOffice) {
          const held = this.seats.find((st) => st.holder?.cardId === d.card.id
            && !(st.office === office && st.state === state && st.slot === slot));
          d.heldOffice = held?.office;
        }
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

  /** v0.2 items 5, 6 and 9, read off the board onto one declaration.
   *
   *  `partyFit` is the distance from this card's tags to the CURRENT centroid
   *  of its party's officeholders -- so the cost of the label is a fact about
   *  who holds office under it this year, and nowhere is it written down that
   *  Democrats are left. It is left undefined when either side carries no
   *  tags, because that is not a perfect fit. */
  private readPosition(d: Declaration): void {
    const mine = tags.weights(d.card.identities);
    const party = tags.partyPosition(this.seats, this.cardById, d.card.party);
    d.partyFit = tags.distance(mine, party);
    d.offDistrict = this.offDistrict.get(d.card.id) ?? 0;
    d.power = this.powerOf(d.player);
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
      shock: this.shockPips,
    };
  }

  /** Nomination is a national primary, so only two cards reach the general
   *  regardless of table size. The general then runs state by state -- which is
   *  what produces the states carried that the honeymoon counter needs, and
   *  what makes the map worth holding. */
  private presidentialRace(declarations: Declaration[], wave: Wave, human = -1): Party | undefined {
    const natCtx = this.raceContext('president', 'US', undefined);
    // The stepping-stone bonus. The office a card holds when it reaches for the
    // presidency is worth something, and worth different amounts in the two
    // rounds. Read off the board, so it needs no card data and no new state.
    for (const d of declarations) {
      this.readPosition(d);
      // Already set if the card resigned a seat to get here.
      if (!d.heldOffice) {
        const held = this.seats.find((st) => st.office !== 'president' && st.holder?.cardId === d.card.id);
        d.heldOffice = held?.office;
      }
      // The presidency never set this, so `incumbency` fired in 0 of
      // 11,327 presidential sides against 41.7% everywhere else.
      // The presidency never set this, so `incumbency` fired in 0 of 11,327
      // presidential sides against 41.7% everywhere else: the one office the
      // whole game is about was the one office incumbency did not reach.
      d.incumbent = !!this.president && this.president.cardId === d.card.id;
    }
    const nominees = this.runPrimaries(declarations, natCtx, wave, human);
    if (!nominees.length) return undefined;

    // The ticket is chosen before the general. Any player may offer a
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
      // A district card boosts House, Senate, governor, and presidential runs
      // in its state -- it is an investment in a state, not just a seat.
      // The presidential general runs state by state, so each nominee reads
      // their own district for THIS state -- without which presence buys
      // nothing at the top of the ticket and no agent ever wants the office.
      // A presidential race has no single correct district to read fit
      // against (unlike a House seat), so `homeDistrict` combines every
      // district the player holds in the state rather than reading
      // whichever one the array yields first -- see #112.
      const local = nominees.map((d) => {
        const vp = tickets.get(d.player);
        // The VP adds a home-state bonus in the general.
        const vpBonus = vp && vp.card.homeState === st.code
          ? [{ type: 'conditional' as const, pips: vp.card.homeStateBonus, note: `VP ${vp.card.name}` }]
          : [];
        return {
          ...d,
          card: vpBonus.length ? { ...d.card, effects: [...d.card.effects, ...vpBonus] } : d.card,
          district: homeDistrict(this.players[d.player].districts, st.code),
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
    // Term counters, for the two- and three-term conditions (see
    // engine/victory.test.ts).
    this.termsBy[best] = (this.termsBy[best] ?? 0) + 1;
    for (const p of this.players) {
      this.consecutiveBy[p.id] = p.id === best ? (this.consecutiveBy[p.id] ?? 0) + 1 : 0;
    }
    this.log.push(`${this.year}: ${winner.card.name} (${winner.card.party}) wins with ${bestEV} electoral votes`);

    // The honeymoon. One counter in every state carried, removed at the
    // next decay -- so the incoming party enters the midterm with a fleeting
    // map advantage immediately before the -2 lands on them (see
    // engine/rules/lean.test.ts, "the honeymoon counter is placed and then
    // decays away").
    lean.honeymoon(this.leanMap, this.cfg.lean, carried.get(winner.card.party) ?? [], winner.card.party);
    this.vicePresident = tickets.get(best);
    return winner.card.party;
  }

  /** hf7y/american-cycle#96: Lieberman 2006 -- whether a card that is about to
   *  contest a primary would run as an independent in THIS race if it lost.
   *  Asked before the primary's own die is drawn, same footing as `withdraw`,
   *  so it shares that view rather than a result nobody can see yet. The
   *  human's answer was collected earlier, in `electionsInteractive`; here it
   *  is only looked up. */
  private decideIndependent(d: Declaration, others: Declaration[], ctx: RaceContext, human: number): boolean {
    if (d.player === human) return this.humanIndependentDecisions.get(raceKeyOf(d) + '|' + d.card.id) ?? false;
    const mods = buildModifiers(d, ctx, 'primary', this.cfg.resolution, this.cfg.national, this.cfg.primaryGeneral);
    return this.agents[d.player].declareIndependent?.(withdrawalView(d, mods, 'primary', ctx, others)) ?? false;
  }

  private runPrimaries(group: Declaration[], ctx: RaceContext, wave: Wave, human = -1): Declaration[] {
    const byParty = new Map<Party, Declaration[]>();
    for (const d of group) {
      if (!byParty.has(d.card.party)) byParty.set(d.card.party, []);
      byParty.get(d.card.party)!.push(d);
    }
    const winners: Declaration[] = [];
    for (const [party, cands] of byParty) {
      if (party === 'I') { winners.push(...cands); continue; }  // independents skip the primary
      if (cands.length === 1) { winners.push(cands[0]); continue; }
      // Decided now, before the primary's own die is drawn -- a card cannot
      // see its own loss coming, only that it might lose.
      const wantsIndependent = new Map(cands.map((d) =>
        [d.card.id, this.decideIndependent(d, cands.filter((o) => o !== d), ctx, human)] as const));
      const out = runRace({
        ctx, round: 'primary', declarations: cands, wave, rng: this.rng,
        res: this.cfg.resolution, nat: this.cfg.national, pg: this.cfg.primaryGeneral,
        decide: (p, v) => this.decideWithdraw(p, v, cands, human),
      });
      for (const w of out.withdrawnCards) this.returnToHand(w);
      if (!out.event) continue;
      this.events.push(out.event);
      const w = cands.find((d) => d.player === out.event!.winner);
      if (w) {
        // McCarthy, New Hampshire 1968: a strong SHOWING damaged the
        // incumbent, not just a loss. A primary won by less than the
        // threshold carries the same bruise into the general (see #95).
        const threshold = this.cfg.primaryGeneral.bruisingPrimaryMargin;
        if (threshold !== undefined && !out.event.uncontested && out.event.margin < threshold) w.bruisingPrimary = true;
        winners.push(w);
      }
      const withdrawnIds = new Set(out.withdrawnCards.map((c) => c.card.id));
      for (const d of cands) {
        if (d.player === out.event!.winner || withdrawnIds.has(d.card.id)) continue;
        // A primary loss returns the card to hand -- unless it committed to
        // run anyway, as itself but under no party's line, in this same
        // race. `cardById` stays the source of truth for the card's printed
        // party, so the label reverts the moment the seat or the hand takes
        // the card back (see `releaseExpiringTerms`, `returnToHand`).
        if (wantsIndependent.get(d.card.id)) winners.push({ ...d, card: { ...d.card, party: 'I' } });
        else this.returnToHand(d);
      }
    }
    return winners;
  }

  private pushLean(results: { ev: RaceEvent; won: Declaration }[]): void {
    const byState = new Map<string, { office: Office; party: Party; margin: number }[]>();
    for (const r of results) {
      const st = r.ev.state;
      if (st === 'US') continue;
      if (!byState.has(st)) byState.set(st, []);
      // An uncontested race has no real margin, so `uncontestedPush` (the
      // config field itself) is fed through `lean.pushForMargin`'s table as
      // a synthetic one rather than applied directly -- ×2 unprinted, audited
      // by #87: it exists to clear the table's own maxPips:1/push:0 tier,
      // which would otherwise read `uncontestedPush: 1` as no push at all.
      byState.get(st)!.push({ office: r.ev.office, party: r.won.card.party,
        margin: r.ev.uncontested ? (this.cfg.lean.uncontestedPush ?? 0) * 2 : r.ev.margin });
    }
    for (const [st, races] of byState) {
      const top = lean.nationalizedRace(races, this.cfg.lean.priority);
      if (!top) continue;
      lean.applyPush(this.leanMap, this.cfg.lean, st, top.party, top.office, top.margin);
    }
  }

  /** Governors appoint Senate vacancies, placing a card from hand with
   *  no election. A vacancy arises here the way it does in life: a sitting
   *  senator wins a different office and leaves the seat behind. The governor
   *  of that state fills it, which is the only route to a seat that never
   *  faces the voters. */
  private fillVacancy(state: string, slot: number | undefined): void {
    const gov = this.seats.find((s) => s.office === 'governor' && s.state === state && s.holder);
    if (!gov) return;
    const p = this.players[gov.holder!.player];
    // With `resignToRun` a seat-holder sits in hand, and appointing one would
    // seat the same card twice.
    const pick = p.hand.find((c) => c.kind === 'candidate'
      && !this.seats.some((st) => st.holder?.cardId === c.id)) as (CandidateCard & { kind: 'candidate' }) | undefined;
    if (!pick) return;
    const seat = this.seats.find((s) => s.office === 'senator' && s.state === state && s.slot === slot);
    if (!seat) return;
    seat.holder = { cardId: pick.id, player: gov.holder!.player, party: pick.party, since: this.year };
    p.hand = p.hand.filter((c) => !(c.kind === 'candidate' && c.id === pick.id));
    this.log.push(`${this.year}: the governor of ${state} appoints ${pick.name} to the Senate`);
  }

  private seat(office: Office, state: string, slot: number | undefined, d: Declaration): void {
    const existing = this.seats.find((s) => s.office === office && s.state === state && s.slot === slot);
    const holder = { cardId: d.card.id, player: d.player, party: d.card.party, since: this.year };
    if (existing) existing.holder = holder;
    else this.seats.push({ office, state, slot, senateClass: office === 'senator' ? (slot as 1 | 2 | 3) : undefined, holder });
    if (office === 'president') this.president = { ...holder };

    // Winning something else leaves EVERY other seat behind. This looked only
    // for a senate seat, so one card could sit in as many as five at once.
    // The governor gets an appointment for a Senate vacancy and nothing
    // for the others; a governorship or a House seat simply stands empty until
    // its next election, which is what the board can express.
    for (const v of this.seats.filter((st) => st.holder?.cardId === d.card.id
      && !(st.office === office && st.state === state && st.slot === slot))) {
      const vo = v.office, vs = v.state, vslot = v.slot;
      v.holder = undefined;
      if (vo === 'senator') this.fillVacancy(vs, vslot);
    }

    const p = this.players[d.player];
    p.hand = p.hand.filter((c) => !(c.kind === 'candidate' && c.id === d.card.id));
    // No award for winning. A seat is worth what it is worth for as long as
    // it is HELD -- `cfg.scoring.office`, read off the board in the epilogue.
  }

  /** Winning a seat transfers the district card to the winner: THE
   *  district — the one the race was fought over, identified by its number —
   *  not merely some card the winner's opponent happens to hold in that state.
   *
   *  Taking an arbitrary district from the first opponent in seat order was a
   *  real bias and not a cosmetic one. It robbed low seats systematically, and
   *  because districts are ballast rather than presence (hand size caps
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
    if (this.expelled.has(d.card.id)) return;      // impeached: out, not discarded
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
   *  `runRace` enforces for the agents (see engine/rules/elections.test.ts,
   *  "the withdrawal window closes before any die is rolled"). */
  *interactiveTick(human: number): Generator<UiRequest, void, UiAnswer> {
    for (const p of this.players) p.tapped.clear();
    if (isBillYear(this.cfg, this.year) && !this.impeachment() && !this.convention()) {
      this.omnibillInteractive(human, yield* this.askBill(human));
    }
    this.ratify();
    const fed = econ.fedCheck(this.economy, this.cfg.economy, this.rng);
    if (fed.rateRise) { this.stats.rateRises++; this.log.push(`${this.year}: the Fed tightens`); }
    econ.walk(this.economy, this.cfg.economy, this.rng);
    lean.decay(this.leanMap, this.cfg.lean, this.year, this.rng);
    this.rollShock();

    if (isElectionYear(this.cfg, this.year)) {
      yield* this.electionsInteractive(human);
      this.refill();
    }
    this.rescore();
    this.scoreHistory.push(this.players.map((p) => p.score));
    this.year++;
    // The ending, which this path never asked about: `victor()` was private and
    // called from `run()` alone, so a browser game ran to the year cap however
    // many bills anyone authored. Set here rather than returned so the existing
    // generator signature holds; the driver reads `wonBy`.
    if (this.wonBy === undefined) {
      this.wonBy = this.victor();
      // `endedBy` was set by `run()` alone, so the browser could ratify an
      // amendment or reach a bill target and keep playing. Both paths now
      // record the same two facts.
      if (this.wonBy !== undefined) this.endedBy = this.cfg.game.victory;
    }
  }

  private humanDeclarations: Declaration[] = [];
  private humanWithdrawals = new Map<string, boolean>();
  private humanIndependentDecisions = new Map<string, boolean>();

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
    this.releaseExpiringTerms(open);
    this.releaseHolders();
    const answer = yield { kind: 'declare', year: this.year, open };
    this.humanDeclarations = answer.declarations ?? [];
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

    this.vacateForRunners(decls);

    // The withdrawal window, before any die is drawn.
    this.humanWithdrawals.clear();
    this.humanIndependentDecisions.clear();
    const mineContested = decls.filter((d) => d.player === human)
      .map((d) => ({ d, others: decls.filter((o) => o !== d && sameRace(o, d)) }))
      .filter((x) => x.others.length > 0);
    for (const { d, others } of mineContested) {
      const ctx = this.raceContext(d.office, d.state, d.slot);
      const primaryOthers = others.filter((o) => o.card.party === d.card.party);
      const round = primaryOthers.length > 0 ? 'primary' : 'general';
      const mods = buildModifiers(d, ctx, round, this.cfg.resolution, this.cfg.national, this.cfg.primaryGeneral);
      const a = yield {
        kind: 'withdraw', year: this.year, round,
        view: withdrawalView(d, mods, round, ctx, others),
        race: { office: d.office, state: d.state, slot: d.slot, cardName: d.card.name },
      };
      this.humanWithdrawals.set(raceKeyOf(d) + '|' + d.card.id, !!a.withdraw);

      // hf7y/american-cycle#96: decided in the same window as withdrawal, on
      // the same incomplete information -- only asked when there IS a primary
      // to lose.
      if (round === 'primary') {
        const b = yield {
          kind: 'independent', year: this.year,
          view: withdrawalView(d, mods, round, ctx, primaryOthers),
          race: { office: d.office, state: d.state, slot: d.slot, cardName: d.card.name },
        };
        this.humanIndependentDecisions.set(raceKeyOf(d) + '|' + d.card.id, !!b.independent);
      }
    }

    this.resolveDeclared(decls, wave, human);
  }

  /** Refill is a rotating draw-and-pass, not a fixed sweep. Refilling in
   *  seat order hands the low seats every card when the talon is short, which
   *  showed up as a persistent ~7% scoring advantage for seat 0 and a 22pp
   *  win-share gap -- entirely an artefact of the loop order, not the design.
   *
   *  Presence is scarce and must be purchased in the draft, so hand size
   *  caps TOTAL cards held; a district you keep is a candidate you do not. */
  private refill(): void {
    const start = Math.floor(this.year / 2) % this.players.length;
    for (let k = 0; k < this.players.length; k++) {
      const p = this.players[(start + k) % this.players.length];
      const want = this.handSize(p) - p.hand.length - p.districts.length;
      if (want > 0) this.draw(p, want);
    }
  }

  /** The endings. The rule itself is `victorOf`, module-level and exported;
   *  this is the reading of it against THIS game's tallies. Public because the
   *  loop around a tick is what has to ask -- and a caller driving `tick()`
   *  itself, as sim/skowronek.ts does, could not reach it while it was private. */
  victor(): number | undefined { return victorOf(this.cfg, this.players, this); }

  /** A card's accumulated counters are simply read off at resolution.
   *  Counters carry the colour of the party that was in power
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

  /** Bill-vote counters, by card id. */
  private billCounters = new Map<string, { record: number; counters: Partial<Record<Party, number>> }>();
  /** Victory-condition counters. Public because `victorOf` reads them structurally and a
   *  driver stepping `tick()` has to be able to ask the same question `run()` does. */
  billsBy: Record<number, number> = {};
  termsBy: Record<number, number> = {};
  consecutiveBy: Record<number, number> = {};

  /** One annual tick. */
  tick(): void {
    for (const p of this.players) p.tapped.clear();      // 1. action phase
    const billYear = isBillYear(this.cfg, this.year);
    // The year's legislating slot, now three-way: a removal, a convention
    // call, or a bill. Wanting the ending is a decision taken INSTEAD of
    // legislating.
    if (billYear && !this.impeachment() && !this.convention()) this.omnibill();   // 2-3.
    this.ratify();
    const fed = econ.fedCheck(this.economy, this.cfg.economy, this.rng);  // 4.
    // Logged in BOTH paths. The interactive tick logged this and the headless
    // one did not, so a coverage sweep that reads the log reported the Fed as
    // a dead rule when it fires in 44% of games.
    if (fed.rateRise) { this.stats.rateRises++; this.log.push(`${this.year}: the Fed tightens`); }
    econ.walk(this.economy, this.cfg.economy, this.rng);
    lean.decay(this.leanMap, this.cfg.lean, this.year, this.rng);  // 5.
    this.rollShock();

    if (isElectionYear(this.cfg, this.year)) {
      this.elections();                                  // 6-9.
      this.refill();
    }
    this.rescore();
    this.scoreHistory.push(this.players.map((p) => p.score));
    this.year++;
  }

  /** v0.2 item 9. Rolled before the elections and cleared after them, so a
   *  shock is a property of one cycle and never of the whole game. */
  private rollShock(): void {
    this.shockPips = econ.shockCheck(this.cfg.economy, this.rng)
      ? (this.cfg.economy.shockPips ?? 0) : 0;
    if (this.shockPips) { this.stats.shocks++; this.log.push(`${this.year}: a shock hits the incumbents`); }
  }

  /** Set when a victory condition fires, so the result can say which. */
  wonBy?: number;
  /** Why the game stopped, if it was not the clock. See `GameResult.endedBy`. */
  endedBy?: Victory | 'deckOut';

  run(): GameResult {
    const end = this.cfg.game.startYear + this.cfg.game.maxYears;
    while (this.year < end) {
      this.tick();
      // v0.2 item 3: ratification stops the clock without naming a winner.
      if (this.endedBy) break;
      const v = this.victor();
      if (v !== undefined) { this.wonBy = v; this.endedBy = this.cfg.game.victory; break; }
      if (this.cfg.game.deckOutEnds && !this.talon.length && !this.discard.length && !this.eraQueue.length) {
        this.endedBy = 'deckOut'; break;
      }
    }
    return this.result();
  }

  /** Public because the interactive path needs the same read of a game that
   *  `run()` hands back, which is how the two are compared (#29). */
  result(): GameResult {
    const scores = this.players.map((p) => p.score);
    // Ties on final score are common between equally-skilled players, and
    // `indexOf` would hand every one of them to the lowest seat -- which reads
    // as a 25pp seat bias that is not in the game at all. How a tie resolves
    // is not settled by anything in DECISIONS.md, so the
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
      wonBy: this.wonBy,
      determinationYear: determination,
      events: this.events,
      billsPassed: this.stats.billsPassed, billsAttempted: this.stats.billsAttempted,
      crossBenchVotes: this.stats.crossBench, impeachments: this.stats.impeachments,
      rateRises: this.stats.rateRises, finalLean: this.leanMap,
      uncontestedShare: this.events.length ? uncontested / this.events.length : 0,
      contestedSlotShare: this.stats.raceSlots ? this.stats.contestedSlots / this.stats.raceSlots : 0,
      decisionCounts: this.stats.decisions, seatsByOffice,
      scoreHistory: this.scoreHistory,
      endedBy: this.endedBy,
      bills: this.bills, amendments: this.amendments,
      billsOnBooks: this.bills.filter((b) => b.repealedIn === undefined).length,
      billsRepealed: this.stats.billsRepealed,
      shutdownBlame: this.shutdownBlame,
    };
  }
}

function clampInt(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, Math.round(v))); }

/** The default draft heuristic. Candidates are valued by home-state bonus and
 *  card text; districts only while a player is thin on presence, because
 *  holding many is measurably a liability -- hand size caps total cards,
 *  so every district crowds out someone to run.
 *
 *  hf7y/american-cycle#87 audited this as four unprinted magnitudes and left
 *  three of them (`0.5`, `2`, `-2` -- the same-state discount and the size of
 *  the thin/full swing) as-is: `0.5` discounts a district in a state already
 *  held, so a fifth district in one state loses to a first district in a new
 *  one; `2`/`-2` are the swing itself.
 *
 *  The fourth, the target spread of distinct states before a player is
 *  "thin" no longer, is now `cfg.draft.districtsPerPack` rather than a
 *  hardcoded `4` -- #87's own deferred decision, resolved by reusing the
 *  field that already shipped in every config for exactly this ratio and
 *  was read nowhere (DECISIONS.md Open item 4). Its "per pack" name is a
 *  holdover from a pack-composition mechanism the draft never built --
 *  packs are dealt from one shuffled talon with no district/candidate
 *  quota -- so this is that number wired to the nearest live mechanism
 *  that actually sets district-to-candidate ratio: past the target, a
 *  district scores `synergy - 2` rather than `2 + synergy`, which is the
 *  cap on board size (#87 measured the `4` default pinning House races
 *  between 56 and 79 regardless of card-pool size; see
 *  sim/scratch-district-threshold-ablation.ts for the swept comparison
 *  that set each shipped config's value). */
function defaultPick(pack: Card[], p: PlayerState, districtGoal: number): Card {
  const states = new Set(p.districts.map((d) => d.state));
  const value = (c: Card): number => {
    if (c.kind === 'district') {
      const need = Math.max(0, districtGoal - states.size);
      return (states.has(c.state) ? 0.5 : 1) * (need > 0 ? 2 + c.synergy : c.synergy - 2);
    }
    return 2 + c.homeStateBonus + c.effects.length;
  };
  return pack.reduce((best, c) => (value(c) > value(best) ? c : best), pack[0]);
}
export { STATES, BY_CODE, electors, type StateDef, defaultPick };
