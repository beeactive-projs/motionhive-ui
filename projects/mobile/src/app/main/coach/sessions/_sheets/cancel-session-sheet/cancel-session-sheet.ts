import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
  IonItem,
  IonLabel,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonTextarea,
} from '@ionic/angular/standalone';
import { take } from 'rxjs';

import {
  CancelScope,
  SessionInstance,
  SessionService,
  SessionTemplate,
  formatSessionDayShort,
} from 'core';

import { SheetShell } from '../../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../../_shared/services/feedback.service';
import { CANCEL_SCOPE_OPTIONS } from '../../sessions.config';

/**
 * Cancel an occurrence, the rest of the series, or all of it.
 *
 * A one-off skips the choice entirely — there is nothing to scope. For a series
 * the three options are spelled out with what each one actually takes down,
 * because "cancel" on a recurring session is otherwise ambiguous in a way that
 * loses people's bookings.
 *
 * The optional message goes to everyone who signed up. Cancelling notifies them
 * either way; this is the chance to say why.
 */
@Component({
  selector: 'mh-cancel-session-sheet',
  imports: [IonItem, IonLabel, IonNote, IonRadio, IonRadioGroup, IonTextarea, SheetShell],
  templateUrl: './cancel-session-sheet.html',
  styleUrl: './cancel-session-sheet.scss',
})
export class CancelSessionSheet {
  private readonly _sessionService = inject(SessionService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly open = model(false);
  readonly instance = input<SessionInstance | null>(null);
  readonly template = input<SessionTemplate | null>(null);

  readonly cancelled = output<void>();

  readonly scope = signal<CancelScope>(CancelScope.This);
  readonly message = signal('');
  readonly saving = signal(false);

  readonly isRecurring = computed(() => this.template()?.isRecurring === true);

  readonly signupCount = computed(() => {
    const instance = this.instance();
    if (!instance) return 0;
    return instance.confirmedCount + instance.pendingApprovalCount;
  });

  /** "Powerlifting prep · Wed 3 Jun" — which session is on the block. */
  readonly subtitle = computed(() => {
    const instance = this.instance();
    if (!instance) return '';
    const title = instance.titleOverride ?? this.template()?.title ?? '';
    const day = formatSessionDayShort(instance.startAt);
    return title ? `${title} · ${day}` : day;
  });

  readonly scopeOptions = computed(() => {
    const instance = this.instance();
    const day = instance ? formatSessionDayShort(instance.startAt) : '';
    return CANCEL_SCOPE_OPTIONS.map((option) => ({
      ...option,
      detail: this._detailFor(option.value, day),
    }));
  });

  readonly messageLabel = computed(() => {
    const count = this.signupCount();
    if (count === 0) return 'Message · optional';
    return `Message to ${count} ${count === 1 ? 'signup' : 'signups'} · optional`;
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.scope.set(CancelScope.This);
      this.message.set('');
    });
  }

  confirm(): void {
    const instance = this.instance();
    if (!instance || this.saving()) return;

    this.saving.set(true);
    const message = this.message().trim();

    this._sessionService
      .cancelInstance(instance.id, {
        // A one-off has no series to scope against; sending anything else
        // would cancel a template that has only this occurrence anyway.
        scope: this.isRecurring() ? this.scope() : CancelScope.This,
        ...(message ? { message } : {}),
      })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.open.set(false);
          const count = result.cancelledInstanceIds.length;
          void this._feedbackService.success(
            count > 1 ? `${count} sessions cancelled` : 'Session cancelled'
          );
          this.cancelled.emit();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(error, 'Could not cancel the session.');
        },
      });
  }

  /**
   * What each option takes down. Exact counts would need the whole series
   * loaded, which this sheet does not have — so the copy says what happens
   * without inventing a number. The occurrence's own date is real data,
   * though, so the single-occurrence option is grounded in it.
   */
  private _detailFor(scope: CancelScope, day: string): string {
    switch (scope) {
      case CancelScope.This:
        return day ? `${day} — the series continues.` : 'The series continues.';
      case CancelScope.ThisAndFuture:
        return 'This and every later occurrence.';
      default:
        return 'Every session in this series. The template is ended.';
    }
  }
}
