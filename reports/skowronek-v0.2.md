# Skowronek suite — does american-cycle produce political time?

Run 2026-09-02T02:39:54Z on `5d06f41`.

Regenerate with:

```
npm run skowronek -- --games 20 --agents Greedy,BillAuthor,SenateFlood,Random --packs 1932,1964,1976,1992,2008,2016,2024
```

These are **design targets, not regressions**. They are expected to fail on the current build and are
meant to keep failing until the design changes. This suite is not in `npm test` and not in the blocking
CI job; it is invoked by hand with `npm run skowronek`.

Read the **preconditions** and **diagnosis** sections before the verdict column. On a build where the
settlement object does not exist, most verdicts are `BLOCKED`, which is an *undefined*, not a zero.

## Summary across configs

| config | cap | mean length | settlement forms? | movement? | power concentrates? | quadrants reachable |
| --- | --- | --- | --- | --- | --- | --- |
| `as-written-plus.json` | 100y | 62.7y | yes | yes | yes | 2/4 |
| `as-written.json` | 16y | 16.0y | no | no | yes | 0/4 |
| `baseline.json` | 16y | 16.0y | no | yes | yes | 0/4 |
| `brutal.json` | 16y | 16.0y | no | yes | yes | 0/4 |
| `flat-push.json` | 16y | 16.0y | no | yes | yes | 0/4 |
| `governors-push.json` | 16y | 16.0y | no | yes | yes | 0/4 |
| `realigning.json` | 24y | 24.0y | yes | yes | yes | 2/4 |
| `three-terms.json` | 60y | 42.3y | yes | yes | yes | 2/4 |
| `tuned.json` | 16y | 16.0y | no | yes | yes | 0/4 |

## as-written-plus.json

20 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 100, mean game length 62.7y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 15022.000 ± 0.000 (n=611) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.539 ± 0.016 (n=20) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 0.883 ± 0.079 (n=20) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 8.336 ± 1.179 (n=131) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.741 ± 0.130 (n=16) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.700 ± 0.263 (n=20) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 34.000 ± 0.000 (n=20) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 34.000 ± 0.000 (n=20) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 34.000 ± 0.000 (n=20) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 34.000 ± 0.000 (n=20) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 5.6 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 15022.000 ± 0.000 (n=611) state-years |
| state-years |lean| rose, NON-election years | 42.000 ± 0.000 (n=623) state-years |
| bills passed in non-election years | 3.500 ± 0.467 (n=20) per game |
| non-election bill years per game | 31.150 ± 4.091 (n=20) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.539 ± 0.016 (n=20) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.700 ± 0.263 (n=20) per game |
| mean spread across players | 0.228 ± 0.008 (n=20) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.883 ± 0.079 (n=20) lean counters |
| peak |country position| | 2.003 ± 0.157 (n=20) lean counters |
| years displaced beyond deadband | 0.851 ± 0.024 (n=20) share |
| longest unbroken run on one side | 29.300 ± 5.304 (n=20) years |
| variance ratio at lag 4 (descriptive) | 0.546 ± 0.063 (n=20) 1 = random walk |
| sign crossings per decade | 0.471 ± 0.119 (n=20) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 8.336 ± 1.179 (n=131) years |
| longest regime per game | 29.300 ± 5.304 (n=20) years |
| game length | 62.700 ± 8.155 (n=20) years |
| config year cap | 100.000 ± 0.000 (n=20) years |

The cap (100y) admits at least one full cycle, so a short mean run here is a fact about the engine and not about the clock.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.741 ± 0.130 (n=16) lean counters/yr |
| country move within a party | 0.362 ± 0.008 (n=1218) lean counters/yr |
| excess move on turnover | 0.378 ± 0.130 (n=16) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.700 ± 0.263 (n=20) per game |
| sustained power windows (no presidency) | 1.800 ± 0.421 (n=20) per game |
| mean power in window (with) | 0.490 ± 0.008 (n=34) |
| mean power in window (no presidency) | 0.440 ± 0.004 (n=36) |
| windows that held the presidency | 0.971 ± 0.029 (n=34) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 34.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | 0.000 (n=20) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 34.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | 0.000 (n=20) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 34.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 34.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## as-written.json

