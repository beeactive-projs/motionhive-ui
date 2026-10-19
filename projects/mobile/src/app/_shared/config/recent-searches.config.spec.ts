import { describe, expect, it } from 'vitest';

import {
  RECENT_SEARCH_LIMIT,
  RecentPerson,
  parseRecents,
  pushRecent,
  removeRecent,
} from './recent-searches.config';

function person(id: string): RecentPerson {
  return { id, name: `Person ${id}`, avatarUrl: null, subline: null };
}

describe('recent searches', () => {
  it('puts the newest first and keeps three', () => {
    let list: RecentPerson[] = [];
    for (const id of ['a', 'b', 'c', 'd']) list = pushRecent(list, person(id));

    expect(RECENT_SEARCH_LIMIT).toBe(3);
    expect(list.map((entry) => entry.id)).toEqual(['d', 'c', 'b']);
  });

  // Opening someone again moves them up; they never take two rows.
  it('moves a repeat to the top instead of adding it twice', () => {
    const list = pushRecent([person('a'), person('b'), person('c')], person('c'));
    expect(list.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
  });

  it('removes one person', () => {
    expect(removeRecent([person('a'), person('b')], 'a').map((entry) => entry.id)).toEqual(['b']);
  });

  // Storage is outside our control: whatever it holds must not break the screen.
  it('reads only well-formed entries back from storage', () => {
    expect(parseRecents(null)).toEqual([]);
    expect(parseRecents('nope')).toEqual([]);
    expect(
      parseRecents([person('a'), { id: 'b' }, 42, { ...person('c'), avatarUrl: 'x.png' }]).map(
        (entry) => entry.id,
      ),
    ).toEqual(['a', 'c']);
  });
});
