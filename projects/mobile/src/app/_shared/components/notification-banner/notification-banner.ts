import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { GestureController, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, notificationsOutline } from 'ionicons/icons';
import { catchError, EMPTY, take } from 'rxjs';

import { BellNotification, NotificationService, NotificationStore } from 'core';

import { activeTabIdFromUrl } from '../../config/tabs.config';
import { categoryStyle } from '../../config/notification-categories.config';
import { isOnTarget } from '../../config/notification-deep-link';
import { HexAvatar } from '../hex-avatar/hex-avatar';

/** Long enough to read two lines, short enough not to sit over the content. */
const VISIBLE_MS = 5000;
/** How far up, or how fast, a drag must go before it counts as a dismiss. Gesture math is in px. */
const DISMISS_DISTANCE_PX = 40;
const DISMISS_VELOCITY = 0.3;

/**
 * In-app twin of a push banner: something arrived while you were looking at
 * something else.
 *
 * The arrival signal is the unread count going *up*, which comes from the
 * store's minute poll — so a banner can lag its event by up to a minute. The
 * app has no notification stream and no push worker yet. It reads fine in
 * practice because nothing that reaches the bell is a live conversation: new
 * messages are the one instant thing, and those go to the Messages tab
 * instead.
 *
 * One at a time. A second arrival replaces the first rather than stacking,
 * which is how the OS behaves and keeps this from ever covering the screen.
 * Like the OS banner it also slides away under a finger, and stays quiet when
 * you are already on the screen it would open.
 */
@Component({
  selector: 'mh-notification-banner',
  imports: [HexAvatar, IonButton, IonIcon],
  templateUrl: './notification-banner.html',
  styleUrl: './notification-banner.scss',
})
export class NotificationBanner {
  private readonly _store = inject(NotificationStore);
  private readonly _service = inject(NotificationService);
  private readonly _router = inject(Router);
  private readonly _gestureController = inject(GestureController);
  private readonly _banner = viewChild<ElementRef<HTMLElement>>('banner');

  readonly current = signal<BellNotification | null>(null);
  /** Snapping back after a drag that did not commit — the one time the card animates. */
  readonly settling = signal(false);

  readonly style = computed(() => {
    const item = this.current();
    return item ? categoryStyle(item.category) : null;
  });

  private _lastCount: number | null = null;
  private _timer?: ReturnType<typeof setTimeout>;
  /** A drag can end with a click on the card; that click must not open it. */
  private _dragged = false;

  constructor() {
    addIcons({ closeOutline, notificationsOutline });
    inject(DestroyRef).onDestroy(() => clearTimeout(this._timer));

    effect(() => {
      // Until the first poll lands the count is a placeholder 0, and reacting
      // to it would banner the whole backlog on every cold start.
      if (!this._store.countLoaded()) return;

      const count = this._store.unreadCount();
      const previous = this._lastCount;
      this._lastCount = count;

      if (previous === null || count <= previous) return;
      // No point announcing an arrival on the screen that already lists it.
      // Read off the router rather than a signal — this is a question about
      // right now, not something the effect should re-run for.
      if (this._router.url.includes('/notifications')) return;

      this._fetchNewest();
    });

    // The card sits behind an @if, so the query only resolves once it has
    // rendered — which is also the first moment there is an element to attach
    // the gesture to. The cleanup runs when the card leaves.
    afterRenderEffect((onCleanup) => {
      const el = this._banner()?.nativeElement;
      if (!el) return;

      const gesture = this._gestureController.create({
        el,
        gestureName: 'mh-banner-dismiss',
        direction: 'y',
        threshold: 10,
        onStart: () => {
          this.settling.set(false);
          this._dragged = false;
        },
        onMove: (detail) => {
          if (detail.deltaY >= 0) return;
          this._dragged = true;
          el.style.transform = `translateY(${detail.deltaY}px)`;
        },
        onEnd: (detail) => {
          const flung =
            detail.deltaY < -DISMISS_DISTANCE_PX || detail.velocityY < -DISMISS_VELOCITY;
          if (flung) {
            this.dismiss();
            return;
          }
          this.settling.set(true);
          el.style.transform = '';
          // The trailing click, if any, lands before this fires.
          setTimeout(() => (this._dragged = false));
        },
      });
      gesture.enable(true);
      onCleanup(() => gesture.destroy());
    });
  }

  open(): void {
    if (this._dragged) {
      this._dragged = false;
      return;
    }
    const item = this.current();
    if (!item) return;
    this.dismiss();
    // The centre owns what a notification does when tapped, including the
    // dead-end sheet, so hand it the row rather than deciding again here.
    void this._router.navigate([this._centreRoute()], {
      queryParams: { open: item.id },
    });
  }

  dismiss(): void {
    clearTimeout(this._timer);
    this.current.set(null);
  }

  private _fetchNewest(): void {
    this._service
      .list({ page: 1, limit: 1, unreadOnly: true })
      .pipe(
        take(1),
        catchError(() => EMPTY),
      )
      .subscribe((response) => {
        const newest = response.items[0];
        if (!newest) return;
        // The screen it opens is the one you are on: that screen updates
        // itself, and the badge has already moved.
        if (isOnTarget(this._router.url, newest.data)) return;
        this.current.set(newest);
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this.current.set(null), VISIBLE_MS);
      });
  }

  /** Open the centre inside the tab the user is already in. */
  private _centreRoute(): string {
    return `/tabs/${activeTabIdFromUrl(this._router.url) ?? 'home'}/notifications`;
  }
}
