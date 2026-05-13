import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Inbox filter chip row. Four chips — All / Unread / Groups / Coaches.
 *
 * v1 implements All + Unread fully (counts computed from
 * `MessagingStore.conversations`). Groups + Coaches are kept for design
 * fidelity but disabled with a tooltip — Groups because group chats
 * don't exist in v1, Coaches because the BE doesn't categorize
 * conversations by relationship type yet.
 *
 * The disabled chips still render the count when relevant (Groups
 * always shows 0; Coaches isn't shown a count).
 */
export type InboxFilter = 'all' | 'unread' | 'groups' | 'coaches';

interface ChipConfig {
  key: InboxFilter;
  label: string;
  count: number | null;
  disabled: boolean;
  disabledReason?: string;
}

@Component({
  selector: 'mh-inbox-filters',
  standalone: true,
  template: `
    <div class="mh-filters" role="tablist" aria-label="Inbox filters">
      @for (chip of chips(); track chip.key) {
        <button
          type="button"
          role="tab"
          class="mh-filters__chip"
          [class.mh-filters__chip--active]="chip.key === active()"
          [class.mh-filters__chip--disabled]="chip.disabled"
          [attr.aria-selected]="chip.key === active()"
          [attr.title]="chip.disabledReason ?? null"
          [disabled]="chip.disabled"
          (click)="select(chip)"
        >
          {{ chip.label }}
          @if (chip.count !== null) {
            <span class="mh-filters__count">{{ chip.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 0 16px 10px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    }
    .mh-filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .mh-filters__chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 11px;
      border-radius: 999px;
      border: none;
      background: #f7f1e6;
      color: #475569;
      font-family: inherit;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 120ms ease, color 120ms ease;
    }
    .mh-filters__chip:hover:not(.mh-filters__chip--disabled):not(.mh-filters__chip--active) {
      background: #ede4d2;
    }
    .mh-filters__chip--active {
      background: #0f172a;
      color: #ffffff;
    }
    .mh-filters__chip--disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .mh-filters__count {
      opacity: 0.7;
    }
    .mh-filters__chip--active .mh-filters__count {
      opacity: 0.85;
    }

    /* ── Dark mode ─────────────────────────────────────────── */
    :host-context(.dark) {
      border-bottom-color: rgba(248, 250, 252, 0.08);
    }
    :host-context(.dark) .mh-filters__chip {
      background: rgba(248, 250, 252, 0.06);
      color: var(--p-surface-200, #e2e8f0);
    }
    :host-context(.dark) .mh-filters__chip:hover:not(.mh-filters__chip--disabled):not(.mh-filters__chip--active) {
      background: rgba(248, 250, 252, 0.12);
    }
    :host-context(.dark) .mh-filters__chip--active {
      background: var(--p-surface-50, #f1f5f9);
      color: var(--p-surface-900, #0f172a);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxFilters {
  readonly active = input<InboxFilter>('all');
  readonly totalCount = input<number>(0);
  readonly unreadCount = input<number>(0);

  readonly filterChange = output<InboxFilter>();

  protected chips(): ChipConfig[] {
    return [
      { key: 'all', label: 'All', count: this.totalCount(), disabled: false },
      { key: 'unread', label: 'Unread', count: this.unreadCount(), disabled: false },
      // v1: no group conversations exist yet, so the chip would always
      // be 0 and click-no-op'd. Disabled until F-future.
      {
        key: 'groups',
        label: 'Groups',
        count: 0,
        disabled: true,
        disabledReason: 'Group chats coming soon',
      },
      // BE doesn't tag conversations by relationship type yet.
      {
        key: 'coaches',
        label: 'Coaches',
        count: null,
        disabled: true,
        disabledReason: 'Coming soon',
      },
    ];
  }

  protected select(chip: ChipConfig): void {
    if (chip.disabled) return;
    if (chip.key !== this.active()) {
      this.filterChange.emit(chip.key);
    }
  }
}
