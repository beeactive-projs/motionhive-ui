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
  IonProgressBar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  AuthStore,
  SessionInstance,
  SessionParticipant,
  SessionsDetailStore,
  detectMeetingProvider,
  displayName,
  formatRelativeShort,
  formatSessionDayShort,
  formatSessionDuration,
  formatSessionTime,
  formatTimeUntil,
  publicProfileUrl,
  sessionLifecycle,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { ClockService } from '../../../_shared/services/clock.service';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { AvatarTone, avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { ShareOutcomes, copyToClipboard, shareOrCopy } from '../../../_shared/utils/share';
import { CancelSessionSheet } from '../_sheets/cancel-session-sheet/cancel-session-sheet';
import { MessageSignupsSheet } from '../_sheets/message-signups-sheet/message-signups-sheet';
import { ParticipantNoteSheet } from '../_sheets/participant-note-sheet/participant-note-sheet';
import { SessionActionsSheet } from '../_sheets/session-actions-sheet/session-actions-sheet';
import { SessionFormSheet } from '../_sheets/session-form-sheet/session-form-sheet';
import {
  SESSION_ICONS,
  SessionActionId,
  SessionActionIds,
  SessionPrefill,
  formatWeekdayList,
  prefillFromInstance,
} from '../sessions.config';

/** Provider names as people write them, for the Join button. */
const MEETING_PROVIDER_NAMES: Record<string, string> = {
  ZOOM: 'Zoom',
  GOOGLE_MEET: 'Google Meet',
  TEAMS: 'Teams',
};

/**
 * When the API schedules reminders — `startAt` minus each offset. Mirrored from
 * the BE's booking flow, which writes exactly these two and only when they are
 * still in the future at the time of booking.
 */
const REMINDER_OFFSETS = [
  { label: '24 hours before', offsetMs: 24 * 3_600_000 },
  { label: '1 hour before', offsetMs: 3_600_000 },
];

interface ReminderRow {
  label: string;
  detail: string;
}

/**
 * One occurrence: when, where, who is coming, and the one action that makes
 * sense right now.
 *
 * `SessionsDetailStore` is page-scoped by design, so it is provided here rather
 * than at root — two sessions open in a stack keep their own participants.
 */
@Component({
  selector: 'mh-session-detail',
  providers: [SessionsDetailStore],
  imports: [
    CancelSessionSheet,
    EmptyState,
    MessageSignupsSheet,
    HexAvatar,
    ParticipantNoteSheet,
    SessionActionsSheet,
    SessionFormSheet,
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
    IonProgressBar,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './session-detail.html',
  styleUrl: './session-detail.scss',
})
export class SessionDetail implements ViewWillEnter {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _authStore = inject(AuthStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _clockService = inject(ClockService);
  readonly store = inject(SessionsDetailStore);

  readonly cancelOpen = signal(false);
  readonly actionsOpen = signal(false);
  readonly duplicateOpen = signal(false);
  readonly duplicatePrefill = signal<SessionPrefill | null>(null);
  readonly noteOpen = signal(false);
  readonly noteParticipant = signal<SessionParticipant | null>(null);
  readonly skeletonRows = [1, 2, 3];

  /** No handle, no public link — so the Share verb stays hidden. */
  readonly canShare = computed(() => !!this._authStore.user()?.handle);

  readonly instance = this.store.instance;
  readonly template = this.store.template;

  readonly title = computed(
    () => this.instance()?.titleOverride ?? this.template()?.title ?? '',
  );

  readonly isOnline = computed(() => this.template()?.locationKind === 'ONLINE');

  /**
   * Derived from the timestamps, not `instance.status`: the status cron runs
   * hourly, so a session can be underway while the row still reads SCHEDULED.
   */
  readonly lifecycle = computed(() => {
    const instance = this.instance();
    if (!instance) return 'upcoming' as const;
    return sessionLifecycle(instance.startAt, instance.endAt);
  });

  readonly isCancelled = computed(() => this.instance()?.status === 'CANCELLED');

  readonly timeRange = computed(() => {
    const instance = this.instance();
    if (!instance) return '';
    return `${formatSessionTime(instance.startAt)} – ${formatSessionTime(instance.endAt)}`;
  });

  readonly durationLabel = computed(() => {
    const minutes = this.template()?.durationMinutes;
    return minutes ? formatSessionDuration(minutes) : '';
  });

  readonly dayLabel = computed(() => {
    const instance = this.instance();
    if (!instance) return '';
    return new Date(instance.startAt).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  });

  readonly recurrenceLabel = computed(() => {
    const template = this.template();
    if (!template?.isRecurring) return null;
    const days = formatWeekdayList(template.recurrenceRule?.daysOfWeek ?? []);
    return days ? `Repeats ${days}` : 'Repeats';
  });

  readonly locationLabel = computed(() => {
    if (this.isOnline()) return this.template()?.meetingProvider ?? 'Online';
    return (
      this.instance()?.venueOverride?.name ?? this.template()?.venue?.name ?? 'No venue set'
    );
  });

  readonly meetingUrl = computed(
    () => this.instance()?.meetingUrlOverride ?? this.template()?.meetingUrl ?? null,
  );

  readonly counts = this.store.counts;

  readonly capacity = computed(
    () => this.instance()?.capacityOverride ?? this.template()?.capacity ?? null,
  );

  /**
   * From the loaded roster, not `instance.confirmedCount`. Approving does not
   * refetch the instance, so the denormalised counter goes stale the moment a
   * request is accepted — and the bar would then disagree with the list right
   * below it.
   */
  readonly confirmed = computed(() => this.counts().confirmed);

  /** 0–100 for the spots bar; an uncapped session has nothing to fill. */
  readonly fillPercent = computed(() => {
    const capacity = this.capacity();
    if (!capacity) return 0;
    return Math.min(100, Math.round((this.confirmed() / capacity) * 100));
  });

  readonly spotsLabel = computed(() => {
    const capacity = this.capacity();
    return capacity ? `${this.confirmed()} / ${capacity}` : `${this.confirmed()} booked`;
  });

  readonly price = computed(() => {
    const cents = this.template()?.priceAmountCents ?? 0;
    if (cents === 0) return null;
    return `${(cents / 100).toFixed(0)} ${this.template()?.priceCurrency ?? ''}`.trim();
  });

  /** Nothing to do on a cancelled session. */
  readonly showCta = computed(() => !this.isCancelled());

  /**
   * "Starts in 4 min" / "Live now" — the one thing worth saying at the top of
   * an imminent session.
   *
   * Deliberately says nothing about who has joined. The design shows a lobby
   * count, but `joinInfo` requires the caller to be a CONFIRMED participant and
   * 403s for the coach on their own session, and `instructorJoined` is a
   * hardcoded false on the API. There is no join telemetry to report, and
   * inferring it from `confirmedCount` would be inventing it.
   */
  readonly liveNote = computed(() => {
    const instance = this.instance();
    if (!instance || this.isCancelled()) return null;
    if (this.lifecycle() === 'ongoing') return 'Live now';
    if (this.lifecycle() === 'past') return null;
    return formatTimeUntil(instance.startAt, this._clockService.now());
  });

  /** Named after the provider, so the button says where it is taking you. */
  readonly joinLabel = computed(() => {
    const provider =
      this.template()?.meetingProvider ?? detectMeetingProvider(this.meetingUrl());
    return provider ? `Join ${MEETING_PROVIDER_NAMES[provider]}` : 'Join meeting';
  });

  /**
   * When the automatic reminders are due.
   *
   * Derived, not fetched — no endpoint exposes the reminder schedule — so these
   * are worded as the schedule they are, never as deliveries. The API only
   * writes a reminder that is still in the future when the booking is made, so
   * claiming "sent" would be wrong for anyone who booked late.
   */
  readonly reminders = computed<ReminderRow[]>(() => {
    const instance = this.instance();
    if (!instance || this.isCancelled() || this.lifecycle() !== 'upcoming') return [];

    const start = new Date(instance.startAt).getTime();
    if (Number.isNaN(start)) return [];

    return REMINDER_OFFSETS.map(({ label, offsetMs }) => ({
      label,
      detail: new Date(start - offsetMs).toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    }));
  });

  /**
   * "9 of 12 attended" — from the roster, not `instance.attendedCount`.
   *
   * The denormalised counter is not refetched when a mark changes, so it would
   * disagree with the list directly beneath it the instant anyone is ticked.
   */
  readonly attendanceSummary = computed(() => {
    if (this.lifecycle() === 'upcoming') return null;
    const { attended } = this.counts();
    const total = this.attendees().length;
    if (total === 0) return null;
    return `${attended} of ${total} attended`;
  });

  /** Everyone but the waitlist — those get their own section below. */
  readonly attendees = computed(() =>
    this.store.participants().filter((p) => p.status !== 'WAITLISTED'),
  );

  /**
   * The queue, oldest first. `waitlistPosition` is a real column but is only
   * ever written as null, so arrival order is the only ordering there is —
   * which is also the order the BE promotes in.
   */
  readonly waitlist = computed(() =>
    this.store
      .participants()
      .filter((p) => p.status === 'WAITLISTED')
      .sort((a, b) => new Date(a.bookedAt).getTime() - new Date(b.bookedAt).getTime()),
  );

  /** Marking who turned up only makes sense once the session has started. */
  readonly canMarkAttendance = computed(() => this.lifecycle() !== 'upcoming');

  /** Who the message sheet is addressed to this time. */
  readonly messageAudience = signal<'all' | 'userIds'>('all');
  readonly messageOpen = signal(false);

  readonly messageRecipients = computed(() =>
    this.messageAudience() === 'userIds'
      ? this.waitlist().map((p) => p.userId)
      : [],
  );

  readonly messageLabel = computed(() =>
    this.messageAudience() === 'userIds'
      ? `the ${this.waitlist().length} people waiting`
      : 'everyone booked in',
  );

  constructor() {
    addIcons(SESSION_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) this.store.load(id);
    });
  }

  /**
   * Ionic keeps this page alive in the stack, so coming back to it from a tab
   * would otherwise render "starts in 40 min" from whenever it was first
   * opened. The clock is pulled, not ticked — see `ClockService`.
   */
  ionViewWillEnter(): void {
    this._clockService.bump();
  }

  /** "2h" / "yesterday" — how long they have been in the queue. */
  waitingSince(participant: SessionParticipant): string {
    return formatRelativeShort(participant.bookedAt);
  }

  nameOf(participant: SessionParticipant): string {
    return displayName(participant.user, 'Someone');
  }

  toneFor(participant: SessionParticipant): AvatarTone {
    return avatarToneFor(participant.userId);
  }

  /** Confirmed / pending / attended / no-show, as a badge colour. */
  statusColor(participant: SessionParticipant): string {
    if (participant.attended === true) return 'success';
    if (participant.attended === false) return 'danger';
    return participant.status === 'CONFIRMED' ? 'success' : 'medium';
  }

  statusLabel(participant: SessionParticipant): string {
    if (participant.attended === true) return 'Attended';
    if (participant.attended === false) return 'No-show';
    if (participant.status === 'PENDING_APPROVAL') return 'Pending';
    if (participant.status === 'WAITLISTED') return 'Waitlist';
    return 'Confirmed';
  }

  /** Approve/decline only make sense while a request is still pending. */
  isPending(participant: SessionParticipant): boolean {
    return participant.status === 'PENDING_APPROVAL';
  }

  approve(participant: SessionParticipant): void {
    this.store.approve(participant.id);
  }

  decline(participant: SessionParticipant): void {
    this.store.decline(participant.id);
  }

  /**
   * Attendance has three states, not two.
   *
   * A checkbox can only say true or false, which conflates "did not turn up"
   * with "not marked yet" — and those are very different things to a coach
   * looking back at a class they have not finished registering. Tapping the
   * active choice clears it back to unmarked.
   */
  setAttendance(participant: SessionParticipant, attended: boolean): void {
    this.store.setAttendance(
      participant.id,
      participant.attended === attended ? null : attended,
    );
  }

  /** Copy the meeting link — the row's whole purpose on an online session. */
  async copyMeetingUrl(): Promise<void> {
    const url = this.meetingUrl();
    if (!url) return;
    if (await copyToClipboard(url)) {
      await this._feedbackService.success('Link copied');
    } else {
      await this._feedbackService.error(null, 'Could not copy the link.');
    }
  }

  openNote(participant: SessionParticipant): void {
    this.noteParticipant.set(participant);
    this.noteOpen.set(true);
  }

  /** The coach's private note on one attendee — never shown to them. */
  noteFor(participant: SessionParticipant): string | null {
    return participant.privateNote ?? null;
  }

  onNoteSaved(note: string | null): void {
    const participant = this.noteParticipant();
    if (participant) this.store.setPrivateNote(participant.id, note);
  }

  duplicateThis(): void {
    const instance = this.instance();
    if (!instance) return;
    this.duplicatePrefill.set(prefillFromInstance(instance));
    this.duplicateOpen.set(true);
  }

  openProfile(participant: SessionParticipant): void {
    const handle = participant.user?.handle;
    if (handle) void this._router.navigate(['/tabs/sessions/person', handle]);
  }

  /** No handle, no profile to open — the row stays inert rather than 404ing. */
  hasProfile(participant: SessionParticipant): boolean {
    return !!participant.user?.handle;
  }

  messageSignups(): void {
    this.messageAudience.set('all');
    this.messageOpen.set(true);
  }

  messageWaitlist(): void {
    if (this.waitlist().length === 0) return;
    this.messageAudience.set('userIds');
    this.messageOpen.set(true);
  }

  openCancel(): void {
    this.cancelOpen.set(true);
  }

  onCancelled(): void {
    void this._router.navigate(['/tabs/sessions']);
  }

  openActions(): void {
    this.actionsOpen.set(true);
  }

  /**
   * The same verb sheet the agenda rows use, so one session offers one set of
   * actions wherever you reach it from.
   *
   * Open and check-in are no-ops here — this *is* the session, and attendance
   * is the list further down the page — so both just close the sheet. Cancel
   * opens in place rather than navigating, which is the one thing that differs
   * from the agenda's handling.
   */
  async onAction(id: SessionActionId): Promise<void> {
    const instance = this.instance();
    if (!instance) return;

    switch (id) {
      case SessionActionIds.Cancel:
        this.openCancel();
        return;
      case SessionActionIds.Message:
        this.messageSignups();
        return;
      case SessionActionIds.Duplicate:
        // Opened here rather than bounced back to the agenda: this screen
        // already holds the instance and its template, so there is nothing to
        // pass and nothing to reload.
        this.duplicatePrefill.set(prefillFromInstance(instance));
        this.duplicateOpen.set(true);
        return;
      case SessionActionIds.Share:
        await this._share(instance);
        return;
      default:
        return;
    }
  }

  private async _share(instance: SessionInstance): Promise<void> {
    const handle = this._authStore.user()?.handle;
    if (!handle) return;

    const title = this.title() || 'Session';
    const when = `${formatSessionDayShort(instance.startAt)}, ${formatSessionTime(instance.startAt)}`;

    const outcome = await shareOrCopy({
      title,
      text: `${title} · ${when}`,
      url: publicProfileUrl(handle),
    });

    if (outcome === ShareOutcomes.Copied) {
      await this._feedbackService.success('Link copied');
    } else if (outcome === ShareOutcomes.Failed) {
      await this._feedbackService.error(null, 'Could not share the link.');
    }
  }
}
