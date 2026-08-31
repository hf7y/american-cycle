# Overnight build state — american-cycle

Goal (Zach, 2026-08-31): a playable web app, human vs computer, several
opponent types, tuned by simulation, plus variant configs so the effect of
individual mechanics is visible. Docs at root are source of truth.

Branch `phase1-engine`, PR hf7y/american-cycle#7. Board published at
https://claude.ai/code/artifact/258e71c9-7de6-45e0-80e3-d7d7dffbb369

## Done

- [x] Engine: full §7 tick — resolution, three labelled dice, lean, economy and
      Fed, omnibill, impeachment, vice presidency, endorsements, capture,
      governor appointments, independents. 31 tests, clean typecheck.
- [x] BUILD-BRIEF's four named correctness targets all assert.
- [x] Card data: 232 real candidates, 168 real districts, four eras, portraits.
- [x] Historical baseline committed (MIT Election Lab + Vital Statistics).
- [x] Eleven agents; harness, all ten sweeps, round robin, feel metrics.
- [x] Self-contained board, published, republished on every engine change.
- [x] reports/overnight-2026-08-31.md — all seven SIM-BRIEF sections.
- [x] FINDINGS.md — twenty findings, four of them corrections to my own numbers.
- [x] PR open and body current.

## Open, filed as issues

- #5 seat bias at 5–6 players (9–11pp, cause not isolated)
- #8 SenateFlood dominance 51.7%; also the runaway's real cause, and §16's
      victory condition

## Standing cautions for whoever picks this up

- **Measure what SIM-BRIEF specifies, not a convenient proxy.** Four numbers
  had to be corrected this way and two inversions came out of it. Decision
  density is legal moves AVAILABLE, not declarations made. Determination is a
  cross-game curve, not a per-game summary. Comeback means last at halfway.
- **Uncontested races poison any raw win rate.** On a board that is 93%
  walkovers, always report contested-only.
- **A rule firing at 0% is usually unimplemented, not dead.** Five separate
  mechanics looked dead and every one was a missing clause upstream.
- Node strip-only mode bans parameter properties and `enum`.
- Fractional thresholds need an epsilon compare; two-thirds of nine is not
  representable.
