import { describe, expect, it } from 'vitest';
import { maxLengthError, minLengthError, requiredError } from '@angular/forms/signals';

import { validationMessage } from './validation-message';

describe('validationMessage', () => {
  it('is empty for a valid control', () => {
    expect(validationMessage(null)).toBe('');
    expect(validationMessage(undefined)).toBe('');
  });

  it('words the built-in validators, with their limits', () => {
    expect(validationMessage({ required: true })).toBe('This field is required.');
    expect(validationMessage({ email: true })).toBe('Please enter a valid email address.');
    expect(validationMessage({ minlength: { requiredLength: 8, actualLength: 3 } })).toBe(
      'Must be at least 8 characters.',
    );
    expect(validationMessage({ max: { max: 20, actual: 25 } })).toBe('Must be at most 20.');
  });

  // Both fire on an empty-then-typed field; "required" is the one to fix first.
  it('reports errors in priority order, not insertion order', () => {
    expect(
      validationMessage({ minlength: { requiredLength: 8, actualLength: 0 }, required: true }),
    ).toBe('This field is required.');
  });

  it('lets a form reword one error without losing the others', () => {
    const overrides = { required: 'validation.passwordMismatch' };
    expect(validationMessage({ required: true }, overrides)).toBe('Passwords do not match.');
    expect(validationMessage({ email: true }, overrides)).toBe('Please enter a valid email address.');
  });

  it('falls back to a generic message for an unknown validator', () => {
    expect(validationMessage({ notAHandle: true })).toBe('Invalid value.');
  });

  describe('Signal Forms errors', () => {
    it('words them like their reactive counterparts, with their limits', () => {
      expect(validationMessage([requiredError()])).toBe('This field is required.');
      expect(validationMessage([minLengthError(2)])).toBe('Must be at least 2 characters.');
      expect(validationMessage([maxLengthError(50)])).toBe('Must be 50 characters or fewer.');
    });

    // Overrides are keyed by the reactive name: AUTH_FIELD_ERRORS relies on this.
    it('applies a minLength override under its reactive name', () => {
      const overrides = { minlength: 'validation.passwordMismatch' };
      expect(validationMessage([minLengthError(2)], overrides)).toBe('Passwords do not match.');
    });

    it('falls back to a generic message for an unknown kind', () => {
      expect(validationMessage([{ kind: 'notAHandle' }])).toBe('Invalid value.');
    });
  });
});
