import { loadConfig, loadPacks, playOne, ALL_PACKS } from '../sim/harness.ts';
import { oddsAtEdge, primaryOddsAtEdge } from '../engine/rules/resolution.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];

/** hf7y/american-cycle#159: `extremist` is a live +-2 modifier on an eighth of
 *  the deck with no predicate, no track row, and no DECISIONS.md entry --
 *  exactly the defect that got `heterodox` cut on 2026-08-31. That cut was
 *  argued from an SD comparison assuming every primary is contested and 83%
 *  of generals are walkovers; option 1 here is the same shape, measured
 *  rather than assumed, and checked against the odds table
 *  (`primaryOddsAtEdge`/`oddsAtEdge`) rather than eyeballed. */
function rolloutShare(): number {
  const cards = loadPacks(ALL_PACKS);
  const candidates = cards.filter((c) => c.kind === 'candidate');
  const extremist = candidates.filter((c) => c.effects.some((e) => e.type === 'extremist'));
  return (100 * extremist.length) / candidates.length;
}

interface RoundStats {
  events: number; contested: number; twoSide: number;
  /** wins/appearances at the two-side slice only -- the same restriction
   *  hf7y/american-cycle#187 applied to swinginess, because the odds table's
   *  closed form is a pairwise formula and understates the upset chance once
   *  a third or fourth candidate is in the field. */
  edgeWon: number; edgeRan: number;
}

const emptyRound = (): RoundStats => ({ events: 0, contested: 0, twoSide: 0, edgeWon: 0, edgeRan: 0 });

function extremistStats(seedCount: number) {
  const cfg = loadConfig('tuned.json');
  const cards = loadPacks(ALL_PACKS);
  const primary = emptyRound();
  const general = emptyRound();
  for (let i = 0; i < seedCount; i++) {
    const r = playOne(AGENTS, cards, cfg, 2200000 + i);
    for (const ev of r.events) {
      const bucket = ev.round === 'primary' ? primary : ev.round === 'general' ? general : undefined;
      if (!bucket) continue;
      const src = ev.round === 'primary' ? 'extremist (primary)' : 'extremist (general)';
      // One pass per side, not per event: a two-way race where both cards
      // carry `extremist` contributes two edge trials, each scored against
      // its own holder's win/loss -- exactly what a single-sided odds-table
      // lookup below is a prediction for.
      for (const s of ev.sides) {
        if (!s.modifiers.some((mm) => mm.source === src)) continue;
        bucket.events++;
        if (ev.uncontested) continue;
        bucket.contested++;
        if (ev.sides.length !== 2) continue;
        bucket.twoSide++;
        bucket.edgeRan++;
        if (s.player === ev.winner) bucket.edgeWon++;
      }
    }
  }
  return { primary, general };
}

