import { Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConversationListItem, displayName, formatRelativeShort, initialsOf } from 'core';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { UnreadBadge } from '../unread-badge/unread-badge';

/**
 * One row in the inbox conversation list. Dense layout, 8px gutter
 * around, hover/active background but no separator between rows
 * (matches design §5.2).
 *
 * v1 only renders DIRECT conversations meaningfully. GROUP rows are
 * accepted by the schema (BE returns them if any exist) but won't
 * appear in v1 because no UI creates a group conversation.
 */
@Component({
  selector: 'mh-conversation-row',
  imports: [HexAvatar, UnreadBadge, TranslatePipe],
  templateUrl: './conversation-row.html',
  styleUrl: './conversation-row.scss',
})
export class ConversationRow {
  private readonly _translateService = inject(TranslateService);

  readonly conversation = input.required<ConversationListItem>();
  readonly active = input<boolean>(false);

  readonly select = output<void>();

  protected readonly isUnread = computed(() => this.conversation().unreadCount > 0);

  protected readonly title = computed(() => {
    const c = this.conversation();
    if (c.type === 'GROUP') return c.name ?? this._translateService.instant('messages.untitledGroup');
    return displayName(c.otherUser);
  });

  protected readonly initials = computed(() => {
    const c = this.conversation();
    if (c.type === 'GROUP') return '#';
    return initialsOf(c.otherUser);
  });

  protected readonly avatarUserId = computed(() => this.conversation().otherUser?.id ?? null);

  /**
   * Photo URL for the avatar — null for groups (we don't surface their
   * group icon in v1) and null when the participant hasn't uploaded
   * one. Falls back to the hex tone + initials inside `HexAvatar`.
   */
  protected readonly avatarImageUrl = computed(() => {
    const c = this.conversation();
    if (c.type === 'GROUP') return null;
    return c.otherUser?.avatarUrl ?? null;
  });

  protected readonly preview = computed(
    () =>
      this.conversation().lastMessagePreview ??
      this._translateService.instant('messages.row.noMessages'),
  );

  protected readonly relativeTime = computed(() => {
    const iso = this.conversation().lastMessageAt;
    if (!iso) return '';
    return formatRelativeShort(iso);
  });
}

