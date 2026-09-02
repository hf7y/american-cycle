# Historical expressiveness register

**What the game should be able to produce, and what currently cannot happen.**

A case earns its place here only if it is famous enough that a player would
notice its absence, and specific enough to grade. Each names the mechanic it
stresses and a pass condition. Seven of them are **currently impossible**, and
those are marked — they are the design findings, not the flavour.

The standard is *possible at a plausible rate*, never *reproduced*. A game that
forces Truman to win in 1948 is a worse game than one where he wins one time in
five.

> **Revision note, 2026-09-02.** Verified against primary sources; three
> corrections applied (D2, H1, F1) and marked ⚠. Two cases added (F5, F6), one
> quantified pass condition added (G1), and sections C1/G3/H2 are now understood
> as one parameter — see **The nationalization knob** below, which changes what
> C1's fix should cost.
>
> **Second revision, 2026-09-02, vetted against the engine at tag `v0.2`.**
> Three claims checked in code rather than accepted:
> **A2 confirmed and quantified** — the +6 ceiling is real and the curve is now
> measured. **The F-section's blocker is GONE** — cross-bench voting returns
> 77.9 votes a game at v0.1.2 and 125.8 at v0.2, so F5/F6 are not blocked and
> item 7 of the closing list is stale. **E1 answered** — a primary loser cannot
> currently re-declare, because the declaration window closes before any primary
> resolves. One source reconciliation added at C1.

---

## The nationalization knob — read before section H

C1, G3, H1 and H2 are not four phenomena. They are four measurements of one
era-varying parameter, and treating them separately will produce four knobs
that have to be tuned into agreement by hand.

The mechanism is documented: Jacobson's account of the incumbency decline is
titled *It's Nothing Personal*, and the cause it identifies is nationalization
— party loyalty and straight-ticket voting eating the personal vote. The same
trend produces presidential/congressional lean divergence (C1), landslides that
don't carry down-ballot (G3), split-ticket collapse (H2), and the rise and fall
of incumbency advantage (H1).

**Design consequence: C1's two-track fix gets cheaper than it looks.** Add two
lean tracks per state with an era-varying *coupling* between them, and let that
single per-pack number drive all four cases. Tight coupling gives 2016; loose
coupling gives 1972. H1 becomes a consequence rather than an independent value,
and H2 becomes the validation rather than a separate test.

This also sharpens C1's "test for emergence first" instruction: district-card
inertia can produce a lag, but it cannot produce a lag that *narrows across
eras*. If the trend is what you want, inertia alone will not get there.

---

## A. Upsets — does the tail work?

### A1. Truman, 1948 — IMPORTANT
Every poll wrong; the incumbent wins from behind on fundamentals.

**Tests** the corrected odds table's tail. At −4 pips an underdog should win
about 18% of the time in a general.

**Pass:** a candidate trailing on modifiers by 4 wins roughly one general in
five. Also exercises VP succession, since Truman reached the office through
FDR's death.

**Note:** the pass condition is a generic tail test, not a Truman test. Truman's
actual situation was worse than −4 and included a three-way coalition split
(Thurmond right, J. Wallace left) — see the comeback-rate concern in
TEST-PROGRAM.md, currently 0–1.3%.

### A2. Eric Cantor, 2014 — **CURRENTLY IMPOSSIBLE**
A sitting House Majority Leader lost his own primary.

A primary is 1d6 vs 1d6, so the maximum dice difference is 5 and **+6 is
literally unbeatable** — PROGRESS.md already records +6 → 100.0%. An incumbent
with `incumbencyPrimary` plus a presidential endorsement clears +6 routinely.

✅ **Confirmed at `v0.2`**, 1,244 contested primaries over 40 games on `tuned`.
The cliff is exactly where the arithmetic says:

| modifier gap | 0 | 1 | 2 | 3 | 4 | 5 | **6** | 7 | 8 | 9 | 10+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| favourite loses | 51.1% | 29.7% | 14.5% | 9.6% | 6.2% | 2.9% | **0.0%** | 0.0% | 0.0% | 0.0% | 0.0% |

354 primaries were decided at a gap of 6 or more and the favourite lost **none**
of them. Largest gap observed: 16, nearly three times the dice range.

**Finding:** no favoured incumbent can ever lose a primary. Renomination is
safe in reality (House incumbents lose 1–2% a cycle) but it is not *certain*,
and the difference between 1% and 0% is the entire Tea Party.

