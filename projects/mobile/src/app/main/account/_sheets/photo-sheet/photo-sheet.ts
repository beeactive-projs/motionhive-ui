import { Component, ElementRef, inject, model, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { cameraOutline, imageOutline, trashOutline } from 'ionicons/icons';
import { take } from 'rxjs';

import { AVATAR_ACCEPT, AVATAR_MAX_BYTES, UserService, avatarRejectionReason } from 'core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { SheetAction } from '../../../../_shared/components/action-sheet/action-sheet.model';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

const PhotoActionIds = {
  Take: 'take',
  Choose: 'choose',
  Remove: 'remove',
} as const;

type PhotoActionId = (typeof PhotoActionIds)[keyof typeof PhotoActionIds];

/** "Remove photo" is disabled rather than absent: there is no DELETE avatar endpoint yet. */
const PHOTO_ACTIONS: readonly SheetAction<PhotoActionId>[] = [
  { id: PhotoActionIds.Take, label: 'accountSheets.photo.take', icon: 'camera-outline' },
  { id: PhotoActionIds.Choose, label: 'accountSheets.photo.choose', icon: 'image-outline' },
  {
    id: PhotoActionIds.Remove,
    label: 'accountSheets.photo.remove',
    hint: 'accountSheets.photo.comingSoon',
    icon: 'trash-outline',
    destructive: true,
    disabled: true,
  },
];

/**
 * Profile picture actions.
 *
 * Both rows are file inputs rather than a camera plugin: `capture` on a file
 * input is enough to ask Android for the camera, and adding `@capacitor/camera`
 * for two rows would be a native dependency for something the WebView already
 * does.
 */
@Component({
  selector: 'mh-photo-sheet',
  imports: [ActionSheet, TranslatePipe],
  templateUrl: './photo-sheet.html',
})
export class PhotoSheet {
  private readonly _userService = inject(UserService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _accountStore = inject(AccountStore);
  private readonly _translateService = inject(TranslateService);

  private readonly _cameraInput = viewChild<ElementRef<HTMLInputElement>>('cameraInput');
  private readonly _galleryInput = viewChild<ElementRef<HTMLInputElement>>('galleryInput');

  readonly open = model(false);
  readonly accept = AVATAR_ACCEPT;
  readonly actions = PHOTO_ACTIONS;

  constructor() {
    addIcons({ cameraOutline, imageOutline, trashOutline });
  }

  choose(id: PhotoActionId): void {
    switch (id) {
      case PhotoActionIds.Take:
        this._cameraInput()?.nativeElement.click();
        break;
      case PhotoActionIds.Choose:
        this._galleryInput()?.nativeElement.click();
        break;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset first, so picking the same file twice still fires `change`.
    input.value = '';
    if (!file) return;

    // Core decides whether the file is usable; its reason text is English
    // only, so the message is picked here from the same two rules.
    if (avatarRejectionReason(file)) {
      const rejection = file.type.startsWith('image/')
        ? this._translateService.instant('accountSheets.photo.tooLarge', {
            size: Math.floor(AVATAR_MAX_BYTES / (1024 * 1024)),
          })
        : this._translateService.instant('accountSheets.photo.notImage');
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
          void this._feedbackService.success(
            this._translateService.instant('accountSheets.photo.toast.updated'),
          );
          this._accountStore.refresh();
        },
        error: (error: unknown) => {
          this._accountStore.setSaving(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('accountSheets.photo.toast.failed'),
          );
        },
      });
  }
}
