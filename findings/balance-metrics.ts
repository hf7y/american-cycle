import { loadConfig, loadPacks, ALL_PACKS, BALANCE_PACKS } from '../sim/harness.ts';
import { duel, seatBias } from '../sim/roundrobin.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** SIM-BRIEF Part 2's skill-signal and seat-bias bars (hf7y/american-cycle#53),
 *  promoted from sim/roundrobin.ts's print-only instrument to a guarded
 *  predicate. The instrument's third measure -- six-way dominance -- is
 *  already a guarded claim elsewhere (`amendment-victory-dominance.ts`, on
 *  the exact six-way field this file's header names), so this covers the two
 *  SIM-BRIEF bars that weren't. */
const PLAYER_COUNTS = [2, 3, 4, 5, 6] as const;

export const finding: Finding = {
  id: 'balance-metrics',
  dependsOn: [],
  question:
    "SIM-BRIEF Part 2 sets two bars sim/roundrobin.ts measures but nothing asserts: skill signal "
    + '(Greedy should beat Random 65-80% of the time -- enough margin for skill to read, not so much '
    + 'that Random is unplayable) and seat bias (no seat position should deviate more than 3pp from a '
    + 'fair share, at every table size 2-6). Do they hold on the shipped tuned.json?',

  headline:
    'Skill signal holds: Greedy beats Random 67.7% of the time, inside the 65-80% band. Lookahead beats '
    + "Greedy 84.7% of the time on top of that -- a real planning premium, not just Greedy's own edge over "
    + 'Random. Seat bias sits close to the 3pp bar at every table size (1.0-3.0pp) rather than clearing '
    + 'it with room: 3 players measures 3.03pp, on the line, while 2/4/5/6 stay under it. The 3-player '
    + "figure is also noisy across decks -- 2.53pp on all seven eras against 3.03pp on the four-era pool "
    + "-- which is a smaller and less directionally stable gap than tracks/types.ts's own recorded swing "
    + "on the same measurement (1.17pp to 7.18pp), so this reads as sampling noise around the bar rather "
    + 'than a deck-dependent break.',
  stampedAt: '2026-09-05T16:28:34Z',
  stampedOn: '7150d2f',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(BALANCE_PACKS);
    const n = sample(1000);

    const skill = duel('Greedy', 'Random', cards, cfg, n);
    const lookahead = duel('Lookahead', 'Greedy', cards, cfg, n);

    const claims: Claim[] = [
      { name: 'skill signal: Greedy beats Random', value: 100 * skill, stamped: 67.7, tolerance: 8, unit: '%' },
      { name: 'planning premium: Lookahead beats Greedy', value: 100 * lookahead, stamped: 84.7, tolerance: 8, unit: '%' },
    ];

    const stampedBias: Record<(typeof PLAYER_COUNTS)[number], number> = { 2: 1.3, 3: 3.03, 4: 1.0, 5: 2.7, 6: 1.13 };
    for (const p of PLAYER_COUNTS) {
      const b = seatBias('Greedy', p, cards, cfg, n);
      const dev = 100 * Math.max(...b.map((x) => Math.abs(x - 1 / p)));
      claims.push({ name: `seat bias: max deviation, ${p}p`, value: dev, stamped: stampedBias[p], tolerance: 2, unit: 'pp' });
    }

    // hf7y/american-cycle#91: is 3-player seat bias itself a property of which
    // era-pack list ran it -- tracks/types.ts already records this swinging
    // 1.17pp to 7.18pp on the same measurement, so this checks it rather than
    // merely citing it.
    const cardsAll = loadPacks(ALL_PACKS);
    const b3all = seatBias('Greedy', 3, cardsAll, cfg, n);
    const dev3all = 100 * Math.max(...b3all.map((x) => Math.abs(x - 1 / 3)));
    claims.push({ name: 'seat bias: max deviation, 3p, ALL_PACKS', value: dev3all, stamped: 2.53, tolerance: 2.5, unit: 'pp' });

    return claims;
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const skill = v('skill signal: Greedy beats Random');
    const lookahead = v('planning premium: Lookahead beats Greedy');
    const biasByP = Object.fromEntries(PLAYER_COUNTS.map((p) => [p, v(`seat bias: max deviation, ${p}p`)])) as Record<number, number>;
    const worstP = PLAYER_COUNTS.reduce((a, b) => (biasByP[b] > biasByP[a] ? b : a));
    const deck = deckSensitivity([
      { pool: 'four-pack', value: v('seat bias: max deviation, 3p') },
      { pool: 'all-seven', value: v('seat bias: max deviation, 3p, ALL_PACKS') },
    ]);
    return [
      skill >= 65 && skill <= 80
        ? `skill signal holds: Greedy beats Random ${skill.toFixed(1)}% of the time, inside SIM-BRIEF's 65-80% band`
        : `skill signal is OUT of SIM-BRIEF's 65-80% band: Greedy beats Random ${skill.toFixed(1)}% of the time`,
      `Lookahead beats Greedy ${lookahead.toFixed(1)}% of the time`,
      biasByP[worstP] > 3
        ? `seat bias is past the 3pp bar at ${worstP} players (${biasByP[worstP].toFixed(1)}pp); the rest stay under it`
        : `seat bias stays inside the 3pp bar at every table size 2-6 (worst: ${worstP}p at ${biasByP[worstP].toFixed(1)}pp)`,
      deck.sensitive
        ? `and 3-player seat bias is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['four-pack'].toFixed(1)}pp four-pack vs ${deck.byPool['all-seven'].toFixed(1)}pp all-seven`
        : 'and 3-player seat bias held stable between the four-pack and all-seven decks (hf7y/american-cycle#91)',
    ].join('; ');
  },
};
