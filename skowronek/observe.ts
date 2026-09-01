/** Per-year observation of a game, without touching the engine.
 *
 *  `GameResult` keeps `finalLean` and `scoreHistory` and nothing else per year,
 *  so a settlement's HISTORY — the only thing that can show a settlement is
 *  durable — cannot be read from a finished result. It does not have to be:
 *  `Game.tick()`, `seats`, `leanMap`, `economy`, `president` and `stats` are
 *  all public, so this drives its own year loop and snapshots after each tick.
 *  No engine change, no recording added, no behaviour altered.
 *
 *  ONE DIFFERENCE FROM `Game.run()`, stated because it is a real one:
 *  `victor()` is private, so this loop stops on maxYears or deck-out and not on
 *  a victory condition. For the eight configs with `victory: "points"` that is
 *  exactly equivalent — `victor()` never fires for them. `three-terms.json` is
 *  the exception and its runs may extend past the year a victory would have
 *  ended them; `RunObs.stoppedBy` records which rule stopped each run.
 */
import { Game, isBillYear, isElectionYear, type Config, type GameResult } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import type { Lean } from '../engine/rules/lean.ts';
import type { Card, Office, Party, Seat } from '../engine/types/index.ts';
import { AGENTS } from '../sim/agents.ts';
import { COMPASS, centroid, type Board, type Position } from './position.ts';

/** Offices held by one player in one year, as counts and as shares of the
 *  seats actually held at the table (§7: majorities are over HELD seats). */
export interface PowerParts {
  president: number;   // 0 or 1
  senateShare: number;
  houseShare: number;
  govShare: number;
}

/** The power scalar is the unweighted mean of the four components, and is
 *  reported decomposed so the weighting can be second-guessed without re-running.
 *  `withoutPresident` is the mean of the other three — era check 5. */
export const powerScalar = (p: PowerParts): number =>
  (p.president + p.senateShare + p.houseShare + p.govShare) / 4;
export const powerWithoutPresident = (p: PowerParts): number =>
  (p.senateShare + p.houseShare + p.govShare) / 3;

export interface YearObs {
  year: number;
  /** §7's two year-gates, read from the engine's own exported predicates so
   *  they cannot drift from the rules that actually ran (#29, #48). */
  isElection: boolean;
  isBill: boolean;
  lean: Lean;
  /** seat-weighted centroid of state lean — the polity, per the compass */
  country?: Position;
  /** centroid of each player's seated politicians */
  playerPos: (Position | undefined)[];
  parts: PowerParts[];
  power: number[];
  powerNoPres: number[];
  presidentPlayer?: number;
  presidentParty?: Party;
  /** cumulative; per-year passage is the first difference */
  billsPassedCum: number;
  billsAttemptedCum: number;
  economyLevel: number;
  accumulatedG: number;
}

export interface RunObs {
  config: string;
  seed: number;
  agents: string[];
  years: YearObs[];
  stoppedBy: 'maxYears' | 'deckOut';
  result: GameResult;
}

const shareOf = (seats: Seat[], office: Office, player: number): number => {
  const held = seats.filter((s) => s.office === office && s.holder);
  if (!held.length) return 0;
  return held.filter((s) => s.holder!.player === player).length / held.length;
};

/** `played` is the year whose events just ran. `Game.tick()` processes
 *  `this.year` and increments at the END (engine/game.ts), so after the call
 *  `g.year` is already the NEXT year — labelling a snapshot with it puts every
 *  election year's pushes under the following odd year and inverts every
 *  year-gated measurement taken from this series. */
function observeYear(g: Game, nPlayers: number, cfg: Config, played: number): YearObs {
  const board: Board = { lean: g.leanMap, year: played };
  const pres = g.seats.find((s) => s.office === 'president' && s.holder);

  const parts: PowerParts[] = [];
  const playerPos: (Position | undefined)[] = [];
  for (let p = 0; p < nPlayers; p++) {
    parts.push({
      president: pres?.holder?.player === p ? 1 : 0,
      senateShare: shareOf(g.seats, 'senator', p),
      houseShare: shareOf(g.seats, 'representative', p),
      govShare: shareOf(g.seats, 'governor', p),
    });
    const mine = g.seats.filter((s) => s.holder?.player === p);
    const pts = mine.map((s) => COMPASS.politician(s, board)).filter((x): x is Position => !!x);
    playerPos.push(centroid(pts));
  }

  return {
    year: played,
    isElection: isElectionYear(cfg, played),
    isBill: isBillYear(cfg, played),
    lean: { ...g.leanMap },
    country: COMPASS.country(board),
    playerPos,
    parts,
    power: parts.map(powerScalar),
    powerNoPres: parts.map(powerWithoutPresident),
    presidentPlayer: pres?.holder?.player,
    presidentParty: pres?.holder?.party,
    billsPassedCum: g.stats.billsPassed,
    billsAttemptedCum: g.stats.billsAttempted,
    economyLevel: g.economy.level,
    accumulatedG: g.economy.accumulatedG,
  };
}

export function observeRun(agentNames: string[], cards: Card[], cfg: Config, seed: number): RunObs {
  const rng = new RNG(seed);
  const agents = agentNames.map((n) => {
    const C = AGENTS[n];
    if (!C) throw new Error(`unknown agent: ${n}`);
    return new C(cfg, rng);
  });
  const g = new Game(agents, cards, cfg, seed);
  const end = cfg.game.startYear + cfg.game.maxYears;
  const years: YearObs[] = [];
  let stoppedBy: 'maxYears' | 'deckOut' = 'maxYears';

  while (g.year < end) {
    const played = g.year;
    g.tick();
    years.push(observeYear(g, agentNames.length, cfg, played));
    if (cfg.game.deckOutEnds && !g.talon.length && !g.discard.length && !g.eraQueue.length) {
      stoppedBy = 'deckOut';
      break;
    }
  }

  const result = g.result();
  result.seed = seed;
  return { config: cfg.name, seed, agents: agentNames, years, stoppedBy, result };
}
