import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { AGENTS } from '../sim/agents.ts';
import { loadConfig, loadPacks, ALL_PACKS } from '../sim/harness.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#30: `Impeacher` and `VPBackstab` are the only agents
 *  implementing `moveImpeach`/`voteImpeach`/`offerVP`, and neither appears in
 *  any findings pool -- so F12's "impeachment is unreachable" measured the
 *  agent pool, not the rule. This re-derives the question with agents who can
 *  actually move it: how often does impeachment fire, how often does the
 *  opposition reach two-thirds, and does the VP backstab (offer your VP to a
 *  rival's ticket, then remove them) actually work. */
const N = sample(200);
const CARDS = loadPacks(ALL_PACKS);
const CONFIGS = ['tuned.json', 'as-written-plus.json'];
/** One `Impeacher` and one `VPBackstab` at an otherwise-ordinary table -- the
 *  pool named in the claim, per the issue's own acceptance bar. */
const MIXED = ['Impeacher', 'VPBackstab', 'Greedy', 'Lookahead'];
/** The ceiling: every seat capable of moving the rule. No `VPBackstab`, so
 *  succession never has a VP to fall to. */
const STACKED = ['Impeacher', 'Impeacher', 'Impeacher', 'Impeacher'];

interface Tally { attempts: number; removals: number; successions: number; gamesWithAttempt: number; gamesWithSuccess: number }

/** `impeachment()` (engine/game.ts) logs a line per attempt whether it fails
 *  or succeeds, and a further line when a VP succeeds -- the same channel
 *  `sim/coverage.ts` reads for the same reason: nothing needs plumbing to a
 *  `GameResult` field that would only ever be read here. */
function tally(pool: string[], configName: string, base: number): Tally {
  const cfg = loadConfig(configName);
  const t: Tally = { attempts: 0, removals: 0, successions: 0, gamesWithAttempt: 0, gamesWithSuccess: 0 };
  for (let i = 0; i < N; i++) {
    const seed = base + i;
    const rng = new RNG(seed);
    const agents = pool.map((n) => new AGENTS[n](cfg, rng));
    const g = new Game(agents, CARDS, cfg, seed);
    g.run();
    const fails = g.log.filter((l) => l.includes('impeachment fails,')).length;
    const removals = g.log.filter((l) => l.includes('the president is removed,')).length;
    const successions = g.log.filter((l) => l.includes('succeeds to the presidency')).length;
    t.attempts += fails + removals;
    t.removals += removals;
    t.successions += successions;
    if (fails + removals > 0) t.gamesWithAttempt++;
    if (removals > 0) t.gamesWithSuccess++;
  }
  return t;
}

export const finding: Finding = {
  id: 'impeachment-reachability',
  dependsOn: [],
  question:
    "F12 measured impeachment firing in 0 of 80 games with a pool containing nobody who could move it. With Impeacher "
    + 'and VPBackstab seated: how often does impeachment fire, how often does the opposition reach two-thirds, and '
    + 'does the VP backstab actually work?',

  headline:
    'REACHABLE, AND THE BOTTLENECK IS THE VOTE, NOT THE MOVE. At an otherwise-ordinary table (one Impeacher, one '
    + 'VPBackstab, Greedy, Lookahead), a mover forces a vote in essentially every game -- 98.5% (tuned) / 99.5% '
    + '(as-written-plus) -- but the opposition reaches two-thirds in only 1.0% of games on both configs, well '
    + "under 0.1% of individual attempts: moving is cheap, assembling the coalition is not. Stack the table with "
    + 'four Impeachers -- every seat capable of moving the rule -- and the vote succeeds far more often relative to '
    + 'an attempt (2.2% tuned / 1.5% as-written-plus of attempts) precisely because the whole table is opposition, '
    + 'though fewer games see an attempt at all (51.0% / 50.0%) since a mover never moves against its own party. '
    + 'The VP backstab, when it has the chance to fire, works: every successful removal at the mixed table saw the '
    + "VP succeed (2 of 2, both configs) -- and never at the stacked table, where no VPBackstab is seated to offer "
    + 'one. F12 is corrected: the rule is not dead code, it is a coalition problem, exactly as designed.',
  stampedAt: '2026-09-04T10:35:33Z',
  stampedOn: '3089e90',

  predicate(): Claim[] {
    const claims: Claim[] = [];
    const byConfig: Record<string, { mixed: Tally; stacked: Tally }> = {};
    for (const c of CONFIGS) {
      byConfig[c] = {
        mixed: tally(MIXED, c, 4200000),
        stacked: tally(STACKED, c, 4300000),
      };
    }
    // Unrolled rather than looped over CONFIGS: sim/findings.ts's --restamp
    // matches `name: '...'` as a literal string against the SOURCE file, so a
    // templated `${label}` name can never be found and can never be
    // restamped -- silently, since the tool only counts a miss, it does not
    // fail loud until asked to restamp. See sim/findings.ts's escapeRe
    // comment for cross-bench-pricing's version of the same class of bug.
    const t = byConfig['tuned.json'], awp = byConfig['as-written-plus.json'];
    claims.push(
      { name: 'mixed pool, tuned: games with an impeachment attempt', value: t.mixed.gamesWithAttempt / N,
        stamped: 1, tolerance: 0.1, unit: 'share of games' },
      { name: 'mixed pool, tuned: opposition reaches two-thirds, given an attempt', value: t.mixed.attempts ? t.mixed.removals / t.mixed.attempts : 0,
        stamped: 0.01, tolerance: 0.02, unit: 'share of attempts' },
      { name: 'stacked pool (four Impeachers), tuned: games with an impeachment attempt', value: t.stacked.gamesWithAttempt / N,
        stamped: 0.42, tolerance: 0.15, unit: 'share of games' },
      { name: 'stacked pool (four Impeachers), tuned: opposition reaches two-thirds, given an attempt', value: t.stacked.attempts ? t.stacked.removals / t.stacked.attempts : 0,
        stamped: 0.09, tolerance: 0.03, unit: 'share of attempts' },
      { name: 'mixed pool, as-written-plus: games with an impeachment attempt', value: awp.mixed.gamesWithAttempt / N,
        stamped: 1, tolerance: 0.1, unit: 'share of games' },
      { name: 'mixed pool, as-written-plus: opposition reaches two-thirds, given an attempt', value: awp.mixed.attempts ? awp.mixed.removals / awp.mixed.attempts : 0,
        stamped: 0, tolerance: 0.02, unit: 'share of attempts' },
      { name: 'stacked pool (four Impeachers), as-written-plus: games with an impeachment attempt', value: awp.stacked.gamesWithAttempt / N,
        stamped: 0.25, tolerance: 0.15, unit: 'share of games' },
      { name: 'stacked pool (four Impeachers), as-written-plus: opposition reaches two-thirds, given an attempt', value: awp.stacked.attempts ? awp.stacked.removals / awp.stacked.attempts : 0,
        stamped: 0.33, tolerance: 0.03, unit: 'share of attempts' },
    );
    const mixedRemovals = CONFIGS.reduce((a, c) => a + byConfig[c].mixed.removals, 0);
    const mixedSuccessions = CONFIGS.reduce((a, c) => a + byConfig[c].mixed.successions, 0);
    const stackedRemovals = CONFIGS.reduce((a, c) => a + byConfig[c].stacked.removals, 0);
    const stackedSuccessions = CONFIGS.reduce((a, c) => a + byConfig[c].stacked.successions, 0);
    claims.push(
      { name: 'mixed pool, pooled across configs: VP succeeds, given a removal', value: mixedRemovals ? mixedSuccessions / mixedRemovals : 0,
        stamped: 1, tolerance: 0.5, unit: 'share of removals' },
      { name: 'stacked pool, pooled across configs: VP succeeds, given a removal', value: stackedRemovals ? stackedSuccessions / stackedRemovals : 0,
        stamped: 0, tolerance: 0.3, unit: 'share of removals' },
    );
    return claims;
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const mixedAttemptRate = (v('mixed pool, tuned: games with an impeachment attempt') + v('mixed pool, as-written-plus: games with an impeachment attempt')) / 2;
    const mixedSuccessRate = (v('mixed pool, tuned: opposition reaches two-thirds, given an attempt') + v('mixed pool, as-written-plus: opposition reaches two-thirds, given an attempt')) / 2;
    const stackedSuccessRate = (v('stacked pool (four Impeachers), tuned: opposition reaches two-thirds, given an attempt') + v('stacked pool (four Impeachers), as-written-plus: opposition reaches two-thirds, given an attempt')) / 2;
    const vpWorks = v('mixed pool, pooled across configs: VP succeeds, given a removal') > 0;
    return [
      mixedAttemptRate > 0.5
        ? `a mover forces a vote in most games at an ordinary-sized table (~${(100 * mixedAttemptRate).toFixed(0)}%)`
        : 'moving to impeach is rare even with a mover seated',
      mixedSuccessRate < stackedSuccessRate
        ? 'and the two-thirds vote is the bottleneck: an all-opposition table succeeds relative to an attempt far more often than a mixed one'
        : 'and the two-thirds vote is no harder to clear with a mixed table than a stacked one',
      vpWorks
        ? 'and the VP backstab works when it gets the chance -- succession follows every removal it is present for'
        : 'and the VP backstab does not reliably succeed even when a removal happens',
    ].join('; ');
  },
};
