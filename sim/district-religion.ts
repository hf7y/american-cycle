/** #164 part 3: religion tags (`catholic`, `evangelical`, `jewish`) have no
 *  census source -- the Census Bureau does not collect religion, by law.
 *  #164's own thread named the US Religion Census (ASARB/Lilly Endowment,
 *  hosted via ARDA) as the fetchable alternative, and #239 built the
 *  county -> congressional-district crosswalk this needs. This file is the
 *  other mechanical half named there: county-grain adherent counts per
 *  named denomination, joined through that crosswalk to district grain.
 *
 *  What this file does NOT do: decide which of USRC's 375 denomination
 *  names count as catholic/evangelical/jewish for the game's cards. That is
 *  #240 -- a classification-scheme judgment call, not a data pull, still
 *  open. RELTRAD (the standard academic answer) does not drop into this
 *  engine's 3-tag vocabulary cleanly (no mainline/black-protestant slot).
 *
 *  Two of the three tags do have an essentially unambiguous single answer,
 *  reported below as CATHOLIC_GROUPS/JEWISH_GROUPS -- candidates for #240
 *  to confirm, not applied to any card by this file:
 *
 *    catholic -- "Catholic Church" alone. USRC separately tracks a dozen
 *                small independent/schismatic bodies that also use the word
 *                ("Old Catholic", "Liberal Catholic", "Anglican Catholic",
 *                "Ecumenical Catholic Communion", ...) but none of them are
 *                in communion with Rome, which is what this tag has always
 *                meant on the game's own cards.
 *    jewish   -- the six USRC groups that are Judaism itself (Chabad,
 *                Conservative, Independent, Orthodox, Reconstructionist,
 *                Reform). "Union of Messianic Jewish Congregations" and
 *                "Association of Messianic Congregations" are deliberately
 *                excluded: Messianic Judaism holds Jesus as messiah and is
 *                standardly classified in religious demography as a
 *                Christian/evangelical movement, not a Judaism variant.
 *    evangelical -- NOT resolved here. USRC's other ~360 groups are almost
 *                all Protestant denominations, and separating
 *                evangelical/mainline/black-protestant among them is
 *                exactly RELTRAD's contested territory -- #240's own
 *                question, still open. --district-share refuses any group
 *                list this file did not name for that reason.
 *
 *  Grain: 2020 US Religion Census, county level, joined through #239's
 *  crosswalk to 118th Congress district lines -- the vintage that matches
 *  era 2024's map. Applying this to any other era would be applying today's
 *  districts to a map that no longer describes them, same caveat #221/#238
 *  already carry for the ACS-sourced tags.
 *
 *  node sim/district-religion.ts --build <2020_USRC_Group_Detail.xlsx>
 *  node sim/district-religion.ts                       -- coverage report
 *  node sim/district-religion.ts --district-share catholic
 *  node sim/district-religion.ts --district-share jewish
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { PANEL as CROSSWALK_PANEL } from './district-crosswalk.ts';

export const PANEL = 'data/historical/usrc_county_religion.json';

export const CATHOLIC_GROUPS = ['Catholic Church'];
export const JEWISH_GROUPS = [
  'Chabad Judaism', 'Conservative Judaism', 'Independent Judaism',
  'Orthodox Judaism', 'Reconstructionist Judaism', 'Reform Judaism',
];

interface Row {
  countyFips: string; groupCode: string; groupName: string;
  congregations: number; adherents: number; pctOfPop: number;
}

// ---- minimal .xlsx (zip + OOXML) reader -- no dependency, same discipline
// as district-crosswalk.ts's hand-rolled CSV reader. Only reads the two
// parts this file needs (sharedStrings.xml, one worksheet); does not
// implement general zip/xlsx writing or the rest of the OOXML surface. ----

interface ZipEntry { method: number; compSize: number; offset: number }

function centralDirectory(buf: Buffer): Map<string, ZipEntry> {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65557); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file (no End Of Central Directory record)');
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdCount = buf.readUInt16LE(eocd + 10);
  const entries = new Map<string, ZipEntry>();
  let p = cdOffset;
  const CD_SIG = 0x02014b50;
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(p) !== CD_SIG) throw new Error(`bad central directory entry at offset ${p}`);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, { method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readZipEntry(buf: Buffer, cd: Map<string, ZipEntry>, name: string): Buffer {
  const entry = cd.get(name);
  if (!entry) throw new Error(`${name} not found in archive (has the .xlsx internal layout changed?)`);
  const p = entry.offset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error(`bad local file header for ${name}`);
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const dataStart = p + 30 + nameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + entry.compSize);
  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`${name}: unsupported zip compression method ${entry.method}`);
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Shared strings table: index i -> the plain text of the i-th <si>,
 *  concatenating rich-text <r><t>...</t></r> runs where present. */
