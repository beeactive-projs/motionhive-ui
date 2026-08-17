import { Component, computed, inject, input, model } from '@angular/core';
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonNote } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { copyOutline, openOutline, shareSocialOutline } from 'ionicons/icons';

import { publicProfileUrl } from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { ShareOutcomes, copyToClipboard, shareOrCopy } from '../../../../_shared/utils/share';

/**
 * Share the public profile link.
 *
 * The URL is built from `WEB_APP_URL`, never `window.location.origin` — in a
 * Capacitor WebView the origin is `capacitor://localhost`, which would produce
 * a dead link. (Web's profile page has exactly that bug; don't copy it.)
 *
 * The share/copy mechanics live in `_shared/utils/share` — the sessions screens
 * share a link the same way, and the WebView caveats are the same there.
 */
@Component({
  selector: 'mh-share-sheet',
  imports: [
    EmptyState,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    SheetShell,
  ],
  templateUrl: './share-sheet.html',
  styleUrl: './share-sheet.scss',
})
export class ShareSheet {
  private readonly _feedbackService = inject(FeedbackService);

  readonly open = model(false);
  readonly handle = input<string | null>(null);

  readonly url = computed(() => {
    const handle = this.handle();
    return handle ? publicProfileUrl(handle) : null;
  });

  constructor() {
    addIcons({ copyOutline, openOutline, shareSocialOutline });
  }

  async copyLink(): Promise<void> {
    const url = this.url();
    if (!url) return;
    if (await copyToClipboard(url)) {
      await this._feedbackService.success('Link copied');
    } else {
      await this._feedbackService.error(null, 'Could not copy the link.');
    }
  }

  async share(): Promise<void> {
    const url = this.url();
    if (!url) return;

    const outcome = await shareOrCopy({ title: 'My MotionHive profile', url });
    // Shared: the OS already gave feedback. Cancelled: the user said no.
    if (outcome === ShareOutcomes.Copied) {
      await this._feedbackService.success('Link copied');
    } else if (outcome === ShareOutcomes.Failed) {
      await this._feedbackService.error(null, 'Could not share the link.');
    }
  }

  openLink(): void {
    const url = this.url();
    if (url) window.open(url, '_blank', 'noopener');
  }
}
