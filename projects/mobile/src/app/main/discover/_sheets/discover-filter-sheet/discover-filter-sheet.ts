import { Component, computed, effect, input, model, output, signal } from '@angular/core';
import { IonChip } from '@ionic/angular/standalone';

import { SessionLocationKind, SessionType } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import {
  DATE_PRESET_OPTIONS,
  DISCOVER_LOCATION_OPTIONS,
  DISCOVER_TYPE_OPTIONS,
  DiscoverDatePreset,
  DiscoverDatePresets,
  DiscoverSheetFilters,
  NO_SHEET_FILTERS,
  sheetFilterCount,
} from '../../discover.config';

/**
 * Narrow the discover feed: type, location, and a date window as PRESETS —
 * the page compiles them to `dateFrom`/`dateTo`, so the sheet only offers
 * what the backend can answer and never exposes a raw picker.
 *
 * Edits are local until Apply, so a half-set filter never flickers the
 * list behind the sheet.
 */
@Component({
  selector: 'mh-discover-filter-sheet',
  imports: [IonChip, SheetShell],
  templateUrl: './discover-filter-sheet.html',
  styleUrl: './discover-filter-sheet.scss',
})
export class DiscoverFilterSheet {
  readonly open = model(false);
  readonly filters = input<DiscoverSheetFilters>(NO_SHEET_FILTERS);

  readonly applied = output<DiscoverSheetFilters>();

  readonly typeOptions = DISCOVER_TYPE_OPTIONS;
  readonly locationOptions = DISCOVER_LOCATION_OPTIONS;
  readonly presetOptions = DATE_PRESET_OPTIONS;
  readonly Presets = DiscoverDatePresets;

  readonly draft = signal<DiscoverSheetFilters>(NO_SHEET_FILTERS);

  constructor() {
    // Seed from what is applied each time it opens, so a dismissed edit is
    // discarded rather than carried into the next visit.
    effect(() => {
      if (!this.open()) return;
      this.draft.set({ ...this.filters() });
    });
  }

  readonly count = computed(() => sheetFilterCount(this.draft()));

  readonly applyLabel = computed(() => {
    const count = this.count();
    if (count === 0) return 'Apply';
    return `Apply · ${count} ${count === 1 ? 'filter' : 'filters'}`;
  });

  setType(type: SessionType | null): void {
    this.draft.update((draft) => ({ ...draft, type }));
  }

  setLocation(locationKind: SessionLocationKind | null): void {
    this.draft.update((draft) => ({ ...draft, locationKind }));
  }

  setPreset(datePreset: DiscoverDatePreset): void {
    this.draft.update((draft) => ({ ...draft, datePreset }));
  }

  reset(): void {
    this.draft.set({ ...NO_SHEET_FILTERS });
  }

  apply(): void {
    this.applied.emit(this.draft());
    this.open.set(false);
  }
}
