import { Component, computed, effect, inject, viewChild } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular/standalone';

import { AppModeStore, AuthStore, NavMode, NavModes } from 'core';

import { resolveMode } from '../../_shared/config/tabs.config';
import { MySessions } from '../my-sessions/my-sessions';
import { Sessions } from '../sessions/sessions';

/**
 * `/tabs/sessions` for whoever is asking: the coach's agenda, or the trainee's
 * own bookings.
 *
 * A `canMatch` guard was the obvious way to do this and it does not work.
 * Ionic caches a tab's page stack and restores it on return, so the router
 * never re-resolves the route — an instructor who switched to training mode
 * kept the agenda they had already opened, under a trainee tab bar. Switching
 * on a signal instead means the swap follows the mode with no navigation.
 *
 * The catch, and the reason this class is not two lines: Ionic calls
 * `ionViewWillEnter` on the *routed* component only, which is now this shell.
 * Neither screen would ever load. So the hook is forwarded to whichever child
 * is on screen, and the effect covers the other entry — a mode flip, where the
 * child is built fresh while the shell stays put.
 */
@Component({
  selector: 'mh-sessions-shell',
  imports: [MySessions, Sessions],
  template: `
    @if (mode() === NavModes.Coach) {
      <mh-sessions />
    } @else {
      <mh-my-sessions />
    }
  `,
})
export class SessionsShell implements ViewWillEnter {
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);

  private readonly _agenda = viewChild(Sessions);
  private readonly _bookings = viewChild(MySessions);

  readonly NavModes = NavModes;

  readonly mode = computed<NavMode>(() =>
    resolveMode(this._authStore.isInstructor(), this._appModeStore.mode()),
  );

  constructor() {
    // A mode flip swaps the child without any navigation, so nothing else
    // would tell it to load.
    effect(() => {
      this.mode();
      queueMicrotask(() => this.ionViewWillEnter());
    });
  }

  ionViewWillEnter(): void {
    this._agenda()?.ionViewWillEnter();
    this._bookings()?.ionViewWillEnter();
  }
}
