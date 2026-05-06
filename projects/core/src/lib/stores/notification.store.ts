// projects/core/src/lib/stores/notification.store.ts
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, finalize, tap } from 'rxjs';
import { NotificationService } from '../services/notification/notification.service';
import { BellNotification } from '../models/notification/notification.model';
import { AuthStore } from './auth.store';

/**
 * Polling cadence for the unread badge while the tab is in focus.
 * 60 seconds is a reasonable balance — fast enough that "5min ago"
 * never feels stale, slow enough to keep the BE call rate trivial
 * (~1440 calls / active user / day).
 *
 * Phase 6+ swaps this for an SSE stream — same store interface,
 * same component contract, just a different transport behind
 * `unreadCount`.
 */
const POLL_INTERVAL_MS = 60_000;

/**
 * NotificationStore — signal-based state for the bell + notification UI.
 *
 * Two responsibilities:
 *   1. Polling the unread-count endpoint while authenticated + visible.
 *   2. Caching the last-fetched bell list so the dropdown opens instantly
 *      after the first fetch.
 *
 * Mutations (markRead / dismiss / remove) update the signal optimistically
 * and call the API in the background — failures roll back via reload.
 */
@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly _service = inject(NotificationService);
  private readonly _authStore = inject(AuthStore);

  // ─── Internal state ───────────────────────────────────────────
  private readonly unreadCountSignal = signal(0);
  private readonly notificationsSignal = signal<BellNotification[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly hasLoadedListSignal = signal(false);

  // ─── Public readonly surface ──────────────────────────────────
  readonly unreadCount = this.unreadCountSignal.asReadonly();
  readonly notifications = this.notificationsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly hasLoadedList = this.hasLoadedListSignal.asReadonly();
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  private pollTimer?: ReturnType<typeof setInterval>;
  private visibilityListener?: () => void;

  constructor() {
    // Auto-start polling when the user logs in, stop on logout.
    // Effects run in injection context so cleanup is automatic when
    // the store is destroyed (which is never for `providedIn: 'root'`,
    // but the symmetry is nice).
    effect(() => {
      if (this._authStore.isAuthenticated()) {
        this.startPolling();
      } else {
        this.stopPolling();
        this.reset();
      }
    });
  }

  // ─── Polling lifecycle ────────────────────────────────────────

  /**
   * Begin the unread-count poll. Idempotent — safe to call multiple
   * times. Also fires once immediately so the badge shows up without
   * waiting POLL_INTERVAL_MS on first login.
   */
  startPolling() {
    if (this.pollTimer) return;
    this.refreshUnreadCount();

    this.pollTimer = setInterval(() => {
      // Only poll while the tab is in focus. Saves the user (and us)
      // from chatter when they're working in another tab.
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.refreshUnreadCount();
      }
    }, POLL_INTERVAL_MS);

    // Refresh on tab regain so "you've been gone an hour" doesn't
    // show a stale badge until the next tick.
    if (typeof document !== 'undefined' && !this.visibilityListener) {
      this.visibilityListener = () => {
        if (document.visibilityState === 'visible') {
          this.refreshUnreadCount();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);
    }
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    if (typeof document !== 'undefined' && this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = undefined;
    }
  }

  // ─── Reads ────────────────────────────────────────────────────

  refreshUnreadCount() {
    this._service
      .unreadCount()
      .pipe(
        tap(({ count }) => this.unreadCountSignal.set(count)),
        // Swallow errors — polling failures shouldn't blow up the UI.
        // 401s are handled by the auth interceptor; other errors are
        // transient and the next tick recovers.
        catchError(() => EMPTY),
      )
      .subscribe();
  }

  /**
   * Load the list (typically called when the bell dropdown opens).
   * Limit defaults to 20 — the typical dropdown viewport.
   *
   * Pass `markViewedAfter: true` to flag every newly-loaded item as
   * `viewed` once the response arrives. The bell uses this on every
   * dropdown-open so analytics get the signal even for items that
   * just arrived between opens.
   */
  loadList(opts: { limit?: number; markViewedAfter?: boolean } = {}) {
    const limit = opts.limit ?? 20;
    this.loadingSignal.set(true);
    this._service
      .list({ page: 1, limit })
      .pipe(
        tap((response) => {
          this.notificationsSignal.set(response.items);
          this.hasLoadedListSignal.set(true);
          if (opts.markViewedAfter) {
            this.markVisibleAsViewed();
          }
        }),
        catchError(() => EMPTY),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe();
  }

  // ─── Optimistic mutations ─────────────────────────────────────

  /**
   * Sets `read_at` locally and on the server. Drops the unread count
   * by 1 immediately. On failure: refresh from the server to recover
   * the true state.
   */
  markRead(receiptId: string) {
    const wasUnread = this.applyReceiptUpdate(receiptId, (n) => ({
      ...n,
      readAt: n.readAt ?? new Date().toISOString(),
    }));
    if (wasUnread) {
      this.unreadCountSignal.update((c) => Math.max(0, c - 1));
    }
    this._service
      .markAsRead(receiptId)
      .pipe(catchError(() => this.recoverFromError()))
      .subscribe();
  }

  /**
   * Click-through. Same effect on the bell as markRead, but also
   * records `clicked_at` so analytics can distinguish read-via-click
   * from read-via-mark-all.
   */
  markClicked(receiptId: string) {
    const now = new Date().toISOString();
    const wasUnread = this.applyReceiptUpdate(receiptId, (n) => ({
      ...n,
      readAt: n.readAt ?? now,
      clickedAt: n.clickedAt ?? now,
    }));
    if (wasUnread) {
      this.unreadCountSignal.update((c) => Math.max(0, c - 1));
    }
    this._service
      .markAsClicked(receiptId)
      .pipe(catchError(() => this.recoverFromError()))
      .subscribe();
  }

  markAllRead() {
    const now = new Date().toISOString();
    this.notificationsSignal.update((items) =>
      items.map((n) => ({ ...n, readAt: n.readAt ?? now })),
    );
    this.unreadCountSignal.set(0);
    this._service
      .markAllAsRead()
      .pipe(catchError(() => this.recoverFromError()))
      .subscribe();
  }

  /**
   * Mark a batch as viewed. Called when the bell dropdown opens —
   * gives the BE the analytics signal without changing the unread
   * badge. Filters out IDs that already have `viewedAt` to avoid
   * a wasted PATCH.
   */
  markVisibleAsViewed() {
    const ids = this.notificationsSignal()
      .filter((n) => !n.viewedAt)
      .map((n) => n.id);
    if (ids.length === 0) return;

    const now = new Date().toISOString();
    this.notificationsSignal.update((items) =>
      items.map((n) => (ids.includes(n.id) ? { ...n, viewedAt: n.viewedAt ?? now } : n)),
    );
    this._service.markAsViewed(ids).pipe(catchError(() => EMPTY)).subscribe();
  }

  /**
   * Dismiss = "I saw it, get it out of my way" (Slack/Linear pattern).
   *
   * Removes the item from the bell list immediately so the user gets
   * instant visual feedback. The receipt stays in the DB with
   * `dismissed_at` set — we keep the analytics signal but stop
   * showing it. If a fresh notification of the same type arrives
   * later, that's a new receipt and shows up normally.
   */
  dismiss(receiptId: string) {
    const removed = this.notificationsSignal().find((n) => n.id === receiptId);
    this.notificationsSignal.update((items) => items.filter((n) => n.id !== receiptId));
    if (removed && !removed.readAt && !removed.dismissedAt) {
      this.unreadCountSignal.update((c) => Math.max(0, c - 1));
    }
    this._service
      .dismiss(receiptId)
      .pipe(catchError(() => this.recoverFromError()))
      .subscribe();
  }

  /**
   * Hard delete. Removes from the local list immediately so the bell
   * updates without a round-trip.
   */
  remove(receiptId: string) {
    const removed = this.notificationsSignal().find((n) => n.id === receiptId);
    this.notificationsSignal.update((items) => items.filter((n) => n.id !== receiptId));
    if (removed && !removed.readAt && !removed.dismissedAt) {
      this.unreadCountSignal.update((c) => Math.max(0, c - 1));
    }
    this._service
      .remove(receiptId)
      .pipe(catchError(() => this.recoverFromError()))
      .subscribe();
  }

  // ─── Internals ────────────────────────────────────────────────

  /**
   * Apply a transform to one receipt by id. Returns true if the
   * receipt was previously unread (used to decrement the badge).
   */
  private applyReceiptUpdate(
    receiptId: string,
    transform: (n: BellNotification) => BellNotification,
  ): boolean {
    let wasUnread = false;
    this.notificationsSignal.update((items) =>
      items.map((n) => {
        if (n.id !== receiptId) return n;
        if (!n.readAt && !n.dismissedAt) wasUnread = true;
        return transform(n);
      }),
    );
    return wasUnread;
  }

  /**
   * Optimistic-update recovery — when a mutation fails on the server,
   * pull the current truth from the BE so the UI doesn't drift.
   */
  private recoverFromError() {
    this.refreshUnreadCount();
    if (this.hasLoadedListSignal()) this.loadList();
    return EMPTY;
  }

  private reset() {
    this.unreadCountSignal.set(0);
    this.notificationsSignal.set([]);
    this.hasLoadedListSignal.set(false);
  }
}
