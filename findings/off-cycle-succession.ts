import { loadConfig, loadPacks, playOne, ALL_PACKS } from '../sim/harness.ts';
import { runawayMetrics } from '../sim/roundrobin.ts';
import type { Card } from '../engine/types/index.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];

/** hf7y/american-cycle#101 shipped `CandidateCard.succeeds`: a held seat
 *  converts party off-cycle, with no election, the moment its own holder
 *  plays the card that succeeds it. Three real pairs ship with it -- Shelby
 *  and Campbell switching to the GOP after 1994, Thurmond doing the same in
 *  reverse in 1964 -- which is what HISTORICAL-CASES.md's C1 (the 61.1%
 *  held / 50.0% won 1994-95 Deep South gap) needed and did not have. The
 *  mechanism itself is exercised deterministically in `engine/game.test.ts`
 *  ("a held seat converts party off-cycle...", "...is inert unless the same
 *  player holds both..."); this finding is the acceptance ruling's other
 *  two asks -- does it fire, and does it move the runaway metrics -- neither
 *  of which a scripted unit test can answer. */
const SUCCESSOR_IDS = ['richard-shelby-1996', 'ben-nighthorse-campbell-1995', 'strom-thurmond-1954'];

function successorPairShipped(cards: Card[]): number {
  const byId = new Map(cards.filter((c) => c.kind === 'candidate').map((c) => [c.id, c]));
  let pairs = 0;
  for (const c of byId.values()) {
    if (c.kind !== 'candidate' || !c.succeeds) continue;
    // The predecessor need not still be in the shipped pool (Thurmond's isn't
    // in this pack list until this issue added it) -- what matters is that
    // SOME card names it, wiring the pair together.
    pairs++;
  }
  return pairs;
}

function firedRate(cards: Card[], seedCount: number) {
  const cfg = loadConfig('tuned.json');
  let gamesWithSuccession = 0, totalSuccessions = 0;
  for (let i = 0; i < seedCount; i++) {
    const r = playOne(AGENTS, cards, cfg, 3_100_000 + i);
    if (r.successions.length) { gamesWithSuccession++; totalSuccessions += r.successions.length; }
  }
  return { gamesWithSuccession, totalSuccessions, games: seedCount };
}

export const finding: Finding = {
  id: 'off-cycle-succession',
  dependsOn: [],
  question:
    "hf7y/american-cycle#101's acceptance, items 4 and 5: with the three successor cards in the pool, does the "
    + 'off-cycle conversion ever fire in ordinary simulated play, does it move the SIM-BRIEF runaway metrics, and '
    + "can a gap of HISTORICAL-CASES.md C1's shape (seats held diverging from seats won) actually open?",

  headline:
    'Wired and correctly gated, but silent at this sample size: 0 successions in 1000 games across the shipped '
    + "agent pool, all seven packs. The mechanism needs the SAME player to already hold the EXACT predecessor's "
    + 'seat when the exact successor is drawn into their own hand -- three specific pairs out of 607 cards and 50 '
    + "states -- and the shipped agents' declaration heuristics and the draft's own randomness never reproduced "
    + "that precondition in this sample. Consequently the runaway metrics (determination, lead changes) are "
    + 'statistically indistinguishable with the three successor cards in the pool versus pulled back out: this is '
    + "the ruling's own concern (an ungated flip as a runaway lever) read as a null result, not a pass -- there is "
    + "nothing here yet for hf7y/american-cycle#84 to worry about. A gap of C1's shape CAN open (the unit tests "
    + 'in engine/game.test.ts force the precondition and confirm the seat converts, `since` intact, exactly once), '
    + 'but not from natural play at this scale -- it stays a structural capability until hf7y/american-cycle#90\'s '
    + 'expanded, sourced pool ships enough comparable pairs to reach it by chance.',
  stampedAt: '2026-09-05T19:30:00Z',
  stampedOn: '0385b91',

  predicate(): Claim[] {
    const seedCount = sample(1000);
    const withCards = loadPacks(ALL_PACKS);
    const withoutCards = withCards.filter((c) => !SUCCESSOR_IDS.includes(c.id));
    const pairs = successorPairShipped(withCards);
    const fired = firedRate(withCards, seedCount);

    const runawaySeeds = Array.from({ length: sample(150) }, (_, i) => 3_200_000 + i);
    const cfg = loadConfig('tuned.json');
    const withRunaway = runawayMetrics(runawaySeeds, AGENTS, withCards, cfg);
    const withoutRunaway = runawayMetrics(runawaySeeds, AGENTS, withoutCards, cfg);

    return [
      { name: '#101 successor cards shipped (succeeds pairs)', value: pairs, stamped: 3, tolerance: 0 },
      { name: `games with >=1 off-cycle succession, of ${seedCount}`, value: fired.gamesWithSuccession, stamped: 0, tolerance: 2 },
      {
        // Determination is quantised to whole years of an 8-point curve (see
        // sim/roundrobin.ts), so removing three cards from a 607-card deck
        // reshuffles every later draw in their era block and can move this
        // by a full 0.125 step on shuffle noise alone, with zero successions
        // fired either side -- runaway-no-brake.ts's own +/-0.2 tolerance is
        // the precedent for how wide that jitter runs.
        name: 'determination point, with successor cards minus without',
        value: withRunaway.determination - withoutRunaway.determination, stamped: -0.125, tolerance: 0.2,
      },
      {
        name: 'mean lead changes/game, with successor cards minus without',
        value: withRunaway.leadChanges - withoutRunaway.leadChanges, stamped: -0.15, tolerance: 0.3,
      },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const fired = v('games with');
    const detGap = v('determination point');
    const leadGap = v('mean lead changes');
    return fired === 0
      ? `still silent at this sample size (0 fires), and the runaway metrics move by ${detGap.toFixed(3)} `
        + `determination / ${leadGap.toFixed(2)} lead changes -- noise, not a lever`
      : `NOW FIRING (${fired} games) -- re-read the runaway gap (${detGap.toFixed(3)} determination, `
        + `${leadGap.toFixed(2)} lead changes) as a real measurement, not noise, and take it to hf7y/american-cycle#84`;
  },
};
