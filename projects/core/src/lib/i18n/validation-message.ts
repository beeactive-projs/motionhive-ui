import { ValidationErrors } from '@angular/forms';

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
 * The message for a control's current errors, or '' when it has none.
 *
 * Replaces the per-component `getFieldError()` bodies: they built text from
 * the control name (`${capitalize(field)} is required`), which cannot be
 * translated. The label beside the field already names it, so the message
 * doesn't need to.
 */
export function validationMessage(
  errors: ValidationErrors | null | undefined,
  overrides?: ValidationKeyOverrides,
): string {
  if (!errors) return '';
  const name = Object.keys(KEY_BY_ERROR).find((n) => n in errors) ?? Object.keys(errors)[0];
  if (!name) return '';

  const key = overrides?.[name] ?? KEY_BY_ERROR[name] ?? 'validation.invalid';
  return translate(key, paramsFor(name, errors[name]));
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
