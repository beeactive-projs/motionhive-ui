import { Component, computed, inject, input, output } from '@angular/core';
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  ConversationListItem,
  displayName,
  formatRelativeShort,
  isConversationUnread,
} from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { emitAndClose } from '../../../../_shared/utils/swipe';
import { sharedKindKey } from '../../messages.config';

/**
 * One row of the inbox. Unread is weight and colour rather than an extra
 * element, so a read and an unread row occupy identical space and nothing
 * shifts when one is opened.
 *
 * Swipes follow WhatsApp: right toggles read / unread, left reveals More
 * and mute. The row only emits — the page owns the store calls and the
 * More sheet, so this stays a presentational component.
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
    TranslatePipe,
  ],
  templateUrl: './conversation-row.html',
  styleUrl: './conversation-row.scss',
  host: {
    '[class.mh-unread]': 'isUnread()',
    '[class.mh-muted]': 'isMuted()',
  },
})
export class ConversationRow {
  private readonly _translateService = inject(TranslateService);

  readonly conversation = input.required<ConversationListItem>();
  /** Off where the row only opens its thread (the new-message results). */
  readonly swipeable = input(true);
  /** The swipe's More option; off where the list offers only Archive. */
  readonly showMore = input(true);

  readonly select = output<void>();
  readonly markRead = output<void>();
  readonly markUnread = output<void>();
  readonly toggleMute = output<void>();
  readonly archive = output<void>();
  readonly more = output<void>();

  readonly isArchived = computed(() => !!this.conversation().archived);

  /** The swipe's verb: Archive, or Unarchive on an archived chat. */
  readonly archiveLabel = computed(() => {
    if (this.isArchived()) {
      return 'messages.actions.unarchive';
    }
    return 'messages.actions.archive';
  });

  /** Unread messages, or marked unread by the reader. */
  readonly isUnread = computed(() => isConversationUnread(this.conversation()));

  /** Marked unread with nothing actually unread: a dot, no number. */
  readonly isMarkedUnread = computed(
    () => !!this.conversation().markedUnread && this.conversation().unreadCount === 0,
  );

  readonly isMuted = computed(() => this.conversation().muted);

  readonly title = computed(() => displayName(this.conversation().otherUser));

  readonly avatarUrl = computed(() => this.conversation().otherUser?.avatarUrl ?? null);

  readonly tone = computed(() => avatarToneFor(this.conversation().otherUser?.id));

  /** The last message, after what it shared when it shared something ("Session · ..."). */
  readonly preview = computed(() => {
    const { lastMessagePreview, lastMessageAttachmentType } = this.conversation();
    const text = lastMessagePreview ?? this._translateService.instant('messages.row.noPreview');
    if (!lastMessageAttachmentType) {
      return text;
    }
    const kind = this._translateService.instant(sharedKindKey(lastMessageAttachmentType));
    if (!lastMessagePreview) {
      return kind;
    }
    return `${kind} · ${lastMessagePreview}`;
  });

  readonly time = computed(() => {
    const iso = this.conversation().lastMessageAt;
    return iso ? formatRelativeShort(iso) : '';
  });

  /**
   * Two digits is what the pill fits; 300 unread would stretch the row.
   * Empty when nothing is unread, so the template can test it.
   */
  readonly unreadLabel = computed(() => {
    const count = this.conversation().unreadCount;
    if (count <= 0) return '';
    return count > 99 ? '99+' : String(count);
  });

  readonly emitAndClose = emitAndClose;
}
