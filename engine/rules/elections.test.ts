import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as resolution from './resolution.ts';
import { Wave } from './resolution.ts';
import { RNG } from './rng.ts';
import { buildModifiers, eligible, homeDistrict, runRace, withdrawalView } from './elections.ts';
import type { Declaration, RaceContext, NationalConfig, PrimaryGeneralConfig, ResolutionConfig } from './elections.ts';
import type { CandidateCard, DistrictCard } from '../types/index.ts';
import cfg from '../config/baseline.json' with { type: 'json' };

const res = cfg.resolution as ResolutionConfig;
const nat = cfg.national as NationalConfig;
const pg = cfg.primaryGeneral as PrimaryGeneralConfig;

const cand = (o: Partial<CandidateCard>): CandidateCard => ({
  id: 'c', name: 'C', party: 'D', homeState: 'OH', homeStateBonus: 0,
  identities: [], era: 1976, effects: [], ...o,
});
const dist = (o: Partial<DistrictCard>): DistrictCard => ({
  id: 'OH-9', state: 'OH', number: 9, era: 1976, demographics: [], ...o,
});
const ctx = (o: Partial<RaceContext>): RaceContext => ({
  year: 1978, office: 'senator', state: 'OH', lean: 0,
  isMidterm: false, isPresidentialYear: false, economyMod: 0, ...o,
});

/** BUILD-BRIEF correctness target #2, and withdrawal's central claim. */
test('the withdrawal window closes before any die is rolled', () => {
  const wave = new Wave(new RNG(1));
  const rng = new RNG(1);
  let sawDiceField = false;
  const decl: Declaration[] = [
    { player: 0, card: cand({ id: 'a' }), office: 'senator', state: 'OH' },
    { player: 1, card: cand({ id: 'b', party: 'R' }), office: 'senator', state: 'OH' },
  ];
  runRace({
    ctx: ctx({}), round: 'general', declarations: decl, res, nat, pg, wave, rng,
    decide: (_p, v) => {
      assert.equal(wave.rolls, 0, 'no die may be drawn while the window is open');
      for (const k of Object.keys(v)) if (/die|dice|roll/i.test(k)) sawDiceField = true;
      return false;
    },
  });
  assert.ok(!sawDiceField, 'the view carries no field that could hold a die');
  assert.ok(wave.rolls > 0, 'and the dice are rolled once the window has closed');
});

test('a primary hides the opponent card; a general reveals it', () => {
  const me: Declaration = { player: 0, card: cand({ id: 'a' }), office: 'senator', state: 'OH' };
  const them: Declaration = { player: 1, card: cand({ id: 'b', party: 'R' }), office: 'senator', state: 'OH' };
  const mods = buildModifiers(me, ctx({}), 'primary', res, nat, pg);
  assert.equal(withdrawalView(me, mods, 'primary', ctx({}), [them]).opponentCards, undefined,
    'you pull out of a primary without ever seeing the card');
  const g = withdrawalView(me, mods, 'general', ctx({}), [them]);
  assert.deepEqual(g.opponentCards, [{ cardId: 'b', party: 'R' }]);
  assert.equal(g.contenders, 1, 'a peg on the board is always visible');
});

test('withdrawal returns the card and hands the opponent a walkover', () => {
  const wave = new Wave(new RNG(2));
  const out = runRace({
    ctx: ctx({}), round: 'general', wave, rng: new RNG(2), res, nat, pg,
    declarations: [
      { player: 0, card: cand({ id: 'a' }), office: 'senator', state: 'OH' },
      { player: 1, card: cand({ id: 'b', party: 'R' }), office: 'senator', state: 'OH' },
    ],
    decide: (p) => p === 0,
  });
  assert.equal(out.withdrawnCards.length, 1);
  assert.equal(out.withdrawnCards[0].card.id, 'a');
  assert.equal(out.walkover?.player, 1);
  assert.ok(out.event?.uncontested, 'uncontested is an auto-win');
});

test('district cards gate all races', () => {
  const ohio = cand({ homeState: 'OH' });
  assert.ok(eligible(ohio, 'OH', []), 'a native may always run at home');
  assert.ok(!eligible(ohio, 'CA', []), 'and nowhere else without presence');
  assert.ok(eligible(ohio, 'CA', [dist({ id: 'CA-3', state: 'CA' })]), 'presence is purchased in the draft');
});

