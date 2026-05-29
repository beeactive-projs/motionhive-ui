import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of, tap } from 'rxjs';
import { SessionService } from '../services/session/session.service';
import { apiErrorMessage } from '../utils/api-error.utils';
import type {
  SessionInstance,
  SessionParticipant,
  SessionTemplate,
} from '../models/session/session.model';

/**
 * Per-instance detail store — drives the session detail page, the
 * recurring template detail page, and the approvals inbox.
 *
 * Holds:
 *   - The hydrated `SessionInstance` + its eager-loaded `SessionTemplate`
 *   - The full participant list (with status filter)
 *   - Local loading + error signals
 *
 * Intentionally NOT `providedIn: 'root'` — each detail page should get a
 * fresh instance so navigating between sessions doesn't accidentally
 * leak state across screens. Provide it at the route's `providers: []`.
 */
@Injectable()
export class SessionsDetailStore {
  private readonly _svc = inject(SessionService);
  private readonly _destroyRef = inject(DestroyRef);

  // ─── State ────────────────────────────────────────────────────────
  private readonly _instance = signal<SessionInstance | null>(null);
  private readonly _template = signal<SessionTemplate | null>(null);
  private readonly _participants = signal<SessionParticipant[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  // Track in-flight participant ids so we can disable rows mid-action.
  private readonly _busyParticipants = signal<Set<string>>(new Set());

  // ─── Public readonly ──────────────────────────────────────────────
  readonly instance = this._instance.asReadonly();
  readonly template = this._template.asReadonly();
  readonly participants = this._participants.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly busyParticipantIds = this._busyParticipants.asReadonly();

  readonly counts = computed(() => {
    const ps = this._participants();
    const confirmed = ps.filter((p) => p.status === 'CONFIRMED').length;
    const pending = ps.filter((p) => p.status === 'PENDING_APPROVAL').length;
    const waitlisted = ps.filter((p) => p.status === 'WAITLISTED').length;
    const attended = ps.filter((p) => p.attended === true).length;
    const noShow = ps.filter((p) => p.attended === false).length;
    return { confirmed, pending, waitlisted, attended, noShow };
  });

  isParticipantBusy(participantId: string): boolean {
    return this._busyParticipants().has(participantId);
  }

  // ─── Load ─────────────────────────────────────────────────────────

  /** Load instance + participants in parallel; clears prior state first. */
  load(instanceId: string): void {
    this._loading.set(true);
    this._error.set(null);
    this._instance.set(null);
    this._template.set(null);
    this._participants.set([]);

    forkJoin({
      instance: this._svc.getInstance(instanceId).pipe(
        catchError((err: unknown) => {
          this._error.set(apiErrorMessage(err, 'Could not load session'));
          return of(null);
        }),
      ),
      participants: this._svc.listInstanceParticipants(instanceId, { limit: 100 }).pipe(
        catchError(() =>
          of({ items: [] as SessionParticipant[], total: 0, page: 1, pageSize: 100 }),
        ),
      ),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ instance, participants }) => {
          if (instance) {
            this._instance.set(instance);
            if (instance.template) this._template.set(instance.template);
          }
          this._participants.set(participants.items);
        },
        complete: () => this._loading.set(false),
      });
  }

  reload(): void {
    const i = this._instance();
    if (i) this.load(i.id);
  }

  // ─── Mutations ────────────────────────────────────────────────────

  approve(participantId: string): void {
    const i = this._instance();
    if (!i) return;
    this._markBusy(participantId, true);
    this._svc.approveParticipant(i.id, participantId).pipe(
      tap(() => this._patchParticipant(participantId, { status: 'CONFIRMED' })),
      takeUntilDestroyed(this._destroyRef),
    ).subscribe({
      complete: () => this._markBusy(participantId, false),
      error: () => this._markBusy(participantId, false),
    });
  }

  decline(participantId: string, reason?: string): void {
    const i = this._instance();
    if (!i) return;
    this._markBusy(participantId, true);
    this._svc.declineParticipant(i.id, participantId, { reason }).pipe(
      tap(() => this._patchParticipant(participantId, { status: 'DECLINED' })),
      takeUntilDestroyed(this._destroyRef),
    ).subscribe({
      complete: () => this._markBusy(participantId, false),
      error: () => this._markBusy(participantId, false),
    });
  }

  setAttendance(participantId: string, attended: boolean | null): void {
    const i = this._instance();
    if (!i) return;
    this._markBusy(participantId, true);
    this._svc.patchParticipant(i.id, participantId, { attended }).pipe(
      tap((p) => this._patchParticipant(participantId, { attended: p.attended })),
      takeUntilDestroyed(this._destroyRef),
    ).subscribe({
      complete: () => this._markBusy(participantId, false),
      error: () => this._markBusy(participantId, false),
    });
  }

  setPrivateNote(participantId: string, note: string | null): void {
    const i = this._instance();
    if (!i) return;
    this._markBusy(participantId, true);
    this._svc.patchParticipant(i.id, participantId, { privateNote: note }).pipe(
      tap((p) => this._patchParticipant(participantId, { privateNote: p.privateNote })),
      takeUntilDestroyed(this._destroyRef),
    ).subscribe({
      complete: () => this._markBusy(participantId, false),
      error: () => this._markBusy(participantId, false),
    });
  }

  // ─── Internals ────────────────────────────────────────────────────

  private _patchParticipant(id: string, patch: Partial<SessionParticipant>): void {
    this._participants.set(
      this._participants().map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  private _markBusy(id: string, on: boolean): void {
    const next = new Set(this._busyParticipants());
    if (on) next.add(id);
    else next.delete(id);
    this._busyParticipants.set(next);
  }

}
