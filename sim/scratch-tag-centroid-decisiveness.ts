/** Scratch: hf7y/american-cycle#108 -- measure before rewriting.
 *
 *  tags.centroid()/distance() are the one subsystem in this engine nobody
 *  could compute at a table. #92's ruling made them load-bearing everywhere
 *  a position is compared. The question is whether that unplayability is
 *  DECISIVE or THEORETICAL: how often does the tag-fit term actually change
 *  a race winner or a bill's passage, versus sit there scoring nothing.
 *
 *  Two measurements, on both shipped configs (tuned, as-written-plus):
 *
 *  1. PARTY FIT (elections.ts's `partyFit` modifier, from tags.distance() in
 *     game.ts). Post-hoc: every RaceEvent already logs each side's modifier
 *     stack and dice (`zeroDiceWinner` is this same counterfactual shape,
 *     applied to ALL modifiers instead of one). Strip 'party fit' and
 *     re-rank on the remainder plus the SAME dice already rolled -- no
 *     engine change, no re-simulation. Ties (rare -- see resolution.ts's own
 *     comment on the open tie-break question) keep the actual winner rather
 *     than drawing a new coin flip, which slightly UNDERSTATES the flip
 *     rate; noted in the printout, not hidden.
 *
 *  2. BILL FIT (the `distance` term in Base.voteBill, sim/agents.ts). No
 *     RaceEvent equivalent exists for votes, so this patches
 *     Base.prototype.voteBill for the run: call the real method twice, once
 *     with the real billTags and once with billTags forced to `undefined`,
 *     which is EXACTLY the party-only fallback branch already written in
 *     Base.voteBill (elections.ts is untouched; this calls the shipped
 *     function twice rather than reimplementing its branches). Only agents
 *     that inherit Base.voteBill unmodified are measurable this way --
 *     RandomAgent/BillMaximizer/BillAuthor/EconomyChicken override it and
 *     are excluded from the pool for exactly that reason, not sampled around.
 *     Passage counterfactual re-tallies with `tallyBill` (the real function,
 *     imported not reimplemented) on the party-only vote set. VETOES ARE NOT
 *     MODELLED in the counterfactual tally -- passed-then-vetoed bills are
 *     compared as passed/not-passed on the vote count alone, which is the
 *     legislative question #108 asks; a throwaway RNG feeds the reaction
 *     roll `tallyBill` requires so the game's own RNG stream is untouched.
 *
 *  node sim/scratch-tag-centroid-decisiveness.ts
 */
import { loadConfig, loadPacks, ALL_PACKS } from './harness.ts';
import { GreedyAgent, AGENTS } from './agents.ts';
import { Game } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { tallyBill, type Vote } from '../engine/rules/legislature.ts';
import type { GameView } from '../engine/game.ts';
import type { Seat, IdentityTag } from '../engine/types/index.ts';

const POOL = ['Greedy', 'Lookahead', 'SenateFlood', 'HouseFarm'];
const SEEDS = 200;
const cards = loadPacks(ALL_PACKS);

// ---- 1. party fit in races, from the logged RaceEvent alone ---------------

function partyFitDecisiveness(configName: string) {
  const cfg = loadConfig(configName);
  const counts = {
    primary: { total: 0, nonzero: 0, flips: 0 },
    general: { total: 0, nonzero: 0, flips: 0 },
  };
  for (let i = 0; i < SEEDS; i++) {
    const seed = 8_800_000 + i;
    const rng = new RNG(seed);
    const order = POOL.map((_, k) => POOL[(k + i) % POOL.length]);
    const g = new Game(order.map((name) => new AGENTS[name](cfg, rng)), cards, cfg, seed);
    const r = g.run();
    for (const ev of r.events) {
      if (ev.uncontested || ev.sides.length < 2) continue;
      const bucket = counts[ev.round as 'primary' | 'general'];
      if (!bucket) continue;
      bucket.total++;
      const hasFit = ev.sides.some((s) => s.modifiers.some((m) => m.source === 'party fit' && m.pips !== 0));
      if (!hasFit) continue;
      bucket.nonzero++;
      const without = ev.sides.map((s) => ({
        player: s.player,
        total: s.total - s.modifiers.filter((m) => m.source === 'party fit').reduce((n, m) => n + m.pips, 0),
      }));
      const ranked = [...without].sort((a, b) => b.total - a.total);
      const flipped = ranked[0].total !== ranked[1]?.total && ranked[0].player !== ev.winner;
      if (flipped) bucket.flips++;
    }
  }
  return counts;
}

