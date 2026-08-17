import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { forkJoin, take } from 'rxjs';

import {
  BlockedSessionInstance,
  MyTab,
  PublicSessionInstance,
  SessionParticipant,
  SessionService,
  WEB_APP_URL,
  displayName,
  formatSessionDuration,
  formatSessionTime,
  sessionLifecycle,
} from 'core';

import { CancelBookingSheet } from '../_sheets/cancel-booking-sheet/cancel-booking-sheet';
import {
  BookingOutcome,
  BookingOutcomeSheet,
} from '../_sheets/booking-outcome-sheet/booking-outcome-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { SESSION_ICONS } from '../../sessions/sessions.config';
import { MY_SESSION_ICONS } from '../my-sessions.config';

/**
 * A session the caller may not see in full — group-only, non-member.
 *
 * The flag is `isBlocked`, not `blocked`. Getting that wrong silently renders
 * the redacted payload as if it were a normal session, complete with a Book
 * button for something they cannot book.
 */
function isBlocked(
  value: PublicSessionInstance | BlockedSessionInstance,
): value is BlockedSessionInstance {
  return (value as BlockedSessionInstance).isBlocked === true;
}

/**
 * One session, from the trainee's side: what it is, when, where, who runs it,
 * and the one thing to do about it right now.
 *
 * This is where every session notification a trainee gets lands — booking
 * confirmed, approved, promoted off the waitlist, rescheduled, and both
 * reminders. It reads from the public instance endpoint, which returns the
 * session as this caller is allowed to see it, plus their own booking when
 * they have one.
 */
