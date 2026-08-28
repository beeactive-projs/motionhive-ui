import { Component, computed, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';

/**
 * The centre's empty state: hexagon tile, one line, one action. The same
 * frame serves a filter that finds nothing — "Nothing in Payments" with a
 * Clear filter action — so an empty result looks like an answer, not a fault.
 *
 * Not `mh-empty-state`: the design's hexagon-tile hero is the frame the
 * sessions empties use, and `mh-sessions-empty` documents why the generic
 * block does not stretch to it.
 */
@Component({
  selector: 'mh-notifications-empty',
  imports: [HexAvatar, IonButton],
  templateUrl: './notifications-empty.html',
  styleUrl: './notifications-empty.scss',
})
export class NotificationsEmpty {
  /** True while Unread or a category filter is on — swaps copy and action. */
  readonly filtered = input(false);
  /** The active category's label, when the filter is a category. */
  readonly filterLabel = input<string | null>(null);

  readonly action = output<void>();

  readonly icon = computed(() =>
    this.filtered() ? 'checkmark-done-outline' : 'notifications-outline',
  );

  readonly heading = computed(() => {
    const label = this.filterLabel();
    if (label) return `Nothing in ${label}`;
    return this.filtered() ? 'All caught up' : 'Nothing here yet';
  });

  // Messages are deliberately absent from the promise: a new message never
  // reaches the bell, the Messages tab is that inbox.
  readonly message = computed(() => {
    if (this.filterLabel()) return 'Nothing to show with this filter on.';
    if (this.filtered()) return 'You have no unread notifications.';
    return 'Session reminders, client requests and payment updates show up here as they happen.';
  });

  readonly actionLabel = computed(() =>
    this.filtered() ? 'Clear filters' : 'Notification settings',
  );
}
