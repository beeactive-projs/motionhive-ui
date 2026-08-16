import { Component, computed, input, output } from '@angular/core';
import {
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonNote,
} from '@ionic/angular/standalone';

import { BellNotification, formatCalendarShort } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { categoryStyle } from '../../../../_shared/config/notification-categories.config';
import { routeFor } from '../../deep-link';

/**
 * One row of the notification centre.
 *
 * Unread is a red dot plus a heavier title; read drops both. The chevron
 * appears only when the notification has somewhere to go on mobile — a row
 * without one still opens, into the detail sheet.
 *
 * Swiping right toggles read (reversible, safe). Swiping left reveals dismiss
 * and delete; only dismiss is reachable by a full swipe, since delete is not
 * undoable.
 */
@Component({
  selector: 'mh-notification-row',
  imports: [
    HexAvatar,
    IonIcon,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    IonNote,
  ],
  templateUrl: './notification-row.html',
  styleUrl: './notification-row.scss',
  host: {
    '[class.mh-unread]': 'isUnread()',
  },
})
export class NotificationRow {
  readonly notification = input.required<BellNotification>();

  readonly select = output<void>();
  readonly toggleRead = output<void>();
  readonly dismiss = output<void>();
  readonly remove = output<void>();

  readonly isUnread = computed(() => !this.notification().readAt);

  readonly style = computed(() => categoryStyle(this.notification().category));

  /** Drives the chevron: no route, no affordance to follow one. */
  readonly hasTarget = computed(() => routeFor(this.notification().data) !== null);

  /** Clock time, not "2h" — the day divider above already said which day. */
  readonly time = computed(() => formatCalendarShort(this.notification().createdAt));

  /** Ionic leaves a row open after an option is tapped. */
  emitAndClose(sliding: IonItemSliding, action: { emit: () => void }): void {
    action.emit();
    void sliding.close();
  }
}
