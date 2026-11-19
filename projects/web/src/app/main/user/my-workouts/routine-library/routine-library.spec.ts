import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Subject, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PaginatedRoutines, RoutineService } from 'core';

import { RoutineLibrary } from './routine-library';

afterEach(() => vi.useRealTimers());

function page(ids: string[], total = ids.length): PaginatedRoutines {
  return {
    items: ids.map((id) => ({ id, name: id }) as PaginatedRoutines['items'][number]),
    total,
    page: 1,
    pageSize: 20,
  };
}

function setup() {
  const list = vi.fn((_query: { search?: string }) => of(page(['r1', 'r2'], 40)));
  TestBed.overrideComponent(RoutineLibrary, {
    set: { template: '', imports: [], providers: [] },
  });
  TestBed.configureTestingModule({
    providers: [
      { provide: RoutineService, useValue: { list } },
      { provide: MessageService, useValue: { add: vi.fn() } },
      { provide: ConfirmationService, useValue: { confirm: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const fixture = TestBed.createComponent(RoutineLibrary);
  fixture.detectChanges();
  return { library: fixture.componentInstance, list };
}

describe('RoutineLibrary, search', () => {
  // It filtered the page on screen only: routine 21 was never found.
  it('asks the server once typing pauses', () => {
    vi.useFakeTimers();
    const { library, list } = setup();
    list.mockClear();

    library.onRoutineSearch('l');
    library.onRoutineSearch('leg');
    expect(list).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);

    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0][0]).toMatchObject({ page: 1, search: 'leg' });
  });

  it('lets only the latest search land', () => {
    vi.useFakeTimers();
    const { library, list } = setup();
    const slow = new Subject<PaginatedRoutines>();
    list.mockReturnValueOnce(slow).mockReturnValueOnce(of(page(['legs'], 1)));

    library.onRoutineSearch('le');
    vi.advanceTimersByTime(300);
    library.onRoutineSearch('legs');
    vi.advanceTimersByTime(300);
    slow.next(page(['lemons'], 1));

    expect(library.routines().map((r) => r.id)).toEqual(['legs']);
  });

  it('reads the whole list again once the search is cleared', () => {
    vi.useFakeTimers();
    const { library, list } = setup();
    library.onRoutineSearch('leg');
    vi.advanceTimersByTime(300);
    list.mockClear();

    library.clearRoutineSearch();

    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0][0]).toMatchObject({ search: '' });
  });

  it('keeps the search on the next page', () => {
    vi.useFakeTimers();
    const { library, list } = setup();
    library.onRoutineSearch('leg');
    vi.advanceTimersByTime(300);

    library.loadMoreRoutines();

    expect(list.mock.lastCall?.[0]).toMatchObject({ page: 2, search: 'leg' });
  });
});
