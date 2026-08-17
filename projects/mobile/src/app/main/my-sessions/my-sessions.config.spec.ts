/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { SessionParticipantStatus } from 'core';

import { BOOKING_TABS, MY_SESSION_ICONS, TAB_SOURCES, bookingTone } from './my-sessions.config';

/** Every template in this feature, inlined at build time by Vite. */
const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Every TypeScript file, for the icon names that live in code. */
const sources = import.meta.glob('./**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `person-outline` → `personOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Icon names these screens can render.
 *
 * Templates are not enough here: the booking-outcome sheet picks its glyph in
 * TypeScript, one per outcome, and three of those shipped unregistered because
 * a template scan could never see them.
 */
function iconNamesUsed(): string[] {
  const names = new Set<string>();

  for (const html of Object.values(templates)) {
    for (const match of html.matchAll(/\bname="([a-z][a-z0-9-]*)"/g)) {
      names.add(match[1]);
    }
    for (const binding of html.matchAll(/\[name\]="([^"]*)"/g)) {
      for (const literal of binding[1].matchAll(/'([a-z][a-z0-9-]*)'/g)) {
        names.add(literal[1]);
      }
    }
  }

  for (const [path, src] of Object.entries(sources)) {
    if (path.endsWith('.spec.ts')) continue;
    for (const match of src.matchAll(/icon: '([a-z][a-z0-9-]*)'/g)) {
      names.add(match[1]);
    }
  }

  return [...names];
}

const registered = new Set(Object.keys(MY_SESSION_ICONS));

describe('MY_SESSION_ICONS', () => {
  it('registers every icon these screens render, including the ones set in code', () => {
    const used = iconNamesUsed();
    expect(used.length).toBeGreaterThan(0);

    for (const name of used) {
      expect(registered, `${name} is used but not registered`).toContain(toCamelCase(name));
    }
  });
});

describe('booking buckets', () => {
  // Awaiting-approval and waitlisted bookings are upcoming sessions you do not
  // have a seat for. Splitting them out made "what is next" three questions.
  it('folds pending and waitlisted into Upcoming', () => {
    expect(TAB_SOURCES.upcoming).toEqual(['upcoming', 'pendingApproval', 'waitlisted']);
  });

  it('keeps cancelled out of the header', () => {
    expect(BOOKING_TABS.map((tab) => tab.key)).toEqual(['upcoming', 'past']);
  });
});

describe('bookingTone', () => {
  // The spine answers "do I have a seat", not "what kind of session is this" —
  // that is the coach's question and the coach's row.
  it('keys the spine to the booking, not the session type', () => {
    expect(bookingTone(SessionParticipantStatus.Confirmed, false)).toBe('emerald');
    expect(bookingTone(SessionParticipantStatus.PendingApproval, false)).toBe('honey');
    expect(bookingTone(SessionParticipantStatus.Waitlisted, false)).toBe('sky');
  });

  it('mutes anything already settled, whatever the booking said', () => {
    expect(bookingTone(SessionParticipantStatus.Confirmed, true)).toBe('slate');
    expect(bookingTone(SessionParticipantStatus.Cancelled, false)).toBe('slate');
  });
});
