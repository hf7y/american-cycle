# Decisions register

**Read this before changing anything in `design-doc.md`.**

The design doc says what the game *is*. This says what is **settled**, what is **open**, and what was **considered and cut**. The last category is the important one — most of the ideas below are attractive, and several were mine. They were removed for reasons, and an agent trying to be helpful will otherwise reinvent them.

---

## Settled — do not relitigate without evidence

| Decision | Why |
|---|---|
| 1 pip = 2 points of margin | Anchors every number to real political science; makes the odds table mentally computable |
| 3d6, split national / state / candidate | Same distribution as undifferentiated 3d6, but each die names its source of error and generates narrative for free |
| Dice are error, modifiers are the point estimate | Lets a player say "I'm up 8, that's 75%." A dice-heavy alternative makes cards feel like noise |
| Withdrawal closes before the deciding information | The only thing making cards actually die. Break this and the bench never depletes |
| Primary loss to hand, general loss to discard | Primaries cheap to enter, cost is card reveal. Generals are where attrition happens |
| Neutral lean means the state's *home* baseline, not purple | Board tracks deviation only. No state needs a printed number. Same logic as Cook PVI |
| Districts gate all races | The brake on wide-and-empty play. Presence must be purchased in the draft |
| District cards are captured on a win, not politicians | Models inheriting the machine; keeps the talon alive; makes the map genuinely contested |
| Heterodoxy ignores national *modifiers*, not the national die | Nobody is insulated from noise. Manchin was insulated from the tide |
| Endorsements are primary-only | The general effect is coattails, already modelled. A general endorsement double-counts |
| Governors never push lean | Falls out of the nationalization priority rule; Baker/Hogan/Scott are the evidence |
| Impeachment consumes the omnibill slot | Prices the coup in the currency everyone is accumulating |
| One macro number, not two | "How the country is doing" is honest. A separate ideological axis was double-counting |

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
