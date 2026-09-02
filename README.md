# american-cycle

A board game about the American political cycle, and a simulator that grades it.
Players are factions, not parties: a faction holds cards of both parties and
declares candidates into races across a fifty-state map. Elections resolve on
3d6 against a stack of flat modifiers; winning a state by a wide margin pushes
its **lean**, and lean decays every cycle, so the map realigns only under
sustained pressure.

**Scoring is the board, not a tally** (v0.2). Nothing accumulates: at the end
of every year the score is read off what you still hold — bills still on the
books, states still leaning your way, politicians still in office, amendments
ratified, cards played and held. Anything repealed, reversed or unseated
scores zero, which is why a score can fall without a decay rule anywhere. The
one earned ending is a **constitutional amendment**: two-thirds of the states
to call a convention, three-quarters to ratify, and thirteen to block — so a
narrow leader can never close alone.

## Layout

| path | what it is |
|---|---|
| `engine/` | the rules as code — `game.ts` is the turn loop, `rules/` the resolvers |
| `engine/config/*.json` | nine tunings of the same rules; `as-written-plus` is §7 taken literally |
| `sim/` | headless harness, agents, sweeps, and the browser playtests |
| `findings/` | **claims as predicates** — see below |
| `tracks/` | **the test program** — four tracks, two oracles; see below |
| `skowronek/` | the regime suite: compass, observation, checks, controls, report |
| `data/historical/` | MIT election returns, as evidence to validate against |
| `ui/` | the playable board; `node ui/build.ts` bundles it |

## Findings are predicates, not prose

A number written in a document is true on the day it is written and silently
false afterwards. So a finding here is a **predicate that re-derives itself**,
carrying a stamped value and a tolerance:

```
node sim/findings.ts          # HOLDS / STALE / BROKEN for every finding
node sim/findings.ts --restamp   # the only sanctioned way for a headline to change
```

STALE is information, not failure — it means the engine moved. Prose that made
claims the engine could invalidate has been reaped; see issue #53 for the index
and `hf7y/ecosystem1-vault` for the text.

## The test program: tests are not pinned to builds, baselines are

`findings/` carries its stamp inline and goes stale. `tracks/` carries none —
one suite lives on main and runs against any worktree, and what gets frozen per
tag is a **numbers file**. Comparison is diffing two numbers files, so a test
written today can be re-run against v0.1.2 in a year.

| track | oracle | expected state | blocks CI |
|---|---|---|---|
| **A** measurement layer | none — plumbing | green | yes |
| **B** characterization | none — records, never judges | always green, values move | yes |
| **C** design acceptance | design literature + SIM-BRIEF bars | **RED until built, on purpose** | no |
| **D** historical validity | the postwar record | mixed, permanently | no |

Recording is separated from judging for a reason: a predicate that both
measures and passes has to pick a tolerance, and a wide one hides staleness.
Track B stamps a number without comment; Track C fails on it loudly.

```
npm run tracks                                  # everything
npm run tracks -- --emit reports/tracks-v0.2.json   # freeze a baseline
npm run tracks -- --diff old.json new.json          # what moved between tags
npm run skowronek                                   # the regime suite (Track C1)
```

An item that is deliberately not built says so and says what it would need.
Silent omission reads as "covered everything" when it did not.

## Run

```
npm test                  # engine + findings shape checks
npx tsc --noEmit          # typecheck
npm run sim               # headless games
npm run tracks            # the four-track test program
npm run skowronek         # the regime suite
node ui/build.ts && python3 sim/playtest.py   # play a game in a browser
```

Everything is seeded. `PLAYTEST_SEED` fixes the browser tests; every sim entry
point takes a seed, so a pathology is reported with the seed that shows it.
