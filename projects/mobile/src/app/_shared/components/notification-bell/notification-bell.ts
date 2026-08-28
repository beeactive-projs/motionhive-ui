import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { IonBadge, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { notificationsOutline } from 'ionicons/icons';
import { filter, map, startWith } from 'rxjs';

import { NotificationStore } from 'core';

import { activeTabIdFromUrl } from '../../config/tabs.config';

/**
 * The bell for a tab's root header, with its unread dot.
 *
 * It links into its *own* tab's copy of the centre — Ionic keys a navigation
 * stack on the first segment after `/tabs`, so a fixed address would yank the
 * user out of the tab they were working in.
 *
 * The count comes from the shared store, which polls once a minute for the
 * whole app; every bell on screen reads the same signal. Visually it is only
 * a dot — the number lives in the accessible name and in the centre itself.
 */
@Component({
  selector: 'mh-notification-bell',
  imports: [IonBadge, IonButton, IonIcon, RouterLink],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
})
export class NotificationBell {
  private readonly _store = inject(NotificationStore);
  private readonly _router = inject(Router);

  readonly unread = this._store.unreadCount;

  private readonly _url = toSignal(
    this._router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this._router.url),
    ),
    { initialValue: this._router.url },
  );

  readonly target = computed(
    () => `/tabs/${activeTabIdFromUrl(this._url()) ?? 'home'}/notifications`,
  );

  constructor() {
    // Registered here, not by each host page — the bell is the only thing that
    // renders this glyph, and six pages each remembering is six chances to
    // forget.
    addIcons({ notificationsOutline });
  }
}
