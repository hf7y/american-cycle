import unittest

from american_cycle.cards import Card, DECK, ATTACK, ENDORSEMENT, RALLY
from american_cycle.game import Game, STARTING_CAPITAL


class TestCards(unittest.TestCase):
    def test_deck_kinds_are_valid(self):
        for c in DECK:
            self.assertIn(c.kind, (RALLY, ATTACK, ENDORSEMENT))

    def test_unknown_kind_rejected(self):
        with self.assertRaises(ValueError):
            Card("Third Party", "spoiler", 0, 1)


class TestGame(unittest.TestCase):
    def setUp(self):
        self.g = Game(["Blue", "Red"], seed=1)
        self.blue, self.red = self.g.players

    def test_needs_two_players(self):
        with self.assertRaises(ValueError):
            Game(["Blue"])

    def test_deal_is_deterministic(self):
        a = [c.name for c in Game(["A", "B"], seed=42).players[0].hand]
        b = [c.name for c in Game(["A", "B"], seed=42).players[0].hand]
        self.assertEqual(a, b)

    def test_rally_adds_capital_net_of_cost(self):
        card = Card("Bus Tour", RALLY, 1, 4)
        self.blue.hand.append(card)
        self.g.play(self.blue, card)
        self.assertEqual(self.blue.capital, STARTING_CAPITAL - 1 + 4)

    def test_endorsement_buys_score(self):
        card = Card("County Chair", ENDORSEMENT, 2, 3)
        self.blue.hand.append(card)
        self.g.play(self.blue, card)
        self.assertEqual(self.blue.score, 3)
        self.assertEqual(self.blue.capital, STARTING_CAPITAL - 2)

    def test_attack_hits_the_leader_not_yourself(self):
        self.red.score = 10
        card = Card("Attack Ad", ATTACK, 2, 5)
        self.blue.hand.append(card)
        self.g.play(self.blue, card)
        self.assertEqual(self.red.capital, 0)          # 3 - 5, floored
        self.assertEqual(self.blue.capital, STARTING_CAPITAL - 2)

    def test_capital_never_goes_negative(self):
        card = Card("Ethics Probe", ATTACK, 0, 99)
        self.blue.hand.append(card)
        self.g.play(self.blue, card)
        self.assertEqual(self.red.capital, 0)

    def test_cannot_play_unaffordable_card(self):
        card = Card("Former President", ENDORSEMENT, 6, 10)
        self.blue.hand.append(card)
        with self.assertRaises(ValueError):
            self.g.play(self.blue, card)

    def test_cannot_play_card_not_in_hand(self):
        with self.assertRaises(ValueError):
            self.g.play(self.blue, Card("Town Hall", RALLY, 0, 2))

    def test_turn_passes_when_nothing_is_affordable(self):
        self.blue.capital = 0
        self.blue.hand = [Card("Governor", ENDORSEMENT, 4, 6)]
        self.assertIsNone(self.g.take_turn(self.blue))

    def test_run_is_reproducible_and_produces_a_winner(self):
        one = Game(["Blue", "Red", "Green"], seed=99).run()
        two = Game(["Blue", "Red", "Green"], seed=99).run()
        self.assertEqual(
            [(p.name, p.score, p.capital) for p in one],
            [(p.name, p.score, p.capital) for p in two],
        )
        self.assertEqual(len(one), 3)
        self.assertGreaterEqual(one[0].score, one[-1].score)

    def test_standings_are_ordered_by_score(self):
        g = Game(["A", "B"], seed=5)
        g.players[0].score, g.players[1].score = 2, 9
        self.assertEqual(g.winner().name, "B")

    def test_deck_exhaustion_is_not_fatal(self):
        g = Game(["A", "B"], seed=3, rounds=20)
        g.run()
        self.assertEqual(g.deck, [])


if __name__ == "__main__":
    unittest.main()
