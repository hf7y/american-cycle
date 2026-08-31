/** SCRATCH probe — cross-office incumbency transfer. Research only; ships no
 *  rule and touches no config. Three measurements, all read off the event
 *  stream, so none of them needs an engine change:
 *
 *   1. CENSUS — how often a card that already holds a seat is declared for a
 *      DIFFERENT office. The seat map is rebuilt from the generals in
 *      chronological order; the presidency is settled on real electors rather
 *      than states carried. BLIND SPOT: fillVacancy() appoints a senator with
 *      no RaceEvent, so appointed senators are invisible here. The instrumented
 *      count taken off `this.seats` is 52.8 different-office declarations per
 *      game, so the replay below is a floor, not a ceiling.
 *
 *   2. COUNTERFACTUAL — what a transfer pip is worth. For every race carrying a
 *      cross-office declarant, re-decide the race with that side's total moved
 *      by delta and THE SAME DICE. Holding the dice fixed removes seed noise
 *      entirely, so the marginal value of a pip is measured rather than
 *      inferred from the difference of two noisy win rates. It deliberately
 *      does not capture agents declaring differently; that needs a re-sim.
 *
 *   3. PROVENANCE — the board has no district lean (districts print synergy and
 *      demographics only) and exactly one lean number per state, so
 *      districtLean - stateLean is identically zero and cannot be measured.
 *      The nearest quantity that does exist is the margin of the general that
 *      seated the card: "did this member ever run a competitive race".
 */
import { loadConfig, loadPacks, playOne } from './harness.ts';
import { STATES, electors, DC_ELECTORS } from '../engine/states.ts';
import type { RaceEvent, Office } from '../engine/types/index.ts';

const seatKey = (o: string, s: string, slot?: number) => `${o}|${s}|${slot ?? ''}`;

export interface Decl {
  ev: RaceEvent;
  side: RaceEvent['sides'][number];
  /** offices this card held when it was declared */
  held: Office[];
  /** holds a seat, and none of them is of the office being contested */
  differentOffice: boolean;
  /** margin in pips of the general that last seated this card */
  priorMargin: number;
  priorUncontested: boolean;
}

/** Rebuild seat tenure from one game's events; return every declaration made
 *  by a card that already held a seat. */
export function census(events: RaceEvent[]): Decl[] {
  const holder = new Map<string, string>();            // seatKey -> cardId
  const held = new Map<string, Set<string>>();         // cardId  -> seatKeys
  const wonWith = new Map<string, { margin: number; uncontested: boolean }>();
  const out: Decl[] = [];

  const byYear = new Map<number, RaceEvent[]>();
  for (const e of events) {
    if (!byYear.has(e.year)) byYear.set(e.year, []);
    byYear.get(e.year)!.push(e);
  }

  for (const [year, evs] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    // The presidential general is 50 state races sharing one pair of nominees;
    // group by year so the office counts as one declaration, not fifty.
    const seen = new Set<string>();
    for (const e of evs) {
      for (const s of e.sides) {
        const keys = held.get(s.cardId);
        if (!keys || !keys.size) continue;
        if (e.office === 'president') {
          const k = `${e.round}|${s.cardId}`;
          if (seen.has(k)) continue;
          seen.add(k);
        }
        const offices = [...keys].map((k) => k.split('|')[0] as Office);
        const prior = wonWith.get(s.cardId);
        out.push({
          ev: e, side: s, held: offices,
          // A sitting senator running for another Senate seat is carpetbagging,
          // not a transfer between offices. Excluded on purpose.
          differentOffice: !offices.includes(e.office),
          priorMargin: prior?.margin ?? 0,
          priorUncontested: prior?.uncontested ?? false,
        });
      }
    }

    // Seat the year's winners after every declaration in the year is read --
    // declarations are simultaneous.
    const evTally = new Map<string, number>();
    const take = (k: string, cardId: string) => {
      const old = holder.get(k);
      if (old && old !== cardId) held.get(old)?.delete(k);
      holder.set(k, cardId);
      if (!held.has(cardId)) held.set(cardId, new Set());
      held.get(cardId)!.add(k);
    };
    for (const e of evs) {
      if (e.round !== 'general') continue;
      const won = e.sides.find((s) => s.player === e.winner);
      if (!won) continue;
      if (e.office === 'president') {
        const st = STATES.find((x) => x.code === e.state);
        if (!st) continue;
        evTally.set(won.cardId, (evTally.get(won.cardId) ?? 0)
          + electors(st, year) + (e.state === 'MD' ? DC_ELECTORS : 0));
        continue;
      }
      // engine seat(): winning anything vacates a senate seat held elsewhere,
      // and nothing else -- which is why a card can hold two House seats.
      const k = seatKey(e.office, e.state, e.slot);
      for (const other of held.get(won.cardId) ?? []) {
        if (other !== k && other.startsWith('senator|')) { holder.delete(other); held.get(won.cardId)!.delete(other); }
      }
      take(k, won.cardId);
      wonWith.set(won.cardId, { margin: e.margin, uncontested: e.uncontested });
    }
    if (evTally.size) {
      let best = '', bestEV = -1;
      for (const [c, v] of evTally) if (v > bestEV) { bestEV = v; best = c; }
      take(seatKey('president', 'US'), best);
    }
  }
  return out;
}

