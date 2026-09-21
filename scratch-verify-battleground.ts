import { finding } from './findings/battleground-concentration.ts';
const t0 = Date.now();
const claims = finding.predicate();
console.log('ms:', Date.now() - t0);
for (const c of claims) console.log(c.name, '=', c.value.toFixed(4), ' stamped', c.stamped, ' tol', c.tolerance);
console.log('\nverdict:', finding.verdict(claims));
