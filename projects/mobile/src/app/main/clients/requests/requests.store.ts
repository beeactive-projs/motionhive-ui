import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, take, tap } from 'rxjs';

import { ClientService, InstructorClient, InstructorClientStatuses } from 'core';

import { splitPendingRows } from '../clients.config';

/** The BE drops expired rows, and a coach with more than this pending has a different problem. */
const PAGE_LIMIT = 100;

type LoadOptions = { force?: boolean; done?: () => void };

/**
 * Page-scoped state for the Requests screen.
 *
 * One call feeds both sections: `GET /clients?status=PENDING` returns every
 * open `client_request` in the coach's name — incoming requests and sent
 * invitations alike — normalised into `InstructorClient` rows whose `id` is
 * the request id. The two dedicated endpoints each see only half of it
 * (`getPendingRequests` is recipient-only, `getSentInvites` email-only), so
 * neither is used here.
 *
 * Verbs return the request so the page can toast; the row is updated here
 * the moment the call succeeds, and a silent reload follows to pick up
 * anything the BE changed alongside.
 */
@Injectable()
export class RequestsStore {
  private readonly _clientService = inject(ClientService);

  private readonly _rows = signal<InstructorClient[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  private readonly _loaded = signal(false);
  /** Request ids with a verb in flight — their buttons disable. */
  private readonly _busy = signal<ReadonlySet<string>>(new Set());

  readonly rows = this._rows.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly incoming = computed(() => splitPendingRows(this._rows()).incoming);
  readonly sent = computed(() => splitPendingRows(this._rows()).sent);

  readonly showSkeleton = computed(() => this._loading() && !this._loaded());
  readonly showLoadError = computed(() => this._error() && !this._loaded());
  readonly isEmpty = computed(
    () => this._loaded() && !this._error() && this._rows().length === 0,
  );

  isBusy(id: string): boolean {
    return this._busy().has(id);
  }

  load(opts: LoadOptions = {}): void {
    if (this._loading() || (this._loaded() && !opts.force)) {
      opts.done?.();
      return;
    }
    this._loading.set(true);
    this._error.set(false);

    this._clientService
      .getClients({ status: InstructorClientStatuses.Pending, page: 1, limit: PAGE_LIMIT })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this._rows.set(response.items);
          this._loaded.set(true);
          this._loading.set(false);
          opts.done?.();
        },
        error: () => {
          this._error.set(true);
          this._loading.set(false);
          opts.done?.();
        },
      });
  }

  refresh(done?: () => void): void {
    this.load({ force: true, done });
  }

  accept(row: InstructorClient): Observable<unknown> {
    return this._verb(row, this._clientService.acceptRequest(row.id), () =>
      this._remove(row.id),
    );
  }

  decline(row: InstructorClient): Observable<unknown> {
    return this._verb(row, this._clientService.declineRequest(row.id), () =>
      this._remove(row.id),
    );
  }

  /** Only the sender may cancel — so only on the invitations the coach sent. */
  withdraw(row: InstructorClient): Observable<unknown> {
    return this._verb(row, this._clientService.cancelRequest(row.id), () =>
      this._remove(row.id),
    );
  }

  /** The row stays; only its expiry moves out. */
  resend(row: InstructorClient): Observable<unknown> {
    return this._verb(row, this._clientService.resendInvitation(row.id), (response) => {
      const expiresAt = response.request?.expiresAt;
      if (!expiresAt) return;
      this._rows.update((rows) =>
        rows.map((current) => (current.id === row.id ? { ...current, expiresAt } : current)),
      );
    });
  }

  private _verb<T>(
    row: InstructorClient,
    request: Observable<T>,
    onSuccess: (response: T) => void,
  ): Observable<T> {
    this._setBusy(row.id, true);
    return request.pipe(
      take(1),
      tap({
        next: (response) => {
          onSuccess(response);
          // Silent: rows stay put while the BE's view of the list lands.
          this.load({ force: true });
        },
      }),
      finalize(() => this._setBusy(row.id, false)),
    );
  }

  private _remove(id: string): void {
    this._rows.update((rows) => rows.filter((row) => row.id !== id));
  }

  private _setBusy(id: string, busy: boolean): void {
    this._busy.update((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
