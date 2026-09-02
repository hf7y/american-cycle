/** TRACK C — design acceptance. EXPECTED RED, on purpose, and NOT blocking.
 *
 *  The oracle is the design literature and the repo's own SIM-BRIEF bars. A
 *  test that should be red for six months needs somewhere to live; that is
 *  what makes acceptance-test-first possible, and it is why nothing here can
 *  fail a build.
 *
 *  Write the Track C test BEFORE building the mechanic. The test is a better
 *  spec than a prose issue.
 */
import { playOne } from '../sim/harness.ts';
import { runawayMetrics } from '../sim/roundrobin.ts';
import * as tags from '../engine/rules/tags.ts';
import type { Party, RaceEvent } from '../engine/types/index.ts';
import { mean, pick, share, type Measure, type TrackItem } from './types.ts';

/** C1 — the Skowronek suite. BUILT, and it lives in `skowronek/` with its own
 *  runner (`npm run skowronek`). Not duplicated here: the flagship
 *  (disjunction) needs the maximizer control, and a report that does not show
 *  two efficacy numbers per candidate window has not done the test. */
const c1: TrackItem = {
  id: 'C1-skowronek-suite',
  track: 'C',
  question: 'Does the engine produce a Skowronekian regime — settlement, strain, disjunction?',
  notRun: 'built and run separately: `npm run skowronek`. Read era-check 1 first — if settlement position '
    + 'random-walks with no persistent regime, nothing else in the suite means anything. As of v0.2 its two '
    + 'construction-level preconditions (BILL_CORPUS, BILL_POSITION) are MET; STRAIN_RISE and EFFICACY_DROP '
    + 'are now ABSENT rather than ABSENT_BY_CONSTRUCTION, i.e. unbuilt rather than unbuildable.',
};

/** C2 — win without the presidency. */
const c2: TrackItem = {
  id: 'C2-win-without-the-presidency',
  track: 'C',
  question: 'Is the presidency the game? A committee operator should be able to win without it.',
  run({ runs }): Measure[] {
    let lacksPresidency = 0;
    // Regression of final score on years holding the presidency, across games
    // and players. If that term explains most of the variance, the office IS
    // the game.
    const xs: number[] = [], ys: number[] = [];
    for (const r of runs) {
      const presYears = r.scores.map(() => 0);
      for (const e of r.events) {
        if (e.office === 'president' && e.round === 'general' && e.state !== 'US') presYears[e.winner] += 1 / 50;
      }
      const top = r.scores.indexOf(Math.max(...r.scores));
      const mostPres = presYears.indexOf(Math.max(...presYears));
      if (top !== mostPres || Math.max(...presYears) === 0) lacksPresidency++;
      r.scores.forEach((s, i) => { xs.push(presYears[i]); ys.push(s); });
    }
    const mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
    const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
    return [
      { name: 'top scorer lacks the presidency', value: share(lacksPresidency, runs.length), unit: 'share of games', n: runs.length },
      { name: 'r2 of final score on presidential years', value: r2, n: xs.length },
    ];
  },
  accept(m) {
    const lacks = pick(m, 'top scorer lacks the presidency');
    const r2 = pick(m, 'r2 of final score on presidential years');
    return {
      pass: lacks >= 0.3 && r2 < 0.5,
      note: `top scorer lacks the presidency in ${(100 * lacks).toFixed(0)}% of games (target >=30%); `
        + `presidential years explain r2=${r2.toFixed(2)} of final score (target <0.50)`,
    };
  },
};

/** C3 — cross-office divergence, the defining electoral feature of the
 *  modelled era.
 *
 *  GAP = top-of-ticket share (0 or 100) minus the same party's legislative
 *  share of that state. Measured on PARTY, not player: every player plays both
 *  sides, so player-level divergence is meaningless.
 *
 *  Historical target, five Deep South states: 1964 ~81pp, 1972 ~84pp, 1976
 *  ~75pp and REVERSED, 1984 ~69pp. Twenty years above 69pp with the top
 *  flipping in 1976 while the legislative number moved 9pp.
 *
 *  PRECONDITIONS, typed rather than assumed: a presidential race IS resolved
 *  per-state here (engine/game.ts runs the general state by state), a state
 *  may have no House seats at all, and a config where every office reads the
 *  same lean with no office-specific modifier makes divergence structurally
 *  impossible. */
