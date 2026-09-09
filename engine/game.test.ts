/** The orchestration `victory.test.ts` does not reach: the electoral college,
 *  staggered Senate terms, capture, the coin-flip tie-break, the office hand
 *  bonuses, the appointment that fills a Senate vacancy, and the era-ordered
 *  talon. `victory.test.ts` already owns `victorOf()` itself and the
 *  headless/interactive parity of the ending -- nothing here repeats that.
 *
 *  Where a scenario can be built directly (capture, the tie-break, the hand
 *  bonus, fillVacancy), it is: a scripted `Agent` and a hand-built board beat
 *  a seed search for both clarity and stability. Where the rule only exists
 *  as a property of a real running game (the electoral college's majority
 *  rule, staggered terms actually being staggered), it is checked against a
 *  full simulated game and cross-checked against the oracle in `states.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  Game, type Config, type Agent, type GameView, type OpenRace, type PendingPeg,
} from './game.ts';
import type { Declaration } from './rules/elections.ts';
import { RNG } from './rules/rng.ts';
import { AGENTS } from '../sim/agents.ts';
import { STATES, BY_CODE, senateUp, electors, totalElectors, DC_ELECTORS } from './states.ts';
import type { Card, CandidateCard, DistrictCard } from './types/index.ts';

const loadConfig = (name: string): Config =>
  JSON.parse(readFileSync(new URL(`./config/${name}`, import.meta.url), 'utf8')) as Config;
const loadPack = (era: string): Card[] =>
  JSON.parse(readFileSync(new URL(`../data/pack-${era}.json`, import.meta.url), 'utf8')).cards as Card[];
const CARDS: Card[] = ['1932', '1964', '1976', '1992', '2008', '2016', '2024'].flatMap(loadPack);

const cand = (o: Partial<CandidateCard>): CandidateCard => ({
  id: 'c', name: 'C', party: 'D', homeState: 'ZZ', homeStateBonus: 0,
  identities: [], era: 1976, effects: [], ...o,
});
const dist = (o: Partial<DistrictCard>): DistrictCard => ({
  id: 'ZZ-1', state: 'ZZ', number: 1, era: 1976, demographics: [], ...o,
});

/** A fully scripted `Agent`: declares whatever `declFn` returns and otherwise
 *  never acts. Used where the point under test needs one exact declaration
 *  rather than a heuristic's approximation of one -- capture, the appointment
 *  and the hand bonus all need the SAME race to happen every run, not
 *  whichever race an edge-scoring agent happens to prefer. */
class ScriptedAgent implements Agent {
  name: string;
  private declFn: (v: GameView, open: OpenRace[], pending: PendingPeg[]) => Declaration[];
  private indepFn: boolean;
  constructor(
    name: string, declFn?: (v: GameView, open: OpenRace[], pending: PendingPeg[]) => Declaration[], indepFn = false,
  ) {
    this.name = name; this.declFn = declFn ?? (() => []); this.indepFn = indepFn;
  }
  declare(v: GameView, open: OpenRace[], pending: PendingPeg[]): Declaration[] { return this.declFn(v, open, pending); }
  withdraw(): boolean { return false; }
  declareIndependent(): boolean { return this.indepFn; }
  proposeG(): number { return 3; }
  voteBill(): boolean { return false; }
  veto(): boolean { return false; }
}

// ------------------------------------------------------- the electoral college

/** The general runs 50 independent state races and awards the state's
 *  electors, winner-take-all, to whoever takes it -- so a candidate who
 *  dominates a few huge states can beat one who wins many small ones. That is
 *  the property a national vote-share tally would not have, so it is the one
 *  worth constructing: a per-state card-text bonus (25 pips, since #27
 *  deleted district-card synergy) swamps the largest possible dice swing (two
 *  3d6 sides, at most ~15 pips apart), so who wins which state is decided by
 *  which player we hand the bonus to, not by the dice. */
test('the presidency goes to whoever crosses the electors majority, not whoever carries more states', () => {
  const cfg = loadConfig('as-written-plus.json');
  const year = cfg.game.startYear; // 1976, and a presidential year (1976 % 4 === 0)

  const byElectors = [...STATES].sort((a, b) => electors(b, year) - electors(a, year));
  const fewBigStates: string[] = [];
  let sum = 0;
  for (const s of byElectors) { if (sum >= 270) break; fewBigStates.push(s.code); sum += electors(s, year); }
  const manySmallStates = STATES.map((s) => s.code).filter((c) => !fewBigStates.includes(c));
  // The construction only proves the point if it is actually lopsided both ways.
  assert.ok(fewBigStates.length < manySmallStates.length, 'the big-state bloc must be the smaller number of states');
  assert.ok(sum > totalElectors(year) / 2, 'and still hold the electoral majority');

  const effectsFor = (codes: string[]) =>
    codes.map((state) => ({ type: 'conditional' as const, pips: 25, when: { state }, note: `${state} lock` }));
  const candD = cand({ id: 'many-states', party: 'D', effects: effectsFor(manySmallStates) });
  const candR = cand({ id: 'few-states', party: 'R', effects: effectsFor(fewBigStates) });

  const agentD = new ScriptedAgent('D', () => [{ player: 0, card: candD, office: 'president', state: 'US' }]);
  const agentR = new ScriptedAgent('R', () => [{ player: 1, card: candR, office: 'president', state: 'US' }]);
  const g = new Game([agentD, agentR], [{ kind: 'candidate', ...candD }, { kind: 'candidate', ...candR }], cfg, 1);
  g.players[0].hand = [{ kind: 'candidate', ...candD }];
  g.players[1].hand = [{ kind: 'candidate', ...candR }];

  g.tick();

  const prez = g.events.filter((e) => e.office === 'president' && e.round === 'general');
  assert.equal(prez.length, 50, 'every state runs a presidential general');
  const wonByD = prez.filter((e) => e.winner === 0).length;
  const wonByR = prez.filter((e) => e.winner === 1).length;
  assert.equal(wonByD, manySmallStates.length, 'the small-state bloc carries every small state');
  assert.equal(wonByR, fewBigStates.length, 'the big-state bloc carries every big state');
  assert.ok(wonByD > wonByR, 'sanity: D really did carry more STATES than R');
  assert.equal(g.president?.player, 1, 'and still loses the presidency to the electoral-vote majority');
  assert.equal(g.termsBy[1], 1, 'the winner’s term counter advances');
});

