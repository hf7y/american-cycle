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
  id: 'OH-9', state: 'OH', number: 9, era: 1976, demographics: [], synergy: 1, ...o,
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

/** #112: a statewide race has no single correct district to read fit
 *  against, so `homeDistrict` must not depend on which of a player's
 *  districts an array happens to yield first. */
test('homeDistrict combines a state\'s districts regardless of array order', () => {
  const a = dist({ id: 'CA-3', state: 'CA', synergy: 2, demographics: ['urban'] });
  const b = dist({ id: 'CA-9', state: 'CA', synergy: 1, demographics: ['union'] });
  const forward = homeDistrict([a, b], 'CA')!;
  const reversed = homeDistrict([b, a], 'CA')!;
  assert.deepEqual(forward, reversed, 'draw order must not change the combined district');
  assert.equal(forward.synergy, 3, 'synergy sums rather than reading one card');
  assert.deepEqual(new Set(forward.demographics), new Set(['urban', 'union']));
  assert.equal(homeDistrict([a, b], 'OH'), undefined, 'no district in the state, no fit');
});

test('#112: the presidential modifier stack does not depend on district draw order', () => {
  const a = dist({ id: 'CA-3', state: 'CA', synergy: 2, demographics: ['urban'] });
  const b = dist({ id: 'CA-9', state: 'CA', synergy: 1, demographics: ['union'] });
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
  // on home state plus district synergy.
  const manchin: Declaration = {
    player: 0, state: 'WV', office: 'senator',
    district: dist({ id: 'WV-1', state: 'WV', synergy: 3 }),
    card: cand({ id: 'manchin', party: 'D', homeState: 'WV', homeStateBonus: 2 }),
  };
  const c = ctx({ state: 'WV', isMidterm: true, presidentParty: 'D' });
  const mods = buildModifiers(manchin, c, 'general', res, nat, pg);
  assert.ok(mods.some((m) => m.source === 'midterm'), 'the tide is not shed');
  const side = { player: 0, cardId: 'manchin', party: 'D' as const, modifiers: mods };
  assert.equal(resolution.modifierTotal(side), 3, 'home state 2 + synergy 3 - midterm 2');
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
  const house: Declaration = { player: 0, card: cand({}), office: 'representative', state: 'OH', incumbent: true };
  const senate: Declaration = { player: 0, card: cand({}), office: 'senator', state: 'OH', incumbent: true };
  const houseMods = buildModifiers(house, ctx({ office: 'representative' }), 'general', res, nat, pg);
  const senateMods = buildModifiers(senate, ctx({ office: 'senator' }), 'general', res, nat, pg);
  assert.equal(houseMods.find((m) => m.source === 'incumbency')?.pips, res.incumbency,
    'no incumbencyHouse set on baseline.json, so the House falls back to the flat value');
  assert.equal(senateMods.find((m) => m.source === 'incumbency')?.pips, res.incumbency,
    'same fallback for the Senate -- #16 ships the field before it ships a new number');
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
