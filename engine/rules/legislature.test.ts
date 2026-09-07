import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tallyBill, impeach, author, majorityParty, authorCandidates, resolveAuthorVote, proposeAmendment,
} from './legislature.ts';
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

test('hf7y/american-cycle#86: a congressional amendment proposal needs two-thirds of EACH chamber, not two-thirds overall', () => {
  const seats = bench(Array(6).fill('D'), [...Array(6).fill('D'), ...Array(4).fill('R')]);
  // House is unanimous (6/6, easily two-thirds); Senate is 6/10, short of 2/3.
  const short = votes(seats, (s) => s.office === 'representative' || s.holder!.party === 'D');
  const out = proposeAmendment(2 / 3, seats, short);
  assert.equal(out.houseYes, 6);
  assert.equal(out.senateYes, 6);
  assert.ok(!out.passed, 'a chamber-wide combined tally would clear 2/3 (12/16); voted per chamber it does not');

  const withTwoR = votes(seats, (s) =>
    s.office === 'representative' || s.holder!.party === 'D' || ['s6', 's7'].includes(s.holder!.cardId));
  const passed = proposeAmendment(2 / 3, seats, withTwoR);
  assert.equal(passed.senateYes, 8);
  assert.ok(passed.passed, 'eight of ten senators is two-thirds');
});

test('hf7y/american-cycle#86: no presentment -- a proposal has no veto to skip, only the two chamber votes', () => {
  // A unanimous chamber pair passes with no president, no veto arg, and no
  // reaction/score machinery: proposeAmendment's return type carries none of
  // tallyBill's g/vetoed/scores fields.
  const seats = bench(Array(6).fill('D'), Array(6).fill('D'));
  const out = proposeAmendment(2 / 3, seats, votes(seats, () => true));
  assert.ok(out.passed);
  assert.deepEqual(Object.keys(out).sort(), ['houseTotal', 'houseYes', 'passed', 'senateTotal', 'senateYes']);
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

test('hf7y/american-cycle#83: authorCandidates is every player in the majority-party bloc, not just the biggest', () => {
  const seats = bench(['D', 'D', 'D', 'R'], [], [7, 7, 9, 3]);
  assert.deepEqual(authorCandidates(seats), [7, 9], 'player 3 holds the lone R seat and is not a D-majority candidate');
});

test('hf7y/american-cycle#83: the chamber vote reaches the old outright pick when nobody contests it', () => {
  const seats = bench(['D', 'D', 'D', 'R'], [], [7, 7, 9, 3]);
  const candidates = authorCandidates(seats);
  const frontrunner = author(seats)!;
  // every default voter (see Game.defaultChooseAuthor) votes for themselves
  // if eligible, else the frontrunner -- seat 2 (player 9) and the R seat
  // (player 3, ineligible) both default to the frontrunner.
  const choices = [frontrunner, frontrunner, frontrunner];
  assert.equal(resolveAuthorVote(candidates, choices, frontrunner), frontrunner);
});

test('hf7y/american-cycle#83: a rival bloc can win the vote outright', () => {
  const seats = bench(Array(5).fill('D'), [], [1, 1, 1, 2, 2]);
  const candidates = authorCandidates(seats); // [1, 2], player 1 has the larger bloc
  assert.deepEqual(candidates, [1, 2]);
  assert.equal(author(seats), 1);
  // three seats vote for player 2 despite player 1's larger bloc
  assert.equal(resolveAuthorVote(candidates, [2, 2, 2, 2, 1], 1), 2);
});

test('hf7y/american-cycle#83: a tied vote keeps the frontrunner rather than the lowest id', () => {
  const seats = bench(Array(4).fill('D'), [], [9, 9, 5, 5]); // two equal-size D blocs, frontrunner is NOT the lower id
  const candidates = authorCandidates(seats);
  assert.deepEqual(candidates, [5, 9]);
  const frontrunner = author(seats); // insertion-order tiebreak sees player 9's bloc first
  assert.equal(frontrunner, 9);
  assert.equal(resolveAuthorVote(candidates, [9, 9, 5, 5], frontrunner), frontrunner, 'a 2-2 vote tie keeps the frontrunner, not the lowest id by coincidence');
});

test('hf7y/american-cycle#83: no majority party means no candidates and no author', () => {
  assert.deepEqual(authorCandidates([]), []);
  assert.equal(resolveAuthorVote([], [], undefined), undefined);
});

test('hf7y/american-cycle#86: a three-way plurality with nobody over half is also "no pen to win"', () => {
  // 4 D, 4 R, 2 I -- D is the plurality leader (majorityParty picks a
  // winner on every held seat, ties included) but holds 4 of 10, not a
  // true majority. congressionalPropose's fallback to a convention (#86)
  // reads this function as "is there a House majority", so it must say no
  // here, not hand D a pen it was never elected to hold outright.
  const house: Party[] = [...Array(4).fill('D'), ...Array(4).fill('R'), ...Array(2).fill('I')];
  const seats = bench(house, []);
  assert.equal(majorityParty(seats, 'representative'), 'D', 'plurality leader is still named');
  assert.deepEqual(authorCandidates(seats), [], 'but a 4-of-10 plurality is not a pen to win');
});
