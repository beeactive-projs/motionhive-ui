import { describe, expect, it } from 'vitest';

import { SESSION_ACCESS_LEVELS } from '../constants/session-meta.const';
import { GenderLabels } from '../models/profile/profile.enums';
import { SessionAccess } from '../models/session/session.enums';
import { enumLabel, enumLabelMap, withEnumLabels } from './enum-label';

describe('enumLabel', () => {
  it('reads enum.<domain>.<VALUE>', () => {
    expect(enumLabel('clientStatus', 'ARCHIVED')).toBe('Archived');
  });

  // A status the BE added before the JSON caught up must not render as a key.
  it('humanises a value with no key yet', () => {
    expect(enumLabel('invoiceStatus', 'PAST_DUE')).toBe('Past due');
  });

  it('is empty for no value', () => {
    expect(enumLabel('clientStatus', null)).toBe('');
  });
});

describe('enumLabelMap / withEnumLabels', () => {
  it('builds a map whose labels translate when read', () => {
    const map = enumLabelMap('gender', ['MALE', 'PREFER_NOT_TO_SAY'] as const);
    expect(map.PREFER_NOT_TO_SAY).toBe('Prefer not to say');
    expect(Object.keys(map)).toEqual(['MALE', 'PREFER_NOT_TO_SAY']);
  });

  it('adds a label getter beside existing metadata', () => {
    const record = withEnumLabels('sessionLocationKind', { ONLINE: { tone: 'teal' } });
    expect(record.ONLINE).toEqual({ tone: 'teal', label: 'Online' });
  });

  it('backs the core label tables', () => {
    expect(GenderLabels.FEMALE).toBe('Female');
    // "Paid", not "Open" — user-owned copy for the OPEN access level.
    expect(SESSION_ACCESS_LEVELS[SessionAccess.Open].label).toBe('Paid');
    expect(SESSION_ACCESS_LEVELS[SessionAccess.Open].sub).toBe('Anyone with the link can book.');
  });
});
