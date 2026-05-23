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
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import {
  MyBookingsIndexStore,
  MyTab,
  PageShell,
  ProviderChip,
  SessionParticipant,
  SessionsMyStore,
} from 'core';
import { CancelBookingDialog } from './_dialogs/cancel-booking-dialog/cancel-booking-dialog';

interface TabSpec {
  key: MyTab;
  label: string;
  countKey: 'upcoming' | 'pendingApproval' | 'waitlisted' | 'past' | 'cancelled';
}

@Component({
  selector: 'mh-sessions-my',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    MessageModule,
    SkeletonModule,
    TagModule,
    ToastModule,
    PageShell,
    ProviderChip,
    CancelBookingDialog,
  ],
  providers: [SessionsMyStore, MessageService],
  templateUrl: './sessions-my.html',
  styleUrl: './sessions-my.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsMy implements OnInit {
  protected readonly store = inject(SessionsMyStore);
  private readonly _bookings = inject(MyBookingsIndexStore);
  private readonly _router = inject(Router);

  // Cancel-booking dialog state.
  protected readonly cancelOpen = signal(false);
  protected readonly cancelTarget = signal<SessionParticipant | null>(null);

  protected readonly tabs: TabSpec[] = [
    { key: MyTab.Upcoming, label: 'Upcoming', countKey: 'upcoming' },
    { key: MyTab.PendingApproval, label: 'Pending', countKey: 'pendingApproval' },
    { key: MyTab.Waitlisted, label: 'Waitlisted', countKey: 'waitlisted' },
    { key: MyTab.Past, label: 'Past', countKey: 'past' },
    { key: MyTab.Cancelled, label: 'Cancelled', countKey: 'cancelled' },
  ];

  // ─── Filters (client-side, no extra requests) ─────────────────────
  //
  // The BE's MySessionsQueryDto only takes `tab` + pagination. To
  // mirror the instructor-side filter UX (search + quick pill row) we
  // filter the already-loaded participants locally. Avoids the extra
  // round-trips the user explicitly asked us to skip; trade-off is
  // that a filter only operates on the current page slice — that's
  // fine because client-side My Sessions volumes are tiny.
  protected readonly searchInput = signal<string>('');
  protected readonly locationKindFilter = signal<'ONLINE' | 'IN_PERSON' | null>(null);

  protected readonly filteredItems = computed(() => {
    const all = this.store.items();
    const q = this.searchInput().trim().toLowerCase();
    const loc = this.locationKindFilter();
    if (!q && !loc) return all;
    return all.filter((p) => {
      if (loc) {
        const isOnline = this.isOnline(p);
        if (loc === 'ONLINE' && !isOnline) return false;
        if (loc === 'IN_PERSON' && isOnline) return false;
      }
      if (q) {
        const title = this.sessionTitle(p).toLowerCase();
        if (!title.includes(q)) return false;
      }
      return true;
    });
  });

  protected onSearchInput(value: string): void {
    this.searchInput.set(value);
  }

  protected toggleLocation(kind: 'ONLINE' | 'IN_PERSON'): void {
    this.locationKindFilter.set(
      this.locationKindFilter() === kind ? null : kind,
    );
  }

  protected clearFilters(): void {
    this.searchInput.set('');
    this.locationKindFilter.set(null);
  }

  ngOnInit(): void {
    this.store.load();
  }

  protected setTab(tab: MyTab): void {
    this.store.setTab(tab);
  }

  protected countFor(spec: TabSpec): number {
    const c = this.store.counts();
    return c ? c[spec.countKey] : 0;
  }

  protected openSession(p: SessionParticipant): void {
    if (p.instanceId) void this._router.navigate(['/sessions', p.instanceId]);
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

  /** Show the Cancel button only for active bookings. */
  protected canCancel(p: SessionParticipant): boolean {
    return p.status === 'CONFIRMED' || p.status === 'PENDING_APPROVAL' || p.status === 'WAITLISTED';
  }

  /**
   * Show "Join now" within ~15 minutes of start (and during the session).
   * Online-only — in-person doesn't surface a join link.
   */
  protected canJoin(p: SessionParticipant): boolean {
    if (p.status !== 'CONFIRMED' || !this.isOnline(p)) return false;
    const startIso = this.startAt(p);
    if (!startIso) return false;
    const startMs = new Date(startIso).getTime();
    const now = Date.now();
    // Join window: 15 min before start to start + assumed session length.
    const fifteenMinMs = 15 * 60 * 1000;
    const hoursLater = 4 * 60 * 60 * 1000;
    return now >= startMs - fifteenMinMs && now <= startMs + hoursLater;
  }

  protected join(p: SessionParticipant, event: MouseEvent): void {
    event.stopPropagation();
    if (!p.instanceId) return;
    // The showcase page handles the actual join (calls /join-info and
    // opens the meeting URL). Routing there keeps the flow consistent
    // with deep-links from email reminders.
    void this._router.navigate(['/sessions', p.instanceId], {
      queryParams: { action: 'join' },
    });
  }

  protected isOnline(p: SessionParticipant): boolean {
    return (p as SessionParticipant & { instance?: { template?: { locationKind?: string } } })
      .instance?.template?.locationKind === 'ONLINE';
  }

  protected meetingProvider(
    p: SessionParticipant,
  ): string | null {
    const i = (p as SessionParticipant & { instance?: { template?: { meetingProvider?: string } } }).instance;
    return i?.template?.meetingProvider ?? null;
  }

  protected sessionTitle(p: SessionParticipant): string {
    const i = (p as SessionParticipant & { instance?: { template?: { title?: string }; titleOverride?: string | null } }).instance;
    return i?.titleOverride ?? i?.template?.title ?? '(Session)';
  }

  protected startAt(p: SessionParticipant): string | null {
    const i = (p as SessionParticipant & { instance?: { startAt?: string } }).instance;
    return i?.startAt ?? null;
  }

  protected statusSeverity(
    s: SessionParticipant['status'],
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (s) {
      case 'CONFIRMED': return 'success';
      case 'PENDING_APPROVAL': return 'warn';
      case 'WAITLISTED': return 'info';
      case 'CANCELLED':
      case 'DECLINED': return 'danger';
      default: return 'secondary';
    }
  }

  protected statusLabel(s: SessionParticipant['status']): string {
    switch (s) {
      case 'CONFIRMED': return 'Confirmed';
      case 'PENDING_APPROVAL': return 'Pending approval';
      case 'WAITLISTED': return 'Waitlisted';
      case 'CANCELLED': return 'Cancelled';
      case 'DECLINED': return 'Declined';
      default: return s;
    }
  }
}
