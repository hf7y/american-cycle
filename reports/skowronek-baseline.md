# Skowronek suite — does american-cycle produce political time?

Run 2026-09-02T00:59:02Z on `7f60caa`.

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
| `as-written-plus.json` | 100y | 68.2y | yes | no | yes | 0/4 |
| `as-written.json` | 16y | 16.0y | no | no | yes | 0/4 |
| `baseline.json` | 16y | 16.0y | no | no | yes | 0/4 |
| `brutal.json` | 16y | 16.0y | no | no | yes | 0/4 |
| `flat-push.json` | 16y | 16.0y | no | no | yes | 0/4 |
| `governors-push.json` | 16y | 16.0y | no | no | yes | 0/4 |
| `realigning.json` | 24y | 24.0y | yes | no | yes | 0/4 |
| `three-terms.json` | 60y | 42.5y | no | no | yes | 0/4 |
| `tuned.json` | 16y | 16.0y | no | no | yes | 0/4 |

## as-written-plus.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 100, mean game length 68.2y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 236765.000 ± 0.000 (n=9964) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.532 ± 0.004 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 0.685 ± 0.019 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 7.013 ± 0.278 (n=2278) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.812 ± 0.032 (n=205) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.880 ± 0.082 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 564.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 564.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 564.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 564.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | ABSENT BY CONSTRUCTION | passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a single scalar the Fed decays. |
| `BILL_POSITION` | ABSENT BY CONSTRUCTION | a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis." |
| `SETTLEMENT_FORMATION` | MET | the country position holds off baseline with a variance ratio above 1 |
| `SETTLEMENT_MOVEMENT` | ABSENT | nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts) |
| `STRAIN_RISE` | ABSENT BY CONSTRUCTION | strain is the distance between a settlement and the country, and this build has no settlement object to be the far end of it. Downstream of BILL_CORPUS and BILL_POSITION. |
| `EFFICACY_DROP` | ABSENT BY CONSTRUCTION | efficacy is bills moving the settlement toward the passer, per year of power. With no bill position it is undefined, and with SETTLEMENT_MOVEMENT absent it would be identically zero for every player in every year — which cannot distinguish a blocked leader from an effective one. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `BILL_POSITION`, `SETTLEMENT_MOVEMENT`.
  - First missing: a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis."
  - Control: none possible: no run can give a scalar a second dimension.
- **PREEMPTION** — blocked by `BILL_CORPUS`, `BILL_POSITION`.
  - First missing: passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a single scalar the Fed decays.
  - Control: none possible: no run can create a record the engine does not keep.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`.
  - First missing: nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts)
  - Control: C2: |lean| rises in election years and never in non-election years, on the same runs.
- **DISJUNCTION** — blocked by `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis."
  - Control: none possible: no run can give a scalar a second dimension.

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
| state-years |lean| rose, election years | 236765.000 ± 0.000 (n=9964) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=10188) state-years |
| bills passed in non-election years | 3.147 ± 0.124 (n=300) per game |
| non-election bill years per game | 33.960 ± 1.071 (n=300) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.532 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.880 ± 0.082 (n=300) per game |
| mean spread across players | 0.234 ± 0.002 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.685 ± 0.019 (n=300) lean counters |
| peak |country position| | 1.712 ± 0.030 (n=300) lean counters |
| years displaced beyond deadband | 0.777 ± 0.010 (n=300) share |
| longest unbroken run on one side | 29.330 ± 1.459 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.512 ± 0.009 (n=300) 1 = random walk |
| sign crossings per decade | 0.501 ± 0.029 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 7.013 ± 0.278 (n=2278) years |
| longest regime per game | 29.330 ± 1.459 (n=300) years |
| game length | 68.173 ± 2.128 (n=300) years |
| config year cap | 100.000 ± 0.000 (n=300) years |

