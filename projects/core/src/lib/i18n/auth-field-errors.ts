import { ValidationKeyOverrides } from './validation-message';

/**
 * Per-field wording for the auth forms' errors (web and mobile), passed to
 * `fieldError` / `validationMessage`: each message names its field ("Enter
 * your email address.") instead of the generic "This field is required.".
 */
export const AUTH_FIELD_ERRORS = {
  firstName: {
    required: 'validation.auth.firstNameRequired',
    minlength: 'validation.auth.firstNameMinLength',
  },
  lastName: {
    required: 'validation.auth.lastNameRequired',
    minlength: 'validation.auth.lastNameMinLength',
  },
  email: {
    required: 'validation.auth.emailRequired',
    email: 'validation.auth.emailInvalid',
  },
  /** Signing in with an existing password. */
  password: {
    required: 'validation.auth.passwordRequired',
  },
  /** Creating a password (sign up, reset). */
  newPassword: {
    required: 'validation.auth.newPasswordRequired',
    passwordStrength: 'validation.auth.passwordStrength',
  },
  confirmPassword: {
    required: 'validation.auth.confirmPasswordRequired',
    passwordMismatch: 'validation.auth.passwordMismatch',
  },
} satisfies Record<string, ValidationKeyOverrides>;
