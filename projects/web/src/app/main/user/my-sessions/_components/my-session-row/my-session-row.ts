import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import {
  CurrencyRonPipe,
  SessionInstructorRef,
  SessionKind,
  SessionLocationKind,
  SessionMeetingProvider,
  SessionParticipant,
  SessionParticipantStatus,
  TagSeverity,
  formatSessionDuration,
  formatSessionTime,
} from 'core';
import { Avatar } from '../../../../../_shared/components/avatar/avatar';
import { TypeChip } from '../../../../../_shared/components/type-chip/type-chip';
import { ProviderChip } from '../../../../../_shared/components/provider-chip/provider-chip';

/**
 * Left-edge accent of a booking row. It answers one question at a glance —
 * *"how do I attend this, and is it still live?"* — so its meaning is defined
 * on a single axis, never on status:
 *
 *   BASIS        the session's location (online vs in-person)
 *   OVERRIDE     a booking that is no longer live goes grey
 *   PRECEDENCE   inactive  ›  online  ›  in-person   (first match wins)
 *
 *   - `Inactive` (muted grey) — cancelled, declined, or already started/past;
 *                  no longer actionable. Checked first, so a dead booking is
 *                  never tinted by its location.
 *   - `Online`   (teal)       — live & upcoming, attended via a meeting link.
 *   - `InPerson` (honey)      — live & upcoming, attended at a venue.
 *
 * Each visual channel owns exactly one fact, so nothing is said twice:
 *   - booking *status* (Confirmed/Pending/Waitlisted/…) → the status `p-tag`
 *     (semantic colours); the stripe must not echo it — honey here means
 *     "in-person", not "selected/pending".
 *   - session *type* (Group/Private/Open) → the `mh-type-chip`.
 *
 * The row only names the situation; the colour for each name lives in one
 * place (`my-session-row.scss`, keyed off `[data-tone]`).
 */
const SessionRowTone = {
  Online: 'online',
  InPerson: 'in-person',
  Inactive: 'inactive',
} as const;
type SessionRowTone = (typeof SessionRowTone)[keyof typeof SessionRowTone];

/**
 * `mh-my-session-row` — a single booking row on the client "My sessions"
 * page. Presentational: it takes one `SessionParticipant` (with the eager-
 * loaded `instance` + `instructor` the `listMy` response embeds) and emits
 * `open` / `join` / `cancel`; the page owns the Router + cancel dialog.
 *
 * Layout (richer than the generic `mh-time-row`, which this replaces here):
 *
 *  ┌────┬────┬───────────────────────────────────┬────────────┐
 *  │time│ ⬡  │ Title  [Group] [Zoom]              │ [Confirmed]│
 *  │    │avtr│ 👤 Coach · 📹 Online · 👥 1/15      │   50 RON   │
 *  │    │    │ ✓ Free cancellation until 24h before│ [Join] [✕]│
 *  └────┴────┴───────────────────────────────────┴────────────┘
 *
 * The instructor line / location / capacity / cancellation-policy / booked-on
 * are desktop-only (hidden when `mobile` is true) to keep small screens tidy;
 * the cancel reason always shows. No "Add to calendar" and no chevron.
 */
@Component({
  selector: 'mh-my-session-row',
  standalone: true,
  imports: [DatePipe, Button, Card, Tag, Avatar, TypeChip, ProviderChip, CurrencyRonPipe],
  templateUrl: './my-session-row.html',
  styleUrl: './my-session-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'button',
    tabindex: '0',
    '[attr.data-tone]': 'tone()',
    '(click)': 'onOpen()',
    '(keydown)': 'onKey($event)',
  },
})
export class MySessionRow {
  readonly participant = input.required<SessionParticipant>();
  /** Mobile viewport flag (from the page's `injectIsMobile()`). */
  readonly mobile = input<boolean>(false);

  readonly open = output<void>();
  readonly join = output<MouseEvent>();
  readonly cancel = output<MouseEvent>();

  // ─── Derived row data (all typed off SessionParticipant.instance) ─────

  protected readonly instance = computed(() => this.participant().instance);

  protected readonly title = computed(() => {
    const i = this.instance();
    return i?.titleOverride ?? i?.template?.title ?? '(Session)';
  });

  protected readonly start = computed<string | null>(() => this.instance()?.startAt ?? null);

  /** Row time label (e.g. "09:00"), em-dash when the start is unknown. */
  protected readonly time = computed(() => {
    const s = this.start();
    return s ? formatSessionTime(s) : '—';
  });

  /** Row duration label (e.g. "60 min"), empty when unknown. */
  protected readonly duration = computed(() => {
    const mins = this.instance()?.template?.durationMinutes;
    return mins ? formatSessionDuration(mins) : '';
  });

  protected readonly type = computed<SessionKind | null>(
    () => this.instance()?.template?.type ?? null,
  );

  protected readonly isOnline = computed(
    () => this.instance()?.template?.locationKind === SessionLocationKind.Online,
  );

  protected readonly provider = computed<SessionMeetingProvider | null>(
    () => this.instance()?.template?.meetingProvider ?? null,
  );

  protected readonly instructor = computed<SessionInstructorRef | null>(
    () => this.instance()?.instructor ?? null,
  );

  protected readonly instructorName = computed<string | null>(() => {
    const ins = this.instructor();
    if (!ins) return null;
    const name = `${ins.firstName ?? ''} ${ins.lastName ?? ''}`.trim();
    return name || null;
  });

