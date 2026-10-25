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

import {
  ConversationListItem,
  MyInstructor,
  SuggestedCoach,
  UserSearchResult,
  displayName,
  translate,
} from 'core';

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

/** A coach the reader already has, as a person. */
export function personFromMyCoach({ instructor }: MyInstructor): UserSearchResult {
  return {
    id: instructor.id,
    firstName: instructor.firstName,
    lastName: instructor.lastName,
    avatarUrl: instructor.avatarUrl ?? null,
    handle: instructor.handle ?? null,
  };
}

/** A suggested coach, as a person: keyed by user id, which is what a draft chat is addressed to. */
export function personFromSuggestedCoach(coach: SuggestedCoach): UserSearchResult {
  return {
    id: coach.userId,
    firstName: coach.firstName,
    lastName: coach.lastName,
    avatarUrl: coach.avatarUrl,
    handle: coach.handle,
  };
}

/**
 * The people of one strip or list, in the order given: once each, without
 * anyone in `excludeIds` (the recents, the lists above), capped.
 */
export function stripPeople(
  people: readonly UserSearchResult[],
  excludeIds: readonly string[],
  limit = SUGGESTION_LIMIT,
): RecentPerson[] {
  const seen = new Set(excludeIds);
  const strip: RecentPerson[] = [];

  for (const person of people) {
    if (strip.length >= limit) break;
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    strip.push(recentFromPerson(person));
  }
  return strip;
}

/**
 * The new-message page's "Suggested": the reader's own coaches, said as
 * such, then the coaches the server suggests (each with their handle, where a
 * sponsored one will later say so). One list, capped as a whole.
 */
export function suggestedContacts(
  mine: readonly MyInstructor[],
  suggested: readonly SuggestedCoach[],
  limit = SUGGESTION_LIMIT,
): RecentPerson[] {
  const own = stripPeople(mine.map(personFromMyCoach), [], limit).map((person) => ({
    ...person,
    subline: translate('messages.compose.yourCoach'),
  }));
  const others = stripPeople(
    suggested.map(personFromSuggestedCoach),
    own.map((person) => person.id),
    limit - own.length,
  );
  return [...own, ...others];
}

/**
 * Frequent contacts: the people from the latest conversations, in inbox
 * order (newest message first). The inbox carries no message counts, so
 * recency stands in for frequency. Groups have no one person to show.
 */
export function frequentContacts(
  conversations: readonly ConversationListItem[],
  excludeIds: readonly string[],
  limit = SUGGESTION_LIMIT,
): RecentPerson[] {
  const people = conversations.flatMap((conversation) =>
    conversation.otherUser ? [conversation.otherUser] : [],
  );
  return stripPeople(people, excludeIds, limit);
}
