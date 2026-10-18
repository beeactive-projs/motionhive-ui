import {
  addOutline,
  alertCircleOutline,
  arrowBackOutline,
  banOutline,
  chatbubbleOutline,
  chatbubblesOutline,
  checkmarkCircle,
  checkmarkDoneOutline,
  closeOutline,
  ellipsisHorizontalOutline,
  informationCircleOutline,
  notificationsOffOutline,
  notificationsOutline,
  personOutline,
  searchOutline,
  sendOutline,
} from 'ionicons/icons';

import { SheetAction } from '../../_shared/components/action-sheet/action-sheet.model';

/**
 * Every icon the messages screens render. Each page calls
 * `addIcons(MESSAGING_ICONS)` once, so a name in a template can never
 * reference an icon nobody registered.
 */
export const MESSAGING_ICONS = {
  addOutline,
  alertCircleOutline,
  arrowBackOutline,
  banOutline,
  chatbubbleOutline,
  chatbubblesOutline,
  checkmarkCircle,
  checkmarkDoneOutline,
  closeOutline,
  ellipsisHorizontalOutline,
  informationCircleOutline,
  notificationsOffOutline,
  notificationsOutline,
  personOutline,
  searchOutline,
  sendOutline,
};

/** The verbs behind a row's "More" swipe. */
export const ConversationActions = {
  Profile: 'profile',
  Mute: 'mute',
  Block: 'block',
} as const;

export type ConversationAction = (typeof ConversationActions)[keyof typeof ConversationActions];

/**
 * The More sheet for one conversation: the person, the notification switch,
 * then block on its own red card. The profile row needs a handle to route
 * to, so it is left out without one. Tile colours follow the lists rule:
 * people violet, notifications info. Red is block's alone: only a
 * destructive verb is red.
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
      id: ConversationActions.Block,
      label: 'messages.actions.block',
      icon: 'ban-outline',
      destructive: true,
    },
  ];
}
