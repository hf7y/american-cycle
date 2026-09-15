import { readFileSync } from 'node:fs';
import type { Claim, Finding } from './types.ts';

type GovRow = [number, string, 'D' | 'R'];
type PresRow = [number, string, number, number];

function panel<T>(f: string): T {
  return JSON.parse(readFileSync(new URL(`../data/historical/${f}`, import.meta.url), 'utf8'));
}

/** State-years with both a sitting governor (D/R only, per governor_panel.json's
 *  exclusions) and a presidential general, and whether the two shared a party. */
function concordanceByYear(): Map<number, { n: number; concordant: number }> {
  const gov = panel<{ rows: GovRow[] }>('governor_panel.json').rows;
  const pres = panel<{ rows: PresRow[] }>('pres_state_panel.json').rows;
  const presWinner = new Map<string, 'D' | 'R'>();
  for (const [y, st, d, r] of pres) {
    if (d === r) continue;
    presWinner.set(`${y}|${st}`, d > r ? 'D' : 'R');
  }
  const out = new Map<number, { n: number; concordant: number }>();
  for (const [y, st, gp] of gov) {
    const pw = presWinner.get(`${y}|${st}`);
    if (!pw) continue;
    const bucket = out.get(y) ?? { n: 0, concordant: 0 };
    bucket.n++;
    if (gp === pw) bucket.concordant++;
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
  id: 'governor-cross-party',
  dependsOn: [],
  question:
    "hf7y/american-cycle#53's SIM-BRIEF target 'Governor cross-party incidence' -- against the committed "
    + 'returns, how often does a state\'s sitting governor share the winning presidential party in that '
    + "state, and does it show the same rising-nationalization trend hf7y/american-cycle#159 and "
    + 'senate-concordance.ts already measure for the Senate?',

  headline:
    'Governor/presidential concordance is lower than the Senate\'s and moves the same direction: 54.9% '
    + 'overall across the 11 presidential years 1976-2016 (506 state-years, data/historical/governor_panel.json '
    + 'against pres_state_panel.json), rising from 54.2% in 1976 to 79.4% in 2016 with a dip to 33.3% in 1984 '
    + "(Reagan's 49-state landslide against governors elected on their own, off-cycle timetables). Cross-party "
    + 'incidence -- the complement -- is high and durable: 45.1% overall, never below 20% even at the 2016 peak.',
  stampedAt: '2026-09-07T06:30:00Z',
  stampedOn: 'aebde8b',

  predicate(): Claim[] {
    const byYear = concordanceByYear();
    const y2016 = byYear.get(2016)!;
    const y1984 = byYear.get(1984)!;
    return [
      { name: 'real: governor/presidential concordance, 1976', value: shareInRange(byYear, 1976, 1976), stamped: 54.2, tolerance: 1, unit: '%' },
      { name: 'real: governor/presidential concordance, 1984', value: (100 * y1984.concordant) / y1984.n, stamped: 33.3, tolerance: 1, unit: '%' },
      { name: 'real: governor/presidential concordance, 2016', value: (100 * y2016.concordant) / y2016.n, stamped: 79.4, tolerance: 1, unit: '%' },
      { name: 'real: governor/presidential concordance, overall 1976-2016', value: shareInRange(byYear, 1976, 2016), stamped: 54.9, tolerance: 1, unit: '%' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const early = v('real: governor/presidential concordance, 1976');
    const late = v('real: governor/presidential concordance, 2016');
    const overall = v('real: governor/presidential concordance, overall 1976-2016');
    const rising = late > early;
    return [
      `overall governor/presidential concordance is ${overall.toFixed(1)}%, cross-party incidence ${(100 - overall).toFixed(1)}%`,
      rising
        ? 'and it rises from 1976 to 2016, the same nationalization direction the Senate shows'
        : 'BUT it no longer rises from 1976 to 2016 -- the Senate/governor nationalization comparison needs re-checking',
    ].join('; ');
  },
};
