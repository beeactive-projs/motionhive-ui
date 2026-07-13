import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Social share row. X and Facebook are plain intent links (work without
 * JS, open in a new tab); copy-link uses the async clipboard API with a
 * brief "copied" confirmation. Pass an absolute `url` so shares resolve
 * off the marketing origin, not a relative path.
 */
@Component({
  selector: 'mh-share-bar',
  templateUrl: './share-bar.html',
  styleUrl: './share-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareBar {
  readonly url = input.required<string>();
  readonly title = input<string>('');

  private readonly _platformId = inject(PLATFORM_ID);
  readonly copied = signal(false);

  readonly xUrl = computed(
    () =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(this.url())}` +
      `&text=${encodeURIComponent(this.title())}`,
  );

  readonly facebookUrl = computed(
    () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.url())}`,
  );

  async copyLink(): Promise<void> {
    if (!isPlatformBrowser(this._platformId)) return;
    try {
      await navigator.clipboard.writeText(this.url());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Clipboard blocked (permissions / insecure context) — no-op.
    }
  }
}
