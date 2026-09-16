/** hf7y/american-cycle#37: unit tests for `Dealmaker`'s ledger (`favor`, via
 *  `voteBill`), the deterministic decision point PR-review of a scripted
 *  agent should target directly rather than through a full simulated game.
 *  `npm test`'s glob covers `engine/**\/*.test.ts`, not `sim/`, hence this
 *  file living here rather than beside the agent it tests. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Config, GameView } from './game.ts';
import { Dealmaker } from '../sim/agents.ts';
import { RNG } from './rules/rng.ts';
import type { EnactedBill, Seat } from './types/index.ts';

const cfg: Config = JSON.parse(readFileSync(new URL('./config/tuned.json', import.meta.url), 'utf8'));

/** One player (me), one Senate seat they hold, one district in their state
 *  whose demographics deliberately share no tag with the bill on offer --
 *  `union` vs. `farm` don't overlap, so `tags.distance` reads 1, safely past
 *  `VOTE_AT_DISTANCE` (0.6) regardless of party fallback. Isolates the
 *  ledger: without it, this fixture's bill never earns a yes on fit alone. */
function fixture(bills: EnactedBill[]): { v: GameView; seat: Seat } {
  const seat: Seat = { office: 'senator', state: 'ZZ', holder: { cardId: 'c1', player: 0, party: 'D', since: 1976 } };
  const v: GameView = {
    year: 1978, isElectionYear: true, isMidterm: true, isPresidentialYear: false,
    economy: { level: 0, accumulatedG: 0 },
    lean: {},
    seats: [seat],
    players: [{
      id: 0, name: 'P', hand: [], score: 0, tapped: new Set(),
      districts: [{ id: 'ZZ-1', state: 'ZZ', number: 1, era: 1976, demographics: ['farm'] }],
    }],
    me: 0,
    bills, amendments: [],
  };
  return { v, seat };
}

test('Dealmaker: no shared history extends no favour to a stranger', () => {
  const { v, seat } = fixture([]);
  const agent = new Dealmaker('Dealmaker', cfg, new RNG(1));
  assert.equal(agent.voteBill(v, 3, seat, ['union'], 1), false);
});

test('Dealmaker: repays a bill author who has voted yes on its own bill before', () => {
  const bills: EnactedBill[] = [
    { id: 'b0', year: 1976, g: 3, author: 0, tags: ['union'], yesVoters: [0, 1] },
  ];
  const { v, seat } = fixture(bills);
  const agent = new Dealmaker('Dealmaker', cfg, new RNG(1));
  // Player 1 authors this year's off-fit bill; player 0 owes them for b0.
  assert.equal(agent.voteBill(v, 3, seat, ['union'], 1), true);
});

test('Dealmaker: a balance already repaid earns no second favour', () => {
  const bills: EnactedBill[] = [
    { id: 'b0', year: 1976, g: 3, author: 0, tags: ['union'], yesVoters: [0, 1] },
    { id: 'b1', year: 1977, g: 3, author: 1, tags: ['farm'], yesVoters: [0, 1] },
  ];
  const { v, seat } = fixture(bills);
  const agent = new Dealmaker('Dealmaker', cfg, new RNG(1));
  assert.equal(agent.voteBill(v, 3, seat, ['union'], 1), false);
});

test('Dealmaker: helping someone first creates no debt owed back', () => {
  // Player 0 voted yes on player 1's own bill (b0) -- that is player 0
  // helping, not being helped, so it must not read as player 1 owing them.
  const bills: EnactedBill[] = [
    { id: 'b0', year: 1976, g: 3, author: 1, tags: ['farm'], yesVoters: [0, 1] },
  ];
  const { v, seat } = fixture(bills);
  const agent = new Dealmaker('Dealmaker', cfg, new RNG(1));
  assert.equal(agent.voteBill(v, 3, seat, ['union'], 1), false);
});

test('Dealmaker: fit alone still passes a bill, ledger or not', () => {
  const { v, seat } = fixture([]);
  const agent = new Dealmaker('Dealmaker', cfg, new RNG(1));
  assert.equal(agent.voteBill(v, 3, seat, ['farm'], 1), true);
});
