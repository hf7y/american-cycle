/** Rule-coverage assertion — hf7y/american-cycle#31.
 *
 *  Five rules have been found firing at 0% because of a missing clause
 *  upstream — impeachment, the veto, card text, §12's bill counters, odd-year
 *  governors — and every one was found by hand, after the fact, by someone
 *  who happened to look. Nothing asserted a rule fires. This does.
 *
 *  Nothing new to plumb: every rule below is read off `GameResult.events`
 *  (`sides[].modifiers[].source` already names what priced a race) or
 *  `Game.log` (already a line per governance action). `fillVacancy` — the
 *  governor's Senate appointment — already pushes a log line
 *  (`the governor of ${state} appoints ${name} to the Senate`), so the one
 *  blocker this issue named is not a blocker any more; it just had nothing
 *  reading it.
 *
 *  Odd-year governors (hf7y/american-cycle#23) and a few other rules the
 *  issue names are not in this inventory: they are not built yet, so there
 *  is no firing condition to name. A rule the engine cannot execute is not
 *  this tool's concern; a rule that CAN execute and never does is.
 *
 *  Two more computed values reach the map with no log line at all — the
 *  passed-bill lean counter (#78's `billLeanPips`) and impeachment's backfire
 *  push (`impeachBackfirePips`) — so they cannot be named here without first
 *  giving them one, the same gap this issue closed for `fillVacancy`. Named
 *  in this comment rather than silently dropped.
 *
 *  Only `Impeacher` and `VPBackstab` implement `moveImpeach`, `voteImpeach`
 *  and `offerVP` (#30), so the pool below is not "the field" any findings
 *  predicate should use — it is deliberately every agent capable of moving a
 *  rule this tool checks, at a six-seat table nobody would actually play, on
 *  purpose. A rule average players never reach is "unreachable in practice"
 *  (#30's question); this tool asks the prior question, "can it fire at all."
 *
 *  node sim/coverage.ts [games-per-config] [config1.json,config2.json,...]
 */
import { readFileSync } from 'node:fs';
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { AGENTS } from './agents.ts';
import { Game, type Config, type GameResult } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';

const POOL = [
  'Impeacher', 'VPBackstab', 'BillMaximizer', 'BillAuthor', 'SenateFlood',
  'HouseFarm', 'HeterodoxSpecialist', 'WideAndEmpty', 'EconomyChicken',
  'Launchpad', 'Greedy', 'Lookahead',
];
const TABLE_SIZE = 6;

function loadCfg(arg: string): Config {
  if (arg.startsWith('/') || arg.startsWith('.')) return JSON.parse(readFileSync(arg, 'utf8')) as Config;
  return loadConfig(arg);
}

// Modifier sources the engine names itself. Anything else appearing in
// `modifiers[].source` is a card's own printed effect text (`CardEffect.note`)
// reaching `buildModifiers`'s `conditional` branch — i.e. "card text" firing —
// so it does not need a name of its own to be counted as covered.
const ENGINE_SOURCES = new Set([
  'state lean', 'home state', 'party fit', 'incumbency', 'endorsements',
  'extremist (primary)', 'extremist (general)', 'bill record', 'shock',
  'midterm', 'economy', 'coattails',
]);
const enginePrefixed = (s: string): boolean =>
  s.startsWith('identity: ') || s.endsWith(' stepping up')
  || s.startsWith('cross-benched') || s.startsWith('off-position votes') || s.startsWith('VP ');

interface Rule { id: string; note: string; hit(r: GameResult, log: readonly string[]): number }

const modifiers = (r: GameResult) => r.events.flatMap((e) => e.sides.flatMap((s) => s.modifiers));
const bySource = (pred: (s: string) => boolean) =>
  (r: GameResult): number => modifiers(r).filter((m) => pred(m.source)).length;
const byLog = (...needles: string[]) =>
  (_r: GameResult, log: readonly string[]): number => log.filter((l) => needles.every((n) => l.includes(n))).length;