/** #106 change 1: `districtLevelEligibility` is the caller passing a `house`
 *  slot. Untouched (no 4th argument), eligibility stays state-level -- a
 *  non-native holding any district in a state may still enter every House
 *  race there, which is the pre-#106 behaviour #77 measured. */
test('#106: district-level House eligibility -- OH-3 does not buy entry to OH-9', () => {
  const outsider = cand({ homeState: 'CA' });
  const oh3 = dist({ id: 'OH-3', state: 'OH', number: 3 });
  assert.ok(eligible(outsider, 'OH', [oh3]), 'state-level gate (no house arg): any district in the state suffices');
  assert.ok(eligible(outsider, 'OH', [oh3], 3), 'district-level gate: holding OH-3 admits OH-3');
  assert.ok(!eligible(outsider, 'OH', [oh3], 9), 'district-level gate: holding OH-3 does not admit OH-9');
});

test('#106: a favourite son may run in their home district with no district card at all', () => {
  const native = cand({ homeState: 'OH' });
  assert.ok(eligible(native, 'OH', [], 9), 'homeState alone clears the district-level gate');
});

/** #106 change 2/3: two players contesting the same opened district both
 *  receive identity fit against its demographics -- neither the caller's
 *  ownership of the card nor which of them is asked matters, only `d.district`
 *  (or, for a statewide sum, `d.districts`) does. */
test('#106: two candidates contesting the same district both price the same fit, regardless of who holds the card', () => {
  const cd = dist({ id: 'OH-9', state: 'OH', number: 9, demographics: ['union', 'catholic'] });
  const home = { player: 0, card: cand({ identities: ['union'] }), district: cd, office: 'senator' as const, state: 'OH' };
  const away = { player: 1, card: cand({ id: 'b', identities: ['union'] }), district: cd, office: 'senator' as const, state: 'OH' };
  const homeMods = buildModifiers(home, ctx({}), 'general', res, nat, pg);
  const awayMods = buildModifiers(away, ctx({}), 'general', res, nat, pg);
  assert.equal(homeMods.find((m) => m.source.startsWith('identity'))?.pips,
    awayMods.find((m) => m.source.startsWith('identity'))?.pips,
    'the district card in play prices the race, not who is holding it');
});

/** #106 change 3: a statewide race sums fit across EVERY district card on the
 *  table in that state -- a player adds, a player does not average. */
test('#106: statewideFitSums adds fit across every district in the state, not just one', () => {
  const urban = dist({ id: 'OH-3', state: 'OH', number: 3, demographics: ['urban'] });
  const urban2 = dist({ id: 'OH-9', state: 'OH', number: 9, demographics: ['urban'] });
  const rural = dist({ id: 'OH-14', state: 'OH', number: 14, demographics: ['rural'] });
  const candidate = cand({ identities: ['urban'] });

  const single: Declaration = { player: 0, card: candidate, district: urban, office: 'senator', state: 'OH' };
  const singleMods = buildModifiers(single, ctx({}), 'general', res, nat, pg);
  assert.equal(singleMods.find((m) => m.source.startsWith('identity'))?.pips, res.identityBonus,
    'reading one district prices the match once');

  const summed: Declaration = { player: 0, card: candidate, districts: [urban, urban2, rural], office: 'senator', state: 'OH' };
  const summedMods = buildModifiers(summed, ctx({}), 'general', res, nat, pg);
  assert.equal(summedMods.find((m) => m.source.startsWith('identity'))?.pips, res.identityBonus * 2,
    'two of three districts share urban -- a sum counts both, the third contributes nothing');

  const outOfState: Declaration = { player: 0, card: candidate, districts: [urban, dist({ id: 'CA-1', state: 'CA', demographics: ['urban'] })], office: 'senator', state: 'OH' };
  const outMods = buildModifiers(outOfState, ctx({}), 'general', res, nat, pg);
  assert.equal(outMods.find((m) => m.source.startsWith('identity'))?.pips, res.identityBonus,
    'a district card from another state on the same list does not contribute');
});

