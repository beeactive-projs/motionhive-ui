import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ClientRequest, ClientService } from 'core';

import { ProfileCoaches } from './coaches';

const invitation = { id: 'r-1', type: 'INSTRUCTOR_TO_CLIENT' } as ClientRequest;
// A trainee asking a coach: sent TO a coach, so only a coach sees it incoming.
const askedMe = { id: 'r-2', type: 'CLIENT_TO_INSTRUCTOR' } as ClientRequest;
const mine = { id: 'r-3', type: 'CLIENT_TO_INSTRUCTOR' } as ClientRequest;

describe('ProfileCoaches, requests', () => {
  it("shows a person's own sent requests, and never someone else's as theirs", () => {
    TestBed.overrideComponent(ProfileCoaches, { set: { template: '', imports: [] } });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ClientService,
          useValue: {
            getMyInstructors: () => of([]),
            getPendingRequests: () => of([invitation, askedMe]),
            getSentRequests: vi.fn(() => of([mine])),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: of(convertToParamMap({})),
          },
        },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const fixture = TestBed.createComponent(ProfileCoaches);
    fixture.detectChanges();
    const tab = fixture.componentInstance;

    expect(tab.incomingRequests().map((r) => r.id)).toEqual(['r-1']);
    expect(tab.outgoingRequests().map((r) => r.id)).toEqual(['r-3']);
  });
});
