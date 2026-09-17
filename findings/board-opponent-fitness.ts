import { loadConfig, loadPacks, BALANCE_PACKS } from '../sim/harness.ts';
import { duel } from '../sim/roundrobin.ts';
import { AGENTS } from '../sim/agents.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const AGENT_NAMES = Object.keys(AGENTS).filter((n) => n !== 'Greedy');

export const finding: Finding = {
  id: 'board-opponent-fitness',
  dependsOn: [],
  question:
    'Now that #202 lets the setup screen seat exactly one opponent, which of the scripted '
    + "agents give a human a fair one-on-one game (Greedy standing in for an ordinary player, per this repo's own "
    + "skill-signal convention), and does the app's existing OPPONENT_BLURB -- calibrated against a fixed "
    + 'three-opponent field -- still describe them accurately at 1v1?',

  headline:
    'It does not: seven agents are near-unloseable for the human 1v1 (HouseFarm 92.7%, WideAndEmpty 100%, '
    + 'BillAuthor 85.7%, RunawayMaximiser 85.3%, WalkoverFarmer/BillMaximizer 77%, Random 73.3%) and six are '
    + "near-unwinnable (Lookahead 79%, BillBlocker 78%, Impeacher 66.3%, VPBackstab 65.3%, SenateFlood 65%, "
    + 'Launchpad 62.7% win rate for the agent) -- against the 3-opponent blurb text (e.g. Lookahead "wins about '
    + 'half of all games it plays", Greedy is "a fair fight") that ships regardless of table size. Four '
    + 'land in a fair 40-60% band for the human: Kingmaker (human wins 46%), HeterodoxSpecialist (59%), '
    + 'EconomyChicken (54%), Vetoer (46.7%). Shipped a solitaire-specific blurb in ui/app.js that only renders '
    + 'when exactly one opponent is seated, so the 3-opponent numbers stay correct for the field they were '
    + 'measured against.',
  stampedAt: '2026-09-16T15:00:00Z',
  stampedOn: '469c0ea',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(BALANCE_PACKS);
    const n = sample(300);

    const stamped: Record<string, number> = {
      Random: 26.7, WideAndEmpty: 0, WalkoverFarmer: 22.7, RunawayMaximiser: 14.7,
      SenateFlood: 65, HouseFarm: 7.3, HeterodoxSpecialist: 41, BillMaximizer: 23,
      Impeacher: 66.3, VPBackstab: 65.3, Launchpad: 62.7, EconomyChicken: 46,
      BillAuthor: 14.3, Vetoer: 53.3, BillBlocker: 78, Lookahead: 79,
      // hf7y/american-cycle#37: at 1v1 there is exactly one other player to
      // build a ledger with, and both sides run the same fit-first default,
      // so the extra reciprocal yes votes cut close to evenly -- a coin
      // flip, same shape RunawayBrake's own 1v1 degenerate case reads.
      Dealmaker: 50.7,
      // hf7y/american-cycle#37: RunawayBrake's leader-detection needs a
      // rival AND a benchmark rival to compare them against (see its own
      // `leader()` comment) -- unmeetable at 1v1, so it degenerates to
      // exactly GreedyAgent's declare/vote/veto and this is a Greedy-mirror
      // duel, correctly landing at a coin flip.
      RunawayBrake: 50.7,
      // hf7y/american-cycle#37: `Whip`'s declare() reuses BillAuthor's own
      // House/Senate weighting (favour-building needs bills to author and
      // Senate seats to hold), and BillAuthor is already this table's
      // second-weakest 1v1 opponent (14.3%) for exactly that reason -- too
      // narrow a diet of races to convert. Whip lands lower still.
      Whip: 6.7,
      // hf7y/american-cycle#37: `Kingmaker`'s offerVP/pickVP only diverge
      // from `Base`'s own defaults once a favour is already on the ledger
      // (see its own comment) -- at 1v1 that ledger builds off ordinary
      // fit-vote reciprocity same as `Dealmaker`'s, and a VP pick that
      // happens to land on the only other player at the table changes
      // little either way. Lands in the fair band, same shape as Dealmaker.
      Kingmaker: 54,
    };

    return AGENT_NAMES.map((name) => {
      const w = 100 * duel(name, 'Greedy', cards, cfg, n);
      return { name: `${name}: win rate vs Greedy, 1v1`, value: w, stamped: stamped[name], tolerance: 8, unit: '%' };
    });
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === `${n}: win rate vs Greedy, 1v1`)!.value;
    const fair = AGENT_NAMES.filter((n) => v(n) >= 40 && v(n) <= 60);
    const forHuman = AGENT_NAMES.filter((n) => v(n) < 40).sort((a, b) => v(a) - v(b));
    const forAgent = AGENT_NAMES.filter((n) => v(n) > 60).sort((a, b) => v(b) - v(a));
    return [
      fair.length
        ? `fair 1v1 opponents (human wins 40-60%): ${fair.map((n) => `${n} (${(100 - v(n)).toFixed(1)}%)`).join(', ')}`
        : 'no agent lands in a fair 40-60% band for the human at 1v1',
      `lopsided toward the human: ${forHuman.map((n) => `${n} (${(100 - v(n)).toFixed(1)}%)`).join(', ')}`,
      `lopsided toward the agent: ${forAgent.map((n) => `${n} (${v(n).toFixed(1)}%)`).join(', ')}`,
    ].join('; ');
  },
};
