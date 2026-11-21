import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionInstance } from 'core';

import { SessionRow } from './session-row';

const HOUR = 3_600_000;

function instance(startOffsetMs: number): SessionInstance {
  const start = Date.now() + startOffsetMs;
  return {
    id: 'i-1',
    status: 'SCHEDULED',
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + HOUR).toISOString(),
    confirmedCount: 3,
    pendingApprovalCount: 0,
    capacityOverride: null,
    titleOverride: null,
    conflictingInstanceIds: null,
    template: { type: 'GROUP', title: 'Strength club', durationMinutes: 60, capacity: 10 },
  } as SessionInstance;
}

describe('SessionRow', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
    });
    TestBed.overrideComponent(SessionRow, { set: { template: '', imports: [] } });
  });

  function row(value: SessionInstance): SessionRow {
    const fixture = TestBed.createComponent(SessionRow);
    fixture.componentRef.setInput('instance', value);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('keeps the type colour on a session still ahead or under way', () => {
    expect(row(instance(2 * HOUR)).tone()).toBe('honey');
    expect(row(instance(2 * HOUR)).isPast()).toBe(false);
    expect(row(instance(-HOUR / 2)).tone()).toBe('honey');
  });

  it('mutes a session that has ended', () => {
    const past = row(instance(-3 * HOUR));
    expect(past.isPast()).toBe(true);
    expect(past.tone()).toBe('muted');
  });
});
