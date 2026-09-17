/** hf7y/american-cycle#37: unit tests for `Dealmaker`'s ledger (`favor`, via
 *  `voteBill`), `RunawayBrake`'s deterministic decision points (leader
 *  detection, the bill-vote block, impeachment targeting), and `Whip`'s
 *  coalition arithmetic (moveImpeach's predicted-yes count against the real
 *  2/3 threshold, voteImpeach's cross-party defection) -- all are decision
 *  points PR-review of a scripted agent should target directly rather than
 *  through a full simulated game. `npm test`'s glob covers
 *  `engine/**\/*.test.ts`, not `sim/`, hence this file living here rather
 *  than beside the agents it tests. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Config, GameView, PlayerState, VPGrant, VPOffer } from './game.ts';
import { Bandwagon, Dealmaker, RunawayBrake, Whip, RunningMate } from '../sim/agents.ts';
import { RNG } from './rules/rng.ts';
import type { CandidateCard, EnactedBill, Seat } from './types/index.ts';
import type { Vote } from './rules/legislature.ts';

const cfg: Config = JSON.parse(readFileSync(new URL('./config/tuned.json', import.meta.url), 'utf8'));

/** One player (me), one Senate seat they hold, one district in their state
 *  whose demographics deliberately share no tag with the bill on offer --
 *  `union` vs. `farm` don't overlap, so `tags.distance` reads 1, safely past
 *  `VOTE_AT_DISTANCE` (0.6) regardless of party fallback. Isolates the
 *  ledger: without it, this fixture's bill never earns a yes on fit alone. */
