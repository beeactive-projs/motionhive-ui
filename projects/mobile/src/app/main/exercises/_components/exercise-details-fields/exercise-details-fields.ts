import { Component, input } from '@angular/core';
import {
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToggle,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { ExerciseDraftForm } from '../../exercise-draft';
import {
  EXERCISE_ICONS,
  FORCE_OPTIONS,
  MECHANIC_OPTIONS,
  PATTERN_OPTIONS,
} from '../../exercises.config';

/**
 * Everything about an exercise that is optional: classification, the demo
 * link and cues, and who can see it.
 *
 * The create wizard's last step and the edit page render exactly this, so it
 * is one block rather than two templates that agree today. It writes
 * straight into the page's `ExerciseDraftForm` — the block has no state of
 * its own to get out of sync with the draft.
 */
@Component({
  selector: 'mh-exercise-details-fields',
  imports: [
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonToggle,
  ],
  templateUrl: './exercise-details-fields.html',
  styleUrl: './exercise-details-fields.scss',
})
export class ExerciseDetailsFields {
  readonly form = input.required<ExerciseDraftForm>();
  /** Under the Visibility card — the edit page's "n coaches have forked this". */
  readonly visibilityNote = input<string | null>(null);

  readonly patternOptions = PATTERN_OPTIONS;
  readonly mechanicOptions = MECHANIC_OPTIONS;
  readonly forceOptions = FORCE_OPTIONS;

  constructor() {
    addIcons(EXERCISE_ICONS);
  }
}
