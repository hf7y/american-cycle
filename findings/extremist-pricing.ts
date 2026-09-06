import { loadConfig, loadPacks, playOne, ALL_PACKS, BALANCE_PACKS } from '../sim/harness.ts';
import { oddsAtEdge, primaryOddsAtEdge, PRIMARY_CANDIDATE_DICE, GENERAL_CANDIDATE_DICE } from '../engine/rules/resolution.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#159: `extremist` is a live +2 primary / -2 general
 *  modifier on 12.7% of the deck with no predicate, no track row and no
 *  DECISIONS.md entry -- unlike `heterodox`, which was cut on a measured
 *  asymmetry between the two rounds. This is that measurement, on the
 *  pattern DEFAULT-AFTER-30d option 1 asks for. */
const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];

/** heterodox was priced against the PRIMARY dice curve as it stood the day
 *  it was cut -- 1d6 vs 1d6, SD 2.42. hf7y/american-cycle#94 has since
 *  widened the primary candidate die to 2d6 (SD 3.42) and #159's own table
 *  never re-read that: it quotes heterodox's stale 0.83 SD figure as the
 *  primary side of the mirror. These are the CURRENT dice, the ones
 *  `primaryOddsAtEdge`/`oddsAtEdge` actually resolve races with. */
const PRIMARY_SD = Math.sqrt(2 * PRIMARY_CANDIDATE_DICE * 35 / 12);
const GENERAL_SD = Math.sqrt(2 * (GENERAL_CANDIDATE_DICE + 2) * 35 / 12);

function deckShare(packs: string[]): number {
  const candidates = loadPacks(packs).filter((c) => c.kind === 'candidate');
  const extremist = candidates.filter((c) => c.effects.some((e) => e.type === 'extremist'));
  return (100 * extremist.length) / candidates.length;
}

/** Every side over `seedCount` games that carries an `extremist (...)`
 *  modifier -- reads `RaceEvent.sides[].modifiers`, same source
 *  `arithmetic-load.ts` and `identity-bonus-rollout.ts` read off
 *  `GameResult.events`. Contested share is the whole question: the tag's
 *  pips can only ever matter in a race that is not decided by default. */
function tagStats(packs: string[], seedCount: number) {
  const cfg = loadConfig('tuned.json');
  const cards = loadPacks(packs);
  let primarySides = 0, primaryContested = 0, primaryPipsSum = 0;
  let generalSides = 0, generalContested = 0, generalPipsSum = 0;
  for (let i = 0; i < seedCount; i++) {
    const r = playOne(AGENTS, cards, cfg, 1590000 + i);
    for (const ev of r.events) {
      for (const s of ev.sides) {
        const p = s.modifiers.find((m) => m.source === 'extremist (primary)');
        if (p) { primarySides++; primaryPipsSum += p.pips; if (!ev.uncontested) primaryContested++; }
        const g = s.modifiers.find((m) => m.source === 'extremist (general)');
        if (g) { generalSides++; generalPipsSum += g.pips; if (!ev.uncontested) generalContested++; }
      }
    }
  }
  return {
    primarySides, generalSides,
    primaryContestedShare: primarySides ? (100 * primaryContested) / primarySides : NaN,
    generalContestedShare: generalSides ? (100 * generalContested) / generalSides : NaN,
    meanPrimaryPips: primarySides ? primaryPipsSum / primarySides : NaN,
    meanGeneralPips: generalSides ? generalPipsSum / generalSides : NaN,
  };
}

