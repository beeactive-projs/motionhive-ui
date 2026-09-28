import { translate } from 'core';

/** The periodization models the program form offers, stored lowercase. */
export const PERIODIZATION_MODELS = ['linear', 'undulating', 'block', 'conjugate'] as const;

/**
 * Display label for a program's periodization model.
 *
 * The form stores one of `PERIODIZATION_MODELS`, which translate. The column
 * is free text on the BE, so anything else (older rows, starter content) is
 * data: shown as authored, title-cased like before.
 */
export function periodizationLabel(model: string): string {
  const key = model.trim().toLowerCase();
  if ((PERIODIZATION_MODELS as readonly string[]).includes(key)) {
    return translate(`programs.periodization.${key}`);
  }
  return model.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
