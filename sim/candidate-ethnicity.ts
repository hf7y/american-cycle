/** #164 part 5: "richer tagged data for politicians ... from more than one
 *  source (wikipedia even could work)". Part 3 sourced district `black` and
 *  `hispanic` from census ACS; every CANDIDATE's identities are still 100%
 *  hand-assigned (#212's provenance backfill stamped them all
 *  `hand-assigned`, and nothing since has touched that side).
 *
 *  Religion is deliberately NOT attempted here. Wikidata's P140 for a
 *  politician typically resolves to a specific denomination ("Baptist",
 *  "United Methodist"...), and bucketing ~200 denomination names into
 *  catholic/evangelical/jewish is exactly the RELTRAD judgment call #240
 *  already opened for the district side. Building a second, independent
 *  answer to the same open question here would pre-empt that decision
 *  rather than inform it.
 *
 *  Ethnicity is attempted because it doesn't have that problem: Wikidata's
 *  P172 (ethnic group) resolves to values that map onto `black`/`hispanic`/
 *  `cuban` by simple substring match, sourced and reference-carrying (see
 *  any candidate's `groups` in the built panel for the raw labels).
 *
 *  Grain: this is per-PERSON, not per-era -- a real person's ethnicity does
 *  not change between their 1992 card and their 2008 card, so the panel is
 *  built once per unique name and applied to every era's pack.
 *
 *  ADDITIVE ONLY, like district-demographics.ts: this never removes a
 *  hand-assigned tag Wikidata doesn't confirm. It reports the disagreement
 *  instead (see --apply's "disagreements" section) -- some of those turn out
 *  to be the hand-assigned tag meaning something looser than literal
 *  ethnicity (e.g. Tim Kaine's `hispanic`, which the record backing it is
 *  about fluency and missionary years in Honduras, not descent), which is a
 *  finding about the vocabulary, not a data error this script should
 *  silently resolve.
 *
 *  node sim/candidate-ethnicity.ts --build     -- query Wikidata, write the panel (network)
 *  node sim/candidate-ethnicity.ts             -- coverage + disagreement report (no network)
 *  node sim/candidate-ethnicity.ts --apply     -- rewrite every data/pack-*.json in place
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

export const PANEL = 'data/historical/wikidata_candidate_ethnicity.json';
const PACKS = readdirSync('data').filter((f) => f.startsWith('pack-') && f.endsWith('.json')).map((f) => `data/${f}`);
const UA = 'american-cycle-research/1.0 (https://github.com/hf7y/american-cycle; #164 part 5)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wikidata throttles unauthenticated bursts (confirmed live: a handful of
 *  requests inside ~2s drew "You are making too many requests", recovered
 *  within ~20s). Paced at ~700ms between calls plus backoff retry so a build
 *  run of ~290 names, each 2+ requests, degrades to slower rather than
 *  failing outright. */
async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await sleep(700);
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      if (attempt >= 4) throw new Error(`Wikidata request failed after retries: ${url}\n${text.slice(0, 200)}`);
      const backoff = 5000 * (attempt + 1);
      console.log(`  throttled, backing off ${backoff}ms (attempt ${attempt + 1})`);
      await sleep(backoff);
    }
  }
}

/** Labels observed in practice, matched by substring so a subgroup neither of
 *  us has seen yet (e.g. a specific Mexican-American or Puerto Rican entry)
 *  still resolves instead of silently dropping. Order matters: Cuban American
 *  is checked before the general Hispanic/Latino match so a person gets both
 *  tags, matching how Marco Rubio is hand-assigned (`cuban`, no separate
 *  `hispanic`) -- this script still emits both where Wikidata says both, and
 *  leaves reconciling that convention to whoever reviews the report. */
function classify(labels: string[]): Set<'black' | 'hispanic' | 'cuban'> {
  const out = new Set<'black' | 'hispanic' | 'cuban'>();
  for (const l of labels) {
    if (/african[\s-]american|black american/i.test(l)) out.add('black');
    if (/cuban/i.test(l)) out.add('cuban');
    if (/hispanic|latino|latina|mexican american|puerto rican|dominican american|salvadoran american|colombian american/i.test(l)) out.add('hispanic');
  }
  return out;
}

interface PanelRow { id: string; name: string; qid: string | null; groups: string[] }

