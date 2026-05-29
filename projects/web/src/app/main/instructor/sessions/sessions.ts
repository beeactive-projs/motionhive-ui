import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import {
  ActionItem,
  ActionList,
  AuthStore,
  BottomSheet,
  DaySeparator,
  KpiCard,
  MobileFab,
  PageShell,
  SectionLabel,
  SessionCard,
  SessionKind,
  SessionLocationKind,
  SessionsInstructorStore,
  TimeRow,
  TimeRowSkeleton,
  dayTone,
  formatSessionDuration,
  formatSessionTime,
  injectIsMobile,
  sessionDayLabel,
  sessionTone,
  type SessionInstance,
  type SessionTemplate,
  type TemplateTab,
} from 'core';
import { SessionFormDialog } from './_dialogs/session-form-dialog/session-form-dialog';

interface TabSpec {
  key: TemplateTab;
  label: string;
}

const TABS: TabSpec[] = [
  { key: 'active', label: 'Upcoming' },
  { key: 'recurring', label: 'Recurring templates' },
  { key: 'ended', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
];

@Component({
  selector: 'mh-instructor-sessions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    SkeletonModule,
    MessageModule,
    PageShell,
    KpiCard,
    SectionLabel,
    SessionCard,
    SessionFormDialog,
    ToastModule,
    TooltipModule,
    ActionList,
    BottomSheet,
    DaySeparator,
    MobileFab,
    TimeRow,
    TimeRowSkeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions.html',
  styleUrl: './sessions.scss',
  providers: [MessageService],
})
export class Sessions implements OnInit, OnDestroy {
  protected readonly store = inject(SessionsInstructorStore);
  private readonly _router = inject(Router);
  private readonly _auth = inject(AuthStore);

  /** Handle on the logged-in instructor, used to drive the "Public profile" button. */
  protected readonly handle = computed(() => this._auth.user()?.handle ?? null);
  private readonly _destroyRef = inject(DestroyRef);

  // Infinite scroll: a sentinel at the end of the list pulls the next page on intersection.
  private readonly _scrollSentinel =
    viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private _observer?: IntersectionObserver;

  protected readonly tabs = TABS;
  // The view signal stays here even though the only real value is
  // 'cards' — the segmented control needs something to bind to for the
  // pressed state. 'calendar' is a navigation event, not a state.
  protected readonly view = signal<'cards'>('cards');
  protected readonly searchInput = signal<string>('');
  protected searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Create / edit dialog state. `editingTemplate` null = create mode.
  protected readonly formOpen = signal(false);
  protected readonly editingTemplate = signal<SessionTemplate | null>(null);

  // ─── Mobile state ──────────────────────────────────────────────────
  protected readonly isMobile = injectIsMobile();
  protected readonly filterSheetOpen = signal(false);
  /** When non-null, an action sheet shows for this template row. */
  protected readonly actionSheetTemplate = signal<SessionTemplate | null>(null);

  /** How many quick filters are currently applied (type + location). */
  protected readonly appliedFilterCount = computed(() => {
    const f = this.store.filters();
    let n = 0;
    if (f.type) n++;
    if (f.locationKind) n++;
    return n;
  });

  /**
   * Header label for the Cancelled tab. The BE caps per-request at 100
   * instances; when we hit the cap we want the user to understand the
   * displayed list is a window, not the total ("100+" suffix). Reads
   * the server-reported total via `cancelledTotal()`.
   */
  protected readonly cancelledLabel = computed(() => {
    const total = this.store.cancelledTotal();
    const items = this.store.cancelledInstances().length;
    const isCap = items >= 100 && total >= 100;
    return isCap ? '100+ cancelled (showing latest 100)' : `${total} cancelled`;
  });

  constructor() {
    effect(() => {
      const el = this._scrollSentinel()?.nativeElement;
      this._observer?.disconnect();
      if (!el) return;
      this._observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            this.store.loadMore();
          }
        },
        { threshold: 0.1 },
      );
      this._observer.observe(el);
    });
    this._destroyRef.onDestroy(() => this._observer?.disconnect());
  }

  ngOnInit(): void {
    this.store.reload();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  // ─── Day-grouped cards ──────────────────────────────────────────
  //
  // Two grouping strategies, picked by tab:
  //
  // (1) Upcoming tab uses `upcomingInstancesByDay`: instances grouped
  //     by their `startAt` day. Bypasses the BE templates pagination
  //     (which sorts firstStartAt DESC and puts long-running fixtures
  //     on top of what's actually happening this week).
  //
  // (2) Recurring / Past tabs use `groupedByDay`: templates grouped
  //     by their next instance when available, else firstStartAt.
  //     For these tabs the question is "show me my templates", not
  //     "show me what's coming next chronologically".
  protected readonly upcomingInstancesByDay = computed(() => {
    const insts = this.store.upcomingInstances();
    const groups = new Map<string, { date: Date; items: SessionInstance[] }>();
    for (const inst of insts) {
      const d = new Date(inst.startAt);
      const dayKey = this._toISODateLocal(d);
      if (!groups.has(dayKey)) {
        const day = new Date(d);
        day.setHours(0, 0, 0, 0);
        groups.set(dayKey, { date: day, items: [] });
      }
      groups.get(dayKey)!.items.push(inst);
    }
    return Array.from(groups.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  });

  protected readonly groupedByDay = computed(() => {
    const templates = this.store.templates();
    const groups = new Map<string, { date: Date; items: SessionTemplate[] }>();

    for (const t of templates) {
      const next = this.store.nextInstanceFor(t.id);
      const ref = next ? new Date(next.startAt) : new Date(t.firstStartAt);
      const dayKey = this._toISODateLocal(ref);
      if (!groups.has(dayKey)) {
        const day = new Date(ref);
        day.setHours(0, 0, 0, 0);
        groups.set(dayKey, { date: day, items: [] });
      }
      groups.get(dayKey)!.items.push(t);
    }

    return Array.from(groups.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  });

  /**
   * Local-zone YYYY-MM-DD. Using `toISOString().slice(0,10)` shifts the
   * date in non-UTC timezones (e.g. EAT +03:00, 00:30 local rolls back
   * to "yesterday" via UTC). All grouping keys use local time so the
   * "Today" label means the user's today.
   */
  private _toISODateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Thin shims so the template keeps calling `sectionLabel(...)` etc.
  // The actual logic lives in core/utils/session-format.utils so the
  // calendar agenda (and future surfaces) can share it.
  protected readonly sectionLabel = sessionDayLabel;

  // ─── Project the template + its next instance into a card-friendly shape ──

  // Stable references: returning a fresh placeholder per CD tick triggers
  // OnPush re-renders all the way down the SessionCard subtree. Cache by
  // templateId so the same object identity is returned until it's evicted.
  private readonly _placeholders = new Map<string, SessionInstance>();

  protected cardInstanceFor(t: SessionTemplate): SessionInstance {
    const next = this.store.nextInstanceFor(t.id);
    if (next) return { ...next, template: t };
    const cached = this._placeholders.get(t.id);
    if (cached) return cached;
    const placeholder: SessionInstance = {
      id: `placeholder-${t.id}`,
      templateId: t.id,
      instructorId: t.instructorId,
      occurrenceIndex: 0,
      startAt: t.firstStartAt,
      endAt: new Date(
        new Date(t.firstStartAt).getTime() + t.durationMinutes * 60_000,
      ).toISOString(),
      titleOverride: null,
      descriptionOverride: null,
      venueIdOverride: null,
      meetingUrlOverride: null,
      capacityOverride: null,
      isOverride: false,
      status: 'SCHEDULED',
      cancelReason: null,
      cancelledAt: null,
      confirmedCount: 0,
      pendingApprovalCount: 0,
      waitlistedCount: 0,
      attendedCount: null,
      conflictingInstanceIds: null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      template: t,
    };
    this._placeholders.set(t.id, placeholder);
    return placeholder;
  }

  // ─── Event handlers ────────────────────────────────────────────────

  protected onSearchInput(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.store.setFilters({ q: value.trim() || undefined });
    }, 200);
  }

  protected onTabChange(tab: TemplateTab): void {
    this.store.setTab(tab);
  }

  /** Toggle a location pill — click the active one again to clear. */
  protected toggleLocation(kind: 'IN_PERSON' | 'ONLINE'): void {
    const current = this.store.filters().locationKind;
    this.store.setFilters({
      locationKind: current === kind ? undefined : (kind as SessionLocationKind),
    });
  }

  /** Toggle a type pill — click the active one again to clear. */
  protected toggleType(type: 'GROUP' | 'PRIVATE' | 'OPEN'): void {
    const current = this.store.filters().type;
    this.store.setFilters({
      type: current === type ? undefined : (type as SessionKind),
    });
  }

  /** Drop all quick filters (the "All" pill). Search input is left intact. */
  protected clearQuickFilters(): void {
    this.store.setFilters({ locationKind: undefined, type: undefined });
  }

  /**
   * Cancelled tab: each card represents a SessionInstance (not template).
   * Route straight to /coaching/sessions/:instanceId so the user can see
   * the cancelled detail (cancel reason, who was notified, etc.).
   */
  protected openCancelledInstance(instanceId: string): void {
    void this._router.navigate(['/coaching/sessions', instanceId]);
  }

  /**
   * Tap-through on an Upcoming agenda row. The row represents a
   * specific session occurrence (SessionInstance), so we navigate
   * directly to the instance detail page. Recurring templates with
   * no current instance fall back to the template-detail view —
   * but in Upcoming we always have an instance per row.
   */
  protected onInstanceOpen(inst: SessionInstance): void {
    void this._router.navigate(['/coaching/sessions', inst.id]);
  }

  protected onCardOpen(templateId: string): void {
    // Navigate to the right detail page based on template kind:
    //   - recurring → template-detail (shows the series + all occurrences)
    //   - one-off   → directly to the single instance detail page
    // For non-recurring with a known next instance, prefer the instance
    // route (deep-linkable + matches the calendar/event click target).
    const tpl = this.store.templates().find((t) => t.id === templateId);
    if (tpl?.isRecurring) {
      void this._router.navigate(['/coaching/sessions/templates', templateId]);
      return;
    }
    const nextInst = this.store.nextInstanceFor(templateId);
    if (nextInst) {
      void this._router.navigate(['/coaching/sessions', nextInst.id]);
      return;
    }
    // Fallback: template detail (works for both one-off and recurring;
    // surfaces edit even when no upcoming instance exists yet).
    void this._router.navigate(['/coaching/sessions/templates', templateId]);
  }

  protected onCreateNew(): void {
    this.editingTemplate.set(null);
    this.formOpen.set(true);
  }

  protected onSessionSaved(): void {
    this.formOpen.set(false);
    this.editingTemplate.set(null);
    this.store.reload();
  }

  protected retry(): void {
    this.store.reload();
  }

  /**
   * Open the instructor's own public profile (`/@<handle>`) in a new tab —
   * it's a preview of how the world sees their sessions. New tab so we
   * don't lose the instructor's place in the management UI.
   */
  protected openPublicProfile(): void {
    const h = this.handle();
    if (!h) return;
    window.open(`/@${h}`, '_blank', 'noopener');
  }

  /**
   * View toggle: 'cards' stays on the list page. 'calendar' navigates
   * to the dedicated calendar route — they're separate pages, not
   * just a local visual swap.
   */
  protected setView(v: 'cards' | 'calendar'): void {
    if (v === 'calendar') {
      void this._router.navigate(['/coaching/sessions/calendar']);
      return;
    }
    this.view.set('cards');
  }

  // Template-facing aliases for the pure helpers in core/utils. Keeps
  // the HTML readable (`formatTime(iso)` instead of
  // `formatSessionTime(iso)`) without duplicating the implementation.
  protected readonly formatTime = formatSessionTime;
  protected readonly formatDuration = formatSessionDuration;
  protected readonly toneFor = sessionTone;
  protected readonly dayTone = dayTone;

  /** Open the action sheet for a long-pressed (or ⋮-tapped) row. */
  protected openActions(t: SessionTemplate): void {
    this.actionSheetTemplate.set(t);
  }

  protected closeActions(): void {
    this.actionSheetTemplate.set(null);
  }

  /**
   * Action-sheet rows for a session card (frame 1C). Static — every
   * row has the same verbs in the same order. The `(select)` handler
   * switches on `id` to dispatch the right effect against the
   * template captured in `actionSheetTemplate`. Stubbed rows
   * (duplicate, share) close the sheet but don't act yet — the BE
   * surfaces aren't wired.
   */
  protected readonly rowActions: ActionItem[] = [
    { id: 'open', icon: 'pi pi-external-link', label: 'Open session' },
    { id: 'edit', icon: 'pi pi-pencil', label: 'Edit' },
    { id: 'message', icon: 'pi pi-send', label: 'Message all signups' },
    { id: 'duplicate', icon: 'pi pi-copy', label: 'Duplicate' },
    { id: 'share', icon: 'pi pi-share-alt', label: 'Share public link' },
    { id: 'cancel', icon: 'pi pi-times', label: 'Cancel session…', danger: true },
  ];

  protected onRowAction(item: ActionItem, t: SessionTemplate): void {
    this.closeActions();
    switch (item.id) {
      case 'open':
        this.onCardOpen(t.id);
        break;
      case 'edit':
        this.editingTemplate.set(t);
        this.formOpen.set(true);
        break;
      // The remaining verbs are visual-only for now — the surfaces
      // they call into either don't exist yet (duplicate, share) or
      // live on the detail page (message, cancel — both surfaced as
      // ⋮-actions in session-detail's own sheet).
      default:
        break;
    }
  }

  /** Reset all quick filters from inside the filter sheet. */
  protected resetSheetFilters(): void {
    this.store.setFilters({ type: undefined, locationKind: undefined });
  }
}