const RULES: Rule[] = [
  // ---- election modifiers (buildModifiers, engine/rules/elections.ts) ----
  { id: 'state-lean', note: 'the map lean applies to a race', hit: bySource((s) => s === 'state lean') },
  { id: 'home-state-bonus', note: "a candidate's printed home-state bonus", hit: bySource((s) => s === 'home state') },
  { id: 'identity-bonus', note: 'a candidate identity matches district demographics', hit: bySource((s) => s.startsWith('identity: ')) },
  { id: 'party-fit', note: 'distance from the party tag centroid', hit: bySource((s) => s === 'party fit') },
  { id: 'incumbency', note: 'an incumbent runs again', hit: bySource((s) => s === 'incumbency') },
  { id: 'cross-office-stepping-up', note: 'a seat-holder runs for a different office', hit: bySource((s) => s.endsWith(' stepping up')) },
  { id: 'endorsements', note: 'a primary endorsement prices a race', hit: bySource((s) => s === 'endorsements') },
  { id: 'extremist-primary', note: "a card's printed extremist tag, in a primary", hit: bySource((s) => s === 'extremist (primary)') },
  { id: 'extremist-general', note: "a card's printed extremist tag, in a general", hit: bySource((s) => s === 'extremist (general)') },
  { id: 'cross-benched-penalty', note: 'a primary prices a cross-bench voting record', hit: bySource((s) => s.startsWith('cross-benched')) },
  { id: 'bill-record-counter', note: "§12's bill-record counter reaches a primary", hit: bySource((s) => s === 'bill record') },
  { id: 'off-position-votes', note: 'a general prices an off-district yes-vote', hit: bySource((s) => s.startsWith('off-position votes')) },
  { id: 'shock-modifier', note: 'the cheap shock reaches an incumbent race', hit: bySource((s) => s === 'shock') },
  { id: 'midterm-penalty', note: "the president's party takes the midterm penalty", hit: bySource((s) => s === 'midterm') },
  { id: 'economy-modifier', note: 'the economy reaches a race', hit: bySource((s) => s === 'economy') },
  { id: 'coattails', note: 'presidential coattails reach a down-ballot race', hit: bySource((s) => s === 'coattails') },
  { id: 'vp-homestate-bonus', note: "the VP's home-state bonus prices the general", hit: bySource((s) => s.startsWith('VP ')) },
  { id: 'card-text-effect', note: "a card's printed conditional effect (CardEffect.note) fires", hit: bySource((s) => !ENGINE_SOURCES.has(s) && !enginePrefixed(s)) },

  // ---- structural race outcomes ----
  { id: 'uncontested-race', note: 'a race draws only one side', hit: (r) => r.events.filter((e) => e.uncontested).length },
  { id: 'upset', note: 'the dice reverse the modifier favourite', hit: (r) => r.events.filter((e) => e.upset).length },

  // ---- legislature (engine/rules/legislature.ts) ----
  { id: 'bill-passed', note: 'an omnibill passes', hit: byLog('omnibill G', ' passed ') },
  { id: 'the-veto', note: 'the president vetoes a passed bill', hit: byLog('omnibill G', ' vetoed') },
  { id: 'bill-failed', note: 'an omnibill fails without a veto', hit: byLog('omnibill G', ' failed') },
  { id: 'bill-repealed', note: 'a repeal bill passes', hit: byLog(' repealed,') },
  { id: 'shutdown', note: 'the omnibill fails and blame is assigned', hit: byLog('the shutdown is blamed on') },
  {
    id: 'legislative-cross-bench-vote', note: 'a member votes off their own party position',
    hit: (r) => (r.crossBenchVotes > 0 ? r.crossBenchVotes : 0),
  },

  // ---- impeachment and succession ----
  { id: 'impeachment-fails', note: 'a mover forces an impeachment vote and it falls short', hit: byLog('impeachment fails,') },
  { id: 'impeachment-succeeds', note: 'a president is removed', hit: byLog('the president is removed,') },
  { id: 'vp-succession', note: 'a VP succeeds a removed president', hit: byLog('succeeds to the presidency') },

  // ---- the amendment (engine/rules/amendment.ts) ----
  { id: 'convention-called', note: 'two-thirds of the states call a convention', hit: byLog('a convention is called on') },
  { id: 'convention-call-fails', note: 'a called convention falls short of two-thirds', hit: byLog('the convention call fails,') },
  { id: 'amendment-ratified', note: 'three-quarters of the states ratify', hit: byLog('is ratified by') },
  { id: 'amendment-failed', note: 'an amendment fails to reach ratification', hit: byLog('the amendment fails at') },

  // ---- executive and misc ----
  { id: 'presidential-election', note: 'a presidential general resolves', hit: byLog('wins with', 'electoral votes') },
  { id: 'governor-fills-vacancy', note: "a governor appoints a Senate vacancy (fillVacancy, this issue's blocker)", hit: byLog('appoints ', 'to the Senate') },
  { id: 'fed-tightens', note: 'the Fed raises rates', hit: byLog('the Fed tightens') },
  { id: 'shock-hits-incumbents', note: 'the cheap shock fires for the year', hit: byLog('a shock hits the incumbents') },
];