// ---- 2. bill fit in votes and passage, via the shipped functions ----------

function billFitDecisiveness(configName: string) {
  const cfg = loadConfig(configName);
  const BaseProto = Object.getPrototypeOf(GreedyAgent.prototype);
  const original: (v: GameView, g: number, seat: Seat, billTags?: readonly IdentityTag[]) => boolean =
    BaseProto.voteBill;

  let voteTotal = 0, voteFlips = 0;
  let billGroups: { seats: Seat[]; g: number; votes: { actual: Vote; partyOnly: Vote }[] }[] = [];
  let current: (typeof billGroups)[number] | undefined;
  let currentTagsRef: readonly IdentityTag[] | undefined;

  BaseProto.voteBill = function (
    this: unknown, v: GameView, g: number, seat: Seat, billTags?: readonly IdentityTag[],
  ): boolean {
    const actual = original.call(this, v, g, seat, billTags);
    const partyOnly = original.call(this, v, g, seat, undefined);
    voteTotal++;
    if (billTags !== undefined && actual !== partyOnly) voteFlips++;

    if (billTags !== currentTagsRef || !current) {
      current = { seats: v.seats, g, votes: [] };
      billGroups.push(current);
      currentTagsRef = billTags;
    }
    const holder = seat.holder!;
    const base = { player: holder.player, party: holder.party, office: seat.office as 'senator' | 'representative', cardId: holder.cardId };
    current.votes.push({ actual: { ...base, yes: actual }, partyOnly: { ...base, yes: partyOnly } });
    return actual;
  };

  try {
    for (let i = 0; i < SEEDS; i++) {
      const seed = 9_900_000 + i;
      const rng = new RNG(seed);
      const order = POOL.map((_, k) => POOL[(k + i) % POOL.length]);
      const g = new Game(order.map((name) => new AGENTS[name](cfg, rng)), cards, cfg, seed);
      g.run();
    }
  } finally {
    BaseProto.voteBill = original;
  }

  const shadowRng = new RNG(1);
  let billsTotal = 0, billsFlipped = 0;
  for (const bill of billGroups) {
    if (!bill.votes.length) continue;
    billsTotal++;
    const actualVotes = bill.votes.map((v) => v.actual);
    const partyVotes = bill.votes.map((v) => v.partyOnly);
    const actualPassed = tallyBill(cfg.legislature, bill.seats, actualVotes, bill.g, undefined, false, undefined, shadowRng).passed;
    const partyPassed = tallyBill(cfg.legislature, bill.seats, partyVotes, bill.g, undefined, false, undefined, shadowRng).passed;
    if (actualPassed !== partyPassed) billsFlipped++;
  }

  return { voteTotal, voteFlips, billsTotal, billsFlipped };
}

for (const configName of ['tuned.json', 'as-written-plus.json']) {
  console.log(`\n=== ${configName} (pool ${POOL.join(',')}, ${SEEDS} seeds) ===`);

  const races = partyFitDecisiveness(configName);
  for (const round of ['primary', 'general'] as const) {
    const b = races[round];
    console.log(
      `party fit, ${round}: nonzero in ${b.nonzero}/${b.total} contested races `
      + `(${b.total ? ((b.nonzero / b.total) * 100).toFixed(1) : 'n/a'}%), `
      + `flips winner in ${b.flips}/${b.nonzero || 1} nonzero cases `
      + `(${b.nonzero ? ((b.flips / b.nonzero) * 100).toFixed(1) : 'n/a'}%)`,
    );
  }

  const bills = billFitDecisiveness(configName);
  console.log(
    `bill fit, votes: flips ${bills.voteFlips}/${bills.voteTotal} `
    + `(${bills.voteTotal ? ((bills.voteFlips / bills.voteTotal) * 100).toFixed(1) : 'n/a'}%)`,
  );
  console.log(
    `bill fit, passage: flips ${bills.billsFlipped}/${bills.billsTotal} `
    + `(${bills.billsTotal ? ((bills.billsFlipped / bills.billsTotal) * 100).toFixed(1) : 'n/a'}%)`,
  );
}
