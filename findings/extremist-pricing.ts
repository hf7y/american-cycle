import { loadConfig, loadPacks, playOne, ALL_PACKS, BALANCE_PACKS } from '../sim/harness.ts';
import { oddsAtEdge1d6 } from '../sim/cross-bench.ts';
import { oddsAtEdge } from '../engine/rules/resolution.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Config } from '../engine/game.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#159: `extremist` is a live +-2 modifier on 12.6% of the
 *  deck with no predicate and no DECISIONS.md entry. The tag charges a bonus
 *  in the primary and a penalty in the general, the exact shape `heterodox`
 *  was cut for -- so this measures it the same way that cut was measured. */
const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const SEED_BASE = 900000;
const PRIMARY_SD = Math.sqrt(2 * 35 / 12);

function measure(cards: ReturnType<typeof loadPacks>, cfg: Config, n: number) {
  let primObserved = 0, primContested = 0;
  let genObserved = 0, genContested = 0;
  let primaryHadEvent = 0, generalReached = 0;
  let primPipsSum = 0, genPipsSum = 0;

  for (let i = 0; i < n; i++) {
    const r = playOne(AGENTS, cards, cfg, SEED_BASE + i);
    // A primary event only exists when a party fielded 2+ candidates for this
    // race -- a lone same-party candidate advances with no event and no roll.
    const primaryKeys = new Set<string>();
    for (const ev of r.events) {
      if (ev.round !== 'primary') continue;
      primaryKeys.add(`${ev.year}|${ev.office}|${ev.state}|${ev.slot ?? ''}|${ev.sides[0]?.party}`);
    }
    for (const ev of r.events) {
      for (const s of ev.sides) {
        const pm = s.modifiers.find((m) => m.source === 'extremist (primary)');
        const gm = s.modifiers.find((m) => m.source === 'extremist (general)');
        if (ev.round === 'primary' && pm) {
          primObserved++; primPipsSum += pm.pips;
          if (!ev.uncontested) primContested++;
        }
        if (ev.round === 'general' && gm) {
          genObserved++; genPipsSum += gm.pips;
          if (!ev.uncontested) genContested++;
          generalReached++;
          const k = `${ev.year}|${ev.office}|${ev.state}|${ev.slot ?? ''}|${s.party}`;
          if (s.party !== 'I' && primaryKeys.has(k)) primaryHadEvent++;
        }
      }
    }
  }
  return {
    primShare: 100 * primContested / primObserved,
    genShare: 100 * genContested / genObserved,
    reachedWithPrimaryFight: 100 * primaryHadEvent / generalReached,
    meanPrimPips: primPipsSum / primObserved,
    meanGenPips: genPipsSum / genObserved,
  };
}

