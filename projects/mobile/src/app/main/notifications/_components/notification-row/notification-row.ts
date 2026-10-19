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
import { TranslatePipe } from '@ngx-translate/core';

import { BellNotification, formatCalendarShort } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { categoryStyle } from '../../../../_shared/config/notification-categories.config';

/**
 * One row of the notification centre, a flat-list row (`mh-flat-list`): the
 * category tile, the title with its time, the body on one line.
 *
 * Unread is a red dot in the gutter plus full-ink text; read drops both. No
 * chevron, as in every flat list: the whole row opens, into the screen it points
 * at or, failing that, the detail sheet.
 *
 * Swiping right toggles read (reversible, safe), and a full swipe commits it.
 * Swiping left reveals delete and dismiss; only dismiss is reachable by a full
 * swipe, since delete is not undoable.
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
    TranslatePipe,
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

  /** Clock time, not "2h" — the day divider above already said which day. */
  readonly time = computed(() => formatCalendarShort(this.notification().createdAt));

  /** Ionic leaves a row open after an option is tapped. */
  emitAndClose(sliding: IonItemSliding, action: { emit: () => void }): void {
    action.emit();
    void sliding.close();
  }
}
