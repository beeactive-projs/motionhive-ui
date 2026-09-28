import { Component, computed, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessagingStore } from 'core';

/**
 * Inline banner shown to the SENDER when the BE flags their just-sent
 * message for off-platform contact attempts, payment handles, or
 * shortener URLs. Recipient never sees this — flags ship in the SEND
 * response only and are never broadcast over SSE.
 *
 * Visibility is bound to `store.activeThreatFlags()`. Dismiss clears
 * the flags for the active conversation; flags re-appear if the user
 * sends another flagged message.
 *
 * Copy is intentionally calm — these are heuristic signals, not
 * accusations. We don't list the matched URL or handle because in
 * practice that information is more useful to a phishing victim than
 * to the sender themselves.
 */
@Component({
  selector: 'mh-threat-banner',
  imports: [TranslatePipe],
  templateUrl: './threat-banner.html',
  styleUrl: './threat-banner.scss',
})
export class ThreatBanner {
  private readonly _translateService = inject(TranslateService);
  protected readonly store = inject(MessagingStore);

  protected readonly flags = this.store.activeThreatFlags;

  protected readonly reasons = computed<string[]>(() => {
    const f = this.flags();
    if (!f) return [];
    const out: string[] = [];
    const t = (key: string, params?: Record<string, unknown>): string =>
      this._translateService.instant(`messages.threat.reason.${key}`, params);
    if (f.hasOffPlatformContact) out.push(t('offPlatform'));
    if (f.hasPaymentHandle) out.push(t('payment'));
    if (f.hasShortenerUrl) out.push(t('shortener'));
    // BE flips `anyFlag` true for any URL — even a plain non-shortener
    // link. Surface that as a generic "links" reason so the banner
    // never reads "Your last message contains ." (empty list).
    if (out.length === 0 && f.urls.length > 0) {
      out.push(t('links', { count: f.urls.length }));
    }
    return out;
  });

  protected dismiss(): void {
    this.store.dismissThreatFlags();
  }
}