function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si>([\s\S]*?)<\/si>|<si\/>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const body = m[1] ?? '';
    let text = '';
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>|<t[^>]*\/>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(body))) text += decodeXmlEntities(tm[1] ?? '');
    out.push(text);
  }
  return out;
}

/** One worksheet's <sheetData> rows -> per-row cell values keyed by column
 *  letter, resolving shared-string cells (t="s") against `strings`. */
function parseSheetRows(xml: string, strings: string[]): Map<string, string>[] {
  const rows: Map<string, string>[] = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  const cellRe = /<c r="([A-Z]+)\d+"([^>]*?)\/>|<c r="([A-Z]+)\d+"([^>]*?)>(?:<f>[\s\S]*?<\/f>)?(?:<v>([^<]*)<\/v>)?<\/c>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const cells = new Map<string, string>();
    let cm: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((cm = cellRe.exec(rm[1]))) {
      const col = cm[1] ?? cm[3];
      const attrs = cm[2] ?? cm[4] ?? '';
      const raw = cm[5];
      if (raw === undefined) continue;
      const isString = /\bt="s"/.test(attrs);
      cells.set(col, isString ? (strings[Number(raw)] ?? '') : raw);
    }
    if (cells.size) rows.push(cells);
  }
  return rows;
}

function build(xlsxPath: string): void {
  const buf = readFileSync(xlsxPath);
  const cd = centralDirectory(buf);
  const strings = parseSharedStrings(readZipEntry(buf, cd, 'xl/sharedStrings.xml').toString('utf8'));
  // rId3 in xl/_rels/workbook.xml.rels -> worksheets/sheet3.xml is "2020
  // Group by County" as of the 2023-06 release; verified against
  // xl/workbook.xml's <sheets> order and the rels file at build time.
  const sheetXml = readZipEntry(buf, cd, 'xl/worksheets/sheet3.xml').toString('utf8');
  const rawRows = parseSheetRows(sheetXml, strings);

  const rows: Row[] = [];
  for (const c of rawRows) {
    const countyFips = c.get('A');
    const groupName = c.get('E');
    if (!countyFips || !/^\d{5}$/.test(countyFips) || !groupName) continue; // skips header/total/blank rows
    const congregations = Number(c.get('F'));
    const adherents = Number(c.get('G'));
    const pctOfPop = Number(c.get('I'));
    if (!Number.isFinite(adherents) || !Number.isFinite(pctOfPop)) continue;
    rows.push({
      countyFips,
      groupCode: c.get('D') ?? '',
      groupName,
      congregations: Number.isFinite(congregations) ? congregations : 0,
      adherents,
      pctOfPop,
    });
  }
  rows.sort((a, b) => a.countyFips.localeCompare(b.countyFips) || a.groupName.localeCompare(b.groupName));

  // groupCode <-> groupName is 1:1 (verified at build time below); storing
  // the dictionary once instead of the name on all 65k+ rows is most of
  // this panel's size -- county/state *names* are dropped from rows
  // entirely for the same reason, joinable by countyFips against #239's
  // own committed crosswalk panel instead of repeated here.
  const denominations = new Map<string, string>();
  for (const r of rows) {
    const prior = denominations.get(r.groupCode);
    if (prior !== undefined && prior !== r.groupName) {
      throw new Error(`groupCode ${r.groupCode} names both ${JSON.stringify(prior)} and ${JSON.stringify(r.groupName)} -- code is not a stable key, cannot dictionary-encode`);
    }
    denominations.set(r.groupCode, r.groupName);
  }
  const codes = [...denominations.keys()].sort();

  const panel = {
    note: "Evidence for #164 part 3. Sourced denomination x county adherence, joined to districts by --district-share. Classification into catholic/evangelical/jewish is #240's open call -- this panel names two low-ambiguity candidates (see this file's header) and resolves neither by writing them to any card. County/state names are not repeated here -- join countyFips against county_to_cd118_crosswalk.json for those.",
    source: {
      dataset: '2020 US Religion Census, Group by County (ASARB/Lilly Endowment, hosted via the Association of Religion Data Archives)',
      geography: 'county (5-digit FIPS)',
      url: 'https://www.usreligioncensus.org/sites/default/files/2023-06/2020_USRC_Group_Detail.xlsx',
      retrieved: '2026-09-16',
    },
    transform: [
      "Sheet '2020 Group by County' (xl/worksheets/sheet3.xml), one row per (county, denomination) pair with at least one adherent.",
      'pctOfPop is USRC\'s own "Adherents as % of Total Population" column, read as-is (not re-derived).',
      'Rows with no county FIPS (subtotal/blank rows at the sheet foot) are dropped.',
    ],
    denominations: Object.fromEntries(codes.map((code) => [code, denominations.get(code)])),
    columns: ['countyFips', 'groupCode', 'congregations', 'adherents', 'pctOfPop'],
    rows: rows.map((r) => [r.countyFips, r.groupCode, r.congregations, r.adherents, r.pctOfPop]),
  };
  writeFileSync(PANEL, JSON.stringify(panel, null, 1).replace(/\n\s+(-?"|\d)/g, ' $1').replace(/\n\s+\]/g, ' ]'));
  console.log(`rebuilt ${PANEL}: ${rows.length} county-denomination rows, ${codes.length} denominations`);
}

function loadPanel(): Row[] {
  const panel = JSON.parse(readFileSync(PANEL, 'utf8')) as {
    denominations: Record<string, string>;
    rows: [string, string, number, number, number][];
  };
  return panel.rows.map(([countyFips, groupCode, congregations, adherents, pctOfPop]) => ({
    countyFips, groupCode, groupName: panel.denominations[groupCode], congregations, adherents, pctOfPop,
  }));
}

function report(): void {
  const rows = loadPanel();
  const counties = new Set(rows.map((r) => r.countyFips));
  const groups = new Set(rows.map((r) => r.groupName));
  const totalAdherents = rows.reduce((s, r) => s + r.adherents, 0);
  console.log(`${rows.length} county-denomination rows, ${counties.size} counties, ${groups.size} distinct denominations, ${totalAdherents.toLocaleString()} adherents summed`);
  for (const [label, names] of [['catholic candidate', CATHOLIC_GROUPS], ['jewish candidate', JEWISH_GROUPS]] as const) {
    const hit = rows.filter((r) => names.includes(r.groupName));
    const nationalAdherents = hit.reduce((s, r) => s + r.adherents, 0);
    console.log(`  ${label}: ${names.join(', ')} -- ${hit.length} county rows, ${nationalAdherents.toLocaleString()} adherents nationally`);
  }
}

interface CrosswalkRow { state: string; countyFips: string; countyName: string; cd118: string; pop20: number; afact: number }

function loadCrosswalk(): CrosswalkRow[] {
  const panel = JSON.parse(readFileSync(CROSSWALK_PANEL, 'utf8')) as {
    rows: [string, string, string, string, number, number][];
  };
  return panel.rows.map(([state, countyFips, countyName, cd118, pop20, afact]) => ({ state, countyFips, countyName, cd118, pop20, afact }));
}

/** District-level adherent share for a named set of denominations,
 *  population-weighted across a split county the same way the crosswalk's
 *  own afact already weights lean/demographics elsewhere in this repo:
 *  each (county, district) row's share of that county's population
 *  (pop20) stands in for its share of that county's adherents too. */
function districtShare(groupNames: string[]): void {
  const known = new Set([...CATHOLIC_GROUPS, ...JEWISH_GROUPS]);
  const unknown = groupNames.filter((g) => !known.has(g));
  if (unknown.length) {
    throw new Error(
      `--district-share refuses group(s) not named in this file: ${unknown.join(', ')}. ` +
      `Only CATHOLIC_GROUPS/JEWISH_GROUPS are resolved here -- bucketing the remaining ~360 ` +
      `Protestant denominations into 'evangelical' is #240's open classification call, not this file's.`,
    );
  }
  const religion = loadPanel();
  const byCounty = new Map<string, number>(); // countyFips -> pctOfPop for the requested group set
  for (const r of religion) {
    if (!groupNames.includes(r.groupName)) continue;
    byCounty.set(r.countyFips, (byCounty.get(r.countyFips) ?? 0) + r.pctOfPop);
  }

  const crosswalk = loadCrosswalk();
  const districtAdherents = new Map<string, number>();
  const districtPop = new Map<string, number>();
  for (const c of crosswalk) {
    const key = `${c.state}-${c.cd118}`;
    const pct = byCounty.get(c.countyFips) ?? 0;
    districtAdherents.set(key, (districtAdherents.get(key) ?? 0) + pct * c.pop20);
    districtPop.set(key, (districtPop.get(key) ?? 0) + c.pop20);
  }

  const shares = [...districtPop.keys()]
    .map((key) => ({ key, share: 100 * (districtAdherents.get(key) ?? 0) / districtPop.get(key)! }))
    .sort((a, b) => b.share - a.share);

  console.log(`district-level share, ${groupNames.join(' + ')} (118th Congress lines, ${shares.length} districts):`);
  for (const { key, share } of shares.slice(0, 15)) console.log(`  ${key}  ${share.toFixed(2)}%`);
  console.log('  ...');
}

function main(): void {
  const argv = process.argv.slice(2);
  const bi = argv.indexOf('--build');
  if (bi >= 0) { build(argv[bi + 1]); return; }
  const di = argv.indexOf('--district-share');
  if (di >= 0) {
    const which = argv[di + 1];
    const groups = which === 'catholic' ? CATHOLIC_GROUPS : which === 'jewish' ? JEWISH_GROUPS : null;
    if (!groups) throw new Error(`--district-share expects 'catholic' or 'jewish', got ${JSON.stringify(which)}`);
    districtShare(groups);
    return;
  }
  report();
}

main();
