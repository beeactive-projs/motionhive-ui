import { Component, computed, effect, inject, input, model, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { IonItem, IonLabel, IonList, IonSpinner, NavController } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  atOutline,
  copyOutline,
  qrCodeOutline,
  scanOutline,
  shareSocialOutline,
} from 'ionicons/icons';

import { QR_CODE_SVG_OPTIONS, publicProfileUrl } from 'core';

import { FeedbackService } from '../../services/feedback.service';
import { ShareOutcomes, copyToClipboard, shareOrCopy } from '../../utils/share';
import { EmptyState } from '../empty-state/empty-state';
import { HexAvatar } from '../hex-avatar/hex-avatar';
import { SheetShell } from '../sheet-shell/sheet-shell';

/**
 * The reader's public profile, as a code to scan and a link to send. Every
 * "share my profile" in the app opens this one sheet: the Account hero and the
 * coach's invite page.
 *
 * The link is built from `WEB_APP_URL` (`publicProfileUrl`), never
 * `window.location.origin`: in a Capacitor WebView the origin is
 * `capacitor://localhost`, which would make a dead link.
 *
 * The share/copy mechanics live in `_shared/utils/share`. The code is drawn
 * with core's `QR_CODE_SVG_OPTIONS`, as web's share dialog draws it, and the
 * encoder is loaded only when the sheet first opens.
 */
@Component({
  selector: 'mh-profile-share-sheet',
  imports: [EmptyState, HexAvatar, IonItem, IonLabel, IonList, IonSpinner, SheetShell, TranslatePipe],
  templateUrl: './profile-share-sheet.html',
  styleUrl: './profile-share-sheet.scss',
})
export class ProfileShareSheet {
  private readonly _domSanitizer = inject(DomSanitizer);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _navController = inject(NavController);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);

  /** The reader's own handle. Without one there is no public address to share. */
  readonly handle = input<string | null>(null);

  /** The OS share tray's heading. Defaults to "My MotionHive profile". */
  readonly shareTitle = input<string | null>(null);
  /** The sentence sent along with the link, if the screen has one to say. */
  readonly shareText = input<string | null>(null);
  /** The footnote under the options: what the link does for whoever opens it. */
  readonly hint = input<string | null>(null);

  readonly url = computed(() => {
    const handle = this.handle();
    return handle ? publicProfileUrl(handle) : null;
  });

  /** The link as read aloud: the scheme says nothing to a person. Shared and copied whole. */
  readonly displayUrl = computed(() => this.url()?.replace(/^https?:\/\//, '') ?? '');

  readonly hintText = computed(
    () => this.hint() ?? this._translateService.instant('profileShare.hint'),
  );

  readonly qr = signal<string | null>(null);
  readonly qrFailed = signal(false);

  /** The code enlarged, in a sheet stacked over this one. */
  readonly fullScreenOpen = signal(false);

  // By name: the full-screen view is a second shell in the same template.
  private readonly _shell = viewChild<SheetShell>('sheet');

  constructor() {
    addIcons({ atOutline, copyOutline, qrCodeOutline, scanOutline, shareSocialOutline });

    effect(() => {
      const url = this.url();
      if (!this.open() || !url) return;
      void this._renderQr(url);
    });
  }

  async copyLink(): Promise<void> {
    const url = this.url();
    if (!url) return;
    if (await copyToClipboard(url)) {
      await this._feedbackService.success(
        this._translateService.instant('toast.detail.linkCopied'),
      );
    } else {
      await this._feedbackService.error(
        null,
        this._translateService.instant('profileShare.toast.copyFailed'),
      );
    }
  }

  async share(): Promise<void> {
    const url = this.url();
    if (!url) return;

    const outcome = await shareOrCopy({
      title: this.shareTitle() ?? this._translateService.instant('profileShare.shareTitle'),
      text: this.shareText() ?? undefined,
      url,
    });

    // Shared: the OS already gave feedback. Cancelled: they said no.
    if (outcome === ShareOutcomes.Copied) {
      await this._feedbackService.success(
        this._translateService.instant('toast.detail.linkCopied'),
      );
    } else if (outcome === ShareOutcomes.Failed) {
      await this._feedbackService.error(
        null,
        this._translateService.instant('profileShare.toast.shareFailed'),
      );
    }
  }

  /**
   * No username yet, so there is no public address to share. Off to the
   * screen that sets one, awaiting the dismissal first, or the sheet is
   * stranded over the profile page.
   */
  async chooseHandle(): Promise<void> {
    await this._shell()?.close();
    this.open.set(false);
    await this._navController.navigateForward('/tabs/more/account/profile');
  }

  /** Trusted into `[innerHTML]`: see `QR_CODE_SVG_OPTIONS` for why that is safe. */
  private async _renderQr(url: string): Promise<void> {
    if (this.qr()) return;
    try {
      const { toString } = await import('qrcode');
      this.qr.set(await toString(url, QR_CODE_SVG_OPTIONS));
      this.qrFailed.set(false);
    } catch {
      // The link and the share button still work; only the code is missing.
      this.qrFailed.set(true);
    }
  }

  readonly qrHtml = computed(() => {
    const svg = this.qr();
    return svg ? this._domSanitizer.bypassSecurityTrustHtml(svg) : null;
  });
}
