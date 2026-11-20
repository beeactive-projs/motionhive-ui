import {
  addOutline,
  alertCircleOutline,
  archiveOutline,
  mailUnreadOutline,
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
  MessagingReach,
  MyInstructor,
  ReachStatus,
  RequestContext,
  ShareTargetType,
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
  archiveOutline,
  mailUnreadOutline,
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
  Archive: 'archive',
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
  archived = false,
): SheetAction<ConversationAction>[] {
  let archiveLabel = 'messages.actions.archive';
  if (archived) {
    archiveLabel = 'messages.actions.unarchive';
  }
  return [
    ...(hasProfile
      ? [
          {
            id: ConversationActions.Profile,
            label: 'button.viewProfile',
            icon: 'person-outline',
            color: 'violet',
          } satisfies SheetAction<ConversationAction>,
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
      // Put aside, undone in one tap: violet, like every archive.
      id: ConversationActions.Archive,
      label: archiveLabel,
      icon: 'archive-outline',
      color: 'violet',
    },
    {
      id: ConversationActions.Delete,
      label: 'messages.actions.delete',
      icon: 'trash-outline',
      color: 'danger',
      destructive: true,
    },
    {
      id: ConversationActions.Block,
      label: 'messages.actions.block',
      icon: 'ban-outline',
      color: 'danger',
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

// ── Message requests, archive, shares ─────────────────────────────────────

/** A line of copy as a key and its params; the template translates it. */
export interface CopyLine {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * How the writer of a request and the reader might know each other, as the
 * request view says it: the coach part, then a group in common or none.
 */
export function requestContextLines(context: RequestContext | null | undefined): CopyLine[] {
  const lines: CopyLine[] = [];
  if (context?.isCoach) {
    lines.push({ key: 'messages.request.context.coach' });
  }
  if (context?.sharedGroupName) {
    lines.push({
      key: 'messages.request.context.group',
      params: { name: context.sharedGroupName, more: Math.max(0, context.sharedGroupCount - 1) },
    });
  } else {
    lines.push({ key: 'messages.request.context.noGroup' });
  }
  return lines;
}

/**
 * What the composer says while the reader's request waits: how many more
 * fit, or that it is full until they accept. Null when nothing waits.
 */
export function waitingNote(
  waiting: { remaining: number } | null | undefined,
  name: string,
): CopyLine | null {
  if (!waiting) {
    return null;
  }
  if (waiting.remaining <= 0) {
    return { key: 'messages.request.waitingFull', params: { name } };
  }
  return { key: 'messages.request.waiting', params: { name, count: waiting.remaining } };
}

/** The composer is closed: the request is full, or they can't be written to. */
export function composerClosed(
  waiting: { remaining: number } | null | undefined,
  reach: MessagingReach | null,
): boolean {
  if (waiting && waiting.remaining <= 0) {
    return true;
  }
  const status = reach?.status;
  return (
    status === ReachStatus.ConnectionsOnly ||
    status === ReachStatus.YouBlocked ||
    status === ReachStatus.NewAccount ||
    status === ReachStatus.Suspended
  );
}

/** What a first message to someone will do, said before it is typed. Null: straight in. */
export function reachNote(reach: MessagingReach | null, name: string): CopyLine | null {
  switch (reach?.status) {
    case ReachStatus.Request:
      return { key: 'messages.reach.request', params: { name, count: reach.requestLimit ?? 0 } };
    case ReachStatus.ConnectionsOnly:
      return { key: 'messages.reach.connectionsOnly', params: { name } };
    case ReachStatus.YouBlocked:
      return { key: 'messages.reach.youBlocked', params: { name } };
    case ReachStatus.NewAccount:
      return { key: 'messages.reach.newAccount' };
    case ReachStatus.Suspended:
      return { key: 'messages.reach.suspended' };
    default:
      return null;
  }
}

/** The chat list's word for what a message shared: "Session · ...". */
export function sharedKindKey(type: ShareTargetType): string {
  return `messages.shared.${type}`;
}

/** A row over the chats that opens a folder of its own. */
export interface FolderRow {
  /** The path under the Messages tab. */
  route: 'requests' | 'archived';
  label: string;
  /** Plural copy taking `count`. */
  hint: string;
  count: number;
  /** Shown as a honey badge; empty for none. */
  badge: string;
}

/**
 * The rows over the chats: Message requests when any wait (info, like the
 * bell, with a badge of how many), Archived when there are archived chats
 * (violet, quiet, no badge). Neither when there is nothing in it.
 */
export function folderRows(
  requests: readonly ConversationListItem[],
  archived: readonly ConversationListItem[],
): FolderRow[] {
  const rows: FolderRow[] = [];
  if (requests.length > 0) {
    let badge = String(requests.length);
    if (requests.length > 99) {
      badge = '99+';
    }
    rows.push({
      route: 'requests',
      label: 'messages.requests.title',
      hint: 'messages.requests.rowHint',
      count: requests.length,
      badge,
    });
  }
  if (archived.length > 0) {
    rows.push({
      route: 'archived',
      label: 'messages.archived.title',
      hint: 'messages.archived.rowHint',
      count: archived.length,
      badge: '',
    });
  }
  return rows;
}

/** The words of a folder's own screen. */
export interface FolderCopy {
  title: string;
  note: string;
  emptyIcon: string;
  emptyHeading: string;
}

export const FOLDER_COPY: Record<'requests' | 'archived', FolderCopy> = {
  requests: {
    title: 'messages.requests.title',
    note: 'messages.requests.note',
    emptyIcon: 'mail-unread-outline',
    emptyHeading: 'messages.requests.empty',
  },
  archived: {
    title: 'messages.archived.title',
    note: 'messages.archived.note',
    emptyIcon: 'archive-outline',
    emptyHeading: 'messages.archived.empty',
  },
};

/** The folder a route names in its data; requests when it names none it knows. */
export function folderOf(data: Record<string, unknown>): 'requests' | 'archived' {
  if (data['folder'] === 'archived') {
    return 'archived';
  }
  return 'requests';
}