20 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 1348.000 ± 0.000 (n=140) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.532 ± 0.013 (n=20) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.208 ± 0.016 (n=20) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 1.096 ± 0.041 (n=52) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.845 ± 0.085 (n=6) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.300 ± 0.147 (n=20) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.6 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 1348.000 ± 0.000 (n=140) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=160) state-years |
| bills passed in non-election years | 1.550 ± 0.285 (n=20) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=20) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.532 ± 0.013 (n=20) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.300 ± 0.147 (n=20) per game |
| mean spread across players | 0.267 ± 0.012 (n=20) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.208 ± 0.016 (n=20) lean counters |
| peak |country position| | 1.133 ± 0.041 (n=20) lean counters |
| years displaced beyond deadband | 0.178 ± 0.017 (n=20) share |
| longest unbroken run on one side | 1.250 ± 0.099 (n=20) years |
| variance ratio at lag 4 (descriptive) | 0.284 ± 0.031 (n=20) 1 = random walk |
| sign crossings per decade | 0.375 ± 0.123 (n=20) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 1.096 ± 0.041 (n=52) years |
| longest regime per game | 1.250 ± 0.099 (n=20) years |
| game length | 16.000 ± 0.000 (n=20) years |
| config year cap | 16.000 ± 0.000 (n=20) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.845 ± 0.085 (n=6) lean counters/yr |
| country move within a party | 0.279 ± 0.022 (n=294) lean counters/yr |
| excess move on turnover | 0.566 ± 0.088 (n=6) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.300 ± 0.147 (n=20) per game |
| sustained power windows (no presidency) | 0.300 ± 0.105 (n=20) per game |
| mean power in window (with) | 0.494 ± 0.011 (n=26) |
| mean power in window (no presidency) | 0.458 ± 0.011 (n=6) |
| windows that held the presidency | 1.000 ± 0.000 (n=26) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## baseline.json

20 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 1452.000 ± 0.000 (n=140) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.547 ± 0.012 (n=20) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.554 ± 0.035 (n=20) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 2.822 ± 0.261 (n=73) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.184 ± 0.055 (n=12) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.300 ± 0.128 (n=20) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.35 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `STRAIN_RISE`, `EFFICACY_DROP`.
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

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 1452.000 ± 0.000 (n=140) state-years |
| state-years |lean| rose, NON-election years | 706.000 ± 0.000 (n=160) state-years |
| bills passed in non-election years | 1.500 ± 0.286 (n=20) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=20) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.547 ± 0.012 (n=20) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.300 ± 0.128 (n=20) per game |
| mean spread across players | 0.292 ± 0.011 (n=20) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.554 ± 0.035 (n=20) lean counters |
| peak |country position| | 1.290 ± 0.050 (n=20) lean counters |
| years displaced beyond deadband | 0.644 ± 0.040 (n=20) share |
| longest unbroken run on one side | 5.300 ± 0.620 (n=20) years |
| variance ratio at lag 4 (descriptive) | 0.607 ± 0.074 (n=20) 1 = random walk |
| sign crossings per decade | 0.938 ± 0.154 (n=20) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 2.822 ± 0.261 (n=73) years |
| longest regime per game | 5.300 ± 0.620 (n=20) years |
| game length | 16.000 ± 0.000 (n=20) years |
| config year cap | 16.000 ± 0.000 (n=20) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.184 ± 0.055 (n=12) lean counters/yr |
| country move within a party | 0.355 ± 0.020 (n=288) lean counters/yr |
| excess move on turnover | 0.830 ± 0.058 (n=12) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.300 ± 0.128 (n=20) per game |
| sustained power windows (no presidency) | 0.550 ± 0.153 (n=20) per game |
| mean power in window (with) | 0.489 ± 0.009 (n=26) |
| mean power in window (no presidency) | 0.447 ± 0.009 (n=11) |
| windows that held the presidency | 1.000 ± 0.000 (n=26) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## brutal.json

