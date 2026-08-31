#!/usr/bin/env python3
"""Fetch candidate portraits from Wikipedia and embed them as small data URIs.

The board is a single self-contained file, so portraits must travel inside it.
72x72 JPEG at quality 72 keeps 224 faces to roughly a megabyte, which the page
can carry without trouble.
"""
import base64, io, json, pathlib, sys, time, urllib.parse, urllib.request
from PIL import Image

UA = "american-cycle-cardgame/0.1 (https://github.com/hf7y/american-cycle; portraits for a board game prototype)"
SIZE = 72

def get(url, timeout=20):
    """Wikimedia rate-limits politely but firmly with 429. Back off rather than
    hammer it: this is someone else's infrastructure, the job is resumable, and
    waiting costs nothing but wall-clock."""
    for attempt in range(6):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            wait = 5 * (2 ** attempt)
            print(f"  429 -- sleeping {wait}s", file=sys.stderr, flush=True)
            time.sleep(wait)
    raise RuntimeError("unreachable")

def summary(title):
    t = urllib.parse.quote(title.replace(" ", "_"), safe="")
    return json.loads(get(f"https://en.wikipedia.org/api/rest_v1/page/summary/{t}"))

def search(name):
    q = urllib.parse.quote(name)
    d = json.loads(get(f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={q}&format=json&srlimit=1"))
    hits = d.get("query", {}).get("search", [])
    return hits[0]["title"] if hits else None

def portrait(name, hint):
    for title in (name, f"{name} ({hint})" if hint else None):
        if not title: continue
        try:
            d = summary(title)
            if d.get("type") == "disambiguation": continue
            src = d.get("thumbnail", {}).get("source")
            if src: return src
        except Exception: pass
    try:
        t = search(f"{name} {hint or 'politician'}")
        if t:
            src = summary(t).get("thumbnail", {}).get("source")
            if src: return src
    except Exception: pass
    return None

def square(raw):
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = im.size
    s = min(w, h)
    # faces sit high in a portrait, so bias the crop upward rather than centring
    top = max(0, int((h - s) * 0.18))
    im = im.crop(((w - s) // 2, top, (w - s) // 2 + s, top + s)).resize((SIZE, SIZE), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=72, optimize=True)
    return buf.getvalue()

out_path = pathlib.Path("data/portraits.json")
out = json.loads(out_path.read_text()) if out_path.exists() else {}
cards = []
for f in sorted(pathlib.Path("data").glob("pack-*.json")):
    for c in json.loads(f.read_text())["cards"]:
        if c["kind"] == "candidate": cards.append(c)

hit = miss = skip = 0
for i, c in enumerate(cards):
    if c["id"] in out: skip += 1; continue
    src = portrait(c["name"], "politician")
    if not src:
        miss += 1; print(f"  MISS {c['name']}", file=sys.stderr)
    else:
        try:
            out[c["id"]] = "data:image/jpeg;base64," + base64.b64encode(square(get(src))).decode()
            hit += 1
        except Exception as e:
            miss += 1; print(f"  FAIL {c['name']}: {e}", file=sys.stderr)
    time.sleep(1.1)      # ~1 req/s, comfortably inside Wikimedia's limits
    if i % 25 == 0:
        out_path.write_text(json.dumps(out))
        print(f"  ... {i}/{len(cards)}  hit {hit} miss {miss}", file=sys.stderr, flush=True)

out_path.write_text(json.dumps(out))
kb = out_path.stat().st_size / 1024
print(f"portraits: {hit} fetched, {miss} missing, {skip} already had, {len(out)} total, {kb:.0f} KB")
