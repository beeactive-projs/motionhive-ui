import {
  alertCircleOutline,
  checkmarkDoneOutline,
  ellipsisHorizontalOutline,
  mailUnreadOutline,
  optionsOutline,
  settingsOutline,
  trashOutline,
} from 'ionicons/icons';

import { NotificationCategory, appLocale, translate } from 'core';

import { SheetAction } from '../../_shared/components/action-sheet/action-sheet.model';

import {
  CATEGORY_ICONS,
  CATEGORY_ORDER,
  CATEGORY_STYLES,
} from '../../_shared/config/notification-categories.config';

/**
 * Every icon the notification screens render: the eight category glyphs plus
 * the chrome around them. An unregistered name renders as a blank box with no
 * error, so `notifications.config.spec.ts` asserts this list covers the
 * templates and the component sources.
 */
export const NOTIFICATION_ICONS = {
  ...CATEGORY_ICONS,
  alertCircleOutline,
  checkmarkDoneOutline,
  ellipsisHorizontalOutline,
  mailUnreadOutline,
  optionsOutline,
  settingsOutline,
  trashOutline,
};

/** The verbs behind the header's ⋯ button: ones about the whole list. */
export const NotificationListActions = {
  MarkAllRead: 'markAllRead',
  Settings: 'settings',
} as const;

export type NotificationListAction = (typeof NotificationListActions)[keyof typeof NotificationListActions];

/**
 * The header's More sheet. Mark all read stays listed with nothing unread,
 * disabled, so the verb is always where it was. Tile colours follow the
 * lists rule: marking done is success green, notification settings info,
 * both `shade` for the white glyph's 3:1.
 */
export function notificationListActions(hasUnread: boolean): SheetAction<NotificationListAction>[] {
  return [
    {
      id: NotificationListActions.MarkAllRead,
      label: 'notifications.markAllRead',
      icon: 'checkmark-done-outline',
      color: 'success',
      tone: 'shade',
      disabled: !hasUnread,
    },
    {
      id: NotificationListActions.Settings,
      label: 'notifications.settings',
      icon: 'settings-outline',
      color: 'info',
      tone: 'shade',
    },
  ];
}

/** The verbs on the detail sheet: ones about the one notification it shows. */
export const NotificationDetailActions = {
  ToggleRead: 'toggleRead',
  Delete: 'delete',
} as const;

export type NotificationDetailAction =
  (typeof NotificationDetailActions)[keyof typeof NotificationDetailActions];

/**
 * The detail sheet's verbs, the pair the row's swipes offer: whichever of Mark
 * read / Mark unread undoes the current state, then Delete in its own red
 * card. Read is the done tick in green, as Mark all read is; unread is the
 * envelope in info, a notification state and nothing destroyed.
 */
export function notificationDetailActions(
  isUnread: boolean,
): SheetAction<NotificationDetailAction>[] {
  return [
    isUnread
      ? {
          id: NotificationDetailActions.ToggleRead,
          label: 'notifications.markRead',
          icon: 'checkmark-done-outline',
          color: 'success',
          tone: 'shade',
        }
      : {
          id: NotificationDetailActions.ToggleRead,
          label: 'notifications.markUnread',
          icon: 'mail-unread-outline',
          color: 'info',
          tone: 'shade',
        },
    {
      id: NotificationDetailActions.Delete,
      label: 'button.delete',
      icon: 'trash-outline',
      color: 'danger',
      destructive: true,
    },
  ];
}

/**
 * What the centre is narrowed to — the shape the filter sheet edits.
 *
 * Both go to the server, unlike the agenda's filters: the list is paged, so a
 * filter run over the page already loaded would return short pages. The store
 * holds the applied values; this is only the contract between page and sheet.
 */
export interface NotificationFilters {
  unreadOnly: boolean;
  categories: NotificationCategory[];
}

export const NO_FILTERS: NotificationFilters = {
  unreadOnly: false,
  categories: [],
};

/**
 * How many of these are actually narrowing anything — drives the chip count.
 *
 * Each category counts on its own: three picked chips are three things you
 * tapped, and "Filters · 1" over the three of them reads as a miscount.
 */
export function activeFilterCount(filters: NotificationFilters): number {
  return (filters.unreadOnly ? 1 : 0) + filters.categories.length;
}

/**
 * The number on the strip's Filters chip. Status alone is what the All /
 * Unread chips beside it say, so it counts only once a category is on and
 * the sheet, not a chip, is the view: one thing is on at a time.
 */
export function sheetChipCount(filters: NotificationFilters): number {
  return filters.categories.length > 0 ? activeFilterCount(filters) : 0;
}

/** Order-insensitive — the sheet hands categories back in tap order. */
export function sameFilters(a: NotificationFilters, b: NotificationFilters): boolean {
  if (a.unreadOnly !== b.unreadOnly) return false;
  if (a.categories.length !== b.categories.length) return false;
  return a.categories.every((category) => b.categories.includes(category));
}

/**
 * The short name the centre gives a category — "Payments", not the settings
 * page's "Payments & invoices". A category the server added after this build
 * reads as a plain "Notification", matching `categoryStyle`'s neutral bell.
 */
export function categoryLabel(category: NotificationCategory): string {
  return category in CATEGORY_STYLES
    ? translate(`notifications.category.${category}`)
    : translate('notifications.categoryFallback');
}

/**
 * "Payments", "Sessions and Payments", "Sessions, Groups and Payments" — for
 * the empty state's heading and the line under a filtered list. Display order
 * rather than tap order, so the same pick always reads the same way. Null with
 * no category on, so callers can fall back to the unfiltered copy.
 */
export function categoryListLabel(categories: readonly NotificationCategory[]): string | null {
  if (categories.length === 0) return null;
  const labels = [...categories]
    .sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))
    .map(categoryLabel);
  return new Intl.ListFormat(appLocale(), { type: 'conjunction' }).format(labels);
}
