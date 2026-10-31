import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { copyToClipboard } from '../../../_shared/utils/share';
import { MOTIONHIVE_TAG } from './share-card.config';

/**
 * "Copy @motionhive.fit", for the share sheet and the guide after Save:
 * the handle on the clipboard and a toast saying so, or that it failed.
 * Call it in an injection context; the returned function is called
 * straight from the tap, the way the clipboard wants it.
 */
export function injectCopyTag(): () => Promise<void> {
  const feedbackService = inject(FeedbackService);
  const translateService = inject(TranslateService);
  return async () => {
    const t = (key: string) => translateService.instant(key, { tag: MOTIONHIVE_TAG });
    if (await copyToClipboard(MOTIONHIVE_TAG)) {
      void feedbackService.success(t('workouts.share.tag.copied'));
    } else {
      void feedbackService.error(null, t('workouts.share.tag.copyFailed'));
    }
  };
}
