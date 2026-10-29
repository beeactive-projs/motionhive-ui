import { Component, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { HexAvatar } from '../hex-avatar/hex-avatar';

/**
 * Illustration + heading + message + optional action, centred in whatever
 * height is left — the shape WhatsApp gives an empty screen.
 *
 * The same block was pasted three times in the clients page alone (error,
 * filtered-empty, truly-empty) and every list screen needs its own. Callers
 * register their own icon with `addIcons()` and pass the name.
 */
@Component({
  selector: 'mh-empty-state',
  imports: [IonButton, HexAvatar],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  /** ionicons name — the host page is responsible for `addIcons()`. */
  readonly icon = input.required<string>();
  readonly heading = input.required<string>();
  readonly message = input<string | null>(null);
  /**
   * Ionic palette name for the tile, in its wash. Honey by default, as on
   * every hand-built empty screen (clients, sessions, notifications): one
   * look wherever a list has nothing to show (lists.md, "Empty states").
   */
  readonly color = input('primary');
  /** Omit to render no action. */
  readonly actionLabel = input<string | null>(null);

  readonly action = output<void>();
}
