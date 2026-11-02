import { translate } from 'core';

import { ChoiceOption } from '../../../_shared/components/choice-sheet/choice-sheet';
import { secondsToClock } from '../workouts.config';

export {
  linkWithNext,
  normalizeSupersets,
  supersetTags,
  unlinkFromNext,
} from 'core';
export type { Linkable } from 'core';

/** Rests offered in the builder, one tap each. */
export const BUILDER_REST_CHOICES = [45, 60, 90, 120, 150, 180, 240, 300] as const;

/** The value a rest sheet uses for "no rest of its own". */
export const NO_REST = '';

/**
 * Rows for a rest sheet: what applies when this one sets nothing (the
 * person's default, or the routine's), then the rests themselves.
 */
export function builderRestChoices(inherit: string): ChoiceOption[] {
  return [
    { value: NO_REST, label: inherit },
    ...BUILDER_REST_CHOICES.map((seconds) => ({ value: String(seconds), label: secondsToClock(seconds) })),
  ];
}

/** "Your default (1:30)": what the routine rests when it sets nothing itself. */
export function personDefaultLabel(seconds: number): string {
  return translate('workouts.routineBuilder.rest.yourDefault', { value: secondsToClock(seconds) });
}
