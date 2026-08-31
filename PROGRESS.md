# american-cycle — handover

**v0.1 is the tag `v0.1` (a253943), not a mood.** It was called landed once
before it was, and then landed into — so it is now pinned. PR
hf7y/american-cycle#7, branch `phase1-engine`, CI green on both jobs.

**v0.2 is the working line.** Anything below is fair game; the tag is not.

## v0.2 — measured, argued, not yet done

v0.1.1 closed the built-not-wired, layered-not-replaced and raised-went-nowhere
backlog. What is left is genuine new work.

| | |
|---|---|
| **Turn on `game.resignToRun`** | Off, an office-holder can reach for a higher office only in the cycle its term expires — close to the complement of real ambition, not an approximation of it. Every sitting senator ever elected president ran mid-term, as did Wilson, Clinton and G.W. Bush; of seven, the gate admits FDR. On, the governor launchpad rises **nineteenfold** (0.46% → 8.85% of presidential sides) and contested presidential races nearly double. Implemented, measured, default false. |
| **era-key `govTerm` in `engine/states.ts`** | MEASURED, `data/historical/governor-rules.json`. Freezing 2026 puts **225 of 1,386** real elections in the wrong year (16.2%) — but **midterms are 1.2% wrong, odd years 1.9%, and PRESIDENTIAL YEARS 44.7%** (65.9% across the 1932 pack). Two-year states at the seven era dates: **24, 14, 4, 3, 2, 2, 2**. **1932 carried 35 governorships; the 2026 table schedules 11.** Historical term lengths alone take the error to **2.5%**. The error concentrates exactly where the stepping stone lives. |
| `govTerm: 2 \| 4` cannot express New Jersey | It ran a THREE-year term until 1949. Era-keying must widen the type, not just add a key. |
| do NOT encode per-state term limits | Two reasons. They never touch the calendar, and turnover is already governed by card availability. And the data is thin: 22 of 50 adoption years sourced, the rest behind a lending wall. |
| **`identityBonus` is the district-partisanship lever. Do not build a table.** | Stable district partisanship is 56.4% of the variance in House two-party share, and **only 10.6% of it is the state — 89.4% is within-state**, so the state lean cannot carry it. But the carrier does not need building: an era-keyed demographics→party table scores +3.0 pips in **1.3%** of House races, because a PARTY-keyed carrier cancels in a primary where both sides are the same party. Emergent-from-play scores **+0.0** (r = −0.026; a feedback loop with no seed). The shipped `identityBonus` scores the same +3.0 in **5.5x more races** — 62.5% of contested generals and 66.3% of contested House primaries. Raise it, or attack the 98.6% House walkover rate. |
| **era-price incumbency** | It collapses from ~6.5 pips (1982–2010) to **2.88** (2012–18) while district partisanship rises. One scalar cannot be right for seven era packs. |
| **a distribution test for the PRIMARY** | `engine/rules/resolution.test.ts` guards §3's odds table — which BUILD-BRIEF calls "the foundation the rest of the game sits on" — and it is the GENERAL's table only. Assert the 1d6 table too: +1 65.3%, +2 77.8%, +4 94.4%, **+6 100.0%**. At +6 a primary is decided before the dice leave the hand, and nothing tests that. |
| **CI that can see staleness** | It runs `sim/findings.ts` at `FINDINGS_SEEDS: 12`, and only BROKEN fails the step — so green is not evidence a headline is current. Fail on STALE at full N on a schedule, or at least report the count. |
| **odd-year governors** | Zach's original question — running in an odd year to bank incumbency before an even-year Senate run — was measured (1,039 even-year races, 0 odd) and dropped. `oddYearGovernors` is in the engine's config type but in none of the nine configs. |
| **national sentiment reaching primaries** | Today it reaches them through NO channel: national modifiers are general-only, and the national die cancels because `Wave` memoizes it per party and every primary side is the same party. Historically primaries ARE largely insulated, so this is defensible — but it misses the real dynamic, which is not a modifier: primary electorates trade purity against electability, and trade differently by how much danger the party is in. The game has that as a STATIC ±2. `ctx.economyMod`, `ctx.isMidterm` and `ctx.presidentParty` are already in `RaceContext`. **Measure before believing it.** |
| three data files nothing reads | `governor-rules.json`, `house_district_panel.json`, `pres_state_panel.json` are evidence, not inputs. Fine — but say so rather than letting someone assume the engine consumes them. |

## What exists

BUILD-BRIEF Phase 1 (engine + simulator), Phase 2 (the board), Phase 3 (card
data), and the SIM-BRIEF report.

- `engine/` — every mechanic in the design doc: §7's tick, §9's stack, §4's
  three labelled dice, §10's lean, §12's omnibill and impeachment, §11's vice
  presidency and appointments, §13's Fed, §6's pack-pass draft, §15's capture,
  endorsements, independents. 31 tests, clean typecheck, no dependency but tsc.
