import {
  alertCircleOutline,
  checkmarkDoneOutline,
  chevronForward,
  funnelOutline,
  trashOutline,
} from 'ionicons/icons';

import { NotificationCategory } from 'core';

import {
  CATEGORY_ICONS,
  CATEGORY_ORDER,
  categoryStyle,
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
  chevronForward,
  funnelOutline,
  trashOutline,
};

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

/** Order-insensitive — the sheet hands categories back in tap order. */
export function sameFilters(a: NotificationFilters, b: NotificationFilters): boolean {
  if (a.unreadOnly !== b.unreadOnly) return false;
  if (a.categories.length !== b.categories.length) return false;
  return a.categories.every((category) => b.categories.includes(category));
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
    .map((category) => categoryStyle(category).label);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
