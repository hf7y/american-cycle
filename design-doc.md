# American Cycle
### A drafting and area-control game about electoral politics

**Design document — v0.2**

---

## 1. Core concept

Players draft historical American politicians and congressional districts, then run them for office across a decade or more of simulated election cycles. Politicians are consumed by defeat. Seats are held for their real terms — two years for the House, four for the presidency, six for the Senate, staggered per-state for governors — so every year of play has a different shape.

The game is Risk-like in structure: territory matters, presence compounds, and a player who is squeezed off the map cannot recover easily. It is Magic-like in extensibility: rules complexity lives in card text rather than in the rulebook, and packs are released by historical era.

The design has two theses it is trying to argue through play:

**Realignment is not inevitable.** It is the accumulated residue of individual races won by individual candidates. The board is a memory of who has been winning, not an independent simulation of national mood.

**Incoherent coalitions are rational.** A party holding contradictory positions is not confused; it is competitive. The heterodox candidate who survives a hostile state is the most valuable and most fragile card in the game.

**Players: 2–6.** Solitaire mode targeted for v2.

---

## 2. Components

**Board.** A map of the United States at state resolution. No districts printed. A per-state table of gubernatorial election years. Space for a national sentiment track and an accumulated-spending track.

**Candidate cards.** Real politicians. Each carries: name, party, home state, home-state bonus (printed, not global), identity tags, at most one belief, and optional rules text.

**District cards.** Numbered by state (OH-9, WY-1). Each carries demographic type tags and printed synergy bonuses. District cards are the gate on presence.

**Tokens.** Player pegs for seats. Red and blue counters for state lean and for card status. That is the entire token economy — one color pair doing all the work.

**Dice.** 3d6 per race.

---

## 3. The scale

**One pip equals two points of margin.**

Every number in the game is denominated in pips. This makes the design auditable against real political science and makes the odds mentally computable at the table.

3d6 has a mean of 10.5 and a standard deviation of 2.96. The difference between two 3d6 rolls has a standard deviation of 4.18 pips — about 8 points of margin, which is close to the real dispersion of district results around their fundamentals.

**The odds rule: nine points a pip out to +3, where you are three-in-four.**

| Edge (pips) | Win probability |
|---|---|
| 0 | 50% |
| +1 | 59% |
| +2 | 68% |
| +3 | 76% |
| +4 | 82% |
| +5 | 88% |
| +6 | 92% |
| +8 | 97% |

These are the exact odds for 3d6 vs 3d6 with ties broken evenly. The 9%-a-pip
linear rule is exact through +2 and within two points at +3; past that it
overshoots badly and the table should be read directly. Beyond +6, "very
likely."

The design intent is that an 8-point lead (+4 pips) is not a lock. At 82% it
is not, though it is a firmer favourite than a table-side reading of "three in
four" would suggest.

> **Corrected 2026-08-31.** v0.2 printed this table as 5% a pip with +4 at 75%,
> and claimed the linear rule tracked the true distribution within two points
> out to +6. It does not: 5%-a-pip implies a spread of about 5.9 pips, but
> 3d6 − 3d6 has a standard deviation of 4.18, so the real curve is materially
> steeper — +4 is 82%, not 75%. The dice are correct and the calibration to
> real dispersion in §3 stands; only the printed table and its rule of thumb
> were wrong. `engine/rules/resolution.ts` asserts the values above.

## 4. The three dice

Each race rolls 3d6, but the dice are **labeled by source of error**:

- **National die** — the wave. Same value for every race in the cycle.
- **State die** — how this state broke.
- **Candidate die** — how this candidate performed.

Same distribution as an undifferentiated 3d6, but every result tells a story: the wave came in hot, Ohio broke the other way, the candidate underperformed. Heterodoxy insulation works by ignoring the national die, which is only possible because the dice are named.

---

## 5. Card classes

### Candidates

**Identity tags** are stable and never change: Catholic, Veteran, Union, Evangelical, Rural, Cuban, Ivy. They match against district card demographics. Party is irrelevant to whether they fire — a Catholic Democrat and a Catholic Republican both unlock a heavily Catholic district. Identity bonuses should be **small and swing-proof** — recommend +1, and no interaction with the wave.

**Beliefs** are at most one per card, and exist only as rules text. There is no issue system, no salience deck, no position tracks. John Bel Edwards is pro-life, which reads as a bonus in Catholic districts. Bill Clinton is tough on crime. Nixon has an environmental clause. Barry Goldwater and Joe Lieberman are interesting because their baskets of views are unstable, and the game expresses that instability through where their bonuses fire, not through a tracked ideology.

