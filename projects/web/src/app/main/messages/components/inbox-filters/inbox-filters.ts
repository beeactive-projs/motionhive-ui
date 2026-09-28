import { Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Segmented, SegmentedOption } from 'core';

/**
 * Inbox filter row — the shared `mh-segmented` control (Action System §8).
 *
 * v1 ships All + Unread (counts from `MessagingStore.conversations`). Groups +
 * Coaches stay in the type union for forward-compat but are **not rendered**
 * (group chats / relationship-type categorization don't exist yet) — add them
 * to `options()` once the BE supports them.
 */
export type InboxFilter = 'all' | 'unread' | 'groups' | 'coaches';

@Component({
  selector: 'mh-inbox-filters',
  imports: [Segmented, TranslatePipe],
  template: `
    <mh-segmented
      [options]="options()"
      [value]="active()"
      [ariaLabel]="'messages.filters.label' | translate"
      (valueChange)="onSelect($event)"
    />
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 0 16px 10px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      }
      :host-context(.dark) {
        border-bottom-color: rgba(248, 250, 252, 0.08);
      }
    `,
  ],
})
export class InboxFilters {
  private readonly _translateService = inject(TranslateService);

  readonly active = input<InboxFilter>('all');
  readonly totalCount = input<number>(0);
  readonly unreadCount = input<number>(0);

  readonly filterChange = output<InboxFilter>();

  readonly options = computed<SegmentedOption[]>(() => [
    { value: 'all', label: this._translateService.instant('common.all'), count: this.totalCount() },
    {
      value: 'unread',
      label: this._translateService.instant('messages.filters.unread'),
      count: this.unreadCount(),
    },
  ]);

  protected onSelect(value: string | undefined): void {
    if (value && value !== this.active()) {
      this.filterChange.emit(value as InboxFilter);
    }
  }
}
