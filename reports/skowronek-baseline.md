# Skowronek suite — does american-cycle produce political time?

Run 2026-09-02T19:58:16Z on `99e69f6`.

Regenerate with:

```
npm run skowronek -- --games 300 --agents Greedy,BillAuthor,SenateFlood,Random --packs 1932,1964,1976,1992,2008,2016,2024
```

These are **design targets, not regressions**. They are expected to fail on the current build and are
meant to keep failing until the design changes. This suite is not in `npm test` and not in the blocking
CI job; it is invoked by hand with `npm run skowronek`.

Read the **preconditions** and **diagnosis** sections before the verdict column. On a build where the
settlement object does not exist, most verdicts are `BLOCKED`, which is an *undefined*, not a zero.

## Summary across configs

| config | cap | mean length | settlement forms? | movement? | power concentrates? | quadrants reachable |
| --- | --- | --- | --- | --- | --- | --- |
| `as-written-plus.json` | 100y | 68.7y | yes | yes | yes | 2/4 |
| `as-written.json` | 16y | 16.0y | no | no | yes | 0/4 |
| `baseline.json` | 16y | 16.0y | yes | yes | yes | 2/4 |
| `brutal.json` | 16y | 16.0y | yes | yes | yes | 2/4 |
| `flat-push.json` | 16y | 16.0y | yes | yes | yes | 2/4 |
| `governors-push.json` | 16y | 16.0y | yes | yes | yes | 2/4 |
| `realigning.json` | 24y | 24.0y | yes | yes | yes | 2/4 |
| `three-terms.json` | 60y | 27.9y | yes | yes | yes | 2/4 |
| `tuned.json` | 16y | 16.0y | yes | yes | yes | 2/4 |

