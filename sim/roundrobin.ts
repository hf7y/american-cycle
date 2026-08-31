/** Balance — SIM-BRIEF Part 2. Skill signal, seat bias, dominance search. */
import { loadConfig, loadPacks, playOne } from './harness.ts';
import { AGENTS } from './agents.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';

export function duel(a: string, b: string, cards: Card[], cfg: Config, n: number) {
  let aw = 0, games = 0;
  for (let i = 0; i < n; i++) {
    // alternate seats so the result is not a seat-bias measurement
    const order = i % 2 === 0 ? [a, b] : [b, a];
    const r = playOne(order, cards, cfg, 5000 + i);
    if (order[r.winner] === a) aw++;
    games++;
  }
  return aw / games;
}

export function seatBias(agent: string, players: number, cards: Card[], cfg: Config, n: number) {
  const wins = new Array(players).fill(0);
  for (let i = 0; i < n; i++) {
    const r = playOne(new Array(players).fill(agent), cards, cfg, 8000 + i);
    wins[r.winner]++;
  }
  return wins.map((w) => w / n);
}

export function roundRobin(names: string[], cards: Card[], cfg: Config, n: number) {
  const wins: Record<string, number> = Object.fromEntries(names.map((x) => [x, 0]));
  let games = 0;
  for (let i = 0; i < n; i++) {
    // rotate the seating each game so no strategy owns a seat
    const order = names.map((_, k) => names[(k + i) % names.length]);
    const r = playOne(order, cards, cfg, 9000 + i);
    wins[order[r.winner]]++;
    games++;
  }
  return { wins, games };
}

if (import.meta.filename === process.argv[1]) {
  const cfg = loadConfig(process.argv[2] ?? 'tuned.json');
  const cards = loadPacks(['1976', '1992', '2008', '2016']);
  const N = Number(process.argv[3] ?? 60);

  console.log(`== skill signal (${N} games each, seats alternated) ==`);
  for (const [a, b, target] of [
    ['Greedy', 'Random', 'SIM-BRIEF target 65-80%'],
    ['Lookahead', 'Greedy', 'the planning premium'],
    ['Greedy', 'WideAndEmpty', 'district gating should kill wide-and-empty'],
  ] as const) {
    console.log(`  ${a} vs ${b}: ${(100 * duel(a, b, cards, cfg, N)).toFixed(0)}%   (${target})`);
  }

  console.log('\n== seat bias (all Greedy; >3pp deviation needs a fix) ==');
  for (const p of [2, 3, 4, 5, 6]) {
    const b = seatBias('Greedy', p, cards, cfg, N);
    const dev = Math.max(...b.map((x) => Math.abs(x - 1 / p)));
    console.log(`  ${p}p: ${b.map((x) => (100 * x).toFixed(0) + '%').join(' ')}  max deviation ${(100 * dev).toFixed(1)}pp`);
  }

  const strategies = ['WideAndEmpty', 'SenateFlood', 'HouseFarm', 'HeterodoxSpecialist', 'BillMaximizer', 'EconomyChicken'];
  console.log(`\n== six-way round robin (${N * 3} games; >40% is dominant) ==`);
  const rr = roundRobin(strategies, cards, cfg, N * 3);
  for (const [k, v] of Object.entries(rr.wins).sort((a, b) => b[1] - a[1])) {
    const pct = 100 * v / rr.games;
    console.log(`  ${k.padEnd(22)} ${pct.toFixed(1).padStart(5)}%${pct > 40 ? '   DOMINANT' : ''}`);
  }
  void AGENTS;
}