**Home-state bonus is printed on the card, not global.** This matters: friends-and-neighbors voting has decayed with nationalization. Gore lost Tennessee. Trump lost New York. Ryan did not deliver Wisconsin. Print larger home-state bonuses on mid-century cards and smaller ones on modern cards, and the decline of localism falls out of pack rotation with no rule at all.

**Design constraint for card authors:** demographic and identity bonuses stay small and unconditional. Ideological or situational text may be larger but should be conditional. This is the only guardrail on power creep and it does not need to appear in the rulebook.

### Districts

District cards carry the demographic composition that cannot be printed on a board. They are numbered per state and bounded by that state's historical maximum delegation, so a state can never hold more districts than it ever had.

**District cards are era-stamped**, because boundaries change. LA-2 as drawn in 1992 and LA-2 as drawn today are different cards, with different demographics and different synergies, competing for the same peg. A rare gerrymandered majority-minority district is genuinely valuable — often the only path into a state that otherwise has none for that party.

This means the map contradicts itself across eras by design rather than by tolerance. A player holding a 1970s district card and a player holding its modern redraw are fighting over the same seat with different tools.

**District cards gate all races.** You may only run in a state where you hold a district card, or where your candidate is a native. This is the brake on wide-and-empty play: presence is scarce and must be purchased in the draft.

A district card boosts House, Senate, governor, and presidential runs in its state. It is an investment in a state, not just a seat.

---

## 6. The draft

Standard pack-pass draft: take one, pass the rest. A pass should take a few minutes.

Alternatives: bring a constructed deck, or draw from a common pool. Construction rules are undetermined; the natural discipline is that a narrow deck has no Senate coverage and no endorsement reach.

**Mid-game refill** is a fast single-card draw-and-pass from the talon, rotating until hands are at size. Refill is to full hand size every cycle.

**Hand size is the primary balance knob.** Base of roughly 12. Senate seat +1, presidency +2. Governors and House seats grant no hand size. Larger office bonuses make the leader's advantage more brutal and shorten the game; testing against target play length will settle it.

---

## 7. Sequence of play

The game runs on annual ticks. Election years are heavy; odd years are light.

### Every year

1. **Action phase.** Card abilities, appointments, tapping.
2. **The omnibill.** Proposal, negotiation, vote, veto.
3. **Reaction.** Rolled immediately on passage. Separate from the national die and resolved long before it.
4. **Fed check.** 2d6 roll-under against accumulated spending.
5. **Decay.** Remove one lean counter from every state.

### Even years, additionally

6. **Primaries.** Declaration, withdrawal, resolution. Endorsements spent here.
7. **General.** Declaration, withdrawal, national die, resolution.
8. **Election night.** Lean pushes, by margin.
9. **Seating, vacancies, appointments.**
10. **Refill to hand size.**

Decay and push are deliberately separated. Decay happens at the top of the year alongside the sentiment reaction, so the board players are looking at when they declare is the decayed board. Pushes land on election night, as results come in, which is where the drama belongs.

**Whether decay is annual or biennial is unsettled and matters a great deal.** Annual decay against biennial pushes means −2 per cycle against a push of at most +2, so only outright blowouts move the map at all. Biennial decay is −1 against the same, which is looser. See §10.

---

## 8. Declaration and withdrawal

This is the heart of the card economy and the most carefully tuned part of the design.

**Declaration is sequential around the table.** A player moves a peg onto a state and places a candidate card face down. Opponents see that a race is contested and can counter-declare, but cannot see the card.

**Withdrawal comes before reveal in the primary, and before the national die in the general.** You pull out on incomplete information. This is what makes cards actually die: by the time the arithmetic is knowable, it is too late to run.

**Withdrawal returns the card to hand.** It costs the opportunity to have played that card elsewhere, and it costs an incumbent their endorsement spend. The opponent takes the seat uncontested.

**Uncontested is an auto-win.** A player who fields nobody scores nothing. The counterplay to spreading thin is aggressive denial — but denial costs a real card against someone who may have spent nothing, and that asymmetry is why district gating is necessary.

**Primary loss returns the card to hand. General loss discards it.** Primaries are cheap to enter; the cost of a primary is that you have revealed your card. Generals are where the bench depletes.

---

## 9. Election resolution

