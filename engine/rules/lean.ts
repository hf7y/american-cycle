/** State lean — design doc §10. Signed pips: positive = R, negative = D,
 *  counters cancelling on placement, which is what a signed integer is.
 *  Neutral is the state's own baseline, not purple: the board tracks
 *  deviation only, exactly as Cook PVI does. */
import type { Office, Party } from '../types/index.ts';

export type Lean = Record<string, number>;

export interface LeanConfig {
  pushByMargin: { maxPips: number; push: number }[];
  decayPerTick: number;
  decayFrequency: 'annual' | 'biennial';
  governorPushes: 'never' | 'with-lean';
  honeymoonCounter: number;
  maxLean: number;
  /** §10 scales the push "by how decisively the race was won" and never says
   *  what a walkover does -- a race nobody contested has no margin at all.
   *  0 reads it as "a race nobody tested tells you nothing"; 1 reads running
   *  unopposed as itself decisive. The gap is real either way (F5). */
  uncontestedPush?: number;
}

export function sign(p: Party): number { return p === 'R' ? 1 : p === 'D' ? -1 : 0; }

export function pushForMargin(cfg: LeanConfig, marginPips: number): number {
  for (const row of cfg.pushByMargin) if (marginPips <= row.maxPips) return row.push;
  return cfg.pushByMargin[cfg.pushByMargin.length - 1].push;
}

/** §10: the most nationalized race on the ballot pushes. Governors never reach
 *  the top of this ordering in an election year, which is why they never push
 *  -- the exclusion falls out of the priority rule rather than being asserted. */
const PRIORITY: Office[] = ['president', 'senator', 'representative', 'governor'];

export function nationalizedRace<T extends { office: Office }>(races: T[]): T | undefined {
  for (const office of PRIORITY) {
    const hit = races.filter((r) => r.office === office);
    if (hit.length) return hit[0];
  }
  return undefined;
}

export function applyPush(
  lean: Lean, cfg: LeanConfig, state: string, winner: Party, office: Office, marginPips: number,
): number {
  if (office === 'governor') {
    if (cfg.governorPushes === 'never') return 0;
    // 'with-lean': a governor pushes only when winning WITH the existing lean,
    // never against it (§10, "the alternative under test").
    const cur = lean[state] ?? 0;
    if (cur === 0 || Math.sign(cur) !== sign(winner)) return 0;
  }
  const push = pushForMargin(cfg, marginPips) * sign(winner);
  const before = lean[state] ?? 0;
  lean[state] = clampLean(before + push, cfg.maxLean);
  return lean[state] - before;
}

/** Decay removes one counter from every state, toward zero. §10: it happens at
 *  the top of the year, so the board players see when they declare is already
 *  decayed -- and pushes land later, on election night. */
export function decay(lean: Lean, cfg: LeanConfig, year: number): void {
  if (cfg.decayFrequency === 'biennial' && year % 2 !== 0) return;
  for (const st of Object.keys(lean)) {
    const v = lean[st];
    if (v === 0) continue;
    lean[st] = v > 0 ? Math.max(0, v - cfg.decayPerTick) : Math.min(0, v + cfg.decayPerTick);
  }
}

/** The honeymoon: a newly elected president places one counter in every state
 *  carried. Removed at the next decay, so the incoming party enters the midterm
 *  with a fleeting map advantage immediately before the -2 lands on them. */
export function honeymoon(lean: Lean, cfg: LeanConfig, carried: string[], party: Party): void {
  for (const st of carried) lean[st] = clampLean((lean[st] ?? 0) + cfg.honeymoonCounter * sign(party), cfg.maxLean);
}

function clampLean(v: number, max: number): number { return Math.max(-max, Math.min(max, v)); }
