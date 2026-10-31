import { Component, inject, model, output } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { IonButton, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { copyToClipboard } from '../../../../_shared/utils/share';
import {
  MOTIONHIVE_TAG,
  SHARE_ICONS,
  SHARE_ICON_NAMES,
  saveCopyKeys,
} from '../../_services/share-card.config';
import { ShareCardService } from '../../_services/share-card.service';

/**
 * After Save to Photos, or to the gallery on Android (design "Share Flow", step 4): the card is saved,
 * open Instagram and pick it from the gallery, tag us. The two things to
 * do are buttons stacked under the steps, as in the design: "Copy
 * @motionhive.fit" is too long to share a footer row with the main
 * action. "Don't show the steps again" turns the guide off for good, and
 * the share sheet then just says it saved.
 */
@Component({
  selector: 'mh-share-guide-sheet',
  imports: [HexAvatar, IonButton, IonItem, IonLabel, IonList, SheetShell, TranslatePipe],
  templateUrl: './share-guide-sheet.html',
  styleUrl: './share-guide-sheet.scss',
})
export class ShareGuideSheet {
  private readonly _shareCardService = inject(ShareCardService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  /** "Don't show the steps again"; the host remembers it. */
  readonly hide = output<void>();

  readonly icons = SHARE_ICON_NAMES;
  readonly tag = MOTIONHIVE_TAG;
  /** "Saved to Photos", or to the gallery on Android: the title and the first step. */
  readonly savedKey = saveCopyKeys(Capacitor.getPlatform()).done;

  constructor() {
    addIcons(SHARE_ICONS);
  }

  /** Written straight from the tap, the way the clipboard wants it. */
  async copyTag(): Promise<void> {
    if (await copyToClipboard(MOTIONHIVE_TAG)) {
      void this._feedbackService.success(
        this._translateService.instant('workouts.share.tag.copied', { tag: MOTIONHIVE_TAG }),
      );
    } else {
      void this._feedbackService.error(
        null,
        this._translateService.instant('workouts.share.tag.copyFailed', { tag: MOTIONHIVE_TAG }),
      );
    }
  }

  /** Instagram itself (the website without the app); the steps are done here. */
  async openInstagram(): Promise<void> {
    this.open.set(false);
    try {
      await this._shareCardService.openInstagram();
    } catch (err) {
      void this._feedbackService.error(
        err,
        this._translateService.instant('workouts.share.guide.openFailed'),
      );
    }
  }

  hideSteps(): void {
    this.hide.emit();
    this.open.set(false);
  }
}
