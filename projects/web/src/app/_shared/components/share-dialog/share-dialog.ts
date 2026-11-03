import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';

import { QR_CODE_SVG_OPTIONS } from 'core';

type ShareTarget = 'instagram' | 'facebook' | 'whatsapp' | 'anywhere';

interface ShareTile {
  id: ShareTarget;
  label: string;
  icon: string;
}

/**
 * Reusable "Share this …" dialog. Drives:
 *   - a copyable URL row
 *   - a QR code of the same URL, for a phone held up to the screen (drawn
 *     with core's `QR_CODE_SVG_OPTIONS`, like the mobile app's share sheet)
 *   - 4 share-target tiles (Instagram, Facebook, WhatsApp, Anywhere)
 *   - an OG-style preview card so users see what gets pasted
 *
 * Instagram has no public web share intent — that tile copies the link
 * and surfaces a toast hint ("Paste in your bio / story"). Facebook +
 * WhatsApp open their respective sharer URLs in a new tab. "Anywhere"
 * uses `navigator.share()` when available (mobile) and falls back to
 * copying the link.
 *
 * Designed for profiles first but kept generic enough for groups,
 * sessions, posts — pass whatever `headline` / `subcopy` /
 * `previewTitle` / `previewSubtitle` fit the context.
 */
@Component({
  selector: 'mh-share-dialog',
  imports: [Dialog, ButtonDirective, InputText, Skeleton, Toast, TranslatePipe],
  providers: [MessageService],
  templateUrl: './share-dialog.html',
  styleUrl: './share-dialog.scss',
})
export class ShareDialog {
  private readonly _domSanitizer = inject(DomSanitizer);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model<boolean>(false);

  /** Headline at the top of the dialog. Defaults to "Share this profile". */
  readonly headline = input<string>();
  /** Helper text below the headline. Defaults to the profile-sharing hint. */
  readonly subcopy = input<string>();

  /** Full URL to share — e.g. `https://motionhive.fit/@mayapetrov`. */
  readonly url = input.required<string>();
  /** What the share text says alongside the URL on WhatsApp / Web Share. */
  readonly shareText = input<string>();

  protected readonly headlineText = computed(
    () => this.headline() ?? this._translateService.instant('components.shareDialog.defaultHeadline'),
  );
  protected readonly subcopyText = computed(
    () => this.subcopy() ?? this._translateService.instant('components.shareDialog.defaultSubcopy'),
  );
  private readonly _shareTextValue = computed(
    () => this.shareText() ?? this._translateService.instant('components.shareDialog.defaultShareText'),
  );

  /** Preview card title — first line under the cover. */
  readonly previewTitle = input<string>('');
  /** Preview card meta — second line under the title. */
  readonly previewSubtitle = input<string>('');
  /** Optional cover image — falls back to the honey striped placeholder. */
  readonly previewCoverUrl = input<string | null>(null);

  readonly copied = signal(false);

  /** The code for `url`, drawn the first time the dialog opens on it. */
  readonly qr = signal<SafeHtml | null>(null);
  readonly qrFailed = signal(false);
  private _qrUrl: string | null = null;

  readonly displayUrl = computed(() => this.url().replace(/^https?:\/\//i, ''));

  readonly tiles: ShareTile[] = [
    { id: 'instagram', label: 'Instagram', icon: 'pi pi-instagram' },
    { id: 'facebook', label: 'Facebook', icon: 'pi pi-facebook' },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'pi pi-whatsapp' },
    {
      id: 'anywhere',
      label: this._translateService.instant('components.shareDialog.anywhere'),
      icon: 'pi pi-link',
    },
  ];

  constructor() {
    effect(() => {
      const url = this.url();
      if (this.visible() && url) void this._renderQr(url);
    });
  }

  async copy(): Promise<void> {
    await this._writeToClipboard(this.url());
    this.copied.set(true);
    this._messageService.add({
      severity: 'success',
      summary: this._translateService.instant('toast.detail.linkCopied'),
      detail: this.displayUrl(),
      life: 2000,
    });
    setTimeout(() => this.copied.set(false), 2000);
  }

  async shareTo(target: ShareTarget): Promise<void> {
    const url = this.url();
    const text = this._shareTextValue();

    switch (target) {
      case 'facebook': {
        const href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      case 'whatsapp': {
        const href = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      case 'instagram': {
        await this._writeToClipboard(url);
        this._messageService.add({
          severity: 'info',
          summary: this._translateService.instant('toast.detail.linkCopied'),
          detail: this._translateService.instant('components.shareDialog.toast.instagramHint'),
          life: 2500,
        });
        return;
      }
      case 'anywhere': {
        if (navigator.share) {
          try {
            await navigator.share({ title: this.headlineText(), text, url });
          } catch {
            /* user cancelled — nothing to do */
          }
          return;
        }
        await this._writeToClipboard(url);
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('toast.detail.linkCopied'),
          detail: this._translateService.instant('components.shareDialog.toast.anywhereHint'),
          life: 2000,
        });
      }
    }
  }

  close(): void {
    this.visible.set(false);
  }

  /**
   * Trusted into `[innerHTML]`: the encoder emits only the code's own path
   * data, never the encoded text, so nothing a caller passes can inject markup.
   * Loaded on first open; it is a large table no other screen needs.
   */
  private async _renderQr(url: string): Promise<void> {
    if (this._qrUrl === url) return;
    this._qrUrl = url;
    this.qr.set(null);
    this.qrFailed.set(false);
    try {
      const { toString } = await import('qrcode');
      const svg = await toString(url, QR_CODE_SVG_OPTIONS);
      // A newer URL may have started rendering while this one was encoding.
      if (this._qrUrl === url) this.qr.set(this._domSanitizer.bypassSecurityTrustHtml(svg));
    } catch {
      // The link and the share targets still work; only the code is missing.
      if (this._qrUrl === url) this.qrFailed.set(true);
    }
  }

  private async _writeToClipboard(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        /* fall through to the legacy path */
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
