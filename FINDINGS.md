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
