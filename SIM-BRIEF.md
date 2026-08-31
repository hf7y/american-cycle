# Overnight simulation brief: American Cycle

**For an agent with a working engine (Phase 1 of `BUILD-BRIEF.md`). Read `design-doc.md` for rules.**

---

## The job

Run the game a few hundred thousand times overnight and come back with a report that says **which numbers are wrong and which mechanics are dead.**

Not "here is some data." A ranked list of design changes with the evidence attached.

The most useful output is a falsification: a mechanic that never fires, a strategy that always wins, a number that produces a distribution nothing like reality. Look for those first. A clean bill of health is the least likely and least useful result, and if you produce one, assume the instrumentation is wrong before assuming the design is right.

---

## Ground rules

**Seed everything.** Every run reproducible from a seed. When you report a pathology, report the seed that shows it.

**Instrument the engine, don't wrap it.** Emit a structured event per rule invocation — every die, every modifier applied, every ability triggered, every decision offered and taken. Most of the analysis below is a query over that event log, and if the log is right you can answer questions nobody thought to ask yet.

**Log the counterfactual.** On every race, record not just the result but the margin, the modifier stack, and what the result would have been at zero dice. This is what lets you separate "the design says X should win" from "the dice said X won."

**Report effect sizes, not p-values.** With 100k games everything is significant. What matters is whether the number is far enough from target to change the design.

---

## Part 1 — Historical validation

This is the part that makes the game worth building. The design claims that simple flat modifiers, honestly calibrated, reproduce real electoral behavior. Test that claim.

**Source real data first.** MIT Election Data and Science Lab has district-level House returns; state-level presidential and Senate returns are widely available. Do not validate against the numbers below — validate against a dataset, and treat the numbers below as my recollection of what you should find. Where they disagree with the data, the data wins and you should flag the discrepancy.

| Target | Approximate real value | Sim measure |
|---|---|---|
| House incumbent reelection | ~90–95% modern era | Share of incumbent Reps who hold |
| Senate incumbent reelection | ~80–90%, more variable | Same for Senate |
| Midterm losses, president's party | Losses in 19 of last 21; avg ~26 seats | Mean seat change, share of midterms with a loss |
| Senate/presidential concordance | Near-total by 2016–2020 | Share of Senate races matching presidential winner in-state |
| Governor cross-party incidence | Substantial and persistent | Share of governors from the state's disfavored party |
| Presidential party turnover | Roughly even, conditioned on economy | Share of incumbent parties holding |
| Uncontested House races | ~10% typical | Share of seats with no opposing declaration |
| State realignment timescale | Decades | Cycles for a state to move 4+ pips and hold it |

**The margin distribution is the deepest test.** Plot simulated race margins against real district-level margin distributions. The real distribution is bimodal — a mass of safe seats, a thin middle of competitive ones. If the sim produces a unimodal blob centered near zero, then district gating and lean counters are not doing the work the design claims, and the whole "1 pip = 2 points" calibration is decorative.

**Incumbency is a calibration check on +1.** If simulated incumbent reelection lands at 60% when reality is 90%, +1 is too small, or incumbency needs to compound with district capture, or safe seats are not emerging. Report which.

---

## Part 2 — Balance

### Skill signal

Run round-robins of agent pairs and report win rates.

`RandomAgent` vs `GreedyAgent` (takes the highest-edge race available) is the headline number. Target roughly **65–80%** for greedy. Below 60% and the game is dice with a board attached. Above 90% and there are no interesting decisions — the right play is obvious and the dice are theater.

Add a `LookaheadAgent` that evaluates two cycles out. Greedy vs lookahead measures whether **planning** pays, which is a different question from whether **competence** pays. If lookahead beats greedy by less than a few points, the game has no strategic depth beyond the current turn, and the staggered-cycle structure — the thing the whole design is built on — isn't earning its keep.

### Runaway leader

Three measures, all necessary:

- **Determination point.** At each year, is the current leader the eventual winner? Report the year at which this first exceeds 80%. Healthy is around 75–85% of the way through. If it's year 3 of 12, the positive-feedback stack is broken.
- **Lead changes per game.** Zero after the early game means runaway.
- **Comeback rate.** Share of games won by a player who was last at the halfway mark.

The design has three stacking feedback loops — hand size, endorsements, district capture — braked only by the midterm penalty, recession, and coalition play against the leader. Measure whether the brakes bind. Specifically: **does the leader's win rate in a given cycle drop after they take the presidency?** If not, the midterm penalty is too small.

### Seat and turn order

Declaration is sequential, and going last means walking into whatever's empty. Report win rate by seat position at 2, 3, 4, 5, and 6 players. **Any deviation over about 3 percentage points needs a fix**, and the obvious one is rotating declaration order or making it simultaneous.

### Dominant strategy search

Write one scripted agent per strategy the design worries about, then round-robin them:

- `WideAndEmpty` — declare everywhere cheap, contest nothing
- `SenateFlood` — run everything for Senate early
- `HouseFarm` — build district presence, promote upward
- `HeterodoxSpecialist` — draft only off-brand candidates for hostile states
- `BillMaximizer` — optimize for yes-votes and majority status
- `Impeacher` — coalition-build for removals
- `EconomyChicken` — spend hot, pivot parties before the reckoning
- `VPBackstab` — place VPs on rival tickets, then impeach

