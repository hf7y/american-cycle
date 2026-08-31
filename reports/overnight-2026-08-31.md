# American Cycle — overnight simulation report

**2026-08-31.** Engine at `phase1-engine`, 35 tests green, clean typecheck.
Four era packs (1976/1992/2008/2016): 232 real candidates, 168 real districts.
Twelve scripted agents, §6's pack-pass draft, and every mechanic in the design
doc implemented. Every figure below is reproducible from its seed — and the
findings behind them are executable predicates rather than sentences, graded
against their own stamps. See §6.

A caution up front, in the brief's own spirit: this run found the design's
problems faster than it found its numbers. Several sweeps that were supposed to
tune constants instead hit structural issues that make the constants moot until
they are fixed. That is reported as it happened rather than smoothed over.

**And a caution about this report.** Eight of my own claims had to be corrected
during the night, most of them because a convenient proxy had been measured
instead of the metric SIM-BRIEF specifies — decision density (declarations made
rather than legal moves available, which *inverted* the conclusion), the
runaway metrics (per-game proxies rather than cross-game curves, which also
inverted it), the independents win rate (walkovers included), the seat bias
(two harness bugs manufacturing ~25pp that was not there), "the runaway is the
opening deal" (refuted by building §6's draft), "the filibuster stalls the
bill" (one variable swept, not two — F27), "+1 incumbency is calibrated" (a
pooled rate compared against a House-only benchmark — F37), and "the
governorship does not matter" (measured against agents that never played the
line — F36). Every headline figure below has since been re-measured on the
current engine. The brief's own instruction — *"assume the instrumentation is
wrong before assuming the design is right"* — was correct eight times out of
eight, and the corrections are kept visible in `FINDINGS.md` rather than
quietly overwritten.

---

## 0. The headline

**The design's central thesis is not implemented.** §1 argues that realignment
is "the accumulated residue of individual races won by individual candidates".
Played across 1932→1992 with era packs for both ends of the largest realignment
in American history, **nothing moves**: mean final lean is −0.14 in the South,
−0.08 in the Northeast, −0.01 elsewhere.

Over 45,000 state-election-cycles, lean moves away from zero 44.6% of the time
and toward zero 45.5% of the time. **Push and decay cancel to within a
percentage point, so the map is a driftless random walk.**

The mechanism the design chose is sound; it is calibrated to roughly zero net
drift. Three measured facts hold it there — 93% of races are uncontested and so
push nothing, contested margins run a median of 8 points against a decay of 1
pip a cycle, and the winning party in a state alternates too often for pushes to
share a sign.

**And there is a one-line fix, to a rule the design never decided.** §10 scales
a push by how decisively a race was won and never says what an *uncontested*
win does. Reading a walkover as worth one pip takes the map from a driftless
walk to a genuinely realigning board:

| walkover pushes | mean \|lean\| | states at 4+ per game |
|---|---|---|
| 0 (current) | 0.13 | 0.2 |
| **1** | **1.44** | **7.4** |

It is also the thematically right answer. The game already encodes a safe seat
as an uncontested race rather than a lopsided one, and in reality a state is
understood to have realigned exactly when the other party stops fielding
anybody. The walkover *is* the evidence, and scoring it at zero throws away the
game's own best signal about which states have moved.

Shipped as the `realigning` config so it can be played against `tuned` rather
than argued about. **Not applied to the baseline** — it is §10's decision to
make. Full working in `FINDINGS.md` F23 and F24.

**It does not fix change 3.** I expected an accumulating map to produce
lopsided races and close the margin gap; it moves the median from 8 points to
10 and leaves safe seats at 0.7% against a real 37.5%. Lean caps at ±8 pips, so
even a completely realigned state contributes 16 points. **Realignment and the
margin ceiling are independent problems with independent fixes.**

---

## 1. Top five design changes

Ranked by confidence. Every figure is reproducible from its seed; the
thirty-seven numbered findings behind them are in `FINDINGS.md`.

**Read the ordering as a claim about causation, not just severity.** Change 2
is one root cause behind four separate failing metrics — contest rate, decision
density, realignment, and dead turns — so it buys more than its position
suggests. Changes 3 and 4 are independent of it and of each other.

