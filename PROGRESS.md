# american-cycle — handover

**State: complete and CI-green.** PR hf7y/american-cycle#7, branch
`phase1-engine`. Nothing is in flight.

- **Play it:** https://claude.ai/code/artifact/258e71c9-7de6-45e0-80e3-d7d7dffbb369
- **Findings:** https://claude.ai/code/artifact/5d881297-7ea3-49a6-a8f5-846157eed5e3

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
- `FINDINGS.md` — 37 findings, prose. `findings/` — nine of them as executable
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
