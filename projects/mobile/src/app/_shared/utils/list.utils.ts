/**
 * Add `value` to the list if it is missing, remove it if it is there — the
 * one move every multi-select chip cloud and picker row makes. Returns a new
 * array; the input is never touched, so it drops straight into
 * `signal.update()`.
 */
export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}
