import { readFileSync } from 'node:fs';
import { loadPacks } from '../sim/harness.ts';
import { fit, era, mean, type Row, type Obs } from '../sim/district-partisanship.ts';
import type { DistrictCard, IdentityTag } from '../engine/types/index.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#163: does a district card's printed `demographics`
 *  predict how that district actually votes? `sim/district-partisanship.ts`
 *  already decomposes real returns into a district-era fixed effect; this
 *  joins our cards to that effect by the same `${state}-${number}|${era}`
 *  key the tool uses, and asks whether the tags explain it.
 *
 *  Only the four packs the MEDSL panel (1976-2018) can actually speak to are
 *  joined -- '1932'/'1964'/'2024' fall outside it entirely (hf7y/american-cycle#90's
 *  ruling), and the issue's own scratch probe joined them anyway on a
 *  coincidental era-bucket-letter match (a 1932 card sharing a bucket letter
 *  with 1976-1980 real districts is not the same place). That is why this
 *  predicate's N is smaller than the 258/248 the issue thread quotes.
 *
 *  hf7y/american-cycle#163's own follow-up withdrew "a prediction, not a
 *  fit": leave-one-out controls for fitting a tag's mean to the same cards
 *  it predicts, but not for a labeller who already knows how a place votes.
 *  The split by tag kind is the honest finding, not the pooled r^2 -- see
 *  hf7y/american-cycle#164 on the PERSON tags being biography, not geography. */
const PANEL_PACKS = ['1976', '1992', '2008', '2016'];
const PLACE: IdentityTag[] = ['urban', 'rural', 'suburban'];
const PERSON: IdentityTag[] = ['ivy', 'academic', 'business', 'veteran'];

function panel(f: string) {
  return JSON.parse(readFileSync(new URL(`../data/historical/${f}`, import.meta.url), 'utf8')).rows as
    [number, string, number, number, number, number][];
}

/** The district-era fixed effect, adjusted for incumbency and national year
 *  swing -- `fit`'s own P1 population (contested only, >=3 elections per
 *  district-era, the module's "headline population"). */
function districtEffects(): Map<string, number> {
  const rows: Row[] = panel('house_district_panel.json').map(([year, state, district, dem, rep, inc]) =>
    ({ year, state, district, dem, rep, inc }));
  const unit = (r: Row) => `${r.state}-${r.district}|${era(r.year)}`;
  const contested = rows.filter((r) => r.dem > 0 && r.rep > 0);
  const counts = new Map<string, number>();
  for (const r of contested) counts.set(unit(r), (counts.get(unit(r)) ?? 0) + 1);
  const kept = contested.filter((r) => counts.get(unit(r))! >= 3);
  const obs: Obs[] = kept.map((r) => ({ y: 100 * r.dem / (r.dem + r.rep), inc: r.inc, unit: unit(r), year: r.year, row: r }));
  return fit(obs).a;
}

/** A district card's own key, with the at-large fallback #163 already found:
 *  the card pool numbers an at-large state's lone district 1, MEDSL numbers
 *  it 0. */
function cardKey(d: DistrictCard, effects: Map<string, number>): string | undefined {
  const bucket = era(d.era);
  const direct = `${d.state}-${d.number}|${bucket}`;
  if (effects.has(direct)) return direct;
  const atLarge = `${d.state}-0|${bucket}`;
  if (d.number === 1 && effects.has(atLarge)) return atLarge;
  return undefined;
}

/** Leave-one-out mean actual effect of every OTHER card carrying `tag`, so a
 *  card is never predicted from its own contribution to the tag's mean. */
function predict(cards: { card: DistrictCard; actual: number }[], tags: IdentityTag[]) {
  const byTag = new Map<IdentityTag, { card: DistrictCard; actual: number }[]>();
  for (const t of tags) byTag.set(t, cards.filter((c) => c.card.demographics.includes(t)));
  const pts: { actual: number; predicted: number }[] = [];
  for (const c of cards) {
    const own = c.card.demographics.filter((t) => tags.includes(t));
    const loo = own.map((t) => {
      const carriers = byTag.get(t)!.filter((x) => x.card.id !== c.card.id);
      return carriers.length ? mean(carriers.map((x) => x.actual)) : undefined;
    }).filter((v): v is number => v !== undefined);
    if (loo.length) pts.push({ actual: c.actual, predicted: mean(loo) });
  }
  return pts;
}

function rSquared(pts: { actual: number; predicted: number }[]): number {
  if (pts.length < 2) return NaN;
  const a = pts.map((p) => p.actual), p = pts.map((p) => p.predicted);
  const ma = mean(a), mp = mean(p);
  let cov = 0, va = 0, vp = 0;
  for (let i = 0; i < pts.length; i++) { cov += (a[i] - ma) * (p[i] - mp); va += (a[i] - ma) ** 2; vp += (p[i] - mp) ** 2; }
  const r = cov / Math.sqrt(va * vp);
  return r * r;
}

