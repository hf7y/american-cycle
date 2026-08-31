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

export interface ResolutionConfig {
  incumbency: number; identityBonus: number; tieBreak: string;
  /** Whose demographics a STATEWIDE candidate is judged against. `district`
   *  lets the one district card they hold speak for the whole state, so an
   *  Atlanta card makes a candidate a perfect fit for Georgia. `board` reads
   *  §10 literally and dilutes the fit by how much of the state's district
   *  presence actually shares it -- Atlanta alone IS Georgia, Atlanta beside
   *  three rural districts is a quarter of it. House races are unaffected: a
   *  representative's own district speaks for itself. */
  statewideIdentity: 'district' | 'board';
}
export interface NationalConfig {
  strongEconomy: number; recession: number; midtermPenalty: number;
  coattailsWith: number; coattailsAgainst: number;
}
export interface PrimaryGeneralConfig {
  extremistPrimary: number; extremistGeneral: number;
  heterodoxPrimaryPenalty: number; crossBenchPrimaryPenalty: number;
  billCounterPips: number;
  /** §12: "Sentiment at election time determines whether that counter is an
   *  asset or a liability." Pips per cross-bench counter in the GENERAL,
   *  signed by whether the defection ran with the state's drift or against
   *  it. 0 ships the primary-only reading; the term is unmeasured. */
  crossBenchGeneral: number;
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
  /** §10: "the baseline lives implicitly in which politicians and district
   *  cards exist for that state." Every district card in play in this state,
   *  held by anyone -- the state's demographic character is a property of the
   *  BOARD, not of one player's holdings and not printed on the state. */
  stateDistricts?: DistrictCard[];
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
  /** §12: how many counters this card carries in the OTHER party's colour,
   *  and which colour that is. Not a boolean -- a serial cross-bencher is not
   *  a one-time defector. */
  crossBench?: number;
  crossBenchToward?: Party;
  /** §12: "the card's accumulated counters are simply read off at resolution."
   *  Signed: a good reaction on a yes-vote is an asset, a bad one a liability. */
  billRecord?: number;
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
    // Synergy is the district's machine and stays whole. §10's named case is
    // "Joe Manchin wins most of the time, because his card is good and his
    // district synergy is real" -- diluting that would delete the example.
    m.push({ source: `district ${d.district.id}`, pips: d.district.synergy });

    const shared = d.card.identities.filter((i) => d.district!.demographics.includes(i));
    if (shared.length) {
      // §10: a state has no printed demographics; its character is whichever
      // district cards happen to be on the board. Statewide, one district must
      // not speak for all of them -- an urban card in a southern state is a
      // real but partial claim on it, and how partial depends on what else
      // came out. On average the districts in play track the state; in any one
      // game Georgia can be unusually liberal because Atlanta came out and
      // Macon never did.
      const statewide = ctx.office !== 'representative';
      const board = statewide && res.statewideIdentity === 'board' ? ctx.stateDistricts : undefined;
      let pips = res.identityBonus * shared.length;
      let src = `identity: ${shared.join(', ')}`;
      if (board && board.length) {
        // Per TAG, not per district: the question is whether THIS trait
        // speaks for the state, not whether the candidate has anything at all
        // in common with it. An urban candidate in a state showing Atlanta and
        // three rural districts is a quarter urban, however much else matches.
        let sum = 0; const parts: string[] = [];
        for (const tag of shared) {
          const carry = board.filter((x) => x.demographics.includes(tag)).length;
          sum += res.identityBonus * (carry / board.length);
          parts.push(`${tag} ${carry}/${board.length}`);
        }
        pips = Math.round(sum);
        src = `identity: ${parts.join(', ')}`;
      }
      if (pips) m.push({ source: src, pips });
    }
  }

  if (d.incumbent) m.push({ source: 'incumbency', pips: res.incumbency });

  if (round === 'primary') {
    if (d.endorsements) m.push({ source: 'endorsements', pips: d.endorsements });
    if (hasEffect(d.card, 'extremist')) m.push({ source: 'extremist (primary)', pips: pg.extremistPrimary });
    if (hasEffect(d.card, 'heterodox')) m.push({ source: 'heterodox (primary)', pips: pg.heterodoxPrimaryPenalty });
    if (d.crossBench) {
      m.push({ source: `cross-benched ×${d.crossBench}`, pips: pg.crossBenchPrimaryPenalty * d.crossBench });
    }
    if (d.billRecord) m.push({ source: 'bill record', pips: d.billRecord * pg.billCounterPips });
  } else {
    if (hasEffect(d.card, 'extremist')) m.push({ source: 'extremist (general)', pips: pg.extremistGeneral });

    // §12: a counter is an asset or a liability according to sentiment. A
    // defection toward the party the state is drifting TOWARD reads as
    // independence; the same defection against the drift reads as betrayal.
    // The primary prices cross-benching flat, because a primary electorate is
    // the party's base everywhere; only the general knows where it is.
    if (d.crossBench && d.crossBenchToward && pg.crossBenchGeneral && ctx.lean !== 0) {
      const toward = d.crossBenchToward === 'R' ? 1 : d.crossBenchToward === 'D' ? -1 : 0;
      if (toward !== 0) {
        const withDrift = Math.sign(ctx.lean) === toward ? 1 : -1;
        m.push({ source: `cross-bench ${withDrift > 0 ? 'with' : 'against'} the drift ×${d.crossBench}`,
                 pips: pg.crossBenchGeneral * d.crossBench * withDrift });
      }
    }

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
      if (w.state && w.state !== ctx.state) continue;
      if (w.round && w.round !== round) continue;
      if (w.office && w.office !== d.office) continue;
      // §5: "John Bel Edwards is pro-life, which reads as a bonus in Catholic
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