### 1. Decay frequency is a pair with the push table, not a setting on its own. *Applied, then beaten.*
**Metric** lean in one state after ten consecutive blowout cycles; then states
reaching a durable 4+ lean per game, across 1932→1992 on seven era packs.
**Observed** **at §10's printed push table of 0/1/2**, annual decay pins the map
at 2 pips forever, at any margin. **At a push table of 2/3/4 it does not** — it
realigns 13.8 states a game against the shipped biennial baseline's 5.8.
**Target** a state repeatedly won decisively reaches a durable 4+ lean.
**Change** `lean.decayFrequency: "biennial"` was applied to every config on the
first reading; `as-written-plus.json` now ships the better one.

§16 calls this the question that "decides whether realignment is possible at
all" and asks for simulation. The arithmetic half is real and still holds: an
annual decay of 2 pips a cycle against a **maximum push of 2** nets exactly
zero, so under §10's printed 0/1/2 table sustained dominance moves nothing and
biennial decay is the only pairing that accumulates. **That conclusion is
conditional on the push table, and the condition was not stated the first
time.**

Raising the push table +2, to 2/3/4, gives an annual decay something it can
outrun — and §7's literal reading, annual bill and annual decay, then beats the
shipped baseline on every measure taken:

| | shipped baseline (biennial, 0/1/2) | `as-written-plus` (annual, 2/3/4) |
|---|---|---|
| states realigned per game | 5.8 | **13.8** |
| states pinned at the ±8 cap | 3.5 | **none** |
| bills passed per game | 3.1 | **7.3** |

Biennial decay was never the fix; it was a workaround for a push table too
small to outrun an annual −2, and it costs half the legislative layer and
saturates the map. The 3d6 design does not limit any of this — the dice fix how
*often* each push tier fires, not what a tier is worth.

Confidence: **certain** on the arithmetic; **high** on the replacement, which
is a live predicate (`findings/decay-push-tradeoff.ts`) that also asserts
`as-written-plus.json` still ships the table the finding selects.

### 2. Cut district supply hard. One change moves five metrics.
**Metric** contested race-slots; legal moves per turn; realignment; dead turns.
**Observed** 37% contested (target >60%), **39 legal races per player-turn**
(target 4–25), 0.21 states realigned a game, 4.4% of turns with no legal move.
**Change** cut district supply, raise base hand size, scale the pool with the
table.

Contest rate is governed by **cards per player ÷ eligible races per player**,
and at the design's own numbers that sits near 1:5 — at year 6 a player has
~60 eligible races and 4–10 cards. Everyone farms their own territory. The
*same* abundance is what puts 39 races in front of a player each turn, which
is analysis paralysis; and realignment barely happens because an uncontested
race has no margin and pushes nothing.

**Two-player is structurally broken** at 10–20% contest, at every setting
tested, and the design claims 2–6.

Confidence: **high** on direction and mechanism; the exact numbers depend on
the card pool.

### 3. A safe seat cannot exist. The pip scale has a ceiling.
**Metric** House margin distribution, sim against 9,555 real races 1976–2018.
**Observed** median 8 points against a real 32.5; safe seats (40+ points) are
**0.0% of simulated races and 37.5% of real ones**.
**Change** decide what a safe seat *is* in this game, then make the scale match.

Arithmetic, not tuning. Mean stack depth is 2.43 entries of 1–3 pips, so a big
realistic stack is +8 pips — 16 points at §3's rate. **A 40-point margin needs
+20 pips and the vocabulary cannot express it at any setting.**

In the design's favour: the game encodes a safe seat as an *uncontested* race
where reality encodes it as a 40-point win. Adjusting for that narrows the gap
to roughly 46% against 93.5% "effectively safe". It narrows; it does not close.

Confidence: **certain** on the ceiling, **open** on which way to resolve it.

### 4. The leader runs away, and the only brake in the design is social.
**Metric** SIM-BRIEF's determination point and comeback rate.
**Observed** determination **38–63% across competent agent pools** (healthy is
75–85%); comeback rate **0–2% in every pool tested**, including random play;
the leader's margin over second place **doubles** across the second half, from
26 to 51; and **100% of player-scores never decrease**.
**Change** none proposed — and that is the finding.

§16 names three suspects and three brakes. Every suspect was tested by
switching it off: **hand size, endorsements and capture are all innocent**
(determination stays at 50% without them, and *worse* without hand bonuses,
which since F7 cap at +3 and act as catch-up). §6's pack-pass draft was
implemented specifically to test whether the opening deal was the cause; it cuts
the deal's predictive grip by a third and moves determination not at all.

What locks the game in is that **nothing in the design can take points away**.
Scores are monotonic, accrual is steady, and the leader pulls further ahead.
Of the three intended brakes, the midterm penalty does not bind, recession hits
the president's party rather than the leader, and the third is *"other players
ganging up"* — the social layer.

