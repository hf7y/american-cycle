# Skowronek suite — does american-cycle produce political time?

Run 2026-09-07T11:42:03Z on `aebde8b`.

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
| `as-written-plus.json` | 100y | 100.0y | yes | yes | yes | 2/4 |
| `as-written.json` | 16y | 16.0y | no | no | yes | 0/4 |
| `baseline.json` | 16y | 16.0y | yes | yes | yes | 2/4 |
| `brutal.json` | 16y | 16.0y | yes | yes | yes | 2/4 |
| `flat-push.json` | 16y | 16.0y | yes | yes | yes | 2/4 |
| `governors-push.json` | 16y | 16.0y | yes | no | yes | 1/4 |
| `realigning.json` | 24y | 24.0y | yes | yes | yes | 2/4 |
| `three-terms.json` | 60y | 36.1y | yes | yes | yes | 2/4 |
| `tuned.json` | 16y | 16.0y | yes | yes | yes | 2/4 |

## as-written-plus.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 100, mean game length 100.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 388965.000 ± 0.000 (n=14700) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.638 ± 0.005 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.890 ± 0.052 (n=300) lean counters |
| `regime-duration` | HEALTHY | mean regime run: 12.807 ± 0.507 (n=2171) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.885 ± 0.038 (n=222) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 6.260 ± 0.187 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 1878.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 1878.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 1878.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 1878.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 15.223333333333333 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 388965.000 ± 0.000 (n=14700) state-years |
| state-years |lean| rose, NON-election years | 13893.000 ± 0.000 (n=15000) state-years |
| bills passed in non-election years | 14.643 ± 0.517 (n=300) per game |
| non-election bill years per game | 50.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.638 ± 0.005 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 6.260 ± 0.187 (n=300) per game |
| mean spread across players | 0.354 ± 0.002 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.890 ± 0.052 (n=300) lean counters |
| peak |country position| | 3.776 ± 0.059 (n=300) lean counters |
| years displaced beyond deadband | 0.927 ± 0.005 (n=300) share |
| longest unbroken run on one side | 64.093 ± 1.567 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.663 ± 0.012 (n=300) 1 = random walk |
| sign crossings per decade | 0.363 ± 0.021 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **HEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 12.807 ± 0.507 (n=2171) years |
| longest regime per game | 64.093 ± 1.567 (n=300) years |
| game length | 100.000 ± 0.000 (n=300) years |
| config year cap | 100.000 ± 0.000 (n=300) years |

