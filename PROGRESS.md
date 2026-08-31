# Overnight build state — american-cycle

Goal (Zach, 2026-08-31): a playable web app, human vs computer, several
opponent types, tuned by simulation. Plus variant configs so the effect of
individual mechanics is visible. Docs at root are source of truth:
`design-doc.md` (rules), `DECISIONS.md` (settled/cut/open), `BUILD-BRIEF.md`
(build order), `SIM-BRIEF.md` (what the sim must answer).

Branch: `phase1-engine`. Land as a PR; never commit to main.

## Steps

- [x] Scaffold: package.json, tsconfig, node-native TS (no build step, no deps
      but typescript). Removed the superseded Python toy.
- [x] design-doc.md §3 odds table corrected — dice right, table wrong (Zach
      confirmed). True 3d6 values now in the doc.
- [x] engine/states.ts — 50 states, gubernatorial schedule, delegation sizes
- [x] engine/types, engine/config/baseline.json (every constant named;
      §16 open questions flagged as placeholders, never silently invented)
- [x] engine/rules/rng.ts — seeded, reproducible from a seed
- [x] engine/rules/resolution.ts — 3 labeled dice, modifier stack, event log
      with the zero-dice counterfactual (SIM-BRIEF ground rule)
- [x] engine/rules/lean.ts — margin push, decay; governors never push
- [x] engine/rules/economy.ts — economy walk, accumulated G, 2d6 Fed roll-under
- [x] engine/rules/legislature.ts — omnibill, 60% Senate, veto, impeachment
- [x] engine/rules/elections.ts — declaration, withdrawal-before-reveal,
      primaries, generals, coattails, seating, capture
- [x] engine/rules/year.ts + engine/game.ts — §7 sequence
- [x] Tests (BUILD-BRIEF names these four as the correctness targets):
      odds table; withdrawal closes before deciding info; decay before push;
      governors never push
- [ ] data/ — real card packs across eras (1976, 1992, 2008, 2016)
- [x] sim/agents.ts — Random, Greedy, Lookahead + the eight from SIM-BRIEF §2
- [x] sim/harness.ts — `node sim/harness.ts --games N --config baseline.json` → CSV
- [x] sim/sweeps.ts — the ten sweeps in SIM-BRIEF Part 4
- [x] Run sweeps; pick tuned baseline + 3-4 contrast variants
- [x] reports/overnight-2026-08-31.md — SIM-BRIEF deliverable, 7 sections
- [ ] ui/ — self-contained HTML, play vs computer, pick opponent + variant
- [x] Publish as Artifact (done)
- [ ] Open PR
- [ ] Portraits from Wikipedia; historical baseline from MIT Election Lab

## Where the build stands

Engine complete and green (31 tests, clean typecheck). Four real era packs.
Ten agents. Harness runs. Findings F1-F5 in FINDINGS.md; F4 (79% of races
uncontested, vs SIM-BRIEF's 40% bar) is the live problem and the next sweep
targets it. Branch pushed.

## Notes / decisions taken while unattended

- Node strip-only mode bans `constructor(private x)` parameter properties and
  `enum`. Engine avoids both throughout.
- Fractional thresholds (2/3 of 9) need an epsilon compare; `legislature.ts`
  routes every threshold through `atLeast`/`moreThan`.
- §16 Q1 (decay frequency) is SETTLED by arithmetic, not simulation -- biennial
  is the only setting under which realignment is possible. See FINDINGS.md F2.
- Tie on equal totals: design doc does not specify. Placeholder = even break
  (coin flip), which is what makes edge 0 exactly 50%. Flagged for DECISIONS.md
  open list, not silently invented.
