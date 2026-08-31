# Findings — american-cycle

Running list. Each entry names the metric, what was observed, and the change.
Ranked by confidence, newest analysis folded in as it lands.

---

## F1. The §3 odds table was wrong. CONFIRMED, fixed.

**Observed.** v0.2 printed 5% a pip with +4 at 75%, and claimed the linear rule
tracked the true distribution within two points out to +6. The exact odds for
3d6 − 3d6 with ties broken evenly are 59/68/76/82/88/92 at +1…+6. The table was
off by 7.5 points at +4.

**Cause.** 5%-a-pip implies a spread of about 5.9 pips. §3 itself states the
correct SD of 4.18, so the prose and the table disagreed with each other.

**Change.** Zach confirms the dice are correct and the table was the error.
`design-doc.md` §3 now carries exact values and a corrected rule of thumb —
*nine points a pip out to +3, where you are three-in-four*. Asserted in
`engine/rules/resolution.test.ts` against both the closed form and 800k
simulated races.

**Consequence for play.** The game is more deterministic than the doc believed.
An 8-point lead is 82%, not 75%. Design intent ("not a lock") survives, but
modifiers matter more and dice matter less than the design assumed.

---

## F2. Only one decay/push pairing permits realignment. CONFIRMED, settled.

§16 calls decay frequency the question that "decides whether realignment is
possible at all" and asks for simulation. It does not need simulation — it is
arithmetic, and it falsifies three of the four candidate settings.

Lean in one state, after ten consecutive cycles won by 12-point blowouts:

| decay | push | result |
|---|---|---|
| annual | flat +1 | pinned at 1 |
| annual | margin-based | **pinned at 2** |
| biennial | flat +1 | pinned at 1 |
| biennial | margin-based | 2→3→4→5→6→7→8 ✓ |

**Why.** Annual decay removes 2 pips a cycle. The maximum margin-based push is
2. Sustained total dominance therefore nets exactly zero, and the map pins at
the size of a single push forever. No margin, however large, escapes it,
because the push table caps at 2.

§7 half-suspected this — "only outright blowouts move the map at all" — but it
is worse than that reading: under annual decay blowouts do not move the map
*at all* beyond the first push. There is no accumulation.

**Change.** Baseline is now `decayFrequency: "biennial"`. This is an open
question answered with a proof rather than a guess, so it is recorded here
rather than quietly set. Proof in `engine/rules/lean.test.ts`.

**Still to test by simulation.** Whether biennial + margin-based produces
realignment on a *realistic* distribution of margins rather than forced
blowouts — real races are mostly squeakers, which push 0. F2 shows the ceiling
is reachable in principle; it does not show it is reached in play.

---

## F3. The presidency is never contested. CONFIRMED.

**Observed.** Over 10 four-player games: 2,750 presidential state races, **0%
contested**, and only 3 presidential primaries. One player seeks the nomination
or nobody does, and the nominee then walks all 50 states.

**Cause.** An edge-ranking agent scores a race by its modifier stack. The
presidency is run in states where the candidate usually holds no district card
and is not native, so its edge is ~0, while a House seat with district synergy
and a home-state bonus scores +4 or more. Rational edge-greed therefore never
runs for president.

**Why it matters beyond the agents.** The presidency is the *only* source of
the midterm penalty, coattails, the honeymoon, the veto, and the economy's
national modifier. With it unfilled, five of the design's national mechanics
never fire at all — a dead-rule cascade from a single unattractive race.

**Proposed change.** Price the office, not the race. The presidency pays 5
points and +2 hand, and it is the only office that grants an endorsement worth
+3 in every primary. Either agents must value offices rather than edges, or the
nomination needs a draw the board can see — the natural one being that the
national primary is run *across every state you hold*, so accumulated presence
converts into a presidential edge rather than being irrelevant to it.

---

## F4. Down-ballot play is 79% uncontested — the game is solitaire in parallel. CONFIRMED.

SIM-BRIEF sets the bar at 40%. Measured across 10 four-player games, excluding
the presidency:

| office | races | contested |
|---|---|---|
| senator | 583 | 12% |
| representative | 193 | 6% |
| governor | 75 | 7% |
| **down-ballot total** | **967** | **21%** |

Every primary that occurs is contested by construction, and Senate primaries
(97) are where players actually meet.

**Cause, quantified.** At year 8 of a four-player game: **153 open races
against 28 declarations.** Players never meet because there is five times more
board than there are cards to put on it. 23 of 35 states had presence from more
than one player, so collision was *available* and simply not worth taking.

**A contributing bug, now fixed.** Districts were drawn without counting
against hand size, so players accumulated 21–31 of them each and presence was
free. §5 says "presence is scarce and must be purchased in the draft"; hand
size now caps total cards held, candidates and districts together. This also
fixed a deck-out that was ending games at year 7 of 24.

**Still open.** The ratio is a design question, not a bug: it is §16's
district-to-candidate question and SIM-BRIEF's district sweep. Being worked.

---

## F5. An uncontested win pushes no lean, so the map never moves in play.

F2 proved realignment is *reachable* under biennial decay and margin-based
pushes. It is not *reached*: mean absolute lean across all states at game end
is 0.005, and no state ever hits the 4-pip durable threshold.

**Cause.** A one-sided race has no margin, so it pushes 0. With 79% of races
uncontested, almost nothing pushes. The design never says what an uncontested
win does to a state's lean — §10 only scales the push "by how decisively the
race was won", and a walkover has no margin at all.

**Placeholder in force:** uncontested ⇒ no push, on the reading that a race
nobody tested tells you nothing about the state. Flagged, not decided. Note the
alternative reading — that running unopposed *is* the most decisive result
possible — points the opposite way and would move the map a great deal.

This finding is downstream of F4. Fix the contest rate and this may resolve
itself; it is recorded separately because the rule gap is real either way.

---

## F6. Contest rate is a ratio, and the design's own numbers put it at 1:5. CONFIRMED.

This is the most important finding of the night and it supersedes F4's framing.

**The mechanism.** A player contests a race only when they choose it *and* an
opponent does. Each player picks `hand` races out of `eligible` ones, so the
expected overlap — and therefore the contest rate — is governed by

> **cards per player ÷ eligible races per player**

Measured at year 6 of a four-player game: each player had **~60 eligible races
and 4–10 cards.** Overlap was not the constraint; 66% of races were eligible to
more than one player. There is simply five times more board than there are
cards to put on it, so everyone farms their own territory.

**Measured surface** (8 seeds each, share of race-slots drawing declarations
from more than one player; SIM-BRIEF wants this above 60%):

| players | hand | district supply | contested | states realigned | years |
|---|---|---|---|---|---|
| 2 | 12 | 0.15 | 10% | 0.0 | 24 |
| 2 | 20 | 0.06 | 20% | 0.1 | 15 |
| 4 | 12 | 0.15 | 23% | 0.1 | 14 |
| 4 | 20 | 0.06 | 44% | 1.1 | 7 |
| 6 | 12 | 0.15 | 40% | 0.9 | 9 |
| 6 | 20 | 0.06 | **63%** | 1.5 | 5 |

**Three things fall out of this table.**

1. **Two-player is structurally broken.** At 10–20% contest it is two solitaires
   sharing a scoreboard. The design says 2–6 players; 2 does not work at any
   setting tested.
2. **Contest and game length trade off directly.** Everything that makes players
   fight also burns cards, and the talon empties. The 63% row lasts five years.
3. **Realignment only appears once players fight.** Every row with a realigned
   state is a row above 40% contest. F2 proved realignment was *reachable*;
   this shows what actually reaches it. The two theses the design argues —
   earned realignment, and valuable heterodoxy — both depend on a contest rate
   the current numbers do not produce.

