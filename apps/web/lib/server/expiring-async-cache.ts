import "server-only";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type CacheState<T> = {
  entry?: CacheEntry<T>;
  pending?: Promise<T>;
};

export function createExpiringAsyncCache<T>(ttlMs: number) {
  const states = new Map<string, CacheState<T>>();

  return {
    clear(key: string) {
      // Removing the state object is also the invalidation token. A loader keeps
      // a reference to the state it started with and may only publish its result
      // while that exact object is still current for the key.
      states.delete(key);
    },
    clearAll() {
      states.clear();
    },
    read(key: string) {
      const state = states.get(key);
      const entry = state?.entry;

      if (!entry) {
        return null;
      }

      if (ttlMs > 0 && entry.expiresAt <= Date.now()) {
        state.entry = undefined;

        if (!state.pending) {
          states.delete(key);
        }

        return null;
      }

      return entry.value;
    },
    set(key: string, value: T) {
      if (ttlMs > 0) {
        // Replacing the state prevents an older pending loader from overwriting
        // this explicit value when it settles later.
        states.set(key, {
          entry: {
            expiresAt: Date.now() + ttlMs,
            value,
          },
        });
      } else {
        states.delete(key);
      }
    },
    async getOrLoad(key: string, load: () => Promise<T>) {
      let state = states.get(key);

      if (ttlMs > 0) {
        const entry = state?.entry;

        if (entry && entry.expiresAt > Date.now()) {
          return entry.value;
        }

        if (entry && state) {
          state.entry = undefined;
        }
      }

      const inFlight = state?.pending;

      if (inFlight) {
        return inFlight;
      }

      if (!state) {
        state = {};
        states.set(key, state);
      }

      const requestState = state;
      let loaded: Promise<T>;

      try {
        loaded = load();
      } catch (error) {
        if (states.get(key) === requestState && !requestState.entry) {
          states.delete(key);
        }

        throw error;
      }

      const request = loaded
        .then((value) => {
          if (
            ttlMs > 0 &&
            states.get(key) === requestState &&
            requestState.pending === request
          ) {
            requestState.entry = {
              expiresAt: Date.now() + ttlMs,
              value,
            };
          }

          return value;
        })
        .finally(() => {
          if (states.get(key) === requestState && requestState.pending === request) {
            requestState.pending = undefined;

            if (!requestState.entry) {
              states.delete(key);
            }
          }
        });

      requestState.pending = request;
      return request;
    },
  };
}