@Component({
  selector: 'mh-session-showcase',
  imports: [
    BookingOutcomeSheet,
    CancelBookingSheet,
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './session-showcase.html',
  styleUrl: './session-showcase.scss',
})
export class SessionShowcase {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _sessionService = inject(SessionService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly cancelOpen = signal(false);
  /** Which outcome sheet to show after a booking lands (3c / 3d / 3e). */
  readonly outcome = signal<BookingOutcome | null>(null);

  readonly instanceId = signal<string | null>(null);
  readonly session = signal<PublicSessionInstance | null>(null);
  readonly booking = signal<SessionParticipant | null>(null);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  /** Group-only session the caller is not a member of — redacted, not missing. */
  readonly blocked = signal(false);
  readonly blockedGroupId = signal<string | null>(null);
  readonly acting = signal(false);

  private readonly _template = computed(() => this.session()?.template ?? null);

  readonly title = computed(
    () => this.session()?.titleOverride ?? this._template()?.title ?? '',
  );

  readonly description = computed(() => this._template()?.description ?? null);

  /** "Thu 27 Aug, 15:00" — the one-line version for the outcome sheet. */
  readonly whenLabel = computed(() => {
    const startAt = this.session()?.startAt;
    if (!startAt) return '';
    return new Date(startAt).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  readonly dayLabel = computed(() => {
    const startAt = this.session()?.startAt;
    if (!startAt) return '';
    return new Date(startAt).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  });

  readonly timeRange = computed(() => {
    const session = this.session();
    if (!session) return '';
    return `${formatSessionTime(session.startAt)} – ${formatSessionTime(session.endAt)}`;
  });

  readonly duration = computed(() => {
    const minutes = this._template()?.durationMinutes;
    return minutes ? formatSessionDuration(minutes) : '';
  });

  readonly isOnline = computed(() => this._template()?.locationKind === 'ONLINE');

  readonly place = computed(() => {
    if (this.isOnline()) return this._template()?.meetingProvider ?? 'Online';
    return (
      this.session()?.venueOverride?.name ??
      this._template()?.venue?.name ??
      'Location to be confirmed'
    );
  });

  readonly coachName = computed(() =>
    displayName(this.session()?.instructor ?? null, 'Your coach'),
  );

  readonly coachTone = computed(() => avatarToneFor(this.session()?.instructorId));

  readonly price = computed(() => {
    const cents = this._template()?.priceAmountCents ?? 0;
    if (cents === 0) return 'Free';
    const currency = this._template()?.priceCurrency ?? '';
    return `${(cents / 100).toFixed(0)} ${currency}`.trim();
  });

  readonly spots = computed(() => {
    const session = this.session();
    const capacity = session?.capacityOverride ?? this._template()?.capacity ?? null;
    if (!capacity) return null;
    return `${session?.confirmedCount ?? 0} / ${capacity}`;
  });

  readonly isFull = computed(() => {
    const session = this.session();
    const capacity = session?.capacityOverride ?? this._template()?.capacity ?? null;
    if (!capacity) return false;
    return (session?.confirmedCount ?? 0) >= capacity;
  });

  readonly lifecycle = computed(() => {
    const session = this.session();
    if (!session) return 'upcoming' as const;
    return sessionLifecycle(session.startAt, session.endAt);
  });

  readonly isCancelled = computed(() => this.session()?.status === 'CANCELLED');

  readonly bookingStatus = computed(() => this.booking()?.status ?? null);

  /**
   * The join window the API enforces: five minutes before the start until
   * fifteen after. Both bounds matter to the UI — before it, the screen says
   * when the link unlocks; after it, the session becomes a record.
   */
  readonly joinOpensAt = computed(() => {
    const startAt = this.session()?.startAt;
    return startAt ? new Date(new Date(startAt).getTime() - 5 * 60_000) : null;
  });

  readonly joinOpensAtLabel = computed(() => {
    const at = this.joinOpensAt();
    return at ? formatSessionTime(at.toISOString()) : '';
  });

  readonly joinWindowOpen = computed(() => this.lifecycle() === 'ongoing');

  /** An online booking that has not reached its window yet. */
  readonly joinPending = computed(
    () => this.isOnline() && this.isBooked() && this.lifecycle() === 'upcoming',
  );

  /**
   * When a free cancellation stops being free, from the terms captured at
   * booking rather than whatever the template says now.
   */
  readonly cancelBy = computed(() => {
    const startAt = this.session()?.startAt;
    const hours = this.booking()?.snapshotCancelCutoffH ?? 0;
    if (!startAt || hours <= 0) return null;
    return new Date(new Date(startAt).getTime() - hours * 3_600_000);
  });

  readonly cancelByLabel = computed(() => {
    const by = this.cancelBy();
    if (!by) return null;
    return by.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  /** Past the free window — the cancel sheet gains its warning card. */
  readonly cancelIsLate = computed(() => {
    const by = this.cancelBy();
    return !!by && Date.now() > by.getTime();
  });

  readonly isBooked = computed(
    () => this.bookingStatus() === 'CONFIRMED' || this.bookingStatus() === 'PENDING_APPROVAL',
  );

  readonly isWaitlisted = computed(() => this.bookingStatus() === 'WAITLISTED');

  /**
   * The single action this screen offers. Everything else is context — a
   * screen that presents four equal buttons is a screen nobody reads.
   */
  readonly cta = computed<{
    label: string;
    kind: 'book' | 'waitlist' | 'cancel' | 'join' | 'waiting';
  } | null>(
    () => {
      // Nothing loaded means nothing to act on. Without this the defaults
      // (not booked, not full, not past) add up to "Book this session" over
      // an error state.
      if (!this.session() || this.loading() || this.loadFailed()) return null;
      if (this.isCancelled() || this.blocked()) return null;
      if (this.lifecycle() === 'past') return null;

      if (this.isBooked()) {
        // Joining beats cancelling once an online session is underway.
        if (this.isOnline() && this.joinWindowOpen()) {
          return { label: 'Join session', kind: 'join' };
        }
        // Before the window the button stays, inert, naming the unlock time —
        // an absent button reads as "there is no link", which is wrong.
        if (this.joinPending()) {
          return { label: `Join opens at ${this.joinOpensAtLabel()}`, kind: 'waiting' };
        }
        return { label: 'Cancel booking', kind: 'cancel' };
      }
      if (this.isWaitlisted()) return { label: 'Leave waitlist', kind: 'cancel' };
      if (this.isFull()) return { label: 'Join waitlist', kind: 'waitlist' };
      return { label: 'Book this session', kind: 'book' };
    },
  );

  /** Why the action is missing, when it is. Silence reads as a broken screen. */
  readonly ctaNote = computed(() => {
    // The blocked case has its own card, so no note.
    if (this.blocked()) return null;
    if (this.isCancelled()) return 'This session was cancelled.';
    if (this.lifecycle() === 'past') return 'This session has finished.';
    return null;
  });

  constructor() {
    addIcons({ ...SESSION_ICONS, ...MY_SESSION_ICONS });

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.instanceId.set(id);
      if (id) this._load(id);
    });
  }

  async act(): Promise<void> {
    const kind = this.cta()?.kind;
    if (!kind || this.acting()) return;

    if (kind === 'waiting') return;
    if (kind === 'join') return this._join();
    if (kind === 'cancel') {
      this.cancelOpen.set(true);
      return;
    }
    return this._book();
  }

  /**
   * Groups have no mobile screen yet, so this opens the web app rather than
   * routing nowhere. It becomes an in-app route the day groups ship.
   */
  openGroup(): void {
    const groupId = this.blockedGroupId();
    if (groupId) window.open(`${WEB_APP_URL}/groups/${groupId}`, '_blank', 'noopener');
  }

  messageCoach(): void {
    const instructorId = this.session()?.instructorId;
    if (!instructorId) return;
    void this._router.navigate(['/tabs/messages/new'], {
      queryParams: { to: instructorId, name: this.coachName() },
    });
  }

  retry(): void {
    const id = this.instanceId();
    if (id) this._load(id);
  }

  private _load(instanceId: string): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.blocked.set(false);

    this._sessionService
      .getPublicInstance(instanceId)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          if (isBlocked(result)) {
            this.blocked.set(true);
            this.blockedGroupId.set(result.template?.groupId ?? null);
            this.session.set(result as unknown as PublicSessionInstance);
          } else {
            this.blockedGroupId.set(null);
            this.session.set(result);
          }
          this.loading.set(false);
          this._loadBooking(instanceId);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  /**
   * The public instance says nothing about *this* caller's booking, so the
   * screen asks their own list. Cheap, and it keeps the public endpoint free
   * of per-caller state.
   *
   * It asks every bucket that can hold a live booking rather than working out
   * which one should. Two attempts to be clever were both wrong: the default
   * bucket alone missed anything already started, and picking by lifecycle
   * missed it the other way — the server keeps a *running* session in
   * `upcoming`, while `sessionLifecycle` calls it `ongoing`. The buckets are
   * disjoint, so asking all four costs four small requests and cannot be
   * wrong. Cancelled is left out on purpose: a cancelled booking means they
   * can book again, which is what a null booking already renders.
   */
  private _loadBooking(instanceId: string): void {
    const buckets: MyTab[] = ['upcoming', 'pendingApproval', 'waitlisted', 'past'];

    forkJoin(buckets.map((tab) => this._sessionService.listMy({ tab, limit: 100 })))
      .pipe(take(1))
      .subscribe({
        next: (responses) => {
          const mine = responses
            .flatMap((response) => response.items)
            .find((row) => row.instanceId === instanceId);
          this.booking.set(mine ?? null);
        },
      });
  }

  private _book(): void {
    const instanceId = this.instanceId();
    if (!instanceId) return;
    this.acting.set(true);

    this._sessionService
      .book(instanceId)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.acting.set(false);
          // Same tap, three landings — the sheet says which one happened and
          // what to expect next, which a toast cannot.
          this.outcome.set(result.status as BookingOutcome);
          this._load(instanceId);
        },
        error: (error: unknown) => {
          this.acting.set(false);
          void this._feedbackService.error(error, 'Could not book this session.');
        },
      });
  }

  /**
   * Cancelling can cost money — the cutoff is captured on the booking at the
   * moment it was made, not read live off the template — so it asks first and
   * says what the terms were.
   */
  /** Called by the confirm sheet, which owns the copy and the warning. */
  confirmCancel(): void {
    const instanceId = this.instanceId();
    if (!instanceId) return;
    this.acting.set(true);

    this._sessionService
      .cancelBooking(instanceId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.acting.set(false);
          this.cancelOpen.set(false);
          void this._feedbackService.success('Booking cancelled');
          this._load(instanceId);
        },
        error: (error: unknown) => {
          this.acting.set(false);
          void this._feedbackService.error(error, 'Could not cancel this booking.');
        },
      });
  }

  /** core's `downloadIcs` fetches and triggers the file; nothing to add here. */
  addToCalendar(): void {
    const instanceId = this.instanceId();
    if (!instanceId) return;
    this._sessionService
      .downloadIcs(instanceId, `${this.title() || 'session'}.ics`)
      .pipe(take(1))
      .subscribe({
        error: (error: unknown) =>
          void this._feedbackService.error(error, 'Could not build the calendar file.'),
      });
  }

  /**
   * The meeting URL is fetched on demand rather than carried on the session:
   * the public shape redacts it, and `join-info` is the endpoint that checks
   * you are actually booked before handing it over.
   */
  private _join(): void {
    const instanceId = this.instanceId();
    if (!instanceId) return;
    this.acting.set(true);

    this._sessionService
      .joinInfo(instanceId)
      .pipe(take(1))
      .subscribe({
        next: (info) => {
          this.acting.set(false);
          window.open(info.meetingUrl, '_blank', 'noopener');
        },
        error: (error: unknown) => {
          this.acting.set(false);
          void this._feedbackService.error(error, 'The meeting link is not available yet.');
        },
      });
  }
}
