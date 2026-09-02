import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAGS, centroid, distance, isEmpty, partyPosition, stateposition, weights } from './tags.ts';
import type { CandidateCard, Seat } from '../types/index.ts';

test('distance over tag SETS is set overlap, not Euclidean', () => {
  // Two sets of equal size k sharing j tags must return exactly 1 - j/k.
  const a = weights(['union', 'urban']);
  assert.equal(distance(a, weights(['union', 'urban'])), 0);
  assert.equal(distance(a, weights(['union', 'rural'])), 0.5);
  assert.equal(distance(a, weights(['farm', 'rural'])), 1);
});

test('no tags is not distance 0 — the absence is typed', () => {
  assert.equal(distance(weights([]), weights(['union'])), undefined);
  assert.ok(isEmpty(weights([])));
});

test('a centroid of nothing is not the centre of the space', () => {
  assert.ok(isEmpty(centroid([])));
  assert.ok(isEmpty(centroid([weights([])])));
});

test('weights are normalised, so a long tag list does not outvote a short one', () => {
  const one = weights(['union']);
  const four = weights(['union', 'urban', 'rural', 'farm']);
  assert.equal(one.reduce((a, b) => a + b, 0), 1);
  assert.equal(four.reduce((a, b) => a + b, 0), 1);
  assert.equal(one.length, TAGS.length);
});

const card = (id: string, identities: CandidateCard['identities']): CandidateCard => ({
  id, name: id, party: 'D', homeState: 'NY', homeStateBonus: 0, identities, era: 1976, effects: [],
});

test("a party's position is its CURRENT officeholders, and moves when they change", () => {
  const cards = new Map([['a', card('a', ['union'])], ['b', card('b', ['rural'])]]);
  const seat = (cardId: string): Seat => ({ office: 'senator', state: 'NY', slot: 1,
    holder: { cardId, player: 0, party: 'D', since: 1976 } });

  const before = partyPosition([seat('a')], cards, 'D');
  const after = partyPosition([seat('a'), seat('b')], cards, 'D');
  assert.notDeepEqual(before, after, 'seating a rural D must drag the D centroid');
  // And nothing anywhere says which way is left: the R centroid over the same
  // board is empty, because no R holds anything.
  assert.ok(isEmpty(partyPosition([seat('a')], cards, 'R')));
});

test('a state position is the districts in play there, and nothing when there are none', () => {
  const ds = [{ state: 'OH', demographics: ['union' as const] }, { state: 'TX', demographics: ['farm' as const] }];
  assert.equal(distance(stateposition(ds, 'OH'), weights(['union'])), 0);
  assert.ok(isEmpty(stateposition(ds, 'WY')));
});