The cap (100y) admits at least one full cycle, so a short mean run here is a fact about the engine and not about the clock.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.812 ± 0.032 (n=205) lean counters/yr |
| country move within a party | 0.257 ± 0.002 (n=19947) lean counters/yr |
| excess move on turnover | 0.555 ± 0.032 (n=205) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.880 ± 0.082 (n=300) per game |
| sustained power windows (no presidency) | 2.180 ± 0.113 (n=300) per game |
| mean power in window (with) | 0.481 ± 0.002 (n=564) |
| mean power in window (no presidency) | 0.437 ± 0.001 (n=654) |
| windows that held the presidency | 0.950 ± 0.009 (n=564) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 564.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `BILL_POSITION`, `SETTLEMENT_MOVEMENT`

Never evaluated: BILL_POSITION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 564.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `BILL_CORPUS`, `BILL_POSITION`

Never evaluated: BILL_CORPUS, BILL_POSITION are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 564.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_MOVEMENT, BILL_POSITION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 564.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: BILL_POSITION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## as-written.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 19341.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.538 ± 0.004 (n=300) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.201 ± 0.003 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 1.110 ± 0.013 (n=789) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.936 ± 0.024 (n=103) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.190 ± 0.043 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 357.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 357.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 357.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 357.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | ABSENT BY CONSTRUCTION | passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a single scalar the Fed decays. |
| `BILL_POSITION` | ABSENT BY CONSTRUCTION | a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis." |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | ABSENT | nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts) |
| `STRAIN_RISE` | ABSENT BY CONSTRUCTION | strain is the distance between a settlement and the country, and this build has no settlement object to be the far end of it. Downstream of BILL_CORPUS and BILL_POSITION. |
| `EFFICACY_DROP` | ABSENT BY CONSTRUCTION | efficacy is bills moving the settlement toward the passer, per year of power. With no bill position it is undefined, and with SETTLEMENT_MOVEMENT absent it would be identically zero for every player in every year — which cannot distinguish a blocked leader from an effective one. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`.
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
| state-years |lean| rose, election years | 19341.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 2.280 ± 0.122 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.538 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.190 ± 0.043 (n=300) per game |
| mean spread across players | 0.272 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.201 ± 0.003 (n=300) lean counters |
| peak |country position| | 1.076 ± 0.012 (n=300) lean counters |
| years displaced beyond deadband | 0.182 ± 0.004 (n=300) share |
| longest unbroken run on one side | 1.257 ± 0.031 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.331 ± 0.010 (n=300) 1 = random walk |
| sign crossings per decade | 0.483 ± 0.029 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 1.110 ± 0.013 (n=789) years |
| longest regime per game | 1.257 ± 0.031 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.936 ± 0.024 (n=103) lean counters/yr |
| country move within a party | 0.262 ± 0.005 (n=4397) lean counters/yr |
| excess move on turnover | 0.674 ± 0.025 (n=103) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.190 ± 0.043 (n=300) per game |
| sustained power windows (no presidency) | 0.503 ± 0.034 (n=300) per game |
| mean power in window (with) | 0.502 ± 0.003 (n=357) |
| mean power in window (no presidency) | 0.452 ± 0.003 (n=151) |
| windows that held the presidency | 1.000 ± 0.000 (n=357) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 357.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 357.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`

