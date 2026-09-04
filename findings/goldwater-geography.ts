import { loadConfig, loadPacks } from '../sim/harness.ts';
import { buildModifiers, homeDistrict } from '../engine/rules/elections.ts';
import type { Claim, Finding } from './types.ts';

/** #41's own falsifier: "If signed weights do not separate Goldwater's five
 *  states from his 44 losses, the tag vocabulary is too coarse and the
 *  problem is the demographic taxonomy, not the arithmetic." The 1964 pack
 *  only carries one district card per state it names (30 cards, 24 states),
 *  so this checks what the falsifier can actually be run against, not all
 *  fifty -- and says so rather than quietly narrowing the claim. */
const PACK_STATES_WON = new Set(['AL', 'AZ', 'GA', 'LA', 'MS', 'SC']);

function classify(res: { identityBonus: number }, nat: unknown, pg: { extremistGeneral: number }) {
  const cards = loadPacks(['1964']);
  const goldwater = cards.find((c) => c.kind === 'candidate' && c.id === 'barry-goldwater-1964') as
    import('../engine/types/index.ts').CandidateCard | undefined;
  if (!goldwater) throw new Error('barry-goldwater-1964 not found in pack-1964.json');
  const districts = cards.filter((c) => c.kind === 'district' && c.era === 1964) as
    import('../engine/types/index.ts').DistrictCard[];
  const states = [...new Set(districts.map((d) => d.state))].sort();

  // The pre-#41 card: same effects, but identities/weights as they shipped
  // before this issue -- no union/urban entries, no identityWeights at all.
  const flatCard = { ...goldwater, identities: ['rural', 'veteran', 'business'] as const, identityWeights: undefined };

  const totalFor = (card: typeof goldwater) => {
    const out = new Map<string, number>();
    for (const state of states) {
      const district = homeDistrict(districts.filter((d) => d.state === state), state);
      const declaration = { player: 0, card: card!, office: 'president' as const, state, district };
      const ctx = {
        year: 1964, office: 'president' as const, state, lean: 0,
        isMidterm: false, isPresidentialYear: true, economyMod: 0,
      };
      const mods = buildModifiers(declaration, ctx, 'general', res as never, nat as never, pg as never);
      out.set(state, mods.reduce((n, m) => n + m.pips, 0));
    }
    return out;
  };

  const signed = totalFor(goldwater);
  const flat = totalFor(flatCard as never);

  const score = (totals: Map<string, number>) => {
    let correct = 0, wonCorrect = 0, lostCorrect = 0;
    const won = [...PACK_STATES_WON].filter((s) => states.includes(s));
    const lost = states.filter((s) => !PACK_STATES_WON.has(s));
    for (const [state, total] of totals) {
      const predictedWin = total > 0;
      const actuallyWon = PACK_STATES_WON.has(state);
      if (predictedWin === actuallyWon) correct++;
      if (actuallyWon && predictedWin) wonCorrect++;
      if (!actuallyWon && !predictedWin) lostCorrect++;
    }
    return { correct, wonCorrect, lostCorrect, wonN: won.length, lostN: lost.length, n: states.length };
  };

  return { signedScore: score(signed), flatScore: score(flat), n: states.length };
}

export const finding: Finding = {
  id: 'goldwater-geography',
  dependsOn: ['as-written-plus.json'],
  question:
    "#41's falsifier: does giving Barry Goldwater's 1964 card signed per-tag identity weights "
    + "(union -3, urban -2, business +3, on top of the unweighted rural/veteran he already carried) "
    + 'separate the states his card favours from the states it does not, better than the single flat '
    + 'identityBonus every card shared before this issue?',

  headline:
    "Better, not solved. Scored against the 24 states pack-1964.json actually carries a district "
    + 'card for (of the real 50 -- six of them are Goldwater\'s historical wins, eighteen are losses), '
    + 'the signed-weight card classifies 17/24 correctly against the flat card\'s 13/24 -- a coin flip. '
    + 'All of the gain is on the LOSS side: the union/urban penalty correctly turns Rust Belt states '
    + '(OH, IN, IL, MI, MA, PA) negative where the flat +1-per-tag mechanic read them as neutral-to-'
    + 'positive, taking loss-state specificity from 9/18 to 13/18. It does nothing for recall on the '
    + 'states he actually won: GA and LA are missed under BOTH mechanics, because their only district '
    + "card in the pack is tagged `urban` (representing Atlanta/New Orleans) with no `rural` alongside "
    + 'it, so a white-backlash rural vote that carried the state has no matching demographic tag to '
    + "attach a weight to. That is #164's complaint from the other side: the arithmetic now works, and "
    + 'the taxonomy is still what caps it.',
  stampedAt: '2026-09-04T21:56:03Z',
  stampedOn: '8b1b49a',

  predicate(): Claim[] {
    const cfg = loadConfig('as-written-plus.json');
    const { signedScore, flatScore, n } = classify(cfg.resolution, cfg.national, cfg.primaryGeneral);
    return [
      { name: 'signed weights: states classified correctly (of 24 in the pack)', value: signedScore.correct, stamped: 17, tolerance: 0 },
      { name: 'flat identityBonus: states classified correctly (of 24 in the pack)', value: flatScore.correct, stamped: 13, tolerance: 0 },
      { name: 'signed weights: loss states correctly read negative (of 18)', value: signedScore.lostCorrect, stamped: 13, tolerance: 0 },
      { name: 'flat identityBonus: loss states correctly read negative (of 18)', value: flatScore.lostCorrect, stamped: 9, tolerance: 0 },
      { name: 'signed weights: win states correctly read positive (of 6)', value: signedScore.wonCorrect, stamped: 4, tolerance: 0 },
      { name: 'flat identityBonus: win states correctly read positive (of 6)', value: flatScore.wonCorrect, stamped: 4, tolerance: 0 },
      { name: 'district cards the 1964 pack actually carries a state for', value: n, stamped: 24, tolerance: 0 },
      { name: 'as-written-plus.json identityBonus (unweighted-tag default)', value: cfg.resolution.identityBonus, stamped: 1, tolerance: 0 },
      { name: 'as-written-plus.json extremistGeneral (flat, geography-blind)', value: cfg.primaryGeneral.extremistGeneral, stamped: -2, tolerance: 0 },
    ];
  },

  verdict(c: Claim[]): string {
    const by = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const signedTotal = by('signed weights: states classified correctly');
    const flatTotal = by('flat identityBonus: states classified correctly');
    const signedRecall = by('signed weights: win states');
    const flatRecall = by('flat identityBonus: win states');
    return [
      signedTotal > flatTotal
        ? `signed weights separate geography better than the flat mechanic (${signedTotal}/24 vs ${flatTotal}/24)`
        : `signed weights do NOT separate geography better than the flat mechanic (${signedTotal}/24 vs ${flatTotal}/24)`,
      signedRecall > flatRecall
        ? 'and it catches more of the states he actually won'
        : 'but it catches no more of the states he actually won -- the taxonomy gap #164 named is the binding one there',
    ].join('; ');
  },
};
