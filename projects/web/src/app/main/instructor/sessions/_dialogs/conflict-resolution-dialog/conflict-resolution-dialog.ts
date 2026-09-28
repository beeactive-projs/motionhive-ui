import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import {
  CancelScope,
  SessionInstance,
  SessionService,
  showApiError,
} from 'core';

/**
 * `mh-conflict-resolution-dialog` — shown when the BE returns
 * `warnings: [{code: 'CONFLICT', instanceIds: [...]}]` on create or
 * reschedule.
 *
 * UX: lists the conflicting occurrences with start time + capacity. Each
 * row has two actions:
 *   - **Reschedule** → inline date-time picker → calls `rescheduleInstance`
 *   - **Cancel**     → confirm → calls `cancelInstance(scope='this')`
 *
 * The dialog manages multiple ids in parallel; emits `resolved()` once
 * the user closes it (parent re-fetches its calendar range either way).
 *
 * V1 scope: only the conflicting *partner* instances are shown here.
 * The instance the user just created/rescheduled isn't surfaced —
 * resolving conflicts on the partner is the conventional flow ("I just
 * scheduled this; move the older one away").
 */
@Component({
  selector: 'mh-conflict-resolution-dialog',
  imports: [CommonModule, FormsModule, Dialog, ButtonDirective, DatePickerModule, TranslatePipe],
  templateUrl: './conflict-resolution-dialog.html',
  styleUrl: './conflict-resolution-dialog.scss',
})
export class ConflictResolutionDialog {
  private readonly _sessionService = inject(SessionService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);
  readonly conflictingInstanceIds = input<string[]>([]);
  readonly resolved = output<void>();

  readonly loading = signal(false);
  readonly instances = signal<SessionInstance[]>([]);
  /** Per-row state: 'idle' | 'rescheduling' | 'cancelling' | 'done'. */
  readonly rowState = signal<Map<string, string>>(new Map());
  /** Date-picker value when row is in 'rescheduling' mode. */
  readonly rescheduleDate = signal<Map<string, Date>>(new Map());

  readonly remaining = computed(
    () =>
      this.instances().filter(
        (i) => this.rowState().get(i.id) !== 'done',
      ).length,
  );

  private readonly _loadEffect = effect(() => {
    const ids = this.conflictingInstanceIds();
    if (!this.visible() || ids.length === 0) {
      this.instances.set([]);
      return;
    }
    this.loading.set(true);
    forkJoin(
      ids.map((id) =>
        this._sessionService.getInstance(id).pipe(catchError(() => of(null))),
      ),
    )
      .pipe(map((rs) => rs.filter((x): x is SessionInstance => x != null)))
      .subscribe((rs) => {
        this.instances.set(rs);
        this.loading.set(false);
        // If some ids could not be hydrated (403/404 — usually means the
        // conflicting session was already cancelled/moved between create
        // and now), warn so the user doesn't think the list is complete.
        const missing = ids.length - rs.length;
        if (missing > 0) {
          this._messageService.add({
            severity: 'info',
            summary: this._translateService.instant('sessions.conflictDialog.partial.summary'),
            detail: this._translateService.instant('sessions.conflictDialog.partial.detail', {
              count: missing,
            }),
          });
        }
      });
  });

  startReschedule(id: string): void {
    const inst = this.instances().find((i) => i.id === id);
    if (!inst) return;
    const m = new Map(this.rescheduleDate());
    m.set(id, new Date(inst.startAt));
    this.rescheduleDate.set(m);
    this._setRowState(id, 'rescheduling');
  }

  cancelReschedule(id: string): void {
    this._setRowState(id, 'idle');
  }

  confirmReschedule(id: string): void {
    const newDate = this.rescheduleDate().get(id);
    if (!newDate) return;
    if (newDate.getTime() < Date.now()) {
      this._messageService.add({
        severity: 'warn',
        summary: this._translateService.instant('sessions.conflictDialog.pastDate.summary'),
        detail: this._translateService.instant('sessions.conflictDialog.pastDate.detail'),
      });
      return;
    }
    this._setRowState(id, 'busy');
    this._sessionService
      .rescheduleInstance(id, { newStartAt: newDate.toISOString() })
      .subscribe({
        next: (res) => {
          this._setRowState(id, 'done');
          this._messageService.add({
            severity: 'success',
            summary: this._translateService.instant('sessions.conflictDialog.rescheduled'),
            detail: this._translateService.instant(
              res.warnings.length > 0
                ? 'sessions.conflictDialog.rescheduledStillConflicts'
                : 'sessions.common.attendeesNotified',
              { count: res.notifiedUserIds.length },
            ),
          });
        },
        error: (err: unknown) => {
          this._setRowState(id, 'idle');
          showApiError(
            this._messageService,
            this._translateService.instant('sessions.conflictDialog.rescheduleFailed'),
            this._translateService.instant('common.pleaseTryAgain'),
            err,
          );
        },
      });
  }

  cancelOne(id: string): void {
    this._setRowState(id, 'busy');
    this._sessionService
      .cancelInstance(id, { scope: CancelScope.This })
      .subscribe({
        next: (res) => {
          this._setRowState(id, 'done');
          this._messageService.add({
            severity: 'success',
            summary: this._translateService.instant('sessions.common.sessionCancelled'),
            detail: this._translateService.instant('sessions.common.attendeesNotified', {
              count: res.notifiedUserIds.length,
            }),
          });
        },
        error: (err: unknown) => {
          this._setRowState(id, 'idle');
          showApiError(
            this._messageService,
            this._translateService.instant('sessions.conflictDialog.cancelFailed'),
            this._translateService.instant('common.pleaseTryAgain'),
            err,
          );
        },
      });
  }

  updateDate(id: string, d: Date): void {
    const m = new Map(this.rescheduleDate());
    m.set(id, d);
    this.rescheduleDate.set(m);
  }

  rowOf(id: string): string {
    return this.rowState().get(id) ?? 'idle';
  }

  close(): void {
    this.visible.set(false);
    this.resolved.emit();
  }

  private _setRowState(id: string, state: string): void {
    const m = new Map(this.rowState());
    m.set(id, state);
    this.rowState.set(m);
  }
}