Never evaluated: SETTLEMENT_FORMATION, BILL_CORPUS, BILL_POSITION are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 357.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, BILL_POSITION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 357.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## baseline.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 18109.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.535 ± 0.004 (n=300) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.363 ± 0.007 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 2.557 ± 0.053 (n=740) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.980 ± 0.021 (n=111) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.150 ± 0.041 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 345.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 345.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 345.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 345.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | ABSENT BY CONSTRUCTION | passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a single scalar the Fed decays. |
| `BILL_POSITION` | ABSENT BY CONSTRUCTION | a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis." |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | ABSENT | nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts) |
| `STRAIN_RISE` | ABSENT BY CONSTRUCTION | strain is the distance between a settlement and the country, and this build has no settlement object to be the far end of it. Downstream of BILL_CORPUS and BILL_POSITION. |
| `EFFICACY_DROP` | ABSENT BY CONSTRUCTION | efficacy is bills moving the settlement toward the passer, per year of power. With no bill position it is undefined, and with SETTLEMENT_MOVEMENT absent it would be identically zero for every player in every year — which cannot distinguish a blocked leader from an effective one. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`.
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
| state-years |lean| rose, election years | 18109.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 2.353 ± 0.125 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.535 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.150 ± 0.041 (n=300) per game |
| mean spread across players | 0.271 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.363 ± 0.007 (n=300) lean counters |
| peak |country position| | 1.070 ± 0.012 (n=300) lean counters |
| years displaced beyond deadband | 0.394 ± 0.010 (n=300) share |
| longest unbroken run on one side | 3.267 ± 0.117 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.583 ± 0.017 (n=300) 1 = random walk |
| sign crossings per decade | 0.519 ± 0.029 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 2.557 ± 0.053 (n=740) years |
| longest regime per game | 3.267 ± 0.117 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.980 ± 0.021 (n=111) lean counters/yr |
| country move within a party | 0.220 ± 0.006 (n=4389) lean counters/yr |
| excess move on turnover | 0.760 ± 0.022 (n=111) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.150 ± 0.041 (n=300) per game |
| sustained power windows (no presidency) | 0.470 ± 0.034 (n=300) per game |
| mean power in window (with) | 0.500 ± 0.003 (n=345) |
| mean power in window (no presidency) | 0.454 ± 0.003 (n=141) |
| windows that held the presidency | 1.000 ± 0.000 (n=345) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 345.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 345.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`

Never evaluated: SETTLEMENT_FORMATION, BILL_CORPUS, BILL_POSITION are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 345.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, BILL_POSITION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 345.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## brutal.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 17888.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.539 ± 0.004 (n=300) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.368 ± 0.007 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 2.620 ± 0.057 (n=755) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.013 ± 0.020 (n=108) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.190 ± 0.041 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 357.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 357.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 357.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 357.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | ABSENT BY CONSTRUCTION | passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a single scalar the Fed decays. |
| `BILL_POSITION` | ABSENT BY CONSTRUCTION | a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis." |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | ABSENT | nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts) |
| `STRAIN_RISE` | ABSENT BY CONSTRUCTION | strain is the distance between a settlement and the country, and this build has no settlement object to be the far end of it. Downstream of BILL_CORPUS and BILL_POSITION. |
| `EFFICACY_DROP` | ABSENT BY CONSTRUCTION | efficacy is bills moving the settlement toward the passer, per year of power. With no bill position it is undefined, and with SETTLEMENT_MOVEMENT absent it would be identically zero for every player in every year — which cannot distinguish a blocked leader from an effective one. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`.
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
| state-years |lean| rose, election years | 17888.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 2.260 ± 0.113 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.539 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.190 ± 0.041 (n=300) per game |
| mean spread across players | 0.281 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.368 ± 0.007 (n=300) lean counters |
| peak |country position| | 1.074 ± 0.012 (n=300) lean counters |
| years displaced beyond deadband | 0.412 ± 0.010 (n=300) share |
| longest unbroken run on one side | 3.413 ± 0.128 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.582 ± 0.016 (n=300) 1 = random walk |
| sign crossings per decade | 0.573 ± 0.030 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 2.620 ± 0.057 (n=755) years |
| longest regime per game | 3.413 ± 0.128 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.013 ± 0.020 (n=108) lean counters/yr |
| country move within a party | 0.218 ± 0.006 (n=4392) lean counters/yr |
| excess move on turnover | 0.795 ± 0.021 (n=108) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.190 ± 0.041 (n=300) per game |
| sustained power windows (no presidency) | 0.507 ± 0.034 (n=300) per game |
| mean power in window (with) | 0.503 ± 0.003 (n=357) |
| mean power in window (no presidency) | 0.448 ± 0.002 (n=152) |
| windows that held the presidency | 0.997 ± 0.003 (n=357) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 357.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 357.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`

