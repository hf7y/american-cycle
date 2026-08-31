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