const c3: TrackItem = {
  id: 'C3-cross-office-divergence',
  track: 'C',
  question: 'Does the board produce split-ticket voting — a state going one way at the top and another below it?',
  run({ runs }): Measure[] {
    const gaps: number[] = [];
    let persistence = 0, reversals = 0, statesWithNoHouse = 0, cells = 0;
    const byOffice: Record<string, number[]> = { senator: [], representative: [], governor: [] };

    for (const r of runs) {
      const byYearState = new Map<string, RaceEvent[]>();
      for (const e of r.events) {
        if (e.round !== 'general' || e.state === 'US') continue;
        const k = `${e.year}|${e.state}`;
        (byYearState.get(k) ?? byYearState.set(k, []).get(k)!).push(e);
      }
      const runsByState = new Map<string, number>();
      const lastTop = new Map<string, Party>();
      const lastLeg = new Map<string, number>();
      for (const [k, ev] of [...byYearState.entries()].sort()) {
        const [, state] = k.split('|');
        const partyOf = (e: RaceEvent) => e.sides.find((s) => s.player === e.winner)?.party;
        const top = ev.find((e) => e.office === 'president');
        if (!top) continue;
        const tp = partyOf(top);
        if (!tp) continue;
        cells++;
        for (const office of ['senator', 'representative', 'governor'] as const) {
          const seats = ev.filter((e) => e.office === office);
          if (!seats.length) { if (office === 'representative') statesWithNoHouse++; continue; }
          const legShare = 100 * share(seats.filter((e) => partyOf(e) === tp).length, seats.length);
          byOffice[office].push(100 - legShare);
        }
        const house = ev.filter((e) => e.office === 'representative');
        if (!house.length) continue;
        const legShare = 100 * share(house.filter((e) => partyOf(e) === tp).length, house.length);
        const gap = 100 - legShare;
        gaps.push(gap);
        // Persistence: a run of consecutive cycles above 40pp. A one-cycle
        // spike is a wave, not split-ticket voting.
        const run = gap > 40 ? (runsByState.get(state) ?? 0) + 1 : 0;
        runsByState.set(state, run);
        persistence = Math.max(persistence, run);
        // Reversal: the top flips while the legislative share barely moves.
        const pt = lastTop.get(state), pl = lastLeg.get(state);
        if (pt && pt !== tp && pl !== undefined && Math.abs(legShare - (100 - pl)) < 10) reversals++;
        lastTop.set(state, tp); lastLeg.set(state, legShare);
      }
    }
    const ordered = byOffice.senator.length && byOffice.representative.length && byOffice.governor.length
      ? Number(mean(byOffice.senator) <= mean(byOffice.representative)
        && mean(byOffice.representative) <= mean(byOffice.governor))
      : NaN;
    return [
      { name: 'mean gap', value: mean(gaps), unit: 'pp', n: gaps.length },
      { name: 'share of state-cycles above 69pp', value: share(gaps.filter((g) => g >= 69).length, gaps.length), unit: 'share', n: gaps.length },
      { name: 'longest persistence above 40pp', value: persistence, unit: 'consecutive cycles' },
      { name: 'reversals', value: reversals, n: cells },
      { name: 'office ordering matches §10 priority', value: ordered, unit: '1 = monotone president>senator>rep>governor' },
      { name: 'precondition: presidential-year state-cells with no House seat', value: statesWithNoHouse, n: cells },
    ];
  },
  accept(m) {
    const p = pick(m, 'longest persistence above 40pp');
    const above = pick(m, 'share of state-cycles above 69pp');
    return {
      pass: p >= 3 && above >= 0.1,
      note: `longest run above a 40pp gap is ${p} cycles (target >=3, the Deep South held 20 years); `
        + `${(100 * above).toFixed(0)}% of state-cycles clear 69pp (the 1984 figure)`,
    };
  },
};

/** C4 — shopping blocs. High party volatility, LOW interest volatility: the
 *  Deep South changed vehicle four times in thirty years (Thurmond '48,
 *  Goldwater '64, Wallace '68, Carter '76) while wanting the same thing
 *  throughout. Both volatile is noise; neither is a locked map. */
