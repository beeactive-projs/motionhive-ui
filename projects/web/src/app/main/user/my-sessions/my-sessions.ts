import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Popover } from 'primeng/popover';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import {
  MyBookingsIndexStore,
  MyTab,
  SessionKind,
  SessionLocationKind,
  SessionParticipant,
  SessionsMyStore,
  groupSessionsByBucket,
  injectIsMobile,
  injectIsTablet,
  injectIsTabletDown,
} from 'core';
import { DaySeparator } from '../../../_shared/components/day-separator/day-separator';
import { MobileFab } from '../../../_shared/components/mobile-fab/mobile-fab';
import { SectionLabel } from '../../../_shared/components/section-label/section-label';
import { TimeRowSkeleton } from '../../../_shared/components/time-row-skeleton/time-row-skeleton';
import { ListEmptyState } from '../../../_shared/components/list-empty-state/list-empty-state';
import { MySessionRow } from './_components/my-session-row/my-session-row';
import { CancelBookingDialog } from './_dialogs/cancel-booking-dialog/cancel-booking-dialog';
import { Badge } from 'primeng/badge';
import { Divider } from 'primeng/divider';

interface TabSpec {
  key: MyTab;
  label: string;
  icon: string;
  countKey: 'upcoming' | 'pendingApproval' | 'waitlisted' | 'past' | 'cancelled';
}

/** Tabs that may be requested; anything else falls back to Upcoming. */
const VALID_TABS = new Set<string>(Object.values(MyTab));

