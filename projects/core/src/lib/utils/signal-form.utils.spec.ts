import { describe, expect, it } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, required } from '@angular/forms/signals';

import { validationMessage } from '../i18n/validation-message';
import {
  isFieldInvalid,
  matchesPassword,
  minLengthTrimmed,
  requiredTrimmed,
  strongPassword,
} from './signal-form.utils';

const kinds = (errors: readonly { kind: string }[]) => errors.map((e) => e.kind);

function passwordForm(password: string, confirm = '') {
  return TestBed.runInInjectionContext(() =>
    form(signal({ password, confirm }), (p) => {
      required(p.password);
      strongPassword(p.password);
      required(p.confirm);
      matchesPassword(p.confirm, p.password);
    }),
  );
}

describe('strongPassword', () => {
  it('passes the policy the API enforces', () => {
    expect(kinds(passwordForm('Secure1!x').password().errors())).toEqual([]);
    expect(kinds(passwordForm('Back\\slash1A').password().errors())).toEqual([]);
  });

  it('flags a password missing any required class', () => {
    for (const weak of ['Sh0rt!A', 'nouppercase1!', 'NOLOWERCASE1!', 'NoDigitsHere!', 'NoSymbols123']) {
      expect(kinds(passwordForm(weak).password().errors())).toEqual(['passwordStrength']);
    }
  });

  it('does not count symbols the API rejects', () => {
    for (const weak of ['Password1~', 'Password1`']) {
      expect(kinds(passwordForm(weak).password().errors())).toEqual(['passwordStrength']);
    }
  });

  it('leaves an empty value to required', () => {
    expect(kinds(passwordForm('').password().errors())).toEqual(['required']);
  });
});

describe('matchesPassword', () => {
  it('flags a different confirmation on the confirmation field', () => {
    expect(kinds(passwordForm('Secure1!x', 'Secure1!y').confirm().errors())).toEqual([
      'passwordMismatch',
    ]);
  });

  it('accepts a match, and leaves an empty confirmation to required', () => {
    expect(kinds(passwordForm('Secure1!x', 'Secure1!x').confirm().errors())).toEqual([]);
    expect(kinds(passwordForm('Secure1!x', '').confirm().errors())).toEqual(['required']);
  });
});

describe('trimmed name rules', () => {
  const nameForm = (name: string) =>
    TestBed.runInInjectionContext(() =>
      form(signal({ name }), (p) => {
        requiredTrimmed(p.name);
        minLengthTrimmed(p.name, 2);
      }),
    );

  it('treats whitespace as empty and measures the trimmed value', () => {
    expect(kinds(nameForm('   ').name().errors())).toEqual(['required']);
    expect(kinds(nameForm(' A ').name().errors())).toEqual(['minLength']);
    expect(kinds(nameForm(' Ana ').name().errors())).toEqual([]);
  });

  it('feeds validationMessage the minimum length', () => {
    expect(validationMessage(nameForm('A').name().errors())).toBe('Must be at least 2 characters.');
  });
});

describe('isFieldInvalid', () => {
  it('shows an error only once the field was left', () => {
    const f = passwordForm('weak');
    expect(isFieldInvalid(f.password())).toBe(false);
    f.password().markAsTouched();
    expect(isFieldInvalid(f.password())).toBe(true);
  });
});
