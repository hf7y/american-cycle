/** hf7y/american-cycle#37: unit tests for `Dealmaker`'s ledger (`favor`, via
 *  `voteBill`) and `RunawayBrake`'s deterministic decision points (leader
 *  detection, the bill-vote block, impeachment targeting) -- both are
 *  decision points PR-review of a scripted agent should target directly
 *  rather than through a full simulated game. `npm test`'s glob covers
 *  `engine/**\/*.test.ts`, not `sim/`, hence this file living here rather
 *  than beside the agents it tests. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Config, GameView, PlayerState, VPOffer } from './game.ts';
import { Dealmaker, RunawayBrake, Horsetrader } from '../sim/agents.ts';
import { RNG } from './rules/rng.ts';
import type { CandidateCard, EnactedBill, Seat } from './types/index.ts';

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

/** hf7y/american-cycle#37: `RunawayBrake` (sim/agents.ts) is the first agent
 *  whose decisions read a RIVAL's score, so it gets what every other agent's
 *  heuristic scoring does not -- a direct unit test of the deterministic
 *  decision points (leader detection, the bill-vote block, and impeachment
 *  targeting), rather than only a statistical `findings/*.ts` measurement of
 *  the outcome. `declare()`'s edge bonus reuses the same `raceKey`/
 *  `counterDeclare`/`pickDistinct` machinery every other agent's heuristic
 *  already relies on, unit-tested only by measurement (see this file's own
 *  header note on that split), so it is left to the finding. */
const agent = () => new RunawayBrake('RunawayBrake', cfg, new RNG(1));

const player = (score: number): PlayerState => ({ id: 0, name: 'P', hand: [], districts: [], score, tapped: new Set() });

const view = (players: PlayerState[], seats: Seat[] = []): GameView => ({
  year: 2024, isElectionYear: true, isMidterm: false, isPresidentialYear: true,
  economy: { level: 0, accumulatedG: 0 }, lean: {}, seats, players, me: 0, bills: [], amendments: [],
});

test('RunawayBrake: no leader among a level field', () => {
  const v = view([player(0), player(10), player(10), player(10)]);
  assert.equal((agent() as unknown as { leader(v: GameView): number | undefined }).leader(v), undefined);
});

test('RunawayBrake: no leader when the gap is below the +6 margin', () => {
  // rival 1 leads rivals 2/3 by (7 - 2) = 5, one pip short of the margin
  const v = view([player(0), player(7), player(2), player(2)]);
  assert.equal((agent() as unknown as { leader(v: GameView): number | undefined }).leader(v), undefined);
});

test('RunawayBrake: names the leader once they clear the rest of the field by the margin', () => {
  // rival 1 leads rivals 2/3's mean (2) by 8 -- past the +6 margin
  const v = view([player(0), player(10), player(2), player(2)]);
  assert.equal((agent() as unknown as { leader(v: GameView): number | undefined }).leader(v), 1);
});

test('RunawayBrake: votes no on every bill while a leader exists, regardless of tag fit', () => {
  const seat: Seat = { office: 'senator', state: 'OH', holder: { cardId: 'x', player: 1, party: 'D', since: 2020 } };
  const v = view([player(0), player(10), player(2), player(2)], [seat]);
  assert.equal(agent().voteBill(v, 0, seat, []), false, 'no bill tags: still a no');
  assert.equal(agent().voteBill(v, 0, seat, ['urban']), false, 'even a perfectly-fitting bill: still a no');
});

test('RunawayBrake: falls back to ordinary vote-by-distance once the field is level', () => {
  const seat: Seat = { office: 'senator', state: 'OH', holder: { cardId: 'x', player: 0, party: 'D', since: 2020 } };
  const v = view([player(0), player(10), player(10), player(10)], [seat]);
  // no districts anywhere and no bill tags -- Base's fallback reads the
  // seat's own party against the chamber majority, which here is D (the
  // only party any seat carries)
  assert.equal(agent().voteBill(v, 0, seat, undefined), true);
});

test('RunawayBrake: moves to impeach only when the LEADER holds the presidency', () => {
  const seats: Seat[] = [
    { office: 'president', state: 'US', holder: { cardId: 'p', player: 2, party: 'R', since: 2024 } },
    { office: 'senator', state: 'OH', senateClass: 1, holder: { cardId: 's1', player: 0, party: 'D', since: 2020 } },
    { office: 'senator', state: 'TX', senateClass: 2, holder: { cardId: 's2', player: 3, party: 'D', since: 2020 } },
  ];
  const notRunaway = view([player(0), player(1), player(1), player(1)], seats);
  assert.equal(agent().moveImpeach(notRunaway), false, 'the president is not a runaway leader yet');

  const runaway = view([player(0), player(1), player(10), player(1)], seats);
  assert.equal(agent().moveImpeach(runaway), true, 'the runaway leader holds the presidency and the Senate arithmetic is there');
});

test('RunawayBrake: never moves against a president who merely leads without a Senate majority against them', () => {
  const seats: Seat[] = [
    { office: 'president', state: 'US', holder: { cardId: 'p', player: 2, party: 'R', since: 2024 } },
    { office: 'senator', state: 'OH', senateClass: 1, holder: { cardId: 's1', player: 2, party: 'R', since: 2020 } },
    { office: 'senator', state: 'TX', senateClass: 2, holder: { cardId: 's2', player: 2, party: 'R', since: 2020 } },
    { office: 'senator', state: 'CA', senateClass: 3, holder: { cardId: 's3', player: 3, party: 'D', since: 2020 } },
  ];
  const runaway = view([player(0), player(1), player(10), player(1)], seats);
  assert.equal(agent().moveImpeach(runaway), false, 'only one third of the Senate opposes -- the arithmetic is not there');
});