**Fix candidates:** widen the primary's candidate die, cap the primary modifier
stack below the dice range, or give the primary its own noise term.

### A3. Roy Moore / Doug Jones, Alabama 2017 — **CURRENTLY IMPOSSIBLE**
A candidate-specific catastrophe flips a state that leans ~30 points the other
way. Todd Akin 2012 is the same shape: polling ahead, lost by 15, on one
sentence.

**Off-scale.** At 1 pip = 2 points, Akin's collapse is ~13 pips. The entire
modifier range is roughly ±8 and the candidate die spans ±5.

**This may be a deliberate omission rather than a gap.** An October surprise
that large breaks the scale, and adding a fat tail to the candidate die would
degrade the whole odds table to buy one effect. But it should be a decision on
the record, because "the scandal that loses a safe seat" is a recurring feature
of American politics and the game currently says it cannot happen.

### A4. Scott Brown, Massachusetts 2010 — **CURRENTLY IMPOSSIBLE**
A special election in a wave year takes a seat nobody thought was in play.

Safe seats are uncontested, and an uncontested race discards its modifier stack.
No wave can flip a seat with no opponent. See ISSUES #1, #2, #4.

**Scale of the blocker:** 76–81% of races are uncontested and only 30–33% of
race slots draw more than one declarer. This is not an edge case; it is most of
the board.

---

## B. The heterodox survivor

### B1. Manchin (WV), Collins (ME), Edwards (LA), Ben Nelson (NE), Zell Miller (GA)
The canonical set. Each holds a seat their party cannot otherwise hold.

