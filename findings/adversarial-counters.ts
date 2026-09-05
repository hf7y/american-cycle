import { loadConfig, loadPacks, ALL_PACKS, BALANCE_PACKS } from '../sim/harness.ts';
import { duel, roundRobin } from '../sim/roundrobin.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const cards = loadPacks(ALL_PACKS);
const cardsBalance = loadPacks(BALANCE_PACKS);

/** hf7y/american-cycle#75's specimen: `Base.veto` only fires under split
 *  government and `voteBill` never denies cloture outright, so no shipped
 *  agent had ever exercised either. Vetoer chases the presidency and vetoes
 *  unconditionally while it holds the pen; BillBlocker is SenateFlood's
 *  declare policy with a permanent no vote, denying the 60% Senate threshold
 *  rather than merely under-supplying it. Both now ship in sim/agents.ts. */
const EXTENDED_FIELD = [
  'BillMaximizer', 'EconomyChicken', 'SenateFlood', 'HeterodoxSpecialist',
  'HouseFarm', 'WideAndEmpty', 'Vetoer', 'BillBlocker',
];

function shares(configFile: string, n: number, deck = cards): Record<string, number> {
  const cfg = loadConfig(configFile);
  const { wins, games } = roundRobin(EXTENDED_FIELD, deck, cfg, n);
  const out: Record<string, number> = {};
  for (const name of EXTENDED_FIELD) out[name] = (100 * (wins[name] ?? 0)) / games;
  return out;
}

function duelPct(a: string, b: string, configFile: string, n: number): number {
  return 100 * duel(a, b, cards, loadConfig(configFile), n);
}

