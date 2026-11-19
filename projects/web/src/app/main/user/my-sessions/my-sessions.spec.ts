import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { MyBookingsIndexStore, SessionsMyStore } from 'core';

import { MySessions } from './my-sessions';

function setup(query: Record<string, string>) {
  const store = {
    tab: signal('upcoming'),
    load: vi.fn(),
    setTab: vi.fn(),
    items: signal([]),
    counts: signal(null),
    loading: signal(false),
    total: signal(0),
    hasMore: signal(false),
  };
  // The page provides its own store: swap that one for the stub.
  TestBed.overrideComponent(MySessions, {
    set: {
      template: '',
      imports: [],
      providers: [{ provide: SessionsMyStore, useValue: store }],
    },
  });
  TestBed.configureTestingModule({
    providers: [
      { provide: MyBookingsIndexStore, useValue: {} },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const fixture = TestBed.createComponent(MySessions);
  fixture.detectChanges();
  return store;
}

describe('MySessions, opened from a link', () => {
  it('opens on the tab the link names', () => {
    const store = setup({ tab: 'cancelled' });
    expect(store.setTab).toHaveBeenCalledWith('cancelled');
    expect(store.load).not.toHaveBeenCalled();
  });

  it('opens on Upcoming for no tab or an unknown one', () => {
    const store = setup({ tab: 'nonsense' });
    expect(store.setTab).not.toHaveBeenCalled();
    expect(store.load).toHaveBeenCalledOnce();
  });
});
