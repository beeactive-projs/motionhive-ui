import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActionSheetController,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCheckbox,
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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  SessionParticipant,
  SessionsDetailStore,
  displayName,
  formatRelativeShort,
  formatSessionDuration,
  formatSessionTime,
  sessionLifecycle,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { AvatarTone, avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { CancelSessionSheet } from '../_sheets/cancel-session-sheet/cancel-session-sheet';
import { MessageSignupsSheet } from '../_sheets/message-signups-sheet/message-signups-sheet';
import { SESSION_ICONS } from '../sessions.config';

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
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonCheckbox,
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
export class SessionDetail {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _actionSheetController = inject(ActionSheetController);
  readonly store = inject(SessionsDetailStore);

  readonly cancelOpen = signal(false);
  readonly skeletonRows = [1, 2, 3];

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
    const days = template.recurrenceRule?.daysOfWeek ?? [];
    if (days.length === 0) return 'Repeats';
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return `Repeats ${days.map((d) => names[d - 1]).join(' & ')}`;
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


  constructor() {
    addIcons(SESSION_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) this.store.load(id);
    });
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

  /** Attendance is its own control, so tapping a row always means the same thing. */
  setAttendance(participant: SessionParticipant, attended: boolean): void {
    this.store.setAttendance(participant.id, attended);
  }

  /** Marking who turned up only makes sense once the session has started. */
  readonly canMarkAttendance = computed(() => this.lifecycle() !== 'upcoming');

  openProfile(participant: SessionParticipant): void {
    const handle = participant.user?.handle;
    if (handle) void this._router.navigate(['/tabs/sessions/person', handle]);
  }

  /** No handle, no profile to open — the row stays inert rather than 404ing. */
  hasProfile(participant: SessionParticipant): boolean {
    return !!participant.user?.handle;
  }

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

  async openActions(): Promise<void> {
    const sheet = await this._actionSheetController.create({
      header: this.title(),
      buttons: [
        ...(this.isCancelled()
          ? []
          : [{ text: 'Cancel session…', role: 'destructive', data: 'cancel' }]),
        { text: 'Close', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss<string>();
    if (data === 'cancel') this.openCancel();
  }
}
