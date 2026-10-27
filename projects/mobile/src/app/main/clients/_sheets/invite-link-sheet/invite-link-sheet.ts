import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { IonItem, IonLabel, IonList, IonSpinner } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { publicProfileUrl } from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { ShareOutcomes, copyToClipboard, shareOrCopy } from '../../../../_shared/utils/share';

/**
 * The coach's link, as a code to scan and a URL to send.
 *
 * For the invitation that has no recipient yet: someone standing in front of
 * the coach at a gym, or a chat thread where an email address would be a
 * strange thing to ask for. The link is the coach's public profile, the one
 * address in this product a stranger can open without an account.
 *
 * **It does not convert yet.** The public profile has no "request coaching"
 * action on web or mobile — `RequestToBeClientDialog` exists in the web app
 * but only the Discover dialog uses it — so someone who scans this lands on
 * a page that tells them about the coach and gives them no way to ask. The
 * door is here because a coach asked for it; opening it needs either that
 * CTA wired onto the public profile, or a reusable invite token from the API
 * (`POST /clients/invite/link`), which would be the better shape: the person
 * would land as a pending client instead of having to ask.
 *
 * The QR renders as SVG so it stays crisp at any size, and the encoder is
 * loaded on demand — it is a large table of constants that no other screen
 * needs. It always draws dark-on-white, dark mode included: a scanner needs
 * the contrast, and an inverted code reads badly on many of them.
 */
@Component({
  selector: 'mh-invite-link-sheet',
  imports: [
    EmptyState,
    HexAvatar,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './invite-link-sheet.html',
  styleUrl: './invite-link-sheet.scss',
})
export class InviteLinkSheet {
  private readonly _domSanitizer = inject(DomSanitizer);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);

  /** The coach's own handle. Without one there is no public address to share. */
  readonly handle = input<string | null>(null);

  /** Asked for the account screen where a username is chosen. */
  readonly chooseHandle = output<void>();

  readonly url = computed(() => {
    const handle = this.handle();
    return handle ? publicProfileUrl(handle) : null;
  });

  /** The link as read aloud: the scheme says nothing to a person. Shared and copied whole. */
  readonly displayUrl = computed(() => this.url()?.replace(/^https?:\/\//, '') ?? '');

  readonly qr = signal<string | null>(null);
  readonly qrFailed = signal(false);

  /** The code enlarged, in a sheet stacked over this one. */
  readonly fullScreenOpen = signal(false);

  // By name: the full-screen view is a second shell in the same template.
  private readonly _shell = viewChild<SheetShell>('sheet');

  constructor() {
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
        this._translateService.instant('clients.toast.shareFailed'),
      );
    }
  }

  async share(): Promise<void> {
    const url = this.url();
    if (!url) return;

    const outcome = await shareOrCopy({
      title: this._translateService.instant('clients.invite.share.title'),
      text: this._translateService.instant('clients.invite.share.text'),
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
        this._translateService.instant('clients.toast.shareFailed'),
      );
    }
  }

  /** Close and await the dismissal, for the page that routes straight after. */
  async close(): Promise<void> {
    await this._shell()?.close();
  }

  /**
   * The SVG is built by the encoder from the URL alone and never contains
   * anything a person typed, so it is safe to trust — and it has to be, since
   * Angular strips the `<path>` out of an untrusted SVG string.
   */
  private async _renderQr(url: string): Promise<void> {
    if (this.qr()) return;
    try {
      const { toString } = await import('qrcode');
      const svg = await toString(url, {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      });
      this.qr.set(svg);
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
