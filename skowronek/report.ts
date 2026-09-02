/** The markdown report.
 *
 *  Ordering is deliberate. The diagnosis — which precondition never occurred —
 *  comes BEFORE the verdict table, because on this build the verdict column is
 *  mostly the word BLOCKED and the interesting content is why. Every measured
 *  value is printed with its n and standard error next to its verdict, so no
 *  reader can take a verdict without the number that produced it (#22).
 */
import type { Check, Measure, PreconditionState, Precondition } from './checks.ts';
import { QUADRANT_NEEDS } from './checks.ts';

const f = (x: number, d = 3): string => (Number.isFinite(x) ? x.toFixed(d) : '—');

const fmt = (m: Measure): string => {
  if (!Number.isFinite(m.value)) return `— (n=${m.n})`;
  const se = Number.isFinite(m.se) ? ` ± ${f(m.se)}` : '';
  return `${f(m.value)}${se} (n=${m.n})${m.unit ? ` ${m.unit}` : ''}`;
};

export interface ConfigReport {
  config: string;
  maxYears: number;
  agents: string[];
  games: number;
  meanGameYears: number;
  checks: Check[];
  controls: Check[];
  quadrants: Check[];
  pre: PreconditionState[];
}

function preconditionTable(pre: PreconditionState[]): string {
  const rows = pre.map((p) => `| \`${p.id}\` | ${p.status.replace(/_/g, ' ')} | ${p.why} |`);
  return ['| precondition | status | basis |', '| --- | --- | --- |', ...rows].join('\n');
}

function diagnosis(r: ConfigReport): string {
  const byId = new Map(r.pre.map((p) => [p.id, p]));
  const out: string[] = ['### Why each quadrant is unreachable', ''];
  for (const [q, needs] of Object.entries(QUADRANT_NEEDS)) {
    const missing = needs.filter((n) => byId.get(n)?.status !== 'MET');
    if (!missing.length) { out.push(`- **${q}** — preconditions met; see the verdict table.`); continue; }
    const first = byId.get(missing[0] as Precondition)!;
    out.push(`- **${q}** — blocked by ${missing.map((m) => `\`${m}\``).join(', ')}.`);
    out.push(`  - First missing: ${first.why}`);
    out.push(`  - Control: ${first.control ?? 'none'}`);
  }
  return out.join('\n');
}

function checkBlock(c: Check): string {
  const lines = [`#### ${c.id} — **${c.verdict}**`, '', `*${c.question}*`, ''];
  const rows = Object.entries(c.measures).map(([k, m]) => `| ${k} | ${fmt(m)} |`);
  lines.push('| measure | value |', '| --- | --- |', ...rows, '');
  if (c.blockedBy?.length) lines.push(`Blocked by: ${c.blockedBy.map((b) => `\`${b}\``).join(', ')}`, '');
  lines.push(c.note, '');
  return lines.join('\n');
}

export function renderConfig(r: ConfigReport): string {
  const verdictRow = (c: Check) => `| \`${c.id}\` | ${c.verdict} | ${Object.entries(c.measures)
    .slice(0, 1).map(([k, m]) => `${k}: ${fmt(m)}`).join('')} |`;
  return [
    `## ${r.config}`,
    '',
    `${r.games} games, agents \`${r.agents.join(',')}\`, year cap ${r.maxYears}, mean game length ${f(r.meanGameYears, 1)}y.`,
    '',
    '### Verdict table',
    '',
    '| check | verdict | headline measure |',
    '| --- | --- | --- |',
    ...[...r.controls, ...r.checks, ...r.quadrants].map(verdictRow),
    '',
    '### Preconditions',
    '',
    preconditionTable(r.pre),
    '',
    diagnosis(r),
    '',
    '### Controls',
    '',
    ...r.controls.map(checkBlock),
    '### Era checks',
    '',
    ...r.checks.map(checkBlock),
    '### Quadrant coverage',
    '',
    ...r.quadrants.map(checkBlock),
  ].join('\n');
}

export interface RunParams { games: number; pool: string[]; packs: string[]; configs: string[] }

export function renderReport(
  reports: ConfigReport[], stamp: string, sha: string, p: RunParams,
): string {
  const head = [
    '# Skowronek suite — does american-cycle produce political time?',
    '',
    `Run ${stamp} on \`${sha}\`.`,
    '',
    'Regenerate with:',
    '',
    '```',
    `npm run skowronek -- --games ${p.games} --agents ${p.pool.join(',')} --packs ${p.packs.join(',')}`,
    '```',
    '',
    'These are **design targets, not regressions**. They are expected to fail on the current build and are',
    'meant to keep failing until the design changes. This suite is not in `npm test` and not in the blocking',
    'CI job; it is invoked by hand with `npm run skowronek`.',
    '',
    'Read the **preconditions** and **diagnosis** sections before the verdict column. On a build where the',
    'settlement object does not exist, most verdicts are `BLOCKED`, which is an *undefined*, not a zero.',
    '',
    '## Summary across configs',
    '',
    '| config | cap | mean length | settlement forms? | movement? | power concentrates? | quadrants reachable |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...reports.map((r) => {
      const st = (id: string) => r.pre.find((p) => p.id === id)?.status === 'MET' ? 'yes' : 'no';
      const reachable = r.quadrants.filter((q) => q.verdict !== 'BLOCKED').length;
      return `| \`${r.config}\` | ${r.maxYears}y | ${f(r.meanGameYears, 1)}y | ${st('SETTLEMENT_FORMATION')} `
        + `| ${st('SETTLEMENT_MOVEMENT')} | ${st('POWER_CONCENTRATION')} | ${reachable}/4 |`;
    }),
    '',
  ];
  return [...head, ...reports.map(renderConfig)].join('\n');
}
