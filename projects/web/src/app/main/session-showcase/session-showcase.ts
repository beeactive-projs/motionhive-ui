import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { catchError, of } from 'rxjs';
import {
  AccessChip,
  BlockedSessionInstance,
  BookResponse,
  CapacityBar,
  MyBookingsIndexStore,
  PageShell,
  ProviderChip,
  PublicSessionInstance,
  SessionParticipantStatus,
  SessionService,
  TypeChip,
  isBlockedInstance,
  showApiError,
} from 'core';
import { BookDialog } from './_dialogs/book-dialog/book-dialog';
import { BookingConfirmedDialog } from './_dialogs/booking-confirmed-dialog/booking-confirmed-dialog';

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
    DecimalPipe,
    RouterLink,
    Button,
    Message,
    Skeleton,
    Toast,
    PageShell,
    AccessChip,
    TypeChip,
    ProviderChip,
    CapacityBar,
    BookDialog,
    BookingConfirmedDialog,
  ],
  providers: [MessageService],
  templateUrl: './session-showcase.html',
  styleUrl: './session-showcase.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionShowcase implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _sessionService = inject(SessionService);
  private readonly _messageService = inject(MessageService);
  private readonly _myBookingsIndexStore = inject(MyBookingsIndexStore);

  protected readonly instance = signal<
    PublicSessionInstance | BlockedSessionInstance | null
  >(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly bookOpen = signal(false);
  /** Success modal opens after a successful book — replaces the old toast. */
  protected readonly confirmedOpen = signal(false);
  protected readonly bookedStatus = signal<SessionParticipantStatus>('CONFIRMED');

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

  /** Did the current user already book this instance? */
  protected readonly myBooking = computed(() => {
    const inst = this.publicInst();
    return inst ? this._myBookingsIndexStore.bookingFor(inst.id) : null;
  });

  protected readonly canBook = computed(() => {
    const inst = this.publicInst();
    if (!inst) return false;
    if (inst.status !== 'SCHEDULED') return false;
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
  protected readonly waitlistEnabled = computed(
    () => this.tpl()?.waitlistEnabled === true,
  );

  ngOnInit(): void {
    // Subscribe to the param (don't read the snapshot once): Angular reuses
    // this component when navigating /sessions/A -> /sessions/B (e.g. picking
    // another session from the ⌘K search), so a snapshot read would keep
    // showing the first session. Reload whenever the id changes.
    this._route.paramMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
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
          void this._router.navigate(['/sessions', id, 'join']);
        }
      });
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
  }

  protected goToMySessions(): void {
    void this._router.navigate(['/my/sessions']);
  }

  protected goToGroup(): void {
    const b = this.blockedInst();
    if (b?.template?.groupId) {
      void this._router.navigate(['/groups', b.template.groupId]);
    }
  }

  private _load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this._sessionService
      .getPublicInstance(id)
      .pipe(
        catchError((err: unknown) => {
          showApiError(this._messageService, 'Could not load session', 'Please try again.', err);
          this.error.set('Could not load this session.');
          return of(null);
        }),
      )
      .subscribe({
        next: (res) => this.instance.set(res),
        complete: () => this.loading.set(false),
      });
  }
}