/** The same claim, read off a real simulated game rather than a constructed
 *  one: sum the electors independently from the per-state events and confirm
 *  it lands on exactly who the engine says won, and that the 50 states plus
 *  DC add up to the real 538. */
test('a simulated presidential general’s electors sum to the real total and pick the real winner', () => {
  const cfg = loadConfig('as-written-plus.json');
  // #40/#27 changed what agents value a House declaration at, which reorders
  // the RNG draws downstream -- seed 3 no longer reaches a contested
  // presidential race under the new modifier stack. Re-stamped to seed 1.
  const rng = new RNG(1);
  const agents: Agent[] = ['Greedy', 'BillAuthor', 'Random'].map((n) => new AGENTS[n](cfg, rng));
  const g = new Game(agents, structuredClone(CARDS), cfg, 1);
  g.tick();

  const prez = g.events.filter((e) => e.office === 'president' && e.round === 'general');
  assert.ok(prez.length > 0, 'seed 1 is stamped to produce a contested presidential race');
  const evByPlayer = new Map<number, number>();
  for (const e of prez) {
    const ev = electors(BY_CODE[e.state], cfg.game.startYear) + (e.state === 'MD' ? DC_ELECTORS : 0);
    evByPlayer.set(e.winner, (evByPlayer.get(e.winner) ?? 0) + ev);
  }
  const total = [...evByPlayer.values()].reduce((n, x) => n + x, 0);
  assert.equal(total, totalElectors(cfg.game.startYear), '50 states + DC, winner-take-all, sum to 538');
  const [bestPlayer] = [...evByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
  assert.equal(g.president?.player, bestPlayer, 'the seated president is the electors argmax, independently recomputed');
});

// ------------------------------------------------------------ staggered terms

test('senateUp never puts a state’s two classes up in the same year', () => {
  // The oracle itself, not the engine: SENATE_CLASS_YEAR has the two classes
  // two years apart mod 6, so this can never coincide by construction -- but
  // it is cheap to assert directly rather than trust the arithmetic in prose.
  for (const s of STATES) {
    for (let year = 2016; year <= 2032; year += 2) {
      const up = senateUp(s, year);
      assert.ok(up.length <= 1, `${s.code} ${year}: both classes up together (${up.join(',')})`);
    }
  }
});

const senateFloodRun = (seed: number, years: number) => {
  const cfg = loadConfig('as-written-plus.json');
  const rng = new RNG(seed);
  const agents: Agent[] = ['SenateFlood', 'SenateFlood'].map((n) => new AGENTS[n](cfg, rng));
  const g = new Game(agents, structuredClone(CARDS), cfg, seed);
  for (let i = 0; i < years; i++) g.tick();
  return g.events.filter((e) => e.office === 'senator');
};

test('openRaces only opens the Senate class actually up that year', () => {
  const sen = senateFloodRun(555, 14);
  assert.ok(sen.length > 20, 'SenateFlood agents over 14 years should generate a real sample, not a fluke');
  for (const e of sen) {
    assert.ok(senateUp(BY_CODE[e.state], e.year).includes(e.slot as 1 | 2 | 3),
      `${e.state} ${e.year} class ${e.slot}: not a class senateUp says is up`);
  }
});

test('a state’s two Senate classes come up in different years, staggered rather than together', () => {
  const sen = senateFloodRun(555, 14);
  const yearsByState = new Map<string, Set<number>>();
  for (const e of sen) {
    if (!yearsByState.has(e.state)) yearsByState.set(e.state, new Set());
    yearsByState.get(e.state)!.add(e.year);
  }
  const staggered = [...yearsByState.entries()].filter(([, years]) => years.size > 1);
  assert.ok(staggered.length > 0,
    'at least one state should show Senate races in more than one year across 14 years of play');
});

// ------------------------------------------------------------------- capture

test('winning a House race captures the underlying district card, by number', () => {
  const cfg = loadConfig('as-written-plus.json');
  const winner = cand({ id: 'winner', party: 'R', homeState: 'OH' });
  const held5 = dist({ id: 'OH-5', state: 'OH', number: 5 });
  const held9 = dist({ id: 'OH-9', state: 'OH', number: 9 });

  const loser = new ScriptedAgent('loser');
  const contender = new ScriptedAgent('contender', (_v, open) => {
    const race = open.find((r) => r.office === 'representative' && r.state === 'OH' && r.slot === 5);
    return race ? [{ player: 1, card: winner, office: 'representative', state: 'OH', slot: 5 }] : [];
  });
  const g = new Game([loser, contender], [{ kind: 'candidate', ...winner }], cfg, 1);
  g.players[0].hand = [];
  // Player 0 holds two districts in OH; only #5 is contested.
  g.players[0].districts = [held5, held9];
  g.players[1].hand = [{ kind: 'candidate', ...winner }];
  g.players[1].districts = [];

  g.tick();

  assert.deepEqual(g.players[1].districts.map((d) => d.id), ['OH-5'], 'the contested district moves to the winner');
  assert.deepEqual(g.players[0].districts.map((d) => d.id), ['OH-9'],
    'and only that one -- OH-9 is untouched, not "some district in the state"');
  const seat = g.seats.find((s) => s.office === 'representative' && s.state === 'OH' && s.slot === 5);
  assert.equal(seat?.holder?.player, 1);
});

/** #95: McCarthy lost New Hampshire 1968 and the strong showing was the
 *  event. Two same-party cards contest one race, so the loser returns to
 *  hand and the winner reaches the general alone -- an unopposed general run
 *  by a nominee who only barely survived their own primary. Seed 2 rolls a
 *  1-pip primary margin, comfortably under `bruisingPrimaryMargin` (3).
 *  hf7y/american-cycle#171's `cycleOffset` fix draws one extra RNG value per
 *  game, which reshuffles which seed lands which margin -- seed 1 (pinned
 *  before that fix) now rolls 3, not 1. */
test('#95: a primary won by a narrow margin carries a bruise into the general', () => {
  const cfg = loadConfig('as-written-plus.json');
  const a1 = cand({ id: 'a1', homeState: 'OH' });
  const a2 = cand({ id: 'a2', homeState: 'OH' });
  const held5 = dist({ id: 'OH-5', state: 'OH', number: 5 });

  const p0 = new ScriptedAgent('p0', (_v, open) => {
    const race = open.find((r) => r.office === 'representative' && r.state === 'OH' && r.slot === 5);
    return race ? [{ player: 0, card: a1, office: 'representative', state: 'OH', slot: 5 }] : [];
  });
  const p1 = new ScriptedAgent('p1', (_v, open) => {
    const race = open.find((r) => r.office === 'representative' && r.state === 'OH' && r.slot === 5);
    return race ? [{ player: 1, card: a2, office: 'representative', state: 'OH', slot: 5 }] : [];
  });
  const g = new Game([p0, p1], [{ kind: 'candidate', ...a1 }, { kind: 'candidate', ...a2 }], cfg, 2);
  g.players[0].hand = [{ kind: 'candidate', ...a1 }];
  g.players[1].hand = [{ kind: 'candidate', ...a2 }];
  g.players[0].districts = [held5];
  g.players[1].districts = [];

  g.tick();

  const primary = g.events.find((e) => e.round === 'primary' && e.office === 'representative' && e.state === 'OH');
  assert.equal(primary?.margin, 1, 'the scenario is pinned to a specific narrow-margin roll');
  const general = g.events.find((e) => e.round === 'general' && e.office === 'representative' && e.state === 'OH');
  assert.ok(general?.sides[0].modifiers.some((m) => m.source === 'bruising primary'),
    'the nominee who barely survived the primary carries the scar into the general');
});

/** #96: Lieberman 2006 -- a card that loses its own party's primary may
 *  commit, in the same window `withdraw` uses (before any die is drawn), to
 *  run anyway as an independent in the SAME race. Both cards commit here, so
 *  the outcome is deterministic regardless of which one the dice pick: the
 *  primary's winner reaches the general under its printed party, and the
 *  loser reaches it too, relabeled 'I', rather than returning to hand. */
test('#96: a primary loser who committed to run independent appears in the general as an independent, not back in hand', () => {
  const cfg = loadConfig('as-written-plus.json');
  const a1 = cand({ id: 'a1', party: 'D', homeState: 'OH' });
  const a2 = cand({ id: 'a2', party: 'D', homeState: 'OH' });
  const held5 = dist({ id: 'OH-5', state: 'OH', number: 5 });

  const declareOh5 = (player: number, card: CandidateCard) =>
    (_v: GameView, open: OpenRace[]) => {
      const race = open.find((r) => r.office === 'representative' && r.state === 'OH' && r.slot === 5);
      return race ? [{ player, card, office: 'representative' as const, state: 'OH', slot: 5 }] : [];
    };
  const p0 = new ScriptedAgent('p0', declareOh5(0, a1), true);
  const p1 = new ScriptedAgent('p1', declareOh5(1, a2), true);
  // A real-size deck, not just the two named cards: refill() recycles the
  // discard into the talon once it runs dry, and a two-card deck would deal
  // a1 straight back into a hand within the SAME tick, confusing "returned
  // to hand by refill" with "returned to hand instead of going independent".
  const g = new Game([p0, p1], [...structuredClone(CARDS), { kind: 'candidate', ...a1 }, { kind: 'candidate', ...a2 }], cfg, 1);
  g.players[0].hand = [{ kind: 'candidate', ...a1 }];
  g.players[1].hand = [{ kind: 'candidate', ...a2 }];
  g.players[0].districts = [held5]; // a House race only opens where a district card is in play
  g.players[1].districts = [];

  g.tick();

  const primary = g.events.find((e) => e.round === 'primary' && e.office === 'representative' && e.state === 'OH');
  assert.ok(primary, 'the primary actually ran, contested by both cards');
  const loserId = primary!.sides.find((s) => s.player !== primary!.winner)!.cardId;
  const winnerId = primary!.sides.find((s) => s.player === primary!.winner)!.cardId;

  const general = g.events.find((e) => e.round === 'general' && e.office === 'representative' && e.state === 'OH');
  assert.ok(general, 'the loser stood, so the general ran rather than going uncontested');
  assert.equal(general!.sides.length, 2, 'both the primary winner and the committed loser reach the general');
  const loserSide = general!.sides.find((s) => s.cardId === loserId);
  assert.equal(loserSide?.party, 'I', 'the primary loser runs relabeled independent, not under the party it lost');
  const winnerSide = general!.sides.find((s) => s.cardId === winnerId);
  assert.equal(winnerSide?.party, 'D', 'the primary winner keeps its printed party');

  const bothHands = [...g.players[0].hand, ...g.players[1].hand].map((c) => c.id);
  assert.ok(!bothHands.includes(loserId), 'the committed loser did not return to hand -- it is on the board instead');
});

test('capture is a no-op when nobody else holds the contested district', () => {
  const cfg = loadConfig('as-written-plus.json');
  const incumbent = cand({ id: 'incumbent', party: 'R', homeState: 'OH' });
  const held5 = dist({ id: 'OH-5', state: 'OH', number: 5 });

  const bystander = new ScriptedAgent('bystander');
  const runner = new ScriptedAgent('runner', (_v, open) => {
    const race = open.find((r) => r.office === 'representative' && r.state === 'OH' && r.slot === 5);
    return race ? [{ player: 1, card: incumbent, office: 'representative', state: 'OH', slot: 5 }] : [];
  });
  const g = new Game([bystander, runner], [{ kind: 'candidate', ...incumbent }], cfg, 1);
  g.players[0].hand = []; g.players[0].districts = [];
  g.players[1].hand = [{ kind: 'candidate', ...incumbent }];
  g.players[1].districts = [held5]; // the winner already holds the only copy

  assert.doesNotThrow(() => g.tick());
  assert.deepEqual(g.players[1].districts.map((d) => d.id), ['OH-5'], 'their own copy simply stays put');
});

// -------------------------------------------------------------- the tie-break

const buildTiedGame = (seed: number): Game => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.game.victory = 'points'; // names no ending, so wonBy stays undefined and result() must break the tie
  const agents: Agent[] = [new ScriptedAgent('a'), new ScriptedAgent('b'), new ScriptedAgent('c')];
  const g = new Game(agents, structuredClone(loadPack('1976')), cfg, seed);
  g.players.forEach((p) => { p.score = 100; }); // a dead-even three-way tie
  return g;
};

