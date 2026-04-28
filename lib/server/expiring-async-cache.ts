import "server-only";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export function createExpiringAsyncCache<T>(ttlMs: number) {
  const entries = new Map<string, CacheEntry<T>>();
  const pending = new Map<string, Promise<T>>();

  return {
    clear(key: string) {
      entries.delete(key);
      pending.delete(key);
    },
    read(key: string) {
      const entry = entries.get(key);

      if (!entry) {
        return null;
      }

      if (ttlMs > 0 && entry.expiresAt <= Date.now()) {
        entries.delete(key);
        return null;
      }

      return entry.value;
    },
    async getOrLoad(key: string, load: () => Promise<T>) {
      if (ttlMs > 0) {
        const entry = entries.get(key);

        if (entry && entry.expiresAt > Date.now()) {
          return entry.value;
        }
      }

      const inFlight = pending.get(key);

      if (inFlight) {
        return inFlight;
      }

      const request = load()
        .then((value) => {
          if (ttlMs > 0) {
            entries.set(key, {
              expiresAt: Date.now() + ttlMs,
              value,
            });
          }

          return value;
        })
        .finally(() => {
          if (pending.get(key) === request) {
            pending.delete(key);
          }
        });

      pending.set(key, request);
      return request;
    },
  };
}
