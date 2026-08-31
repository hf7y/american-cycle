"""Play one seeded demo game: python3 -m american_cycle [seed]"""

import sys

from .game import Game

seed = int(sys.argv[1]) if len(sys.argv) > 1 else 0
game = Game(["Blue", "Red", "Green"], seed=seed)
for place, p in enumerate(game.run(), 1):
    print(f"{place}. {p.name:6} score {p.score:3}  capital {p.capital:3}")
