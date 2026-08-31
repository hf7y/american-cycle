# American Cycle — overnight simulation report

**2026-08-31.** Engine at `phase1-engine`, 31 tests green, clean typecheck.
Four era packs (1976/1992/2008/2016): 232 real candidates, 168 real districts.
Eleven scripted agents, §6's pack-pass draft, and every mechanic in the design
doc implemented. Every figure below is reproducible from its seed.

A caution up front, in the brief's own spirit: this run found the design's
problems faster than it found its numbers. Several sweeps that were supposed to
tune constants instead hit structural issues that make the constants moot until
they are fixed. That is reported as it happened rather than smoothed over.

**And a caution about this report.** Four of my own numbers had to be corrected
during the night, each time because a convenient proxy had been measured
instead of the metric SIM-BRIEF specifies — decision density (declarations made
rather than legal moves available, which *inverted* the conclusion), the
runaway metrics (per-game proxies rather than cross-game curves, which also
inverted it), the independents win rate (walkovers included), and the seat bias
(two harness bugs manufacturing ~25pp that was not there). Every headline
figure below has since been re-measured on the current engine. The brief's own
instruction — *"assume the instrumentation is wrong before assuming the design
is right"* — was correct four times out of four, and the corrections are kept
visible in `FINDINGS.md` rather than quietly overwritten.

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

Ranked by confidence. Every figure is reproducible from its seed; the twenty
numbered findings behind them are in `FINDINGS.md`.

**Read the ordering as a claim about causation, not just severity.** Change 2
is one root cause behind four separate failing metrics — contest rate, decision
density, realignment, and dead turns — so it buys more than its position
suggests. Changes 3 and 4 are independent of it and of each other.

### 1. Decay must be biennial. Annual makes realignment impossible. *Applied.*
**Metric** lean in one state after ten consecutive blowout cycles.
**Observed** annual decay pins the map at 2 pips, forever, at any margin.
**Target** a state repeatedly won decisively reaches a durable 4+ lean.
**Change** `lean.decayFrequency: "biennial"`, already applied to every config.

§16 calls this the question that "decides whether realignment is possible at
all" and asks for simulation. It needs none — annual decay removes 2 pips a
cycle against a maximum push of 2, so total dominance nets exactly zero. Only
biennial decay with margin-based pushes accumulates.

Confidence: **certain**. It is arithmetic, and it is a passing test.

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
**Observed** determination **50%** of the way through (healthy 75–85%); comeback
rate **0–1%**; the leader's margin over second place **doubles** across the
second half, from 26 to 51; and **100% of player-scores never decrease**.
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
**Observed** SenateFlood 40.8% against SIM-BRIEF's 40% dominance line — down
from 51.7% once §6's draft let opponents compete for Senate-capable cards, and
still on the line. Bills
pass **20%** at the current 60% Senate threshold, against a 20% stall line —
and 63% at a 50% threshold, 0% at 67%.
**Change** for the Senate: it pays four ways at once — points, a six-year term,
hand size, and the midterm lean push it inherits from §10's priority ordering.
Governor appointments are a fifth route in. For the bill: the threshold shape
is unambiguous, but **do not change it on this evidence** — the omnibill is a
negotiation and no agent here can negotiate.

Confidence: **high** on both measurements, **low** on the bill remedy.

---

### What is already working

Most of this report is problems, so the successes are worth naming: district
gating kills wide-and-empty stone dead (0% win rate, 100% loss head-to-head);
**+1 incumbency reproduces reality within a point** (93–94% against 94.1%); the
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
| veto | never (no president) | live |
| honeymoon | never (no president) | live |
| Fed rate rise | 44% of games | unchanged, load-bearing |
| incumbency | **never, in any race** (F9) | live, House 98.2% |
| endorsements | never spent | 32% of primaries, 72% win |
| independent candidacies | no pack held one | 39% of contested generals |
| governor appointments | never | ~12 a game |
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

## 3. Historical validation

**Run.** Real data: 9,555 House general elections 1976–2018 from the MIT
Election Lab constituency returns, and incumbent reelection rates 1946–2016
from *Vital Statistics on Congress* tables 2-7 and 2-8. Both are committed at
`data/historical/baseline.json` so the comparison is reproducible and does not
depend on my recollection — or on the brief's.

