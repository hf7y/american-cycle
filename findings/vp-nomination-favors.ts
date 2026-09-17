import { Game, type Agent, type Config, type GameView, type VPOffer } from '../engine/game.ts';
import type { Card, CandidateCard, Party } from '../engine/types/index.ts';
import { loadConfig, loadPacks, BALANCE_PACKS } from '../sim/harness.ts';
import { AGENTS, Kingmaker } from '../sim/agents.ts';
import { RNG } from '../engine/rules/rng.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#37: does `Kingmaker`'s VP-nomination horse-trading
 *  (offerVP/pickVP reading the same favour ledger Dealmaker/Whip read off
 *  bill votes) actually fire in a real game, or is the ledger empty by the
 *  time a nominee is chosen? Nothing in `GameResult` records an individual
 *  VP offer or pick, so this instruments a subclass directly rather than
 *  reading the result.
 *
 *  Writing this finding is what caught a real sign error in `pickVP`: it
 *  filtered on `favor(v.me, o.from)` (does THIS agent owe the offerer?),
 *  but `favor(A, B) === -favor(B, A)` always (one signed ledger entry per
 *  pair, not two) -- and `offerVP` only ever fires when the OFFERER owes the
 *  NOMINEE, `favor(offerer, nominee) > 0`. That is the exact opposite sign
 *  of what the old `pickVP` checked, so the "prefer a debtor's offer" branch
 *  could never once fire against an offer this same class made -- confirmed
 *  by running this measurement before the fix and getting an exact,
 *  suspicious zero. Fixed to `favor(o.from, v.me)`, matching `offerVP`'s own
 *  direction; see that function's fix commit for the corrected reasoning. */
class InstrumentedKingmaker extends Kingmaker {
  offersConsidered = 0;
  offersFired = 0;
  picksConsidered = 0;
  picksToADebtor = 0;

  offerVP(v: GameView, nominee: { player: number; party: Party }): CandidateCard | undefined {
    if (nominee.player === v.me) return super.offerVP(v, nominee);
    this.offersConsidered++;
    const out = super.offerVP(v, nominee);
    if (out) this.offersFired++;
    return out;
  }

  pickVP(v: GameView, offers: VPOffer[]): VPOffer | undefined {
    if (!offers.length) return super.pickVP(v, offers);
    this.picksConsidered++;
    const out = super.pickVP(v, offers);
    if (out && this.favor(out.from, v.me, v) > 0) this.picksToADebtor++;
    return out;
  }

  private favor(me: number, other: number, v: GameView): number {
    let f = 0;
    for (const b of v.bills) {
      if (b.author === me && b.yesVoters?.includes(other)) f += 1;
      if (b.author === other && b.yesVoters?.includes(me)) f -= 1;
    }
    return f;
  }
}

// Two Kingmakers (so the ledger has a real chance to run in either
// direction between them) plus VPBackstab, which offers to any nominee
// regardless of the ledger -- the unconditional offer `pickVP` has to be
// weighed against a debtor's, or the "prefer a debtor" branch never has a
// live choice to make. BillAuthor fills the fourth seat for ordinary
// House/Senate presence and bill traffic.
const TABLE = ['Kingmaker', 'Kingmaker', 'VPBackstab', 'BillAuthor'];
const SEEDS = sample(400);

function measure(cards: Card[], cfg: Config) {
  let offersConsidered = 0, offersFired = 0, picksConsidered = 0, picksToADebtor = 0;
  for (let i = 0; i < SEEDS; i++) {
    const seed = 3000000 + i;
    const rng = new RNG(seed);
    const instrumented: InstrumentedKingmaker[] = [];
    const agents: Agent[] = TABLE.map((n) => {
      if (n !== 'Kingmaker') return new AGENTS[n](cfg, rng);
      const a = new InstrumentedKingmaker('Kingmaker', cfg, rng);
      instrumented.push(a);
      return a;
    });
    new Game(agents, cards, cfg, seed).run();
    for (const a of instrumented) {
      offersConsidered += a.offersConsidered;
      offersFired += a.offersFired;
      picksConsidered += a.picksConsidered;
      picksToADebtor += a.picksToADebtor;
    }
  }
  return {
    offerFireRate: offersConsidered ? offersFired / offersConsidered : 0,
    pickDebtorRate: picksConsidered ? picksToADebtor / picksConsidered : 0,
    offersPerGame: offersConsidered / SEEDS,
    picksPerGame: picksConsidered / SEEDS,
  };
}

export const finding: Finding = {
  id: 'vp-nomination-favors',
  dependsOn: [],
  question:
    "hf7y/american-cycle#37: does Kingmaker's favour-gated offerVP/pickVP -- the VP-nomination horse-trading "
    + 'plank DECISIONS.md names as untestable by simulation -- actually fire in a real game, given the ledger it '
    + 'reads is built entirely as a side effect of ordinary bill votes and may simply be empty by the time a '
    + 'nominee is chosen?',

  headline:
    'Rarely, but genuinely -- and getting a real number here caught a sign bug the unit tests alone did not. '
    + "Seated two-up against VPBackstab (which offers unconditionally) and BillAuthor, offerVP is asked about a "
    + 'real nominee 2.6 times a game and fires on 1.5% of those -- the ledger is net-positive at exactly that '
    + "moment only occasionally, since two similar agents voting on each other's bills mostly cancel out. "
    + 'pickVP sees offers to weigh 1.4 times a game and picks the one from an actual debtor 1.4% of the time. '
    + "Both are non-zero and match their own logic exactly (verified by construction, not just by the unit "
    + "tests), so the mechanism is not dead code -- it is a rare event, the same shape Dealmaker's own 1v1 "
    + 'result reads: correct, and mostly quiet, because reciprocal fit-voting rarely leaves a lasting balance.',
  stampedAt: '2026-09-16T16:00:00Z',
  stampedOn: '469c0ea',

  predicate(): Claim[] {
    const cfg = loadConfig('tuned.json');
    const cards = loadPacks(BALANCE_PACKS);
    const m = measure(cards, cfg);
    return [
      { name: 'offerVP: share of real opportunities that fire', value: m.offerFireRate, stamped: 0.015, tolerance: 0.03, unit: 'share' },
      { name: 'pickVP: share of picks that favour an actual debtor', value: m.pickDebtorRate, stamped: 0.014, tolerance: 0.03, unit: 'share' },
      { name: 'offerVP: real opportunities per game', value: m.offersPerGame, stamped: 2.63, tolerance: 1.5 },
      { name: 'pickVP: offers considered per game', value: m.picksPerGame, stamped: 1.39, tolerance: 1 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const pp = (x: number) => `${(100 * x).toFixed(1)}%`;
    return [
      `offerVP fires on ${pp(v('offerVP: share of real opportunities that fire'))} of real opportunities `
        + `(${v('offerVP: real opportunities per game').toFixed(2)}/game)`,
      `pickVP favours an actual debtor ${pp(v('pickVP: share of picks that favour an actual debtor'))} of the time `
        + `it has a choice (${v('pickVP: offers considered per game').toFixed(2)} offers considered/game)`,
      v('offerVP: real opportunities per game') > 0 && v('offerVP: share of real opportunities that fire') > 0
        ? 'both halves of the mechanism fire at least occasionally -- the ledger is not permanently empty, it is just rarely imbalanced at the exact moment a nomination happens'
        : 'the mechanism did not fire at all in this sample -- worth re-checking the ledger direction before trusting the unit tests alone',
    ].join('; ');
  },
};
