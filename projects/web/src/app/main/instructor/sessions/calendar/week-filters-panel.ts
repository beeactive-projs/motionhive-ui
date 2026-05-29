import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { SessionKind } from 'core';

export interface CalendarFilters {
  types: Record<SessionKind, boolean>;
  online: boolean;
  inPerson: boolean;
  conflictsOnly: boolean;
}

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  types: { GROUP: true, PRIVATE: true, OPEN: true },
  online: true,
  inPerson: true,
  conflictsOnly: false,
};

/**
 * Left-rail filter card for the sessions calendar.
 *
 * Three filter groups (per artboard `i-cal-week`):
 *   1. Type checkboxes (Group / 1-on-1 / Open)
 *   2. Location checkboxes (Online / In-person)
 *   3. Conflicts-only toggle (coral-tinted)
 *
 * Two-way bound via `[(filters)]` so the parent calendar can re-filter
 * the event set without managing checkbox state itself.
 */
@Component({
  selector: 'mh-week-filters-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mh-wfp" aria-label="Calendar filters">
      <h3 class="mh-wfp__title">Filters</h3>

      <div class="mh-wfp__group">
        @for (opt of typeOptions; track opt.value) {
          <label class="mh-wfp__row">
            <input
              type="checkbox"
              [checked]="filters.types[opt.value]"
              (change)="toggleType(opt.value, $any($event.target).checked)"
            />
            <span class="mh-wfp__dot" [style.background]="opt.color"></span>
            <span class="mh-wfp__label">{{ opt.label }}</span>
          </label>
        }
      </div>

      <div class="mh-wfp__divider" aria-hidden="true"></div>

      <div class="mh-wfp__group">
        <label class="mh-wfp__row">
          <input
            type="checkbox"
            [checked]="filters.online"
            (change)="toggleLocation('online', $any($event.target).checked)"
          />
          <i class="pi pi-video mh-wfp__icon" aria-hidden="true"></i>
          <span class="mh-wfp__label">Online</span>
        </label>
        <label class="mh-wfp__row">
          <input
            type="checkbox"
            [checked]="filters.inPerson"
            (change)="toggleLocation('inPerson', $any($event.target).checked)"
          />
          <i class="pi pi-map-marker mh-wfp__icon" aria-hidden="true"></i>
          <span class="mh-wfp__label">In-person</span>
        </label>
      </div>

      <div class="mh-wfp__divider" aria-hidden="true"></div>

      <label class="mh-wfp__row mh-wfp__row--coral">
        <input
          type="checkbox"
          [checked]="filters.conflictsOnly"
          (change)="toggleConflicts($any($event.target).checked)"
        />
        <i class="pi pi-exclamation-triangle mh-wfp__icon" aria-hidden="true"></i>
        <span class="mh-wfp__label">Conflicts only</span>
      </label>
    </section>
  `,
  styles: `
    .mh-wfp {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 12px;
    }
    .mh-wfp__title {
      margin: 0 0 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--p-text-muted-color);
    }
    .mh-wfp__group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .mh-wfp__row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 4px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: var(--p-text-color);

      &:hover { background: color-mix(in srgb, var(--p-text-color) 4%, transparent); }
      &--coral {
        background: #FFF7F5;
        color: #B91C1C;
        .mh-wfp__icon { color: #B91C1C; }
      }
    }
    .mh-wfp__dot {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
    .mh-wfp__icon {
      width: 14px;
      font-size: 12px;
      color: var(--p-text-muted-color);
    }
    .mh-wfp__label { flex: 1; }
    .mh-wfp__divider {
      height: 1px;
      background: var(--p-surface-200);
      margin: 4px 0;
    }
  `,
})
export class WeekFiltersPanel {
  @Input({ required: true }) filters!: CalendarFilters;
  @Output() filtersChange = new EventEmitter<CalendarFilters>();

  protected readonly typeOptions: {
    value: SessionKind;
    label: string;
    color: string;
  }[] = [
    { value: 'GROUP', label: 'Group', color: 'var(--p-primary-500)' },
    { value: 'PRIVATE', label: '1-on-1', color: '#1D4ED8' },
    { value: 'OPEN', label: 'Open', color: 'var(--p-cyan-500, #14B8A6)' },
  ];

  protected toggleType(t: SessionKind, on: boolean): void {
    this.filtersChange.emit({
      ...this.filters,
      types: { ...this.filters.types, [t]: on },
    });
  }

  protected toggleLocation(key: 'online' | 'inPerson', on: boolean): void {
    this.filtersChange.emit({ ...this.filters, [key]: on });
  }

  protected toggleConflicts(on: boolean): void {
    this.filtersChange.emit({ ...this.filters, conflictsOnly: on });
  }
}
