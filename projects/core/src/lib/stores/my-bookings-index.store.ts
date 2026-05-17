import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of, tap } from 'rxjs';
import { SessionService } from '../services/session/session.service';
import type { SessionParticipant } from '../models/session/session.model';
import { MyTab } from '../models/session/session.enums';

/**
 * Lightweight cache of the current user's "active" bookings (Upcoming +
 * Pending + Waitlisted). Used by Discover cards + the public Showcase
 * to detect "I'm already booked on this instance" so we can swap the
 * Book button for a Cancel / view-in-My-Sessions affordance.
 *
 * `providedIn: 'root'` so multiple consumers share the cache. Refreshed
 * on demand after Book / Cancel actions via `invalidate()`.
 */
@Injectable({ providedIn: 'root' })
export class MyBookingsIndexStore {
  private readonly _svc = inject(SessionService);

  private readonly _byInstanceId = signal<Map<string, SessionParticipant>>(
    new Map(),
  );
  private readonly _loaded = signal(false);
  private readonly _loading = signal(false);

  readonly loaded = this._loaded.asReadonly();
  readonly loading = this._loading.asReadonly();

  /** Returns the user's participant row for an instance, or null. */
  readonly bookingFor = (instanceId: string): SessionParticipant | null =>
    this._byInstanceId().get(instanceId) ?? null;

  readonly hasBooking = (instanceId: string): boolean =>
    this._byInstanceId().has(instanceId);

  readonly count = computed(() => this._byInstanceId().size);

  /**
   * Populate the index. Idempotent — subsequent calls re-use the cache
   * unless `force` is true. After any Book / Cancel UI action, call
   * `invalidate()` then `ensureLoaded()` to refresh.
   */
  ensureLoaded(force = false): void {
    if (this._loading()) return;
    if (this._loaded() && !force) return;
    this._loading.set(true);

    forkJoin({
      upcoming: this._svc.listMy({ tab: MyTab.Upcoming, limit: 100 }).pipe(
        catchError(() => of({ items: [], total: 0, page: 1, pageSize: 100 })),
      ),
      pending: this._svc.listMy({ tab: MyTab.PendingApproval, limit: 100 }).pipe(
        catchError(() => of({ items: [], total: 0, page: 1, pageSize: 100 })),
      ),
      waitlisted: this._svc.listMy({ tab: MyTab.Waitlisted, limit: 100 }).pipe(
        catchError(() => of({ items: [], total: 0, page: 1, pageSize: 100 })),
      ),
    })
      .pipe(
        tap(({ upcoming, pending, waitlisted }) => {
          const map = new Map<string, SessionParticipant>();
          for (const p of [
            ...upcoming.items,
            ...pending.items,
            ...waitlisted.items,
          ]) {
            if (p.instanceId) map.set(p.instanceId, p);
          }
          this._byInstanceId.set(map);
          this._loaded.set(true);
        }),
      )
      .subscribe({ complete: () => this._loading.set(false) });
  }

  /** Drop the cache so the next `ensureLoaded(true)` re-fetches. */
  invalidate(): void {
    this._loaded.set(false);
    this._byInstanceId.set(new Map());
  }
}
