import { Component, model } from '@angular/core';
import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/angular/standalone';

import { ExerciseLevel } from 'core';

import { LEVEL_ORDER, levelLabel } from '../../exercises.config';

/**
 * Beginner / Intermediate / Advanced as one row — a segment, not a select:
 * three answers that always fit on screen should never hide behind a tap.
 * Shared by the create wizard and the edit page so the control, and the
 * tightening that keeps "Intermediate" whole, exist once.
 */
@Component({
  selector: 'mh-level-segment',
  imports: [IonLabel, IonSegment, IonSegmentButton],
  templateUrl: './level-segment.html',
  styleUrl: './level-segment.scss',
})
export class LevelSegment {
  readonly level = model.required<ExerciseLevel>();

  readonly levels = LEVEL_ORDER;
  readonly levelLabel = levelLabel;

  /** Ionic types the segment's value loosely; only a real level gets through. */
  onChange(value: string | number | undefined): void {
    if (LEVEL_ORDER.includes(value as ExerciseLevel)) this.level.set(value as ExerciseLevel);
  }
}
