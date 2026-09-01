/** The Skowronek suite runner — a REPORTING suite, invoked by hand.
 *
 *  Deliberately NOT in `npm test` and NOT in the blocking CI job: these are
 *  design targets that are supposed to fail until the design changes, and a
 *  failing target in a blocking job would either be silenced or would stop the
 *  repo. It has no stamped headlines and no findings-style HOLDS/STALE grading
 *  for the same reason — a stamp asserts a number was once true and worth
 *  keeping, and a design target asserts the opposite.
 *
 *  It lives outside `findings/` on purpose. `sim/findings.ts` auto-loads every
 *  module in that directory and `findings/well-formed.test.ts` re-runs each
 *  predicate under FINDINGS_DEEP, which CI now sets — so a file dropped in
 *  there would run in the blocking job whatever this comment said.
 *
 *    node sim/skowronek.ts                      # all shipped configs, cheap n
 *    node sim/skowronek.ts --games 40 --configs as-written-plus.json
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { loadConfig, loadPacks } from './harness.ts';
import { observeRun } from '../skowronek/observe.ts';
import { eraChecks, quadrantCoverage, mean } from '../skowronek/checks.ts';
import { leanWriterControl, powerControl, preconditions, syntheticControl } from '../skowronek/controls.ts';
import { renderReport, type ConfigReport } from '../skowronek/report.ts';

const arg = (flag: string, dflt: string): string => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

const games = Number(arg('--games', '12'));
const pool = arg('--agents', 'Greedy,BillAuthor,SenateFlood,Random').split(',');
const packs = arg('--packs', '1932,1964,1976,1992,2008,2016,2024').split(',');
const cfgDir = new URL('../engine/config/', import.meta.url);
const configs = arg('--configs', '').length
  ? arg('--configs', '').split(',')
  : readdirSync(cfgDir).filter((f) => f.endsWith('.json')).sort();

const cards = loadPacks(packs);
const seeds = Array.from({ length: games }, (_, i) => 5000 + i);

// C1 is a property of the code, not of any config, so it runs once.
const c1 = syntheticControl();
if (!c1.passed) console.error('WARNING: C1 failed — the formation instrument is not live.');

const reports: ConfigReport[] = [];
for (const name of configs) {
  const cfg = loadConfig(name);
  process.stderr.write(`${name} ... `);
  const runs = seeds.map((s) => observeRun(pool, cards, cfg, s));
  const c2 = leanWriterControl(runs);
  const c3 = powerControl(runs);
  const checks = eraChecks(runs, cfg.game.maxYears);
  const formation = checks.find((c) => c.id === 'settlement-formation')!;
  const pre = preconditions(
    formation.verdict === 'HEALTHY', c2.movementDetected, c3.concentrated, c1.passed,
  );
  reports.push({
    config: name,
    maxYears: cfg.game.maxYears,
    agents: pool,
    games,
    meanGameYears: mean(runs.map((r) => r.years.length)),
    checks,
    controls: [c1.check, c2.check, c3.check],
    quadrants: quadrantCoverage(runs, pre),
    pre,
  });
  process.stderr.write('done\n');
}

const sha = (() => {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
})();
const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const md = renderReport(reports, stamp, sha);

mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
const out = new URL(`../reports/skowronek-${stamp.replace(/[:]/g, '')}.md`, import.meta.url);
writeFileSync(out, md);
console.error(`wrote ${out.pathname}`);
