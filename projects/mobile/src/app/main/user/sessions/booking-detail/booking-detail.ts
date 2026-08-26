import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonProgressBar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewDidEnter,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  MyBookingsIndexStore,
  SessionAccess,
  SessionLocationKind,
  SessionParticipant,
  SessionParticipantStatus,
  SessionService,
  bookingCancelBy,
  formatSessionDayShort,
  formatSessionTime,
  isBlockedInstance,
  meetingProviderLabel,
  sessionLifecycle,
  sessionMinutes,
  sessionTypeLabel,
  sessionTypeTone,
} from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { ClockService } from '../../../../_shared/services/clock.service';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { injectOpenDirectMessage } from '../../../../_shared/utils/direct-message';
import { copyToClipboard } from '../../../../_shared/utils/share';
import { BookingOutcomeSheet } from '../_sheets/booking-outcome-sheet/booking-outcome-sheet';
import { CancelBookingSheet } from '../_sheets/cancel-booking-sheet/cancel-booking-sheet';
import {
  DetailViews,
  MY_SESSION_ICONS,
  bookingJoinWindow,
  bookingPriceLabel,
  detailView,
} from '../my-sessions.config';
import { BookingDetailStore } from './booking-detail.store';

/** How often the open page pulls the clock forward, so the 3g→3h flip —
    "Join · opens 17:55" unlocking into "Join session" — happens in place. */
const CLOCK_TICK_MS = 20_000;

interface StatusBand {
  tone: 'success' | 'warn' | 'info' | 'live';
  icon: string | null;
  title: string;
  detail: string;
}

/**
 * The trainee's session detail: the public instance with their own booking
 * laid over it. One state machine (`detailView`) picks between the design's
 * screens — booked in person, online before/inside the join window, awaiting
 * approval, waitlisted, the members-only redaction, the record — and the
 * showcase with Book for a session not yet booked.
 *
 * The coach twin is `../../coach/sessions/session-detail`; the hero, card
 * and footer idioms are copied from it, not shared — the two screens answer
 * different questions and would fight over every conditional.
 */
@Component({
  selector: 'mh-booking-detail',
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
    IonProgressBar,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './booking-detail.html',
  styleUrl: './booking-detail.scss',
  providers: [BookingDetailStore],
})
export class BookingDetail implements ViewWillEnter, ViewDidEnter, ViewWillLeave {
  readonly store = inject(BookingDetailStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _clockService = inject(ClockService);
  private readonly _sessionService = inject(SessionService);
  private readonly _myBookingsIndexStore = inject(MyBookingsIndexStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _openDirectMessage = injectOpenDirectMessage();

  readonly Views = DetailViews;

  /**
   * The stack this page was pushed onto. It is mounted under two tabs —
   * the trainee sessions area and Discover (`discover/:id`) — and the
   * settled rule is that back returns to origin, so the back fallback and
   * both in-page navigations follow whichever stack the URL is in.
   */
  readonly stackBase = computed(() =>
    this._router.url.startsWith('/tabs/discover')
      ? '/tabs/discover'
      : '/tabs/user/sessions',
  );

  readonly skeletonRows = [1, 2, 3];

  readonly cancelOpen = signal(false);
  readonly outcomeOpen = signal(false);
  readonly outcomeStatus = signal<SessionParticipantStatus | null>(null);
  readonly bookingInFlight = signal(false);

  private _loadedId: string | null = null;
  private _tick: ReturnType<typeof setInterval> | undefined;

  constructor() {
    addIcons(MY_SESSION_ICONS);
    this._destroyRef.onDestroy(() => this._stopTick());

    // Ionic mounts a fresh page per pushed id, but a same-id return from the
    // person page re-enters this one — the param stream covers both.
    this._route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (!id || id === this._loadedId) return;
      this._loadedId = id;
      this.store.load(id, this._stateParticipant());
    });
  }

  // ─── Derived state ───────────────────────────────────────────────────────

  /** The instance when it is NOT the members-only redaction. */
  readonly publicInstance = computed(() => {
    const instance = this.store.instance();
    return instance && !isBlockedInstance(instance) ? instance : null;
  });

  readonly blockedInstance = computed(() => {
    const instance = this.store.instance();
    return instance && isBlockedInstance(instance) ? instance : null;
  });

