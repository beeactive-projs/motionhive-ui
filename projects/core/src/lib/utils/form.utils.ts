import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Like `Validators.required`, but whitespace-only strings also fail.
 * Returns the same `{ required: true }` shape so error mapping written
 * against the built-in validator keeps working.
 */
export const noWhitespaceValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = control.value as string | null | undefined;
  return value && value.trim().length > 0 ? null : { required: true };
};

/**
 * `Validators.minLength`, but measured on the trimmed value so padding
 * spaces can't satisfy the minimum. Empty values pass — pair with
 * `noWhitespaceValidator` when the field is also required.
 */
export function trimmedMinLength(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = ((control.value as string | null | undefined) ?? '').trim();
    if (!value) return null;
    return value.length < min
      ? { minlength: { requiredLength: min, actualLength: value.length } }
      : null;
  };
}

/** One requirement of the password policy, with the translation key of its short label. */
export interface PasswordRule {
  labelKey: string;
  test: (password: string) => boolean;
}

/**
 * The password policy the API enforces on sign up and reset (its
 * `IsStrongPassword`), one rule per requirement so a form can show each one
 * as met or not while the user types. The `strongPassword` Signal Forms rule
 * is built from this list, so the two can't drift apart.
 */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  { labelKey: 'form.hint.passwordRule.length', test: (p) => p.length >= 8 },
  { labelKey: 'form.hint.passwordRule.uppercase', test: (p) => /[A-Z]/.test(p) },
  { labelKey: 'form.hint.passwordRule.lowercase', test: (p) => /[a-z]/.test(p) },
  { labelKey: 'form.hint.passwordRule.number', test: (p) => /[0-9]/.test(p) },
  {
    labelKey: 'form.hint.passwordRule.symbol',
    // Exactly the API's symbol set: a backtick or `~` alone fails there.
    test: (p) => /[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]/.test(p),
  },
];
