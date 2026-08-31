# american-cycle — handover

**v0.1 — landed and CI-green.** PR hf7y/american-cycle#7, branch
`phase1-engine`. Nothing is in flight.

## v0.2 — decided, deliberately not in v0.1

Each of these is measured and argued; none is shipped, because each moves every
baseline and the nine findings are stamped against these configs.

| | |
|---|---|
| **`game.resignToRun` on in as-written-plus** | **The one that matters.** Off, an office-holder can reach for a higher office only in the cycle its term expires — close to the complement of real ambition, not an approximation of it. Every sitting senator ever elected president ran mid-term, as did Wilson, Clinton and G.W. Bush; of seven, the gate admits FDR. On, the governor launchpad rises **nineteenfold** (0.46% → 8.85% of presidential sides) and contested presidential races nearly double. Implemented, measured, default false. |
| **era-key `govTerm` in `engine/states.ts`** | MEASURED, `data/historical/governor-rules.json`. Freezing 2026 puts **225 of 1,386** real elections in the wrong year (16.2%) — but that blends two very different things: **midterms are 1.2% wrong, odd years 1.9%, and PRESIDENTIAL YEARS 44.7%** (65.9% across the 1932 pack). Two-year states at the seven era dates: **24, 14, 4, 3, 2, 2, 2** — half the board in 1932. **1932 carried 35 governorships; the 2026 table schedules 11.** Giving each state its historical term length and changing nothing else takes the error to **2.5%**. Note the error concentrates exactly where the launchpad lives. |
| do NOT encode per-state term limits — CONFIRMED | Two independent reasons. Mechanically they never touch the calendar, and turnover is already governed by card availability. Empirically the data is the thin part: 22 of 50 adoption years sourced, mid-century counts only bounded, the Book of the States editions behind a lending wall. |
| `govTerm: 2 \| 4` cannot express New Jersey | It ran a THREE-year term until 1949. Any era-keying should widen the type, not just add a key. |
| **a printed district party preference, +4 to +5 pips** | Measured on the MEDSL 1976–2018 panel, 9,556 district-years. Stable district partisanship is **56.4% of the variance** in two-party share — and **only 10.6% of it is the state the district is in; 89.4% is within-state.** So the state lean cannot carry it, and §10 prints no state number: if the district card does not carry the baseline, nothing does. +10.9 pips on §3's literal margin scale, +4 to +5 calibrated on win rates; the gap is because §3's dice are ~2x less dispersed than reality (4.18 vs a measured 6.82 contested / 8.62 open). |
| loyalty vs lean: **real, but not a second field** | WV's House ran 33.9 share points more Democratic than the nation in 1996 while its presidential vote ran 3.6; it lost the presidential edge in 2000 and the House edge in 2010 — a **ten-year lag**, and the same shape in the South (1984→1992) and Appalachia (1988→1994). Outside a realignment the gap never leaves ±2.5, so ~80% of cards would print 0. The mechanism already exists as heterodoxy card text on Byrd/Rahall/Manchin/Edwards; what was missing is its magnitude — **+15 to +30 pips at peak, decaying over a decade** — which answers §16's open question #3, not a new field. |
| era-price incumbency | It collapses from ~6.5 pips (1982–2010) to **2.88** (2012–18) while district partisanship rises. One scalar cannot be right for seven era packs. |
| **national sentiment reaching primaries** | Today it reaches them through NO channel: national modifiers sit in the general-only branch of `buildModifiers`, and the national die cancels because `Wave` memoizes it per party and every side of a primary is the same party. Exactly zero. Historically primaries ARE largely insulated, so this is defensible — but it misses the real dynamic, which is not a modifier: primary electorates trade purity against electability, and trade differently by how much danger the party is in (2020 Democrats picked the electable one; 2010 Republicans did not, and lost winnable Senate seats). The game has that as a STATIC ±2. Making it respond needs no new data — `ctx.economyMod`, `ctx.isMidterm`, `ctx.presidentParty` are already in `RaceContext`. **Measure before believing it**, because it cuts against insulation that is historically real. |
| **districts print demographics; an era-keyed table maps demographics to party** | Do NOT print a party lean on a district: it freezes the partisanship the realignment thesis says must move, and no printed value is right in both 1932 and 2008. Demographics are stable across eras and the party mapping is not — a coal district is union+rural in both, and only the party those voters back changed. All 258 district cards ALREADY carry demographics (rural 100, urban 87, suburban 68, union 67, black 59, farm 47...), so this costs zero card data and one era-keyed table in the same shape as `seats: Record<census, number>`. |
| **derive `heterodox`, do not print it** | NOT retired -- it is live on 114 of 346 candidates and does two jobs: `heterodoxPrimaryPenalty` and the §9 exemption from national modifiers (`resolution.ts:54`). Under the mapping above a candidate is heterodox WHEN THEIR DEMOGRAPHIC FIT POINTS AWAY FROM THEIR PARTY'S CURRENT ERA MAPPING, which recovers both jobs and makes heterodoxy era-dependent -- Manchin is heterodox in 2018 and orthodox in 1958, which a printed tag cannot express. The lag needs no field: when the mapping flips, the incumbent holds on native-son plus fit plus incumbency for a few cycles. Measured real lag ~10 years; a Senate term is 6 and a House term 2. |
| revisit `crossBenchCap` | Capped at 3 on evidence, not principle. §12 says the counters are read off; uncapped they read ~30. |



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