function candidates(): { id: string; name: string; identities: string[] }[] {
  const byName = new Map<string, { id: string; name: string; identities: string[] }>();
  for (const path of PACKS) {
    const pack = JSON.parse(readFileSync(path, 'utf8'));
    for (const c of pack.cards ?? pack) {
      if (c.kind !== 'candidate') continue;
      if (!byName.has(c.name)) byName.set(c.name, { id: c.id, name: c.name, identities: c.identities ?? [] });
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const POLITICIAN_HINT = /senator|representative|governor|president|vice president|congress|politician|mayor|attorney general|secretary of state|diplomat|activist|civil rights/i;

async function searchQid(name: string): Promise<{ qid: string; desc: string } | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&limit=8`;
  const json = await fetchJson<{ search: { id: string; label?: string; description?: string }[] }>(url);
  for (const hit of json.search) {
    if ((hit.label ?? '').toLowerCase() !== name.toLowerCase()) continue;
    if (POLITICIAN_HINT.test(hit.description ?? '')) return { qid: hit.id, desc: hit.description ?? '' };
  }
  return null;
}

async function build(): Promise<void> {
  const cands = candidates();
  const rows: PanelRow[] = [];
  const unmatched: string[] = [];
  const labelCache = new Map<string, string>();

  for (const c of cands) {
    const hit = await searchQid(c.name);
    if (!hit) { unmatched.push(c.name); rows.push({ id: c.id, name: c.name, qid: null, groups: [] }); continue; }
    const claimsUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${hit.qid}&property=P172&format=json`;
    const claims = await fetchJson<{ claims?: { P172?: { mainsnak: { datavalue?: { value?: { id: string } } } }[] } }>(claimsUrl);
    const qids = (claims.claims?.P172 ?? [])
      .map((s) => s.mainsnak.datavalue?.value?.id)
      .filter((x): x is string => !!x);
    const labels: string[] = [];
    for (const qid of qids) {
      if (!labelCache.has(qid)) {
        const labUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels&languages=en&format=json`;
        const labJson = await fetchJson<{ entities: Record<string, { labels?: { en?: { value: string } } }> }>(labUrl);
        labelCache.set(qid, labJson.entities[qid]?.labels?.en?.value ?? qid);
      }
      labels.push(labelCache.get(qid)!);
    }
    rows.push({ id: c.id, name: c.name, qid: hit.qid, groups: labels });
  }

  const panel = {
    note: '#164 part 5: candidate ethnicity, sourced from Wikidata P172 (ethnic group). One row per unique candidate NAME (a real person\'s ethnicity is era-invariant) -- apply matches every pack card by name. `groups` is the raw Wikidata label set; classify() in this file maps it onto black/hispanic/cuban.',
    source: {
      dataset: 'Wikidata',
      property: { P172: 'ethnic group' },
      matching: 'wbsearchentities by exact-label name, accepted only when the result description matches a politician/public-office hint pattern (see POLITICIAN_HINT in this file) -- a precaution against name collisions with unrelated Wikidata entries.',
      url: 'https://www.wikidata.org/w/api.php',
      retrieved: '2026-09-08',
    },
    unmatched,
    rows,
  };
  writeFileSync(PANEL, JSON.stringify(panel, null, 2) + '\n');
  console.log(`built ${PANEL}: ${rows.length} candidates, ${unmatched.length} unmatched (no confident Wikidata match)`);
}

function loadPanel(): PanelRow[] {
  const panel = JSON.parse(readFileSync(PANEL, 'utf8')) as { rows: PanelRow[] };
  return panel.rows;
}

function apply(): void {
  const byName = new Map(loadPanel().map((r) => [r.name, r]));
  let matched = 0, added = 0, upgraded = 0;
  const disagreements: string[] = [];
  const additions: string[] = [];

  for (const path of PACKS) {
    const pack = JSON.parse(readFileSync(path, 'utf8'));
    const cards = pack.cards ?? pack;
    let touched = false;
    for (const c of cards) {
      if (c.kind !== 'candidate') continue;
      const row = byName.get(c.name);
      if (!row || !row.qid) continue;
      matched++;
      const found = classify(row.groups);
      c.provenance = c.provenance ?? {};
      c.identities = c.identities ?? [];
      for (const tag of found) {
        const has = c.identities.includes(tag);
        if (!has) {
          c.identities.push(tag);
          added++;
          additions.push(`  +${tag} ${c.id} (wikidata: ${row.groups.join(', ')})`);
          touched = true;
        }
        if (c.provenance[tag]?.source !== 'wikidata') {
          c.provenance[tag] = { source: 'wikidata', vintage: '2026-09-08' };
          upgraded++;
          touched = true;
        }
      }
      for (const tag of ['black', 'hispanic', 'cuban'] as const) {
        if (c.identities.includes(tag) && !found.has(tag)) {
          disagreements.push(`  ${c.id} carries hand-assigned '${tag}' -- Wikidata ethnic groups are [${row.groups.join(', ') || 'none'}]`);
        }
      }
    }
    if (touched) writeFileSync(path, JSON.stringify(pack, null, 2) + '\n');
  }

  console.log(`${matched} candidate-cards matched to a Wikidata person, ${added} tags added, ${upgraded} provenance entries stamped 'wikidata'`);
  if (additions.length) { console.log('additions:'); for (const a of additions) console.log(a); }
  if (disagreements.length) {
    console.log(`\n${disagreements.length} hand-assigned tag(s) Wikidata's P172 does not confirm (left as-is -- additive only):`);
    for (const d of disagreements) console.log(d);
  }
}

function report(): void {
  const rows = loadPanel();
  const withQid = rows.filter((r) => r.qid);
  console.log(`panel: ${rows.length} unique candidates, ${withQid.length} matched to a Wikidata entity`);
  const tagCounts = { black: 0, hispanic: 0, cuban: 0 };
  for (const r of withQid) for (const t of classify(r.groups)) tagCounts[t]++;
  console.log('candidates classified by Wikidata P172:', tagCounts);
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes('--build')) { build(); return; }
  if (argv.includes('--apply')) { apply(); return; }
  report();
}

if (import.meta.url === `file://${process.argv[1]}`) main();