test('a tied final score resolves to one of the tied players, not a crash or a fixed seat', () => {
  const g = buildTiedGame(1);
  const r = g.result();
  assert.equal(g.wonBy, undefined, '\'points\' names no ending -- the tie-break is what has to decide this');
  assert.ok([0, 1, 2].includes(r.winner), 'the winner is one of the three equally-scored players');
});

test('the tie-break is deterministic for a given seed', () => {
  const a = buildTiedGame(777).result().winner;
  const b = buildTiedGame(777).result().winner;
  assert.equal(a, b, 'the same seed must break the same tie the same way');
});

test('the tie-break is not fixed to one seat across different seeds', () => {
  const winners = new Set(Array.from({ length: 20 }, (_, i) => buildTiedGame(i + 1).result().winner));
  assert.ok(winners.size > 1, 'a coin flip that always favours seat 0 is the bias this rule exists to avoid');
});

// -------------------------------------------------------------- hand size

/** Build a single-player game, seed a board of seats directly (bypassing a
 *  real election), clear the hand, and read off how many cards refill()
 *  actually draws for it in one election-year tick. That is `handSize()`'s
 *  entire observable surface. */
const heldAfterOneTick = (seed: (g: Game) => void): number => {
  const cfg = loadConfig('as-written-plus.json');
  const g = new Game([new ScriptedAgent('solo')], structuredClone(CARDS), cfg, 1);
  seed(g);
  g.players[0].hand = [];
  g.players[0].districts = [];
  g.tick();
  return g.players[0].hand.length + g.players[0].districts.length;
};

