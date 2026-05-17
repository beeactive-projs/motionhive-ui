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
  CalendarEvent,
  CalendarGrid,
  CalendarRange,
  CalendarView,
  CreateTemplateRequest,
  MiniMonth,
  PageShell,
  SessionInstance,
  SessionsInstructorStore,
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

  // ─── Lifecycle ────────────────────────────────────────────────────

  ngOnInit(): void {
    // On phones, default to Day view — the 7-column Week grid forces
    // ~40px per column, which truncates titles to 1-2 chars. Day is
    // narrower (single column) and reads cleanly.
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      this.view.set('day');
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