**Any agent above 40% in a six-way round robin is dominant and the design has a hole.** `WideAndEmpty` is the specific one to watch: district gating is supposed to have killed it. Confirm that, and confirm it stays dead as pack composition varies.

`VPBackstab` is the other one. The design accepted it on the theory that impeachment's party penalty is a sufficient brake. Test that theory rather than trusting it.

---

## Part 3 — Complexity audit

The design's governing rule is that if it can't be a token on a card, it doesn't exist. Check whether the surviving rules earn their space.

**Dead rule detection.** Count invocations of every rule across all games. Report anything firing in under 1% of games. Candidates for the chopping block, and my priors on each:

- Impeachment — plausibly too expensive to ever be worth it
- Austerity (negative G) — may be strictly dominated
- Independent candidacies — no primary, no coattails, may be pure downside
- Veto — only rational in split-government years, which may be rare
- VP succession
- Governor Senate appointments
- Extremist horseshoe wins — is shooting the moon ever correct?

A rule that fires in 0.2% of games is a paragraph of rulebook and a permanent cognitive tax for a thing nobody sees. Recommend cutting or strengthening, and say which.

**Card text usage.** Once real cards exist: what share of printed abilities ever change an outcome? If half the cards' text is decorative, the enumerated effect types are wrong or the magnitudes are too small.

**Decision density.** Mean legal moves per player-turn. Under ~4 and turns are automatic; over ~25 and the game is analysis paralysis. Report the distribution across game phases, since the failure will be phase-specific — my guess is the primary is where the count explodes.

**Board load.** Peak simultaneous tokens: pegs, lean counters, card counters. If a mid-game board carries 200 counters, the single-token-type economy has failed in practice even though it succeeded on paper.

**Arithmetic load.** Distribution of modifier-stack depth per race. The design promises mental math. If the median race stacks 7 modifiers, it doesn't.

---

## Part 4 — Parameter sweeps

The six open questions from design doc §16. Sweep each, holding others at baseline, and report the metric each is supposed to move.

| Sweep | Range | Watch |
|---|---|---|
| Base hand size | 8–16 | Game length, determination point |
| Presidency hand bonus | 0–4 | Runaway measures |
| Senate hand bonus | 0–2 | Same |
| Incumbency value | +1 to +3 | Incumbent reelection vs historical |
| Districts per 15-card pack | 3–9 | Map fill rate, share of turns with a legal move |
| Decay rate | 1 per cycle vs 1 per year | Realignment timescale, whether lean ever accumulates |
| Push rule | flat +1 vs margin-based (0/1/2) | Whether states ever realign |
| Midterm penalty | −1 to −4 | Whether the presidency's brake binds |
| Fed threshold curve | 2d6 vs 3d6 roll-under | Whether the chicken game is playable or just punishing |
| Filibuster threshold | 50% vs 60% vs 67% | Bill passage rate, cross-benching frequency |

**The margin-based push is the priority sweep.** Under flat +1 push against −1 decay, a party winning every cycle nets zero and nothing ever realigns — which would falsify the game's central thesis. Verify the pathology exists, then verify the margin-based rule fixes it. If it doesn't, that's the most important finding of the night.

---

## Part 5 — Game feel

Harder to measure, worth attempting.

**Length.** Distribution of years and estimated wall-clock time. Target a table session. Report the tail — a game that usually runs 90 minutes but sometimes 5 hours has a variance problem worse than its mean.

**Dead player detection.** Share of player-turns where a player has no meaningful choice, or is mathematically eliminated but still playing. Both are feel-bad states and both should be near zero.

**Swinginess.** Share of races decided by dice against the modifier stack — where the favorite loses. Should sit near what the odds table predicts. If it's much higher, something is adding variance the design didn't intend.

**Bill cooperation rate.** Share of years a bill passes, and share of votes that cross-bench. The 60% filibuster is supposed to force cooperation. If bills pass 95% of the time, the threshold isn't binding and the negotiation is theater. If they pass 20%, the primary scoring engine is stalled and victory conditions never trigger.

**Uncontested share.** How many seats go unopposed. Some is realistic. If it's over about 40%, players aren't fighting each other and the game is solitaire in parallel.

---

## Deliverable

A markdown report at `/reports/overnight-YYYY-MM-DD.md`, structured as:

1. **Top five design changes**, ranked by confidence, each with the metric, the observed value, the target, and the specific proposed change.
2. **Rules recommended for cutting**, with invocation rates.
3. **Historical validation table**, sim against real, with discrepancies flagged.
4. **Balance dashboard** — skill signal, determination point, seat bias, round-robin matrix.
5. **Sweep charts** for each parameter.
6. **Pathologies**, with reproducing seeds.
7. **What I couldn't test and why.**

Section 7 matters. Anything gated on card data that doesn't exist yet, or on agent sophistication you couldn't reach, should be named rather than silently skipped.

---

## A caution

Simulated agents are not people. They won't table-talk, form grudges, gang up on a leader out of spite, or make a bad play because it's funny to name a bill after their cat. The social layer — negotiation before the bill, VP horse-trading, coalition-building for impeachment — is a large fraction of this design and **none of it is testable here.**

So: trust the simulator on arithmetic, distributions, dead rules, and runaway detection. Do not trust it on whether the game is fun, whether the bill negotiation is the best part of the evening, or whether the VP backstab is a delight or a betrayal that ends friendships.

Where a finding depends on the social layer, say so and recommend a human playtest instead of a parameter change.