  readonly view = computed(() =>
    detailView(
      this.store.instance(),
      this.store.booking(),
      this.store.joinInfo(),
      this._clockService.now(),
    ),
  );

  readonly title = computed(() => {
    const blocked = this.blockedInstance();
    if (blocked) return blocked.template.title;
    const instance = this.publicInstance();
    return instance?.titleOverride ?? instance?.template?.title ?? 'Session';
  });

  /** "Sat 23 May · 08:00 – 09:30 · 90 min" */
  readonly dateLine = computed(() => {
    const instance = this.store.instance();
    if (!instance) return '';
    const minutes = this.publicInstance()
      ? sessionMinutes(this.publicInstance()!)
      : this.blockedInstance()!.template.durationMinutes;
    return [
      formatSessionDayShort(instance.startAt),
      `${formatSessionTime(instance.startAt)} – ${formatSessionTime(instance.endAt)}`,
      minutes ? `${minutes} min` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  /**
   * Wash tint: violet says members-only, teal says online, otherwise the
   * session type's own tone (honey group, navy 1-on-1, teal open) — the same
   * vocabulary the coach detail paints with.
   */
  readonly heroTone = computed(() => {
    if (this.blockedInstance()) return 'violet';
    const template = this.publicInstance()?.template;
    if (!template) return null;
    if (template.locationKind === SessionLocationKind.Online) return 'teal';
    return sessionTypeTone(template.type);
  });

  readonly heroBadges = computed<{ label: string; tone: string }[]>(() => {
    const badges: { label: string; tone: string }[] = [];

    // The redacted payload carries only the template's identity fields.
    const blocked = this.blockedInstance();
    if (blocked) {
      badges.push({ label: sessionTypeLabel(blocked.template.type), tone: 'type' });
      badges.push({ label: 'Members only', tone: 'violet' });
      return badges;
    }

    const template = this.publicInstance()?.template;
    if (!template) return badges;

    badges.push({ label: sessionTypeLabel(template.type), tone: 'type' });
    if (template.access === SessionAccess.GroupOnly) {
      badges.push({ label: 'Members only', tone: 'violet' });
    }
    badges.push(
      template.locationKind === SessionLocationKind.Online
        ? { label: meetingProviderLabel(template.meetingProvider), tone: 'place' }
        : { label: 'In person', tone: 'place' },
    );

    // A record's one fact worth a badge: whether they made it.
    if (this.view() === DetailViews.Past) {
      const attended = this.store.booking()?.attended;
      if (attended === true) badges.push({ label: 'Attended', tone: 'success' });
      if (attended === false) badges.push({ label: 'Missed', tone: 'medium' });
    }
    return badges;
  });

  /** The status band under the title — the screen's one-line answer. */
  readonly band = computed<StatusBand | null>(() => {
    const view = this.view();
    const booking = this.store.booking();
    switch (view) {
      case DetailViews.BookedInPerson:
      case DetailViews.OnlinePre:
        return {
          tone: 'success',
          icon: 'checkmark-circle-outline',
          title: "You're booked",
          detail: this._cancelByLine(booking),
        };
      case DetailViews.OnlineLive:
        return {
          tone: 'live',
          icon: null,
          title: 'Live now',
          detail: this._liveLine(),
        };
      case DetailViews.Pending: {
        const first = this.coach()?.firstName?.trim();
        return {
          tone: 'warn',
          icon: 'hourglass-outline',
          title: 'Awaiting approval',
          detail: first
            ? `${first} approves bookings for this session — you'll get a notification either way.`
            : "You'll get a notification either way — nothing else to do.",
        };
      }
      case DetailViews.Waitlist:
        return {
          tone: 'info',
          icon: 'time-outline',
          title: "You're on the waitlist",
          detail: "If a spot opens you're booked automatically — we'll notify you.",
        };
      default:
        return null;
    }
  });

  readonly coach = computed(() => {
    const blocked = this.blockedInstance();
    if (blocked) return blocked.instructor;
    const instance = this.publicInstance();
    return instance?.instructor ?? instance?.template?.instructor ?? null;
  });

  readonly coachName = computed(() => {
    const coach = this.coach();
    return coach ? `${coach.firstName} ${coach.lastName}`.trim() : '';
  });

  readonly whereLabel = computed(() => {
    const instance = this.publicInstance();
    return (
      instance?.venueOverride?.name ??
      instance?.template?.venue?.name ??
      this.store.booking()?.snapshotLocationText ??
      'To be announced'
    );
  });

  readonly whereCity = computed(
    () => this.publicInstance()?.venueOverride?.city ?? null,
  );

  readonly isOnlineSession = computed(
    () =>
      this.publicInstance()?.template?.locationKind === SessionLocationKind.Online,
  );

  readonly providerLabel = computed(() =>
    meetingProviderLabel(this.publicInstance()?.template?.meetingProvider),
  );

  /** The link, when we hold one — `joinInfo` is the only source for a
      list-loaded booking; the snapshot covers a state-passed one. */
  readonly meetingUrl = computed(
    () =>
      this.store.joinInfo()?.meetingUrl ??
      this.store.booking()?.snapshotMeetingUrl ??
      null,
  );

  /** "Available from 17:55" / "Join · opens 17:55". */
  readonly unlockTime = computed(() => {
    const instance = this.publicInstance();
    if (!instance) return '';
    const { from } = bookingJoinWindow(instance.startAt, this.store.joinInfo());
    return formatSessionTime(from.toISOString());
  });

  readonly priceLabel = computed(() => {
    const booking = this.store.booking();
    if (booking) {
      return bookingPriceLabel(booking.snapshotPriceCents, booking.snapshotCurrency);
    }
    const template = this.publicInstance()?.template;
    if (!template) return '';
    return bookingPriceLabel(template.priceAmountCents, template.priceCurrency);
  });

  readonly isFree = computed(() => this.priceLabel() === 'Free');

  readonly capacity = computed(() => {
    const instance = this.publicInstance();
    if (!instance) return null;
    return instance.capacityOverride ?? instance.template?.capacity ?? null;
  });

  readonly spotsLabel = computed(() => {
    const capacity = this.capacity();
    const taken = this.publicInstance()?.confirmedCount ?? 0;
    return capacity === null ? '' : `${taken} of ${capacity} booked`;
  });

  readonly spotsProgress = computed(() => {
    const capacity = this.capacity();
    if (!capacity) return 0;
    return Math.min(1, (this.publicInstance()?.confirmedCount ?? 0) / capacity);
  });

  readonly isFull = computed(() => {
    const capacity = this.capacity();
    if (capacity === null) return false;
    return (this.publicInstance()?.confirmedCount ?? 0) >= capacity;
  });

  /** What the showcase footer offers: book, join the waitlist, or nothing. */
  readonly bookAction = computed<'book' | 'waitlist' | 'full' | null>(() => {
    const instance = this.publicInstance();
    if (this.view() !== DetailViews.Showcase || !instance) return null;
    if (sessionLifecycle(instance.startAt, instance.endAt) === 'past') return null;
    if (!this.isFull()) return 'book';
    return instance.template?.waitlistEnabled ? 'waitlist' : 'full';
  });

  readonly showFooter = computed(() => {
    const view = this.view();
    if (view === DetailViews.Showcase) return this.bookAction() !== null;
    return (
      view === DetailViews.BookedInPerson ||
      view === DetailViews.OnlinePre ||
      view === DetailViews.OnlineLive ||
      view === DetailViews.Pending ||
      view === DetailViews.Waitlist
    );
  });

  /** "Cancelled Mon 18 May · everyone booked was notified." */
  readonly cancelledDetail = computed(() => {
    const cancelledAt = this.publicInstance()?.cancelledAt;
    return cancelledAt
      ? `Cancelled ${formatSessionDayShort(cancelledAt)} · everyone booked was notified.`
      : 'Everyone booked was notified.';
  });

  /** "Sat 23 May, 08:00" — the When row. */
  readonly whenLabel = computed(() => {
    const instance = this.store.instance();
    if (!instance) return '';
    return `${formatSessionDayShort(instance.startAt)}, ${formatSessionTime(instance.startAt)}`;
  });

  /** The .ics is worth offering only to a confirmed seat — the endpoint
      404s gated sessions for everyone else anyway. */
  readonly canAddToCalendar = computed(
    () => this.store.booking()?.status === SessionParticipantStatus.Confirmed,
  );

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  ionViewWillEnter(): void {
    this._clockService.bump();
    // Coming back from person/chat: the roster may have moved underneath us.
    if (this._loadedId) this.store.reload({ silent: true });
  }

  // The one screen where an unattended value change IS the feature: someone
  // staring at "Join · opens 17:55" must see it unlock. A page-scoped tick
  // that pulls the shared clock — never an app-lifetime timer (ClockService
  // documents why), and never while this page is off screen.
  ionViewDidEnter(): void {
    this._stopTick();
    this._tick = setInterval(() => this._clockService.bump(), CLOCK_TICK_MS);
  }

  ionViewWillLeave(): void {
    this._stopTick();
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  book(): void {
    const id = this._loadedId;
    if (!id || this.bookingInFlight()) return;
    this.bookingInFlight.set(true);

    this._sessionService
      .book(id)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.bookingInFlight.set(false);
          this.outcomeStatus.set(result.status);
          this.outcomeOpen.set(true);
          this._myBookingsIndexStore.invalidate();
          this._myBookingsIndexStore.ensureLoaded(true);
          this.store.reload({ silent: true });
        },
        error: (error: unknown) => {
          this.bookingInFlight.set(false);
          void this._feedbackService.error(error, "Couldn't book this session.");
        },
      });
  }

  openCancel(): void {
    this.cancelOpen.set(true);
  }

  onCancelled(): void {
    this.store.clearStateParticipant();
    this._myBookingsIndexStore.invalidate();
    this._myBookingsIndexStore.ensureLoaded(true);
    void this._router.navigate([this.stackBase()]);
  }

  joinSession(): void {
    const url = this.meetingUrl();
    if (url) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    const id = this._loadedId;
    if (!id) return;
    this._sessionService
      .joinInfo(id)
      .pipe(take(1))
      .subscribe({
        next: (info) => window.open(info.meetingUrl, '_blank', 'noopener'),
        error: (error: unknown) =>
          void this._feedbackService.error(error, "Couldn't get the meeting link."),
      });
  }

  async copyMeetingUrl(): Promise<void> {
    const url = this.meetingUrl();
    if (!url) return;
    const copied = await copyToClipboard(url);
    if (copied) await this._feedbackService.success('Link copied');
    else await this._feedbackService.error(null, "Couldn't copy the link.");
  }

  addToCalendar(): void {
    const id = this._loadedId;
    if (!id) return;
    this._sessionService
      .downloadIcs(id)
      .pipe(take(1))
      .subscribe({
        next: () => void this._feedbackService.success('Calendar file downloaded'),
        error: (error: unknown) =>
          void this._feedbackService.error(error, "Couldn't download the invite."),
      });
  }

  messageCoach(): void {
    const coach = this.coach();
    if (coach) this._openDirectMessage(coach);
  }

  openCoach(): void {
    const handle = this.coach()?.handle;
    if (handle) void this._router.navigate([this.stackBase(), 'person', handle]);
  }

  onOutcomeDone(): void {
    this.outcomeOpen.set(false);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _stopTick(): void {
    if (this._tick) {
      clearInterval(this._tick);
      this._tick = undefined;
    }
  }

  private _stateParticipant(): SessionParticipant | null {
    const state = history.state as { participant?: SessionParticipant } | null;
    return state?.participant ?? null;
  }

  private _cancelByLine(booking: SessionParticipant | null): string {
    const startAt = this.publicInstance()?.startAt;
    const cutoff = booking?.snapshotCancelCutoffH ?? 0;
    const cancelBy = startAt ? bookingCancelBy(startAt, cutoff) : null;
    if (!cancelBy) return 'Free to cancel any time before it starts';
    const iso = cancelBy.toISOString();
    return `Free to cancel until ${formatSessionDayShort(iso)} ${formatSessionTime(iso)} · ${cutoff} h before start`;
  }

  /** "Started 2 min ago · join closes 18:15" — or the pre-start variant. */
  private _liveLine(): string {
    const instance = this.publicInstance();
    if (!instance) return '';
    const { until } = bookingJoinWindow(instance.startAt, this.store.joinInfo());
    const closes = `join closes ${formatSessionTime(until.toISOString())}`;
    const now = this._clockService.now();
    const sinceStart = Math.round((now - new Date(instance.startAt).getTime()) / 60_000);
    if (sinceStart < 0) return `Starts in ${-sinceStart} min · ${closes}`;
    if (sinceStart === 0) return `Starting now · ${closes}`;
    return `Started ${sinceStart} min ago · ${closes}`;
  }
}
