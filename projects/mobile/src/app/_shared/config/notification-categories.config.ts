import { NotificationCategory } from 'core';
import {
  barbellOutline,
  calendarOutline,
  cardOutline,
  chatbubbleEllipsesOutline,
  chatbubblesOutline,
  notificationsOutline,
  peopleOutline,
  ribbonOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';

/**
 * The eight category glyphs, for pages that register their own icon set.
 * Spread this into the page's `*_ICONS` object rather than listing the names
 * again — two lists drift, and an unregistered name renders as a blank box
 * with no error anywhere.
 */
export const CATEGORY_ICONS = {
  barbellOutline,
  calendarOutline,
  cardOutline,
  chatbubbleEllipsesOutline,
  chatbubblesOutline,
  notificationsOutline,
  peopleOutline,
  ribbonOutline,
  shieldCheckmarkOutline,
};

export interface CategoryStyle {
  label: string;
  icon: string;
  /** Ionic palette name — rendered as a `tone="wash"` hexagon. */
  color: string;
}

/**
 * How a notification category looks, wherever it appears: the centre's rows,
 * its filter chips, the detail sheet, and the preferences list.
 *
 * Red is deliberately absent. It means unread, and a category that owned it
 * would read as urgent on every row it touched.
 *
 * The server owns the category list, so `categoryStyle` falls back rather than
 * assuming this map is complete — a category added there renders as a neutral
 * bell instead of an empty tile.
 */
export const CATEGORY_STYLES: Record<NotificationCategory, CategoryStyle> = {
  [NotificationCategory.Messaging]: {
    label: 'Messaging',
    icon: 'chatbubble-ellipses-outline',
    color: 'teal',
  },
  [NotificationCategory.Sessions]: {
    label: 'Sessions',
    icon: 'calendar-outline',
    color: 'info',
  },
  [NotificationCategory.Coaching]: {
    label: 'Coaching',
    icon: 'ribbon-outline',
    color: 'warning',
  },
  [NotificationCategory.Workouts]: {
    label: 'Workouts',
    icon: 'barbell-outline',
    color: 'coral',
  },
  [NotificationCategory.Groups]: {
    label: 'Groups',
    icon: 'people-outline',
    color: 'violet',
  },
  [NotificationCategory.Payments]: {
    label: 'Payments',
    icon: 'card-outline',
    color: 'success',
  },
  [NotificationCategory.Posts]: {
    label: 'Posts',
    icon: 'chatbubbles-outline',
    color: 'medium',
  },
  [NotificationCategory.Account]: {
    label: 'Account',
    icon: 'shield-checkmark-outline',
    color: 'dark',
  },
};

/** Display order for the preferences list, matching the server's own. */
export const CATEGORY_ORDER: NotificationCategory[] = [
  NotificationCategory.Messaging,
  NotificationCategory.Sessions,
  NotificationCategory.Coaching,
  NotificationCategory.Workouts,
  NotificationCategory.Groups,
  NotificationCategory.Payments,
  NotificationCategory.Posts,
  NotificationCategory.Account,
];

/**
 * The categories the centre can filter to — everything except Messaging.
 *
 * A new message never reaches the bell: `MESSAGE_RECEIVED` is created with
 * `channelOverride.in_app = false` because the Messages tab and its badge are
 * that inbox, and a second copy in the bell would be a duplicate you have to
 * clear twice. So a Messaging chip could only ever say "nothing here".
 *
 * Preferences still lists all eight — you can turn message *emails* off, which
 * is a real setting even though nothing lands in the bell.
 */
export const FILTERABLE_CATEGORIES: NotificationCategory[] = CATEGORY_ORDER.filter(
  (category) => category !== NotificationCategory.Messaging,
);

const FALLBACK: CategoryStyle = {
  label: 'Notification',
  icon: 'notifications-outline',
  color: 'medium',
};

export function categoryStyle(category: NotificationCategory): CategoryStyle {
  return CATEGORY_STYLES[category] ?? FALLBACK;
}
