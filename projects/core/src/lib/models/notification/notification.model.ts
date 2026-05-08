import { NotificationSeverity, NotificationType } from './notification.enums';

/**
 * Routing payload attached to every notification. Drives deep-linking
 * when the user clicks the entry in the bell.
 *
 *   { screen: 'profile/invoices', entityId: 'inv-9' }
 *     → router.navigate(['/profile/invoices', 'inv-9'])
 *
 *   { screen: 'profile', queryParams: { tab: 'memberships' } }
 *     → router.navigate(['/profile'], { queryParams: { tab: 'memberships' } })
 */
export interface NotificationData {
  screen: string;
  entityId?: string;
  action?: string;
  queryParams?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * The flattened (notification + receipt) shape returned by
 * GET /notifications and GET /notifications/:id. The FE never sees
 * the underlying notification + receipt split — the BE joins them
 * into this single shape.
 *
 * `id` is the **receipt id**. Mark-read / dismiss / delete endpoints
 * all key off this. The `notificationId` is exposed for the rare case
 * where we need to correlate two receipts to the same alert
 * (e.g. broadcast analytics).
 */
export interface BellNotification {
  id: string;
  notificationId: string;
  type: NotificationType | string;
  title: string;
  body: string;
  data: NotificationData | null;
  severity: NotificationSeverity;
  iconUrl: string | null;
  priority: number;
  deliveredAt: string | null;
  viewedAt: string | null;
  readAt: string | null;
  clickedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

/**
 * Query params for GET /notifications. The BE caps `limit` at 100;
 * we default to 20 (the typical bell-dropdown size).
 */
export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}