**The design's only effective brake on a runaway leader is table politics, and
that is exactly what this simulator cannot test.** Recommend a human playtest
before adding any catch-up mechanic. The design may well be right that ganging
up suffices; it should be a deliberate choice that the brake is social, because
there is no mechanical fallback if a table fails to coordinate.

Confidence: **high** on the runaway and on the absence of a mechanical brake;
the remedy is a table question, not a parameter.

### 5. SenateFlood is dominant at 51.7%, and the filibuster stalls the bill.
**Metric** six-way round robin; bill pass rate.
**Observed** SenateFlood **31.7%**, down from 51.7% once the seat-order bug was
fixed; the top strategy is now EconomyChicken at **37.8%**, touching
SIM-BRIEF's 40% dominance line without crossing it (n=360, 2σ = 3.9pp). Bills
pass **16%** at the current 60% Senate threshold, against a 20% stall line —
and 63% at a 50% threshold, 0% at 67%.
**Change** for the Senate: it pays more ways than anything else on the board —
points, a six-year term, hand size, the midterm lean push from §10's priority,
and governor appointments as a fifth route in. It is no longer *dominant* (the
51.7% was an artefact of the seat-order bug, F26) but it is still the best thing
to do.

**For the bill: change nothing.** The threshold sweep moved passage 63/16/0
across 50/60/67 — but holding the threshold at 60% and varying only who is at
the table moves it **14% to 100%**, a wider range than the sweep produced. The
16% figure is a property of my agent pool, not of the design, and §12's stated
intent — that the filibuster makes cooperation structurally necessary — is
working exactly as written. What the simulator cannot supply is the
cooperation. See `FINDINGS.md` F27.

Confidence: **high** on the Senate, and the bill needs a human table rather
than a parameter.

---

### A robustness check on all of it

Every headline number above was re-measured across six agent pools, from four
identical Randoms to a mix of specialists, because F27 caught one figure that
was an artefact of who was playing. **The median House margin is identical —
8 points — in all six.** Uncontested share, incumbent reelection, contest rate,
realignment and comeback rate all hold their range. Only the determination
point moves materially (38–75%), and its top end is four Random agents, where
nothing locks in because nothing accumulates. Full table in `FINDINGS.md` F28.

### What is already working

Most of this report is problems, so the successes are worth naming: district
gating kills wide-and-empty stone dead (0% win rate, 100% loss head-to-head);
**+1 incumbency does NOT reproduce reality** — 98.8% against 94.1% on House races (F37; the earlier 93% compared a pooled figure to a House benchmark); the
single-token economy holds at a peak of 151 against a 200 failure line; the
modifier stack averages 2.43 entries so the mental arithmetic really is mental;
and the dice do exactly what the corrected odds table predicts (32.1% observed
upsets against 34.6% predicted). **The resolution machinery is sound. The
problems are scale and structure.**

---

## 2. Rules recommended for cutting

**Nothing should be cut**, and the reason is worth more than the list.

Every rule that looked dead on the first pass was dead *downstream of a bug*,
not on its own merits. §5 says a district card boosts House, Senate, governor
and presidential runs in its state; the presidential clause was unimplemented.
That single omission made the office score edge 0.0 against a House seat's +5,
so no edge-ranking agent ever ran for it, so all fifty state races were
walkovers, so **five national mechanics fired in zero races**.

| rule | before the fix | after |
|---|---|---|
| midterm penalty | never | 63.5 times a game |
| coattails | never | 52.6 times a game |
| economy modifier | never | 51.3 times a game |
| veto | **0.00 a game**, even with a president (F35) | 0.30 a game |
| honeymoon | never (no president) | live |
| Fed rate rise | 44% of games | unchanged, load-bearing |
| incumbency | **never, in any race** (F9) | live, House 98.2% |
| endorsements | never spent | 32% of primaries, 72% win |
| independent candidacies | no pack held one | 39% of contested generals |
| governor appointments | never | ~12 a game |
| §12's bill counters | **never recorded** (F33) | cross-benched 15.0, bill record 14.2 per 1000 races |
| printed card text | **decorative, on all 346 candidates** (F34) | fires in 4.12% of races |
| `may_endorse` senators | no card carried it (F34) | Sanders, DeMint, Kennedy, Goldwater |
| odd-year governorships | **0 of 1,039 governor races** (F36) | live behind `game.oddYearGovernors` |
| impeachment | unwired | wired, and still 0% — see F12 |