The cap (100y) admits at least one full cycle, so a short mean run here is a fact about the engine and not about the clock.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.885 ± 0.038 (n=222) lean counters/yr |
| country move within a party | 0.433 ± 0.002 (n=29478) lean counters/yr |
| excess move on turnover | 0.452 ± 0.038 (n=222) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 6.260 ± 0.187 (n=300) per game |
| sustained power windows (no presidency) | 7.887 ± 0.239 (n=300) per game |
| mean power in window (with) | 0.484 ± 0.001 (n=1878) |
| mean power in window (no presidency) | 0.537 ± 0.001 (n=2366) |
| windows that held the presidency | 0.306 ± 0.011 (n=1878) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 1878.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 1878.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 1878.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 1878.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## as-written.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 25759.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.569 ± 0.004 (n=300) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.222 ± 0.004 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 1.103 ± 0.011 (n=877) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.971 ± 0.017 (n=160) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.260 ± 0.049 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 378.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 378.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 378.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 378.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 1.9366666666666668 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 25759.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 1.743 ± 0.073 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.569 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.260 ± 0.049 (n=300) per game |
| mean spread across players | 0.301 ± 0.003 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.222 ± 0.004 (n=300) lean counters |
| peak |country position| | 1.113 ± 0.010 (n=300) lean counters |
| years displaced beyond deadband | 0.201 ± 0.004 (n=300) share |
| longest unbroken run on one side | 1.280 ± 0.030 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.302 ± 0.010 (n=300) 1 = random walk |
| sign crossings per decade | 0.552 ± 0.031 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 1.103 ± 0.011 (n=877) years |
| longest regime per game | 1.280 ± 0.030 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.971 ± 0.017 (n=160) lean counters/yr |
| country move within a party | 0.303 ± 0.006 (n=4340) lean counters/yr |
| excess move on turnover | 0.669 ± 0.018 (n=160) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.260 ± 0.049 (n=300) per game |
| sustained power windows (no presidency) | 0.653 ± 0.038 (n=300) per game |
| mean power in window (with) | 0.491 ± 0.002 (n=378) |
| mean power in window (no presidency) | 0.490 ± 0.003 (n=196) |
| windows that held the presidency | 0.979 ± 0.007 (n=378) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 378.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 378.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`

Never evaluated: SETTLEMENT_FORMATION is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 378.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 378.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## baseline.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 20733.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.564 ± 0.004 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 0.892 ± 0.030 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 3.926 ± 0.126 (n=949) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.192 ± 0.033 (n=170) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.213 ± 0.048 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 364.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 364.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 364.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 364.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 1.9833333333333334 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 20733.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 14785.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 1.657 ± 0.070 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.564 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.213 ± 0.048 (n=300) per game |
| mean spread across players | 0.298 ± 0.003 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.892 ± 0.030 (n=300) lean counters |
| peak |country position| | 1.955 ± 0.051 (n=300) lean counters |
| years displaced beyond deadband | 0.776 ± 0.010 (n=300) share |
| longest unbroken run on one side | 8.130 ± 0.249 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.697 ± 0.024 (n=300) 1 = random walk |
| sign crossings per decade | 0.829 ± 0.042 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 3.926 ± 0.126 (n=949) years |
| longest regime per game | 8.130 ± 0.249 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.192 ± 0.033 (n=170) lean counters/yr |
| country move within a party | 0.429 ± 0.006 (n=4330) lean counters/yr |
| excess move on turnover | 0.763 ± 0.034 (n=170) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.213 ± 0.048 (n=300) per game |
| sustained power windows (no presidency) | 0.647 ± 0.042 (n=300) per game |
| mean power in window (with) | 0.493 ± 0.002 (n=364) |
| mean power in window (no presidency) | 0.489 ± 0.003 (n=194) |
| windows that held the presidency | 0.967 ± 0.009 (n=364) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 364.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 364.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 364.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 364.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## brutal.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 20782.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.564 ± 0.004 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 0.925 ± 0.031 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 3.934 ± 0.124 (n=954) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.148 ± 0.035 (n=184) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.277 ± 0.048 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 383.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 383.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 383.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 383.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 1.8733333333333333 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 20782.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 15269.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 1.540 ± 0.069 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.564 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.277 ± 0.048 (n=300) per game |
| mean spread across players | 0.304 ± 0.003 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.925 ± 0.031 (n=300) lean counters |
| peak |country position| | 2.028 ± 0.055 (n=300) lean counters |
| years displaced beyond deadband | 0.782 ± 0.010 (n=300) share |
| longest unbroken run on one side | 8.080 ± 0.249 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.688 ± 0.023 (n=300) 1 = random walk |
| sign crossings per decade | 0.840 ± 0.041 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 3.934 ± 0.124 (n=954) years |
| longest regime per game | 8.080 ± 0.249 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.148 ± 0.035 (n=184) lean counters/yr |
| country move within a party | 0.448 ± 0.006 (n=4316) lean counters/yr |
| excess move on turnover | 0.700 ± 0.035 (n=184) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.277 ± 0.048 (n=300) per game |
| sustained power windows (no presidency) | 0.630 ± 0.041 (n=300) per game |
| mean power in window (with) | 0.493 ± 0.002 (n=383) |
| mean power in window (no presidency) | 0.486 ± 0.003 (n=189) |
| windows that held the presidency | 0.984 ± 0.006 (n=383) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 383.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 383.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 383.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 383.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## flat-push.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 27880.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.553 ± 0.005 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.365 ± 0.048 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 4.540 ± 0.151 (n=866) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.131 ± 0.047 (n=132) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.093 ± 0.046 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 328.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 328.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 328.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 328.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.37 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 27880.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 14122.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 2.320 ± 0.096 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.553 ± 0.005 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.093 ± 0.046 (n=300) per game |
| mean spread across players | 0.292 ± 0.003 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.365 ± 0.048 (n=300) lean counters |
| peak |country position| | 2.777 ± 0.072 (n=300) lean counters |
| years displaced beyond deadband | 0.819 ± 0.009 (n=300) share |
| longest unbroken run on one side | 9.523 ± 0.234 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.782 ± 0.025 (n=300) 1 = random walk |
| sign crossings per decade | 0.775 ± 0.043 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 4.540 ± 0.151 (n=866) years |
| longest regime per game | 9.523 ± 0.234 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.131 ± 0.047 (n=132) lean counters/yr |
| country move within a party | 0.529 ± 0.008 (n=4368) lean counters/yr |
| excess move on turnover | 0.602 ± 0.048 (n=132) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.093 ± 0.046 (n=300) per game |
| sustained power windows (no presidency) | 0.903 ± 0.043 (n=300) per game |
| mean power in window (with) | 0.497 ± 0.003 (n=328) |
| mean power in window (no presidency) | 0.495 ± 0.003 (n=271) |
| windows that held the presidency | 0.945 ± 0.013 (n=328) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 328.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 328.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 328.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 328.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## governors-push.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | BLOCKED | state-years |lean| rose, election years: 41064.000 ± 0.000 (n=4500) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.554 ± 0.005 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.248 ± 0.044 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 4.357 ± 0.145 (n=889) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.158 ± 0.045 (n=156) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.123 ± 0.048 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 337.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 337.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 337.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 337.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.223333333333333 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
| `BILL_POSITION` | MET | bills carry IdentityTag[] (v0.2 item 4) and TAG_COMPASS.bill reads them |
| `SETTLEMENT_FORMATION` | MET | the country position holds off baseline with a variance ratio above 1 |
| `SETTLEMENT_MOVEMENT` | ABSENT | nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts) |
| `STRAIN_RISE` | ABSENT | strain is the distance between a settlement and the country. Its two preconditions were met at v0.2 -- Game.bills is the corpus and TAG_COMPASS places a bill -- but no detector assembles the settlement from them yet. Unbuilt, not unbuildable. |
| `EFFICACY_DROP` | ABSENT | efficacy is bills moving the settlement toward the passer, per year of power. The bill position exists as of v0.2, so this is no longer undefined -- it is unmeasured, and it stays unmeasured until STRAIN_RISE has a settlement to move. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_MOVEMENT`.
  - First missing: nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts)
  - Control: C2: |lean| rises in election years and never in non-election years, on the same runs.
