import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { FacebookAuthService, FacebookOAuthMessage } from './facebook-auth.service';

/** A stand-in for the popup window: only `closed` and `close()` are read. */
interface FakePopup {
  closed: boolean;
  close: () => void;
}

describe('FacebookAuthService (Facebook Login on the web)', () => {
  let service: FacebookAuthService;
  let popup: FakePopup;
  let openedUrl: string | null;

  /** The `state` the service sent to Facebook. */
  function sentState(): string {
    return new URL(openedUrl as string).searchParams.get('state') as string;
  }

  /** What the callback page posts back to the opener. */
  function answer(message: Omit<FacebookOAuthMessage, 'type'>, origin = window.location.origin): void {
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'facebook-oauth-callback', ...message }, origin }),
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    openedUrl = null;
    popup = { closed: false, close: () => (popup.closed = true) };
    vi.spyOn(window, 'open').mockImplementation((url) => {
      openedUrl = String(url);
      return popup as unknown as Window;
    });
    TestBed.configureTestingModule({});
    service = TestBed.inject(FacebookAuthService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens Facebook dialog for email and profile, back to the callback page on this origin', () => {
    void service.signIn();

    const url = new URL(openedUrl as string);
    expect(url.origin).toBe('https://www.facebook.com');
    expect(url.pathname).toMatch(/\/dialog\/oauth$/);
    expect(url.searchParams.get('redirect_uri')).toBe(`${window.location.origin}/auth/facebook-callback`);
    expect(url.searchParams.get('scope')).toBe('email,public_profile');
    expect(url.searchParams.get('response_type')).toBe('token');
    expect(sentState()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('resolves with the access token when Facebook answers with this sign in state', async () => {
    const pending = service.signIn();
    answer({ accessToken: 'EAAtoken', state: sentState() });

    await expect(pending).resolves.toEqual({ status: 'signed-in', accessToken: 'EAAtoken' });
  });

  it('counts Cancel on Facebook dialog as cancelled, not as a failure', async () => {
    const pending = service.signIn();
    answer({ error: 'access_denied', errorReason: 'user_denied', state: sentState() });

    await expect(pending).resolves.toEqual({ status: 'cancelled' });
  });

  it('counts a popup closed with no answer as cancelled', async () => {
    const pending = service.signIn();
    popup.closed = true;
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toEqual({ status: 'cancelled' });
  });

  it('still takes the token when the callback page closes itself right after posting', async () => {
    const pending = service.signIn();
    popup.closed = true;
    await vi.advanceTimersByTimeAsync(500);
    answer({ accessToken: 'EAAlate', state: sentState() });

    await expect(pending).resolves.toEqual({ status: 'signed-in', accessToken: 'EAAlate' });
  });

  it('rejects an answer carrying another sign in state', async () => {
    const pending = service.signIn();
    answer({ accessToken: 'EAAtoken', state: 'someone-elses' });

    await expect(pending).rejects.toThrow('OAuth state mismatch');
  });

  it('rejects any other Facebook error', async () => {
    const pending = service.signIn();
    answer({ error: 'server_error', errorDescription: 'Something broke', state: sentState() });

    await expect(pending).rejects.toThrow('Something broke');
  });

  it('ignores messages from other origins', async () => {
    const pending = service.signIn();
    answer({ accessToken: 'EAAforged', state: sentState() }, 'https://evil.example');
    answer({ accessToken: 'EAAtoken', state: sentState() });

    await expect(pending).resolves.toEqual({ status: 'signed-in', accessToken: 'EAAtoken' });
  });

  it('rejects when the browser blocked the popup', async () => {
    vi.mocked(window.open).mockReturnValue(null);

    await expect(service.signIn()).rejects.toThrow(/Popup was blocked/);
  });
});
