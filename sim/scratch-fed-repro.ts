import { readFileSync } from 'node:fs';
import { Game, type Config } from '../engine/game.ts';
import { RNG } from '../engine/rules/rng.ts';
import { AGENTS } from './agents.ts';
import type { Card } from '../engine/types/index.ts';

const loadConfig = (name: string): Config =>
  JSON.parse(readFileSync(new URL(`../engine/config/${name}`, import.meta.url), 'utf8')) as Config;
const CARDS: Card[] = ['1932', '1964', '1976', '1992', '2008', '2016', '2024'].flatMap((n) =>
  JSON.parse(readFileSync(new URL(`../data/pack-${n}.json`, import.meta.url), 'utf8')).cards as Card[]);

const cfg = loadConfig('as-written-plus.json');
const seed = 1;
const rng = new RNG(seed);
const agents = ['Greedy', 'HouseFarm', 'Random', 'Greedy'].map((n) => new AGENTS[n](cfg, rng));
const g = new Game(agents, structuredClone(CARDS), cfg, seed);
for (let y = 0; y < 100; y++) g.tick();
