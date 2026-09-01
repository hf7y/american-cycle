# Decisions register

**Read this before changing anything in `design-doc.md`.**

The design doc says what the game *is*. This says what is **settled**, what is **open**, and what was **considered and cut**. The last category is the important one — most of the ideas below are attractive, and several were mine. They were removed for reasons, and an agent trying to be helpful will otherwise reinvent them.

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
| **The House is a feeder, not a win route** | Ruled 2026-09-01. `HouseFarm` has won 0-0.6% of games in every engine version ever measured, including 0.1% at n=2400; the `what-wins` predicate puts House seats at 0.13x winner-to-field and calls holding them anti-correlated with winning. The House is a stepping stone to higher office and should stop being graded as a failed strategy |

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

1. **Decay frequency** — annual or biennial. Decides whether realignment is possible at all.
2. **Base hand size and office bonuses** — the master tuning knob for game length and runaway.
3. **District synergy magnitudes** — currently unbounded card text with no baseline. Must be tuned against specific historical cases: Manchin holding West Virginia, Collins holding Maine, Edwards holding Louisiana.
4. **District-to-candidate ratio per pack** — sets map fill rate and turn density.
5. **Victory condition** — bills passed, two consecutive presidential terms, three terms, or parallel conditions.
6. **Governor pushes** — never, or only when winning with the existing lean.
7. **Deck-out as the end condition** — whether it needs a year backstop.
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