**Proposed change, in order of confidence.** Cut district supply hard (it is
§16's open question and the doc already says it "sets the tempo of the whole
game"); raise base hand size above 12; and scale the card pool with the table,
since a six-player game at hand 20 holds 120 cards before a single refill.

## F7. Office hand bonuses cannot be per seat. CONFIRMED, fixed.

§6 and §11 print "Senate +1, presidency +2" without saying whether that is per
seat held or per office held. Read per seat it is a runaway: players were
holding 28 seats each, drawing 40 cards a cycle, and exhausting the talon —
game length collapsed from 24 years to 7.

The doc's own arithmetic settles it. §16 says "base 12 with president +2 is a
17% edge", and 2/12 is 17% only if the +2 is a one-off. Implemented per office
held, and flagged in the config placeholders.

---

## F8. The margin distribution is the falsification the brief predicted. CONFIRMED.

SIM-BRIEF calls this "the deepest test", and names the failure in advance: *"If
the sim produces a unimodal blob centered near zero, then district gating and
lean counters are not doing the work the design claims, and the whole '1 pip =
2 points' calibration is decorative."*

That is what it produces. Real data is 9,555 House general elections 1976–2018
(MIT Election Lab); sim is 120 four-player games on `tuned`, margins converted
at §3's rate of 1 pip = 2 points.

| \|margin\| | sim | real |
|---|---|---|
| 0–4 | 35.2% | 6.8% |
| 5–9 | 24.8% | 6.6% |
| 10–19 | 32.6% | 15.0% |
| 20–29 | 7.4% | 17.0% |
| 30–39 | **0.0%** | 16.9% |
| 40–49 | **0.0%** | 12.9% |
| 50–59 | **0.0%** | 6.4% |
| 60–79 | **0.0%** | 6.5% |
| 80–100 | **0.0%** | 11.7% |

Median simulated margin **8 points against a real 32.5**. Competitive races
(under 10 points) are 60% of the sim and 13.5% of reality. **Safe seats — 37.5%
of real races — are 0.0% of simulated ones.**

**The cause is a scale ceiling, and it is arithmetic.** A margin is the
modifier difference plus 3d6 − 3d6. Mean stack depth is 2.43 entries worth 1–3
pips each, so a large realistic stack is +8 pips. At 1 pip = 2 points that is a
16-point margin. **A 40-point margin needs +20 pips of modifier, and the game's
entire vocabulary cannot express it.** No tuning of the existing numbers
reaches the real distribution, because the numbers do not go that high.

**One honest qualification, in the sim's favour.** The game encodes a safe seat
as an *uncontested* race, where reality encodes it as a contested race won by
forty points — a hopeless challenger still files. So the sim's 93.5% uncontested
pile and reality's 37.5% safe mass are partly the same phenomenon wearing
different clothes. Combining reality's uncontested (13.6%) with its safe-but-
contested share gives roughly 46% "effectively safe", against the sim's 93.5%.
The gap narrows and does not close.

**What to do.** Either accept that the design models only the competitive
tail and that a safe seat *is* a walkover — in which case the pip scale is fine
and the margin distribution should never be compared to reality — or widen the
scale so a locked-down district can print a modifier that actually locks it
down. The current position is the worst of both: §3 claims a calibration to
"the real dispersion of district results", and the sim's dispersion is a
quarter of it.

## F9. Incumbency had never fired. In any race. CONFIRMED, fixed.

Measured incumbent reelection over 120 games: **0 races**. Not a low rate — no
race in the entire corpus had an incumbent.

**Cause.** Winning a seat removes the card from the holder's hand, and nothing
ever put it back, so no politician could stand for re-election. §11 says seats
are held for their real terms and the member may then run again; that second
half was unimplemented.

This silently voided §16's *"incumbency is a calibration check on +1"*, and
every earlier run in this report that touches incumbency was measuring a
modifier that never applied.

**Fixed:** a member whose term is up returns to their player's hand and may be
re-declared into the same seat, or run somewhere else. With that in place:

| office | sim | real 1976–2016 |
|---|---|---|
| representative | 98.2% | 94.1% |
| senator | 91.8% | 83.2% |
| governor | 96.1% | — |

Both run high, but **this is not yet evidence that +1 is too large.** 93.5% of
House races are walkovers, and an unopposed incumbent always holds. The +1
cannot be calibrated until F6 is fixed and incumbents are actually challenged.

---

## F10. District cards never applied to presidential races. CONFIRMED, fixed.

§5 is explicit: *"A district card boosts House, Senate, governor, and
presidential runs in its state. It is an investment in a state, not just a
seat."* The presidential clause was unimplemented. The general runs state by
state, but every nominee entered each state with no district card attached, so
presence bought nothing at the top of the ticket.

That is the mechanical root of F3. An agent scoring a race by its stack saw the
presidency at edge **0.0** against a House seat at **+5**, so only an agent
valuing the *office* rather than the *race* ever ran — one of four. With a
single nominee, all fifty state races were walkovers, and the presidency was
0% contested across 2,750 races.

**Fixed**, plus the matching agent correction: the presidency is not run in a
place, so its edge cannot be read off one board square. Agents now value it by
the mean edge across the states they actually hold.

| | before | after |
|---|---|---|
| presidential generals contested | 0.0% | **20.4%** |
| presidential primaries | 3 in 10 games | 47 in 60, all contested |

**The dead-rule cascade is resolved.** The five mechanics that fired in zero
races now fire in every game — midterm penalty 63.5 times a game, coattails
52.6, economy modifier 51.3. F3's cascade was real and is closed; the veto and
honeymoon are live for the first time.

## F11. With the presidency alive, SenateFlood is dominant at 51.7%.

SIM-BRIEF: *"Any agent above 40% in a six-way round robin is dominant and the
design has a hole."*

| strategy | before F10 | after F10 |
|---|---|---|
| SenateFlood | 32.5% | **51.7%** |
| BillMaximizer | 40.0% | 24.2% |
| EconomyChicken | 26.7% | 19.2% |
| HeterodoxSpecialist | 0.8% | 5.0% |
| WideAndEmpty | 0.0% | 0.0% |
| HouseFarm | 0.0% | 0.0% |

Flooding the Senate now collects four rewards at once: three points a seat, a
six-year term that holds them, +1 hand size, and — because §10 puts the Senate
second in the nationalisation priority, behind only the presidency — **the push
that moves the map in every midterm**. Nothing else on the board pays four
ways.

This is a genuine hole and it appeared only once the presidency worked, which
is worth noting on its own: **the earlier round robin was measuring a game with
five mechanics switched off**, and BillMaximizer's 40% was an artefact of that.

Fixing the presidency also improved the skill signal, from 93% to **85%**
(Greedy vs Random), and the planning premium from 90% to 83%. Both remain above
SIM-BRIEF's 65–80% band, but the direction is right and the cause is now the
contest rate (F6) rather than a switched-off layer.

**Heterodoxy is still near-dead at 5.0%**, up from 0.8%. It remains the finding
that should worry most, for the reason in F6: on a board where 79% of races go
uncontested there is no hostile terrain to survive.

---

## F12. Impeachment is unreachable, so the VP backstab is inert. CONFIRMED.

SIM-BRIEF asks for this one by name: *"The design accepted it on the theory
that impeachment's party penalty is a sufficient brake. Test that theory rather
than trusting it."*

**The theory is untested, because a stronger brake sits in front of it.**

Both mechanics are now implemented — §12's impeachment (two-thirds of the
Senate, replaces the omnibill, the president leaves the game entirely) and
§11's vice presidency (a second card, not consumed on a loss, succeeding on a
vacancy with the *supplier's* player scoring). Measured over 80 games with a
`VPBackstab` agent and an `Impeacher` agent at the table:

| measure | value |
|---|---|
| games where a VP was seated on a ticket | **100%** |
| median opposition share of the Senate | 47% |
| p90 opposition share | 58% |
| maximum ever observed | 73% |
| games where the opposition ever reached two-thirds | **9%** |
| impeachments that actually occurred | **0** |

The backstab sets itself up perfectly and can never be cashed. A president's
party holds the Senate roughly half the time *because* they won the presidency,
so removal requires most of his own party to defect — and §12 says plainly that
for impeachment "cross-benching is not incentivized the same way". The design
removed the incentive to cross, and the two-thirds bar then makes the coup
arithmetically unreachable.

**So the party-wide penalty is not doing the work the design credits it with.**
It has never once been applied. If the backstab is ever to be a real threat,
the bar has to come down or defection has to pay; if it is not meant to be a
real threat, then the VP's bargaining role — which §11 calls "its real
function" — has nothing to bargain over.

**This is the finding most in need of a human playtest, and the brief says so.**
Everything here was measured against agents that vote the party line. §12's
impeachment is a negotiation — a coalition assembled at the table, against a
president people are actually annoyed with. A table might well produce the
cross-party defections no scripted agent will. **Do not lower the two-thirds
threshold on this evidence.** Play it with people first.

**Round-robin note, so the numbers are not misread.** Swapping `VPBackstab`
and `Impeacher` into the six-way round robin flattens it — top strategy 20.0%,
bottom 9.2%, nothing dominant. That is **not** evidence that SenateFlood's
51.7% dominance was resolved: the agent set changed, and the two strategies
removed (`WideAndEmpty`, `HouseFarm`) were both winning 0% and functioning as
free wins for everyone else. The two round robins are not comparable.

---

## F13. The last three unbuilt rules are live, and none of them should be cut.

SIM-BRIEF's dead-rule list named all three as cut candidates. All three were
firing at 0% because they were **unimplemented**, not because they were
unwanted — the same trap as F9 and F10.

**Endorsements — the largest modifier in the game had never been spent.** §9
gives a president +3 in any primary and a governor +2 in their own state, as a
tap that untaps at cycle start. Nothing ever assigned one. Now each endorser
backs their player's most contested primary:

| | value |
|---|---|
| primaries with an endorsement spent | **32%** (was 0%) |
| endorsed candidate wins its primary | **72%** |

That 72% is also a clean consistency check on the corrected odds table: §3 puts
+3 pips at 76%, and an endorsement rarely arrives unopposed by other modifiers.
**Keep. It is load-bearing and correctly sized.**