test('the office hand bonus fires once an office is held', () => {
  const cfg = loadConfig('as-written-plus.json');
  const baseline = heldAfterOneTick(() => {});
  const withSenator = heldAfterOneTick((g) => {
    g.seats = [{ office: 'senator', state: 'OH', slot: 2, senateClass: 2,
                 holder: { cardId: 's1', player: 0, party: 'D', since: 1970 } }];
  });
  assert.equal(baseline, cfg.hand.base, 'no office held, no bonus');
  assert.equal(withSenator, cfg.hand.base + cfg.hand.bonusSenator, 'one Senate seat, one bonus');
});

test('holding two seats of the same office does not double the hand bonus', () => {
  const cfg = loadConfig('as-written-plus.json');
  const withTwoSenators = heldAfterOneTick((g) => {
    g.seats = [
      { office: 'senator', state: 'OH', slot: 2, senateClass: 2,
        holder: { cardId: 's1', player: 0, party: 'D', since: 1970 } },
      { office: 'senator', state: 'CA', slot: 2, senateClass: 2,
        holder: { cardId: 's2', player: 0, party: 'D', since: 1970 } },
    ];
  });
  assert.equal(withTwoSenators, cfg.hand.base + cfg.hand.bonusSenator,
    'two Senate seats still pay the bonus once -- per office held, not per seat (this is the bug that once ' +
    'collapsed game length from 24 years to 7)');
});

// --------------------------------------------------------------- fillVacancy

test('a Senate seat vacated mid-term is filled by appointment from the state’s governor, not left empty', () => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.game.resignToRun = true;
  const senator = cand({ id: 'sen-x', party: 'D' });
  const spare = cand({ id: 'spare-b', party: 'R' });
  const governor = cand({ id: 'gov-oh', party: 'R', homeState: 'OH' });

  // Resigns the OH Senate seat to run for president -- any race but its own,
  // since `resignToRun` vacates the seat the instant the card declares.
  const climber = new ScriptedAgent('climber',
    () => [{ player: 0, card: senator, office: 'president', state: 'US' }]);
  const bystander = new ScriptedAgent('bystander');

  const g = new Game([climber, bystander],
    [{ kind: 'candidate', ...senator }, { kind: 'candidate', ...spare }, { kind: 'candidate', ...governor }], cfg, 1);
  g.seats = [
    { office: 'senator', state: 'OH', slot: 2, senateClass: 2, holder: { cardId: 'sen-x', player: 0, party: 'D', since: 1970 } },
    { office: 'governor', state: 'OH', holder: { cardId: 'gov-oh', player: 1, party: 'R', since: 1972 } },
  ];
  g.players[0].hand = [];
  g.players[0].districts = [];
  g.players[1].hand = [{ kind: 'candidate', ...spare }];
  g.players[1].districts = [];

  g.tick();

  const senate = g.seats.find((s) => s.office === 'senator' && s.state === 'OH');
  assert.equal(senate?.holder?.cardId, 'spare-b', 'the governor’s spare card fills the vacancy');
  assert.equal(senate?.holder?.player, 1, 'and it seats under the GOVERNOR’s player, an appointment, not an election');
  assert.ok(!g.players[1].hand.some((c) => c.kind === 'candidate' && c.id === 'spare-b'),
    'the appointed card leaves the governor’s hand');
});

