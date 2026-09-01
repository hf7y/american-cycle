#!/usr/bin/env python3
"""Drive the built board in a real browser and play a whole game.

The headless generator tests exercise the engine; this exercises the page --
event wiring, modal flow, rendering. A console error here is a bug a player
would hit on the first click.
"""
import os, pathlib, sys
from playwright.sync_api import sync_playwright

HTML = pathlib.Path(__file__).resolve().parent.parent / "ui" / "index.html"
SHOT = pathlib.Path(os.environ.get("SHOT_DIR", "/tmp/american-cycle-shots"))
SHOT.mkdir(parents=True, exist_ok=True)
errors, logs = [], []

# #28: the setup form seeds itself from Math.random(), so every CI run played a
# DIFFERENT game and a red build could not be reproduced. Fix the seed, and
# print it -- BUILD-BRIEF: "when you report a pathology, report the seed".
SEED = int(os.environ.get("PLAYTEST_SEED", "20260831"))

def start(pg):
    """Fill the seed before starting, so this run is the one you can re-run."""
    pg.fill("#sseed", str(SEED))
    pg.click("#go")

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

    cycles = declared = withdrew = bills = 0
    for step in range(400):
        if pg.locator("#modal.on").count():
            body = pg.inner_text("#modalBody")
            if pg.locator("#stand").count():
                withdrew += 1
                pg.click("#stand" if withdrew % 2 else "#pull")
            elif pg.locator("#yes").count():
                bills += 1
                pg.click("#yes")
            elif pg.locator("#again").count():
                pg.screenshot(path=str(SHOT / "shot-gameover.png"))
                print(f"GAME OVER after {cycles} declaration phases")
                print("  " + body.replace("\n", " | ")[:220])
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
        break
    else:
        print("hit the step cap without finishing")

    log_entries = pg.locator("#log .le").count()
    print(f"declarations {declared} | withdrawal windows {withdrew} | bill votes {bills} | log entries {log_entries}")
    pg.screenshot(path=str(SHOT / "shot-board.png"), full_page=True)
    b.close()

print(f"\nseed {SEED} (PLAYTEST_SEED to change)")
print(f"console errors: {len(errors)}")
for e in errors[:12]: print("  ✗", e[:200])
sys.exit(1 if errors else 0)
