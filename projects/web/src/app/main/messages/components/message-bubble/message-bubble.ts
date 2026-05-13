import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MessageView, ParticipantSnapshot } from 'core';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { BubblePosition } from '../../utils/group-messages';
import { displayName, initialsOf } from '../../utils/participant';

/**
 * Single message bubble. Renders both "me" and "them" sides based on
 * whether the message's `senderId` matches the current user.
 *
 * Grouping (§6.4):
 *   - Outer corners 16px; inner corners drop to 6px for middle/non-end
 *     positions in a run so adjacent bubbles "stick" visually.
 *   - The 30px hex avatar only appears on the LAST bubble of a "them"
 *     run (or `only`). Space is reserved on the other bubbles so they
 *     stay aligned with the avatar column.
 *   - Sender name (group chats — N/A v1) shows above the FIRST bubble
 *     of a "them" run.
 *   - Metadata ("2:48 PM · Delivered") on the LAST bubble of a run.
 */
@Component({
  selector: 'mh-message-bubble',
  standalone: true,
  imports: [HexAvatar],
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageBubble {
  readonly message = input.required<MessageView>();
  readonly position = input.required<BubblePosition>();
  /** Caller-supplied: `true` when `message.senderId === currentUserId`. */
  readonly mine = input.required<boolean>();
  /**
   * Profile snapshot for the message's author when the bubble is on
   * the "them" side. v1 only renders DMs, so the snapshot can come
   * from `conversation.otherUser` directly. Group v2 will look it up
   * by `senderId` against the members list.
   */
  readonly author = input<ParticipantSnapshot | null>(null);

  protected readonly isMine = computed(() => this.mine());
  protected readonly isDeleted = computed(() => !!this.message().deletedAt);

  /** Avatar shown only on the last bubble of a "them" run. */
  protected readonly showAvatar = computed(() => {
    if (this.mine()) return false;
    const pos = this.position();
    return pos === 'last' || pos === 'only';
  });

  /** Author name shown above the first bubble of a "them" run (groups only — not in v1). */
  protected readonly showAuthorName = computed(() => {
    if (this.mine()) return false;
    if (!this.author()) return false;
    const pos = this.position();
    return pos === 'first' || pos === 'only';
  });

  /** Metadata line under the last bubble of a run. */
  protected readonly showMeta = computed(() => {
    const pos = this.position();
    return pos === 'last' || pos === 'only';
  });

  protected readonly authorInitials = computed(() => initialsOf(this.author()));
  protected readonly authorName = computed(() => displayName(this.author(), ''));

  protected readonly timeLabel = computed(() => {
    const iso = this.message().createdAt;
    const date = new Date(iso);
    // Same locale-aware short time as the rest of the app.
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  });

  /**
   * Inline grouped-corner math. The outer corner radius stays at 16px
   * and the "inner" corners (top/bottom of the bubble facing the rest
   * of the run, depending on side) drop to 6px.
   */
  protected readonly bubbleRadius = computed(() => {
    const pos = this.position();
    const mine = this.mine();
    // [topLeft, topRight, bottomRight, bottomLeft]
    let tl = 16, tr = 16, br = 16, bl = 16;
    if (mine) {
      if (pos === 'middle' || pos === 'first') br = 6;
      if (pos === 'middle' || pos === 'last') tr = 6;
    } else {
      if (pos === 'middle' || pos === 'first') bl = 6;
      if (pos === 'middle' || pos === 'last') tl = 6;
    }
    return `${tl}px ${tr}px ${br}px ${bl}px`;
  });
}