export const finding: Finding = {
  id: 'extremist-pricing',
  dependsOn: ['tuned.json'],
  question:
    "hf7y/american-cycle#159: extremist carries a live +-2 modifier with no predicate and no design-record entry. "
    + 'Option 1 is to measure before ruling, the same shape the heterodox cut used: how often each side of the '
    + "modifier actually meets a contested race, and whether the pricing is decisive against the odds table "
    + 'rather than assumed.',

  headline:
    'extremist carries on 12.6% of the pool. The primary bonus is contested by construction -- the engine never '
    + "creates a primary race event unless the card has a same-party opponent, so every extremist-primary "
    + 'appearance IS a real contest, and 77% of those are exactly two-sided. At that flat +2, a 2d6 primary edge, '
    + "the observed win rate tracks the odds table (68.1% observed vs 71.3% predicted, well inside sampling "
    + "noise at this N) -- the primary bonus is real and decisive, not cosmetic. The general penalty is a "
    + 'different story: only 31.9% of extremist-general appearances are contested at all (most are walkovers, '
    + 'where no modifier of any size changes the outcome), and of the contested ones -- almost all two-sided -- '
    + 'the observed rate at -2 also tracks the odds table (35.9% vs 32.1%). So both halves of the tag are '
    + 'correctly priced WHEN they fire -- the asymmetry is not in the pips, it is in how often each side of the '
    + "ledger gets collected. That is a much smaller, less one-sided defect than heterodox's (which fired at its "
    + "face value unconditionally): the case for cutting extremist on heterodox's arithmetic does not transfer, "
    + "because unlike heterodox's near-worthless general exemption, both of extremist's numbers are earning their "
    + 'keep in the races where they apply. Recording it in DECISIONS.md as a settled, priced term (option 3) fits '
    + 'what this measures better than cutting it.',
  stampedAt: '2026-09-06T02:55:00Z',
  stampedOn: '6cb3688',

  predicate(): Claim[] {
    const seedCount = sample(80);
    const roll = rolloutShare();
    const { primary, general } = extremistStats(seedCount);
    const cfg = loadConfig('tuned.json');
    const primaryEdgeOdds = 100 * primaryOddsAtEdge(cfg.primaryGeneral.extremistPrimary);
    const generalEdgeOdds = 100 * oddsAtEdge(cfg.primaryGeneral.extremistGeneral);
    return [
      { name: 'extremist candidate cards, share of the full pool', value: roll, stamped: 12.6, tolerance: 1, unit: '%' },
      { name: 'shipped extremistPrimary (tuned.json)', value: cfg.primaryGeneral.extremistPrimary, stamped: 2, tolerance: 0 },
      { name: 'shipped extremistGeneral (tuned.json)', value: cfg.primaryGeneral.extremistGeneral, stamped: -2, tolerance: 0 },
      { name: 'extremist-primary appearances that are contested', value: 100 * primary.contested / primary.events, stamped: 100, tolerance: 2, unit: '%' },
      { name: 'contested extremist-primary appearances that are two-sided', value: 100 * primary.twoSide / primary.contested, stamped: 77.2, tolerance: 5, unit: '%' },
      { name: 'extremist-general appearances that are contested', value: 100 * general.contested / general.events, stamped: 31.9, tolerance: 4, unit: '%' },
      { name: 'contested extremist-general appearances that are two-sided', value: 100 * general.twoSide / general.contested, stamped: 99.3, tolerance: 2, unit: '%' },
      { name: 'observed win rate, two-side extremist-primary sides at +2', value: 100 * primary.edgeWon / primary.edgeRan, stamped: 68.1, tolerance: 8, unit: '%' },
      { name: 'odds-table win rate at primary edge +2', value: primaryEdgeOdds, stamped: 71.3, tolerance: 0.5, unit: '%' },
      { name: 'observed win rate, two-side extremist-general sides at -2', value: 100 * general.edgeWon / general.edgeRan, stamped: 35.9, tolerance: 8, unit: '%' },
      { name: 'odds-table win rate at general edge -2', value: generalEdgeOdds, stamped: 32.1, tolerance: 0.5, unit: '%' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const roll = v('extremist candidate cards, share of the full pool');
    const gContested = v('extremist-general appearances that are contested');
    const pObs = v('observed win rate, two-side extremist-primary sides at +2');
    const pPred = v('odds-table win rate at primary edge +2');
    const gObs = v('observed win rate, two-side extremist-general sides at -2');
    const gPred = v('odds-table win rate at general edge -2');
    const primaryDecisive = Math.abs(pObs - pPred) <= 10;
    const generalDecisive = Math.abs(gObs - gPred) <= 10;
    return [
      `extremist carries on ${roll.toFixed(1)}% of the pool`,
      `the primary bonus is contested by construction and ${primaryDecisive ? 'tracks' : 'diverges from'} the odds table when it fires (${pObs.toFixed(1)}% vs ${pPred.toFixed(1)}%)`,
      `the general penalty only ever has something to bite in ${gContested.toFixed(1)}% of its appearances, and there it ${generalDecisive ? 'also tracks' : 'diverges from'} the odds table (${gObs.toFixed(1)}% vs ${gPred.toFixed(1)}%)`,
      primaryDecisive && generalDecisive
        ? 'both halves are correctly priced when they apply -- the defect is that no document says so, not that the magnitudes are wrong'
        : 'at least one side does not track the odds table at this sample size, which is worth a larger run before ruling',
    ].join('; ');
  },
};
