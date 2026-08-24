import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import {
  SESSION_MEETING_PROVIDERS,
  SessionMeetingProvider,
  meetingProviderLabel,
} from 'core';

/**
 * `mh-provider-chip` — meeting provider pill (Zoom / Google Meet / Teams).
 *
 * Renders ONLY when the session is online AND we know the provider.
 * Pass `null` for "Online" without a known provider.
 */
@Component({
  selector: 'mh-provider-chip',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './provider-chip.html',
})
export class ProviderChip {
  readonly provider = input<SessionMeetingProvider | null>(null);

  protected readonly Provider = SessionMeetingProvider;

  protected readonly label = computed<string>(() => meetingProviderLabel(this.provider()));

  protected readonly icon = computed<string>(() => {
    const provider = this.provider();
    return (provider && SESSION_MEETING_PROVIDERS[provider]?.piIcon) || 'pi pi-video';
  });

  /** Per-provider bg + text color classes. */
  protected readonly colorClass = computed<string>(() => {
    switch (this.provider()) {
      case SessionMeetingProvider.Zoom:
        return 'bg-blue-500 text-blue-50';
      case SessionMeetingProvider.GoogleMeet:
        return 'bg-green-500 text-green-50';
      case SessionMeetingProvider.Teams:
        return 'bg-indigo-500 text-indigo-50';
      default:
        return 'bg-teal-500 text-teal-50';
    }
  });
}