**Independent candidacies — half of the brief's prior is right.** SIM-BRIEF
guessed "no primary, no coattails, may be pure downside". The engine had
supported party `I` from the first commit; no pack contained one, so the rule
was unmeasurable. Eight real independents added across the four eras — Harry
Byrd Jr., Eugene McCarthy, Weicker, Perot, Lieberman, Sanders, King, McMullin.

| measure | value |
|---|---|
| contested generals featuring an independent | 559 |
| independent wins **in contested generals** | **39%** |

Below the ~50% two-way baseline, so forfeiting coattails is a real cost — but
they reach far more generals than party candidates, because skipping the
primary means no primary attrition and no card reveal. **Not pure downside:
a worse race, entered more often. Keep.**

*A measurement note against myself:* the first cut of this said independents
win **60%**, which counted walkovers. Uncontested wins say nothing about a
candidate's strength, and on a board that is 79% walkovers they dominate any
raw win rate. The contested-only figure is the real one.

**Governor Senate appointments — implemented, and they may be too good.** §11:
"Governors appoint Senate vacancies, placing a card from hand with no
election." A vacancy now arises the way it does in life: a sitting senator wins
a different office and leaves the seat behind. Roughly **12 appointments a
game**, each worth 3 points and a Senate seat that never faced a voter.

**Flagged rather than cut.** This compounds F11 — the Senate already pays four
ways, and appointment is a fifth route into it that skips the electorate
entirely. Anyone acting on hf7y/american-cycle#8 should weigh appointments as
part of the same problem.

---

## F14. The sweeps, now that the rules fire. Two clean answers, one acquittal.

**~~+1 incumbency is correctly calibrated.~~ WRONG — see F37.** This compared a
figure pooled across every office below the presidency against a House-only
benchmark. Measured on House races alone, +1 gives 98.8% against a real 94.1%.

**The filibuster is what stalls the omnibill.** ~~Bills pass 63% at a 50% Senate
threshold, 16% at the current 60%, and 0% at 67%.~~ **These three figures are
STALE — `findings/bill-passage-is-the-table.ts` is the value.** The predicate
re-derives them on the same agent pool (`Greedy, Lookahead, SenateFlood,
HeterodoxSpecialist` in both `sim/sweeps-full.ts` and the predicate), so this
is NOT a population mismatch of the kind F37 was: the engine moved underneath
the prose. F33, F34 and F35 each changed what a bill does — counters were never
recorded, card text never fired, the veto never ran — and this paragraph was
measured before all three. Read the current numbers off the predicate. Cross-benching is roughly
constant across all three, so players are already reaching across — the bar is
simply too high for the reaching to produce anything. §12's intent that 60%
"forces cooperation" is half-achieved: it forces the attempt and refuses the
result. *Not to be changed on simulation alone; the bill is a negotiation and
no agent here can negotiate.*

**The midterm brake does not bind.** The president's party loses 16% of its
midterm races at the current −2, and 19% at −4 — against a reality of losses in
19 of the last 21 midterms. Doubling the penalty moves the outcome three
points, because a modifier cannot punish anyone in a race nobody contests. This
is F6 downstream again.

**The runaway.** ~~Acquitted.~~ **This claim was wrong — see F18.** It rested
on two metrics that were not the ones SIM-BRIEF defines: a per-game
determination proxy, and a "comeback rate" that counted any game containing a
lead change. Measured to the brief's definitions the runaway is real. What
survives is the narrower result: the presidency and Senate hand bonuses are not
what causes it.

**Two sweeps returned nothing usable, and say so rather than dressing it up.**
Game length is invariant at 16 years across every hand size because `maxYears`
caps it before deck-out — that question needs the cap lifted. And the district
sweep's game-length column, reported earlier under F6, has the same defect.

---

## F15. The game had no ending. §14's deck-out is unreachable. CONFIRMED, settled.

Run without a year cap, **every game runs forever**. 200 years, every seed,
every hand size. §14 names the deck-out as the ending — "if the discard is too
thin to reshuffle, that is the deck-out ending" — and it cannot happen, because
the same section has defeated politicians circulate back through the draft.
Circulation wins:

| year | talon + discard | in hands | on seats |
|---|---|---|---|
| +10 | 79 | 72 | 77 |
| +30 | 98 | 81 | 90 |
| +60 | 228 | 92 | 99 |
| +100 | **273** | 95 | 90 |

The circulating pool **grows**, because the discard fills faster than hands and
seats absorb. Only impeachment removes a card permanently, and impeachment
fires at 0% (F12). This is the same shape as F2: a rule the design treats as a
backstop, made unreachable by arithmetic elsewhere in the same section.

**§14's four victory candidates, measured.** None had been implemented; §16
lists the choice as open and says it "should be settled empirically". It now is:

| condition | median years | p90 | max | games that ended |
|---|---|---|---|---|
| points (current) | — | — | — | **0%** |
| bills passed (8) | 71 | 200 | 200 | 86% |
| two consecutive terms | 9 | 25 | 41 | 100% |
| **three terms** | **13** | **17** | **25** | **100%** |
| parallel (any) | 9 | 25 | 29 | 100% |

**Recommend three terms.** It is the only condition with a tight tail — a
median of 13 years and a worst case of 25, a ratio under 2. SIM-BRIEF warns
specifically about this: *"a game that usually runs 90 minutes but sometimes 5
hours has a variance problem worse than its mean."* Two consecutive terms is
quicker at the median but tails to 41 years, four and a half times its median.
Bills-passed leaves one game in seven unfinished.

Applied to every config. `maxYears` stays as a backstop rather than the
condition, which is what it had silently become.

---

## F16. §14's victory conditions all fail, in two different directions.

**Correcting F15.** F15 recommended three terms on the strength of its length
distribution — median 13 years, max 25, always terminates. **That
recommendation was wrong**, and measuring only length is how I got it wrong.

A victory condition is not neutral about *who wins*. Six-way round robin, 90
games each, identical agent pool throughout:

| condition | winner spread | median years | games that ended |
|---|---|---|---|
| three terms | **Lookahead 90%** · 3 · 3 · 2 · 1 · 0 | 13 | 100% |
| two consecutive terms | **Lookahead 90%** · 4 · 3 · 2 · 0 · 0 | 9 | 100% |
| bills passed (5) | Bill 33 · Het 28 · Greedy 24 · 12 · 1 · 1 | 34 | 63% |
| bills passed (8) | Bill 30 · Greedy 29 · Het 28 · 11 · 2 · 0 | 49 | 58% |
| parallel (either) | **Lookahead 50–66%** | 9 | 100% |
| points + year cap | Look 28 · Bill 28 · 16 · 16 · 8 · 6 | capped | 0% |

**Everything that ends reliably is won by whoever is best at the presidency;
everything that stays balanced leaves 40% of games unfinished.** There is no
setting among §14's candidates that does both.

**And this is the rule, not the agents.** The same pool, unchanged, goes from
**28% to 90%** for its best agent purely by switching `points` → `three-terms`.
The presidency is contested in 27–34% of games under *every* condition, so it
is not that nobody runs — it is that a term-based condition concentrates all
the value of the game into one race a cycle, and then whoever is marginally
better at that race takes everything.

**Shipping `points` plus a year cap** as the least-bad playable default, and
leaving §16's question open rather than closing it badly. A `three-terms.json`
variant ships alongside so the collapse can be felt at the table instead of
argued about.

**What would actually solve it** is not on §14's list: a condition that
terminates on something *many* strategies can pursue. Bills-passed is the only
candidate with that shape and its tail is too long; a lower target with a term
backstop is the obvious next thing to try, and it needs a human table, because
bill passage is a negotiation.

## F17. The harness CLI silently ran on one era pack. Fixed.

`--packs` defaulted to `1976` alone, so any measurement taken from the command
line used 114 cards instead of 400 — and four-player games end at a median of
**3 years instead of 13**. A silent factor of four in anything read off the CLI.

Caught by a number that disagreed with itself: the CLI reported 3.5 mean years
where a direct call on the same config reported 12.2.

Worth keeping as a finding in its own right, because it answers a question §16
asks: **one era pack is not a viable pool.** Median game length by pool size,
four players: 114 cards → 3 years, 212 → 13, 400 → 13. Two eras is the minimum,
which makes §14's "refill packs draw from later years" load-bearing rather than
flavour.

---

## F18. The runaway is real. F14's acquittal was measured wrong.

**Correcting myself.** F14 reported the runaway "acquitted at every tested
setting". That was two bad metrics, not a finding.

SIM-BRIEF defines the determination point as a **cross-game curve** — at each
year, the share of games where the *current* leader is the *eventual* winner —
reported as the first year that share exceeds 80%. I had measured a per-game
proxy instead. And it defines comeback rate as "share of games won by a player
who was **last at the halfway mark**"; I had counted any game containing a lead
change, which is a far easier bar and gave a cheerful 67–87%.

To the brief's definitions, 120 games each:

| presidency hand bonus | determination | comeback | lead changes |
|---|---|---|---|
| 0 | 44% | **1%** | 1.3 |
| 2 (current) | 38% | **0%** | 1.1 |
| 4 | 50% | **1%** | 1.0 |

