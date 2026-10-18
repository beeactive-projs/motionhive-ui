import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { finalize } from 'rxjs';

import { AuthService, ScheduledDeletion, appLocale } from 'core';

/**
 * Shown in place of a sign-in error when the account is in its deletion
 * cooling-off: the credentials were right, and the API offers to keep the
 * account instead. Keeping it cancels the deletion and signs the person in;
 * the page then carries on as after any sign-in.
 */
@Component({
  selector: 'mh-keep-account-offer',
  imports: [ButtonDirective, Message, TranslatePipe],
  template: `
    <p-message severity="warn">
      <div class="flex flex-col gap-3">
        <span class="font-semibold">{{ 'auth.keepAccount.title' | translate }}</span>
        <span>{{ 'auth.keepAccount.body' | translate: { date: date() } }}</span>
        <div class="flex flex-wrap gap-2">
          <button pButton type="button" size="small" [disabled]="keeping()" (click)="keep()">
            {{ 'auth.keepAccount.confirm' | translate }}
          </button>
          <button pButton type="button" size="small" severity="secondary" [outlined]="true"
            [disabled]="keeping()" (click)="dismissed.emit()">
            {{ 'auth.keepAccount.cancel' | translate }}
          </button>
        </div>
      </div>
    </p-message>
  `,
})
export class KeepAccountOffer {
  private readonly _authService = inject(AuthService);

  readonly offer = input.required<ScheduledDeletion>();

  /** Signed in with the account kept; the page navigates on. */
  readonly kept = output<void>();
  readonly dismissed = output<void>();
  /** The 15-minute ticket ran out; the page asks them to sign in again. */
  readonly expired = output<void>();

  protected readonly keeping = signal(false);
  protected readonly date = computed(() =>
    new Date(this.offer().scheduledFor).toLocaleDateString(appLocale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );

  protected keep(): void {
    if (this.keeping()) return;
    this.keeping.set(true);
    this._authService
      .restoreAccount(this.offer().restoreTicket)
      .pipe(finalize(() => this.keeping.set(false)))
      .subscribe({
        next: () => this.kept.emit(),
        error: () => this.expired.emit(),
      });
  }
}