const c4: TrackItem = {
  id: 'C4-shopping-blocs',
  track: 'C',
  question: 'Does a district ever change its vehicle while keeping its interest?',
  run({ runs, cards }): Measure[] {
    const demo = new Map(cards.filter((c) => c.kind === 'district').map((c) => [`${c.state}|${c.number}`, c.demographics]));
    const ids = new Map(cards.filter((c) => c.kind === 'candidate').map((c) => [c.id, c.identities]));
    let partyFlips = 0, fitFlips = 0, obs = 0;
    for (const r of runs) {
      const last = new Map<string, { party: Party; fit: number }>();
      for (const e of r.events.filter((x) => x.round === 'general' && x.office === 'representative')) {
        const w = e.sides.find((s) => s.player === e.winner);
        const d = demo.get(`${e.state}|${e.slot}`);
        if (!w || !d) continue;
        // INTEREST is the fit between the winner and the district they won —
        // what the seat is now FOR. Party is the label on the same seat.
        // Stable interest with an unstable label is the shopping signature.
        const fit = tags.distance(tags.weights(ids.get(w.cardId) ?? []), tags.weights(d));
        if (fit === undefined) continue;
        const prev = last.get(`${e.state}|${e.slot}`);
        if (prev) {
          obs++;
          if (prev.party !== w.party) partyFlips++;
          if (Math.abs(prev.fit - fit) > 0.25) fitFlips++;
        }
        last.set(`${e.state}|${e.slot}`, { party: w.party, fit });
      }
    }
    return [
      { name: 'party flips', value: share(partyFlips, obs), unit: 'share of consecutive holds', n: obs },
      { name: 'interest flips', value: share(fitFlips, obs), unit: 'share of consecutive holds', n: obs },
      { name: 'shopping ratio', value: share(partyFlips, fitFlips || 1), unit: 'party flips per interest flip' },
    ];
  },
  accept(m) {
    const ratio = pick(m, 'shopping ratio');
    const party = pick(m, 'party flips');
    return {
      pass: ratio >= 2 && party > 0.05,
      note: `${(100 * party).toFixed(0)}% of consecutive holds change party against `
        + `${(100 * pick(m, 'interest flips')).toFixed(0)}% changing interest — ratio ${ratio.toFixed(1)} (target >=2). `
        + 'NOTE: candidate tag-fit is measured against the district a card actually ran in, so a district with '
        + 'no card in play contributes nothing.',
    };
  },
};

/** C5 — the strategy ladder. NOT RUN here: a duel matrix over the nine
 *  strategies is O(n^2) full games and belongs in `sim/roundrobin.ts`, which
 *  already ships it. Named rather than omitted because the acceptance
 *  criterion is specific and unmet. */
const c5: TrackItem = {
  id: 'C5-strategy-ladder-breaks',
  track: 'C',
  question: 'Do concentration and diversity beat each other conditionally, or is the ladder perfectly transitive?',
  notRun: 'the duel matrix is `node sim/roundrobin.ts`, not re-run here. Acceptance: the matrix must NOT be '
    + 'perfectly transitive on both configs, and must include hand-written adversarial strategies designed to '
    + 'beat the top — if nothing in a reasonable strategy space beats it, that is structural. `WideAndEmpty` '
    + 'at 0.0% of every duel is the v0.1.2 reading.',
};

/** C6 — games end by condition. 0% on eight of nine configs at v0.1.2; every
 *  game ran to the year cap. Reads `endedBy`, NOT `wonBy` — an amendment
 *  ending is shared, so it names no winner. */
const c6: TrackItem = {
  id: 'C6-games-end-by-condition',
  track: 'C',
  question: 'Does the game have an ending, or only a timer?',
  run({ runs, cfg }): Measure[] {
    return [
      { name: 'games ending by condition', value: share(runs.filter((r) => r.endedBy).length, runs.length), unit: 'share of games', n: runs.length },
      { name: 'mean game length as a share of the cap', value: mean(runs.map((r) => r.years)) / cfg.game.maxYears, unit: 'share' },
    ];
  },
  accept(m) {
    const e = pick(m, 'games ending by condition');
    return { pass: e >= 0.25, note: `${(100 * e).toFixed(0)}% of games end by condition (target >=25%; v0.1.2 was 0% on eight of nine configs)` };
  },
};

