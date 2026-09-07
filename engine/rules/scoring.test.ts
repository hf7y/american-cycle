import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardScores, type BoardView, type ScoringConfig } from './scoring.ts';
import type { EnactedBill, Seat } from '../types/index.ts';
import type { Lean } from './lean.ts';

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

test('authorship credit pays once at passage and repeal does not claw it back (#111)', () => {
  const bills: EnactedBill[] = [
    { id: 'b1', year: 1980, g: 3, author: 0, tags: ['union'] },
    { id: 'b2', year: 1982, g: 3, author: 0, tags: ['farm'], repealedIn: 1984 },
  ];
  assert.deepEqual(boardScores(cfg, { ...empty(), bills }), [6, 0], 'both bills pay their author, repealed or not');
});

test('#111: an opposite-fit bill nets the board effect to zero, but does not claw back either author’s credit', () => {
  // Mirrors engine/game.test.ts's #78 two-tick case: player 1's bill fully
  // cancels player 0's push on OH via the ORDINARY passage path, no repeal
  // object involved. The board effect washes out; authorship does not.
  const bills: EnactedBill[] = [
    { id: 'b1', year: 1977, g: 3, author: 0, tags: ['union'] },
    { id: 'b2', year: 1979, g: 3, author: 1, tags: ['union'] },
  ];
  const lean: Lean = { OH: 0 };
  const s = boardScores(cfg, { ...empty(), bills, lean });
  assert.deepEqual(s, [3, 3], 'both authors keep their billOnBooks credit even though OH nets to a wash');
});

test('#111 acceptance: forty bills, all countered, still reads as a wasted career -- through leanCounter, not billOnBooks', () => {
  // #111's acceptance item 4, literally: a career of forty bills every one of
  // which got countered should read as a wasted career. Under the new rule it
  // does NOT read as zero -- the author keeps a flat credit for having passed
  // them -- but the durable board legacy (leanCounter) a legislating career is
  // actually FOR is gone, which is the comparison this test makes explicit.
  const bills: EnactedBill[] = Array.from({ length: 40 }, (_, i) => (
    { id: `b${i}`, year: 1900 + i, g: 3, author: 0, tags: ['union'] }
  ));
  const seats: Seat[] = [{ office: 'senator', state: 'OH', slot: 1,
    holder: { cardId: 'x', player: 0, party: 'D', since: 1900 } }];
  const stood = boardScores(cfg, { ...empty(), bills, seats, lean: { OH: -8 } });
  const countered = boardScores(cfg, { ...empty(), bills, seats, lean: { OH: 0 } });
  assert.equal(stood[0] - countered[0], 8, 'losing the board effect costs exactly the lean counters it carried, and nothing else');
  assert.equal(countered[0], 40 * cfg.billOnBooks + cfg.office.senator,
    'the forty bills still pay their author in full -- #111 keeps authorship, only the board legacy is gone');
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
    amendments: [{ id: 'a1', proposer: 0, route: 'convention', tags: ['union'], calledIn: 1980,
                   called: [], ratified: [], rescinded: [], ratifiedIn: 1988 }],
    identitiesOf: () => ['union'],
  };
  const s = boardScores(cfg, b);
  assert.equal(s[0], s[1], 'the proposer gets no premium over the ratifiers');
});
