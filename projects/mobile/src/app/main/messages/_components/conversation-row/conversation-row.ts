import { Component, computed, input, output } from '@angular/core';
import {
  IonBadge,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonNote,
} from '@ionic/angular/standalone';

import { ConversationListItem, displayName, formatRelativeShort } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';

/**
 * One row of the inbox. Unread is weight and colour rather than an extra
 * element, so a read and an unread row occupy identical space and nothing
 * shifts when one is opened.
 *
 * Swiping reveals mark-read and mute. The row only emits — the page owns the
 * store calls, so this stays a presentational component.
 */
@Component({
  selector: 'mh-conversation-row',
  imports: [
    HexAvatar,
    IonBadge,
    IonIcon,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    IonNote,
  ],
  templateUrl: './conversation-row.html',
  styleUrl: './conversation-row.scss',
  host: {
    '[class.mh-unread]': 'isUnread()',
  },
})
export class ConversationRow {
  readonly conversation = input.required<ConversationListItem>();

  readonly select = output<void>();
  readonly markRead = output<void>();
  readonly toggleMute = output<void>();

  readonly isUnread = computed(() => this.conversation().unreadCount > 0);

  readonly isMuted = computed(() => this.conversation().muted);

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

  /**
   * Ionic leaves the row open after an option is tapped, so the next render
   * shows a half-swiped row with stale buttons.
   */
  emitAndClose(sliding: IonItemSliding, action: { emit: () => void }): void {
    action.emit();
    void sliding.close();
  }
}
