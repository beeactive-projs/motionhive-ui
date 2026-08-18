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
  SessionAccess,
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
import {
  HexAvatar,
  HexAvatarTone,
  HexAvatarTones,
} from '../../../_shared/components/hex-avatar/hex-avatar';
import { ClockService } from '../../../_shared/services/clock.service';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { AvatarTone, avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { ShareOutcomes, copyToClipboard, shareOrCopy } from '../../../_shared/utils/share';
import { CapacitySheet } from '../_sheets/capacity-sheet/capacity-sheet';
import { CancelSessionSheet } from '../_sheets/cancel-session-sheet/cancel-session-sheet';
import { MessageSignupsSheet } from '../_sheets/message-signups-sheet/message-signups-sheet';
import { ParticipantNoteSheet } from '../_sheets/participant-note-sheet/participant-note-sheet';
import { SessionActionsSheet } from '../_sheets/session-actions-sheet/session-actions-sheet';
import { SessionFormSheet } from '../_sheets/session-form-sheet/session-form-sheet';
import {
  SESSION_ACCESS_OPTIONS,
  SESSION_ICONS,
  SessionActionId,
  SessionActionIds,
  SessionPrefill,
  SessionSurfaces,
  formatRecurrenceSummary,
  prefillFromInstance,
  sessionTypeLabel,
} from '../sessions.config';

/** Provider names as people write them, for the Join button. */
const MEETING_PROVIDER_NAMES: Record<string, string> = {
  ZOOM: 'Zoom',
  GOOGLE_MEET: 'Google Meet',
  TEAMS: 'Teams',
};

/**
 * When the meeting link goes live, in minutes before the start.
 *
 * Mirrors `JOIN_BEFORE_START_MS` in the API's session-client service, which is
 * what decides `joinActiveFrom`. Hardcoded rather than read from `joinInfo`:
 * that endpoint 403s for the coach on their own session.
 */
const JOIN_OPENS_MINUTES = 5;

/** How many attendees show before the list collapses behind "Show all". */
const ATTENDEE_PREVIEW = 5;

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

/** One line of the Details card: a hex tile, the fact, and what it is. */
interface DetailRow {
  icon: string;
  /** Ionic palette name for the tile. */
  color: string;
  tone: HexAvatarTone;
  title: string;
  detail: string | null;
}

/** Badge tone per access level — the same hues the web access chip uses. */
const ACCESS_TONES: Record<SessionAccess, string> = {
  [SessionAccess.Open]: 'open',
  [SessionAccess.Free]: 'free',
  [SessionAccess.ClientsOnly]: 'clients',
  [SessionAccess.GroupOnly]: 'group',
};

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
    CapacitySheet,
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
  readonly editOpen = signal(false);
  readonly duplicateOpen = signal(false);
  readonly duplicatePrefill = signal<SessionPrefill | null>(null);
  readonly noteOpen = signal(false);
  readonly noteParticipant = signal<SessionParticipant | null>(null);
  readonly capacityOpen = signal(false);
  readonly skeletonRows = [1, 2, 3];
  readonly joinOpensMinutes = JOIN_OPENS_MINUTES;
  readonly Surfaces = SessionSurfaces;

  /** Set once the coach taps "Show all" — long rosters open one row deep. */
  readonly attendeesExpanded = signal(false);

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

  /** "Every Tue & Thu · 24 occurrences", or nothing for a one-off. */
  readonly recurrenceLabel = computed(() => {
    const template = this.template();
    if (!template?.isRecurring) return null;
    return formatRecurrenceSummary(template.recurrenceRule) || 'Repeats';
  });

  /** "Friday 22 May · 07:30" — the line the card leads with. */
  readonly startLine = computed(() => {
    const instance = this.instance();
    if (!instance) return '';
    return `${this.dayLabel()} · ${formatSessionTime(instance.startAt)}`;
  });

  /** How long it runs and how often it comes round, under the date. */
  readonly scheduleDetail = computed(() =>
    [this.durationLabel(), this.recurrenceLabel()].filter(Boolean).join(' · '),
  );

  /** "Group" / "1-on-1" / "Open" — the band's type chip. */
  readonly typeLabel = computed(() => sessionTypeLabel(this.template()?.type));

  /**
   * What the band says about the moment this session is in. Upcoming gets
   * nothing: the date right below it already says that.
   */
  readonly statusChip = computed<{ label: string; tone: string } | null>(() => {
    if (this.isCancelled()) return { label: 'Cancelled', tone: 'cancelled' };
    if (this.lifecycle() === 'ongoing') return { label: 'Live now', tone: 'live' };
    if (this.lifecycle() === 'past') return { label: 'Completed', tone: 'done' };
    return null;
  });

  /** "Google Meet", not GOOGLE_MEET — falls back to the link when unset. */
  readonly providerLabel = computed(() => {
    const provider =
      this.template()?.meetingProvider ?? detectMeetingProvider(this.meetingUrl());
    return (provider && MEETING_PROVIDER_NAMES[provider]) || 'Online';
  });

  readonly venue = computed(
    () => this.instance()?.venueOverride ?? this.template()?.venue ?? null,
  );

  readonly venueCity = computed(() => this.venue()?.city ?? null);

  readonly locationLabel = computed(() => {
    if (this.isOnline()) return this.providerLabel();
    return this.venue()?.name ?? 'No venue set';
  });

  /**
   * "Mon 13 May · 09:00 – 10:00 · Herăstrău" — a finished session in one line.
   *
   * Replaces the schedule card once the session is over: nothing on it is
   * actionable any more, and the attendance below is what the screen is for.
   */
  readonly metaLine = computed(() => {
    const instance = this.instance();
    if (!instance) return '';
    const place = this.locationLabel();
    return [formatSessionDayShort(instance.startAt), this.timeRange(), place]
      .filter(Boolean)
      .join(' · ');
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

  /** The same number as a sentence, for the banner above the fold. */
  readonly bookedLabel = computed(() => {
    const capacity = this.capacity();
    return capacity
      ? `${this.confirmed()} of ${capacity} booked`
      : `${this.confirmed()} booked`;
  });

  /**
   * Full, and still ahead of us — so there is something to do about it.
   *
   * Danger-tinted, not honey: "full" is a state of the session, and honey in
   * this product means "press this".
   */
  readonly isFull = computed(() => {
    const capacity = this.capacity();
    return (
      !!capacity &&
      this.confirmed() >= capacity &&
      this.lifecycle() === 'upcoming' &&
      !this.isCancelled()
    );
  });

  readonly price = computed(() => {
    const cents = this.template()?.priceAmountCents ?? 0;
    if (cents === 0) return null;
    return `${(cents / 100).toFixed(0)} ${this.template()?.priceCurrency ?? ''}`.trim();
  });

  /** Nothing to do on a cancelled session. */
  readonly showCta = computed(() => !this.isCancelled());

  /**
   * "live in 4 min" / "live now" — the clock half of the banner, lower-cased
   * because it is always read as the tail of a longer line.
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
    if (this.lifecycle() === 'ongoing') return 'live now';
    if (this.lifecycle() === 'past') return null;

    const until = formatTimeUntil(instance.startAt, this._clockService.now());
    if (!until) return null;
    // "in 4 min" reads as a countdown only with the verb in front of it;
    // "starting now" already is a sentence.
    return until.startsWith('in ') ? `live ${until}` : until;
  });

  /**
   * "11 of 20 booked · live in 4 min" — the one line worth reading when the
   * session is about to start, or is on.
   */
  readonly liveBanner = computed(() => {
    const note = this.liveNote();
    return note ? `${this.bookedLabel()} · ${note}` : null;
  });

  /** Under the count in the footer: the countdown, or what a spot costs. */
  readonly ctaMeta = computed(() => this.liveNote() ?? this.price());

  /**
   * Named after the provider, so the button says where it is taking you.
   * "Join meeting" rather than "Join Online" when the link names nothing we
   * recognise — `providerLabel`'s fallback is a place, not a destination.
   */
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
      detail: `Push · ${new Date(start - offsetMs).toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })}`,
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

  /** How many are still unmarked — the register's own to-do line. */
  readonly attendanceDetail = computed(() => {
    const unmarked = this.attendees().length - this.markedCount();
    if (unmarked <= 0) return null;
    return `${unmarked} not marked yet`;
  });

  /**
   * Everyone but the waitlist — those get their own section below.
   *
   * Requests waiting on a decision come first: the roster collapses behind
   * "Show all" once it is long, and an approval hidden below the fold is one
   * that does not get made.
   */
  readonly attendees = computed(() =>
    this.store
      .participants()
      .filter((p) => p.status !== 'WAITLISTED')
      .sort((a, b) => Number(this.isPending(b)) - Number(this.isPending(a))),
  );

  /** The first few, until the coach asks for the rest or starts marking. */
  readonly visibleAttendees = computed(() => {
    const all = this.attendees();
    if (this.attendeesExpanded() || this.editingAttendance()) return all;
    // One row hidden is not worth a whole row to reveal it.
    return all.length > ATTENDEE_PREVIEW + 1 ? all.slice(0, ATTENDEE_PREVIEW) : all;
  });

  readonly hiddenAttendees = computed(
    () => this.attendees().length - this.visibleAttendees().length,
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

  readonly markedCount = computed(() => {
    const { attended, noShow } = this.counts();
    return attended + noShow;
  });

  /**
   * `null` = follow the session, `true`/`false` = the coach said so.
   *
   * A register that is already filled in is something to read, so it shows as
   * badges and "Edit attendance" opens it; an untouched one is something to
   * fill in, so it opens straight into the two marks.
   */
  private readonly _attendanceEdit = signal<boolean | null>(null);

  readonly editingAttendance = computed(
    () => this._attendanceEdit() ?? (this.canMarkAttendance() && this.markedCount() === 0),
  );

  /** The private note is a line under the name, not a prompt on every row. */
  showsNote(participant: SessionParticipant): boolean {
    return this.editingAttendance() || !!this.noteFor(participant);
  }

  toggleAttendanceEdit(): void {
    this._attendanceEdit.set(!this.editingAttendance());
  }

  /** What signups read before booking — the description, if there is one. */
  readonly description = computed(
    () => this.instance()?.descriptionOverride ?? this.template()?.description ?? null,
  );

  /** "Open" / "Free" / "Clients only" — the access level as a hero badge. */
  readonly accessLabel = computed(() => {
    const access = this.template()?.access;
    return SESSION_ACCESS_OPTIONS.find((option) => option.value === access)?.label ?? null;
  });

  readonly accessTone = computed(() => {
    const access = this.template()?.access;
    return access ? ACCESS_TONES[access] : null;
  });

  /** The cancel banner's second line — when it happened, who heard about it. */
  readonly cancelDetail = computed(() => {
    const cancelledAt = this.instance()?.cancelledAt;
    if (!cancelledAt) return 'Everyone booked in was notified.';
    return `Cancelled ${formatSessionDayShort(cancelledAt)} · everyone booked in was notified.`;
  });

  /**
   * The rest of what the API knows about this session, as one card — price,
   * access, group, cancellation policy, waitlist, series, timezone. The web
   * detail spreads these across chips and dialogs; here they read as
   * account-style rows.
   */
  readonly detailRows = computed<DetailRow[]>(() => {
    const template = this.template();
    const instance = this.instance();
    if (!template) return [];

    const rows: DetailRow[] = [
      {
        icon: 'pricetag-outline',
        color: 'success',
        tone: HexAvatarTones.Shade,
        title: this.price() ?? 'Free',
        detail: 'Price per spot',
      },
    ];

    const access = SESSION_ACCESS_OPTIONS.find(
      (option) => option.value === template.access,
    );
    if (access) {
      rows.push({
        icon: access.icon,
        color: 'violet',
        tone: HexAvatarTones.Base,
        title: access.label,
        detail: template.approvalRequired
          ? 'Approval needed for every booking'
          : access.sub,
      });
    }

    if (template.group) {
      rows.push({
        icon: 'people-outline',
        color: 'info',
        tone: HexAvatarTones.Shade,
        title: template.group.name,
        detail: 'Group',
      });
    }

    rows.push({
      icon: 'time-outline',
      color: 'coral',
      tone: HexAvatarTones.Base,
      title:
        template.cancellationCutoffHours > 0
          ? `Cancel up to ${template.cancellationCutoffHours}h before`
          : 'Cancel any time',
      detail: 'Cancellation policy',
    });

    rows.push({
      icon: 'hourglass-outline',
      color: 'medium',
      tone: HexAvatarTones.Base,
      title: template.waitlistEnabled ? 'Waitlist on' : 'Waitlist off',
      detail: template.waitlistEnabled
        ? 'A full session queues new signups'
        : 'Booking closes once it is full',
    });

    if (template.isRecurring) {
      const position = instance
        ? `Session ${instance.occurrenceIndex + 1} of the series`
        : null;
      rows.push({
        icon: 'repeat-outline',
        color: 'secondary',
        tone: HexAvatarTones.Base,
        title: this.recurrenceLabel() ?? 'Repeats',
        detail: instance?.isOverride ? `${position} · edited` : position,
      });
    }

    rows.push({
      icon: 'globe-outline',
      color: 'dark',
      tone: HexAvatarTones.Base,
      title: template.timezone,
      detail: 'Timezone',
    });

    return rows;
  });

  /** Who the message sheet is addressed to this time. */
  readonly messageAudience = signal<'all' | 'userIds'>('all');
  readonly messageOpen = signal(false);
  /** Explicit rather than derived: the whole queue, or one person from it. */
  readonly messageWaitlistIds = signal<string[]>([]);

  readonly messageRecipients = computed(() =>
    this.messageAudience() === 'userIds' ? this.messageWaitlistIds() : [],
  );

  readonly messageLabel = computed(() => {
    if (this.messageAudience() !== 'userIds') return 'everyone booked in';
    const count = this.messageWaitlistIds().length;
    return count === 1 ? 'one person on the waitlist' : `the ${count} people waiting`;
  });

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

  /**
   * Confirmed / pending / attended / no-show, as a chip tone.
   *
   * The same wash vocabulary as the band's chips rather than Ionic's solid
   * colours: a column of saturated pills down the roster reads louder than the
   * names beside them, which are the thing being looked up.
   */
  statusTone(participant: SessionParticipant): string {
    if (participant.attended === true) return 'attended';
    if (participant.attended === false) return 'noshow';
    return participant.status === 'CONFIRMED' ? 'confirmed' : 'pending';
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
    // The first mark is what turns "nothing marked yet" false, and without
    // this the register would close under the coach's thumb mid-list.
    this._attendanceEdit.set(true);
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
    this.messageWaitlistIds.set(this.waitlist().map((p) => p.userId));
    this.messageOpen.set(true);
  }

  /**
   * Message one person in the queue.
   *
   * This is what a waitlist row can honestly offer. The design shows "Promote",
   * but no route reaches the promotion service — it only runs inside the cancel
   * transaction — and `approveParticipant` requires PENDING_APPROVAL, so it
   * cannot be repurposed for a WAITLISTED row.
   */
  messageOne(participant: SessionParticipant): void {
    this.messageAudience.set('userIds');
    this.messageWaitlistIds.set([participant.userId]);
    this.messageOpen.set(true);
  }

  openCapacity(): void {
    this.capacityOpen.set(true);
  }

  /** An edit changes what this whole screen shows — refetch, don't patch. */
  onEdited(): void {
    this.store.reload();
  }

  onCapacityChanged(): void {
    this.store.reload();
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
   * Open and check-in never arrive here — passing `Surfaces.Detail` drops them
   * from the sheet, because this *is* the session and attendance is a section
   * further down the same page. The `default` below is the compiler's, not a
   * silent swallow. Cancel opens in place rather than navigating, which is the
   * one thing that differs from the agenda's handling.
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
      case SessionActionIds.Edit:
        // The store fetched the full template on load, so the form seeds with
        // the fields the instance's eager subset omits (recurrence, anchor).
        this.editOpen.set(true);
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
