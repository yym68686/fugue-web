/**
 * Run an async mapper over `items` with a bounded number of in-flight tasks.
 *
 * `Promise.all(items.map(fn))` starts every task at once. When each task opens a
 * network connection, a large list can fire dozens of simultaneous connections
 * from a single process; upstream proxies/edges may refuse or time out the burst
 * (observed as `UND_ERR_CONNECT_TIMEOUT`), so most tasks fail even though the
 * backend is healthy. Bounding concurrency keeps the connection count sane while
 * still overlapping I/O.
 *
 * Results are returned in the same order as `items`. `fn` receives the item and
 * its original index. This helper does not catch errors — a rejecting `fn`
 * rejects the whole call, matching `Promise.all` semantics; wrap `fn` in your own
 * try/catch if you want per-item fallbacks.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const bound = Math.max(1, Math.min(limit, items.length));
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: bound }, () => worker()));
  return results;
}
