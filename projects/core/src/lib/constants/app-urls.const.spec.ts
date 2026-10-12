import { describe, expect, it } from 'vitest';

import {
  MARKETING_SITE_URL,
  marketingSiteUrl,
  privacyPolicyUrl,
  termsOfServiceUrl,
} from './app-urls.const';

describe('marketingSiteUrl', () => {
  it('serves the default language at the root', () => {
    expect(marketingSiteUrl('/blog', 'en')).toBe(`${MARKETING_SITE_URL}/blog`);
  });

  it('serves other languages under their code', () => {
    expect(marketingSiteUrl('/blog', 'ro')).toBe(`${MARKETING_SITE_URL}/ro/blog`);
  });
});

describe('legal page URLs', () => {
  it('follow the language', () => {
    expect(termsOfServiceUrl('en')).toBe(`${MARKETING_SITE_URL}/legal/terms-of-service`);
    expect(privacyPolicyUrl('ro')).toBe(`${MARKETING_SITE_URL}/ro/legal/privacy-policy`);
  });
});
