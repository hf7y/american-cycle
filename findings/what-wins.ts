import { loadConfig, loadPacks } from '../sim/harness.ts';
import { AGENTS } from '../sim/agents.ts';
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import type { Office } from '../engine/types/index.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** A House specialist has to be at the table or the question cannot be asked:
 *  with nobody farming House seats every player holds about the same handful,
 *  and the ratio measures noise rather than whether the office pays. */
const POOL = ['Greedy', 'Lookahead', 'SenateFlood', 'HouseFarm'];
const OFFICES: Office[] = ['senator', 'representative', 'governor', 'president'];
const GAMES = sample(120);

/** Seats held at game end, split by whether the holder won.
 *
 *  `playOne` cannot answer this: GameResult carries seatsByOffice for the whole
 *  board and not who holds what, so the Game is built here and `g.seats` read
 *  after `run()`.
 */
function seatsByOutcome() {
  const cfg = loadConfig('tuned.json');
  const cards = loadPacks(['1976', '1992', '2008', '2016']);
  const winner: Record<string, number> = {};
  const rest: Record<string, number> = {};
  for (const o of OFFICES) { winner[o] = 0; rest[o] = 0; }
  for (let i = 0; i < GAMES; i++) {
    const seed = 1050400 + i;
    const rng = new RNG(seed);
    // rotate the seating each game so no strategy owns a seat
    const order = POOL.map((_, k) => POOL[(k + i) % POOL.length]);
    const g = new Game(order.map((n) => new AGENTS[n](cfg, rng)), cards, cfg, seed);
    const r = g.run();
    for (const s of g.seats) {
      if (!s.holder) continue;
      (s.holder.player === r.winner ? winner : rest)[s.office]++;
    }
  }
  const losers = POOL.length - 1;
  return Object.fromEntries(OFFICES.map((o) => {
    const per = rest[o] / (GAMES * losers);
    return [o, { winner: winner[o] / GAMES, rest: per, ratio: per ? winner[o] / GAMES / per : NaN }];
  })) as Record<Office, { winner: number; rest: number; ratio: number }>;
}

export const finding: Finding = {
  id: 'what-wins',
  dependsOn: [],
  question: 'Which offices do the players who win actually hold, and what does each score '
    + '(engine/rules/scoring.ts)?',

  headline:
    'The Senate and the presidency; everything else loses. Winners hold 2.4x the Senate seats and '
    + '3.7x the presidencies of everyone else, and 0.13x the House seats — holding House seats is '
    + 'anti-correlated with winning, not merely a weak play. That follows from what a House seat '
    + 'is: it scores 1, expires every two years, grants no hand size, and arrives attached to a '
    + 'district card that is itself ballast. Governorships have now joined it at 0.89x: they were '
    + 'read as 1.2x while one card could sit in as many as five seats at once, and correcting that '
    + 'took the whole seat count down and the governorship below parity. A governor scores '
    + 'points, gets a Senate appointment power, and carries a stepping-stone bonus into other '
    + 'races, and measured against this board none of it '
    + 'pays — which is a claim about the LAUNCHPAD being unreachable, not about the office: only '
    + '21.9% of gubernatorial elections fall in a presidential year, and a governor could reach '
    + 'the presidency only in the cycle its term expired until `resignToRun` existed.',
  stampedAt: '2026-08-31T16:16:11Z',
  stampedOn: '1fa308e',

  predicate(): Claim[] {
    const s = seatsByOutcome();
    return [
      { name: 'Senate seats: winner vs everyone else', value: s.senator.ratio, stamped: 2.42, tolerance: 0.7, unit: 'x' },
      { name: 'House seats: winner vs everyone else', value: s.representative.ratio, stamped: 0.13, tolerance: 0.15, unit: 'x' },
      { name: 'governorships: winner vs everyone else', value: s.governor.ratio, stamped: 0.89, tolerance: 0.5, unit: 'x' },
      { name: 'the presidency: winner vs everyone else', value: s.president.ratio, stamped: 3.67, tolerance: 1.6, unit: 'x' },
      { name: 'Senate seats held by the winner', value: s.senator.winner, stamped: 22.06, tolerance: 4 },
      { name: 'House seats held by the winner', value: s.representative.winner, stamped: 0.71, tolerance: 1.5 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const rank = (['Senate seats:', 'the presidency:', 'governorships:', 'House seats:'] as const)
      .map((n) => `${n.replace(/[:.]/g, '')} ${v(n).toFixed(2)}x`);
    return [
      `winner-to-field seat ratios — ${rank.join(', ')}`,
      v('House seats:') < 1 ? 'holding House seats is anti-correlated with winning' : 'House seats no longer lose',
      v('governorships:') < v('Senate seats:') / 1.5
        ? 'and the governorship is not something to plan around'
        : 'and the governorship now pays like the Senate',
    ].join('; ');
  },
};