```
TOTAL = national die + state die + candidate die
      + state lean counters (1 pip each, sign by party)
      + home state bonus (printed on card)
      + district card synergy (printed on card)
      + incumbency (+1)
      + endorsements
      + national modifiers
      + card text
```

Higher total wins.

### National modifiers

| Condition | Effect |
|---|---|
| Strong economy | +1 to the president's party |
| Recession | −2 to the president's party |
| Midterm year | −2 to the president's party |
| Presidential coattails | +1 to the winning party, down-ballot |

The asymmetry on the economy is deliberate and empirically grounded: voters punish downturns harder than they reward booms. It also means spending to juice the economy is a bet with a worse downside than upside, which is what gives the chicken game its edge.

The midterm penalty is one of the most reliable facts in American politics — the president's party has lost House seats in 19 of the last 21 midterms, averaging around 26 seats, roughly 3–4 points of national margin.

### Endorsements

**Endorsements are a primary mechanic only.**

| Endorser | Primary |
|---|---|
| President | +3 |
| Governor, in-state | +2 |
| Senator | none by default, card text only |

Presidential endorsements are enormous in primaries and near-worthless in generals — presidents campaign where they are already winning, so the measured general effect is close to noise. Gubernatorial endorsements are real but smaller, and in-state.

A general-election endorsement was double-counting: the presidential general effect already exists as coattails. So the general reads its national effect off the board instead.

**Turnout coattails.** In presidential years, the nominee's party gets **+1 down-ballot in states leaning their way and −1 in states leaning against.** This is the top of the ticket driving turnout, and it produces reverse coattails for free — an unpopular nominee drags his own party down in hostile states without any extra rule.

Senators do not endorse as a class, because most senators move nothing. The exceptions are ideological validators with national followings — Sanders, DeMint in the Tea Party era, Kennedy in 2008 — and those get printed text. Susan Collins may not have it even in Maine.

Endorsement is a tap. A card taps to endorse and untaps at cycle start. Incumbents may endorse and run in the same cycle.

### Primary versus general

The same card reads different numbers depending on the round.

| | Primary | General |
|---|---|---|
| Heterodoxy | penalty | ignores national modifiers |
| Extremism | bonus | penalty |
| Cross-benching | penalty | depends on sentiment |
| Endorsements | large | none |

**Heterodoxy buys insulation from the tide, not from noise.**

A heterodox candidate ignores the **national modifiers** — midterm penalty, economy, coattails. They do *not* ignore the national die.

This distinction matters. The national die is noise: turnout, weather, polling error. Nobody is insulated from that, and Manchin never was. What he was insulated from was the national partisan tide, and in this design the tide is the modifier stack, not the dice. Routing insulation through the modifiers also preserves the 3d6 distribution instead of quietly collapsing it to 2d6 with a different mean.

This is John Bel Edwards holding Louisiana in red years. Susan Collins is the mirror. These cards are the only way to win hostile terrain and the most likely to die before they get there.

**Extremism inverts it:** a bonus in the primary, a penalty in the general. Going extreme and winning anyway is shooting the moon — the payoff is simply the seat, which is the honest payoff.

**Independents** skip the primary entirely and forfeit party coattails. They vote on the omnibill. They may be endorsed, but only in generals and only for president.

---

## 10. State lean

Counters on the board, red and blue, cancelling on placement. **One counter is one pip, two points of margin.**

**Neutral does not mean purple.** It means the state's own home lean, whatever that is. The board tracks *deviation from baseline*, and the baseline lives implicitly in which politicians and district cards exist for that state. Nothing needs to be printed and no state needs a number. West Virginia at zero is a state where Joe Manchin wins most of the time, because his card is good and his district synergy is real.

This is the same logic as Cook PVI, which measures deviation from the national result rather than absolute partisanship.

### Pushes are margin-based

Lean moves on **election night**. One push per state per election, scaled by how decisively the race was won:

| Margin | Push |
|---|---|
| 0–1 pips (0–2 points) | 0 |
| 2–3 pips (4–6 points) | 1 |
| 4+ pips (8+ points) | 2 |

**A flat push cannot work.** Push +1 on any win against −1 decay means a party that wins a state every single cycle nets exactly zero, and nothing ever realigns. The game's central thesis would be unimplemented.

Margin-based pushes fix this and add something the design otherwise lacked: **a reason to want a blowout rather than a win.** Squeakers hold the seat and change nothing. A state realigns when someone wins it big, repeatedly — which is what realignments actually look like. It is also what PVI measures, since deviation is computed from vote share, not from who won.

