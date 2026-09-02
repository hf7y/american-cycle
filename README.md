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
written today can be re-run against v0.1.2 in a year:

```
git worktree add /tmp/old <tag>
cp -r tracks /tmp/old/tracks && cp sim/tracks.ts /tmp/old/sim/
(cd /tmp/old && node sim/tracks.ts --tag <tag> --emit /tmp/old.json)
npm run tracks -- --diff /tmp/old.json reports/tracks-v0.2.json
```

That only works because the suite **probes the build rather than assuming
it**. Nothing in `tracks/` may import a module that postdates the oldest build
it runs against, or read a `GameResult` field without asking whether this build
has one. An item declares what it `needs`; the runner reports **NOT
MEASURABLE**, which is a third state — not a pass, not a failure, and not a
decision not to build. In a diff those cells read `n/a`, never `0`, because a
zero would claim the mechanic did nothing when in fact it did not exist.

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
npm run tracks                                      # everything
npm run tracks -- --emit reports/tracks-v0.2.json   # freeze a baseline
npm run tracks -- --diff reports/tracks-v0.1.2.json reports/tracks-v0.2.json
npm run skowronek                                   # the regime suite (Track C1)
```

`reports/tracks-v0.1.2.json` and `reports/tracks-v0.2.json` are the two frozen
baselines. The headline of the diff between them: player-scores that never
decrease **1.00 → 0.05**, games ending by condition **n/a → 48%**, bill passage
**6.3% → 26.1%**, determination point **0.50 → 0.625** against a 75–85% band.

### Read the bar before you read the verdict

Every acceptance item carries an `oracle`: where its **passing threshold** came
from. `SIM-BRIEF` and `design-doc` are quoted from something external;
`authored-here` means whoever wrote the item picked the number, in most cases
after seeing the data. A compound bar takes the provenance of its weaker half.

A green against an external bar is evidence. A green against an authored one is
a scoreboard drawn around where the ball landed. Both belong in the suite — an
authored bar beats no bar — but they are not the same claim, and the number
alone cannot tell you which it is. At v0.2:

| bar set by | green |
|---|---|
| SIM-BRIEF | 0 / 1 |
| design-doc | 0 / 3 |
| authored-here | 4 / 7 |

**Every externally-set bar is red, and every green is one we set ourselves.**

Separately, `calibrated` marks an item whose *measured value* — not its bar —
depends on a knob somebody tuned to reach it. C6's 48% is the case: Article V's
two-thirds and three-quarters are constitutional, but the die thresholds under
them are not, and across the swept grid the ending rate runs from 3% to 98%. A
green there says the dial is where it was put.

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
