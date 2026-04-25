import { Injectable, signal } from '@angular/core';

/**
 * Tiny coordinator: the search modal lives once, globally, in the
 * authenticated layout. Triggers (sidenav search bar, Cmd/Ctrl-K, the
 * future home-hero search button) all flip this signal to open it.
 */
@Injectable({ providedIn: 'root' })
export class SearchTriggerService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }
}
