import { describe, expect, it } from 'vitest';

import { MessageAttachment, ShareResult } from 'core';

import {
  SHARE_STYLES,
  sessionDateParts,
  shareActionKey,
  shareLink,
  shareSummary,
  toggleRecipient,
} from './share.config';

function attachment(card: MessageAttachment['card'], id = 'x-1'): MessageAttachment {
  return { type: card.type, id, card };
}

describe('shareLink', () => {
  const available = (type: string) => ({ type, state: 'AVAILABLE' }) as MessageAttachment['card'];

  it('opens each kind in the Messages tab, so back returns to the chat', () => {
    const chat = '/tabs/messages/c-1';
    expect(shareLink(attachment(available('SESSION'), 's-1'), chat)).toEqual([
      '/tabs/messages/shared',
      'session',
      's-1',
    ]);
    expect(shareLink(attachment(available('GROUP'), 'g-1'), chat)).toEqual([
      '/tabs/messages/groups',
      'preview',
      'g-1',
    ]);
    expect(shareLink(attachment(available('EXERCISE'), 'e-1'), chat)).toEqual([
      '/tabs/messages/shared',
      'exercise',
      'e-1',
    ]);
    expect(shareLink(attachment(available('PROGRAM'), 'p-1'), chat)).toEqual([
      '/tabs/messages/shared',
      'routine',
      'p-1',
    ]);
  });

  it('opens each kind in the stack of a chat opened from a profile', () => {
    const chat = '/tabs/clients/chat/c-1';
    expect(shareLink(attachment(available('SESSION'), 's-1'), chat)).toEqual([
      '/tabs/clients/chat/shared',
      'session',
      's-1',
    ]);
    expect(shareLink(attachment(available('GROUP'), 'g-1'), chat)).toEqual([
      '/tabs/clients/groups',
      'preview',
      'g-1',
    ]);
    expect(shareLink(attachment(available('EXERCISE'), 'e-1'), chat)).toEqual([
      '/tabs/clients/chat/shared',
      'exercise',
      'e-1',
    ]);
  });

  it('opens a coach in the stack the chat is in, and nothing without a handle', () => {
    const coach = { type: 'COACH', state: 'AVAILABLE', handle: 'ana' } as MessageAttachment['card'];
    expect(shareLink(attachment(coach), '/tabs/messages/c-1')).toEqual([
      '/tabs/messages/person',
      'ana',
    ]);
    const noHandle = { ...coach, handle: null } as MessageAttachment['card'];
    expect(shareLink(attachment(noHandle), '/tabs/messages/c-1')).toBeNull();
  });

  it('opens nothing for something gone or no longer public', () => {
    expect(
      shareLink(attachment({ type: 'GROUP', state: 'UNAVAILABLE', name: null }), '/'),
    ).toBeNull();
  });
});

describe('shareActionKey', () => {
  it('says routine or program from the card, the kind otherwise', () => {
    expect(
      shareActionKey({ type: 'PROGRAM', state: 'AVAILABLE', isSingleWorkout: true } as MessageAttachment['card']),
    ).toBe('share.view.ROUTINE');
    expect(shareActionKey({ type: 'SESSION', state: 'ENDED' } as MessageAttachment['card'])).toBe(
      'share.view.SESSION',
    );
  });

  it('has a tile for every kind', () => {
    expect(Object.keys(SHARE_STYLES).sort()).toEqual(
      ['COACH', 'EXERCISE', 'GROUP', 'PROGRAM', 'SESSION'],
    );
  });
});

describe('sessionDateParts', () => {
  it('reads the day and time in the session\'s own time zone', () => {
    // 05:00 UTC is 07:00 in Bucharest in winter.
    const parts = sessionDateParts('2027-01-09T05:00:00Z', 'Europe/Bucharest', 'en-GB');
    expect(parts.day).toBe('9');
    expect(parts.time).toBe('07:00');
    expect(parts.month.toLowerCase()).toContain('jan');
  });
});

describe('toggleRecipient', () => {
  it('picks, unpicks, and stops at the limit', () => {
    const empty = new Map<string, { id: string }>();
    const one = toggleRecipient(empty, { id: 'a' }, 2);
    const two = toggleRecipient(one, { id: 'b' }, 2);
    expect([...two.keys()]).toEqual(['a', 'b']);
    expect(toggleRecipient(two, { id: 'c' }, 2)).toBe(two);
    expect([...toggleRecipient(two, { id: 'a' }, 2).keys()]).toEqual(['b']);
  });
});

describe('shareSummary', () => {
  const result = (status: ShareResult['status']): ShareResult => ({
    recipientId: 'u',
    status,
    conversationId: null,
    reason: null,
  });

  it('counts a request as reached', () => {
    expect(shareSummary([result('SENT'), result('WAITING')])).toEqual({
      key: 'share.toast.sent',
      params: { count: 2 },
      ok: true,
    });
  });

  it('says how many could not get it', () => {
    expect(shareSummary([result('SENT'), result('REFUSED')])).toEqual({
      key: 'share.toast.partial',
      params: { count: 1, refused: 1 },
      ok: true,
    });
    expect(shareSummary([result('REFUSED')]).ok).toBe(false);
  });
});
