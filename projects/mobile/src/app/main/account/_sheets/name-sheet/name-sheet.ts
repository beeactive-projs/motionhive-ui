import { Component, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { IonInput } from '@ionic/angular/standalone';
import { take } from 'rxjs';

import { ProfileService } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

@Component({
  selector: 'mh-name-sheet',
  imports: [IonInput, SheetShell],
  templateUrl: './name-sheet.html',
  styleUrl: './name-sheet.scss',
})
export class NameSheet {
  private readonly _profileService = inject(ProfileService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _accountStore = inject(AccountStore);

  readonly open = model(false);

  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly saving = signal(false);

  readonly canSave = computed(
    () => this.firstName().trim().length > 0 && this.lastName().trim().length > 0,
  );

  constructor() {
    // Re-seed from the store every time the sheet opens, so a cancelled edit
    // never leaks into the next one. `untracked` matters: this must depend on
    // `open()` alone. Tracking the store would re-run mid-edit — a failed save
    // reverts the optimistic patch, which would wipe what the user just typed.
    effect(() => {
      if (!this.open()) return;
      const account = untracked(() => this._accountStore.account());
      this.firstName.set(account?.firstName ?? '');
      this.lastName.set(account?.lastName ?? '');
    });
  }

  save(): void {
    const firstName = this.firstName().trim();
    const lastName = this.lastName().trim();
    const account = this._accountStore.account();
    if (!account) return;

    // Diff-only: a PATCH carrying unchanged fields is a write we don't need.
    const patch: { firstName?: string; lastName?: string } = {};
    if (firstName !== account.firstName) patch.firstName = firstName;
    if (lastName !== account.lastName) patch.lastName = lastName;

    if (Object.keys(patch).length === 0) {
      this.open.set(false);
      void this._feedbackService.info('No changes');
      return;
    }

    const previous = { firstName: account.firstName, lastName: account.lastName };
    this.saving.set(true);
    this._accountStore.patchAccount(patch);

    this._profileService
      .updateMyProfile({ account: patch })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this._accountStore.syncAuthUser();
          this.open.set(false);
          void this._feedbackService.success('Name updated');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this._accountStore.patchAccount(previous);
          void this._feedbackService.error(error, 'Could not update your name.');
        },
      });
  }
}
