/** SIM-BRIEF Part 3 and Part 5 measures that need instrumenting rather than
 *  reading off a result: decision density, board load, dead players, and
 *  swinginess against what the odds table predicts. */
import { loadConfig, loadPacks } from './harness.ts';
import { Game } from '../engine/game.ts';
import { AGENTS, options } from './agents.ts';
import { RNG } from '../engine/rules/rng.ts';
import { oddsAtEdge } from '../engine/rules/resolution.ts';

const cfg = loadConfig(process.argv[2] ?? 'tuned.json');
const cards = loadPacks(['1976', '1992', '2008', '2016']);
const NAMES = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const GAMES = Number(process.argv[3] ?? 40);

const legal: number[] = [];         // LEGAL MOVES available, not choices taken
const tokens: number[] = [];        // pegs + lean counters, simultaneous
let deadTurns = 0, turns = 0;
let upsets = 0, races = 0, predicted = 0;

for (let g = 0; g < GAMES; g++) {
  const rng = new RNG(300000 + g);
  const game = new Game(NAMES.map((n) => new AGENTS[n](cfg, rng)), cards, cfg, 300000 + g);
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
    predicted += 1 - oddsAtEdge(sorted[0].modifierTotal - sorted[1].modifierTotal);
  }
}

const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length * p)]; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

console.log(`config ${cfg.name}, ${GAMES} games\n`);
console.log('DECISION DENSITY  (legal races available per player-turn; brief wants 4-25)');
console.log(`  median ${q(legal, 0.5)}   mean ${mean(legal).toFixed(1)}   p90 ${q(legal, 0.9)}   max ${Math.max(...legal)}`);
console.log(`  turns with NO legal move: ${(100 * deadTurns / turns).toFixed(1)}%   [brief wants near zero]`);
console.log('\nBOARD LOAD  (pegs + lean counters on the board at once)');
console.log(`  median ${q(tokens, 0.5)}   p90 ${q(tokens, 0.9)}   peak ${Math.max(...tokens)}   [brief: 200 means the token economy failed]`);
console.log('\nSWINGINESS  (favourite loses, against what the odds table predicts)');
console.log(`  observed ${(100 * upsets / races).toFixed(1)}%   predicted ${(100 * predicted / races).toFixed(1)}%   over ${races} contested races`);
