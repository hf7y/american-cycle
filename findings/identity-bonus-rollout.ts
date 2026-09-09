import { loadConfig, loadPacks, playOne, ALL_PACKS } from '../sim/harness.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];

/** hf7y/american-cycle#19 priced a district-party match at +4 to +5 pips,
 *  calibrated on win rates, against a mechanic where every shared tag paid
 *  the same flat `identityBonus`. hf7y/american-cycle#41 shipped a DIFFERENT
 *  mechanic -- signed, per-card, per-tag weights -- and #19's own thread
 *  says the +4/+5 figure cannot just be inherited: it has to be re-derived
 *  against the mechanic that actually shipped. This is that re-derivation,
 *  as far as it can go without #106 (parked): how far has the per-card
 *  rollout actually gone, and does the sim's fired magnitude move at all. */
function rolloutShare(): number {
  const cards = loadPacks(ALL_PACKS);
  const candidates = cards.filter((c) => c.kind === 'candidate');
  const weighted = candidates.filter((c) => c.identityWeights);
  return (100 * weighted.length) / candidates.length;
}

/** Every contested side over `seedCount` games, all seven packs -- reads the
 *  `identity:` modifier `buildModifiers` (engine/rules/elections.ts) attaches
 *  when a candidate's identities share a tag with the race's district. */
function matchStats(seedCount: number) {
  const cfg = loadConfig('as-written-plus.json');
  const cards = loadPacks(ALL_PACKS);
  let contestedGenerals = 0, matchedGenerals = 0, contestedPrimaries = 0, matchedPrimaries = 0;
  let pipsSum = 0, tagsSum = 0, matchedTotal = 0, maxTags = 0;
  for (let i = 0; i < seedCount; i++) {
    const r = playOne(AGENTS, cards, cfg, 1090000 + i);
    for (const ev of r.events) {
      if (ev.uncontested) continue;
      const isGeneral = ev.round === 'general';
      for (const s of ev.sides) {
        if (isGeneral) contestedGenerals++; else contestedPrimaries++;
        const m = s.modifiers.find((mm) => mm.source.startsWith('identity:'));
        if (!m) continue;
        if (isGeneral) matchedGenerals++; else matchedPrimaries++;
        matchedTotal++;
        pipsSum += m.pips;
        const tagCount = m.source.slice('identity: '.length).split(', ').length;
        tagsSum += tagCount;
        maxTags = Math.max(maxTags, tagCount);
      }
    }
  }
  return {
    generalMatchShare: (100 * matchedGenerals) / contestedGenerals,
    primaryMatchShare: (100 * matchedPrimaries) / contestedPrimaries,
    meanPips: pipsSum / matchedTotal,
    meanTags: tagsSum / matchedTotal,
    maxTags,
  };
}

