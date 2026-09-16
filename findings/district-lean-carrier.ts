import { readFileSync } from 'node:fs';
import { loadConfig, loadPacks, playOne } from '../sim/harness.ts';
import { fit, era, mean, type Row, type Obs } from '../sim/district-partisanship.ts';
import type { Card, DistrictCard, IdentityTag } from '../engine/types/index.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#90 names three ways a district card's partisanship could
 *  be sourced: a printed lean (A, the ceiling -- the district's own real
 *  fixed effect, leave-one-out), an era-keyed demographics table fitted from
 *  the real MEDSL panel (B), or emergent from play via district-card capture
 *  (C). hf7y/american-cycle#130 separately asks whether the mechanism actually
 *  WIRED into `elections.ts` today -- the flat identity bonus matching a
 *  candidate's tags against a district's (D) -- predicts real partisanship at
 *  all. `sim/scratch-district-carrier.ts` priced all four against the real
 *  district-era fixed effect (`sim/district-partisanship.ts`, the same fit
 *  `findings/district-fit.ts` already reads) and never shipped as a
 *  re-derivable finding -- this formalizes that research so it stays checked
 *  rather than going stale in an ungraded scratch file.
 *
 *  Two results carry weight. First: B -- no new field, fitted directly from
 *  the same real panel `district-fit.ts` already joins to -- tracks the real
 *  district far better than D, the mechanism actually shipped; C (emergent
 *  from play) tracks it barely at all. Second, and this is the one that
 *  bears on whether building B is worth doing: a party-keyed carrier (A or B)
 *  only ever differs the two sides of a race that are BOTH contested AND
 *  cross-party -- a primary is same-party on both sides, so it cancels there
 *  regardless of the carrier. hf7y/american-cycle#77/#90 already measured
 *  House generals running 96%+ walkover on the shipped seven-era pool; this
 *  predicate reports how much of that walkover share survives into the
 *  narrower "could a district-lean carrier ever have mattered here" slice. */

const ALL_PACKS = ['1932', '1964', '1976', '1992', '2008', '2016', '2024'];
/** Which panel redistricting-era letter each card pack's district numbers
 *  fall inside -- the same map `sim/scratch-district-carrier.ts` used. Packs
 *  not listed here (1932/1964/2024) sit outside the panel entirely. */
const PACK_ERA: Record<string, string> = { '1976': 'A', '1992': 'C', '2008': 'D', '2016': 'E' };
const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HouseFarm'];
const TAGS: IdentityTag[] = ['catholic', 'evangelical', 'jewish', 'black', 'hispanic', 'cuban', 'union', 'rural', 'suburban', 'urban', 'farm'];
const GAMES = sample(200);

function panelRows(): Row[] {
  const raw = JSON.parse(readFileSync(new URL('../data/historical/house_district_panel.json', import.meta.url), 'utf8')).rows as
    [number, string, number, number, number, number][];
  return raw.map(([year, state, district, dem, rep, inc]) => ({ year, state, district, dem, rep, inc }));
}

/** The district-era fixed effect, adjusted for incumbency and national year
 *  swing -- the same P1 population `sim/district-partisanship.ts`'s own
 *  report and `findings/district-fit.ts` both use (contested only, >=3
 *  elections per district-era). */
function fitPanel() {
  const rows = panelRows();
  const unit = (r: Row) => `${r.state}-${r.district}|${era(r.year)}`;
  const contested = rows.filter((r) => r.dem > 0 && r.rep > 0);
  const counts = new Map<string, number>();
  for (const r of contested) counts.set(unit(r), (counts.get(unit(r)) ?? 0) + 1);
  const kept = contested.filter((r) => counts.get(unit(r))! >= 3);
  const obs: Obs[] = kept.map((r) => ({ y: 100 * r.dem / (r.dem + r.rep), inc: r.inc, unit: unit(r), year: r.year, row: r }));
  return fit(obs);
}

const vr = (a: number[]) => { const m = mean(a); return mean(a.map((z) => (z - m) * (z - m))); };
const cv = (a: number[], b: number[]) => { const ma = mean(a), mb = mean(b); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); return s / a.length; };
const corr = (a: number[], b: number[]) => cv(a, b) / Math.sqrt(vr(a) * vr(b));

interface Measured {
  matched: number;
  corrB: number; corrD: number; corrC: number;
  winB: number; winD: number; winC: number;
  houseGenerals: number; crossPartyContestedGenerals: number;
  contestedShare: number;
}

