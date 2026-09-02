import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, take, tap } from 'rxjs';

import {
  ClientService,
  InstructorClient,
  RosterClient,
  RosterService,
  SessionInstance,
  SessionInstanceStatus,
  SessionService,
  apiErrorMessage,
} from 'core';

import { ROSTER_WINDOW } from '../clients.config';

/** How far ahead the Upcoming sessions section looks. */
const UPCOMING_DAYS = 30;
const UPCOMING_LIMIT = 5;

/**
 * Page-scoped state for one client.
 *
 * Three sources, none of which knows about the others: the relationship
 * (`getClient`) drives the screen; the roster row, found by user id in the
 * coach's `/coach/roster`, fills the This week card and the Plan row and is
 * simply absent when the client has no assigned work; the coach's own
 * calendar narrowed to this person feeds Upcoming sessions. The last two
 * degrade to nothing on error — a missing section, never an error screen.
 *
 * Every verb keys on `clientId`, the person's user id, which is what the
 * client endpoints take. The relationship id is never sent anywhere.
 */
@Injectable()
export class ClientDetailStore {
  private readonly _clientService = inject(ClientService);
  private readonly _rosterService = inject(RosterService);
  private readonly _sessionService = inject(SessionService);

  private readonly _clientId = signal<string | null>(null);
  private readonly _client = signal<InstructorClient | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _roster = signal<RosterClient | null>(null);
  private readonly _sessions = signal<SessionInstance[]>([]);
  private readonly _saving = signal(false);

  readonly clientId = this._clientId.asReadonly();
  readonly client = this._client.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly roster = this._roster.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly saving = this._saving.asReadonly();

  /**
   * This week's numbers, or null when nothing was due — a client with no
   * assigned work has no week to report, and a card saying "0 of 0" would be
   * a status invented from silence.
   */
  readonly week = computed(() => {
    const roster = this._roster();
    if (!roster || roster.due === 0) return null;
    return {
      due: roster.due,
      completed: roster.completed,
      skipped: roster.skipped,
      remaining: Math.max(0, roster.due - roster.completed - roster.skipped),
      percent: roster.adherencePercent,
      flagged: roster.attention !== null,
    };
  });

  readonly activePlans = computed(() => this._roster()?.activePlans ?? null);

  load(clientId: string): void {
    this._clientId.set(clientId);
    this._client.set(null);
    this._roster.set(null);
    this._sessions.set([]);
    this._error.set(null);
    this._fetchClient(false);
    this._fetchRoster();
    this._fetchSessions();
  }

  /** Silent refresh keeps the current screen when the network lets us down. */
  reload(opts: { silent?: boolean } = {}): void {
    this._fetchClient(!!opts.silent);
    this._fetchRoster();
    this._fetchSessions();
  }

  updateNotes(notes: string): Observable<InstructorClient> {
    return this._verb((clientId) => this._clientService.updateClient(clientId, { notes }));
  }

  archive(): Observable<InstructorClient> {
    return this._verb((clientId) => this._clientService.archiveClient(clientId));
  }

  unarchive(): Observable<InstructorClient> {
    return this._verb((clientId) => this._clientService.unarchiveClient(clientId));
  }

  private _verb(
    request: (clientId: string) => Observable<InstructorClient>,
  ): Observable<InstructorClient> {
    const clientId = this._clientId();
    if (!clientId) throw new Error('No client loaded');
    this._saving.set(true);
    return request(clientId).pipe(
      take(1),
      // Only what the verb changed — the response may omit the nested user.
      tap((updated) =>
        this._client.update((current) =>
          current
            ? {
                ...current,
                status: updated.status,
                notes: updated.notes,
                startedAt: updated.startedAt,
              }
            : updated,
        ),
      ),
      finalize(() => this._saving.set(false)),
    );
  }

  private _fetchClient(silent: boolean): void {
    const clientId = this._clientId();
    if (!clientId || this._loading()) return;
    this._loading.set(true);
    if (!silent) this._error.set(null);

    this._clientService
      .getClient(clientId)
      .pipe(take(1))
      .subscribe({
        next: (client) => {
          this._client.set(client);
          this._error.set(null);
          this._loading.set(false);
        },
        error: (error: unknown) => {
          if (!silent || !this._client()) {
            this._error.set(apiErrorMessage(error, "Couldn't load this client."));
          }
          this._loading.set(false);
        },
      });
  }

  private _fetchRoster(): void {
    const clientId = this._clientId();
    if (!clientId) return;

    this._rosterService
      .roster(ROSTER_WINDOW)
      .pipe(take(1))
      .subscribe({
        next: (summary) => {
          // The id may have moved on while this was in flight.
          if (this._clientId() !== clientId) return;
          this._roster.set(summary.clients.find((row) => row.clientId === clientId) ?? null);
        },
        error: () => this._roster.set(null),
      });
  }

  private _fetchSessions(): void {
    const clientId = this._clientId();
    if (!clientId) return;

    const from = new Date();
    const to = new Date(from.getTime() + UPCOMING_DAYS * 86_400_000);

    this._sessionService
      .listInstances({
        clientId,
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
        status: SessionInstanceStatus.Scheduled,
        limit: UPCOMING_LIMIT,
      })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          if (this._clientId() !== clientId) return;
          this._sessions.set(page.items);
        },
        error: () => this._sessions.set([]),
      });
  }
}
