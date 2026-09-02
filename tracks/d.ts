/** TRACK D — historical validity. Small, slow-moving, highest value per test.
 *
 *  Nothing else in the repo tests against an oracle the repo did not set
 *  itself. Mixed results here are PERMANENT and expected: the game is a game,
 *  and a rule that reproduces the record on one axis will miss on another.
 *  Not blocking, for the same reason C is not.
 */
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { AGENTS } from '../sim/agents.ts';
import { playOne } from '../sim/harness.ts';
import type { Party, RaceEvent } from '../engine/types/index.ts';
import { crossOfficeGap, deepSouthRShare, historicalWaveReversal, midtermLoss, realignmentLagYears,
  reversalStats, swingPairs, WAVE_THRESHOLD_PP } from './history.ts';
import { mean, pick, quantile, share, type Measure, type TrackItem } from './types.ts';

const partyOf = (e: RaceEvent): Party | undefined => e.sides.find((s) => s.player === e.winner)?.party;

/** D1 — midterm loss for the president's party. Near-universal postwar; 1998
 *  and 2002 are the exceptions people cite because there are only two. So the
 *  target is not "always" — it is "usually", and a rule that produced it
 *  always would be wrong in the other direction. */
const d1: TrackItem = {
  id: 'D1-midterm-loss',
  track: 'D',
  question: "Does the president's party lose ground at the midterm, as it did in every postwar cycle but two?",
  oracle: 'historical-record',
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
    const h = midtermLoss();
    return [
      { name: "president's party loses seat share at the midterm",
        value: share(losses, midterms), unit: 'share of midterms', n: midterms,
        historical: h.rate,
        historicalNote: `${h.lost} of ${h.n} midterms 1978-2018 in house_district_panel.json; the two `
          + `exceptions the data finds are ${h.exceptions.join(' and ')}, which are the two the record names. `
          + 'Same quantity both sides: share of House seats held by the president\'s party, against the '
          + 'previous election.' },
      { name: 'historical band, lower (Wilson 95% on the record)', value: h.lo, unit: 'share of midterms' },
      { name: 'historical band, upper (Wilson 95% on the record)', value: h.hi, unit: 'share of midterms' },
    ];
  },
  accept(m) {
    const h = midtermLoss();
    const v = pick(m, "president's party loses seat share at the midterm");
    const lo = pick(m, 'historical band, lower (Wilson 95% on the record)');
    const hi = pick(m, 'historical band, upper (Wilson 95% on the record)');
    // The band is the Wilson interval on 9 of 11, not a number picked here.
    // Wilson rather than the normal approximation because at n=11 the normal
    // upper bound exceeds 1 and would read as "no ceiling".
    return {
      pass: v >= lo && v <= hi,
      note: `${(100 * v).toFixed(0)}% of midterms cost the president's party ground, against `
        + `${(100 * h.rate).toFixed(1)}% in the returns (${h.lost} of ${h.n}, 1978-2018, the exceptions `
        + `being ${h.exceptions.join(' and ')}). Band is the Wilson 95% interval on that: `
        + `${(100 * lo).toFixed(0)}-${(100 * hi).toFixed(0)}%. Derived from house_district_panel.json, not chosen.`,
    };
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
  oracle: 'authored-here',
  needs: ['backfireShutdownShock'],
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
  oracle: 'authored-here',
  needs: ['shutdownBlame'],
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
  oracle: 'design-doc',
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
  oracle: 'historical-record',
  run({ cards, cfg, agents, seeds }): Measure[] {
    // Drives its own year loop, as B3 does: `GameResult.finalLean` is one
    // snapshot and this needs the series. `Game.leanMap` and `Game.seats` are
    // public for exactly this.
    const lags: number[] = [];
    let crossings = 0;
    for (const seed of seeds.slice(0, Math.min(30, seeds.length))) {
      const rng = new RNG(seed);
      const g = new Game(agents.map((n) => new AGENTS[n](cfg, rng)), cards, cfg, seed);
      const crossedAt = new Map<string, { year: number; dir: number }>();
      const end = cfg.game.startYear + cfg.game.maxYears;
      while (g.year < end) {
        const year = g.year;
        g.tick();
        for (const [st, v] of Object.entries(g.leanMap)) {
          const dir = Math.sign(v);
          // A lean CROSSING is the earliest moment the map says a state has
          // moved. Recorded once per direction, so a state oscillating around
          // the threshold does not manufacture a short lag.
          if (Math.abs(v) >= 2 && crossedAt.get(st)?.dir !== dir) crossedAt.set(st, { year, dir });
        }
        for (const [st, c] of crossedAt) {
          const held = g.seats.filter((x) => x.office === 'representative' && x.state === st && x.holder);
          if (held.length < 2) continue;
          const want = c.dir > 0 ? 'R' : 'D';
          const shareOf = held.filter((x) => x.holder!.party === want).length / held.length;
          if (shareOf > 0.5) { lags.push(year - c.year); crossings++; crossedAt.delete(st); }
        }
        if (g.endedBy) break;
      }
    }
    const h = realignmentLagYears();
    const ds = deepSouthRShare();
    return [
      { name: 'median years from lean crossing to delegation flip', value: quantile(lags, 0.5), unit: 'years', n: lags.length,
        historical: h.lagYears,
        historicalNote: 'the Deep South turned at the top of the ticket in 1964 and its House delegation '
          + `went majority-R in ${h.seatsFlipped}, per house_district_panel.json — a ${h.lagYears}-year lag. `
          + 'The lean date is documented rather than derived: the panel starts in 1976 and the turn is '
          + 'outside it. NOT like-for-like on the clock: a game is 16 years, so a 32-year lag cannot occur '
          + 'in one, and the engine figure is bounded by the cap rather than by the rules.' },
      { name: 'lean crossings that reached a delegation flip', value: crossings, n: lags.length },
      { name: 'Deep South R House share, first panel year', value: ds[0]?.share ?? NaN, unit: '%' },
      { name: 'Deep South R House share, last panel year', value: ds[ds.length - 1]?.share ?? NaN, unit: '%' },
    ];
  },
  accept(m) {
    const lag = pick(m, 'median years from lean crossing to delegation flip');
    const h = realignmentLagYears();
    return {
      pass: Number.isFinite(lag) && lag >= 8,
      note: Number.isFinite(lag)
        ? `median lag ${lag} years against ${h.lagYears} in the record (1964 lean -> ${h.seatsFlipped} `
          + 'delegation). The bar is >=8 years, a quarter of the historical figure, because a 16-year cap '
          + 'cannot contain 32 and grading against the full figure would grade the clock. See D4.'
        : 'no state crossed its lean and then flipped its delegation in any game — the realignment the '
          + 'design is named for does not complete inside a game',
    };
  },
};

