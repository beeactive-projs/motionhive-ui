import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonIcon, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, createOutline, ellipsisVerticalOutline } from 'ionicons/icons';

import { ExerciseKind } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { exerciseTile } from '../../../exercises/exercises.config';

/**
 * An exercise's header, after the workout prototype: the kind's tile, the
 * name with one line under it (`meta`), and at the end either a chevron
 * inside it (the header is a link and nothing more) or the verb sheet's ⋮
 * beside it, when the screen has verbs to offer. Beside, not inside: a
 * button in a button is one control to a screen reader. Under it, the
 * person's note and the plan's note, when there are any.
 *
 * `mh-exercise-card` draws one over its body. The logger's superset card
 * draws one per member, so a superset's exercises have exactly the header
 * an exercise on its own has.
 *
 * It sits on the card's grid: `--mh-card-inset` and `--mh-card-lead` from
 * the card (exercise-head.scss). The card above it sets the space on top.
 */
@Component({
  selector: 'mh-exercise-head',
  imports: [HexAvatar, IonButton, IonIcon, IonItem, IonLabel, TranslatePipe],
  templateUrl: './exercise-head.html',
  styleUrl: './exercise-head.scss',
  host: {
    '[class.skipped]': 'skipped()',
  },
})
export class ExerciseHead {
  readonly name = input.required<string>();
  /**
   * The line under the name, one line with an ellipsis: what the plan asks
   * in the logger ("3 × 8–10 · 62.5 kg · rest 2:00"), "3 sets" on a program
   * day. Omit for none, and the name centres on the tile.
   */
  readonly meta = input<string | null>(null);
  /** A skipped exercise stays visible and legible; it is a decision, not an absence. */
  readonly skipped = input(false);
  /** Shows the ellipsis in place of the chevron and emits `actions` from it. */
  readonly showActions = input(false);
  /** The exercise's kind, for the tinted hexagon beside the name. Omit for none. */
  readonly kind = input<ExerciseKind | null>(null);
  /** The exercise's photo, drawn in the hexagon as the library rows draw it. */
  readonly imageUrl = input<string | null>(null);
  /**
   * The person's own note on the movement ("Seat 4, pin on 3"), shown each
   * time it comes up. Only when there is one: nothing new costs a line for
   * someone who never writes one.
   */
  readonly note = input<string | null>(null);
  /** The plan's note on the exercise, in its author's words. */
  readonly planNote = input<string | null>(null);
  /** "A1": a superset member's tag, before the name. */
  readonly tag = input<string | null>(null);

  /** The name was tapped: open the movement. */
  readonly open = output<void>();
  /** The ⋮ was tapped. */
  readonly actions = output<void>();
  /** The note line was tapped: edit it. */
  readonly noteTap = output<void>();

  /** The hex tile: the photo, else the kind's glyph (`exerciseTile`). */
  readonly tile = computed(() => exerciseTile(this.kind(), this.imageUrl()));

  constructor() {
    // Hosted by three features; none of them should have to know which
    // glyphs it draws.
    addIcons({ chevronForwardOutline, createOutline, ellipsisVerticalOutline });
  }
}
