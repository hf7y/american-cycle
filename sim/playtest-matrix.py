#!/usr/bin/env python3
"""Exercise the paths one playthrough misses: both themes, both widths, every
rule set, every start era. Each is a code path nobody has run."""
import pathlib, sys, json
from playwright.sync_api import sync_playwright

HTML = pathlib.Path(__file__).resolve().parent.parent / "ui" / "index.html"
SHOT = pathlib.Path("/tmp/claude-1000/-home-zach-Documents-Projects-realisateur/3d386c7e-5690-4b17-b66e-d3f9663ff34a/scratchpad")
fails = []

def check(pg, label):
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    # horizontal overflow: the page body must never scroll sideways
    ow = pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
    if ow:
        sw = pg.evaluate("document.documentElement.scrollWidth"); cw = pg.evaluate("document.documentElement.clientWidth")
        fails.append(f"{label}: page scrolls horizontally ({sw} > {cw})")
    # body must paint an explicit background, or it borrows the host's theme
    bg = pg.evaluate("getComputedStyle(document.body).backgroundColor")
    if bg in ("rgba(0, 0, 0, 0)", "transparent"):
        fails.append(f"{label}: body background is transparent")
    # text must not match its own background
    fg = pg.evaluate("getComputedStyle(document.body).color")
    if fg == bg: fails.append(f"{label}: body text colour equals background ({fg})")
    return errs, bg, fg

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for theme in ("light", "dark"):
        for w, h, tag in ((1280, 900, "desktop"), (390, 844, "mobile")):
            pg = b.new_page(viewport={"width": w, "height": h}, color_scheme=theme)
            pg.goto(HTML.as_uri()); pg.wait_for_timeout(500)
            label = f"{theme}/{tag}"
            errs, bg, fg = check(pg, label + " setup")
            pg.click("#go"); pg.wait_for_timeout(500)
            e2, _, _ = check(pg, label + " board")
            if errs or e2: fails.append(f"{label}: pageerror {(errs+e2)[0][:120]}")
            pg.screenshot(path=str(SHOT / f"m-{theme}-{tag}.png"))
            print(f"  {label:16} bg {bg:22} fg {fg}")
            pg.close()

    # every rule set and a spread of start eras
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.goto(HTML.as_uri()); pg.wait_for_timeout(400)
    cfgs = pg.eval_on_selector_all("#scfg option", "os => os.map(o => o.value)")
    eras = pg.eval_on_selector_all("#sera option", "os => os.map(o => o.value)")
    print(f"\n  rule sets: {cfgs}\n  start eras: {eras}")
    pg.close()

    for cfg in cfgs:
        for era in (eras[0], eras[len(eras)//2], eras[-1]):
            pg = b.new_page(viewport={"width": 1280, "height": 900})
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(HTML.as_uri()); pg.wait_for_timeout(350)
            pg.select_option("#scfg", cfg); pg.select_option("#sera", era)
            pg.click("#go"); pg.wait_for_timeout(400)
            # play three cycles
            for _ in range(60):
                if pg.locator("#modal.on").count():
                    for sel in ("#stand", "#yes", "#again"):
                        if pg.locator(sel).count():
                            if sel == "#again": break
                            pg.click(sel); break
                    else:
                        if pg.locator("#rr").count(): pg.locator("#rr button").first.click()
                    if pg.locator("#again").count(): break
                    pg.wait_for_timeout(80); continue
                go = pg.locator("#controls button").first
                if go.count(): go.click(); pg.wait_for_timeout(150)
                else: break
            if errs: fails.append(f"{cfg}@{era}: {errs[0][:140]}")
            pg.close()
    print(f"  played {len(cfgs)*3} config x era combinations")
    b.close()

print(f"\nfailures: {len(fails)}")
for f in fails[:14]: print("  ✗", f)
sys.exit(1 if fails else 0)
