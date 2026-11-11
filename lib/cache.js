// Minimal in-memory TTL cache with a size cap (oldest entry is evicted first).
// Per-process only, which is enough to soften CoinGecko's rate limits.
export function createTtlCache({ ttlMs, maxEntries = 500 }) {
  const entries = new Map();

  return {
    async getOrLoad(key, load) {
      const cached = entries.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.value;

      const value = await load();
      entries.delete(key);
      if (entries.size >= maxEntries) {
        entries.delete(entries.keys().next().value);
      }
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    },
  };
}
