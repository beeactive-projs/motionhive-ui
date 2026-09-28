import { translate } from './translator';

/**
 * Label for an enum value: `enum.<domain>.<VALUE>`, e.g.
 * `enumLabel('clientStatus', 'ACTIVE')` → "Active".
 *
 * A value with no key yet (a new BE status the JSON hasn't caught up with)
 * renders humanised — `PAST_DUE` → "Past due" — rather than as a raw key.
 */
export function enumLabel(domain: string, value: string | null | undefined): string {
  if (!value) return '';
  const key = `enum.${domain}.${value}`;
  const label = translate(key);
  return label === key ? humanise(value) : label;
}

/**
 * `{ VALUE: label }` for an enum, each label translated when read.
 *
 * Getters, not values: these maps are module constants, evaluated before the
 * language file has loaded. Reading on access keeps every `Labels[value]`
 * call site working unchanged.
 */
export function enumLabelMap<V extends string>(domain: string, values: readonly V[]): Record<V, string> {
  const map = {} as Record<V, string>;
  for (const value of values) {
    Object.defineProperty(map, value, { get: () => enumLabel(domain, value), enumerable: true });
  }
  return map;
}

/**
 * Adds a `label` getter (`enum.<domain>.<VALUE>`) to each entry of an
 * enum-keyed metadata record — the tone/icon tables in `session-meta.const`.
 * Getters for the same reason as `enumLabelMap`.
 */
export function withEnumLabels<V extends string, T extends object>(
  domain: string,
  record: Record<V, T>,
): Record<V, T & { label: string }> {
  for (const value of Object.keys(record) as V[]) {
    Object.defineProperty(record[value], 'label', {
      get: () => enumLabel(domain, value),
      enumerable: true,
    });
  }
  return record as Record<V, T & { label: string }>;
}

function humanise(value: string): string {
  const words = value.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
