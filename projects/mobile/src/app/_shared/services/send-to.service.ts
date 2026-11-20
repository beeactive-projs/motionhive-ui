import { Service, computed, signal } from '@angular/core';

import { SendTarget } from '../config/share.config';

/**
 * Opens the "Send to…" sheet from any screen with something public to send
 * (a session, a group, a coach, an exercise, a starter). The sheet lives once
 * in the tab shell, like the photo viewer, so a screen only names what it
 * sends.
 */
@Service()
export class SendToService {
  private readonly _target = signal<SendTarget | null>(null);

  readonly target = this._target.asReadonly();
  readonly isOpen = computed(() => this._target() !== null);

  open(target: SendTarget): void {
    this._target.set(target);
  }

  close(): void {
    this._target.set(null);
  }
}
