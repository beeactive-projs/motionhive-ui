import { describe, expect, it } from 'vitest';
import { convertToParamMap } from '@angular/router';

import { isInAppPath, resolveReturnUrl } from './url.utils';

describe('isInAppPath', () => {
  it('accepts paths inside the app', () => {
    expect(isInAppPath('/groups')).toBe(true);
    expect(isInAppPath('/groups/1?tab=feed#top')).toBe(true);
  });

  it('rejects anything that could leave the app', () => {
    expect(isInAppPath('https://evil.com')).toBe(false);
    expect(isInAppPath('//evil.com')).toBe(false);
    expect(isInAppPath('/\\evil.com')).toBe(false);
    expect(isInAppPath('/\t/evil.com')).toBe(false);
    expect(isInAppPath('/\n/evil.com')).toBe(false);
    expect(isInAppPath('javascript:alert(1)')).toBe(false);
    expect(isInAppPath('')).toBe(false);
    expect(isInAppPath(null)).toBe(false);
  });
});

describe('resolveReturnUrl', () => {
  const resolve = (params: Record<string, string>) =>
    resolveReturnUrl(convertToParamMap(params), '/home');

  it('uses an in-app returnUrl', () => {
    expect(resolve({ returnUrl: '/groups/1' })).toBe('/groups/1');
  });

  it('falls back when returnUrl is missing or leaves the app', () => {
    expect(resolve({})).toBe('/home');
    expect(resolve({ returnUrl: 'https://evil.com' })).toBe('/home');
  });
});