Two of those — incumbency and the whole national layer — had been silently
returning nothing while earlier sections of this very report drew conclusions
from them. **A rule that never fires because something upstream is broken is
not a dead rule, and cutting it would have been the worst possible outcome of
this run.**

Impeachment is the one rule that is now correctly implemented and *still* fires
at 0%, and F12 explains why: two-thirds of the Senate is arithmetically out of
reach when the president's party holds the chamber by having won the
presidency. Even that is not a cut recommendation — it is a request for a human
playtest, because impeachment is a negotiation and every agent here votes the
party line.

### The bottom four rows were found by sweep, not by noticing

The last four rows of that table came out of three **coverage sweeps** run
late: instrument every named entry in §9's modifier stack, then BUILD-BRIEF's
seven effect types, then §7's ten year-sequence steps, and see which never
appear. The sweep is cheap and should have been run first.

- **§12's counters had no electoral consequence at all** (F33). `reactionGood`
  was computed on every passing bill and discarded, and `Declaration.crossBenched`
  was read by the modifier builder and never set. A player could vote for
  anything, forever, and never answer for it. Implemented, and the two
  modifiers now fire 15.0 and 14.2 times per 1000 races — but *zero* contested
  generals in 120 games featured a candidate carrying a bill record, because on
  a 92%-walkover board two rare things almost never coincide. **Live, and
  unmeasurable until the contest rate is fixed.**
- **Every card's belief text was decoration** (F34). 346 candidates carry a
  printed belief and not one had a mechanical hook, which is the answer to
  SIM-BRIEF's question *"what share of printed abilities ever change an
  outcome?"* — the answer was all of it. Hooks written for the cases the doc
  names by hand; printed text now fires in 4.12% of races. **A bug caught on
  the way in matters more than the feature**: the engine's `conditional`
  handler checked `state`, `round` and `office` and **ignored `identity`**, so
  an effect written as "a bonus in Catholic districts" fired in *every* race —
  61 times per 1000 before the fix, 9.75 after. Effects that ignore their own
  conditions are worse than no effects.
- **The veto had never been exercised** (F35). Not rarely — never, because
  every agent's `veto()` returned `false`. SIM-BRIEF lists it as a cut
  candidate on the theory that it is "only rational in split-government years,
  which may be rare". Implemented to §12's stated case, it fires 0.30 times a
  game and split government is 23% of games. **The brief's prior is right and
  the rule survives.**

**And one sweep result was false, which is the part to carry forward.** The
same pass reported the Fed firing 0.00 times a game. It fires in about five:
`interactiveTick` logged the Fed tightening and the headless `tick` did not, so
the sweep was reading an instrument that only one of two code paths wrote to.
Trusted, it would have put a confident false claim that §13's entire Fed
mechanism was dead into the section whose whole purpose is finding dead rules.
Both paths now log it. **A coverage sweep is only as good as the instrument it
reads, and a log written by one code path and not its twin is not an
instrument.**

## 3. Historical validation

**Run.** Real data: 9,555 House general elections 1976–2018 from the MIT
Election Lab constituency returns, and incumbent reelection rates 1946–2016
from *Vital Statistics on Congress* tables 2-7 and 2-8. Both are committed at
`data/historical/baseline.json` so the comparison is reproducible and does not
depend on my recollection — or on the brief's.

| target | real | sim | verdict |
|---|---|---|---|
| House incumbent reelection | **94.1%** (1976–2016) | 98.2% | **overshoots by 4.7 pts** (F37) |
| Senate incumbent reelection | **83.2%** | 91.8% | high |
| Uncontested House seats | **13.6%** | 93.5% | **fails badly** |
| Median House margin | **32.5 pts** | 8 pts | **fails badly** |
| Safe seats (40+ pts) | **37.5%** | **0.0%** | **cannot occur** |

The brief's recollection table checks out where it can be checked: it guessed
~90–95% for the House (actual 94.1%), ~80–90% for the Senate (actual 83.2%,
and far more variable — 55.2% in 1980), and ~10% uncontested (actual 13.6%).

**The margin distribution is the deepest test and the sim fails it in exactly
the way the brief predicted.** Full table in `FINDINGS.md` F8. The short version:
simulated margins are a unimodal blob crushed against zero, real ones are
bimodal with a large safe mass. The cause is a **scale ceiling**. A realistic
modifier stack is about +8 pips; at §3's rate of 1 pip = 2 points that is a
16-point margin, so a 40-point margin would need +20 pips and **the game's
modifier vocabulary cannot express it at any setting**. This is not a tuning
failure — no value of any existing constant reaches the real distribution.

