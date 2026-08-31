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
- [ ] engine/states.ts — 50 states, gubernatorial schedule, delegation sizes
- [ ] engine/types, engine/config/baseline.json (every constant named;
      §16 open questions flagged as placeholders, never silently invented)
- [ ] engine/rules/rng.ts — seeded, reproducible from a seed
- [ ] engine/rules/resolution.ts — 3 labeled dice, modifier stack, event log
      with the zero-dice counterfactual (SIM-BRIEF ground rule)
- [ ] engine/rules/lean.ts — margin push, decay; governors never push
- [ ] engine/rules/economy.ts — economy walk, accumulated G, 2d6 Fed roll-under
- [ ] engine/rules/legislature.ts — omnibill, 60% Senate, veto, impeachment
- [ ] engine/rules/elections.ts — declaration, withdrawal-before-reveal,
      primaries, generals, coattails, seating, capture
- [ ] engine/rules/year.ts + engine/game.ts — §7 sequence
- [ ] Tests (BUILD-BRIEF names these four as the correctness targets):
      odds table; withdrawal closes before deciding info; decay before push;
      governors never push
- [ ] data/ — real card packs across eras (1976, 1992, 2008, 2016)
- [ ] sim/agents.ts — Random, Greedy, Lookahead + the eight from SIM-BRIEF §2
- [ ] sim/harness.ts — `node sim/harness.ts --games N --config baseline.json` → CSV
- [ ] sim/sweeps.ts — the ten sweeps in SIM-BRIEF Part 4
- [ ] Run sweeps; pick tuned baseline + 3-4 contrast variants
- [ ] reports/overnight-2026-08-31.md — SIM-BRIEF deliverable, 7 sections
- [ ] ui/ — self-contained HTML, play vs computer, pick opponent + variant
- [ ] Publish as Artifact; open PR

## Notes / decisions taken while unattended

- Tie on equal totals: design doc does not specify. Placeholder = even break
  (coin flip), which is what makes edge 0 exactly 50%. Flagged for DECISIONS.md
  open list, not silently invented.