## as-written-plus.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 100, mean game length 68.7y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 260529.000 ± 0.000 (n=10042) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.579 ± 0.004 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.392 ± 0.034 (n=300) lean counters |
| `regime-duration` | HEALTHY | mean regime run: 7.308 ± 0.247 (n=2469) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.749 ± 0.019 (n=660) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 3.860 ± 0.139 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 1158.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 1158.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 1158.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 1158.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 4.726666666666667 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | MET | the country position holds off baseline with a variance ratio above 1 |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — preconditions met; see the verdict table.
- **PREEMPTION** — preconditions met; see the verdict table.
- **RECONSTRUCTION** — blocked by `STRAIN_RISE`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.
- **DISJUNCTION** — blocked by `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.

### Controls

#### control-instrument-liveness — **HEALTHY**

*C1: can the formation detector see a settlement that is there by construction?*

| measure | value |
| --- | --- |
| synthetic regime: longest run | 20.000 ± 0.000 (n=1) years |
| synthetic regime: variance ratio | 0.990 ± 0.000 (n=1) |
| random walk: longest run | 15.000 ± 0.000 (n=1) years |
| random walk: variance ratio | 1.102 ± 0.000 (n=1) |
| white noise: longest run | 6.000 ± 0.000 (n=1) years |
| white noise: variance ratio | 0.286 ± 0.000 (n=1) |

Run length separates a built 20-year regime from white noise (20y vs a handful), and the variance ratio correctly marks noise as mean-reverting. NOTE the caveat this control surfaced: the step regime scores VR 0.99 and the random walk 1.10, so VR does NOT distinguish a settlement from a walk. Persistence is read from run length; VR is reported as description only.

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 260529.000 ± 0.000 (n=10042) state-years |
| state-years |lean| rose, NON-election years | 5777.000 ± 0.000 (n=10261) state-years |
| bills passed in non-election years | 3.390 ± 0.115 (n=300) per game |
| non-election bill years per game | 34.203 ± 1.049 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.579 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 3.860 ± 0.139 (n=300) per game |
| mean spread across players | 0.288 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.392 ± 0.034 (n=300) lean counters |
| peak |country position| | 3.261 ± 0.050 (n=300) lean counters |
| years displaced beyond deadband | 0.892 ± 0.005 (n=300) share |
| longest unbroken run on one side | 30.170 ± 1.233 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.768 ± 0.018 (n=300) 1 = random walk |
| sign crossings per decade | 0.599 ± 0.028 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **HEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 7.308 ± 0.247 (n=2469) years |
| longest regime per game | 30.170 ± 1.233 (n=300) years |
| game length | 68.677 ± 2.084 (n=300) years |
| config year cap | 100.000 ± 0.000 (n=300) years |

The cap (100y) admits at least one full cycle, so a short mean run here is a fact about the engine and not about the clock.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.749 ± 0.019 (n=660) lean counters/yr |
| country move within a party | 0.425 ± 0.003 (n=19643) lean counters/yr |
| excess move on turnover | 0.324 ± 0.019 (n=660) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 3.860 ± 0.139 (n=300) per game |
| sustained power windows (no presidency) | 2.200 ± 0.103 (n=300) per game |
| mean power in window (with) | 0.506 ± 0.002 (n=1158) |
| mean power in window (no presidency) | 0.438 ± 0.001 (n=660) |
| windows that held the presidency | 0.992 ± 0.003 (n=1158) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 1158.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 1158.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 1158.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 1158.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## as-written.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 25318.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.547 ± 0.004 (n=300) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.227 ± 0.004 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 1.112 ± 0.012 (n=921) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.918 ± 0.018 (n=177) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.363 ± 0.042 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 409.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 409.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 409.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 409.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.5 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | ABSENT | nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts) |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.

### Controls

#### control-instrument-liveness — **HEALTHY**

*C1: can the formation detector see a settlement that is there by construction?*

| measure | value |
| --- | --- |
| synthetic regime: longest run | 20.000 ± 0.000 (n=1) years |
| synthetic regime: variance ratio | 0.990 ± 0.000 (n=1) |
| random walk: longest run | 15.000 ± 0.000 (n=1) years |
| random walk: variance ratio | 1.102 ± 0.000 (n=1) |
| white noise: longest run | 6.000 ± 0.000 (n=1) years |
| white noise: variance ratio | 0.286 ± 0.000 (n=1) |

Run length separates a built 20-year regime from white noise (20y vs a handful), and the variance ratio correctly marks noise as mean-reverting. NOTE the caveat this control surfaced: the step regime scores VR 0.99 and the random walk 1.10, so VR does NOT distinguish a settlement from a walk. Persistence is read from run length; VR is reported as description only.

#### control-non-electoral-lean-writer — **UNHEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 25318.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 1.643 ± 0.092 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.547 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.363 ± 0.042 (n=300) per game |
| mean spread across players | 0.298 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.227 ± 0.004 (n=300) lean counters |
| peak |country position| | 1.099 ± 0.010 (n=300) lean counters |
| years displaced beyond deadband | 0.213 ± 0.005 (n=300) share |
| longest unbroken run on one side | 1.307 ± 0.033 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.315 ± 0.010 (n=300) 1 = random walk |
| sign crossings per decade | 0.673 ± 0.034 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 1.112 ± 0.012 (n=921) years |
| longest regime per game | 1.307 ± 0.033 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.918 ± 0.018 (n=177) lean counters/yr |
| country move within a party | 0.305 ± 0.006 (n=4323) lean counters/yr |
| excess move on turnover | 0.613 ± 0.018 (n=177) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.363 ± 0.042 (n=300) per game |
| sustained power windows (no presidency) | 0.467 ± 0.032 (n=300) per game |
| mean power in window (with) | 0.501 ± 0.003 (n=409) |
| mean power in window (no presidency) | 0.457 ± 0.003 (n=140) |
| windows that held the presidency | 0.995 ± 0.003 (n=409) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 409.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 409.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 409.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 409.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## baseline.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 20425.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.543 ± 0.004 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.120 ± 0.043 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 4.258 ± 0.137 (n=922) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.018 ± 0.034 (n=188) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.377 ± 0.045 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 413.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 413.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 413.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 413.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.283333333333333 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | MET | the country position holds off baseline with a variance ratio above 1 |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — preconditions met; see the verdict table.
- **PREEMPTION** — preconditions met; see the verdict table.
- **RECONSTRUCTION** — blocked by `STRAIN_RISE`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.
- **DISJUNCTION** — blocked by `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.