One qualification in the design's favour: the game encodes a safe seat as an
*uncontested* race, where reality encodes it as a contested race won by forty
points. The two are partly the same phenomenon in different clothes, and
adjusting for it narrows the gap from 37.5%-vs-0% to roughly 46%-vs-93.5%
"effectively safe". It narrows; it does not close.

**Incumbency could not be measured at all until tonight** — see F9. Over 120
games, *zero* races had an incumbent, because winning a seat removed the card
from hand and nothing returned it, so no politician could ever stand for
re-election. §16 calls incumbency "a calibration check on +1"; that check had
been silently returning nothing. Fixed, and the rates above are the first real
measurement.

**They do not calibrate +1, and an earlier draft of this report said they did.**
Measured on House races alone the rate at +1 is **98.84%** against a real
94.10%, and +2 and +3 only walk it further up, to 99.37% and 99.66%. The figure
that lands on the benchmark — 94.05% — is pooled over every office below the
presidency, and comparing it to a House-only benchmark is what produced the
false match. Strip the walkovers and contested incumbents hold **78.18%**, so
the 98.84% is measuring how rarely anyone is challenged rather than what +1 is
worth. The check §16 asks for cannot be run until the contest rate is fixed.
See F37 and `findings/incumbency-calibration.ts`.

**Validated, and worth saying plainly:** §5's claim that the decline of
localism falls out of pack rotation with no rule at all. Mean home-state bonus
across my packs runs 2.96 → 1.85 → 1.84 → 1.62 for 1976 → 1992 → 2008 → 2016.

**A defect in my own card data:** heterodoxy does *not* decline across the packs
(37% → 44% → 40% → 42%) when it should collapse toward the handful of modern
survivors. The 1976 figure is defensible — liberal Republicans and conservative
Democrats genuinely existed — but the 2016 pack is over-tagged. This is an
authoring error, not a design finding, and it biases anything measuring
heterodoxy's value upward. Filed as hf7y/american-cycle#6.

## 4. Balance dashboard

**Skill signal** (40 games each, seats alternated, `tuned`). Both figures moved
once the presidency worked, because the earlier run was measuring a game with
five mechanics switched off:

| matchup | before | after | target | verdict |
|---|---|---|---|---|
| Greedy vs Random | 93% | **85%** | 65–80% | still high |
| Lookahead vs Greedy | 90% | **83%** | a few points | planning pays enormously |
| Greedy vs WideAndEmpty | 100% | **100%** | should be dead | **gating works** |

85% is still past SIM-BRIEF's band, but the direction is right and the cause is
now the contest rate (F6) rather than a switched-off layer.

**Wide-and-empty is confirmed dead** under both measurements — 0% in the round
robin, 0% head-to-head. District gating does exactly the job §5 claims for it.
This is the design's clearest success in the whole run.

**Seat bias** (all Greedy, n=300–400, `tuned`, 16 years):

| players | before | after | SIM-BRIEF bar |
|---|---|---|---|
| 3 | 4.3pp | **1.7pp** | 3pp |
| 4 | 11.5pp | **3.5pp** | 3pp |
| 5 | 14.3pp | **2.9pp** | 3pp |
| 6 | 13.6pp | **4.1pp** | 3pp |

Three bugs were manufacturing this, none of them in the rules. Resolving score
ties with `indexOf` handed every tie to the lowest seat (~25pp of phantom
bias). Refilling hands in seat order gave low seats every card when the talon
ran short. And — the one that took an ablation to find — `openRaces()` listed
House seats in seat order, so with a stable sort every tie resolved to player
0's districts; their seats drew the most declarations, lost most often to
capture, and **shed the most ballast**, which is an advantage because districts
are a liability (F21). Seat 0 scored 164 against seat 4's 143.

Fixed by sorting open races by state and district number. Three of four table
sizes now sit at or under the brief's 3pp bar, and the monotonic score gradient
is gone at every size. Full working in `FINDINGS.md` F25.

**Six-way round robin** (n=360; >40% is dominant, 2σ = 3.9pp):

| strategy | before the presidency fix | before the seat-order fix | now |
|---|---|---|---|
| EconomyChicken | 26.7% | 19.2% | **37.8%** |
| SenateFlood | 32.5% | **51.7%** | 31.7% |
| BillMaximizer | **40.0%** | 24.2% | 25.6% |
| HeterodoxSpecialist | 0.8% | 5.0% | 4.2% |
| HouseFarm | 0.0% | 0.0% | 0.6% |
| WideAndEmpty | 0.0% | 0.0% | 0.3% |

