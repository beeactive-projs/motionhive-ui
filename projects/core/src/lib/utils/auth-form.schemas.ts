import { email, required, schema } from '@angular/forms/signals';

import { LoginRequest } from '../models/auth/login.model';
import { ForgotPasswordRequest, ResetPasswordRequest } from '../models/auth/password-reset.model';
import { RegisterRequest } from '../models/auth/register.model';
import {
  matchesPassword,
  minLengthTrimmed,
  requiredTrimmed,
  strongPassword,
} from './signal-form.utils';

/**
 * The validation of the auth forms, shared by web and mobile so both apps
 * accept exactly the same input. Pass one to `form()` directly, or `apply()`
 * it inside a page's own schema to add page-specific rules:
 * `form(model, (p) => { apply(p, signUpSchema); disabled(p.email, …); })`.
 * A page's model may carry extra fields (sign up's coach checkbox).
 */

/**
 * Sign in. Presence only for the password: the policy is checked where a
 * password is set, so an account made under an older policy can still sign in.
 */
export const signInSchema = schema<LoginRequest>((p) => {
  required(p.email);
  email(p.email);
  required(p.password);
});

/** A form that only asks for an email address (password reset request). */
export const emailSchema = schema<ForgotPasswordRequest>((p) => {
  required(p.email);
  email(p.email);
});

/** Sign up: trimmed names, an email, and a password that meets the policy, typed twice. */
export const signUpSchema = schema<
  Pick<RegisterRequest, 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword'>
>((p) => {
  requiredTrimmed(p.firstName);
  minLengthTrimmed(p.firstName, 2);
  requiredTrimmed(p.lastName);
  minLengthTrimmed(p.lastName, 2);
  required(p.email);
  email(p.email);
  required(p.password);
  strongPassword(p.password);
  required(p.confirmPassword);
  matchesPassword(p.confirmPassword, p.password);
});

/** A new password from a reset link: the same policy as sign up, typed twice. */
export const newPasswordSchema = schema<Omit<ResetPasswordRequest, 'token'>>((p) => {
  required(p.newPassword);
  strongPassword(p.newPassword);
  required(p.confirmPassword);
  matchesPassword(p.confirmPassword, p.newPassword);
});
