# american-cycle

A board game about the American political cycle, and a simulator that grades it.
Players are factions, not parties: a faction holds cards of both parties and
declares candidates into races across a fifty-state map. Elections resolve on
3d6 against a stack of flat modifiers; winning a state by a wide margin pushes
its **lean**, and lean decays every cycle, so the map realigns only under
sustained pressure.

## Layout

| path | what it is |
|---|---|
| `design-doc.md` | the rules. The spec the engine implements |
| `engine/` | the rules as code — `game.ts` is the turn loop, `rules/` the resolvers |
| `engine/config/*.json` | nine tunings of the same rules; `as-written-plus` is §7 taken literally |
| `sim/` | headless harness, agents, sweeps, and the browser playtests |
| `findings/` | **claims as predicates** — see below |
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

## Run

```
npm test                  # engine + findings shape checks
npx tsc --noEmit          # typecheck
npm run sim               # headless games
node ui/build.ts && python3 sim/playtest.py   # play a game in a browser
```

Everything is seeded. `PLAYTEST_SEED` fixes the browser tests; every sim entry
point takes a seed, so a pathology is reported with the seed that shows it.
