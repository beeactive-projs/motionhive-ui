import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { escapeHtml } from '../../utils/html.utils';
import type { CalendarEvent } from './calendar-event.model';

/** One event block rendered inside `mh-calendar-grid` — pure presentation. */
@Component({
  selector: 'mh-event-block',
  standalone: true,
  imports: [CommonModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="mh-event-block"
      [class.mh-event-block--compact]="layout().height < 50"
      [class.mh-event-block--ring-conflict]="event().ring === 'conflict'"
      [class.mh-event-block--ring-active]="event().ring === 'active'"
      [style.top.px]="layout().top"
      [style.height.px]="layout().height"
      [style.left.%]="layout().leftPct ?? 0"
      [style.width.%]="layout().widthPct ?? 100"
      [style.borderLeftColor]="event().color"
      [style.backgroundColor]="tintedColor()"
      role="button"
      tabindex="0"
      [pTooltip]="tooltipHtml()"
      [escape]="false"
      tooltipPosition="top"
      [showDelay]="120"
      tooltipStyleClass="mh-event-tooltip"
      [attr.aria-label]="tooltipText()"
    >
      <span class="mh-event-block__title-row">
        @if (hasBadge('online')) {
          <i class="pi pi-video mh-event-block__icon" aria-hidden="true"></i>
        }
        @if (hasBadge('recurring')) {
          <i class="pi pi-replay mh-event-block__icon" aria-hidden="true"></i>
        }
        @if (hasBadge('cancelled')) {
          <i class="pi pi-times-circle mh-event-block__icon mh-event-block__icon--danger" aria-hidden="true"></i>
        }
        <span class="mh-event-block__title">{{ event().title }}</span>
      </span>
      @if (event().subtitle) {
        <span class="mh-event-block__sub">{{ event().subtitle }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }

    .mh-event-block {
      position: absolute;
      /* left + width are set inline from the lane layout (overlapping
         events split the column horizontally). Default to full-width
         when only one lane is present. */
      left: 0;
      width: 100%;
      padding: 4px 6px;
      border-left: 3px solid var(--p-primary-500);
      border-radius: 4px;
      overflow: hidden;
      cursor: pointer;
      transition: box-shadow 120ms ease;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 12px;
      line-height: 1.2;
      min-width: 0;

      &:hover,
      &:focus-visible {
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
        outline: none;
        z-index: 2;
      }

      &.mh-event-block--ring-conflict {
        box-shadow: 0 0 0 2px var(--p-red-500);
      }
      &.mh-event-block--ring-active {
        box-shadow: 0 0 0 2px var(--p-primary-500);
      }
      /* On short blocks (< ~1 row) we hide subtitle so the title
         alone gets the height. User can hover for the full detail. */
      &.mh-event-block--compact .mh-event-block__sub {
        display: none;
      }
    }

    .mh-event-block__title-row {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }

    .mh-event-block__title {
      flex: 1 1 auto;
      min-width: 0;
      font-weight: 600;
      /* Single line + ellipsis: a 2-line wrap on a narrow column
         shows broken words like "E2E one-/off" which reads worse
         than a clean truncation. Full text is in the title tooltip. */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mh-event-block__icon {
      flex-shrink: 0;
      font-size: 11px;
      color: var(--p-text-muted-color);
    }
    .mh-event-block__icon--danger {
      color: var(--p-red-600);
    }

    .mh-event-block__sub {
      color: var(--p-text-muted-color);
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class EventBlock {
  readonly event = input.required<CalendarEvent>();
  readonly layout = input.required<{
    top: number;
    height: number;
    /** Horizontal offset (%) when sharing the column with overlapping events. */
    leftPct?: number;
    /** Width (%) of this block within the column (100 = full width). */
    widthPct?: number;
  }>();

  /** Plain-text aria-label mirror of the rich tooltip. */
  protected tooltipText(): string {
    const e = this.event();
    const parts = [`${this._timeLabel()} · ${e.title}`];
    if (e.subtitle) parts.push(e.subtitle);
    if (e.badges?.includes('cancelled')) parts.push('Cancelled');
    return parts.join('\n');
  }

  /** Rich tooltip body — user-supplied fields escaped (escape=false). */
  protected tooltipHtml(): string {
    const e = this.event();
    const title = escapeHtml(e.title);
    const sub = e.subtitle ? escapeHtml(e.subtitle) : '';

    const flags: string[] = [];
    if (e.badges?.includes('online')) flags.push('Online');
    if (e.badges?.includes('recurring')) flags.push('Recurring');
    if (e.badges?.includes('cancelled')) flags.push('Cancelled');
    if (e.ring === 'conflict') flags.push('Conflict');

    return [
      `<div class="mh-evt-tt__title">${title}</div>`,
      `<div class="mh-evt-tt__time">${this._timeLabel()}</div>`,
      sub ? `<div class="mh-evt-tt__sub">${sub}</div>` : '',
      flags.length
        ? `<div class="mh-evt-tt__flags">${flags.map((f) => `<span>${f}</span>`).join('')}</div>`
        : '',
    ]
      .filter(Boolean)
      .join('');
  }

  private _timeLabel(): string {
    const fmt: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
    };
    const e = this.event();
    return `${e.start.toLocaleTimeString('en-GB', fmt)} – ${e.end.toLocaleTimeString('en-GB', fmt)}`;
  }

  protected hasBadge(name: 'online' | 'recurring' | 'cancelled'): boolean {
    return this.event().badges?.includes(name) ?? false;
  }

  /** Append `1A` (~10% alpha) when color is hex; else fall back to color-mix. */
  protected tintedColor(): string {
    const c = this.event().color.trim();
    if (/^#([0-9a-f]{6})$/i.test(c)) {
      return `${c}1A`;
    }
    return `color-mix(in srgb, ${c} 10%, transparent)`;
  }
}
