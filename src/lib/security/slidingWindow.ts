/* Counts events per key over a rolling time window (PRD §21.2 rate limiting). Pure, unit-tested. */
export class SlidingWindow {
  private hits = new Map<string, number[]>();

  constructor(private readonly windowMs: number) {}

  private recent(key: string, now: number): number[] {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  count(key: string, now = Date.now()): number {
    return this.recent(key, now).length;
  }

  oldest(key: string, now = Date.now()): number | null {
    return this.recent(key, now)[0] ?? null;
  }

  hit(key: string, now = Date.now()): void {
    this.hits.set(key, [...this.recent(key, now), now]);
  }

  clear(): void {
    this.hits.clear();
  }
}