const hasIncumbency = (s: RaceEvent['sides'][number]) => s.modifiers.some((m) => m.source === 'incumbency');

/** Re-decide one race with `cardId` shifted by delta, same dice. Returns that
 *  side's win probability; tieBreak is "even", so a tie is 1/n. */
function winProb(e: RaceEvent, cardId: string, delta: number): number {
  const tot = (s: RaceEvent['sides'][number]) => s.total + (s.cardId === cardId ? delta : 0);
  const best = Math.max(...e.sides.map(tot));
  const mine = e.sides.find((s) => s.cardId === cardId)!;
  if (tot(mine) < best) return 0;
  return 1 / e.sides.filter((s) => tot(s) === best).length;
}

export interface Cell { n: number; base: number; at: Map<number, number> }

/** Expected wins at each TARGET transfer value. The delta actually applied is
 *  target minus whatever incumbency the shipped engine already granted, so the
 *  numbers are marginal to what is on the board today. */
export function counterfactual(decls: Decl[], targets: number[], incumbencyPips: number,
                               filter: (d: Decl) => boolean): Cell {
  const at = new Map<number, number>(targets.map((t) => [t, 0]));
  let n = 0, base = 0;
  for (const d of decls) {
    if (!d.differentOffice || !filter(d)) continue;
    n++;
    const already = hasIncumbency(d.side) ? incumbencyPips : 0;
    base += winProb(d.ev, d.side.cardId, 0);
    for (const t of targets) at.set(t, at.get(t)! + winProb(d.ev, d.side.cardId, t - already));
  }
  return { n, base, at };
}

/** The presidential general is fifty state races settled on electoral votes, so
 *  a pip there is applied fifty times over and its value must be read off the
 *  EV majority, not off states carried. Dice held fixed, as everywhere above.
 *  `office` selects which launchpad row is being priced: only nominees holding
 *  that office are shifted. */
export function presidentialEV(games: RaceEvent[][], targets: number[], office: Office | 'any'): void {
  const wins = new Map<number, number>(targets.map((t) => [t, 0]));
  let contests = 0, baseWins = 0, movable = 0;

  for (const events of games) {
    // seat map, rebuilt exactly as census() does, so we know what each nominee held
    const decls = census(events);
    const heldBy = new Map<string, Office[]>();
    for (const d of decls) if (d.ev.office === 'president') heldBy.set(`${d.ev.year}|${d.side.cardId}`, d.held);

    const byYear = new Map<number, RaceEvent[]>();
    for (const e of events) {
      if (e.office !== 'president' || e.round !== 'general') continue;
      if (!byYear.has(e.year)) byYear.set(e.year, []);
      byYear.get(e.year)!.push(e);
    }
    for (const [year, evs] of byYear) {
      const cards = [...new Set(evs.flatMap((e) => e.sides.map((s) => s.cardId)))];
      if (cards.length < 2) continue;               // a walkover decides nothing
      const target = cards.find((c) => {
        const h = heldBy.get(`${year}|${c}`) ?? [];
        return office === 'any' ? h.length > 0 : h.includes(office);
      });
      contests++;
      if (!target) continue;
      movable++;
      const tally = (delta: number) => {
        const ev = new Map<string, number>();
        for (const e of evs) {
          const st = STATES.find((x) => x.code === e.state);
          if (!st) continue;
          const tot = (s: RaceEvent['sides'][number]) => s.total + (s.cardId === target ? delta : 0);
          const best = Math.max(...e.sides.map(tot));
          const top = e.sides.filter((s) => tot(s) === best);
          const w = top[0];                          // ties: first side, as the engine does
          ev.set(w.cardId, (ev.get(w.cardId) ?? 0) + electors(st, year) + (e.state === 'MD' ? DC_ELECTORS : 0));
        }
        let bc = '', bv = -1;
        for (const [c, v] of ev) if (v > bv) { bv = v; bc = c; }
        return bc === target ? 1 : 0;
      };
      baseWins += tally(0);
      for (const t of targets) wins.set(t, wins.get(t)! + tally(t));
    }
  }
  const p = (x: number) => `${((100 * x) / (movable || 1)).toFixed(1)}%`.padStart(6);
  console.log(`  row=${String(office).padEnd(15)} contested presidential generals=${String(contests).padStart(4)}`
    + `  carrying that office=${String(movable).padStart(4)}  shipped ${p(baseWins)}  `
    + targets.map((t) => `@${t} ${p(wins.get(t)!)}`).join('  '));
}

