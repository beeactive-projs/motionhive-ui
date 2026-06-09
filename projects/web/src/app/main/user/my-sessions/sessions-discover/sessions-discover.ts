import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { Popover } from 'primeng/popover';
import {
  MyBookingsIndexStore,
  PublicSessionInstance,
  SessionCard,
  SessionKind,
  SessionLocationKind,
  SessionsDiscoverStore,
  injectIsTabletDown,
} from 'core';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';

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
    FormsModule,
    ButtonModule,
    IconField,
    InputIcon,
    InputTextModule,
    SkeletonModule,
    MessageModule,
    Popover,
    SessionCard,
    ListEmptyState,
  ],
  providers: [SessionsDiscoverStore],
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
   * Group consecutive instances of the same template into a single card.
   * Discover returns one row per occurrence — a weekly class with 5
   * upcoming sessions would render as 5 identical cards. We keep the
   * earliest instance as the card representative + count siblings for
   * the "+N more" line.
   */
  protected readonly groupedItems = computed<
    { lead: PublicSessionInstance; moreCount: number }[]
  >(() => {
    const byTemplate = new Map<string, PublicSessionInstance[]>();
    for (const inst of this.store.items()) {
      const list = byTemplate.get(inst.templateId) ?? [];
      list.push(inst);
      byTemplate.set(inst.templateId, list);
    }
    const groups: { lead: PublicSessionInstance; moreCount: number }[] = [];
    for (const list of byTemplate.values()) {
      list.sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
      groups.push({ lead: list[0], moreCount: list.length - 1 });
    }
    groups.sort(
      (a, b) =>
        new Date(a.lead.startAt).getTime() - new Date(b.lead.startAt).getTime(),
    );
    return groups;
  });

  /** Any quick filter (type / location) or search currently applied. */
  protected readonly hasActiveFilters = computed(() => {
    const f = this.store.filters();
    return !!(f.q || f.type || f.locationKind);
  });

  protected readonly searchInput = signal('');
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;

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
}
