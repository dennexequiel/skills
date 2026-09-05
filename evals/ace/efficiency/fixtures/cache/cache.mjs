export function createCache(ttl, now) {
  const entries = new Map()
  return {
    set(key, value) {
      entries.set(key, { value, expires: now() + ttl })
    },
    get(key) {
      const entry = entries.get(key)
      if (!entry || entry.expires < now()) return undefined
      return entry.value
    },
  }
}
