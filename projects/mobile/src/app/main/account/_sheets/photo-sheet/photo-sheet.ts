import { Component, ElementRef, inject, model, viewChild } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cameraOutline, imageOutline, trashOutline } from 'ionicons/icons';
import { take } from 'rxjs';

import { AVATAR_ACCEPT, UserService, avatarRejectionReason } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

/**
 * Profile picture actions.
 *
 * Both rows are file inputs rather than a camera plugin: `capture` on a file
 * input is enough to ask Android for the camera, and adding `@capacitor/camera`
 * for two rows would be a native dependency for something the WebView already
 * does. "Remove photo" is disabled — there is no DELETE avatar endpoint yet.
 */
@Component({
  selector: 'mh-photo-sheet',
  imports: [IonIcon, IonItem, IonLabel, IonList, SheetShell],
  templateUrl: './photo-sheet.html',
  styleUrl: './photo-sheet.scss',
})
export class PhotoSheet {
  private readonly _userService = inject(UserService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _accountStore = inject(AccountStore);

  private readonly _cameraInput = viewChild<ElementRef<HTMLInputElement>>('cameraInput');
  private readonly _galleryInput = viewChild<ElementRef<HTMLInputElement>>('galleryInput');

  readonly open = model(false);
  readonly accept = AVATAR_ACCEPT;

  constructor() {
    addIcons({ cameraOutline, imageOutline, trashOutline });
  }

  takePhoto(): void {
    this._cameraInput()?.nativeElement.click();
  }

  choosePhoto(): void {
    this._galleryInput()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset first, so picking the same file twice still fires `change`.
    input.value = '';
    if (!file) return;

    const rejection = avatarRejectionReason(file);
    if (rejection) {
      void this._feedbackService.error(null, rejection);
      return;
    }

    this._upload(file);
  }

  private _upload(file: File): void {
    this._accountStore.setSaving(true);
    this._userService
      .uploadAvatar(file)
      .pipe(take(1))
      .subscribe({
        next: ({ avatarUrl }) => {
          this._accountStore.setPendingAvatarUrl(avatarUrl);
          this._accountStore.patchAccount({ avatarUrl });
          this._accountStore.syncAuthUser();
          this._accountStore.setSaving(false);
          this.open.set(false);
          void this._feedbackService.success('Photo updated');
          this._accountStore.refresh();
        },
        error: (error: unknown) => {
          this._accountStore.setSaving(false);
          void this._feedbackService.error(error, 'Could not upload the picture.');
        },
      });
  }
}