### Controls

#### control-instrument-liveness — **HEALTHY**

*C1: can the formation detector see a settlement that is there by construction?*

| measure | value |
| --- | --- |
| synthetic regime: longest run | 20.000 ± 0.000 (n=1) years |
| synthetic regime: variance ratio | 0.990 ± 0.000 (n=1) |
| random walk: longest run | 15.000 ± 0.000 (n=1) years |
| random walk: variance ratio | 1.102 ± 0.000 (n=1) |
| white noise: longest run | 6.000 ± 0.000 (n=1) years |
| white noise: variance ratio | 0.286 ± 0.000 (n=1) |

Run length separates a built 20-year regime from white noise (20y vs a handful), and the variance ratio correctly marks noise as mean-reverting. NOTE the caveat this control surfaced: the step regime scores VR 0.99 and the random walk 1.10, so VR does NOT distinguish a settlement from a walk. Persistence is read from run length; VR is reported as description only.

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 20425.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 18373.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 1.713 ± 0.098 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.543 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.377 ± 0.045 (n=300) per game |
| mean spread across players | 0.292 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.120 ± 0.043 (n=300) lean counters |
| peak |country position| | 2.292 ± 0.073 (n=300) lean counters |
| years displaced beyond deadband | 0.818 ± 0.008 (n=300) share |
| longest unbroken run on one side | 8.993 ± 0.239 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.740 ± 0.028 (n=300) 1 = random walk |
| sign crossings per decade | 0.821 ± 0.040 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 4.258 ± 0.137 (n=922) years |
| longest regime per game | 8.993 ± 0.239 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.018 ± 0.034 (n=188) lean counters/yr |
| country move within a party | 0.458 ± 0.006 (n=4312) lean counters/yr |
| excess move on turnover | 0.560 ± 0.034 (n=188) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.377 ± 0.045 (n=300) per game |
| sustained power windows (no presidency) | 0.430 ± 0.033 (n=300) per game |
| mean power in window (with) | 0.498 ± 0.002 (n=413) |
| mean power in window (no presidency) | 0.448 ± 0.002 (n=129) |
| windows that held the presidency | 1.000 ± 0.000 (n=413) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 413.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 413.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 413.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 413.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## brutal.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 20309.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.546 ± 0.004 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.101 ± 0.040 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 4.144 ± 0.133 (n=946) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.002 ± 0.030 (n=200) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.400 ± 0.042 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 420.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 420.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 420.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 420.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.1266666666666665 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | MET | the country position holds off baseline with a variance ratio above 1 |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — preconditions met; see the verdict table.
- **PREEMPTION** — preconditions met; see the verdict table.
- **RECONSTRUCTION** — blocked by `STRAIN_RISE`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.
- **DISJUNCTION** — blocked by `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.

### Controls

#### control-instrument-liveness — **HEALTHY**

*C1: can the formation detector see a settlement that is there by construction?*

| measure | value |
| --- | --- |
| synthetic regime: longest run | 20.000 ± 0.000 (n=1) years |
| synthetic regime: variance ratio | 0.990 ± 0.000 (n=1) |
| random walk: longest run | 15.000 ± 0.000 (n=1) years |
| random walk: variance ratio | 1.102 ± 0.000 (n=1) |
| white noise: longest run | 6.000 ± 0.000 (n=1) years |
| white noise: variance ratio | 0.286 ± 0.000 (n=1) |

Run length separates a built 20-year regime from white noise (20y vs a handful), and the variance ratio correctly marks noise as mean-reverting. NOTE the caveat this control surfaced: the step regime scores VR 0.99 and the random walk 1.10, so VR does NOT distinguish a settlement from a walk. Persistence is read from run length; VR is reported as description only.

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 20309.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 18831.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 1.483 ± 0.086 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.546 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.400 ± 0.042 (n=300) per game |
| mean spread across players | 0.303 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.101 ± 0.040 (n=300) lean counters |
| peak |country position| | 2.301 ± 0.068 (n=300) lean counters |
| years displaced beyond deadband | 0.817 ± 0.009 (n=300) share |
| longest unbroken run on one side | 8.813 ± 0.247 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.716 ± 0.025 (n=300) 1 = random walk |
| sign crossings per decade | 0.875 ± 0.045 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 4.144 ± 0.133 (n=946) years |
| longest regime per game | 8.813 ± 0.247 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.002 ± 0.030 (n=200) lean counters/yr |
| country move within a party | 0.468 ± 0.006 (n=4300) lean counters/yr |
| excess move on turnover | 0.533 ± 0.030 (n=200) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.400 ± 0.042 (n=300) per game |
| sustained power windows (no presidency) | 0.510 ± 0.036 (n=300) per game |
| mean power in window (with) | 0.501 ± 0.002 (n=420) |
| mean power in window (no presidency) | 0.447 ± 0.002 (n=153) |
| windows that held the presidency | 1.000 ± 0.000 (n=420) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 420.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 420.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 420.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 420.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## flat-push.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 26336.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.532 ± 0.004 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.507 ± 0.054 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 4.848 ± 0.163 (n=846) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.970 ± 0.033 (n=182) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.400 ± 0.048 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 420.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 420.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 420.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 420.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.8466666666666667 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | MET | the country position holds off baseline with a variance ratio above 1 |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — preconditions met; see the verdict table.
- **PREEMPTION** — preconditions met; see the verdict table.
- **RECONSTRUCTION** — blocked by `STRAIN_RISE`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.
- **DISJUNCTION** — blocked by `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.

