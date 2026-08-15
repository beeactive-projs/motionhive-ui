import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { IonNote, IonTextarea } from '@ionic/angular/standalone';
import { take } from 'rxjs';

import { FollowUpAudience, SessionService } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';

/** Matches the BE's cap on the follow-up body. */
const MAX_LENGTH = 2000;

/** One tap to fill the box, still editable before sending. */
const SUGGESTIONS = [
  'Running a few minutes late — see you shortly.',
  "Don't forget water and a towel.",
  'Change of plan for this one — details to follow.',
];

/**
 * Send a note to the people booked into a session.
 *
 * Audience is the caller's choice: everyone booked, or a specific set of user
 * ids (the waitlist). `attended`/`noshow` are deliberately not offered — the BE
 * rejects those before the session has started, and the two screens that open
 * this sheet can both be on an upcoming session.
 */
@Component({
  selector: 'mh-message-signups-sheet',
  imports: [IonNote, IonTextarea, SheetShell],
  templateUrl: './message-signups-sheet.html',
  styleUrl: './message-signups-sheet.scss',
})
export class MessageSignupsSheet {
  private readonly _sessionService = inject(SessionService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly open = model(false);
  readonly instanceId = input<string | null>(null);
  readonly audience = input<FollowUpAudience>('all');
  /** Required when `audience` is 'userIds'. */
  readonly userIds = input<string[]>([]);
  /** Shown under the title so it is clear who receives this. */
  readonly recipientLabel = input('everyone booked in');

  readonly suggestions = SUGGESTIONS;
  readonly message = signal('');
  readonly sending = signal(false);

  readonly remaining = computed(() => MAX_LENGTH - this.message().length);

  readonly canSend = computed(
    () =>
      !!this.instanceId() &&
      this.message().trim().length > 0 &&
      this.message().length <= MAX_LENGTH,
  );

  constructor() {
    effect(() => {
      if (this.open()) this.message.set('');
    });
  }

  use(suggestion: string): void {
    this.message.set(suggestion);
  }

  send(): void {
    const instanceId = this.instanceId();
    if (!instanceId || !this.canSend() || this.sending()) return;

    this.sending.set(true);
    const audience = this.audience();

    this._sessionService
      .followUp(instanceId, {
        audience,
        ...(audience === 'userIds' ? { userIds: this.userIds() } : {}),
        message: this.message().trim(),
      })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.sending.set(false);
          this.open.set(false);
          const count = result.notifiedUserIds.length;
          void this._feedbackService.success(
            count === 0
              ? 'Nobody to notify'
              : `Sent to ${count} ${count === 1 ? 'person' : 'people'}`,
          );
        },
        error: (error: unknown) => {
          this.sending.set(false);
          void this._feedbackService.error(error, 'Could not send the message.');
        },
      });
  }
}
