/** The test program's runner — four tracks, one suite, no stamps.
 *
 *   node sim/tracks.ts                                   # run everything
 *   node sim/tracks.ts --emit reports/char-v0.2.json     # freeze Track B
 *   node sim/tracks.ts --diff a.json b.json              # compare two tags
 *   node sim/tracks.ts --track C --config tuned.json
 *
 *  EXIT CODES. Track A (the measurement layer) and Track B block: they must
 *  RUN. Tracks C and D never block, which is what lets an acceptance test be
 *  written before the mechanic and sit red for six months. A crash in C or D
 *  is still a failure, because a broken instrument is not a red test.
 *
 *  THE BASELINE IS THE NUMBERS FILE, NOT THE SUITE. `--emit` per tag,
 *  `--diff` between tags. A test written today re-runs against v0.1.2
 *  unchanged, which is the whole reason these are not `findings/`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadConfig, loadPacks, playOne } from './harness.ts';
import { B } from '../tracks/b.ts';
import { C } from '../tracks/c.ts';
import { D } from '../tracks/d.ts';
import type { Measure, TrackCtx, TrackItem } from '../tracks/types.ts';

const arg = (flag: string, dflt: string): string => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

if (process.argv.includes('--diff')) {
  const i = process.argv.indexOf('--diff');
  const [a, b] = [process.argv[i + 1], process.argv[i + 2]].map((f) => JSON.parse(readFileSync(f, 'utf8')));
  console.log(`${a.tag ?? a.config} -> ${b.tag ?? b.config}\n`);
  const rows = new Map<string, [number | undefined, number | undefined]>();
  for (const [file, slot] of [[a, 0], [b, 1]] as const) {
    for (const item of file.items) for (const m of item.measures ?? []) {
      const k = `${item.id} :: ${m.name}`;
      const row = rows.get(k) ?? [undefined, undefined];
      row[slot] = m.value;
      rows.set(k, row);
    }
  }
  for (const [k, [x, y]] of rows) {
    const d = x === undefined ? 'NEW' : y === undefined ? 'GONE' : (y - x).toFixed(3);
    console.log(`  ${k.padEnd(64)} ${String(x ?? '-').padStart(9)} -> ${String(y ?? '-').padStart(9)}  ${d}`);
  }
  process.exit(0);
}

const configName = arg('--config', 'tuned.json');
const games = Number(arg('--games', '80'));
const only = arg('--track', '');
const agents = arg('--agents', 'Greedy,Lookahead,HouseFarm,SenateFlood').split(',');
const packs = arg('--packs', '1932,1964,1976,1992,2008,2016,2024').split(',');

const cfg = loadConfig(configName);
const cards = loadPacks(packs);
const seeds = Array.from({ length: games }, (_, i) => 7000 + i);
process.stderr.write(`playing ${games} games on ${configName} ... `);
const runs = seeds.map((s) => playOne(agents, cards, cfg, s));
process.stderr.write('done\n');

const ctx: TrackCtx = { cards, cfg, configName, agents, seeds, runs };

interface Row { id: string; track: string; question: string; notRun?: string; measures?: Measure[]; verdict?: string; pass?: boolean }
const out: Row[] = [];
let crashed = 0, red = 0;

for (const item of [...B, ...C, ...D] as TrackItem[]) {
  if (only && item.track !== only) continue;
  console.log(`\n[${item.track}] ${item.id}\n  Q: ${item.question.replace(/\s+/g, ' ')}`);
  if (item.notRun || !item.run) {
    console.log(`  NOT RUN — ${item.notRun?.replace(/\s+/g, ' ')}`);
    out.push({ id: item.id, track: item.track, question: item.question, notRun: item.notRun });
    continue;
  }
  let measures: Measure[];
  try { measures = await item.run(ctx); }
  catch (e) { crashed++; console.log(`  CRASHED — ${(e as Error).message}`); continue; }
  for (const m of measures) {
    console.log(`    ${m.name.padEnd(52)} ${Number(m.value).toFixed(3).padStart(10)}`
      + `${m.unit ? '  ' + m.unit : ''}${m.n ? `  (n=${m.n})` : ''}`);
  }
  const row: Row = { id: item.id, track: item.track, question: item.question, measures };
  if (item.accept) {
    const v = item.accept(measures);
    row.pass = v.pass; row.verdict = v.note;
    if (!v.pass) red++;
    console.log(`  ${v.pass ? 'GREEN' : 'RED  '} — ${v.note}`);
  } else {
    console.log('  RECORDED (Track B judges nothing).');
  }
  out.push(row);
}

console.log(`\n${red} acceptance item(s) red, ${crashed} crashed.`);
console.log('Track C and D are NOT blocking: red is the expected state until the mechanic lands.');

const emit = arg('--emit', '');
if (emit) {
  mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
  const path = emit.startsWith('/') ? emit : new URL(`../${emit}`, import.meta.url).pathname;
  writeFileSync(path, JSON.stringify({
    tag: arg('--tag', 'working-tree'), config: configName, agents, games, packs, items: out,
  }, null, 2) + '\n');
  console.error(`wrote ${path}`);
}

// A crash is a broken instrument and blocks. A red acceptance item does not.
if (crashed) process.exit(1);
