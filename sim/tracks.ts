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
import { loadConfig, loadPacks, playOne, ALL_PACKS } from './harness.ts';
import { B } from '../tracks/b.ts';
import { C } from '../tracks/c.ts';
import { D } from '../tracks/d.ts';
import { CAPABILITY_NOTE, probe, type Capabilities, type Measure, type TrackCtx, type TrackItem } from '../tracks/types.ts';

const arg = (flag: string, dflt: string): string => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

if (process.argv.includes('--diff')) {
  const i = process.argv.indexOf('--diff');
  const [a, b] = [process.argv[i + 1], process.argv[i + 2]].map((f) => JSON.parse(readFileSync(f, 'utf8')));
  console.log(`${a.tag ?? a.config} -> ${b.tag ?? b.config}\n`);
  const rows = new Map<string, [number | undefined, number | undefined, number | undefined]>();
  for (const [file, slot] of [[a, 0], [b, 1]] as const) {
    for (const item of file.items) for (const m of item.measures ?? []) {
      const k = `${item.id} :: ${m.name}`;
      const row = rows.get(k) ?? [undefined, undefined, undefined];
      row[slot] = m.value;
      // The historical figure is a property of the ITEM, not of the build, so
      // either file may supply it. It is derived from the committed returns,
      // so the two files agreeing is a check that the datasets have not moved.
      if (m.historical !== undefined) row[2] = m.historical;
      rows.set(k, row);
    }
  }
  const f = (v: number | undefined) => (v === undefined ? 'n/a' : Number(v.toFixed(4)).toString());
  for (const [k, [x, y, h]] of rows) {
    // A blank is NOT a zero. An item the older build could not be asked has no
    // value, and printing 0 there would invent a before-and-after that says
    // the mechanic did nothing when in fact it did not exist.
    const d = x === undefined ? 'NEW' : y === undefined ? 'GONE' : (y - x).toFixed(3);
    // Movement TOWARD the record is the only reading that matters on a
    // historical row: a change is not an improvement unless it closed a gap.
    let toward = '';
    if (h !== undefined && x !== undefined && y !== undefined) {
      const before = Math.abs(x - h), after = Math.abs(y - h);
      toward = after < before ? `  CLOSER by ${(before - after).toFixed(3)}`
        : after > before ? `  further by ${(after - before).toFixed(3)}` : '  unmoved';
    }
    console.log(`  ${k.padEnd(58)} ${f(x).padStart(9)} -> ${f(y).padStart(9)}`
      + `${(h === undefined ? '' : '  hist ' + f(h)).padEnd(16)}${d.padStart(8)}${toward}`);
  }
  const caps = (f: { capabilities?: Capabilities }) => Object.entries(f.capabilities ?? {})
    .filter(([, v]) => !v).map(([k]) => k);
  for (const [label, f] of [['left', a], ['right', b]] as const) {
    const missing = caps(f);
    if (missing.length) console.log(`\n  ${label} build could not be asked: ${missing.join(', ')}`);
  }
  process.exit(0);
}

const configName = arg('--config', 'tuned.json');
const games = Number(arg('--games', '80'));
const only = arg('--track', '');
const agents = arg('--agents', 'Greedy,Lookahead,HouseFarm,SenateFlood').split(',');
const packs = arg('--packs', ALL_PACKS.join(',')).split(',');

const cfg = loadConfig(configName);
const cards = loadPacks(packs);
const seeds = Array.from({ length: games }, (_, i) => 7000 + i);
process.stderr.write(`playing ${games} games on ${configName} ... `);
const runs = seeds.map((s) => playOne(agents, cards, cfg, s));
process.stderr.write('done\n');

// Ask the build what it is, rather than assuming it is this one. A worktree
// carries no version, and the fields are what actually decide the answer.
const can: Capabilities = probe(runs[0] as unknown as Record<string, unknown>, cfg as unknown as Record<string, unknown>);
const missing = (Object.keys(can) as (keyof Capabilities)[]).filter((k) => !can[k]);
if (missing.length) {
  console.log(`build under test is missing: ${missing.join(', ')}`);
  for (const k of missing) console.log(`  ${k}: ${CAPABILITY_NOTE[k]}`);
}

