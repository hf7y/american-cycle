import { loadConfig, loadPacks, BALANCE_PACKS } from '../sim/harness.ts';
import { tableWinRate } from '../sim/roundrobin.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const cards = loadPacks(BALANCE_PACKS);

export const finding: Finding = {
  id: 'multiplayer-default-fitness',
  dependsOn: [],
  question:
    "hf7y/american-cycle#46's own open scope, after #205/#211 measured 1v1 fairness for the solitaire "
    + "picker: read that same discipline back into the multiplayer game. ui/app.js prefills the setup "
    + "screen's three opponent slots with Greedy, HouseFarm and Random, and an unguarded code comment "
    + 'claims this leaves "a player of ordinary skill" (Greedy, per this repo\'s own skill-signal '
    + 'convention) winning 27% of 4-player games against fair share of 25%. Does it still, now that '
    + 'districts, tags and the amendment ending have all moved since that number was typed?',

  headline:
    'It does not: the shipped 4-player default (opponents Greedy+HouseFarm+Random, ordinary player '
    + 'proxied by a fourth Greedy seat) now wins 37.0% on both shipped configs -- 10pp above the 27% the '
    + "code comment claims and 12pp above the table's own 25% fair share, comfortably outside sampling "
    + 'noise (SE ~2.8pp at n=300). The 3-player default (Greedy+HouseFarm, no third opponent) is further '
    + 'off: 45.3% (tuned) / 42.7% (as-written-plus) against a 33.3% fair share. Both shipped tables now '
    + "favour the human, not the reverse -- the 27%/70%/8% claim was never re-derived after it was typed "
    + 'and had drifted quietly, exactly the failure mode this discipline exists to catch.',
  stampedAt: '2026-09-06T23:00:00Z',
  stampedOn: '360c1f3',

  predicate(): Claim[] {
    const n = sample(300);
    const claims: Claim[] = [];
    const stamped: Record<string, Record<string, number>> = {
      'tuned.json': { '4p': 37.0, '3p': 45.3 },
      'as-written-plus.json': { '4p': 37.0, '3p': 42.7 },
    };
    for (const cfgFile of ['tuned.json', 'as-written-plus.json']) {
      const cfg = loadConfig(cfgFile);
      const w4 = 100 * tableWinRate('Greedy', ['Greedy', 'HouseFarm', 'Random'], cards, cfg, n);
      const w3 = 100 * tableWinRate('Greedy', ['Greedy', 'HouseFarm'], cards, cfg, n);
      claims.push({ name: `${cfgFile}: 4p default win rate`, value: w4, stamped: stamped[cfgFile]['4p'], tolerance: 6, unit: '%' });
      claims.push({ name: `${cfgFile}: 3p default win rate`, value: w3, stamped: stamped[cfgFile]['3p'], tolerance: 6, unit: '%' });
    }
    return claims;
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    return [`tuned 4p: ${v('tuned.json: 4p default win rate').toFixed(1)}% (fair share 25%)`,
      `tuned 3p: ${v('tuned.json: 3p default win rate').toFixed(1)}% (fair share 33.3%)`,
      `as-written-plus 4p: ${v('as-written-plus.json: 4p default win rate').toFixed(1)}%`,
      `as-written-plus 3p: ${v('as-written-plus.json: 3p default win rate').toFixed(1)}%`].join('; ');
  },
};
