import { Component, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { appLocale, escapeHtml } from 'core';
import type { CalendarEvent } from './calendar-event.model';

/** One event block rendered inside `mh-calendar-grid` — pure presentation. */
@Component({
  selector: 'mh-event-block',
  imports: [TooltipModule, TranslatePipe],
  templateUrl: './event-block.html',
  styleUrl: './event-block.scss',
})
export class EventBlock {
  private readonly _translateService = inject(TranslateService);

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
    if (e.badges?.includes('cancelled')) {
      parts.push(this._translateService.instant('enum.sessionInstanceStatus.CANCELLED'));
    }
    return parts.join('\n');
  }

  /** Rich tooltip body — user-supplied fields escaped (escape=false). */
  protected tooltipHtml(): string {
    const e = this.event();
    const title = escapeHtml(e.title);
    const sub = e.subtitle ? escapeHtml(e.subtitle) : '';

    const t = (key: string) => escapeHtml(this._translateService.instant(key));
    const flags: string[] = [];
    if (e.badges?.includes('online')) flags.push(t('enum.sessionLocationKind.ONLINE'));
    if (e.badges?.includes('recurring')) flags.push(t('components.calendar.recurring'));
    if (e.badges?.includes('cancelled')) flags.push(t('enum.sessionInstanceStatus.CANCELLED'));
    if (e.ring === 'conflict') flags.push(t('components.calendar.conflict'));

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
    const locale = appLocale();
    return `${e.start.toLocaleTimeString(locale, fmt)} – ${e.end.toLocaleTimeString(locale, fmt)}`;
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
