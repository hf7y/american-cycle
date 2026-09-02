/** The macro layer — design doc §13. One number for how the country is doing,
 *  one accumulated-spending track, and a 2d6 roll-under that decides when the
 *  Fed tightens. There is deliberately no second ideological axis. */
import type { RNG } from './rng.ts';

export interface EconomyConfig {
  start: number; min: number; max: number;
  strongAt: number; recessionAt: number;
  gMin: number; gMax: number;
  fedDice: number;
  rateRiseSpendDown: number;
  rateRiseEconomyHit: number;
  walkDrift: number;
  /** v0.2 item 9, the CHEAP version deliberately. An exogenous shock on a d6
   *  roll-under, hitting incumbents in proportion to the power their faction
   *  holds. Nothing positional: shocks discredit POSITIONS in reality —
   *  stagflation discredited demand management, 2008 discredited deregulation
   *  — but that version needs tags on bills and a country position, and its
   *  value is unproven. Build this, then test whether it moves the
   *  determination point. If it does, the fancy one is never built; if it does
   *  not, the complexity has been earned rather than assumed. 0 disables. */
  shockOnRollAtMost?: number;
  /** pips against an incumbent of average power. Scaled by power held. */
  shockPips?: number;
}

export interface Economy { level: number; accumulatedG: number; lastRateRise?: number; }

export function newEconomy(cfg: EconomyConfig): Economy {
  return { level: cfg.start, accumulatedG: 0 };
}

/** §13: "the economy random-walks with memory". The walk is small relative to
 *  spending and tightening, so policy is legible against the noise. */
export function walk(e: Economy, cfg: EconomyConfig, rng: RNG): number {
  const step = rng.d6() <= 3 ? -1 : 1;
  const before = e.level;
  e.level = clampEcon(e.level + step + cfg.walkDrift, cfg.min, cfg.max);
  return e.level - before;
}

/** Spending pushes the economy up and loads the track that the Fed reads. */
export function spend(e: Economy, cfg: EconomyConfig, g: number): void {
  e.accumulatedG = Math.max(0, e.accumulatedG + g);
  // Austerity (negative G) cools directly; spending warms.
  e.level = clampEcon(e.level + Math.sign(g) * (Math.abs(g) >= 4 ? 2 : 1), cfg.min, cfg.max);
}

/** §13: 2d6 roll-under against the accumulation. G12 is a certainty; the
 *  interesting range is 6 to 8, where the curve is steepest -- which is
 *  exactly where a player trying to run hot will hover. */
export function fedCheck(e: Economy, cfg: EconomyConfig, rng: RNG): { roll: number; rateRise: boolean } {
  let roll = 0;
  for (let i = 0; i < cfg.fedDice; i++) roll += rng.d6();
  const rateRise = roll <= e.accumulatedG;
  if (rateRise) {
    e.accumulatedG = Math.max(0, e.accumulatedG - cfg.rateRiseSpendDown);
    e.level = clampEcon(e.level + cfg.rateRiseEconomyHit, cfg.min, cfg.max);
  }
  return { roll, rateRise };
}

/** The shock roll. Separate from `fedCheck` because the Fed is endogenous —
 *  it reads accumulated spending — and this is not. */
export function shockCheck(cfg: EconomyConfig, rng: RNG): boolean {
  const at = cfg.shockOnRollAtMost ?? 0;
  return at > 0 && rng.d6() <= at;
}

/** Exact probability the Fed tightens at a given accumulation, 2d6 roll-under. */
export function rateRiseOdds(accumulatedG: number, dice = 2): number {
  let ways = 0, total = 0;
  const counts = new Map<number, number>();
  const rec = (d: number, sum: number) => {
    if (d === 0) { counts.set(sum, (counts.get(sum) ?? 0) + 1); return; }
    for (let f = 1; f <= 6; f++) rec(d - 1, sum + f);
  };
  rec(dice, 0);
  for (const [sum, n] of counts) { total += n; if (sum <= accumulatedG) ways += n; }
  return ways / total;
}

/** §9's national modifier from the economy, applied to the president's party.
 *  Asymmetric on purpose: voters punish downturns harder than they reward booms. */
export function economyModifier(e: Economy, cfg: EconomyConfig, strong: number, recession: number): number {
  if (e.level >= cfg.strongAt) return strong;
  if (e.level <= cfg.recessionAt) return recession;
  return 0;
}

function clampEcon(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