Never evaluated: SETTLEMENT_FORMATION, BILL_CORPUS, BILL_POSITION are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 357.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, BILL_POSITION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 357.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## flat-push.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 21812.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.511 ± 0.005 (n=300) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.395 ± 0.009 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 3.654 ± 0.102 (n=659) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.003 ± 0.029 (n=106) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.030 ± 0.041 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 309.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 309.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 309.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 309.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | ABSENT BY CONSTRUCTION | passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a single scalar the Fed decays. |
| `BILL_POSITION` | ABSENT BY CONSTRUCTION | a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis." |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | ABSENT | nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts) |
| `STRAIN_RISE` | ABSENT BY CONSTRUCTION | strain is the distance between a settlement and the country, and this build has no settlement object to be the far end of it. Downstream of BILL_CORPUS and BILL_POSITION. |
| `EFFICACY_DROP` | ABSENT BY CONSTRUCTION | efficacy is bills moving the settlement toward the passer, per year of power. With no bill position it is undefined, and with SETTLEMENT_MOVEMENT absent it would be identically zero for every player in every year — which cannot distinguish a blocked leader from an effective one. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`.
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
| state-years |lean| rose, election years | 21812.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 2.027 ± 0.116 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.511 ± 0.005 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.030 ± 0.041 (n=300) per game |
| mean spread across players | 0.251 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.395 ± 0.009 (n=300) lean counters |
| peak |country position| | 1.038 ± 0.017 (n=300) lean counters |
| years displaced beyond deadband | 0.502 ± 0.013 (n=300) share |
| longest unbroken run on one side | 5.140 ± 0.185 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.629 ± 0.018 (n=300) 1 = random walk |
| sign crossings per decade | 0.381 ± 0.025 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 3.654 ± 0.102 (n=659) years |
| longest regime per game | 5.140 ± 0.185 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.003 ± 0.029 (n=106) lean counters/yr |
| country move within a party | 0.186 ± 0.005 (n=4394) lean counters/yr |
| excess move on turnover | 0.817 ± 0.029 (n=106) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.030 ± 0.041 (n=300) per game |
| sustained power windows (no presidency) | 0.410 ± 0.033 (n=300) per game |
| mean power in window (with) | 0.492 ± 0.003 (n=309) |
| mean power in window (no presidency) | 0.450 ± 0.003 (n=123) |
| windows that held the presidency | 1.000 ± 0.000 (n=309) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 309.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 309.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`

Never evaluated: SETTLEMENT_FORMATION, BILL_CORPUS, BILL_POSITION are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 309.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, BILL_POSITION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 309.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## governors-push.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 15749.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.510 ± 0.005 (n=300) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.339 ± 0.007 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 2.692 ± 0.061 (n=671) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.945 ± 0.034 (n=83) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.043 ± 0.041 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 313.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 313.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 313.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 313.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | ABSENT BY CONSTRUCTION | passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a single scalar the Fed decays. |
| `BILL_POSITION` | ABSENT BY CONSTRUCTION | a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis." |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | ABSENT | nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts) |
| `STRAIN_RISE` | ABSENT BY CONSTRUCTION | strain is the distance between a settlement and the country, and this build has no settlement object to be the far end of it. Downstream of BILL_CORPUS and BILL_POSITION. |
| `EFFICACY_DROP` | ABSENT BY CONSTRUCTION | efficacy is bills moving the settlement toward the passer, per year of power. With no bill position it is undefined, and with SETTLEMENT_MOVEMENT absent it would be identically zero for every player in every year — which cannot distinguish a blocked leader from an effective one. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`.
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
| state-years |lean| rose, election years | 15749.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 2.110 ± 0.117 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.510 ± 0.005 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.043 ± 0.041 (n=300) per game |
| mean spread across players | 0.248 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.339 ± 0.007 (n=300) lean counters |
| peak |country position| | 1.035 ± 0.017 (n=300) lean counters |
| years displaced beyond deadband | 0.376 ± 0.010 (n=300) share |
| longest unbroken run on one side | 3.420 ± 0.125 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.608 ± 0.018 (n=300) 1 = random walk |
| sign crossings per decade | 0.467 ± 0.029 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 2.692 ± 0.061 (n=671) years |
| longest regime per game | 3.420 ± 0.125 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.945 ± 0.034 (n=83) lean counters/yr |
| country move within a party | 0.196 ± 0.005 (n=4417) lean counters/yr |
| excess move on turnover | 0.749 ± 0.034 (n=83) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.043 ± 0.041 (n=300) per game |
| sustained power windows (no presidency) | 0.397 ± 0.031 (n=300) per game |
| mean power in window (with) | 0.492 ± 0.003 (n=313) |
| mean power in window (no presidency) | 0.445 ± 0.002 (n=119) |
| windows that held the presidency | 1.000 ± 0.000 (n=313) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 313.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 313.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`

