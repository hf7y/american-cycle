import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockers, needed, stateBacks, supportPips, type AmendmentConfig } from './amendment.ts';
import { RNG } from './rng.ts';

const cfg: AmendmentConfig = {
  enabled: true, callFraction: 2 / 3, ratifyFraction: 0.75, windowYears: 8,
  target: 3, rescindTarget: 7, governorPips: 2, districtPips: 2, leanPips: 1,
  tagsPerAmendment: 2, failurePush: 1,
};

test('Article V makes thirteen states a blocking minority — the anti-runaway claim', () => {
  assert.equal(needed(cfg.ratifyFraction, 50), 38);
  assert.equal(blockers(cfg, 50), 13);
  assert.equal(needed(cfg.callFraction, 50), 34);
});

test('the state check reads governor, districts and lean, and nothing else', () => {
  assert.equal(supportPips(cfg, { governor: false, matchingDistricts: 0, leanWith: 0 }), 0);
  assert.equal(supportPips(cfg, { governor: true, matchingDistricts: 2, leanWith: 3 }), 2 + 4 + 3);
});

test('rescission is a harder act than ratification, and that is what lets an amendment ever pass', () => {
  const s = { governor: true, matchingDistricts: 0, leanWith: 0 };   // 2 pips
  const backs = (target: number) => {
    const rng = new RNG(7);
    let n = 0;
    for (let i = 0; i < 600; i++) if (stateBacks(cfg, s, rng, target)) n++;
    return n / 600;
  };
  assert.ok(backs(cfg.target) > backs(cfg.rescindTarget) + 0.3,
    'a symmetric bar pins ratification below three-quarters for ever');
});
