/** Declaration, withdrawal, and the modifier stack.
 *
 *  Withdrawal is the heart of the card economy. It comes BEFORE reveal in the
 *  primary and BEFORE the national die in the general, so you pull out on
 *  incomplete information; by the time the arithmetic is knowable it is too
 *  late to run. That ordering is enforced structurally here: the withdrawal
 *  window is handed a `WithdrawalView`, which has no field that could carry a
 *  die, and the Wave counts its own rolls so a test can prove none were drawn
 *  (see elections.test.ts).
 */
import type {
  CandidateCard, DistrictCard, Modifier, Office, Party, Round, Seat,
} from '../types/index.ts';
import { resolveRace, type Side, type Wave } from './resolution.ts';
import type { RNG } from './rng.ts';

export interface ResolutionConfig {
  incumbency: number; identityBonus: number; tieBreak: string;
  /** Incumbency in a PRIMARY, which is a different contest: every side is the
   *  same party in the same state, so `Wave` hands them the same national and
   *  state die and only the candidate die differs. A primary is 1d6 vs 1d6,
   *  SD 2.42 against the general's 4.18, and the general odds table in
   *  resolution.ts does not describe it. Renomination is also the safer half
   *  of reelection in reality -- House
   *  incumbents lose a primary at 1-2% a cycle -- so one scalar cannot serve
   *  both rounds. */
  incumbencyPrimary: number;
  /** The stepping-stone bonus, flat: what a card already holding an office is
   *  worth running for a DIFFERENT one. One number for every combination,
   *  because the primary/general asymmetry it would otherwise encode is
   *  already emergent from the board -- a House member stepping up runs +4.3pp
   *  above fair share in the primary and -2.7pp below it in the general with
   *  no term at all -- and the history refutes the split anyway: sitting House
   *  members won 61% of Senate primaries and 63% of the generals, the same
   *  number twice. What actually separates them is whether the seat is open,
   *  80% against 30%, which the board already models as an incumbent. */
  crossOfficeIncumbency: number;
  /** Per-office override of `incumbency` for a GENERAL, House and Senate only
   *  -- governor and president stay on the flat value until there is data for
   *  them (#16). Unset falls back to `incumbency`, so a config that does not
   *  set these behaves exactly as it did before the split. */
  incumbencyHouse?: number;
  incumbencySenate?: number;
}
export interface NationalConfig {
  strongEconomy: number; recession: number; midtermPenalty: number;
  coattailsWith: number; coattailsAgainst: number;
}
export interface PrimaryGeneralConfig {
  extremistPrimary: number; extremistGeneral: number;
  crossBenchPrimaryPenalty: number;
  billCounterPips: number;
  /** Most counters a cross-bench record can be worth. The record's counters
   *  are read off at resolution (see legislature.ts), and uncapped they read
   *  off ~30 -- but the 60% Senate threshold also makes cross-benching
   *  structurally necessary to pass anything, so an uncapped record makes
   *  cooperation career-ending. The cap keeps a serial defector distinct from
   *  a one-time one without that. */
  crossBenchCap: number;
  /** v0.2 items 5 and 6: what it costs to run under a label whose CURRENT
   *  officeholders you do not resemble. A party's position is the centroid of
   *  its officeholders' tags (engine/rules/tags.ts), so this is Thurmond's
   *  1964 switch, priced — and it is what makes a primary a fight over who
   *  defines the party's claim in this district rather than a coin flip with
   *  extra steps. Negative; multiplied by a distance in [0,1]. */
  partyFitPips?: number;
  /** v0.2 item 6: heterodoxy stops being a strategy label and becomes a
   *  per-vote decision with a price. Vote against your district's position,
   *  lose competitiveness, gain the bill. Negative, per off-position vote. */
  offDistrictPips?: number;
}

export interface RaceContext {
  year: number;
  office: Office;
  state: string;
  slot?: number;
  /** signed pips: positive R, negative D */
  lean: number;
  isMidterm: boolean;
  isPresidentialYear: boolean;
  presidentParty?: Party;
  economyMod: number;
  /** set once the presidential general has resolved, for down-ballot coattails */
  presidentialWinner?: Party;
  /** v0.2 item 9: pips of exogenous shock this year, 0 in a quiet one. Falls
   *  on incumbents, scaled by `Declaration.power`. */
  shock?: number;
}