function measure(): Measured {
  const f = fitPanel();
  const feOf = (u: string) => f.a.get(u)!;
  const cardsByEra = new Map<string, Card[]>();
  for (const e of ALL_PACKS) cardsByEra.set(e, loadPacks([e]));

  // ---- district cards the panel can actually speak to
  const districts: (DistrictCard & { unit: string })[] = [];
  for (const [e, cs] of cardsByEra) {
    const le = PACK_ERA[e];
    if (!le) continue;
    for (const c of cs) {
      if (c.kind !== 'district') continue;
      const u = `${c.state}-${c.number}|${le}`;
      if (f.byUnit.has(u)) districts.push({ ...c, unit: u });
    }
  }

  // ---- B: era-keyed demographics table, fitted from the real panel, LOO by district
  const byEra = new Map<string, (DistrictCard & { unit: string })[]>();
  for (const d of districts) { const le = d.unit.split('|')[1]; if (!byEra.has(le)) byEra.set(le, []); byEra.get(le)!.push(d); }
  const tagTable = (le: string, drop?: string) => {
    const pool = byEra.get(le)!.filter((d) => d.unit !== drop);
    const t = new Map<IdentityTag, number>();
    for (const tag of TAGS) {
      const hit = pool.filter((d) => d.demographics.includes(tag));
      if (hit.length) t.set(tag, mean(hit.map((d) => feOf(d.unit))));
    }
    return t;
  };
  const bPred = new Map<string, number>();
  for (const d of districts) {
    const t = tagTable(d.unit.split('|')[1], d.unit);
    const vs = d.demographics.map((g) => t.get(g)).filter((v): v is number => v !== undefined);
    bPred.set(d.unit, vs.length ? mean(vs) : 0);
  }

  // ---- D: the mechanism actually shipped -- a district's demographics meet
  // the era's own candidate pool, the same match `elections.ts` scores.
  const dPred = new Map<string, number>();
  for (const d of districts) {
    const packEra = Object.entries(PACK_ERA).find(([, v]) => v === d.unit.split('|')[1])![0];
    const pool = (cardsByEra.get(packEra)!).filter((c) => c.kind === 'candidate' && c.party !== 'I');
    const fitScore = (party: string) => {
      const side = pool.filter((c) => c.kind === 'candidate' && c.party === party);
      return side.length ? mean(side.map((c) => c.kind === 'candidate' ? c.identities.filter((i) => d.demographics.includes(i)).length : 0)) : 0;
    };
    dPred.set(d.unit, fitScore('D') - fitScore('R'));
  }

  // ---- C: emergent from play, plus the bite-rate this whole question turns on
  const cfg = loadConfig('as-written-plus.json');
  const allCards = loadPacks(ALL_PACKS);
  const holds = new Map<string, { d: number; n: number }>();
  let houseGenerals = 0, contestedGenerals = 0, crossPartyContestedGenerals = 0;
  for (let i = 0; i < GAMES; i++) {
    const r = playOne(AGENTS, allCards, cfg, 5_000 + i);
    for (const e of r.events) {
      if (e.office !== 'representative' || e.round !== 'general') continue;
      houseGenerals++;
      if (!e.uncontested) {
        contestedGenerals++;
        if (new Set(e.sides.map((s) => s.party)).size > 1) crossPartyContestedGenerals++;
      }
      const k = `${e.state}-${e.slot}`;
      const t = holds.get(k) ?? { d: 0, n: 0 };
      const winnerParty = e.sides.find((s) => s.player === e.winner)!.party;
      t.d += winnerParty === 'D' ? 1 : winnerParty === 'R' ? 0 : 0.5;
      t.n++;
      holds.set(k, t);
    }
  }
  const cPred = (u: string): number | undefined => {
    const t = holds.get(u.split('|')[0]);
    return t && t.n ? 2 * (t.d / t.n) - 0.5 * 2 : undefined; // signed, + = majority D
  };

  // ---- price every carrier against the real outcome (sign match = correct)
  const sign = (v: number) => v > 0 ? 1 : v < 0 ? 0 : 0.5;
  const winOf = (pred: (u: string) => number | undefined) => {
    let n = 0, w = 0;
    for (const d of districts) {
      const p = pred(d.unit);
      if (p === undefined) continue;
      n++;
      w += feOf(d.unit) > 0 ? sign(p) : 1 - sign(p);
    }
    return n ? 100 * w / n : NaN;
  };

  const us = districts.map((d) => d.unit);
  const withC = us.filter((u) => cPred(u) !== undefined);

  return {
    matched: districts.length,
    corrB: corr(us.map((u) => bPred.get(u)!), us.map(feOf)),
    corrD: corr(us.map((u) => dPred.get(u)!), us.map(feOf)),
    corrC: withC.length >= 2 ? corr(withC.map((u) => cPred(u)!), withC.map(feOf)) : NaN,
    winB: winOf((u) => bPred.get(u)),
    winD: winOf((u) => dPred.get(u)),
    winC: winOf((u) => cPred(u)),
    houseGenerals,
    crossPartyContestedGenerals,
    contestedShare: houseGenerals ? 100 * contestedGenerals / houseGenerals : NaN,
  };
}

