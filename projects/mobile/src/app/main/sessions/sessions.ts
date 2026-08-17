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
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
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
  SessionLocationKind,
  SessionsInstructorStore,
  endOfDay,
  formatSessionTime,
  formatTimeUntil,
  formatTotalDuration,
  localDayKey,
  sessionDayLabel,
  sessionMinutes,
  startOfDay,
  weekStart,
} from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { ClockService } from '../../_shared/services/clock.service';
import { DayRail } from './_components/day-rail/day-rail';
import { SessionRow } from './_components/session-row/session-row';
import { SessionsEmpty } from './_components/sessions-empty/sessions-empty';
import { MessageSignupsSheet } from './_sheets/message-signups-sheet/message-signups-sheet';
import { MonthSheet } from './_sheets/month-sheet/month-sheet';
import { SessionFormSheet } from './_sheets/session-form-sheet/session-form-sheet';
import { SessionFilterSheet } from './_sheets/session-filter-sheet/session-filter-sheet';
import {
  AGENDA_DAYS_AHEAD,
  AgendaFilters,
  DayWindow,
  LOCATION_QUICK_FILTERS,
  NO_FILTERS,
  SESSION_ICONS,
  WEEKDAY_LETTERS,
  activeFilterCount,
  dayFromKey,
  fitWindow,
  instanceTone,
  matchesFilters,
} from './sessions.config';

type LoadOptions = { force?: boolean; done?: () => void };

interface AgendaDay {
  key: string;
  label: string;
  isToday: boolean;
  instances: SessionInstance[];
  conflicts: number;
  /** "next in 18 min" — only ever set on the day holding the soonest session. */
  nextNote: string | null;
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
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    DayRail,
    MessageSignupsSheet,
    MonthSheet,
    NotificationBell,
    SessionFilterSheet,
    SessionFormSheet,
    SessionRow,
    SessionsEmpty,
  ],
  templateUrl: './sessions.html',
  styleUrl: './sessions.scss',
})
export class Sessions implements ViewWillEnter {
  readonly store = inject(SessionsInstructorStore);
  private readonly _router = inject(Router);
  private readonly _actionSheetController = inject(ActionSheetController);
  private readonly _clockService = inject(ClockService);

  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly locationFilters = LOCATION_QUICK_FILTERS;

  readonly createOpen = signal(false);
  /** Seeds the create sheet when it opens from a slot on the day rail. */
  readonly createStart = signal<Date | null>(null);
  readonly filterOpen = signal(false);
  readonly monthOpen = signal(false);
  readonly messageOpen = signal(false);
  readonly messageInstanceId = signal<string | null>(null);

  /**
   * Search owns the whole toolbar while it is open — a title, three actions, a
   * field and two filter rows do not fit above the fold on a phone. Same
   * treatment as the inbox.
   */
  readonly searchOpen = signal(false);
  /**
   * Kept beside the sheet's filters rather than inside them: the "Filters · 2"
   * badge counts what the sheet set, and a query typed in the header should not
   * inflate it.
   */
  readonly query = signal('');

  /** 'agenda' is the day-grouped list; 'day' is the hour rail. */
  readonly view = signal<'agenda' | 'day'>('agenda');

  /** Which day the rail shows, and what the month sheet opens on. */
  readonly selectedDay = signal(startOfDay(new Date()));

  readonly filters = signal<AgendaFilters>({ ...NO_FILTERS });
  readonly filterCount = computed(() => activeFilterCount(this.filters()));

  /**
   * The day the default window is anchored on. A signal rather than a fresh
   * `new Date()` per read, so the required window is stable between visits
   * instead of shifting by a millisecond on every recompute.
   */
  private readonly _today = signal(startOfDay(new Date()));

  /** Which month the month sheet is parked on, once it has moved off today's. */
  private readonly _monthCursor = signal<Date | null>(null);

  /** Set while a load is in flight and the requirement moved underneath it. */
  private _resyncQueued = false;

  /** The bounds of the last request, so an unchanged requirement does not refetch. */
  private readonly _loadedKey = signal<string | null>(null);