export const finding: Finding = {
  id: 'identity-bonus-rollout',
  dependsOn: [],
  question:
    "hf7y/american-cycle#19's remaining half, as far as it goes without hf7y/american-cycle#106 "
    + '(parked): #41 shipped signed per-tag identity weights (PR #175) in place of the flat '
    + '`identityBonus` #19 priced at +4 to +5 pips. How far has the per-card rollout actually gone, '
    + "and does the sim's fired identity-match magnitude move at all as a result?",

  headline:
    'This commit re-cuts 27 more candidate cards (some reused across multiple packs), closing '
    + "out one well-documented figure per tag: `rural` (Cordell Hull +2, log-cabin-born son of a "
    + "Tennessee farmer, a birthplace the state still runs as a park; Joseph T. Robinson +2, farmer's "
    + "son who chopped cotton and tended his father's orchard as a boy; Alben Barkley +2, tenant "
    + "tobacco farmer's son who chopped wood and harvested tobacco before law school; Charles Curtis "
    + '+2, raised on the Kaw reservation by his grandmother after his mother\'s death; Simeon Fess +2, '
    + "orphaned young onto a farm near Harrod, Ohio; Wayne Morse +2, raised on his family's 320-acre "
    + "working farm outside Madison, WI (still a National Register site); John C. Stennis +2 (both "
    + "his '64 and '76 cards), born on a farm in Kemper County, MS; John Connally +2, a barefoot boy "
    + "of mule-plowed furrows on the family's South Texas cotton farm before age 10; Everett Dirksen "
    + "+2, raised on a farm his widowed mother ran inside Pekin, IL's city limits; Sam Nunn +2 (both "
    + "his '76 and '92 cards), who left a House Armed Services staff job to run the family farm in "
    + "Perry, GA; William E. Borah +1, farm-born but by his own account no farmer at heart; Carl "
    + 'Hayden +1, born in adobe-house territorial Arizona to a town-founding father; Phil Scott +1 '
    + "(both '16 and '24), Barre, VT construction/racing persona more blue-collar than literally "
    + "agrarian), `farm` (Albert Gore Sr. +2, Possum Hollow farm boy who watched the Depression wipe "
    + "out three local banks; Birch Bayh +2 (both '64 and '76), raised partly on his grandparents' "
    + "farm and a 4-H tomato champion; Karl Mundt +1, adult 'agricultural pursuits' and a Senate Ag "
    + "Committee record more professional than boyhood-farm), and `urban` (Hiram Johnson +2, an "
    + "entire San Francisco prosecutorial and gubernatorial career; Tammy Baldwin +2 (both '16 and "
    + "'24), born and raised in Madison, WI; Clifford Case +1 (both '64 and '76), a Wall Street firm "
    + "and industrial-NJ political base; FDR +1, the urban ethnic/Catholic Tammany coalition he built "
    + "as governor, distinct from his own patrician Hyde Park upbringing; Pat Harrison +1, small-town "
    + 'Crystal Springs, MS rather than open country). Contested-ethnicity tags (hispanic/black) left '
    + 'untouched, same as every prior commit, gated on #164/#240; Orrin Hatch\'s `evangelical` tag '
    + "left unweighted too -- he's LDS, and #240 is the open decision on how denominations bucket. "
    + 'Three more cards were checked and skipped as likely tag/biography mismatches rather than '
    + "weighted on a stretch: James F. Byrnes ('rural', but born and raised in urban Charleston, SC), "
    + "Richard Shelby ('rural', but born in Birmingham to a U.S. Steel draftsman), and Ron DeSantis "
    + "('evangelical' on both his '16 and '24 cards, but raised and still practicing Catholic) -- "
    + 'flagged on #164 rather than silently reweighted, since fixing a tag is that issue\'s call, not '
    + "this rollout's. J. William Fulbright and Russell B. Long were checked and left alone for "
    + 'insufficient personal grounding (a diversified family business with one farm among several '
    + "holdings; a Shreveport upbringing once the family was already in power, respectively). "
    + 'Two-hundred-twenty-six candidate cards of the full pool (226/349) now carry `identityWeights`, '
    + 'up from one-hundred-ninety-nine. Measured over the shipped agent pool, all seven packs, full '
    + 'sample: an identity match now fires in 20.9% of contested generals (up from 20.2%) and 51.3% '
    + 'of contested primaries (up from 48.9%), mean pips 2.02 (up from 1.88) and mean tags 1.40 (flat) '
    + "when a match fires. 123 of 349 still fall back to the flat default (identityBonus 1) -- 62 of "
    + 'those carry no identity tag at all and can never be weighted; the other 61 are candidates for '
    + "a future commit. The math from the prior comments still holds: closing the full gap to #19's "
    + '+4/5 pip target by raising the flat default alone would still need roughly tripling it, and the '
    + "sample still has a 3-tag simultaneous match: tripling would put that case at 9 pips, over #41's "
    + "own ~8-pip full-stack ceiling. Same collision #41 flagged, still unresolved at this scale.",
  stampedAt: '2026-09-09T16:55:21Z',
  stampedOn: '0c1e851',

  predicate(): Claim[] {
    const seedCount = sample(60);
    const roll = rolloutShare();
    const m = matchStats(seedCount);
    return [
      { name: 'candidate cards carrying signed identityWeights, of the full pool', value: roll, stamped: 64.76, tolerance: 0.2, unit: '%' },
      { name: 'contested generals with an identity match', value: m.generalMatchShare, stamped: 20.86, tolerance: 3, unit: '%' },
      { name: 'contested primaries with an identity match', value: m.primaryMatchShare, stamped: 51.26, tolerance: 3, unit: '%' },
      { name: 'mean pips when an identity match fires', value: m.meanPips, stamped: 2.02, tolerance: 0.3 },
      { name: 'mean tags shared when an identity match fires', value: m.meanTags, stamped: 1.4, tolerance: 0.3 },
      { name: 'max tags shared simultaneously, this sample', value: m.maxTags, stamped: 3, tolerance: 0 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const roll = v('candidate cards carrying signed identityWeights, of the full pool');
    const meanPips = v('mean pips when an identity match fires');
    const maxTags = v('max tags shared simultaneously, this sample');
    const target = 4;
    const neededMultiplier = target / (meanPips / (v('mean tags shared when an identity match fires') || 1));
    const ceilingBreak = neededMultiplier * maxTags > 8;
    return [
      roll < 5
        ? `the per-card rollout is still near zero (${roll.toFixed(1)}% of the pool)`
        : `the per-card rollout has spread (${roll.toFixed(1)}% of the pool)`,
      `so the fired magnitude (${meanPips.toFixed(2)} mean pips) is still close to the pre-#41 flat mechanic`,
      ceilingBreak
        ? "and raising the flat default to reach #19's target would push the observed max simultaneous match over #41's ~8-pip ceiling"
        : "and raising the flat default to reach #19's target would NOT push the observed max simultaneous match over #41's ~8-pip ceiling",
    ].join('; ');
  },
};
