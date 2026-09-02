import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardScores, type BoardView, type ScoringConfig } from './scoring.ts';
import type { EnactedBill, Seat } from '../types/index.ts';

const cfg: ScoringConfig = {
  billOnBooks: 3, leanCounter: 1,
  office: { president: 5, senator: 3, governor: 2, representative: 1 },
  amendmentMatch: 2, districtPlayed: 1, cardInHand: 1,
};
const empty = (n = 2): BoardView => ({
  seats: [], lean: {}, bills: [], amendments: [],
  players: Array.from({ length: n }, (_, id) => ({ id, hand: [], districts: [] })),
  identitiesOf: () => undefined,
});

test('a repealed bill scores zero — the epilogue rule, not an exception to it', () => {
  const bills: EnactedBill[] = [
    { id: 'b1', year: 1980, g: 3, author: 0, tags: ['union'] },
    { id: 'b2', year: 1982, g: 3, author: 0, tags: ['farm'], repealedIn: 1984 },
  ];
  assert.deepEqual(boardScores(cfg, { ...empty(), bills }), [3, 0]);
});

test('an unseated politician scores zero, so the score can FALL', () => {
  const held: Seat[] = [{ office: 'senator', state: 'NY', slot: 1,
    holder: { cardId: 'a', player: 0, party: 'D', since: 1976 } }];
  const lost: Seat[] = [{ office: 'senator', state: 'NY', slot: 1 }];
  assert.deepEqual(boardScores(cfg, { ...empty(), seats: held }), [3, 0]);
  assert.deepEqual(boardScores(cfg, { ...empty(), seats: lost }), [0, 0]);
});

test("a state's lean pays the largest bloc of the party it leans toward, and a tie pays nobody", () => {
  const holder = (player: number, party: 'D' | 'R', slot: number): Seat => ({
    office: 'representative', state: 'OH', slot,
    holder: { cardId: `c${slot}`, player, party, since: 1976 },
  });
  const lean = { OH: -3 };            // leans D
  const one = boardScores(cfg, { ...empty(), lean, seats: [holder(0, 'D', 1)] });
  assert.equal(one[0] - one[1], 1 + 3, 'the seat plus three lean counters');
  const tied = boardScores(cfg, { ...empty(), lean, seats: [holder(0, 'D', 1), holder(1, 'D', 2)] });
  assert.equal(tied[0], tied[1], 'two factions splitting a state have not settled it');
});

test('a ratified amendment pays every matching board, with no premium for the proposer', () => {
  const seats: Seat[] = [
    { office: 'senator', state: 'NY', slot: 1, holder: { cardId: 'a', player: 0, party: 'D', since: 1976 } },
    { office: 'senator', state: 'NY', slot: 2, holder: { cardId: 'b', player: 1, party: 'R', since: 1976 } },
  ];
  const b: BoardView = {
    ...empty(), seats,
    amendments: [{ id: 'a1', proposer: 0, tags: ['union'], calledIn: 1980,
                   called: [], ratified: [], rescinded: [], ratifiedIn: 1988 }],
    identitiesOf: () => ['union'],
  };
  const s = boardScores(cfg, b);
  assert.equal(s[0], s[1], 'the proposer gets no premium over the ratifiers');
});
