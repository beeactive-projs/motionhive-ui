import {
  CategoryPreferenceView,
  ConfigurableChannelPreferences,
  NotificationCategory,
  translate,
} from 'core';

export type ConfigurableChannel = keyof ConfigurableChannelPreferences;

/**
 * The channels a person can set, by the key the API uses for them, mapped to
 * translation keys — module-level, so the label is resolved at read time.
 */
export const CHANNEL_LABEL_KEYS: Record<string, string> = {
  email: 'account.notifications.channels.email',
  push: 'account.notifications.channels.push',
};

function channelLabel(channel: ConfigurableChannel): string {
  const key = CHANNEL_LABEL_KEYS[channel];
  return key ? translate(key) : channel;
}

function isMessaging(category: NotificationCategory): boolean {
  return category === NotificationCategory.Messaging;
}

/**
 * Where the always-on copy of a category lands. Everything goes to the bell
 * except direct messages, which are suppressed there on purpose — the
 * Messages tab and its badge are that inbox, so claiming "in-app" for them
 * would point at a screen they never reach.
 */
export function inAppLabel(category: NotificationCategory): string {
  return isMessaging(category)
    ? translate('nav.messages')
    : translate('account.notifications.channels.inApp');
}

/** Why the in-app row cannot be turned off, in the sheet. */
export function inAppNote(category: NotificationCategory): string {
  return isMessaging(category)
    ? translate('account.notifications.channels.messagesNote')
    : translate('account.notifications.channels.inAppNote');
}

/** The row's second line: "In-app · Email", or "In-app only" when nothing else is on. */
export function channelSummary(view: CategoryPreferenceView): string {
  const on = configurableChannels(view.channels)
    .filter((channel) => view.channels[channel])
    .map(channelLabel);
  if (on.length === 0) {
    return isMessaging(view.category)
      ? translate('account.notifications.channels.messagesOnly')
      : translate('account.notifications.channels.inAppOnly');
  }
  return [inAppLabel(view.category), ...on].join(' · ');
}

/** One toggle row in the per-category sheet. */
export interface ChannelRow {
  key: 'in_app' | ConfigurableChannel;
  label: string;
  note: string | null;
  /** Rendered on and disabled — in-app cannot be turned off. */
  locked: boolean;
  checked: boolean;
}

/**
 * The locked in-app row first, then one row per channel the API exposes on
 * this category. Driven by the keys present on `channels`, so the day core's
 * `ConfigurableChannelPreferences` gains `push`, the Push row appears here
 * with no further change.
 */
export function channelRows(view: CategoryPreferenceView): ChannelRow[] {
  return [
    {
      key: 'in_app',
      label: inAppLabel(view.category),
      note: inAppNote(view.category),
      locked: true,
      checked: true,
    },
    ...configurableChannels(view.channels).map((channel) => ({
      key: channel,
      label: channelLabel(channel),
      note: null,
      locked: false,
      checked: view.channels[channel],
    })),
  ];
}

/** The keys on the preference object that have a label — in the label order. */
function configurableChannels(channels: ConfigurableChannelPreferences): ConfigurableChannel[] {
  return (Object.keys(CHANNEL_LABEL_KEYS) as ConfigurableChannel[]).filter(
    (channel) => channel in channels,
  );
}
