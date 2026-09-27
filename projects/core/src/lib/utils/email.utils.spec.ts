import { describe, expect, it } from 'vitest';

import { emailErrorMessage, isValidEmail } from './email.utils';

describe('isValidEmail', () => {
  // Enough to catch a typo before the request; the BE is the real validator.
  it('accepts an address and refuses what cannot be one', () => {
    expect(isValidEmail('radu@example.com')).toBe(true);
    expect(isValidEmail('  radu@example.com ')).toBe(true);
    expect(isValidEmail('radu+tag@sub.example.co.uk')).toBe(true);
    expect(isValidEmail('radu')).toBe(false);
    expect(isValidEmail('radu@')).toBe(false);
    expect(isValidEmail('radu@example')).toBe(false);
    expect(isValidEmail('ra du@example.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  // Each of these enabled Send, went to the BE and came back rejected.
  it('refuses the malformed addresses the BE would reject anyway', () => {
    expect(isValidEmail('a@b..c')).toBe(false);
    expect(isValidEmail('a@-b.com')).toBe(false);
    expect(isValidEmail('a@b-.com')).toBe(false);
    expect(isValidEmail('<script>@x.com')).toBe(false);
    expect(isValidEmail('.radu@example.com')).toBe(false);
    expect(isValidEmail('radu.@example.com')).toBe(false);
    expect(isValidEmail(`${'a'.repeat(300)}@example.com`)).toBe(false);
    expect(isValidEmail(`${'a'.repeat(65)}@example.com`)).toBe(false);
  });
});

describe('emailErrorMessage', () => {
  // Empty is not a mistake — nothing has been filled in and the submit is off.
  it('explains a bad address and stays quiet about an empty one', () => {
    expect(emailErrorMessage('')).toBeNull();
    expect(emailErrorMessage('   ')).toBeNull();
    expect(emailErrorMessage('radu@example.com')).toBeNull();
    expect(emailErrorMessage('radu@')).toBe(
      'Enter a valid email address, like client@example.com.',
    );
    expect(emailErrorMessage(`${'a'.repeat(250)}@example.com`)).toBe(
      'An email address cannot be longer than 254 characters.',
    );
  });
});
