# CLAUDE.md

## The engine is the spec

`DECISIONS.md` is the design record — settled, open, and **considered and cut**.
Read the cut list before building anything attractive: most of those ideas were
good and were removed for reasons. `§N` in a code comment cites a document that
was reaped; it is a historical citation, never a live pointer. Do not add new
ones — state the rule instead.

## Before you open a PR

```
npx tsc --noEmit
FINDINGS_DEEP=1 FINDINGS_SEEDS=12 npm test
FINDINGS_SEEDS=12 node sim/findings.ts     # STALE is information; only BROKEN fails
node ui/build.ts && git diff --exit-code ui/index.html
```

The last line is not tidiness: `ui/index.html` is the **committed bundle a
player loads**. A source change without a rebuild ships a board playing a
different game from the simulator.

Node 22.18+ or 24 — the repo imports `.ts` directly and relies on unflagged
type stripping.

## A finding is a predicate, not a number

`findings/` re-derives itself against a stamped value and a tolerance. The only
sanctioned way for a headline to change is `node sim/findings.ts --restamp`,
and restamping is a claim that the engine moved — say why in the commit.

`tracks/` carries no stamp: the suite lives on main and runs against any
worktree, and what is frozen per tag is a numbers file. Comparison is diffing
two numbers files.

## Deleting

There is no `rm` here. `.claude/hooks/guard-destructive.py` blocks it and
`.claude/bin/trash <paths>` displaces into `.claude/trash/<stamp>/` instead,
printing where each went. `reports/` is gitignored, so a deleted artefact is
gone for good — that is the incident the guard was written for.
