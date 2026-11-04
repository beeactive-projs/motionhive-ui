/**
 * Append a page, skipping rows already held. Offset paging repeats a row
 * whenever the order shifts between two pages (a row added above the
 * window, a ranking that moved with use), and a repeat would show twice
 * and break a `track row.id`.
 */
export function appendUnique<T extends { id: string }>(
  rows: readonly T[],
  incoming: readonly T[],
): T[] {
  const held = new Set(rows.map((row) => row.id));
  return [...rows, ...incoming.filter((row) => !held.has(row.id))];
}
