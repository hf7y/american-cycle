/** Findings are rejected if they are malformed.
 *
 *  The rule this enforces: a finding that recommends a shipped config must
 *  CHECK that config. Declaring `dependsOn: ['x.json']` obliges the predicate
 *  to carry a zero-tolerance claim that reads x.json back from disk, so the
 *  config cannot drift away from the evidence that justifies it.
 *
 *  Everything else here is shape: a finding without a question, a headline, a
 *  stamp or a verdict is prose wearing a module's clothes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import type { Finding } from './types.ts';

const dir = new URL('./', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'types.ts' && !f.endsWith('.test.ts'));

/** Predicates play hundreds of games each. Run every one ONCE and share the
 *  result, or this file costs as much as the whole findings suite per test. */
const loaded = new Map<string, Finding>();
const claimsOf = new Map<string, Awaited<ReturnType<Finding['predicate']>>>();

async function all() {
  if (loaded.size) return;
  for (const f of files) {
    const mod = await import(new URL(f, dir).href) as { finding?: Finding };
    if (!mod.finding) continue;
    loaded.set(f, mod.finding);
    claimsOf.set(f, await mod.finding.predicate());
  }
}

test('every finding module exports a finding', async () => {
  assert.ok(files.length > 0, 'no findings found at all');
  for (const f of files) {
    const mod = await import(new URL(f, dir).href) as { finding?: Finding };
    assert.ok(mod.finding, `${f} exports no \`finding\``);
  }
  await all();
});

test('every finding is well formed', async () => {
  await all();
  for (const [f, finding] of loaded) {
    const where = `${f} (${finding.id})`;
    assert.match(finding.id, /^[a-z0-9-]+$/, `${where}: id must be kebab-case`);
    assert.ok(finding.question.length > 20, `${where}: question is too short to be a question`);
    assert.ok(finding.headline.length > 40, `${where}: headline is too short to be a claim`);
    assert.ok(!Number.isNaN(Date.parse(finding.stampedAt)), `${where}: stampedAt does not parse`);
    assert.ok(finding.stampedOn.length > 0, `${where}: stampedOn is empty`);
    assert.equal(typeof finding.predicate, 'function', `${where}: predicate is not callable`);
    assert.equal(typeof finding.verdict, 'function', `${where}: verdict is not callable`);
    assert.ok(Array.isArray(finding.dependsOn), `${where}: dependsOn must be declared, [] if none`);
  }
});

test('a declared config dependency exists and is checked by a zero-tolerance claim', async () => {
  await all();
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

test('claims are measurable: finite values and a sane tolerance', async () => {
  await all();
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