**Nothing is dominant.** The leader sits at 37.8% against a 40% line with a
3.9pp band — it touches without crossing.

**Read the three columns as a warning, not a history.** Each earlier column was
measured on a board with a bug in it: the first before the presidency worked
(five national mechanics switched off), the second before open races stopped
being listed in seat order. Every strategy's apparent standing moved by 15–20
points across those fixes, and **BillMaximizer's 40% and SenateFlood's 51.7%
were both artefacts.** Two ablations confirm the current position is not the
Senate's doing: zeroing its hand bonus moves SenateFlood 34.0%→31.3%, and
demoting it below the House in §10's priority moves it to 30.7%.

The general lesson for anyone tuning from this report: **a balance number is
only valid against the engine that produced it.** Three round robins here are
void and are shown only to make that visible.

**HeterodoxSpecialist at 4.2% remains the finding that should worry you most.**
Heterodoxy is one of the design's two theses — "the most valuable and most
fragile card in the game" — and it is second-worst on the board across every
engine version tested. On a map where 92% of races go uncontested there is no
hostile terrain to survive, because nobody is defending anything.

**EconomyChicken's rise to 37.8% is unexamined.** It is new since the seat-order
fix and no ablation has been run against it.

**The governorship is strong, and an earlier draft of this report had it dead.**
Winners and losers held governorships at 1.02× — exactly neutral — so it was
written up as an office nobody should plan around. That number was measured
against a field in which **nobody sought the line the office exists for**. §11
says governors "carry incumbency into Senate and presidential runs"; an agent
built around that — take governorships, then run those same cards for Senate —
changes the picture completely:

| field | governor advantage | Senate advantage |
|---|---|---|
| Lookahead + Greedy + HouseFarm + Random | **1.07×** | 3.55× |
| **Launchpad** + Greedy + SenateFlood + Heterodox | **2.39×** | 1.59× |

Same engine, same rules. The step-up converts a cheap office into an expensive
one, and the Senate's advantage falls correspondingly. `Launchpad` wins
**68–73%** of four-player games against a 25% fair share, and 26.7% of a
six-way round robin against stronger opposition — strong but not dominant,
which is a healthy shape for a strategic line.

Odd-year governorships are not the source. KY, LA, MS, NJ and VA elect in odd
years and those races had never run at all — `openRaces()` computed them and
`tick()` only held elections in even years, so 1,039 governor races resolved in
even years and **0 in odd.** Implemented behind `game.oddYearGovernors` they
raise governorships held by 45%, but Launchpad wins *more* with them off
(72.8% against 68.3%). The step-up is the whole line.

**The general lesson is the one to keep.** A "dead" measurement is a claim
about the agents, not about the design. The governorship joins incumbency, the
presidency, the veto, the bill counters and the card text on the list of things
that measured dead — with the difference that those five were *unimplemented*
and this one was merely *unplayed*. **A simulator can only find the strategies
its agents already know.** See F36.

---

## 5. Sweeps

All ten now run. Eight were deliberately skipped earlier in the night on the
grounds that they measured noise on an uncontested board; that was right at the
time and wrong afterwards, because F10 and F13 turned five dead mechanics back
on. **Any sweep taken before those fixes was measuring a different game.**

### Incumbency: +1 is NOT calibrated, and this sweep is why.

§16 calls incumbency "a calibration check on +1". **The check cannot be run on
this board, and the first reading of this sweep said it passed.**

| incumbency | simulated House reelection | real House 1976–2016 |
|---|---|---|
| **+1** | **98.84%** | **94.10%** |
| +2 | 99.37% | |
| +3 | 99.66% | |

The earlier draft reported +1 at 93% and called a one-point match "the design's
best single number". **That 93% was the rate pooled over every office below the
presidency** — Senate and governorships averaged in — **reported against a
House-only benchmark.** `sim/sweeps-full.ts` computes the pooled rate; the
finding read it as a House rate. F9 already had the right number, reporting
"representative 98.2%", so this file held two incompatible figures for six
findings and the sweep quoted the wrong half.