20 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 942.000 ± 0.000 (n=140) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.520 ± 0.017 (n=20) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.540 ± 0.054 (n=20) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 3.138 ± 0.358 (n=65) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.151 ± 0.091 (n=7) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 0.900 ± 0.176 (n=20) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 18.000 ± 0.000 (n=20) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 18.000 ± 0.000 (n=20) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 18.000 ± 0.000 (n=20) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 18.000 ± 0.000 (n=20) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `STRAIN_RISE`, `EFFICACY_DROP`.
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

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 942.000 ± 0.000 (n=140) state-years |
| state-years |lean| rose, NON-election years | 851.000 ± 0.000 (n=160) state-years |
| bills passed in non-election years | 1.550 ± 0.450 (n=20) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=20) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.520 ± 0.017 (n=20) share of offices |
| sustained windows (>=0.4 for >=3y) | 0.900 ± 0.176 (n=20) per game |
| mean spread across players | 0.250 ± 0.018 (n=20) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.540 ± 0.054 (n=20) lean counters |
| peak |country position| | 1.267 ± 0.073 (n=20) lean counters |
| years displaced beyond deadband | 0.637 ± 0.048 (n=20) share |
| longest unbroken run on one side | 6.150 ± 0.805 (n=20) years |
| variance ratio at lag 4 (descriptive) | 0.587 ± 0.084 (n=20) 1 = random walk |
| sign crossings per decade | 0.656 ± 0.173 (n=20) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 3.138 ± 0.358 (n=65) years |
| longest regime per game | 6.150 ± 0.805 (n=20) years |
| game length | 16.000 ± 0.000 (n=20) years |
| config year cap | 16.000 ± 0.000 (n=20) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.151 ± 0.091 (n=7) lean counters/yr |
| country move within a party | 0.320 ± 0.018 (n=293) lean counters/yr |
| excess move on turnover | 0.831 ± 0.093 (n=7) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 0.900 ± 0.176 (n=20) per game |
| sustained power windows (no presidency) | 0.400 ± 0.152 (n=20) per game |
| mean power in window (with) | 0.491 ± 0.011 (n=18) |
| mean power in window (no presidency) | 0.451 ± 0.009 (n=8) |
| windows that held the presidency | 1.000 ± 0.000 (n=18) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 18.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 18.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 18.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 18.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## flat-push.json

20 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 1533.000 ± 0.000 (n=140) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.522 ± 0.016 (n=20) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.593 ± 0.064 (n=20) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 3.565 ± 0.471 (n=62) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.884 ± 0.097 (n=5) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.200 ± 0.138 (n=20) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 24.000 ± 0.000 (n=20) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 24.000 ± 0.000 (n=20) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 24.000 ± 0.000 (n=20) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 24.000 ± 0.000 (n=20) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 3.35 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `STRAIN_RISE`, `EFFICACY_DROP`.
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

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 1533.000 ± 0.000 (n=140) state-years |
| state-years |lean| rose, NON-election years | 597.000 ± 0.000 (n=160) state-years |
| bills passed in non-election years | 2.150 ± 0.379 (n=20) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=20) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.522 ± 0.016 (n=20) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.200 ± 0.138 (n=20) per game |
| mean spread across players | 0.245 ± 0.014 (n=20) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.593 ± 0.064 (n=20) lean counters |
| peak |country position| | 1.387 ± 0.102 (n=20) lean counters |
| years displaced beyond deadband | 0.691 ± 0.045 (n=20) share |
| longest unbroken run on one side | 7.250 ± 1.036 (n=20) years |
| variance ratio at lag 4 (descriptive) | 0.543 ± 0.081 (n=20) 1 = random walk |
| sign crossings per decade | 0.656 ± 0.140 (n=20) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 3.565 ± 0.471 (n=62) years |
| longest regime per game | 7.250 ± 1.036 (n=20) years |
| game length | 16.000 ± 0.000 (n=20) years |
| config year cap | 16.000 ± 0.000 (n=20) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.884 ± 0.097 (n=5) lean counters/yr |
| country move within a party | 0.308 ± 0.017 (n=295) lean counters/yr |
| excess move on turnover | 0.576 ± 0.098 (n=5) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.200 ± 0.138 (n=20) per game |
| sustained power windows (no presidency) | 0.250 ± 0.099 (n=20) per game |
| mean power in window (with) | 0.487 ± 0.009 (n=24) |
| mean power in window (no presidency) | 0.446 ± 0.008 (n=5) |
| windows that held the presidency | 1.000 ± 0.000 (n=24) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 24.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 24.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 24.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 24.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## governors-push.json

