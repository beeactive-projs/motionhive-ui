import { ConversationListItem, IncomingMessage, displayName } from 'core';

import { avatarToneFor } from '../utils/avatar-tone.utils';

/** What the in-app banner draws: two lines and a picture (a person, or a category tile). */
export interface BannerView {
  title: string;
  detail: string;
  /** A category tile, when there is no person. */
  icon: string;
  color: string;
  /** A person: their name for the initials and their photo. */
  name: string | null;
  imageUrl: string | null;
  /** A message: the chat a tap opens. */
  conversationId: string | null;
}

/**
 * A message as the banner says it: the sender's photo and name over the
 * first line; for a message request, "Ana wants to message you" and no
 * words of theirs (a stranger's words wait until the reader opens them).
 * Null for a chat the reader muted or archived: it stays quiet.
 */
export function messageBanner(
  incoming: IncomingMessage,
  conversation: ConversationListItem,
  t: (key: string, params?: Record<string, unknown>) => string,
): BannerView | null {
  if (conversation.muted || conversation.archived) {
    return null;
  }
  const name = displayName(conversation.otherUser, conversation.name ?? '');
  let title = name;
  let detail = incoming.preview;
  if (incoming.isRequest || conversation.isRequest) {
    title = t('messages.banner.request', { name });
    detail = t('messages.banner.requestDetail');
  }
  return {
    title,
    detail,
    icon: 'chatbubble-outline',
    color: avatarToneFor(conversation.otherUser?.id ?? conversation.id),
    name,
    imageUrl: conversation.otherUser?.avatarUrl ?? null,
    conversationId: conversation.id,
  };
}