  /** Confirmed signups on the occurrence (denormalized on the instance). */
  protected readonly confirmed = computed(() => this.instance()?.confirmedCount ?? 0);

  /** Capacity denominator — per-occurrence override wins, else template. */
  protected readonly capacity = computed<number | null>(() => {
    const i = this.instance();
    return i?.capacityOverride ?? i?.template?.capacity ?? null;
  });

  /** True for group/open sessions that have a known capacity to show. */
  protected readonly showCapacity = computed(() => {
    const t = this.type();
    return this.capacity() != null && (t === SessionKind.Group || t === SessionKind.Open);
  });

  /** Left-edge tone — muted for past/cancelled, teal online, honey in-person. */
  protected readonly tone = computed<SessionRowTone>(() => {
    const st = this.participant().status;
    if (st === SessionParticipantStatus.Cancelled || st === SessionParticipantStatus.Declined) {
      return SessionRowTone.Inactive;
    }
    const s = this.start();
    if (s && new Date(s).getTime() < Date.now()) return SessionRowTone.Inactive;
    return this.isOnline() ? SessionRowTone.Online : SessionRowTone.InPerson;
  });

  protected readonly statusClass = computed<string>(() => {
    switch (this.participant().status) {
      case SessionParticipantStatus.Confirmed:
        return 'bg-green-50 text-green-800';
      case SessionParticipantStatus.PendingApproval:
        return 'bg-orange-50 text-orange-800';
      case SessionParticipantStatus.Waitlisted:
        return 'bg-yellow-50 text-yellow-800';
      case SessionParticipantStatus.Cancelled:
      case SessionParticipantStatus.Declined:
        return 'bg-red-50 text-red-800';
      default:
        return 'bg-green-50 text-green-800';
    }
  });
  protected readonly statusIcon = computed<string>(() => {
    switch (this.participant().status) {
      case SessionParticipantStatus.Confirmed:
        return 'pi pi-verified';
      case SessionParticipantStatus.PendingApproval:
        return 'pi pi-hourglass';
      case SessionParticipantStatus.Waitlisted:
        return 'pi pi-clock';
      case SessionParticipantStatus.Cancelled:
      case SessionParticipantStatus.Declined:
        return 'pi pi-times-circle';
      default:
        return 'pi pi-tag';
    }
  });

  protected readonly statusLabel = computed(() => {
    switch (this.participant().status) {
      case SessionParticipantStatus.Confirmed:
        return 'Confirmed';
      case SessionParticipantStatus.PendingApproval:
        return 'Pending approval';
      case SessionParticipantStatus.Waitlisted:
        return 'Waitlisted';
      case SessionParticipantStatus.Cancelled:
        return 'Cancelled';
      case SessionParticipantStatus.Declined:
        return 'Declined';
      default:
        return this.participant().status;
    }
  });

  /** Status label with the queue position appended for waitlisted rows. */
  protected readonly statusLabelText = computed(() => {
    const p = this.participant();
    const base = this.statusLabel();
    if (p.status === SessionParticipantStatus.Waitlisted && p.waitlistPosition != null) {
      return `${base} · #${p.waitlistPosition}`;
    }
    return base;
  });

  protected readonly isFree = computed(() => this.participant().snapshotPriceCents === 0);

  /** Show the Cancel button only for active bookings. */
  protected readonly canCancel = computed(() => {
    const st = this.participant().status;
    return (
      st === SessionParticipantStatus.Confirmed ||
      st === SessionParticipantStatus.PendingApproval ||
      st === SessionParticipantStatus.Waitlisted
    );
  });

  /** Free-cancellation policy line — active, still-cancellable upcoming rows. */
  protected readonly cancelPolicy = computed<string | null>(() => {
    const p = this.participant();
    if (!this.canCancel() || !p.snapshotCancelCutoffH) return null;
    const s = this.start();
    if (s && new Date(s).getTime() < Date.now()) return null; // past → no policy
    return `Free cancellation until ${p.snapshotCancelCutoffH}h before`;
  });

  /** Cancel reason for cancelled/declined rows. Null otherwise. */
  protected readonly cancelReasonText = computed<string | null>(() => {
    const p = this.participant();
    const cancelled =
      p.status === SessionParticipantStatus.Cancelled ||
      p.status === SessionParticipantStatus.Declined;
    return cancelled ? p.cancelReason?.trim() || null : null;
  });

  /**
   * Show "Join" within ~15 minutes of start (and during the session).
   * Online-only — in-person doesn't surface a join link.
   */
  protected readonly canJoin = computed(() => {
    const p = this.participant();
    if (p.status !== SessionParticipantStatus.Confirmed || !this.isOnline()) return false;
    const s = this.start();
    if (!s) return false;
    const startMs = new Date(s).getTime();
    const now = Date.now();
    return now >= startMs - 15 * 60 * 1000 && now <= startMs + 4 * 60 * 60 * 1000;
  });

  // ─── Events ───────────────────────────────────────────────────────────

  protected onOpen(): void {
    this.open.emit();
  }

  protected onJoin(event: MouseEvent): void {
    event.stopPropagation();
    this.join.emit(event);
  }

  protected onCancel(event: MouseEvent): void {
    event.stopPropagation();
    this.cancel.emit(event);
  }

  /** Keyboard activation — Enter/Space open the session (like a button). */
  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (event.target as HTMLElement).click();
    }
  }
}
