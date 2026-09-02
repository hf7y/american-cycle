/** The suite carries its OWN set-overlap distance, because
 *  `engine/rules/tags.ts` postdates v0.1.2 and importing it would make
 *  tracks/c.ts unloadable on the build the baseline most needs to measure.
 *
 *  A second copy is a drift hazard, so this is the thing that makes it safe:
 *  if the two ever disagree, the before-and-after silently stops comparing
 *  like with like, and this fails instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlapDistance } from './types.ts';
import { distance, weights } from '../engine/rules/tags.ts';
import type { IdentityTag } from '../engine/types/index.ts';

const CASES: [IdentityTag[], IdentityTag[]][] = [
  [['union'], ['union']],
  [['union'], ['rural']],
  [['union', 'urban'], ['union', 'rural']],
  [['union', 'urban'], ['union', 'urban']],
  [['union', 'urban', 'black'], ['union']],
  [['farm', 'rural'], ['business', 'suburban', 'ivy']],
  [[], ['union']],
  [['union'], []],
  [[], []],
];

test("the suite's distance and the engine's are the same function", () => {
  for (const [a, b] of CASES) {
    assert.equal(overlapDistance(a, b), distance(weights(a), weights(b)),
      `disagreed on [${a}] vs [${b}]`);
  }
});

test('both report the empty case as not-asked rather than as agreement', () => {
  assert.equal(overlapDistance([], ['union']), undefined);
  assert.equal(overlapDistance(['union'], []), undefined);
});
