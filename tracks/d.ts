/** TRACK D — historical validity. Small, slow-moving, highest value per test.
 *
 *  Nothing else in the repo tests against an oracle the repo did not set
 *  itself. Mixed results here are PERMANENT and expected: the game is a game,
 *  and a rule that reproduces the record on one axis will miss on another.
 *  Not blocking, for the same reason C is not.
 */
import { playOne } from '../sim/harness.ts';
import type { Party, RaceEvent } from '../engine/types/index.ts';
import { mean, pick, share, type Measure, type TrackItem } from './types.ts';

const partyOf = (e: RaceEvent): Party | undefined => e.sides.find((s) => s.player === e.winner)?.party;

/** D1 — midterm loss for the president's party. Near-universal postwar; 1998
 *  and 2002 are the exceptions people cite because there are only two. So the
 *  target is not "always" — it is "usually", and a rule that produced it
 *  always would be wrong in the other direction. */
const d1: TrackItem = {
  id: 'D1-midterm-loss',
  track: 'D',
  question: "Does the president's party lose ground at the midterm, as it did in every postwar cycle but two?",
  run({ runs }): Measure[] {
    let midterms = 0, losses = 0;
    for (const r of runs) {
      const byYear = new Map<number, RaceEvent[]>();
      for (const e of r.events) {
        if (e.round !== 'general' || e.state === 'US') continue;
        (byYear.get(e.year) ?? byYear.set(e.year, []).get(e.year)!).push(e);
      }
      const years = [...byYear.keys()].sort((a, b) => a - b);
      // The president's party is whoever won the last presidential general.
      let pres: Party | undefined;
      const shareIn = (y: number, p: Party) => {
        const ev = byYear.get(y)!.filter((e) => e.office !== 'president');
        return share(ev.filter((e) => partyOf(e) === p).length, ev.length);
      };
      for (const y of years) {
        const top = byYear.get(y)!.find((e) => e.office === 'president');
        if (y % 4 === 0 && top) { pres = partyOf(top); continue; }
        if (y % 4 !== 2 || !pres) continue;
        const prev = years.filter((x) => x < y && x % 2 === 0).pop();
        if (prev === undefined) continue;
        midterms++;
        if (shareIn(y, pres) < shareIn(prev, pres)) losses++;
      }
    }
    return [
      { name: "president's party loses seat share at the midterm", value: share(losses, midterms), unit: 'share of midterms', n: midterms },
    ];
  },
  accept(m) {
    const v = pick(m, "president's party loses seat share at the midterm");
    return { pass: v >= 0.7 && v <= 0.95, note: `${(100 * v).toFixed(0)}% of midterms cost the president's party ground (postwar: all but two, so the target band is 70-95% rather than 100%)` };
  },
};

/** D2 — a failed conviction backfires on the impeaching side.
 *
 *  Clinton's approval spiked to 73% at the House vote and sat in the high 60s
 *  through acquittal; Gallup recorded a significant drop in Republican Party
 *  favourability alongside 54% saying congressional Republicans had abused
 *  their authority. THE 1998 MIDTERM PRECEDED THE SENATE VOTE BY THREE MONTHS
 *  — the penalty attaches to the attempt, not the verdict, which is why the
 *  implemented rule is flat and fires on failure. */
const d2: TrackItem = {
  id: 'D2-failed-conviction-backfires',
  track: 'D',
  question: 'Does the side that tries and fails to remove a president pay for it?',
  run({ cards, cfg, seeds }): Measure[] {
    const pool = ['Impeacher', 'Impeacher', 'Greedy', 'Lookahead'];
    const block = seeds.slice(0, Math.min(40, seeds.length));
    const off = { ...cfg, legislature: { ...cfg.legislature, impeachBackfirePips: 0 } };
    // The impeaching side is player 0 and 1; the measure is their share of
    // seats at the epilogue with the rule on against off, same seeds.
    const seatShare = (r: { seatsByOffice: Record<string, number>; scores: number[] }) =>
      share(r.scores[0] + r.scores[1], r.scores.reduce((a, b) => a + b, 0));
    return [
      { name: 'impeachers: board share with backfire', value: mean(block.map((s) => seatShare(playOne(pool, cards, cfg, s)))), n: block.length },
      { name: 'impeachers: board share without backfire', value: mean(block.map((s) => seatShare(playOne(pool, cards, off, s)))), n: block.length },
    ];
  },
  accept(m) {
    const on = pick(m, 'impeachers: board share with backfire');
    const off = pick(m, 'impeachers: board share without backfire');
    return {
      pass: on < off,
      note: `impeaching pool holds ${(100 * on).toFixed(1)}% of the board with the rule on against `
        + `${(100 * off).toFixed(1)}% with it off — the attempt must cost, not pay`,
    };
  },
};

