const DEFAULT_BASE = "./data/chinese-fallback";

export function fallbackShardIndex(value, shardCount) {
  let valueHash = 2166136261;
  for (const character of String(value ?? "")) {
    valueHash ^= character.codePointAt(0);
    valueHash = Math.imul(valueHash, 16777619) >>> 0;
  }
  return valueHash % shardCount;
}

export function fallbackShardName(value, shardCount) {
  return `${fallbackShardIndex(value, shardCount).toString(16).padStart(2, "0")}.json`;
}

export function createChineseFallbackLoader({
  fetchImpl = globalThis.fetch,
  base = DEFAULT_BASE,
  cacheTag = "",
} = {}) {
  let manifestPromise = null;
  const shardPromises = new Map();

  async function fetchJson(path) {
    const suffix = cacheTag ? `?v=${encodeURIComponent(cacheTag)}` : "";
    const response = await fetchImpl(`${base}/${path}${suffix}`);
    if (!response.ok) throw new Error(`Fallback HTTP ${response.status}`);
    return response.json();
  }

  async function manifest() {
    if (!manifestPromise) {
      manifestPromise = fetchJson("manifest.json").then((value) => {
        if (value?.schemaVersion !== 1 || !Number.isInteger(value.shardCount)) {
          throw new Error("Unsupported fallback manifest");
        }
        return value;
      });
    }
    return manifestPromise;
  }

  async function shard(filename) {
    if (!shardPromises.has(filename)) {
      shardPromises.set(
        filename,
        fetchJson(filename).then((value) => {
          if (value?.schemaVersion !== 1 || typeof value.entries !== "object") {
            throw new Error("Unsupported fallback shard");
          }
          return value;
        }),
      );
    }
    return shardPromises.get(filename);
  }

  return async function lookup(rawQuery) {
    const query = String(rawQuery ?? "").trim();
    if (!query) return [];
    const metadata = await manifest();
    const filename = fallbackShardName(query, metadata.shardCount);
    const payload = await shard(filename);
    return Array.isArray(payload.entries[query]) ? payload.entries[query] : [];
  };
}
