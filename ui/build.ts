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
const engine = ORDER.map((f) => `// ---- ${f} ----\n${flatten(read(f))}`).join('\n\n');

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

writeFileSync(new URL('ui/index.html', root), html);
console.log(`ui/index.html  ${(html.length / 1024).toFixed(0)} KB`);
