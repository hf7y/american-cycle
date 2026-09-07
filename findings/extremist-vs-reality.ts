import { readFileSync } from 'node:fs';
import { loadConfig, loadPacks, playOne, ALL_PACKS } from '../sim/harness.ts';
import type { Config } from '../engine/game.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#159, ruled 2026-09-06: "add a toggle to turn this off,
 *  measure this against reality to see if it's worth it." `extremistPrimary`
 *  / `extremistGeneral` are already sweepable numeric knobs -- the same shape
 *  `Config.endorsements.presidentCount` uses as sweep precedent -- so the
 *  toggle is the zeroed variant of those fields, not a new schema field.
 *
 *  The comparison Zach asked for is NOT on-vs-off; it's each arm against the
 *  real record (findings/margin-ceiling.ts's #11 yardstick), because a flag
 *  that moves the sim without moving it CLOSER to reality is not a case for
 *  keeping the tag. */
const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];

function real() {
  const url = new URL('../data/historical/baseline.json', import.meta.url);
  const f = JSON.parse(readFileSync(url, 'utf8')) as {
    derived: { house_median_abs_margin_pts: number; house_safe_40plus_pct: number; house_competitive_under10_pct: number };
  };
  return f.derived;
}

/** Same method as margin-ceiling.ts's simMargins(): every CONTESTED House
 *  general over `seeds` games, in points (1 pip = 2 points, DECISIONS.md).
 *  Parametrized on the full config so the extremist arm can be swept. */
function simMargins(cfg: Config, seedOffset: number, seedCount: number) {
  const cards = loadPacks(ALL_PACKS);
  const full: Config = { ...cfg, game: { ...cfg.game, startYear: 1932 } };
  const pts: number[] = [];
  for (let i = 0; i < seedCount; i++) {
    for (const e of playOne(AGENTS, cards, full, seedOffset + i).events) {
      if (e.office !== 'representative' || e.round !== 'general' || e.uncontested) continue;
      pts.push(2 * Math.abs(e.margin));
    }
  }
  pts.sort((a, b) => a - b);
  const pct = (ok: (p: number) => boolean) => (100 * pts.filter(ok).length) / pts.length;
  return { median: pts[Math.floor(pts.length / 2)], safe: pct((p) => p >= 40), competitive: pct((p) => p < 10) };
}

/** Every extremist side over `seeds` games, contested or not -- the
 *  candidacy-level expectation the pricing finding (findings/extremist-pricing.ts)
 *  named and did not compute: what the tag is worth PER APPEARANCE, folding in
 *  the appearances where it never gets the chance to fire. This is a per-
 *  candidacy average (one primary, one general), not a multi-cycle career
 *  average -- that needs per-card tracking across a whole game and is out of
 *  scope tonight. */
function perCandidacyValue(cfg: Config, seedOffset: number, seedCount: number) {
  const cards = loadPacks(ALL_PACKS);
  let primarySides = 0, primaryFired = 0, generalSides = 0, generalFired = 0;
  for (let i = 0; i < seedCount; i++) {
    for (const ev of playOne(AGENTS, cards, cfg, seedOffset + i).events) {
      for (const s of ev.sides) {
        if (s.modifiers.some((m) => m.source === 'extremist (primary)')) { primarySides++; if (!ev.uncontested) primaryFired++; }
        if (s.modifiers.some((m) => m.source === 'extremist (general)')) { generalSides++; if (!ev.uncontested) generalFired++; }
      }
    }
  }
  const primaryRate = primarySides ? primaryFired / primarySides : 0;
  const generalRate = generalSides ? generalFired / generalSides : 0;
  return { netPerCandidacy: primaryRate * 2 + generalRate * -2, primaryRate, generalRate };
}

