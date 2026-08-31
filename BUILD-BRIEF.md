# Build brief: American Cycle prototype

**For a Claude Code agent. Read `design-doc.md` first — it is the source of truth for all rules.**

---

## What this build is for

This is not a product. It is **a tuning instrument.**

The design is settled. The numbers are not. Section 16 of the design doc lists six open questions, and every one of them is answerable by playing the game a few hundred times with different constants. The prototype's job is to make that cheap.

Two consequences for how you build it:

1. **Every tunable number lives in one config file.** Hand size, office hand bonuses, incumbency value, economy modifiers, midterm penalty, endorsement values, decay rate, pack composition, victory thresholds. Not scattered as literals. A playtester must be able to change one number and replay.

2. **The engine must run headless.** The same game logic that drives the UI must be callable from a script that plays N games with random or scripted agents and dumps results to CSV. This is how the open questions actually get answered — not by humans playing fifty games, but by a human playing five and a simulator playing fifty thousand.

Build the engine first. The UI is a viewer for it.

---

## Phases

### Phase 1 — Engine and simulator

Pure TypeScript, no UI, full test coverage on resolution math.

- Game state: board, hands, benches, seats, lean counters, economy, accumulated G, year.
- Full year sequence per design doc §7.
- Election resolution per §9, with the three labeled dice.
- Omnibill, Fed check, lean push and decay.
- A `RandomAgent` and a `GreedyAgent` (runs the highest-edge race available).
- A harness: `npm run sim -- --games 10000 --config baseline.json` producing a CSV of game length, winner by seat count, seats by office, whether anyone ran away with it.

**Ship this before touching the UI.** If the numbers are broken, a UI just makes it prettier.

Key correctness targets — assert these in tests:

- 3d6 difference distribution matches the odds table in §3 within one percentage point.
- Withdrawal windows close before the information that would decide them (§8). This is the single most important rule in the game and the easiest to implement wrong.
- Lean decay applies before push, every cycle, every state.
- Governors never push lean.

### Phase 2 — Hot-seat UI

React. One screen, no routing. Local play, pass the device.

- US map at state resolution. SVG, states clickable, lean counters visible as colored pips.
- Hand as a card row. Bench as a second row.
- Declaration: click state, click card, confirm — card goes face down.
- A reveal step, a withdrawal window with a visible timer or explicit confirm, then dice.
- **Dice roll visibly and separately**, labeled national / state / candidate. This is the drama of the game and the reason the dice were split. Do not collapse them into one number.
- A running log in plain English: "Wave came in +2 Democratic. Ohio broke Republican. Metzenbaum underperformed and lost by 3."

### Phase 3 — Card data

The engine needs cards. Start with one era pack — 1976 is a good first target — of roughly 60 candidates and 40 districts. Store as JSON, schema per design doc §5.

Card rules text is the hard part. Do not build a general effects engine. Implement a small enumerated set of effect types (`identity_bonus`, `home_state`, `district_synergy`, `heterodox`, `extremist`, `may_endorse`, `conditional`) and let anything else be flavor text with no mechanical hook. If a card needs an effect outside the enum, that card waits.

### Phase 4 — Bots and balance report

Better agents. A script that runs the six open questions from §16 as parameter sweeps and outputs a markdown report with charts.

---

## Constraints

- **TypeScript throughout.** The engine is the asset; type it properly.
- **No backend in phases 1–3.** State in memory, save to localStorage only if trivial.
- **Deterministic seeding.** Every game runs from a seed so a playtester can report a bug reproducibly.
- **No art.** Cards are typographic rectangles. Resist the urge.

---

## Repo layout

```
/engine        game logic, pure, no DOM
  /rules       resolution, elections, legislature, economy
  /types
  /config      baseline.json and variant configs
/sim           headless harness and agents
/ui            React app
/data          card JSON by era pack
/reports       simulator output, gitignored
```

---

## What not to build

- Online multiplayer.
- Accounts, persistence, matchmaking.
- An issue system, salience tracking, or position markers. These were explicitly cut from the design. If you find yourself adding a tracker for something, re-read §5 — the rule is that if it cannot be a token on a card, it does not exist.
- A rules engine general enough to express arbitrary card text.
- Art, animation, or sound before phase 4.

---

## First commit

Scaffold, `design-doc.md` committed at the root, config file with every constant from the design doc as a named field, and a single passing test that verifies the odds table. That test is the foundation the rest of the game sits on.