export interface Declaration {
  player: number;
  card: CandidateCard;
  district?: DistrictCard;
  office: Office;
  state: string;
  slot?: number;
  /** pips of endorsement bought in the primary; primary-only, since the
   *  general effect is coattails, already modelled (see elections.test.ts) */
  endorsements?: number;
  incumbent?: boolean;
  /** How many counters this card carries in the OTHER party's colour,
   *  and which colour that is. Not a boolean -- a serial cross-bencher is not
   *  a one-time defector. */
  crossBench?: number;
  crossBenchToward?: Party;
  /** The office this card holds right now, captured before any seat it is
   *  vacating is cleared. Feeds the stepping-stone bonus above. */
  heldOffice?: Office;
  /** The card's accumulated counters are simply read off at resolution.
   *  Signed: a good reaction on a yes-vote is an asset, a bad one a liability. */
  billRecord?: number;
  /** v0.2 item 5: distance in [0,1] between this card's tags and the CURRENT
   *  centroid of its party's officeholders. Undefined when either side carries
   *  no tags — which is not distance 0 and must not read as a perfect fit. */
  partyFit?: number;
  /** v0.2 item 6: yes-votes this card cast on bills far from its district. */
  offDistrict?: number;
  /** v0.2 item 9: the player's share of held seats over its fair share, so
   *  1 is an average faction. The shock is proportional to power held. */
  power?: number;
}

/** District cards gate all races. You may run only where you hold a
 *  district card, or where your candidate is a native. This is the brake on
 *  wide-and-empty play (see elections.test.ts). */
export function eligible(card: CandidateCard, state: string, districts: DistrictCard[]): boolean {
  return card.homeState === state || districts.some((d) => d.state === state);
}

function hasEffect(card: CandidateCard, t: 'extremist'): boolean {
  return card.effects.some((e) => e.type === t);
}

export function buildModifiers(
  d: Declaration, ctx: RaceContext, round: Round,
  res: ResolutionConfig, nat: NationalConfig, pg: PrimaryGeneralConfig,
): Modifier[] {
  const m: Modifier[] = [];
  const partySign = d.card.party === 'R' ? 1 : d.card.party === 'D' ? -1 : 0;

  // The lean applies once, to the party it favours -- one counter is one
  // pip. Giving the other side the negative would double the scale.
  if (ctx.lean !== 0 && partySign !== 0 && Math.sign(ctx.lean) === partySign) {
    m.push({ source: 'state lean', pips: Math.abs(ctx.lean) });
  }

  if (d.card.homeState === ctx.state && d.card.homeStateBonus) {
    m.push({ source: 'home state', pips: d.card.homeStateBonus });
  }

  if (d.district && d.district.state === ctx.state) {
    // Synergy is the district's machine and stays whole. The named case is
    // "Joe Manchin wins most of the time, because his card is good and his
    // district synergy is real" -- diluting that would delete the example.
    m.push({ source: `district ${d.district.id}`, pips: d.district.synergy });

    const shared = d.card.identities.filter((i) => d.district!.demographics.includes(i));
    if (shared.length) {
      m.push({ source: `identity: ${shared.join(', ')}`, pips: res.identityBonus * shared.length });
    }
  }

  // v0.2 item 5. Priced in BOTH rounds: a primary is where the party's claim
  // is contested and a general is where the mismatch is punished, and the
  // whole point of defining a party as its officeholders is that the two are
  // the same measurement.
  if (d.partyFit !== undefined && pg.partyFitPips) {
    const pips = Math.round(pg.partyFitPips * d.partyFit);
    if (pips) m.push({ source: 'party fit', pips });
  }

  if (d.incumbent) {
    const perOffice = ctx.office === 'representative' ? res.incumbencyHouse
      : ctx.office === 'senator' ? res.incumbencySenate
      : undefined;
    const pips = round === 'primary' ? res.incumbencyPrimary : (perOffice ?? res.incumbency);
    m.push({ source: 'incumbency', pips });
  }

  if (d.heldOffice && d.heldOffice !== ctx.office && res.crossOfficeIncumbency) {
    m.push({ source: `${d.heldOffice} stepping up`, pips: res.crossOfficeIncumbency });
  }

  if (round === 'primary') {
    if (d.endorsements) m.push({ source: 'endorsements', pips: d.endorsements });
    if (hasEffect(d.card, 'extremist')) m.push({ source: 'extremist (primary)', pips: pg.extremistPrimary });
    if (d.crossBench) {
      const n = Math.min(d.crossBench, pg.crossBenchCap);
      m.push({ source: `cross-benched ×${n}`, pips: pg.crossBenchPrimaryPenalty * n });
    }
    if (d.billRecord) m.push({ source: 'bill record', pips: d.billRecord * pg.billCounterPips });
  } else {
    if (hasEffect(d.card, 'extremist')) m.push({ source: 'extremist (general)', pips: pg.extremistGeneral });

    // v0.2 item 6: the price of the bill you gained.
    if (d.offDistrict && pg.offDistrictPips) {
      m.push({ source: `off-position votes \u00d7${d.offDistrict}`, pips: pg.offDistrictPips * d.offDistrict });
    }

    // v0.2 item 9: the cheap shock. It falls on the people in office and it
    // falls hardest on whoever holds most of them, which is the only brake in
    // the design that reads a player's total position rather than one race.
    if (ctx.shock && d.incumbent) {
      const pips = -Math.round(ctx.shock * (d.power ?? 1));
      if (pips) m.push({ source: 'shock', pips });
    }

    // National modifiers -- the tide, never the noise.
    if (ctx.presidentParty === d.card.party) {
      if (ctx.isMidterm) m.push({ source: 'midterm', pips: nat.midtermPenalty });
      if (ctx.economyMod) m.push({ source: 'economy', pips: ctx.economyMod });
    }
    if (ctx.isPresidentialYear && ctx.presidentialWinner && d.office !== 'president' && partySign !== 0) {
      // Turnout coattails: +1 down-ballot in states leaning your way, -1
      // against. Reverse coattails fall out for free.
      const leaningWith = Math.sign(ctx.lean) === partySign;
      if (d.card.party === ctx.presidentialWinner) {
        m.push({ source: 'coattails', pips: leaningWith ? nat.coattailsWith : nat.coattailsAgainst });
      }
    }
  }

  for (const e of d.card.effects) {
    if (e.type === 'conditional' && e.pips) {
      const w = e.when ?? {};
      if (w.state && w.state !== ctx.state) continue;
      if (w.round && w.round !== round) continue;
      if (w.office && w.office !== d.office) continue;
      // "John Bel Edwards is pro-life, which reads as a bonus in Catholic
      // districts." An identity condition is a claim about the DISTRICT being
      // run in, not about the candidate -- without this the effect fires in
      // every race and the condition is decorative.
      if (w.identity && !d.district?.demographics.includes(w.identity)) continue;
      m.push({ source: e.note ?? 'card text', pips: e.pips });
    }
  }

  return m;
}

