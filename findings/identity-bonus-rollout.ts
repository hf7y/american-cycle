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
    'This commit re-cuts 20 more candidate cards, spread across six of the seven packs, closing out '
    + "a specific, well-documented figure per tag rather than opening a new bucket: `catholic` (Joe/"
    + "Joseph R. Biden '92/'08/'24 +2 each, a Scranton Catholic identity central to his brand across "
    + "three decades; Jerry Brown '76/'92 +2 each, three years in a Jesuit novitiate before politics; "
    + "George Voinovich '92/'08 +1 each, Slavic-Catholic Cleveland roots), `urban` (John Lindsay '64 "
    + "+2, the quintessential reform mayor of New York; Jack Kemp '92 +2, urban enterprise zones were "
    + "his signature policy; George Voinovich '92/'08 +2 each, two terms as Cleveland's mayor), "
    + "`jewish` (Bernie Sanders '08/'16/'24 +2 each, the first Jewish candidate to win a state "
    + "presidential primary), `rural` (Jim Webb '08 +2, his book on Scots-Irish Appalachian identity "
    + "was the spine of his campaign; Al Gore '92 +1, the family farm in Carthage, TN; Fred Thompson "
    + "'08 +1, a folksy Tennessee persona built into his ads), `farm` (Byron Dorgan '92 +2, decades on "
    + "the Senate Agriculture Committee for a wheat state), `suburban` (Hillary Clinton '08/'16 +1 "
    + "each, the Park Ridge, IL upbringing her own campaign biography cited), and `evangelical` (Nikki "
    + "Haley '16/'24 +1 each, a Sikh-raised convert to Christianity who ran in South Carolina's "
    + 'evangelical-heavy primary electorate). One-hundred-sixty-nine candidate cards of the full pool '
    + "(169/349) now carry `identityWeights`, up from one-hundred-forty-nine. Measured over the "
    + 'shipped agent pool, all seven packs, full sample: an identity match now fires in 19.5% of '
    + 'contested generals (up from 19.2%) and 49.2% of contested primaries (up from 49.1%), mean pips '
    + '1.84 (up from 1.82) and mean tags 1.44 (up from 1.43) when a match fires. 180 of 349 still fall '
    + "back to the flat default (identityBonus 1), and the math from the prior comments still holds: "
    + "closing the full gap to #19's +4/5 pip target by raising the flat default alone would still need "
    + 'roughly tripling it, and the sample still has a 3-tag simultaneous match: tripling would put '
    + "that case at 9 pips, over #41's own ~8-pip full-stack ceiling. Same collision #41 flagged, still "
    + 'unresolved at this scale -- re-cutting the remaining 180 cards is the same per-card content '
    + 'task, just twenty fewer of them.',
  stampedAt: '2026-09-09T10:25:00Z',
  stampedOn: '49ab96f',

  predicate(): Claim[] {
    const seedCount = sample(60);
    const roll = rolloutShare();
    const m = matchStats(seedCount);
    return [
      { name: 'candidate cards carrying signed identityWeights, of the full pool', value: roll, stamped: 48.42, tolerance: 0.2, unit: '%' },
      { name: 'contested generals with an identity match', value: m.generalMatchShare, stamped: 19.49, tolerance: 3, unit: '%' },
      { name: 'contested primaries with an identity match', value: m.primaryMatchShare, stamped: 49.15, tolerance: 3, unit: '%' },
      { name: 'mean pips when an identity match fires', value: m.meanPips, stamped: 1.84, tolerance: 0.3 },
      { name: 'mean tags shared when an identity match fires', value: m.meanTags, stamped: 1.44, tolerance: 0.3 },
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