Never evaluated: SETTLEMENT_FORMATION, BILL_CORPUS, BILL_POSITION are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 313.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, BILL_POSITION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 313.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## realigning.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 24, mean game length 24.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 35209.000 ± 0.000 (n=3300) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.525 ± 0.004 (n=300) share of offices |
| `settlement-formation` | HEALTHY | mean |country position|: 0.429 ± 0.010 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 4.427 ± 0.131 (n=951) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 1.026 ± 0.027 (n=138) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.343 ± 0.052 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 403.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 403.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 403.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 403.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | ABSENT BY CONSTRUCTION | passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a single scalar the Fed decays. |
| `BILL_POSITION` | ABSENT BY CONSTRUCTION | a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis." |
| `SETTLEMENT_FORMATION` | MET | the country position holds off baseline with a variance ratio above 1 |
| `SETTLEMENT_MOVEMENT` | ABSENT | nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts) |
| `STRAIN_RISE` | ABSENT BY CONSTRUCTION | strain is the distance between a settlement and the country, and this build has no settlement object to be the far end of it. Downstream of BILL_CORPUS and BILL_POSITION. |
| `EFFICACY_DROP` | ABSENT BY CONSTRUCTION | efficacy is bills moving the settlement toward the passer, per year of power. With no bill position it is undefined, and with SETTLEMENT_MOVEMENT absent it would be identically zero for every player in every year — which cannot distinguish a blocked leader from an effective one. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `BILL_POSITION`, `SETTLEMENT_MOVEMENT`.
  - First missing: a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis."
  - Control: none possible: no run can give a scalar a second dimension.
