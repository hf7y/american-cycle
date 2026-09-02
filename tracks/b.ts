/** TRACK B — characterization. Never fails; the values move.
 *
 *  Emits a numbers file per tag. Run against v0.1.2, v0.2, and every tag
 *  after. Nothing here has an oracle: an item that judges belongs in C.
 */
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { AGENTS } from '../sim/agents.ts';
import { playOne } from '../sim/harness.ts';
import { mean, quantile, share, type Measure, type TrackCtx, type TrackItem } from './types.ts';

/** B1 — race resolution.
 *
 *  ALREADY LOGGED ON EVERY `RaceEvent`. `margin`, `uncontested`,
 *  `zeroDiceWinner` and `upset` are recorded by the engine; do not
 *  re-instrument, and do not re-run the die-dominance question as a two-run
 *  seed comparison — `upset` answers it directly. */
const b1: TrackItem = {
  id: 'B1-race-resolution',
  track: 'B',
  question: 'How do races resolve — how often do the dice reverse the favourite, and how often is there no race at all?',
  run({ runs }): Measure[] {
    const ev = runs.flatMap((r) => r.events);
    // THE TRAP: an uncontested race records margin 0, which is IDENTICAL to a
    // dead heat. Plot the raw distribution and the spike at zero is walkovers,
    // not close races. Split on `uncontested` FIRST, always.
    const walkovers = ev.filter((e) => e.uncontested);
    const contested = ev.filter((e) => !e.uncontested);
    return [
      { name: 'races', value: ev.length, n: runs.length },
      { name: 'walkover share', value: share(walkovers.length, ev.length), unit: 'share of races', n: ev.length },
      { name: 'upset rate', value: share(ev.filter((e) => e.upset).length, ev.length), unit: 'share of races', n: ev.length },
      { name: 'contested: mean margin', value: mean(contested.map((e) => e.margin)), unit: 'pips', n: contested.length },
      { name: 'contested: median margin', value: quantile(contested.map((e) => e.margin), 0.5), unit: 'pips', n: contested.length },
      { name: 'contested-slot share', value: mean(runs.map((r) => r.contestedSlotShare)), unit: 'share of slots', n: runs.length },
    ];
  },
};

/** B2 — losing-margin distribution, contested races only. Shape, not summary
 *  stats. Was the gate on overperformance-converts, which is dropped;
 *  retained because it reads whether races are close enough for anything to
 *  be at stake. */
const b2: TrackItem = {
  id: 'B2-losing-margin',
  track: 'B',
  question: 'Are contested races close enough for anything to be at stake?',
  run({ runs }): Measure[] {
    const m = runs.flatMap((r) => r.events).filter((e) => !e.uncontested).map((e) => e.margin);
    return [
      { name: 'p10', value: quantile(m, 0.1), unit: 'pips', n: m.length },
      { name: 'p25', value: quantile(m, 0.25), unit: 'pips', n: m.length },
      { name: 'p50', value: quantile(m, 0.5), unit: 'pips', n: m.length },
      { name: 'p75', value: quantile(m, 0.75), unit: 'pips', n: m.length },
      { name: 'p90', value: quantile(m, 0.9), unit: 'pips', n: m.length },
      { name: 'within 2 pips', value: share(m.filter((x) => x <= 2).length, m.length), unit: 'share of contested' },
    ];
  },
};

/** B3 — district tag drift.
 *
 *  Near-zero drift means a concentrated bloc is free and the
 *  concentration-vs-diversity axis has no tradeoff in it. That decides
 *  whether coalition synergy is balanceable at all, so it is measured even
 *  though the answer is currently structural: `DistrictCard.demographics` is
 *  printed on the card and no rule writes to it. Districts CHANGE HANDS; the
 *  map does not change shape. Recorded, not judged. */