// --------------------------------------------------- off-cycle succession (#101)

test('a held seat converts party off-cycle when its holder plays the card that succeeds it', () => {
  const cfg = loadConfig('as-written-plus.json');
  // `resignToRun` (on in every shipped config) mirrors EVERY seat holder's
  // card back into hand each election year, by design -- so it would put
  // `succ-r` right back in hand after the swap, for the same reason it does
  // that for any other incumbent, and this test would misread that as a
  // failure to convert. Off, to isolate the conversion itself.
  cfg.game.resignToRun = false;
  const predecessor = cand({ id: 'pred-d', name: 'Pat Predecessor', party: 'D' });
  const successor = cand({ id: 'succ-r', name: 'Sam Successor', party: 'R', succeeds: 'pred-d' });
  const g = new Game([new ScriptedAgent('a'), new ScriptedAgent('b')],
    [{ kind: 'candidate', ...predecessor }, { kind: 'candidate', ...successor }], cfg, 1);
  g.seats = [{ office: 'senator', state: 'OH', slot: 2, senateClass: 2, holder: { cardId: 'pred-d', player: 0, party: 'D', since: 1970 } }];
  g.players[0].hand = [{ kind: 'candidate', ...successor }];
  g.players[0].districts = [];
  g.players[1].hand = [];
  g.players[1].districts = [];

  g.tick();

  const seat = g.seats.find((s) => s.office === 'senator' && s.state === 'OH');
  assert.equal(seat?.holder?.cardId, 'succ-r', 'the successor card is now the holder');
  assert.equal(seat?.holder?.party, 'R', 'the seat’s party follows the successor');
  assert.equal(seat?.holder?.player, 0, 'the same player keeps the seat -- a conversion, not a transfer');
  assert.equal(seat?.holder?.since, 1970, 'ruled no gate: `since` is left untouched, not reset to run as a non-incumbent');
  assert.ok(!g.players[0].hand.some((c) => c.kind === 'candidate' && c.id === 'succ-r'),
    'the successor card leaves hand once played');
  assert.deepEqual(g.successions, [{ year: cfg.game.startYear, office: 'senator', state: 'OH', slot: 2, from: 'D', to: 'R' }],
    'the swap is recorded so a finding can measure it without scraping the log');
});

test('a succession is inert unless the same player holds both the seat and the successor', () => {
  const cfg = loadConfig('as-written-plus.json');
  const predecessor = cand({ id: 'pred-d2', name: 'Pat Predecessor', party: 'D' });
  const successor = cand({ id: 'succ-r2', name: 'Sam Successor', party: 'R', succeeds: 'pred-d2' });
  const g = new Game([new ScriptedAgent('a'), new ScriptedAgent('b')],
    [{ kind: 'candidate', ...predecessor }, { kind: 'candidate', ...successor }], cfg, 1);
  g.seats = [{ office: 'senator', state: 'OH', slot: 2, senateClass: 2, holder: { cardId: 'pred-d2', player: 0, party: 'D', since: 1970 } }];
  g.players[0].hand = [];
  g.players[0].districts = [];
  // The successor card is drawn by the OTHER player -- not the one who holds the seat.
  g.players[1].hand = [{ kind: 'candidate', ...successor }];
  g.players[1].districts = [];

  g.tick();

  const seat = g.seats.find((s) => s.office === 'senator' && s.state === 'OH');
  assert.equal(seat?.holder?.cardId, 'pred-d2', 'no swap: the card the seat would need sits in the wrong hand');
  assert.equal(g.successions.length, 0);
  assert.ok(g.players[1].hand.some((c) => c.kind === 'candidate' && c.id === 'succ-r2'),
    'the card nobody could use for a swap is otherwise an ordinary card -- it stays in hand, playable in a race');
});

// ---------------------------------------------------------- era-ordered talon

test('a hand that stays inside the first era’s pool never draws a later one', () => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.hand = { ...cfg.hand, base: 10, bonusPresident: 0, bonusSenator: 0, bonusGovernor: 0, bonusRepresentative: 0 };
  const pack1976 = loadPack('1976'), pack2008 = loadPack('2008');
  // 3 players x 10 cards = 30, comfortably inside 1976's 114-card pool.
  const agents: Agent[] = [new ScriptedAgent('a'), new ScriptedAgent('b'), new ScriptedAgent('c')];
  const g = new Game(agents, [...pack1976, ...pack2008], cfg, 1);
  const eras = new Set<number>();
  for (const p of g.players) { for (const c of p.hand) eras.add(c.era); for (const d of p.districts) eras.add(d.era); }
  assert.deepEqual([...eras], [1976], 'nothing from 2008 was touched while 1976 still had cards to give');
});

