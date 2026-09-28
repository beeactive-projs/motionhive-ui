import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { IonChip, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { NotificationCategory } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FILTERABLE_CATEGORIES } from '../../../../_shared/config/notification-categories.config';
import {
  NO_FILTERS,
  NotificationFilters,
  activeFilterCount,
  categoryLabel,
} from '../../notifications.config';

/**
 * Narrow the centre.
 *
 * The same shell as the agenda's filter sheet — Reset in the header, chip
 * groups in the body, Cancel / Apply in the footer — so a filter is picked the
 * same way everywhere in the app. Unlike the agenda's, these go to the server:
 * the list is paged, and a filter run over the page already loaded would
 * return short pages.
 *
 * Edits are local until Apply, so browsing the chips never reloads the list
 * behind the sheet.
 */
@Component({
  selector: 'mh-notification-filter-sheet',
  imports: [IonChip, IonNote, SheetShell, TranslatePipe],
  templateUrl: './notification-filter-sheet.html',
  styleUrl: './notification-filter-sheet.scss',
})
export class NotificationFilterSheet {
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly filters = input<NotificationFilters>(NO_FILTERS);

  readonly applied = output<NotificationFilters>();

  /** Label only — the chips are text, like the agenda's; the glyph belongs to the rows. */
  readonly categoryOptions = FILTERABLE_CATEGORIES.map((value) => ({
    value,
    label: categoryLabel(value),
  }));

  readonly draft = signal<NotificationFilters>(NO_FILTERS);

  constructor() {
    // Seed from what is applied each time it opens, so a dismissed edit is
    // discarded rather than carried into the next visit.
    effect(() => {
      if (!this.open()) return;
      this.draft.set({ ...this.filters() });
    });
  }

  readonly count = computed(() => activeFilterCount(this.draft()));

  readonly applyLabel = computed(() => {
    const count = this.count();
    if (count === 0) return this._translateService.instant('button.apply');
    return this._translateService.instant('notifications.filter.applyCount', { count });
  });

  /** All / Unread — a pair, so this one is a radio rather than a toggle. */
  setUnreadOnly(unreadOnly: boolean): void {
    this.draft.update((draft) => ({ ...draft, unreadOnly }));
  }

  /** Categories stack: each chip is its own toggle. */
  toggleCategory(category: NotificationCategory): void {
    this.draft.update((draft) => ({
      ...draft,
      categories: draft.categories.includes(category)
        ? draft.categories.filter((picked) => picked !== category)
        : [...draft.categories, category],
    }));
  }

  isPicked(category: NotificationCategory): boolean {
    return this.draft().categories.includes(category);
  }

  /** Reset is a decision, not an edit: it lands and closes, like Apply. */
  reset(): void {
    this.draft.set({ ...NO_FILTERS });
    this.apply();
  }

  apply(): void {
    this.applied.emit(this.draft());
    this.open.set(false);
  }
}
