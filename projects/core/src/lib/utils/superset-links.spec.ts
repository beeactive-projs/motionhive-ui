import { describe, expect, it } from 'vitest';

import { linkWithNext, supersetChanges } from './superset-links';

const row = (id: string, supersetGroupId: number | null) => ({ id, supersetGroupId });

describe('supersetChanges', () => {
  it('lists every row a link renumbered, and no other', () => {
    // A1 B1 C D E2 F2: linking C with D renumbers E and F.
    const before = [row('a', 1), row('b', 1), row('c', null), row('d', null), row('e', 2), row('f', 2)];
    const after = linkWithNext(before, 2);
    expect(supersetChanges(before, after)).toEqual([
      { id: 'c', supersetGroupId: 2 },
      { id: 'd', supersetGroupId: 2 },
      { id: 'e', supersetGroupId: 3 },
      { id: 'f', supersetGroupId: 3 },
    ]);
  });

  it('is empty when nothing moved', () => {
    const rows = [row('a', 1), row('b', 1)];
    expect(supersetChanges(rows, rows)).toEqual([]);
  });
});