@Component({
  selector: 'mh-my-sessions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    IconField,
    InputIcon,
    InputTextModule,
    MessageModule,
    ToastModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TimeRowSkeleton,
    SectionLabel,
    DaySeparator,
    MobileFab,
    ListEmptyState,
    MySessionRow,
    CancelBookingDialog,
    Badge,
    Popover,
  ],
  providers: [SessionsMyStore, MessageService],
  templateUrl: './my-sessions.html',
  styleUrl: './my-sessions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySessions implements OnInit {
  protected readonly store = inject(SessionsMyStore);
  private readonly _bookings = inject(MyBookingsIndexStore);
  private readonly _router = inject(Router);

  protected readonly isMobile = injectIsMobile();
  protected readonly isTablet = injectIsTablet();
  protected readonly isTabletDown = injectIsTabletDown();

  // Enum consts exposed for template comparisons — never compare against
  // raw string literals (see CLAUDE.md).
  protected readonly SessionLocationKind = SessionLocationKind;
  protected readonly SessionKind = SessionKind;

  // Cancel-booking dialog state.
  protected readonly cancelOpen = signal(false);
  protected readonly cancelTarget = signal<SessionParticipant | null>(null);

  protected readonly tabs: TabSpec[] = [
    { key: MyTab.Upcoming, label: 'Upcoming', icon: 'pi pi-calendar', countKey: 'upcoming' },
    {
      key: MyTab.PendingApproval,
      label: 'Pending',
      icon: 'pi pi-hourglass',
      countKey: 'pendingApproval',
    },
    { key: MyTab.Waitlisted, label: 'Waitlisted', icon: 'pi pi-clock', countKey: 'waitlisted' },
    { key: MyTab.Past, label: 'Past', icon: 'pi pi-history', countKey: 'past' },
    { key: MyTab.Cancelled, label: 'Cancelled', icon: 'pi pi-times-circle', countKey: 'cancelled' },
  ];

  // ─── Filters (client-side, no extra requests) ─────────────────────
  //
  // The BE's MySessionsQueryDto only takes `tab` + pagination. To mirror
  // the instructor sessions surface we filter the already-loaded
  // participants locally: search by title + a location quick-filter row.
  protected readonly searchInput = signal<string>('');
  protected readonly locationKindFilter = signal<SessionLocationKind | null>(null);
  protected readonly typeFilter = signal<SessionKind | null>(null);

  protected readonly filteredItems = computed(() => {
    const all = this.store.items();
    const q = this.searchInput().trim().toLowerCase();
    const loc = this.locationKindFilter();
    const type = this.typeFilter();
    if (!q && !loc && !type) return all;
    return all.filter((p) => {
      if (loc) {
        const online = this.isOnline(p);
        if (loc === SessionLocationKind.Online && !online) return false;
        if (loc === SessionLocationKind.InPerson && online) return false;
      }
      if (type && this.sessionType(p) !== type) return false;
      if (q && !this.sessionTitle(p).toLowerCase().includes(q)) return false;
      return true;
    });
  });

  /** How many quick filters are applied (type + location) — drives the badge. */
  protected readonly appliedFilterCount = computed(() => {
    let n = 0;
    if (this.typeFilter()) n++;
    if (this.locationKindFilter()) n++;
    return n;
  });

  /**
   * Items bucketed Today / Tomorrow / This week / by month. Upcoming /
   * pending / waitlisted read ascending ("what's next"); past / cancelled
   * read descending (Today / Yesterday / Earlier this week / by month). The
   * row carries its own date inside multi-day buckets.
   */
  protected readonly groupedItems = computed(() => {
    const past = this.store.tab() === MyTab.Past || this.store.tab() === MyTab.Cancelled;
    return groupSessionsByBucket(
      this.filteredItems(),
      (p) => this.startAt(p),
      past ? 'past' : 'future',
    );
  });

  ngOnInit(): void {
    this.store.load();
  }

  protected onSearchInput(value: string): void {
    this.searchInput.set(value);
  }

  protected toggleLocation(kind: SessionLocationKind): void {
    this.locationKindFilter.set(this.locationKindFilter() === kind ? null : kind);
  }

  protected toggleType(type: SessionKind): void {
    this.typeFilter.set(this.typeFilter() === type ? null : type);
  }

  /** Drop the type + location quick filters (the "All" pill). Search is kept. */
  protected clearQuickFilters(): void {
    this.typeFilter.set(null);
    this.locationKindFilter.set(null);
  }

  protected clearFilters(): void {
    this.searchInput.set('');
    this.locationKindFilter.set(null);
    this.typeFilter.set(null);
  }

  protected onTabChange(value: string | number | undefined): void {
    const tab =
      typeof value === 'string' && VALID_TABS.has(value) ? (value as MyTab) : MyTab.Upcoming;
    this.store.setTab(tab);
  }

  protected countFor(spec: TabSpec): number {
    const c = this.store.counts();
    return c ? c[spec.countKey] : 0;
  }

  protected openSession(p: SessionParticipant): void {
    if (p.instanceId) void this._router.navigate(['/user/sessions', p.instanceId]);
  }

  protected goToDiscover(): void {
    void this._router.navigate(['/user/sessions/discover']);
  }

  protected openCancel(p: SessionParticipant, event: MouseEvent): void {
    // Stop the row's (click) handler from also firing navigation.
    event.stopPropagation();
    this.cancelTarget.set(p);
    this.cancelOpen.set(true);
  }

  protected onCancelled(): void {
    this.cancelOpen.set(false);
    this.store.invalidateTab(this.store.tab());
    // Discover + Showcase consult MyBookingsIndexStore — make sure the
    // "Booked" badge/state flips off after a cancel.
    this._bookings.invalidate();
    this._bookings.ensureLoaded();
  }

  protected join(p: SessionParticipant, event: MouseEvent): void {
    event.stopPropagation();
    if (!p.instanceId) return;
    // The showcase page handles the actual join (calls /join-info and
    // opens the meeting URL). Routing there keeps the flow consistent
    // with deep-links from email reminders.
    void this._router.navigate(['/user/sessions', p.instanceId], {
      queryParams: { action: 'join' },
    });
  }

  protected isOnline(p: SessionParticipant): boolean {
    return p.instance?.template?.locationKind === SessionLocationKind.Online;
  }

  protected sessionType(p: SessionParticipant): string | null {
    return p.instance?.template?.type ?? null;
  }

  protected sessionTitle(p: SessionParticipant): string {
    const i = p.instance;
    return i?.titleOverride ?? i?.template?.title ?? '(Session)';
  }

  protected startAt(p: SessionParticipant): string | null {
    return p.instance?.startAt ?? null;
  }
}
