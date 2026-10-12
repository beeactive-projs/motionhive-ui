import { Pipe, PipeTransform } from '@angular/core';
import { ValidationErrors } from '@angular/forms';
import { ValidationError } from '@angular/forms/signals';

import { ValidationKeyOverrides, validationMessage } from '../i18n/validation-message';

/**
 * Translated message for a field's errors, from reactive forms or Signal Forms:
 *
 *   {{ form.controls.email.errors | fieldError }}
 *   {{ form.email().errors() | fieldError: fieldErrors.email }}
 *
 * (`fieldErrors` being core's `AUTH_FIELD_ERRORS`, or any `ValidationKeyOverrides`.)
 *
 * Pure: both hand over a new errors value whenever validity changes, and the
 * UI language is fixed for the page load.
 */
@Pipe({ name: 'fieldError' })
export class FieldErrorPipe implements PipeTransform {
  transform(
    errors: ValidationErrors | readonly ValidationError[] | null | undefined,
    overrides?: ValidationKeyOverrides,
  ): string {
    return validationMessage(errors, overrides);
  }
}
