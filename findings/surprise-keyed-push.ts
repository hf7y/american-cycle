import { loadConfig, loadPacks, playOne, BALANCE_PACKS, ALL_PACKS } from '../sim/harness.ts';
import { deckSensitivity } from '../tracks/types.ts';
import { seeds as sample } from './sample.ts';
import type { Claim, Finding } from './types.ts';

/** hf7y/american-cycle#51, RULED 2026-09-02: key the lean push on SURPRISE --
 *  how far a result beat what the state's own standing lean already predicts
 *  -- not on the race's raw margin. `engine/rules/lean.ts` ships the
 *  mechanism behind `pushKeyedOn: 'surprise'`, opt-in only: `lean.test.ts`
 *  shows it directly contradicts the fixed-margin "sustained blowouts must
 *  produce a durable lean" invariant, so it is not the default pending that
 *  call. This finding is the full-game evidence for whoever makes it -- does
 *  the mechanism actually relieve the cap-pinning #51 named as the reason for
 *  the ruling, in real play rather than in an isolated fixture? */
function measure(pushKeyedOn: 'margin' | 'surprise', packs = ALL_PACKS, seeds = sample(50)) {
  const base = loadConfig('tuned.json');
  const cards = loadPacks(packs);
  const cfg = {
    ...base,
    game: { ...base.game, startYear: 1932, maxYears: 60, victory: 'points' },
    lean: { ...base.lean, uncontestedPush: 1, pushKeyedOn },
  };
  let abs = 0, n = 0, four = 0, cap = 0, games = 0;
  for (let i = 0; i < seeds; i++) {
    const r = playOne(['Greedy', 'Lookahead', 'SenateFlood', 'HeterodoxSpecialist'], cards, cfg as never, 1020000 + i);
    games++;
    for (const v of Object.values(r.finalLean)) {
      abs += Math.abs(v); n++;
      if (Math.abs(v) >= 4) four++;
      if (Math.abs(v) >= 8) cap++;
    }
  }
  return { meanAbs: abs / n, fourPerGame: four / games, cappedPerGame: cap / games };
}

export const finding: Finding = {
  id: 'surprise-keyed-push',
  dependsOn: [],
  question:
    "hf7y/american-cycle#51's ruling says keying the push on surprise relieves the cap-pinning it names as "
    + 'the reason to change the key at all. Does it, over full games, or only in the isolated fixture '
    + 'lean.test.ts uses to demonstrate the mechanism?',

  headline:
    'It does, substantially. Over 60-year games on tuned.json (uncontestedPush 1, four-agent pool), '
    + 'surprise-keying cuts states pinned at the ±8 cap from 6.34 to 1.76 per game and mean |lean| from '
    + '2.32 to 1.15, while realigned states (|lean|>=4) fall from 12.42 to 3.80 -- so the mechanism trades '
    + 'away most of the realignment the margin-keyed table produces along with the saturation, not just '
    + 'the saturation alone. The cap relief is itself deck-sensitive (hf7y/american-cycle#91: 1.76 '
    + 'all-seven vs 1.08 four-pack pinned/game) though the direction holds either way. That tradeoff, not '
    + 'just whether the mechanism works, is what the still-open ruling has to weigh.',
  stampedAt: '2026-09-05T18:00:00Z',
  stampedOn: 'bd9ff01',

  predicate(): Claim[] {
    const margin = measure('margin');
    const surprise = measure('surprise');
    const surpriseBalance = measure('surprise', BALANCE_PACKS);
    return [
      { name: 'margin-keyed: states pinned at the cap', value: margin.cappedPerGame, stamped: 6.34, tolerance: 1.2 },
      { name: 'surprise-keyed: states pinned at the cap', value: surprise.cappedPerGame, stamped: 1.76, tolerance: 0.6 },
      { name: 'margin-keyed: mean absolute lean', value: margin.meanAbs, stamped: 2.32, tolerance: 0.4 },
      { name: 'surprise-keyed: mean absolute lean', value: surprise.meanAbs, stamped: 1.15, tolerance: 0.3 },
      { name: 'margin-keyed: states realigned per game', value: margin.fourPerGame, stamped: 12.42, tolerance: 2.0 },
      { name: 'surprise-keyed: states realigned per game', value: surprise.fourPerGame, stamped: 3.80, tolerance: 1.0 },
      // hf7y/american-cycle#91: is the surprise-keyed cap relief itself a
      // property of which era-pack list ran it?
      { name: 'surprise-keyed, BALANCE_PACKS: states pinned at the cap', value: surpriseBalance.cappedPerGame, stamped: 1.08, tolerance: 0.5 },
    ];
  },

  verdict(c: Claim[]): string {
    const by = (n: string) => c.find((x) => x.name.startsWith(n))!.value;
    const relievesCap = by('surprise-keyed: states pinned') < by('margin-keyed: states pinned');
    const deck = deckSensitivity([
      { pool: 'all-seven', value: by('surprise-keyed: states pinned') },
      { pool: 'four-pack', value: by('surprise-keyed, BALANCE_PACKS: states pinned') },
    ]);
    return [
      relievesCap
        ? `surprise-keying relieves the cap (${by('surprise-keyed: states pinned').toFixed(2)} vs ${by('margin-keyed: states pinned').toFixed(2)} pinned/game)`
        : 'surprise-keying does NOT relieve the cap in full games -- the fixture result does not generalize',
      `and trims mean |lean| ${by('margin-keyed: mean absolute').toFixed(2)} -> ${by('surprise-keyed: mean absolute').toFixed(2)}`,
      by('surprise-keyed: states realigned') < by('margin-keyed: states realigned') * 0.5
        ? 'at the cost of more than half the realigned-state count, which is the tradeoff the open ruling has to weigh'
        : 'without giving up most of the realigned-state count',
      deck.sensitive
        ? `and the cap relief is itself deck-sensitive (hf7y/american-cycle#91): ${deck.byPool['all-seven'].toFixed(2)} all-seven vs ${deck.byPool['four-pack'].toFixed(2)} four-pack`
        : 'and the cap relief held stable between the all-seven and four-pack decks (hf7y/american-cycle#91)',
    ].join('; ');
  },
};