export const finding: Finding = {
  id: 'extremist-vs-reality',
  dependsOn: [],
  question:
    "hf7y/american-cycle#159, ruled 2026-09-06: with `extremist` behind a toggle (the existing "
    + '`extremistPrimary`/`extremistGeneral` fields, zeroed), which arm -- shipped +2/-2, or off -- '
    + 'produces a House margin distribution closer to the real record (hf7y/american-cycle#11\'s yardstick), '
    + "and is the difference even detectable at a measurable sample, or is 12.7% of the deck carrying a "
    + 'tag with no measurable effect on realism at all?',

  headline:
    'ON is closer to reality, and the gap is real, not noise -- but both arms stay far off, so extremist is not '
    + 'the fix for the compression margin-ceiling.ts already names. Summed over the three #11-yardstick gaps '
    + '(median margin, 40+pt safe-seat share, sub-10pt competitive share), the shipped +2/-2 arm sits at 91.3 '
    + 'against the OFF arm\'s 95.9 -- a 4.6-point gap that clears the 2.0-point noise floor measured by re-running '
    + 'the ON arm on a disjoint seed block. Both arms are still an order of magnitude off the real record (median '
    + '10 simulated pts against a real 32.5, near-zero simulated safe seats against a real 37.5%), so the toggle '
    + "moving realism a little closer is not evidence the tag is doing the job DECISIONS.md's calibration gap "
    + 'needs -- it is evidence a tag on 12.7% of the deck is not making that gap worse, which is the bar #159 set. '
    + 'Per candidacy (one primary, one general), extremist nets +1.31 expected pips: the primary bonus fires in '
    + '100% of appearances, the general penalty in about 35%, mirroring extremist-pricing.ts\'s contested-share '
    + 'finding restated as a single signed number.',
  stampedAt: '2026-09-07T02:45:00Z',
  stampedOn: 'a8525cc',

  predicate(): Claim[] {
    const seedCount = sample(80);
    const on = loadConfig('tuned.json');
    const off: Config = { ...on, primaryGeneral: { ...on.primaryGeneral, extremistPrimary: 0, extremistGeneral: 0 } };
    const r = real();

    const onA = simMargins(on, 2026090, seedCount);
    const offA = simMargins(off, 2026090, seedCount);
    // A same-arm replicate on a disjoint seed block, to size the noise floor
    // the on-vs-off gap has to clear before it counts as a detected effect.
    const onB = simMargins(on, 2126090, seedCount);

    const value = perCandidacyValue(on, 2026090, seedCount);

    const dist = (x: { median: number; safe: number; competitive: number }) =>
      Math.abs(x.median - r.house_median_abs_margin_pts)
      + Math.abs(x.safe - r.house_safe_40plus_pct)
      + Math.abs(x.competitive - r.house_competitive_under10_pct);

    return [
      { name: 'real: median House margin', value: r.house_median_abs_margin_pts, stamped: 32.5, tolerance: 0.5, unit: 'pts' },
      { name: 'real: safe seats, 40+ pts', value: r.house_safe_40plus_pct, stamped: 37.5, tolerance: 0.5, unit: '%' },
      { name: 'real: competitive, under 10 pts', value: r.house_competitive_under10_pct, stamped: 13.5, tolerance: 0.5, unit: '%' },

      { name: 'extremist ON: median House margin', value: onA.median, stamped: 10, tolerance: 3, unit: 'pts' },
      { name: 'extremist ON: safe seats, 40+ pts', value: onA.safe, stamped: 0.89, tolerance: 3, unit: '%' },
      { name: 'extremist ON: competitive, under 10 pts', value: onA.competitive, stamped: 45.70, tolerance: 5, unit: '%' },

      { name: 'extremist OFF: median House margin', value: offA.median, stamped: 10, tolerance: 3, unit: 'pts' },
      { name: 'extremist OFF: safe seats, 40+ pts', value: offA.safe, stamped: 0.44, tolerance: 3, unit: '%' },
      { name: 'extremist OFF: competitive, under 10 pts', value: offA.competitive, stamped: 49.85, tolerance: 5, unit: '%' },

      // Noise floor: the ON arm re-run on a disjoint seed block. If the
      // on-vs-off gap is no bigger than this same-arm gap, the toggle is not
      // detectable at this sample size.
      { name: 'extremist ON (replicate): median House margin', value: onB.median, stamped: 10, tolerance: 3, unit: 'pts' },
      { name: 'extremist ON (replicate): safe seats, 40+ pts', value: onB.safe, stamped: 0.33, tolerance: 3, unit: '%' },
      { name: 'extremist ON (replicate): competitive, under 10 pts', value: onB.competitive, stamped: 47.15, tolerance: 5, unit: '%' },

      { name: 'distance to real, extremist ON (sum of three gaps)', value: dist(onA), stamped: 91.31, tolerance: 5, unit: 'pts+pp' },
      { name: 'distance to real, extremist OFF (sum of three gaps)', value: dist(offA), stamped: 95.91, tolerance: 5, unit: 'pts+pp' },
      { name: 'distance to real, extremist ON (replicate)', value: dist(onB), stamped: 93.33, tolerance: 5, unit: 'pts+pp' },

      { name: 'extremist: net expected pips per candidacy (primary+general)', value: value.netPerCandidacy, stamped: 1.31, tolerance: 0.3 },
      { name: 'extremist: primary fire rate (contested share)', value: 100 * value.primaryRate, stamped: 100, tolerance: 5, unit: '%' },
      { name: 'extremist: general fire rate (contested share)', value: 100 * value.generalRate, stamped: 34.62, tolerance: 5, unit: '%' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const distOn = v('distance to real, extremist ON (sum of three gaps)');
    const distOff = v('distance to real, extremist OFF (sum of three gaps)');
    const distReplicate = v('distance to real, extremist ON (replicate)');
    const closer = distOn < distOff ? 'ON' : distOff < distOn ? 'OFF' : 'neither -- tied';
    const onOffGap = Math.abs(distOn - distOff);
    const noiseFloor = Math.abs(distOn - distReplicate);
    const detectable = onOffGap > noiseFloor;
    return [
      `on the sum of the three #11-yardstick gaps (median/safe%/competitive%), ${closer} sits closer to the real record `
      + `(ON: ${distOn.toFixed(1)}, OFF: ${distOff.toFixed(1)})`,
      detectable
        ? `and the on/off gap (${onOffGap.toFixed(1)}) clears the same-arm replicate noise floor `
          + `(${noiseFloor.toFixed(1)}), so the toggle has a detectable effect on realism at this sample size`
        : `but the on/off gap (${onOffGap.toFixed(1)}) does not clear the same-arm replicate noise floor `
          + `(${noiseFloor.toFixed(1)}) -- a tag on 12.7% of the deck moving nothing measurable against reality is itself `
          + 'the publishable result #159\'s ruling asked this finding to be prepared to report',
      `per candidacy, extremist nets ${v('extremist: net expected pips per candidacy (primary+general)').toFixed(2)} `
      + `expected pips (primary fires ${v('extremist: primary fire rate (contested share)').toFixed(0)}% of the time at `
      + `+2, general fires ${v('extremist: general fire rate (contested share)').toFixed(0)}% of the time at -2) -- `
      + 'a per-candidacy figure, not a multi-cycle career average, which would need per-card tracking',
    ].join('; ');
  },
};
