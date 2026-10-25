import {
  addOutline,
  alertCircleOutline,
  banOutline,
  chatbubbleOutline,
  chatbubblesOutline,
  checkmarkCircle,
  checkmarkDoneOutline,
  chevronBackOutline,
  closeOutline,
  ellipsisHorizontalOutline,
  informationCircleOutline,
  notificationsOffOutline,
  notificationsOutline,
  personOutline,
  searchOutline,
  sendOutline,
  trashOutline,
} from 'ionicons/icons';

import { ConversationListItem, UserSearchResult, displayName } from 'core';

import { SheetAction } from '../../_shared/components/action-sheet/action-sheet.model';
import { RecentPerson, SUGGESTION_LIMIT } from '../../_shared/config/recent-searches.config';

/**
 * Every icon the messages screens render. Each page calls
 * `addIcons(MESSAGING_ICONS)` once, so a name in a template can never
 * reference an icon nobody registered.
 */
export const MESSAGING_ICONS = {
  addOutline,
  alertCircleOutline,
  banOutline,
  chatbubbleOutline,
  chatbubblesOutline,
  checkmarkCircle,
  checkmarkDoneOutline,
  chevronBackOutline,
  closeOutline,
  ellipsisHorizontalOutline,
  informationCircleOutline,
  notificationsOffOutline,
  notificationsOutline,
  personOutline,
  searchOutline,
  sendOutline,
  trashOutline,
};

/** The verbs behind a row's "More" swipe. */
export const ConversationActions = {
  Profile: 'profile',
  Mute: 'mute',
  Delete: 'delete',
  Block: 'block',
} as const;

export type ConversationAction = (typeof ConversationActions)[keyof typeof ConversationActions];

/**
 * The More sheet for one conversation: the person, the notification switch,
 * then delete and block on their own red card. The profile row needs a
 * handle to route to, so it is left out without one. Tile colours follow
 * the lists rule: people violet, notifications info. Only a destructive
 * verb is red.
 */
export function conversationActions(
  muted: boolean,
  hasProfile: boolean,
): SheetAction<ConversationAction>[] {
  return [
    ...(hasProfile
      ? [
          {
            id: ConversationActions.Profile,
            label: 'button.viewProfile',
            icon: 'person-outline',
            color: 'violet',
          },
        ]
      : []),
    {
      id: ConversationActions.Mute,
      label: muted ? 'messages.actions.unmute' : 'messages.actions.mute',
      icon: muted ? 'notifications-outline' : 'notifications-off-outline',
      color: 'info',
      tone: 'shade',
    },
    {
      id: ConversationActions.Delete,
      label: 'messages.actions.delete',
      icon: 'trash-outline',
      destructive: true,
    },
    {
      id: ConversationActions.Block,
      label: 'messages.actions.block',
      icon: 'ban-outline',
      destructive: true,
    },
  ];
}

// ── Search start ────────────────────────────────────────────────────────────

/** A person as the inbox's recent searches keep them. */
export function recentFromPerson(person: UserSearchResult): RecentPerson {
  return {
    id: person.id,
    name: displayName(person),
    avatarUrl: person.avatarUrl,
    subline: person.handle ? `@${person.handle}` : null,
  };
}

/**
 * The strip under the recents: the people from the latest conversations,
 * in inbox order (newest message first). Groups have no one person to show,
 * and someone already in the recents is not offered twice.
 */
export function suggestedPeople(
  conversations: readonly ConversationListItem[],
  excludeIds: readonly string[],
  limit = SUGGESTION_LIMIT,
): RecentPerson[] {
  const seen = new Set(excludeIds);
  const people: RecentPerson[] = [];

  for (const conversation of conversations) {
    const person = conversation.otherUser;
    if (!person || seen.has(person.id)) continue;
    seen.add(person.id);
    people.push(recentFromPerson(person));
    if (people.length === limit) break;
  }
  return people;
}
