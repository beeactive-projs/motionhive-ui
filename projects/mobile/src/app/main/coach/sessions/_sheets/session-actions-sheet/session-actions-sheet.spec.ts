import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionInstance, SessionInstanceStatus } from 'core';

import { SessionActionId, SessionActionIds, SessionSurface, SessionSurfaces } from '../../sessions.config';
import { SessionActionsSheet } from './session-actions-sheet';

const HOUR = 3_600_000;

function instance(status: SessionInstanceStatus, startOffsetMs: number): SessionInstance {
  const start = Date.now() + startOffsetMs;
  return {
    id: 'i-1',
    status,
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + HOUR).toISOString(),
    confirmedCount: 2,
    pendingApprovalCount: 0,
    titleOverride: null,
  } as SessionInstance;
}

describe('SessionActionsSheet', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
    });
    TestBed.overrideComponent(SessionActionsSheet, { set: { template: '', imports: [] } });
  });

  function verbs(value: SessionInstance, surface: SessionSurface = SessionSurfaces.Agenda): SessionActionId[] {
    const fixture = TestBed.createComponent(SessionActionsSheet);
    fixture.componentRef.setInput('instance', value);
    fixture.componentRef.setInput('surface', surface);
    fixture.detectChanges();
    return fixture.componentInstance.visibleActions().map((action) => action.id);
  }

  it('offers Cancel on a scheduled session', () => {
    expect(verbs(instance(SessionInstanceStatus.Scheduled, 2 * HOUR))).toContain(SessionActionIds.Cancel);
  });

  // The API refuses to cancel anything that is no longer SCHEDULED.
  it('keeps Cancel off a started or finished session', () => {
    expect(verbs(instance(SessionInstanceStatus.InProgress, -HOUR / 2))).not.toContain(
      SessionActionIds.Cancel,
    );
    expect(verbs(instance(SessionInstanceStatus.Completed, -3 * HOUR))).not.toContain(
      SessionActionIds.Cancel,
    );
  });

  // The link is the session itself now, so no handle is needed to share it.
  it('offers Share on every session that is not cancelled', () => {
    expect(verbs(instance(SessionInstanceStatus.Scheduled, 2 * HOUR))).toContain(SessionActionIds.Share);
    expect(verbs(instance(SessionInstanceStatus.Completed, -3 * HOUR))).toContain(SessionActionIds.Share);
    expect(verbs(instance(SessionInstanceStatus.Cancelled, 2 * HOUR))).not.toContain(
      SessionActionIds.Share,
    );
  });

  // Cancel and recreate lost every booking; a date still ahead can move.
  it('offers Reschedule on a scheduled date still ahead, on both screens', () => {
    const ahead = instance(SessionInstanceStatus.Scheduled, 2 * HOUR);
    expect(verbs(ahead)).toContain(SessionActionIds.Reschedule);
    expect(verbs(ahead, SessionSurfaces.Detail)).toContain(SessionActionIds.Reschedule);
  });

  it('keeps Reschedule off a date under way, finished or cancelled', () => {
    expect(verbs(instance(SessionInstanceStatus.Scheduled, -HOUR / 2))).not.toContain(
      SessionActionIds.Reschedule,
    );
    expect(verbs(instance(SessionInstanceStatus.Completed, -3 * HOUR))).not.toContain(
      SessionActionIds.Reschedule,
    );
    expect(verbs(instance(SessionInstanceStatus.Cancelled, 2 * HOUR))).not.toContain(
      SessionActionIds.Reschedule,
    );
  });

  it('offers check-in once a session has started, on the agenda only', () => {
    const started = instance(SessionInstanceStatus.InProgress, -HOUR / 2);
    expect(verbs(started)).toContain(SessionActionIds.CheckIn);
    expect(verbs(started, SessionSurfaces.Detail)).not.toContain(SessionActionIds.CheckIn);
  });
});
