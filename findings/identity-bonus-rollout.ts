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
    'This commit deepens two buckets that previously carried only one or two weighted cards each, rather '
    + 'than opening a new one. Seventy-three candidate cards of the full pool (73/349) now carry '
    + '`identityWeights`: the fifty-five carried over from the five prior commits, plus eighteen more '
    + 'split across `jewish` and `black`. `jewish` (13): Joe Lieberman \'08 (+2, the first Jewish '
    + "major-party VP nominee) and Chuck Schumer '16 (+2, a Brooklyn base built on it) at the top; "
    + "Barbara Boxer '92, Dianne Feinstein '92, Ron Wyden '92, Arlen Specter '92 and '08, Rahm Emanuel "
    + "'08, Barney Frank '08, Russ Feingold '08, Al Franken '08, Eric Cantor '08 and Norm Coleman '08 "
    + '(+1 each, part of the coalition without being the defining fact of the campaign). `black` (5): '
    + "Edward Brooke '76 (+2, the first Black senator elected by popular vote), Cory Booker '16 (+2, "
    + "Newark's urban Black base under his rise), Raphael Warnock '24 (+2, Ebenezer's pulpit and the GA "
    + "runoff coalition), Hakeem Jeffries '24 (+2, a Central Brooklyn Black political base), and Tim "
    + "Scott '24 (+1, a landmark seat built on a broader conservative coalition rather than a Black "
    + "electoral base). Measured over the shipped agent pool, all seven packs: an identity match now "
    + 'fires in 20.5% of contested generals (up from 20.1%) and 47.5% of contested primaries (down from '
    + '48.4%, sample noise either direction), mean pips 1.66 (up from 1.65) and mean tags 1.42 (flat) '
    + 'when a match fires. 276 of 349 still fall back to the flat default, and the math from the prior '
    + "comments still holds: closing the full gap to #19's +4/5 pip target by raising the flat default "
    + 'alone would still need roughly tripling it, and the sample still has a 3-tag simultaneous match: '
    + 'tripling would put that case at 9 pips, over #41\'s own ~8-pip full-stack ceiling. Same collision '
    + '#41 flagged, still unresolved at this scale -- re-cutting the remaining 276 cards is the same '
    + 'per-card content task, just eighteen fewer of them.',
  stampedAt: '2026-09-09T07:50:32Z',
  stampedOn: 'd155118',

  predicate(): Claim[] {
    const seedCount = sample(60);
    const roll = rolloutShare();
    const m = matchStats(seedCount);
    return [
      { name: 'candidate cards carrying signed identityWeights, of the full pool', value: roll, stamped: 20.92, tolerance: 0.2, unit: '%' },
      { name: 'contested generals with an identity match', value: m.generalMatchShare, stamped: 20.46, tolerance: 3, unit: '%' },
      { name: 'contested primaries with an identity match', value: m.primaryMatchShare, stamped: 47.5, tolerance: 3, unit: '%' },
      { name: 'mean pips when an identity match fires', value: m.meanPips, stamped: 1.66, tolerance: 0.3 },
      { name: 'mean tags shared when an identity match fires', value: m.meanTags, stamped: 1.42, tolerance: 0.3 },
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
