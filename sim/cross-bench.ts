/** What should cross-benching cost, and in which round? — §9, §12, §16.
 *
 *  Party fluidity is the DEFAULT in this design: `PlayerState` has no party
 *  field, a player is a faction holding cards of both parties (§13), and the
 *  only mechanic that prices fluidity as such is §12's cross-bench counter.
 *  This script measures what that counter is worth, and whether anything in
 *  the engine makes a one-party portfolio pay.
 *
 *  Every number here comes from a full config sweep — each arm is a separate
 *  set of games played end to end, so effects propagate into seats, lean and
 *  the draft. Nothing is replayed or re-scored.
 *
 *  Reads `billCounters` off the Game the way `sim/feel.ts` reads `leanMap`.
 *  The snapshot is taken after each tick, which is exactly the state that
 *  tick's elections saw: §7 runs the omnibill (step 2-3) before the elections
 *  (step 6-9), and nothing else writes the counters. Counts are copied out as
 *  numbers rather than held as references, because the engine mutates the
 *  stored record in place and a reference would report end-of-game values.
 *
 *  node sim/cross-bench.ts [games]
 */
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { AGENTS } from './agents.ts';
import { Game, type Config } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { oddsAtEdge } from '../engine/rules/resolution.ts';
import type { Party, RaceEvent } from '../engine/types/index.ts';

const POOL = ['Greedy', 'Lookahead', 'SenateFlood', 'Launchpad'];
const PACKS = ALL_PACKS;

/** one side's §12 counters as they stood when the race ran */
interface Side { crossBench: number; toward?: Party; record: number }
export interface Obs { game: number; ev: RaceEvent; lean: number; sides: Side[] }

/** One player's end-of-game portfolio.
 *
 *  `excess` is the party Herfindahl MINUS its own expectation, and the
 *  subtraction is the whole point. Raw Herfindahl is biased upward in small
 *  portfolios — four seats are far likelier to be all one party than thirty
 *  are — so ranking players by it ranks them by seat count instead, and small
 *  portfolios score less for reasons that have nothing to do with party. For k
 *  seats drawn from a board whose own party mix has Herfindahl H, the
 *  expectation is H + (1-H)/k. Excess is 0 when a portfolio's party mix is
 *  exactly what indifference to party would produce. */
export interface Portfolio { game: number; player: number; score: number; seats: number; excess: number }

function herfindahl(parties: string[]): number {
  const t = new Map<string, number>();
  for (const p of parties) t.set(p, (t.get(p) ?? 0) + 1);
  let h = 0;
  for (const n of t.values()) h += (n / parties.length) ** 2;
  return h;
}

/** exact win probability at edge e, 1d6 vs 1d6, even tie-break.
 *
 *  In a primary every side is the same party in the same state, so `Wave`
 *  memoization hands them the SAME national and state die and only the
 *  candidate die differs. The primary is a one-die contest with a 2.42-pip
 *  noise floor, not the 4.18 of a general — which is why a pip bought in the
 *  primary is worth more than the same pip in November. */
export function oddsAtEdge1d6(e: number): number {
  let w = 0, t = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      if (a + e > b) w++; else if (a + e === b) t++;
    }
  }
  return (w + t / 2) / 36;
}

const leanSign = (p: Party | undefined) => (p === 'R' ? 1 : p === 'D' ? -1 : 0);

/** Play `games` under `cfg`, recording every race with the counters and state
 *  lean in force when it ran, plus each player's final portfolio. */