  /**
   * What we would like loaded: the default span ahead, plus wherever the month
   * sheet and the date filter are pointing.
   *
   * The most specific request wins the anchor and the rest are merely nice to
   * have, because the API rejects anything wider than 180 days — see
   * `fitWindow`. Widening-only was the old rule and it eventually 400'd.
   */
  private readonly _requiredWindow = computed<DayWindow>(() => {
    const today = this._today();
    const base: DayWindow = {
      start: today,
      end: endOfDay(new Date(today.getTime() + AGENDA_DAYS_AHEAD * 86_400_000)),
    };

    const { dateFrom, dateTo } = this.filters();
    const dateRange: DayWindow | null =
      dateFrom || dateTo
        ? {
            start: dateFrom ? dayFromKey(dateFrom) : base.start,
            end: dateTo ? endOfDay(dayFromKey(dateTo)) : base.end,
          }
        : null;

    const cursor = this._monthCursor();
    const monthRange: DayWindow | null = cursor
      ? {
          start: startOfDay(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
          end: endOfDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
        }
      : null;

    const anchor = dateRange ?? monthRange ?? base;
    const extras = [dateRange, monthRange, base].filter(
      (window): window is DayWindow => window !== null && window !== anchor,
    );

    return fitWindow(anchor, extras);
  });

  /** The Monday of the week the strip is showing. */
  readonly weekStartDate = computed(() => weekStart(this.selectedDay()));

  /** The loaded window, narrowed by the filter sheet and the header search. */
  readonly visibleInstances = computed(() => {
    const filters = this.filters();
    const query = this.query();
    return this.store
      .rangeInstances()
      .filter((instance) => matchesFilters(instance, filters, query));
  });

  /**
   * `loadRange` asks for 100 rows and does not page, so a wide window on a busy
   * coach silently stops short. Fixing that means paging in the store, which
   * web shares — until then the list says so rather than quietly lying.
   */
  readonly truncated = computed(() => this.store.rangeInstances().length >= 100);

  /**
   * The soonest session still ahead of us, and how long until it starts.
   *
   * Read off a pulled clock rather than a timer — see `ClockService`. Null once
   * the next one is more than eight hours out, which is when a countdown stops
   * telling you anything the date on the row does not.
   */
  private readonly _nextUp = computed(() => {
    const now = this._clockService.now();
    const next = this.visibleInstances().find(
      (instance) => new Date(instance.startAt).getTime() > now,
    );
    if (!next) return null;
    const note = formatTimeUntil(next.startAt, now);
    return note ? { key: localDayKey(new Date(next.startAt)), note } : null;
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
    const nextUp = this._nextUp();

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
        nextNote: nextUp?.key === key ? nextUp.note : null,
      }));
  });

  /**
   * The seven days of the strip, each with up to three dots keyed to what is
   * scheduled — teal for online, navy for a 1-on-1, coral for a clash.
   *
   * Tone, not a single colour: honey is the brand's action colour, so painting
   * every dot with it would use the accent to say "busy", which is a status.
   */
  readonly weekDays = computed(() => {
    const start = this.weekStartDate();
    const todayKey = localDayKey(new Date());

    const tones = new Map<string, string[]>();
    for (const instance of this.visibleInstances()) {
      const key = localDayKey(new Date(instance.startAt));
      const existing = tones.get(key) ?? [];
      // Three is enough to read as "busy" without the row growing.
      if (existing.length >= 3) continue;
      existing.push(instanceTone(instance));
      tones.set(key, existing);
    }

    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      const key = localDayKey(date);
      return {
        key,
        initial: WEEKDAY_LETTERS[offset],
        dayOfMonth: date.getDate(),
        date,
        isToday: key === todayKey,
        dots: tones.get(key) ?? [],
      };
    });
  });

  /**
   * The week the strip is showing — which is what the summary line counts.
   *
   * Scoped to the week rather than the whole loaded window because the line
   * says "this week" and sits directly above the strip; counting 30 days there
   * would label a number that nothing on screen accounts for.
   */
  private readonly _weekInstances = computed(() => {
    const start = this.weekStartDate().getTime();
    const end = start + 7 * 86_400_000;
    return this.visibleInstances().filter((instance) => {
      const at = new Date(instance.startAt).getTime();
      return at >= start && at < end;
    });
  });

  readonly weekCount = computed(() => this._weekInstances().length);

  readonly conflictCount = computed(
    () =>
      this._weekInstances().filter((i) => (i.conflictingInstanceIds?.length ?? 0) > 0)
        .length,
  );

  readonly signupCount = computed(() =>
    this._weekInstances().reduce(
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

  /** "5 sessions · 6h scheduled" — the day view's right-hand summary. */
  readonly dayTotalLabel = computed(() => {
    const instances = this.dayInstances();
    const count = `${instances.length} ${instances.length === 1 ? 'session' : 'sessions'}`;
    const minutes = instances.reduce((sum, i) => sum + sessionMinutes(i), 0);
    return minutes > 0 ? `${count} · ${formatTotalDuration(minutes)} scheduled` : count;
  });

  /** "1 conflict at 17:00" — the day view's left-hand warning, or null. */
  readonly dayConflictLabel = computed(() => {
    const clashing = this.dayInstances().filter(
      (i) => (i.conflictingInstanceIds?.length ?? 0) > 0,
    );
    if (clashing.length === 0) return null;
    const noun = clashing.length === 1 ? 'conflict' : 'conflicts';
    return `${clashing.length} ${noun} at ${formatSessionTime(clashing[0].startAt)}`;
  });

  /** Filters or a search hid everything, but the window itself is not empty. */
  readonly isFilteredEmpty = computed(
    () =>
      this.store.rangeInstances().length > 0 && this.visibleInstances().length === 0,
  );

  readonly showSkeleton = computed(
    () => this.store.rangeLoading() && this.store.rangeInstances().length === 0,
  );

  readonly showLoadError = computed(
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
  readonly showChrome = computed(() => !this.isEmpty() && !this.showLoadError());

  constructor() {
    addIcons(SESSION_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page alive in the tab stack, so that would
  // run once per app session. The store caches the window.
  ionViewWillEnter(): void {
    // Before the load, so a cached window still renders a fresh countdown.
    this._clockService.bump();
    // Re-anchored here rather than at construction: the page lives in the tab
    // stack, so a session left open overnight would otherwise keep asking for
    // a window starting yesterday.
    this._today.set(startOfDay(new Date()));
    this._syncWindow();
  }

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

  openSearch(): void {
    this.searchOpen.set(true);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.query.set('');
  }

  openFilters(): void {
    this.filterOpen.set(true);
  }

  openMonth(): void {
    this.monthOpen.set(true);
  }

  /** A date filter can point outside the loaded window, so the window follows. */
  onFiltersApplied(filters: AgendaFilters): void {
    this.filters.set(filters);
    this._syncWindow();
  }

  clearFilters(): void {
    this.filters.set({ ...NO_FILTERS });
    this.query.set('');
    this._syncWindow();
  }

  /** The quick chips under the strip write straight through to the sheet's state. */
  setLocation(kind: SessionLocationKind | null): void {
    this.filters.update((filters) => ({ ...filters, locationKind: kind }));
  }

  setView(value: string | number | undefined): void {
    if (value === 'agenda' || value === 'day') this.view.set(value);
  }

  showAgenda(): void {
    this.view.set('agenda');
  }

  pickDay(date: Date): void {
    this.selectedDay.set(startOfDay(date));
    this.view.set('day');
  }

  /** Jumping outside the loaded window has to load it before dots appear. */
  onMonthChanged(month: Date): void {
    this._monthCursor.set(startOfDay(month));
    this._syncWindow();
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
    this._syncWindow({ force: true });
  }

  onRefresh(event: RefresherCustomEvent): void {
    this._clockService.bump();
    this._syncWindow({ force: true, done: () => void event.target.complete() });
  }

  retry(): void {
    this._syncWindow({ force: true });
  }

  /**
   * Load whatever `_requiredWindow` now says, if that is not what is already
   * loaded.
   *
   * `loadRange` drops any call arriving while one is in flight — it fires
   * `done` and returns — so a filter applied mid-load would otherwise be lost
   * with nothing to show for it. Queue it and re-run from the completion
   * callback instead. Re-running recomputes the requirement rather than
   * replaying a stale one, so several changes during one load collapse into a
   * single follow-up request.
   */
  private _syncWindow(opts: LoadOptions = {}): void {
    const target = this._requiredWindow();
    const key = `${target.start.getTime()}-${target.end.getTime()}`;

    if (!opts.force && key === this._loadedKey()) {
      opts.done?.();
      return;
    }

    if (this.store.rangeLoading()) {
      this._resyncQueued = true;
      opts.done?.();
      return;
    }

    this._loadedKey.set(key);
    this.store.loadRange(target, {
      force: opts.force,
      done: () => {
        opts.done?.();
        if (!this._resyncQueued) return;
        this._resyncQueued = false;
        this._syncWindow();
      },
    });
  }
}