20 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 1084.000 ± 0.000 (n=140) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.523 ± 0.017 (n=20) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.594 ± 0.056 (n=20) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 3.152 ± 0.343 (n=66) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.900 ± 0.105 (n=7) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.300 ± 0.147 (n=20) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.85 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `STRAIN_RISE`, `EFFICACY_DROP`.
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

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 1084.000 ± 0.000 (n=140) state-years |
| state-years |lean| rose, NON-election years | 973.000 ± 0.000 (n=160) state-years |
| bills passed in non-election years | 1.600 ± 0.336 (n=20) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=20) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.523 ± 0.017 (n=20) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.300 ± 0.147 (n=20) per game |
| mean spread across players | 0.242 ± 0.012 (n=20) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.594 ± 0.056 (n=20) lean counters |
| peak |country position| | 1.410 ± 0.090 (n=20) lean counters |
| years displaced beyond deadband | 0.650 ± 0.042 (n=20) share |
| longest unbroken run on one side | 6.200 ± 0.742 (n=20) years |
| variance ratio at lag 4 (descriptive) | 0.736 ± 0.090 (n=20) 1 = random walk |
| sign crossings per decade | 0.844 ± 0.130 (n=20) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 3.152 ± 0.343 (n=66) years |
| longest regime per game | 6.200 ± 0.742 (n=20) years |
| game length | 16.000 ± 0.000 (n=20) years |
| config year cap | 16.000 ± 0.000 (n=20) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.900 ± 0.105 (n=7) lean counters/yr |
| country move within a party | 0.357 ± 0.018 (n=293) lean counters/yr |
| excess move on turnover | 0.543 ± 0.106 (n=7) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.300 ± 0.147 (n=20) per game |
| sustained power windows (no presidency) | 0.200 ± 0.092 (n=20) per game |
| mean power in window (with) | 0.485 ± 0.009 (n=26) |
| mean power in window (no presidency) | 0.432 ± 0.007 (n=4) |
| windows that held the presidency | 1.000 ± 0.000 (n=26) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## realigning.json

20 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 24, mean game length 24.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 2571.000 ± 0.000 (n=220) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.516 ± 0.016 (n=20) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 0.684 ± 0.062 (n=20) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 4.259 ± 0.472 (n=81) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.000 ± 0.123 (n=10) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.700 ± 0.263 (n=20) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 34.000 ± 0.000 (n=20) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 34.000 ± 0.000 (n=20) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 34.000 ± 0.000 (n=20) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 34.000 ± 0.000 (n=20) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 3.95 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 2571.000 ± 0.000 (n=220) state-years |
| state-years |lean| rose, NON-election years | 952.000 ± 0.000 (n=240) state-years |
| bills passed in non-election years | 2.700 ± 0.519 (n=20) per game |
| non-election bill years per game | 12.000 ± 0.000 (n=20) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.516 ± 0.016 (n=20) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.700 ± 0.263 (n=20) per game |
| mean spread across players | 0.241 ± 0.013 (n=20) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.684 ± 0.062 (n=20) lean counters |
| peak |country position| | 1.698 ± 0.128 (n=20) lean counters |
| years displaced beyond deadband | 0.719 ± 0.034 (n=20) share |
| longest unbroken run on one side | 10.000 ± 1.074 (n=20) years |
| variance ratio at lag 4 (descriptive) | 0.781 ± 0.075 (n=20) 1 = random walk |
| sign crossings per decade | 0.708 ± 0.125 (n=20) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 4.259 ± 0.472 (n=81) years |
| longest regime per game | 10.000 ± 1.074 (n=20) years |
| game length | 24.000 ± 0.000 (n=20) years |
| config year cap | 24.000 ± 0.000 (n=20) years |

PRECONDITION FAILURE, not a result: the year cap is 24, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.000 ± 0.123 (n=10) lean counters/yr |
| country move within a party | 0.314 ± 0.014 (n=450) lean counters/yr |
| excess move on turnover | 0.685 ± 0.124 (n=10) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.700 ± 0.263 (n=20) per game |
| sustained power windows (no presidency) | 0.550 ± 0.135 (n=20) per game |
| mean power in window (with) | 0.475 ± 0.007 (n=34) |
| mean power in window (no presidency) | 0.433 ± 0.006 (n=11) |
| windows that held the presidency | 1.000 ± 0.000 (n=34) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 34.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | 0.000 (n=20) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 34.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | 0.000 (n=20) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 34.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 34.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## three-terms.json

