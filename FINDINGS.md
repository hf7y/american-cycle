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

**+1 incumbency is correctly calibrated.** §16 calls it "a calibration check on
+1", and it passes within a point: simulated reelection 93% against a real
94.1% for the House 1976–2016. +2 gives 96%, +3 gives 97%. **Keep +1.** This is
the design's best single number, chosen before any of it was measured.

**The filibuster is what stalls the omnibill.** Bills pass 63% at a 50% Senate
threshold, 16% at the current 60%, and **0% at 67%**. Cross-benching is roughly
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
