import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import {
  MyBookingsIndexStore,
  PageShell,
  PublicSessionInstance,
  SessionCard,
  SessionsDiscoverStore,
} from 'core';

/**
 * Public-ish "find a session" page for logged-in users.
 *
 * Uses `SessionsDiscoverStore` against `GET /sessions/discover`. Cards
 * render via the existing `mh-session-card` primitive (showcase variant
 * for the discover layout). Clicking a card routes to the session
 * showcase page where the user can book.
 *
 * Filters in V1: search query (q), type, location kind. The instructor /
 * group filters are reserved for the per-profile and per-group session
 * lists (Phase E.2).
 */
@Component({
  selector: 'mh-sessions-discover',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    Select,
    SkeletonModule,
    MessageModule,
    PageShell,
    SessionCard,
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

  protected isBooked(inst: PublicSessionInstance): boolean {
    return this.bookings.hasBooking(inst.id);
  }

  /**
   * Group consecutive instances of the same template into a single card.
   * Discover returns one row per occurrence — a weekly yoga class with
   * 5 upcoming sessions would render as 5 identical-looking cards, which
   * is the noise the user flagged. We keep the earliest instance as the
   * card representative + count siblings for the "+N more" line.
   */
  protected readonly groupedItems = computed<
    { lead: PublicSessionInstance; moreCount: number }[]
  >(() => {
    const byTemplate = new Map<string, PublicSessionInstance[]>();
    for (const inst of this.store.items()) {
      const tid = inst.templateId;
      const list = byTemplate.get(tid) ?? [];
      list.push(inst);
      byTemplate.set(tid, list);
    }
    const groups: { lead: PublicSessionInstance; moreCount: number }[] = [];
    for (const list of byTemplate.values()) {
      // Earliest occurrence first.
      list.sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
      groups.push({ lead: list[0], moreCount: list.length - 1 });
    }
    // Sort groups by the lead's startAt so the order matches the BE.
    groups.sort(
      (a, b) =>
        new Date(a.lead.startAt).getTime() -
        new Date(b.lead.startAt).getTime(),
    );
    return groups;
  });

  protected readonly searchInput = signal('');
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly typeOptions = [
    { value: null, label: 'Any type' },
    { value: 'OPEN', label: 'Open' },
    { value: 'GROUP', label: 'Group' },
    { value: 'PRIVATE', label: 'Private (1:1)' },
  ];

  protected readonly locationOptions = [
    { value: null, label: 'Anywhere' },
    { value: 'ONLINE', label: 'Online' },
    { value: 'IN_PERSON', label: 'In person' },
  ];

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

  protected onTypeChange(value: string | null): void {
    this.store.setFilters({ type: (value ?? undefined) as 'OPEN' | 'GROUP' | 'PRIVATE' | undefined });
  }

  protected onLocationChange(value: string | null): void {
    this.store.setFilters({ locationKind: (value ?? undefined) as 'ONLINE' | 'IN_PERSON' | undefined });
  }

  protected onCardOpen(instance: PublicSessionInstance): void {
    void this._router.navigate(['/sessions', instance.id]);
  }
}
