import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPush, decay, pushForMargin, nationalizedRace, honeymoon } from './lean.ts';
import type { LeanConfig } from './lean.ts';
import cfgJson from '../config/baseline.json' with { type: 'json' };

const cfg = cfgJson.lean as LeanConfig;

test('pushes are margin-based, not flat (§10)', () => {
  assert.equal(pushForMargin(cfg, 0), 0, 'a squeaker changes nothing');
  assert.equal(pushForMargin(cfg, 1), 0);
  assert.equal(pushForMargin(cfg, 2), 1);
  assert.equal(pushForMargin(cfg, 3), 1);
  assert.equal(pushForMargin(cfg, 4), 2, 'a blowout moves the map two');
  assert.equal(pushForMargin(cfg, 12), 2);
});

/** BUILD-BRIEF correctness target: "Governors never push lean." */
test('governors never push under the baseline priority rule', () => {
  const lean = { MA: 0 };
  assert.equal(applyPush(lean, cfg, 'MA', 'R', 'governor', 6), 0);
  assert.equal(lean.MA, 0, 'Baker winning Massachusetts tells you nothing');
});

test('the with-lean variant pushes only with the grain', () => {
  const v: LeanConfig = { ...cfg, governorPushes: 'with-lean' };
  const withGrain = { WY: 3 };
  applyPush(withGrain, v, 'WY', 'R', 'governor', 4);
  assert.equal(withGrain.WY, 5, 'a Republican winning Wyoming is a nationalized result');
  const against = { MA: -3 };
  applyPush(against, v, 'MA', 'R', 'governor', 4);
  assert.equal(against.MA, -3, 'a Republican winning Massachusetts is a personality');
});

test('the most nationalized race on the ballot is the one that pushes', () => {
  const races = [
    { office: 'governor' as const }, { office: 'representative' as const },
    { office: 'senator' as const }, { office: 'president' as const },
  ];
  assert.equal(nationalizedRace(races)!.office, 'president');
  assert.equal(nationalizedRace(races.slice(0, 3))!.office, 'senator');
  assert.equal(nationalizedRace(races.slice(0, 2))!.office, 'representative');
  assert.equal(nationalizedRace(races.slice(0, 1))!.office, 'governor');
});

/** BUILD-BRIEF correctness target: "Lean decay applies before push, every
 *  cycle, every state." The ordering is what makes the flat-push pathology
 *  real, so it is asserted as a sequence, not just as two functions. */
test('decay applies to every state and runs before push', () => {
  const lean = { OH: 3, CA: -2, WY: 0 };
  decay(lean, cfg, 1976);
  assert.deepEqual(lean, { OH: 2, CA: -1, WY: 0 }, 'every state, toward zero, never past it');

  // A party winning a state decisively every cycle must NET GAIN. This is the
  // game's central thesis, and only one decay/push pairing delivers it.
  const map = { OH: 0 };
  for (let cycle = 0; cycle < 8; cycle++) {
    decay(map, cfg, 1976 + cycle * 2);
    decay(map, cfg, 1977 + cycle * 2);
    applyPush(map, cfg, 'OH', 'R', 'senator', 4);
  }
  assert.ok(map.OH >= 4, `sustained blowouts must produce a durable lean; got ${map.OH}`);
});

/** §16's first open question, settled by arithmetic. Annual decay removes 2 a
 *  cycle against a maximum push of 2, so the map cannot move regardless of how
 *  decisively anyone wins. This test is the proof, and it is why the baseline
 *  ships biennial. */
test('annual decay makes realignment impossible at any margin', () => {
  const annual: LeanConfig = { ...cfg, decayFrequency: 'annual' };
  const map = { OH: 0 };
  for (let cycle = 0; cycle < 10; cycle++) {
    decay(map, annual, 1976 + cycle * 2);
    decay(map, annual, 1977 + cycle * 2);
    applyPush(map, annual, 'OH', 'R', 'senator', 12);
  }
  assert.equal(map.OH, 2, 'ten straight blowouts, and the map is pinned at the push size');
});

test('flat +1 pushes are the pathology the design doc says they are', () => {
  for (const freq of ['annual', 'biennial'] as const) {
    const flat: LeanConfig = { ...cfg, decayFrequency: freq, pushByMargin: [{ maxPips: 99, push: 1 }] };
    const map = { OH: 0 };
    for (let cycle = 0; cycle < 10; cycle++) {
      decay(map, flat, 1976 + cycle * 2);
      decay(map, flat, 1977 + cycle * 2);
      applyPush(map, flat, 'OH', 'R', 'senator', 8);
    }
    assert.equal(map.OH, 1, `under ${freq} decay a decade of blowouts moves the map nowhere`);
  }
});

test('the honeymoon counter is placed and then decays away', () => {
  const lean = { OH: 0, CA: 0 };
  honeymoon(lean, cfg, ['OH', 'CA'], 'D');
  assert.deepEqual(lean, { OH: -1, CA: -1 });
  // Biennial decay fires in election years, at the top, before declaration
  // (§7 step 5, §10 "the board players see when they declare is already
  // decayed"). So a president elected in 1976 carries the honeymoon through
  // the quiet odd year and loses it at the top of the 1978 midterm -- exactly
  // as the -2 midterm penalty lands.
  decay(lean, cfg, 1977);
  assert.deepEqual(lean, { OH: -1, CA: -1 }, 'odd years are light: no decay');
  decay(lean, cfg, 1978);
  assert.deepEqual(lean, { OH: 0, CA: 0 }, 'real, and short');
});
