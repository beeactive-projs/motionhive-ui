import { ChoiceOption } from '../../../_shared/components/choice-sheet/choice-sheet';
import { secondsToClock } from '../../workouts/workouts.config';

/** The default rests offered, from a quick 45 s to a heavy-lift 5 min. */
export const DEFAULT_REST_CHOICES = [45, 60, 90, 120, 150, 180, 240, 300] as const;

/** "1:30" rows for the default rest sheet; the current value is kept even if off the list. */
export function restChoices(current: number): ChoiceOption[] {
  const values: number[] = [...DEFAULT_REST_CHOICES];
  if (!values.includes(current)) values.push(current);
  return values
    .sort((a, b) => a - b)
    .map((seconds) => ({
      value: String(seconds),
      label: secondsToClock(seconds),
    }));
}