const b3: TrackItem = {
  id: 'B3-district-tag-drift',
  track: 'B',
  question: 'How far do district demographics move across a full game?',
  run({ cards, cfg, agents, seeds }): Measure[] {
    // Read off a LIVE board: `GameResult` keeps no districts, and the question
    // is about the cards in play, not about the deck.
    const asPrinted = new Map(cards.filter((c) => c.kind === 'district')
      .map((c) => [c.id, [...c.demographics].sort().join(',')]));
    let moved = 0, inPlay = 0;
    for (const seed of seeds.slice(0, Math.min(20, seeds.length))) {
      const rng = new RNG(seed);
      const g = new Game(agents.map((n) => new AGENTS[n](cfg, rng)), cards, cfg, seed);
      g.run();
      for (const p of g.players) {
        for (const d of p.districts) {
          inPlay++;
          if (asPrinted.get(d.id) !== [...d.demographics].sort().join(',')) moved++;
        }
      }
    }
    return [
      { name: 'district cards printed', value: asPrinted.size },
      { name: 'district-cards in play at the epilogue', value: inPlay },
      { name: 'drift rate', value: share(moved, inPlay), unit: 'share of district-games', n: inPlay },
    ];
  },
};

/** B4 — cross-bench votes, unstacked. `BillOutcome.crossBenched` exists and
 *  never got a number in the battery. Characterize before assuming fracture
 *  exists. */
const b4: TrackItem = {
  id: 'B4-cross-bench',
  track: 'B',
  question: 'Does cross-benching actually happen at an ordinary table?',
  run({ runs }): Measure[] {
    return [
      { name: 'cross-bench votes a game', value: mean(runs.map((r) => r.crossBenchVotes)), n: runs.length },
      { name: 'bills attempted a game', value: mean(runs.map((r) => r.billsAttempted)), n: runs.length },
      { name: 'bill passage rate', value: share(
        runs.reduce((a, r) => a + r.billsPassed, 0), runs.reduce((a, r) => a + r.billsAttempted, 0)),
        unit: 'share of attempts' },
    ];
  },
};

/** B5 — impeachment baseline, UNSTACKED. The prior 4.5%/2.5% was measured
 *  with four Impeachers at the table. That is a ceiling, not a rate. */
const b5: TrackItem = {
  id: 'B5-impeachment-unstacked',
  track: 'B',
  question: 'How often does impeachment happen at an ordinary table, rather than a table of Impeachers?',
  run({ runs, cards, cfg, seeds }): Measure[] {
    const stacked = seeds.slice(0, Math.min(40, seeds.length))
      .map((s) => playOne(['Impeacher', 'Impeacher', 'Impeacher', 'Impeacher'], cards, cfg, s));
    return [
      { name: 'ordinary pool: impeachments a game', value: mean(runs.map((r) => r.impeachments)), n: runs.length },
      { name: 'four Impeachers: impeachments a game', value: mean(stacked.map((r) => r.impeachments)), n: stacked.length },
    ];
  },
};

/** B6 — tenure. Reported alongside several Track C checks; cheap to emit once
 *  here so C3 can read it rather than re-deriving it. */
const b6: TrackItem = {
  id: 'B6-tenure',
  track: 'B',
  question: 'How long do members serve, by office?',
  run({ runs, cards, cfg, seeds }): Measure[] {
    // `Seat.holder.since` is only readable off a live board, so this replays a
    // short block rather than reading GameResult, which keeps no seats.
    const out: Measure[] = [];
    const byOffice: Record<string, number[]> = { president: [], senator: [], governor: [], representative: [] };
    void runs;
    for (const s of seeds.slice(0, Math.min(30, seeds.length))) {
      const r = playOne(['Greedy', 'Lookahead', 'HouseFarm', 'SenateFlood'], cards, cfg, s);
      // Terms served is the count of ELECTIONS a card won, per office -- which
      // is not the count of race events. The presidential general runs state
      // by state (engine/game.ts), so one term is fifty winning events and
      // counting events reported the president at 74 terms a game. Distinct
      // (card, office, year) is the term.
      const seen = new Set<string>();
      const won = new Map<string, { office: string; n: number }>();
      for (const e of r.events) {
        if (e.round !== 'general') continue;
        const w = e.sides.find((x) => x.player === e.winner);
        if (!w) continue;
        const once = `${w.cardId}|${e.office}|${e.year}`;
        if (seen.has(once)) continue;
        seen.add(once);
        const k = `${w.cardId}|${e.office}`;
        const rec = won.get(k) ?? { office: e.office, n: 0 };
        rec.n++; won.set(k, rec);
      }
      for (const rec of won.values()) byOffice[rec.office]?.push(rec.n);
    }
    for (const [office, xs] of Object.entries(byOffice)) {
      out.push({ name: `${office}: mean terms won`, value: mean(xs), n: xs.length });
    }
    return out;
  },
};

