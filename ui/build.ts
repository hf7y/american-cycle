/** Bundles the engine into one self-contained HTML file.
 *
 *  No bundler dependency: Node's own stripTypeScriptTypes turns each module
 *  into JS, and the modules are concatenated in dependency order with their
 *  import/export syntax removed. That works because the engine has no default
 *  exports, no circular runtime dependencies, and (after the rename pass) no
 *  colliding module-private names. Card packs and configs are inlined as JSON
 *  so the page needs no network at all.
 */
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const ORDER = [
  'engine/states.ts',
  'engine/rules/rng.ts',
  'engine/rules/resolution.ts',
  'engine/rules/lean.ts',
  'engine/rules/economy.ts',
  'engine/rules/legislature.ts',
  'engine/rules/tags.ts',
  'engine/rules/amendment.ts',
  'engine/rules/scoring.ts',
  'engine/rules/elections.ts',
  'engine/game.ts',
  'sim/agents.ts',
];

const root = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

/** Remove import/export syntax so the modules can share one scope.
 *  A line-by-line state machine, because imports and re-export blocks span
 *  several lines and a per-line filter leaks their middles as bare statements. */
function flatten(src: string): string {
  const lines = stripTypeScriptTypes(src, { mode: 'strip' }).split('\n');
  const out: string[] = [];
  let skipUntilFrom = false, skipUntilBrace = false;
  for (const line of lines) {
    if (skipUntilFrom) { if (/from\s*['"][^'"]*['"]\s*;?\s*$/.test(line)) skipUntilFrom = false; continue; }
    if (skipUntilBrace) { if (/\}/.test(line)) skipUntilBrace = false; continue; }
    if (/^\s*import\s/.test(line)) {
      if (!/from\s*['"][^'"]*['"]\s*;?\s*$/.test(line)) skipUntilFrom = true;
      continue;
    }
    if (/^\s*export\s*\{/.test(line)) {          // re-export block
      if (!/\}/.test(line)) skipUntilBrace = true;
      continue;
    }
    out.push(line.replace(/^(\s*)export\s+(?=(const|let|var|function|class|async|\*))/, '$1'));
  }
  return out.join('\n');
}

// engine/rules/economy.ts imports nothing at runtime except types; the
// multi-line `import { a, b } from` forms are dropped by the two filters above.
/** `export` names, before flatten() strips the keyword. Needed to rebuild
 *  namespace imports below. */
function exportedNames(src: string): string[] {
  const out: string[] = [];
  for (const line of src.split('\n')) {
    const m = /^export\s+(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

const sources = new Map(ORDER.map((f) => [f, read(f)]));

/** `import * as econ from './rules/economy.ts'` has no meaning once every
 *  module shares one scope, and flatten() drops the line -- so `econ.walk(...)`
 *  threw at runtime and the board died on the first click. Rebuild each
 *  namespace as a plain object over the names that module exported. */
const namespaces: string[] = [];
const seenNs = new Set<string>();
for (const src of sources.values()) {
  for (const m of src.matchAll(/^import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+'([^']+)'/gm)) {
    const [, alias, spec] = m;
    if (seenNs.has(alias)) continue;
    const target = [...sources.keys()].find((f) => f.endsWith(spec.replace(/^\.\.?\//, '').replace(/^rules\//, 'rules/')))
      ?? [...sources.keys()].find((f) => f.endsWith(spec.split('/').pop()!));
    if (!target) throw new Error(`ui/build.ts: cannot resolve namespace import '${spec}'`);
    const names = exportedNames(sources.get(target)!);
    if (!names.length) throw new Error(`ui/build.ts: namespace '${alias}' resolves to no exported names`);
    seenNs.add(alias);
    namespaces.push(`const ${alias} = { ${names.join(', ')} };`);
  }
}

const engine = ORDER.map((f) => `// ---- ${f} ----\n${flatten(sources.get(f)!)}`).join('\n\n')
  + `\n\n// ---- namespace imports, rebuilt ----\n${namespaces.join('\n')}\n`;

const packs: Record<string, unknown> = {};
for (const f of readdirSync(new URL('data/', root))) {
  // pack-*.json ONLY. Globbing every .json here swallowed portraits.json as if
  // it were a pack and inlined half a megabyte of faces a second time.
  if (!f.startsWith('pack-') || !f.endsWith('.json')) continue;
  packs[f.replace(/^pack-|\.json$/g, '')] = JSON.parse(read(`data/${f}`));
}
let portraits = '{}';
try { portraits = read('data/portraits.json'); } catch { /* portraits are optional */ }

const configs: Record<string, unknown> = {};
for (const f of readdirSync(new URL('engine/config/', root))) {
  if (f.endsWith('.json')) configs[f.replace(/\.json$/, '')] = JSON.parse(read(`engine/config/${f}`));
}

const html = read('ui/index.template.html')
  .replace('/*__ENGINE__*/', engine)
  .replace('/*__PACKS__*/', `const PACKS = ${JSON.stringify(packs)};`)
  .replace('/*__CONFIGS__*/', `const CONFIGS = ${JSON.stringify(configs)};\nconst PORTRAITS = ${portraits};`)
  .replace('/*__APP__*/', read('ui/app.js'));

/** Every <script> block shares one global lexical scope, so a `const` in the
 *  engine and a `const` of the same name in the app collide at parse time and
 *  the page renders BLANK -- which is exactly what shipped until a browser
 *  playtest caught `S` (the engine's state-row builder against the app's UI
 *  state). Nothing in the type system or the tests can see this, so the
 *  bundler checks it. */
function topLevelNames(src: string): Set<string> {
  const out = new Set<string>();
  for (const line of src.split('\n')) {
    const d = /^(?:const|let|var)\s+(.*)$/.exec(line);
    if (d) {
      let depth = 0, cur = '';
      for (const ch of d[1]) {
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) depth--;
        if (ch === ',' && depth === 0) { out.add(cur.trim().split('=')[0].trim()); cur = ''; }
        else cur += ch;
      }
      if (cur.trim()) out.add(cur.trim().split('=')[0].trim());
    }
    const f = /^(?:function|class)\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (f) out.add(f[1]);
  }
  return new Set([...out].filter((n) => /^[A-Za-z_$][\w$]*$/.test(n)));
}
const engineNames = topLevelNames(engine);
const appNames = topLevelNames(read('ui/app.js'));
const clash = [...engineNames].filter((n) => appNames.has(n));
if (clash.length) {
  throw new Error(`ui/build.ts: ${clash.length} identifier(s) declared in BOTH the engine and the app: `
    + `${clash.join(', ')}. Script blocks share one global scope, so this renders a blank page. Rename one side.`);
}

writeFileSync(new URL('ui/index.html', root), html);
console.log(`ui/index.html  ${(html.length / 1024).toFixed(0)} KB`);
