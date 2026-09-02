import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newEconomy, spend, fedCheck, rateRiseOdds, economyModifier } from './economy.ts';
import type { EconomyConfig } from './economy.ts';
import { RNG } from './rng.ts';
import cfgJson from '../config/baseline.json' with { type: 'json' };

const cfg = cfgJson.economy as EconomyConfig;

test('the Fed curve is steepest at 6-8, and G12 is a certainty', () => {
  assert.equal(rateRiseOdds(12), 1, 'G12 is a certainty');
  assert.equal(rateRiseOdds(1), 0, '2d6 cannot roll under 2');
  const slope = (g: number) => rateRiseOdds(g) - rateRiseOdds(g - 1);
  const steepest = [...Array(11).keys()].map((i) => i + 2)
    .reduce((best, g) => (slope(g) > slope(best) ? g : best), 2);
  assert.ok(steepest >= 6 && steepest <= 8, `steepest at G${steepest}, doc says 6-8`);
});

test('a rate rise spends down the track and cools the economy', () => {
  const e = newEconomy(cfg);
  e.accumulatedG = 12; e.level = 3;
  const { rateRise } = fedCheck(e, cfg, new RNG(4));
  assert.ok(rateRise, 'at G12 the Fed always tightens');
  assert.equal(e.accumulatedG, 12 - cfg.rateRiseSpendDown);
  assert.equal(e.level, 1, 'the recession follows the tightening');
});

test('the economy modifier is asymmetric — punishment exceeds reward', () => {
  const e = newEconomy(cfg);
  e.level = cfg.strongAt;
  assert.equal(economyModifier(e, cfg, 1, -2), 1);
  e.level = cfg.recessionAt;
  assert.equal(economyModifier(e, cfg, 1, -2), -2, 'downturns punish harder than booms reward');
  e.level = 0;
  assert.equal(economyModifier(e, cfg, 1, -2), 0);
});

test('austerity is legal and cools the economy (negative G)', () => {
  const e = newEconomy(cfg); e.level = 2; e.accumulatedG = 6;
  spend(e, cfg, -3);
  assert.ok(e.level < 2, 'austerity cools');
  assert.equal(e.accumulatedG, 3, 'and reduces the Fed threat');
});

test('the chicken game: spending hot makes tightening near-certain', () => {
  const e = newEconomy(cfg);
  for (let i = 0; i < 3; i++) spend(e, cfg, 4);
  assert.ok(rateRiseOdds(e.accumulatedG) > 0.9, 'run hot enough and the reckoning is certain');
});
