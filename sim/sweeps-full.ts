/** The remaining sweeps from SIM-BRIEF Part 4, each holding the rest at
 *  baseline and reporting the metric it is supposed to move. Only worth
 *  running now: before the presidency and the last three unbuilt rules were wired, these measured a board with half its rules
 *  switched off. */
import { loadConfig, loadPacks, playOne, BALANCE_PACKS } from './harness.ts';
import type { Config } from '../engine/game.ts';
import type { Card } from '../engine/types/index.ts';

const AGENTS = ['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'];
const N = Number(process.argv[2] ?? 40);

function measure(cfg: Config, cards: Card[], seedBase: number) {
  let years = 0, det = 0, leads = 0, bills = 0, billsA = 0, cross = 0, rate = 0;
  let incRan = 0, incHeld = 0, slots = 0, contested = 0, midtermLoss = 0, midtermN = 0;
  let margin = 0, marginN = 0, comeback = 0, games = 0;
  for (let i = 0; i < N; i++) {
    const r = playOne(AGENTS, cards, cfg, seedBase + i);
    games++; years += r.years; leads += r.leadChanges; rate += r.rateRises;
    det += r.years ? r.determinationYear / r.years : 0;
    bills += r.billsPassed; billsA += r.billsAttempted; cross += r.crossBenchVotes;
    slots += 1; contested += r.contestedSlotShare;
    const top = Math.max(...r.scores), second = [...r.scores].sort((a, b) => b - a)[1] ?? 0;
    margin += top - second; marginN++;
    if (r.leadChanges > 0) comeback++;
    for (const e of r.events) {
      if (e.round !== 'general' || e.office === 'president') continue;
      const inc = e.sides.find((s) => s.modifiers.some((m) => m.source === 'incumbency'));
      if (inc) { incRan++; if (e.winner === inc.player) incHeld++; }
      const mid = e.sides.find((s) => s.modifiers.some((m) => m.source === 'midterm'));
      if (mid) { midtermN++; if (e.winner !== mid.player) midtermLoss++; }
    }
  }
  return {
    years: years / games, det: det / games, leads: leads / games,
    bills: billsA ? bills / billsA : 0, cross: cross / games, rate: rate / games,
    incumbency: incRan ? incHeld / incRan : NaN,
    contested: contested / slots,
    midtermLoss: midtermN ? midtermLoss / midtermN : NaN,
    margin: margin / marginN, comeback: comeback / games,
  };
}

const base = loadConfig('tuned.json');
const cards = loadPacks(BALANCE_PACKS);
const clone = (): Config => JSON.parse(JSON.stringify(base));

function sweep(title: string, watch: string, values: (number | string)[],
               apply: (c: Config, v: number | string) => void,
               show: (m: ReturnType<typeof measure>) => string) {
  console.log(`\n== ${title}  —  watch: ${watch} ==`);
  for (const v of values) {
    const c = clone(); apply(c, v);
    console.log(`  ${String(v).padStart(6)}  ${show(measure(c, cards, 100000 + Number(String(v).length) * 977))}`);
  }
}

const pct = (x: number) => (100 * x).toFixed(0) + '%';

sweep('base hand size', 'game length, determination point', [8, 10, 12, 14, 16],
  (c, v) => { c.hand.base = Number(v); },
  (m) => `years ${m.years.toFixed(0).padStart(2)}  determination ${pct(m.det)}  contested ${pct(m.contested)}  lead changes ${m.leads.toFixed(1)}`);

sweep('presidency hand bonus', 'runaway', [0, 1, 2, 3, 4],
  (c, v) => { c.hand.bonusPresident = Number(v); },
  (m) => `determination ${pct(m.det)}  lead changes ${m.leads.toFixed(1)}  winning margin ${m.margin.toFixed(0).padStart(3)}  comeback ${pct(m.comeback)}`);

sweep('Senate hand bonus', 'runaway', [0, 1, 2],
  (c, v) => { c.hand.bonusSenator = Number(v); },
  (m) => `determination ${pct(m.det)}  lead changes ${m.leads.toFixed(1)}  winning margin ${m.margin.toFixed(0).padStart(3)}`);

sweep('incumbency value', 'incumbent reelection vs 94.1% real', [1, 2, 3],
  (c, v) => { c.resolution.incumbency = Number(v); },
  (m) => `incumbent reelection ${pct(m.incumbency)}   [real House 94.1%]`);

sweep('midterm penalty', "whether the presidency's brake binds", [-1, -2, -3, -4],
  (c, v) => { c.national.midtermPenalty = Number(v); },
  (m) => `president's party loses ${pct(m.midtermLoss)} of its midterm races   [real: losses in 19 of 21]`);

sweep('Fed dice', 'whether the chicken game is playable or just punishing', [2, 3],
  (c, v) => { c.economy.fedDice = Number(v); },
  (m) => `rate rises per game ${m.rate.toFixed(1)}  bills ${pct(m.bills)}`);

sweep('filibuster threshold', 'bill passage, cross-benching', [0.5, 0.6, 0.667],
  (c, v) => { c.legislature.senatePassage = Number(v); },
  (m) => `bills pass ${pct(m.bills)}  cross-bench votes/game ${m.cross.toFixed(0)}`);
