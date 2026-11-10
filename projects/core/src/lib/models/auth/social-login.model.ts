export interface GoogleLoginRequest {
  idToken: string;
}

export interface FacebookLoginRequest {
  accessToken: string;
}

/**
 * A completed Sign in with Apple, for `POST /auth/apple`. The API checks
 * `identityToken` against Apple, and that its `nonce` claim is the SHA-256
 * of `rawNonce` (Apple was given the hash, see `createAppleNonce`).
 */
export interface AppleLoginRequest {
  identityToken: string;
  rawNonce: string;
  /** Apple's one-time code: the API trades it for the token that revokes Apple on account deletion. */
  authorizationCode?: string;
  /** Only when Apple shared a name, which it does on the first sign in alone. */
  firstName?: string;
  lastName?: string;
}
