/** The victory endings, and the path that never asked about them.
 *
 *  `victor()` was a private method called from `run()` alone. The headless game
 *  therefore ended on a victory and the browser, which drives
 *  `interactiveTick()`, played to the year cap however many bills anyone
 *  authored. That is #29's two-paths-one-rule divergence in a fifth place, and
 *  the one place `game.parity.test.ts` structurally cannot see: it compares the
 *  two TICKS, and the ending lives in the loop around them.
 *
 *  hf7y/american-cycle#65 rules that bills passed is the victory condition, so
 *  `'bills'` is the case that has to work rather than merely exist.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  Game, victorOf, type Config, type Agent, type UiAnswer, type VictoryTally, type Victory,
} from './game.ts';
import { RNG } from './rules/rng.ts';
import { AGENTS } from '../sim/agents.ts';
import type { Card } from './types/index.ts';

const loadConfig = (name: string): Config =>
  JSON.parse(readFileSync(new URL(`./config/${name}`, import.meta.url), 'utf8')) as Config;
const CARDS: Card[] = ['1932', '1964', '1976', '1992', '2008', '2016', '2024'].flatMap((n) =>
  JSON.parse(readFileSync(new URL(`../data/pack-${n}.json`, import.meta.url), 'utf8')).cards as Card[]);

const PLAYERS = [{ id: 0 }, { id: 1 }, { id: 2 }];
const tally = (t: Partial<VictoryTally>): VictoryTally =>
  ({ billsBy: {}, termsBy: {}, consecutiveBy: {}, ...t });

const withVictory = (v: Victory, billTarget?: number): Config => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.game.victory = v;
  if (billTarget !== undefined) cfg.game.billTarget = billTarget;
  return cfg;
};

// ------------------------------------------------------------ the predicate

test("'bills' fires for the player who reaches the target, and not before", () => {
  const cfg = withVictory('bills', 8);
  assert.equal(victorOf(cfg, PLAYERS, tally({ billsBy: { 0: 7, 1: 3 } })), undefined);
  assert.equal(victorOf(cfg, PLAYERS, tally({ billsBy: { 0: 7, 1: 8 } })), 1);
});

test("'bills' reads billTarget from the config rather than a constant", () => {
  assert.equal(victorOf(withVictory('bills', 3), PLAYERS, tally({ billsBy: { 2: 3 } })), 2);
  assert.equal(victorOf(withVictory('bills', 12), PLAYERS, tally({ billsBy: { 2: 3 } })), undefined);
});

test("'points' names no ending, so the game plays out its year cap", () => {
  const cfg = withVictory('points');
  assert.equal(victorOf(cfg, PLAYERS, tally({ billsBy: { 0: 99 }, termsBy: { 1: 9 } })), undefined);
});

test("the term endings count terms and consecutive terms separately", () => {
  assert.equal(victorOf(withVictory('three-terms'), PLAYERS, tally({ termsBy: { 1: 3 } })), 1);
  assert.equal(victorOf(withVictory('three-terms'), PLAYERS, tally({ termsBy: { 1: 2 } })), undefined);
  // two-terms is CONSECUTIVE: three non-consecutive terms do not win it.
  assert.equal(victorOf(withVictory('two-terms'), PLAYERS, tally({ termsBy: { 1: 3 } })), undefined);
  assert.equal(victorOf(withVictory('two-terms'), PLAYERS, tally({ consecutiveBy: { 1: 2 } })), 1);
});

test("'parallel' fires on whichever ending arrives first", () => {
  const cfg = withVictory('parallel', 8);
  assert.equal(victorOf(cfg, PLAYERS, tally({ billsBy: { 0: 8 } })), 0);
  assert.equal(victorOf(cfg, PLAYERS, tally({ consecutiveBy: { 2: 2 } })), 2);
  assert.equal(victorOf(cfg, PLAYERS, tally({ billsBy: { 0: 1 }, termsBy: { 2: 1 } })), undefined);
});

test('a missing tally entry is zero, not a crash', () => {
  assert.equal(victorOf(withVictory('bills', 1), [{ id: 5 }], tally({})), undefined);
});

// ------------------------------------------------- the path that never asked

/** `human = -1` matches no player, so every seat is agent-driven and the
 *  interactive path is the headless one plus its yields -- the same device
 *  game.parity.test.ts uses. */
function playInteractive(cfg: Config, seed: number, years: number): Game {
  const rng = new RNG(seed);
  const agents: Agent[] = ['BillAuthor', 'Greedy', 'Random'].map((n) => new AGENTS[n](cfg, rng));
  const g = new Game(agents, structuredClone(CARDS), cfg, seed);
  for (let y = 0; y < years; y++) {
    if (g.wonBy !== undefined) break;
    const it = g.interactiveTick(-1);
    for (let r = it.next(); !r.done; r = it.next({ declarations: [] } as UiAnswer));
  }
  return g;
}

test('the interactive path ends on a victory, as the headless one does', () => {
  // Target 1 so the ending is reached well inside the cap on every seed; the
  // point under test is that the browser path ASKS, not where the bar sits.
  const cfg = withVictory('bills', 1);
  const g = playInteractive(cfg, 20260901, cfg.game.maxYears);
  assert.notEqual(g.wonBy, undefined, 'the browser path ran to the cap with an ending available');
  assert.ok((g.billsBy[g.wonBy!] ?? 0) >= 1, 'wonBy names a player who did not meet the condition');
});

test('both paths agree on who won and when', () => {
  const cfg = withVictory('bills', 2);
  for (const seed of [1, 20260831, 7777]) {
    const rng = new RNG(seed);
    const agents: Agent[] = ['BillAuthor', 'Greedy', 'Random'].map((n) => new AGENTS[n](cfg, rng));
    const headless = new Game(agents, structuredClone(CARDS), cfg, seed).run();
    const g = playInteractive(cfg, seed, cfg.game.maxYears);
    assert.equal(g.wonBy, headless.wonBy, `seed ${seed}: the two paths ended on different players`);
    assert.equal(g.result().years, headless.years, `seed ${seed}: the two paths ended in different years`);
  }
});
