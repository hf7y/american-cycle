/** The board: states, their Senate classes, and their gubernatorial schedules.
 *  Design doc §2 — "a per-state table of gubernatorial election years". */

export type StateCode = string;

export interface StateDef {
  code: StateCode;
  name: string;
  /** The two Senate classes this state elects. Class 1 → 2024, 2 → 2026, 3 → 2022. */
  senateClasses: [1 | 2 | 3, 1 | 2 | 3];
  /** Governor term length in years. NH and VT are the two-year outliers. */
  govTerm: 2 | 4;
  /** A year in which this state elected a governor; the schedule repeats from it. */
  govAnchor: number;
  /** House delegation by apportionment era, keyed by the census that set it. */
  seats: Record<number, number>;
}

/** Class 3 elects in 2022/2016, class 1 in 2024/2018, class 2 in 2026/2020. */
export const SENATE_CLASS_YEAR: Record<1 | 2 | 3, number> = { 1: 2024, 2: 2026, 3: 2022 };

export function senateUp(s: StateDef, year: number): (1 | 2 | 3)[] {
  return s.senateClasses.filter((c) => (year - SENATE_CLASS_YEAR[c]) % 6 === 0);
}

export function governorUp(s: StateDef, year: number): boolean {
  const d = year - s.govAnchor;
  return d % s.govTerm === 0;
}

/** seats for the apportionment in force in `year` */
export function seatsIn(s: StateDef, year: number): number {
  const censuses = Object.keys(s.seats).map(Number).sort((a, b) => a - b);
  let n = s.seats[censuses[0]];
  for (const c of censuses) if (year >= c + 2) n = s.seats[c];
  return n;
}

// seats: 1970 census (in force 1972-1982) and 2010 census (2012-2022).
const S = (code: string, name: string, sc: [1|2|3, 1|2|3], govTerm: 2 | 4, govAnchor: number, s70: number, s10: number): StateDef =>
  ({ code, name, senateClasses: sc, govTerm, govAnchor, seats: { 1970: s70, 2010: s10 } });

export const STATES: StateDef[] = [
  S('AL', 'Alabama', [2, 3], 4, 2022, 7, 7),
  S('AK', 'Alaska', [2, 3], 4, 2022, 1, 1),
  S('AZ', 'Arizona', [1, 3], 4, 2022, 4, 9),
  S('AR', 'Arkansas', [2, 3], 4, 2022, 4, 4),
  S('CA', 'California', [1, 3], 4, 2022, 43, 53),
  S('CO', 'Colorado', [2, 3], 4, 2022, 5, 7),
  S('CT', 'Connecticut', [1, 3], 4, 2022, 6, 5),
  S('DE', 'Delaware', [1, 2], 4, 2024, 1, 1),
  S('FL', 'Florida', [1, 3], 4, 2022, 15, 27),
  S('GA', 'Georgia', [2, 3], 4, 2022, 10, 14),
  S('HI', 'Hawaii', [1, 3], 4, 2022, 2, 2),
  S('ID', 'Idaho', [2, 3], 4, 2022, 2, 2),
  S('IL', 'Illinois', [2, 3], 4, 2022, 24, 18),
  S('IN', 'Indiana', [1, 3], 4, 2024, 11, 9),
  S('IA', 'Iowa', [2, 3], 4, 2022, 6, 4),
  S('KS', 'Kansas', [2, 3], 4, 2022, 5, 4),
  S('KY', 'Kentucky', [2, 3], 4, 2023, 7, 6),
  S('LA', 'Louisiana', [2, 3], 4, 2023, 8, 6),
  S('ME', 'Maine', [1, 2], 4, 2022, 2, 2),
  S('MD', 'Maryland', [1, 3], 4, 2022, 8, 8),
  S('MA', 'Massachusetts', [1, 2], 4, 2022, 12, 9),
  S('MI', 'Michigan', [1, 2], 4, 2022, 19, 14),
  S('MN', 'Minnesota', [1, 2], 4, 2022, 8, 8),
  S('MS', 'Mississippi', [1, 2], 4, 2023, 5, 4),
  S('MO', 'Missouri', [1, 3], 4, 2024, 10, 8),
  S('MT', 'Montana', [1, 2], 4, 2024, 2, 1),
  S('NE', 'Nebraska', [1, 2], 4, 2022, 3, 3),
  S('NV', 'Nevada', [1, 3], 4, 2022, 1, 4),
  S('NH', 'New Hampshire', [2, 3], 2, 2022, 2, 2),
  S('NJ', 'New Jersey', [1, 2], 4, 2025, 15, 12),
  S('NM', 'New Mexico', [1, 2], 4, 2022, 2, 3),
  S('NY', 'New York', [1, 3], 4, 2022, 39, 27),
  S('NC', 'North Carolina', [2, 3], 4, 2024, 11, 13),
  S('ND', 'North Dakota', [1, 3], 4, 2024, 1, 1),
  S('OH', 'Ohio', [1, 3], 4, 2022, 23, 16),
  S('OK', 'Oklahoma', [2, 3], 4, 2022, 6, 5),
  S('OR', 'Oregon', [2, 3], 4, 2022, 4, 5),
  S('PA', 'Pennsylvania', [1, 3], 4, 2022, 25, 18),
  S('RI', 'Rhode Island', [1, 2], 4, 2022, 2, 2),
  S('SC', 'South Carolina', [2, 3], 4, 2022, 6, 7),
  S('SD', 'South Dakota', [2, 3], 4, 2022, 2, 1),
  S('TN', 'Tennessee', [1, 2], 4, 2022, 8, 9),
  S('TX', 'Texas', [1, 2], 4, 2022, 24, 36),
  S('UT', 'Utah', [1, 3], 4, 2024, 2, 4),
  S('VT', 'Vermont', [1, 3], 2, 2022, 1, 1),
  S('VA', 'Virginia', [1, 2], 4, 2025, 10, 11),
  S('WA', 'Washington', [1, 3], 4, 2024, 7, 10),
  S('WV', 'West Virginia', [1, 2], 4, 2024, 4, 3),
  S('WI', 'Wisconsin', [1, 3], 4, 2022, 9, 8),
  S('WY', 'Wyoming', [1, 2], 4, 2022, 1, 1),
];

export const BY_CODE: Record<StateCode, StateDef> = Object.fromEntries(STATES.map((s) => [s.code, s]));

/** Electoral votes = delegation + 2. DC's three are added as a flat constant. */
export const DC_ELECTORS = 3;
export function electors(s: StateDef, year: number): number { return seatsIn(s, year) + 2; }
export function totalElectors(year: number): number {
  return STATES.reduce((n, s) => n + electors(s, year), 0) + DC_ELECTORS;
}
