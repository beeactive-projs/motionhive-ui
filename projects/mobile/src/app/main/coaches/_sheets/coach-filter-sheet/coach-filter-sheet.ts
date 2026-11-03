import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CoachDirectoryFacets, CoachDirectorySort } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import {
  CoachSheetFilters,
  EXPERIENCE_OPTIONS,
  NO_SHEET_FILTERS,
  SORT_OPTIONS,
  sheetFilterCount,
} from '../../coaches.filters';

/**
 * The coach directory's Filters chip: what the quick chips do not cover.
 *
 * The same shell as the notification and agenda filter sheets (Reset in the
 * header, chip groups in the body, Cancel / Apply in the footer), so a filter
 * is picked the same way everywhere in the app. These go to the server: the
 * list is paged, and a filter over the page already loaded would return short
 * pages. The specializations and cities come from the whole directory
 * (`/directory/facets`), with how many coaches each.
 *
 * Edits are local until Apply, so browsing the chips never reloads the list
 * behind the sheet.
 */
@Component({
  selector: 'mh-coach-filter-sheet',
  imports: [IonButton, SheetShell, TranslatePipe],
  templateUrl: './coach-filter-sheet.html',
  styleUrl: './coach-filter-sheet.scss',
})
export class CoachFilterSheet {
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly filters = input<CoachSheetFilters>(NO_SHEET_FILTERS);
  readonly facets = input<CoachDirectoryFacets>({ cities: [], specializations: [] });

  readonly applied = output<CoachSheetFilters>();

  readonly sortOptions = SORT_OPTIONS;
  readonly experienceOptions = EXPERIENCE_OPTIONS;

  readonly draft = signal<CoachSheetFilters>(NO_SHEET_FILTERS);

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
    if (count === 0) return this._translateService.instant('button.apply');
    return this._translateService.instant('coaches.filter.applyCount', { count });
  });

  /** Sort is one of three, so its chips are a radio rather than toggles. */
  setSort(sort: CoachDirectorySort): void {
    this.draft.update((draft) => ({ ...draft, sort }));
  }

  /** Specializations stack: each chip is its own toggle. */
  toggleSpecialization(label: string): void {
    this.draft.update((draft) => ({
      ...draft,
      specializations: draft.specializations.includes(label)
        ? draft.specializations.filter((picked) => picked !== label)
        : [...draft.specializations, label],
    }));
  }

  isPicked(label: string): boolean {
    return this.draft().specializations.includes(label);
  }

  /** One city at a time; null is everywhere. */
  setCity(city: string | null): void {
    this.draft.update((draft) => ({ ...draft, city }));
  }

  setMinYears(minYears: number | null): void {
    this.draft.update((draft) => ({ ...draft, minYears }));
  }

  /** Reset is a decision, not an edit: it lands and closes, like Apply. */
  reset(): void {
    this.draft.set({ ...NO_SHEET_FILTERS });
    this.apply();
  }

  apply(): void {
    this.applied.emit(this.draft());
    this.open.set(false);
  }
}