test('once the first era is exhausted, the draft moves into the next one', () => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.hand = { ...cfg.hand, base: 45, bonusPresident: 0, bonusSenator: 0, bonusGovernor: 0, bonusRepresentative: 0 };
  const pack1976 = loadPack('1976'), pack2008 = loadPack('2008');
  // 3 x 45 = 135, more than 1976's 114 cards, so the draft must spill over.
  const agents: Agent[] = [new ScriptedAgent('a'), new ScriptedAgent('b'), new ScriptedAgent('c')];
  const g = new Game(agents, [...pack1976, ...pack2008], cfg, 1);
  const eras = new Set<number>();
  for (const p of g.players) { for (const c of p.hand) eras.add(c.era); for (const d of p.districts) eras.add(d.era); }
  assert.ok(eras.has(2008), '1976 alone could not fill 135 cards, so 2008 had to be reached');
});

// -------------------------------------------------------- #106: redistricting

/** #106 change 4, `districtSupersession`: CA-8 is the issue's own clearest
 *  example of a seat that carries different demographics across eras. Built
 *  synthetically here (real CA-8 cards would need era-1992's own huge pool
 *  drafted around them to force the sequencing) but the shape is exactly
 *  what the pack files carry: same state and number, a later era, different
 *  demographics.
 *
 *  Single player, packSize 1 for a fully deterministic draft order, hand
 *  base 2: era 1976 supplies exactly a district and a candidate, so the
 *  initial draft fills the hand from 1976 alone and era 1992's card is left
 *  untouched in the era queue. Winning the House race empties the candidate's
 *  hand slot in the same tick `refill()` runs, which is what reaches into
 *  1992 and admits the superseding card. */
test('#106: a later-era district card discards the seat\'s earlier one, under the flag', () => {
  const ca8_1976 = dist({ id: 'CA-8-1976', state: 'CA', number: 8, era: 1976, demographics: ['urban', 'black'] });
  const ca8_1992 = dist({ id: 'CA-8-1992', state: 'CA', number: 8, era: 1992, demographics: ['urban', 'catholic'] });
  const filler = cand({ id: 'filler', era: 1976 });

  const declFn = (v: GameView, open: OpenRace[]): Declaration[] => {
    const held = v.players[0].hand.find((c) => c.kind === 'candidate') as CandidateCard | undefined;
    const race = open.find((r) => r.office === 'representative' && r.state === 'CA' && r.slot === 8);
    return held && race ? [{ player: 0, card: held, office: 'representative', state: 'CA', slot: 8 }] : [];
  };
  const agent = new ScriptedAgent('solo', declFn);

  const cfg = loadConfig('as-written-plus.json');
  cfg.hand = { ...cfg.hand, base: 2, bonusPresident: 0, bonusSenator: 0, bonusGovernor: 0, bonusRepresentative: 0 };
  cfg.draft = { ...cfg.draft, packSize: 1 };
  cfg.game = { ...cfg.game, districtSupersession: true };

  const g = new Game([agent], [
    { kind: 'district', ...ca8_1976 }, { kind: 'candidate', ...filler }, { kind: 'district', ...ca8_1992 },
  ], cfg, 1);

  assert.deepEqual(g.players[0].districts.map((d) => d.id), ['CA-8-1976'],
    'the initial draft fills the 2-card hand from 1976 alone; 1992 is untouched');

  g.tick();

  assert.deepEqual(g.players[0].districts.map((d) => d.id), ['CA-8-1992'],
    'winning the race frees the hand slot refill() uses to reach 1992, which supersedes 1976');
  assert.ok(g.discard.some((c) => c.kind === 'district' && c.id === 'CA-8-1976'),
    'the superseded card is discarded, not handed to anyone');
  const seat = g.seats.find((s) => s.office === 'representative' && s.state === 'CA' && s.slot === 8);
  assert.equal(seat?.holder?.player, 0, 'ownership of the SEAT is unaffected -- supersession only replaces the card');
});

test('#106: districtSupersession off (default) leaves an earlier era\'s card in play', () => {
  const ca8_1976 = dist({ id: 'CA-8-1976', state: 'CA', number: 8, era: 1976, demographics: ['urban', 'black'] });
  const ca8_1992 = dist({ id: 'CA-8-1992', state: 'CA', number: 8, era: 1992, demographics: ['urban', 'catholic'] });
  const filler = cand({ id: 'filler', era: 1976 });

  const declFn = (v: GameView, open: OpenRace[]): Declaration[] => {
    const held = v.players[0].hand.find((c) => c.kind === 'candidate') as CandidateCard | undefined;
    const race = open.find((r) => r.office === 'representative' && r.state === 'CA' && r.slot === 8);
    return held && race ? [{ player: 0, card: held, office: 'representative', state: 'CA', slot: 8 }] : [];
  };
  const agent = new ScriptedAgent('solo', declFn);

  const cfg = loadConfig('as-written-plus.json');
  cfg.hand = { ...cfg.hand, base: 2, bonusPresident: 0, bonusSenator: 0, bonusGovernor: 0, bonusRepresentative: 0 };
  cfg.draft = { ...cfg.draft, packSize: 1 };
  // districtSupersession left unset -- the default.

  const g = new Game([agent], [
    { kind: 'district', ...ca8_1976 }, { kind: 'candidate', ...filler }, { kind: 'district', ...ca8_1992 },
  ], cfg, 1);

  g.tick();

  const ids = g.players[0].districts.map((d) => d.id).sort();
  assert.deepEqual(ids, ['CA-8-1976', 'CA-8-1992'], 'off by default, both eras\' cards coexist -- nothing displaces the older one');
});

// -------------------------------------------------------- the shipped configs

/** #32's specific complaint: `three-terms.json` ships a victory condition
 *  nothing verified. Run it for real, headless, to the end. */
