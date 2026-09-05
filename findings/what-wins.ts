import { loadConfig, loadPacks, ALL_PACKS } from '../sim/harness.ts';
import { AGENTS } from '../sim/agents.ts';
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { deckSensitivity } from '../tracks/types.ts';
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
function seatsByOutcome(packs = ['1976', '1992', '2008', '2016']) {
  const cfg = loadConfig('tuned.json');
  const cards = loadPacks(packs);
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
    'Re-measured for hf7y/american-cycle#13, which asked for a dedicated pass rather than a byproduct '
    + 'number after `tuned.json` and `as-written-plus.json` both moved to `victory: \'amendment\'` '
    + '(hf7y/american-cycle#145). The ranking is unchanged -- presidency, then Senate, then '
    + 'governorships, with House seats still the one office anti-correlated with winning -- but the '
    + 'presidency\'s lead has come in hard, 15x down to 7.3x, and House seats have drifted up from '
    + '0.27x to 0.54x. Senate and the two "held by the winner" counts still hold within tolerance. '
    + 'Nothing here pins the drop on the ending change specifically rather than the district-identity '
    + 'fixes landed in the same window (hf7y/american-cycle#27, #40) -- both moved before this stamp -- '
    + 'so this restamp records that the ratio moved, not why. See '
    + 'hf7y/american-cycle#50 / `findings/amendment-victory-dominance.ts` for the companion measurement: '
    + 'the amendment ending does not fix the dominance hole this office question keeps colliding with, '
    + 'it relocates it again, the same way it moved between points and bills.',
  stampedAt: '2026-09-05T06:59:14Z',
  stampedOn: '2021e16',

  predicate(): Claim[] {
    const s = seatsByOutcome();
    // hf7y/american-cycle#91: is the presidency's dominant ratio itself a
    // property of which era-pack list ran it, same config/agents/seeds?
    const sAll = seatsByOutcome(ALL_PACKS);
    return [
      { name: 'Senate seats: winner vs everyone else', value: s.senator.ratio, stamped: 2.64, tolerance: 0.7, unit: 'x' },
      { name: 'House seats: winner vs everyone else', value: s.representative.ratio, stamped: 0.43, tolerance: 0.15, unit: 'x' },
      { name: 'governorships: winner vs everyone else', value: s.governor.ratio, stamped: 2, tolerance: 0.5, unit: 'x' },
      { name: 'the presidency: winner vs everyone else', value: s.president.ratio, stamped: 6, tolerance: 1.6, unit: 'x' },
      { name: 'Senate seats held by the winner', value: s.senator.winner, stamped: 9.08, tolerance: 4 },
      { name: 'House seats held by the winner', value: s.representative.winner, stamped: 2.17, tolerance: 1.5 },
      { name: 'the presidency, ALL_PACKS: winner vs everyone else', value: sAll.president.ratio, stamped: 15.00, tolerance: 1.6, unit: 'x' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const exact = (n: string) => c.find((x) => x.name === n)!.value;
    const rank = (['Senate seats:', 'the presidency:', 'governorships:', 'House seats:'] as const)
      .map((n) => `${n.replace(/[:.]/g, '')} ${v(n).toFixed(2)}x`);
    const deck = deckSensitivity([
      { pool: 'four-pack', value: exact('the presidency: winner vs everyone else') },
      { pool: 'all-seven', value: exact('the presidency, ALL_PACKS: winner vs everyone else') },
    ]);
    return [
      `winner-to-field seat ratios — ${rank.join(', ')}`,
      v('House seats:') < 1 ? 'holding House seats is anti-correlated with winning' : 'House seats no longer lose',
      v('governorships:') < v('Senate seats:') / 1.5
        ? 'and the governorship is not something to plan around'
        : 'and the governorship now pays like the Senate',
      deck.sensitive
        ? `and the presidency's ratio is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['four-pack'].toFixed(2)}x four-pack vs ${deck.byPool['all-seven'].toFixed(2)}x all-seven`
        : "and the presidency's ratio held stable between the four-pack and all-seven decks (hf7y/american-cycle#91)",
    ].join('; ');
  },
};
