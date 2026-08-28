import { describe, expect, it } from 'vitest';

import { CategoryPreferenceView, NotificationCategory } from 'core';

import { channelRows, channelSummary, inAppLabel } from './notification-preferences.config';

function view(overrides: Partial<CategoryPreferenceView> = {}): CategoryPreferenceView {
  return {
    category: NotificationCategory.Sessions,
    label: 'Sessions',
    description: 'Reminders, cancellations and signups.',
    channels: { email: true },
    isCustomized: false,
    ...overrides,
  };
}

/** A preference shaped the way the API will send it once push ships. */
function withChannels(channels: Record<string, boolean>): CategoryPreferenceView {
  return view({ channels: channels as unknown as CategoryPreferenceView['channels'] });
}

describe('inAppLabel', () => {
  it('names the Messages tab for messaging and the bell for everything else', () => {
    expect(inAppLabel(NotificationCategory.Messaging)).toBe('Messages');
    expect(inAppLabel(NotificationCategory.Payments)).toBe('In-app');
  });
});

describe('channelSummary', () => {
  it('lists the channels that are on, after the always-on one', () => {
    expect(channelSummary(view())).toBe('In-app · Email');
  });

  it('says so when nothing but in-app is on', () => {
    expect(channelSummary(view({ channels: { email: false } }))).toBe('In-app only');
  });

  it('uses the messaging label for messaging', () => {
    expect(channelSummary(view({ category: NotificationCategory.Messaging }))).toBe(
      'Messages · Email',
    );
  });
});

describe('channelRows', () => {
  it('leads with the locked in-app row, then the channels the API exposes', () => {
    const rows = channelRows(view());
    expect(rows.map((row) => row.key)).toEqual(['in_app', 'email']);
    expect(rows[0]).toMatchObject({ locked: true, checked: true });
    expect(rows[0]?.note).toContain('Always on');
    expect(rows[1]).toMatchObject({ label: 'Email', locked: false, checked: true, note: null });
  });

  // The rows follow the keys on `channels`, so push shows up the day core
  // exposes it — with nothing else to change here.
  it('renders a push row once the preference carries one', () => {
    const preference = withChannels({ email: false, push: true });
    expect(channelRows(preference).map((row) => row.key)).toEqual(['in_app', 'email', 'push']);
    expect(channelSummary(preference)).toBe('In-app · Push');
  });

  it('ignores channels it has no label for', () => {
    const preference = withChannels({ email: true, sms: true });
    expect(channelRows(preference).map((row) => row.key)).toEqual(['in_app', 'email']);
  });
});
