import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { catchError, of, take } from 'rxjs';

import {
  BlockedSessionInstance,
  JoinInfo,
  MyBookingsIndexStore,
  PublicSessionInstance,
  SessionLocationKind,
  SessionParticipant,
  SessionParticipantStatus,
  SessionService,
  apiErrorMessage,
  isBlockedInstance,
} from 'core';

/**
 * Page-scoped state for the trainee's session detail.
 *
 * There is no participant-scoped detail endpoint — the screen is the PUBLIC
 * instance plus the trainee's own booking laid over it. The booking arrives
 * through router state when the list pushed here (the only source that also
 * covers past and cancelled bookings), with `MyBookingsIndexStore` as the
 * deep-link fallback for active ones.
 *
 * `joinInfo` is the server's authority on the join window and the only place
 * the meeting link exists for list-loaded bookings (`listMy` strips the
 * snapshot URL). It 403s for anyone not confirmed — the screen then falls
 * back to the derived window and simply has no link until a retry.
 */
@Injectable()
export class BookingDetailStore {
  private readonly _sessionService = inject(SessionService);
  private readonly _myBookingsIndexStore = inject(MyBookingsIndexStore);

  private readonly _id = signal<string | null>(null);
  private readonly _stateParticipant = signal<SessionParticipant | null>(null);
  private readonly _instance = signal<
    PublicSessionInstance | BlockedSessionInstance | null
  >(null);
  private readonly _joinInfo = signal<JoinInfo | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  /** Which instance the current `joinInfo` belongs to — refetch guard. */
  private _joinInfoFor: string | null = null;

  readonly instance = this._instance.asReadonly();
  readonly joinInfo = this._joinInfo.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * The trainee's own booking for this instance. The index wins when it has
   * an entry — it is refreshed after every book/cancel, while the router
   * state is a snapshot from the moment the list was tapped.
   */
  readonly booking = computed<SessionParticipant | null>(() => {
    const id = this._id();
    if (!id) return null;
    return this._myBookingsIndexStore.bookingFor(id) ?? this._stateParticipant();
  });

  constructor() {
    // The booking can resolve after the instance (index still loading), so
    // the join-info fetch is a reaction, not a load step.
    effect(() => {
      const id = this._id();
      const instance = this._instance();
      const booking = this.booking();
      if (!id || !instance || isBlockedInstance(instance)) return;
      if (booking?.status !== SessionParticipantStatus.Confirmed) return;
      if (instance.template?.locationKind !== SessionLocationKind.Online) return;
      if (this._joinInfoFor === id) return;
      this._joinInfoFor = id;

      this._sessionService
        .joinInfo(id)
        .pipe(
          take(1),
          // 403/anything: the derived window carries the screen instead.
          catchError(() => of(null)),
        )
        .subscribe((info) => this._joinInfo.set(info));
    });
  }

  load(id: string, stateParticipant: SessionParticipant | null): void {
    this._id.set(id);
    this._stateParticipant.set(
      stateParticipant?.instanceId === id ? stateParticipant : null,
    );
    this._instance.set(null);
    this._joinInfo.set(null);
    this._joinInfoFor = null;
    // Deep links have no router state; the index is the only chance to know
    // this session is already booked. Idempotent when already loaded.
    this._myBookingsIndexStore.ensureLoaded();
    this._fetch(false);
  }

  /** Silent refresh keeps the current screen when the network lets us down. */
  reload(opts: { silent?: boolean } = {}): void {
    this._fetch(!!opts.silent);
  }

  /** After a cancel the router-state booking is a stale CONFIRMED row. */
  clearStateParticipant(): void {
    this._stateParticipant.set(null);
  }

  private _fetch(silent: boolean): void {
    const id = this._id();
    if (!id || this._loading()) return;
    this._loading.set(true);
    if (!silent) this._error.set(null);

    this._sessionService
      .getPublicInstance(id)
      .pipe(take(1))
      .subscribe({
        next: (instance) => {
          this._instance.set(instance);
          this._error.set(null);
          this._loading.set(false);
        },
        error: (error: unknown) => {
          if (!silent || !this._instance()) {
            this._error.set(apiErrorMessage(error, "Couldn't load this session."));
          }
          this._loading.set(false);
        },
      });
  }
}
