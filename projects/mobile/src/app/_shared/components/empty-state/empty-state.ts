import { Component, input, output } from '@angular/core';
import { IonButton, IonIcon, IonText } from '@ionic/angular/standalone';

/**
 * Icon + heading + message + optional action, centred in the content area.
 *
 * The same block was pasted three times in the clients page alone (error,
 * filtered-empty, truly-empty) and every list screen needs its own. Callers
 * register their own icon with `addIcons()` and pass the name.
 */
@Component({
  selector: 'mh-empty-state',
  imports: [IonButton, IonIcon, IonText],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  /** ionicons name — the host page is responsible for `addIcons()`. */
  readonly icon = input.required<string>();
  readonly heading = input.required<string>();
  readonly message = input<string | null>(null);
  /** Omit to render no button. */
  readonly actionLabel = input<string | null>(null);
  readonly actionFill = input<'solid' | 'outline'>('solid');

  readonly action = output<void>();
}
