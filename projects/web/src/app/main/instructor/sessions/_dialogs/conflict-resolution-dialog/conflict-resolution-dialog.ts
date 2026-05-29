import {
  ChangeDetectionStrategy,
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
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import {
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
  standalone: true,
  imports: [CommonModule, FormsModule, Dialog, ButtonModule, DatePickerModule],
  templateUrl: './conflict-resolution-dialog.html',
  styleUrl: './conflict-resolution-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConflictResolutionDialog {
  private readonly _svc = inject(SessionService);
  private readonly _msg = inject(MessageService);

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
        this._svc.getInstance(id).pipe(catchError(() => of(null))),
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
          this._msg.add({
            severity: 'info',
            summary: 'Some conflicts already resolved',
            detail: `${missing} session(s) couldn’t be loaded — they may have already been cancelled or moved.`,
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
      this._msg.add({
        severity: 'warn',
        summary: 'Pick a future date',
        detail: 'You can’t reschedule into the past.',
      });
      return;
    }
    this._setRowState(id, 'busy');
    this._svc
      .rescheduleInstance(id, { newStartAt: newDate.toISOString() })
      .subscribe({
        next: (res) => {
          this._setRowState(id, 'done');
          this._msg.add({
            severity: 'success',
            summary: 'Rescheduled',
            detail: `${res.notifiedUserIds.length} attendee(s) notified.${res.warnings.length > 0 ? ' (still has conflicts)' : ''}`,
          });
        },
        error: (err: unknown) => {
          this._setRowState(id, 'idle');
          showApiError(this._msg, 'Reschedule failed', 'Please try again.', err);
        },
      });
  }

  cancelOne(id: string): void {
    this._setRowState(id, 'busy');
    this._svc
      .cancelInstance(id, { scope: 'this' as const })
      .subscribe({
        next: (res) => {
          this._setRowState(id, 'done');
          this._msg.add({
            severity: 'success',
            summary: 'Session cancelled',
            detail: `${res.notifiedUserIds.length} attendee(s) notified.`,
          });
        },
        error: (err: unknown) => {
          this._setRowState(id, 'idle');
          showApiError(this._msg, 'Cancel failed', 'Please try again.', err);
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
