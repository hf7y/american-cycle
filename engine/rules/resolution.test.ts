import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oddsAtEdge, resolveRace, Wave, modifierTotal } from './resolution.ts';
import { RNG } from './rng.ts';

/** BUILD-BRIEF: "a single passing test that verifies the odds table. That test
 *  is the foundation the rest of the game sits on." */
test('odds table matches design doc §3 within one percentage point', () => {
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
      // fresh wave each race: independent 3d6 a side, which is what §3's SD requires
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

test('heterodoxy ignores national modifiers but not the national die', () => {
  const side = {
    player: 0, cardId: 'manchin', party: 'D' as const, heterodox: true,
    modifiers: [
      { source: 'midterm', pips: -2, national: true },
      { source: 'district synergy', pips: 3 },
    ],
  };
  assert.equal(modifierTotal(side), 3, 'the -2 midterm penalty is ignored');
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