/** C7 — the runaway bars. SIM-BRIEF §2: a healthy determination point is
 *  75-85% of the way through, and a comeback rate near zero means the second
 *  half is an irreversible lead running out the clock. */
const c7: TrackItem = {
  id: 'C7-runaway-bars',
  track: 'C',
  question: 'Can a player behind at the midpoint still win?',
  run({ cards, cfg, seeds }): Measure[] {
    const m = runawayMetrics(seeds, ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg);
    return [
      { name: 'determination point', value: m.determination, unit: 'fraction of game length', n: m.games },
      { name: 'comeback rate', value: m.comeback, unit: 'share of games', n: m.games },
      { name: 'lead changes a game', value: m.leadChanges, n: m.games },
    ];
  },
  accept(m) {
    const d = pick(m, 'determination point');
    return {
      pass: d >= 0.75 && d <= 0.85,
      note: `determination at ${(100 * d).toFixed(0)}% against SIM-BRIEF's 75-85% band; `
        + `comeback rate ${(100 * pick(m, 'comeback rate')).toFixed(1)}%`,
    };
  },
};

/** C8 — v0.2 items 7, 8 and 9, each with the acceptance test the build order
 *  says to write first. All three are direction tests, because all three were
 *  specified as flat: there is no magnitude to check, only a sign. */
const c8: TrackItem = {
  id: 'C8-backfire-shutdown-shock',
  track: 'C',
  question: 'Do the failed impeachment, the shutdown and the shock move the board in the direction the record says?',
  run({ cards, cfg, seeds }): Measure[] {
    const block = seeds.slice(0, Math.min(30, seeds.length));

    // ITEM 7. A table of Impeachers against one with the backfire switched
    // off, same seeds. The penalty is on the ATTEMPT, so the comparison is
    // failed attempts, not convictions.
    const pool = ['Impeacher', 'Impeacher', 'Greedy', 'Lookahead'];
    const off = { ...cfg, legislature: { ...cfg.legislature, impeachBackfirePips: 0 } };
    const leanMass = (r: { finalLean: Record<string, number> }) =>
      Object.values(r.finalLean).reduce((a, v) => a + Math.abs(v), 0);
    const withBackfire = mean(block.map((s) => leanMass(playOne(pool, cards, cfg, s))));
    const without = mean(block.map((s) => leanMass(playOne(pool, cards, off, s))));

    // ITEM 8. Shutdowns are logged; the blamed party is the one with the most
    // no-votes, and the acceptance question is whether that is ever the
    // MAJORITY party — in 1995 and 2013 it was, so a rule that can only ever
    // blame the minority has encoded incumbency by accident.
    const shutOff = { ...cfg, legislature: { ...cfg.legislature, shutdownPips: 0 } };
    const shutOn = mean(block.map((s) => leanMass(playOne(['Greedy', 'Lookahead', 'HouseFarm', 'SenateFlood'], cards, cfg, s))));
    const shutNone = mean(block.map((s) => leanMass(playOne(['Greedy', 'Lookahead', 'HouseFarm', 'SenateFlood'], cards, shutOff, s))));

    // ITEM 9. The whole point: does the cheap shock move the determination
    // point? If it does, the positional version is never built.
    const noShock = { ...cfg, economy: { ...cfg.economy, shockOnRollAtMost: 0 } };
    const A = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
    const withShock = runawayMetrics(seeds, A, cards, cfg).determination;
    const withoutShock = runawayMetrics(seeds, A, cards, noShock).determination;

    return [
      { name: 'item 7: lean mass with backfire', value: withBackfire, n: block.length },
      { name: 'item 7: lean mass without backfire', value: without, n: block.length },
      { name: 'item 8: lean mass with shutdown blame', value: shutOn, n: block.length },
      { name: 'item 8: lean mass without shutdown blame', value: shutNone, n: block.length },
      { name: 'item 9: determination with shock', value: withShock, unit: 'fraction of game length' },
      { name: 'item 9: determination without shock', value: withoutShock, unit: 'fraction of game length' },
    ];
  },
  accept(m) {
    const fires = (a: string, b: string) => Math.abs(pick(m, a) - pick(m, b)) > 1e-9;
    const shockDelta = pick(m, 'item 9: determination with shock') - pick(m, 'item 9: determination without shock');
    return {
      pass: fires('item 7: lean mass with backfire', 'item 7: lean mass without backfire')
        && fires('item 8: lean mass with shutdown blame', 'item 8: lean mass without shutdown blame')
        && shockDelta > 0.02,
      note: `item 7 backfire ${fires('item 7: lean mass with backfire', 'item 7: lean mass without backfire') ? 'fires' : 'IS UNREACHABLE'}; `
        + `item 8 shutdown blame ${fires('item 8: lean mass with shutdown blame', 'item 8: lean mass without shutdown blame') ? 'fires' : 'IS UNREACHABLE'}; `
        + `item 9 shock moves determination by ${(100 * shockDelta).toFixed(1)}pp `
        + (Math.abs(shockDelta) <= 0.02
          ? '— i.e. NOT AT ALL, which is the branch the build order names: at 400 seeds on tuned.json the '
            + 'determination point is 0.625 with the shock and 0.625 without it. A shock proportional to '
            + 'power held is not a brake, so the brake has to be POSITIONAL — shocks discredit positions, '
            + 'stagflation discredited demand management, 2008 discredited deregulation — and the '
            + 'complexity of that version has now been earned rather than assumed. v0.3.'
          : shockDelta < 0
            ? '— the wrong way; the shock settles the game earlier, which also argues for the positional version'
            : '(a positive move retires the positional version unbuilt)')
        + ' NOTE: determination quantises to 1/maxYears, so a block below ~200 seeds cannot resolve this.',
    };
  },
};