test('engine/config/three-terms.json actually ends a game on three-terms, not just the year cap', () => {
  const cfg = loadConfig('three-terms.json');
  // #41 re-cut Goldwater's card, which shifted seed 2's trace to an
  // amendment ending -- a single seed's chaos, not a claim about this
  // config, which still reaches three-terms in 24 of 30 seeds checked.
  const rng = new RNG(1);
  const agents: Agent[] = ['Greedy', 'BillAuthor', 'Random'].map((n) => new AGENTS[n](cfg, rng));
  const g = new Game(agents, structuredClone(CARDS), cfg, 1);
  const result = g.run();
  assert.equal(result.endedBy, 'three-terms');
  assert.equal(result.wonBy, result.winner, 'a victory condition, not a score tie-break, decided this game');
  assert.ok((g.termsBy[result.winner!] ?? 0) >= 3, 'the winner actually holds 3 presidential terms, not fewer');
});

// ------------------------------------------------------------- #78: bills write to the board

/** Votes yes on everything, so the omnibill's passage is a fact about the
 *  fixture rather than a heuristic's guess. */
class BillYesAgent extends ScriptedAgent {
  voteBill(): boolean { return true; }
}

test('#78: a passed bill places a lean counter in every district on the table its tags touch, not just the author’s own', () => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.legislature = { ...cfg.legislature, billLeanPips: 3, tagsPerBill: 1 };
  cfg.amendment = { ...cfg.amendment, enabled: false };

  const author = new BillYesAgent('author');
  const other = new BillYesAgent('other');
  const g = new Game([author, other], structuredClone(CARDS), cfg, 1);
  g.year = 1977; // odd: no election, isolating the bill's push from any electoral one

  g.seats = [
    { office: 'representative', state: 'OH', slot: 1, holder: { cardId: 'h1', player: 0, party: 'R', since: 1976 } },
    { office: 'representative', state: 'OH', slot: 2, holder: { cardId: 'h2', player: 0, party: 'R', since: 1976 } },
    { office: 'senator', state: 'OH', slot: 1, senateClass: 1, holder: { cardId: 's1', player: 0, party: 'R', since: 1976 } },
  ];
  g.players[0].hand = [];
  g.players[0].districts = [dist({ id: 'OH-1', state: 'OH', number: 1, demographics: ['union'] })];
  g.players[1].hand = [];
  // Held by the OTHER player, with no seat in the chamber at all -- proving the
  // channel reads every district on the table, not the author's own coalition.
  g.players[1].districts = [dist({ id: 'ZZ-9', state: 'ZZ', number: 9, demographics: ['union'] })];

  g.tick();

  assert.equal(g.bills.length, 1, 'the bill passed');
  assert.deepEqual(g.bills[0].tags, ['union'], 'carrying the tag the author’s own coalition supplied');
  assert.equal(g.leanMap.OH, 2, 'the author’s own matching district moved (3 pips pushed, 1 decayed the same tick)');
  assert.equal(g.leanMap.ZZ, 2, 'so did the OTHER player’s matching district -- the channel is not author-scoped');
});

test('#78: a bill whose tags touch nothing on the table moves no state', () => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.legislature = { ...cfg.legislature, billLeanPips: 3, tagsPerBill: 1 };
  cfg.amendment = { ...cfg.amendment, enabled: false };

  const author = new BillYesAgent('author');
  const g = new Game([author], structuredClone(CARDS), cfg, 1);
  g.year = 1977;
  g.seats = [
    { office: 'representative', state: 'OH', slot: 1, holder: { cardId: 'h1', player: 0, party: 'R', since: 1976 } },
    { office: 'senator', state: 'OH', slot: 1, senateClass: 1, holder: { cardId: 's1', player: 0, party: 'R', since: 1976 } },
  ];
  g.players[0].hand = [];
  g.players[0].districts = [dist({ id: 'OH-1', state: 'OH', number: 1, demographics: ['union'] })];

  g.tick();

  assert.equal(g.bills.length, 1, 'the bill passed');
  assert.equal(g.leanMap.CA ?? 0, 0, 'a state with no matching district on the table is untouched');
});

test('#78: a second bill on the same tags, passed once the House flips, nets the first one’s counters out -- with no repeal object involved', () => {
  const cfg = loadConfig('as-written-plus.json');
  cfg.legislature = { ...cfg.legislature, billLeanPips: 3, tagsPerBill: 1 };
  cfg.amendment = { ...cfg.amendment, enabled: false };
  // NJ/VA (1977) and KY/LA/MS (1979) have governors up, so with the shipped
  // oddYearGovernors flag this test's hand-staged odd years would trigger a
  // real election tick -- this test is about bill netting, not elections.
  cfg.game = { ...cfg.game, oddYearGovernors: false };

  const r = new BillYesAgent('r'), d = new BillYesAgent('d');
  const g = new Game([r, d], structuredClone(CARDS), cfg, 1);
  g.year = 1977;
  g.seats = [
    { office: 'representative', state: 'OH', slot: 1, holder: { cardId: 'h1', player: 0, party: 'R', since: 1976 } },
    { office: 'representative', state: 'OH', slot: 2, holder: { cardId: 'h2', player: 0, party: 'R', since: 1976 } },
    { office: 'senator', state: 'OH', slot: 1, senateClass: 1, holder: { cardId: 's1', player: 0, party: 'R', since: 1976 } },
  ];
  g.players[0].hand = [];
  g.players[0].districts = [dist({ id: 'OH-1', state: 'OH', number: 1, demographics: ['union'] })];
  g.players[1].hand = [];
  g.players[1].districts = [];

  g.tick(); // 1977, R-controlled: passes, pushes OH toward R
  assert.equal(g.leanMap.OH, 2, 'the first bill’s push, net of the same tick’s decay');

  // The House flips to D. Player 1 needs a district of its own for the
  // default bill-tagger to reach for "union" again -- proposeTags is not
  // scripted here on purpose, so nothing in this test hand-picks the tag.
  g.year = 1979; // odd again: skip the intervening election year entirely
  g.seats = [
    { office: 'representative', state: 'OH', slot: 1, holder: { cardId: 'h3', player: 1, party: 'D', since: 1978 } },
    { office: 'representative', state: 'OH', slot: 2, holder: { cardId: 'h4', player: 1, party: 'D', since: 1978 } },
    { office: 'senator', state: 'OH', slot: 1, senateClass: 1, holder: { cardId: 's2', player: 1, party: 'D', since: 1978 } },
  ];
  g.players[1].districts = [dist({ id: 'TX-1', state: 'TX', number: 1, demographics: ['union'] })];

  g.tick(); // 1979, D-controlled: a second, ordinary bill -- not a repeal

  assert.equal(g.bills.length, 2, 'a second bill passed');
  assert.equal(g.bills[1].tags[0], 'union', 'carrying the same tag as the first, from player 1’s own district');
  assert.equal(g.bills[1].repealedIn, undefined, 'the FIRST bill, not carried here -- this one is not flagged as a repeal at all');
  assert.equal(g.leanMap.OH, 0,
    'OH nets fully back to baseline: the D push (3 pips) overtakes the R remainder (2), then decays -1 toward zero');
  assert.equal(g.leanMap.TX, -2, 'TX has no earlier push to net against, so the same D bill just moves it, ordinarily');
});

