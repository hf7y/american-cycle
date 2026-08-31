"""Card definitions for American Cycle."""

from dataclasses import dataclass

RALLY = "rally"            # +value capital to you
ATTACK = "attack"          # -value capital from the current leader
ENDORSEMENT = "endorsement"  # +value score, paid for out of capital

KINDS = (RALLY, ATTACK, ENDORSEMENT)


@dataclass(frozen=True)
class Card:
    name: str
    kind: str
    cost: int
    value: int

    def __post_init__(self):
        if self.kind not in KINDS:
            raise ValueError(f"unknown kind: {self.kind}")


DECK = [
    Card("Town Hall", RALLY, 0, 2),
    Card("Iowa Caucus", RALLY, 0, 3),
    Card("Small-Dollar Drive", RALLY, 0, 2),
    Card("Bus Tour", RALLY, 1, 4),
    Card("Convention Speech", RALLY, 2, 6),
    Card("Super PAC", RALLY, 3, 8),
    Card("Opposition Research", ATTACK, 1, 3),
    Card("Attack Ad", ATTACK, 2, 5),
    Card("Leaked Memo", ATTACK, 2, 4),
    Card("Debate Gaffe", ATTACK, 3, 7),
    Card("Ethics Probe", ATTACK, 4, 9),
    Card("Union Local", ENDORSEMENT, 2, 3),
    Card("County Chair", ENDORSEMENT, 2, 3),
    Card("Newspaper Board", ENDORSEMENT, 3, 5),
    Card("Governor", ENDORSEMENT, 4, 6),
    Card("Former President", ENDORSEMENT, 6, 10),
]
