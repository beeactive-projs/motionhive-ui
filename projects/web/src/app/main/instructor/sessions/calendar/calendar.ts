import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import {
  BottomSheet,
  CalendarEvent,
  CalendarGrid,
  CalendarRange,
  CalendarView,
  CreateTemplateRequest,
  DaySeparator,
  MiniMonth,
  MobileFab,
  PageShell,
  SessionInstance,
  SessionTemplate,
  SessionsInstructorStore,
  TimeRow,
  WeekStrip,
  WeekStripDot,
  dayTone,
  formatSessionDuration,
  formatSessionTime,
  injectIsMobile,
  sessionDayLabel,
  sessionTone,
} from 'core';
import { instanceToCalendarEvent } from './mappers';
import { QuickCreatePopover } from './quick-create-popover';
import {
  CalendarFilters,
  DEFAULT_CALENDAR_FILTERS,
  WeekFiltersPanel,
} from './week-filters-panel';
import {
  SessionFormDialog,
  type SessionForm,
} from '../_dialogs/session-form-dialog/session-form-dialog';

/**
 * Smart wrapper for the sessions calendar.
 *
 * Responsibilities (per `SESSIONS_FRONTEND_BUILD_PLAN.md` §5):
 *   1. Own `SessionsInstructorStore` for the calendar's range cache.
 *   2. Map `SessionInstance` → `CalendarEvent` via `instanceToCalendarEvent()`.
 *   3. Apply the left-rail filters (type / online / in-person / conflicts).
 *   4. Wire `mh-calendar-grid`'s outputs:
 *        - `(cellDrag)` → open `QuickCreatePopover` (Shift+drag → full form)
 *        - `(eventClick)` → navigate to /coaching/sessions/:id (Phase D)
 *        - `(rangeChange)` → call store.loadRange()
 *
 * The grid itself stays domain-agnostic; everything session-shaped
 * lives here.
 */
