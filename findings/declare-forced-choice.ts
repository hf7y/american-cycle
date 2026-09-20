import { loadConfig, loadPacks, playOne, ALL_PACKS } from '../sim/harness.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#158's ruling, acceptance item 4 (added 2026-09-17,
 *  citing hf7y/american-cycle#252): "measure forced vs chosen declarations,
 *  and their |lean|, under the draft." hf7y/american-cycle#186/#229 asked the
 *  same question of the OLD pack-draft mechanic and never landed
 *  (hf7y/american-cycle#273 re-measured it fresh as
 *  `findings/battleground-concentration.ts`'s declare-time claims, since
 *  #229's own code never reached main). That instrumentation subclassed each
 *  shipped agent's `declare()` and tallied every entry it returned, which
 *  was safe because the OLD engine called `declare()` exactly once per
 *  player per cycle and the return value WAS the cycle's declarations.
 *
 *  Under #158's one-at-a-time `declareRounds` (engine/game.ts), `declare()`
 *  is called once per player per ROUND -- many times a cycle -- and returns
 *  the same full ranked wishlist every time; the engine, not the agent,
 *  picks the first legal not-yet-committed entry each round. Re-tallying
 *  every entry `declare()` returns from outside would count the same
 *  candidates over and over across rounds, and reimplementing the
 *  uc/ur/eligible filter a second time outside `declareRounds` risks
 *  drifting from what the engine actually did. So this measurement reads
 *  `GameResult.declareForcedLean`/`declareChosenLean` instead -- counted
 *  once, inside `declareRounds` itself, from the exact same legal-options
 *  pass that picks each round's declaration (see that method's own
 *  comment): FORCED means, at the moment a card was committed, none of the
 *  player's other remaining legal cards were eligible for that same race;
 *  CHOSEN means at least one more was. */
function measure(seeds: number) {
  const cfg = loadConfig('tuned.json');
  const cards = loadPacks(ALL_PACKS);
  const forced: number[] = [];
  const chosen: number[] = [];
  for (let i = 0; i < seeds; i++) {
    const r = playOne(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg, 9_900_000 + i);
    forced.push(...r.declareForcedLean);
    chosen.push(...r.declareChosenLean);
  }
  return { forced, chosen };
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

export const finding: Finding = {
  id: 'declare-forced-choice',
  dependsOn: [],
  question:
    "hf7y/american-cycle#158's ruling, acceptance item 4 (hf7y/american-cycle#252): under the "
    + 'one-at-a-time declareRounds draft, does a declared race’s |lean| differ between one a player '
    + 'was FORCED onto (exactly one of their own remaining legal cards was eligible for it) and one '
    + 'they CHOSE (two or more competed for it)? The same question hf7y/american-cycle#186/#229 asked '
    + 'of the old pack-draft mechanic, re-measured fresh because the draft mechanic #229 measured no '
    + 'longer exists.',

  headline:
    'A real forced/chosen population exists under the draft, unlike the old mechanic\'s draft-time split '
    + '(#186/#229 item 2, arithmetically unreachable there) -- 26% of declarations have only one eligible '
    + 'card for the race (forced), the other 74% had at least one more of the player\'s own cards competing '
    + 'for the same race (chosen). Chosen declarations run at meaningfully higher |lean| than forced ones '
    + '(3.06 vs 2.07, +0.98), the same direction #273\'s re-measurement of the old mechanic found (Greedy '
    + '+0.27, Lookahead +0.25) -- a player with more than one option for a race disproportionately ends up '
    + "declaring into a less-safe seat, whichever mechanic is doing the picking. Settles #158's acceptance "
    + 'item 4: the comparison exists and moves the same way under the new draft as the old one did.',
  stampedAt: '2026-09-20T11:40:00Z',
  stampedOn: '45852a5',

  predicate(): Claim[] {
    const n = sample(60);
    const { forced, chosen } = measure(n);
    const total = forced.length + chosen.length;
    return [
      { name: 'forced-declare share', value: forced.length / total, stamped: 0.2559, tolerance: 0.06 },
      { name: 'mean |lean|, forced declare', value: mean(forced), stamped: 2.071, tolerance: 0.4 },
      { name: 'mean |lean|, chosen declare', value: chosen.length ? mean(chosen) : 0, stamped: 3.056, tolerance: 0.4 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const forcedShare = v('forced-declare share');
    const gap = v('mean |lean|, chosen declare') - v('mean |lean|, forced declare');
    return [
      `${(forcedShare * 100).toFixed(0)}% of declarations under the draft are FORCED (exactly one legal card for that race)`,
      Math.abs(gap) < 0.1
        ? 'chosen and forced declarations run at about the same |lean| -- no signal either way'
        : gap > 0
          ? `chosen declarations run at meaningfully HIGHER |lean| than forced ones (+${gap.toFixed(2)}), the same direction the old mechanic's #273 re-measurement found`
          : `chosen declarations run at meaningfully LOWER |lean| than forced ones (${gap.toFixed(2)}), the opposite of what the old mechanic's #273 re-measurement found`,
    ].join('; ');
  },
};
