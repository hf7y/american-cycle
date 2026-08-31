/** Headless harness — BUILD-BRIEF Phase 1.
 *  node sim/harness.ts --games 10000 --config baseline.json --agents Greedy,Random
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Game, type Config, type GameResult, type Agent } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { AGENTS } from './agents.ts';
import type { Card } from '../engine/types/index.ts';

export function loadConfig(path: string): Config {
  return JSON.parse(readFileSync(new URL(`../engine/config/${path}`, import.meta.url), 'utf8')) as Config;
}

export function loadPacks(names: string[]): Card[] {
  const out: Card[] = [];
  for (const n of names) {
    const p = JSON.parse(readFileSync(new URL(`../data/pack-${n}.json`, import.meta.url), 'utf8'));
    out.push(...(p.cards as Card[]));
  }
  return out;
}

export function playOne(agentNames: string[], cards: Card[], cfg: Config, seed: number): GameResult {
  const rng = new RNG(seed);
  const agents: Agent[] = agentNames.map((n) => {
    const C = AGENTS[n];
    if (!C) throw new Error(`unknown agent: ${n}`);
    return new C(cfg, rng);
  });
  const g = new Game(agents, cards, cfg, seed);
  const r = g.run();
  r.seed = seed;
  return r;
}

export interface Summary {
  games: number;
  agents: string[];
  winRate: number[];
  meanScore: number[];
  meanYears: number;
  meanLeadChanges: number;
  meanDeterminationFrac: number;
  billPassRate: number;
  crossBenchPerGame: number;
  uncontestedShare: number;
  meanDecisions: number;
  upsetRate: number;
  meanSeats: Record<string, number>;
  realignedStates: number;
  meanAbsLean: number;
}

export function summarise(results: GameResult[], agentNames: string[]): Summary {
  const n = results.length;
  const wins = new Array(agentNames.length).fill(0);
  const scores = new Array(agentNames.length).fill(0);
  let years = 0, leadChanges = 0, detFrac = 0, passed = 0, attempted = 0, cross = 0;
  let unc = 0, decisions = 0, decisionN = 0, upsets = 0, races = 0;
  const seats: Record<string, number> = { president: 0, senator: 0, governor: 0, representative: 0 };
  let realigned = 0, absLean = 0, leanN = 0;

  for (const r of results) {
    wins[r.winner]++;
    r.scores.forEach((s, i) => { scores[i] += s; });
    years += r.years; leadChanges += r.leadChanges;
    detFrac += r.years ? r.determinationYear / r.years : 0;
    passed += r.billsPassed; attempted += r.billsAttempted; cross += r.crossBenchVotes;
    unc += r.uncontestedShare;
    decisions += r.decisionCounts.reduce((a, b) => a + b, 0); decisionN += r.decisionCounts.length;
    upsets += r.events.filter((e) => e.upset).length; races += r.events.length;
    for (const k of Object.keys(seats)) seats[k] += r.seatsByOffice[k as keyof typeof r.seatsByOffice] ?? 0;
    for (const v of Object.values(r.finalLean)) { absLean += Math.abs(v); leanN++; if (Math.abs(v) >= 4) realigned++; }
  }
  return {
    games: n, agents: agentNames,
    winRate: wins.map((w) => w / n),
    meanScore: scores.map((s) => s / n),
    meanYears: years / n,
    meanLeadChanges: leadChanges / n,
    meanDeterminationFrac: detFrac / n,
    billPassRate: attempted ? passed / attempted : 0,
    crossBenchPerGame: cross / n,
    uncontestedShare: unc / n,
    meanDecisions: decisionN ? decisions / decisionN : 0,
    upsetRate: races ? upsets / races : 0,
    meanSeats: Object.fromEntries(Object.entries(seats).map(([k, v]) => [k, v / n])),
    realignedStates: realigned / n,
    meanAbsLean: leanN ? absLean / leanN : 0,
  };
}

function arg(flag: string, dflt: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

if (import.meta.filename === process.argv[1]) {
  const games = Number(arg('--games', '200'));
  const cfgName = arg('--config', 'baseline.json');
  const agentNames = arg('--agents', 'Greedy,Random').split(',');
  // ALL FOUR ERAS BY DEFAULT. Defaulting to '1976' alone quietly ran every CLI
  // measurement on 112 cards instead of 400, which ends four-player games at
  // ~3.5 years instead of ~13 -- a silent factor of four in any number taken
  // from the command line.
  const packs = arg('--packs', '1976,1992,2008,2016').split(',');
  const csv = arg('--csv', '');
  const cfg = loadConfig(cfgName);
  const cards = loadPacks(packs);

  const results: GameResult[] = [];
  for (let i = 0; i < games; i++) results.push(playOne(agentNames, cards, cfg, 1000 + i));
  const s = summarise(results, agentNames);
  console.log(JSON.stringify(s, null, 2));

  if (csv) {
    mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
    const rows = ['seed,years,winner,' + agentNames.map((a) => `score_${a}`).join(',') + ',leadChanges,billsPassed,uncontested'];
    for (const r of results) {
      rows.push([r.seed, r.years, agentNames[r.winner], ...r.scores, r.leadChanges, r.billsPassed, r.uncontestedShare.toFixed(3)].join(','));
    }
    writeFileSync(new URL(`../reports/${csv}`, import.meta.url), rows.join('\n') + '\n');
    console.error(`wrote reports/${csv}`);
  }
}
