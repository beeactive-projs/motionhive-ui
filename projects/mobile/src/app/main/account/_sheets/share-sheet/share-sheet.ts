import { Component, computed, inject, input, model } from '@angular/core';
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonNote } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { copyOutline, openOutline, shareSocialOutline } from 'ionicons/icons';

import { WEB_APP_URL } from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';

/**
 * Share the public profile link.
 *
 * The URL is built from `WEB_APP_URL`, never `window.location.origin` — in a
 * Capacitor WebView the origin is `capacitor://localhost`, which would produce
 * a dead link. (Web's profile page has exactly that bug; don't copy it.)
 *
 * `navigator.share` is frequently missing from the Android System WebView, so
 * the share row falls back to copying rather than assuming it exists.
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
    return handle ? `${WEB_APP_URL}/@${handle}` : null;
  });

  constructor() {
    addIcons({ copyOutline, openOutline, shareSocialOutline });
  }

  async copyLink(): Promise<void> {
    const url = this.url();
    if (!url) return;
    if (await this._writeToClipboard(url)) {
      await this._feedbackService.success('Link copied');
    } else {
      await this._feedbackService.error(null, 'Could not copy the link.');
    }
  }

  async share(): Promise<void> {
    const url = this.url();
    if (!url) return;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'My MotionHive profile', url });
        return;
      } catch (error) {
        // A user-cancelled share is an AbortError, not a failure worth a toast.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await this.copyLink();
  }

  openLink(): void {
    const url = this.url();
    if (url) window.open(url, '_blank', 'noopener');
  }

  private async _writeToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
