import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { RosterClient, RosterService } from 'core';

import { CoachRoster } from './roster';

describe('CoachRoster, needs attention', () => {
  it('says why a client with no plan needs attention', () => {
    TestBed.overrideComponent(CoachRoster, { set: { template: '', imports: [] } });
    TestBed.configureTestingModule({
      providers: [
        { provide: RosterService, useValue: { roster: () => of({ clients: [] }) } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        { provide: MessageService, useValue: { add: () => undefined } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const roster = TestBed.createComponent(CoachRoster).componentInstance;
    const client = { attention: 'NO_PLAN' } as RosterClient;

    expect(roster.attentionLabel(client)).toBe('clients.roster.attention.reason.noPlan');
    expect(roster.attentionDetail(client)).toBe('clients.roster.attention.detail.noPlan');
  });
});
