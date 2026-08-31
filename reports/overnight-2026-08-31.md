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

### 3. Safe seats cannot exist — the pip scale has a ceiling.
**Metric** distribution of House margins, sim against 9,555 real races 1976–2018.
**Observed** median 8 points against a real 32.5; safe seats (40+ pts) are
**0.0% of simulated races and 37.5% of real ones**.
**Target** the real distribution is bimodal — a thin competitive middle and a
large safe mass. SIM-BRIEF calls this the deepest test.
**Change** decide what a safe seat *is* in this game, then make the scale match.

This is arithmetic, not tuning. A margin is the modifier difference plus
3d6 − 3d6. Mean stack depth is 2.43 entries of 1–3 pips, so a large realistic
stack is +8 pips — a 16-point margin at §3's rate. **A 40-point margin needs
+20 pips and the game's entire vocabulary cannot express it at any setting.**

One qualification in the design's favour: the game encodes a safe seat as an
*uncontested* race, where reality encodes it as a contested race won by forty
points. Adjusting for that narrows the gap from 37.5%-vs-0% to roughly
46%-vs-93.5% "effectively safe". It narrows and does not close. Either accept
that a safe seat *is* a walkover and stop comparing margins to reality, or
widen the scale so a locked district can print a modifier that locks it.

Confidence: **certain** on the ceiling, **open** on which way to resolve it.

**(The presidency finding that stood here has been fixed — see §2 and F10.)**

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