export const finding: Finding = {
  id: 'extremist-pricing',
  dependsOn: ['as-written-plus.json'],
  question:
    "hf7y/american-cycle#159: `extremist` charges +-2 in the primary and general, mirroring the "
    + 'shape `heterodox` was cut for -- a pip is worth more in the 1d6 primary (SD 2.42) than the '
    + '3d6 general (SD 4.18). Does the mirror argument hold under measurement the way it did for '
    + 'heterodox: does the bonus round actually reach live dice, and does the penalty round mostly not?',

  headline:
    'The mirror holds, more sharply than heterodox did. Extremist is unconditional -- unlike '
    + "heterodox's national-modifier exemption, it fires at its full printed value every single time "
    + 'it is computed (mean fielded pips exactly +2.00 primary / -2.00 general, both packs) -- so the '
    + 'whole question is how often each round is live. It rarely is for the bonus round: only 29.0% '
    + "(15.5% on BALANCE_PACKS) of extremist nominees who reach a general had a contested primary at "
    + "all -- the other 70-85% won their party's line unopposed and never rolled the die the +2 was "
    + 'attached to. When a primary IS contested, though, the dice are genuinely live (98.9%/98.2% of '
    + 'those events are not walkovers) and the edge is large: a 2-pip lead is 77.8% at 1d6 against '
    + "67.9% at 3d6. The penalty round is the mirror image: only 8.9% (13.6% BALANCE_PACKS) of the "
    + "card's general appearances are contested at all, so the -2 sits inert in a walkover 86-91% of "
    + 'the time. Net: extremist collects its bonus rarely but big when it does, and pays its penalty '
    + 'almost never -- the same asymmetry that got heterodox cut, not yet ruled on here.',
  stampedAt: '2026-09-06T01:30:00Z',
  stampedOn: '5d2695b',

  predicate(): Claim[] {
    const cfg = loadConfig('as-written-plus.json');
    const n = sample(80);
    const allSeven = measure(loadPacks(ALL_PACKS), cfg, n);
    const fourPack = measure(loadPacks(BALANCE_PACKS), cfg, n);

    return [
      { name: 'extremist candidate cards in the deck', value: 100 * 44 / 349, stamped: 12.6, tolerance: 1, unit: '%' },

      // --- is the modifier conditional, the way heterodox's was? ---
      { name: 'mean pips fielded, extremist (primary)', value: allSeven.meanPrimPips, stamped: 2, tolerance: 0.05 },
      { name: 'mean pips fielded, extremist (general)', value: allSeven.meanGenPips, stamped: -2, tolerance: 0.05 },

      // --- how often does each round actually roll live dice? ---
      { name: 'extremist primary events that are contested (not a mass-withdrawal walkover)', value: allSeven.primShare, stamped: 98.87, tolerance: 3, unit: '%' },
      { name: 'extremist general appearances that are contested', value: allSeven.genShare, stamped: 8.90, tolerance: 4, unit: '%' },
      { name: 'extremist general appearances that are contested, BALANCE_PACKS', value: fourPack.genShare, stamped: 13.58, tolerance: 5, unit: '%' },

      // --- how often does the +2 bonus round even happen for the cards that use it? ---
      { name: 'general-reaching extremist nominees whose primary was itself contested', value: allSeven.reachedWithPrimaryFight, stamped: 29.05, tolerance: 8, unit: '%' },
      { name: 'general-reaching extremist nominees whose primary was itself contested, BALANCE_PACKS', value: fourPack.reachedWithPrimaryFight, stamped: 15.54, tolerance: 8, unit: '%' },

      // --- the analytical odds table the mirror argument depends on ---
      { name: 'a 2-pip edge in a primary (1d6)', value: 100 * oddsAtEdge1d6(2), stamped: 77.78, tolerance: 0.01, unit: '%' },
      { name: 'a 2-pip edge in a general (3d6)', value: 100 * oddsAtEdge(2), stamped: 67.88, tolerance: 0.01, unit: '%' },

      // The conclusion is about SHIPPED numbers, so the shipped numbers are
      // checked, same as cross-bench-pricing.ts.
      { name: 'as-written-plus.json still ships extremistPrimary 2', value: cfg.primaryGeneral.extremistPrimary, stamped: 2, tolerance: 0 },
      { name: 'as-written-plus.json still ships extremistGeneral -2', value: cfg.primaryGeneral.extremistGeneral, stamped: -2, tolerance: 0 },
      { name: 'as-written-plus.json ships extremistEnvironmentPips unset, so the primary bonus is flat', value: cfg.primaryGeneral.extremistEnvironmentPips ? 1 : 0, stamped: 0, tolerance: 0 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const deck = deckSensitivity([
      { pool: 'all-seven', value: v('extremist general appearances that are contested') },
      { pool: 'four-pack', value: v('extremist general appearances that are contested, BALANCE_PACKS') },
    ]);
    const conditional = v('mean pips fielded, extremist (primary)') !== 2 || v('mean pips fielded, extremist (general)') !== -2;
    return [
      conditional
        ? 'the modifier is no longer unconditional -- some environment or scaling knob now shrinks it below its printed value'
        : `unlike heterodox, extremist fields its full printed value every time (+${v('mean pips fielded, extremist (primary)').toFixed(2)} / ${v('mean pips fielded, extremist (general)').toFixed(2)}) -- there is no exemption filter diluting it`,
      `the bonus round is rarely reached at all: only ${v('general-reaching extremist nominees whose primary was itself contested').toFixed(1)}% of extremist nominees had a contested primary before winning their line`,
      `but when it is, the dice are live (${v('extremist primary events that are contested (not a mass-withdrawal walkover)').toFixed(1)}% not walkovers) and the edge is real: a 2-pip lead is ${v('a 2-pip edge in a primary (1d6)').toFixed(1)}% at 1d6 against ${v('a 2-pip edge in a general (3d6)').toFixed(1)}% at 3d6`,
      `the penalty round mirrors this the other way: only ${v('extremist general appearances that are contested').toFixed(1)}% of the card's generals are contested, so the -2 is inert the rest of the time`,
      deck.sensitive
        ? `and the general contest share is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['all-seven'].toFixed(1)}% all-seven vs ${deck.byPool['four-pack'].toFixed(1)}% four-pack`
        : 'and the general contest share held stable between the all-seven and four-pack decks (hf7y/american-cycle#91)',
      'so the mirror argument #159 raised against heterodox\'s cut reasoning holds under measurement -- a ruling on cut-vs-keep is still open',
    ].join('; ');
  },
};