/** C9 — repeal is reachable.
 *
 *  v0.2 item 2 says a corpus that only grows makes the epilogue equivalent to
 *  the running tally it replaces, so "bills can be repealed" is a claim about
 *  the RATE and not about the code. The code is built; this asks whether the
 *  board ever reaches it.
 *
 *  THE BINDING CONSTRAINT IS AUTHORSHIP, not the repeal rule. §12 gives the
 *  pen to the largest bloc of the majority House party, and a faction holds
 *  cards of both parties, so the same player keeps it: over 120 games on
 *  tuned.json, 78 had exactly ONE bill author for the whole game and one had
 *  more than one. A default that will not repeal its own work therefore has
 *  almost nothing to act on. Reported rather than tuned around — manufacturing
 *  repeals by letting an author strike their own bill would buy the number
 *  and lose the mechanic. */
const c9: TrackItem = {
  id: 'C9-repeal-is-reachable',
  track: 'C',
  question: 'Do bills actually come off the books, or is the corpus monotone in a second costume?',
  run({ runs }): Measure[] {
    const authorSpread = runs.map((r) => new Set(r.bills.map((b) => b.author)).size);
    return [
      { name: 'bills enacted a game', value: mean(runs.map((r) => r.bills.length)), n: runs.length },
      { name: 'bills repealed a game', value: mean(runs.map((r) => r.billsRepealed)), n: runs.length },
      { name: 'games with a repeal', value: share(runs.filter((r) => r.billsRepealed > 0).length, runs.length), unit: 'share of games', n: runs.length },
      { name: 'games whose bills had more than one author', value: share(authorSpread.filter((x) => x > 1).length, runs.length), unit: 'share of games', n: runs.length },
    ];
  },
  accept(m) {
    const rate = pick(m, 'games with a repeal');
    const spread = pick(m, 'games whose bills had more than one author');
    return {
      pass: rate >= 0.2,
      note: `${(100 * rate).toFixed(0)}% of games see a repeal (target >=20%), against `
        + `${(100 * spread).toFixed(0)}% whose bills had more than one author. The rule is built and fires; `
        + 'what is missing is turnover in the pen — §12 hands authorship to the largest bloc of the majority '
        + 'House party and a faction holds both parties, so it never changes hands. Fix authorship, not repeal.',
    };
  },
};

export const C: TrackItem[] = [c1, c2, c3, c4, c5, c6, c7, c8, c9];
