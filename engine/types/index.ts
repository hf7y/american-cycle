export type Party = 'D' | 'R' | 'I';
export type Office = 'president' | 'senator' | 'governor' | 'representative';
export type Round = 'primary' | 'general';

export type IdentityTag =
  | 'catholic' | 'evangelical' | 'jewish' | 'black' | 'hispanic' | 'cuban'
  | 'union' | 'rural' | 'suburban' | 'urban'
  | 'farm';

/** BUILD-BRIEF Phase 3: a small enumerated set. Anything else is flavor text.
 *  identity bonus and home-state bonus are real mechanics, but each is wired
 *  through its own dedicated field -- resolution.identityBonus,
 *  CandidateCard.homeStateBonus -- not through this union, so no literal
 *  names them here (hf7y/american-cycle#153). */
export type EffectType = 'extremist' | 'may_endorse' | 'conditional';

/** #164 part 2: a tag needs somewhere to say where it came from before any
 *  sourcing work has anywhere to write to. `vintage` is the underlying
 *  data's own date (a census year, a returns cycle) -- absent when none
 *  applies, as it does for every tag today. */
export interface TagProvenance {
  source: string;
  vintage?: string;
}

export interface CardEffect {
  type: EffectType;
  pips?: number;
  /** for conditional: what must be true for it to fire */
  when?: { identity?: IdentityTag; state?: string; round?: Round; office?: Office };
  note?: string;
}

export interface CandidateCard {
  id: string;
  name: string;
  party: Party;
  homeState: string;
  /** printed per card, NOT global -- models the decline of localism */
  homeStateBonus: number;
  identities: IdentityTag[];
  /** #164 part 2: where each of `identities` came from. Keyed by tag rather
   *  than parallel to it, since a future sourced/hand-assigned mix will not
   *  keep both arrays index-aligned. */
  provenance?: Partial<Record<IdentityTag, TagProvenance>>;
  /** Signed per-tag override of resolution.identityBonus (#41). A tag absent
   *  here still matches at the flat default -- this is what lets one card
   *  price `business` as an asset and another price it as a liability,
   *  something a single positive scalar could never express. */
  identityWeights?: Partial<Record<IdentityTag, number>>;
  belief?: string;
  era: number;
  effects: CardEffect[];
  portrait?: string;
  /** hf7y/american-cycle#101: this card's id is the predecessor whose seat it
   *  converts, off-cycle, the moment its holder can play this card -- the
   *  Shelby/Campbell/Thurmond shape, a party (or position) switch that skips
   *  an election entirely. Unset for every ordinary card. */
  succeeds?: string;
}

export interface DistrictCard {
  id: string;          // "OH-9"
  state: string;
  number: number;
  era: number;
  demographics: IdentityTag[];
  provenance?: Partial<Record<IdentityTag, TagProvenance>>;
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
  /** hf7y/american-cycle#86's ruling: 'congress' is the ordinary path (two-
   *  thirds of each chamber, the route all 27 ratified amendments actually
   *  used); 'convention' is v0.2 item 3's original state-called route, kept
   *  live but not the default any shipped agent reaches for -- Article V's
   *  convention route has never once been used in 237 years. */
  route: 'congress' | 'convention';
  /** the demographic/issue content, drawn from the existing tag vocabulary */
  tags: IdentityTag[];
  calledIn: number;
  /** states that voted to call the convention. Empty for a 'congress' route
   *  proposal -- Congress does not poll the states to propose. */
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