function measure() {
  const effects = districtEffects();
  const districts = loadPacks(PANEL_PACKS).filter((c) => c.kind === 'district') as (DistrictCard & { kind: 'district' })[];
  const matched: { card: DistrictCard; actual: number }[] = [];
  for (const d of districts) {
    const key = cardKey(d, effects);
    if (key) matched.push({ card: d, actual: effects.get(key)! });
  }
  const ALL: IdentityTag[] = [...PLACE, ...PERSON,
    'catholic', 'evangelical', 'jewish', 'black', 'hispanic', 'cuban', 'union', 'farm'];
  const DEMOGRAPHIC = ALL.filter((t) => !PLACE.includes(t) && !PERSON.includes(t));
  return {
    total: districts.length,
    matched: matched.length,
    all: rSquared(predict(matched, ALL)),
    place: rSquared(predict(matched, PLACE)),
    demographic: rSquared(predict(matched, DEMOGRAPHIC)),
    person: rSquared(predict(matched, PERSON)),
    nAll: predict(matched, ALL).length,
    nPerson: predict(matched, PERSON).length,
  };
}

export const finding: Finding = {
  id: 'district-fit',
  dependsOn: [],
  question:
    "hf7y/american-cycle#163: `sim/district-partisanship.ts` measures how much of a House result is "
    + 'the district but never asks whether the tags WE PRINTED explain any of it. Does a district '
    + "card's `demographics` predict its real district-era partisanship, and does that hold up when "
    + 'split by what kind of tag it is -- place, demographic, or the candidate-biography tags '
    + 'hf7y/american-cycle#164 flags as geography in name only?',

  headline:
    "It predicts, and the split confirms #163's own withdrawal of \"a prediction, not a fit\": pooling "
    + 'every tag, leave-one-out r^2 against the real district-era fixed effect is real but the PERSON '
    + "tags (ivy/academic/business/veteran) carry a materially weaker r^2 on a much smaller matched set "
    + 'than PLACE and DEMOGRAPHIC tags do -- consistent with #164\'s point that no census table reports '
    + "a district's Ivy League attendance, so whatever those four tags predict is a labeller who already "
    + 'knew the place\'s politics, not geography. Matched against only the four packs the MEDSL panel '
    + "(1976-2018) can actually speak to -- #163's own scratch probe joined 1932/1964/2024 cards too, on "
    + 'a coincidental era-bucket letter rather than a real place match, which is why this N is smaller.',
  stampedAt: '2026-09-06T03:10:00Z',
  stampedOn: '6cb3688',

  predicate(): Claim[] {
    const m = measure();
    return [
      { name: 'district cards in the four MEDSL-era packs', value: m.total, stamped: 168, tolerance: 0 },
      { name: 'matched to a district-era fixed effect', value: m.matched, stamped: 153, tolerance: 3 },
      { name: 'leave-one-out r^2, all tags', value: m.all, stamped: 0.56, tolerance: 0.05 },
      { name: 'leave-one-out r^2, place tags only', value: m.place, stamped: 0.49, tolerance: 0.05 },
      { name: 'leave-one-out r^2, demographic tags only', value: m.demographic, stamped: 0.35, tolerance: 0.05 },
      { name: 'leave-one-out r^2, PERSON tags only (ivy/academic/business/veteran)', value: m.person, stamped: 0.22, tolerance: 0.05 },
      { name: 'cards with a usable ALL-tag prediction', value: m.nAll, stamped: 153, tolerance: 3 },
      { name: 'cards with a usable PERSON-tag prediction', value: m.nPerson, stamped: 40, tolerance: 5 },
    ];
  },

  verdict(c: Claim[]): string {
    const v = (n: string) => c.find((x) => x.name === n)!.value;
    const all = v('leave-one-out r^2, all tags');
    const place = v('leave-one-out r^2, place tags only');
    const demo = v('leave-one-out r^2, demographic tags only');
    const person = v('leave-one-out r^2, PERSON tags only (ivy/academic/business/veteran)');
    const nPerson = v('cards with a usable PERSON-tag prediction');
    return [
      `pooled leave-one-out r^2 is ${all.toFixed(2)} against the real district-era fixed effect`,
      `place ${place.toFixed(2)} and demographic ${demo.toFixed(2)} tags carry most of that`,
      person < Math.min(place, demo)
        ? `PERSON tags (ivy/academic/business/veteran) predict more weakly (r^2 ${person.toFixed(2)}, n=${nPerson.toFixed(0)}) -- consistent with #164's "biography used as geography"`
        : `PERSON tags do NOT predict more weakly than place/demographic ones (r^2 ${person.toFixed(2)}, n=${nPerson.toFixed(0)}) -- #164's concern is not borne out here`,
      'a labeller who already knows a district\'s politics before tagging it is a confound LOO cannot detect, per #163\'s own withdrawal -- this is evidence tags correlate with real partisanship, not evidence they are an independent source of it',
    ].join('; ');
  },
};
