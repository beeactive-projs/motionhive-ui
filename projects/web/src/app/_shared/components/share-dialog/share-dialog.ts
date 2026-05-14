import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

type ShareTarget = 'instagram' | 'facebook' | 'whatsapp' | 'anywhere';

interface ShareTile {
  id: ShareTarget;
  label: string;
  icon: string;
}

/**
 * Reusable "Share this …" dialog. Drives:
 *   - a copyable URL row
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
  imports: [Dialog, Button, InputText, Toast],
  providers: [MessageService],
  templateUrl: './share-dialog.html',
  styleUrl: './share-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareDialog {
  private readonly _messageService = inject(MessageService);

  readonly visible = model<boolean>(false);

  /** Headline at the top of the dialog. */
  readonly headline = input<string>('Share this profile');
  /** Helper text below the headline. */
  readonly subcopy = input<string>(
    'Drop this link in your Instagram bio, your story, or anywhere people can find you.',
  );

  /** Full URL to share — e.g. `https://motionhive.fit/@mayapetrov`. */
  readonly url = input.required<string>();
  /** What the share text says alongside the URL on WhatsApp / Web Share. */
  readonly shareText = input<string>('Check this out on MotionHive');

  /** Preview card title — first line under the cover. */
  readonly previewTitle = input<string>('');
  /** Preview card meta — second line under the title. */
  readonly previewSubtitle = input<string>('');
  /** Optional cover image — falls back to the honey striped placeholder. */
  readonly previewCoverUrl = input<string | null>(null);

  readonly copied = signal(false);

  readonly displayUrl = computed(() => this.url().replace(/^https?:\/\//i, ''));

  readonly tiles: ShareTile[] = [
    { id: 'instagram', label: 'Instagram', icon: 'pi pi-instagram' },
    { id: 'facebook', label: 'Facebook', icon: 'pi pi-facebook' },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'pi pi-whatsapp' },
    { id: 'anywhere', label: 'Anywhere', icon: 'pi pi-link' },
  ];

  async copy(): Promise<void> {
    await this._writeToClipboard(this.url());
    this.copied.set(true);
    this._messageService.add({
      severity: 'success',
      summary: 'Link copied',
      detail: this.displayUrl(),
      life: 2000,
    });
    setTimeout(() => this.copied.set(false), 2000);
  }

  async shareTo(target: ShareTarget): Promise<void> {
    const url = this.url();
    const text = this.shareText();

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
          summary: 'Link copied',
          detail: 'Paste it in your Instagram bio, story, or DM.',
          life: 2500,
        });
        return;
      }
      case 'anywhere': {
        if (navigator.share) {
          try {
            await navigator.share({ title: this.headline(), text, url });
          } catch {
            /* user cancelled — nothing to do */
          }
          return;
        }
        await this._writeToClipboard(url);
        this._messageService.add({
          severity: 'success',
          summary: 'Link copied',
          detail: 'Paste it anywhere you want to share.',
          life: 2000,
        });
      }
    }
  }

  close(): void {
    this.visible.set(false);
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