export function record(cfg: Config, games: number, seed0 = 3300000): { obs: Obs[]; portfolios: Portfolio[] } {
  if (cfg.lean.decayFrequency !== 'annual' || cfg.lean.decayPerTick !== 1) {
    throw new Error('lean reconstruction assumes annual decay of 1');
  }
  const cards = loadPacks(PACKS);
  const obs: Obs[] = [];
  const portfolios: Portfolio[] = [];
  for (let i = 0; i < games; i++) {
    const seed = seed0 + i;
    const order = POOL.map((_, k) => POOL[(k + i) % POOL.length]);
    const rng = new RNG(seed);
    const g = new Game(order.map((n) => new AGENTS[n](cfg, rng)), cards, cfg, seed);
    const end = cfg.game.startYear + cfg.game.maxYears;
    let seen = 0;
    while (g.year < end) {
      // Decay (step 5) lands before the elections and pushes land after them,
      // so the map players declared into is one decay step from the last tick.
      const before = { ...g.leanMap };
      g.tick();
      const atElection: Record<string, number> = {};
      for (const [st, v] of Object.entries(before)) atElection[st] = v > 0 ? v - 1 : v < 0 ? v + 1 : 0;
      const counters = (g as unknown as {
        billCounters: Map<string, { record: number; counters: Partial<Record<Party, number>> }>;
      }).billCounters;
      for (; seen < g.events.length; seen++) {
        const ev = g.events[seen];
        obs.push({
          game: i,
          ev,
          lean: atElection[ev.state] ?? 0,
          // A card's cross-bench counters are the ones NOT in its own colour,
          // and the dominant other colour is the direction of the defection —
          // the same reading `Game.readCounters` performs.
          sides: ev.sides.map((s) => {
            const rec = counters.get(s.cardId);
            let crossBench = 0, toward: Party | undefined, most = 0;
            for (const [colour, n] of Object.entries(rec?.counters ?? {}) as [Party, number][]) {
              if (colour === s.party) continue;
              crossBench += n;
              if (n > most) { most = n; toward = colour; }
            }
            return { crossBench, toward, record: rec?.record ?? 0 };
          }),
        });
      }
      if (cfg.game.deckOutEnds && !g.talon.length && !g.discard.length
        && !(g as unknown as { eraQueue: unknown[] }).eraQueue.length) break;
    }
    const held = g.seats.filter((s) => s.holder);
    if (held.length < 8) continue;
    const board = herfindahl(held.map((s) => s.holder!.party));
    for (const p of g.players) {
      const mine = held.filter((s) => s.holder!.player === p.id).map((s) => s.holder!.party);
      if (mine.length < 4) continue;
      portfolios.push({
        game: i, player: p.id, score: p.score, seats: mine.length,
        excess: herfindahl(mine) - (board + (1 - board) / mine.length),
      });
    }
  }
  return { obs, portfolios };
}

const contested = (o: Obs) => !o.ev.uncontested && o.ev.sides.length > 1;

/** Win rate of the marked side, over contested races where exactly one side
 *  carries a cross-bench counter. `pick` narrows the population further. */
export function markedWin(obs: Obs[], round: 'primary' | 'general', pick?: (o: Obs, i: number) => boolean) {
  let w = 0, n = 0, pips = 0;
  for (const o of obs) {
    if (o.ev.round !== round || !contested(o)) continue;
    const marked = o.sides.map((s, i) => (s.crossBench > 0 ? i : -1)).filter((i) => i >= 0);
    if (marked.length !== 1) continue;
    const i = marked[0];
    if (pick && !pick(o, i)) continue;
    n++;
    if (o.ev.sides[i].player === o.ev.winner) w++;
    pips += o.ev.sides[i].modifiers
      .filter((m) => m.source.startsWith('cross-benc'))
      .reduce((a, m) => a + Math.abs(m.pips), 0);
  }
  return { rate: n ? w / n : NaN, n, meanPips: n ? pips / n : NaN };
}

/** Share of ALL sides, and of contested sides, carrying a counter. */
export function incidence(obs: Obs[]) {
  let all = 0, allN = 0, con = 0, conN = 0;
  for (const o of obs) {
    for (const s of o.sides) { allN++; if (s.crossBench > 0) all++; }
    if (!contested(o)) continue;
    for (const s of o.sides) { conN++; if (s.crossBench > 0) con++; }
  }
  return { all: all / allN, contested: con / conN };
}

/** did the defection run WITH the state's drift, or against it? */
export const withDrift = (o: Obs, i: number) =>
  o.lean !== 0 && o.sides[i].toward !== undefined
  && Math.sign(o.lean) === leanSign(o.sides[i].toward);

function over(base: Config, primary: number): Config {
  return { ...base, primaryGeneral: { ...base.primaryGeneral, crossBenchPrimaryPenalty: primary } };
}

const pct = (x: number) => `${(100 * x).toFixed(2)}%`;