/** D3 — shutdown blame direction. 1995-96, 2013 and 2018-19 all point the same
 *  way: the party perceived as MAKING THE DEMAND takes it, and in 1995 and
 *  2013 that party held the congressional majority, so incumbency did not
 *  protect them. The acceptance test is therefore not "the minority is
 *  blamed" — it is that the majority is blamed at least sometimes. */
const d3: TrackItem = {
  id: 'D3-shutdown-blame-direction',
  track: 'D',
  question: 'Is the blame for a failed bill attached to the obstructor rather than to whoever happens to be out of power?',
  run({ runs }): Measure[] {
    const all = runs.flatMap((r) => r.shutdownBlame);
    return [
      { name: 'shutdowns a game', value: all.length / runs.length, n: runs.length },
      { name: 'blamed party held a chamber majority', value: share(all.filter((x) => x.wasMajority).length, all.length), unit: 'share of shutdowns', n: all.length },
    ];
  },
  accept(m) {
    const v = pick(m, 'blamed party held a chamber majority');
    const n = pick(m, 'shutdowns a game');
    return {
      pass: n > 0 && v > 0.2,
      note: n === 0
        ? 'no shutdown occurred, so the direction is untested — not passed'
        : `the blamed party held a chamber majority in ${(100 * v).toFixed(0)}% of shutdowns. `
          + 'In 1995 and 2013 the blamed party held the congressional majority, so a rule that never blames '
          + 'the majority has encoded incumbency by accident. Target >20%.',
    };
  },
};

/** D4 — regime duration against a 30-40 year reference, and whether the year
 *  cap even permits one full cycle. That second half is the load-bearing part:
 *  a 16-year cap cannot contain a 30-year regime, so a null result on the
 *  Skowronek suite would be a fact about the cap and not about the rules. */
const d4: TrackItem = {
  id: 'D4-regime-duration',
  track: 'D',
  question: 'Can a game even be long enough to contain one Skowronekian regime?',
  run({ cfg, runs }): Measure[] {
    return [
      { name: 'year cap', value: cfg.game.maxYears, unit: 'years' },
      { name: 'mean game length', value: mean(runs.map((r) => r.years)), unit: 'years', n: runs.length },
      { name: 'caps needed for a 30-year regime', value: 30 / cfg.game.maxYears },
    ];
  },
  accept(m) {
    const cap = pick(m, 'year cap');
    return { pass: cap >= 30, note: `the cap is ${cap} years against a 30-40 year reference regime; below 30 a null settlement result is a fact about the clock` };
  },
};

/** D5 — realignment frequency and lag. Deep South House seats: 0% Republican
 *  1947-1963, 18.9% in 1965, back to 16.2% in 1967, majority only in 1994.
 *  THIRTY YEARS from lean to seats. */
const d5: TrackItem = {
  id: 'D5-realignment-lag',
  track: 'D',
  question: 'How long does the board take to turn lean into seats?',
  notRun: 'needs a lean series per state per year, which `GameResult.finalLean` does not carry — '
    + 'skowronek/observe.ts snapshots it and is the right home for this. The historical target is a '
    + 'thirty-year lag: Deep South House seats went 0% R 1947-63, 18.9% in 1965, 16.2% in 1967, and did not '
    + 'reach a majority until 1994.',
};

export const D: TrackItem[] = [d1, d2, d3, d4, d5];
