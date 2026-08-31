/** Sample size for a finding's measurement, overridable for a smoke run.
 *
 *  A finding measures by playing games, and the full counts cost minutes.
 *  `FINDINGS_SEEDS=12 node sim/findings.ts` proves every predicate still runs
 *  in a fraction of the time; the stamps were taken at the defaults, so a run
 *  at a lower N reads STALE and says nothing about whether a headline holds.
 */
export function seeds(defaultN: number): number {
  return Number(process.env.FINDINGS_SEEDS) || defaultN;
}
