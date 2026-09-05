import { readFileSync } from 'node:fs';
import { loadConfig } from '../sim/harness.ts';
import type { Claim, Finding } from './types.ts';

/** Two of hf7y/american-cycle#53's uncovered SIM-BRIEF targets:
 *
 *    Presidential party turnover (roughly even, conditioned on economy)
 *    Midterm losses, president's party (19 of last 21; avg ~26 seats)
 *
 *  Both are real-world facts, so they are answered from returns, not from
 *  play. `data/historical/pres_state_panel.json` and
 *  `house_district_panel.json` carry two-party VOTE totals (MEDSL), not who
 *  actually held the White House -- and votes alone get 2000 and 2016 wrong
 *  (Bush and Trump each won the Electoral College while losing the
 *  committed panel's two-party popular vote). "President's party" is a
 *  fact about the Electoral College, not a derived statistic, so it is
 *  listed directly below rather than mis-inferred from vote totals -- the
 *  same way `engine/game.ts`'s own comments cite the 1998 midterm's date
 *  as a fact, not a measurement. */
const PRESIDENT_PARTY: Record<number, 'D' | 'R'> = {
  1976: 'D', 1980: 'R', 1984: 'R', 1988: 'R', 1992: 'D', 1996: 'D',
  2000: 'R', 2004: 'R', 2008: 'D', 2012: 'D', 2016: 'R',
};

const panel = (f: string) =>
  JSON.parse(readFileSync(new URL(`../data/historical/${f}`, import.meta.url), 'utf8')).rows as number[][];

/** D/R House seats won that year -- one seat per district, ties (none in
 *  this panel) counted toward neither. */
function houseSeats(rows: number[][]): Record<number, [number, number]> {
  const seats: Record<number, [number, number]> = {};
  for (const [y, , , dem, rep] of rows) {
    const [d, r] = seats[y] ?? [0, 0];
    seats[y] = dem > rep ? [d + 1, r] : rep > dem ? [d, r + 1] : [d, r];
  }
  return seats;
}

export const finding: Finding = {
  id: 'midterm-and-turnover',
  dependsOn: ['as-written-plus.json'],
  question:
    "SIM-BRIEF names two uncovered targets (hf7y/american-cycle#53): presidential party turnover "
    + '("roughly even, conditioned on economy") and midterm losses for the president\'s party '
    + '("19 of last 21; avg ~26 seats"). Do real returns bear them out over the window the committed '
    + "panels cover, and does the shipped midterm penalty point the right way?",

  headline:
    'Both hold, over a shorter window than the target names. The presidency changed party in 5 of the '
    + '10 elections 1976-2016 -- exactly even. The president\'s party lost House seats in 9 of the 11 '
    + 'midterms 1978-2018 (81.8%, against the target\'s 19-of-21 90.5% over a longer run starting 1934), '
    + 'averaging -22.7 seats net (-29.3 among the losses alone) against the target\'s ~26. The two '
    + 'exceptions this window can see, 1998 and 2002, are the two exceptions political history already '
    + "names. as-written-plus.json's midtermPenalty ships at -2, correctly signed against the "
    + 'president\'s party.',
  stampedAt: '2026-09-05T20:27:15Z',
  stampedOn: '0385b918488dcba1166dc973e696a2b501d8afdc',

  predicate(): Claim[] {
    const presYears = Object.keys(PRESIDENT_PARTY).map(Number).sort((a, b) => a - b);
    let turnovers = 0;
    for (let i = 1; i < presYears.length; i++) {
      if (PRESIDENT_PARTY[presYears[i]] !== PRESIDENT_PARTY[presYears[i - 1]]) turnovers++;
    }

    const seats = houseSeats(panel('house_district_panel.json'));
    const midtermYears = presYears.map((y) => y + 2).filter((y) => seats[y] && seats[y - 2]);
    const netChanges = midtermYears.map((y) => {
      const presParty = PRESIDENT_PARTY[y - 2];
      const idx = presParty === 'D' ? 0 : 1;
      return seats[y][idx] - seats[y - 2][idx];
    });
    const losses = netChanges.filter((c) => c < 0);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

    const cfg = loadConfig('as-written-plus.json');

    return [
      { name: 'presidential elections with a party turnover, 1976-2016', value: (100 * turnovers) / (presYears.length - 1), stamped: 50, tolerance: 0, unit: '%' },
      { name: "midterms where the president's party lost House seats, 1978-2018", value: (100 * losses.length) / netChanges.length, stamped: 81.818, tolerance: 0.01, unit: '%' },
      { name: "mean net House seat change for the president's party at a midterm, 1978-2018", value: mean(netChanges), stamped: -22.727, tolerance: 0.01, unit: 'seats' },
      { name: "mean House seat loss among losing midterms, 1978-2018", value: mean(losses), stamped: -29.333, tolerance: 0.01, unit: 'seats' },
      { name: "as-written-plus.json national.midtermPenalty", value: cfg.national.midtermPenalty, stamped: -2, tolerance: 0, unit: 'pips' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    return [
      `party turnover ${v('presidential elections').toFixed(1)}% across 1976-2016 -- "roughly even" holds`,
      `the president's party lost House seats in ${v('midterms where').toFixed(1)}% of 1978-2018's midterms `
        + `(mean ${v('mean net').toFixed(1)} net, ${v('mean House seat loss').toFixed(1)} among the losses), `
        + `in the same range as SIM-BRIEF's 19-of-21 / ~26-seat target measured over a window starting in 1934`,
      `and the shipped midtermPenalty (${v('as-written-plus.json').toFixed(0)} pips) is signed against the `
        + 'president\'s party, matching the direction both figures above require',
    ].join('; ');
  },
};
