#!/usr/bin/env python3
"""Drive the built board in a real browser and play a whole game.

The headless generator tests exercise the engine; this exercises the page --
event wiring, modal flow, rendering. A console error here is a bug a player
would hit on the first click.
"""
import os, pathlib, sys, time
from playwright.sync_api import sync_playwright

HTML = pathlib.Path(__file__).resolve().parent.parent / "ui" / "index.html"
SHOT = pathlib.Path(os.environ.get("SHOT_DIR", "/tmp/american-cycle-shots"))
SHOT.mkdir(parents=True, exist_ok=True)
errors, logs = [], []
phase_failures = []

# #28: the setup form seeds itself from Math.random(), so every CI run played a
# DIFFERENT game and a red build could not be reproduced. Fix the seed, and
# print it -- BUILD-BRIEF: "when you report a pathology, report the seed".
SEED = int(os.environ.get("PLAYTEST_SEED", "20260831"))

def start(pg):
    """Fill the seed before starting, so this run is the one you can re-run."""
    pg.fill("#sseed", str(SEED))
    pg.click("#go")

def check_phases(pg, districts_t0):
    end = pg.evaluate("""() => ({
      stats: G.stats,
      leanMap: G.leanMap,
      events: G.events.map(e => ({
        office: e.office, uncontested: e.uncontested,
        winnerCardId: (e.sides.find(s => s.player === e.winner) || {}).cardId,
      })),
      heldCardIds: G.seats.filter(s => s.holder).map(s => s.holder.cardId),
      handCardIds: G.players.flatMap(p => p.hand.filter(c => c.kind === 'candidate').map(c => c.id)),
      districts: G.players.map(p => p.districts.map(d => d.id)),
    })""")

    owner_t0 = {key: i for i, ds in enumerate(districts_t0) for key in ds}
    owner_end = {key: i for i, ds in enumerate(end["districts"]) for key in ds}
    captured = any(owner_end.get(k) != v for k, v in owner_t0.items() if k in owner_end)

    held = set(end["heldCardIds"])
    ever_won = {e["winnerCardId"] for e in end["events"] if e["winnerCardId"]}
    expired_to_hand = bool((ever_won - held) & set(end["handCardIds"]))

    phases = {
        "an election resolved": any(not e["uncontested"] for e in end["events"]),
        "a bill was voted": end["stats"]["billsAttempted"] > 0,
        "the Fed reacted to spending": end["stats"]["rateRises"] > 0,
        "a lean was pushed": any(v for v in end["leanMap"].values()),
        "a district was captured": captured,
        "a term expired and a card returned to hand": expired_to_hand,
    }
    for name, happened in phases.items():
        print(f"  {'✓' if happened else '✗'} {name}")
        if not happened:
            phase_failures.append(name)

# #36: no run anywhere has ever produced a wall-clock number; lengths are
# reported in years. This times one browser game, wall clock, so that number
# exists at all -- it is one sample, not the median/tail SIM-BRIEF asks for,
# which needs many seeded runs of this same script.
start_time = time.monotonic()

with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.on("console", lambda m: (errors if m.type == "error" else logs).append(m.text))
    pg.on("pageerror", lambda e: errors.append(f"PAGEERROR {e}"))
    pg.goto(HTML.as_uri())
    pg.wait_for_timeout(700)

    assert pg.locator("#modal.on").count(), "setup modal did not open"
    pg.screenshot(path=str(SHOT / "shot-setup.png"))
    start(pg)
    pg.wait_for_timeout(400)
    districts_t0 = pg.evaluate("() => G.players.map(p => p.districts.map(d => d.id))")

    cycles = declared = withdrew = bills = 0
    finished = False
    for step in range(3000):
        if pg.locator("#modal.on").count():
            body = pg.inner_text("#modalBody")
            if pg.locator("#stand").count():
                withdrew += 1
                pg.click("#stand" if withdrew % 2 else "#pull")
            elif pg.locator("#yes").count():
                bills += 1
                pg.click("#yes")
            elif pg.locator("#party").count():
                pg.click("#party")
            elif pg.locator("#again").count():
                pg.screenshot(path=str(SHOT / "shot-gameover.png"))
                print(f"GAME OVER after {cycles} declaration phases")
                print("  " + body.replace("\n", " | ")[:220])
                finished = True
                break
            elif pg.locator("#rr").count():
                pg.locator("#rr button").first.click()
            else:
                print("UNKNOWN MODAL:", body[:160]); break
            pg.wait_for_timeout(120)
            continue

        cards = pg.locator("#hand .cc")
        go = pg.locator("#controls button").first
        if cards.count() and declared < 3 * (cycles + 1):
            cards.first.click(); pg.wait_for_timeout(90)
            states = pg.locator("#map .st.act")
            if states.count():
                states.first.click(); declared += 1; pg.wait_for_timeout(120); continue
        if go.count():
            if cycles == 1: pg.screenshot(path=str(SHOT / "shot-declare.png"))
            go.click(); cycles += 1; pg.wait_for_timeout(220); continue
        print("stuck: no modal, no card, no state, no go button"); break
    if not finished:
        print("did not reach GAME OVER")
        phase_failures.append("the game did not reach GAME OVER")

    log_entries = pg.locator("#log .le").count()
    print(f"declarations {declared} | withdrawal windows {withdrew} | bill votes {bills} | log entries {log_entries}")
    if finished:
        print("phases:")
        check_phases(pg, districts_t0)
    pg.screenshot(path=str(SHOT / "shot-board.png"), full_page=True)
    b.close()

elapsed = time.monotonic() - start_time
print(f"wall clock {elapsed:.1f}s for {cycles} declaration cycles ({elapsed / cycles:.2f}s/cycle)" if cycles else f"wall clock {elapsed:.1f}s")
print(f"\nseed {SEED} (PLAYTEST_SEED to change)")
print(f"console errors: {len(errors)}")
for e in errors[:12]: print("  ✗", e[:200])
for f in phase_failures: print("  ✗ phase missing:", f)
sys.exit(1 if errors or phase_failures else 0)
