/** Generates docs/rules.html from the engine's own source of truth, the way
 *  ui/build.ts generates ui/index.html from the engine (#68). The prose
 *  scaffolding is hand-written in docs/rules.template.html; every value,
 *  table and threshold in it is interpolated here from a runtime config or
 *  export -- never typed into the template by hand -- so a rule that
 *  changes in engine/ cannot go stale in a document nobody re-derives.
 *
 *  HTML, not Markdown: hf7y/etalon's prose guard prices every committed .md
 *  file as prose against `.prose-ratchet`, a shrink-only ratchet -- exactly
 *  the reason ui/index.html (also generated, also player-facing) is .html
 *  and not .md. A rules PAGE costs nothing there; a rules DOCUMENT would
 *  have silently broken the next PR's prose gate.
 *
 *  CI diffs the committed docs/rules.html against a fresh run of this file,
 *  identically to how it diffs ui/index.html (#68's own requirement: "CI
 *  gates it the way it gates the bundle").
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { oddsAtEdge, primaryOddsAtEdge } from '../engine/rules/resolution.ts';
import { TAGS } from '../engine/rules/tags.ts';
import { PRIORITY } from '../engine/rules/lean.ts';
import { STATES } from '../engine/states.ts';
import type { Config } from '../engine/game.ts';

const root = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

const CONFIG_NAME = 'as-written-plus';
const cfg: Config = JSON.parse(read(`engine/config/${CONFIG_NAME}.json`));

const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
const table = (head: string[], rows: string[][]): string =>
  '<table><tr>' + head.map((h) => `<th>${h}</th>`).join('') + '</tr>'
  + rows.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('')
  + '</table>';

function oddsTable(fn: (edge: number) => number): string {
  const edges = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return table(['modifier edge (pips)', 'win probability'], edges.map((e) => [`+${e}`, pct(fn(e), 1)]));
}

/** `pushByMargin` is a list of `{maxPips, push}` rows read in order (see
 *  `pushForMargin`); render it as the margin BANDS a player actually sees. */
function pushTable(cfg: Config): string {
  const rows = cfg.lean.pushByMargin.map((r, i, arr) => {
    const lo = i === 0 ? 0 : arr[i - 1].maxPips + 1;
    const label = r.maxPips >= 90 ? `${lo}+` : lo === r.maxPips ? `${r.maxPips}` : `${lo}-${r.maxPips}`;
    return [label, String(r.push)];
  });
  return table(['winning margin (pips)', 'lean push'], rows);
}

function scoringTable(cfg: Config): string {
  const office = cfg.scoring.office;
  return table(['what you hold', 'points'], [
    ['the presidency', String(office.president)],
    ['a Senate seat', String(office.senator)],
    ['a governorship', String(office.governor)],
    ['a House seat', String(office.representative)],
    ['a bill still on the books', String(cfg.scoring.billOnBooks)],
    ['a state currently leaning your way', String(cfg.scoring.leanCounter)],
    ['a ratified amendment matching your tags', String(cfg.scoring.amendmentMatch)],
    ['a district card you hold', String(cfg.scoring.districtPlayed)],
    ['a card still in your hand', String(cfg.scoring.cardInHand)],
  ]);
}

/** The `Victory` union is a TS type, not a runtime value -- read its members
 *  out of the source text rather than copying the list into this file, so a
 *  mode added or removed in engine/game.ts shows up here without a second edit. */
function victoryModes(gameTs: string): string[] {
  const m = /export type Victory = ([^;]+);/.exec(gameTs);
  if (!m) throw new Error('docs/build.ts: could not find `export type Victory =` in engine/game.ts');
  return m[1].split('|').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

function billTargetDefault(gameTs: string): number {
  const m = /billTarget\s*\?\?\s*(\d+)/.exec(gameTs);
  if (!m) throw new Error('docs/build.ts: could not find the billTarget default in engine/game.ts');
  return Number(m[1]);
}

function victoryTable(gameTs: string, cfg: Config): string {
  const billTarget = cfg.game.billTarget ?? billTargetDefault(gameTs);
  const prose: Record<string, string> = {
    points: 'no earned ending &mdash; play runs out the year cap and the highest score wins.',
    bills: `first player to author ${billTarget} enacted bills (config <code>billTarget</code>, default ${billTargetDefault(gameTs)}).`,
    'two-terms': 'two CONSECUTIVE presidential terms for one player.',
    'three-terms': 'three presidential terms for one player, need not be consecutive.',
    parallel: `either the bills target (${billTarget}) or two consecutive terms, whichever a player reaches first.`,
    amendment: 'the amendment ratifies &mdash; see below. Not a player win: the game ends and the epilogue score decides.',
  };
  const modes = victoryModes(gameTs);
  const rows = modes.map((v) => [`<code>${v}</code>`, prose[v] ?? '<em>(undocumented -- docs/build.ts has no prose for this mode)</em>']);
  const current = cfg.game.victory;
  return `<p><code>${CONFIG_NAME}</code> ships <code>victory: "${current}"</code>. `
    + `All modes the engine knows:</p>${table(['mode', 'what ends the game'], rows)}`;
}

const GAME_TS = read('engine/game.ts');

const amendmentCall = Math.ceil(STATES.length * cfg.amendment.callFraction);
const amendmentRatify = Math.ceil(STATES.length * cfg.amendment.ratifyFraction);
const amendmentBlock = STATES.length - amendmentRatify + 1;

const substitutions: Record<string, string> = {
  CONFIG_NAME,
  HAND_SIZE: String(cfg.hand.base),
  GENERAL_ODDS: oddsTable(oddsAtEdge),
  PRIMARY_ODDS: oddsTable(primaryOddsAtEdge),
  PUSH_TABLE: pushTable(cfg),
  OFFICE_PRIORITY: PRIORITY.join(' &gt; '),
  TAG_LIST: TAGS.join(', '),
  SENATE_PASSAGE: pct(cfg.legislature.senatePassage),
  VETO_OVERRIDE: pct(cfg.legislature.vetoOverride, 1),
  IMPEACH_THRESHOLD: pct(cfg.legislature.impeachThreshold, 1),
  SCORING_TABLE: scoringTable(cfg),
  VICTORY_TABLE: victoryTable(GAME_TS, cfg),
  AMENDMENT_CALL: String(amendmentCall),
  AMENDMENT_RATIFY: String(amendmentRatify),
  AMENDMENT_BLOCK: String(amendmentBlock),
};

let out = read('docs/rules.template.html');
for (const [key, value] of Object.entries(substitutions)) {
  const token = `{{${key}}}`;
  if (!out.includes(token)) throw new Error(`docs/build.ts: template has no ${token} placeholder -- unused substitution`);
  out = out.split(token).join(value);
}
const leftover = out.match(/\{\{[A-Z_]+\}\}/);
if (leftover) throw new Error(`docs/build.ts: ${leftover[0]} in template has no substitution`);

writeFileSync(new URL('docs/rules.html', root), out);
console.log(`docs/rules.html  ${(out.length / 1024).toFixed(0)} KB`);
