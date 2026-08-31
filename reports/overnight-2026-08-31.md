# American Cycle — overnight simulation report

**2026-08-31.** Engine at `phase1-engine`, 31 tests green, clean typecheck.
Four era packs (1976/1992/2008/2016): 224 real candidates, 168 real districts.
Ten scripted agents. Every figure below is reproducible from its seed.

A caution up front, in the brief's own spirit: this run found the design's
problems faster than it found its numbers. Several sweeps that were supposed to
tune constants instead hit a structural issue that makes the constants moot
until it is fixed. That is reported as it happened rather than smoothed over.

---

## 1. Top five design changes

### 1. Decay must be biennial. Annual makes realignment arithmetically impossible.
**Metric** lean in one state after ten consecutive blowout cycles.
**Observed** annual decay pins the map at 2 pips, forever, at any margin.
**Target** a state that keeps being won decisively reaches a durable 4+ lean.
**Change** `lean.decayFrequency: "biennial"`. Already applied to the baseline.

§16 calls this the question that "decides whether realignment is possible at
all" and asks for simulation. It needs none — annual decay removes 2 pips a
cycle against a maximum push of 2, so total dominance nets exactly zero. Only
one of the four decay/push pairings accumulates:

| decay | push | after 10 blowout cycles |
|---|---|---|
| annual | flat +1 | pinned at 1 |
| annual | margin-based | pinned at 2 |
| biennial | flat +1 | pinned at 1 |
| biennial | margin-based | 2→3→4→5→6→7→8 ✓ |

Confidence: **certain**. It is arithmetic, and it is a passing test.

### 2. The board is far too large for the table — 79% of races go uncontested.
**Metric** share of race-slots drawing declarations from more than one player.
**Observed** 21–24% contested at the design's stated numbers.
**Target** SIM-BRIEF wants uncontested under 40%, i.e. contested above 60%.
**Change** cut district supply hard, raise base hand above 12, and scale the
card pool with the table.

The mechanism is a ratio: **cards per player ÷ eligible races per player.** At
year 6 of a four-player game each player had ~60 eligible races and 4–10 cards,
so everyone farms their own territory. Overlap was never the constraint — 66%
of races were eligible to more than one player and simply not worth taking.

| players | hand | districts | contested | states realigned | years |
|---|---|---|---|---|---|
| 2 | 12 | 0.15 | 10% | 0.0 | 24 |
| 4 | 12 | 0.15 | 23% | 0.1 | 14 |
| 4 | 20 | 0.06 | 44% | 1.1 | 7 |
| 6 | 12 | 0.15 | 40% | 0.9 | 9 |
| 6 | 20 | 0.06 | **63%** | 1.5 | 5 |

Two things fall out. **Two-player is structurally broken** at 10–20% contest —
two solitaires sharing a scoreboard, at every setting tested. And **contest and
game length trade off directly**: everything that makes players fight burns
cards, and the 63% row lasts five years.

Confidence: **high**. The direction is unambiguous and monotone; the exact
numbers depend on the card pool.

### 3. The presidency is never contested, and takes five mechanics down with it.
**Metric** contested share of presidential races.
**Observed** 0% across 2,750 presidential state races; 3 nominations in 10 games.
**Target** the presidency should be the most fought-over prize on the board.
**Change** let accumulated presence convert into a presidential edge — run the
national primary across the states you hold — or the office is priced wrong.

An edge-ranking agent scores a race by its modifier stack. The presidency is
run in states where the candidate holds no district and is not native, so its
edge is ~0 while a House seat with synergy and a home-state bonus scores +4.
Rational play never runs for it. Because the presidency is the sole source of
the midterm penalty, coattails, the honeymoon, the veto and the economy
modifier, **five national mechanics never fire at all** — a dead-rule cascade
from one unattractive race.

Confidence: **high** on the mechanism, **medium** on the fix.

