import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { Popover } from 'primeng/popover';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import {
  BookResponse,
  MyBookingsIndexStore,
  PublicSessionInstance,
  SessionKind,
  SessionLocationKind,
  SessionParticipantStatus,
  SessionsDiscoverStore,
  groupSessionsByBucket,
  injectIsMobile,
  injectIsTabletDown,
} from 'core';
import { DaySeparator } from '../../../../_shared/components/day-separator/day-separator';
import { SectionLabel } from '../../../../_shared/components/section-label/section-label';
import { TimeRowSkeleton } from '../../../../_shared/components/time-row-skeleton/time-row-skeleton';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';
import { DiscoverSessionRow } from './_components/discover-session-row/discover-session-row';
import { BookDialog } from '../_dialogs/book-dialog/book-dialog';
import { BookingConfirmedDialog } from '../_dialogs/booking-confirmed-dialog/booking-confirmed-dialog';

/**
 * Public-ish "find a session" page for logged-in users.
 *
 * Uses `SessionsDiscoverStore` against `GET /sessions/discover`. Cards
 * render via the existing `mh-session-card` primitive. Clicking a card
 * routes to the session showcase page where the user can book.
 *
 * Filters: search query (q) + type + location-kind quick filters,
 * mirroring the instructor sessions list filter row.
 */
@Component({
  selector: 'mh-sessions-discover',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    ButtonModule,
    IconField,
    InputIcon,
    InputTextModule,
    MessageModule,
    Popover,
    TimeRowSkeleton,
    SectionLabel,
    DaySeparator,
    ListEmptyState,
    DiscoverSessionRow,
    Toast,
    BookDialog,
    BookingConfirmedDialog,
  ],
  providers: [SessionsDiscoverStore, MessageService],
  templateUrl: './sessions-discover.html',
  styleUrl: './sessions-discover.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsDiscover implements OnInit, OnDestroy {
  protected readonly store = inject(SessionsDiscoverStore);
  protected readonly bookings = inject(MyBookingsIndexStore);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);

  /** Tablet or smaller — collapses the quick filters behind a popover. */
  protected readonly isTabletDown = injectIsTabletDown();
  /** Mobile viewport — switches day headers + row layout, like my-sessions. */
  protected readonly isMobile = injectIsMobile();

  // Enum consts exposed for template comparisons — never compare against
  // raw string literals (see CLAUDE.md).
  protected readonly SessionKind = SessionKind;
  protected readonly SessionLocationKind = SessionLocationKind;

  /** How many quick filters are applied (type + location) — drives the badge. */
  protected readonly appliedFilterCount = computed(() => {
    const f = this.store.filters();
    let n = 0;
    if (f.type) n++;
    if (f.locationKind) n++;
    return n;
  });

  protected isBooked(inst: PublicSessionInstance): boolean {
    return this.bookings.hasBooking(inst.id);
  }

  /**
   * Instances bucketed Today / Tomorrow / This week / by month, ascending
   * ("what's next"). Discover returns one row per occurrence, so a recurring
   * class shows once per day it runs; the row carries its own date inside
   * multi-day buckets.
   */
  protected readonly groupedItems = computed(() =>
    groupSessionsByBucket(this.store.items(), (inst) => inst.startAt, 'future'),
  );

  /** Any quick filter (type / location) or search currently applied. */
  protected readonly hasActiveFilters = computed(() => {
    const f = this.store.filters();
    return !!(f.q || f.type || f.locationKind);
  });

  protected readonly searchInput = signal('');
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Booking dialog state (mirrors the session showcase) ────────────────
  /** The instance whose Book CTA was clicked — feeds both dialogs. */
  protected readonly selectedInstance = signal<PublicSessionInstance | null>(null);
  protected readonly bookOpen = signal(false);
  /** Success modal opens after a successful book. */
  protected readonly confirmedOpen = signal(false);
  protected readonly bookedStatus = signal<SessionParticipantStatus>('CONFIRMED');

  ngOnInit(): void {
    this.store.load();
    this.bookings.ensureLoaded();
  }

  ngOnDestroy(): void {
    if (this._searchTimer) clearTimeout(this._searchTimer);
  }

  protected onSearchChange(value: string): void {
    this.searchInput.set(value);
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this.store.setFilters({ q: value.trim() || undefined });
    }, 300);
  }

  /** Toggle a type quick-filter — click the active one again to clear. */
  protected toggleType(type: SessionKind): void {
    const current = this.store.filters().type;
    this.store.setFilters({ type: current === type ? undefined : type });
  }

  /** Toggle a location quick-filter — click the active one again to clear. */
  protected toggleLocation(kind: SessionLocationKind): void {
    const current = this.store.filters().locationKind;
    this.store.setFilters({ locationKind: current === kind ? undefined : kind });
  }

  /** Drop the type + location quick filters (the "All" pill). Search is kept. */
  protected clearQuickFilters(): void {
    this.store.setFilters({ type: undefined, locationKind: undefined });
  }

  /** Drop every quick filter + the search box (empty-state action). */
  protected clearFilters(): void {
    this.searchInput.set('');
    this.store.setFilters({ q: undefined, type: undefined, locationKind: undefined });
  }

  protected goBack(): void {
    // Location.back() === history.back(). If we arrived via deep link or a
    // refresh there's no in-app history to pop, so fall back to My sessions.
    if (this._router.lastSuccessfulNavigation()?.previousNavigation) {
      this._location.back();
    } else {
      void this._router.navigate(['/user/sessions']);
    }
  }

  protected onCardOpen(instance: PublicSessionInstance): void {
    void this._router.navigate(['/user/sessions', instance.id]);
  }

  /**
   * Book action — opens the booking dialog inline (same flow as the session
   * showcase) instead of routing away to the detail page. The row's button is
   * already gated by `canBook`, so we just stash the instance + open the modal.
   */
  protected onBook(instance: PublicSessionInstance): void {
    this.selectedInstance.set(instance);
    this.bookOpen.set(true);
  }

  /** A booking landed — swap to the confirmation modal + refresh the index. */
  protected onBookSuccess(res: BookResponse): void {
    this.bookOpen.set(false);
    this.bookedStatus.set(res.status);
    this.confirmedOpen.set(true);
    // Refresh so the row's Book button flips to the "Booked" tag immediately.
    this.bookings.invalidate();
    this.bookings.ensureLoaded();
  }

  protected goToMySessions(): void {
    void this._router.navigate(['/user/sessions']);
  }
}
