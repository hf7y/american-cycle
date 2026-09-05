import { loadConfig, loadPacks, BALANCE_PACKS } from '../sim/harness.ts';
import { Game } from '../engine/game.ts';
import { AGENTS } from '../sim/agents.ts';
import { RNG } from '../engine/rules/rng.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** What actually happens in an odd year, versus an even one.
 *
 *  Crossed with decay frequency, because that is the other thing that can
 *  occupy an odd year: with ANNUAL decay the odd year carries a decay step
 *  even when the bill does not, so "is the odd year empty" is a question about
 *  both choices and not one. */
function measure(
  billFrequency: 'annual' | 'biennial',
  decayFrequency: 'annual' | 'biennial',
  packs = ['1932', '1964', '1976', '1992', '2008', '2016', '2024'],
  seeds = sample(40),
) {
  const base = loadConfig('tuned.json');
  const cards = loadPacks(packs);
  const cfg = {
    ...base,
    legislature: { ...base.legislature, billFrequency },
    lean: { ...base.lean, decayFrequency },
    game: { ...base.game, maxYears: 16, victory: 'points' },
  };
  const odd = { bill: 0, decay: 0, years: 0 }, even = { bill: 0, races: 0, years: 0 };
  for (let i = 0; i < seeds; i++) {
    const rng = new RNG(1040000 + i);
    const names = ['Greedy', 'Lookahead', 'SenateFlood', 'BillMaximizer'];
    const g = new Game(names.map((n) => new AGENTS[n](cfg as never, rng)), cards, cfg as never, 1040000 + i);
    while (g.year < cfg.game.startYear + cfg.game.maxYears) {
      const y = g.year, n0 = g.log.length, e0 = g.events.length;
      const leanBefore = JSON.stringify(g.leanMap);
      g.tick();
      const bills = g.log.slice(n0).filter((l) => l.includes('omnibill')).length;
      if (y % 2 === 0) { even.years++; even.bill += bills; even.races += g.events.length - e0; }
      else {
        odd.years++; odd.bill += bills;
        // a decay step is observable as the map moving in a year with no election
        if (JSON.stringify(g.leanMap) !== leanBefore) odd.decay++;
      }
    }
  }
  return {
    oddBills: odd.bill / odd.years,
    oddDecays: odd.decay / odd.years,
    evenBills: even.bill / even.years,
    evenRaces: even.races / even.years,
  };
}

export const finding: Finding = {
  id: 'odd-year-is-the-bill',
  dependsOn: [],
  question:
    'Should the game run on two-year cycles rather than annual ticks — i.e. what is left in the odd '
    + 'year, and what happens if the omnibill is biennial too?',

  headline:
    'Whether the odd year is empty depends on TWO choices, not one. With biennial decay (the shipped '
    + 'baseline) an odd year is exactly one bill and a Fed check, so a biennial bill empties it '
    + 'completely and the game should collapse to two-year cycles. With ANNUAL decay the odd year still '
    + 'carries a decay step, so it survives a biennial bill — the map keeps moving between elections '
    + 'even when the legislature is silent. So: biennial decay + biennial bill is the combination that '
    + 'makes the annual tick pointless, and it is the only one that does.',
  stampedAt: '2026-09-03T22:09:48Z',
  stampedOn: 'eb1d185',

  predicate(): Claim[] {
    const bienBien = measure('biennial', 'biennial');   // the empty odd year
    const bienAnn = measure('biennial', 'annual');      // decay still occupies it
    const annBien = measure('annual', 'biennial');      // the shipped baseline
    // hf7y/american-cycle#91: is the shipped-baseline "bills in an odd year"
    // figure itself a property of which era-pack list ran it?
    const annBienBalance = measure('annual', 'biennial', BALANCE_PACKS);
    return [
      { name: 'bill annual + decay biennial: bills in an odd year', value: annBien.oddBills, stamped: 0.77, tolerance: 0.15 },
      { name: 'bill annual + decay biennial: decay steps in an odd year', value: annBien.oddDecays, stamped: 0.84, tolerance: 0.10 },
      { name: 'bill annual + decay biennial: races in an even year', value: annBien.evenRaces, stamped: 70.17, tolerance: 15 },
      { name: 'bill biennial + decay biennial: bills in an odd year', value: bienBien.oddBills, stamped: 0, tolerance: 0.05 },
      { name: 'bill biennial + decay biennial: decay steps in an odd year', value: bienBien.oddDecays, stamped: 0, tolerance: 0.10 },
      { name: 'bill biennial + decay ANNUAL: decay steps in an odd year', value: bienAnn.oddDecays, stamped: 1, tolerance: 0.25 },
      { name: 'bill annual + decay biennial, BALANCE_PACKS: bills in an odd year', value: annBienBalance.oddBills, stamped: 0.82, tolerance: 0.15 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const exact = (n: string) => c.find((x) => x.name === n)!.value;
    const baselineOddIsBill = v('bill annual + decay biennial: bills') > 0.5
      && v('bill annual + decay biennial: decay') < 0.1;
    const trulyEmpty = v('bill biennial + decay biennial: bills') < 0.05
      && v('bill biennial + decay biennial: decay') < 0.1;
    const decayRescues = v('bill biennial + decay ANNUAL: decay') > 0.5;
    const deck = deckSensitivity([
      { pool: 'all-seven', value: exact('bill annual + decay biennial: bills in an odd year') },
      { pool: 'four-pack', value: exact('bill annual + decay biennial, BALANCE_PACKS: bills in an odd year') },
    ]);
    return [
      baselineOddIsBill ? 'at the shipped baseline the odd year is a bill and nothing else' : 'the odd year holds more than a bill',
      trulyEmpty ? 'biennial bill + biennial decay empties it entirely' : 'no combination empties it',
      decayRescues ? 'but annual decay keeps it occupied even with no bill' : 'and annual decay does not save it',
      deck.sensitive
        ? `and the baseline odd-year-bill figure is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['all-seven'].toFixed(2)} all-seven vs ${deck.byPool['four-pack'].toFixed(2)} four-pack`
        : 'and the baseline odd-year-bill figure held stable between the all-seven and four-pack decks (hf7y/american-cycle#91)',
    ].join('; ');
  },
};