**Tests** signed per-card tag weights (ISSUES #3). Pass condition: each card,
played in its own state in a hostile national year, wins meaningfully more often
than a generic co-partisan does.

**Note:** these are the cards that justified the heterodoxy tag, which was cut
on measurement. They should be re-tested against signed weights before anyone
argues the mechanic back.

**Era caveat:** this archetype is dying for the reason in the nationalization
note. Collins was the *only* split-ticket Senate outcome in 2020. A pack-stamped
coupling value should make heterodox survivors common in early packs and nearly
extinct in late ones — that is itself a good test of whether the knob works.

---

## C. Realignment and its lags

### C1. The Solid South, 1964 → 1994 — **CURRENTLY IMPOSSIBLE**
Goldwater takes five Deep South states in 1964. Those states keep sending
Democrats to the House for **thirty more years**.

**Measured lag** (congressional roster, 80th–119th Congress, five Deep South
states): 0% Republican House seats 1947–1963; 18.9% in 1965; back to 16.2% in
1967; 25% in 1973; majority only in 1995 at 61.1%. Thirty years from lean to
seats, with the initial spike partly reverting.

⚠ **Two series, and the gap between them is a phenomenon.** The committed MEDSL
panel (`data/historical/house_district_panel.json`, election returns) gives the
same five states as **50.0% in 1994** and 69.4% in 1996 — not 61.1% in 1995.
Both are right: the roster counts seats *held* in the seated Congress, the panel
counts seats *won* at the election, and the 11-point difference is Southern
Democrats **switching party after the 1994 election**. The engine has no
party-switch mechanic at all, so whichever series is used as the target, that
step is unreachable. Worth its own case if anyone wants it.

**One lean number per state cannot carry this.** Presidential lean and
congressional lean diverged by a generation, and that divergence *is* the story
of postwar southern politics. A single counter stack forces them to agree.

**Fix candidate:** two lean tracks per state, presidential and congressional,
pushed by their own races and decaying independently, with an era-varying
coupling between them (see the nationalization note — the coupling is the same
knob H1 and H2 need).

Cheaper alternative worth testing first: since House races only exist where a
district card is in play, delegation lag may emerge from district card
inertia alone. Measure before adding a track. But note inertia cannot produce a
lag that *narrows* across eras.

**Incumbency is ruled out as the mechanism.** Deep South Democrats' median
House service was 12.0 years against 11.9 for non-South Democrats, with
identical p75 (19.9) and p90 (29.8). No tenure anomaly exists, so the seats were
not held by unusually long careers — they were held by new Democrats repeatedly
winning open seats in districts voting 70–87% Republican for president. Any fix
that routes through incumbency is solving the wrong problem.

### C1b. The bloc shops — Thurmond '48 → Stevenson '56 → Goldwater '64 → Wallace '68 → Carter '76
Stronger than C1's endpoints and a harder test.

The same states backed a Dixiecrat, then a Democrat, then a Republican, then a
third-party segregationist, then a Democrat again — five vehicles in
twenty-eight years, one stable underlying interest. In 1956, four of the states
Thurmond had carried went for **Stevenson**.

**Pass:** a state's winning party changes repeatedly while the winning
candidate's tag-fit stays stable. A game that moves lean monotonically from D to
R across thirty years passes C1 and still gets the history wrong.

### C2. West Virginia, 2000 → 2016
Reliably Democratic to deepest Republican inside one generation.

**Tests** whether margin-based pushes plus decay produce a durable 4+ pip move
(F23, F24). Currently 0.2 states per game reach that; the uncontested-push fix
raises it to 7.4.

### C3. California, 1988 → 1992
A Republican presidential lock becomes a Democratic one in a single cycle.
Tests fast realignment against C1's slow one — the game should produce both.

---

## D. Primaries that decided things

### D1. Eugene McCarthy, New Hampshire 1968 — **CURRENTLY IMPOSSIBLE**
He *lost* the primary with 42% and a sitting president withdrew from the race
three weeks later.

A lost primary returns the card to hand and has no other consequence. There is
no mechanism by which a strong showing damages the winner, and no mechanism by
which an incumbent declines to run.

**Fix candidate:** a primary margin below some threshold puts a counter on the
winner, read in the general. Cheap, uses existing counters, and it makes
contesting a hopeless primary rational — which is also a lever on the walkover
rate.

### D2. Goldwater 1964, McGovern 1972 ⚠ CORRECTED
Extremist takes the nomination, loses the general catastrophically.

**Tests** `extremistPrimary` / `extremistGeneral`. Currently a flat +2/−2, which
reproduces the loss but **erases the geography** — Goldwater lost 44 states and
won five Deep South states plus Arizona. Signed tags (ISSUES #3) are what make
his map look like his map.

⚠ **Correction:** Goldwater was the first Republican since Reconstruction to
carry Alabama, Georgia, Mississippi and South Carolina — **not Louisiana**.
Eisenhower carried Louisiana in 1956, the first Republican to take any Deep
South state since Hayes in 1876. Four of five, not five. (The 1964 *House*
gains are first-since-Reconstruction in the strong sense: Georgia since 1874,
Alabama and Mississippi since 1876.)

### D3. Tea Party 2010 — O'Donnell (DE), Angle (NV), Buck (CO)
Extremists win primaries and hand the other party three winnable Senate seats.

**Tests** the extremist mechanic doing its intended job: the primary bonus is a
trap. Pass condition: an `extremist` card wins its primary meaningfully more
often *and* costs its party seats it would otherwise hold.

### D4. Mourdock over Lugar, 2012
A 36-year incumbent loses a primary to an extremist, and the party loses the
seat. Blocked by A2 — verify the fix admits this.

---

## E. The primary loser's second life

### E1. Lieberman 2006 — ⚠ ANSWERED: NOT LEGAL
Lost his own party's primary, ran as an independent in the general, **won**.
Murkowski 2010 is the same shape as a write-in.

The rules give both halves: a primary loss returns the card to hand, and
independents skip primaries and forfeit coattails. But whether a card that just
lost a primary may re-declare as an independent in the same cycle **has never
been stated or tested.**

⚠ **Checked at `v0.2`: it is not possible, and the reason is structural rather
than a missing clause.** Every declaration for the cycle is collected in one
phase (`engine/game.ts:949`) before any race resolves; primaries run inside
`resolveDeclared` (`:1038`) and a loser is returned to hand at `:1246`, by which
point the declaration window has closed. So the card is back in hand and cannot
be played again until the next cycle. Allowing Lieberman needs a **second
declaration window after the primaries**, not a permission flag — which is a
larger change than "one clause", though still self-contained.

**Highest flavour-per-byte item on this list.** If it is already legal, it needs
a test asserting it. If not, allowing it costs one clause and buys one of the
best stories in modern Senate politics.

### E2. Wallace 1968, Perot 1992
Wallace won five states and 46 electoral votes. Perot took 19% and none.

**Tests** whether an independent presidential run can take states without
winning, and whether it can throw an election. The electoral college exists
(`electors = delegation + 2`), so this is checkable now.

---

## F. Heroes — the costly vote

This is the group the RPG layer exists to serve, and the mechanism is already
built: cross-bench, take a counter in the opposite colour, face the reaction
roll and then the primary penalty.

**F1–F4 are individual. F5–F6 are the leader-scale and structural versions of
the same register.**

✅ **The blocker is gone — this section is open for work.** `BillOutcome.crossBenched`
was suspected unreachable. It is not: Track B item `B4-cross-bench` measures
**77.9 cross-bench votes a game at v0.1.2 and 125.8–140 at v0.2**, frozen in
`reports/tracks-v0.1.2.json` and `reports/tracks-v0.2.json`. Cross-benching is
live, common, and already priced (`crossBenchPrimaryPenalty`, `crossBenchCap`,
and the reaction roll). Nothing in section F is waiting on a measurement.

### F1. Edmund Ross, 1868 ⚠ VERIFY
Cast the deciding vote to acquit Andrew Johnson. Never won elective office
again.

⚠ Two claims to check before asserting: Ross was later appointed territorial
governor of New Mexico, so "never held office again" is likely wrong — "never
won elective office again" is the safe form. And the "deciding vote" framing is
contested; several senators were reportedly prepared to acquit had their votes
been needed, which makes Ross less the lone hero than the one who drew the short
straw. That is arguably a *better* fit for a dice game and worth a line either
way.

**Pass:** a cross-bencher on a badly received bill loses their next primary at a
high rate. This should be *punishing* — the mechanic's honesty depends on the
downside being real.

### F2. Margaret Chase Smith, 1950
The Declaration of Conscience was **a speech, not a vote**. She broke with
McCarthy while casting no ballot against him.

**Nothing mechanical to test — and that is the point.** This is the single best
argument for writing the bill-debate prose section: the game's most admired act
of political courage produces no counter, no modifier, and no die roll. If the
rulebook has no room for a speech, it has no room for Margaret Chase Smith.

### F3. McCain, 2017
A cross-bench vote that killed a bill and was *not* punished.

**Pass:** the reaction roll must genuinely cut both ways. If F1 always destroys
and F3 never happens, the mechanic is a penalty rather than a gamble.

### F4. Sam Houston, Thomas Hart Benton
Lost the governorship over secession; lost a 30-year Senate seat over slavery
expansion. Cross-benching that ends a career on a state's *lean* rather than on
a bill's reception — the state punished them, not the party.

**Known limit worth recording:** Ross was vindicated 60 years later, and the
game cannot express delayed vindication. Counters are read at the next election
and nothing carries further. That is the right scope — this is a game about
electoral consequence, not historical judgment — but it means heroism is always
a bet on one roll and never a long position.

### F5. Johnson and the Civil Rights Act, 1964 — NEW
The leader-scale version of F1. Not a legislator taking a personal hit, but a
party leader spending the coalition itself: passing a bill knowing it costs his
party the South.

**Pass:** the game produces bills whose passer *loses lean* and *wins anyway*.
Under board scoring the sacrifice pays if the bill survives to the epilogue, so
this is a direct test of whether the epilogue does its job. If passing is always
coalition-positive, the game has no politics in it — only optimisation.

Depends on: board scoring, repeal, and cross-bench voting firing.

### F6. Dirksen and the 1964 cloture vote — NEW
The structural case, and the strongest argument in this register for getting
cross-bench voting off the dead-content list.

Cloture passed 71–29: **44 Democrats and 27 Republicans for, 23 Democrats and
6 Republicans against.** Every one of the 23 Democratic no votes came from a
Southern or border state. Dirksen delivered 27 of his 33 Republicans, against a
sixty-working-day filibuster. Senate historians state it directly: the
filibuster was led not by the opposition party but by a faction within the
majority.

**Pass:** a bill passes on a coalition that is not party-aligned, over
obstruction from inside the sponsoring party. Both halves are required — a bill
that merely attracts some opposition votes is not this case.

This also tests the counter-majoritarian brake: a cohesive minority sustaining
obstruction against a measure with majority support, defeated only by a
supermajority threshold. The convention's 13-state block is one instance; this
asks whether *ordinary* legislation can be blocked the same way.

---

## G. Waves and coattails

### G1. 1894, 1932, 1958, 1974, 1994, 2010, 2018
Blocked by A4. Until safe seats are contested, no wave can flip anything.

**Pass, part one:** the engine produces at least one 40+ seat swing per long
game, and those swings cluster in years where the economy and midterm modifiers
agree.

**Pass, part two — NEW, and this is the part that brakes runaway leaders.**
Waves must reverse. Measured on the postwar congressional roster (40 cycles):

- lag-1 autocorrelation of national House swing: **−0.36**
- after any swing of 25+ seats, the next cycle **reverses 71%** of the time
- canonical case: 1965 **+44 D** → 1967 **−48 D**
- largest postwar swings: 1949 +75, 2011 −65, 1995 −61, 1947 −55, 1967 −48

A game whose swings are uncorrelated or positively correlated compounds big
wins and produces exactly the irreversible lead already stamped at determination
41.7–56.3%. This is a historically grounded thermostatic brake and it is
cheaper than any of the invented ones.

### G2. Reagan 1980
Twelve Senate seats on presidential coattails. Tests `coattailsWith` at scale.

### G3. Nixon 1972
Forty-nine states, and the House stays Democratic. The pure split-ticket case,
and the counterweight to G2 — the game needs to produce landslides that *don't*
carry down-ballot.

**Same knob as C1 and H2.** See the nationalization note.

---

## H. Era drift — what the packs should encode

These are trends across packs rather than single events, and they are the best
argument for era-stamped cards. **All three are driven by the coupling
parameter in the nationalization note; do not tune them independently.**

### H1. Incumbency rises, then falls ⚠ NUMBERS CORRECTED
The shape is solid and well-supported. The levels are estimator-dependent by a
factor of three at the low end, and the published series disagree:

| Source | Series |
|---|---|
| Ansolabehere et al. | 1–2 pts in the **1940s**, rising to 8–10 pts in the **2000s** |
| Gelman–King (via Fiorina) | 6–12 pts from the mid-1950s to the late 1990s, falling after |
| Carson/Sievert/Williamson | 1960s jump, peak **8.9 pts in the 1980s**, **4.5 pts** in the last decade |

⚠ The doc previously read "roughly 2 points in the 1950s." That figure belongs
to the 1940s; Gelman–King has the mid-1950s at 6 or above.

**A single flat `incumbency: 1` across all eras is still wrong**, and per-pack
values are still the right call. But record in the pack comments that the
specific numbers are a design choice among disagreeing estimators, so nobody
later "corrects" them toward a different paper.

### H2. Split-ticket collapse
1972 had massive presidential/congressional divergence. By 2016 every one of 34
Senate races matched its state's presidential winner; in 2020 only Collins
split.

**Pass:** measured split-ticket rate declines monotonically across era packs.
This is also the cleanest validation of C1 — the same trend that closes the gap
between presidential and congressional lean.

### H3. Home-state advantage decays
Gore lost Tennessee. Trump lost New York. Ryan did not deliver Wisconsin.
Already handled by printing `homeStateBonus` per card; H3 just asserts the
printed values trend downward across packs.

---

## The seven that cannot happen today

1. **Cantor** — a favoured incumbent cannot lose a primary (+6 is unbeatable)
2. **Solid South lag** — one lean number forces presidential and congressional
   to agree
3. **Akin / Moore** — candidate collapse is off-scale by roughly 5x
4. **McCarthy 1968** — a lost primary has no consequence
5. **Scott Brown / all wave years** — safe seats are uncontested, so nothing can
   flip
6. **Lieberman** — unstated whether a primary loser may run as an independent
7. ~~**Dirksen and Johnson (F5, F6)** — cross-bench voting has never returned a
   number and is suspected unreachable~~ ✅ **RESOLVED 2026-09-02.** Cross-bench
   voting returns 77.9 votes a game at v0.1.2 and 125.8–140 at v0.2 (Track B,
   `B4-cross-bench`). The costly-vote register is not decorative and F5/F6 are
   open for work.

Items 1 and 4 are cheap and self-contained. Item 6 is self-contained but needs a
second declaration window rather than a clause. Item 5 is the largest by surface
area — it blocks all of G — and is now hf7y/american-cycle#16, #77 and #90, where
the cause is measured: not eligibility, not agent behaviour, but a 604-card pool
that was assembled rather than designed. Item 7 is **resolved**. Item 2 is the
expensive one, but the nationalization note makes it cheaper than previously
scoped, since one coupling parameter also discharges H1, H2 and G3 — and it is
the same axis question as hf7y/american-cycle#92. Item 3 may be a deliberate
scope limit, but it should be recorded as one.

**Six remain, and one of them is now the most valuable item in this document:**
G1's part two — waves reverse 71% of the time and national swing has lag-1
autocorrelation −0.36 — is a *historically grounded* anti-runaway brake, against
hf7y/american-cycle#84 where the two invented ones have both failed.