// #84's other named arm: strain-scaled impeachment backfire. `backfire` docks
// the convicting senators and pays the acquitted president's party -- flat,
// unless `impeachBackfireStrainScaled` reads the convicting coalition's own
// tag centroid against the country's (every district in play).
class ImpeachTestAgent extends ScriptedAgent {
  private moves: boolean;
  private votes: boolean;
  constructor(name: string, moves: boolean, votes: boolean) { super(name); this.moves = moves; this.votes = votes; }
  moveImpeach(): boolean { return this.moves; }
  voteImpeach(): boolean { return this.votes; }
}

/** One failed conviction, 1 of 3 senators against threshold 2/3 -- always a
 *  backfire, never a removal. Odd year + `oddYearGovernors: false` skips
 *  `elections()` entirely (the #78 tests' own trick), so nothing but
 *  `backfire` can move `leanMap` this tick; biennial decay is also skipped on
 *  an odd year, so the pips land un-netted. */
function failedConviction(strainScaled: boolean | undefined, dSenatorTags: string[], districtTags: string[][]) {
  const cfg = loadConfig('tuned.json');
  cfg.legislature = { ...cfg.legislature, impeachBackfirePips: 6, impeachThreshold: 2 / 3, impeachBackfireStrainScaled: strainScaled };
  cfg.amendment = { ...cfg.amendment, enabled: false };
  cfg.game = { ...cfg.game, oddYearGovernors: false };

  const r = new ImpeachTestAgent('R', false, false), d = new ImpeachTestAgent('D', true, true);
  const g = new Game([r, d], structuredClone(CARDS), cfg, 1);
  g.year = 1977;
  g.president = { player: 0, cardId: 'pres', party: 'R', since: 1976 };
  g.seats = [
    { office: 'senator', state: 'OH', slot: 1, senateClass: 1, holder: { cardId: 'r1', player: 0, party: 'R', since: 1976 } },
    { office: 'senator', state: 'MI', slot: 1, senateClass: 1, holder: { cardId: 'r2', player: 0, party: 'R', since: 1976 } },
    { office: 'senator', state: 'TX', slot: 1, senateClass: 1, holder: { cardId: 'd1', player: 1, party: 'D', since: 1976 } },
  ];
  g.cardById.set('d1', cand({ id: 'd1', party: 'D', identities: dSenatorTags as never }));
  g.players[0].hand = [];
  g.players[1].hand = [];
  g.players[0].districts = districtTags.map((t, i) => dist({ id: `Z-${i}`, state: 'ZZ', number: i, demographics: t as never }));
  g.players[1].districts = [];

  g.tick();
  return g;
}

test('#84: strain scaling off reproduces the flat backfire exactly, whatever the coalition\'s own tags', () => {
  const g = failedConviction(undefined, ['farm'], [['urban']]);
  assert.equal(g.leanMap.TX, 6, 'the lone convicting D senator\'s state docks the full flat pips, unscaled');
  assert.equal(g.leanMap.OH, 6, 'the acquitted president\'s (R) state pays the same flat pips, unscaled');
});

test('#84: strain scaling zeroes the backfire when the coalition mirrors the country', () => {
  const g = failedConviction(true, ['urban'], [['urban']]);
  assert.equal(g.leanMap.TX ?? 0, 0, 'coalition and country are the same tag -- distance 0, so 6*0 rounds to no push at all');
  assert.equal(g.leanMap.OH ?? 0, 0, 'and the same zero scale applies to the target\'s reward side');
});

test('#84: strain scaling pays the full flat pips when the coalition sits in a disjoint tag corner', () => {
  const g = failedConviction(true, ['farm'], [['urban']]);
  assert.equal(g.leanMap.TX, 6, 'urban country vs. a farm-only coalition is maximum set-overlap distance (1) -- 6*1 is the flat pips');
  assert.equal(g.leanMap.OH, 6, 'and the target\'s reward side scales identically');
});

test('#84: strain scaling falls back to the flat pips when neither side has a measurable tag position', () => {
  const g = failedConviction(true, [], []);
  assert.equal(g.leanMap.TX, 6, 'no districts in play and an untagged senator both read as "no position" -- undefined strain must not zero the penalty out');
  assert.equal(g.leanMap.OH, 6, 'the fallback applies to both sides of the backfire alike');
});
