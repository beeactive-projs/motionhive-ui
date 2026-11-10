import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonCard, IonCardContent, IonIcon, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, createOutline, ellipsisVerticalOutline } from 'ionicons/icons';

import { ExerciseKind } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { kindIcon, kindTone } from '../../../exercises/exercises.config';

/**
 * One exercise as a card: its name up top, opening the catalogue page for
 * the movement, and whatever the screen prescribes or logs against it
 * projected underneath.
 *
 * Three screens draw this frame — the live logger, the routine builder and
 * a program day — and each had its own copy of the header, the card chrome
 * and the "tap the name to see the movement" affordance. One component, so a
 * change to the card lands in all three and the builder really is the logger
 * without a stopwatch.
 *
 * The header, after the workout prototype: the kind's tile, the name with
 * one line under it (`meta`), and at the end either a chevron inside it
 * (the header is a link and nothing more) or the verb sheet's ⋮ beside it,
 * when the screen has verbs to offer. Beside, not inside: a button in a
 * button is one control to a screen reader.
 *
 * A host whose body pads its own rows (the logger's set table) narrows the
 * card with `--mh-card-inset` and `--mh-card-lead`, so the tile sits over
 * the body's first column (exercise-card.scss).
 */
@Component({
  selector: 'mh-exercise-card',
  imports: [HexAvatar, IonButton, IonCard, IonCardContent, IonIcon, IonItem, IonLabel, TranslatePipe],
  templateUrl: './exercise-card.html',
  styleUrl: './exercise-card.scss',
  host: {
    '[class.skipped]': 'skipped()',
    '[class.linked]': '!!tag()',
  },
})
export class ExerciseCard {
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

  /** "A1": a superset member's tag, before the name; the card gets the honey rail. */
  readonly tag = input<string | null>(null);

  /** The note line was tapped: edit it. */
  readonly noteTap = output<void>();

  readonly open = output<void>();
  readonly actions = output<void>();

  /**
   * The hex tile, as the library row draws it: the photo when there is one,
   * else the kind's glyph. The kind's tint stays under the photo, so one
   * that fails to load still reads as an exercise of that kind.
   */
  readonly tile = computed(() => {
    const kind = this.kind();
    const imageUrl = this.imageUrl() || null;
    if (!kind && !imageUrl) return null;
    return {
      icon: imageUrl || !kind ? null : kindIcon(kind),
      tone: kind ? kindTone(kind) : 'medium',
      imageUrl,
    };
  });

  constructor() {
    // The card is hosted by three features; none of them should have to
    // know which glyphs it draws.
    addIcons({ chevronForwardOutline, createOutline, ellipsisVerticalOutline });
  }
}
