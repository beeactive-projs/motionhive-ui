import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  IonBadge,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
} from '@ionic/angular/standalone';

import { Exercise, ExerciseSource } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { emitAndClose } from '../../../../_shared/utils/swipe';
import {
  exerciseSubline,
  kindIcon,
  kindTone,
  levelLabel,
  levelTone,
  ownershipChip,
} from '../../exercises.config';

/**
 * One row of the exercise library page, a flat-list row (`mh-flat-list`),
 * laid out like a client row: the exercise's tile, its name, and what it
 * trains with its level beside it. The name may wrap to a second line, the
 * one flat-list title that does (`lists.md`, "Exercises").
 *
 * The tile is the exercise's own photo where there is one and the
 * kind-tinted hexagon where there is not, as on `mh-exercise-row`, the card
 * list's row the picker and the Workouts tab keep.
 *
 * An exercise of your own swipes left to Edit and Delete. The row only
 * emits; the page decides which form edits it and confirms the delete.
 */
@Component({
  selector: 'mh-exercise-flat-row',
  imports: [
    HexAvatar,
    IonBadge,
    IonIcon,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    TranslatePipe,
  ],
  templateUrl: './exercise-flat-row.html',
  styleUrl: './exercise-flat-row.scss',
})
export class ExerciseFlatRow {
  readonly exercise = input.required<Exercise>();
  /** Whose library this is, so "Mine" can be told from someone else's public row. */
  readonly myUserId = input<string | null>(null);
  /** Yours: the swipe offers Edit and Delete. */
  readonly swipeable = input(false);
  /**
   * Off on a slice that is all one owner (Mine, Public): a badge every row
   * repeats says nothing, as "System" would on every catalogue row.
   */
  readonly showOwnership = input(true);

  readonly select = output<void>();
  readonly edit = output<void>();
  readonly remove = output<void>();

  readonly name = computed(() => this.exercise().name);

  readonly subline = computed(() => exerciseSubline(this.exercise()));

  /**
   * None on someone's own exercise: the short form never asks for a level,
   * so the stored default is not a difficulty anyone chose.
   */
  readonly levelLabel = computed(() => {
    const exercise = this.exercise();
    return exercise.source !== ExerciseSource.User ? levelLabel(exercise.level) : null;
  });

  readonly levelTone = computed(() => levelTone(this.exercise().level));

  readonly kindTone = computed(() => kindTone(this.exercise().kind));

  readonly ownership = computed(() =>
    this.showOwnership() ? ownershipChip(this.exercise(), this.myUserId()) : null,
  );

  readonly thumbnailUrl = computed(() => this.exercise().thumbnailUrl || null);

  /** An icon or a photo on the hexagon, never both: the glyph would sit on the photo. */
  readonly tileIcon = computed(() =>
    this.thumbnailUrl() ? null : kindIcon(this.exercise().kind),
  );

  readonly emitAndClose = emitAndClose;
}
