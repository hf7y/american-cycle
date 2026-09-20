import { finding } from '../findings/battleground-concentration.ts';
const claims = await finding.predicate();
for (const c of claims) console.log(`${c.name}: ${c.value}  (stamped ${c.stamped}, tol ${c.tolerance})`);
console.log('\nVERDICT:', finding.verdict(claims));
