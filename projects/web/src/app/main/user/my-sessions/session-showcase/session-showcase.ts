import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { catchError, of } from 'rxjs';
import {
  BlockedSessionInstance,
  BookResponse,
  CurrencyRonPipe,
  MyBookingsIndexStore,
  PublicSessionInstance,
  SessionInstanceStatus,
  SessionKind,
  SessionLocationKind,
  SessionParticipantStatus,
  SessionService,
  isBlockedInstance,
  showApiError,
} from 'core';
import { AccessChip } from '../../../../_shared/components/access-chip/access-chip';
import { TypeChip } from '../../../../_shared/components/type-chip/type-chip';
import { CapacityBar } from '../../../../_shared/components/capacity-bar/capacity-bar';
import { ProviderChip } from '../../../../_shared/components/provider-chip/provider-chip';
import { BookDialog } from '../_dialogs/book-dialog/book-dialog';
import { BookingConfirmedDialog } from '../_dialogs/booking-confirmed-dialog/booking-confirmed-dialog';
import { CancelBookingDialog } from '../_dialogs/cancel-booking-dialog/cancel-booking-dialog';
import { Avatar } from '../../../../_shared/components/avatar/avatar';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public session showcase — shown to a logged-in user (or, in a future
 * iteration, a guest) when they land on `/sessions/:id` from Discover,
 * a share link, or an instructor's profile.
 *
 * Uses `GET /sessions/instances/:id/public` which returns either a
 * `PublicSessionInstance` (everything except meeting URL / PII) or a
 * `BlockedSessionInstance` (just enough to render a "Join the group"
 * CTA without leaking the session details).
 */