### Controls

#### control-instrument-liveness — **HEALTHY**

*C1: can the formation detector see a settlement that is there by construction?*

| measure | value |
| --- | --- |
| synthetic regime: longest run | 20.000 ± 0.000 (n=1) years |
| synthetic regime: variance ratio | 0.990 ± 0.000 (n=1) |
| random walk: longest run | 15.000 ± 0.000 (n=1) years |
| random walk: variance ratio | 1.102 ± 0.000 (n=1) |
| white noise: longest run | 6.000 ± 0.000 (n=1) years |
| white noise: variance ratio | 0.286 ± 0.000 (n=1) |

Run length separates a built 20-year regime from white noise (20y vs a handful), and the variance ratio correctly marks noise as mean-reverting. NOTE the caveat this control surfaced: the step regime scores VR 0.99 and the random walk 1.10, so VR does NOT distinguish a settlement from a walk. Persistence is read from run length; VR is reported as description only.

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 26336.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 17993.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 1.973 ± 0.111 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.532 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.400 ± 0.048 (n=300) per game |
| mean spread across players | 0.286 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.507 ± 0.054 (n=300) lean counters |
| peak |country position| | 2.834 ± 0.078 (n=300) lean counters |
| years displaced beyond deadband | 0.854 ± 0.008 (n=300) share |
| longest unbroken run on one side | 10.017 ± 0.257 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.846 ± 0.029 (n=300) 1 = random walk |
| sign crossings per decade | 0.762 ± 0.044 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 4.848 ± 0.163 (n=846) years |
| longest regime per game | 10.017 ± 0.257 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.970 ± 0.033 (n=182) lean counters/yr |
| country move within a party | 0.528 ± 0.007 (n=4318) lean counters/yr |
| excess move on turnover | 0.442 ± 0.034 (n=182) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.400 ± 0.048 (n=300) per game |
| sustained power windows (no presidency) | 0.410 ± 0.030 (n=300) per game |
| mean power in window (with) | 0.492 ± 0.002 (n=420) |
| mean power in window (no presidency) | 0.447 ± 0.002 (n=123) |
| windows that held the presidency | 1.000 ± 0.000 (n=420) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 420.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 420.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 420.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 420.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## governors-push.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 21146.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.533 ± 0.004 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.429 ± 0.049 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 4.638 ± 0.150 (n=878) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.045 ± 0.039 (n=197) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.427 ± 0.048 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 428.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 428.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 428.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 428.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.7133333333333334 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | MET | the country position holds off baseline with a variance ratio above 1 |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — preconditions met; see the verdict table.
- **PREEMPTION** — preconditions met; see the verdict table.
- **RECONSTRUCTION** — blocked by `STRAIN_RISE`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.
- **DISJUNCTION** — blocked by `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.

### Controls

#### control-instrument-liveness — **HEALTHY**

*C1: can the formation detector see a settlement that is there by construction?*

| measure | value |
| --- | --- |
| synthetic regime: longest run | 20.000 ± 0.000 (n=1) years |
| synthetic regime: variance ratio | 0.990 ± 0.000 (n=1) |
| random walk: longest run | 15.000 ± 0.000 (n=1) years |
| random walk: variance ratio | 1.102 ± 0.000 (n=1) |
| white noise: longest run | 6.000 ± 0.000 (n=1) years |
| white noise: variance ratio | 0.286 ± 0.000 (n=1) |

Run length separates a built 20-year regime from white noise (20y vs a handful), and the variance ratio correctly marks noise as mean-reverting. NOTE the caveat this control surfaced: the step regime scores VR 0.99 and the random walk 1.10, so VR does NOT distinguish a settlement from a walk. Persistence is read from run length; VR is reported as description only.

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 21146.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 22763.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 1.973 ± 0.108 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.533 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.427 ± 0.048 (n=300) per game |
| mean spread across players | 0.287 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.429 ± 0.049 (n=300) lean counters |
| peak |country position| | 2.912 ± 0.081 (n=300) lean counters |
| years displaced beyond deadband | 0.848 ± 0.007 (n=300) share |
| longest unbroken run on one side | 9.560 ± 0.244 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.821 ± 0.030 (n=300) 1 = random walk |
| sign crossings per decade | 0.821 ± 0.044 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 4.638 ± 0.150 (n=878) years |
| longest regime per game | 9.560 ± 0.244 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.045 ± 0.039 (n=197) lean counters/yr |
| country move within a party | 0.568 ± 0.008 (n=4303) lean counters/yr |
| excess move on turnover | 0.478 ± 0.040 (n=197) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.427 ± 0.048 (n=300) per game |
| sustained power windows (no presidency) | 0.410 ± 0.031 (n=300) per game |
| mean power in window (with) | 0.493 ± 0.002 (n=428) |
| mean power in window (no presidency) | 0.444 ± 0.002 (n=123) |
| windows that held the presidency | 0.998 ± 0.002 (n=428) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 428.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 428.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 428.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 428.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## realigning.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 24, mean game length 24.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 42843.000 ± 0.000 (n=3300) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.559 ± 0.003 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.745 ± 0.055 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 6.617 ± 0.234 (n=969) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.954 ± 0.028 (n=288) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 2.000 ± 0.061 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 600.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 600.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 600.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 600.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 3.79 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | MET | the country position holds off baseline with a variance ratio above 1 |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — preconditions met; see the verdict table.
- **PREEMPTION** — preconditions met; see the verdict table.
- **RECONSTRUCTION** — blocked by `STRAIN_RISE`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.
- **DISJUNCTION** — blocked by `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.

