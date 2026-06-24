import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import {
  CurrencyRonPipe,
  PublicSessionInstance,
  SessionInstructorRef,
  SessionInstanceStatus,
  SessionKind,
  SessionLocationKind,
  SessionMeetingProvider,
  formatSessionDayShort,
  formatSessionDuration,
  formatSessionTime,
} from 'core';
import { Avatar } from '../../../../../../_shared/components/avatar/avatar';
import { TypeChip } from '../../../../../../_shared/components/type-chip/type-chip';
import { ProviderChip } from '../../../../../../_shared/components/provider-chip/provider-chip';

/**
 * Left-edge accent of a discover row — answers *"how do I attend this?"* on a
 * single axis (location), never on status. Discover only ever lists live,
 * upcoming, bookable occurrences, so there is no `inactive` tone here.
 *
 *   - `Online`   (teal)  — attended via a meeting link.
 *   - `InPerson` (honey) — attended at a venue.
 *
 * The colour for each name lives in one place (`discover-session-row.scss`,
 * keyed off `[data-tone]`), mirroring `mh-my-session-row`.
 */
const DiscoverRowTone = {
  Online: 'online',
  InPerson: 'in-person',
} as const;
type DiscoverRowTone = (typeof DiscoverRowTone)[keyof typeof DiscoverRowTone];

/**
 * `mh-discover-session-row` — a single bookable session row on the client
 * "Discover sessions" page. The discover-side sibling of `mh-my-session-row`:
 * same layout, but keyed off a `PublicSessionInstance` (no participant) and
 * with a **Book** action instead of cancel/join.
 *
 * Presentational: it takes one instance (with the eager-loaded `template` +
 * `instructor` the discover response embeds) and emits `open` / `book`; the
 * page owns the Router. A `booked` flag swaps the Book button for a "Booked"
 * tag so already-booked occurrences read at a glance.
 */
@Component({
  selector: 'mh-discover-session-row',
  standalone: true,
  imports: [Button, Card, Tag, Avatar, TypeChip, ProviderChip, CurrencyRonPipe],
  templateUrl: './discover-session-row.html',
  styleUrl: './discover-session-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'button',
    tabindex: '0',
    '[attr.data-tone]': 'tone()',
    '(click)': 'onOpen()',
    '(keydown)': 'onKey($event)',
  },
})
export class DiscoverSessionRow {
  readonly instance = input.required<PublicSessionInstance>();
  /** Mobile viewport flag (from the page's `injectIsMobile()`). */
  readonly mobile = input<boolean>(false);
  /** True when the current user already has a booking on this occurrence. */
  readonly booked = input<boolean>(false);
  /** Show the row's date (multi-day buckets like "This week" / a month). */
  readonly showDate = input<boolean>(false);

  readonly open = output<void>();
  readonly book = output<MouseEvent>();

  // ─── Derived row data (all typed off PublicSessionInstance.template) ────

  protected readonly title = computed(() => {
    const i = this.instance();
    return i.titleOverride ?? i.template?.title ?? '(Session)';
  });

  protected readonly start = computed<string | null>(() => this.instance().startAt ?? null);

  /** Row time label (e.g. "09:00"), em-dash when the start is unknown. */
  protected readonly time = computed(() => {
    const s = this.start();
    return s ? formatSessionTime(s) : '—';
  });

  /** Compact date label (e.g. "Wed 25 Jun") for multi-day buckets. */
  protected readonly dateLabel = computed(() => {
    const s = this.start();
    return s ? formatSessionDayShort(s) : '';
  });

  /** Row duration label (e.g. "60 min"), empty when unknown. */
  protected readonly duration = computed(() => {
    const mins = this.instance().template?.durationMinutes;
    return mins ? formatSessionDuration(mins) : '';
  });

  protected readonly type = computed<SessionKind | null>(
    () => this.instance().template?.type ?? null,
  );

  protected readonly isOnline = computed(
    () => this.instance().template?.locationKind === SessionLocationKind.Online,
  );

  protected readonly provider = computed<SessionMeetingProvider | null>(
    () => this.instance().template?.meetingProvider ?? null,
  );

  protected readonly instructor = computed<SessionInstructorRef | null>(
    () => this.instance().instructor ?? null,
  );

  protected readonly instructorName = computed<string | null>(() => {
    const ins = this.instructor();
    if (!ins) return null;
    const name = `${ins.firstName ?? ''} ${ins.lastName ?? ''}`.trim();
    return name || null;
  });

  /** Confirmed signups on the occurrence (denormalized on the instance). */
  protected readonly confirmed = computed(() => this.instance().confirmedCount ?? 0);

  /** Capacity denominator — per-occurrence override wins, else template. */
  protected readonly capacity = computed<number | null>(() => {
    const i = this.instance();
    return i.capacityOverride ?? i.template?.capacity ?? null;
  });

  /** True for group/open sessions that have a known capacity to show. */
  protected readonly showCapacity = computed(() => {
    const t = this.type();
    return this.capacity() != null && (t === SessionKind.Group || t === SessionKind.Open);
  });

  /** Left-edge tone — teal online, honey in-person. */
  protected readonly tone = computed<DiscoverRowTone>(() =>
    this.isOnline() ? DiscoverRowTone.Online : DiscoverRowTone.InPerson,
  );

  protected readonly priceCents = computed(() => this.instance().template?.priceAmountCents ?? 0);
  protected readonly currency = computed(() => this.instance().template?.priceCurrency ?? 'RON');
  protected readonly isFree = computed(() => this.priceCents() === 0);

  /** Approval-required sessions request a booking rather than book instantly. */
  protected readonly bookLabel = computed(() =>
    this.instance().template?.approvalRequired ? 'Request to join' : 'Book',
  );

  /** Start time has already passed — bookings are closed for past occurrences. */
  protected readonly isPast = computed(() => {
    const s = this.start();
    return s ? new Date(s).getTime() < Date.now() : false;
  });

  /** Capacity reached — at/over a known hard cap. Unlimited caps are never full. */
  protected readonly isFull = computed(() => {
    const cap = this.capacity();
    if (!cap || cap <= 0) return false;
    return this.confirmed() >= cap;
  });

  /**
   * Mirrors the showcase Book CTA: bookable only while the occurrence is
   * scheduled, not full, and not in the past. (`booked` swaps the button
   * for a tag upstream, so it isn't re-checked here.)
   */
  protected readonly canBook = computed(() => {
    if (this.instance().status !== SessionInstanceStatus.Scheduled) return false;
    if (this.isFull()) return false;
    if (this.isPast()) return false;
    return true;
  });

  // ─── Events ───────────────────────────────────────────────────────────

  protected onOpen(): void {
    this.open.emit();
  }

  protected onBook(event: MouseEvent): void {
    event.stopPropagation();
    this.book.emit(event);
  }

  /** Keyboard activation — Enter/Space open the session (like a button). */
  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (event.target as HTMLElement).click();
    }
  }
}
