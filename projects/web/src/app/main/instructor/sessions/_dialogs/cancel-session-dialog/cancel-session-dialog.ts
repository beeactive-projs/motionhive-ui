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
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { InputText } from 'primeng/inputtext';
import {
  BottomSheet,
  CancelInstanceResponse,
  CancelScope,
  SessionInstance,
  SessionService,
  SessionTemplate,
  injectIsMobile,
  showApiError,
} from 'core';

/**
 * `mh-cancel-session-dialog` — 3-scope cancel modal.
 *
 * Scopes mirror `CancelScope` from the BE:
 *   - `this`            — only this occurrence
 *   - `thisAndFuture`   — this occurrence + all later ones in the series
 *   - `series`          — the whole series (template too)
 *
 * For a non-recurring template only the "this" scope is shown. The
 * dialog only collects the reason + message — it does NOT do the
 * "reschedule instead" path (that opens the RescheduleDialog from the
 * detail page directly).
 *
 * Emits `cancelled(response)` so the parent can refresh its list and
 * the calendar can drop the affected ids from its range cache.
 */
@Component({
  selector: 'mh-cancel-session-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Dialog,
    ButtonModule,
    TextareaModule,
    InputText,
    BottomSheet,
  ],
  templateUrl: './cancel-session-dialog.html',
  styleUrl: './cancel-session-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelSessionDialog {
  private readonly _svc = inject(SessionService);
  private readonly _msg = inject(MessageService);

  /**
   * Mobile breakpoint. When true, the template renders the sheet
   * variant (4C from the design); when false, the existing p-dialog.
   * Same form state in both branches.
   */
  readonly isMobile = injectIsMobile();

  readonly visible = model(false);
  readonly instance = input<SessionInstance | null>(null);
  readonly template = input<SessionTemplate | null>(null);
  readonly cancelled = output<CancelInstanceResponse>();

  readonly scope = signal<CancelScope>(CancelScope.This);
  readonly reason = signal('');
  readonly message = signal('');
  readonly busy = signal(false);

  readonly isRecurring = computed(() => this.template()?.isRecurring === true);
  readonly affectedCount = computed(() => {
    // Best-effort estimate so the user sees the blast radius. Real number
    // is computed server-side; we surface what we know from the loaded
    // instance counters.
    const i = this.instance();
    if (!i) return 0;
    return i.confirmedCount + i.pendingApprovalCount + i.waitlistedCount;
  });

  readonly scopeOptions = computed(() => {
    const recurring = this.isRecurring();
    const opts: { value: CancelScope; label: string; help: string }[] = [
      {
        value: CancelScope.This,
        label: 'Only this session',
        help: 'Cancel the one occurrence below. The series continues.',
      },
    ];
    if (recurring) {
      opts.push({
        value: CancelScope.ThisAndFuture,
        label: 'This and all future',
        help: 'Cancel this session and every later occurrence.',
      });
      opts.push({
        value: CancelScope.Series,
        label: 'The whole series',
        help: 'Cancel every session in this series. The template is ended.',
      });
    }
    return opts;
  });

  private readonly _resetEffect = effect(() => {
    if (this.visible()) {
      this.scope.set(CancelScope.This);
      this.reason.set('');
      this.message.set('');
    }
  });

  close(): void {
    this.visible.set(false);
  }

  submit(): void {
    const inst = this.instance();
    if (!inst) return;
    this.busy.set(true);
    this._svc
      .cancelInstance(inst.id, {
        scope: this.scope(),
        reason: this.reason().trim() || undefined,
        message: this.message().trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.visible.set(false);
          this._msg.add({
            severity: 'success',
            summary: 'Session cancelled',
            detail: `${res.cancelledInstanceIds.length} occurrence(s) cancelled · ${res.notifiedUserIds.length} attendee(s) notified.`,
          });
          this.cancelled.emit(res);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          showApiError(this._msg, 'Could not cancel', 'Please try again.', err);
        },
      });
  }
}
