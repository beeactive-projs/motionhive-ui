/**
 * Superset links in a plan's day or a routine, as plain rules both apps
 * share: link a row with the next, undo it, keep groups clean, tag rows.
 */

/** What the superset links need to know about a plan row. */
export interface Linkable {
  supersetGroupId: number | null;
}

/**
 * Clean superset groups: a group only means something for two or more rows
 * standing together, so a row left alone is unlinked, and groups are
 * numbered 1, 2, 3 in the order they appear.
 */
export function normalizeSupersets<T extends Linkable>(rows: readonly T[]): T[] {
  const runs: { group: number; start: number; end: number }[] = [];
  rows.forEach((row, i) => {
    const group = row.supersetGroupId;
    const last = runs[runs.length - 1];
    if (group === null) return;
    if (last && last.group === group && last.end === i - 1) last.end = i;
    else runs.push({ group, start: i, end: i });
  });
  const next = new Map<number, number>();
  let counter = 0;
  for (const run of runs) {
    if (run.end > run.start) next.set(run.start, ++counter);
  }
  let current: number | null = null;
  let until = -1;
  return rows.map((row, i) => {
    const run = runs.find((r) => r.start === i);
    if (run) {
      current = next.get(i) ?? null;
      until = run.end;
    }
    const group = i <= until ? current : null;
    return group === row.supersetGroupId ? row : { ...row, supersetGroupId: group };
  });
}

/** Link a row with the one after it: join its superset, or start one together. */
export function linkWithNext<T extends Linkable>(rows: readonly T[], index: number): T[] {
  if (index < 0 || index >= rows.length - 1) return [...rows];
  const a = rows[index].supersetGroupId;
  const b = rows[index + 1].supersetGroupId;
  const used = rows.map((r) => r.supersetGroupId ?? 0);
  const group = a ?? b ?? Math.max(0, ...used) + 1;
  return normalizeSupersets(
    rows.map((row, i) => {
      // The next row's whole superset joins, so linking two groups merges them.
      const joins = i === index || i === index + 1 || (b !== null && row.supersetGroupId === b && i > index);
      return joins ? { ...row, supersetGroupId: group } : row;
    }),
  );
}

/** Undo the link between a row and the one after it; anything left alone is unlinked. */
export function unlinkFromNext<T extends Linkable>(rows: readonly T[], index: number): T[] {
  if (index < 0 || index >= rows.length - 1) return [...rows];
  const group = rows[index].supersetGroupId;
  if (group === null) return [...rows];
  const fresh = Math.max(0, ...rows.map((r) => r.supersetGroupId ?? 0)) + 1;
  let splitting = true;
  return normalizeSupersets(
    rows.map((row, i) => {
      if (i <= index) return row;
      if (splitting && row.supersetGroupId === group) return { ...row, supersetGroupId: fresh };
      splitting = false;
      return row;
    }),
  );
}

/** "A1", "A2", "B1": each linked row's tag, null for the rest. */
export function supersetTags(rows: readonly Linkable[]): (string | null)[] {
  const letters = new Map<number, string>();
  const counts = new Map<number, number>();
  return rows.map((row) => {
    const group = row.supersetGroupId;
    if (group === null) return null;
    if (!letters.has(group)) letters.set(group, String.fromCharCode(65 + letters.size));
    const n = (counts.get(group) ?? 0) + 1;
    counts.set(group, n);
    return `${letters.get(group)}${n}`;
  });
}
