import { describe, expect, it } from 'vitest';

import { CategoryPreferenceView, NotificationCategory } from '../models/notification/preference.model';
import { localizeCategoryPreference } from './notification.utils';

const row = (category: string): CategoryPreferenceView => ({
  category: category as NotificationCategory,
  label: 'BE label',
  description: 'BE description',
  channels: { email: true },
  isCustomized: false,
});

describe('localizeCategoryPreference', () => {
  it('uses the translated copy for a known category', () => {
    const localized = localizeCategoryPreference(row(NotificationCategory.Payments));
    expect(localized.label).toBe('Payments & invoices');
    expect(localized.description).toBe('Invoices, payments, subscriptions, refunds, payouts, and disputes.');
    expect(localized.channels).toEqual({ email: true });
  });

  it('keeps the BE copy for a category it has no key for', () => {
    const localized = localizeCategoryPreference(row('NEW_THING'));
    expect(localized.label).toBe('BE label');
    expect(localized.description).toBe('BE description');
  });
});