/** B7 — v0.2's own numbers. Board scoring, the books, and the ending. Nothing
 *  here existed to measure before v0.2, so it has no v0.1.2 column and the
 *  diff will show it as new rather than as movement. */
const b7: TrackItem = {
  id: 'B7-board-scoring-and-endings',
  track: 'B',
  question: 'What does board scoring, repeal and the amendment ending actually do to the shape of a game?',
  // The monotone-score number is the one that matters most and it needs
  // nothing: `scoreHistory` is as old as the harness, so v0.1.2's 1.00 and
  // v0.2's 0.02 are the same measurement on both builds. The rest of B7 reads
  // the corpus and the ending, which only one of them has.
  needs: ['corpus', 'ending'],
  run({ runs }): Measure[] {
    let series = 0, never = 0;
    for (const r of runs) {
      for (let p = 0; p < (r.scoreHistory[0]?.length ?? 0); p++) {
        series++;
        let fell = false;
        for (let y = 1; y < r.scoreHistory.length; y++) if (r.scoreHistory[y][p] < r.scoreHistory[y - 1][p]) { fell = true; break; }
        if (!fell) never++;
      }
    }
    return [
      { name: 'player-scores that never decrease', value: share(never, series), unit: 'share of series', n: series },
      { name: 'games ending by condition', value: share(runs.filter((r) => r.endedBy).length, runs.length), unit: 'share of games', n: runs.length },
      { name: 'games ending by amendment', value: share(runs.filter((r) => r.endedBy === 'amendment').length, runs.length), unit: 'share of games', n: runs.length },
      { name: 'mean game length', value: mean(runs.map((r) => r.years)), unit: 'years', n: runs.length },
      { name: 'bills on the books at the epilogue', value: mean(runs.map((r) => r.billsOnBooks)), n: runs.length },
      { name: 'bills repealed a game', value: mean(runs.map((r) => r.billsRepealed)), n: runs.length },
      { name: 'conventions called a game', value: mean(runs.map((r) => r.amendments.length)), n: runs.length },
    ];
  },
};

/** B7b — the one number from B7 that every build can answer.
 *
 *  Split out deliberately. B7 needs the corpus and the ending, so it goes
 *  NOT MEASURABLE on v0.1.2 — and the monotone-score share would have gone
 *  with it, which is the single most load-bearing figure in the whole
 *  before-and-after. `scoreHistory` is as old as the harness. */
const b7b: TrackItem = {
  id: 'B7b-score-monotonicity',
  track: 'B',
  question: 'Can a score ever fall?',
  run({ runs }): Measure[] {
    let series = 0, never = 0;
    for (const r of runs) {
      for (let p = 0; p < (r.scoreHistory[0]?.length ?? 0); p++) {
        series++;
        let fell = false;
        for (let y = 1; y < r.scoreHistory.length; y++) if (r.scoreHistory[y][p] < r.scoreHistory[y - 1][p]) { fell = true; break; }
        if (!fell) never++;
      }
    }
    return [
      { name: 'player-scores that never decrease', value: share(never, series), unit: 'share of series', n: series },
      { name: 'mean game length', value: mean(runs.map((r) => r.years)), unit: 'years', n: runs.length },
      { name: 'mean lead changes', value: mean(runs.map((r) => r.leadChanges)), n: runs.length },
    ];
  },
};

/** B8 — the variance sweep. NOT BUILT, and named rather than omitted.
 *  `zeroDiceWinner` gives the 0x point for free; the sweep needs a dice-spread
 *  knob the engine does not expose, so building it is an engine change and not
 *  a test. */
const b8: TrackItem = {
  id: 'B8-variance-sweep',
  track: 'B',
  question: 'At what dice spread do races stop resolving on the tally, and does race-flip diverge from winner-flip?',
  notRun: 'the 3d6 spread is not a config knob; `zeroDiceWinner` gives the 0x point and nothing gives 0.25x, '
    + '0.5x or 2x. Report both share of races resolving differently AND share of games with a different '
    + 'winner when it is built: high race-flip with low winner-flip is the healthy shape.',
};

export const B: TrackItem[] = [b1, b2, b3, b4, b5, b6, b7, b7b, b8];
