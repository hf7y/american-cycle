import { loadConfig, loadPacks, ALL_PACKS, playOne } from './harness.ts';

const base = loadConfig('as-written-plus.json');
const cards = loadPacks(ALL_PACKS);
const AGENTS_SET = ['Random', 'Greedy', 'HouseFarm', 'Random']; // player 0 stands in for "You"
const N = 10;

function measure(cfg: any, label: string) {
  let rateRises = 0, billsPassed = 0, billsAttempted = 0, house = 0, senate = 0, years = 0, zeroRises = 0;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const r = playOne(AGENTS_SET, cards, cfg, 2 + i); // seed 2 first, matching CI's PLAYTEST_SEED
    rateRises += r.rateRises; billsPassed += r.billsPassed; billsAttempted += r.billsAttempted;
    house += r.seatsByOffice.representative; senate += r.seatsByOffice.senator; years += r.years;
    if (r.rateRises === 0) zeroRises++;
    if (i === 0) console.log('  seed 2 detail:', { years: r.years, rateRises: r.rateRises, billsAttempted: r.billsAttempted, billsPassed: r.billsPassed, house: r.seatsByOffice.representative });
  }
  console.log(label, {
    years: (years / N).toFixed(1),
    rateRises: (rateRises / N).toFixed(2), zeroRiseShare: (zeroRises / N).toFixed(2),
    billsPassed: (billsPassed / N).toFixed(2), billsAttempted: (billsAttempted / N).toFixed(2),
    house: (house / N).toFixed(1), senate: (senate / N).toFixed(1),
    secs: ((Date.now() - t0) / 1000).toFixed(1),
  });
}

measure(base, `baseline as-written-plus (hand.base=${base.hand.base}, districtsDealt=${base.draft.districtsDealt}, maxYears=${base.game.maxYears})`);
