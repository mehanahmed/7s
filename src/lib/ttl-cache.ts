// Tiny in-memory TTL cache for rarely-changing reference data (settings, statuses, roles).
// Busted automatically by query() whenever a write touches the related table.
// ponytail: per-process only; with multiple instances data can be stale for up to the TTL.
const store = new Map<string, { exp: number; value: unknown }>();

export async function cached<T>(table: string, ttlMs: number, load: () => Promise<T>, key = ''): Promise<T> {
  const k = table + '|' + key;
  const hit = store.get(k);
  if (hit && hit.exp > Date.now()) return structuredClone(hit.value) as T;
  const value = await load();
  store.set(k, { exp: Date.now() + ttlMs, value: structuredClone(value) });
  return value;
}

export function bustForSql(sql: string) {
  if (/^\s*(select|show)\b/i.test(sql)) return;
  for (const k of store.keys()) if (sql.includes(k.split('|')[0])) store.delete(k);
}
