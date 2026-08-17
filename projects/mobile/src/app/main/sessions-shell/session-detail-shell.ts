import { Component, computed, inject } from '@angular/core';

import { AppModeStore, AuthStore, NavMode, NavModes } from 'core';

import { resolveMode } from '../../_shared/config/tabs.config';
import { SessionShowcase } from '../my-sessions/session-showcase/session-showcase';
import { SessionDetail } from '../sessions/session-detail/session-detail';

/**
 * One session at `/tabs/sessions/:id`, from whichever side is asking — the
 * coach's roster and controls, or the trainee's booking.
 *
 * Same reason as `SessionsShell`: the mode has to be able to change without a
 * navigation, and a route guard cannot see that happen.
 */
@Component({
  selector: 'mh-session-detail-shell',
  imports: [SessionDetail, SessionShowcase],
  template: `
    @if (mode() === NavModes.Coach) {
      <mh-session-detail />
    } @else {
      <mh-session-showcase />
    }
  `,
})
export class SessionDetailShell {
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);

  readonly NavModes = NavModes;

  readonly mode = computed<NavMode>(() =>
    resolveMode(this._authStore.isInstructor(), this._appModeStore.mode()),
  );
}
