/**
 * Top-level groupings the user sees on the settings page. Mirrors
 * the BE NotificationCategory enum exactly. Industry convention
 * (Linear, HubSpot redesign) is to group by category rather than
 * per-event-type — six choices instead of thirty.
 */
export enum NotificationCategory {
  Sessions = 'SESSIONS',
  Coaching = 'COACHING',
  Groups = 'GROUPS',
  Payments = 'PAYMENTS',
  Account = 'ACCOUNT',
  Posts = 'POSTS',
}

/**
 * Channels the user can configure on the settings page. We
 * deliberately omit:
 *   - in_app: always-on by design (the bell is the inbox)
 *   - push:  not implemented yet
 *   - sms:   not implemented yet
 *
 * When push ships, add `push: boolean` here and the toggle column
 * on the settings page renders automatically — no other changes.
 */
export interface ConfigurableChannelPreferences {
  email: boolean;
}

/**
 * One row on the settings page. The BE returns six of these on
 * GET /users/me/notification-settings, in display order, with the
 * effective channel state already merged.
 *
 * `label` and `description` come from the BE so the user-facing
 * copy stays consistent with the underlying catalog and we don't
 * have to re-implement it on the FE.
 */
export interface CategoryPreferenceView {
  category: NotificationCategory;
  label: string;
  description: string;
  channels: ConfigurableChannelPreferences;
  isCustomized: boolean;
}

/**
 * Body shape for PATCH /users/me/notification-settings.
 * Whole-payload save — only categories the user changed are sent.
 */
export interface UpdatePreferencesPayload {
  items: {
    category: NotificationCategory;
    channels: ConfigurableChannelPreferences;
  }[];
}
