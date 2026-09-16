/** hf7y/american-cycle#37: `RunawayBrake` (sim/agents.ts) is the first agent
 *  whose decisions read a RIVAL's score, so it gets what every other agent's
 *  heuristic scoring does not -- a direct unit test of the deterministic
 *  decision points (leader detection, the bill-vote block, and impeachment
 *  targeting), rather than only a statistical `findings/*.ts` measurement of
 *  the outcome. `declare()`'s edge bonus reuses the same `raceKey`/
 *  `counterDeclare`/`pickDistinct` machinery every other agent's heuristic
 *  already relies on, unit-tested only by measurement (see this file's own
 *  header note on that split), so it is left to the finding.
 *
 *  Lives here, not in sim/, because `npm test`'s glob does not cover sim/ --
 *  every other test in this repo that exercises an `Agent` does so from
 *  `engine/`. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RunawayBrake } from '../sim/agents.ts';
import { RNG } from './rules/rng.ts';
import type { GameView, PlayerState, Config } from './game.ts';
import type { Seat } from './types/index.ts';

const loadConfig = (name: string): Config =>
  JSON.parse(readFileSync(new URL(`./config/${name}`, import.meta.url), 'utf8')) as Config;

const cfg = loadConfig('tuned.json');
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