test('#106: districts (sum mode) takes priority over a single district on the same Declaration', () => {
  const decoy = dist({ id: 'OH-1', state: 'OH', demographics: ['rural'] });
  const real = dist({ id: 'OH-3', state: 'OH', demographics: ['urban'] });
  const candidate = cand({ identities: ['urban'] });
  const d: Declaration = { player: 0, card: candidate, district: decoy, districts: [real], office: 'senator', state: 'OH' };
  const mods = buildModifiers(d, ctx({}), 'general', res, nat, pg);
  assert.equal(mods.find((m) => m.source.startsWith('identity'))?.pips, res.identityBonus,
    'the sum list is authoritative when present, per its own doc comment');
});

/** #112: a statewide race has no single correct district to read fit
 *  against, so `homeDistrict` must not depend on which of a player's
 *  districts an array happens to yield first. */
test('homeDistrict combines a state\'s districts regardless of array order', () => {
  const a = dist({ id: 'CA-3', state: 'CA', demographics: ['urban'] });
  const b = dist({ id: 'CA-9', state: 'CA', demographics: ['union'] });
  const forward = homeDistrict([a, b], 'CA')!;
  const reversed = homeDistrict([b, a], 'CA')!;
  assert.deepEqual(forward, reversed, 'draw order must not change the combined district');
  assert.deepEqual(new Set(forward.demographics), new Set(['urban', 'union']));
  assert.equal(homeDistrict([a, b], 'OH'), undefined, 'no district in the state, no fit');
});

test('#112: the presidential modifier stack does not depend on district draw order', () => {
  const a = dist({ id: 'CA-3', state: 'CA', demographics: ['urban'] });
  const b = dist({ id: 'CA-9', state: 'CA', demographics: ['union'] });
  const candidate = cand({ homeState: 'OH', identities: ['union'] });
  const c = ctx({ office: 'president', state: 'CA' });
  const forward = { player: 0, card: candidate, office: 'president' as const, state: 'CA', district: homeDistrict([a, b], 'CA') };
  const reversed = { player: 0, card: candidate, office: 'president' as const, state: 'CA', district: homeDistrict([b, a], 'CA') };
  assert.deepEqual(buildModifiers(forward, c, 'general', res, nat, pg), buildModifiers(reversed, c, 'general', res, nat, pg));
});

test('lean applies once, to the party it favours', () => {
  const r = { player: 0, card: cand({ party: 'R' as const }), office: 'senator' as const, state: 'OH' };
  const d = { player: 1, card: cand({ party: 'D' as const }), office: 'senator' as const, state: 'OH' };
  const c = ctx({ lean: 3 });
  const rm = buildModifiers(r, c, 'general', res, nat, pg);
  const dm = buildModifiers(d, c, 'general', res, nat, pg);
  assert.equal(rm.find((m) => m.source === 'state lean')?.pips, 3);
  assert.equal(dm.find((m) => m.source === 'state lean'), undefined,
    'the other side takes no penalty -- that would double the pip scale');
});

test('the midterm penalty reaches everyone; a local card outruns it', () => {
  // Manchin's insulation was a printed tag and is now the ordinary arithmetic
  // of a big personal vote: he takes the -2 like anyone else and survives it
  // on home state plus identity match against his district.
  const manchin: Declaration = {
    player: 0, state: 'WV', office: 'senator',
    district: dist({ id: 'WV-1', state: 'WV', demographics: ['rural', 'union'] }),
    card: cand({
      id: 'manchin', party: 'D', homeState: 'WV', homeStateBonus: 2,
      identities: ['rural', 'union'],
    }),
  };
  const c = ctx({ state: 'WV', isMidterm: true, presidentParty: 'D' });
  const mods = buildModifiers(manchin, c, 'general', res, nat, pg);
  assert.ok(mods.some((m) => m.source === 'midterm'), 'the tide is not shed');
  const side = { player: 0, cardId: 'manchin', party: 'D' as const, modifiers: mods };
  assert.equal(resolution.modifierTotal(side), 2, 'home state 2 + identity match 2 (res.identityBonus 1 x 2) - midterm 2');
});

test('coattails run in reverse in hostile states, with no extra rule', () => {
  const base = { player: 0, office: 'senator' as const, state: 'OH' };
  const dem = { ...base, card: cand({ party: 'D' as const }) };
  const withGrain = buildModifiers(dem, ctx({ lean: -3, isPresidentialYear: true, presidentialWinner: 'D' }), 'general', res, nat, pg);
  assert.equal(withGrain.find((m) => m.source === 'coattails')?.pips, nat.coattailsWith);
  const against = buildModifiers(dem, ctx({ lean: 3, isPresidentialYear: true, presidentialWinner: 'D' }), 'general', res, nat, pg);
  assert.equal(against.find((m) => m.source === 'coattails')?.pips, nat.coattailsAgainst,
    'an unpopular nominee drags his own party down in hostile states');
});

