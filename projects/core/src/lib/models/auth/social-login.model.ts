export interface GoogleLoginRequest {
  idToken: string;
}

/**
 * A completed Facebook sign in, for `POST /auth/facebook`, in one of two
 * shapes. The API answers 400 to any other mix (both tokens, a nonce with
 * the access token).
 */
export type FacebookLoginRequest = FacebookAccessTokenLogin | FacebookLimitedLogin;

/** Facebook Login's Graph access token: the web popup and the Android app. */
export interface FacebookAccessTokenLogin {
  accessToken: string;
  idToken?: never;
  rawNonce?: never;
}

/**
 * Limited Login on iPhone, which never asks for tracking: Facebook's OpenID
 * Connect ID token, and the nonce the app gave Facebook. Facebook copies the
 * nonce into the token as is (no hash, unlike Apple), and the API checks the
 * two match.
 */
export interface FacebookLimitedLogin {
  idToken: string;
  rawNonce: string;
  accessToken?: never;
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
