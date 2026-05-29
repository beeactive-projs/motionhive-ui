import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import type { SessionMeetingProvider } from '../../models/session/session.enums';

/**
 * `mh-provider-chip` — meeting provider pill (Zoom / Google Meet / Teams).
 *
 * Renders ONLY when the session is online AND we know the provider.
 * Pass `null` for "Online" without a known provider.
 */
@Component({
  selector: 'mh-provider-chip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="mh-provider">
      <i class="pi pi-video" aria-hidden="true"></i>
      <span>{{ label() }}</span>
    </span>
  `,
  styles: `
    .mh-provider {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 6px;
      background: #E0F2F1;
      color: #00695C;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.4;
      white-space: nowrap;

      i { font-size: 10px; }
    }
  `,
})
export class ProviderChip {
  @Input() provider: SessionMeetingProvider | null = null;

  protected label(): string {
    switch (this.provider) {
      case 'ZOOM': return 'Zoom';
      case 'GOOGLE_MEET': return 'Google Meet';
      case 'TEAMS': return 'Teams';
      default: return 'Online';
    }
  }
}
