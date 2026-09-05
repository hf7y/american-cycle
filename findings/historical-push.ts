import { readFileSync } from 'node:fs';
import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from '../sim/harness.ts';
import { deckSensitivity } from '../tracks/types.ts';
import type { Claim, Finding } from './types.ts';

/** The push rule (engine/rules/lean.ts) asserts a state "realigns when someone
 *  wins it big, repeatedly". That is a claim about the real world, so it is
 *  answered from returns, not from play.
 *
 *  The quantities here are derived from COMMITTED datasets and are therefore
 *  deterministic: their tolerance is ~0, which makes this finding a guard on
 *  `data/historical/` as much as on the engine. They cannot go stale by tuning,
 *  which is the point -- a target does not rot, only a measurement does. */
const panel = (f: string) =>
  JSON.parse(readFileSync(new URL(`../data/historical/${f}`, import.meta.url), 'utf8')).rows;

function slope(xs: number[], ys: number[]): number {
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return sxy / sxx;
}

/** Deviation from the national result -- lean's own Cook PVI framing -- then the
 *  SURPRISE, which is deviation minus that unit's own leave-one-out norm. A
 *  safe state posting its usual blowout has a large margin and zero surprise,
 *  and it is surprise, not margin, that the design needs to be keyed on. */
function reversion(rows: number[][], key: (r: number[]) => string, dem: number, rep: number,
                   windowOf: (y: number) => number, dropUnopposed: boolean) {
  const marg: Record<string, number> = {}, tot: Record<number, [number, number]> = {};
  let unopposed = 0;
  for (const r of rows) {
    const [y, d, p] = [r[0], r[dem], r[rep]];
    if (dropUnopposed && (d === 0 || p === 0)) { unopposed++; continue; }
    if (d + p === 0) continue;
    marg[`${y}|${key(r)}`] = (100 * (p - d)) / (d + p);
    const [a, b] = tot[y] ?? [0, 0]; tot[y] = [a + d, b + p];
  }
  const years = Object.keys(tot).map(Number).sort((a, b) => a - b);
  const dev: Record<string, number> = {};
  for (const k in marg) {
    const y = Number(k.split('|')[0]); const [d, p] = tot[y];
    dev[k] = marg[k] - (100 * (p - d)) / (d + p);
  }
  const units = [...new Set(Object.keys(marg).map((k) => k.split('|').slice(1).join('|')))];
  const windows = [...new Set(years.map(windowOf))];
  const lx: number[] = [], ly: number[] = [], sx: number[] = [], sy: number[] = [];
  for (const u of units) for (const w of windows) {
    // A unit's "own norm" is scoped to the window. Across a redistricting the
    // label survives and the district does not, so a baseline spanning both
    // averages two different seats and flattens the surprise toward zero.
    const ys = years.filter((y) => windowOf(y) === w && `${y}|${u}` in dev);
    if (ys.length < 3) continue;
    const vals = ys.map((y) => dev[`${y}|${u}`]); const sum = vals.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ys.length - 1; i++) {
      if (years.indexOf(ys[i + 1]) !== years.indexOf(ys[i]) + 1) continue;
      const d0 = dev[`${ys[i]}|${u}`], move = dev[`${ys[i + 1]}|${u}`] - d0;
      lx.push(d0); ly.push(move);
      sx.push(d0 - (sum - d0) / (vals.length - 1)); sy.push(move);
    }
  }
  return { level: slope(lx, ly), surprise: slope(sx, sy), n: sx.length, unopposed, rows: rows.length };
}

/** District identity does not survive redistricting, so a House district is
 *  only ever compared with itself inside one decade's map -- both for the pair
 *  and for the baseline it is measured against. */
const era = (y: number) => (y < 1982 ? 0 : y < 1992 ? 1 : y < 2002 ? 2 : y < 2012 ? 3 : 4);

