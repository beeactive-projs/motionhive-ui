import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
  IonChip,
  IonDatetime,
  IonDatetimeButton,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { Group, GroupService, SessionType, SessionLocationKind } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import {
  AgendaFilters,
  AgendaStatus,
  LOCATION_KIND_OPTIONS,
  MAX_RANGE_DAYS,
  NO_FILTERS,
  SESSION_ICONS,
  SESSION_TYPE_OPTIONS,
  STATUS_OPTIONS,
  activeFilterCount,
} from '../../sessions.config';

// Re-exported so the page and the sheet keep importing the filter contract from
// one place; the definitions live in sessions.config now that the header chips
// and the agenda predicate need them too.
export type { AgendaFilters };
export { NO_FILTERS, activeFilterCount };

/**
 * Narrow the agenda.
 *
 * Applied client-side against the window already loaded rather than refetching:
 * the store's own filters drive its templates list, not the calendar range this
 * screen reads, and a round-trip per chip tap would be slower than filtering a
 * few hundred rows in memory. The one exception is the date range, which can
 * ask for days outside the window — the page widens it when that happens.
 *
 * Edits are local until Apply, so a half-set filter never flickers the list
 * behind the sheet.
 */
@Component({
  selector: 'mh-session-filter-sheet',
  imports: [
    IonChip,
    IonDatetime,
    IonDatetimeButton,
    IonItem,
    IonLabel,
    IonModal,
    IonNote,
    IonSelect,
    IonSelectOption,
    SheetShell,
  ],
  templateUrl: './session-filter-sheet.html',
  styleUrl: './session-filter-sheet.scss',
})
export class SessionFilterSheet {
  private readonly _groupService = inject(GroupService);

  readonly open = model(false);
  readonly filters = input<AgendaFilters>(NO_FILTERS);

  readonly applied = output<AgendaFilters>();

  readonly typeOptions = SESSION_TYPE_OPTIONS;
  readonly locationOptions = LOCATION_KIND_OPTIONS;
  readonly statusOptions = STATUS_OPTIONS;

  readonly draft = signal<AgendaFilters>(NO_FILTERS);

  readonly groups = signal<Group[]>([]);
  private _groupsLoaded = false;

  constructor() {
    addIcons(SESSION_ICONS);

    // Seed from what is applied each time it opens, so a dismissed edit is
    // discarded rather than carried into the next visit.
    effect(() => {
      if (!this.open()) return;
      this.draft.set({ ...this.filters() });
      this._loadGroups();
    });
  }

  readonly count = computed(() => activeFilterCount(this.draft()));

  /**
   * The API rejects a range wider than its own cap outright, so the sheet
   * refuses to send one rather than letting the agenda fall into an error
   * screen. Blocking at the source beats handling a 400.
   */
  readonly rangeTooWide = computed(() => {
    const { dateFrom, dateTo } = this.draft();
    if (!dateFrom || !dateTo) return false;
    const days =
      (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86_400_000;
    return days > MAX_RANGE_DAYS;
  });

  /** A backwards range is a typo, not a filter — say so rather than showing nothing. */
  readonly rangeBackwards = computed(() => {
    const { dateFrom, dateTo } = this.draft();
    return !!dateFrom && !!dateTo && dateTo < dateFrom;
  });

  readonly canApply = computed(() => !this.rangeTooWide() && !this.rangeBackwards());

  readonly applyLabel = computed(() => {
    const count = this.count();
    if (count === 0) return 'Apply';
    return `Apply · ${count} ${count === 1 ? 'filter' : 'filters'}`;
  });

  /** Tapping the selected option clears it — the chips are toggles, not a radio. */
  toggleType(type: SessionType): void {
    this.draft.update((draft) => ({ ...draft, type: draft.type === type ? null : type }));
  }

  toggleLocation(kind: SessionLocationKind): void {
    this.draft.update((draft) => ({
      ...draft,
      locationKind: draft.locationKind === kind ? null : kind,
    }));
  }

  toggleStatus(status: AgendaStatus): void {
    this.draft.update((draft) => ({
      ...draft,
      status: draft.status === status ? null : status,
    }));
  }

  /** `ion-datetime` hands back `yyyy-mm-dd` for a date presentation. */
  setDateFrom(value: string | string[] | null | undefined): void {
    this.draft.update((draft) => ({ ...draft, dateFrom: firstDay(value) }));
  }

  setDateTo(value: string | string[] | null | undefined): void {
    this.draft.update((draft) => ({ ...draft, dateTo: firstDay(value) }));
  }

  clearDates(): void {
    this.draft.update((draft) => ({ ...draft, dateFrom: null, dateTo: null }));
  }

  setGroup(value: string | null): void {
    this.draft.update((draft) => ({ ...draft, groupId: value }));
  }

  reset(): void {
    this.draft.set({ ...NO_FILTERS });
  }

  apply(): void {
    if (!this.canApply()) return;
    this.applied.emit(this.draft());
    this.open.set(false);
  }

  /**
   * Fetched once, on first open. The flag rather than `groups().length` because
   * a coach with no groups is a valid answer that would otherwise refetch every
   * time the sheet opens. A failure does not latch, so reopening retries.
   */
  private _loadGroups(): void {
    if (this._groupsLoaded) return;
    this._groupsLoaded = true;
    this._groupService
      .getMyGroups()
      .pipe(take(1))
      .subscribe({
        next: (groups) => this.groups.set(groups),
        // Not worth an error: the section simply does not render, and every
        // other filter still works.
        error: () => {
          this._groupsLoaded = false;
          this.groups.set([]);
        },
      });
  }
}

/** `ion-datetime` can hand back an array in multi-select mode; we never use it. */
function firstDay(value: string | string[] | null | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw.slice(0, 10) : null;
}