Healthy determination is 75–85% of the way through. **This is 38–50%** — the
winner is settled around the halfway mark. And the year-by-year curve shows
where it starts:

`54 57 68 68 73 73 80 81 85 86 90 90 90 90 100 100`

**In year one, the eventual winner is already leading 54% of the time**, against
25% for a four-player coin flip. The early game decides too much, and once
ahead a player is essentially never caught: **the comeback rate is 1%.**

**What survives from F14** is the narrower and still useful result: the
presidency and Senate hand bonuses are *not* the cause. Determination does not
trend across bonus 0→4, and the Senate bonus sweep is flat. §16 names hand
size, endorsements and capture as the three stacking loops to suspect; on this
evidence hand size is innocent and the other two are unexamined.

**Three of my own numbers have now had to be corrected** — the independents
win rate (walkovers), the seat bias (two harness bugs), and this. The pattern
is the same each time: a convenient proxy standing in for the metric that was
actually specified. The brief warned about exactly this — *"assume the
instrumentation is wrong before assuming the design is right"* — and it has
been right every time.

---

## F19. Decision density is analysis paralysis, not automatic turns. Inverts my earlier claim.

**Correcting myself again, and this one flips a recommendation.** I reported
decision density as "median 2, turns are close to automatic" and put it in the
report's top five. That measured **declarations made**. SIM-BRIEF asks for
*"mean legal moves per player-turn"* — the option set, not the choice taken.

Measured as specified, counting distinct races a player could legally enter:

| | value |
|---|---|
| median legal races per player-turn | **39** |
| mean | 37.2 |
| p90 | 49 |
| max | 64 |

SIM-BRIEF: *"Under ~4 and turns are automatic; over ~25 and the game is
analysis paralysis."* At a median of 39 the game is **well into paralysis** —
the opposite of what I reported. A player at a real table is being asked to
compare thirty-nine possible races, every cycle.

This is the same root cause as F6 seen from the other side: presence is
abundant and the board is enormous, so a player has far more places to run than
cards to run with. **Cutting district supply fixes both.**

**Turns with no legal move at all: 4.4%.** The brief wants that near zero. It
is a dead-player rate, and it is not zero — one player-turn in twenty-three has
nothing to do.

## F20. Two design successes, measured and confirmed.

Worth stating plainly, because most of tonight's findings are problems.

**The single-token economy holds.** §2 puts the entire token economy at "player
pegs for seats, red and blue counters for state lean". Peak simultaneous tokens
on a four-player board: **median 84, p90 132, peak 151.** SIM-BRIEF's failure
line is 200 — *"if a mid-game board carries 200 counters, the single-token-type
economy has failed in practice even though it succeeded on paper."* It has not
failed. It works.

**The dice behave exactly as the corrected odds table says.** Swinginess —
the share of contested races where the favourite loses — is **32.1% observed
against 34.6% predicted** by the odds table, over 5,603 contested races. Within
2.5 points.

That is a double confirmation: the resolution engine adds no variance the
design did not intend, *and* the §3 table as corrected in F1 is an accurate
predictor of play. Had the original 5%-a-pip table been right, the predicted
figure would have been materially different from what the dice actually do.

Together with §5's district gating killing wide-and-empty (0% win rate), the
+1 incumbency calibration landing within a point of reality, and the modifier
stack averaging 2.43 entries so the mental arithmetic really is mental — the
design's core resolution machinery is sound. **Its problems are all in scale
and structure, not in the dice.**

---

## F21. The runaway is the opening deal, and districts are a liability. CONFIRMED.

F18 established the runaway is real (determination 38–50% against a healthy
75–85%, comeback 1%) but left the cause open. §16 names three stacking loops to
suspect: hand size, endorsements, capture. **All three are innocent.**

Switching each off, 120 games apiece:

| variant | determination | comeback |
|---|---|---|
| baseline (all three on) | 50% | 1% |
| endorsements off | 50% | 0% |
| capture off | 50% | 0% |
| both off | 50% | 0% |
| hand bonuses off | **38%** | 0% |

Removing the suspects changes nothing, and removing hand bonuses makes the
runaway **worse**. That last one has a clean explanation: since F7 made the
office bonuses per-office-held rather than per-seat, they cap at +3 and saturate
the moment a player holds one seat of each kind. They are a **catch-up**
mechanic in practice, not a compounding one.

**The deal predicts the winner strongly** — though *"the cause is the opening
deal"*, as this finding originally claimed, turned out to be too strong. See
F22. Over 250 games, correlating each player's
opening hand — measured before a single die is rolled — against their final
score:

| opening measure | correlation with final score | player dealt the best wins |
|---|---|---|
| total home-state bonus in hand | **+0.316** | **48%** |
| districts held | **−0.324** | **9%** |
| distinct states of presence | −0.303 | 10% |
| total district synergy | −0.290 | 8% |

Chance is 25%. **The player dealt the strongest home-state bonuses wins nearly
twice as often as chance**, which is why the determination curve already stands
at 54% in year one. The game is substantially decided before anyone declares.

**And districts are actively bad to hold.** Every district measure correlates
*negatively* with winning, and the player dealt the most districts wins 9% of
the time — a third of chance. This directly contradicts §5: *"presence is
scarce and must be purchased in the draft."* Presence is not scarce. It is
**ballast**. Hand size caps total cards, so every district crowds out a
candidate, and on a board this large a district buys access to races you have
no one left to run in.

**This is the second independent argument for the same change.** Cutting
district supply was already recommendation #2 on the contest-rate evidence.
It now also fixes the draft: fewer districts means each one is worth holding,
which is what §5 believed was already true.

**What it does not fix** is the home-state draw. If a single dealt statistic
predicts the winner at twice chance, the draft needs to be a draft — pack-pass,
as §6 specifies — rather than the random deal the simulator uses. That is a
real limitation of this harness and not a finding about the design: **§6's
take-one-and-pass draft is unimplemented here**, and implementing it is the
obvious next thing, because it is exactly the mechanism that would let players
correct a bad opening.

---

## F22. The design has no mechanical brake on a leader. Only table politics.

**Correcting F21's overreach.** F21 concluded the runaway *is* the opening
deal. Implementing §6's pack-pass draft — which is exactly the mechanism that
lets a player correct a bad opening — tests that claim directly:

| | random deal | with §6's draft |
|---|---|---|
| home-state bonus correlation | +0.316 | **+0.208** |
| best-dealt player wins | 48% | **38%** |
| districts correlation | −0.324 | −0.223 |
| **determination point** | **50%** | **50%** |
| comeback rate | 1% | 0% |

The draft cuts the deal's grip by a third — and moves determination **not at
all**. So the deal is a real advantage but it is not what locks the game in.

**What locks it in is that nothing in the design can take points away.**

| measure | value |
|---|---|
| player-scores that never decrease, all game | **100%** |
| second-half vs first-half accrual ratio | 0.86 (roughly steady) |
| leader's margin over second place, at halfway | 26 |
| the same margin at the end | **51** |

Scores are strictly monotonic, accrual is roughly steady, and the leader's gap
**doubles** over the second half. With no mechanism that reduces a score, a
player who is ahead at the midpoint cannot be caught by anyone accruing at a
similar rate. Determination near 50% is not a symptom of a feedback loop — it
is what a monotonic scoring game looks like.

**This reframes §16's question.** The doc asks whether hand size, endorsements
and capture "stack into a runaway", and names three intended brakes: the
midterm penalty, recession, and *"other players ganging up"*. Measured:

- **hand size, endorsements, capture** — none of them causes it (F21)
- **the midterm penalty** — does not bind; doubling it moves outcomes three
  points (F14)
- **recession** — hits the president's party, who need not be the leader
- **players ganging up on the leader** — the social layer

**So the design's only effective brake on a runaway leader is table politics,
and that is precisely the thing this simulator cannot test.** SIM-BRIEF's own
caution applies exactly: *"Where a finding depends on the social layer, say so
and recommend a human playtest rather than a parameter change."*

**Recommend a human playtest before adding any catch-up mechanic.** Real
players do gang up on a leader, and the design may well be right that this is
enough. But it should be a deliberate choice that the brake is social, because
at present there is no mechanical one — and if a table ever fails to coordinate,
nothing else stops the leader.

**A note on method.** This is the fifth correction to one of my own claims
tonight, and the second where implementing the missing mechanism was the only
honest way to test the claim. Reasoning about whether a draft *would* fix the
deal was not good enough; building it and measuring took twenty minutes and
gave the opposite answer.

---

## F23. The central thesis is not implemented. Realignment is a driftless walk.

This is the capstone, and it is the one finding that tests what the design
exists to argue. §1: *"Realignment is not inevitable. It is the accumulated
residue of individual races won by individual candidates."*

**The residue does not accumulate.**

With seven era packs in rotation, playing 1932→1992 — the largest realignment
in American history, and the game now holds the cards for both ends of it — 60
games:

| region | mean final lean (+ = Republican) | reality 1932→1992 |
|---|---|---|
| South | **−0.14** | solid D → solid R |
| Northeast | **−0.08** | solid R → solid D |
| elsewhere | **−0.01** | — |