### Controls

#### control-instrument-liveness — **HEALTHY**

*C1: can the formation detector see a settlement that is there by construction?*

| measure | value |
| --- | --- |
| synthetic regime: longest run | 20.000 ± 0.000 (n=1) years |
| synthetic regime: variance ratio | 0.990 ± 0.000 (n=1) |
| random walk: longest run | 15.000 ± 0.000 (n=1) years |
| random walk: variance ratio | 1.102 ± 0.000 (n=1) |
| white noise: longest run | 6.000 ± 0.000 (n=1) years |
| white noise: variance ratio | 0.286 ± 0.000 (n=1) |

Run length separates a built 20-year regime from white noise (20y vs a handful), and the variance ratio correctly marks noise as mean-reverting. NOTE the caveat this control surfaced: the step regime scores VR 0.99 and the random walk 1.10, so VR does NOT distinguish a settlement from a walk. Persistence is read from run length; VR is reported as description only.

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 42843.000 ± 0.000 (n=3300) state-years |
| state-years |lean| rose, NON-election years | 25881.000 ± 0.000 (n=3600) state-years |
| bills passed in non-election years | 2.517 ± 0.131 (n=300) per game |
| non-election bill years per game | 12.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.559 ± 0.003 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 2.000 ± 0.061 (n=300) per game |
| mean spread across players | 0.289 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.745 ± 0.055 (n=300) lean counters |
| peak |country position| | 3.396 ± 0.079 (n=300) lean counters |
| years displaced beyond deadband | 0.891 ± 0.006 (n=300) share |
| longest unbroken run on one side | 15.893 ± 0.358 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.911 ± 0.026 (n=300) 1 = random walk |
| sign crossings per decade | 0.622 ± 0.037 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 6.617 ± 0.234 (n=969) years |
| longest regime per game | 15.893 ± 0.358 (n=300) years |
| game length | 24.000 ± 0.000 (n=300) years |
| config year cap | 24.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 24, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.954 ± 0.028 (n=288) lean counters/yr |
| country move within a party | 0.502 ± 0.006 (n=6612) lean counters/yr |
| excess move on turnover | 0.452 ± 0.028 (n=288) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 2.000 ± 0.061 (n=300) per game |
| sustained power windows (no presidency) | 0.683 ± 0.038 (n=300) per game |
| mean power in window (with) | 0.497 ± 0.002 (n=600) |
| mean power in window (no presidency) | 0.447 ± 0.002 (n=205) |
| windows that held the presidency | 1.000 ± 0.000 (n=600) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 600.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 600.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 600.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 600.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## three-terms.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 60, mean game length 27.9y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 40294.000 ± 0.000 (n=4029) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.565 ± 0.003 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.505 ± 0.051 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 5.415 ± 0.191 (n=1321) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.933 ± 0.028 (n=320) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 2.047 ± 0.057 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 614.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 614.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 614.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 614.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 4.083333333333333 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | MET | the country position holds off baseline with a variance ratio above 1 |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — preconditions met; see the verdict table.
- **PREEMPTION** — preconditions met; see the verdict table.
- **RECONSTRUCTION** — blocked by `STRAIN_RISE`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.
- **DISJUNCTION** — blocked by `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.

### Controls

#### control-instrument-liveness — **HEALTHY**

*C1: can the formation detector see a settlement that is there by construction?*

| measure | value |
| --- | --- |
| synthetic regime: longest run | 20.000 ± 0.000 (n=1) years |
| synthetic regime: variance ratio | 0.990 ± 0.000 (n=1) |
| random walk: longest run | 15.000 ± 0.000 (n=1) years |
| random walk: variance ratio | 1.102 ± 0.000 (n=1) |
| white noise: longest run | 6.000 ± 0.000 (n=1) years |
| white noise: variance ratio | 0.286 ± 0.000 (n=1) |

Run length separates a built 20-year regime from white noise (20y vs a handful), and the variance ratio correctly marks noise as mean-reverting. NOTE the caveat this control surfaced: the step regime scores VR 0.99 and the random walk 1.10, so VR does NOT distinguish a settlement from a walk. Persistence is read from run length; VR is reported as description only.

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 40294.000 ± 0.000 (n=4029) state-years |
| state-years |lean| rose, NON-election years | 41470.000 ± 0.000 (n=4050) state-years |
| bills passed in non-election years | 2.720 ± 0.185 (n=300) per game |
| non-election bill years per game | 13.500 ± 0.429 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.565 ± 0.003 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 2.047 ± 0.057 (n=300) per game |
| mean spread across players | 0.289 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.505 ± 0.051 (n=300) lean counters |
| peak |country position| | 3.359 ± 0.089 (n=300) lean counters |
| years displaced beyond deadband | 0.859 ± 0.006 (n=300) share |
| longest unbroken run on one side | 14.280 ± 0.542 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.878 ± 0.026 (n=300) 1 = random walk |
| sign crossings per decade | 0.861 ± 0.041 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 5.415 ± 0.191 (n=1321) years |
| longest regime per game | 14.280 ± 0.542 (n=300) years |
| game length | 27.930 ± 0.849 (n=300) years |
| config year cap | 60.000 ± 0.000 (n=300) years |

The cap (60y) admits at least one full cycle, so a short mean run here is a fact about the engine and not about the clock.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.933 ± 0.028 (n=320) lean counters/yr |
| country move within a party | 0.552 ± 0.006 (n=7759) lean counters/yr |
| excess move on turnover | 0.381 ± 0.029 (n=320) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 2.047 ± 0.057 (n=300) per game |
| sustained power windows (no presidency) | 0.873 ± 0.051 (n=300) per game |
| mean power in window (with) | 0.494 ± 0.002 (n=614) |
| mean power in window (no presidency) | 0.445 ± 0.002 (n=262) |
| windows that held the presidency | 0.993 ± 0.003 (n=614) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 614.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 614.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 614.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 614.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## tuned.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 21152.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.533 ± 0.004 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.427 ± 0.049 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 4.650 ± 0.150 (n=876) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.045 ± 0.039 (n=197) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.430 ± 0.048 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 429.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 429.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 429.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 429.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.6866666666666665 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | MET | the country position holds off baseline with a variance ratio above 1 |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — preconditions met; see the verdict table.
- **PREEMPTION** — preconditions met; see the verdict table.
- **RECONSTRUCTION** — blocked by `STRAIN_RISE`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.
- **DISJUNCTION** — blocked by `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable.
  - Control: none yet: the instrument does not exist to be controlled.

