import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tallyBill, impeach, author, majorityParty } from './legislature.ts';
import type { LegislatureConfig, Vote } from './legislature.ts';
import type { Seat, Party } from '../types/index.ts';
import { RNG } from './rng.ts';
import cfgJson from '../config/baseline.json' with { type: 'json' };

const cfg = cfgJson.legislature as LegislatureConfig;

function bench(house: Party[], senate: Party[], players: number[] = []): Seat[] {
  const seats: Seat[] = [];
  house.forEach((p, i) => seats.push({ office: 'representative', state: 'OH', slot: i,
    holder: { cardId: `h${i}`, player: players[i] ?? (p === 'D' ? 0 : 1), party: p, since: 1976 } }));
  senate.forEach((p, i) => seats.push({ office: 'senator', state: 'OH', senateClass: 1,
    holder: { cardId: `s${i}`, player: p === 'D' ? 0 : 1, party: p, since: 1976 } }));
  return seats;
}
const votes = (seats: Seat[], yes: (s: Seat) => boolean): Vote[] =>
  seats.filter((s) => s.holder).map((s) => ({
    player: s.holder!.player, party: s.holder!.party,
    office: s.office as 'senator' | 'representative', yes: yes(s),
    cardId: s.holder!.cardId,
  }));

test('a bare majority cannot pass the Senate — 60% forces cross-benching', () => {
  const seats = bench(Array(10).fill('D'), [...Array(5).fill('D'), ...Array(4).fill('R')]);
  const partyLine = votes(seats, (s) => s.holder!.party === 'D');
  const out = tallyBill(cfg, seats, partyLine, 3, undefined, false, undefined, new RNG(1));
  assert.equal(out.senateYes, 5);
  assert.ok(!out.passed, '5 of 9 is a clear majority and still fails the 60% threshold');

  const withOneR = votes(seats, (s) => s.holder!.party === 'D' || s.holder!.cardId === 's5');
  const out2 = tallyBill(cfg, seats, withOneR, 3, undefined, false, undefined, new RNG(1));
  assert.ok(out2.passed, 'one cross-bencher carries it');
  assert.equal(out2.crossBenched, 1);
});

test('yes-voters score, doubled for the majority party', () => {
  const seats = bench(['D', 'D', 'D', 'R'], [...Array(7).fill('D'), ...Array(3).fill('R')]);
  const all = votes(seats, () => true);
  const out = tallyBill(cfg, seats, all, 3, undefined, false, undefined, new RNG(2));
  assert.ok(out.passed);
  // player 0 holds every D seat (3 House + 7 Senate), all doubled as majority
  assert.equal(out.scores[0], (3 + 7) * cfg.majorityMultiplier);
  // player 1 holds the R seats, scoring single as the minority
  assert.equal(out.scores[1], 1 + 3);
});

test('the minority gains nothing when the bill fails', () => {
  const seats = bench(Array(10).fill('D'), Array(10).fill('D'));
  const none = votes(seats, () => false);
  const out = tallyBill(cfg, seats, none, 3, undefined, false, undefined, new RNG(3));
  assert.ok(!out.passed);
  assert.deepEqual(out.scores, {}, 'no passage, no points, for anyone');
});

test('the veto stands unless two-thirds of both chambers override', () => {
  const seats = bench(Array(9).fill('D'), Array(10).fill('D'));
  const all = votes(seats, () => true);
  const vetoed = tallyBill(cfg, seats, all, 3, { player: 1, party: 'R' }, true, undefined, new RNG(4));
  assert.ok(vetoed.vetoed && !vetoed.passed);
  assert.deepEqual(vetoed.scores, {}, 'nobody gains, and the president owns the stagnation');

  const short = tallyBill(cfg, seats, all, 3, { player: 1, party: 'R' }, true, { house: 5, senate: 9 }, new RNG(4));
  assert.ok(!short.passed, 'five of nine is not two-thirds of the House');

  const over = tallyBill(cfg, seats, all, 3, { player: 1, party: 'R' }, true, { house: 6, senate: 7 }, new RNG(4));
  assert.ok(over.overridden && over.passed, 'two-thirds of both carries it over the veto');
});

test('impeachment needs two-thirds of the Senate', () => {
  const seats = bench([], Array(9).fill('D'));
  assert.ok(!impeach(cfg, seats, 5));
  assert.ok(impeach(cfg, seats, 6), 'six of nine is two-thirds');
});

test('authorship goes to the largest bloc of the majority House party', () => {
  const seats = bench(['D', 'D', 'D', 'R'], [], [7, 7, 9, 3]);
  assert.equal(majorityParty(seats, 'representative'), 'D');
  assert.equal(author(seats), 7, 'two D seats beats one');
});
