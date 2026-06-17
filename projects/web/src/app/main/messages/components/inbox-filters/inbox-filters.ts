import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Inbox filter chip row.
 *
 * v1 ships All + Unread (counts computed from
 * `MessagingStore.conversations`). Groups + Coaches stay in the type union
 * for forward-compat but are **not rendered** — group chats don't exist
 * yet and the BE doesn't categorize conversations by relationship type, so
 * they'd be permanently disabled. Re-add them to `chips()` once supported.
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
    // Groups + Coaches are intentionally omitted until the BE supports
    // group chats / relationship-type categorization — see class doc.
    return [
      { key: 'all', label: 'All', count: this.totalCount(), disabled: false },
      { key: 'unread', label: 'Unread', count: this.unreadCount(), disabled: false },
    ];
  }

  protected select(chip: ChipConfig): void {
    if (chip.disabled) return;
    if (chip.key !== this.active()) {
      this.filterChange.emit(chip.key);
    }
  }
}
