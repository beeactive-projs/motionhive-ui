import { Component, DestroyRef, computed, inject, input, output } from '@angular/core';
import { IonBadge, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';

import {
  SessionInstance,
  formatSessionDuration,
  formatSessionTime,
  sessionLifecycle,
} from 'core';

import { instanceTone } from '../../sessions.config';

/** Hold this long for the quick-actions sheet. */
const LONG_PRESS_MS = 500;

/** Chip copy per session type. The BE enum is terser than the UI wants. */
const TYPE_LABELS: Record<string, string> = {
  GROUP: 'Group',
  PRIVATE: '1-on-1',
  OPEN: 'Open',
};

/**
 * One agenda row: time and duration on the left, title and a status line on the
 * right, with a coloured spine keyed to the session type.
 *
 * A conflicting occurrence overrides the type colour with danger — an overlap
 * is the one thing on this screen worth interrupting a scan for.
 */
@Component({
  selector: 'mh-session-row',
  imports: [IonBadge, IonIcon, IonItem, IonLabel, IonNote],
  templateUrl: './session-row.html',
  styleUrl: './session-row.scss',
  host: {
    '[attr.data-tone]': 'tone()',
    // Long-press is the quick-actions gesture. Bound on the host so the timer
    // is cancelled by a scroll or a lift anywhere on the row.
    '(pointerdown)': 'onPressStart()',
    '(pointerup)': 'onPressEnd()',
    '(pointercancel)': 'onPressEnd()',
    '(pointerleave)': 'onPressEnd()',
    '(contextmenu)': 'onContextMenu($event)',
  },
})
export class SessionRow {
  readonly instance = input.required<SessionInstance>();

  readonly select = output<void>();
  readonly longPress = output<void>();

  private readonly _template = computed(() => this.instance().template ?? null);

  readonly title = computed(
    () => this.instance().titleOverride ?? this._template()?.title ?? 'Session',
  );

  readonly time = computed(() => formatSessionTime(this.instance().startAt));

  readonly duration = computed(() => {
    const minutes = this._template()?.durationMinutes;
    return minutes ? formatSessionDuration(minutes) : '';
  });

  readonly hasConflict = computed(
    () => (this.instance().conflictingInstanceIds?.length ?? 0) > 0,
  );

  readonly isOnline = computed(() => this._template()?.locationKind === 'ONLINE');

  /** Drives the spine colour via a `data-tone` attribute. */
  readonly tone = computed(() => instanceTone(this.instance()));

  readonly typeLabel = computed(() => {
    if (this.hasConflict()) return 'Conflict';
    const type = this._template()?.type;
    return type ? (TYPE_LABELS[type] ?? type) : '';
  });

  /**
   * Live/upcoming/past comes from the timestamps, not `instance.status` — the
   * status cron only runs hourly, so a session can be underway while the row
   * still says SCHEDULED.
   */
  readonly isLive = computed(
    () => sessionLifecycle(this.instance().startAt, this.instance().endAt) === 'ongoing',
  );

  /** Capacity is the per-occurrence override when there is one. */
  private readonly _capacity = computed(
    () => this.instance().capacityOverride ?? this._template()?.capacity ?? null,
  );

  /** "8/12 · Herăstrău", or whichever halves exist. */
  readonly meta = computed(() => {
    const parts: string[] = [];
    const capacity = this._capacity();
    const confirmed = this.instance().confirmedCount;
    parts.push(capacity === null ? `${confirmed} booked` : `${confirmed}/${capacity}`);

    const place = this.isOnline()
      ? (this._template()?.meetingProvider ?? 'Online')
      : (this.instance().venueOverride?.name ?? this._template()?.venue?.name ?? '');
    if (place) parts.push(place);

    return parts.join(' · ');
  });

  readonly pendingCount = computed(() => this.instance().pendingApprovalCount);

  private readonly _destroyRef = inject(DestroyRef);
  private _pressTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // A filter or a refresh can drop this row mid-press.
    this._destroyRef.onDestroy(() => this.onPressEnd());
  }

  onPressStart(): void {
    this._pressTimer = setTimeout(() => {
      this._pressTimer = undefined;
      this.longPress.emit();
    }, LONG_PRESS_MS);
  }

  onPressEnd(): void {
    if (this._pressTimer) {
      clearTimeout(this._pressTimer);
      this._pressTimer = undefined;
    }
  }

  /** Desktop right-click reaches the same menu; also stops the browser's own. */
  onContextMenu(event: Event): void {
    event.preventDefault();
    this.onPressEnd();
    this.longPress.emit();
  }
}
