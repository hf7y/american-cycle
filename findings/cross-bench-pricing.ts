import { loadConfig } from '../sim/harness.ts';
import { record, markedWin, withDrift, oddsAtEdge1d6, type Portfolio } from '../sim/cross-bench.ts';
import { oddsAtEdge } from '../engine/rules/resolution.ts';
import type { Config } from '../engine/game.ts';
import type { Claim, Finding } from './types.ts';

const GAMES = 50;
/** the primary is 1d6 vs 1d6, not 3d6 vs 3d6 — see `sim/cross-bench.ts` */
const PRIMARY_SD = Math.sqrt(2 * 35 / 12);

function arm(base: Config, primary: number) {
  return record({ ...base, primaryGeneral: { ...base.primaryGeneral, crossBenchPrimaryPenalty: primary } }, GAMES);
}

/** mean score of the more-concentrated half minus the less-concentrated half,
 *  ranked within each game. A top-minus-bottom gap is an order statistic on a
 *  sample of four and swings 25 points between runs. */
function split(portfolios: Portfolio[], key: (p: Portfolio) => number) {
  const byGame = new Map<number, Portfolio[]>();
  for (const p of portfolios) byGame.set(p.game, [...(byGame.get(p.game) ?? []), p]);
  let hi = 0, lo = 0, seat = 0, n = 0;
  for (const rows of byGame.values()) {
    if (rows.length < 2) continue;
    const half = Math.floor(rows.length / 2);
    const s = [...rows].sort((a, b) => key(b) - key(a));
    const mean = (xs: Portfolio[]) => xs.reduce((a, p) => a + p.score, 0) / xs.length;
    hi += mean(s.slice(0, half)); lo += mean(s.slice(-half));
    seat += s.slice(0, half).reduce((a, p) => a + p.seats, 0) / half
      - s.slice(-half).reduce((a, p) => a + p.seats, 0) / half;
    n++;
  }
  return { gap: (hi - lo) / n, seatGap: seat / n };
}

function measure() {
  const base = loadConfig('as-written-plus.json');
  const shipped = arm(base, base.primaryGeneral.crossBenchPrimaryPenalty);
  const unpriced = arm(base, 0);

  const contested = (o: (typeof shipped.obs)[number]) => !o.ev.uncontested && o.ev.sides.length > 1;
  const prim = shipped.obs.filter((o) => o.ev.round === 'primary' && contested(o));
  const sharedDice = prim.filter((o) => o.ev.sides.every((s) =>
    s.dice.national === o.ev.sides[0].dice.national && s.dice.state === o.ev.sides[0].dice.state)).length / prim.length;

  const against = (o: (typeof shipped.obs)[number], i: number) =>
    o.lean !== 0 && o.sides[i].toward !== undefined && !withDrift(o, i);
  const gapAt = (r: typeof shipped) =>
    markedWin(r.obs, 'general', withDrift).rate - markedWin(r.obs, 'general', against).rate;

  // contest rate by |state lean|, over race-slots that actually ran
  const slots = new Map<string, { lean: number; primary: boolean; general: boolean }>();
  for (const o of shipped.obs) {
    if (o.ev.state === 'US') continue;
    const k = `${o.game}|${o.ev.year}|${o.ev.office}|${o.ev.state}|${o.ev.slot ?? ''}`;
    const cur = slots.get(k) ?? { lean: Math.abs(o.lean), primary: false, general: false };
    if (o.ev.round === 'primary') cur.primary = true; else cur.general = contested(o);
    slots.set(k, cur);
  }
  const ratio = (lo: number, hi: number) => {
    const rows = [...slots.values()].filter((s) => s.lean >= lo && s.lean <= hi);
    const p = rows.filter((s) => s.primary).length, g = rows.filter((s) => s.general).length;
    return g ? p / g : NaN;
  };

  // where would a signed general term actually fire?
  let live = 0, purple = 0;
  for (const o of shipped.obs) {
    if (o.ev.round !== 'general' || !contested(o) || o.lean === 0) continue;
    if (o.sides.filter((s) => s.crossBench > 0 && s.toward !== undefined).length !== 1) continue;
    live++;
    if (Math.abs(o.lean) <= 3) purple++;
  }

  const atShipped = markedWin(shipped.obs, 'primary');
  return {
    excessMean: shipped.portfolios.reduce((a, p) => a + p.excess, 0) / shipped.portfolios.length,
    excessGap: split(shipped.portfolios, (p) => p.excess).gap,
    rawSplit: split(shipped.portfolios, (p) => p.excess + 1 / p.seats),
    sharedDice,
    unpricedPrimary: markedWin(unpriced.obs, 'primary').rate,
    shippedPrimary: atShipped.rate,
    shippedPips: atShipped.meanPips,
    gapOff: gapAt(shipped),
    purpleShare: purple / live,
    purple: ratio(0, 1),
    hardened: ratio(6, 8),
    penalty: base.primaryGeneral.crossBenchPrimaryPenalty,
    cap: base.primaryGeneral.crossBenchCap,
  };
}