export const finding: Finding = {
  id: 'extremist-pricing',
  dependsOn: [],
  question:
    "hf7y/american-cycle#159: `extremist` fires in `engine/rules/elections.ts` as a live +2 primary / "
    + '-2 general modifier with no predicate, no track row, and no DECISIONS.md entry. The issue asks '
    + "the arithmetic that cut `heterodox` mirrored: what share of extremist sides actually meet the "
    + 'general penalty, what the tag is worth averaged over a card\'s career, and whether the primary '
    + 'bonus is decisive.',

  headline:
    "The issue's own mirror table compared extremist's +2 primary against heterodox's stale 1d6 "
    + 'primary curve (SD 2.42, giving 0.83 SD) -- hf7y/american-cycle#94 widened the primary die to 2d6 '
    + '(SD 3.42) and nothing re-read that comparison against it. On the CURRENT dice the two rounds are '
    + 'much closer than the issue states: +2 pips is 0.59 SD in the primary against -2 pips at 0.48 SD '
    + "in the general, not 0.83 vs 0.48 -- so extremist is not heterodox's mirror-image bargain, it is a "
    + "smaller edit in both directions, and both edges are live: 71.3% at a 2-pip primary edge, 67.9% "
    + 'at a 2-pip general edge. What still separates it from heterodox is not the SD gap but WHEN the '
    + "penalty gets the chance to bite: 12.6% of the deck carries the tag, extremist primaries are "
    + '100% contested over the shipped agent pool on tuned.json (every printed +2 is live), but '
    + 'extremist generals are contested only 23.8% of the time (all-seven packs) -- 35.8% on the '
    + 'four-pack subset, a real deck-sensitivity gap -- so the -2 general penalty is a dead letter in '
    + 'three walkovers out of four while the +2 primary bonus is never wasted. Net, holding the tag is '
    + 'a good trade for that reason alone: a bonus that always fires against a cost that mostly does not.',
  stampedAt: '2026-09-06T02:37:00Z',
  stampedOn: '6cb3688',

  predicate(): Claim[] {
    const seedCount = sample(80);
    const share = deckShare(ALL_PACKS);
    const t = tagStats(ALL_PACKS, seedCount);
    // hf7y/american-cycle#91: is contested share itself a property of which
    // era-pack list ran it, same config/agents/seeds?
    const tBalance = tagStats(BALANCE_PACKS, seedCount);
    return [
      { name: 'candidate cards carrying the extremist effect, of the full pool', value: share, stamped: 12.61, tolerance: 1, unit: '%' },
      { name: 'extremist-primary sides contested', value: t.primaryContestedShare, stamped: 100, tolerance: 2, unit: '%' },
      { name: 'extremist-general sides contested', value: t.generalContestedShare, stamped: 23.84, tolerance: 6, unit: '%' },
      { name: 'extremist-general sides contested, BALANCE_PACKS', value: tBalance.generalContestedShare, stamped: 35.80, tolerance: 6, unit: '%' },
      { name: 'mean primary pips when extremist fires', value: t.meanPrimaryPips, stamped: 2, tolerance: 0.01 },
      { name: 'mean general pips when extremist fires', value: t.meanGeneralPips, stamped: -2, tolerance: 0.01 },
      { name: 'a 2-pip edge in the CURRENT primary (2d6)', value: 100 * primaryOddsAtEdge(2), stamped: 71.26, tolerance: 0.01, unit: '%' },
      { name: 'a 2-pip edge in a general (3d6)', value: 100 * oddsAtEdge(2), stamped: 67.88, tolerance: 0.01, unit: '%' },
      { name: 'extremist primary bonus, in CURRENT primary SDs', value: 2 / PRIMARY_SD, stamped: 0.59, tolerance: 0.02 },
      { name: 'extremist general penalty, in general SDs', value: 2 / GENERAL_SD, stamped: 0.48, tolerance: 0.02 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const primarySD = v('extremist primary bonus, in CURRENT primary SDs');
    const generalSD = v('extremist general penalty, in general SDs');
    const primaryContested = v('extremist-primary sides contested');
    const generalContested = v('extremist-general sides contested');
    const deck = deckSensitivity([
      { pool: 'all-seven', value: v('extremist-general sides contested') },
      { pool: 'four-pack', value: v('extremist-general sides contested, BALANCE_PACKS') },
    ]);
    return [
      `+2/-2 is ${primarySD.toFixed(2)} primary SDs against ${generalSD.toFixed(2)} general SDs on the CURRENT `
      + `dice (hf7y/american-cycle#94), not the stale 1d6 curve #159's own table used`,
      primaryContested > 2 * generalContested
        ? `and the round that pays (general, ${generalContested.toFixed(1)}% contested) fires far less often than `
          + `the round that pockets (primary, ${primaryContested.toFixed(1)}% contested), so extremist reads as `
          + 'a bonus nobody would refuse rather than heterodox\'s mirror -- a cost nobody would pay'
        : 'and the two rounds now fire at comparable rates, so the walkover asymmetry no longer excuses the tag',
      deck.sensitive
        ? `and the general contested share is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['all-seven'].toFixed(1)}% all-seven vs ${deck.byPool['four-pack'].toFixed(1)}% four-pack`
        : 'and the general contested share held stable between the all-seven and four-pack decks (hf7y/american-cycle#91)',
    ].join('; ');
  },
};
