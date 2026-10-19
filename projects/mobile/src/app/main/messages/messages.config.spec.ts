/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { ConversationListItem } from 'core';

import {
  ConversationActions,
  MESSAGING_ICONS,
  conversationActions,
  recentFromPerson,
  suggestedPeople,
} from './messages.config';

/** Every template in this feature, inlined at build time by Vite. */
const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `person-outline` → `personOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Icon names the templates reference:
 *   - static `name="…"` / `icon="…"` attributes
 *   - kebab-case literals inside a bound `[name]="…"` / `[icon]="…"`, which is
 *     how a row picks between two icons on a condition
 *
 * A name built by concatenation would slip through, but nothing here does that
 * and the alternative is a hand-kept list that silently rots.
 */
function iconNamesInTemplates(): string[] {
  const names = new Set<string>();

  for (const html of Object.values(templates)) {
    for (const match of html.matchAll(/\b(?:name|icon)="([a-z][a-z0-9-]*)"/g)) {
      names.add(match[1]);
    }
    for (const binding of html.matchAll(/\[(?:name|icon)\]="([^"]*)"/g)) {
      for (const literal of binding[1].matchAll(/'([a-z][a-z0-9-]*)'/g)) {
        names.add(literal[1]);
      }
    }
  }

  // Ionic's own components name these; we never register them.
  names.delete('crescent');
  return [...names];
}

const registered = new Set(Object.keys(MESSAGING_ICONS));

describe('MESSAGING_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere, which
  // is exactly the kind of thing that ships. Same guard as ACCOUNT_ICONS.
  it('registers every icon the messages templates render', () => {
    const used = iconNamesInTemplates();
    expect(used.length).toBeGreaterThan(0);

    for (const name of used) {
      expect(registered, `${name} is used but not registered`).toContain(toCamelCase(name));
    }
  });

  // The opposite drift: icons kept around for screens that changed.
  it('registers nothing the templates do not use', () => {
    const used = new Set(iconNamesInTemplates().map(toCamelCase));

    for (const key of registered) {
      expect(used, `${key} is registered but unused`).toContain(key);
    }
  });
});

describe('conversationActions', () => {
  it('offers profile, mute, then block for a person with a handle', () => {
    expect(conversationActions(false, true).map((a) => a.id)).toEqual([
      ConversationActions.Profile,
      ConversationActions.Mute,
      ConversationActions.Block,
    ]);
  });

  it('leaves out the profile row when there is no handle to open', () => {
    expect(conversationActions(false, false).map((a) => a.id)).toEqual([
      ConversationActions.Mute,
      ConversationActions.Block,
    ]);
  });

  it('flips the notification row with the mute state', () => {
    const mute = (muted: boolean) =>
      conversationActions(muted, true).find((a) => a.id === ConversationActions.Mute);

    expect(mute(false)).toMatchObject({
      label: 'messages.actions.mute',
      icon: 'notifications-off-outline',
    });
    expect(mute(true)).toMatchObject({
      label: 'messages.actions.unmute',
      icon: 'notifications-outline',
    });
  });

  it('keeps block alone in the destructive card', () => {
    const destructive = conversationActions(false, true).filter((a) => a.destructive);
    expect(destructive.map((a) => a.id)).toEqual([ConversationActions.Block]);
  });

  // The sheet renders these through `mh-hex-avatar`, which needs them registered.
  it('only uses registered icons', () => {
    for (const action of [...conversationActions(false, true), ...conversationActions(true, true)]) {
      expect(registered).toContain(toCamelCase(action.icon ?? ''));
    }
  });
});

/** A conversation row with the fields the suggestion strip reads. */
function conversation(
  id: string,
  otherUser: ConversationListItem['otherUser'],
): ConversationListItem {
  return { id, type: otherUser ? 'DIRECT' : 'GROUP', otherUser } as ConversationListItem;
}

function person(id: string, firstName: string, handle: string | null = null) {
  return { id, firstName, lastName: 'Pop', avatarUrl: null, handle };
}

describe('search start', () => {
  it('remembers a person with their handle under the name', () => {
    expect(recentFromPerson(person('u1', 'Ana', 'ana'))).toEqual({
      id: 'u1',
      name: 'Ana Pop',
      avatarUrl: null,
      subline: '@ana',
    });
    expect(recentFromPerson(person('u1', 'Ana')).subline).toBeNull();
  });

  it('suggests the people from the latest conversations, once each, minus the recents', () => {
    const inbox = [
      conversation('c1', person('u1', 'Ana')),
      conversation('c2', null),
      conversation('c3', person('u2', 'Bogdan')),
      conversation('c4', person('u1', 'Ana')),
      conversation('c5', person('u3', 'Corina')),
      conversation('c6', person('u4', 'Dan')),
    ];

    expect(suggestedPeople(inbox, ['u2'], 2).map((entry) => entry.id)).toEqual(['u1', 'u3']);
  });
});
