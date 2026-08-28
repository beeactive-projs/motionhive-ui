import {
  CategoryPreferenceView,
  ConfigurableChannelPreferences,
  NotificationCategory,
} from 'core';

export type ConfigurableChannel = keyof ConfigurableChannelPreferences;

/** The channels a person can set, by the key the API uses for them. */
export const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  push: 'Push',
};

/**
 * Where the always-on copy of a category lands. Everything goes to the bell
 * except direct messages, which are suppressed there on purpose — the
 * Messages tab and its badge are that inbox, so claiming "in-app" for them
 * would point at a screen they never reach.
 */
export function inAppLabel(category: NotificationCategory): string {
  return category === NotificationCategory.Messaging ? 'Messages' : 'In-app';
}

/** Why the in-app row cannot be turned off, in the sheet. */
export function inAppNote(category: NotificationCategory): string {
  return category === NotificationCategory.Messaging
    ? 'Always on — the Messages tab is that inbox.'
    : 'Always on — the bell is your inbox.';
}

/** The row's second line: "In-app · Email", or "In-app only" when nothing else is on. */
export function channelSummary(view: CategoryPreferenceView): string {
  const base = inAppLabel(view.category);
  const on = configurableChannels(view.channels)
    .filter((channel) => view.channels[channel])
    .map((channel) => CHANNEL_LABELS[channel] ?? channel);
  return on.length > 0 ? [base, ...on].join(' · ') : `${base} only`;
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
      label: CHANNEL_LABELS[channel] ?? channel,
      note: null,
      locked: false,
      checked: view.channels[channel],
    })),
  ];
}

/** The keys on the preference object that have a label — in the label order. */
function configurableChannels(channels: ConfigurableChannelPreferences): ConfigurableChannel[] {
  return (Object.keys(CHANNEL_LABELS) as ConfigurableChannel[]).filter(
    (channel) => channel in channels,
  );
}
