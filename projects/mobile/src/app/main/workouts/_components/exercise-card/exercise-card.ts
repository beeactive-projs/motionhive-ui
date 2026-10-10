import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonCard, IonCardContent, IonIcon, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronForward, ellipsisVertical } from 'ionicons/icons';

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
 * The trailing control is either a chevron (the header is a link and nothing
 * more) or the verb sheet's ellipsis, when the screen has verbs to offer.
 */
@Component({
  selector: 'mh-exercise-card',
  imports: [HexAvatar, IonButton, IonCard, IonCardContent, IonIcon, IonItem, IonLabel, TranslatePipe],
  templateUrl: './exercise-card.html',
  styleUrl: './exercise-card.scss',
  host: {
    '[class.skipped]': 'skipped()',
  },
})
export class ExerciseCard {
  readonly name = input.required<string>();
  /** The line under the name — "Last time: 80 kg — 8 · 8 · 7", "3 sets". */
  readonly meta = input<string | null>(null);
  /** A skipped exercise stays visible and legible; it is a decision, not an absence. */
  readonly skipped = input(false);
  /** Shows the ellipsis in place of the chevron and emits `actions` from it. */
  readonly showActions = input(false);
  /** The exercise's kind, for the tinted hexagon beside the name. Omit for none. */
  readonly kind = input<ExerciseKind | null>(null);

  readonly open = output<void>();
  readonly actions = output<void>();

  /** The kind-tinted hex tile, same as the library row draws it. */
  readonly tile = computed(() => {
    const kind = this.kind();
    return kind ? { icon: kindIcon(kind), tone: kindTone(kind) } : null;
  });

  constructor() {
    // The card is hosted by three features; none of them should have to
    // know which glyphs it draws.
    addIcons({ chevronForward, ellipsisVertical });
  }

  onActions(event: Event): void {
    // The button sits inside the header item; without this the tap also opens
    // the catalogue page underneath the sheet.
    event.stopPropagation();
    this.actions.emit();
  }
}
