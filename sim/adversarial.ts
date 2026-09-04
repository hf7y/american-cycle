/** hf7y/american-cycle#33: every agent in sim/agents.ts is trying to WIN.
 *  This file runs agents built to BREAK the game instead, against SIM-BRIEF's
 *  own bars (>40% in a six-way is dominant, a rule forced to 0% is a hole),
 *  and reports what each achieved. It does not fix anything it finds -- that
 *  is a separate, later change.
 *
 *  node sim/adversarial.ts
 */
import { loadConfig, loadPacks, playOne, ALL_PACKS } from './harness.ts';
import { roundRobin, seatBias } from './roundrobin.ts';
import type { Config } from '../engine/game.ts';

const cfg = loadConfig('tuned.json');
const cards = loadPacks(ALL_PACKS);
console.log(`packs: ${ALL_PACKS.join(',')} (${cards.length} cards), config: tuned.json\n`);

const findings: string[] = [];
function flag(msg: string) { findings.push(msg); console.log(`  DEGENERATE: ${msg}`); }

/** A six-way round robin against the standard dominance-search pool
 *  (sim/roundrobin.ts's own six strategies), with one slot swapped for the
 *  agent under test. n chosen for ~2pp SE around a 16.7% fair share. */
function sixWay(name: string, swapOut: string, n = 360) {
  const pool = ['WideAndEmpty', 'SenateFlood', 'HouseFarm', 'HeterodoxSpecialist', 'BillMaximizer', 'EconomyChicken']
    .map((s) => (s === swapOut ? name : s));
  const rr = roundRobin(pool, cards, cfg, n);
  const rows = Object.entries(rr.wins).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [k, 100 * v / rr.games] as const);
  for (const [k, pct] of rows) console.log(`    ${k.padEnd(22)} ${pct.toFixed(1).padStart(5)}%${pct > 40 ? '   DOMINANT' : ''}`);
  return Object.fromEntries(rows);
}

// 1. wide-and-empty at scale -- declare everywhere cheap, contest nothing.
console.log('== 1. wide-and-empty at scale (six-player table, all WideAndEmpty) ==');
{
  const N = 240;
  const b = seatBias('WideAndEmpty', 6, cards, cfg, N);
  console.log(`    seat shares: ${b.map((x) => (100 * x).toFixed(1) + '%').join('  ')}  (n=${N})`);
  console.log('    (already in the standard six-way pool below, at scale here for its own read)');
  const share = sixWay('WideAndEmpty', 'WideAndEmpty');
  if (share.WideAndEmpty > 40) flag(`WideAndEmpty wins ${share.WideAndEmpty.toFixed(1)}% of a six-way -- district gating did not kill it`);
  else console.log(`    stays dead: ${share.WideAndEmpty.toFixed(1)}% in the six-way (known, tracked already where it's not 0%: #50/#75 territory)`);
}

// 2. deck-out racing -- burn the talon as fast as possible. F15 says
// deck-out is unreachable; try to reach it with the most efficient shipped
// agent, given all the time it could plausibly want.
console.log('\n== 2. deck-out racing (four-player Greedy table, maxYears lifted to 300) ==');
{
  const N = 24;
  const longCfg: Config = { ...cfg, game: { ...cfg.game, maxYears: 300 } };
  let deckOuts = 0, other = 0;
  const years: number[] = [];
  for (let i = 0; i < N; i++) {
    const r = playOne(['Greedy', 'Greedy', 'Greedy', 'Greedy'], cards, longCfg, 30000 + i);
    years.push(r.years);
    if (r.endedBy === 'deckOut') deckOuts++; else other++;
  }
  const meanYears = years.reduce((a, b) => a + b, 0) / years.length;
  console.log(`    deckOut fired ${deckOuts}/${N} games; mean length ${meanYears.toFixed(1)}y (cap 300y)`);
  if (deckOuts > 0) flag(`deck-out reached ${deckOuts}/${N} times at maxYears:300 -- F15's "unreachable" does not hold at this length`);
  else console.log('    still unreached at 300 years -- consistent with F15 and the no-cap amendment\'s account of why circulation regrows the talon');
}

// 3. runaway-maximising -- stack every positive-feedback loop on purpose.
console.log('\n== 3. runaway-maximising (RunawayMaximiser swapped into the six-way pool) ==');
{
  const share = sixWay('RunawayMaximiser', 'WideAndEmpty');
  if (share.RunawayMaximiser > 40) flag(`RunawayMaximiser wins ${share.RunawayMaximiser.toFixed(1)}% of a six-way -- stacking every loop at once clears the dominance bar`);
  else console.log(`    ${share.RunawayMaximiser.toFixed(1)}% -- stacking every loop at once does not, on its own, clear the bar`);
}

// 4. walkover-farming -- take only uncontested races.
console.log('\n== 4. walkover-farming (WalkoverFarmer swapped into the six-way pool) ==');
{
  const share = sixWay('WalkoverFarmer', 'WideAndEmpty');
  if (share.WalkoverFarmer > 40) flag(`WalkoverFarmer wins ${share.WalkoverFarmer.toFixed(1)}% of a six-way -- free uncontested seats alone clear the dominance bar`);
  else console.log(`    ${share.WalkoverFarmer.toFixed(1)}% -- taking only free seats does not, on its own, win the table`);
}

// 5. refusing to legislate -- never vote yes, and see whether the bill
// layer stalls. BillBlocker already exists (#75) as a one-agent counter;
// this runs a WHOLE TABLE of it to see whether passage goes to zero rather
// than merely down.
console.log('\n== 5. refusing to legislate (four-player table, all BillBlocker) ==');
{
  const N = 60;
  let passed = 0, attempted = 0, years = 0, ended = 0;
  for (let i = 0; i < N; i++) {
    const r = playOne(['BillBlocker', 'BillBlocker', 'BillBlocker', 'BillBlocker'], cards, cfg, 40000 + i);
    passed += r.billsPassed; attempted += r.billsAttempted; years += r.years;
    if (r.endedBy) ended++;
  }
  const rate = attempted ? 100 * passed / attempted : 0;
  console.log(`    passage rate ${rate.toFixed(1)}% (${passed}/${attempted} attempted), mean length ${(years / N).toFixed(1)}y, ended-by-condition ${(100 * ended / N).toFixed(0)}%`);
  if (passed === 0 && attempted > 0) {
    flag(`a whole table refusing to legislate forces bill passage to exactly 0% (${attempted} attempts, 0 passed) -- the bill layer fully stalls rather than merely slowing`);
  } else if (rate === 0) {
    console.log('    no bill was even attempted -- a different stall than the one this arm was built to find');
  } else {
    console.log(`    the bill layer does not fully stall: ${rate.toFixed(1)}% still pass`);
  }
}

console.log(`\n${findings.length} degenerate result(s) found.`);
for (const f of findings) console.log(`  - ${f}`);
process.exit(0);
