/** Re-derive every finding from scratch and grade its stamped headline.
 *
 *  HOLDS  — the predicate still returns what the headline claims.
 *  STALE  — the engine moved. The headline is now historical; the predicate is
 *           the current truth. This is information, not an error.
 *  BROKEN — the predicate could not run at all.
 *
 *  `--restamp` rewrites the stamped values and dates in place, which is the
 *  only sanctioned way for a headline to change.
 *
 *  `FINDINGS_SEEDS=12` cuts every predicate's game count. That proves they
 *  all still RUN in a fraction of the time; it says nothing about whether a
 *  headline holds, because the stamps were taken at the full counts.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { Finding } from '../findings/types.ts';

const dir = new URL('../findings/', import.meta.url);
const restamp = process.argv.includes('--restamp');
const files = readdirSync(dir).filter((f) =>
  f.endsWith('.ts') && f !== 'types.ts' && f !== 'sample.ts' && !f.endsWith('.test.ts'));

const sha = (() => {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
})();

let stale = 0, broken = 0, held = 0;

for (const file of files.sort()) {
  const mod = await import(new URL(file, dir).href) as { finding: Finding };
  const f = mod.finding;
  process.stdout.write(`\n${f.id}\n  Q: ${f.question.replace(/\s+/g, ' ')}\n`);
  let claims;
  try { claims = await f.predicate(); }
  catch (e) { broken++; console.log(`  BROKEN — ${(e as Error).message}`); continue; }

  const drifted = claims.filter((c) => Math.abs(c.value - c.stamped) > c.tolerance);
  for (const c of claims) {
    const d = Math.abs(c.value - c.stamped);
    const mark = d > c.tolerance ? '  drift' : '       ';
    console.log(`   ${mark} ${c.name.padEnd(52)} ${c.value.toFixed(2).padStart(7)}  (stamped ${c.stamped}, ±${c.tolerance})`);
  }
  console.log(`  verdict: ${f.verdict(claims)}`);

  if (drifted.length) {
    stale++;
    console.log(`  STALE — ${drifted.length} of ${claims.length} claims moved past tolerance.`);
    console.log(`  headline stamped ${f.stampedAt} on ${f.stampedOn}; the predicate above is the current value.`);
    if (restamp) {
      const path = new URL(file, dir);
      let src = readFileSync(path, 'utf8');
      for (const c of claims) {
        const rounded = Number(c.value.toFixed(2));
        src = src.replace(
          new RegExp(`(name: '${c.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}'[^}]*stamped: )[-\\d.]+`),
          `$1${rounded}`);
      }
      src = src.replace(/stampedAt: '[^']*'/, `stampedAt: '${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}'`);
      src = src.replace(/stampedOn: '[^']*'/, `stampedOn: '${sha}'`);
      writeFileSync(path, src);
      console.log('  RESTAMPED.');
    }
  } else { held++; console.log('  HOLDS.'); }
}

console.log(`\n${held} hold, ${stale} stale, ${broken} broken.`);
if (broken) process.exit(1);
