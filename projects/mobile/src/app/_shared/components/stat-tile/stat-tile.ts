import { Component, input } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonCardSubtitle,
  IonCardTitle,
  IonSkeletonText,
  IonText,
} from '@ionic/angular/standalone';

/**
 * A single labelled figure — eyebrow, value, optional hint.
 *
 * Deliberately owns no layout: the caller wraps tiles in `ion-grid`/`ion-col`
 * so one tile can sit in a 2x2 grid on one screen and a 2-column row on
 * another. What it does own is the loading skeleton, which would otherwise be
 * repeated once per tile.
 */
@Component({
  selector: 'mh-stat-tile',
  imports: [IonCard, IonCardContent, IonCardSubtitle, IonCardTitle, IonSkeletonText, IonText],
  templateUrl: './stat-tile.html',
  styleUrl: './stat-tile.scss',
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly loading = input(false);
  /** Ionic palette name applied to the value — use for semantic emphasis only. */
  readonly valueColor = input<string | null>(null);
  /** Same, for the hint line — "2 overdue invoices" earns `danger`. */
  readonly hintColor = input<string | null>(null);
}
