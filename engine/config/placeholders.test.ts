/** Guards against the disease `design-doc.md` had: a value printed twice, with
 *  nothing keeping the two copies equal. `placeholders` exists to say "this
 *  field was never specified; the value here is a stand-in" -- meta-information
 *  about a decision, not a restatement of one. See hf7y/american-cycle#70.
 *
 *  Two guards:
 *
 *  1. Every placeholder key must resolve to a real config path (exact match,
 *     or `prefix.*` where `prefix` is a real object path). A key that resolves
 *     to nothing is prose describing a field that was renamed or deleted out
 *     from under it -- drift nobody would notice, in the file that is
 *     supposed to document itself.
 *
 *  2. Placeholder prose may not contain a numeric literal. A number there is
 *     either restating a value that lives a few lines away in the same file
 *     (drift by construction), or quoting a measurement that belongs in
 *     `findings/`, where a predicate re-derives it instead of a comment
 *     asserting it once. This can't land as a hard zero yet -- 19 of the 27
 *     placeholders in `as-written-plus.json` carry one today -- so it ships as
 *     a ratchet: the count may fall, never rise. Lower CEILING as violations
 *     are moved into findings or cut; do not raise it to make a new violation
 *     pass.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
const configFiles = readdirSync(dir).filter((f) => f.endsWith('.json'));

type Json = { [k: string]: Json } | Json[] | string | number | boolean | null;
const isPlainObject = (v: unknown): v is Record<string, Json> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every dot path a real (non-placeholder) config value lives at, including
 *  the intermediate object paths -- `"economy"` is a valid resolution target
 *  in its own right, which is what makes `economy.*` a legal wildcard. */
function realPaths(cfg: Record<string, Json>): Set<string> {
  const paths = new Set<string>();
  const walk = (o: Record<string, Json>, prefix: string) => {
    for (const [k, v] of Object.entries(o)) {
      const p = prefix ? `${prefix}.${k}` : k;
      paths.add(p);
      if (isPlainObject(v)) walk(v, p);
    }
  };
  walk(cfg, '');
  return paths;
}

const resolves = (key: string, paths: Set<string>): boolean =>
  paths.has(key) || (key.endsWith('.*') && paths.has(key.slice(0, -2)));

test('every placeholder key resolves to a real config path', () => {
  for (const f of configFiles) {
    const cfg = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Record<string, Json>;
    const placeholders = cfg.placeholders;
    if (!isPlainObject(placeholders)) continue;
    const { placeholders: _omit, ...rest } = cfg;
    const paths = realPaths(rest);
    const orphans = Object.keys(placeholders).filter((k) => !resolves(k, paths));
    assert.deepEqual(orphans, [],
      `${f}: placeholder key(s) resolve to no config path -- renamed or deleted field left its prose behind: ${orphans.join(', ')}`);
  }
});

/** A trailing digit inside a version-shaped word like "v0.2" or a bare cross-
 *  reference isn't a restated magnitude, but a plain digit run is exactly the
 *  thing this guard exists to catch, and the ratchet only ever tightens --
 *  so no exemption list here. Widen it only by moving a violation into
 *  findings/ or cutting it, never by pattern-matching around a new one. */
const hasNumericLiteral = (prose: string): boolean => /\d/.test(prose);

/** Recorded 2026-09-02, the day the guard was built (hf7y/american-cycle#70):
 *  145 numeric-literal placeholders summed across all nine configs (16-17
 *  each), after fixing the two orphan keys (hand.bonus*, game.victory
 *  (ties)) also found by that issue. Lower this as placeholders are
 *  rewritten to drop the numbers they restate; raising it defeats the
 *  guard. */
const CEILING = 145;

test('placeholder prose carries no numeric literal, and the count never rises', () => {
  let total = 0;
  const perFile: Record<string, number> = {};
  for (const f of configFiles) {
    const cfg = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Record<string, Json>;
    const placeholders = cfg.placeholders;
    if (!isPlainObject(placeholders)) continue;
    const violating = Object.values(placeholders).filter((v) => typeof v === 'string' && hasNumericLiteral(v));
    perFile[f] = violating.length;
    total += violating.length;
  }
  assert.ok(total <= CEILING,
    `${total} placeholders carry a numeric literal, ceiling is ${CEILING} (${JSON.stringify(perFile)}). `
    + 'A number in a placeholder restates a value that lives elsewhere in the same file, or a measurement '
    + 'that belongs in findings/. Move it or cut it -- do not raise the ceiling.');
});
