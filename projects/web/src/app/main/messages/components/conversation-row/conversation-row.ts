import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ConversationListItem } from 'core';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { displayName, initialsOf } from '../../utils/participant';
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
  standalone: true,
  imports: [HexAvatar, UnreadBadge],
  templateUrl: './conversation-row.html',
  styleUrl: './conversation-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationRow {
  readonly conversation = input.required<ConversationListItem>();
  readonly active = input<boolean>(false);

  readonly select = output<void>();

  protected readonly isUnread = computed(() => this.conversation().unreadCount > 0);

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
    () => this.conversation().lastMessagePreview ?? 'No messages yet',
  );

  protected readonly relativeTime = computed(() => {
    const iso = this.conversation().lastMessageAt;
    if (!iso) return '';
    return formatRelative(iso);
  });
}

/**
 * Compact "now / 5m / 2h / yesterday / Apr 28" formatter for the inbox
 * row timestamp.
 *
 * Reads `iso` as a UTC-anchored ISO string (the BE serializes Dates
 * via JSON.stringify which always appends "Z"). We compare against
 * `Date.now()` which is UTC milliseconds, so timezones drop out.
 *
 * Robustness:
 *   - Sub-minute gaps render as "now" (the previous "Ns" felt jittery
 *     and the difference is meaningless to a chat user).
 *   - Small clock skew (BE clock ahead of FE by &lt; 60s) also renders
 *     as "now" — without this, a brand-new message would briefly
 *     render as "-1s ago" or similar.
 *   - "yesterday" is computed in the BROWSER's local-day terms so it
 *     matches the user's intuition, not the server's day boundary.
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const ms = Date.now() - then;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  // Local-day comparison: "yesterday" is whatever the user calls
  // yesterday, not whatever the server's UTC midnight thinks.
  const now = new Date();
  const that = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 3600_000;
  if (that.getTime() >= startOfYesterday && that.getTime() < startOfToday) {
    return 'yesterday';
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return that.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return that.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
