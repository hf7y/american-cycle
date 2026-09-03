# CLAUDE.md

## The engine is the spec

`DECISIONS.md` is the design record — settled, open, and **considered and
cut**. Read the cut list before building anything attractive: most of those
ideas were removed for reasons. `§N` in a code comment cites a reaped
document, never a live pointer — state the rule instead of adding a new one.

## Before you open a PR

```
npx tsc --noEmit
FINDINGS_DEEP=1 FINDINGS_SEEDS=12 npm test
FINDINGS_SEEDS=12 node sim/findings.ts     # STALE is information; only BROKEN fails
node ui/build.ts && git diff --exit-code ui/index.html
```

The last line matters: `ui/index.html` is the **committed bundle a player
loads**, so an unrebuilt source change ships a different game than the
simulator plays. Node 22.18+ or 24 — the repo imports `.ts` directly and
relies on unflagged type stripping.

CI also runs `hf7y/etalon`'s prose guard against `.prose-ratchet` and
`.state-prose-ratchet`, both shrink-only — reap prose, or encode state in
code, rather than raise either by hand.

## A finding is a predicate, not a number

`findings/` re-derives itself against a stamped value and a tolerance.
Restamping (`node sim/findings.ts --restamp`) is the only way a headline
changes, and it is a claim the engine moved — say why in the commit.

`tracks/` carries no stamp: the suite lives on main and runs against any
worktree, and what's frozen per tag is a numbers file — comparison is
diffing two of them.

## Deleting

There is no `rm` here: `.claude/hooks/guard-destructive.py` blocks it, and
`.claude/bin/trash <paths>` displaces into `.claude/trash/<stamp>/` instead.
`reports/` is gitignored, so a deleted artefact there is gone for good.
