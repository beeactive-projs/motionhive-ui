import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  SessionInstance,
  SessionsInstructorStore,
  endOfDay,
  localDayKey,
  sessionDayLabel,
  startOfDay,
  weekStart,
} from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { DayRail } from './_components/day-rail/day-rail';
import { SessionRow } from './_components/session-row/session-row';
import { MessageSignupsSheet } from './_sheets/message-signups-sheet/message-signups-sheet';
import { MonthSheet } from './_sheets/month-sheet/month-sheet';
import { SessionFormSheet } from './_sheets/session-form-sheet/session-form-sheet';
import {
  AgendaFilters,
  NO_FILTERS,
  SessionFilterSheet,
  activeFilterCount,
} from './_sheets/session-filter-sheet/session-filter-sheet';
import { AGENDA_DAYS_AHEAD, SESSION_ICONS } from './sessions.config';

interface AgendaDay {
  key: string;
  label: string;
  isToday: boolean;
  instances: SessionInstance[];
  conflicts: number;
}

/**
 * The coach's agenda: a week strip for orientation, then sessions grouped by
 * day.
 *
 * Reads `SessionsInstructorStore`, shared with web — `loadRange` returns the
 * scheduled occurrences in a window and caches recent windows, so moving
 * between weeks does not refetch.
 */
@Component({
  selector: 'mh-sessions',
  imports: [
    EmptyState,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    DayRail,
    MessageSignupsSheet,
    MonthSheet,
    SessionFilterSheet,
    SessionFormSheet,
    SessionRow,
  ],
  templateUrl: './sessions.html',
  styleUrl: './sessions.scss',
})
export class Sessions implements ViewWillEnter {
  readonly store = inject(SessionsInstructorStore);
  private readonly _router = inject(Router);
  private readonly _actionSheetController = inject(ActionSheetController);

  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly createOpen = signal(false);
  /** Seeds the create sheet when it opens from a slot on the day rail. */
  readonly createStart = signal<Date | null>(null);
  readonly filterOpen = signal(false);
  readonly monthOpen = signal(false);
  readonly messageOpen = signal(false);
  readonly messageInstanceId = signal<string | null>(null);

  /** 'agenda' is the day-grouped list; 'day' is the hour rail. */
  readonly view = signal<'agenda' | 'day'>('agenda');

  /** Which day the rail shows, and what the month sheet opens on. */
  readonly selectedDay = signal(startOfDay(new Date()));

  readonly filters = signal<AgendaFilters>({ ...NO_FILTERS });
  readonly filterCount = computed(() => activeFilterCount(this.filters()));

  /** The window currently loaded. The month sheet can widen it. */
  private readonly _windowStart = signal(startOfDay(new Date()));

  /** The Monday of the week the strip is showing. */
  readonly weekStartDate = computed(() => weekStart(this.selectedDay()));

