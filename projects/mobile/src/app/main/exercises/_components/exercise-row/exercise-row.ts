import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonIcon, IonItem, IonLabel } from '@ionic/angular/standalone';

import { Exercise } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import {
  exerciseSubline,
  kindIcon,
  kindTone,
  levelLabel,
  levelTone,
  ownershipChip,
} from '../../exercises.config';

/**
 * One row of the exercise library: a tile, the name, what it trains, and a
 * level chip.
 *
 * The tile is the exercise's own photo where there is one and the
 * kind-tinted hexagon where there is not. Seeded system exercises ship a
 * start-position frame; a custom one usually has nothing until the coach
 * pastes a YouTube link. A list that insisted on photos would be half empty
 * boxes, and one that refused them would throw away the only picture of the
 * movement we have — so the photo fills the same hexagon the tint would,
 * and the shape stays constant down the list either way.
 *
 * Ownership is chip-silent for system rows: in a catalogue of eight hundred
 * they are the default case, and saying so on every row says nothing.
 *
 * The same row serves the program picker, where it is a checkbox rather
 * than a link: pass `selected` and the chevron becomes a check mark and the
 * chips step aside — a row you are ticking needs its name and its tick, not
 * its difficulty.
 */
@Component({
  selector: 'mh-exercise-row',
  imports: [HexAvatar, IonBadge, IonIcon, IonItem, IonLabel],
  templateUrl: './exercise-row.html',
  styleUrl: './exercise-row.scss',
})
export class ExerciseRow {
  readonly exercise = input.required<Exercise>();
  /** Whose library this is, so "Mine" can be told from someone else's public row. */
  readonly myUserId = input<string | null>(null);
  /** Set (true or false) in a picker; left null where the row is a link. */
  readonly selected = input<boolean | null>(null);

  readonly select = output<void>();

  readonly name = computed(() => this.exercise().name);

  readonly subline = computed(() => exerciseSubline(this.exercise()));

  readonly levelLabel = computed(() => levelLabel(this.exercise().level));

  readonly levelTone = computed(() => levelTone(this.exercise().level));

  readonly kindTone = computed(() => kindTone(this.exercise().kind));

  readonly ownership = computed(() => ownershipChip(this.exercise(), this.myUserId()));

  readonly thumbnailUrl = computed(() => this.exercise().thumbnailUrl || null);

  readonly isPicker = computed(() => this.selected() !== null);

  /**
   * The hexagon takes an icon or a picture, never both — the glyph would
   * sit on top of the photo. The kind tint stays underneath regardless, so
   * a photo that fails to load still reads as an exercise of that kind.
   */
  readonly tileIcon = computed(() =>
    this.thumbnailUrl() ? null : kindIcon(this.exercise().kind),
  );
}
