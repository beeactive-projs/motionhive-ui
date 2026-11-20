import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { MessagingStore, ProgramAssignment, ProgramAssignmentStatus } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ClientDetail } from './client-detail';
import { ClientDetailStore } from './client-detail.store';

const plan = (status: ProgramAssignmentStatus) =>
  ({
    id: 'a-1',
    clientId: 'c-1',
    status,
    programNameSnapshot: 'Strength Base',
    masterProgramId: 'p-1',
    startDate: '2026-11-02',
    completionPercent: 25,
  }) as ProgramAssignment;

function setup(status: ProgramAssignmentStatus) {
  const navigate = vi.fn();
  const store = {
    load: vi.fn(),
    client: signal({ id: 'rel-1', client: { id: 'c-1', firstName: 'Anna', lastName: 'Popescu' } }),
    currentPlans: signal([plan(status)]),
    plansLoaded: signal(true),
  };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ clientId: 'c-1' })),
          queryParamMap: of(convertToParamMap({})),
          snapshot: {
            paramMap: convertToParamMap({ clientId: 'c-1' }),
            queryParamMap: convertToParamMap({}),
          },
        },
      },
      { provide: Router, useValue: { url: '/tabs/clients/c-1', navigate } },
      { provide: MessagingStore, useValue: {} },
      { provide: FeedbackService, useValue: { error: vi.fn(), success: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  TestBed.overrideComponent(ClientDetail, {
    set: { template: '', imports: [], providers: [{ provide: ClientDetailStore, useValue: store }] },
  });
  const fixture = TestBed.createComponent(ClientDetail);
  return { page: fixture.componentInstance, navigate };
}

describe("ClientDetail, the door to the client's copy", () => {
  it("offers to edit the client's copy of a running or paused plan, in this stack", () => {
    const { page, navigate } = setup(ProgramAssignmentStatus.Active);
    expect(page.overviewPlan()?.canEditCopy).toBe(true);
    expect(page.copyLabel()).toBe('programs.clientCopy.editCopy');

    page.openCopy(plan(ProgramAssignmentStatus.Active));
    expect(navigate).toHaveBeenCalledWith(['/tabs/clients', 'copy', 'a-1']);
  });

  it('offers it on a paused plan too', () => {
    const { page } = setup(ProgramAssignmentStatus.Paused);
    expect(page.overviewPlan()?.canEditCopy).toBe(true);
  });

  it('keeps the door shut on a plan waiting to start', () => {
    const { page } = setup(ProgramAssignmentStatus.Pending);
    expect(page.overviewPlan()?.canEditCopy).toBe(false);
  });
});
