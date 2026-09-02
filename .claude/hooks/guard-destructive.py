#!/usr/bin/env python3
"""PreToolUse guard: an agent may not destroy a file, only displace one.

WHY THIS EXISTS
    2026-09-01: an agent deleted reports/skowronek-2026-09-02T004912Z.md -- a
    103KB artefact the user had just asked it to publish -- as incidental
    cleanup inside a compound command whose stated purpose was to publish it.
    The file was gitignored, so git could not restore it; recovery cost a
    312-second rerun. A `mv` would have been correct and instant.

    Nothing prompted, because auto mode does not prompt per Bash call. The
    agent's judgement was the only control, and judgement is not a control.

WHAT IT DOES
    Blocks destructive shell verbs and tells the agent to use .claude/bin/trash
    instead, which MOVES the target into .claude/trash/<stamp>/ preserving its
    relative path. Deletion stops being irreversible; nothing else changes, and
    no prompt is added, so there is no friction to route around.

CONTRACT
    stdin  : JSON with .tool_name and .tool_input.command
    exit 0 : allow
    exit 2 : block, and stderr is returned to the agent as feedback

DELIBERATE GAPS, so nobody mistakes this for a sandbox:
  - /tmp is exempt. Scratch is disposable, and a guard that nags about scratch
    is a guard that gets switched off.
  - Shell redirection (`>`) can still truncate a file. Catching it would mean
    blocking ordinary, legitimate writes; the trade was made knowingly.
  - A script that itself deletes is invisible here -- only the command string
    the agent runs is inspected.
  This raises the floor. It does not seal the room. Version control is still
  the thing that makes data loss a non-event.
"""
import json
import os
import re
import shlex
import sys

DESTRUCTIVE = {"rm", "shred", "truncate", "unlink"}
# Scratch only. Anything else is presumed to matter.
EXEMPT_PREFIXES = ("/tmp/",)

TRASH = ".claude/bin/trash"


def block(what: str, detail: str) -> None:
    sys.stderr.write(
        f"BLOCKED by .claude/hooks/guard-destructive.py: {what}\n"
        f"  segment: {detail}\n\n"
        f"Do not delete. Move it instead:\n"
        f"  {TRASH} <paths...>\n"
        f"which relocates into .claude/trash/<stamp>/ and prints where it went.\n"
        f"If you meant to RENAME or RELOCATE a deliverable, use `mv` -- that was\n"
        f"the correct action in the incident this guard was written for.\n"
        f"Scratch under /tmp/ is exempt and needs no trash.\n"
    )
    sys.exit(2)


def targets_of(args):
    """Non-flag operands. `--` ends option parsing."""
    out, seen_ddash = [], False
    for a in args:
        if a == "--":
            seen_ddash = True
            continue
        if not seen_ddash and a.startswith("-"):
            continue
        out.append(a)
    return out


def exempt(paths) -> bool:
    return bool(paths) and all(p.startswith(EXEMPT_PREFIXES) for p in paths)


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0  # unparseable input is not this hook's business
    if data.get("tool_name") != "Bash":
        return 0
    cmd = ((data.get("tool_input") or {}).get("command") or "").strip()
    if not cmd:
        return 0

    # Split on shell separators so a verb buried mid-command is still seen --
    # which is exactly the shape that caused the incident:
    #   cd <dir>; rm -f reports/*.md; (node ...) & until ...
    for raw in re.split(r"\|\||&&|[;&|\n]", cmd):
        seg = raw.strip().lstrip("({ \t")
        if not seg:
            continue
        try:
            toks = shlex.split(seg)
        except ValueError:
            # Unbalanced quotes: fail closed if a destructive word appears.
            if any(w in seg.split() for w in DESTRUCTIVE):
                block("unparseable command containing a destructive verb", seg)
            continue
        if not toks:
            continue

        i = 0
        while i < len(toks) and "=" in toks[i] and not toks[i].startswith("-"):
            i += 1  # skip VAR=value prefixes
        if i >= len(toks):
            continue
        verb = os.path.basename(toks[i])
        args = toks[i + 1:]

        if verb in DESTRUCTIVE:
            if exempt(targets_of(args)):
                continue
            block(f"`{verb}` destroys data", seg)

        if verb == "git" and args:
            if args[0] == "clean":
                block("`git clean` destroys untracked files", seg)
            if args[0] == "reset" and "--hard" in args:
                block("`git reset --hard` discards working-tree changes", seg)
            if args[0] == "checkout" and "--" in args and "-f" in args:
                block("forced checkout discards working-tree changes", seg)

        if verb == "find" and ("-delete" in args or "-fdelete" in args):
            block("`find -delete` destroys data", seg)

        if verb == "mv" and any(a == "/dev/null" for a in args):
            block("moving to /dev/null destroys data", seg)

        # `... | xargs rm` -- the destructive verb is an argument here.
        if verb == "xargs" and any(os.path.basename(a) in DESTRUCTIVE for a in args):
            block("`xargs` invoking a destructive verb", seg)

    return 0


if __name__ == "__main__":
    sys.exit(main())