test('a per-office incumbency override falls back to the flat value when unset', () => {
  const flat: ResolutionConfig = { ...res, incumbencyHouse: undefined, incumbencySenate: undefined };
  const house: Declaration = { player: 0, card: cand({}), office: 'representative', state: 'OH', incumbent: true };
  const senate: Declaration = { player: 0, card: cand({}), office: 'senator', state: 'OH', incumbent: true };
  const houseMods = buildModifiers(house, ctx({ office: 'representative' }), 'general', flat, nat, pg);
  const senateMods = buildModifiers(senate, ctx({ office: 'senator' }), 'general', flat, nat, pg);
  assert.equal(houseMods.find((m) => m.source === 'incumbency')?.pips, flat.incumbency,
    'with no per-office override, the House falls back to the flat value');
  assert.equal(senateMods.find((m) => m.source === 'incumbency')?.pips, flat.incumbency,
    'same fallback for the Senate');
});

test('baseline.json ships the #16/#93-derived House/Senate incumbency levels', () => {
  const house: Declaration = { player: 0, card: cand({}), office: 'representative', state: 'OH', incumbent: true };
  const senate: Declaration = { player: 0, card: cand({}), office: 'senator', state: 'OH', incumbent: true };
  assert.equal(buildModifiers(house, ctx({ office: 'representative' }), 'general', res, nat, pg)
    .find((m) => m.source === 'incumbency')?.pips, 4, 'see findings/incumbency-magnitude.ts');
  assert.equal(buildModifiers(senate, ctx({ office: 'senator' }), 'general', res, nat, pg)
    .find((m) => m.source === 'incumbency')?.pips, 2, "hf7y/american-cycle#53's Senate panel replaces #16's assumed 3-pip gap with a measured one");
});

test('a per-office incumbency override, once set, wins over the flat value -- and only for that office', () => {
  const split: ResolutionConfig = { ...res, incumbencyHouse: 7, incumbencySenate: 4 };
  const house: Declaration = { player: 0, card: cand({}), office: 'representative', state: 'OH', incumbent: true };
  const senate: Declaration = { player: 0, card: cand({}), office: 'senator', state: 'OH', incumbent: true };
  const governor: Declaration = { player: 0, card: cand({}), office: 'governor', state: 'OH', incumbent: true };
  assert.equal(buildModifiers(house, ctx({ office: 'representative' }), 'general', split, nat, pg)
    .find((m) => m.source === 'incumbency')?.pips, 7);
  assert.equal(buildModifiers(senate, ctx({ office: 'senator' }), 'general', split, nat, pg)
    .find((m) => m.source === 'incumbency')?.pips, 4);
  assert.equal(buildModifiers(governor, ctx({ office: 'governor' }), 'general', split, nat, pg)
    .find((m) => m.source === 'incumbency')?.pips, res.incumbency,
    'governor and president are left on the flat value -- #16 has no data for them yet');
});

test('a per-office incumbency override does not touch the primary', () => {
  const split: ResolutionConfig = { ...res, incumbencyHouse: 7, incumbencySenate: 4 };
  const house: Declaration = { player: 0, card: cand({}), office: 'representative', state: 'OH', incumbent: true };
  assert.equal(buildModifiers(house, ctx({ office: 'representative' }), 'primary', split, nat, pg)
    .find((m) => m.source === 'incumbency')?.pips, res.incumbencyPrimary,
    'the primary keeps its own scalar regardless of office');
});

test('endorsements are primary-only', () => {
  const d: Declaration = { player: 0, card: cand({}), office: 'governor', state: 'OH', endorsements: 3 };
  assert.ok(buildModifiers(d, ctx({}), 'primary', res, nat, pg).some((m) => m.source === 'endorsements'));
  assert.ok(!buildModifiers(d, ctx({}), 'general', res, nat, pg).some((m) => m.source === 'endorsements'),
    'the general effect is coattails, already modelled -- an endorsement would double-count');
});

