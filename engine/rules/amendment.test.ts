import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockers, congressProposes, needed, stateBacks, supportPips, type AmendmentConfig } from './amendment.ts';
import type { Vote } from './legislature.ts';
import type { Seat, Party } from '../types/index.ts';
import { RNG } from './rng.ts';

const cfg: AmendmentConfig = {
  enabled: true, callFraction: 2 / 3, ratifyFraction: 0.75, congressFraction: 2 / 3, windowYears: 8,
  dice: 2, target: 6, rescindTarget: 11, governorPips: 2, districtPips: 2, leanPips: 1,
  tagsPerAmendment: 2, failurePush: 1,
};

function bench(house: Party[], senate: Party[]): Seat[] {
  const seats: Seat[] = [];
  house.forEach((p, i) => seats.push({ office: 'representative', state: 'OH', slot: i,
    holder: { cardId: `h${i}`, player: p === 'D' ? 0 : 1, party: p, since: 1976 } }));
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

test('hf7y/american-cycle#86: Congress proposes on two-thirds of EACH chamber, not two-thirds overall', () => {
  // 8 of 9 House (89%) but only 5 of 9 Senate (56%) -- overall 13/18 (72%)
  // clears two-thirds combined, and must still fail on the Senate alone.
  const seats = bench(Array(9).fill('D'), Array(9).fill('D'));
  const lopsided = votes(seats, (s) => s.office === 'representative' ? true : s.holder!.cardId === 's0' || s.holder!.cardId === 's1'
    || s.holder!.cardId === 's2' || s.holder!.cardId === 's3' || s.holder!.cardId === 's4');
  assert.ok(!congressProposes(cfg, seats, lopsided), 'a chamber short of two-thirds sinks the whole proposal');

  const both = votes(seats, () => true);
  assert.ok(congressProposes(cfg, seats, both), 'two-thirds of both chambers proposes');
});

test('hf7y/american-cycle#86: an empty chamber cannot propose by default', () => {
  const seats = bench(Array(9).fill('D'), []);
  assert.ok(!congressProposes(cfg, seats, votes(seats, () => true)), 'no Senate seated, nothing to check two-thirds of');
});

test('Article V makes thirteen states a blocking minority — the anti-runaway claim', () => {
  assert.equal(needed(cfg.ratifyFraction, 50), 38);
  assert.equal(blockers(cfg, 50), 13);
  assert.equal(needed(cfg.callFraction, 50), 34);
});

test('the state check reads governor, districts and lean, and nothing else', () => {
  assert.equal(supportPips(cfg, { governor: false, matchingDistricts: 0, leanWith: 0 }), 0);
  assert.equal(supportPips(cfg, { governor: true, matchingDistricts: 2, leanWith: 3 }), 2 + 4 + 3);
});

const s = { governor: true, matchingDistricts: 0, leanWith: 0 };   // 2 pips
const rate = (c: AmendmentConfig, target: number, seed = 7) => {
  const rng = new RNG(seed);
  let n = 0;
  for (let i = 0; i < 3000; i++) if (stateBacks(c, s, rng, target)) n++;
  return n / 3000;
};

test('rescission is a harder act than ratification, and that is what lets an amendment ever pass', () => {
  assert.ok(rate(cfg, cfg.target) > rate(cfg, cfg.rescindTarget) + 0.3,
    'a symmetric bar pins ratification below three-quarters for ever');
});

test('one die cannot be calibrated, which is why the check rolls two', () => {
  // The reason for `dice`. A flat d6 moves the per-state probability in
  // sixths, so adjacent integer targets are 0.167 apart with nothing between
  // them -- and across fifty states and a multi-year window that compounds
  // into a ratification rate that jumps 0.49 to 0.92 with no setting in
  // between. The record's 71% is not reachable on one die at any target.
  const one: AmendmentConfig = { ...cfg, dice: 1 };
  const step = (c: AmendmentConfig, t: number) => Math.abs(rate(c, t) - rate(c, t + 1));
  const coarsest1 = Math.max(...[1, 2, 3, 4, 5].map((t) => step(one, t)));
  const coarsest2 = Math.max(...[3, 4, 5, 6, 7, 8, 9].map((t) => step(cfg, t)));
  assert.ok(coarsest1 > 0.15, 'one die should move in sixths');
  assert.ok(coarsest2 < coarsest1, 'two dice must give a finer grid than one');
});
