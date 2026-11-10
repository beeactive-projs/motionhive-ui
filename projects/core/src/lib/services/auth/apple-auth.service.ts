import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { appLanguage } from '../../i18n/app-language';
import { AppleLoginRequest } from '../../models/auth/social-login.model';
import {
  AppleNonce,
  AppleSharedName,
  appleSharedName,
  createAppleNonce,
  randomHex,
} from '../../utils/apple-sign-in.utils';

/** What `AppleID.auth.signIn()` resolves with in popup mode. */
interface AppleSignInResponse {
  authorization: {
    code?: string;
    id_token?: string;
    state?: string;
  };
  /** Only on the first authorization of MotionHive by this Apple Account. */
  user?: {
    email?: string;
    name?: {
      firstName?: string;
      lastName?: string;
    };
  };
}

interface AppleIdAuth {
  init(config: {
    clientId: string;
    scope: string;
    redirectURI: string;
    state: string;
    nonce: string;
    usePopup: boolean;
  }): void;
  signIn(): Promise<AppleSignInResponse>;
}

/** One prepared sign in: Apple is set up with these before the click. */
interface PreparedSignIn {
  auth: AppleIdAuth;
  nonce: AppleNonce;
  state: string;
}

/** The outcome of a tap on "Continue with Apple". */
export type AppleWebSignInResult =
  | { status: 'signed-in'; request: AppleLoginRequest }
  | { status: 'cancelled' };

/** What Apple's popup rejects with when the person closes it or says no. */
const APPLE_CANCEL_ERRORS = ['popup_closed_by_user', 'user_cancelled_authorize'];

/** Holds the name Apple shared until the API has taken it (see `rememberName`). */
const SHARED_NAME_KEY = 'mh.apple.sharedName';

function appleScriptUrl(): string {
  // Apple's popup speaks the language the script was loaded in.
  let locale = 'en_US';
  if (appLanguage() === 'ro') {
    locale = 'ro_RO';
  }
  return `https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/${locale}/appleid.auth.js`;
}

function getAppleIdAuth(): AppleIdAuth | undefined {
  const w = window as unknown as Record<string, Record<string, unknown> | undefined>;
  const appleId = w['AppleID'];
  if (!appleId) {
    return undefined;
  }
  return appleId['auth'] as AppleIdAuth | undefined;
}

/** The in-flight or finished script load, shared by every button on the page. */
let appleLoad: Promise<AppleIdAuth> | null = null;

/**
 * Loads Apple's script on first use, like `GoogleAuthService` does Google's:
 * a blocked script rejects this promise rather than firing an `error` event
 * nobody listens to yet, and a failed load is forgotten so the next sign in
 * page tries again.
 */
function loadAppleIdAuth(): Promise<AppleIdAuth> {
  const ready = getAppleIdAuth();
  if (ready) {
    return Promise.resolve(ready);
  }
  appleLoad ??= new Promise<AppleIdAuth>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = appleScriptUrl();
    script.async = true;
    script.onload = () => {
      const auth = getAppleIdAuth();
      if (auth) {
        resolve(auth);
      } else {
        reject(new Error('Sign in with Apple did not initialize'));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Sign in with Apple failed to load'));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    appleLoad = null;
    throw error;
  });
  return appleLoad;
}

