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
  | 'heterodox' | 'extremist' | 'may_endorse' | 'conditional';

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

/** One named entry in the modifier stack. `national` entries are what a
 *  heterodox candidate ignores (§9, and DECISIONS.md settles it). */
export interface Modifier {
  source: string;
  pips: number;
  national?: boolean;
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
