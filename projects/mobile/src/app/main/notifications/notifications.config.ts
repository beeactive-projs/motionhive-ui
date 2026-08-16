import {
  alertCircleOutline,
  checkmarkDoneOutline,
  chevronForward,
  close,
  trashOutline,
} from 'ionicons/icons';

import { CATEGORY_ICONS } from '../../_shared/config/notification-categories.config';

/**
 * Every icon the notification screens render: the eight category glyphs plus
 * the chrome around them. An unregistered name renders as a blank box with no
 * error, so `notifications.config.spec.ts` asserts this list covers the
 * templates.
 */
export const NOTIFICATION_ICONS = {
  ...CATEGORY_ICONS,
  alertCircleOutline,
  checkmarkDoneOutline,
  chevronForward,
  close,
  trashOutline,
};
