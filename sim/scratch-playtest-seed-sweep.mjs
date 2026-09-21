// Local seed sweep for sim/playtest.py's six-phase coverage check, without
// round-tripping through CI. Not committed -- throwaway.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HTML = 'file://' + path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui', 'index.html');
const seeds = process.argv.slice(2).map(Number);

async function run(seed) {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  pg.on('pageerror', (e) => errors.push(String(e)));
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await pg.goto(HTML);
  await pg.waitForTimeout(500);
  await pg.fill('#sseed', String(seed));
  await pg.click('#go');
  await pg.waitForTimeout(300);
  const districts_t0 = await pg.evaluate(() => G.players.map((p) => p.districts.map((d) => d.id)));

  let cycles = 0, declared = 0, withdrew = 0, finished = false;
  for (let step = 0; step < 3000; step++) {
    if (await pg.locator('#modal.on').count()) {
      if (await pg.locator('#stand').count()) {
        withdrew++;
        await pg.click(withdrew % 2 ? '#stand' : '#pull');
      } else if (await pg.locator('#yes').count()) {
        await pg.click('#yes');
      } else if (await pg.locator('#party').count()) {
        await pg.click('#party');
      } else if (await pg.locator('#again').count()) {
        finished = true;
        break;
      } else if (await pg.locator('#rr').count()) {
        await pg.locator('#rr button').first().click();
      } else {
        console.log(seed, 'UNKNOWN MODAL'); break;
      }
      await pg.waitForTimeout(20);
      continue;
    }
    const cards = pg.locator('#hand .cc');
    const go = pg.locator('#controls button').first();
    if ((await cards.count()) && declared < 3 * (cycles + 1)) {
      await cards.first().click(); await pg.waitForTimeout(15);
      const states = pg.locator('#map .st.act');
      if (await states.count()) {
        await states.first().click(); declared++; await pg.waitForTimeout(20); continue;
      }
    }
    if (await go.count()) { await go.click(); cycles++; await pg.waitForTimeout(20); continue; }
    console.log(seed, 'stuck'); break;
  }

  let phases = null;
  if (finished) {
    const end = await pg.evaluate(() => ({
      stats: G.stats,
      leanMap: G.leanMap,
      events: G.events.map((e) => ({ uncontested: e.uncontested, winnerCardId: (e.sides.find((s) => s.player === e.winner) || {}).cardId })),
      heldCardIds: G.seats.filter((s) => s.holder).map((s) => s.holder.cardId),
      handCardIds: G.players.flatMap((p) => p.hand.filter((c) => c.kind === 'candidate').map((c) => c.id)),
      districts: G.players.map((p) => p.districts.map((d) => d.id)),
    }));
    const owner_t0 = {}; districts_t0.forEach((ds, i) => ds.forEach((k) => { owner_t0[k] = i; }));
    const owner_end = {}; end.districts.forEach((ds, i) => ds.forEach((k) => { owner_end[k] = i; }));
    const captured = Object.keys(owner_end).some((k) => k in owner_t0 && owner_end[k] !== owner_t0[k]);
    const held = new Set(end.heldCardIds);
    const everWon = new Set(end.events.map((e) => e.winnerCardId).filter(Boolean));
    const expiredToHand = [...everWon].some((id) => !held.has(id) && end.handCardIds.includes(id));
    phases = {
      election: end.events.some((e) => !e.uncontested),
      bill: end.stats.billsAttempted > 0,
      fed: end.stats.rateRises > 0,
      lean: Object.values(end.leanMap).some(Boolean),
      capture: captured,
      expire: expiredToHand,
    };
  }
  await b.close();
  return { seed, finished, phases, errors };
}

for (const s of seeds) {
  const r = await run(s);
  console.log(JSON.stringify(r));
}
