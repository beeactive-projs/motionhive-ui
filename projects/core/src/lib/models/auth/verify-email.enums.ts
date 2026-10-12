/** What the email verification page shows (web and mobile). */
export const VerifyEmailStates = {
  /** The request is in flight. */
  Verifying: 'verifying',
  /** Verified (now or before); redirects to sign in. */
  Success: 'success',
  /** The token is expired or unknown. */
  Invalid: 'invalid',
  /** The link has no token at all. */
  Missing: 'missing',
} as const;

export type VerifyEmailState = (typeof VerifyEmailStates)[keyof typeof VerifyEmailStates];
