/** The board: states, their Senate classes, and their gubernatorial schedules
 *  -- a per-state table of gubernatorial election years. */

export type StateCode = string;

export interface StateDef {
  code: StateCode;
  name: string;
  /** The two Senate classes this state elects. Class 1 → 2024, 2 → 2026, 3 → 2022. */
  senateClasses: [1 | 2 | 3, 1 | 2 | 3];
  /** Governor election schedule, oldest first. Each entry's term applies from
   *  its own `from` year until superseded by the next entry (or forever, for
   *  the last one) -- most states carry one, a handful moved terms mid-window.
   *  hf7y/american-cycle#18: the 2026 table alone misplaces 16.2% of every
   *  governor's race 1932-2024 (44.7% in presidential years), because term
   *  length and election-year phase both drifted and a single anchor cannot
   *  express New Jersey's three-year terms before 1949 at all. Derived from
   *  data/historical/governor-rules.json's election_year_segments. */
  govSchedule: { from: number; term: number }[];
  /** House delegation by apportionment era, keyed by the census that set it. */
  seats: Record<number, number>;
}

/** Class 3 elects in 2022/2016, class 1 in 2024/2018, class 2 in 2026/2020. */
export const SENATE_CLASS_YEAR: Record<1 | 2 | 3, number> = { 1: 2024, 2: 2026, 3: 2022 };

export function senateUp(s: StateDef, year: number): (1 | 2 | 3)[] {
  return s.senateClasses.filter((c) => (year - SENATE_CLASS_YEAR[c]) % 6 === 0);
}

export function governorUp(s: StateDef, year: number): boolean {
  // The schedule is chronological; the entry in force is the last one whose
  // `from` has arrived. Its own `from` is the anchor for that phase -- a
  // state that moved terms also moved *which* years within the cycle it
  // elects on, so an old anchor carried forward would get the phase wrong
  // even after the term length itself was corrected (see #18's residual
  // states: FL, IL, LA, NJ, HI).
  let entry = s.govSchedule[0];
  for (const e of s.govSchedule) { if (e.from > year) break; entry = e; }
  return (year - entry.from) % entry.term === 0;
}

/** seats for the apportionment in force in `year` */
export function seatsIn(s: StateDef, year: number): number {
  const censuses = Object.keys(s.seats).map(Number).sort((a, b) => a - b);
  let n = s.seats[censuses[0]];
  for (const c of censuses) if (year >= c + 2) n = s.seats[c];
  return n;
}

// seats: 1970 census (in force 1972-1982) and 2010 census (2012-2022).
type Sched = { from: number; term: number }[];
const mkState = (code: string, name: string, sc: [1|2|3, 1|2|3], govSchedule: Sched, s70: number, s10: number): StateDef =>
  ({ code, name, senateClasses: sc, govSchedule, seats: { 1970: s70, 2010: s10 } });