test('RunawayBrake: votes to convict only a Senator opposed to the runaway leader\'s own party', () => {
  const seats: Seat[] = [
    { office: 'president', state: 'US', holder: { cardId: 'p', player: 2, party: 'R', since: 2024 } },
  ];
  const runaway = view([player(0), player(1), player(10), player(1)], seats);
  const opposed: Seat = { office: 'senator', state: 'OH', senateClass: 1, holder: { cardId: 's1', player: 0, party: 'D', since: 2020 } };
  const same: Seat = { office: 'senator', state: 'TX', senateClass: 2, holder: { cardId: 's2', player: 0, party: 'R', since: 2020 } };
  assert.equal(agent().voteImpeach(runaway, opposed), true);
  assert.equal(agent().voteImpeach(runaway, same), false);
});

test('RunawayBrake: never moves or votes to impeach when no rival is running away', () => {
  const seats: Seat[] = [
    { office: 'president', state: 'US', holder: { cardId: 'p', player: 2, party: 'R', since: 2024 } },
    { office: 'senator', state: 'OH', senateClass: 1, holder: { cardId: 's1', player: 0, party: 'D', since: 2020 } },
  ];
  const level = view([player(0), player(1), player(1), player(1)], seats);
  assert.equal(agent().moveImpeach(level), false);
  assert.equal(agent().voteImpeach(level, seats[1]), false);
});

/** hf7y/american-cycle#37: `Horsetrader` reads the same `favor` ledger
 *  `Dealmaker` does, plus `GameView.vicePresident` for the ticket side --
 *  unit-tested directly for the same reason `Dealmaker`'s tests above are:
 *  a scripted agent's decision points, not a full simulated game. */
const card = (id: string, homeStateBonus: number): CandidateCard =>
  ({ id, name: id, party: 'D', homeState: 'ZZ', homeStateBonus, identities: [], era: 1976, effects: [] });

const horsetrader = () => new Horsetrader('Horsetrader', cfg, new RNG(1));

test('Horsetrader: offers the ticket to nobody when no debt is owed', () => {
  const { v } = fixture([]);
  assert.equal(horsetrader().offerVP(v, { player: 1, party: 'D' }), undefined);
});

test('Horsetrader: never offers to itself, ledger or not', () => {
  const bills: EnactedBill[] = [{ id: 'b0', year: 1976, g: 3, author: 0, tags: ['union'], yesVoters: [0] }];
  const { v } = fixture(bills);
  assert.equal(horsetrader().offerVP(v, { player: 0, party: 'D' }), undefined);
});

test('Horsetrader: offers its best card once the ledger shows a debt owed to the nominee', () => {
  // player 1 voted yes on player 0's own bill -- player 0 owes player 1
  const bills: EnactedBill[] = [{ id: 'b0', year: 1976, g: 3, author: 0, tags: ['union'], yesVoters: [0, 1] }];
  const { v } = fixture(bills);
  v.players[0].hand = [
    { kind: 'candidate', ...card('weak', 1) },
    { kind: 'candidate', ...card('strong', 4) },
  ];
  assert.equal(horsetrader().offerVP(v, { player: 1, party: 'D' })?.id, 'strong');
});

test('Horsetrader: accepts the offer from whoever is owed the most, not the biggest home-state bonus', () => {
  // player 2 voted yes on player 0's own bill -- player 0 owes player 2, not player 1
  const bills: EnactedBill[] = [{ id: 'b0', year: 1976, g: 3, author: 0, tags: ['union'], yesVoters: [0, 2] }];
  const { v } = fixture(bills);
  const offers: VPOffer[] = [
    { from: 1, card: card('big-bonus', 5) },
    { from: 2, card: card('owed', 1) },
  ];
  assert.equal(horsetrader().pickVP(v, offers)?.from, 2);
});

test('Horsetrader: repays a bill author who supplied its running mate, even off-fit', () => {
  const { v, seat } = fixture([]);
  v.seats = [{ office: 'president', state: 'US', holder: { cardId: 'p', player: 0, party: 'D', since: 1976 } }, seat];
  v.vicePresident = { cardId: 'vp1', card: card('vp1', 2), from: 1 };
  // player 1 supplied player 0's own running mate: player 0 owes them, off-fit or not
  assert.equal(horsetrader().voteBill(v, 3, seat, ['union'], 1), true);
});

test('Horsetrader: giving a rival the VP slot is not itself a debt owed back', () => {
  const { v, seat } = fixture([]);
  v.seats = [{ office: 'president', state: 'US', holder: { cardId: 'p', player: 1, party: 'D', since: 1976 } }, seat];
  v.vicePresident = { cardId: 'vp1', card: card('vp1', 2), from: 0 };
  // player 0 supplied player 1's running mate -- that is player 0 helping,
  // so it must not read as player 1 owing them
  assert.equal(horsetrader().voteBill(v, 3, seat, ['union'], 1), false);
});
