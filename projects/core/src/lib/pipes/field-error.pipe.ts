import { Pipe, PipeTransform } from '@angular/core';
import { ValidationErrors } from '@angular/forms';

import { ValidationKeyOverrides, validationMessage } from '../i18n/validation-message';

/**
 * Translated message for a control's errors:
 *
 *   {{ form.controls.email.errors | fieldError }}
 *   {{ form.controls.terms.errors | fieldError: { required: 'auth.signUp.termsRequired' } }}
 *
 * Pure: Angular replaces a control's `errors` object whenever its validity
 * changes, and the UI language is fixed for the page load.
 */
@Pipe({ name: 'fieldError' })
export class FieldErrorPipe implements PipeTransform {
  transform(errors: ValidationErrors | null | undefined, overrides?: ValidationKeyOverrides): string {
    return validationMessage(errors, overrides);
  }
}
