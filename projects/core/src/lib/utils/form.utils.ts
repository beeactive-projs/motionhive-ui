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