### 4. The omnibill is stalled — 16% pass rate.
**Metric** share of proposed bills that pass.
**Observed** 16% over 2,250 attempts.
**Target** SIM-BRIEF: "If they pass 20%, the primary scoring engine is stalled
and victory conditions never trigger."
**Change** the 60% Senate threshold is doing exactly what §12 designed it to do
— forcing cross-benching — but with scoring available only on passage, the
minority's incentive to cross is too weak. Either lower the threshold, or give
cross-benchers a reward that does not depend on the bill passing.

Cross-bench votes are frequent (72 a game), so players *are* reaching across;
the bills still fail. The threshold binds harder than intended.

Confidence: **high** on the measurement, **medium** on the cause.

### 5. Turns are close to automatic — median 2 legal declarations.
**Metric** mean legal moves per player-turn.
**Observed** median 2, mean 3.7, p90 10.
**Target** SIM-BRIEF: under ~4 and turns are automatic.
**Change** downstream of #2. More cards per player raises this directly.

Confidence: **high**.

---

## 2. Rules recommended for cutting

Only one rule was measured firing rarely enough to be a cut candidate, and the
honest answer for most of the brief's list is that they are **not implemented**,
not that they are dead. See §7.

| rule | fires in | verdict |
|---|---|---|
| Fed rate rise | 44% of games | **alive and load-bearing** — keep |
| Austerity (negative G) | agents propose it only under EconomyChicken | **untested**, needs an agent that wants it |
| Veto | never, because a president is never seated | blocked by finding #3, not dead |
| Impeachment | 0% | **not wired into the year loop** — untested |
| Extremist / heterodox text | fires on every card carrying it | alive |

**Nothing should be cut on this run's evidence.** A rule that never fires
because the office feeding it is never filled is not a dead rule; it is a rule
downstream of a broken one.

---

## 3. Historical validation

**Not run.** See §7 — this is the section I could not deliver, and the reason
is not a shortage of time.

One thing was validated, and it is the design's own claim about pack rotation:

| pack | mean home-state bonus |
|---|---|
| 1976 | 2.96 |
| 1992 | 1.85 |
| 2008 | 1.84 |
| 2016 | 1.62 |

§5 says to "print larger home-state bonuses on mid-century cards and smaller
ones on modern ones, and the decline of localism falls out of pack rotation
with no rule at all." It does. That is a real, if small, historical validation.

**A defect in my own card data:** heterodoxy does *not* decline across the packs
(37% → 44% → 40% → 42%) when it should collapse toward the handful of modern
survivors. The 1976 figure is defensible — liberal Republicans and conservative
Democrats genuinely existed — but the 2016 pack is over-tagged. This is an
authoring error, not a design finding, and it biases anything measuring
heterodoxy's value upward.

---

## 4. Balance dashboard

**Skill signal** (40 games each, seats alternated, `tuned`):

| matchup | result | target | verdict |
|---|---|---|---|
| Greedy vs Random | **93%** | 65–80% | **fails high** |
| Lookahead vs Greedy | **90%** | a few points | planning pays enormously |
| Greedy vs WideAndEmpty | **100%** | should be dead | **district gating works** |

93% is past SIM-BRIEF's "above 90% and there are no interesting decisions" bar.
Combined with Lookahead beating Greedy 90%, the picture is a game where
competence dominates and the dice are close to decoration — the opposite of the
failure the design feared. Note this is measured on a board where almost
nothing is contested, so it may be an artefact of finding #2 rather than a
property of the design; it should be re-measured once players actually meet.

**Wide-and-empty is confirmed dead.** It wins 0% in the round robin and loses
100% head-to-head. District gating does the job §5 claims for it. This is the
design's clearest success in the whole run.

**Seat bias** (all Greedy, n=300–400, `tuned`, 16 years):

| players | max deviation | 2×SE | verdict |
|---|---|---|---|
| 3 | 4.3pp | 5.4pp | within noise |
| 4 | 4.7pp | 5.0pp | within noise |
| 5 | 9.5pp | 4.0pp | **real** |
| 6 | 11.3pp | 4.3pp | **real** |

