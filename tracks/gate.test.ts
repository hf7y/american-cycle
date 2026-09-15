/** hf7y/american-cycle#147's three properties, each pinned to a case: a row
 *  must be measurable on both sides, must move CLOSER (not just move), and
 *  must close more than a rounding error of the remaining gap. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FROZEN_GATE_ROWS, gate, type NumbersFile } from './gate.ts';

const file = (id: string, name: string, value: number, historical?: number): NumbersFile => ({
  items: [{ id, measures: [{ name, value, historical }] }],
});

test('clears the gate when a row closes more than the fraction required', () => {
  const before = file('X', 'm', 10, 0);
  const after = file('X', 'm', 8, 0); // gap 10 -> 8, closed 20%
  const result = gate(before, after, [{ id: 'X', measure: 'm', minFraction: 0.1 }]);
  assert.equal(result.pass, true);
  assert.equal(result.rows[0].status, 'CLOSER');
});

test('CLOSER by noise still fails — epsilon is not closer', () => {
  const before = file('X', 'm', 10, 0);
  const after = file('X', 'm', 9.95, 0); // closed 0.5%, under a 10% floor
  const result = gate(before, after, [{ id: 'X', measure: 'm', minFraction: 0.1 }]);
  assert.equal(result.pass, false);
  assert.equal(result.rows[0].status, 'CLOSER');
  assert.equal(result.rows[0].pass, false);
});

test('moving away from the record fails regardless of size', () => {
  const before = file('X', 'm', 10, 0);
  const after = file('X', 'm', 20, 0);
  const result = gate(before, after, [{ id: 'X', measure: 'm', minFraction: 0.01 }]);
  assert.equal(result.pass, false);
  assert.equal(result.rows[0].status, 'FURTHER');
});

test('no movement fails, and is reported distinctly from FURTHER', () => {
  const before = file('X', 'm', 10, 0);
  const after = file('X', 'm', 10, 0);
  const result = gate(before, after, [{ id: 'X', measure: 'm', minFraction: 0.01 }]);
  assert.equal(result.pass, false);
  assert.equal(result.rows[0].status, 'UNMOVED');
});

test('a row missing on either side fails rather than passing by omission', () => {
  const before: NumbersFile = { items: [] };
  const after = file('X', 'm', 8, 0);
  const result = gate(before, after, [{ id: 'X', measure: 'm', minFraction: 0.1 }]);
  assert.equal(result.pass, false);
  assert.equal(result.rows[0].status, 'MISSING');
});

test('a row with no historical figure at all fails rather than passing by omission', () => {
  const before = file('X', 'm', 10, undefined);
  const after = file('X', 'm', 8, undefined);
  const result = gate(before, after, [{ id: 'X', measure: 'm', minFraction: 0.1 }]);
  assert.equal(result.pass, false);
  assert.equal(result.rows[0].status, 'MISSING');
});

test('the historical figure may come from either file, same as --diff', () => {
  const before = file('X', 'm', 10, 5);
  const after: NumbersFile = { items: [{ id: 'X', measures: [{ name: 'm', value: 6 }] }] };
  const result = gate(before, after, [{ id: 'X', measure: 'm', minFraction: 0.1 }]);
  assert.equal(result.rows[0].historical, 5);
  assert.equal(result.pass, true); // gap 5 -> 1, closed 80%
});

test('the gate fails overall if any one frozen row fails, even if the rest pass', () => {
  const before: NumbersFile = { items: [
    { id: 'X', measures: [{ name: 'm', value: 10, historical: 0 }] },
    { id: 'Y', measures: [{ name: 'n', value: 10, historical: 0 }] },
  ] };
  const after: NumbersFile = { items: [
    { id: 'X', measures: [{ name: 'm', value: 0, historical: 0 }] }, // fully closed
    { id: 'Y', measures: [{ name: 'n', value: 10, historical: 0 }] }, // unmoved
  ] };
  const result = gate(before, after, [
    { id: 'X', measure: 'm', minFraction: 0.1 },
    { id: 'Y', measure: 'n', minFraction: 0.1 },
  ]);
  assert.equal(result.rows[0].pass, true);
  assert.equal(result.rows[1].pass, false);
  assert.equal(result.pass, false);
});

test('the shipped frozen row set names no clock-bound or unpaired rows', () => {
  // Regression guard for the two exclusions #147/gate.ts's header documents:
  // D5 (clock-bound) and B1's walkover-share row (unpaired since #93).
  for (const row of FROZEN_GATE_ROWS) {
    assert.notEqual(row.id, 'D5-realignment-lag');
    assert.ok(!(row.id === 'B1-race-resolution' && row.measure === 'House generals: walkover share'));
  }
});
