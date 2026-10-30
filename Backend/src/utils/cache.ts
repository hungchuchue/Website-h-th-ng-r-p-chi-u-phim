type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

const cache = {
  get<T>(key: string): T | undefined {
    const entry = store.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry.value as T;
  },

  set<T>(key: string, value: T, ttlSeconds: number) {
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },

  flushAll() {
    store.clear();
  }
};

export default cache;
