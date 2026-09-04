# Decisions register

**This is the design record. There is no design document.**

`design-doc.md` was reaped on 2026-09-01, and Zach accepted the reap the same day when
asked directly whether to revert it. It is archived in the vault at
`hf7y/ecosystem1-vault` commit `0746d7f`. It had ONE commit in its entire history and was
never edited, while the engine moved through two tags and 38 findings -- and it lost every
argument with the code it was meant to specify: its own odds table carried a correction to
itself, its push table is contradicted by MIT returns (#51), and all four of its victory
candidates were measured as failing (#13). Nine config files and 213 code comments cited it
by section number, so a document nobody updated was dragging the repo behind it.

The engine is the spec. This file is what is **settled**, what is **open**, and what was
**considered and cut**.

**Section numbers (`§N`) in code comments refer to that retired document.** They are
historical citations, not live pointers. Do not add new ones; when you touch one, state the
rule instead of citing a section. The last category is the important one — most of the ideas below are attractive, and several were mine. They were removed for reasons, and an agent trying to be helpful will otherwise reinvent them.

---

## Settled — do not relitigate without evidence

| Decision | Why |
|---|---|
| 1 pip = 2 points of margin | Anchors every number to real political science; makes the odds table mentally computable |
| 3d6, split national / state / candidate | Each die names its source of error and generates narrative for free. **The "same distribution as undifferentiated 3d6" half of this is false in a primary** — see below |
| Dice are error, modifiers are the point estimate | Lets a player say "I'm up 8, that's 75%." A dice-heavy alternative makes cards feel like noise |
| Withdrawal closes before the deciding information | The only thing making cards actually die. Break this and the bench never depletes |
| Primary loss to hand, general loss to discard | Primaries cheap to enter, cost is card reveal. Generals are where attrition happens |
| Neutral lean means the state's *home* baseline, not purple | Board tracks deviation only. No state needs a printed number. Same logic as Cook PVI |
| Districts gate all races | The brake on wide-and-empty play. Presence must be purchased in the draft |
| District cards are captured on a win, not politicians | Models inheriting the machine; keeps the talon alive; makes the map genuinely contested |
| ~~Heterodoxy ignores national *modifiers*, not the national die~~ | **CUT 2026-08-31 — see below** |
| Endorsements are primary-only | The general effect is coattails, already modelled. A general endorsement double-counts |
| Governors never push lean | Falls out of the nationalization priority rule; Baker/Hogan/Scott are the evidence |
| Impeachment consumes the omnibill slot | Prices the coup in the currency everyone is accumulating |
| One macro number, not two | "How the country is doing" is honest. A separate ideological axis was double-counting |
| **The House is a feeder, not a win route** — *contested, see below* | Ruled 2026-09-01. `HouseFarm` has won 0-0.6% of games in every engine version ever measured, including 0.1% at n=2400; the `what-wins` predicate puts House seats at 0.13x winner-to-field and calls holding them anti-correlated with winning. The House is a stepping stone to higher office and should stop being graded as a failed strategy |
| **No year cap. `billTarget` is the only length knob** — *amended 2026-09-01, superseded 2026-09-04, see below* | Ruled 2026-09-01 ("infinity"). With bills as the victory condition the game was measured to end itself: at `maxYears: 10000`, **100% of games terminate** at targets 5/8/12 on both shipped configs, target 8 giving a median of 11-12 years. **That does not reproduce.** `as-written-plus` now ships `maxYears: 100` as a backstop; the amendment records why |
| ~~Bills passed is the victory condition~~ | **REVERSED 2026-09-04 — see below, hf7y/american-cycle#145** |
| **Scoring stays points; bills are points among others; the amendment is the ending** | Ruled 2026-09-04, reversing the row above. See below |

### Amendment, 2026-09-01: the no-cap ruling does not survive measurement

The "infinity" ruling rests on the claim that **100% of games terminate** at target 8 with a median of 11-12 years. Re-measured on `as-written-plus` at `maxYears: 100000`, 20 games a cell, it does not hold — **and the reason is the agent pool, which the original measurement did not vary**:

| pool | ended | median | within 100y |
|---|---|---|---|
| `Greedy, Lookahead, SenateFlood, HeterodoxSpecialist` — the pool 6 of 11 findings use | 11/20 | 91y | 6/20 |
| `BillMaximizer` x4 | 20/20 | 13y | 20/20 |
| six-way with `BillMaximizer` and `EconomyChicken` | 18/20 | 17y | 15/20 |

A pool that chases bills ends fast, and matches the ruling. A pool that does not chase them may never end at all: `billsBy` credits the **author**, the largest bloc of the majority party in the House, so a table with no bill-chaser accumulates authorship slowly while passage itself needs a House majority AND 60% of the Senate. At six players the fragmentation is severe enough that one trace passed **2 bills in 200 years**.

The design's own backstop cannot catch this. §14 has defeated politicians circulate back through the draft, and circulation wins: the talon and discard **grow** from 79 to 273 cards over a century, so `deckOutEnds` never fires. With no cap and no deck-out, a game that does not reach the target does not end.

**So `maxYears: 100` ships as a backstop, not as a length knob.** It binds in about 70% of games for the passive findings pool and in none for a bill-chasing one. `billTarget` remains the intended length control; the cap exists so that an unfinished game is bounded rather than infinite.

**What would restore the ruling** is making the deck-out backstop reachable — that is the real defect, and it is upstream of this. Until then, "no cap" and "the game ends itself" are not both true.

### Correction, 2026-08-31: the split is NOT distribution-neutral

`Wave` memoizes the national die by party and the state die by party+state, so
two sides of a **general** draw independently and it really is 3d6 vs 3d6. But
every side of a **primary** is the same party in the same state, so both are
shared and only the candidate die differs. **A primary is 1d6 vs 1d6, SD 2.42
against the general's 4.18.** §3's odds table — the one `resolution.test.ts`
guards as "the foundation the rest of the game sits on" — describes the general
only:

| edge | general 3d6 | primary 1d6 |
|---|---|---|
| +1 | 59.2% | 65.3% |
| +2 | 67.9% | 77.8% |
| +4 | 82.5% | 94.4% |
| +6 | 92.1% | **100.0%** |

At +6 a primary is decided before the dice leave the hand. Consequences already
acted on: a primary-only modifier judged against 4.18 is understated by ~1.7x,
which is how the cross-bench penalty shipped at ~1.5 SD; and `incumbency` was
split into `incumbencyPrimary` because one scalar cannot serve two
distributions. Anything primary-only must be priced against 2.42.

### Correction, 2026-08-31: heterodoxy was a net liability, and is cut

The exemption WORKED — 0.00% of 11,611 heterodox general sides carried a
national modifier against 43.95% of orthodox sides — and was worth **+0.316
pips** averaged over a heterodox card's generals, 7.6% of the general's 4.18
SD and below this game's own 1-pip granularity. National modifiers fire only
when the president's party matches the card's, so 56% of sides never saw one
and the mean was −0.72 where they did.

The same tag charged **−2** in the primary, which at 1d6 is 0.83 SD. 114 of 346
cards paid two pips in the round that is 100% contested to save a third of a
pip in the round that is 83% walkovers. **Nobody would take that tag if they
were choosing.**

The primary half was already duplicated, EARNED, by §12's cross-bench counter:
a politician punished for a defection they actually cast on a bill that
actually passed, rather than for a printed label. `Modifier.national` went with
the tag — the exemption filter was its only reader.

What the tag was labelling survives as a derivation, and is better for it: a
candidate is off-brand where their identities match the district while the
state's lean points against their party, which is era-dependent in a way a
printed tag cannot be. Manchin reads heterodox in 2018 and perfectly orthodox
in 1958. `sim/agents.ts`'s `HeterodoxSpecialist` now detects it that way.

**The two rulings above collide, and the collision is measured.** Under a bills victory with no cap, `BillAuthor` and `HouseFarm` take **90-99% of all games** between them (tuned, target 8: 62% / 37%), while `SenateFlood` — which wins 40-63% under points — wins **0%**. Bills are passed by House votes and credited to the largest House bloc, so an ending that counts bills makes the House the game. Whichever ending is counted, the strategy that farms it takes everything: points hands the game to the Senate, bills hand it to the House. The feeder ruling is not true under the ending that was also ruled, and one of the two has to move. See hf7y/american-cycle#13 and hf7y/american-cycle#50.

### Amendment, 2026-09-02: "1 pip = 2 points" is a conversion, not a claim about dispersion

Ruled on hf7y/american-cycle#11. The settled line fixes the *conversion* — it
anchors the vocabulary to a real unit and makes the odds table mentally
computable. It never should have been read as a claim that the resulting
margin distribution matches the real one's shape, and any prose that read it
that way is withdrawn.

`findings/margin-ceiling.ts` measures the shape and finds the sim's spread
compressed against the real bimodal one: median 8pts against a real 32.5, 0%
of races at 40+ against a real 37.5%. That gap is not evidence against the
conversion. **A locked-down district shows up in this engine as a race the
other side does not contest, not as a forty-point beating** — the two
distributions are answering different questions, so comparing their shapes
directly is not a like-for-like calibration check.

Widening the pip scale to close the gap was considered and rejected. Two
different changes hide behind "widen the scale": relabeling the conversion
(1 pip = 4 points) changes nothing, since every number in the game — including
the dice — is denominated in pips and every ratio is unchanged; widening the
*spread* of printed modifiers would make safe seats genuinely unlosable,
compounding hf7y/american-cycle#94 ("+6 is unbeatable, and 354 of 354 confirm
it") rather than fixing this.

The margin-distribution comparison retires as a calibration check. The honest
comparison is effective competitiveness — the band hf7y/american-cycle#93
built in `tracks/history.ts` — measured on the historical side now and
deferred on the sim side to hf7y/american-cycle#91, because that figure is
deck-sensitive and needs its flag first.

### Reversal, 2026-09-04: the collision above is resolved by moving the ending, not the feeder ruling

Ruled directly on hf7y/american-cycle#145: "the ending is points where bills
are points and it's triggered by the amendment." This resolves the collision
the 2026-08-31 correction above measured and named out loud — bills as a
count-to-target made `BillAuthor`/`HouseFarm` take 90-99% of games, which
contradicted the House-is-a-feeder ruling under its own numbers. This ruling
moves the ending, not the feeder row: **`as-written-plus.json` now ships
`victory: 'amendment'`, not `victory: 'bills'`**, and `billTarget` is gone
from that config. Scoring itself did not change — `scoring.billOnBooks`
already counted a bill still on the books as board points, same as it always
has; only the count-to-a-target win condition is removed.

The amendment ending was not speculative going in: `findings/amendment-is-the-ending.ts`
(stamped from this ruling) measures the passive pool (`Greedy`, `Lookahead`,
`SenateFlood`, `HeterodoxSpecialist`, `as-written-plus.json`, `maxYears: 100`,
n=120) and finds ratification ends **57%** of games outright, the 100-year
cap still binds **42%** of the time — a real backstop, not a formality — and
deck-out fires in **0%**, matching the no-cap amendment's finding that
circulation regrows the talon faster than it empties. No game reports the
retired bill target as its ending.

**What this does NOT settle**, named directly on #145 and left as open
questions rather than answered here:

- hf7y/american-cycle#50 — `SenateFlood` wins 40-63% of games under a points
  ending on `tuned.json`; whether that dominance is a hole in the design or
  an artefact of that config comes back **live** under this ruling, not
  resolved by it.
- hf7y/american-cycle#13 — which offices the winner actually holds
  (`findings/what-wins.ts`) was measured under the old ending and needs
  re-measuring under this one. `findings/what-wins.ts`, `findings/runaway-no-brake.ts`,
  `findings/adversarial-counters.ts`, `findings/impeachment-reachability.ts`,
  `findings/decay-push-tradeoff.ts` and `findings/contest-vs-walkover.ts` all
  depend on `as-written-plus.json`'s behavior and will read STALE against
  their old stamps because the engine genuinely moved under them — that is
  expected, and restamping any of them is answering #13 or #50 by the back
  door, not this ruling. Leave them stale until each is deliberately
  re-measured on its own issue.

---

## Cut — do not reintroduce

These were considered in design and rejected. Each has a plausible-sounding case for adding it back. Don't.

**Salience decks and per-issue tracking.** Flipping 2–3 live issues per cycle. Cut because it is a state machine with nowhere to live on the board.

**Position markers (Oppose / Hedge / Support) on candidate cards.** Cut for the same reason. Beliefs are card text and at most one per card.

**Issue polarity flips and party realignment tracks.** Cut. Realignment is encoded in state counters and in which cards happen to be good, not in a tracked platform object.

**The "Evolve" action for changing positions over time.** The Obama gay-marriage case was the motivating example. Solved instead with card text plus one counter. No action, no track, no marker movement.

**Ratchet vs pendulum issue tracks.** Cut with the rest of the issue system.

**Capturing politician cards.** Replaced by capturing district cards. Politician capture permanently shrank the talon and modelled nothing real.

**A separate left–right national axis alongside the economy.** Collapsed into one number.

**Presidential endorsements in the general election.** Cut; coattails already covers it.

**Flat +1 lean pushes.** Mathematically broken against decay — a party could win a state every cycle for a decade and move the map zero. Replaced by margin-based pushes.

**Tracking bill authorship for penalties.** Too complex. Pain goes to the party and to yes-voters, read off card counters.

**A Fed with appointments, interest rates, inflation, and unemployment as separate systems.** Collapsed to one accumulated-spending track and a 2d6 roll-under.

**The governing rule:** *if it cannot be a token on a card or a counter on the board, it does not exist.* When in doubt, apply this and cut.

---

## Open — do not guess, flag instead

Ordered by how much the answer changes the game.

1. ~~Decay frequency~~ — **answered**, `findings/decay-push-tradeoff.ts`: annual decay is the best configuration measured, but only paired with the push table raised to 2/3/4. Annual decay at the shipped push table realigns almost nothing (0.4 states/game) — it is the push table that has to outrun the decay, not the decay that has to be slowed. Shipped on `as-written-plus.json`.
2. **Base hand size and office bonuses** — the master tuning knob for game length and runaway.
3. **District synergy magnitudes** — currently unbounded card text with no baseline. Must be tuned against specific historical cases: Manchin holding West Virginia, Collins holding Maine, Edwards holding Louisiana. Open per hf7y/american-cycle#27.
4. ~~District-to-candidate ratio per pack~~ — **measured, not settled**: `draft.districtsPerPack` was dead (hf7y/american-cycle#87 found it read nowhere) and is now wired into `defaultPick`'s draft heuristic. But swept across its whole range the district count it was assumed to set doesn't move — see hf7y/american-cycle#132, which reopens the actual question: something else pins district holdings near a fixed value per player, and nobody has found what yet.
5. ~~Victory condition~~ — **settled**, see the Settled table above: points, with the amendment as the ending, ruled 2026-09-04 (hf7y/american-cycle#145), reversing the 2026-09-01 bills-passed ruling wired on `as-written-plus.json` (`victory: 'amendment'`). hf7y/american-cycle#13 measured the other three win-condition candidates failing under the earlier ruling and is reopened by this one for the offices question specifically, not the win-condition question.
6. ~~Governor pushes~~ — **measured, hf7y/american-cycle#26**: `with-lean` moves neither realignment (3.43 vs 3.46 states/game, n=400) nor the governorship's winner-advantage ratio (1.73x vs 1.56x) once `resignToRun`/`oddYearGovernors` are on. Stays `never` on every shipped config; `governors-push.json` remains as the shipped contrast.
7. ~~Deck-out as the end condition~~ — **settled in part**, see the no-cap amendment above: `maxYears: 100` ships as a length backstop because deck-out itself does not reliably fire (circulation regrows the talon faster than it depletes). Making deck-out itself reachable remains unresolved and is called out there as "the real defect."
8. **Whether capture is too strong** — parked; reintroduce only if balance requires it.

If an implementation question is not answered by the design doc, **it is probably on this list.** Add to it rather than inventing a rule, and note the placeholder you used.

---

## Untestable by simulation

The social layer is a large fraction of this design and none of it can be measured by agents:

- Negotiation before the bill vote
- VP horse-trading during the nomination
- Coalition-building for impeachment
- Naming the omnibill
- Table politics against a runaway leader

Where a finding depends on any of these, recommend a human playtest rather than a parameter change.