/** #95: McCarthy lost New Hampshire 1968 and the strong showing was the
 *  event. A nominee who won their primary by less than the threshold carries
 *  a scar into the general; one who was unopposed carries nothing. */
test('a bruising primary win carries a worse general stack than an unopposed one', () => {
  const bruised: Declaration = { player: 0, card: cand({}), office: 'senator', state: 'OH', bruisingPrimary: true };
  const clean: Declaration = { player: 0, card: cand({}), office: 'senator', state: 'OH' };
  const bruisedMods = buildModifiers(bruised, ctx({}), 'general', res, nat, pg);
  const cleanMods = buildModifiers(clean, ctx({}), 'general', res, nat, pg);
  assert.equal(bruisedMods.find((m) => m.source === 'bruising primary')?.pips, pg.bruisingPrimaryPips);
  const total = (mods: typeof bruisedMods) =>
    resolution.modifierTotal({ player: 0, cardId: 'c', party: 'D', modifiers: mods });
  assert.ok(total(bruisedMods) < total(cleanMods),
    'the same card, the only difference is the bruise -- the general stack must be worse');
  assert.ok(!buildModifiers(bruised, ctx({}), 'primary', res, nat, pg).some((m) => m.source === 'bruising primary'),
    'the counter is read in the general only -- see Declaration.bruisingPrimary');
});

test('#24: extremistEnvironmentPips unset leaves the primary bonus flat, as before', () => {
  const extremist: Declaration = { player: 0, card: cand({ effects: [{ type: 'extremist' }] }), office: 'senator', state: 'OH' };
  const badTide = ctx({ isMidterm: true, presidentParty: 'D', economyMod: -2 });
  const mods = buildModifiers(extremist, badTide, 'primary', res, nat, pg);
  assert.equal(mods.find((m) => m.source === 'extremist (primary)')?.pips, pg.extremistPrimary,
    'no config ships the knob yet, so the tide must not reach the primary bonus');
});

test('#24: once set, a bad national tide shrinks the extremist bonus for the president\'s own party', () => {
  const withKnob: PrimaryGeneralConfig = { ...pg, extremistEnvironmentPips: 1 };
  const extremist: Declaration = { player: 0, card: cand({ party: 'D', effects: [{ type: 'extremist' }] }), office: 'senator', state: 'OH' };
  // D holds the presidency, and midterm + recession both hurt the president's party.
  const badTide = ctx({ isMidterm: true, presidentParty: 'D', economyMod: -2 });
  const mods = buildModifiers(extremist, badTide, 'primary', res, nat, withKnob);
  const pips = mods.find((m) => m.source === 'extremist (primary)')?.pips;
  assert.ok(pips! < pg.extremistPrimary, 'in danger, the electorate should favour electability over purity');
});

test('#24: the same bad tide for the president\'s party is a GOOD tide for the opposition, mirrored', () => {
  const withKnob: PrimaryGeneralConfig = { ...pg, extremistEnvironmentPips: 1 };
  const oppositionExtremist: Declaration = { player: 0, card: cand({ party: 'R', effects: [{ type: 'extremist' }] }), office: 'senator', state: 'OH' };
  // D holds the presidency and is struggling -- the mirror image favours R.
  const badTideForD = ctx({ isMidterm: true, presidentParty: 'D', economyMod: -2 });
  const mods = buildModifiers(oppositionExtremist, badTideForD, 'primary', res, nat, withKnob);
  const pips = mods.find((m) => m.source === 'extremist (primary)')?.pips;
  assert.ok(pips! > pg.extremistPrimary,
    '2010: Republicans, riding a wave against a struggling incumbent party, tolerated more extremism, not less');
});

test('#24: an independent card reads no environment term -- there is no presidency to hold or oppose', () => {
  const withKnob: PrimaryGeneralConfig = { ...pg, extremistEnvironmentPips: 1 };
  const independentExtremist: Declaration = { player: 0, card: cand({ party: 'I', effects: [{ type: 'extremist' }] }), office: 'senator', state: 'OH' };
  const badTide = ctx({ isMidterm: true, presidentParty: 'D', economyMod: -2 });
  const mods = buildModifiers(independentExtremist, badTide, 'primary', res, nat, withKnob);
  assert.equal(mods.find((m) => m.source === 'extremist (primary)')?.pips, pg.extremistPrimary,
    'partySign is 0 for an independent, so the tide has no party to attach to');
});