/** D6 — the amendment rate against the record.
 *
 *  THE PROPOSAL STAGE HAS AN ORACLE AND THE CONVENTION STAGE DOES NOT, and
 *  the two must not be graded together.
 *
 *  RATIFICATION GIVEN PROPOSAL is measurable. Congress has sent 33 amendments
 *  to the states since 1789 and 27 were ratified — 82% all-time. In the
 *  modelled era seven went out after 1947: the 22nd, 23rd, 24th, 25th and
 *  26th ratified; the ERA stalled at 35 of 38 and DC Voting Rights reached 16
 *  before its seven years ran out. That is 5 of 7, 71% postwar. This is the
 *  stage the engine models and the number it is calibrated against.
 *
 *  CALLING A CONVENTION HAS NO ORACLE. Article V's convention route has never
 *  been used — no convention has been called in 237 years, against roughly
 *  four hundred state applications. The historical rate is zero and the game
 *  calls one in nearly every game, because a game needs an ending. That is an
 *  authored number for a stated design reason, and it is reported here
 *  without a bar rather than graded against a zero that would be meaningless.
 *
 *  AMENDMENTS PER UNIT TIME IS CONTAMINATED BY THE ENDING RULE. Six
 *  amendments entered the Constitution between 1947 and 2026, one per ~13
 *  years, so ~1.2 per sixteen. The game cannot reach that: ratification STOPS
 *  the clock, so no game can record more than one. Reported as
 *  characterization, never as a target — grading it would be grading the
 *  ending rule under another name. */
const d6: TrackItem = {
  id: 'D6-amendment-rate',
  track: 'D',
  question: 'Does an amendment that reaches the states ratify as often as the real ones did?',
  oracle: 'historical-record',
  needs: ['ending'],
  calibrated: 'amendment.dice, target and rescindTarget were swept to land this on the postwar figure, on '
    + 'tuned.json specifically. That makes the tuned number a fit rather than a prediction; the OTHER '
    + 'configs are the out-of-sample test, and they are reported below rather than tuned to match.',
  run({ runs }): Measure[] {
    const all = runs.flatMap((r) => r.amendments);
    const ratified = all.filter((a) => a.ratifiedIn !== undefined);
    const years = runs.reduce((n, r) => n + r.years, 0);
    // The ERA case: how far short does a failure get? 35 of 38 is the model.
    const failed = all.filter((a) => a.failedIn !== undefined);
    const shortfall = failed.map((a) => a.ratified.length);
    return [
      { name: 'ratification given proposal', value: share(ratified.length, all.length), unit: 'share of conventions', n: all.length },
      { name: 'conventions called a game', value: all.length / runs.length, n: runs.length },
      { name: 'amendments per 16 game-years', value: years ? 16 * ratified.length / years : 0, n: runs.length },
      { name: 'failed amendments: mean states reached', value: mean(shortfall), unit: 'of 38 needed', n: failed.length },
    ];
  },
  accept(m) {
    const r = pick(m, 'ratification given proposal');
    return {
      pass: r >= 0.6 && r <= 0.9,
      note: `${(100 * r).toFixed(0)}% of proposals ratify, against 71% postwar (5 of 7 sent to the states `
        + 'after 1947) and 82% all-time (27 of 33). Band is 60-90%, which spans both point estimates and '
        + 'leaves room for the small-n uncertainty in 5 of 7. The convention-call rate alongside it has NO '
        + 'bar: Article V conventions have never been called, so the historical value is zero and the game '
        + 'needs an ending.',
    };
  },
};

