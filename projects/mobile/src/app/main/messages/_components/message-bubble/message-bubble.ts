import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

import { BubblePosition, MessageView, ParticipantSnapshot, displayName } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';

/** Outer corner radius of a bubble, and the tight one facing its own run. */
const RADIUS = 18;
const TIGHT_RADIUS = 6;

/**
 * One chat bubble, either side.
 *
 * Grouping comes from `groupMessages` in core, which hands each message a
 * position in its run. That drives three things: the corner facing the rest of
 * the run tightens to 6px so adjacent bubbles read as one block, the avatar
 * appears only under the last bubble of a "them" run, and the timestamp only
 * under the last of any run.
 */
@Component({
  selector: 'mh-message-bubble',
  imports: [HexAvatar, IonIcon],
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
  host: {
    '[class.mine]': 'isMine()',
  },
})
export class MessageBubble {
  readonly message = input.required<MessageView>();
  readonly position = input.required<BubblePosition>();
  /** True when `message.senderId` matches the signed-in user. */
  readonly isMine = input.required<boolean>();
  /** The other participant, for the avatar under a "them" run. */
  readonly author = input<ParticipantSnapshot | null>(null);
  /**
   * The other participant's last-read timestamp. A message sent at or before
   * it has been read.
   */
  readonly otherReadAt = input<string | null>(null);
  /** Set only on my most recent message — a tick under every one is noise. */
  readonly showReceipt = input(false);

  readonly isDeleted = computed(() => !!this.message().deletedAt);

  readonly authorName = computed(() => displayName(this.author(), ''));

  readonly tone = computed(() => avatarToneFor(this.author()?.id));

  readonly authorAvatarUrl = computed(() => this.author()?.avatarUrl ?? null);

  /** Avatar only under the final bubble of a "them" run. */
  readonly showAvatar = computed(() => {
    if (this.isMine()) return false;
    const position = this.position();
    return position === 'last' || position === 'only';
  });

  /** Timestamp under the final bubble of any run. */
  readonly showMeta = computed(() => {
    const position = this.position();
    return position === 'last' || position === 'only';
  });

  readonly isRead = computed(() => {
    if (!this.isMine() || this.isDeleted()) return false;
    const readAt = this.otherReadAt();
    if (!readAt) return false;
    return new Date(this.message().createdAt).getTime() <= new Date(readAt).getTime();
  });

  readonly timeLabel = computed(() =>
    new Date(this.message().createdAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
  );

  /**
   * Grouped corners. The outer three stay at 18px; the one facing the rest of
   * the run drops to 6px — bottom on the way into a run, top on the way out,
   * mirrored by side.
   */
  readonly radius = computed(() => {
    const position = this.position();
    const mine = this.isMine();
    let [topLeft, topRight, bottomRight, bottomLeft] = [RADIUS, RADIUS, RADIUS, RADIUS];

    if (mine) {
      if (position === 'middle' || position === 'first') bottomRight = TIGHT_RADIUS;
      if (position === 'middle' || position === 'last') topRight = TIGHT_RADIUS;
    } else {
      if (position === 'middle' || position === 'first') bottomLeft = TIGHT_RADIUS;
      if (position === 'middle' || position === 'last') topLeft = TIGHT_RADIUS;
    }

    return `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
  });

  /** Bubbles inside a run sit tight; the last one opens the gap to the next. */
  readonly marginBottom = computed(() => (this.showMeta() ? '0.75rem' : '0.125rem'));
}
