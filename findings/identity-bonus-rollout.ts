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
    'This commit re-cuts 39 more candidate cards (some reused across multiple packs), closing '
    + 'out most of the remaining pool that carries an identity tag but no override: `rural` (La '
    + 'Follette Jr., Watson, Pinchot, Udall, Church, Ford, Culver, Stafford, Kerrey, Richards, '
    + 'Simpson, Lott, Jeffords, Thompson, Edwards, Reid, Shuler, Hagel, Stefanik, DeWine -- '
    + 'documented small-town/farm/working-rural biography, or, where personal upbringing was '
    + "urban but the political base was rural (Church's Idaho wilderness/farm coalition, Ford's "
    + "Owensboro KY good-ol'-boy base, Proxmire's decades of Wisconsin dairy-farmer advocacy), "
    + 'the coalition basis the Pinchot/FDR precedent already established), `farm` (Culver, '
    + 'Proxmire), `catholic` (Eagleton, Dodd, Kasich, Toomey, DeWine -- documented personal '
    + 'upbringing or public faith narrative), `urban` (Eagleton, Mathias, Harris), `evangelical` '
    + "(Reagan -- 1976 primary courting the same Southern religious-conservative bloc the Nikki "
    + 'Haley precedent weighted; Lott, Shuler, Graham, Pawlenty, Sasse, Cotton, Blackburn -- '
    + 'Southern Baptist/evangelical upbringing or public identification), `suburban` (Hagan, '
    + 'Crist, Pawlenty, Stefanik, Blackburn, Crenshaw, Kelly, Lake), and `black` (Harris, both '
    + 'her cards -- HBCU/AKA/self-identification central to her campaigns). Same per-card, '
    + "only-tags-the-card-already-carries methodology as every prior commit. `hispanic` left off "
    + "both Harris cards (gated on #245, which flags the tag itself as an accuracy problem); "
    + "`evangelical` left off Harry Reid (he is LDS, same #240 denomination-bucketing gate as "
    + 'Hatch) -- weighted his `rural` tag only. Two-hundred-sixty-five candidate cards of the '
    + 'full pool (265/349) now carry `identityWeights`, up from two-hundred-twenty-six. 22 '
    + 'tagged-but-unweighted cards remain: 10 are prior commits\' already-flagged mismatches or '
    + 'insufficient-grounding skips (Byrnes, Fulbright, both Longs, both Shelbys, both DeSantis '
    + 'cards, both Hatch cards); the other 12 are new judgment calls from this pass -- Collins '
    + '(x3, `suburban`), McCarthy (`suburban`), Jones (`rural`+`evangelical`), Bush '
    + '(`evangelical`), Hollings (`rural`), and Tsongas (`catholic`) look like tag/bio mismatches, '
    + 'flagged separately on #164; Flake and McMullin are gated on #240 same as Reid/Hatch (both '
    + 'LDS); Rand Paul left alone for insufficient grounding, Abbott on the existing hispanic '
    + 'gate. Measured over the shipped agent pool, all seven packs, full sample: an identity '
    + 'match now fires in 22.5% of contested generals (up from 20.9%) and 49.7% of contested '
    + 'primaries (down from 51.3%), mean pips 2.02 (flat) and mean tags 1.40 (flat) when a match '
    + 'fires. 84 of 349 still fall back to the flat default (identityBonus 1) -- 62 of those carry '
    + 'no identity tag at all and can never be weighted; the other 22 are the judgment-call/gate '
    + "cases above. The math from the prior comments still holds: closing the full gap to #19's "
    + '+4/5 pip target by raising the flat default alone would still need roughly tripling it, and '
    + "the sample still has a 3-tag simultaneous match: tripling would put that case at 9 pips, "
    + "over #41's own ~8-pip full-stack ceiling. Same collision #41 flagged, still unresolved at "
    + 'this scale.',
  stampedAt: '2026-09-09T17:44:00Z',
  stampedOn: '8bf6f9a',

  predicate(): Claim[] {
    const seedCount = sample(60);
    const roll = rolloutShare();
    const m = matchStats(seedCount);
    return [
      { name: 'candidate cards carrying signed identityWeights, of the full pool', value: roll, stamped: 75.93, tolerance: 0.2, unit: '%' },
      { name: 'contested generals with an identity match', value: m.generalMatchShare, stamped: 22.50, tolerance: 3, unit: '%' },
      { name: 'contested primaries with an identity match', value: m.primaryMatchShare, stamped: 49.69, tolerance: 3, unit: '%' },
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