function fixture(bills: EnactedBill[], vpGrants: VPGrant[] = []): { v: GameView; seat: Seat } {
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
    bills, amendments: [], vpGrants,
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
  economy: { level: 0, accumulatedG: 0 }, lean: {}, seats, players, me: 0, bills: [], amendments: [], vpGrants: [],
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

/** hf7y/american-cycle#37: `Whip` reads the same `favor` ledger `Dealmaker`
 *  introduced to both size up an impeachment coalition before moving
 *  (`moveImpeach`, against the real 2/3 threshold rather than Impeacher's
 *  50% or VPBackstab's 25%) and to actually cross party lines paying down a
 *  debt at the vote itself (`voteImpeach`). */
const whip = () => new Whip('Whip', cfg, new RNG(1));

test('Whip: does not move when opposition arithmetic alone falls short of 2/3', () => {
  const seats: Seat[] = [
    { office: 'president', state: 'US', holder: { cardId: 'p', player: 2, party: 'R', since: 2024 } },
    { office: 'senator', state: 'OH', senateClass: 1, holder: { cardId: 's1', player: 0, party: 'D', since: 2020 } },
    { office: 'senator', state: 'TX', senateClass: 2, holder: { cardId: 's2', player: 3, party: 'R', since: 2020 } },
    { office: 'senator', state: 'CA', senateClass: 3, holder: { cardId: 's3', player: 3, party: 'R', since: 2020 } },
  ];
  const v = view([player(0), player(1), player(1), player(1)], seats);
  assert.equal(whip().moveImpeach(v), false, 'only one of three senators opposes -- short of 2/3');
});

test('Whip: moves once opposition alone clears 2/3', () => {
  const seats: Seat[] = [
    { office: 'president', state: 'US', holder: { cardId: 'p', player: 2, party: 'R', since: 2024 } },
    { office: 'senator', state: 'OH', senateClass: 1, holder: { cardId: 's1', player: 0, party: 'D', since: 2020 } },
    { office: 'senator', state: 'TX', senateClass: 2, holder: { cardId: 's2', player: 3, party: 'D', since: 2020 } },
    { office: 'senator', state: 'CA', senateClass: 3, holder: { cardId: 's3', player: 3, party: 'R', since: 2020 } },
  ];
  const v = view([player(0), player(1), player(1), player(1)], seats);
  assert.equal(whip().moveImpeach(v), true, 'two of three senators oppose -- past 2/3');
});

test('Whip: a favour owed by a same-party senator fills the gap opposition alone cannot', () => {
  const seats: Seat[] = [
    { office: 'president', state: 'US', holder: { cardId: 'p', player: 2, party: 'R', since: 2024 } },
    { office: 'senator', state: 'OH', senateClass: 1, holder: { cardId: 's1', player: 0, party: 'D', since: 2020 } },
    // player 3 holds the other two seats, same party as the president --
    // opposition alone (1/3) falls well short of 2/3.
    { office: 'senator', state: 'TX', senateClass: 2, holder: { cardId: 's2', player: 3, party: 'R', since: 2020 } },
    { office: 'senator', state: 'CA', senateClass: 3, holder: { cardId: 's3', player: 3, party: 'R', since: 2020 } },
  ];
  // player 3 authored a bill the mover (player 0) voted yes on -- favor(3, 0) > 0, player 3 owes player 0.
  const bills: EnactedBill[] = [{ id: 'b0', year: 2020, g: 3, author: 3, tags: [], yesVoters: [0, 3] }];
  const v: GameView = { ...view([player(0), player(1), player(1), player(1)], seats), bills };
  assert.equal(whip().moveImpeach(v), true, 'the debtor holding both remaining seats covers the shortfall');
});

test('Whip: never moves against its own party\'s president', () => {
  const seats: Seat[] = [{ office: 'president', state: 'US', holder: { cardId: 'p', player: 0, party: 'R', since: 2024 } }];
  const v = view([player(0), player(1), player(1), player(1)], seats);
  assert.equal(whip().moveImpeach(v), false);
});

test('Whip: an opposition-party senator always votes to convict', () => {
  const seats: Seat[] = [{ office: 'president', state: 'US', holder: { cardId: 'p', player: 2, party: 'R', since: 2024 } }];
  const opposed: Seat = { office: 'senator', state: 'OH', senateClass: 1, holder: { cardId: 's1', player: 0, party: 'D', since: 2020 } };
  const v = view([player(0), player(1), player(1), player(1)], seats);
  assert.equal(whip().voteImpeach(v, opposed), true);
});

test('Whip: a same-party senator crosses to convict when it owes another player a favour', () => {
  const seats: Seat[] = [{ office: 'president', state: 'US', holder: { cardId: 'p', player: 2, party: 'R', since: 2024 } }];
  const same: Seat = { office: 'senator', state: 'TX', senateClass: 2, holder: { cardId: 's2', player: 0, party: 'R', since: 2020 } };
  // player 0 (this senator) authored a bill player 1 voted yes on -- favor(0, 1) > 0, player 0 owes player 1.
  const bills: EnactedBill[] = [{ id: 'b0', year: 2020, g: 3, author: 0, tags: [], yesVoters: [0, 1] }];
  const v: GameView = { ...view([player(0), player(1), player(1), player(1)], seats), bills };
  assert.equal(whip().voteImpeach(v, same), true);
});

test('Whip: a same-party senator with no debt to anyone stays loyal', () => {
  const seats: Seat[] = [{ office: 'president', state: 'US', holder: { cardId: 'p', player: 2, party: 'R', since: 2024 } }];
  const same: Seat = { office: 'senator', state: 'TX', senateClass: 2, holder: { cardId: 's2', player: 0, party: 'R', since: 2020 } };
  const v = view([player(0), player(1), player(1), player(1)], seats);
  assert.equal(whip().voteImpeach(v, same), false);
});

/** hf7y/american-cycle#37: `Bandwagon` is the first agent to read
 *  `voteBill`'s `votesSoFar` (#263/#272's roll call) -- real-time same-party
 *  momentum, not `Dealmaker`/`Whip`'s cross-year ledger. Reuses `fixture`
 *  above: a `D` senator in a district that shares no tag with `union` (fit
 *  reads false) but shares every tag with `farm` (fit reads true), so both
 *  override directions are provable against a known fit baseline. */
const bw = () => new Bandwagon('Bandwagon', cfg, new RNG(1));

test('Bandwagon: no votesSoFar falls back to fit', () => {
  const { v, seat } = fixture([]);
  assert.equal(bw().voteBill(v, 3, seat, ['union'], 1, []), false);
});

test('Bandwagon: a single same-party vote is one early holdout, not momentum', () => {
  const { v, seat } = fixture([]);
  const votesSoFar: Vote[] = [{ player: 5, party: 'D', office: 'representative', yes: true, cardId: 'x1' }];
  assert.equal(bw().voteBill(v, 3, seat, ['union'], 1, votesSoFar), false);
});

test('Bandwagon: strong same-party yes momentum overrides a fit-no', () => {
  const { v, seat } = fixture([]);
  const votesSoFar: Vote[] = [
    { player: 5, party: 'D', office: 'representative', yes: true, cardId: 'x1' },
    { player: 6, party: 'D', office: 'representative', yes: true, cardId: 'x2' },
  ];
  assert.equal(bw().voteBill(v, 3, seat, ['union'], 1, votesSoFar), true);
});

test('Bandwagon: strong same-party no momentum overrides a fit-yes', () => {
  const { v, seat } = fixture([]);
  const votesSoFar: Vote[] = [
    { player: 5, party: 'D', office: 'representative', yes: false, cardId: 'x1' },
    { player: 6, party: 'D', office: 'representative', yes: false, cardId: 'x2' },
  ];
  assert.equal(bw().voteBill(v, 3, seat, ['farm'], 1, votesSoFar), false);
});

test('Bandwagon: a mixed same-party signal falls back to fit', () => {
  const { v, seat } = fixture([]);
  const votesSoFar: Vote[] = [
    { player: 5, party: 'D', office: 'representative', yes: true, cardId: 'x1' },
    { player: 6, party: 'D', office: 'representative', yes: false, cardId: 'x2' },
  ];
  assert.equal(bw().voteBill(v, 3, seat, ['union'], 1, votesSoFar), false);
});

test('Bandwagon: momentum counts only the seat\'s own party, not the whole roll', () => {
  const { v, seat } = fixture([]);
  const votesSoFar: Vote[] = [
    { player: 5, party: 'R', office: 'representative', yes: true, cardId: 'x1' },
    { player: 6, party: 'R', office: 'representative', yes: true, cardId: 'x2' },
  ];
  assert.equal(bw().voteBill(v, 3, seat, ['union'], 1, votesSoFar), false, 'two R yes votes are not D momentum');
});

/** hf7y/american-cycle#37: unit tests for `RunningMate`'s combined bill+VP
 *  ledger (`vpFavor`, alongside `favor`). Isolates the sign convention `favor`
 *  already set -- positive `favor(me, other)`/`vpFavor(me, other)` means ME:
 *  a favour or a VP grant taken and not yet returned, which is why a debtor
 *  is the NEGATIVE case, not the positive one, and getting that backwards is
 *  exactly the bug a unit test on the raw ledger functions is for. */
const runningMate = () => new RunningMate('RunningMate', cfg, new RNG(1));
const cand = (id: string, homeStateBonus: number): CandidateCard => ({
  id, name: id, party: 'D', homeState: 'ZZ', homeStateBonus, identities: [], era: 1976, effects: [],
});

test('RunningMate: offers its best card to a nominee it has no history with', () => {
  const { v } = fixture([]);
  const withHand: GameView = {
    ...v,
    players: [{ ...v.players[0], hand: [
      { kind: 'candidate', ...cand('c2', 2) },
      { kind: 'candidate', ...cand('c5', 5) },
      { kind: 'candidate', ...cand('c3', 3) },
    ] }],
  };
  const offer = runningMate().offerVP(withHand, { player: 1, party: 'D' });
  assert.equal(offer?.id, 'c5');
});

test('RunningMate: withholds from a nominee it already gave a VP grant, unrepaid', () => {
  // player 0 (this agent) already gave player 1 a VP grant -- vpFavor(0, 1) < 0, player 1 owes ME.
  const grants: VPGrant[] = [{ year: 2020, to: 1, from: 0, card: cand('old', 4) }];
  const { v } = fixture([], grants);
  const withHand: GameView = { ...v, players: [{ ...v.players[0], hand: [{ kind: 'candidate', ...cand('c5', 5) }] }] };
  assert.equal(runningMate().offerVP(withHand, { player: 1, party: 'D' }), undefined);
});

test('RunningMate: still offers to a nominee it owes from a past VP grant', () => {
  // player 1 gave player 0 (this agent) a VP grant -- vpFavor(0, 1) > 0, ME in debt to player 1.
  const grants: VPGrant[] = [{ year: 2020, to: 0, from: 1, card: cand('old', 4) }];
  const { v } = fixture([], grants);
  const withHand: GameView = { ...v, players: [{ ...v.players[0], hand: [{ kind: 'candidate', ...cand('c5', 5) }] }] };
  assert.notEqual(runningMate().offerVP(withHand, { player: 1, party: 'D' }), undefined);
});

test('RunningMate: never offers to itself', () => {
  const { v } = fixture([]);
  assert.equal(runningMate().offerVP(v, { player: 0, party: 'D' }), undefined);
});

test('RunningMate: pickVP prefers the supplier it owes over a better card from a stranger', () => {
  const { v } = fixture([]);
  // player 2 gave player 0 a VP grant before -- vpFavor(0, 2) > 0, ME in debt to player 2.
  const grants: VPGrant[] = [{ year: 2020, to: 0, from: 2, card: cand('old', 1) }];
  const withGrants: GameView = { ...v, vpGrants: grants };
  const offers: VPOffer[] = [
    { from: 1, card: cand('stranger', 9) },
    { from: 2, card: cand('debtor', 2) },
  ];
  assert.equal(runningMate().pickVP(withGrants, offers)?.from, 2);
});

test('RunningMate: repays a VP grant with a yes vote on an off-fit bill', () => {
  // player 1 gave player 0 (this agent) a VP grant -- ME in debt to player 1, no bills exchanged.
  const grants: VPGrant[] = [{ year: 2020, to: 0, from: 1, card: cand('old', 4) }];
  const { v, seat } = fixture([], grants);
  assert.equal(runningMate().voteBill(v, 3, seat, ['union'], 1), true);
});

test('RunningMate: extends no favour on VP grants alone to a stranger', () => {
  const { v, seat } = fixture([]);
  assert.equal(runningMate().voteBill(v, 3, seat, ['union'], 1), false);
});
