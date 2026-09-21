import { finding } from './findings/margin-ceiling.ts';
const t0 = Date.now();
const claims = finding.predicate();
console.log('ms:', Date.now() - t0);
for (const c of claims) console.log(c.name, '=', c.value.toFixed(4), ' stamped', c.stamped, ' tol', c.tolerance, ' drift?', Math.abs(c.value - c.stamped) > c.tolerance);
console.log('\nverdict:', finding.verdict(claims));