// Governor schedules below are hf7y/american-cycle#18's election_year_segments
// (data/historical/governor-rules.json), one literal entry per historical
// term-length/anchor phase -- not hand-derived. AK and HI schedules start at
// their first territorial-era election (1958/1959); before that they simply
// never race, which is more correct than the old flat 2022 anchor letting
// pre-statehood governor races fire at all.
export const STATES: StateDef[] = [
  mkState('AL', 'Alabama', [2, 3], [{ from: 1930, term: 4 }], 7, 7),
  mkState('AK', 'Alaska', [2, 3], [{ from: 1958, term: 4 }], 1, 1),
  mkState('AZ', 'Arizona', [1, 3], [{ from: 1930, term: 2 }, { from: 1970, term: 4 }], 4, 9),
  mkState('AR', 'Arkansas', [2, 3], [{ from: 1930, term: 2 }, { from: 1986, term: 4 }], 4, 4),
  mkState('CA', 'California', [1, 3], [{ from: 1930, term: 4 }], 43, 53),
  mkState('CO', 'Colorado', [2, 3], [{ from: 1930, term: 2 }, { from: 1958, term: 4 }], 5, 7),
  mkState('CT', 'Connecticut', [1, 3], [{ from: 1930, term: 2 }, { from: 1950, term: 4 }], 6, 5),
  mkState('DE', 'Delaware', [1, 2], [{ from: 1932, term: 4 }], 1, 1),
  mkState('FL', 'Florida', [1, 3], [{ from: 1932, term: 4 }, { from: 1964, term: 2 }, { from: 1966, term: 4 }], 15, 27),
  mkState('GA', 'Georgia', [2, 3], [{ from: 1930, term: 2 }, { from: 1942, term: 4 }], 10, 14),
  mkState('HI', 'Hawaii', [1, 3], [{ from: 1959, term: 3 }, { from: 1962, term: 4 }], 2, 2),
  mkState('ID', 'Idaho', [2, 3], [{ from: 1930, term: 2 }, { from: 1946, term: 4 }], 2, 2),
  mkState('IL', 'Illinois', [2, 3], [{ from: 1932, term: 4 }, { from: 1976, term: 2 }, { from: 1978, term: 4 }], 24, 18),
  mkState('IN', 'Indiana', [1, 3], [{ from: 1932, term: 4 }], 11, 9),
  mkState('IA', 'Iowa', [2, 3], [{ from: 1930, term: 2 }, { from: 1974, term: 4 }], 6, 4),
  mkState('KS', 'Kansas', [2, 3], [{ from: 1930, term: 2 }, { from: 1974, term: 4 }], 5, 4),
  mkState('KY', 'Kentucky', [2, 3], [{ from: 1931, term: 4 }], 7, 6),
  mkState('LA', 'Louisiana', [2, 3], [{ from: 1932, term: 4 }, { from: 1975, term: 4 }], 8, 6),
  mkState('ME', 'Maine', [1, 2], [{ from: 1930, term: 2 }, { from: 1958, term: 4 }], 2, 2),
  mkState('MD', 'Maryland', [1, 3], [{ from: 1930, term: 4 }], 8, 8),
  mkState('MA', 'Massachusetts', [1, 2], [{ from: 1930, term: 2 }, { from: 1966, term: 4 }], 12, 9),
  mkState('MI', 'Michigan', [1, 2], [{ from: 1930, term: 2 }, { from: 1966, term: 4 }], 19, 14),
  mkState('MN', 'Minnesota', [1, 2], [{ from: 1930, term: 2 }, { from: 1962, term: 4 }], 8, 8),
  mkState('MS', 'Mississippi', [1, 2], [{ from: 1931, term: 4 }], 5, 4),
  mkState('MO', 'Missouri', [1, 3], [{ from: 1932, term: 4 }], 10, 8),
  mkState('MT', 'Montana', [1, 2], [{ from: 1932, term: 4 }], 2, 1),
  mkState('NE', 'Nebraska', [1, 2], [{ from: 1930, term: 2 }, { from: 1966, term: 4 }], 3, 3),
  mkState('NV', 'Nevada', [1, 3], [{ from: 1930, term: 4 }], 1, 4),
  mkState('NH', 'New Hampshire', [2, 3], [{ from: 1930, term: 2 }], 2, 2),
  mkState('NJ', 'New Jersey', [1, 2], [{ from: 1931, term: 3 }, { from: 1949, term: 4 }], 15, 12),
  mkState('NM', 'New Mexico', [1, 2], [{ from: 1930, term: 2 }, { from: 1970, term: 4 }], 2, 3),
  mkState('NY', 'New York', [1, 3], [{ from: 1930, term: 2 }, { from: 1938, term: 4 }], 39, 27),
  mkState('NC', 'North Carolina', [2, 3], [{ from: 1932, term: 4 }], 11, 13),
  mkState('ND', 'North Dakota', [1, 3], [{ from: 1930, term: 2 }, { from: 1964, term: 4 }], 1, 1),
  mkState('OH', 'Ohio', [1, 3], [{ from: 1930, term: 2 }, { from: 1958, term: 4 }], 23, 16),
  mkState('OK', 'Oklahoma', [2, 3], [{ from: 1930, term: 4 }], 6, 5),
  mkState('OR', 'Oregon', [2, 3], [{ from: 1930, term: 4 }], 4, 5),
  mkState('PA', 'Pennsylvania', [1, 3], [{ from: 1930, term: 4 }], 25, 18),
  mkState('RI', 'Rhode Island', [1, 2], [{ from: 1930, term: 2 }, { from: 1994, term: 4 }], 2, 2),
  mkState('SC', 'South Carolina', [2, 3], [{ from: 1930, term: 4 }], 6, 7),
  mkState('SD', 'South Dakota', [2, 3], [{ from: 1930, term: 2 }, { from: 1974, term: 4 }], 2, 1),
  mkState('TN', 'Tennessee', [1, 2], [{ from: 1930, term: 2 }, { from: 1954, term: 4 }], 8, 9),
  mkState('TX', 'Texas', [1, 2], [{ from: 1930, term: 2 }, { from: 1974, term: 4 }], 24, 36),
  mkState('UT', 'Utah', [1, 3], [{ from: 1932, term: 4 }], 2, 4),
  mkState('VT', 'Vermont', [1, 3], [{ from: 1930, term: 2 }], 1, 1),
  mkState('VA', 'Virginia', [1, 2], [{ from: 1929, term: 4 }], 10, 11),
  mkState('WA', 'Washington', [1, 3], [{ from: 1932, term: 4 }], 7, 10),
  mkState('WV', 'West Virginia', [1, 2], [{ from: 1932, term: 4 }], 4, 3),
  mkState('WI', 'Wisconsin', [1, 3], [{ from: 1930, term: 2 }, { from: 1970, term: 4 }], 9, 8),
  mkState('WY', 'Wyoming', [1, 2], [{ from: 1930, term: 4 }], 1, 1),
];

export const BY_CODE: Record<StateCode, StateDef> = Object.fromEntries(STATES.map((s) => [s.code, s]));

/** Electoral votes = delegation + 2. DC's three are added as a flat constant. */
export const DC_ELECTORS = 3;
export function electors(s: StateDef, year: number): number { return seatsIn(s, year) + 2; }
export function totalElectors(year: number): number {
  return STATES.reduce((n, s) => n + electors(s, year), 0) + DC_ELECTORS;
}