20 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 60, mean game length 42.3y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 2086.000 ± 0.000 (n=408) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.525 ± 0.015 (n=20) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 0.580 ± 0.042 (n=20) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 3.662 ± 0.310 (n=148) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.935 ± 0.079 (n=9) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.600 ± 0.210 (n=20) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 32.000 ± 0.000 (n=20) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 32.000 ± 0.000 (n=20) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 32.000 ± 0.000 (n=20) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 32.000 ± 0.000 (n=20) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 7.45 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 2086.000 ± 0.000 (n=408) state-years |
| state-years |lean| rose, NON-election years | 2794.000 ± 0.000 (n=418) state-years |
| bills passed in non-election years | 5.000 ± 1.458 (n=20) per game |
| non-election bill years per game | 20.900 ± 2.477 (n=20) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.525 ± 0.015 (n=20) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.600 ± 0.210 (n=20) per game |
| mean spread across players | 0.241 ± 0.014 (n=20) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.580 ± 0.042 (n=20) lean counters |
| peak |country position| | 1.624 ± 0.083 (n=20) lean counters |
| years displaced beyond deadband | 0.666 ± 0.037 (n=20) share |
| longest unbroken run on one side | 8.800 ± 1.228 (n=20) years |
| variance ratio at lag 4 (descriptive) | 0.845 ± 0.082 (n=20) 1 = random walk |
| sign crossings per decade | 0.925 ± 0.108 (n=20) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 3.662 ± 0.310 (n=148) years |
| longest regime per game | 8.800 ± 1.228 (n=20) years |
| game length | 42.300 ± 4.858 (n=20) years |
| config year cap | 60.000 ± 0.000 (n=20) years |

The cap (60y) admits at least one full cycle, so a short mean run here is a fact about the engine and not about the clock.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.935 ± 0.079 (n=9) lean counters/yr |
| country move within a party | 0.299 ± 0.010 (n=817) lean counters/yr |
| excess move on turnover | 0.636 ± 0.079 (n=9) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.600 ± 0.210 (n=20) per game |
| sustained power windows (no presidency) | 0.900 ± 0.204 (n=20) per game |
| mean power in window (with) | 0.475 ± 0.008 (n=32) |
| mean power in window (no presidency) | 0.448 ± 0.007 (n=18) |
| windows that held the presidency | 0.969 ± 0.031 (n=32) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 32.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | 0.000 (n=20) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 32.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | 0.000 (n=20) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 32.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 32.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## tuned.json

20 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 1083.000 ± 0.000 (n=140) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.523 ± 0.017 (n=20) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.593 ± 0.056 (n=20) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 3.152 ± 0.343 (n=66) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.900 ± 0.105 (n=7) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.300 ± 0.147 (n=20) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 26.000 ± 0.000 (n=20) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.85 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | MET | passing more bills moved the country position |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `STRAIN_RISE`, `EFFICACY_DROP`.
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

#### control-non-electoral-lean-writer — **HEALTHY**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 1083.000 ± 0.000 (n=140) state-years |
| state-years |lean| rose, NON-election years | 973.000 ± 0.000 (n=160) state-years |
| bills passed in non-election years | 1.600 ± 0.336 (n=20) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=20) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.523 ± 0.017 (n=20) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.300 ± 0.147 (n=20) per game |
| mean spread across players | 0.242 ± 0.012 (n=20) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.593 ± 0.056 (n=20) lean counters |
| peak |country position| | 1.405 ± 0.088 (n=20) lean counters |
| years displaced beyond deadband | 0.650 ± 0.042 (n=20) share |
| longest unbroken run on one side | 6.200 ± 0.742 (n=20) years |
| variance ratio at lag 4 (descriptive) | 0.731 ± 0.090 (n=20) 1 = random walk |
| sign crossings per decade | 0.844 ± 0.130 (n=20) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 3.152 ± 0.343 (n=66) years |
| longest regime per game | 6.200 ± 0.742 (n=20) years |
| game length | 16.000 ± 0.000 (n=20) years |
| config year cap | 16.000 ± 0.000 (n=20) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.900 ± 0.105 (n=7) lean counters/yr |
| country move within a party | 0.357 ± 0.018 (n=293) lean counters/yr |
| excess move on turnover | 0.542 ± 0.106 (n=7) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.300 ± 0.147 (n=20) per game |
| sustained power windows (no presidency) | 0.200 ± 0.092 (n=20) per game |
| mean power in window (with) | 0.485 ± 0.009 (n=26) |
| mean power in window (no presidency) | 0.432 ± 0.007 (n=4) |
| windows that held the presidency | 1.000 ± 0.000 (n=26) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 26.000 ± 0.000 (n=20) windows |
| windows classified as this quadrant | — (n=20) |

Blocked by: `SETTLEMENT_FORMATION`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.