const arg = (f: string, d: string) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };

if (import.meta.filename === process.argv[1]) {
  const seeds = Number(arg('--seeds', '200'));
  const cfgName = arg('--config', 'as-written-plus.json');
  const agents = arg('--agents', 'Greedy,Lookahead,SenateFlood,HouseFarm').split(',');
  const cfg = loadConfig(cfgName);
  const cards = loadPacks(['1932', '1964', '1976', '1992', '2008', '2016', '2024']);

  const all: Decl[] = [];
  const games: RaceEvent[][] = [];
  let races = 0;
  for (let i = 0; i < seeds; i++) {
    const r = playOne(agents, cards, cfg, 1000 + i);
    races += r.events.length;
    games.push(r.events);
    all.push(...census(r.events));
  }
  const cross = all.filter((d) => d.differentOffice);
  const gen = (d: Decl) => d.ev.round === 'general';
  const pri = (d: Decl) => d.ev.round === 'primary';
  const contested = (d: Decl) => !d.ev.uncontested;

  const pairs = new Map<string, number>();
  for (const d of cross) pairs.set(`${[...new Set(d.held)].sort().join('+')} -> ${d.ev.office}`,
    (pairs.get(`${[...new Set(d.held)].sort().join('+')} -> ${d.ev.office}`) ?? 0) + 1);

  console.log(JSON.stringify({
    config: cfgName, agents, games: seeds, races,
    declarationsByASeatedCard: all.length,
    differentOffice: cross.length,
    differentOfficePerGame: +(cross.length / seeds).toFixed(2),
    contestedDifferentOfficeGenerals: cross.filter((d) => gen(d) && contested(d)).length,
    differentOfficePrimaries: cross.filter(pri).length,
    incumbencyPipAlreadyFiring: cross.filter((d) => hasIncumbency(d.side)).length,
    byPair: Object.fromEntries([...pairs].sort((a, b) => b[1] - a[1])),
  }, null, 2));

  const targets = [0, 0.5, 1, 2];
  const show = (label: string, c: Cell) => {
    if (!c.n) { console.log(`${label}  n=0`); return; }
    const p = (x: number) => `${((100 * x) / c.n).toFixed(1)}%`.padStart(6);
    console.log(`${label}  n=${String(c.n).padStart(5)}  shipped ${p(c.base)}  `
      + targets.map((t) => `@${t} ${p(c.at.get(t)!)}`).join('  '));
  };
  console.log('\n-- what a transfer pip is worth, dice held fixed --');
  show('general, ALL (walkovers included)', counterfactual(cross, targets, cfg.resolution.incumbency, gen));
  show('general, CONTESTED only          ', counterfactual(cross, targets, cfg.resolution.incumbency, (d) => gen(d) && contested(d)));
  show('primary  (all are contested)     ', counterfactual(cross, targets, cfg.resolution.incumbency, pri));

  console.log('\n-- provenance: does a safe prior seat predict a worse cross-office run? --');
  console.log('   (districtLean - stateLean is identically 0 on this board; prior margin is the surrogate)');
  const band = (lo: number, hi: number) => (d: Decl) => d.priorMargin >= lo && d.priorMargin < hi;
  for (const [lo, hi, name] of [[0, 3, 'prior margin 0-2 (fought for it)'], [3, 7, 'prior margin 3-6'],
                                [7, 12, 'prior margin 7-11'], [12, 999, 'prior margin 12+ (safe seat)']] as [number, number, string][]) {
    show(name.padEnd(34), counterfactual(cross, targets, cfg.resolution.incumbency, (d) => gen(d) && contested(d) && band(lo, hi)(d)));
  }
  console.log('\n-- a launchpad pip on the PRESIDENTIAL general, priced on the EV majority --');
  for (const o of ['senator', 'governor', 'representative', 'president', 'any'] as (Office | 'any')[]) {
    presidentialEV(games, targets, o);
  }

  show('prior race was a WALKOVER         ', counterfactual(cross, targets, cfg.resolution.incumbency, (d) => gen(d) && contested(d) && d.priorUncontested));
  show('prior race was CONTESTED          ', counterfactual(cross, targets, cfg.resolution.incumbency, (d) => gen(d) && contested(d) && !d.priorUncontested));
}
