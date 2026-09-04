/** SIM-BRIEF Part 3 and Part 5 measures that need instrumenting rather than
 *  reading off a result: decision density, board load, dead turns, and
 *  swinginess against what the odds table predicts. */
import { loadConfig, loadPacks, BALANCE_PACKS } from './harness.ts';
import { Game, type Config } from '../engine/game.ts';
import { AGENTS, options } from './agents.ts';
import { RNG } from '../engine/rules/rng.ts';
import { oddsAtEdge, primaryOddsAtEdge } from '../engine/rules/resolution.ts';
import type { Card } from '../engine/types/index.ts';

export interface FeelMetrics {
  legal: number[];        // LEGAL MOVES available per player-turn, not choices taken
  tokens: number[];       // pegs + lean counters, simultaneous
  deadTurnShare: number;  // turns with no legal move
  upsets: number; races: number; predicted: number; // swinginess
}

/** Plays `seeds.length` games, sampling board state every even year (the
 *  election years), and returns the raw per-sample arrays -- callers take
 *  whatever quantile or share they need rather than this function guessing
 *  which one matters. */
export function feelMetrics(seeds: number[], agentNames: string[], cards: Card[], cfg: Config): FeelMetrics {
  const legal: number[] = [];
  const tokens: number[] = [];
  let deadTurns = 0, turns = 0;
  let upsets = 0, races = 0, predicted = 0;

  for (const seed of seeds) {
    const rng = new RNG(seed);
    const game = new Game(agentNames.map((n) => new AGENTS[n](cfg, rng)), cards, cfg, seed);
    const end = cfg.game.startYear + cfg.game.maxYears;
    while (game.year < end) {
      if (game.year % 2 === 0) {
        const open = (game as any).openRaces();
        for (let i = 0; i < game.players.length; i++) {
          const v = (game as any).view(i);
          const opts = options(v, open, cfg);
          // distinct races, not card-race pairs: a player choosing between two
          // cards for one seat faces one decision, not two
          const distinct = new Set(opts.map((o) => `${o.d.office}|${o.d.state}|${o.d.slot ?? ''}`)).size;
          legal.push(distinct);
          turns++;
          if (distinct === 0) deadTurns++;
        }
        const pegs = game.seats.filter((s) => s.holder).length;
        const counters = Object.values((game as any).leanMap).reduce((n: number, v) => n + Math.abs(v as number), 0) as number;
        tokens.push(pegs + counters);
      }
      game.tick();
    }
    for (const e of game.events) {
      if (e.uncontested || e.sides.length < 2) continue;
      races++;
      if (e.upset) upsets++;
      const sorted = [...e.sides].sort((a, b) => b.modifierTotal - a.modifierTotal);
      const edge = sorted[0].modifierTotal - sorted[1].modifierTotal;
      const favouriteWinProb = e.round === 'primary' ? primaryOddsAtEdge(edge) : oddsAtEdge(edge);
      predicted += 1 - favouriteWinProb;
    }
  }
  return { legal, tokens, deadTurnShare: turns ? deadTurns / turns : 0, upsets, races, predicted };
}

export const quantile = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length * p)]; };
export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

if (import.meta.filename === process.argv[1]) {
  const cfg = loadConfig(process.argv[2] ?? 'tuned.json');
  const cards = loadPacks(BALANCE_PACKS);
  const NAMES = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
  const GAMES = Number(process.argv[3] ?? 40);
  const seeds = Array.from({ length: GAMES }, (_, g) => 300000 + g);
  const m = feelMetrics(seeds, NAMES, cards, cfg);

  console.log(`config ${cfg.name}, ${GAMES} games\n`);
  console.log('DECISION DENSITY  (legal races available per player-turn; brief wants 4-25)');
  console.log(`  median ${quantile(m.legal, 0.5)}   mean ${mean(m.legal).toFixed(1)}   p90 ${quantile(m.legal, 0.9)}   max ${Math.max(...m.legal)}`);
  console.log(`  turns with NO legal move: ${(100 * m.deadTurnShare).toFixed(1)}%   [brief wants near zero]`);
  console.log('\nBOARD LOAD  (pegs + lean counters on the board at once)');
  console.log(`  median ${quantile(m.tokens, 0.5)}   p90 ${quantile(m.tokens, 0.9)}   peak ${Math.max(...m.tokens)}   [brief: 200 means the token economy failed]`);
  console.log('\nSWINGINESS  (favourite loses, against what the odds table predicts)');
  console.log(`  observed ${(100 * m.upsets / m.races).toFixed(1)}%   predicted ${(100 * m.predicted / m.races).toFixed(1)}%   over ${m.races} contested races`);
}
