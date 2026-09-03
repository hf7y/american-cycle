/** #29: the UI and the simulator must play the same game.
 *
 *  `tick()` and `interactiveTick()` were two hand-maintained copies of one turn
 *  sequence, and they had drifted in four places: the bill-year gate, the
 *  odd-year-governor gate, `releaseHolders()` and `vacateForRunners()`.
 *
 *  Every one of the four is gated behind a flag no shipped config sets, so on
 *  `as-written-plus` the two paths agree and a digest test over the shipped
 *  configs proves nothing. Measured against the pre-fix engine, 12 years x 3
 *  seeds:
 *
 *      shipped configs      0/3 diverge      <- why nobody noticed
 *      resignToRun: true    3/3 diverge      <- #17 wants exactly this
 *      biennial bills       3/3 diverge
 *      oddYearGovernors     3/3 diverge
 *
 *  So this is a gate on #17: turning resignToRun on without this fix means the
 *  browser and the simulator disagree in every seed tried. The flags are the
 *  test, and the shipped-config case is only a regression guard. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game, isBillYear, isElectionYear, type Config, type Agent, type UiAnswer } from './game.ts';
import { RNG } from './rules/rng.ts';
import { AGENTS } from '../sim/agents.ts';
import type { Card } from './types/index.ts';

// Inlined rather than imported from sim/harness.ts, which runs a CLI on import.
const loadConfig = (name: string): Config =>
  JSON.parse(readFileSync(new URL(`./config/${name}`, import.meta.url), 'utf8')) as Config;
const CARDS: Card[] = ['1932', '1964', '1976', '1992', '2008', '2016', '2024'].flatMap((n) =>
  JSON.parse(readFileSync(new URL(`../data/pack-${n}.json`, import.meta.url), 'utf8')).cards as Card[]);

const NAMES = ['Greedy', 'Random', 'Lookahead'];
const SEEDS = [1, 20260831, 7777];
const YEARS = 12;

const build = (cfg: Config, seed: number): Agent[] => {
  const rng = new RNG(seed);
  return NAMES.map((n) => new AGENTS[n](cfg, rng));
};

/** `human = -1` matches no player, so every seat is driven by its own agent and
 *  the interactive path becomes the headless one plus its yields: `askBill`
 *  returns early and no race is the human's, so the only request is `declare`.
 *  Answering it with nothing leaves the agents in charge of both runs, which is
 *  what makes the two comparable at all. */
function play(cfg: Config, seed: number, interactive: boolean): string {
  const g = new Game(build(cfg, seed), structuredClone(CARDS), cfg, seed);
  for (let y = 0; y < YEARS; y++) {
    if (!interactive) { g.tick(); continue; }
    const it = g.interactiveTick(-1);
    for (let r = it.next(); !r.done; r = it.next({ declarations: [] } as UiAnswer));
  }
  return JSON.stringify(g.result());
}

const assertParity = (cfg: Config, label: string) => {
  for (const seed of SEEDS) {
    assert.equal(play(cfg, seed, true), play(cfg, seed, false),
      `${label}, seed ${seed}: the browser and the simulator played different games`);
  }
};

// The flags that make the drift bite. Each was 3/3 divergent before the fix.
test('parity holds with resignToRun on -- the gate on #17', () => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.game.resignToRun = true;
  assertParity(cfg, 'resignToRun');
});

test('parity holds with biennial bills', () => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.legislature.billFrequency = 'biennial';
  assertParity(cfg, 'biennial');
});

test('parity holds with odd-year governors on', () => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.game.oddYearGovernors = true;
  assertParity(cfg, 'oddYearGovernors');
});

test('parity holds with all three flags on at once', () => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.game.resignToRun = true;
  cfg.legislature.billFrequency = 'biennial';
  cfg.game.oddYearGovernors = true;
  assertParity(cfg, 'all three');
});

// Regression guard only: these agree today and agreed before the fix.
for (const name of ['as-written-plus.json', 'baseline.json']) {
  test(`parity holds on shipped ${name} (latent case)`, () => assertParity(loadConfig(name), name));
}

test('the bill-year gate is one function, and biennial means even years only', () => {
  const cfg = loadConfig('as-written-plus.json');
  assert.equal(cfg.legislature.billFrequency, 'annual');
  for (const y of [2024, 2025, 2026, 2027]) assert.equal(isBillYear(cfg, y), true);

  const biennial = structuredClone(cfg);
  biennial.legislature.billFrequency = 'biennial';
  assert.deepEqual([2024, 2025, 2026, 2027].map((y) => isBillYear(biennial, y)), [true, false, true, false]);
});

/** A rule with THREE copies, two of them unified. The parity test above compares
 *  tick() with interactiveTick(), and both read the same GameView -- so a rule
 *  that is wrong in the view is wrong identically in both paths and parity still
 *  passes. This asserts the view agrees with the function the engine gates on. */
test('GameView.isElectionYear agrees with the gate the engine actually uses', () => {
  const cfg = loadConfig('as-written-plus.json');
  const odd = structuredClone(cfg);
  odd.game.oddYearGovernors = true;
  for (const c of [cfg, odd]) {
    const g = new Game(build(c, 1), structuredClone(CARDS), c, 1);
    for (let y = 0; y < 8; y++) {
      const seen = (g as unknown as { view(i: number): { year: number; isElectionYear: boolean } }).view(0);
      assert.equal(seen.isElectionYear, isElectionYear(c, seen.year),
        `year ${seen.year}: the view tells an agent ${seen.isElectionYear} while the engine gates on ${isElectionYear(c, seen.year)}`);
      g.tick();
    }
  }
});

test('the election-year gate is one function, and odd years need a governor up', () => {
  const cfg = loadConfig('as-written-plus.json');

  const even = structuredClone(cfg);
  even.game.oddYearGovernors = false;
  for (const y of [2024, 2026]) assert.equal(isElectionYear(even, y), true);
  for (const y of [2025, 2027]) assert.equal(isElectionYear(even, y), false);

  // #17/#23 ship oddYearGovernors: true on the loaded config itself.
  assert.equal(cfg.game.oddYearGovernors, true);
  assert.equal(isElectionYear(cfg, 2024), true);
  assert.ok([2025, 2027].some((y) => isElectionYear(cfg, y)),
    'no odd year has a governor up, so the flag could never do anything');
});