function main(): void {
  const games = Number(process.argv[2] ?? 60);
  const base = loadConfig('as-written-plus.json');
  const shipped = base.primaryGeneral.crossBenchPrimaryPenalty;

  console.log(`# cross-bench pricing — ${games} games/arm, ${base.name}, `
    + `shipped primary ${shipped}, cap ${base.primaryGeneral.crossBenchCap}\n`);
  console.log(`noise floor: primary 1d6 SD ${Math.sqrt(2 * 35 / 12).toFixed(2)} pips, `
    + `general 3d6 SD ${Math.sqrt(6 * 35 / 12).toFixed(2)} pips`);
  console.log(`a 1-pip edge is worth ${pct(oddsAtEdge1d6(1))} in a primary vs ${pct(oddsAtEdge(1))} in a general\n`);

  const shippedRun = record(base, games);

  // --- 0. is a one-party PORTFOLIO rewarded at all? ---
  const { portfolios } = shippedRun;
  const byGame = new Map<number, Portfolio[]>();
  for (const p of portfolios) byGame.set(p.game, [...(byGame.get(p.game) ?? []), p]);
  // A median split, not top-minus-bottom: with four players a top-vs-bottom
  // gap is an order statistic on a sample of four and swings by 25 points
  // between runs, which reads as signal and is not.
  let rawTop = 0, rawBot = 0, exTop = 0, exBot = 0, seatTop = 0, seatBot = 0, n = 0;
  for (const rows of byGame.values()) {
    if (rows.length < 2) continue;
    const half = Math.floor(rows.length / 2);
    const mean = (xs: Portfolio[]) => xs.reduce((a, p) => a + p.score, 0) / xs.length;
    const seat = (xs: Portfolio[]) => xs.reduce((a, p) => a + p.seats, 0) / xs.length;
    n++;
    const ex = [...rows].sort((a, b) => b.excess - a.excess);
    exTop += mean(ex.slice(0, half)); exBot += mean(ex.slice(-half));
    const raw = [...rows].sort((a, b) => (b.excess + 1 / b.seats) - (a.excess + 1 / a.seats));
    rawTop += mean(raw.slice(0, half)); rawBot += mean(raw.slice(-half));
    seatTop += seat(raw.slice(0, half)); seatBot += seat(raw.slice(-half));
  }
  console.log('## 0. is portfolio party-concentration rewarded?');
  console.log(`  mean excess concentration ${(portfolios.reduce((a, p) => a + p.excess, 0) / portfolios.length).toFixed(4)} `
    + `over ${portfolios.length} player-games (0 = party-random)`);
  console.log(`  by RAW Herfindahl: most-concentrated ${(rawTop / n).toFixed(1)} vs least ${(rawBot / n).toFixed(1)} `
    + `(gap ${((rawTop - rawBot) / n).toFixed(1)}) — with a ${((seatTop - seatBot) / n).toFixed(1)}-seat gap riding along`);
  console.log(`  by EXCESS:         most-concentrated ${(exTop / n).toFixed(1)} vs least ${(exBot / n).toFixed(1)} `
    + `(gap ${((exTop - exBot) / n).toFixed(1)})`);

  // --- 1. the primary is a one-die contest ---
  const prim = shippedRun.obs.filter((o) => o.ev.round === 'primary' && contested(o));
  const share = prim.filter((o) => o.ev.sides.every((s) =>
    s.dice.national === o.ev.sides[0].dice.national && s.dice.state === o.ev.sides[0].dice.state)).length / prim.length;
  console.log('\n## 1. why the primary is where a pip bites');
  console.log(`  contested primaries sharing the national AND state die: ${pct(share)}`);
  const inc = incidence(shippedRun.obs);
  console.log(`  counter incidence: ${pct(inc.all)} of all sides, ${pct(inc.contested)} of contested sides`);
  const counts = shippedRun.obs.flatMap((o) => o.sides.filter((s) => s.crossBench > 0).map((s) => s.crossBench))
    .sort((a, b) => a - b);
  const q = (p: number) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))];
  console.log(`  cross-bench counts where they exist: mean ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(2)}, `
    + `median ${q(0.5)}, p90 ${q(0.9)}, max ${counts[counts.length - 1]}`);

  // --- 2. is the scaled primary penalty too strong? ---
  console.log('\n## 2. is the scaled primary penalty too strong?');
  console.log('  population: contested primaries with exactly one marked side');
  const primSD = Math.sqrt(2 * 35 / 12);
  for (const p of [0, -1, -2]) {
    const r = markedWin(record(over(base, p), games).obs, 'primary');
    console.log(`  crossBenchPrimaryPenalty ${String(p).padStart(2)}: marked side wins ${pct(r.rate)} `
      + `(n=${r.n}, mean ${r.meanPips.toFixed(2)} pips = ${(r.meanPips / primSD).toFixed(2)} PRIMARY SD `
      + `— benchmarking it against the general's 4.18 understates it by 1.7x)`);
  }

  // --- 3. where WOULD a signed general term fire? ---
  console.log('\n## 3. where would a signed general term fire?');
  console.log('  population: contested generals with exactly one marked side');
  // `crossBenchGeneral` was built, swept here, and CUT. The sweep found the
  // term moves the with-minus-against gap monotonically (-36.4 / -11.6 / -2.9
  // / +10.2 at 0/1/2/3) but fires in the wrong places: a hardened state's
  // general is a walkover 96% of the time, so it keyed on state drift almost
  // exclusively in states that have not drifted. The section is kept to show
  // WHERE it would fire, which is the part that killed it.
  {
    const o = record(over(base, shipped), games).obs;
    const all = markedWin(o, 'general');
    const w = markedWin(o, 'general', (x, i) => withDrift(x, i));
    const a = markedWin(o, 'general', (x, i) => x.lean !== 0 && x.sides[i].toward !== undefined && !withDrift(x, i));
    console.log(`  unpriced: overall ${pct(all.rate)} (n=${all.n}) | `
      + `with the drift ${pct(w.rate)} (n=${w.n}) | against it ${pct(a.rate)} (n=${a.n})`);
  }

  // --- 4. does the contest rate already differentiate states by lean? ---
  console.log('\n## 4. does |state lean| already shift the primary/general balance?');
  console.log('  population: race-slots that actually ran, bucketed by |lean| at declaration');
  const slots = new Map<string, { lean: number; primary: boolean; general: boolean }>();
  for (const o of shippedRun.obs) {
    if (o.ev.state === 'US') continue;
    const k = `${o.game}|${o.ev.year}|${o.ev.office}|${o.ev.state}|${o.ev.slot ?? ''}`;
    const cur = slots.get(k) ?? { lean: Math.abs(o.lean), primary: false, general: false };
    if (o.ev.round === 'primary') cur.primary = true; else cur.general = contested(o);
    slots.set(k, cur);
  }
  console.log('  |lean|   slots   contested primary   contested general   ratio P:G');
  for (const [lo, hi] of [[0, 1], [2, 3], [4, 5], [6, 8]] as const) {
    const rows = [...slots.values()].filter((s) => s.lean >= lo && s.lean <= hi);
    const p = rows.filter((s) => s.primary).length, g = rows.filter((s) => s.general).length;
    console.log(`   ${`${lo}-${hi}`.padEnd(7)} ${String(rows.length).padStart(6)}   ${pct(p / rows.length).padStart(17)}   `
      + `${pct(g / rows.length).padStart(17)}   ${(g ? p / g : NaN).toFixed(2)}`);
  }
  // The same mechanism that excuses the PRIMARY penalty from needing a lean
  // condition undercuts the signed GENERAL term: a hardened state's general is
  // a walkover 96% of the time, so the term fires almost only where the drift
  // signal it keys on is weakest.
  let live = 0, livePurple = 0;
  for (const o of shippedRun.obs) {
    if (o.ev.round !== 'general' || !contested(o) || o.lean === 0) continue;
    const marked = o.sides.filter((s) => s.crossBench > 0 && s.toward !== undefined);
    if (marked.length !== 1) continue;
    live++;
    if (Math.abs(o.lean) <= 3) livePurple++;
  }
  console.log(`  of the ${live} contested generals where a signed term would fire, `
    + `${pct(livePurple / live)} are in states with |lean| <= 3`);
}

if (import.meta.filename === process.argv[1]) main();