Nothing moves. Only 18% of games see even one state reach a durable 4+ lean.

**The mechanism, over 45,000 state-election-cycles:**

| | share |
|---|---|
| lean moved **away** from zero (a push outran decay) | **44.6%** |
| lean moved **toward** zero (decay won) | **45.5%** |
| unchanged | 9.9% |
| state-cycles sitting at 4+ pips | 0.62% |

Push and decay cancel to within a percentage point. **A state's lean is a
driftless random walk**: it can wander as far as the ±8 cap and does, but it has
no tendency to go anywhere and no memory of having been there.

**F2 was necessary and not sufficient.** Fixing annual decay to biennial made
accumulation *arithmetically possible* — under annual decay the map was pinned
at 2 forever. But possible is not likely. Realignment needs one party to keep
winning a state *decisively*, and three separate measured facts prevent it:

1. **93% of races are uncontested** (F6), and an uncontested win has no margin,
   so it pushes nothing at all.
2. **Contested races have a median margin of 8 points** — 4 pips (F8) — which
   buys a push of 1 or 2 against a decay of 1.
3. **Which party wins a given state alternates** often enough that consecutive
   pushes rarely share a sign.

**What this means for the design.** The thesis is sound and the mechanism
chosen to express it — margin-based pushes against decay — is a reasonable one.
It is calibrated wrong by roughly a factor of two: at present the expected
drift is zero. Making realignment happen needs some combination of a larger
push for a blowout, a slower decay, or — most promisingly, because it fixes
four other findings at once — **a contested board**, since a race nobody
contests cannot be evidence about anything.

**This is the finding to act on first.** Not because it is the worst number in
the report, but because it is the only one that measures whether the game does
what it is for.

---

## F24. One undecided rule is the difference. Uncontested wins should push lean.

F23 showed the map is a driftless random walk and the central thesis
unimplemented. Sweeping the levers finds the fix, and it is **not** a
recalibration of anything the design decided — it is an answer to something the
design never decided at all.

§10 scales a lean push "by how decisively the race was won" and **never says
what an uncontested win does**. A walkover has no margin. F5 flagged the gap;
this is its resolution.

Played 1932→1992, 40 games, seven era packs:

| setting | mean \|lean\| | states at 4+ per game | South mean \|lean\| |
|---|---|---|---|
| baseline — walkover pushes 0 | 0.13 | 0.2 | 0.21 |
| **walkover pushes 1** | **1.44** | **7.4** | **2.69** |
| bigger pushes for blowouts (0/2/3) | 0.31 | 1.3 | 0.42 |
| both together | 3.62 | 21.9 | 5.53 |

**One pip for a walkover turns a dead map into a realigning one.** Bigger
blowout pushes barely help by comparison — the problem was never the size of
the pushes that happened, it was that 93% of races pushed nothing at all.
Doing both is too much: 22 states a game reaching a durable lean is a map that
realigns constantly, which is its own kind of wrong.

**And it is the thematically right answer**, which is the part worth arguing.
The game already encodes a safe seat as an *uncontested race* rather than a
lopsided one (F8). In reality a state is understood to have realigned precisely
when the other party stops being able to field anybody — the walkover *is* the
evidence. Reading it as worth nothing throws away the game's own best signal
about which states have moved.

Shipped as `realigning.json` so the difference is playable side by side with
`tuned`. **Not applied to the baseline**: this is a design decision, it is
§10's to make, and the sweep gives the shape rather than the ruling.

*A discarded row.* The sweep also tried "decay once per presidential cycle",
which returned mean |lean| 0.02. That number is void — `quadrennial` is not a
value `decay()` recognises, so it fell through to annual decay, which F2 already
showed pins the map. Reported as discarded rather than as a finding.

### F24 addendum: realignment and the margin ceiling are independent problems.

I predicted that fixing the map (F24) would narrow the margin gap (F8): if lean
accumulates to 4–8 pips, leaning states should start producing lopsided races,
which is the safe-seat mass F8 says is missing. **It does not.**

| | tuned | realigning | real |
|---|---|---|---|
| median margin | 8 pts | **10 pts** | 32.5 |
| competitive (<10) | 51.3% | 45.6% | 13.5% |
| safe (40+ pts) | 0.2% | **0.7%** | 37.5% |

Realignment moves the median by two points and leaves the safe-seat mass at
essentially zero. The arithmetic says why: lean caps at ±8 pips, so even a
*completely* realigned state contributes 16 points of margin — and the rest of
a typical stack is 2.43 entries worth 1–3 pips each. A 40-point margin needs a
near-maximal stack on every axis at once, which is why 0.7% of races reach it.

**So F8 and F23 are separate problems with separate fixes**, and my hypothesis
that one implied the other was wrong. The map can be made to realign without
the margin distribution ever resembling reality; the pip scale would have to
change for that, and that is a much larger decision than one undecided rule.

One thing got slightly *worse*: uncontested share rose from 97.4% to 98.3%.
That is not caused by the rule change — it is the seven-era pool, which puts
258 districts and therefore far more open races on the board than the four-era
pool that produced the 93% figure. It is F6 again, and it is the argument for
cutting district supply stated a third way.

---

## F25. The seat bias was capture reading the table's order. Mostly fixed.

Issue #5 had a measured 9–14pp seat bias at 4–6 players with the cause
unisolated. Two hypotheses were wrong before the right one turned up, and both
are worth recording because each was tested rather than argued.

**Wrong hypothesis 1: rotation not dividing evenly.** With 8 election cycles
and 5 players, three players lead an extra time, so the residue looked like an
arithmetic artefact. Directly tested by choosing game lengths where cycles
divide exactly: 5 players over 10 cycles gave **8.2pp** against 8 cycles'
**8.0pp**. No effect. Refuted.

**Wrong hypothesis 2: capture robbing in seat order.** `capture()` walked
`this.players` by index and took a district from the first opponent holding one
in that state, which does rob low seats systematically. Fixed to take **the**
district the race was fought over, per §15 — and the bias got *worse*, 14.3pp.
Refuted, though the fix is correct on its own terms and stays.

**The actual cause: `openRaces()` listed House seats in seat order.** It built
the list by walking players and reading their districts, so every race derived
from player 0's cards came first. Agents sort options by edge,
`Array.prototype.sort` is stable, and ties therefore resolved to whatever came
first — so player 0's districts drew the most declarations, lost most often to
capture, and **shed the most ballast**. Districts are a liability (F21), so
being stripped of them is an advantage. Seat 0 scored 164 against seat 4's 143.

The ablation is what found it: with capture disabled the bias fell from 11.7pp
to 2.7pp and the score gradient flattened completely, which proved capture was
in the causal path even though capture's own ordering turned out not to be the
mechanism.

**Fixed** by sorting open House races by state and district number, making the
board's order a property of the board rather than of the table.

| players | before | after (n=900) | SIM-BRIEF bar |
|---|---|---|---|
| 3 | 4.3pp | **1.7pp** | 3pp |
| 4 | 11.5pp | **3.5pp** | 3pp |
| 5 | 14.3pp | **2.9pp** | 3pp |
| 6 | 13.6pp | **4.1pp** | 3pp |

Three of four table sizes now sit at or under the brief's 3pp tolerance, and
the monotonic score gradient is gone at every size — 3 players finish 171 /
172 / 173. Six players retains 4.1pp with seat 0 favoured, which is real at
n=900 and no longer has a score gradient behind it; what remains is variance in
converting similar scores into wins, and it is small enough to leave.

**The lesson worth keeping.** A stable sort plus a list built in seat order is
enough to hand one player a 15% scoring advantage, through a mechanism
(capture) that looks unrelated to either. Nothing in the rules was wrong. The
iteration order of a `Map` was.

---

## F26. SenateFlood's dominance was partly the seat-order bug. Resolved, not designed away.

Issue #8 recorded SenateFlood at **51.7%**, well past SIM-BRIEF's 40% dominance
line. Re-measured on the current engine, n=360:

| strategy | at #8 | now |
|---|---|---|
| EconomyChicken | 19.2% | **37.8%** (borderline) |
| SenateFlood | **51.7%** | **31.7%** |
| BillMaximizer | 24.2% | 25.6% |
| HeterodoxSpecialist | 5.0% | 4.2% |
| HouseFarm | 0.0% | 0.6% |
| WideAndEmpty | 0.0% | 0.3% |

**Nothing is dominant any more.** The top strategy sits at 37.8% with a 3.9pp
two-sigma band, so it touches the line without crossing it.

**This was not fixed by design work, and that matters.** Two ablations were run
first, and neither explains it: zeroing the Senate hand bonus moves SenateFlood
34.0% → 31.3%, and demoting the Senate below the House in §10's nationalisation
priority moves it 34.0% → 30.7%. Both are small. The dominance fell out of the
**F25 capture fix** — open races were listed in seat order, which fed the whole
declaration economy a systematic distortion.

