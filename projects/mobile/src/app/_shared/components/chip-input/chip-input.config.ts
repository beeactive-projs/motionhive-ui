import { foldForSearch } from 'core';

/**
 * The rules behind `mh-chip-input`: a field whose entries become chips (a
 * coach's own specialities, a group's tags). Pure, so the spec can hold
 * every edge still.
 */

/** What separates several entries typed or pasted at once: "boxing, tennis". */
const SEPARATORS = /[,;\n]/;

/**
 * An entry as it is compared: case, accents and spacing aside, so "Forță"
 * and "forta " are one. The API's `foldText` folds the same way.
 */
export function chipKey(text: string): string {
  return foldForSearch(text.trim().replace(/\s+/g, ' '));
}

/** The entries in what was typed: trimmed, inner runs of spaces made one, empty ones dropped. */
export function splitChipText(text: string): string[] {
  const entries: string[] = [];
  for (const part of text.split(SEPARATORS)) {
    const entry = part.trim().replace(/\s+/g, ' ');
    if (entry !== '') {
      entries.push(entry);
    }
  }
  return entries;
}

export interface ChipRules {
  /** How many chips there may be in all. */
  max: number;
  /** The longest one entry may be. */
  maxLength: number;
  /** Names an entry may not repeat (the list it adds to, shown elsewhere). */
  exclude: readonly string[];
}

/** What the line under the chips says after an add, most pressing first. */
export const ChipNotices = {
  /** Some entries had no room under the cap; they stay in the field. */
  Full: 'full',
  /** Some entries were over the length; they stay in the field to be shortened. */
  TooLong: 'tooLong',
  /** Some entries only repeated an excluded name; they were not added. */
  Excluded: 'excluded',
  /** Some entries were chips already; they were not added again. */
  Duplicate: 'duplicate',
} as const;
export type ChipNotice = (typeof ChipNotices)[keyof typeof ChipNotices];

export interface ChipAddResult {
  /** Every chip after the add, in order. */
  values: string[];
  /** The entries that became chips. */
  added: string[];
  /** The chips that were typed again, as the chips spell them. */
  duplicates: string[];
  /** The excluded names typed, as the list spells them ("forta" is "Forță"). */
  excluded: string[];
  /** What stays in the field: the entries over the length and the ones the cap had no room for. */
  rest: string;
  notice: ChipNotice | null;
}

/**
 * Add what was typed to `values`: each entry once (an entry repeated in the
 * same paste is simply dropped), none that repeats an excluded name, none
 * over the length, and no more than the cap. Whatever could not be added but
 * can still be fixed stays in the field.
 */
export function addChips(
  values: readonly string[],
  text: string,
  rules: ChipRules,
): ChipAddResult {
  const next = [...values];
  const existing = spellings(values);
  const excludedNames = spellings(rules.exclude);
  const typed = new Set<string>();
  const added: string[] = [];
  const duplicates: string[] = [];
  const excluded: string[] = [];
  const kept: string[] = [];
  let tooLong = false;
  let full = false;

  for (const entry of splitChipText(text)) {
    const key = chipKey(entry);
    if (typed.has(key)) {
      continue;
    }
    typed.add(key);
    const listed = excludedNames.get(key);
    if (listed !== undefined) {
      excluded.push(listed);
      continue;
    }
    const chip = existing.get(key);
    if (chip !== undefined) {
      duplicates.push(chip);
      continue;
    }
    if (entry.length > rules.maxLength) {
      tooLong = true;
      kept.push(entry);
      continue;
    }
    if (next.length >= rules.max) {
      full = true;
      kept.push(entry);
      continue;
    }
    existing.set(key, entry);
    next.push(entry);
    added.push(entry);
  }

  let notice: ChipNotice | null = null;
  if (full) {
    notice = ChipNotices.Full;
  } else if (tooLong) {
    notice = ChipNotices.TooLong;
  } else if (excluded.length > 0) {
    notice = ChipNotices.Excluded;
  } else if (duplicates.length > 0) {
    notice = ChipNotices.Duplicate;
  }

  return { values: next, added, duplicates, excluded, rest: kept.join(', '), notice };
}

/** Each name by its key, first spelling kept. */
function spellings(names: readonly string[]): Map<string, string> {
  const byKey = new Map<string, string>();
  for (const name of names) {
    const key = chipKey(name);
    if (!byKey.has(key)) {
      byKey.set(key, name);
    }
  }
  return byKey;
}

/** Add stays off until there is something to add and room for it. */
export function canAddChip(text: string, count: number, max: number): boolean {
  if (count >= max) {
    return false;
  }
  return splitChipText(text).length > 0;
}
