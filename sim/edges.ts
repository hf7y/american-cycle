/** hf7y/american-cycle#36: every measurement in this repo has used four
 *  players and a subset of years, and no document states a target session
 *  length. This gives SIM-BRIEF the three numbers it asks for and has never
 *  had: seat bias at every table size 2-6, real game length by hand size
 *  with `maxYears` lifted (F15: the shipped cap hides this knob entirely),
 *  and the full 1932-2024 span run end to end. `maxYears` is lifted only in
 *  this file's own measurements, never in a shipped config.
 *
 *  node sim/edges.ts
 */
import { loadConfig, loadPacks, playOne, ALL_PACKS } from './harness.ts';
import { seatBias } from './roundrobin.ts';
import type { Config } from '../engine/game.ts';

const cfg = loadConfig('tuned.json');
const cards = loadPacks(ALL_PACKS);
console.log(`packs: ${ALL_PACKS.join(',')} (${cards.length} cards), config: tuned.json\n`);

// 1. seat-position win rate, 2-6 players.
console.log('== 1. seat-position win rate, 2-6 players (all Greedy; SIM-BRIEF: >3pp deviation needs a fix) ==');
{
  const N = 600;
  const seFor = (players: number) => 100 * Math.sqrt((1 / players) * (1 - 1 / players) / N);
  let over: number[] = [];
  for (const p of [2, 3, 4, 5, 6]) {
    const b = seatBias('Greedy', p, cards, cfg, N);
    const dev = 100 * Math.max(...b.map((x) => Math.abs(x - 1 / p)));
    if (dev > 3) over.push(p);
    console.log(`  ${p}p: ${b.map((x) => (100 * x).toFixed(1) + '%').join('  ')}  max deviation ${dev.toFixed(1)}pp (SE ${seFor(p).toFixed(1)}pp, n=${N})${dev > 3 ? '  OVER BAR' : ''}`);
  }
  console.log(over.length ? `  -> over the 3pp bar at: ${over.join('p, ')}p (see #55 for the 3-player case already tracked)` : '  -> every table size clears the bar');
}

// 2. game length by hand size, maxYears lifted so the knob is visible at all.
console.log('\n== 2. game length by hand size (maxYears lifted to 500, measurement only) ==');
{
  const N = 30;
  const uncapped: Config = { ...cfg, game: { ...cfg.game, maxYears: 500 } };
  for (const base of [8, 16, 24, 32, 48, 96]) {
    const c: Config = { ...uncapped, hand: { ...uncapped.hand, base } };
    const years: number[] = [];
    let deckOuts = 0;
    for (let i = 0; i < N; i++) {
      const r = playOne(['Greedy', 'Greedy', 'Greedy', 'Greedy'], cards, c, 50000 + base * 1000 + i);
      years.push(r.years);
      if (r.endedBy === 'deckOut') deckOuts++;
    }
    const mean = years.reduce((a, b) => a + b, 0) / years.length;
    const cappedOut = years.filter((y) => y >= 500).length;
    console.log(`  hand.base ${base.toString().padStart(3)}: mean ${mean.toFixed(1)}y  (${cappedOut}/${N} hit the 500y safety cap, ${deckOuts}/${N} deck-out)`);
  }
  console.log('  F15\'s claim was that length is invariant at 16y across hand sizes because the shipped cap binds first; the spread above is what it looks like with that cap removed.');
}

// 3. wall-clock estimate. Not measurable headlessly -- there is no render or
// animation cost in this harness to time. `sim/playtest.py`, which drives
// the actual board in a browser, now times itself per declaration cycle;
// that is where this number comes from, not here.
console.log('\n== 3. wall-clock estimate ==');
console.log('  not measurable in the headless harness (no render/animation cost exists to time here).');
console.log('  PLAYTEST_SEED=<seed> python3 sim/playtest.py now prints elapsed time and a per-cycle estimate.');

// 4. the full 1932-2024 span, and the odd-year / deck-out edges.
console.log('\n== 4. full 1932-2024 span (startYear 1932, maxYears 200, measurement only) ==');
{
  const N = 20;
  const spanCfg: Config = { ...cfg, game: { ...cfg.game, startYear: 1932, maxYears: 200 } };
  const years: number[] = [];
  let deckOuts = 0, oddYearGovRaces = 0, totalGovRaces = 0, minYear = Infinity, maxYear = -Infinity;
  for (let i = 0; i < N; i++) {
    const r = playOne(['Greedy', 'Greedy', 'Greedy', 'Greedy'], cards, spanCfg, 60000 + i);
    years.push(r.years);
    if (r.endedBy === 'deckOut') deckOuts++;
    for (const ev of r.events) {
      if (ev.office !== 'governor') continue;
      totalGovRaces++;
      if (ev.year % 2 !== 0) oddYearGovRaces++;
      minYear = Math.min(minYear, ev.year);
      maxYear = Math.max(maxYear, ev.year);
    }
  }
  const mean = years.reduce((a, b) => a + b, 0) / years.length;
  console.log(`  ${N} games, mean length ${mean.toFixed(1)}y, deck-out ${deckOuts}/${N}`);
  console.log(`  governor races: ${totalGovRaces} total, ${oddYearGovRaces} (${(100 * oddYearGovRaces / totalGovRaces).toFixed(1)}%) in an odd year`);
  console.log(`  years touched: ${minYear}-${maxYear} (startYear 1932)`);
}