export const finding: Finding = {
  id: 'district-lean-carrier',
  dependsOn: [],
  question:
    "hf7y/american-cycle#90 names three ways a district card's real partisanship could be carried -- a "
    + 'printed lean, an era-keyed demographics table fitted from the real MEDSL panel (B), or emergence from '
    + 'play via capture (C) -- and hf7y/american-cycle#130 asks whether the mechanism actually shipped, the '
    + "flat identity bonus (D), predicts real partisanship at all. `sim/scratch-district-carrier.ts` priced "
    + 'all of them and never shipped as a checked finding: does B track the real district better than D, does '
    + "C track it at all, and how much of the game can a party-keyed carrier (A or B) ever touch given #77/#90's "
    + 'own walkover-share finding?',

  headline:
    'B (real panel, no new field) tracks the real district far better than D (the mechanism actually shipped) '
    + '-- correlation 0.74 vs 0.36 against the district-era fixed effect, 85% vs 58% win rate predicting the '
    + "real winner's party -- while C (emergent from play, the capture mechanic) tracks it not at all, "
    + 'correlation -0.04, 46% win rate (worse than a coin flip). But a party-keyed carrier only ever differs a '
    + 'race that is BOTH contested AND cross-party, since a primary is same-party on both sides regardless of '
    + 'carrier; measured live over the shipped seven-era pool (200 games, four agents), only 2.76% of House '
    + 'generals are contested at all -- most of the 96%+ walkover share #77/#90 already measured survives into '
    + 'this narrower cut too. So building B would close a real accuracy gap the shipped mechanism leaves on '
    + "the table, but its payoff is capped by the same card-pool density #90/#77 are already blocked on "
    + "sourcing, not by B's own design.",
  stampedAt: '2026-09-16T00:00:00Z',
  stampedOn: '469c0ea',

  predicate(): Claim[] {
    const m = measure();
    return [
      { name: 'district cards matched to the real panel', value: m.matched, stamped: 153, tolerance: 5 },
      { name: 'correlation with real district effect: B (era demographics table)', value: m.corrB, stamped: 0.74, tolerance: 0.1 },
      { name: 'correlation with real district effect: D (shipped identity bonus)', value: m.corrD, stamped: 0.36, tolerance: 0.1 },
      { name: 'correlation with real district effect: C (emergent from play)', value: m.corrC, stamped: -0.04, tolerance: 0.15 },
      { name: 'win% predicting the real winner: B', value: m.winB, stamped: 85, tolerance: 6, unit: '%' },
      { name: 'win% predicting the real winner: D', value: m.winD, stamped: 58, tolerance: 6, unit: '%' },
      { name: 'win% predicting the real winner: C', value: m.winC, stamped: 46, tolerance: 8, unit: '%' },
      { name: 'House generals played', value: m.houseGenerals, stamped: 195640, tolerance: 195640 * 0.3 },
      { name: 'of which contested', value: m.contestedShare, stamped: 2.76, tolerance: 1.5, unit: '%' },
      { name: 'of which contested AND cross-party -- where a party-keyed carrier can ever bite', value: m.crossPartyContestedGenerals, stamped: 5402, tolerance: 5402 * 0.4 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const corrB = v('correlation with real district effect: B (era demographics table)');
    const corrD = v('correlation with real district effect: D (shipped identity bonus)');
    const corrC = v('correlation with real district effect: C (emergent from play)');
    const contested = v('of which contested');
    return [
      `B correlates with the real district at ${corrB.toFixed(2)}, D (shipped) at ${corrD.toFixed(2)}, C (emergent) at ${corrC.toFixed(2)}`,
      'B is real panel data, no new field, and already sits behind the same tag vocabulary hf7y/american-cycle#164 is sourcing -- '
        + 'building it is a config/engine change, not a data-sourcing one',
      `but only ${contested.toFixed(1)}% of House generals on the shipped pool are contested at all, and a party-keyed carrier `
        + 'needs contested AND cross-party to ever bite -- so B\'s payoff is capped by the same card-pool density '
        + 'hf7y/american-cycle#90/#77 are already blocked on, independent of whether B itself is worth building',
    ].join('; ');
  },
};
