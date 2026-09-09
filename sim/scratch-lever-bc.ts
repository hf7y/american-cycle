// Scratch probe for hf7y/american-cycle#105 levers B and C, the two levers
// left after #206 measured lever A (pushKeyedOn:'surprise') alone as
// insufficient. Same shape as scratch-lever-a.ts: not wired into anything,
// not committed as a finding, seeds/config/agents held identical across arms
// so only the lever under test differs.
import { loadConfig, loadPacks, playOne, ALL_PACKS } from './harness.ts';
import { AGENTS } from './agents.ts';
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { eligible } from '../engine/rules/elections.ts';
import type { Config, Agent, GameView, OpenRace, PendingPeg } from '../engine/game.ts';
import type { Declaration } from '../engine/rules/elections.ts';

type LeverFlags = { pushKeyedOn?: 'surprise'; generalLoserReturns?: boolean; contestCapture?: boolean };

function cfgFor(flags: LeverFlags): Config {
  const base = loadConfig('tuned.json');
  return {
    ...base,
    game: { ...base.game, startYear: 1932, generalLoserReturns: flags.generalLoserReturns, contestCapture: flags.contestCapture },
    lean: { ...base.lean, ...(flags.pushKeyedOn ? { pushKeyedOn: flags.pushKeyedOn } : {}) },
  } as Config;
}

function run(flags: LeverFlags, seeds: number) {
  const cfg = cfgFor(flags);
  const cards = loadPacks(ALL_PACKS);
  let generals = 0, walkovers = 0, safe40 = 0, contestedShareSum = 0;
  for (let i = 0; i < seeds; i++) {
    const r = playOne(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg as never, 2040000 + i);
    contestedShareSum += r.contestedSlotShare;
    for (const e of r.events) {
      if (e.office !== 'representative' || e.round !== 'general') continue;
      generals++;
      if (e.uncontested) { walkovers++; continue; }
      if (2 * Math.abs(e.margin) >= 40) safe40++;
    }
  }
  return {
    generals,
    walkoverShare: (100 * walkovers) / generals,
    contestedShare: (100 * (generals - walkovers)) / generals,
    safe40Share: (100 * safe40) / generals,
    contestedSlotShare: contestedShareSum / seeds,
  };
}

/** hf7y/american-cycle#105 acceptance item 3: report the interaction of
 *  levers B/C with hf7y/american-cycle#77's decision-density figure. #77
 *  instrumented four quantities per `declare()` call -- open races per
 *  cycle, races legal for one player, candidate cards in hand, and actually
 *  declared -- and found "every player declares down to the last card they
 *  hold" (candidate cards in hand == actually declared). B and C don't touch
 *  the hand cap or draft, so the question is whether making House races
 *  *worth entering when you expect to lose* (B: the loser's card returns to
 *  hand instead of being discarded; C: a losing nominee still gets a
 *  capture() attempt) changes how many of a player's declarations land on
 *  the House specifically, without changing the size of the budget itself.
 *
 *  Instrumented the way #77 and sim/scratch-106-district-changes.ts both do
 *  it: wrap `declare()` so the count is taken from what the engine itself
 *  offers and what the agent itself returns, not a re-derivation. */
function declareStats(flags: LeverFlags, seeds: number) {
  const cfg = cfgFor(flags);
  const cards = loadPacks(ALL_PACKS);
  const NAMES = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];

  let openHouseSum = 0, legalHouseSum = 0, handCandidatesSum = 0, declaredHouseSum = 0, declaredAllSum = 0, calls = 0;

  function instrumented(a: Agent): Agent {
    return new Proxy(a, {
      get(t, p) {
        if (p === 'declare') {
          return (v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] => {
            const me = v.players[v.me];
            const house = open.filter((r) => r.office === 'representative');
            const gate = cfg.game.districtLevelEligibility;
            const legal = house.filter((r) => {
              const slot = gate ? r.slot : undefined;
              return me.hand.some((c) => c.kind === 'candidate' && eligible(c, r.state, me.districts, slot));
            });
            openHouseSum += house.length;
            legalHouseSum += legal.length;
            handCandidatesSum += me.hand.filter((c) => c.kind === 'candidate').length;
            calls++;
            const mine = a.declare(v, open, pending);
            declaredHouseSum += mine.filter((d) => d.office === 'representative').length;
            declaredAllSum += mine.length;
            return mine;
          };
        }
        return (t as never)[p];
      },
    });
  }

  for (let i = 0; i < seeds; i++) {
    const seed = 2040000 + i;
    const rng = new RNG(seed);
    const agents = NAMES.map((n) => instrumented(new AGENTS[n](cfg, rng)));
    new Game(agents, cards, cfg, seed).run();
  }

  return {
    // #77's own quantities, House-scoped since B/C are House-only levers.
    openRacesPerCycle: openHouseSum / calls,
    racesLegalPerPlayer: legalHouseSum / calls,
    candidateCardsInHand: handCandidatesSum / calls,
    actuallyDeclaredHouse: declaredHouseSum / calls,
    // all-office total, to check #77/#90's "declares down to the last card"
    // claim (candidateCardsInHand == actuallyDeclaredAll) still holds --
    // i.e. whether B/C exhaust the budget on House races that would
    // otherwise have gone to other offices, or just relabel a walkover.
    actuallyDeclaredAll: declaredAllSum / calls,
  };
}

const seeds = Number(process.argv[2] ?? 60);
const arms: Record<string, LeverFlags> = {
  'baseline (all levers off)': {},
  'A alone (pushKeyedOn: surprise)': { pushKeyedOn: 'surprise' },
  'B alone (generalLoserReturns)': { generalLoserReturns: true },
  'C alone (contestCapture)': { contestCapture: true },
  'B+C': { generalLoserReturns: true, contestCapture: true },
  'A+B+C': { pushKeyedOn: 'surprise', generalLoserReturns: true, contestCapture: true },
};
for (const [name, flags] of Object.entries(arms)) {
  console.log(name.padEnd(32), run(flags, seeds));
}

console.log('\n#105 acceptance item 3 -- interaction with #77\'s decision-density figure');
console.log('(same seeds/config/arms as the table above -- ALL_PACKS, startYear 1932 --');
console.log(' so #77\'s own absolute figures, taken on BALANCE_PACKS at the default start');
console.log(' year, are not directly comparable; what matters here is arm vs. arm)\n');
for (const [name, flags] of Object.entries(arms)) {
  console.log(name.padEnd(32), declareStats(flags, seeds));
}