- **PREEMPTION** — blocked by `BILL_CORPUS`, `BILL_POSITION`.
  - First missing: passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a single scalar the Fed decays.
  - Control: none possible: no run can create a record the engine does not keep.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`.
  - First missing: nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts)
  - Control: C2: |lean| rises in election years and never in non-election years, on the same runs.
- **DISJUNCTION** — blocked by `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`.
  - First missing: a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis."
  - Control: none possible: no run can give a scalar a second dimension.

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
| state-years |lean| rose, election years | 35209.000 ± 0.000 (n=3300) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=3600) state-years |
| bills passed in non-election years | 2.800 ± 0.160 (n=300) per game |
| non-election bill years per game | 12.000 ± 0.000 (n=300) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.525 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.343 ± 0.052 (n=300) per game |
| mean spread across players | 0.241 ± 0.003 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **HEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.429 ± 0.010 (n=300) lean counters |
| peak |country position| | 1.140 ± 0.017 (n=300) lean counters |
| years displaced beyond deadband | 0.585 ± 0.012 (n=300) share |
| longest unbroken run on one side | 8.053 ± 0.311 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.647 ± 0.013 (n=300) 1 = random walk |
| sign crossings per decade | 0.471 ± 0.024 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 4.427 ± 0.131 (n=951) years |
| longest regime per game | 8.053 ± 0.311 (n=300) years |
| game length | 24.000 ± 0.000 (n=300) years |
| config year cap | 24.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 24, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 1.026 ± 0.027 (n=138) lean counters/yr |
| country move within a party | 0.177 ± 0.004 (n=6762) lean counters/yr |
| excess move on turnover | 0.849 ± 0.028 (n=138) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.343 ± 0.052 (n=300) per game |
| sustained power windows (no presidency) | 0.663 ± 0.037 (n=300) per game |
| mean power in window (with) | 0.491 ± 0.003 (n=403) |
| mean power in window (no presidency) | 0.446 ± 0.002 (n=199) |
| windows that held the presidency | 0.993 ± 0.004 (n=403) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 403.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `BILL_POSITION`, `SETTLEMENT_MOVEMENT`

Never evaluated: BILL_POSITION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 403.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `BILL_CORPUS`, `BILL_POSITION`

Never evaluated: BILL_CORPUS, BILL_POSITION are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 403.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_MOVEMENT, BILL_POSITION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 403.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: BILL_POSITION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## three-terms.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 60, mean game length 42.5y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 38862.000 ± 0.000 (n=6170) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.534 ± 0.004 (n=300) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.290 ± 0.008 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 2.507 ± 0.046 (n=1299) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.963 ± 0.025 (n=126) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.490 ± 0.050 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 447.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 447.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 447.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 447.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | ABSENT BY CONSTRUCTION | passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a single scalar the Fed decays. |
| `BILL_POSITION` | ABSENT BY CONSTRUCTION | a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis." |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | ABSENT | nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts) |
| `STRAIN_RISE` | ABSENT BY CONSTRUCTION | strain is the distance between a settlement and the country, and this build has no settlement object to be the far end of it. Downstream of BILL_CORPUS and BILL_POSITION. |
| `EFFICACY_DROP` | ABSENT BY CONSTRUCTION | efficacy is bills moving the settlement toward the passer, per year of power. With no bill position it is undefined, and with SETTLEMENT_MOVEMENT absent it would be identically zero for every player in every year — which cannot distinguish a blocked leader from an effective one. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`.
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
| state-years |lean| rose, election years | 38862.000 ± 0.000 (n=6170) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=6292) state-years |
| bills passed in non-election years | 6.557 ± 0.416 (n=300) per game |
| non-election bill years per game | 20.973 ± 0.537 (n=300) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.534 ± 0.004 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.490 ± 0.050 (n=300) per game |
| mean spread across players | 0.237 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.290 ± 0.008 (n=300) lean counters |
| peak |country position| | 1.159 ± 0.010 (n=300) lean counters |
| years displaced beyond deadband | 0.305 ± 0.009 (n=300) share |
| longest unbroken run on one side | 4.143 ± 0.143 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.550 ± 0.013 (n=300) 1 = random walk |
| sign crossings per decade | 0.525 ± 0.027 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 2.507 ± 0.046 (n=1299) years |
| longest regime per game | 4.143 ± 0.143 (n=300) years |
| game length | 42.540 ± 1.052 (n=300) years |
| config year cap | 60.000 ± 0.000 (n=300) years |