### Which race sets the lean

**The most nationalized race on the ballot pushes.** Priority order:

1. Presidential
2. Senate
3. House delegation majority
4. Governor

Because presidential and midterm years always have something higher on the list, **governors never reach the top of the ordering and never push.** The exclusion falls out of the priority rule rather than being asserted as a special case.

The evidence is unusually clean. Gubernatorial races are the least nationalized contests on the ballot, which is exactly why they are so often won by the party that cannot carry the state federally: Baker in Massachusetts, Scott in Vermont, Hogan in Maryland, Beshear in Kentucky, Kelly in Kansas, Edwards in Louisiana. Senate races have gone the opposite way — in 2016 all 34 Senate races matched the presidential result in that state, and in 2020 only Collins split.

So winning a governorship in hostile territory is precisely the win that tells you nothing about a state's trend. Governors are points, appointments, and a launchpad, with no effect on the map.

**Alternative under test.** If never-push feels wrong at the table, the more nuanced version is: *a governor pushes only when winning with the state's existing lean, never against it.* A Republican winning Wyoming is a nationalized result and means something. A Republican winning Massachusetts is a personality and means nothing. One conditional, and it captures the exact asymmetry that makes governors strange.

### Decay and the honeymoon

Decay removes one counter from every state, at the top of the year in the phase after the Fed check — so the board players see when they declare is already decayed.

A newly elected president places one counter in every state carried. This is the honeymoon: real, and short. It is removed at the next decay, so the incoming party enters the midterm with a fleeting map advantage immediately before the −2 midterm penalty lands on them. That sequencing is very true to life.

Because deviation only persists while someone keeps winning decisively, holding a realignment requires sustained dominance. Heavily leaning states are not abandoned; their primaries simply become the real contest.

---

## 11. Offices

| Office | Term | Points | Hand | Endorses | Pushes lean |
|---|---|---|---|---|---|
| President | 4 yr | high | +2 | yes | yes |
| Senator | 6 yr, staggered | yes | +1 | card text only | midterms |
| Governor | per-state schedule | yes | — | in-state primaries | never |
| Representative | 2 yr | 0 or 1 | — | card text only | fallback |

**The House** gates bill majorities and is the cheapest way to convert a district card into a body on the board with incumbency. Because district cards transfer on a win, contesting House seats is how presence is taken away from an opponent — which makes a nominally 1-point seat into territorial warfare.

**Governors** appoint Senate vacancies, placing a card from hand with no election. They carry incumbency into Senate and presidential runs.

**The presidency** is won by taking the party nomination in a national primary — running in every state — so only two cards reach the general regardless of table size. It grants hand size, one endorsement per cycle, and the veto.

**The vice presidency** is a second card on the ticket. It does not score and is not consumed on a loss. It carries incumbency, may endorse in primaries, and adds a home-state bonus in the general. Its real function is as a bargaining chip during the nomination fight. It breaks Senate ties. It succeeds on a vacancy, and on succession the VP's original player scores.

---

## 12. The omnibill

Once per year, Congress passes one bill. Players name it in plain language for flavor; the name has no mechanical effect and should be funny.

**The bill is a single number, G**, from 1 to 6, representing spending and taxation collapsed together. Negative G — austerity — is legal, cooling the economy and reducing the Fed threat. It gives the minority something real to argue for.

**Authorship** goes to the player holding the largest bloc of the majority party in the House. Strictly propose-then-vote, with open negotiation beforehand and no formal amendment procedure.

**Passage requires** a House majority and 60% of the Senate. The filibuster threshold means bills essentially cannot pass without cross-benching, which makes cooperation structurally necessary rather than optional.

**The president may veto.** Override is two-thirds of both chambers and is nearly unreachable by design.

**Scoring:** every yes-voter scores, in both chambers, doubled for the majority party. This makes the bill a genuine cooperation game with a defection option, and it explains the veto without further rules — the president chooses between "everyone gains, my rivals gain more" and "nobody gains, and I own the stagnation." Vetoing makes most sense when a midterm has handed the opposition the majority.

**Reaction rolls immediately on passage.** A good reaction rewards yes-voters; a bad one penalizes them at the next election, in both the primary and the general. Passage matters, not just position: a symbolic vote on a failed bill earns heterodoxy credit but no points.

**Voting places a counter on the card**, colored by the party in power. Cross-bench votes therefore show as the opposite color. Sentiment at election time determines whether that counter is an asset or a liability, and the card's accumulated counters are simply read off at resolution. No separate tracking of who voted for what.

