import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { SessionMeetingProvider } from 'core';

/**
 * `mh-provider-chip` — meeting provider pill (Zoom / Google Meet / Teams).
 *
 * Renders ONLY when the session is online AND we know the provider.
 * Pass `null` for "Online" without a known provider.
 */
@Component({
  selector: 'mh-provider-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './provider-chip.html',
  styleUrl: './provider-chip.scss',
})
export class ProviderChip {
  readonly provider = input<SessionMeetingProvider | null>(null);

  protected label(): string {
    switch (this.provider()) {
      case 'ZOOM': return 'Zoom';
      case 'GOOGLE_MEET': return 'Google Meet';
      case 'TEAMS': return 'Teams';
      default: return 'Online';
    }
  }
}
