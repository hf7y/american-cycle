/** Findings are rejected if they are malformed.
 *
 *  The rule this enforces: a finding that recommends a shipped config must
 *  CHECK that config. Declaring `dependsOn: ['x.json']` obliges the predicate
 *  to carry a zero-tolerance claim that reads x.json back from disk, so the
 *  config cannot drift away from the evidence that justifies it.
 *
 *  Everything else here is shape: a finding without a question, a headline, a
 *  stamp or a verdict is prose wearing a module's clothes.
 *
 *  The shape checks read the module and cost nothing. The two below them run
 *  every predicate, which plays hundreds of games apiece and takes minutes, so
 *  they only run under FINDINGS_DEEP=1. `FINDINGS_SEEDS` (see `sample.ts`)
 *  cuts the game counts if you want the deep pass cheaply.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { Claim, Finding } from './types.ts';

const dir = new URL('./', import.meta.url);
const files = readdirSync(dir).filter((f) =>
  f.endsWith('.ts') && f !== 'types.ts' && f !== 'sample.ts' && !f.endsWith('.test.ts'));

/** Importing a finding module is cheap: the measuring happens in `predicate`. */
const loaded = new Map<string, Finding>();
for (const f of files) {
  const mod = await import(new URL(f, dir).href) as { finding?: Finding };
  if (mod.finding) loaded.set(f, mod.finding);
}

/** Predicates play hundreds of games each. Run every one ONCE and share the
 *  result, or this file costs as much as the whole findings suite per test. */
const claimsOf = new Map<string, Claim[]>();
async function runPredicates() {
  if (claimsOf.size) return;
  for (const [f, finding] of loaded) claimsOf.set(f, await finding.predicate());
}

const skip = process.env.FINDINGS_DEEP === '1'
  ? false
  : 'needs every predicate to run — set FINDINGS_DEEP=1 (and FINDINGS_SEEDS to cut the game counts)';

test('every finding module exports a finding', () => {
  assert.ok(files.length > 0, 'no findings found at all');
  for (const f of files) assert.ok(loaded.has(f), `${f} exports no \`finding\``);
});

test('every finding is well formed', () => {
  for (const [f, finding] of loaded) {
    const where = `${f} (${finding.id})`;
    assert.match(finding.id, /^[a-z0-9-]+$/, `${where}: id must be kebab-case`);
    assert.ok(finding.question.length > 20, `${where}: question is too short to be a question`);
    assert.ok(finding.headline.length > 40, `${where}: headline is too short to be a claim`);
    assert.ok(!Number.isNaN(Date.parse(finding.stampedAt)), `${where}: stampedAt does not parse`);
    // A stamp names the ENGINE a headline was taken on, so it has to be a
    // commit. Five findings shipped `phase1-engine` -- a branch name, which
    // moves, and which `--restamp` could never fix because it only rewrites
    // findings that are STALE and these all HOLD.
    assert.match(finding.stampedOn, /^[0-9a-f]{7,40}$/,
      `${where}: stampedOn must be a commit sha, not ${JSON.stringify(finding.stampedOn)}. `
      + 'A branch name moves; a stamp that moves dates nothing.');
    assert.equal(typeof finding.predicate, 'function', `${where}: predicate is not callable`);
    assert.equal(typeof finding.verdict, 'function', `${where}: verdict is not callable`);
    assert.ok(Array.isArray(finding.dependsOn), `${where}: dependsOn must be declared, [] if none`);
  }
});

/** A sha-shaped stamp is not a sha this repo HAS. `contest-ratio` and
 *  `margin-ceiling` both shipped `75de16c` while it was unreachable in the
 *  clone that filed #64, and the shape check above admitted it, because it
 *  reads the shape of a stamp and never asks git. Resolving a stamp needs
 *  history a shallow checkout does not have, so this stands down when git
 *  cannot answer rather than failing for the wrong reason -- and the engine
 *  job fetches full history so that standing down is not the CI default. */
const noHistory = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--is-shallow-repository'],
      { encoding: 'utf8' }).trim() !== 'false' && 'shallow clone: no history to resolve a stamp against';
  } catch { return 'no git here to resolve a stamp against'; }
})();

test('every stamp names a commit this clone can reach', { skip: noHistory }, () => {
  for (const [f, finding] of loaded) {
    const reachable = (() => {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', finding.stampedOn, 'HEAD'], { stdio: 'ignore' });
        return true;
      } catch { return false; }
    })();
    assert.ok(reachable,
      `${f} (${finding.id}): stampedOn ${finding.stampedOn} is not an ancestor of HEAD. `
      + 'A stamp dates a headline to an engine; one nobody can check out dates it to nothing.');
  }
});

test('a declared config dependency exists and is checked by a zero-tolerance claim', { skip }, async () => {
  await runPredicates();
  for (const [f, finding] of loaded) {
    if (!finding.dependsOn.length) continue;
    const where = `${f} (${finding.id})`;
    const claims = claimsOf.get(f)!;
    for (const dep of finding.dependsOn) {
      assert.ok(existsSync(new URL(`../engine/config/${dep}`, dir)),
        `${where}: declares a dependency on ${dep}, which does not exist`);
      const checking = claims.filter((c) => c.name.includes(dep) && c.tolerance === 0);
      assert.ok(checking.length > 0,
        `${where}: declares a dependency on ${dep} but no claim reads it back with zero tolerance. `
        + 'A config a finding recommends must be checked by that finding, or the two drift apart.');
    }
  }
});

test('claims are measurable: finite values and a sane tolerance', { skip }, async () => {
  await runPredicates();
  for (const [f] of loaded) {
    const claims = claimsOf.get(f)!;
    assert.ok(claims.length > 0, `${f}: predicate returned no claims`);
    for (const c of claims) {
      assert.ok(Number.isFinite(c.value), `${f}: claim "${c.name}" produced ${c.value}`);
      assert.ok(Number.isFinite(c.stamped), `${f}: claim "${c.name}" has a non-finite stamp`);
      assert.ok(c.tolerance >= 0, `${f}: claim "${c.name}" has a negative tolerance`);
      assert.ok(c.name.length > 3, `${f}: a claim needs a name a human can read`);
    }
  }
});
