/** hf7y/american-cycle#18: engine/states.ts's govSchedule literals are a
 *  transcription of this file's election_year_segments, not derived from it
 *  at runtime (ui/build.ts bundles engine/states.ts standalone, with no JSON
 *  import). A transcription can drift from its source silently, so this is
 *  the thing that fails instead: every real election year 1932-2024 (1959
 *  for AK/HI) must be a year governorUp() also says yes to, and vice versa.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BY_CODE, governorUp } from '../engine/states.ts';

const rules = JSON.parse(readFileSync(new URL('historical/governor-rules.json', import.meta.url), 'utf8')) as
  { states: Record<string, { election_year_segments: [number, number, number][] }> };

function realYears(segments: [number, number, number][]): Set<number> {
  const years = new Set<number>();
  for (const [from, term, end] of segments) for (let y = from; y <= end; y += term) years.add(y);
  return years;
}

test("every state's real 1932-2024 governor election year matches governorUp()", () => {
  const mismatches: string[] = [];
  for (const [code, { election_year_segments }] of Object.entries(rules.states)) {
    const state = BY_CODE[code];
    assert.ok(state, `${code} is in governor-rules.json but not engine/states.ts`);
    const start = code === 'AK' || code === 'HI' ? 1959 : 1932;
    const real = realYears(election_year_segments);
    for (let y = start; y <= 2024; y++) {
      const up = governorUp(state, y);
      const shouldBe = real.has(y);
      if (up !== shouldBe) mismatches.push(`${code} ${y}: governorUp=${up}, real=${shouldBe}`);
    }
  }
  assert.deepEqual(mismatches, []);
});