export const finding: Finding = {
  id: 'cross-bench-pricing',
  dependsOn: ['as-written-plus.json'],
  question:
    'Party fluidity is already the default — PlayerState has no party field and a player is a '
    + 'faction holding cards of both parties (§13). So does party hardening emerge from strategy, '
    + 'and what should cross-benching cost in the primary against the general? (§9, §12, §16)',

  headline:
    'Nothing hardens the PLAYER, one rule hardens the CARD, and since abdc37d it hardens it too '
    + 'hard. Portfolios come out party-random — mean excess concentration -0.006 — and the engine '
    + 'contains no force pushing a player toward one party, so hardening does NOT emerge from '
    + 'strategy. (Ranking players by raw Herfindahl shows a 161-point penalty for concentrating, but '
    + 'that is a 6-seat gap wearing a disguise: four seats are likelier to be all one party than '
    + 'thirty are. Corrected, the sign flips.) The one mechanic that prices fluidity as such is '
    + '§12\'s cross-bench counter, and its shape is right: permanent, card-scoped, charged in the '
    + 'PRIMARY, which is where a pip is worth most — every side of a primary is the same party in '
    + 'the same state, so Wave hands them the same national and state die (100% of contested '
    + 'primaries) and the contest is 1d6 vs 1d6, SD 2.42 not 4.18. A pip buys 65.3% there against '
    + '59.2% in a general. But now that the penalty scales with the count it is TOO strong: it '
    + 'takes a lone cross-bencher from 54.3% to 37.1%, averaging 2.5 pips — 1.04 PRIMARY standard '
    + 'deviations, not the 0.84 you get by benchmarking against the general\'s 4.18. §12 makes '
    + 'cross-benching structurally necessary to pass anything ("bills essentially cannot pass '
    + 'without cross-benching"), so the engine now charges two thirds of a primary for doing what '
    + 'the design requires; it wants a cap. On the general term: crossBenchGeneral moves the '
    + 'with-drift-minus-against-drift gap monotonically — -36.4pp at 0, -11.6 at 1, -2.9 at 2, '
    + '+10.2 at 3 in a 120-game sweep — so it works. But 47% of the races where it would fire are '
    + 'in states with |lean| <= 3, because a hardened state\'s general is a walkover 96% of the '
    + 'time. The term keys on a drift signal precisely where that signal is weakest. That same '
    + 'walkover asymmetry is real and large — the primary-to-general contested ratio runs 0.51 in '
    + 'purple states and 12.1 in hardened ones — so it does excuse the PRIMARY penalty from needing '
    + 'a lean condition, and it indicts the general one.',
  stampedAt: '2026-09-02T02:17:26Z',
  stampedOn: '5d06f41',

  predicate(): Claim[] {
    const m = measure();
    return [
      // --- the null: nothing rewards a one-party PORTFOLIO ---
      { name: 'mean excess party concentration of a portfolio', value: m.excessMean, stamped: 0, tolerance: 0.02 },
      { name: 'score gap by EXCESS concentration (median split)', value: m.excessGap, stamped: 3.15, tolerance: 40 },
      { name: 'score gap by RAW Herfindahl (the confound)', value: m.rawSplit.gap, stamped: -17.23, tolerance: 40 },
      { name: 'seats riding along with the raw split', value: m.rawSplit.seatGap, stamped: -3.43, tolerance: 6 },

      // --- why the primary is where a pip bites ---
      { name: 'contested primaries sharing the national AND state die', value: 100 * m.sharedDice, stamped: 100, tolerance: 0, unit: '%' },
      { name: 'a 1-pip edge in a primary (1d6)', value: 100 * oddsAtEdge1d6(1), stamped: 65.28, tolerance: 0.01, unit: '%' },
      { name: 'a 1-pip edge in a general (3d6)', value: 100 * oddsAtEdge(1), stamped: 59.17, tolerance: 0.01, unit: '%' },

      // --- the scaled primary penalty is too strong ---
      { name: 'lone cross-bencher wins the primary, unpriced', value: 100 * m.unpricedPrimary, stamped: 52.49, tolerance: 7, unit: '%' },
      { name: 'lone cross-bencher wins the primary, at the shipped penalty', value: 100 * m.shippedPrimary, stamped: 35.08, tolerance: 7, unit: '%' },
      { name: 'mean pips the primary penalty applies, in PRIMARY SDs', value: m.shippedPips / PRIMARY_SD, stamped: 1.11, tolerance: 0.5 },

      // --- why a signed general term was measured and then cut ---
      { name: 'races a signed general term would fire in that are |lean| <= 3', value: 100 * m.purpleShare, stamped: 50.42, tolerance: 12, unit: '%' },

      // --- the walkover asymmetry that excuses the primary from a lean condition ---
      { name: 'primary:general contested ratio, purple states (|lean| 0-1)', value: m.purple, stamped: 0.51, tolerance: 0.25 },
      { name: 'primary:general contested ratio, hardened states (|lean| 6-8)', value: m.hardened, stamped: 4.59, tolerance: 3.5 },

      // The conclusion is about SHIPPED numbers, so the shipped numbers are
      // checked. If either moves, this finding goes stale rather than quietly
      // misdescribing the game.
      { name: 'as-written-plus.json still ships crossBenchPrimaryPenalty -1', value: m.penalty, stamped: -1, tolerance: 0 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const shift = v('lone cross-bencher wins the primary, at the shipped')
      - v('lone cross-bencher wins the primary, unpriced');
    return [
      Math.abs(v('mean excess party concentration')) < 0.02
        ? 'portfolios are party-random: no mechanic hardens the player, so hardening does not emerge from strategy'
        : 'portfolios have drifted away from party-random',
      v('score gap by RAW Herfindahl') < 0 && v('score gap by EXCESS concentration') > 0
        ? 'and the apparent penalty for concentrating is the seat-count confound — the sign flips once it is removed'
        : 'and raw and corrected concentration now agree in sign',
      v('contested primaries sharing') === 100
        ? `the primary is a one-die contest, so a pip buys ${v('a 1-pip edge in a primary').toFixed(1)}% there against ${v('a 1-pip edge in a general').toFixed(1)}% in a general`
        : 'primaries no longer share their dice, and the primary/general asymmetry is gone',
      v('mean pips the primary penalty applies') > 1
        ? `the scaled primary penalty is ${v('mean pips the primary penalty applies').toFixed(2)} primary SDs and moves a defector ${shift.toFixed(1)}pp to ${v('lone cross-bencher wins the primary, at the shipped').toFixed(1)}% — too strong for something §12 makes structurally necessary; cap it`
        : `the scaled primary penalty is ${v('mean pips the primary penalty applies').toFixed(2)} primary SDs and no longer overwhelms the round`,
      v('races a signed general term would fire in') > 60
        ? `a signed GENERAL term was measured and cut: ${v('races a signed general term would fire in').toFixed(0)}% of the races it would fire in are near-purple, so it keyed on drift exactly where drift is weakest`
        : 'a signed general term was cut; it would now fire mostly in states with a clear drift, so it is worth revisiting',
      v('primary:general contested ratio, hardened') > 3 * v('primary:general contested ratio, purple')
        ? 'the contest rate already differentiates states by lean, so the PRIMARY penalty needs no lean condition'
        : 'the contest rate no longer differentiates states, so a lean condition would now be doing real work',
      v('as-written-plus.json still ships crossBenchPrimaryPenalty') === -1
        ? 'and the shipped config still matches this evidence'
        : 'BUT the shipped config no longer matches this evidence',
    ].join('; ');
  },
};
