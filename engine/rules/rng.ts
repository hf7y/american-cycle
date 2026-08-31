/** Seeded RNG. BUILD-BRIEF: every game runs from a seed so a bug is reproducible. */
export class RNG {
  private s: number;
  constructor(seed: number) { this.s = (seed >>> 0) || 1; }
  /** mulberry32 — small, fast, good enough for dice */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  d6(): number { return 1 + Math.floor(this.next() * 6); }
  int(n: number): number { return Math.floor(this.next() * n); }
  pick<T>(xs: T[]): T { return xs[this.int(xs.length)]; }
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) { const j = this.int(i + 1); [xs[i], xs[j]] = [xs[j], xs[i]]; }
    return xs;
  }
  bool(): boolean { return this.next() < 0.5; }
}
