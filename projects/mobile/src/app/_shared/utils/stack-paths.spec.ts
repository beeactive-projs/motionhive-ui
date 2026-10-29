import { describe, expect, it } from 'vitest';

import { chatBase, groupBase, groupLinks, personBase, stackRootOf } from './stack-paths';

describe('stack paths', () => {
  it('finds the stack a URL is in, the deepest root winning', () => {
    expect(stackRootOf('/tabs/clients/abc?tab=training')).toBe('/tabs/clients');
    expect(stackRootOf('/tabs/more/account/person/anna')).toBe('/tabs/more/account');
    expect(stackRootOf('/tabs/coach/sessions/123')).toBe('/tabs/coach/sessions');
    expect(stackRootOf('/tabs/home')).toBeNull();
  });

  it('opens a chat on the Messages tab there, and under chat/ anywhere else', () => {
    expect(chatBase('/tabs/messages')).toBe('/tabs/messages');
    expect(chatBase('/tabs/clients')).toBe('/tabs/clients/chat');
    expect(chatBase(null)).toBe('/tabs/messages');
  });

  it("opens a group on the Groups tab there, and under groups/ anywhere else, clear of Discover's group/", () => {
    expect(groupBase('/tabs/groups')).toBe('/tabs/groups');
    expect(groupBase('/tabs/discover')).toBe('/tabs/discover/groups');
    expect(personBase('/tabs/clients')).toBe('/tabs/clients/person');
  });

  it("builds a group page's links from its own URL", () => {
    const tab = groupLinks('/tabs/groups/g-1');
    expect(tab.inGroupsTab).toBe(true);
    expect(tab.home).toBe('/tabs/groups');
    expect(tab.post('p-1', 'photos')).toEqual(['/tabs/groups', 'post', 'p-1', 'photos']);

    const fromProfile = groupLinks('/tabs/clients/groups/g-1');
    expect(fromProfile.inGroupsTab).toBe(false);
    expect(fromProfile.home).toBe('/tabs/clients');
    expect(fromProfile.group('g-1', 'compose')).toEqual(['/tabs/clients/groups', 'g-1', 'compose']);
    expect(fromProfile.person('anna', 'workout', 'w-1')).toEqual([
      '/tabs/clients/person',
      'anna',
      'workout',
      'w-1',
    ]);
  });
});