**The minority** gains no victory points while in the minority. Their reward for correctly opposing an unpopular bill is entirely electoral. Minorities play for position; majorities play for score; the flip between them is the rhythm of the game.

**Impeachment replaces the omnibill for that year.** The same coalition capable of passing a bill can remove a president, but doing so costs the year's scoring, and cross-benching is not incentivized the same way. Threshold is two-thirds of the Senate. **An impeached president leaves the game entirely** — not to the discard, out. It is the only permanent removal in the design.

---

## 13. The economy and the Fed

The macro layer is one number on one track: **how the country is doing**. There is no separate ideological axis. A boom helps whoever is in power regardless of party, and that is the honest abstraction.

The economy random-walks with memory. Spending pushes it up. The Fed pushes it down.

**Accumulated G** builds on a track. Each year the Fed checks **2d6 roll-under** against the accumulation. G12 is a certainty; the interesting range is 6 to 8, where the curve is steepest — the incremental cost of one more point of spending is highest exactly where players will hover.

**A rate rise** spends down the accumulated G, cools the economy number itself, and penalizes the majority's national modifier. The recession follows the tightening, so the player who juiced the economy may well have handed the downturn to someone else.

This is a game of chicken. Spend to boom, get your candidate into position, and be out of the way before the reckoning. A skilled player runs one party hot and pivots to the other in the recession year.

---

## 14. The talon and the end of the game

One shared discard pile. When the talon empties, the discard reshuffles into it. Defeated politicians circulate back through the draft, which is thematically correct and keeps the pool alive without a special comeback rule. A defeated card must wait for a reshuffle to return.

Reshuffle happens immediately on exhaustion. **If the discard is too thin to reshuffle, that is the deck-out ending.**

**Refill packs draw from later years**, so a game beginning in 1976 will be playing 2010s cards by year ten. District cards from different eras coexist on the map, and a 1976 politician running in a 2010s district is a feature — the demographic composition has shifted underneath them, and that is the game's argument about realignment stated as a card interaction.

**Victory** is under test. Candidates: total bills passed; two consecutive presidential terms; three terms. Parallel conditions keep multiplayer open, since two one-term presidents leaves the game unresolved. The end condition interacts with strategy in the core loop and with total play time, so it should be settled empirically.

---

## 15. Capture

**Districts are captured, not politicians.** Winning a seat transfers the district card to the winner. The defeated politician goes to the discard as normal.

This is the correct home for the mechanic. It models something real — you take the seat, you inherit the machine. It does not shrink the candidate pool, so the talon stays alive. And because districts gate all races in a state, capture turns the map into genuinely contested territory.

---

## 16. Open questions for playtest

**Decay frequency.** Annual or biennial. Annual is −2 per cycle against a maximum push of +2, meaning only blowouts move the map at all. Biennial is looser. This single number decides whether realignment is possible, and it should be settled by simulation before anything else.

**Whether margin-based pushes actually produce realignment.** The rule is designed to fix the flat-push pathology. Verify it does, and verify states reach durable 4+ pip leans over a decade rather than oscillating near zero.

**Governor pushes.** Never-push versus push-only-with-the-lean.

**Hand size against office bonuses.** Base 12 with president +2 is a 17% edge, which is mild. Risk-brutal requires either a smaller base or larger office bonuses. This is the single biggest tuning knob and it determines game length.

**District synergy magnitudes.** Currently unbounded card text. Tune against specific historical cases the game should reproduce: Manchin holding West Virginia in red years, Collins holding Maine, Edwards holding Louisiana.

**District-to-candidate ratio in a pack.** If a 15-card pack is mostly politicians, the map stays empty and turns are thin. Presence is now the bottleneck, so district supply sets the tempo of the whole game.

**Whether the House is entered at all.** It gates bills, so if early-game players skip it, the legislative layer stalls for lack of bodies. District capture is the current answer; verify it is enough.

**Whether wide-and-empty is dead.** District gating should kill it. Confirm under actual play with a player actively trying to break it.

**Whether the leader runs away.** Hand size, endorsements, and capture are three stacking positive-feedback loops. The intended brakes are the midterm penalty, recession, and other players ganging up. Verify those are sufficient.

**The VP backstab.** Placing your VP on a rival's ticket and then joining a coalition to impeach him hands you the presidency. It is thematically delicious and possibly too strong. The party-wide penalty from impeachment may be enough of a brake, since it hits the coalition that installed the president in the first place.
