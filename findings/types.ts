/** A finding is a PREDICATE, not a sentence.
 *
 *  The prose headline is a stamped snapshot of what the predicate returned on
 *  a given engine at a given moment. It is expected to go stale, and going
 *  stale is not a failure — it is the finding telling you the engine moved.
 *  The predicate is the durable artefact; the headline is a convenience that
 *  carries its own expiry.
 *
 *  `npm run findings` re-runs every predicate, compares against the stamp, and
 *  reports HOLDS / STALE / BROKEN. `--restamp` writes the new values back.
 *
 *  ONE RULE BEYOND THAT: if a finding recommends a shipped config, the finding
 *  must CHECK that config — read it from disk as a claim with zero tolerance.
 *  Otherwise the config is a hardcoded opinion sitting next to its evidence
 *  rather than being held to it, and the two drift apart silently. See
 *  `decay-push-tradeoff.ts`, which asserts that `as-written-plus.json` still
 *  ships the push table the predicate selects.
 */
export interface Claim {
  /** what is being asserted, in the form a check can evaluate */
  name: string;
  /** the measured value this run */
  value: number;
  /** the value when the headline was stamped */
  stamped: number;
  /** how far it may drift before the headline is considered stale */
  tolerance: number;
  unit?: string;
}

export interface Finding {
  id: string;
  /** Every config file whose contents this finding's conclusion depends on,
   *  by filename — e.g. `['as-written-plus.json']`. Declaring one obliges the
   *  finding to CHECK it: `findings/well-formed.test.ts` rejects any finding
   *  that names a dependency without a zero-tolerance claim reading it back.
   *  Empty is legal and means "this finding recommends no shipped setting". */
  dependsOn: string[];
  /** the design question this answers, verbatim where possible */
  question: string;
  /** prose, true as of `stampedAt` and no later */
  headline: string;
  stampedAt: string;
  /** engine commit the stamp was taken on */
  stampedOn: string;
  /** re-derives the claims from scratch. No cached numbers. */
  predicate(): Promise<Claim[]> | Claim[];
  /** what the claims mean together, evaluated fresh each run */
  verdict(claims: Claim[]): string;
}