export function toSide(d: Declaration, modifiers: Modifier[]): Side {
  return {
    player: d.player, cardId: d.card.id, party: d.card.party,
    modifiers,
  };
}

/** What a player may look at when deciding to withdraw. Deliberately narrow:
 *  no dice, and in the primary not even the opponent's card (see
 *  elections.test.ts). */
export interface WithdrawalView {
  round: Round;
  office: Office;
  state: string;
  year: number;
  /** how many others declared here -- visible, because a peg is on the board */
  contenders: number;
  /** your own stack, which you can read off your card and the board */
  myModifiers: Modifier[];
  myModifierTotal: number;
  /** generals reveal the card; primaries do not */
  opponentCards?: { cardId: string; party: Party }[];
}

export type WithdrawalDecision = (v: WithdrawalView) => boolean;

export function withdrawalView(
  d: Declaration, modifiers: Modifier[], round: Round, ctx: RaceContext,
  others: Declaration[],
): WithdrawalView {
  return {
    round, office: ctx.office, state: ctx.state, year: ctx.year,
    contenders: others.length,
    myModifiers: modifiers,
    myModifierTotal: modifiers.reduce((n, x) => n + x.pips, 0),
    opponentCards: round === 'general'
      ? others.map((o) => ({ cardId: o.card.id, party: o.card.party }))
      : undefined,
  };
}

export interface RunRaceArgs {
  ctx: RaceContext;
  round: Round;
  declarations: Declaration[];
  decide: (player: number, v: WithdrawalView) => boolean;
  res: ResolutionConfig; nat: NationalConfig; pg: PrimaryGeneralConfig;
  wave: Wave;
  rng: RNG;
}

/** The ordering withdrawal depends on: build stacks, open the withdrawal
 *  window, close it, and only then touch the dice. Nothing between `decide`
 *  and `resolveRace` may consult the wave. */
export function runRace(a: RunRaceArgs) {
  const stacks = a.declarations.map((d) => buildModifiers(d, a.ctx, a.round, a.res, a.nat, a.pg));

  const withdrawn = new Set<number>();
  a.declarations.forEach((d, i) => {
    const others = a.declarations.filter((_, j) => j !== i);
    const v = withdrawalView(d, stacks[i], a.round, a.ctx, others);
    if (a.decide(d.player, v)) withdrawn.add(i);
  });

  const running = a.declarations.map((d, i) => ({ d, i })).filter(({ i }) => !withdrawn.has(i));
  const withdrawnCards = [...withdrawn].map((i) => a.declarations[i]);

  if (running.length === 0) return { event: undefined, withdrawnCards, walkover: undefined };

  const event = resolveRace({
    year: a.ctx.year, round: a.round, office: a.ctx.office, state: a.ctx.state, slot: a.ctx.slot,
    sides: running.map(({ d, i }) => toSide(d, stacks[i])),
    wave: a.wave, rng: a.rng,
  });
  return { event, withdrawnCards, walkover: running.length === 1 ? running[0].d : undefined };
}

