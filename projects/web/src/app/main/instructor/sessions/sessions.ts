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
import {
  KpiCard,
  PageShell,
  SectionLabel,
  SessionCard,
  SessionsInstructorStore,
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions.html',
  styleUrl: './sessions.scss',
  providers: [MessageService],
})
export class Sessions implements OnInit, OnDestroy {
  protected readonly store = inject(SessionsInstructorStore);
  private readonly _router = inject(Router);
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

  // ─── Day-grouped cards: group templates by their next instance's date ──

  protected readonly groupedByDay = computed(() => {
    const templates = this.store.templates();
    const groups = new Map<string, { date: Date; items: SessionTemplate[] }>();

    for (const t of templates) {
      const next = this.store.nextInstanceFor(t.id);
      // Hide one-off templates from Upcoming when there's no scheduled
      // next instance (it was cancelled, or already happened). The BE
      // keeps the template ACTIVE — we filter on the FE so the tab
      // matches the user's mental model ("Upcoming = something I can
      // attend or run").
      if (this.store.tab() === 'active' && !next && !t.isRecurring) {
        continue;
      }
      const ref = next ? new Date(next.startAt) : new Date(t.firstStartAt);
      const dayKey = ref.toISOString().slice(0, 10);
      if (!groups.has(dayKey)) {
        groups.set(dayKey, { date: ref, items: [] });
      }
      groups.get(dayKey)!.items.push(t);
    }

    return Array.from(groups.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  });

  protected sectionLabel(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    if (diffDays === 0) {
      return `Today · ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
    }
    if (diffDays === 1) {
      return `Tomorrow · ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
    }
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

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

  /**
   * Cancelled tab: each card represents a SessionInstance (not template).
   * Route straight to /coaching/sessions/:instanceId so the user can see
   * the cancelled detail (cancel reason, who was notified, etc.).
   */
  protected openCancelledInstance(instanceId: string): void {
    void this._router.navigate(['/coaching/sessions', instanceId]);
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
}