| target | real | sim | verdict |
|---|---|---|---|
| House incumbent reelection | **94.1%** (1976–2016) | 98.2% | high, but see below |
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
measurement. They still cannot calibrate +1, because 93.5% of House races are
walkovers and an unopposed incumbent always holds.

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

**Six-way round robin** (120 games; >40% is dominant):

| strategy | before the presidency fix | after |
|---|---|---|
| SenateFlood | 32.5% | **51.7% — DOMINANT** |
| BillMaximizer | 40.0% | 24.2% |
| EconomyChicken | 26.7% | 19.2% |
| HeterodoxSpecialist | 0.8% | 5.0% |
| WideAndEmpty | 0.0% | 0.0% |
| HouseFarm | 0.0% | 0.0% |

**SenateFlood is a genuine hole.** The Senate pays four ways at once: three
points a seat, a six-year term that holds them, +1 hand size, and — because §10
puts the Senate second in the nationalisation priority, behind only the
presidency — the push that moves the map in every midterm. Nothing else on the
board pays four ways. Filed as hf7y/american-cycle#8.

Note what the "before" column means: **BillMaximizer's 40% was an artefact of
five switched-off mechanics.** Any balance number taken before F10 is void.

**HeterodoxSpecialist at 5.0% is still the finding that should worry you most.**
Heterodoxy is one of the design's two theses — "the most valuable and most
fragile card in the game" — and it is the second-worst strategy on the board.
On a map where 79% of races go uncontested there is no hostile terrain to
survive, because nobody is defending anything.

---

## 5. Sweeps

All ten now run. Eight were deliberately skipped earlier in the night on the
grounds that they measured noise on an uncontested board; that was right at the
time and wrong afterwards, because F10 and F13 turned five dead mechanics back
on. **Any sweep taken before those fixes was measuring a different game.**

### Incumbency: +1 is correctly calibrated. Keep it.

§16 calls incumbency "a calibration check on +1". It passes.

| incumbency | simulated reelection | real House 1976–2016 |
|---|---|---|
| **+1** | **93%** | **94.1%** |
| +2 | 96% | |
| +3 | 97% | |

A one-point match against the real rate, from a modifier chosen before any of
this was measured. This is the design's best single number.

### The filibuster is what stalls the bill, and the shape is unambiguous.

| Senate threshold | bills pass | cross-bench votes/game |
|---|---|---|
| 50% | **63%** | 52 |
| **60%** (current) | **16%** | 47 |
| 67% | **0%** | 50 |

SIM-BRIEF's stall line is 20%. The current 60% sits below it; 50% puts passage
at 63%, comfortably inside a working range. Note that cross-benching is roughly
constant across all three — **players are already reaching across; the bar is
simply too high for it to matter.** §12's intent, that 60% "forces cooperation",
is half-achieved: it forces the attempt and then refuses the result.

**Do not change this on simulation alone.** The bill is a negotiation and no
agent here can negotiate. The sweep gives the shape; a table gives the answer.

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

Contest rises monotonically with hand size, exactly as F6's ratio predicts.
**Game length is not measurable from this sweep** — every row returns 16 years
because `maxYears` caps it, so the deck-out ending never arrives. That question
needs the cap lifted and is not answered here.

### The runaway the design fears is not there.

| presidency hand bonus | determination | lead changes | comeback rate |
|---|---|---|---|
| 0 | 29% | 1.2 | 67% |
| 2 (current) | 30% | 1.5 | 77% |
| 4 | 30% | 1.6 | 87% |

§16 asks whether hand size, endorsements and capture stack into a runaway.
**They do not, at any setting tested.** Determination is flat near 30% — the
leader at 30% of the way through is not reliably the winner — and comebacks
become *more* common as the bonus grows, not less. The Senate bonus sweep is
flat too (determination 26–32% across 0–2).

This is a genuine acquittal of one of the design's stated worries, and it points
the tuning elsewhere: the presidency bonus can be raised for flavour without
buying a runaway.

### Fed dice: both playable, 2d6 keeps the chicken live.

2d6 produces 2.0 rate rises a game against 3d6's 1.2. The tighter curve keeps
the spend-and-pivot decision frequent enough to matter. **Keep 2d6.**

### Already reported above

District supply (finding #2) and the decay/push pairing (finding #1) are in §1.

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
