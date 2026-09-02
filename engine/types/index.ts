export type Party = 'D' | 'R' | 'I';
export type Office = 'president' | 'senator' | 'governor' | 'representative';
export type Round = 'primary' | 'general';

export type IdentityTag =
  | 'catholic' | 'evangelical' | 'jewish' | 'black' | 'hispanic' | 'cuban'
  | 'union' | 'veteran' | 'rural' | 'suburban' | 'urban' | 'ivy'
  | 'farm' | 'business' | 'academic';

/** BUILD-BRIEF Phase 3: a small enumerated set. Anything else is flavor text. */
export type EffectType =
  | 'identity_bonus' | 'home_state' | 'district_synergy'
  | 'extremist' | 'may_endorse' | 'conditional';

export interface CardEffect {
  type: EffectType;
  pips?: number;
  /** for identity_bonus / conditional: what must be true for it to fire */
  when?: { identity?: IdentityTag; state?: string; round?: Round; office?: Office };
  note?: string;
}

export interface CandidateCard {
  id: string;
  name: string;
  party: Party;
  homeState: string;
  /** printed per card, NOT global — §5, the decline of localism */
  homeStateBonus: number;
  identities: IdentityTag[];
  belief?: string;
  era: number;
  effects: CardEffect[];
  portrait?: string;
}

export interface DistrictCard {
  id: string;          // "OH-9"
  state: string;
  number: number;
  era: number;
  demographics: IdentityTag[];
  /** printed synergy, applied when the holder runs in this state */
  synergy: number;
  note?: string;
}

export type Card = ({ kind: 'candidate' } & CandidateCard) | ({ kind: 'district' } & DistrictCard);

export interface Seat {
  office: Office;
  state: string;
  /** district number for House seats */
  slot?: number;
  /** Senate class, for term scheduling */
  senateClass?: 1 | 2 | 3;
  holder?: { cardId: string; player: number; party: Party; since: number };
}

/** One named entry in the modifier stack. */
export interface Modifier {
  source: string;
  pips: number;
}

export interface DiceRoll {
  national: number;
  state: number;
  candidate: number;
}

/** SIM-BRIEF ground rule: log the counterfactual. */
export interface RaceEvent {
  year: number;
  round: Round;
  office: Office;
  state: string;
  slot?: number;
  sides: {
    player: number;
    cardId: string;
    party: Party;
    dice: DiceRoll;
    modifiers: Modifier[];
    modifierTotal: number;
    total: number;
  }[];
  winner: number;
  /** pips, winner minus runner-up */
  margin: number;
  /** who would have won on modifiers alone, with no dice at all */
  zeroDiceWinner: number;
  /** true when the dice reversed the favourite */
  upset: boolean;
  uncontested: boolean;
}

/** v0.2 item 2: bills go ON THE BOOKS and can come off them.
 *
 *  Before this, passage incremented a counter and the bill was gone — which
 *  is why `BILL_CORPUS_ABSENT` held and why board scoring would have been
 *  equivalent to the running tally it replaces. A corpus that only grows is a
 *  tally. `repealedIn` is the whole of the difference. */
export interface EnactedBill {
  id: string;
  year: number;
  /** the spending magnitude, unchanged from v0.1 */
  g: number;
  author: number;
  /** v0.2 item 4: the bill's position, in the same vocabulary as
   *  `CandidateCard.identities` and `DistrictCard.demographics`. */
  tags: IdentityTag[];
  repealedIn?: number;
}

/** v0.2 item 3: the only earned ending, and the goal deck in one object.
 *
 *  Thresholds do the anti-runaway work for free — two-thirds of the states to
 *  call, three-quarters to ratify, thirteen to block. A narrow leader can
 *  never close alone and a minority always has a wall, which is structurally
 *  anti-runaway in a way no scoring tweak achieves. */
export interface Amendment {
  id: string;
  proposer: number;
  /** the demographic/issue content, drawn from the existing tag vocabulary */
  tags: IdentityTag[];
  calledIn: number;
  /** states that voted to call the convention */
  called: string[];
  /** states that have ratified and survived the challenge */
  ratified: string[];
  /** states an opponent pulled back. The ERA's rescissions were one-time acts,
   *  not an annual re-vote, and a rescinded state stayed out. */
  rescinded: string[];
  ratifiedIn?: number;
  /** set when the window closed short — the ERA at 35 of 38 */
  failedIn?: number;
}
