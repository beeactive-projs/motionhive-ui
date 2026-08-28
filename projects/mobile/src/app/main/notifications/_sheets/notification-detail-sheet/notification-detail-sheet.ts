import { Component, computed, input, model, output } from '@angular/core';
import { IonButton, IonIcon, IonNote } from '@ionic/angular/standalone';

import { BellNotification } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { categoryStyle } from '../../../../_shared/config/notification-categories.config';
import { webOnlyLabel } from '../../../../_shared/config/notification-deep-link';

/**
 * What a notification opens into when it has nowhere to go.
 *
 * Roughly half the catalog points at screens that only exist on the web. Those
 * rows still open — into this — so the alert stays readable and actionable
 * rather than being a row that does nothing when tapped.
 *
 * The footnote is derived from the deep-link target, so the day one of those
 * screens ships on mobile the row gains a chevron and stops reaching here at
 * all, with no change to this component.
 */
@Component({
  selector: 'mh-notification-detail-sheet',
  imports: [HexAvatar, IonButton, IonIcon, IonNote, SheetShell],
  templateUrl: './notification-detail-sheet.html',
  styleUrl: './notification-detail-sheet.scss',
})
export class NotificationDetailSheet {
  readonly open = model(false);
  readonly notification = input<BellNotification | null>(null);

  readonly toggleRead = output<void>();
  readonly remove = output<void>();

  readonly style = computed(() => {
    const item = this.notification();
    return item ? categoryStyle(item.category) : null;
  });

  readonly isUnread = computed(() => {
    const item = this.notification();
    return !!item && !item.readAt;
  });

  readonly eyebrow = computed(() => {
    const item = this.notification();
    const style = this.style();
    if (!item || !style) return '';
    const when = new Date(item.createdAt).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${style.label} · ${when}`;
  });

  /** Names where this lives instead; null when we cannot say honestly. */
  readonly elsewhere = computed(() => webOnlyLabel(this.notification()?.data ?? null));
}