@Component({
  selector: 'mh-session-showcase',
  imports: [
    DatePipe,
    CurrencyRonPipe,
    Button,
    Card,
    Divider,
    Message,
    Tag,
    Toast,
    AccessChip,
    TypeChip,
    ProviderChip,
    CapacityBar,
    BookDialog,
    BookingConfirmedDialog,
    CancelBookingDialog,
    Avatar,
  ],
  providers: [MessageService],
  templateUrl: './session-showcase.html',
  styleUrl: './session-showcase.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionShowcase implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);
  private readonly _sessionService = inject(SessionService);
  private readonly _messageService = inject(MessageService);
  private readonly _myBookingsIndexStore = inject(MyBookingsIndexStore);

  // Enum consts exposed for template comparisons — never compare against raw
  // string literals (see CLAUDE.md).
  protected readonly ParticipantStatuses = SessionParticipantStatus;

  protected readonly instance = signal<PublicSessionInstance | BlockedSessionInstance | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly bookOpen = signal(false);
  /** Cancel-booking dialog (reused from My sessions). */
  protected readonly cancelOpen = signal(false);
  /** Success modal opens after a successful book — replaces the old toast. */
  protected readonly confirmedOpen = signal(false);
  protected readonly bookedStatus = signal<SessionParticipantStatus>(
    SessionParticipantStatus.Confirmed,
  );

  protected readonly publicInst = computed<PublicSessionInstance | null>(() => {
    const inst = this.instance();
    if (!inst || isBlockedInstance(inst)) return null;
    return inst;
  });

  protected readonly blockedInst = computed<BlockedSessionInstance | null>(() => {
    const inst = this.instance();
    if (!inst || !isBlockedInstance(inst)) return null;
    return inst;
  });

  protected readonly tpl = computed(() => this.publicInst()?.template ?? null);

  /** Online vs in-person — drives the location meta line + icon. */
  protected readonly isOnline = computed(
    () => this.tpl()?.locationKind === SessionLocationKind.Online,
  );

  protected readonly priceCents = computed(() => this.tpl()?.priceAmountCents ?? 0);
  protected readonly currency = computed(() => this.tpl()?.priceCurrency ?? 'RON');
  protected readonly isFree = computed(() => this.priceCents() === 0);

  /** Effective capacity — per-occurrence override wins, else template. */
  protected readonly cap = computed<number | null>(() => {
    const inst = this.publicInst();
    return inst?.capacityOverride ?? this.tpl()?.capacity ?? null;
  });

  /** Show the booked/capacity line only for group/open sessions with a cap. */
  protected readonly showCapacity = computed(() => {
    const t = this.tpl();
    return this.cap() != null && (t?.type === SessionKind.Group || t?.type === SessionKind.Open);
  });

  /** Did the current user already book this instance? */
  protected readonly myBooking = computed(() => {
    const inst = this.publicInst();
    return inst ? this._myBookingsIndexStore.bookingFor(inst.id) : null;
  });

  /**
   * Can the current booking still be cancelled? Mirrors `my-session-row`'s
   * rule: the session must not have started yet and the booking must be in an
   * active state (confirmed / pending / waitlisted). The cancel cutoff window
   * itself is enforced + messaged by the BE inside the cancel dialog.
   */
  protected readonly canCancelBooking = computed(() => {
    const b = this.myBooking();
    if (!b || this.isPast()) return false;
    return (
      b.status === SessionParticipantStatus.Confirmed ||
      b.status === SessionParticipantStatus.PendingApproval ||
      b.status === SessionParticipantStatus.Waitlisted
    );
  });

  protected readonly canBook = computed(() => {
    const inst = this.publicInst();
    if (!inst) return false;
    if (inst.status !== SessionInstanceStatus.Scheduled) return false;
    if (this.myBooking()) return false; // already booked
    if (this.isFull()) return false; // capacity reached; user gets waitlist CTA instead
    if (this.isPast()) return false; // session start is in the past — read-only
    return true;
  });

  /**
   * Past = the instance's start time has already passed. Booking a
   * session that already happened isn't meaningful — the user can
   * still view the detail (re-book a similar slot, etc.), but the
   * primary CTA is suppressed in favor of a read-only chip.
   */
  protected readonly isPast = computed(() => {
    const inst = this.publicInst();
    if (!inst) return false;
    return new Date(inst.startAt).getTime() < Date.now();
  });

  /**
   * Capacity-full: the template has a hard cap AND confirmed signups
   * are at-or-over it. Drives the design's 5C coral banner + Join
   * waitlist sticky CTA path. Unlimited-capacity sessions (capacity
   * null/0) are never "full" — they always show the regular Book CTA.
   */
  protected readonly isFull = computed(() => {
    const inst = this.publicInst();
    const t = this.tpl();
    if (!inst || !t) return false;
    const cap = inst.capacityOverride ?? t.capacity;
    if (!cap || cap <= 0) return false;
    return inst.confirmedCount >= cap;
  });

  /** Waitlist toggle from the template — gates the secondary CTA. */
  protected readonly waitlistEnabled = computed(() => this.tpl()?.waitlistEnabled === true);

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Missing session id.');
      return;
    }
    // Defensive: a malformed deep-link (e.g. /sessions/my from an old
    // notification) would hit this with a non-UUID. Bail with a friendly
    // error instead of firing /sessions/instances/my/public at the BE,
    // which 400s with "Validation failed (uuid is expected)".
    if (!UUID_RE.test(id)) {
      this.error.set('That session link looks invalid.');
      return;
    }
    this._load(id);
    // Make sure we know whether the user already booked this instance.
    this._myBookingsIndexStore.ensureLoaded();
    // Deep-link from reminders / "Join now" rows: ?action=join routes
    // to the dedicated day-of countdown screen, which polls join-info
    // and surfaces the active window properly instead of just popping
    // a tab open.
    if (this._route.snapshot.queryParamMap.get('action') === 'join') {
      void this._router.navigate(['/user/sessions', id, 'join']);
    }
  }

  protected onBookSuccess(res: BookResponse): void {
    this.bookOpen.set(false);
    // Capture the participant status so the confirmation modal can adapt
    // its copy + hide the calendar-export row for PENDING_APPROVAL.
    this.bookedStatus.set(res.status);
    this.confirmedOpen.set(true);
    // Invalidate the bookings index so the Book button flips to "Booked"
    // immediately if the user navigates back here.
    this._myBookingsIndexStore.invalidate();
    this._myBookingsIndexStore.ensureLoaded();
    // Re-pull the instance so capacity, confirmed count and the CTA state
    // on this page reflect the new booking.
    this._refresh();
  }

  /** A booking was cancelled — refresh the index so the Book CTA returns. */
  protected onCancelled(): void {
    this.cancelOpen.set(false);
    this._myBookingsIndexStore.invalidate();
    this._myBookingsIndexStore.ensureLoaded();
    this._refresh();
  }

  protected goBack(): void {
    // Location.back() === history.back(). If we arrived via deep link or a
    // refresh there's no in-app history to pop, so fall back to Discover.
    if (this._router.lastSuccessfulNavigation()?.previousNavigation) {
      this._location.back();
    } else {
      void this._router.navigate(['/user/sessions/discover']);
    }
  }

  protected goToMySessions(): void {
    void this._router.navigate(['/user/sessions']);
  }

  protected goToGroup(): void {
    const b = this.blockedInst();
    if (b?.template?.groupId) {
      void this._router.navigate(['/groups', b.template.groupId]);
    }
  }

  /**
   * Silently re-pull the public instance after a booking action. Skips the
   * loading spinner (the page already has content) and, on failure, keeps the
   * current data instead of wiping the view — the action itself succeeded.
   */
  private _refresh(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id) this._load(id, true);
  }

  private _load(id: string, silent = false): void {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    this._sessionService
      .getPublicInstance(id)
      .pipe(
        catchError((err: unknown) => {
          if (!silent) {
            showApiError(this._messageService, 'Could not load session', 'Please try again.', err);
            this.error.set('Could not load this session.');
          }
          return of(null);
        }),
      )
      .subscribe({
        next: (res) => {
          if (res || !silent) this.instance.set(res);
        },
        complete: () => {
          if (!silent) this.loading.set(false);
        },
      });
  }
}
