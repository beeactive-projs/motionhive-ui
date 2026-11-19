import { describe, expect, it } from 'vitest';

import { withChipFilter } from './table-chip';

describe('withChipFilter', () => {
  it('adds the chip to a page or sort event that has none', () => {
    const page = { first: 20, rows: 20, sortField: 'name', sortOrder: 1 };
    expect(withChipFilter(page, 'status', 'ARCHIVED')).toEqual({
      ...page,
      filters: { status: { value: 'ARCHIVED' } },
    });
  });

  it('keeps the match mode a table asks for', () => {
    expect(withChipFilter({ first: 0 }, 'type', 'INVITATION', 'equals').filters).toEqual({
      type: { value: 'INVITATION', matchMode: 'equals' },
    });
  });

  it('drops the field when no chip is picked, and keeps the other filters', () => {
    const event = {
      first: 0,
      filters: { status: { value: 'ACTIVE' }, global: { value: 'ana' } },
    };
    expect(withChipFilter(event, 'status', undefined).filters).toEqual({
      global: { value: 'ana' },
    });
  });

  it('replaces a stale chip and leaves the event it was given alone', () => {
    const event = { first: 0, filters: { status: { value: 'ACTIVE' } } };
    expect(withChipFilter(event, 'status', 'ARCHIVED').filters).toEqual({
      status: { value: 'ARCHIVED' },
    });
    expect(event.filters).toEqual({ status: { value: 'ACTIVE' } });
  });
});
