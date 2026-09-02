import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oddsAtEdge, primaryOddsAtEdge, resolveRace, Wave, modifierTotal } from './resolution.ts';
import { RNG } from './rng.ts';

/** BUILD-BRIEF: "a single passing test that verifies the odds table. That test
 *  is the foundation the rest of the game sits on." */
test('odds table matches the exact 3d6 vs 3d6 probabilities within one percentage point', () => {
  const doc: Record<number, number> = { 0: 50, 1: 59, 2: 68, 3: 76, 4: 82, 5: 88, 6: 92, 8: 97 };
  for (const [edge, pct] of Object.entries(doc)) {
    const actual = 100 * oddsAtEdge(Number(edge));
    assert.ok(Math.abs(actual - pct) <= 1.0,
      `edge +${edge}: doc says ${pct}%, exact is ${actual.toFixed(1)}%`);
  }
});

test('simulated dice reproduce the odds table within one point', () => {
  const rng = new RNG(20260831);
  for (const edge of [0, 2, 4, 6]) {
    let wins = 0;
    const N = 200_000;
    for (let i = 0; i < N; i++) {
      // fresh wave each race: independent 3d6 a side, which is what the 4.18-pip SD requires
      const w = new Wave(rng);
      const ev = resolveRace({
        year: 1976, round: 'general', office: 'senator', state: 'OH', wave: w, rng,
        sides: [
          { player: 0, cardId: 'a', party: 'D', modifiers: [{ source: 'edge', pips: edge }] },
          { player: 1, cardId: 'b', party: 'R', modifiers: [] },
        ],
      });
      if (ev.winner === 0) wins++;
    }
    const pct = 100 * wins / N;
    const want = 100 * oddsAtEdge(edge);
    assert.ok(Math.abs(pct - want) < 1.0, `edge +${edge}: simulated ${pct.toFixed(1)}% vs exact ${want.toFixed(1)}%`);
  }
});

// hf7y/american-cycle#94: a primary is 1d6 vs 1d6 (national/state cancel --
// same party, same state), so a flat candidate die made a 6+ modifier gap
// mathematically unbeatable. 354 of 354 measured favourites at that gap won.
// The candidate die widened to 2d6, swing 5 -> 10.
test('primary odds table matches the exact 2d6 vs 2d6 probabilities within one percentage point', () => {
  const doc: Record<number, number> = { 0: 50, 1: 61, 2: 71, 3: 80, 4: 87, 5: 92, 6: 96, 8: 99, 10: 100 };
  for (const [edge, pct] of Object.entries(doc)) {
    const actual = 100 * primaryOddsAtEdge(Number(edge));
    assert.ok(Math.abs(actual - pct) <= 1.0,
      `edge +${edge}: doc says ${pct}%, exact is ${actual.toFixed(1)}%`);
  }
});

test('no modifier gap reachable by the printed cards makes a primary certain', () => {
  // incumbencyPrimary (4) + a presidential endorsement (3) + identityBonus (1)
  // + extremistPrimary (2) = 10, the largest stack the shipped configs can
  // print onto one side (engine/config/tuned.json). At the old 1d6 candidate
  // die this and everything past +5 was a certainty; it no longer is.
  const REACHABLE_MAX_GAP = 10;
  for (let edge = 0; edge <= REACHABLE_MAX_GAP; edge++) {
    assert.ok(primaryOddsAtEdge(edge) < 1,
      `edge +${edge}: favourite's win rate is ${100 * primaryOddsAtEdge(edge)}%, should be < 100%`);
  }
});

test('primary dice reproduce the odds table within one point', () => {
  const rng = new RNG(20260902);
  for (const edge of [0, 2, 4, 6]) {
    let wins = 0;
    const N = 200_000;
    for (let i = 0; i < N; i++) {
      const w = new Wave(rng);
      const ev = resolveRace({
        year: 1976, round: 'primary', office: 'senator', state: 'OH', wave: w, rng,
        sides: [
          { player: 0, cardId: 'a', party: 'D', modifiers: [{ source: 'edge', pips: edge }] },
          { player: 1, cardId: 'b', party: 'D', modifiers: [] },
        ],
      });
      if (ev.winner === 0) wins++;
    }
    const pct = 100 * wins / N;
    const want = 100 * primaryOddsAtEdge(edge);
    assert.ok(Math.abs(pct - want) < 1.0, `edge +${edge}: simulated ${pct.toFixed(1)}% vs exact ${want.toFixed(1)}%`);
  }
});

test('a primary side rolls two candidate dice, a general rolls one', () => {
  const rng = new RNG(5);
  const wave = new Wave(rng);
  const primary = wave.roll('D', 'OH', rng, 'primary');
  assert.ok(primary.candidate >= 2 && primary.candidate <= 12, `2d6 sums to 2-12, got ${primary.candidate}`);
  const general = wave.roll('R', 'PA', rng, 'general');
  assert.ok(general.candidate >= 1 && general.candidate <= 6, `1d6 is 1-6, got ${general.candidate}`);
});

test('nobody is insulated: the tide counts and three dice still roll', () => {
  // Heterodoxy used to let a card shed every `national` modifier. Measured,
  // that exemption was worth +0.316 pips -- 7.6% of the general's 4.18 SD --
  // against the -2 the same tag charged in the primary, so it was cut and
  // `Modifier.national` went with it. The stack is now a plain sum.
  const side = {
    player: 0, cardId: 'manchin', party: 'D' as const,
    modifiers: [
      { source: 'midterm', pips: -2 },
      { source: 'district synergy', pips: 3 },
    ],
  };
  assert.equal(modifierTotal(side), 1, 'the tide is felt by everyone');
  const rng = new RNG(7);
  const ev = resolveRace({
    year: 1978, round: 'general', office: 'senator', state: 'WV', wave: new Wave(rng), rng,
    sides: [side, { player: 1, cardId: 'x', party: 'R', modifiers: [] }],
  });
  // three dice still rolled: nobody is insulated from noise
  assert.ok(ev.sides[0].dice.national >= 1 && ev.sides[0].dice.national <= 6);
});

test('the counterfactual records who would have won on modifiers alone', () => {
  const rng = new RNG(11);
  let upsets = 0;
  for (let i = 0; i < 2000; i++) {
    const ev = resolveRace({
      year: 1976, round: 'general', office: 'governor', state: 'ME', wave: new Wave(rng), rng,
      sides: [
        { player: 0, cardId: 'a', party: 'D', modifiers: [{ source: 'edge', pips: 4 }] },
        { player: 1, cardId: 'b', party: 'R', modifiers: [] },
      ],
    });
    assert.equal(ev.zeroDiceWinner, 0, 'player 0 is the favourite on modifiers');
    if (ev.upset) upsets++;
  }
  const rate = upsets / 2000;
  const expected = 1 - oddsAtEdge(4);
  assert.ok(Math.abs(rate - expected) < 0.03, `upset rate ${rate} vs expected ${expected}`);
});
