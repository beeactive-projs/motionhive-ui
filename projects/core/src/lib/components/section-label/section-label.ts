import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

/**
 * `mh-section-label` — day-group header for grouped lists.
 *
 * Example: "Today · Mon 18 May (4)". Used in sessions list, my-sessions,
 * mobile discover, and any future grouped list.
 */
@Component({
  selector: 'mh-section-label',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mh-section-label">
      <span class="mh-section-label__text">{{ label }}</span>
      @if (count != null) {
        <span class="mh-section-label__count">{{ count }}</span>
      }
    </div>
  `,
  styles: `
    .mh-section-label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 0 8px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--p-text-muted-color);
    }
    .mh-section-label__count {
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--p-surface-100);
      color: var(--p-text-muted-color);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
    }
  `,
})
export class SectionLabel {
  @Input({ required: true }) label!: string;
  @Input() count?: number;
}
