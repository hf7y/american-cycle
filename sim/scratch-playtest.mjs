import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HTML = pathToFileURL(path.resolve('ui/index.html')).href;
const SEED = Number(process.env.PLAYTEST_SEED || '2');

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
pg.on('pageerror', (e) => errors.push('PAGEERROR ' + e));
await pg.goto(HTML);
await pg.waitForTimeout(700);

await pg.fill('#sseed', String(SEED));
await pg.click('#go');
await pg.waitForTimeout(400);
const districts_t0 = await pg.evaluate(() => G.players.map((p) => p.districts.map((d) => d.id)));

let cycles = 0, declared = 0, withdrew = 0, bills = 0, finished = false;
for (let step = 0; step < 3000; step++) {
  if (await pg.locator('#modal.on').count()) {
    const body = await pg.innerText('#modalBody');
    if (await pg.locator('#stand').count()) {
      withdrew++;
      await pg.click(withdrew % 2 ? '#stand' : '#pull');
    } else if (await pg.locator('#yes').count()) {
      bills++;
      await pg.click('#yes');
    } else if (await pg.locator('#party').count()) {
      await pg.click('#party');
    } else if (await pg.locator('#again').count()) {
      console.log(`GAME OVER after ${cycles} declaration phases`);
      console.log('  ' + body.replace(/\n/g, ' | ').slice(0, 220));
      finished = true;
      break;
    } else if (await pg.locator('#rr').count()) {
      await pg.locator('#rr button').first().click();
    } else {
      console.log('UNKNOWN MODAL:', body.slice(0, 160));
      break;
    }
    await pg.waitForTimeout(30);
    continue;
  }
  const cards = pg.locator('#hand .cc');
  const go = pg.locator('#controls button').first();
  if ((await cards.count()) && declared < 3 * (cycles + 1)) {
    await cards.first().click();
    await pg.waitForTimeout(20);
    const states = pg.locator('#map .st.act');
    if (await states.count()) {
      await states.first().click();
      declared++;
      await pg.waitForTimeout(30);
      continue;
    }
  }
  if (await go.count()) {
    await go.click();
    cycles++;
    await pg.waitForTimeout(30);
    continue;
  }
  console.log('stuck: no modal, no card, no state, no go button');
  break;
}
if (!finished) console.log('did not reach GAME OVER');

const log_entries = await pg.locator('#log .le').count();
console.log(`declarations ${declared} | withdrawal windows ${withdrew} | bill votes ${bills} | log entries ${log_entries}`);
if (finished) {
  const end = await pg.evaluate(() => ({
    stats: G.stats,
    leanMap: G.leanMap,
    events: G.events.map((e) => ({
      office: e.office, uncontested: e.uncontested,
      winnerCardId: (e.sides.find((s) => s.player === e.winner) || {}).cardId,
    })),
    heldCardIds: G.seats.filter((s) => s.holder).map((s) => s.holder.cardId),
    handCardIds: G.players.flatMap((p) => p.hand.filter((c) => c.kind === 'candidate').map((c) => c.id)),
    districts: G.players.map((p) => p.districts.map((d) => d.id)),
  }));
  const owner_t0 = {};
  districts_t0.forEach((ds, i) => ds.forEach((key) => (owner_t0[key] = i)));
  const owner_end = {};
  end.districts.forEach((ds, i) => ds.forEach((key) => (owner_end[key] = i)));
  const captured = Object.entries(owner_t0).some(([k, v]) => k in owner_end && owner_end[k] !== v);
  const held = new Set(end.heldCardIds);
  const everWon = new Set(end.events.map((e) => e.winnerCardId).filter(Boolean));
  const handSet = new Set(end.handCardIds);
  const expiredToHand = [...everWon].some((id) => !held.has(id) && handSet.has(id));
  console.log('stats:', JSON.stringify(end.stats));
  const phases = {
    'an election resolved': end.events.some((e) => !e.uncontested),
    'a bill was voted': end.stats.billsAttempted > 0,
    'the Fed reacted to spending': end.stats.rateRises > 0,
    'a lean was pushed': Object.values(end.leanMap).some(Boolean),
    'a district was captured': captured,
    'a term expired and a card returned to hand': expiredToHand,
  };
  for (const [name, happened] of Object.entries(phases)) console.log(`  ${happened ? '✓' : '✗'} ${name}`);
}
console.log('console errors:', errors.length);
for (const e of errors.slice(0, 12)) console.log('  ✗', e.slice(0, 200));
await b.close();
