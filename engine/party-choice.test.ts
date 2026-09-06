/** hf7y/american-cycle#15, RULED 2026-09-02: party choice as a two-arm
 *  experiment. `sim/agents.ts`'s `options()` is the single choke point every
 *  agent declares through (see `AGENTS` in that file), so the mechanism is
 *  tested there rather than per-agent: `game.partyChoice` unset/'printed'
 *  must reproduce the exact pre-#15 behaviour (one option, printed party,
 *  byte-identical edge), and the two open arms must offer BOTH labels as
 *  competing options with the edge difference the ruling specifies, rather
 *  than deciding the pick themselves -- that decision is left to whichever
 *  option scores highest, the policy every agent already runs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Config, GameView, OpenRace } from './game.ts';
import { options, AGENTS } from '../sim/agents.ts';
import { RNG } from './rules/rng.ts';
import type { CandidateCard } from './types/index.ts';

const loadConfig = (name: string): Config =>
  JSON.parse(readFileSync(new URL(`./config/${name}`, import.meta.url), 'utf8')) as Config;

const cand = (o: Partial<CandidateCard>): CandidateCard => ({
  id: 'c1', name: 'C', party: 'R', homeState: 'ZZ', homeStateBonus: 0,
  identities: [], era: 1976, effects: [], ...o,
});

/** One player, one card, one open Senate race in the card's home state --
 *  the smallest fixture `options()` will price. `lean` isolates the only
 *  modifier that tells the two party labels apart in this fixture (state
 *  lean favours a sign, not a party), everything else (home state bonus 0,
 *  no district, no incumbency, no extremist effect) reads as zero pips for
 *  either label so the edge difference is exactly the mechanism under test. */
function fixture(card: CandidateCard, stateLean: number): { v: GameView; open: OpenRace[] } {
  const v: GameView = {
    year: 1978, isElectionYear: true, isMidterm: true, isPresidentialYear: false,
    economy: { level: 0, accumulatedG: 0 },
    lean: { ZZ: stateLean },
    seats: [],
    players: [{ id: 0, name: 'P', hand: [{ kind: 'candidate', ...card }], districts: [], score: 0, tapped: new Set() }],
    me: 0,
    bills: [], amendments: [],
  };
  const open: OpenRace[] = [{ office: 'senator', state: 'ZZ' }];
  return { v, open };
}

test('party choice: unset default offers exactly one option, printed party, unchanged edge', () => {
  const cfg = loadConfig('tuned.json');
  const card = cand({ party: 'R' });
  const { v, open } = fixture(card, -8);
  const opts = options(v, open, cfg);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].d.card.party, 'R');
  assert.equal(opts[0].edge, 0); // R gets no lean modifier in a -8 (D-favouring) state
});

test("party choice: 'printed' explicitly set behaves identically to unset", () => {
  const base = loadConfig('tuned.json');
  const cfg: Config = { ...base, game: { ...base.game, partyChoice: 'printed' } };
  const card = cand({ party: 'R' });
  const { v, open } = fixture(card, -8);
  const opts = options(v, open, cfg);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].d.card.party, 'R');
});

test('party choice: printedAffinity offers both labels; in a neutral state the printed one wins by exactly the configured bonus', () => {
  const base = loadConfig('tuned.json');
  const cfg: Config = {
    ...base,
    game: { ...base.game, partyChoice: 'printedAffinity' },
    primaryGeneral: { ...base.primaryGeneral, printedPartyPips: 3 },
  };
  const card = cand({ party: 'R' });
  const { v, open } = fixture(card, 0); // neutral -- no lean modifier for either label
  const opts = options(v, open, cfg);
  assert.equal(opts.length, 2);
  const printed = opts.find((o) => o.d.card.party === 'R')!;
  const flipped = opts.find((o) => o.d.card.party === 'D')!;
  assert.ok(printed && flipped, 'expected both R and D variants');
  assert.equal(printed.edge - flipped.edge, 3);
});

test('party choice: free offers both labels with no bonus, and a strongly opposing lean makes the OTHER label the higher edge', () => {
  const base = loadConfig('tuned.json');
  const cfg: Config = { ...base, game: { ...base.game, partyChoice: 'free' } };
  const card = cand({ party: 'R' });
  const { v, open } = fixture(card, -8); // a strongly Democratic-leaning state
  const opts = options(v, open, cfg);
  assert.equal(opts.length, 2);
  const printed = opts.find((o) => o.d.card.party === 'R')!;
  const flipped = opts.find((o) => o.d.card.party === 'D')!;
  assert.equal(printed.edge, 0);
  assert.equal(flipped.edge, 8);
  assert.ok(flipped.edge > printed.edge);
});

test("party choice: 'I' (independent-conversion) cards are left alone -- one option, no flip", () => {
  const base = loadConfig('tuned.json');
  const cfg: Config = { ...base, game: { ...base.game, partyChoice: 'free' } };
  const card = cand({ party: 'I' });
  const { v, open } = fixture(card, -8);
  const opts = options(v, open, cfg);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].d.card.party, 'I');
});

test('party choice: a Greedy agent declares the higher-edge label once, not the card twice', () => {
  const base = loadConfig('tuned.json');
  const cfg: Config = { ...base, game: { ...base.game, partyChoice: 'free' } };
  const card = cand({ party: 'R' });
  const { v, open } = fixture(card, -8);
  const agent = new AGENTS.Greedy(cfg, new RNG(1));
  const decls = agent.declare(v, open, []);
  assert.equal(decls.length, 1);
  assert.equal(decls[0].card.party, 'D'); // the higher-edge label in a -8 state
});