**+1 overshoots by 4.7 points and raising it makes that worse**, so the sweep's
direction was right and its conclusion was not. There is no setting of this
modifier that lands on reality, because the modifier is not what sets the rate:
strip the walkovers and contested incumbents hold **78.18%**. An unopposed
incumbent always holds, so at 92% walkovers the reelection rate is a
measurement of F6 wearing incumbency's clothes. See F37, and
`findings/incumbency-calibration.ts`, which reports all three populations side
by side because a predicate has to name which one it measures.

### The threshold sweep, and why it is the smaller of the two levers.

| Senate threshold | bills pass | cross-bench votes/game |
|---|---|---|
| 50% | **63%** | 52 |
| **60%** (current) | **16%** | 47 |
| 67% | **0%** | 50 |

SIM-BRIEF's stall line is 20% and the current 60% sits below it, which is what
the first reading of this table called "the filibuster stalls the bill". **That
was one variable swept, at a fixed agent mix.** Holding the threshold at 60%
and varying only who is playing moves passage **14% to 100%** — a wider range
than the whole threshold sweep produced (F27). So the 16% is a property of my
agent pool, not of the design.

Cross-benching is roughly constant across the three rows above, so players are
already reaching across at every threshold. That is §12's intent — *"bills
essentially cannot pass without cross-benching"* — **working as written**, not
failing. What the simulator cannot supply is the cooperation, because no agent
here can negotiate, offer anything or remember a favour.

**Do not change this on simulation alone**, and now not on this evidence at
all: it points the other way. The sweep gives the shape; a table gives the
answer. See `findings/bill-passage-is-the-table.ts`.

### The midterm brake does not bind, and raising it barely helps.

| midterm penalty | president's party loses |
|---|---|
| −1 | 13% |
| −2 (current) | 16% |
| −3 | 19% |
| −4 | 19% |

Reality: the president's party lost House seats in **19 of the last 21**
midterms. The sim's president loses 16% of his midterm races and doubling the
penalty moves that by three points. The brake §16 is counting on is not
braking — and the reason is F6 again, since a modifier cannot punish anyone in
a race nobody contests.

### Hand size raises contest, and cannot answer game length here.

| base hand | contested | determination | lead changes |
|---|---|---|---|
| 8 | 23% | 44% | 2.1 |
| 12 | 30% | 32% | 1.6 |
| 16 | 34% | 22% | 1.0 |

Contest rises monotonically with hand size, exactly as F6's ratio predicts, and
the live predicate says the same on the current engine at wider spacing: 35.8%
contested at hand 8, 42.9% at 16, 51.2% at 24 — **every point below
SIM-BRIEF's 60% floor** (`findings/contest-ratio.ts`).

**Two columns of that table are void.** The determination and lead-change
figures were taken with the per-game proxy F18 retired; read the runaway from
the sweep above, not from here. And **game length is not measurable from this
sweep either** — every row returns 16 years because `maxYears` caps it, so the
deck-out ending never arrives. That question needs the cap lifted and is not
answered here.

### The runaway is real, and the hand bonus is not what causes it.

An earlier draft of this sweep acquitted the runaway outright, on a per-game
determination proxy and a "comeback rate" that counted any game containing a
lead change. Both are the wrong metric. SIM-BRIEF defines determination as a
**cross-game curve** — at each year, the share of games where the current
leader is the eventual winner, reported as the first year that share exceeds
80% — and comeback rate as the share of games won by a player who was **last at
the halfway mark**. Re-measured to those definitions, 120 games each:

| presidency hand bonus | determination | comeback | lead changes |
|---|---|---|---|
| 0 | 44% | **1%** | 1.3 |
| 2 (current) | 38% | **0%** | 1.1 |
| 4 | 50% | **1%** | 1.0 |

Healthy determination is 75–85% of the way through. This is 38–50%: the winner
is settled around the halfway mark, and the year-by-year curve shows the lock
starting immediately — `54 57 68 68 73 73 80 81 85 86 90 90 90 90 100 100`. **In
year one the eventual winner is already leading 54% of the time**, against 25%
for a four-player coin flip, and **the comeback rate is 1%.**

**What survives is the narrower result**, and it is the one that matters for
tuning: determination does not trend across bonus 0→4 and the Senate bonus
sweep is flat, so §16's suspects are innocent and the presidency bonus can be
raised for flavour without buying a runaway. What buys it is that nothing in
the design can take a point away — see change 4, F18 and F22.

### Fed dice: both playable, 2d6 keeps the chicken live.

2d6 produces 2.0 rate rises a game against 3d6's 1.2. The tighter curve keeps
the spend-and-pivot decision frequent enough to matter. **Keep 2d6.**

### Already reported above