// `moveImpeach`/`voteImpeach`/`offerVP` are implemented ONLY by these two
// (#30) — leaving them to a random draw from POOL means most games seat
// neither, and impeachment/VP succession need hundreds of games to appear
// even once. Seating both every game is what makes a small, fast N a
// coverage check rather than a rare-event search.
const ALWAYS_SEATED = ['Impeacher', 'VPBackstab'];

/** Fisher-Yates on a small xorshift-ish LCG keyed by the game seed, so the
 *  table composition is reproducible without pulling from the same RNG the
 *  agents play with (which would make every game's table a function of the
 *  cards dealt in game 0). */
function tableFor(seed: number): string[] {
  const rest = POOL.filter((n) => !ALWAYS_SEATED.includes(n));
  let x = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = rest.length - 1; i > 0; i--) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const j = x % (i + 1);
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...ALWAYS_SEATED, ...rest.slice(0, TABLE_SIZE - ALWAYS_SEATED.length)];
}

function playOneTracked(cfg: Config, seed: number): { r: GameResult; log: readonly string[] } {
  const cards = loadPacks(ALL_PACKS);
  const rng = new RNG(seed);
  const order = tableFor(seed);
  const agents = order.map((n) => new AGENTS[n](cfg, rng));
  const g = new Game(agents, cards, cfg, seed);
  const r = g.run();
  r.seed = seed;
  return { r, log: g.log };
}

function main(): void {
  const games = Number(process.argv[2] ?? 120);
  const configArg = process.argv[3];
  const configs = configArg ? configArg.split(',') : ['as-written-plus.json', 'tuned.json'];

  const counts = new Map<string, number>(RULES.map((rr) => [rr.id, 0]));
  let played = 0;

  for (const path of configs) {
    const cfg = loadCfg(path);
    for (let i = 0; i < games; i++) {
      const seed = 8100000 + i;
      const { r, log } = playOneTracked(cfg, seed);
      played++;
      for (const rule of RULES) counts.set(rule.id, counts.get(rule.id)! + rule.hit(r, log));
    }
  }

  console.log(`# rule coverage — ${played} games, pool [${POOL.join(', ')}], table size ${TABLE_SIZE}\n`);
  console.log('rule'.padEnd(28) + 'fires'.padStart(8) + '  what it means to fire');
  let dead = 0;
  for (const rule of RULES) {
    const n = counts.get(rule.id)!;
    if (n === 0) dead++;
    console.log(`${(n === 0 ? '✗ ' : '  ') + rule.id}`.padEnd(28) + String(n).padStart(8) + `  ${rule.note}`);
  }

  if (dead) {
    console.log(`\n${dead} of ${RULES.length} named rules fired ZERO times across ${played} games.`);
    process.exit(1);
  }
  console.log(`\nall ${RULES.length} named rules fired at least once.`);
}

if (import.meta.filename === process.argv[1]) main();
