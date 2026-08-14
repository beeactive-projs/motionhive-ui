import { Component, input, output } from '@angular/core';
import { IonButton, IonLabel, IonListHeader, IonNote } from '@ionic/angular/standalone';

/**
 * Section heading with an optional trailing link — "From the journal /
 * Reads from the hive / Read all →". Recurs several times per landing screen.
 *
 * `ion-list-header` already provides the row layout and the `end` slot
 * alignment, so this adds structure and no styling.
 */
@Component({
  selector: 'mh-section-header',
  imports: [IonButton, IonLabel, IonListHeader, IonNote],
  templateUrl: './section-header.html',
  styleUrl: './section-header.scss',
})
export class SectionHeader {
  readonly eyebrow = input<string | null>(null);
  readonly title = input.required<string>();
  /** Omit to render no trailing link. */
  readonly linkLabel = input<string | null>(null);

  readonly linkClick = output<void>();
}
