# american-cycle

A card game about the American political cycle. Factions spend **capital** to
rally, attack the front-runner, or buy **endorsements**; endorsements are the
only thing that scores. Highest score after four rounds wins, capital breaks
ties.

## Cards

| kind | effect |
|---|---|
| `rally` | pay cost, gain `value` capital |
| `attack` | pay cost, strip `value` capital from the current leader (never yourself) |
| `endorsement` | pay cost, gain `value` score |

Definitions live in `american_cycle/cards.py`; the turn engine in
`american_cycle/game.py`.

## Run

```
python3 -m unittest discover      # the suite
python3 -m american_cycle         # one seeded demo game
```

Games are seeded (`Game(names, seed=…)`), so every run is reproducible.

## Status

Stood up 2026-08-31 as a testbed. It carries `.agent-project` so it can be
enrolled as a self-dev project later; it is not enrolled yet — no guard
workflow, no runner, no account.