@Component({
  selector: 'mh-sessions-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    MessageModule,
    SkeletonModule,
    ToastModule,
    PageShell,
    CalendarGrid,
    MiniMonth,
    QuickCreatePopover,
    WeekFiltersPanel,
    SessionFormDialog,
    BottomSheet,
    DaySeparator,
    MobileFab,
    TimeRow,
    WeekStrip,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class SessionsCalendar implements OnInit {
  protected readonly store = inject(SessionsInstructorStore);
  private readonly _router = inject(Router);

  protected readonly view = signal<CalendarView>('week');
  protected readonly anchor = signal<Date>(this._weekStart(new Date()));
  protected readonly filters = signal<CalendarFilters>({
    ...DEFAULT_CALENDAR_FILTERS,
    types: { ...DEFAULT_CALENDAR_FILTERS.types },
  });

  // Quick-create popover state.
  protected readonly popover = signal<null | {
    range: { start: Date; end: Date };
    anchor: { x: number; y: number };
  }>(null);

  // Submission flag for the popover button.
  protected readonly submitting = signal<boolean>(false);

  // Full SessionFormDialog state. Quick-create + Shift+drag both hand off
  // to this dialog (pre-filled from the partial popover payload).
  protected readonly formOpen = signal(false);
  protected readonly formPrefill = signal<Partial<SessionForm> | null>(null);

  // ─── Mobile state ────────────────────────────────────────────────
  //
  // Mobile branches into a different shell: 7-day week strip + agenda
  // list. View defaults to 'day' on mobile (set in ngOnInit). The
  // user-facing "view" segment shows Day | Agenda (Week + Month are
  // unusable at phone widths — Month becomes a bottom-sheet
  // navigator instead).
  protected readonly isMobile = injectIsMobile();
  /** Month-picker sheet open state (triggered by "May 2026 ▾"). */
  protected readonly monthSheetOpen = signal(false);

  // ─── Derived state ─────────────────────────────────────────────────

  /** Current range based on view + anchor. */
  protected readonly range = computed<CalendarRange>(() => {
    const a = this.anchor();
    switch (this.view()) {
      case 'day':
        return { start: this._startOfDay(a), end: this._endOfDay(a) };
      case 'week': {
        const start = this._weekStart(a);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return { start, end };
      }
      case 'month': {
        const start = new Date(a.getFullYear(), a.getMonth(), 1);
        const end = new Date(a.getFullYear(), a.getMonth() + 1, 1);
        return { start, end };
      }
    }
  });

  /** Range label e.g. "18 – 24 May 2026". */
  protected readonly rangeLabel = computed(() => {
    const r = this.range();
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    switch (this.view()) {
      case 'day':
        return r.start.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      case 'week': {
        const endDisplay = new Date(r.end);
        endDisplay.setDate(r.end.getDate() - 1);
        return `${r.start.toLocaleDateString('en-GB', opts)} – ${endDisplay.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
      }
      case 'month':
        return r.start.toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        });
    }
  });

  /**
   * Mini-month range highlight bounds. Week view paints the whole Mon-Sun
   * band so the user instantly sees which week the grid is showing.
   * Day/Month view leave the band off — the single-day `is-selected`
   * is enough by itself, and a 31-cell highlight in Month view would be
   * visual noise. Both null disables the band.
   */
  protected readonly miniMonthRangeStart = computed(() =>
    this.view() === 'week' ? this.range().start : null,
  );
  protected readonly miniMonthRangeEnd = computed(() => {
    if (this.view() !== 'week') return null;
    // `range().end` is exclusive (Mon next week). Subtract one day so the
    // band reads as Mon..Sun inclusive — matches the grid header.
    const end = new Date(this.range().end);
    end.setDate(end.getDate() - 1);
    return end;
  });

  /** Events mapped + filter-applied for the grid. */
  protected readonly events = computed<CalendarEvent[]>(() => {
    const f = this.filters();
    return this.store
      .rangeInstances()
      .filter((inst) => this._passesFilters(inst, f))
      .map(instanceToCalendarEvent);
  });

  // ─── Mobile-only derived state ─────────────────────────────────────

  /**
   * The week containing `anchor()`, Monday-start. The mobile week-strip
   * picker renders 7 cells from here. Independent from `range()`
   * because the range tracks the selected *view* (day/week/month) and
   * the week-strip always shows a week regardless.
   */
  protected readonly weekStripStart = computed(() => this._weekStart(this.anchor()));

  /**
   * Dots-per-day map for the week strip. Each session in the current
   * range contributes one dot under its day, colored by its tone
   * (online=teal, 1-on-1=navy, in-person=honey, conflict=coral).
   * Truncated to 4 dots per day by the strip itself.
   */
  protected readonly weekStripDots = computed(() => {
    const f = this.filters();
    const map: Record<string, WeekStripDot[]> = {};
    for (const inst of this.store.rangeInstances()) {
      if (!this._passesFilters(inst, f)) continue;
      if (!inst.template) continue;
      const d = new Date(inst.startAt);
      const iso = this._toISODateLocal(d);
      const tone = sessionTone(inst.template, inst);
      // Strip ignores the 'muted' tone (cancelled rows don't render
      // dots on the navigator — they're past intent, not active).
      if (tone === 'muted') continue;
      (map[iso] ??= []).push({ tone });
    }
    return map;
  });

  /**
   * Agenda groups for the mobile body: instances grouped by local
   * day, sorted ascending. Drives the `<mh-day-separator>` + repeated
   * `<mh-time-row>` rendering.
   */
  protected readonly agendaGroups = computed(() => {
    const f = this.filters();
    const groups = new Map<string, { date: Date; items: SessionInstance[] }>();
    for (const inst of this.store.rangeInstances()) {
      if (!this._passesFilters(inst, f)) continue;
      const d = new Date(inst.startAt);
      const dayKey = this._toISODateLocal(d);
      if (!groups.has(dayKey)) {
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        groups.set(dayKey, { date: dayStart, items: [] });
      }
      groups.get(dayKey)!.items.push(inst);
    }
    return Array.from(groups.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((g) => ({
        ...g,
        items: g.items.sort(
          (a, b) =>
            new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        ),
      }));
  });

  /** "May 2026" label for the mobile month-picker trigger. */
  protected readonly monthLabel = computed(() =>
    this.anchor().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
  );

  /** Template alias — local-zone YYYY-MM-DD for `data-agenda-day`. */
  protected agendaDayKey(d: Date): string {
    return this._toISODateLocal(d);
  }

  // Template-facing aliases for the core/utils format helpers (same
  // pattern as the Sessions list page).
  protected readonly formatTime = formatSessionTime;
  protected readonly formatDuration = formatSessionDuration;
  protected readonly toneFor = sessionTone;
  protected readonly dayTone = dayTone;
  protected readonly dayLabel = sessionDayLabel;

  // ─── Lifecycle ────────────────────────────────────────────────────

  ngOnInit(): void {
    // On phones, default to mobile Agenda mode (the design's 2A
    // primary). We mark `view='week'` because that's the 7-day range
    // the agenda visually represents — the template branch on
    // `inAgenda()` swaps the grid for the agenda list.
    if (this.isMobile()) {
      this.view.set('week');
    }
    this.store.loadRange(this.range());
  }

  // ─── Event handlers ───────────────────────────────────────────────

  protected setView(v: CalendarView): void {
    this.view.set(v);
    this.store.loadRange(this.range());
  }

  protected goToday(): void {
    this.anchor.set(this._weekStart(new Date()));
    this.store.loadRange(this.range());
  }

  protected goPrev(): void {
    const a = this.anchor();
    const delta = this.view() === 'month' ? 0 : this.view() === 'day' ? -1 : -7;
    if (this.view() === 'month') {
      this.anchor.set(new Date(a.getFullYear(), a.getMonth() - 1, 1));
    } else {
      const next = new Date(a);
      next.setDate(a.getDate() + delta);
      this.anchor.set(next);
    }
    this.store.loadRange(this.range());
  }

  protected goNext(): void {
    const a = this.anchor();
    const delta = this.view() === 'month' ? 0 : this.view() === 'day' ? 1 : 7;
    if (this.view() === 'month') {
      this.anchor.set(new Date(a.getFullYear(), a.getMonth() + 1, 1));
    } else {
      const next = new Date(a);
      next.setDate(a.getDate() + delta);
      this.anchor.set(next);
    }
    this.store.loadRange(this.range());
  }

  protected onMiniMonthSelect(date: Date): void {
    this.anchor.set(date);
    this.store.loadRange(this.range());
  }

  /**
   * Mobile week-strip day tap. Two behaviors depending on view:
   *   - In Day mode: re-anchor (range shifts to that day) + load.
   *   - In Agenda mode: re-anchor for visual selection, then scroll
   *     the day-separator that matches this date into view. Loading
   *     isn't strictly needed because the week is already in the
   *     range, but we update the anchor so the strip selection is
   *     consistent.
   */
  protected onWeekStripSelect(date: Date): void {
    this.anchor.set(date);
    if (!this.inAgenda()) {
      this.store.loadRange(this.range());
      return;
    }
    // Defer scroll until Angular re-renders with the new anchor +
    // selection state. setTimeout 0 puts us after the next CD tick.
    setTimeout(() => {
      const iso = this._toISODateLocal(date);
      const el = document.querySelector<HTMLElement>(
        `[data-agenda-day="${iso}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

  protected onRangeChange(range: CalendarRange): void {
    // The grid emits this when it internally advances (rare — most
    // navigation comes through toolbar/minimonth).
    this.anchor.set(range.start);
    this.store.loadRange(range);
  }

  protected onFiltersChange(next: CalendarFilters): void {
    this.filters.set(next);
  }

  protected onEventClick(event: CalendarEvent): void {
    const inst = event.payload as SessionInstance | undefined;
    if (!inst) return;
    void this._router.navigate(['/coaching/sessions', inst.id]);
  }

  /**
   * Click on an empty hour-cell: open the full session form pre-filled
   * with the clicked date + start hour (1h default duration). Users
   * shouldn't have to re-pick the slot they just clicked.
   */
  protected onCellClick(payload: { date: Date; hour: number }): void {
    const start = new Date(payload.date);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    this._openFormForRange(start, end);
  }

  /**
   * Calendar "+N more" pill — switch to Day view focused on the clicked
   * day so the user can see the overflow events in single-column.
   */
  protected onOverflowClick(day: Date): void {
    this.anchor.set(day);
    this.setView('day');
  }

  protected onCellDrag(payload: {
    start: Date;
    end: Date;
    shiftKey: boolean;
    clientX: number;
    clientY: number;
  }): void {
    if (payload.shiftKey) {
      // Shift+drag jumps straight to the full form, pre-filled with the
      // dragged time range.
      this._openFormForRange(payload.start, payload.end);
      return;
    }
    // AUDIT FIX (Phase C Bug 5): anchor the popover near the cursor's
    // release point — earlier I hardcoded (200, 200). Keep on-screen
    // by clamping against viewport edges. Width 320 / height ~280
    // matches the .mh-qcp CSS.
    const POPOVER_WIDTH = 320;
    const POPOVER_HEIGHT = 280;
    const GUTTER = 16;
    const x = Math.min(
      payload.clientX + 8,
      window.innerWidth - POPOVER_WIDTH - GUTTER,
    );
    const y = Math.min(
      payload.clientY + 8,
      window.innerHeight - POPOVER_HEIGHT - GUTTER,
    );
    this.popover.set({
      range: { start: payload.start, end: payload.end },
      anchor: { x: Math.max(GUTTER, x), y: Math.max(GUTTER, y) },
    });
  }

  protected onPopoverDismiss(): void {
    this.popover.set(null);
  }

  protected onNewSession(): void {
    // "New session" toolbar button: open the empty full form, no prefill.
    this.formPrefill.set(null);
    this.formOpen.set(true);
  }

  protected onPopoverSubmit(payload: CreateTemplateRequest): void {
    // Quick-create can't capture all the BE-required fields (meeting URL,
    // venue) — close the popover and open the full form pre-filled.
    this.popover.set(null);
    this.formPrefill.set(this._toPrefill(payload));
    this.formOpen.set(true);
  }

  protected onSessionSaved(): void {
    this.formOpen.set(false);
    this.formPrefill.set(null);
    this.store.loadRange(this.range());
  }

  // ─── Mobile handlers ──────────────────────────────────────────────

  /** Mobile view segment toggle — only 'day' or 'agenda' on phones. */
  protected setMobileView(v: 'day' | 'agenda'): void {
    if (v === 'day') {
      this.view.set('day');
      this.store.loadRange(this.range());
    } else {
      // Agenda mode uses the existing `week` range (Mon..Sun) so we
      // load 7 days of instances at a time. The grid component isn't
      // rendered in agenda mode — the body switches to <mh-time-row>
      // groups directly.
      this.view.set('week');
      this.store.loadRange(this.range());
    }
  }

  /** Is the user currently in mobile-Agenda mode? */
  protected readonly inAgenda = computed(() => this.isMobile() && this.view() === 'week');

  /** Tap "May 2026 ▾" → opens the month-picker sheet (design 2C). */
  protected openMonthSheet(): void {
    this.monthSheetOpen.set(true);
  }

  /**
   * Month sheet picked a day → close the sheet, anchor to that day,
   * and refresh the range. The mini-month's selection is the
   * "navigator" target — we don't change view here, just where the
   * agenda/day grid is centered.
   */
  protected onMonthSheetSelect(date: Date): void {
    this.monthSheetOpen.set(false);
    this.anchor.set(date);
    this.store.loadRange(this.range());
  }

  /** Mobile filter pills — single-select; tapping the active one clears. */
  protected toggleMobileLocation(kind: 'ONLINE' | 'IN_PERSON'): void {
    const f = this.filters();
    if (kind === 'ONLINE') {
      // ONLINE active = only online cards visible = !inPerson, online=true.
      const showingOnly = !f.inPerson && f.online;
      this.filters.set({ ...f, inPerson: showingOnly, online: true });
    } else {
      const showingOnly = !f.online && f.inPerson;
      this.filters.set({ ...f, online: showingOnly, inPerson: true });
    }
  }

  protected toggleMobileConflictsOnly(): void {
    const f = this.filters();
    this.filters.set({ ...f, conflictsOnly: !f.conflictsOnly });
  }

  protected clearMobileFilters(): void {
    this.filters.set({
      ...DEFAULT_CALENDAR_FILTERS,
      types: { ...DEFAULT_CALENDAR_FILTERS.types },
    });
  }

  /** Tap a row in the agenda → navigate to the instance detail page. */
  protected onAgendaInstanceClick(inst: SessionInstance): void {
    void this._router.navigate(['/coaching/sessions', inst.id]);
  }

  // ─── Helpers used by the template ─────────────────────────────────

  /** Title to render for an instance row (override wins if set). */
  protected instanceTitle(inst: SessionInstance): string {
    return inst.titleOverride ?? inst.template?.title ?? '(Session)';
  }

  /** Conflict flag for the row's conflict ring. */
  protected hasConflict(inst: SessionInstance): boolean {
    return (inst.conflictingInstanceIds?.length ?? 0) > 0;
  }

  /** Template-facing helper: tone for the row (calls core's sessionTone with safe fallback). */
  protected instanceTone(
    inst: SessionInstance,
  ): 'honey' | 'teal' | 'navy' | 'coral' | 'muted' {
    return inst.template ? sessionTone(inst.template, inst) : 'honey';
  }

  private _openFormForRange(start: Date, end: Date): void {
    const minutes = Math.max(
      5,
      Math.round((end.getTime() - start.getTime()) / 60_000),
    );
    this.formPrefill.set({
      firstStartAt: start,
      durationMinutes: minutes,
    });
    this.formOpen.set(true);
  }

  /** Map the popover's partial `CreateTemplateRequest` to a `SessionForm` prefill. */
  private _toPrefill(p: CreateTemplateRequest): Partial<SessionForm> {
    return {
      title: p.title,
      type: p.type,
      access: p.access,
      locationKind: p.locationKind,
      meetingUrl: p.meetingUrl ?? '',
      firstStartAt: p.firstStartAt ? new Date(p.firstStartAt) : null,
      durationMinutes: p.durationMinutes,
      timezone: p.timezone,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  /** ISO 8601 week start (Monday). */
  private _weekStart(d: Date): Date {
    const out = new Date(d);
    const day = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
    out.setDate(d.getDate() - day);
    out.setHours(0, 0, 0, 0);
    return out;
  }

  private _startOfDay(d: Date): Date {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
  }

  private _endOfDay(d: Date): Date {
    const out = new Date(d);
    out.setHours(23, 59, 59, 999);
    return out;
  }

  /**
   * Local-zone YYYY-MM-DD. Avoid `toISOString().slice(0,10)` which
   * shifts the date in non-UTC zones (e.g. EAT +03:00 midnight rolls
   * back to "yesterday").
   */
  private _toISODateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private _passesFilters(inst: SessionInstance, f: CalendarFilters): boolean {
    const t = inst.template;
    if (!t) return true; // permissive when ref missing
    if (!f.types[t.type]) return false;
    if (t.locationKind === 'ONLINE' && !f.online) return false;
    if (t.locationKind === 'IN_PERSON' && !f.inPerson) return false;
    if (f.conflictsOnly && (inst.conflictingInstanceIds?.length ?? 0) === 0)
      return false;
    return true;
  }
}
