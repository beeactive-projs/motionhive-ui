import { Component, computed, inject, input, model, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { BellNotification, appLocale } from 'core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { webOnlyLabel } from '../../../../_shared/config/notification-deep-link';
import {
  NotificationDetailAction,
  NotificationDetailActions,
  categoryLabel,
  notificationDetailActions,
} from '../../notifications.config';

/**
 * What a notification opens into when it has nowhere to go.
 *
 * Roughly half the catalog points at screens that only exist on the web. Those
 * rows still open — into this — so the alert stays readable and actionable
 * rather than being a row that does nothing when tapped.
 *
 * An action sheet like every other "one thing and its verbs" sheet: the
 * notification's title and when it came in the header, its full text above
 * the verbs, Delete in a red card of its own. A verb is reported once the
 * sheet has gone.
 *
 * The footnote is derived from the deep-link target, so the day one of those
 * screens ships on mobile the row gains a chevron and stops reaching here at
 * all, with no change to this component.
 */
@Component({
  selector: 'mh-notification-detail-sheet',
  imports: [ActionSheet, TranslatePipe],
  templateUrl: './notification-detail-sheet.html',
  styleUrl: './notification-detail-sheet.scss',
})
export class NotificationDetailSheet {
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly notification = input<BellNotification | null>(null);

  readonly toggleRead = output<void>();
  readonly remove = output<void>();

  /** Also the dialog's accessible name, so never empty. */
  readonly title = computed(
    () =>
      this.notification()?.title ||
      this._translateService.instant('notifications.detail.title'),
  );

  readonly isUnread = computed(() => {
    const item = this.notification();
    return !!item && !item.readAt;
  });

  readonly eyebrow = computed(() => {
    const item = this.notification();
    if (!item) return '';
    const when = new Date(item.createdAt).toLocaleString(appLocale(), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return this._translateService.instant('notifications.detail.eyebrow', {
      category: categoryLabel(item.category),
      when,
    });
  });

  readonly actions = computed(() => notificationDetailActions(this.isUnread()));

  /** Names where this lives instead; null when we cannot say honestly. */
  readonly elsewhere = computed(() => webOnlyLabel(this.notification()?.data ?? null));

  onChosen(action: NotificationDetailAction): void {
    switch (action) {
      case NotificationDetailActions.ToggleRead:
        this.toggleRead.emit();
        break;
      case NotificationDetailActions.Delete:
        this.remove.emit();
        break;
    }
  }
}
