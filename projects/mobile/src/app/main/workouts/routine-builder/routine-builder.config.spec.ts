/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { linkWithNext, normalizeSupersets, supersetTags, unlinkFromNext } from './routine-builder.config';

const rows = (...groups: (number | null)[]) => groups.map((supersetGroupId, i) => ({ id: i, supersetGroupId }));
const groups = (list: { supersetGroupId: number | null }[]) => list.map((r) => r.supersetGroupId);

describe('superset links in the builder', () => {
  it('links two rows into a superset, and a third onto it', () => {
    const linked = linkWithNext(rows(null, null, null), 0);
    expect(groups(linked)).toEqual([1, 1, null]);
    expect(groups(linkWithNext(linked, 1))).toEqual([1, 1, 1]);
  });

  it('merges two supersets when the rows between them are linked', () => {
    expect(groups(linkWithNext(rows(1, 1, 2, 2), 1))).toEqual([1, 1, 1, 1]);
  });

  it('unlinks, leaving a row alone unlinked', () => {
    expect(groups(unlinkFromNext(rows(1, 1), 0))).toEqual([null, null]);
    expect(groups(unlinkFromNext(rows(1, 1, 1), 0))).toEqual([null, 1, 1]);
    expect(groups(unlinkFromNext(rows(1, 1, 1, 1), 1))).toEqual([1, 1, 2, 2]);
  });

  it('cleans a group of one left behind by a removal', () => {
    expect(groups(normalizeSupersets(rows(3, null, 3, 3)))).toEqual([null, null, 1, 1]);
  });

  it('tags rows A1, A2, B1', () => {
    expect(supersetTags(rows(1, 1, null, 2, 2))).toEqual(['A1', 'A2', null, 'B1', 'B2']);
  });
});