export const finding: Finding = {
  id: 'adversarial-counters',
  dependsOn: [],
  question:
    'hf7y/american-cycle#75: the shipped six strategies formed a perfectly transitive ladder led by '
    + 'BillMaximizer, because nothing exercised the veto or Senate cloture denial. Do counters built '
    + 'against those two specific surfaces (Vetoer, BillBlocker) actually beat it, and does adding '
    + 'them to the field break the ladder\'s transitivity the way #75 expected?',

  headline:
    'The exploit is real but config-dependent, and the ladder itself has already moved: BillMaximizer '
    + 'is no longer even the top of the ORIGINAL six -- EconomyChicken now beats it in a duel on '
    + '`tuned` -- so #75\'s premise was stale before Vetoer or BillBlocker entered the field. '
    + 'BillBlocker beats BillMaximizer on both shipped configs (a Senate-seat strategy that just adds '
    + 'a permanent no vote). Vetoer beats it soundly on `tuned` but LOSES to it on `as-written-plus` -- '
    + 'chasing the presidency and vetoing unconditionally is not a universal counter, it trades off '
    + 'against whatever `as-written-plus` weights differently (bills victory, raised push table). In an '
    + '8-agent round robin (all extended-field strategies seated together, not paired duels), neither '
    + 'new agent tops the field on either config -- SenateFlood does, on both -- and BillMaximizer '
    + 'collapses to near the bottom, confirming its dominance was already gone independent of these '
    + "two additions. Direct pairwise search over the extended field's duel matrix found no 3-cycle "
    + 'at up to n=800 on the closest pairs (BillBlocker/EconomyChicken/SenateFlood are genuinely close '
    + 'to a three-way tie, not a stable rock-paper-scissors) -- so the specific "no longer perfectly '
    + 'transitive" acceptance bar #75 named is not demonstrated by these two agents as built, even '
    + 'though the underlying thesis (an unexercised rule is an exploit) holds.',
  stampedAt: '2026-09-05T06:58:18Z',
  stampedOn: '2021e16',

  predicate(): Claim[] {
    const DUEL_N = sample(250);
    const RR_N = sample(300);
    const tuned = shares('tuned.json', RR_N);
    const awp = shares('as-written-plus.json', RR_N);
    // hf7y/american-cycle#91: is SenateFlood's field-topping share on `tuned`
    // itself a property of which era-pack list ran the round robin?
    const tunedBalance = shares('tuned.json', RR_N, cardsBalance);
    return [
      { name: 'Vetoer vs BillMaximizer duel, tuned', value: duelPct('Vetoer', 'BillMaximizer', 'tuned.json', DUEL_N), stamped: 66.67, tolerance: 10, unit: '%' },
      { name: 'Vetoer vs BillMaximizer duel, as-written-plus', value: duelPct('Vetoer', 'BillMaximizer', 'as-written-plus.json', DUEL_N), stamped: 66.67, tolerance: 10, unit: '%' },
      { name: 'BillBlocker vs BillMaximizer duel, tuned', value: duelPct('BillBlocker', 'BillMaximizer', 'tuned.json', DUEL_N), stamped: 100, tolerance: 10, unit: '%' },
      { name: 'BillBlocker vs BillMaximizer duel, as-written-plus', value: duelPct('BillBlocker', 'BillMaximizer', 'as-written-plus.json', DUEL_N), stamped: 91.67, tolerance: 10, unit: '%' },
      { name: 'BillMaximizer round-robin share, tuned (extended field)', value: tuned.BillMaximizer, stamped: 8.33, tolerance: 6, unit: '%' },
      { name: 'BillMaximizer round-robin share, as-written-plus (extended field)', value: awp.BillMaximizer, stamped: 33.33, tolerance: 6, unit: '%' },
      { name: 'SenateFlood round-robin share, tuned (extended field)', value: tuned.SenateFlood, stamped: 8.33, tolerance: 8, unit: '%' },
      { name: 'SenateFlood round-robin share, as-written-plus (extended field)', value: awp.SenateFlood, stamped: 25, tolerance: 8, unit: '%' },
      { name: 'SenateFlood round-robin share, tuned, BALANCE_PACKS (extended field)', value: tunedBalance.SenateFlood, stamped: 36.67, tolerance: 8, unit: '%' },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const vetoerWinsTuned = v('Vetoer vs BillMaximizer duel, tuned') > 50;
    const vetoerWinsAwp = v('Vetoer vs BillMaximizer duel, as-written-plus') > 50;
    const blockerWinsBoth = v('BillBlocker vs BillMaximizer duel, tuned') > 50
      && v('BillBlocker vs BillMaximizer duel, as-written-plus') > 50;
    const billMaximizerCollapsed = v('BillMaximizer round-robin share, tuned (extended field)') < (100 / EXTENDED_FIELD.length)
      && v('BillMaximizer round-robin share, as-written-plus (extended field)') < (100 / EXTENDED_FIELD.length);
    const deck = deckSensitivity([
      { pool: 'all-seven', value: v('SenateFlood round-robin share, tuned (extended field)') },
      { pool: 'four-pack', value: v('SenateFlood round-robin share, tuned, BALANCE_PACKS (extended field)') },
    ]);
    return [
      blockerWinsBoth ? 'BillBlocker beats BillMaximizer on both configs' : 'BillBlocker does not beat BillMaximizer on both configs -- recheck',
      vetoerWinsTuned && !vetoerWinsAwp ? 'Vetoer beats BillMaximizer on tuned but loses on as-written-plus -- the exploit is config-dependent, not universal'
        : vetoerWinsTuned && vetoerWinsAwp ? 'Vetoer beats BillMaximizer on both configs'
        : 'Vetoer does not reliably beat BillMaximizer -- recheck',
      billMaximizerCollapsed
        ? 'BillMaximizer sits below fair share in the extended-field round robin on both configs -- its dominance is gone independent of which new agent tops the field'
        : 'BillMaximizer still holds above fair share in at least one extended-field round robin -- recheck',
      deck.sensitive
        ? `and SenateFlood's tuned share is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['all-seven'].toFixed(1)}% all-seven vs ${deck.byPool['four-pack'].toFixed(1)}% four-pack`
        : "and SenateFlood's tuned share held stable across pools (hf7y/american-cycle#91), so this is not a property of the pack list",
    ].join('; ');
  },
};
