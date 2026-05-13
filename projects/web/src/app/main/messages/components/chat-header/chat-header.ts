import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ConversationListItem } from 'core';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { displayName, initialsOf } from '../../utils/participant';

/**
 * Fixed top bar above the message thread.
 *
 * v1 surfaces: back button (mobile), avatar + name, info button to
 * toggle the detail rail. Call/video icons from the design are
 * intentionally omitted in v1 (no calling infrastructure). Presence
 * dot is hidden because the BE has no presence service.
 */
@Component({
  selector: 'mh-chat-header',
  standalone: true,
  imports: [HexAvatar],
  templateUrl: './chat-header.html',
  styleUrl: './chat-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatHeader {
  readonly conversation = input.required<ConversationListItem>();

  readonly back = output<void>();
  readonly toggleInfo = output<void>();

  protected readonly isGroup = computed(() => this.conversation().type === 'GROUP');

  protected readonly title = computed(() => {
    const c = this.conversation();
    if (c.type === 'GROUP') return c.name ?? 'Untitled group';
    return displayName(c.otherUser);
  });

  protected readonly initials = computed(() => {
    const c = this.conversation();
    if (c.type === 'GROUP') return '#';
    return initialsOf(c.otherUser);
  });

  protected readonly avatarUserId = computed(() => this.conversation().otherUser?.id ?? null);

  /** Real photo URL when the other user has one; null for groups + fallback to hex+initials. */
  protected readonly avatarImageUrl = computed(() => {
    const c = this.conversation();
    if (c.type === 'GROUP') return null;
    return c.otherUser?.avatarUrl ?? null;
  });
}