const ctx: TrackCtx = { cards, cfg, configName, agents, seeds, runs, can };

interface Row { id: string; track: string; question: string; notRun?: string; notMeasurable?: string; oracle?: string; calibrated?: string; measures?: Measure[]; verdict?: string; pass?: boolean }
const out: Row[] = [];
let crashed = 0, red = 0, unmeasurable = 0;

for (const item of [...B, ...C, ...D] as TrackItem[]) {
  if (only && item.track !== only) continue;
  console.log(`\n[${item.track}] ${item.id}\n  Q: ${item.question.replace(/\s+/g, ' ')}`);
  if (item.notRun || !item.run) {
    console.log(`  NOT RUN — ${item.notRun?.replace(/\s+/g, ' ')}`);
    out.push({ id: item.id, track: item.track, question: item.question, notRun: item.notRun });
    continue;
  }
  // NOT MEASURABLE is a third state, and collapsing it into either of the
  // other two loses the fact the baseline exists to carry. NOT RUN is a
  // decision; RED is a result; this is the build having no answer.
  const unmet = (item.needs ?? []).filter((k) => !can[k]);
  if (unmet.length) {
    const why = unmet.map((k) => CAPABILITY_NOTE[k]).join('; ');
    unmeasurable++;
    console.log(`  NOT MEASURABLE on this build — ${why}`);
    out.push({ id: item.id, track: item.track, question: item.question, notMeasurable: why });
    continue;
  }
  let measures: Measure[];
  try { measures = await item.run(ctx); }
  catch (e) { crashed++; console.log(`  CRASHED — ${(e as Error).message}`); continue; }
  for (const m of measures) {
    const hist = m.historical === undefined ? ''
      : `   hist ${m.historical.toFixed(3)}  (off by ${Math.abs(m.value - m.historical).toFixed(3)})`;
    console.log(`    ${m.name.padEnd(52)} ${Number(m.value).toFixed(3).padStart(10)}`
      + `${m.unit ? '  ' + m.unit : ''}${m.n ? `  (n=${m.n})` : ''}${hist}`);
    if (m.historicalNote) console.log(`      ${m.historicalNote.replace(/\s+/g, ' ')}`);
  }
  const row: Row = { id: item.id, track: item.track, question: item.question, measures,
                     oracle: item.oracle, calibrated: item.calibrated };
  if (item.accept) {
    const v = item.accept(measures);
    row.pass = v.pass; row.verdict = v.note;
    if (!v.pass) red++;
    // The provenance rides with the verdict, because a green against a bar
    // the author drew after seeing the data is not the same claim as a green
    // against one the brief set, and the number cannot say which it is.
    console.log(`  ${v.pass ? 'GREEN' : 'RED  '} [bar: ${item.oracle ?? 'unlabelled'}] — ${v.note}`);
    if (item.calibrated) console.log(`         CALIBRATED — ${item.calibrated.replace(/\s+/g, ' ')}`);
  } else {
    console.log('  RECORDED (Track B judges nothing).');
  }
  out.push(row);
}

console.log(`\n${red} acceptance item(s) red, ${unmeasurable} not measurable on this build, ${crashed} crashed.`);
console.log('Track C and D are NOT blocking: red is the expected state until the mechanic lands.');

const emit = arg('--emit', '');
if (emit) {
  mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
  const path = emit.startsWith('/') ? emit : new URL(`../${emit}`, import.meta.url).pathname;
  writeFileSync(path, JSON.stringify({
    tag: arg('--tag', 'working-tree'), config: configName, agents, games, packs,
    capabilities: can, items: out,
  }, null, 2) + '\n');
  console.error(`wrote ${path}`);
}

// A crash is a broken instrument and blocks. A red acceptance item does not.
if (crashed) process.exit(1);
