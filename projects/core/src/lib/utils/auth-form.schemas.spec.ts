import { describe, expect, it } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FieldTree, form } from '@angular/forms/signals';

import { emailSchema, newPasswordSchema, signInSchema, signUpSchema } from './auth-form.schemas';

const kinds = (field: FieldTree<unknown>) => field().errors().map((e) => e.kind);
const inContext = <T>(fn: () => T) => TestBed.runInInjectionContext(fn);

describe('signInSchema', () => {
  it('asks only for a password, not a strong one', () => {
    const f = inContext(() => form(signal({ email: 'a@b.co', password: 'old' }), signInSchema));
    expect(f().valid()).toBe(true);
  });

  it('needs a valid email', () => {
    const f = inContext(() => form(signal({ email: 'nope', password: 'x' }), signInSchema));
    expect(kinds(f.email)).toEqual(['email']);
  });
});

describe('emailSchema', () => {
  it('needs an email', () => {
    const f = inContext(() => form(signal({ email: '' }), emailSchema));
    expect(kinds(f.email)).toEqual(['required']);
  });
});

describe('signUpSchema', () => {
  const valid = {
    firstName: 'Ana',
    lastName: 'Pop',
    email: 'ana@b.co',
    password: 'Secure1!x',
    confirmPassword: 'Secure1!x',
    isInstructor: false,
  };

  it('accepts a model with extra fields', () => {
    const f = inContext(() => form(signal(valid), signUpSchema));
    expect(f().valid()).toBe(true);
  });

  it('checks names trimmed and the password policy', () => {
    const f = inContext(() =>
      form(signal({ ...valid, firstName: '   ', lastName: ' A ', password: 'weak', confirmPassword: 'weak' }), signUpSchema),
    );
    expect(kinds(f.firstName)).toEqual(['required']);
    expect(kinds(f.lastName)).toEqual(['minLength']);
    expect(kinds(f.password)).toEqual(['passwordStrength']);
  });
});

describe('newPasswordSchema', () => {
  it('needs a strong password, repeated', () => {
    const f = inContext(() =>
      form(signal({ newPassword: 'Secure1!x', confirmPassword: 'Secure1!y' }), newPasswordSchema),
    );
    expect(kinds(f.newPassword)).toEqual([]);
    expect(kinds(f.confirmPassword)).toEqual(['passwordMismatch']);
  });
});
