/** Can the engine reproduce a real election?
 *
 *  1976 is the fairest test available: it is the game's founding era pack, the
 *  race was close (Carter 297–240), and the map has a clean regional story —
 *  Carter sweeps the South, Ford takes the West. Nothing here tunes anything;
 *  it seeds the board with the real pre-election lean and runs §9's resolution
 *  the same way a game would.
 */
import { loadConfig, loadPacks } from './harness.ts';
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { AGENTS } from './agents.ts';
import { STATES, electors } from '../engine/states.ts';

/** The real 1976 result, by state. + = Ford, − = Carter. */
const RESULT_1976: Record<string, 'C' | 'F'> = {
  AL:'C',AK:'F',AZ:'F',AR:'C',CA:'F',CO:'F',CT:'F',DE:'C',FL:'C',GA:'C',HI:'C',ID:'F',
  IL:'F',IN:'F',IA:'F',KS:'F',KY:'C',LA:'C',ME:'F',MD:'C',MA:'C',MI:'F',MN:'C',MS:'C',
  MO:'C',MT:'F',NE:'F',NV:'F',NH:'F',NJ:'F',NM:'F',NY:'C',NC:'C',ND:'F',OH:'C',OK:'F',
  OR:'F',PA:'C',RI:'C',SC:'C',SD:'F',TN:'C',TX:'C',UT:'F',VT:'F',VA:'F',WA:'F',WV:'C',
  WI:'C',WY:'F',
};

/** Pre-election lean, in pips, as the board would have carried it in 1976:
 *  the South still solidly Democratic, the Mountain West and Plains solidly
 *  Republican, the industrial North contested. Signed + = R. */
const LEAN_1976: Record<string, number> = {
  AL:-4,MS:-4,GA:-4,SC:-3,AR:-4,LA:-3,TX:-2,NC:-2,TN:-2,KY:-2,WV:-3,VA:-1,FL:-1,
  MA:-3,RI:-3,MD:-2,NY:-1,PA:-1,MN:-2,WI:-1,HI:-2,MO:-1,
  ID:4,UT:4,WY:4,NE:3,KS:3,SD:3,ND:2,MT:2,AZ:3,NV:2,CO:2,NM:1,OK:2,AK:3,
  IN:2,NH:2,VT:2,ME:1,IA:1,IL:0,OH:0,MI:0,CA:0,NJ:0,CT:0,OR:0,WA:0,DE:0,
};

const cfg = loadConfig('tuned.json');
const cards = loadPacks(['1976']);
const carter = cards.find((c) => c.kind === 'candidate' && c.id === 'jimmy-carter')!;
const ford = cards.find((c) => c.kind === 'candidate' && c.id === 'gerald-r-ford')!;

let hits = 0, total = 0, cEV = 0, fEV = 0, runs = 0;
const perState: Record<string, number> = {};
const N = Number(process.argv[2] ?? 400);

for (let n = 0; n < N; n++) {
  const rng = new RNG(1976_000 + n);
  const g = new Game([new AGENTS.Greedy(cfg, rng), new AGENTS.Greedy(cfg, rng)], cards, cfg, 1976_000 + n);
  Object.assign(g.leanMap, LEAN_1976);

  // Two nominees, no district holdings — the presidency is the only race, and
  // the only thing separating them is the map and their home states.
  const wave = new (Object.getPrototypeOf(g).constructor === Game ? Object : Object)();
  void wave;
  let c = 0, f = 0;
  for (const st of STATES) {
    const ctx = (g as any).raceContext('president', st.code, undefined);
    const { resolveRace, Wave } = await import('../engine/rules/resolution.ts');
    const { buildModifiers, toSide } = await import('../engine/rules/elections.ts');
    const w = new Wave(rng);
    const mk = (card: any) => ({ player: card === carter ? 0 : 1, card, office: 'president' as const, state: st.code });
    const sides = [mk(carter), mk(ford)].map((d) =>
      toSide(d, buildModifiers(d, ctx, 'general', cfg.resolution, cfg.national, cfg.primaryGeneral)));
    const ev = resolveRace({ year: 1976, round: 'general', office: 'president', state: st.code, sides, wave: w, rng });
    const won = ev.winner === 0 ? 'C' : 'F';
    if (won === 'C') c += electors(st, 1976); else f += electors(st, 1976);
    total++;
    if (won === RESULT_1976[st.code]) { hits++; perState[st.code] = (perState[st.code] ?? 0) + 1; }
  }
  cEV += c; fEV += f; runs++;
}

console.log(`1976 replayed ${runs} times, seeded with the real pre-election map\n`);
console.log(`  state-level agreement with the real result: ${(100 * hits / total).toFixed(1)}%`);
console.log(`  mean electoral votes   Carter ${(cEV / runs).toFixed(0)}   Ford ${(fEV / runs).toFixed(0)}`);
console.log(`  the real result        Carter 297           Ford 240\n`);
// Agreement split by how much the board actually knew about the state.
const buckets: Record<string, { hit: number; n: number }> = {
  'lean 3+': { hit: 0, n: 0 }, 'lean 1-2': { hit: 0, n: 0 }, 'lean 0': { hit: 0, n: 0 },
};
for (const st of STATES) {
  const l = Math.abs(LEAN_1976[st.code] ?? 0);
  const k = l >= 3 ? 'lean 3+' : l >= 1 ? 'lean 1-2' : 'lean 0';
  buckets[k].hit += perState[st.code] ?? 0;
  buckets[k].n += runs;
}
console.log('  agreement by how much lean the board carried:');
for (const [k, v] of Object.entries(buckets)) {
  console.log(`    ${k.padEnd(9)} ${(100 * v.hit / v.n).toFixed(1)}%   (${v.n / runs} states)`);
}
const worst = Object.entries(perState).sort((a, b) => a[1] - b[1]).slice(0, 5);
console.log('\n  least-agreeing states:');
for (const [st, n] of worst) {
  console.log(`    ${st}  ${(100 * n / runs).toFixed(0)}%  board lean ${LEAN_1976[st] ?? 0}  (real: ${RESULT_1976[st] === 'C' ? 'Carter' : 'Ford'})`);
}
