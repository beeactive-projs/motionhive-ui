import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
  IonItem,
  IonLabel,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonTextarea,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  CancelScope,
  SessionInstance,
  SessionService,
  SessionTemplate,
} from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { CANCEL_SCOPE_OPTIONS, SESSION_ICONS } from '../../sessions.config';

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

  readonly scope = signal<CancelScope>('this');
  readonly message = signal('');
  readonly saving = signal(false);

  readonly isRecurring = computed(() => this.template()?.isRecurring === true);

  readonly signupCount = computed(() => {
    const instance = this.instance();
    if (!instance) return 0;
    return instance.confirmedCount + instance.pendingApprovalCount;
  });

  readonly scopeOptions = computed(() =>
    CANCEL_SCOPE_OPTIONS.map((option) => ({
      ...option,
      detail: this._detailFor(option.value),
    })),
  );

  constructor() {
    addIcons(SESSION_ICONS);

    effect(() => {
      if (!this.open()) return;
      this.scope.set('this');
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
        scope: this.isRecurring() ? this.scope() : 'this',
        ...(message ? { message } : {}),
      })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.open.set(false);
          const count = result.cancelledInstanceIds.length;
          void this._feedbackService.success(
            count > 1 ? `${count} sessions cancelled` : 'Session cancelled',
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
   * without inventing a number.
   */
  private _detailFor(scope: CancelScope): string {
    switch (scope) {
      case 'this':
        return 'The series carries on.';
      case 'thisAndFuture':
        return 'This and every later occurrence.';
      default:
        return 'Every upcoming occurrence. Past ones are kept.';
    }
  }
}