So the honest reading of the original 51.7% is that it was measuring a
board with a bug in it, in the same way F11's numbers were measuring a board
with five mechanics switched off. **Any round robin in this report taken before
its neighbouring fix is void**, and that is now true of three of them.

`lean.priority` is kept as config even though it did not turn out to be the
lever, because §10's ordering is an assertion the design makes and it should be
testable rather than compiled in.

**What survives from #8:** the Senate still pays more ways than anything else
on the board — points, a six-year term, hand size, the midterm push, and
governor appointments as a fifth route in. It is no longer *dominant*, but it
is still the best thing to do, and EconomyChicken's rise to 37.8% is a new
question rather than an answer.

---

## F27. Bill passage is set by who is at the table, not by the threshold.

**Correcting the strength of F14's filibuster claim.** F14 reported that the
60% Senate threshold "is what stalls the omnibill", on a sweep that moved
passage 63% → 16% → 0% across thresholds of 50/60/67. That sweep was run at a
*fixed agent mix*. Holding the threshold fixed at 60% and varying the mix
instead:

| agents at the table | bills pass | cross-bench votes/game |
|---|---|---|
| Greedy + Lookahead + SenateFlood + Heterodox | **15%** | 66 |
| Greedy + Lookahead + Greedy + Lookahead | **14%** | 57 |
| BillMaximizer + SenateFlood + Greedy + Heterodox | **67%** | 127 |
| BillMaximizer + EconomyChicken + SenateFlood + Heterodox | **88%** | 163 |
| four BillMaximizers | **100%** | 309 |

**The 60% threshold is identical in every row.** Passage runs from 14% to 100%
on nothing but the willingness of the players to vote yes — a wider range than
the entire threshold sweep produced.

**So the 20% figure in this report is a property of my agent pool, not of the
design.** The honest statement is not "the filibuster stalls the bill" but "the
filibuster makes the bill depend on whether anyone will cross the aisle", which
is *precisely what §12 says it is for*: "the filibuster threshold means bills
essentially cannot pass without cross-benching, which makes cooperation
structurally necessary rather than optional."

**The mechanism is working as designed.** What the simulator cannot supply is
the cooperation, because no agent here can negotiate, offer anything, or
remember a favour. SIM-BRIEF says this outright and it is now demonstrated
rather than asserted: *"trust the simulator on arithmetic, distributions, dead
rules, and runaway detection. Do not trust it on whether the bill negotiation
is the best part of the evening."*

**Do not touch the filibuster threshold.** Not "not on this evidence" — the
evidence now points the other way. A table of humans who will trade votes looks
like the bottom rows, not the top ones.

*This is the sixth correction to my own work tonight, and the first that is
about the strength of a claim rather than a wrong number. The measurement in
F14 was correct; the conclusion drawn from it was over-confident because only
one variable was swept.*

---

## F28. Robustness audit: which findings survive a change of agent pool.

F27 showed one headline number (bill passage) was an artefact of who was at the
table. That is a reason to check the others rather than to assume them. Six
agent pools, from four identical Randoms to a mix of specialists:

| metric | range across pools | verdict |
|---|---|---|
| **median House margin** | **8, 8, 8, 8, 8, 8 pts** | **invariant** |
| uncontested share | 85–97% | robust |
| incumbent reelection | 91–97% (real 94.1%) | robust |
| contested race-slots | 21–42% (target >60%) | robust |
| states realigned per game | 0.00–0.33 | robust |
| comeback rate | 0–2% | robust |
| **determination point** | **38–75%** | **agent-dependent** |

**The core findings hold.** The median margin is *literally identical* in every
pool — 8 points against a real 32.5 — which is the strongest possible evidence
for F8's claim that the ceiling is arithmetic rather than behavioural. No
pool produces safe seats, none realigns the map, none contests enough races,
and incumbency lands within a few points of reality regardless of who plays.

**One finding needs qualifying: the determination point.** It runs 38% with
mixed specialists, 50% with four Greedys, 63% with four Lookaheads or four
HouseFarms, and **75% with four Randoms** — which is inside SIM-BRIEF's healthy
75–85% band.

That last row is not good news, and it is worth saying why. Random play
prevents early lock-in because nothing accumulates skill advantage, not because
the design has a brake. The meaningful range is **38–63% among competent
agents**, all of it below the healthy band. So F18's runaway stands for the
players a designer cares about, and the single "50%" figure quoted elsewhere in
this report should be read as the middle of a range.

**The comeback rate is the robust half of the runaway finding**: 0–2% in every
pool tested, including the random one. Whatever the determination point says,
a player who falls behind does not come back, and that does not depend on who
is playing.

**Method note.** This audit exists because F27 caught me generalising from a
single-variable sweep. Every headline number in this report has now been
checked against a change in the one variable a simulator most easily holds
fixed by accident — the players.

---

## F29. The engine reproduces the 1976 electoral college within three votes.

The last item on Zach's list — *"try to represent a real election in the
gamestate"* — and the closest thing to an end-to-end validation available.

1976 is the fairest test: it is the founding era pack, the race was close, and
the map has a clean regional story. The board is seeded with the real
pre-election lean (South solidly Democratic, Mountain West and Plains solidly
Republican, industrial North contested), Carter and Ford are the two nominees,
and §9's resolution runs exactly as it would in a game. Nothing is tuned.
Averaged over 300 replays:

| | simulated | real |
|---|---|---|
| Carter | **294** | **297** |
| Ford | **241** | **240** |

**Three electoral votes.** And the per-state agreement is the interesting part,
because it tracks how much the board actually knew:

| board lean | agreement with the real result | states |
|---|---|---|
| 3+ pips | **79.3%** | 17 |
| 1–2 pips | 63.5% | 24 |
| **0 pips** | **52.8%** | 9 |

A state the board knows nothing about is a coin flip, and the model duly calls
it at 52.8%. A state the board leans hard on is called four times in five. That
is a model whose confidence matches its information, which is the behaviour you
want and not a given.

The five worst-called states are VA, CA, WA, NJ and OR — four of them carry
zero lean on my seeded map, so the engine had no information to be right with.
Virginia is the genuine miss: the board leans it one pip to Carter and Ford
took it.

**And the ceiling shows up here too.** 79.3% agreement on *solid* states looks
low until you check it against §3: three pips is a 76% favourite. **The engine
is not underperforming — it is doing exactly what the odds table says**, and it
cannot make a safe state safer than about 80% because the pip scale does not go
high enough. That is F8, measured a third independent way, in a real election.

**What this does and does not show.** It shows §9's resolution converts a
correct map into a correct outcome, with calibrated per-state confidence. It
does *not* show the game can discover the map — that is F23, and the map was
handed to it here.

---

## F30. The skill floor is punishing, and the board's defaults made it worse.

A playability finding rather than a design one, but it decides whether the
first game is any fun.

Win rate in the human seat against the board's original default opponents
(Lookahead + HouseFarm + Greedy), 240 games each:

| if the player plays like | win rate |
|---|---|
| Lookahead — values a seat over its whole term | **47.9%** |
| SenateFlood | 32.1% |
| EconomyChicken | 21.7% |
| BillMaximizer | 19.2% |
| **Greedy — takes the best race each turn** | **6.3%** |
| Random | 4.6% |
| HouseFarm / WideAndEmpty | 0.0% |

**A newcomer who plays the obvious way loses 94% of the time.** Taking the
highest-edge race each turn — which is what the board's own interface invites,
since it shows you the edge — is close to the worst strategy available. The
whole game is in valuing a seat over its *term*, and nothing on the board says
so.

That is a steep but legitimate skill curve. What was not legitimate was
shipping it with a strong opponent as a default. Measured across opponent sets:

| opponents | ordinary player wins | strong player wins |
|---|---|---|
| Lookahead + HouseFarm + Greedy (was default) | **8.0%** | 46.5% |
| **Greedy + HouseFarm + Random** (now default) | **27.0%** | 70.5% |
| Greedy + BillMaximizer + HouseFarm | 11.0% | 47.5% |

**Changed** the default table to Greedy + HouseFarm + Random, where an ordinary
player wins 27% against a 25% fair share, and labelled every opponent with its
measured strength rather than a guess. Lookahead is still there for anyone who
wants the hard game.

**Also added one line of first-game guidance**, because the finding above is
not discoverable by playing: a seat is worth what it pays over its whole term,
Senate seats run six years and grant hand size, and taking the highest-edge race
each turn loses 94% of the time.

*This is the only change tonight made for the player rather than the designer,
and it came from noticing that the automated playtest finished 4th of 4 twice
and asking whether that was the bot playing badly or the table being unfair. It
was both.*

---

## F31. What actually wins: the Senate and the presidency. House seats lose.

F30 shipped first-game guidance inferred from how I wrote the Lookahead agent
rather than from measurement. Checking it — 200 games, four mixed agents,
seats held at game end:

| | Senate | House | Governor | President |
|---|---|---|---|---|
| winners | **24.4** | 4.7 | 3.6 | 0.5 |
| everyone else | 7.0 | **11.9** | 3.5 | 0.2 |
| **winner advantage** | **3.47×** | **0.39×** | **1.02×** | **3.52×** |