export const finding: Finding = {
  id: 'historical-push',
  dependsOn: ['as-written-plus.json'],
  question:
    'The push rule claims: "A state realigns when someone wins it big, repeatedly — which is what '
    + 'realignments actually look like." Does that bear out in real returns (SIM-BRIEF Part 1)?',

  headline:
    'It does not. Keyed on SURPRISE — how far a unit beat its own norm, which is what the push rule '
    + 'already tracks for the lean LEVEL — an over-performance reverts rather than compounds, in both '
    + 'offices: presidential slope -0.511 (n=510), House -0.741 (n=5,563) against a pure-noise null '
    + 'of exactly -1. Neither ever overshoots, and a presidential surprise persists about TWICE as '
    + 'strongly as a House one — the distance from the null is 0.49 against 0.26. The push table hits '
    + 'hardest exactly where the data reverts hardest, and its single table charges both offices alike. '
    + 'The lean LEVEL meanwhile decays with a half-life of 5.88 presidential cycles — about 24 '
    + "years, which is SIM-BRIEF's \"realignment timescale: decades\" as a number. And 13.9% of real "
    + 'House district-years are unopposed, against 96.9% of simulated House generals fielding a '
    + 'single candidate -- measured on the matching population, which is most of the gap.',
  stampedAt: '2026-09-01T02:35:00Z',
  stampedOn: 'f0bbaca',

  predicate(): Claim[] {
    const pres = panel('pres_state_panel.json') as number[][];
    const p = reversion(pres, (r) => String(r[1]), 2, 3, () => 0, false);

    const house = panel('house_district_panel.json') as number[][];
    const h = reversion(house, (r) => `${r[1]}|${r[2]}`, 3, 4, era, true);

    // MATCH THE POPULATION. The real figure counts House GENERALS in which one
    // party fielded nobody. `uncontestedShare` counts uncontested events across
    // every office AND both rounds, and primaries are 99.7% contested, so it
    // dilutes the very thing being compared -- it read 76% where the matching
    // measure reads 97%. `contestedSlotShare` is a third quantity again (slots
    // drawing >1 declarer), which is what hf7y/american-cycle#40 cites at 9.7%.
    const cfg = loadConfig('as-written-plus.json');
    const cards = loadPacks(['1932', '1964', '1976', '1992', '2008', '2016', '2024']);
    let lone = 0, generals = 0; const N = 30;
    for (let i = 0; i < N; i++) {
      for (const e of playOne(['Greedy', 'Random', 'Lookahead'], cards, cfg, 900000 + i).events) {
        if (e.round !== 'general' || e.office !== 'representative') continue;
        generals++; if (e.uncontested) lone++;
      }
    }

    // hf7y/american-cycle#91: is the sim-side House walkover share itself a
    // property of which era-pack list ran it, same config/agents/seeds?
    const cardsBalance = loadPacks(BALANCE_PACKS);
    let loneBalance = 0, generalsBalance = 0;
    for (let i = 0; i < N; i++) {
      for (const e of playOne(['Greedy', 'Random', 'Lookahead'], cardsBalance, cfg, 900000 + i).events) {
        if (e.round !== 'general' || e.office !== 'representative') continue;
        generalsBalance++; if (e.uncontested) loneBalance++;
      }
    }

    return [
      // real-world facts: deterministic, so a drift here means the DATA moved
      { name: 'presidential surprise persistence', value: p.surprise, stamped: -0.5105, tolerance: 0.01 },
      { name: 'House surprise persistence', value: h.surprise, stamped: -0.7415, tolerance: 0.01 },
      { name: 'presidential lean half-life', value: Math.log(0.5) / Math.log(1 + p.level), stamped: 5.879, tolerance: 0.02, unit: 'cycles' },
      { name: 'real unopposed House share', value: (100 * h.unopposed) / h.rows, stamped: 13.907, tolerance: 0.01, unit: '%' },
      // The config this finding indicts, read back so a change to it is visible
      // here. The name has to carry `as-written-plus.json` in full: the guard in
      // well-formed.test.ts pairs a dependsOn entry with a zero-tolerance claim by
      // looking for the FILENAME in the claim name, so `as-written-plus top push`
      // read as no check at all.
      { name: 'as-written-plus.json still ships the top push', value: cfg.lean.pushByMargin[cfg.lean.pushByMargin.length - 1].push, stamped: 4, tolerance: 0, unit: 'pips' },
      // the engine, which is the only thing here that may legitimately move
      { name: 'sim House generals with one candidate', value: (100 * lone) / generals, stamped: 96.885, tolerance: 2, unit: '%' },
      { name: 'sim House generals with one candidate, BALANCE_PACKS', value: (100 * loneBalance) / generalsBalance, stamped: 95.79, tolerance: 2, unit: '%' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const exact = (n: string) => c.find((x) => x.name === n)!.value;
    const deck = deckSensitivity([
      { pool: 'all-seven', value: exact('sim House generals with one candidate') },
      { pool: 'four-pack', value: exact('sim House generals with one candidate, BALANCE_PACKS') },
    ]);
    // The null is EXACT, not simulated. If a unit's deviation is a fixed
    // baseline plus iid noise, surprise is e_t and next-cycle movement is
    // e_{t+1} - e_t, so the slope is Cov(e_{t+1}-e_t, e_t)/Var(e_t) = -1. The
    // leave-one-out baseline's correction terms cancel, and 200 simulated
    // panels of this shape give -1.0012 +/- 0.0026. An earlier -0.957 here was
    // one noisy draw frozen into the file -- exactly the cached number this
    // findings system exists to prevent.
    const NULL_SLOPE = -1;
    const lift = (s: number) => s - NULL_SLOPE;
    const pres = lift(v('presidential surprise')), house = lift(v('House surprise'));
    return [
      `a surprise REVERTS in both offices (presidential ${v('presidential surprise').toFixed(3)}, House ${v('House surprise').toFixed(3)}), never compounds`,
      `presidential surprises persist ${(pres / house).toFixed(1)}x as strongly as House ones (${pres.toFixed(2)} vs ${house.toFixed(2)} from the null), so one push table cannot serve both`,
      `lean half-life ${v('presidential lean').toFixed(2)} cycles`,
      `and ${v('sim House generals').toFixed(1)}% of simulated House generals have a single candidate against ${v('real unopposed').toFixed(1)}% unopposed in reality`,
      deck.sensitive
        ? `and the sim-side walkover share is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['all-seven'].toFixed(1)}% all-seven vs ${deck.byPool['four-pack'].toFixed(1)}% four-pack`
        : 'and the sim-side walkover share held stable between the all-seven and four-pack decks (hf7y/american-cycle#91)',
    ].join('; ');
  },
};
