import { describe, expect, it } from 'vitest';

import { appendUnique } from './list.utils';

describe('appendUnique', () => {
  it('appends the page, leaving out a row already held', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    const page = [{ id: 'b' }, { id: 'c' }];

    expect(appendUnique(rows, page).map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the held row as it is, not the repeat', () => {
    const held = { id: 'a', name: 'held' };

    expect(appendUnique([held], [{ id: 'a', name: 'repeat' }])).toEqual([held]);
  });
});
