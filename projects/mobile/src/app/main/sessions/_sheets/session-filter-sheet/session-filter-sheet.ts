import { Component, computed, effect, input, model, output, signal } from '@angular/core';
import {
  IonChip,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonToggle,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { SessionKind, SessionLocationKind } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import {
  LOCATION_KIND_OPTIONS,
  SESSION_ICONS,
  SESSION_TYPE_OPTIONS,
} from '../../sessions.config';

/** What the agenda is narrowed to. Everything unset means "show it all". */
export interface AgendaFilters {
  q: string;
  type: SessionKind | null;
  locationKind: SessionLocationKind | null;
  conflictsOnly: boolean;
}

export const NO_FILTERS: AgendaFilters = {
  q: '',
  type: null,
  locationKind: null,
  conflictsOnly: false,
};

/** How many of these are actually narrowing anything — drives the chip count. */
export function activeFilterCount(filters: AgendaFilters): number {
  let count = 0;
  if (filters.q.trim()) count++;
  if (filters.type) count++;
  if (filters.locationKind) count++;
  if (filters.conflictsOnly) count++;
  return count;
}

/**
 * Narrow the agenda.
 *
 * Applied client-side against the window already loaded rather than refetching:
 * the store's own filters drive its templates list, not the calendar range this
 * screen reads, and a round-trip per chip tap would be slower than filtering a
 * few hundred rows in memory.
 *
 * Edits are local until Apply, so a half-set filter never flickers the list
 * behind the sheet.
 */
@Component({
  selector: 'mh-session-filter-sheet',
  imports: [IonChip, IonItem, IonLabel, IonList, IonNote, IonSearchbar, IonToggle, SheetShell],
  templateUrl: './session-filter-sheet.html',
  styleUrl: './session-filter-sheet.scss',
})
export class SessionFilterSheet {
  readonly open = model(false);
  readonly filters = input<AgendaFilters>(NO_FILTERS);

  readonly applied = output<AgendaFilters>();

  readonly typeOptions = SESSION_TYPE_OPTIONS;
  readonly locationOptions = LOCATION_KIND_OPTIONS;

  readonly draft = signal<AgendaFilters>(NO_FILTERS);

  constructor() {
    addIcons(SESSION_ICONS);

    // Seed from what is applied each time it opens, so a dismissed edit is
    // discarded rather than carried into the next visit.
    effect(() => {
      if (!this.open()) return;
      this.draft.set({ ...this.filters() });
    });
  }

  setQuery(value: string): void {
    this.draft.update((draft) => ({ ...draft, q: value }));
  }

  /** Tapping the selected option clears it — the chips are toggles, not a radio. */
  toggleType(type: SessionKind): void {
    this.draft.update((draft) => ({ ...draft, type: draft.type === type ? null : type }));
  }

  toggleLocation(kind: SessionLocationKind): void {
    this.draft.update((draft) => ({
      ...draft,
      locationKind: draft.locationKind === kind ? null : kind,
    }));
  }

  setConflictsOnly(value: boolean): void {
    this.draft.update((draft) => ({ ...draft, conflictsOnly: value }));
  }

  clear(): void {
    this.draft.set({ ...NO_FILTERS });
  }

  apply(): void {
    this.applied.emit(this.draft());
    this.open.set(false);
  }

  readonly count = computed(() => activeFilterCount(this.draft()));
}