### Controls

#### control-instrument-liveness — **HEALTHY**

*C1: can the formation detector see a settlement that is there by construction?*

| measure | value |
| --- | --- |
| synthetic regime: longest run | 20.000 ± 0.000 (n=1) years |
| synthetic regime: variance ratio | 0.990 ± 0.000 (n=1) |
| random walk: longest run | 15.000 ± 0.000 (n=1) years |
| random walk: variance ratio | 1.102 ± 0.000 (n=1) |
| white noise: longest run | 6.000 ± 0.000 (n=1) years |
| white noise: variance ratio | 0.286 ± 0.000 (n=1) |

Run length separates a built 20-year regime from white noise (20y vs a handful), and the variance ratio correctly marks noise as mean-reverting. NOTE the caveat this control surfaced: the step regime scores VR 0.99 and the random walk 1.10, so VR does NOT distinguish a settlement from a walk. Persistence is read from run length; VR is reported as description only.

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 21152.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 22718.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 1.957 ± 0.107 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.533 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.430 ± 0.048 (n=300) per game |
| mean spread across players | 0.287 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.427 ± 0.049 (n=300) lean counters |
| peak |country position| | 2.913 ± 0.080 (n=300) lean counters |
| years displaced beyond deadband | 0.849 ± 0.007 (n=300) share |
| longest unbroken run on one side | 9.580 ± 0.244 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.819 ± 0.030 (n=300) 1 = random walk |
| sign crossings per decade | 0.815 ± 0.044 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 4.650 ± 0.150 (n=876) years |
| longest regime per game | 9.580 ± 0.244 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.045 ± 0.039 (n=197) lean counters/yr |
| country move within a party | 0.566 ± 0.008 (n=4303) lean counters/yr |
| excess move on turnover | 0.479 ± 0.040 (n=197) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.430 ± 0.048 (n=300) per game |
| sustained power windows (no presidency) | 0.410 ± 0.031 (n=300) per game |
| mean power in window (with) | 0.492 ± 0.002 (n=429) |
| mean power in window (no presidency) | 0.444 ± 0.002 (n=123) |
| windows that held the presidency | 0.998 ± 0.002 (n=429) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 429.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 429.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 429.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 429.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.