  constructor() {
    addIcons(SESSION_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page alive in the tab stack, so that would
  // run once per app session. The store caches the window.
  ionViewWillEnter(): void {
    this._load();
  }

  /** The loaded window, narrowed by the filter sheet. */
  readonly visibleInstances = computed(() => {
    const { q, type, locationKind, conflictsOnly } = this.filters();
    const needle = q.trim().toLowerCase();

    return this.store.rangeInstances().filter((instance) => {
      const template = instance.template;
      if (type && template?.type !== type) return false;
      if (locationKind && template?.locationKind !== locationKind) return false;
      if (conflictsOnly && (instance.conflictingInstanceIds?.length ?? 0) === 0) return false;
      if (needle) {
        const title = (instance.titleOverride ?? template?.title ?? '').toLowerCase();
        if (!title.includes(needle)) return false;
      }
      return true;
    });
  });

  /** What the hour rail shows — the selected day only. */
  readonly dayInstances = computed(() => {
    const key = localDayKey(this.selectedDay());
    return this.visibleInstances().filter(
      (instance) => localDayKey(new Date(instance.startAt)) === key,
    );
  });

  /**
   * Grouped by calendar day. The store returns a flat, time-sorted window; the
   * day headers and per-day counts are derived here rather than asked for.
   */
  readonly days = computed<AgendaDay[]>(() => {
    const byDay = new Map<string, SessionInstance[]>();

    for (const instance of this.visibleInstances()) {
      const date = new Date(instance.startAt);
      const key = localDayKey(date);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(instance);
      else byDay.set(key, [instance]);
    }

    const todayKey = localDayKey(new Date());

    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, instances]) => ({
        key,
        label: sessionDayLabel(new Date(instances[0].startAt)),
        isToday: key === todayKey,
        instances: instances.sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        ),
        conflicts: instances.filter((i) => (i.conflictingInstanceIds?.length ?? 0) > 0)
          .length,
      }));
  });

  /** The seven days of the strip, with a density dot per session. */
  readonly weekDays = computed(() => {
    const start = this.weekStartDate();
    const todayKey = localDayKey(new Date());
    const counts = new Map<string, number>();
    for (const instance of this.visibleInstances()) {
      const key = localDayKey(new Date(instance.startAt));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      const key = localDayKey(date);
      return {
        key,
        initial: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][offset],
        date: date.getDate(),
        // The Date itself, for tapping through to the day rail.
        date_: date,
        isToday: key === todayKey,
        // Three is enough to read as "busy" without the row growing.
        dots: Array.from({ length: Math.min(counts.get(key) ?? 0, 3) }),
      };
    });
  });

  readonly totalThisWindow = computed(() => this.visibleInstances().length);

  readonly conflictCount = computed(
    () =>
      this.visibleInstances().filter((i) => (i.conflictingInstanceIds?.length ?? 0) > 0)
        .length,
  );

  readonly signupCount = computed(() =>
    this.visibleInstances().reduce(
      (sum, i) => sum + i.confirmedCount + i.pendingApprovalCount,
      0,
    ),
  );

  readonly selectedDayKey = computed(() => localDayKey(this.selectedDay()));

  readonly selectedDayLabel = computed(() =>
    this.selectedDay().toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  );

  readonly monthLabel = computed(() =>
    this.selectedDay().toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
  );

  /** Filters hid everything, but the window itself is not empty. */
  readonly isFilteredEmpty = computed(
    () =>
      this.store.rangeInstances().length > 0 && this.visibleInstances().length === 0,
  );

  readonly showSkeleton = computed(
    () => this.store.rangeLoading() && this.store.rangeInstances().length === 0,
  );

  readonly showError = computed(
    () => !!this.store.rangeError() && this.store.rangeInstances().length === 0,
  );

  readonly isEmpty = computed(
    () =>
      !this.store.rangeLoading() &&
      !this.store.rangeError() &&
      this.store.rangeInstances().length === 0,
  );

  /** Chrome is hidden on the true-empty and error screens, but not when a
      filter is what emptied the list — you need the controls to undo it. */
  readonly showChrome = computed(() => !this.isEmpty() && !this.showError());

  open(instance: SessionInstance): void {
    void this._router.navigate(['/tabs/sessions', instance.id]);
  }

  openCreate(): void {
    this.createStart.set(null);
    this.createOpen.set(true);
  }

  /**
   * Tapping an empty hour opens the form pre-filled for that slot.
   *
   * No confirmation step: the sheet is the confirmation — nothing is created
   * until Create is pressed, and a mis-tap is dismissed by swiping it away.
   */
  createAt(hour: number): void {
    const start = new Date(this.selectedDay());
    start.setHours(hour, 0, 0, 0);
    this.createStart.set(start);
    this.createOpen.set(true);
  }

  openFilters(): void {
    this.filterOpen.set(true);
  }

  openMonth(): void {
    this.monthOpen.set(true);
  }

  onFiltersApplied(filters: AgendaFilters): void {
    this.filters.set(filters);
  }

  clearFilters(): void {
    this.filters.set({ ...NO_FILTERS });
  }

  setView(value: string | number | undefined): void {
    if (value === 'agenda' || value === 'day') this.view.set(value);
  }

  pickDay(date: Date): void {
    this.selectedDay.set(startOfDay(date));
    this.view.set('day');
  }

  /** Jumping outside the loaded window has to widen it before dots appear. */
  onMonthChanged(month: Date): void {
    const monthStart = startOfDay(month);
    const monthEnd = endOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const start = monthStart < this._windowStart() ? monthStart : this._windowStart();
    const end = monthEnd > this._windowEnd() ? monthEnd : this._windowEnd();
    if (start.getTime() === this._windowStart().getTime() &&
        end.getTime() === this._windowEnd().getTime()) {
      return;
    }
    this._loadWindow(start, end);
  }

  goToday(): void {
    const today = startOfDay(new Date());
    this.selectedDay.set(today);
  }

  /**
   * Long-press a row for the verbs that would otherwise need the detail screen.
   *
   * Only actions with an endpoint behind them: the design also lists check-in,
   * which nothing implements, and duplicate, which would need the create sheet
   * pre-filled rather than a one-tap copy.
   */
  async openQuickActions(instance: SessionInstance): Promise<void> {
    const title = instance.titleOverride ?? instance.template?.title ?? 'Session';
    const signups = instance.confirmedCount + instance.pendingApprovalCount;

    const sheet = await this._actionSheetController.create({
      header: title,
      buttons: [
        { text: 'Open session', data: 'open' },
        ...(signups > 0
          ? [{ text: `Message ${signups} ${signups === 1 ? 'signup' : 'signups'}`, data: 'message' }]
          : []),
        { text: 'Cancel session…', role: 'destructive', data: 'cancel' },
        { text: 'Close', role: 'cancel' },
      ],
    });

    await sheet.present();
    const { data } = await sheet.onDidDismiss<string>();

    if (data === 'open' || data === 'cancel') {
      // Cancelling lives on the detail screen, which owns the series context
      // the cancel sheet needs.
      this.open(instance);
      return;
    }
    if (data === 'message') {
      this.messageInstanceId.set(instance.id);
      this.messageOpen.set(true);
    }
  }

  /** A new session may land outside the cached window, so refetch rather than patch. */
  onCreated(): void {
    this._load({ force: true });
  }

  onRefresh(event: RefresherCustomEvent): void {
    this._load({ force: true });
    // `loadRange` exposes no completion callback; close on the loading signal
    // settling rather than leaving the spinner up.
    const started = Date.now();
    const poll = setInterval(() => {
      if (!this.store.rangeLoading() || Date.now() - started > 8000) {
        clearInterval(poll);
        void event.target.complete();
      }
    }, 150);
  }

  retry(): void {
    this._load({ force: true });
  }

  private readonly _windowEnd = signal(
    endOfDay(new Date(Date.now() + AGENDA_DAYS_AHEAD * 24 * 60 * 60 * 1000)),
  );

  private _load(opts: { force?: boolean } = {}): void {
    this._loadWindow(this._windowStart(), this._windowEnd(), opts);
  }

  private _loadWindow(start: Date, end: Date, opts: { force?: boolean } = {}): void {
    this._windowStart.set(start);
    this._windowEnd.set(end);
    this.store.loadRange({ start, end }, opts);
  }
}

