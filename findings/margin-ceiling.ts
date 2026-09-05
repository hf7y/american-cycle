import { readFileSync } from 'node:fs';
import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from '../sim/harness.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** The real distribution is DATA, not a number retyped into prose: 9,555 House
 *  generals 1976-2018 (MIT Election Lab), re-read every run so that revising
 *  the data set moves the claim instead of silently contradicting it. */
function real() {
  const url = new URL('../data/historical/baseline.json', import.meta.url);
  const f = JSON.parse(readFileSync(url, 'utf8')) as {
    derived: {
      house_median_abs_margin_pts: number;
      house_safe_40plus_pct: number;
      house_competitive_under10_pct: number;
    };
  };
  return f.derived;
}

/** Every CONTESTED House general over `seeds` games, as a margin in POINTS —
 *  the engine's settled scale calibrates 1 pip = 2 points (DECISIONS.md).
 *
 *  Walkovers are excluded because they have no margin: `resolution.ts` reports
 *  0 for a one-candidate race, and folding the walkover pile in as zeroes would
 *  measure the walkover rate wearing a histogram's clothes. The
 *  qualification that reality encodes a safe seat as a 40-point win where this
 *  game encodes it as a walkover is real, and it is argued in the headline
 *  rather than smuggled into the sample.
 *
 *  Config is `tuned` as shipped, including its 16-year cap; only the start year
 *  moves, because the talon is era-ordered oldest-first and a seven-pack pool
 *  deals 1932 cards whatever the calendar says. */
function simMargins(packs = ['1932', '1964', '1976', '1992', '2008', '2016', '2024'], seeds = sample(60)) {
  const base = loadConfig('tuned.json');
  const cards = loadPacks(packs);
  const cfg = { ...base, game: { ...base.game, startYear: 1932 } };
  const pts: number[] = [];
  for (let i = 0; i < seeds; i++) {
    for (const e of playOne(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg as never, 1030000 + i).events) {
      if (e.office === 'representative' && e.round === 'general' && !e.uncontested) pts.push(2 * Math.abs(e.margin));
    }
  }
  pts.sort((a, b) => a - b);
  const pct = (ok: (p: number) => boolean) => (100 * pts.filter(ok).length) / pts.length;
  return {
    median: pts[Math.floor(pts.length / 2)],
    safe: pct((p) => p >= 40),
    competitive: pct((p) => p < 10),
  };
}

export const finding: Finding = {
  id: 'margin-ceiling',
  dependsOn: [],
  question:
    'Does the margin distribution reproduce the real bimodal one, or the unimodal blob SIM-BRIEF '
    + 'flags in Part 5 -- and is that gap a defect in the "1 pip = 2 points" conversion, or the '
    + 'walkover/blowout definitional split DECISIONS.md now names (hf7y/american-cycle#11)?',

  headline:
    'The blob. Simulated House margins sit at a median of 8 points against a real 32.5; safe seats — '
    + '37.5% of real races — do not occur at all, at 0.0% of the simulated corpus; and 55.8% of '
    + 'simulated races land under 10 points against a real 13.5%. The ceiling is arithmetic: a '
    + 'margin is the modifier difference plus 3d6-3d6, a large realistic stack is +8 pips, and at 2 '
    + 'points a pip the game cannot express a 40-point win at all. The one qualification in the '
    + "sim's favour is that it encodes a safe seat as a WALKOVER where reality encodes it as a "
    + 'contested race won by forty, so the two distributions are partly the same phenomenon in '
    + 'different clothes; the gap narrows and does not close.',
  stampedAt: '2026-09-05T06:59:12Z',
  stampedOn: '2021e16',

  predicate(): Claim[] {
    const sim = simMargins();
    const r = real();
    // hf7y/american-cycle#91: is the headline median-margin figure itself a
    // property of which era-pack list ran it, same config/agents/seeds?
    const simBalance = simMargins(BALANCE_PACKS);
    return [
      { name: 'sim: median House margin', value: sim.median, stamped: 10, tolerance: 3, unit: 'pts' },
      { name: 'real: median House margin', value: r.house_median_abs_margin_pts, stamped: 32.5, tolerance: 0.5, unit: 'pts' },
      { name: 'sim: safe seats, 40+ pts', value: sim.safe, stamped: 0.81, tolerance: 2, unit: '%' },
      { name: 'real: safe seats, 40+ pts', value: r.house_safe_40plus_pct, stamped: 37.5, tolerance: 0.5, unit: '%' },
      { name: 'sim: competitive, under 10 pts', value: sim.competitive, stamped: 49.59, tolerance: 8, unit: '%' },
      { name: 'real: competitive, under 10 pts', value: r.house_competitive_under10_pct, stamped: 13.5, tolerance: 0.5, unit: '%' },
      { name: 'sim: median House margin, BALANCE_PACKS', value: simBalance.median, stamped: 10, tolerance: 3, unit: 'pts' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const compressed = v('sim: median House margin') < v('real: median House margin') / 2;
    const noSafeSeats = v('sim: safe seats, 40+ pts') < v('real: safe seats, 40+ pts') / 10;
    const crowded = v('sim: competitive, under 10 pts') > 2 * v('real: competitive, under 10 pts');
    const deck = deckSensitivity([
      { pool: 'all-seven', value: v('sim: median House margin') },
      { pool: 'four-pack', value: v('sim: median House margin, BALANCE_PACKS') },
    ]);
    return [
      compressed ? 'the simulated spread is a fraction of the real one' : 'the simulated spread now matches the real one',
      noSafeSeats ? 'safe seats do not occur' : 'safe seats occur',
      crowded ? 'and the mass piles into the competitive tail: a unimodal blob' : 'and the competitive tail is no longer overfull',
      deck.sensitive
        ? `and the sim median margin is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['all-seven'].toFixed(1)} all-seven vs ${deck.byPool['four-pack'].toFixed(1)} four-pack pts`
        : 'and the sim median margin held stable between the all-seven and four-pack decks (hf7y/american-cycle#91)',
    ].join('; ');
  },
};
