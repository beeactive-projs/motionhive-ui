import { Component, computed, inject, model, signal } from '@angular/core';
import { IonChip, IonInput, IonTextarea } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';

import {
  AuthStore,
  FeedbackCategories,
  FeedbackCategory,
  FeedbackService as FeedbackApiService,
  LanguageService,
} from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';

/** The same floors as web's dialog: enough to say what happened. */
const TITLE_MIN = 3;
const MESSAGE_MIN = 10;

/** One kind of feedback; `label` and the placeholders are translation keys. */
interface FeedbackKind {
  type: FeedbackCategory;
  label: string;
  titlePlaceholder: string;
  messagePlaceholder: string;
}

const KINDS: readonly FeedbackKind[] = [
  {
    type: FeedbackCategories.Suggestion,
    label: 'feedback.type.SUGGESTION',
    titlePlaceholder: 'feedback.placeholder.SUGGESTION.title',
    messagePlaceholder: 'feedback.placeholder.SUGGESTION.message',
  },
  {
    type: FeedbackCategories.Bug,
    label: 'feedback.type.BUG',
    titlePlaceholder: 'feedback.placeholder.BUG.title',
    messagePlaceholder: 'feedback.placeholder.BUG.message',
  },
  {
    type: FeedbackCategories.Other,
    label: 'feedback.type.OTHER',
    titlePlaceholder: 'feedback.placeholder.OTHER.title',
    messagePlaceholder: 'feedback.placeholder.OTHER.message',
  },
];

/**
 * Feedback to the MotionHive team, from the menu — what web's feedback dialog
 * sends, in a sheet. For coaches and trainees alike.
 *
 * The confirmation email follows the language the app is in, and goes to the
 * signed-in person's own address; nothing else about them is attached.
 */
@Component({
  selector: 'mh-feedback-sheet',
  imports: [IonChip, IonInput, IonTextarea, SheetShell, TranslatePipe],
  templateUrl: './feedback-sheet.html',
  styleUrl: './feedback-sheet.scss',
})
export class FeedbackSheet {
  readonly open = model(false);

  private readonly _feedbackApi = inject(FeedbackApiService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _authStore = inject(AuthStore);
  private readonly _languageService = inject(LanguageService);

  readonly kinds = KINDS;
  readonly type = signal<FeedbackCategory>(FeedbackCategories.Suggestion);
  readonly title = signal('');
  readonly message = signal('');
  readonly sending = signal(false);

  readonly kind = computed(() => KINDS.find((k) => k.type === this.type()) ?? KINDS[0]);

  readonly canSend = computed(
    () =>
      this.title().trim().length >= TITLE_MIN &&
      this.message().trim().length >= MESSAGE_MIN &&
      !this.sending(),
  );

  /** Said only once they have started typing, so an empty form is not scolded. */
  readonly messageTooShort = computed(() => {
    const length = this.message().trim().length;
    return length > 0 && length < MESSAGE_MIN;
  });

  readonly messageMin = MESSAGE_MIN;

  send(): void {
    if (!this.canSend()) return;
    this.sending.set(true);
    const email = this._authStore.user()?.email;
    this._feedbackApi
      .submit({
        type: this.type(),
        title: this.title().trim(),
        message: this.message().trim(),
        ...(email ? { email } : {}),
        language: this._languageService.current,
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.open.set(false);
          this._reset();
          void this._feedbackService.success(this._translateService.instant('feedback.toast.sent'));
        },
        error: (err: unknown) => {
          this.sending.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('feedback.toast.sendFailed'),
          );
        },
      });
  }

  private _reset(): void {
    this.type.set(FeedbackCategories.Suggestion);
    this.title.set('');
    this.message.set('');
  }
}
