/**
 * Date helpers shared across calendar surfaces.
 *
 * Local-zone aware — never round-trips through UTC because midnight in
 * one zone can land on a different calendar day in another.
 */

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

/** ISO 8601 week start (Monday) for the week containing `d`. */
export function weekStart(d: Date): Date {
  const out = new Date(d);
  const dayOffset = (d.getDay() + 6) % 7;
  out.setDate(d.getDate() - dayOffset);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
