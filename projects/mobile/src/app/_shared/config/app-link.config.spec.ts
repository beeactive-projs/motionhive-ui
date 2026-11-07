import { describe, expect, it } from 'vitest';

import { resolveAppLink, resolveLiveLink } from './app-link.config';

const HOST = 'dev.app.motionhive.fit';
const at = (path: string) => resolveAppLink(`https://${HOST}${path}`, HOST);

describe('resolveAppLink', () => {
  it('opens the emailed auth pages with their token', () => {
    expect(at('/auth/verify-email?token=abc')).toEqual({
      commands: ['/auth', 'verify-email'],
      queryParams: { token: 'abc' },
    });
    expect(at('/auth/new-password?token=t1')).toEqual({
      commands: ['/auth', 'new-password'],
      queryParams: { token: 't1' },
    });
    expect(at('/auth/login')).toEqual({ commands: ['/auth', 'login'], queryParams: null });
  });

  it('refuses an auth path the app has no page for', () => {
    expect(at('/auth/callback/google')).toBeNull();
    expect(at('/auth/oauth')).toBeNull();
  });

  it('opens a conversation from a message email', () => {
    expect(at('/messages?conversationId=c-1')).toEqual({
      commands: ['/tabs/messages', 'c-1'],
      queryParams: null,
    });
  });

  it('peels the id off a screen that has a slash in it', () => {
    expect(at('/coaching/sessions/s-1')?.commands).toEqual(['/tabs/coach/sessions', 's-1']);
    expect(at('/coaching/sessions')?.commands).toEqual(['/tabs/coach/sessions']);
    expect(at('/groups/g-1')?.commands).toEqual(['/tabs/groups', 'g-1']);
  });

  it('lands a request email on the Requests chip', () => {
    expect(at('/coaching/pending-requests')).toEqual({
      commands: ['/tabs/clients'],
      queryParams: { filter: 'requests' },
    });
  });

  it('returns null for a page the app does not have', () => {
    expect(at('/profile?tab=coaches')).toBeNull();
    expect(at('/')).toBeNull();
  });

  it('refuses a link to another environment or a non-https one', () => {
    expect(resolveAppLink('https://app.motionhive.fit/messages', HOST)).toBeNull();
    expect(resolveAppLink(`http://${HOST}/messages`, HOST)).toBeNull();
    expect(resolveAppLink('not a url', HOST)).toBeNull();
  });
});

describe('resolveLiveLink', () => {
  it('opens the logger on the set "Other value" names', () => {
    expect(resolveLiveLink('motionhive://log/log-1?set=set-2')).toEqual({
      commands: ['/tabs/workouts/log', 'log-1'],
      queryParams: { set: 'set-2' },
    });
    expect(resolveLiveLink('motionhive://log/log-1')).toEqual({
      commands: ['/tabs/workouts/log', 'log-1'],
      queryParams: null,
    });
  });

  it('leaves anything else to the web link resolver', () => {
    expect(resolveLiveLink(`https://${HOST}/log/log-1`)).toBeNull();
    expect(resolveLiveLink('motionhive://profile/me')).toBeNull();
    expect(resolveLiveLink('motionhive://log/')).toBeNull();
    expect(resolveLiveLink('not a url')).toBeNull();
  });
});
