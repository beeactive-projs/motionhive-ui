import {
  FieldTree,
  SchemaPath,
  minLengthError,
  requiredError,
  validate,
} from '@angular/forms/signals';

import { PASSWORD_RULES } from './form.utils';

/**
 * Signal Forms rules shared by the apps' forms. Use them inside a `form()`
 * schema: `form(model, (p) => { strongPassword(p.password); })`. Their error
 * kinds match the keys `validationMessage` / `fieldError` translate.
 */

/**
 * Required, but whitespace-only fails too, as `required` with the standard
 * error. Names and other free text should use this rather than `required`.
 */
export function requiredTrimmed(path: SchemaPath<string>): void {
  validate(path, ({ value }) => (value().trim() ? undefined : requiredError()));
}

/** `minLength` measured on the trimmed value, so padding can't satisfy it. Empty passes. */
export function minLengthTrimmed(path: SchemaPath<string>, min: number): void {
  validate(path, ({ value }) => {
    const length = value().trim().length;
    return length && length < min ? minLengthError(min) : undefined;
  });
}

/**
 * The password policy (`PASSWORD_RULES`, what the API enforces) as
 * `{ kind: 'passwordStrength' }`. Empty passes, so pair it with `required`.
 */
export function strongPassword(path: SchemaPath<string>): void {
  validate(path, ({ value }) =>
    !value() || PASSWORD_RULES.every((rule) => rule.test(value()))
      ? undefined
      : { kind: 'passwordStrength' },
  );
}

/**
 * A confirmation field must repeat `password`: `{ kind: 'passwordMismatch' }`
 * once it has a value (an empty one is left to `required`). It sits on the
 * confirmation itself, so editing either field re-checks it.
 */
export function matchesPassword(confirm: SchemaPath<string>, password: SchemaPath<string>): void {
  validate(confirm, ({ value, valueOf }) =>
    value() && value() !== valueOf(password) ? { kind: 'passwordMismatch' } : undefined,
  );
}

/**
 * Whether to show a field's error. Validation shows on blur: a field being
 * filled in for the first time stays quiet; once left (or the form submitted,
 * which touches every field) its message follows each change, so a fix clears
 * it straight away.
 */
export function isFieldInvalid(field: { invalid(): boolean; touched(): boolean }): boolean {
  return field.invalid() && field.touched();
}

/**
 * A submission's `onInvalid`: focuses the first field with an error, so
 * keyboard and screen reader users land on what needs fixing.
 * `form(model, schema, { submission: { action, onInvalid: focusFirstInvalid } })`.
 */
export function focusFirstInvalid(form: FieldTree<unknown>): void {
  form().errorSummary()[0]?.fieldTree().focusBoundControl();
}
