import { Component, computed, input, output } from '@angular/core';
import {
  IonBadge,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
} from '@ionic/angular/standalone';

import {
  SessionParticipant,
  SessionParticipantStatus,
  displayName,
  formatSessionDuration,
  formatSessionTime,
  sessionLifecycle,
} from 'core';

import {
  bookingStatusColor,
  bookingStatusLabel,
  bookingTone,
} from '../../my-sessions.config';

/**
 * One booking on the trainee's list: when it is, what it is, who runs it, and
 * where their booking stands.
 *
 * Shares the coach agenda row's shape — time rail, coloured spine, title, meta
 * line — because they are the same object seen from two sides, and a trainee
 * who also coaches should not have to learn two layouts. What differs is the
 * meta: the coach's row counts spots, this one names the coach and the
 * booking's status.
 */
@Component({
  selector: 'mh-booking-row',
  imports: [IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote],
  templateUrl: './booking-row.html',
  styleUrl: './booking-row.scss',
  host: {
    '[attr.data-tone]': 'tone()',
  },
})
export class BookingRow {
  readonly booking = input.required<SessionParticipant>();
  readonly select = output<void>();
  /** Only raised by the Join chip, so the row itself still opens the session. */
  readonly join = output<void>();

  private readonly _instance = computed(() => this.booking().instance ?? null);
  private readonly _template = computed(() => this._instance()?.template ?? null);

  readonly lifecycle = computed(() => {
    const instance = this._instance();
    if (!instance) return 'upcoming' as const;
    return sessionLifecycle(instance.startAt, instance.endAt);
  });

  readonly tone = computed(() =>
    bookingTone(this.booking().status, this.lifecycle() === 'past'),
  );

  readonly title = computed(
    () => this._instance()?.titleOverride ?? this._template()?.title ?? 'Session',
  );

  readonly time = computed(() => {
    const startAt = this._instance()?.startAt;
    return startAt ? formatSessionTime(startAt) : '';
  });

  readonly day = computed(() => {
    const startAt = this._instance()?.startAt;
    if (!startAt) return '';
    return new Date(startAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
  });

  readonly duration = computed(() => {
    const minutes = this._template()?.durationMinutes;
    return minutes ? formatSessionDuration(minutes) : '';
  });

  readonly coachName = computed(() =>
    displayName(this._instance()?.instructor ?? null, 'Your coach'),
  );

  readonly statusLabel = computed(() => bookingStatusLabel(this.booking().status));
  readonly statusColor = computed(() => bookingStatusColor(this.booking().status));

  /**
   * A confirmed booking says nothing — it is the default, and a chip on every
   * row makes the two that need attention disappear into the pattern.
   */
  readonly showStatusChip = computed(
    () => this.booking().status !== SessionParticipantStatus.Confirmed,
  );

  /** Coach-marked attendance, on past rows only. */
  readonly attendance = computed(() => {
    if (this.lifecycle() !== 'past') return null;
    const attended = this.booking().attended;
    if (attended === true) return { label: 'Attended', color: 'success' };
    if (attended === false) return { label: 'Missed', color: 'medium' };
    return null;
  });

  /**
   * The join window the API enforces: five minutes before the start until
   * fifteen after. The chip appears in the row rather than making them open
   * the session to find the link.
   */
  readonly canJoin = computed(
    () =>
      this.isOnline() &&
      this.lifecycle() === 'ongoing' &&
      this.booking().status === SessionParticipantStatus.Confirmed,
  );

  /** The session itself was called off — worth saying even on a live booking. */
  readonly sessionCancelled = computed(() => this._instance()?.status === 'CANCELLED');

  readonly isOnline = computed(() => this._template()?.locationKind === 'ONLINE');

  readonly place = computed(() => {
    if (this.isOnline()) return 'Online';
    return (
      this.booking().snapshotLocationText ??
      this._instance()?.venueOverride?.name ??
      this._template()?.venue?.name ??
      ''
    );
  });
}