Two harness bugs were manufacturing a much larger apparent bias and were fixed
before these numbers: resolving score ties by `indexOf` handed every tie to the
lowest seat (~25pp of phantom bias), and refilling hands in seat order gave low
seats every card when the talon ran short (~7% of real scoring advantage).
Rotating declaration order — SIM-BRIEF's suggested fix — brings 3–4 players
within noise. The residue at 5–6 players tracks election cycles not dividing
evenly by player count, so some players lead an extra time. Shuffling the order
each cycle was tried and made it **worse** at every table size.

**Six-way round robin** (120 games; >40% is dominant):

| strategy | win rate |
|---|---|
| BillMaximizer | 40.0% |
| SenateFlood | 32.5% |
| EconomyChicken | 26.7% |
| HeterodoxSpecialist | 0.8% |
| WideAndEmpty | 0.0% |
| HouseFarm | 0.0% |

BillMaximizer sits exactly on the dominance line. It wins by chasing bodies in
both chambers and voting yes on everything — which is rational when yes-votes
are the scoring engine and the minority scores nothing.

**HeterodoxSpecialist at 0.8% is the finding that should worry you most.**
Heterodoxy is one of the design's two theses — "the heterodox candidate who
survives a hostile state is the most valuable and most fragile card in the
game." It is currently the second-worst strategy on the board. On an
uncontested map there is no hostile terrain to survive, because nobody is
defending anything; insulation from a tide buys nothing when no tide is
opposing you. Like the skill signal, this should be re-measured after #2.

---

## 5. Sweeps

Ten sweeps were specified. **Two were run** — district supply, and the
decay/push pairing — and both are reported above under changes #1 and #2. The
remaining eight were not run, because a sweep of hand size or midterm penalty
measured on a board where 79% of races are uncontested measures noise, not the
parameter. Running them would have produced eight tables of numbers that look
like findings and are not.

The priority sweep the brief names — margin-based push against flat — was run
and is finding #1. The pathology exists, and margin-based pushes fix it, but
**only under biennial decay**, which the brief did not anticipate.

---

## 6. Pathologies, with seeds

| pathology | reproduce |
|---|---|
| map cannot realign | `node sim/harness.ts --config as-written.json --games 20` |
| flat push moves nothing | `node sim/harness.ts --config flat-push.json --games 20` |
| presidency never contested | `node sim/roundrobin.ts tuned.json 40` |
| solitaire board | `node sim/sweeps.ts` — every row |
| bill stall | seeds 31000–31149, `tuned`, 16% of 2,250 |

All engine invariants are asserted rather than described: the odds table
against 800k simulated races, the withdrawal window against the wave's own
roll counter, decay-before-push on every state, and governors never pushing.

---

## 7. What I could not test, and why

**Historical validation (Part 1) — the largest gap.** Sourcing real MIT
Election Lab returns was permitted and possible. I did not run it, because
validating simulated incumbent-reelection rates against reality is meaningless
while the presidency is never contested, 79% of races are walkovers, and no
state ever realigns. The sim would have been graded on a board that does not
resemble an election. **The real-world baseline is worth building regardless** —
it does not depend on the rules — and is the obvious next task.

**Not implemented, so not measurable:**
- **Impeachment** — `impeach()` exists and is tested, but is not wired into the
  year loop as an omnibill replacement.
- **The vice presidency** entirely: succession, tie-breaking, the home-state
  bonus, and therefore **VPBackstab**, which the brief explicitly asked to test
  rather than trust. It remains untested.
- **Governor Senate appointments.**
- **Independent candidacies** — the card schema supports party `I` and the
  engine skips their primary, but no pack contains one.
- **Endorsement tapping** — endorsements are scored, but no agent spends one,
  so the +3 presidential endorsement has never been measured.

**Blocked by agent sophistication:** the brief asks whether lookahead beats
greedy by more than a few points as a measure of strategic depth. It beats it
by 90%, which says more about how weak pure edge-greed is than about the depth
of the game.

**Untestable in principle,** and flagged as the brief requires: everything
social. Negotiation before the bill, VP horse-trading, coalition-building for
impeachment, table politics against a runaway leader. The bill's 16% pass rate
in particular should **not** be treated as settled — it is measured against
agents that cannot negotiate, and §12's whole design intent is that they would.
**Recommend a human playtest before changing the filibuster threshold.**