The cap (60y) admits at least one full cycle, so a short mean run here is a fact about the engine and not about the clock.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.963 ± 0.025 (n=126) lean counters/yr |
| country move within a party | 0.147 ± 0.003 (n=12336) lean counters/yr |
| excess move on turnover | 0.816 ± 0.025 (n=126) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.490 ± 0.050 (n=300) per game |
| sustained power windows (no presidency) | 1.377 ± 0.065 (n=300) per game |
| mean power in window (with) | 0.489 ± 0.003 (n=447) |
| mean power in window (no presidency) | 0.447 ± 0.001 (n=413) |
| windows that held the presidency | 0.964 ± 0.009 (n=447) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 447.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 447.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`

Never evaluated: SETTLEMENT_FORMATION, BILL_CORPUS, BILL_POSITION are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 447.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, BILL_POSITION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 447.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.

## tuned.json

300 games, agents `Greedy,BillAuthor,SenateFlood,Random`, year cap 16, mean game length 16.0y.

### Verdict table

| check | verdict | headline measure |
| --- | --- | --- |
| `control-instrument-liveness` | HEALTHY | synthetic regime: longest run: 20.000 ± 0.000 (n=1) years |
| `control-non-electoral-lean-writer` | UNHEALTHY | state-years |lean| rose, election years: 15782.000 ± 0.000 (n=2100) state-years |
| `control-power-is-measurable` | HEALTHY | peak power held: 0.510 ± 0.005 (n=300) share of offices |
| `settlement-formation` | UNHEALTHY | mean |country position|: 0.338 ± 0.007 (n=300) lean counters |
| `regime-duration` | UNHEALTHY | mean regime run: 2.680 ± 0.060 (n=674) years |
| `constraint-on-opponents` | UNHEALTHY | country move on party turnover: 0.944 ± 0.034 (n=83) lean counters/yr |
| `presidency-dependence` | HEALTHY | sustained power windows (with presidency): 1.040 ± 0.041 (n=300) per game |
| `quadrant-articulation` | BLOCKED | classifiable power windows: 312.000 ± 0.000 (n=300) windows |
| `quadrant-preemption` | BLOCKED | classifiable power windows: 312.000 ± 0.000 (n=300) windows |
| `quadrant-reconstruction` | BLOCKED | classifiable power windows: 312.000 ± 0.000 (n=300) windows |
| `quadrant-disjunction` | BLOCKED | classifiable power windows: 312.000 ± 0.000 (n=300) windows |

### Preconditions

| precondition | status | basis |
| --- | --- | --- |
| `BILL_CORPUS` | ABSENT BY CONSTRUCTION | passed bills are counted (GameResult.billsPassed) and discarded; no enacted-bill list, no repeal, no books. The only trace legislation leaves is economy.accumulatedG, a single scalar the Fed decays. |
| `BILL_POSITION` | ABSENT BY CONSTRUCTION | a bill is a single spending magnitude g (economy.gMin..gMax), not a point on any axis the engine defines; engine/rules/economy.ts: "There is deliberately no second ideological axis." |
| `SETTLEMENT_FORMATION` | ABSENT | the country position random-walks around its own baseline; no persistent regime forms |
| `SETTLEMENT_MOVEMENT` | ABSENT | nothing writes lean outside an election: |lean| never rose in a non-election year, in which bills were passing. Legislation reaches only economy.accumulatedG (engine/rules/legislature.ts, economy.ts) |
| `STRAIN_RISE` | ABSENT BY CONSTRUCTION | strain is the distance between a settlement and the country, and this build has no settlement object to be the far end of it. Downstream of BILL_CORPUS and BILL_POSITION. |
| `EFFICACY_DROP` | ABSENT BY CONSTRUCTION | efficacy is bills moving the settlement toward the passer, per year of power. With no bill position it is undefined, and with SETTLEMENT_MOVEMENT absent it would be identically zero for every player in every year — which cannot distinguish a blocked leader from an effective one. |
| `POWER_CONCENTRATION` | MET | sustained power windows occur |

### Why each quadrant is unreachable

- **ARTICULATION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **PREEMPTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **RECONSTRUCTION** — blocked by `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`.
  - First missing: the country position random-walks around its own baseline; no persistent regime forms
  - Control: C1: the detector fires on a synthetic 20-year regime and not on white noise.
- **DISJUNCTION** — blocked by `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`.
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
| state-years |lean| rose, election years | 15782.000 ± 0.000 (n=2100) state-years |
| state-years |lean| rose, NON-election years | 0.000 ± 0.000 (n=2400) state-years |
| bills passed in non-election years | 2.107 ± 0.117 (n=300) per game |
| non-election bill years per game | 8.000 ± 0.000 (n=300) years |

The detector fires in election years and is silent in every non-election year, while bills pass in those same years. So legislation cannot write to the settlement board at all: lean is election-only (applyPush, honeymoon, decay). This is CANNOT ACT as a property of the rules, not of any agent's choices — no pool, however maximising, can move it.

#### control-power-is-measurable — **HEALTHY**

*C3: does the power scalar vary and concentrate, so its silence would be a finding?*

| measure | value |
| --- | --- |
| peak power held | 0.510 ± 0.005 (n=300) share of offices |
| sustained windows (>=0.4 for >=3y) | 1.040 ± 0.041 (n=300) per game |
| mean spread across players | 0.248 ± 0.004 (n=300) |

Power does concentrate into sustained windows, so a quadrant finding no windows would be a fact about the quadrant and not about the scalar.

### Era checks

#### settlement-formation — **UNHEALTHY**

*Do settlements form at all, or does the country position random-walk with no persistent regime?*

| measure | value |
| --- | --- |
| mean |country position| | 0.338 ± 0.007 (n=300) lean counters |
| peak |country position| | 1.036 ± 0.017 (n=300) lean counters |
| years displaced beyond deadband | 0.376 ± 0.010 (n=300) share |
| longest unbroken run on one side | 3.400 ± 0.122 (n=300) years |
| variance ratio at lag 4 (descriptive) | 0.607 ± 0.018 (n=300) 1 = random walk |
| sign crossings per decade | 0.469 ± 0.029 (n=300) per 10y |

A settlement that forms holds the polity off its own baseline for most of the game and in long unbroken stretches: displaced share >= 0.5 and a longest run >= 8y (a quarter of the 30-year historical low). Short runs around a near-zero mean are a polity oscillating about its baseline, not a regime — and every downstream quadrant then measures nothing. Variance ratio is printed for description only: C1 showed a step-function settlement scores ~1, the same as a random walk, so it cannot be the criterion.

#### regime-duration — **UNHEALTHY**

*Do regimes last a cycle? Historical reference is 30-40 years.*

| measure | value |
| --- | --- |
| mean regime run | 2.680 ± 0.060 (n=674) years |
| longest regime per game | 3.400 ± 0.122 (n=300) years |
| game length | 16.000 ± 0.000 (n=300) years |
| config year cap | 16.000 ± 0.000 (n=300) years |

PRECONDITION FAILURE, not a result: the year cap is 16, so a 30-year regime cannot be observed in this config however the engine behaves. Read the quadrant table below as undefined rather than negative for this config.

#### constraint-on-opponents — **UNHEALTHY**

*When power changes hands to the other party, does the settlement position hold?*

| measure | value |
| --- | --- |
| country move on party turnover | 0.944 ± 0.034 (n=83) lean counters/yr |
| country move within a party | 0.196 ± 0.005 (n=4417) lean counters/yr |
| excess move on turnover | 0.748 ± 0.034 (n=83) lean counters/yr |

A settlement nobody has to govern inside is not a settlement. If turnover moves the position much more than an ordinary year does, incoming opponents are unconstrained. NOTE the confound: with no settlement object, this measures the POLITY moving, not a settlement resisting — it cannot distinguish "the settlement constrained them" from "there was nothing there to move".

#### presidency-dependence — **HEALTHY**

*Which of this is reachable with the presidency removed from the power scalar?*

| measure | value |
| --- | --- |
| sustained power windows (with presidency) | 1.040 ± 0.041 (n=300) per game |
| sustained power windows (no presidency) | 0.400 ± 0.031 (n=300) per game |
| mean power in window (with) | 0.492 ± 0.003 (n=312) |
| mean power in window (no presidency) | 0.444 ± 0.002 (n=120) |
| windows that held the presidency | 1.000 ± 0.000 (n=312) share |

Power windows that survive dropping the presidency term are the ones a quadrant could be reached from without winning the White House. Zero here would mean every Skowronek category in this game is a presidential category.

### Quadrant coverage

#### quadrant-articulation — **BLOCKED**

*Is ARTICULATION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 312.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-preemption — **BLOCKED**

*Is PREEMPTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 312.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_CORPUS`, `BILL_POSITION`

Never evaluated: SETTLEMENT_FORMATION, BILL_CORPUS, BILL_POSITION are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-reconstruction — **BLOCKED**

*Is RECONSTRUCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 312.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `SETTLEMENT_MOVEMENT`, `BILL_POSITION`, `STRAIN_RISE`

Never evaluated: SETTLEMENT_FORMATION, SETTLEMENT_MOVEMENT, BILL_POSITION, STRAIN_RISE are missing, so no window could be classified either way. This is an undefined, not a zero.

#### quadrant-disjunction — **BLOCKED**

*Is DISJUNCTION reachable?*

| measure | value |
| --- | --- |
| classifiable power windows | 312.000 ± 0.000 (n=300) windows |
| windows classified as this quadrant | — (n=300) |

Blocked by: `SETTLEMENT_FORMATION`, `BILL_POSITION`, `SETTLEMENT_MOVEMENT`, `STRAIN_RISE`, `EFFICACY_DROP`

Never evaluated: SETTLEMENT_FORMATION, BILL_POSITION, SETTLEMENT_MOVEMENT, STRAIN_RISE, EFFICACY_DROP are missing, so no window could be classified either way. This is an undefined, not a zero.
