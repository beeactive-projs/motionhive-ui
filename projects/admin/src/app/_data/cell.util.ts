/**
 * Resolve a dotted path on a row to a display string. Booleans → yes/no,
 * objects → JSON, null/undefined → ''. Shared by the generic admin
 * tables (payments, domains, moderation, audit).
 */
export function getPath(row: Record<string, unknown>, path: string): string {
  const v = path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, row);
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
