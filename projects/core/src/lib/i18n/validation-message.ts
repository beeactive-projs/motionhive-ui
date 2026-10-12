import { ValidationErrors } from '@angular/forms';
import {
  MaxLengthValidationError,
  MinLengthValidationError,
  ValidationError,
} from '@angular/forms/signals';

import { TranslateParams, translate } from './translator';

/**
 * Translation key per validator error, in priority order — the first error a
 * control carries is the one shown. Built-in Angular validators plus the custom
 * ones the forms in this repo set (`passwordMismatch`, `passwordStrength`, …).
 */
const KEY_BY_ERROR: Record<string, string> = {
  required: 'validation.required',
  email: 'validation.email',
  minlength: 'validation.minLength',
  maxlength: 'validation.maxLength',
  min: 'validation.min',
  max: 'validation.max',
  passwordStrength: 'validation.passwordStrength',
  passwordMismatch: 'validation.passwordMismatch',
  url: 'validation.url',
  phone: 'validation.phone',
  pattern: 'validation.pattern',
};

/** Per-form wording for an error, e.g. `{ required: 'auth.signUp.termsRequired' }`. */
export type ValidationKeyOverrides = Partial<Record<string, string>>;

/**
 * The message for a control's current errors, or '' when it has none. Takes a
 * reactive control's `errors` map or a Signal Forms field's `errors()` list;
 * overrides are keyed by the reactive name (`minlength`) either way.
 *
 * Replaces the per-component `getFieldError()` bodies: they built text from
 * the control name (`${capitalize(field)} is required`), which cannot be
 * translated. The label beside the field already names it, so the message
 * doesn't need to.
 */
export function validationMessage(
  errors: ValidationErrors | readonly ValidationError[] | null | undefined,
  overrides?: ValidationKeyOverrides,
): string {
  if (!errors) return '';
  const byName = isSignalFormsErrors(errors) ? fromSignalForms(errors) : errors;
  const name = Object.keys(KEY_BY_ERROR).find((n) => n in byName) ?? Object.keys(byName)[0];
  if (!name) return '';

  const key = overrides?.[name] ?? KEY_BY_ERROR[name] ?? 'validation.invalid';
  return translate(key, paramsFor(name, byName[name]));
}

function isSignalFormsErrors(
  errors: ValidationErrors | readonly ValidationError[],
): errors is readonly ValidationError[] {
  return Array.isArray(errors);
}

/** Signal Forms kinds that differ from the reactive error names, with their details reshaped. */
const FROM_SIGNAL_FORMS: Record<string, (error: ValidationError) => [string, unknown]> = {
  minLength: (error) => [
    'minlength',
    { requiredLength: (error as MinLengthValidationError).minLength },
  ],
  maxLength: (error) => [
    'maxlength',
    { requiredLength: (error as MaxLengthValidationError).maxLength },
  ],
};

function fromSignalForms(errors: readonly ValidationError[]): ValidationErrors {
  return Object.fromEntries(
    errors.map((error) => FROM_SIGNAL_FORMS[error.kind]?.(error) ?? [error.kind, error]),
  );
}

function paramsFor(name: string, error: unknown): TranslateParams | undefined {
  const e = error as Record<string, number> | null;
  switch (name) {
    case 'minlength':
      return { min: e?.['requiredLength'] };
    case 'maxlength':
      return { max: e?.['requiredLength'] };
    case 'min':
      return { min: e?.['min'] };
    case 'max':
      return { max: e?.['max'] };
    default:
      return undefined;
  }
}