The advice was right about the Senate and **understated the House**. Winners
do not merely under-invest in House seats — they hold **a third as many** as
the players who lose. Holding House seats is *anti-correlated with winning*.

That follows from three things already measured: a House seat scores 1, expires
every two years, grants no hand size, and arrives attached to a district card
that is itself ballast (F21). `HouseFarm` wins 0% of round robins, which is the
same fact from the other end.

**Governors are exactly neutral — 1.02×.** §11 gives them points, Senate
appointments and a launchpad, and describes them as having "no effect on the
map". Measured, they have no effect on *winning* either. That is not
necessarily wrong — a card that is worth taking but never decisive is a fine
thing for a board to contain — but it is worth the designer knowing that the
office currently does nothing a player should plan around.

**The in-app guidance now quotes these numbers** rather than my reasoning about
my own agent. The distinction matters: the first version was a plausible story
about why Lookahead wins, and the second is what winners actually hold.

---

## F32. The governorship is the one office nobody should plan around. ~~SUPERSEDED by F36.~~

F31 measured governors at exactly neutral — 1.02× between winners and losers.
Before reporting that as a design fact I checked whether the office's abilities
were actually implemented, and one was not.

**§11: "Governors ... carry incumbency into Senate and presidential runs."**
Incumbency was granted only for holding *that* seat, so a sitting governor
stepping up ran as a challenger. Same shape as F10's district clause, and the
fifth unimplemented clause found this way.

**Implemented — and it changed nothing.** Governor advantage went from 1.02× to
**0.95×**. Winners hold 3.4 governorships, everyone else 3.5.

So the office now does everything §11 promises: it scores 2, appoints to Senate
vacancies (~12 a game), endorses at +2 in its own state's primaries, and now
carries incumbency upward. **It is still not worth planning around**, because
each of those is small against the alternative use of the card and the
declaration — a Senate seat scores 3, runs six years, grants hand size, and
takes the midterm lean push.

**This is a design observation, not a defect.** §11 already says governors have
no effect on the map, and the measurement extends that: they have no effect on
the outcome either. A card that is worth taking when it is cheap but never
decisive is a perfectly reasonable thing for a board to contain — the design
should just know that is what it has. **If the intent was that a governorship
is a real strategic option, it needs to pay more than it does.**

Filed as a decision rather than changed: it is §11's call whether the office
should matter, and the sim cannot tell you whether "Baker in Massachusetts" is
worth having on the board for its own sake.

---

## F33. §12's card counters were never recorded. The bill had no electoral consequence.

Found by a systematic coverage sweep rather than by stumbling on it: instrument
every named entry in §9's modifier stack and see which never appears. Thirteen
of fourteen fired. One did not.

**`cross-benched` had never fired once.** Chasing it found a whole §12 mechanic
missing, not just a modifier:

> **"Voting places a counter on the card**, coloured by the party in power.
> Cross-bench votes therefore show as the opposite colour. Sentiment at election
> time determines whether that counter is an asset or a liability, and the
> card's accumulated counters are simply read off at resolution."

And:

> "A good reaction rewards yes-voters; a bad one penalises them at the next
> election, **in both the primary and the general**."

Nothing recorded a counter. `reactionGood` was computed on every passing bill
and discarded, and `Declaration.crossBenched` was read by the modifier builder
and never set by anything. **So the omnibill — the design's primary scoring
engine — had no electoral consequence whatsoever.** A player could vote for
anything, forever, and never answer for it.

**Implemented.** Every vote now places a counter on the voter's card; passage
with a good reaction is an asset and with a bad one a liability; a yes-vote
against your own majority marks the card as cross-benched. Counters are read
off at resolution in both rounds, per §12. Only *passage* carries a
consequence — §12 is explicit that a symbolic vote on a failed bill earns
heterodoxy credit but no points.

| modifier | before | after (per 1000 races) |
|---|---|---|
| cross-benched | **never** | 15.0 |
| bill record | did not exist | 14.2 |

**What cannot yet be measured** is whether it changes outcomes: across 120
games, *zero* contested generals featured a candidate carrying a bill record.
That is not a fault in the implementation — it is F6 again. On a board where
92% of races are walkovers, two rare things almost never coincide. **The
mechanic is live and its effect is unmeasurable until the contest rate is
fixed**, which is the same sentence this report has now written about the
midterm penalty, heterodoxy, and realignment.

*Sixth unimplemented clause, and the first found by systematic sweep rather
than by noticing a suspicious number. The sweep is cheap and should have been
run first.*

---

## F34. Card text was entirely decorative, and the `conditional` handler ignored its own condition.

Extending the coverage sweep from §9's modifier stack to BUILD-BRIEF's seven
enumerated effect types:

| effect type | in card data | read by engine |
|---|---|---|
| `heterodox` | 114 cards | yes |
| `extremist` | 44 cards | yes |
| `identity_bonus` | none | implemented as a card *field* |
| `home_state` | none | implemented as a card *field* |
| `district_synergy` | none | implemented as a card *field* |
| **`conditional`** | **none** | **read, and nothing used it** |
| **`may_endorse`** | **none** | **neither** |

Three of the seven are implemented as fields rather than effects, which is a
reasonable choice and works. The other two were dead in different ways.

**Every card's belief text was decoration.** 346 candidates carry a printed
belief and not one had a mechanical hook. SIM-BRIEF asks directly: *"what share
of printed abilities ever change an outcome? If half the cards' text is
decorative, the enumerated effect types are wrong or the magnitudes are too
small."* The honest answer was **all of it**.

**And senators could not endorse at all.** §9: *"Senators do not endorse as a
class ... The exceptions are ideological validators with national followings —
Sanders, DeMint in the Tea Party era, Kennedy in 2008 — and those get printed
text."* That printed text is `may_endorse`; no card carried it and nothing read
it.

**Implemented**, using only the cases the doc names by hand — `may_endorse` on
Sanders, DeMint, Kennedy and Goldwater; `conditional` on Edwards (pro-life,
Catholic districts), Clinton (tough on crime), Goldwater and Lieberman (the
unstable baskets §5 names), and a handful more.

**And a bug caught on the way in.** The engine's `conditional` handler checked
`state`, `round` and `office` and **ignored `identity`** — so an effect written
as "a bonus in Catholic districts" fired in *every race*. Measured before the
fix, "the TVA: farm bonus" fired 61 times per 1000 races; after, 9.75. §5 is
explicit that an identity condition is a claim about the district being run in,
not about the candidate. **I would have shipped effects that ignore their own
conditions**, which is worse than having no effects at all.

Printed card text now fires in **4.12% of races**. That is a real answer to
SIM-BRIEF's question rather than a zero, and it is low — the effect types work,
but only a dozen cards carry text with a hook. Whether to write hooks for the
other 334 is a card-authoring decision, not an engine one.

---

## F35. The veto had never been exercised. And the sweep nearly reported a false dead rule.

Third coverage sweep, this time over §7's ten year-sequence steps. Two results,
one about the design and one about my own harness.

**The veto fired 0.00 times per game.** Not rarely — never. Every agent's
`veto()` returned `false`, so §12's rule had never been exercised in any run in
this report. SIM-BRIEF lists the veto as a cut candidate — *"only rational in
split-government years, which may be rare"* — and that could not be assessed
against agents structurally incapable of using it.

**Implemented §12's stated case:** *"Vetoing makes most sense when a midterm
has handed the opposition the majority."* A president now refuses a bill when
the chamber majority is not his own party, because yes-voters score doubled for
the majority and a bill under split government pays his rivals more than it
pays him.

| | before | after |
|---|---|---|
| vetoes per game | **0.00** | **0.30** |
| games ending under split government | — | 23% |

**So the brief's prior is right and the rule survives.** The veto is rare
because split government is rare — 23% of games — not because it is badly
priced. A rule that fires in roughly a third of games, in exactly the situation
the design says it should, is doing its job. **Keep it.**

### The harness error, which matters more

The same sweep reported **the Fed as firing 0.00 times per game**. It fires in
about five. The sweep read the game log, and `interactiveTick` logged the Fed
tightening while the headless `tick` did not — two code paths writing different
logs for the same event.

Had I trusted it, this report would carry a confident false finding that §13's
entire Fed mechanism was dead, in a section whose whole purpose is identifying
dead rules. It was caught only because the number contradicted an earlier
measurement of the same thing.

**Both paths now log it.** And the standing caution gains a line: *a coverage
sweep is only as good as the instrument it reads, and a log written by one code
path and not its twin is not an instrument.*

---

## F36. F32 was wrong: the governorship is strong, and no agent was using it.

**Correcting F32**, which concluded the governorship "does everything §11
promises and still does not matter" from a measured 1.02× advantage. That was
measured against a field in which **nobody sought the line the office exists
for**.

§11: *"Governors ... carry incumbency into Senate and presidential runs."* An
agent built around that — take governorships, then run those same cards for
Senate — changes the picture completely:

| field | governor advantage | Senate advantage |
|---|---|---|
| Lookahead + Greedy + HouseFarm + Random | **1.07×** | 3.55× |
| **Launchpad** + Greedy + SenateFlood + Heterodox | **2.39×** | 1.59× |

Same engine, same rules. **Governors go from neutral to a 2.39× advantage the
moment one player plays for them**, and the Senate's advantage falls
correspondingly — the step-up converts a cheap office into an expensive one.

The `Launchpad` agent wins **68–73%** of four-player games against a 25% fair
share, and 26.7% in a six-way round robin against stronger opposition — strong
but not dominant, which is a healthy shape for a strategic line.

**Two things follow, and the second is the general one.**

**Odd-year governorships are not the source.** KY, LA, MS, NJ and VA elect in
odd years and those races had never run at all — `openRaces()` computed them
and `tick()` only held elections in even years, so 1,039 governor races
resolved in even years and **0 in odd**. Implemented behind
`game.oddYearGovernors`, they raise governorships held by 45%. But Launchpad
wins *more* with them **off** (72.8% vs 68.3%). The uncontested odd-year
declaration is a distraction; the step-up is the whole line.

**A "dead" measurement is a claim about the agents, not the design.** F32
joined incumbency, the presidency, the veto, the bill counters and the card
text on the list of things that measured dead because nothing exercised them.
The difference is that those five were unimplemented and this one was
*unplayed*. **A simulator can only find the strategies its agents already know**,
and the correct response to "this office does nothing" is to write an agent
that tries to make it do something before believing the number.

*Implementing odd-year elections also surfaced a latent crash: three places
computed a rotation index as `year / 2`, which is fractional in an odd year, so
the agent index was 988.5. Even-year-only play had hidden it since the first
commit.*

---

## F37. +1 incumbency is NOT calibrated. F14 compared the wrong populations.

**Correcting F14**, which called +1 "the design's best single number" and
reported simulated reelection at 93% against a real 94.1%. Measured properly,
by a predicate that reports all three populations side by side rather than one:

| population | value |
|---|---|
| House reelection at +1 | **98.84%** |
| House at +2 | 99.37% |
| House at +3 | 99.66% |
| **real House 1976–2016** | **94.10%** |
| +1, **contested** House races only | **78.18%** |
| +1, pooled over every office below the presidency | 94.05% |

**F14's 93% was the pooled figure** — Senate (~92%) and governorships averaged
in with the House — **compared against a House-only benchmark.**
`sim/sweeps-full.ts` computes the pooled rate and the finding read it as a House
rate. **F9 already had the correct number**, reporting "representative 98.2%",
so `FINDINGS.md` contradicted itself for six findings and I quoted the wrong
half of my own file.

**+1 overshoots by 4.7 points, and raising it makes that worse**, so the sweep's
direction was right and its conclusion was not: there is no setting of this
modifier that lands on reality, because the modifier is not what sets the rate.

**What actually sets it is the contest rate.** Strip walkovers and contested
incumbents hold **78%**. An unopposed incumbent always holds, so at 92%
walkovers the reelection rate measures how rarely anyone is challenged. §16
calls incumbency "a calibration check on +1"; the check cannot run until races
are contested, and every number this report has quoted for it has really been a
measurement of F6.

**Method note.** This was caught by converting the prose to a predicate: the
predicate had to name which population it measured, and naming it exposed that
the prose had not. A sentence can hold two incompatible numbers for six
findings; a function cannot.

---

## F38. Party hardening does not emerge. One rule prices fluidity, and it now overcharges.

Zach's question: *how can party fluidity be the default state and party
hardening emerge from strategy?* The first half is already true and was true
before anyone asked. `PlayerState` is `{id, name, hand, districts, score,
tapped}` — **there is no party field**, and `engine/game.ts` says so at the top:
*"Players are not parties. A player is a faction holding cards of both parties
(§13), so score is per player and party is per card."* Players are party-fluid
by construction.

The second half does not happen. **Nothing in the engine rewards concentrating
a portfolio in one party**, and the portfolios prove it: mean *excess* party
concentration is **-0.006** — indistinguishable from what indifference to party
would produce.

**The measurement that nearly went wrong.** Ranking players by raw Herfindahl
says concentrating costs **46 points**. It does not. Herfindahl is biased upward
in small portfolios — four seats are far likelier to be all one party than
thirty are — so that ranking is a seat-count ranking wearing a disguise, and a
**6-seat gap** rides along with it. Subtract each portfolio's own expectation,
`H_board + (1 - H_board)/k`, and **the sign flips**. The apparent penalty for
party discipline was portfolio size the whole time.

### Why there is no force: the biggest party mechanic is state-scoped

`state lean` is the largest single modifier source in the game at **28.2%** of
all modifier mass, and the map genuinely hardens — mean lean per general side
grows **0.34 → 2.21 pips** across the five fifths of a game. But `applyPush`
writes lean **per state**, and `buildModifiers` grants it only when
`Math.sign(ctx.lean) === partySign`. The reward is for holding, in each state, a
card of *that state's* leaning party — and **97.5% of players hold districts
spanning both lean directions**. The optimal portfolio under §10 is a Democrat
in the D states and a Republican in the R states. *The engine's strongest
accumulating mechanic actively pays for a SPLIT portfolio.* The game hardens the
**map**, not the **players**.

### The one mechanic that prices fluidity, and the round it fires in

§12's cross-bench counter is the only rule that charges for party fluidity as
such, and its shape is right: permanent, card-scoped, and charged in the
**primary only**.

That round choice is load-bearing, for a reason that is not obvious. In a
primary every side is the same party in the same state, so `Wave` memoization
hands them **the same national and state die** — measured at **100.0%** of
contested primaries. A primary is a **1d6 vs 1d6** contest, SD **2.42**, not the
3d6-vs-3d6 SD of **4.18**. A 1-pip edge is worth **65.3%** in a primary against
**59.2%** in a general.

And the contest lives there. Generals are **83% walkovers**; primaries are
**99.7% contested**, because a primary only exists when two players crowd the
same party in the same race.

### The scaled penalty is now too strong

`abdc37d` restored §12's count and colour and fixed a real attribution bug —
`Vote` carried only `{player, party, office}`, so a player's whole delegation's
cross-bench votes landed on **one arbitrary card** (counts reached 145; properly
attributed the median is 2 and the max 30). *Every cross-bench incidence number
taken before that commit was measuring the bug.*

But scaling the penalty by the count overshoots:

| `crossBenchPrimaryPenalty` | lone cross-bencher wins his primary | mean pips |
|---|---|---|
| 0 | **56.7%** | — |
| **-1 (shipped)** | **33.4%** | 3.5 = **1.45 primary SD** |
| -2 | 20.9% | 5.5 = 2.29 primary SD |

**3.5 pips is 1.45 standard deviations of the round it fires in.** Benchmarking
it against 4.18 gives 0.84 and badly understates it — that is the general's
noise floor, and this modifier never appears in a general. §12 makes
cross-benching *structurally necessary* (*"bills essentially cannot pass without
cross-benching"*), so the engine now charges two thirds of a primary for doing
what the design requires. **It wants a cap**, not a different coefficient.

### The general term works, and fires in the wrong places

`crossBenchGeneral` (new, shipped at 0) prices a defection by whether it ran
with the state's drift. Its *levels* are confounded — "with the drift" means the
state is drifting away from the member's own party, so those candidates are
already losing on lean — so the statistic is the **gap**, which moves
monotonically:

| `crossBenchGeneral` | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| with-drift **minus** against-drift | **-36.4pp** | -11.6 | -2.9 | **+10.2** |

So the knob does what it was built to do. **But 74% of the races where it would
fire are in states with |lean| ≤ 3** — because a hardened state's general is a
walkover 96% of the time. *The term keys on a drift signal precisely where that
signal is weakest.*

### The walkover asymmetry, which settles the conditioning question

| \|lean\| | contested primary | contested general | ratio P:G |
|---|---|---|---|
| 0-1 | 8.0% | 21.3% | **0.37** |
| 2-3 | 24.4% | 14.0% | 1.74 |
| 4-5 | 27.5% | 7.1% | 3.87 |
| 6-8 | 28.2% | 3.8% | **7.45** |

*120 games/arm; the predicate stamps the same two ratios at 50 games, where the hardened bucket reads 6.1.*

**A 20x swing.** In a purple state the general is the real election; in a
hardened state only the primary is. This is exactly the shape US politics has,
and it arrives for free from the contest rate. **The primary penalty therefore
needs no state-lean condition** — the board already conditions it. The same
mechanism *indicts* the general term, which operates almost only in the purple
band.

*Canes-Wrone, Brady & Cogan (2002), "Out of Step, Out of Office" (APSR 96:1)
find incumbents take a **lower** general-election vote share the **more** they
support their party, and that it holds for safe members as well as marginal
ones. That supports a general term that rewards defection, and supports leaving
it unconditioned — but the walkover rate above means an unconditioned term still
only ever bites in purple states.*

**Predicate:** `findings/cross-bench-pricing.ts` (17 claims). **Sweep:**
`node sim/cross-bench.ts [games]`.