- **PREEMPTION** — preconditions met; see the verdict table.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`.
  - First missing: nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts)
  - Control: C2: |lean| rises in election years and never in non-election years, on the same runs.
- **DISJUNCTION** — blocked by `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts)
  - Control: C2: |lean| rises in election years and never in non-election years, on the same runs.

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

#### control-non-electoral-lean-writer — **BLOCKED**

*C2: in a year with no election, can anything — legislation included — add lean to the board?*

| measure | value |
| --- | --- |
| state-years |lean| rose, election years | 41064.000 ± 0.000 (n=4500) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=0) state-years |
| bills passed in non-election years | 0.000 ± 0.000 (n=300) per game |
| non-election bill years per game | 0.000 ± 0.000 (n=300) years |

THIS CONFIG HAS NO NON-ELECTION YEARS TO SAMPLE: `governorPushes: 'with-lean'` makes an off-cycle governor race a lean writer, and one resolves in every odd year (#232), so `electionCanWriteLean` is true 100% of the time under this config. C2 cannot be evaluated here — read it on a `governorPushes: 'never'` config instead.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.554 ± 0.005 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.123 ± 0.048 (n=300) per game |
| mean spread across players | 0.294 ± 0.003 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.248 ± 0.044 (n=300) lean counters |
| peak |country position| | 2.658 ± 0.071 (n=300) lean counters |
| years displaced beyond deadband | 0.807 ± 0.010 (n=300) share |
| longest unbroken run on one side | 9.120 ± 0.248 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.802 ± 0.027 (n=300) 1 = random walk |
| sign crossings per decade | 0.846 ± 0.044 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 4.357 ± 0.145 (n=889) years |
| longest regime per game | 9.120 ± 0.248 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.158 ± 0.045 (n=156) lean counters/yr |
| country move within a party | 0.561 ± 0.008 (n=4344) lean counters/yr |
| excess move on turnover | 0.597 ± 0.046 (n=156) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.123 ± 0.048 (n=300) per game |
| sustained power windows (no presidency) | 0.800 ± 0.043 (n=300) per game |
| mean power in window (with) | 0.494 ± 0.003 (n=337) |
| mean power in window (no presidency) | 0.495 ± 0.003 (n=240) |
| windows that held the presidency | 0.947 ± 0.012 (n=337) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 337.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_MOVEMENT`

Never evaluated: SETTLEMENT_MOVEMENT is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 337.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 337.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_MOVEMENT, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 337.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## realigning.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 24, mean game length 24.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 43136.000 ± 0.000 (n=3300) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.582 ± 0.005 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.529 ± 0.052 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 5.806 ± 0.206 (n=1052) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.023 ± 0.035 (n=177) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.467 ± 0.057 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 440.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 440.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 440.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 440.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.7733333333333334 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 43136.000 ± 0.000 (n=3300) state-years |
| state-years |lean| rose, NON-election years | 19088.000 ± 0.000 (n=3600) state-years |
| bills passed in non-election years | 2.963 ± 0.119 (n=300) per game |
| non-election bill years per game | 12.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.582 ± 0.005 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.467 ± 0.057 (n=300) per game |
| mean spread across players | 0.300 ± 0.003 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.529 ± 0.052 (n=300) lean counters |
| peak |country position| | 3.242 ± 0.075 (n=300) lean counters |
| years displaced beyond deadband | 0.848 ± 0.008 (n=300) share |
| longest unbroken run on one side | 14.530 ± 0.372 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.786 ± 0.023 (n=300) 1 = random walk |
| sign crossings per decade | 0.640 ± 0.036 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 5.806 ± 0.206 (n=1052) years |
| longest regime per game | 14.530 ± 0.372 (n=300) years |
| game length | 24.000 ± 0.000 (n=300) years |
| config year cap | 24.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 24, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.023 ± 0.035 (n=177) lean counters/yr |
| country move within a party | 0.491 ± 0.006 (n=6723) lean counters/yr |
| excess move on turnover | 0.532 ± 0.035 (n=177) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.467 ± 0.057 (n=300) per game |
| sustained power windows (no presidency) | 1.557 ± 0.058 (n=300) per game |
| mean power in window (with) | 0.499 ± 0.003 (n=440) |
| mean power in window (no presidency) | 0.509 ± 0.002 (n=467) |
| windows that held the presidency | 0.832 ± 0.018 (n=440) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 440.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 440.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 440.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 440.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## three-terms.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 60, mean game length 36.1y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 39142.000 ± 0.000 (n=5217) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.603 ± 0.005 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.527 ± 0.054 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 6.063 ± 0.242 (n=1497) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.112 ± 0.042 (n=206) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 2.140 ± 0.093 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 642.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 642.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 642.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 642.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 5.1 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 39142.000 ± 0.000 (n=5217) state-years |
| state-years |lean| rose, NON-election years | 52470.000 ± 0.000 (n=5322) state-years |
| bills passed in non-election years | 5.197 ± 0.278 (n=300) per game |
| non-election bill years per game | 17.740 ± 0.596 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.603 ± 0.005 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 2.140 ± 0.093 (n=300) per game |
| mean spread across players | 0.319 ± 0.003 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.527 ± 0.054 (n=300) lean counters |
| peak |country position| | 3.529 ± 0.083 (n=300) lean counters |
| years displaced beyond deadband | 0.835 ± 0.007 (n=300) share |
| longest unbroken run on one side | 18.293 ± 0.845 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.763 ± 0.021 (n=300) 1 = random walk |
| sign crossings per decade | 0.813 ± 0.042 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 6.063 ± 0.242 (n=1497) years |
| longest regime per game | 18.293 ± 0.845 (n=300) years |
| game length | 36.130 ± 1.167 (n=300) years |
| config year cap | 60.000 ± 0.000 (n=300) years |

The cap (60y) admits at least one full cycle, so a short mean run here is a fact about the engine and not about the clock.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.112 ± 0.042 (n=206) lean counters/yr |
| country move within a party | 0.567 ± 0.005 (n=10333) lean counters/yr |
| excess move on turnover | 0.545 ± 0.042 (n=206) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 2.140 ± 0.093 (n=300) per game |
| sustained power windows (no presidency) | 2.730 ± 0.144 (n=300) per game |
| mean power in window (with) | 0.498 ± 0.002 (n=642) |
| mean power in window (no presidency) | 0.527 ± 0.002 (n=819) |
| windows that held the presidency | 0.650 ± 0.019 (n=642) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 642.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 642.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 642.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 642.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## tuned.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | HEALTHY | state-years |lean| rose, election years: 20958.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.565 ± 0.005 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 1.291 ± 0.046 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 4.334 ± 0.140 (n=892) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.138 ± 0.043 (n=164) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.163 ± 0.048 (n=300) per game |
| `quadrant-articulation` | UNHEALTHY | classifiable power windows: 349.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | UNHEALTHY | classifiable power windows: 349.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 349.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 349.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | MET | 2.256666666666667 bills on the books at the epilogue; EnactedBill.repealedIn takes them off |
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
| state-years |lean| rose, election years | 20958.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 20722.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 2.320 ± 0.094 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

Lean rises in years with no election, so some non-electoral mechanism writes to the board and a legislative settlement channel is at least possible.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.565 ± 0.005 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.163 ± 0.048 (n=300) per game |
| mean spread across players | 0.301 ± 0.003 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 1.291 ± 0.046 (n=300) lean counters |
| peak |country position| | 2.754 ± 0.073 (n=300) lean counters |
| years displaced beyond deadband | 0.805 ± 0.009 (n=300) share |
| longest unbroken run on one side | 9.000 ± 0.236 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.794 ± 0.025 (n=300) 1 = random walk |
| sign crossings per decade | 0.850 ± 0.044 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 4.334 ± 0.140 (n=892) years |
| longest regime per game | 9.000 ± 0.236 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.138 ± 0.043 (n=164) lean counters/yr |
| country move within a party | 0.565 ± 0.008 (n=4336) lean counters/yr |
| excess move on turnover | 0.573 ± 0.043 (n=164) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.163 ± 0.048 (n=300) per game |
| sustained power windows (no presidency) | 0.790 ± 0.041 (n=300) per game |
| mean power in window (with) | 0.499 ± 0.003 (n=349) |
| mean power in window (no presidency) | 0.497 ± 0.003 (n=237) |
| windows that held the presidency | 0.957 ± 0.011 (n=349) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **UNHEALTHY**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 349.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-preemption — **UNHEALTHY**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 349.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | 0.000 (n=300) |

Preconditions met and no window matched.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 349.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`

Never evaluated: STRAIN_RISE is missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 349.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.
