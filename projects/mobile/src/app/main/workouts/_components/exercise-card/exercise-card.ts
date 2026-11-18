import { Component, input, output } from '@angular/core';
import { IonCard, IonCardContent } from '@ionic/angular/standalone';

import { ExerciseKind } from 'core';

import { ExerciseHead } from '../exercise-head/exercise-head';

/**
 * One exercise as a card: its header up top (`mh-exercise-head`: the tile,
 * the name opening the catalogue page for the movement, the ⋮ or a chevron,
 * the notes), and whatever the screen prescribes or logs against it
 * projected underneath.
 *
 * Three screens draw this frame — the live logger, the routine builder and
 * a program day — and each had its own copy of the header, the card chrome
 * and the "tap the name to see the movement" affordance. One component, so a
 * change to the card lands in all three and the builder really is the logger
 * without a stopwatch. The logger's superset card is the fourth: it draws
 * the same header once per member.
 *
 * A host whose body pads its own rows (the logger's set table) narrows the
 * card with `--mh-card-inset` and `--mh-card-lead`, so the tile sits over
 * the body's first column (exercise-card.scss).
 */
@Component({
  selector: 'mh-exercise-card',
  imports: [ExerciseHead, IonCard, IonCardContent],
  templateUrl: './exercise-card.html',
  styleUrl: './exercise-card.scss',
  host: {
    '[class.skipped]': 'skipped()',
    '[class.linked]': '!!tag()',
  },
})
export class ExerciseCard {
  readonly name = input.required<string>();
  /** The line under the name (`ExerciseHead.meta`). Omit for none. */
  readonly meta = input<string | null>(null);
  /** A skipped exercise stays visible and legible; it is a decision, not an absence. */
  readonly skipped = input(false);
  /** Shows the ellipsis in place of the chevron and emits `actions` from it. */
  readonly showActions = input(false);
  /** The exercise's kind, for the tinted hexagon beside the name. Omit for none. */
  readonly kind = input<ExerciseKind | null>(null);
  /** The exercise's photo, drawn in the hexagon as the library rows draw it. */
  readonly imageUrl = input<string | null>(null);
  /** The person's own note on the movement, when there is one. */
  readonly note = input<string | null>(null);
  /** The plan's note on the exercise, in its author's words. */
  readonly planNote = input<string | null>(null);

  /** "A1": a superset member's tag, before the name; the card gets the honey rail. */
  readonly tag = input<string | null>(null);

  /** The note line was tapped: edit it. */
  readonly noteTap = output<void>();

  readonly open = output<void>();
  readonly actions = output<void>();
}
