import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';

import { ConversationListItem, displayName, formatRelativeShort } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';

/**
 * One row of the inbox. Unread is weight and colour rather than an extra
 * element, so a read and an unread row occupy identical space and nothing
 * shifts when one is opened.
 */
@Component({
  selector: 'mh-conversation-row',
  imports: [HexAvatar, IonBadge, IonItem, IonLabel, IonNote],
  templateUrl: './conversation-row.html',
  styleUrl: './conversation-row.scss',
  host: {
    '[class.mh-unread]': 'isUnread()',
  },
})
export class ConversationRow {
  readonly conversation = input.required<ConversationListItem>();

  readonly select = output<void>();

  readonly isUnread = computed(() => this.conversation().unreadCount > 0);

  readonly title = computed(() => displayName(this.conversation().otherUser));

  readonly avatarUrl = computed(() => this.conversation().otherUser?.avatarUrl ?? null);

  readonly tone = computed(() => avatarToneFor(this.conversation().otherUser?.id));

  readonly preview = computed(
    () => this.conversation().lastMessagePreview ?? 'No messages yet',
  );

  readonly time = computed(() => {
    const iso = this.conversation().lastMessageAt;
    return iso ? formatRelativeShort(iso) : '';
  });

  /** Two digits is what the pill fits; 300 unread would stretch the row. */
  readonly unreadLabel = computed(() => {
    const count = this.conversation().unreadCount;
    return count > 99 ? '99+' : String(count);
  });
}