/** The `sub` claim of an identity token, read without checking it (the API checks). */
function tokenSubject(identityToken: string): string | null {
  const part = identityToken.split('.')[1];
  if (!part) {
    return null;
  }
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64)) as { sub?: unknown };
    if (typeof claims.sub === 'string') {
      return claims.sub;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The page is the web app on its own https origin, the one whose
 * `/auth/login` is registered with Apple as a return URL.
 */
function isRegisteredOrigin(): boolean {
  if (!environment.appleServicesId || typeof window === 'undefined') {
    return false;
  }
  const origin = window.location.origin;
  return origin.startsWith('https://') && origin === environment.webAppUrl;
}

function isCancel(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = (error as { error?: unknown }).error;
  return typeof code === 'string' && APPLE_CANCEL_ERRORS.includes(code);
}

/**
 * Sign in with Apple on the web: Apple's JS in popup mode, with the Services
 * ID (`environment.appleServicesId`). The page draws its own button, to
 * Apple's rules, and calls `signIn()` on the click.
 *
 * Browsers only let a click open a popup while the click is still being
 * handled, so everything slow happens before it: `prepare()` loads Apple's
 * script and sets it up with a fresh nonce and state, and `signIn()` opens
 * the popup first thing, before anything it awaits. After each attempt the
 * next one is prepared.
 *
 * Apple shares the person's name on the first authorization only. It is
 * kept in sessionStorage until the API has answered (`AuthService.appleLogin`
 * calls `forgetSharedName()`), so a retry after a failed request still
 * carries it.
 */
@Injectable({
  providedIn: 'root',
})
export class AppleAuthService {
  /**
   * Apple only answers on the return URLs registered for the Services ID:
   * the web app's own https origins (`app.` and `dev.app.`). So there is no
   * button on localhost, on a preview deploy, nor without a Services ID.
   */
  readonly available = isRegisteredOrigin();

  private _prepared: PreparedSignIn | null = null;
  private _preparing: Promise<PreparedSignIn> | null = null;

  /**
   * Loads Apple's script and sets up the next sign in. Resolves `false` when
   * Apple is unavailable (blocked, offline, or not on this platform).
   */
  async prepare(): Promise<boolean> {
    if (!this.available) {
      return false;
    }
    try {
      await this._prepare();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Opens Apple's popup and resolves with the request for
   * `AuthService.appleLogin()`, or `cancelled` when the person closed it.
   * Rejects when Apple failed, or answered with another sign in's state.
   */
  async signIn(): Promise<AppleWebSignInResult> {
    // Nothing is awaited before Apple's popup opens: see the class comment.
    let prepared = this._prepared;
    let pending: Promise<AppleSignInResponse> | null = null;
    if (prepared) {
      pending = prepared.auth.signIn();
    }
    this._prepared = null;

    try {
      if (!prepared || !pending) {
        prepared = await this._prepare();
        this._prepared = null;
        pending = prepared.auth.signIn();
      }
      const response = await pending;
      return { status: 'signed-in', request: this._toRequest(response, prepared) };
    } catch (error) {
      if (isCancel(error)) {
        return { status: 'cancelled' };
      }
      throw error;
    } finally {
      // A nonce is good for one sign in; set up the next one.
      void this.prepare();
    }
  }

  /** The API has the name now (or the person is signed in): nothing to keep. */
  forgetSharedName(): void {
    try {
      sessionStorage.removeItem(SHARED_NAME_KEY);
    } catch {
      // Storage blocked: there was nothing kept either.
    }
  }

  private async _prepare(): Promise<PreparedSignIn> {
    if (this._prepared) {
      return this._prepared;
    }
    this._preparing ??= (async () => {
      const auth = await loadAppleIdAuth();
      const nonce = await createAppleNonce();
      const state = randomHex(16);
      auth.init({
        clientId: environment.appleServicesId,
        scope: 'name email',
        // One of the Services ID's return URLs (see `available`); the API
        // trades web codes with the same one. In popup mode Apple hands the
        // answer back to this page instead of loading the URL.
        redirectURI: `${window.location.origin}/auth/login`,
        state,
        nonce: nonce.hashed,
        usePopup: true,
      });
      const prepared: PreparedSignIn = { auth, nonce, state };
      this._prepared = prepared;
      return prepared;
    })().finally(() => {
      this._preparing = null;
    });
    return this._preparing;
  }

  private _toRequest(response: AppleSignInResponse, prepared: PreparedSignIn): AppleLoginRequest {
    const authorization = response.authorization;
    if (authorization.state !== prepared.state) {
      throw new Error('Sign in with Apple answered for another sign in');
    }
    const identityToken = authorization.id_token;
    if (!identityToken) {
      throw new Error('No identity token received from Apple');
    }

    const request: AppleLoginRequest = { identityToken, rawNonce: prepared.nonce.raw };
    if (authorization.code) {
      request.authorizationCode = authorization.code;
    }

    const subject = tokenSubject(identityToken);
    let name: AppleSharedName | null = null;
    const user = response.user;
    if (user && user.name) {
      name = appleSharedName(user.name.firstName, user.name.lastName);
    }
    if (name) {
      this._rememberName(subject, name);
    } else {
      name = this._recallName(subject);
    }
    if (name) {
      Object.assign(request, name);
    }
    return request;
  }

  /** Keeps the name Apple shared, for this Apple Account, until the API has it. */
  private _rememberName(subject: string | null, name: AppleSharedName): void {
    if (!subject) {
      return;
    }
    try {
      sessionStorage.setItem(SHARED_NAME_KEY, JSON.stringify({ subject, ...name }));
    } catch {
      // Storage blocked: the name still goes with this request.
    }
  }

  /** The name kept from an earlier try with the same Apple Account, if any. */
  private _recallName(subject: string | null): AppleSharedName | null {
    if (!subject) {
      return null;
    }
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(SHARED_NAME_KEY);
    } catch {
      return null;
    }
    if (!stored) {
      return null;
    }
    try {
      const kept = JSON.parse(stored) as { subject?: unknown; firstName?: unknown; lastName?: unknown };
      if (kept.subject !== subject) {
        return null;
      }
      let firstName: string | null = null;
      let lastName: string | null = null;
      if (typeof kept.firstName === 'string') {
        firstName = kept.firstName;
      }
      if (typeof kept.lastName === 'string') {
        lastName = kept.lastName;
      }
      return appleSharedName(firstName, lastName);
    } catch {
      return null;
    }
  }
}
