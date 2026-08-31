/** Declaration, withdrawal, and the modifier stack — design doc §8 and §9.
 *
 *  §8 is the heart of the card economy. Withdrawal comes BEFORE reveal in the
 *  primary and BEFORE the national die in the general, so you pull out on
 *  incomplete information; by the time the arithmetic is knowable it is too
 *  late to run. That ordering is enforced structurally here: the withdrawal
 *  window is handed a `WithdrawalView`, which has no field that could carry a
 *  die, and the Wave counts its own rolls so a test can prove none were drawn.
 */
import type {
  CandidateCard, DistrictCard, Modifier, Office, Party, Round, Seat,
} from '../types/index.ts';
import { resolveRace, type Side, type Wave } from './resolution.ts';
import type { RNG } from './rng.ts';

export interface ResolutionConfig { incumbency: number; identityBonus: number; tieBreak: string; }
export interface NationalConfig {
  strongEconomy: number; recession: number; midtermPenalty: number;
  coattailsWith: number; coattailsAgainst: number;
}
export interface PrimaryGeneralConfig {
  extremistPrimary: number; extremistGeneral: number;
  heterodoxPrimaryPenalty: number; crossBenchPrimaryPenalty: number;
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
}

export interface Declaration {
  player: number;
  card: CandidateCard;
  district?: DistrictCard;
  office: Office;
  state: string;
  slot?: number;
  /** pips of endorsement bought in the primary; §9 makes these primary-only */
  endorsements?: number;
  incumbent?: boolean;
  crossBenched?: boolean;
}

/** §5: district cards gate all races. You may run only where you hold a
 *  district card, or where your candidate is a native. This is the brake on
 *  wide-and-empty play. */
export function eligible(card: CandidateCard, state: string, districts: DistrictCard[]): boolean {
  return card.homeState === state || districts.some((d) => d.state === state);
}

function hasEffect(card: CandidateCard, t: 'heterodox' | 'extremist'): boolean {
  return card.effects.some((e) => e.type === t);
}

export function buildModifiers(
  d: Declaration, ctx: RaceContext, round: Round,
  res: ResolutionConfig, nat: NationalConfig, pg: PrimaryGeneralConfig,
): Modifier[] {
  const m: Modifier[] = [];
  const partySign = d.card.party === 'R' ? 1 : d.card.party === 'D' ? -1 : 0;

  // §10: the lean applies once, to the party it favours -- one counter is one
  // pip. Giving the other side the negative would double the scale.
  if (ctx.lean !== 0 && partySign !== 0 && Math.sign(ctx.lean) === partySign) {
    m.push({ source: 'state lean', pips: Math.abs(ctx.lean) });
  }

  if (d.card.homeState === ctx.state && d.card.homeStateBonus) {
    m.push({ source: 'home state', pips: d.card.homeStateBonus });
  }

  if (d.district && d.district.state === ctx.state) {
    m.push({ source: `district ${d.district.id}`, pips: d.district.synergy });
    const shared = d.card.identities.filter((i) => d.district!.demographics.includes(i));
    if (shared.length) {
      m.push({ source: `identity: ${shared.join(', ')}`, pips: res.identityBonus * shared.length });
    }
  }

  if (d.incumbent) m.push({ source: 'incumbency', pips: res.incumbency });

  if (round === 'primary') {
    if (d.endorsements) m.push({ source: 'endorsements', pips: d.endorsements });
    if (hasEffect(d.card, 'extremist')) m.push({ source: 'extremist (primary)', pips: pg.extremistPrimary });
    if (hasEffect(d.card, 'heterodox')) m.push({ source: 'heterodox (primary)', pips: pg.heterodoxPrimaryPenalty });
    if (d.crossBenched) m.push({ source: 'cross-benched', pips: pg.crossBenchPrimaryPenalty });
  } else {
    if (hasEffect(d.card, 'extremist')) m.push({ source: 'extremist (general)', pips: pg.extremistGeneral });

    // National modifiers. `national: true` is precisely the set a heterodox
    // candidate ignores (§9) -- the tide, never the noise.
    if (ctx.presidentParty === d.card.party) {
      if (ctx.isMidterm) m.push({ source: 'midterm', pips: nat.midtermPenalty, national: true });
      if (ctx.economyMod) m.push({ source: 'economy', pips: ctx.economyMod, national: true });
    }
    if (ctx.isPresidentialYear && ctx.presidentialWinner && d.office !== 'president' && partySign !== 0) {
      // Turnout coattails: +1 down-ballot in states leaning your way, -1
      // against. Reverse coattails fall out for free.
      const leaningWith = Math.sign(ctx.lean) === partySign;
      if (d.card.party === ctx.presidentialWinner) {
        m.push({ source: 'coattails', pips: leaningWith ? nat.coattailsWith : nat.coattailsAgainst, national: true });
      }
    }
  }

  for (const e of d.card.effects) {
    if (e.type === 'conditional' && e.pips) {
      const w = e.when ?? {};
      if ((w.state && w.state !== ctx.state) || (w.round && w.round !== round) || (w.office && w.office !== d.office)) continue;
      m.push({ source: e.note ?? 'card text', pips: e.pips });
    }
  }

  return m;
}

export function toSide(d: Declaration, modifiers: Modifier[]): Side {
  return {
    player: d.player, cardId: d.card.id, party: d.card.party,
    modifiers, heterodox: hasEffect(d.card, 'heterodox'),
  };
}

/** What a player may look at when deciding to withdraw. Deliberately narrow:
 *  no dice, and in the primary not even the opponent's card. §8. */
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

/** The ordering §8 depends on: build stacks, open the withdrawal window,
 *  close it, and only then touch the dice. Nothing between `decide` and
 *  `resolveRace` may consult the wave. */
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