- `data/` — 346 real candidates and 258 real districts across seven eras
  (1932/1964/1976/1992/2008/2016/2024), with portraits. Plus the historical
  baseline: 9,555 real House elections and incumbent reelection 1946–2016.
- `sim/` — 11 agents, harness, all ten sweeps, round robin, feel metrics,
  browser playtests.
- `ui/` — one self-contained HTML file, no build step, no network.
- `FINDINGS.md` — 38 findings, prose. `findings/` — ten of them as executable
  predicates. `reports/` — the seven-section brief response and the published
  page.

## The rule that governs this repo's prose

**A headline is a stamped snapshot. The predicate is the value.** Every prose
claim that a re-run could invalidate lives in `findings/` as a module that
re-derives it, and grades itself HOLDS / STALE / BROKEN against the stamp. A
headline is allowed to go stale — it is *not* allowed to go stale silently.

Two obligations fall out, and both are enforced by a test rather than by
discipline:

- **A finding declares what its conclusion rests on** (`dependsOn`).
- **Declaring a config creates an obligation to check it.** If a finding
  recommends a shipped setting, it must read that setting back off disk as a
  zero-tolerance claim. A recommendation nobody re-checks is how a config and
  the reason for it drift apart.

`findings/well-formed.test.ts` rejects malformed findings — a missing question,
a headline too short to be a claim, an unparseable stamp, a non-finite measured
value, or a declared config with no claim checking it.

## The board ships §7's literal reading

`as-written-plus.json` — annual decay, annual bill, and the push table at
2/3/4 — is the default. The literal text of §7 does work; it needed one config
change, not a rules change. Under it 13.8 states realign per game. Under the
old default the end screen read *"no state moved four pips or more."*

## Open — all four are design decisions, none is a defect

| | |
|---|---|
| #10 | what an uncontested win does to lean — **the highest-leverage one** |
| #11 | is a safe seat a walkover, or should the pip scale widen |
| #12 | the runaway has no mechanical brake; is table politics enough |
| #13 | §16's victory condition; none of §14's candidates works |

Each carries the measurement, both readings, and a `DEFAULT-AFTER`. Three ship
a playable variant so the choice can be felt rather than argued.

## Superseded — do not cite the earlier number

- **F32 → F36.** The governorship is strong. F32 called it weak because no
  agent was using it.
- **F14 → F37.** +1 incumbency is *not* calibrated. F14 compared a figure
  pooled across offices to a House-only benchmark. Corrected for walkovers, +1
  is too weak, not too strong.

## Needs a human table, not a parameter

Three findings turn on the social layer and SIM-BRIEF says so itself:

- **The omnibill.** Passage swings 14%→100% on who is willing to vote yes, at a
  fixed 60% threshold — a wider range than the threshold sweep produced. **Do
  not change the filibuster.** (F27)
- **Impeachment.** Fires 0% because two-thirds is unreachable when the
  president's party holds the chamber by having won the presidency. Measured
  against agents that vote the party line. (F12)
- **The runaway.** Its only brake is players ganging up. (F22)

## Standing cautions for whoever picks this up

- **A primary is 1d6 vs 1d6, not 3d6 vs 3d6.** `Wave` memoizes the national die
  by party and the state die by party+state, and every side of a primary is the
  same party in the same state — so only the candidate die differs. The noise
  floor is **SD 2.42 in a primary against 4.18 in a general**, and a pip is
  worth far more there. Judging a primary-only modifier against 4.18
  understates it by 1.7x, which happened here to the cross-bench penalty.
  Primaries are 99.7% contested; generals are 83% walkovers.
- **Measure what SIM-BRIEF specifies, not a convenient proxy.** Six corrections
  came from this and two inverted a conclusion. Decision density is legal moves
  AVAILABLE. Determination is a cross-game curve. Comeback means last at halfway.
- **Name the population before quoting a rate.** F37's error was arithmetically
  fine and compared the wrong two things.
- **Sweep more than one variable.** The filibuster claim was right about the
  threshold and wrong about the cause, because the agent pool was held fixed.
- **A balance number is only valid against the engine that produced it.** Three
  round robins here are void; the report shows them to make that visible.
- **A rule firing at 0% is usually unimplemented, not dead.** Five mechanics
  looked dead and every one was a missing clause upstream. One nearly reported
  a false death because the two tick paths logged differently.
- **Report contested-only on a walkover board.** At 92% uncontested, walkovers
  dominate any raw win rate.
- Node strip-only mode bans parameter properties and `enum`. Fractional
  thresholds need an epsilon compare. Script blocks share one global scope —
  the bundler now refuses to emit a page with colliding names, because a blank
  board shipped once.
