import { readFileSync } from 'node:fs';
import type { Claim, Finding } from './types.ts';

type SenateRow = [number, string, number, number, string | null, string | null, number];
type PresRow = [number, string, number, number];

function panel<T>(f: string): T {
  return JSON.parse(readFileSync(new URL(`../data/historical/${f}`, import.meta.url), 'utf8'));
}

/** State-years with both a Senate general and a presidential general (the
 *  only years a "split ticket" can be observed at the top and the Senate
 *  line simultaneously), and whether the two winners shared a party. */
function concordanceByYear(): Map<number, { n: number; concordant: number }> {
  const senate = panel<{ rows: SenateRow[] }>('senate_panel.json').rows;
  const pres = panel<{ rows: PresRow[] }>('pres_state_panel.json').rows;
  const presWinner = new Map<string, 'D' | 'R'>();
  for (const [y, st, d, r] of pres) {
    if (d === r) continue;
    presWinner.set(`${y}|${st}`, d > r ? 'D' : 'R');
  }
  const out = new Map<number, { n: number; concordant: number }>();
  for (const [y, st, d, r] of senate) {
    if (d === r) continue;
    const pw = presWinner.get(`${y}|${st}`);
    if (!pw) continue;
    const sw: 'D' | 'R' = d > r ? 'D' : 'R';
    const bucket = out.get(y) ?? { n: 0, concordant: 0 };
    bucket.n++;
    if (sw === pw) bucket.concordant++;
    out.set(y, bucket);
  }
  return out;
}

function shareInRange(byYear: Map<number, { n: number; concordant: number }>, lo: number, hi: number): number {
  let n = 0, c = 0;
  for (const [y, v] of byYear) if (y >= lo && y <= hi) { n += v.n; c += v.concordant; }
  return (100 * c) / n;
}

export const finding: Finding = {
  id: 'senate-concordance',
  dependsOn: [],
  question:
    "HISTORICAL-CASES.md's H2 (split-ticket collapse): \"By 2016 every one of 34 Senate races matched "
    + 'its state\'s presidential winner\" -- is that literally true against the committed returns, and '
    + 'does the wider trend it claims (monotonic decline in split-ticket voting across eras) hold up '
    + 'against the era-pack boundaries the engine actually ships (1976/1992/2008/2016)?',

  headline:
    "H2's 2016 claim is exact: 34 of 34 state-years with both a Senate and a presidential general in "
    + "2016 went to the same party (data/historical/senate_panel.json against pres_state_panel.json). "
    + 'The wider trend is monotonic across the engine\'s own era-pack boundaries too, not just the two '
    + 'endpoints H2 quotes: 52.3% concordant in the 1976-1990 pack window, 71.6% in 1992-2006, 84.0% in '
    + '2008-2016. This is a real, uncalibrated trend in the source data -- nothing here reads or writes '
    + 'engine config, since the nationalization-knob mechanism H2 asks for (a per-pack nationalization '
    + 'coupling) is hf7y/american-cycle#84/#92 territory, not this finding\'s.',
  stampedAt: '2026-09-05T21:30:00Z',
  stampedOn: '095ce3f',

  predicate(): Claim[] {
    const byYear = concordanceByYear();
    const y2016 = byYear.get(2016)!;
    return [
      { name: 'real: Senate/presidential concordance, 2016', value: (100 * y2016.concordant) / y2016.n, stamped: 100, tolerance: 0, unit: '%' },
      { name: 'real: Senate/presidential concordance, 1976-1990 pack window', value: shareInRange(byYear, 1976, 1990), stamped: 52.3, tolerance: 1, unit: '%' },
      { name: 'real: Senate/presidential concordance, 1992-2006 pack window', value: shareInRange(byYear, 1992, 2006), stamped: 71.6, tolerance: 1, unit: '%' },
      { name: 'real: Senate/presidential concordance, 2008-2016 pack window', value: shareInRange(byYear, 2008, 2016), stamped: 84.0, tolerance: 1, unit: '%' },
      { name: 'real: Senate/presidential concordance, overall 1976-2016', value: shareInRange(byYear, 1976, 2016), stamped: 68.0, tolerance: 1, unit: '%' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const early = v('real: Senate/presidential concordance, 1976-1990 pack window');
    const mid = v('real: Senate/presidential concordance, 1992-2006 pack window');
    const late = v('real: Senate/presidential concordance, 2008-2016 pack window');
    const monotonic = early < mid && mid < late;
    const exact2016 = v('real: Senate/presidential concordance, 2016') === 100;
    return [
      exact2016 ? "H2's 34/34 claim for 2016 holds exactly" : "H2's 2016 claim no longer holds exactly against the committed data",
      monotonic
        ? 'and concordance rises monotonically across the three era-pack windows, same direction H2 claims'
        : 'BUT the era-pack windows are no longer monotonic -- H2\'s trend claim needs re-checking',
    ].join('; ');
  },
};
