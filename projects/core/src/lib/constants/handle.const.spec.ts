import { describe, expect, it } from 'vitest';

import { handleValidationError, normalizeHandle } from './handle.const';

describe('normalizeHandle', () => {
  it('lowercases and trims', () => {
    expect(normalizeHandle('  TestInstructor  ')).toBe('testinstructor');
  });
});

describe('handleValidationError', () => {
  it('accepts a plain handle', () => {
    expect(handleValidationError('testinstructor')).toBeNull();
  });

  it('accepts hyphens and underscores in the middle', () => {
    expect(handleValidationError('test_instructor-2')).toBeNull();
  });

  it('accepts uppercase input, since it is normalized first', () => {
    expect(handleValidationError('TestInstructor')).toBeNull();
  });

  it('rejects an empty handle', () => {
    expect(handleValidationError('   ')).not.toBeNull();
  });

  it('rejects anything shorter than three characters', () => {
    expect(handleValidationError('ab')).not.toBeNull();
  });

  it('rejects anything longer than forty characters', () => {
    expect(handleValidationError('a'.repeat(41))).not.toBeNull();
  });

  // The server's regex forbids these at the ends, and a mismatch here would
  // show up as a save the API rejects with no client-side warning.
  it('rejects separators at either end', () => {
    expect(handleValidationError('-abc')).not.toBeNull();
    expect(handleValidationError('abc-')).not.toBeNull();
    expect(handleValidationError('_abc')).not.toBeNull();
  });

  it('rejects characters outside the allowed set', () => {
    expect(handleValidationError('test instructor')).not.toBeNull();
    expect(handleValidationError('test.instructor')).not.toBeNull();
  });
});
