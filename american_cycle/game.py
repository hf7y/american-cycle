"""Turn engine for American Cycle.

Each player is a faction with capital (spendable) and score (final ranking).
Play is round-robin: on your turn you play one affordable card or pass.
The game ends after `rounds` rounds; highest score wins, capital breaks ties.
"""

import random
from dataclasses import dataclass, field

from .cards import DECK, ATTACK, ENDORSEMENT, RALLY

STARTING_CAPITAL = 3
HAND_SIZE = 3


@dataclass
class Player:
    name: str
    capital: int = STARTING_CAPITAL
    score: int = 0
    hand: list = field(default_factory=list)


class Game:
    def __init__(self, names, rounds=4, seed=None):
        if len(names) < 2:
            raise ValueError("American Cycle needs at least 2 players")
        self.rng = random.Random(seed)
        self.rounds = rounds
        self.players = [Player(n) for n in names]
        self.deck = list(DECK)
        self.rng.shuffle(self.deck)
        for p in self.players:
            self._draw(p, HAND_SIZE)

    def _draw(self, player, n=1):
        for _ in range(n):
            if not self.deck:
                return
            player.hand.append(self.deck.pop())

    def leader(self, exclude=None):
        """The player to beat: highest score, then capital, then seat order."""
        pool = [p for p in self.players if p is not exclude]
        return max(pool, key=lambda p: (p.score, p.capital, -self.players.index(p)))

    def playable(self, player):
        return [c for c in player.hand if c.cost <= player.capital]

    def play(self, player, card):
        if card not in player.hand:
            raise ValueError(f"{player.name} does not hold {card.name}")
        if card.cost > player.capital:
            raise ValueError(f"{player.name} cannot afford {card.name}")
        player.hand.remove(card)
        player.capital -= card.cost
        if card.kind == RALLY:
            player.capital += card.value
        elif card.kind == ENDORSEMENT:
            player.score += card.value
        elif card.kind == ATTACK:
            target = self.leader(exclude=player)
            target.capital = max(0, target.capital - card.value)
        return card

    def take_turn(self, player):
        """Greedy default policy: the most valuable card you can afford."""
        options = self.playable(player)
        card = max(options, key=lambda c: c.value) if options else None
        if card:
            self.play(player, card)
        self._draw(player)
        return card

    def run(self):
        for _ in range(self.rounds):
            for p in self.players:
                self.take_turn(p)
        return self.standings()

    def standings(self):
        return sorted(self.players, key=lambda p: (-p.score, -p.capital))

    def winner(self):
        return self.standings()[0]