District supply (finding #2) and the decay/push pairing (finding #1) are in §1.

---

## 6. Pathologies, with seeds

| pathology | reproduce |
|---|---|
| map cannot realign — annual decay at §10's printed 0/1/2 | `node sim/harness.ts --config as-written.json --games 20` |
| the same annual decay, rescued by a 2/3/4 push table | `node sim/harness.ts --config as-written-plus.json --games 20` |
| flat push moves nothing | `node sim/harness.ts --config flat-push.json --games 20` |
| presidency never contested | `node sim/roundrobin.ts tuned.json 40` |
| solitaire board | `node sim/sweeps.ts` — every row |
| bill stall | seeds 31000–31149, `tuned`, 16% of 2,250 |

All engine invariants are asserted rather than described: the odds table
against 800k simulated races, the withdrawal window against the wave's own
roll counter, decay-before-push on every state, and governors never pushing.

### The findings are executable, and they expire

The numbered findings in `FINDINGS.md` are prose, and prose does not know when
it has stopped being true — this report has had to correct eight of its own
claims to establish that. The load-bearing ones are now **predicates** under
`findings/`, one module each. A finding carries the design-doc question it
answers, a `predicate()` that re-derives its claims from scratch with no cached
numbers, a `verdict()` evaluated fresh on those claims, and a prose `headline`
that is explicitly *a stamped snapshot* — true as of `stampedAt`, on the engine
named in `stampedOn`, and no later.

`node sim/findings.ts` re-runs every predicate and grades it:

| grade | meaning |
|---|---|
| **HOLDS** | the predicate still returns what the headline claims |
| **STALE** | the engine moved. The headline is now historical and the predicate is the current truth — information, not an error |
| **BROKEN** | the predicate could not run at all |

`--restamp` rewrites the stamped values and the date in place, and is the only
sanctioned way for a headline to change. **One rule beyond that:** a finding
that recommends a shipped config must declare it in `dependsOn` and *check* it
— read the file from disk as a zero-tolerance claim — and
`findings/well-formed.test.ts` fails any finding that names a dependency it
does not read back. `decay-push-tradeoff.ts` asserts that `as-written-plus.json`
still ships the 2/3/4 push table and annual decay it selects, so the config
cannot outlive its evidence.

This is also what caught F37. Converting the incumbency prose to a predicate
forced it to name which population it was measuring, and naming it exposed that
the prose never had. **A sentence can hold two incompatible numbers for six
findings; a function cannot.**

---

## 7. What I could not test, and why

**Historical validation is now run** — see §3. It was deferred earlier in this
report on the grounds that grading a sim against reality is meaningless while
the board is uncontested. That reasoning was half right: the incumbency
comparison is indeed uninterpretable until races are contested, but the margin
distribution is not, and it produced the single most decisive finding of the
night (F8, a scale ceiling no tuning can reach). **Deferring it was the wrong
call and the earlier draft of this section said so too confidently.**

**Now implemented and measured** (they were listed here as gaps earlier in the
night and have since been built):
- **Impeachment** is wired as an omnibill replacement, and **the vice
  presidency** exists — second card, not consumed on a loss, home-state bonus
  in the general, succession with the supplier's player scoring. `VPBackstab`
  is now a real agent. The result is F12: the backstab sets itself up in 100%
  of games and can never be cashed, because two-thirds of the Senate is
  arithmetically out of reach. **This is the finding most in need of a human
  playtest**, and the threshold should not be lowered on agent evidence.
- **Incumbency**, which had never fired in any race at all (F9).
- **The presidency and its five downstream mechanics** (F10).

**Also since built and measured** (F13): endorsement tapping, independent
candidacies, and governor Senate appointments. All three were on the brief's
dead-rule list and all three were firing at 0% because they were unimplemented.
Endorsements now appear in 32% of primaries and the endorsed candidate wins
72%; independents win 39% of *contested* generals; governors make roughly
twelve appointments a game.

**And three more, found by coverage sweep rather than by noticing** (F33, F34,
F35): §12's card counters, which had no electoral consequence at all;
`may_endorse` and `conditional` card text, which was decorative on every one of
346 candidates and whose handler ignored its own `identity` condition; and the
veto, which no agent had ever exercised. All three are live and written up in
§2. The veto in particular vindicates the brief's own prior — it is rare
because split government is rare (23% of games), not because it is priced
wrong.

**Nothing on this run's evidence should be cut.** Every rule that looked dead
was dead upstream, and the audit's real finding is about the harness rather
than the design.

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