/** D7 (#97). Measurement only, no brake built here -- that is #84's call and
 *  this item is the evidence for it. THE TRAP #84 ALREADY FELL INTO TWICE:
 *  board scoring and the exogenous shock both failed to close the runaway,
 *  and neither is a thermostat, because neither pushes back harder after a
 *  bigger win. A negative lag-1 autocorrelation on the national House swing
 *  is what a thermostat looks like in the returns; zero or positive means
 *  the design compounds a big win instead of correcting it.
 *
 *  DECK-SENSITIVE BY CONSTRUCTION: a bigger card pool seats more contested
 *  races and directly reshapes the swing series. #91 is the item that will
 *  eventually flag that; it is open as of this item landing, so there is no
 *  flag to carry yet. */
const d7: TrackItem = {
  id: 'D7-wave-reversal',
  track: 'D',
  question: 'After a big national House swing, does the next cycle reverse it -- a thermostat -- or does the design compound it?',
  oracle: 'historical-record',
  run({ runs }): Measure[] {
    // SHARE, NOT RAW COUNT. The engine's House is nothing like 435 seats --
    // only districts IN PLAY get contested -- so a raw seat-count threshold
    // calibrated to the real chamber would never fire here (checked: it
    // doesn't, big-swing n was 0 across every seed). Seat share is what is
    // actually comparable across two chambers of very different size.
    const pairs = runs.flatMap((r) => {
      const byYear = new Map<number, RaceEvent[]>();
      for (const e of r.events) {
        if (e.office !== 'representative' || e.round !== 'general') continue;
        (byYear.get(e.year) ?? byYear.set(e.year, []).get(e.year)!).push(e);
      }
      const years = [...byYear.keys()].sort((a, b) => a - b);
      const cycles = years.map((y) => {
        const ev = byYear.get(y)!;
        return { share: share(ev.filter((e) => partyOf(e) === 'D').length, ev.length) * 100 };
      });
      // Pairs computed PER GAME, then concatenated -- a swing at the end of
      // one game paired with the start of another would not be a real lag.
      return swingPairs(cycles);
    });
    const s = reversalStats(pairs);
    const h = historicalWaveReversal();
    return [
      { name: 'lag-1 autocorrelation of the national House seat-share swing', value: s.autocorr, n: pairs.length,
        historical: h.autocorr,
        historicalNote: `derived from house_district_panel.json, 1976-2018 -- ${h.pairs} cycle-pairs across 22 `
          + 'cycles. NOT the register\'s 40-cycle postwar figure (-0.36 from HISTORICAL-CASES.md G1): that '
          + 'predates the panel and is a materially larger, earlier-starting sample. This is its own number, '
          + 'not reconciled to it by hand.' },
      { name: `reversal rate after a swing of >=${WAVE_THRESHOLD_PP.toFixed(2)}pp`, value: s.reversalRate, n: s.bigN,
        historical: h.reversalRate,
        historicalNote: `${h.reversed} of ${h.bigN} swings of >=${WAVE_THRESHOLD_PP.toFixed(2)}pp in the panel `
          + `(the register's headline 25-of-435-seat case) reversed the following cycle. Same 1976-2018-sample `
          + 'caveat as the row above.' },
      { name: 'big swings observed', value: s.bigN, n: pairs.length },
    ];
  },
  accept(m) {
    const ac = pick(m, 'lag-1 autocorrelation of the national House seat-share swing');
    const h = historicalWaveReversal();
    return {
      pass: ac < 0,
      note: `lag-1 autocorrelation ${ac.toFixed(3)} against ${h.autocorr.toFixed(3)} in the returns -- negative `
        + 'is a thermostat (big swings reverse), zero or positive compounds them. Whether a brake is needed '
        + 'and what shape it takes is hf7y/american-cycle#84\'s call; this only says which pattern the engine '
        + 'currently produces.',
    };
  },
};

export const D: TrackItem[] = [d1, d2, d3, d4, d5, d6, d7];
