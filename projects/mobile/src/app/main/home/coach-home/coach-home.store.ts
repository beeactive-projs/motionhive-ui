import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, take } from 'rxjs';

import {
  ClientService,
  EarningsService,
  EarningsSummary,
  InstructorClientStatuses,
  SessionInstance,
  SessionInstanceStatus,
  SessionService,
} from 'core';

const AGENDA_LIMIT = 10;

/**
 * Data behind the coach home.
 *
 * Unlike the trainee home this has no web equivalent to port — `/coaching/overview`
 * is placeholder data — so the cards are assembled from the coach services
 * directly. Same discipline as the trainee side: independent loaders, per-card
 * loading signals, errors swallowed into empty states.
 *
 * Four calls, one per block the design shows: agenda, requests banner, and the
 * two stat tiles. Nothing loads for a block that isn't on screen.
 */
@Injectable()
export class CoachHomeStore {
  private readonly _sessionService = inject(SessionService);
  private readonly _clientService = inject(ClientService);
  private readonly _earningsService = inject(EarningsService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _agenda = signal<SessionInstance[]>([]);
  private readonly _pendingRequests = signal(0);
  private readonly _earnings = signal<EarningsSummary | null>(null);
  private readonly _activeClients = signal(0);

  readonly agenda = this._agenda.asReadonly();
  readonly pendingRequests = this._pendingRequests.asReadonly();
  readonly earnings = this._earnings.asReadonly();
  readonly activeClients = this._activeClients.asReadonly();

  readonly agendaLoading = signal(true);
  readonly requestsLoading = signal(true);
  readonly earningsLoading = signal(true);
  readonly clientsLoading = signal(true);

  readonly hasAgenda = computed(() => this._agenda().length > 0);
  readonly showRequestsBanner = computed(() => this._pendingRequests() > 0);

  load(): void {
    this._loadAgenda();
    this._loadPendingRequests();
    this._loadEarnings();
    this._loadActiveClients();
  }

  refresh(done?: () => void): void {
    this.load();
    done?.();
  }

  private _loadAgenda(): void {
    this.agendaLoading.set(true);

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    this._sessionService
      .listInstances({
        dateFrom: startOfDay.toISOString(),
        dateTo: endOfDay.toISOString(),
        status: SessionInstanceStatus.Scheduled,
        limit: AGENDA_LIMIT,
      })
      .pipe(
        take(1),
        catchError(() => of(null)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((response) => {
        this._agenda.set(response?.items ?? []);
        this.agendaLoading.set(false);
      });
  }

  private _loadPendingRequests(): void {
    this.requestsLoading.set(true);
    // Purpose-built count endpoint — cheaper than fetching the request list.
    this._clientService
      .getPendingRequestsCount()
      .pipe(
        take(1),
        catchError(() => of(null)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((response) => {
        this._pendingRequests.set(response?.count ?? 0);
        this.requestsLoading.set(false);
      });
  }

  private _loadEarnings(): void {
    this.earningsLoading.set(true);
    this._earningsService
      .getSummary()
      .pipe(
        take(1),
        catchError(() => of(null)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((summary) => {
        this._earnings.set(summary);
        this.earningsLoading.set(false);
      });
  }

  private _loadActiveClients(): void {
    this.clientsLoading.set(true);
    // There is no /clients/count endpoint; limit 1 makes the list call cheap
    // enough to read `total` from. Worth replacing with a real count later.
    this._clientService
      .getClients({ status: InstructorClientStatuses.Active, page: 1, limit: 1 })
      .pipe(
        take(1),
        catchError(() => of(null)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((response) => {
        this._activeClients.set(response?.total ?? 0);
        this.clientsLoading.set(false);
      });
  }
}
