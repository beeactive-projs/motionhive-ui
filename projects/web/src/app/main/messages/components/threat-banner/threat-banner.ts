import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
  standalone: true,
  templateUrl: './threat-banner.html',
  styleUrl: './threat-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThreatBanner {
  protected readonly store = inject(MessagingStore);

  protected readonly flags = this.store.activeThreatFlags;

  protected readonly reasons = computed<string[]>(() => {
    const f = this.flags();
    if (!f) return [];
    const out: string[] = [];
    if (f.hasOffPlatformContact) out.push('off-platform contact details');
    if (f.hasPaymentHandle) out.push('payment handles');
    if (f.hasShortenerUrl) out.push('shortened links');
    // BE flips `anyFlag` true for any URL — even a plain non-shortener
    // link. Surface that as a generic "links" reason so the banner
    // never reads "Your last message contains ." (empty list).
    if (out.length === 0 && f.urls.length > 0) {
      out.push(f.urls.length === 1 ? 'a link' : 'links');
    }
    return out;
  });

  protected dismiss(): void {
    this.store.dismissThreatFlags();
  }
}
