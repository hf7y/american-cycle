import { loadConfig, loadPacks } from '../sim/harness.ts';
import { Game } from '../engine/game.ts';
import { AGENTS } from '../sim/agents.ts';
import { RNG } from '../engine/rules/rng.ts';
import type { Claim, Finding } from './types.ts';

/** What actually happens in an odd year, versus an even one. */
function measure(billFrequency: 'annual' | 'biennial', seeds = 60) {
  const base = loadConfig('tuned.json');
  const cards = loadPacks(['1932', '1964', '1976', '1992', '2008', '2016', '2024']);
  const cfg = {
    ...base,
    legislature: { ...base.legislature, billFrequency },
    game: { ...base.game, maxYears: 16, victory: 'points' },
  };
  const odd = { bill: 0, years: 0 }, even = { bill: 0, races: 0, years: 0 };
  for (let i = 0; i < seeds; i++) {
    const rng = new RNG(1040000 + i);
    const names = ['Greedy', 'Lookahead', 'SenateFlood', 'BillMaximizer'];
    const g = new Game(names.map((n) => new AGENTS[n](cfg as never, rng)), cards, cfg as never, 1040000 + i);
    while (g.year < cfg.game.startYear + cfg.game.maxYears) {
      const y = g.year, n0 = g.log.length, e0 = g.events.length;
      g.tick();
      const bills = g.log.slice(n0).filter((l) => l.includes('omnibill')).length;
      if (y % 2 === 0) { even.years++; even.bill += bills; even.races += g.events.length - e0; }
      else { odd.years++; odd.bill += bills; }
    }
  }
  return {
    oddBills: odd.bill / odd.years,
    evenBills: even.bill / even.years,
    evenRaces: even.races / even.years,
  };
}

export const finding: Finding = {
  id: 'odd-year-is-the-bill',
  question:
    'Should the game run on two-year cycles rather than annual ticks — i.e. what is left in the odd '
    + 'year, and what happens if the omnibill is biennial too? (§7)',

  headline:
    'The omnibill is the ONLY thing in an odd year. Biennial decay already skips odd years and '
    + 'elections are already biennial, so as written an odd year is exactly one bill (1.00) and a Fed '
    + 'check. Make the bill biennial and the odd year is literally empty (0.00 bills), at which point '
    + 'the annual tick has no reason to exist and the game should collapse to two-year cycles. Keeping '
    + 'the annual bill is defensible — it gives the bill an uncontested stage and yields two bills per '
    + 'election cycle — but the odd year exists to serve the bill and nothing else.',
  stampedAt: '2026-08-31T09:55:00Z',
  stampedOn: 'phase1-engine',

  predicate(): Claim[] {
    const annual = measure('annual');
    const biennial = measure('biennial');
    return [
      { name: 'annual bill: bills in an odd year', value: annual.oddBills, stamped: 1.00, tolerance: 0.15 },
      { name: 'annual bill: bills in an even year', value: annual.evenBills, stamped: 0.88, tolerance: 0.15 },
      { name: 'annual bill: races in an even year', value: annual.evenRaces, stamped: 56.67, tolerance: 15 },
      { name: 'biennial bill: bills in an odd year', value: biennial.oddBills, stamped: 0.00, tolerance: 0.05 },
      { name: 'biennial bill: bills in an even year', value: biennial.evenBills, stamped: 0.88, tolerance: 0.15 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const oddIsOnlyBill = v('annual bill: bills in an odd') > 0.5;
    const emptyIfBiennial = v('biennial bill: bills in an odd') < 0.05;
    return [
      oddIsOnlyBill ? 'the odd year holds a bill and nothing else' : 'the odd year holds more than a bill',
      emptyIfBiennial
        ? 'and a biennial bill empties it completely, so the game should then be two-year cycles'
        : 'and a biennial bill leaves something in it',
    ].join('; ');
  },
};
