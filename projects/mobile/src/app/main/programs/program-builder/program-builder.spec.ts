import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { NavController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Program, ProgramAssignmentService, ProgramService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ProgramBuilder } from './program-builder';
import { ProgramBuilderStore } from './program-builder.store';

const DRAFT_NAME = 'programs.builder.untitledProgram';

function draft(id: string): Program {
  return { id, name: DRAFT_NAME, status: 'DRAFT', workouts: [] } as unknown as Program;
}

function setup(routeId: string) {
  const create = vi.fn(() => of(draft('p-new')));
  const remove = vi.fn(() => of(undefined));
  const navigate = vi.fn(() => Promise.resolve(true));
  const navigateForward = vi.fn(() => Promise.resolve(true));
  const get = vi.fn(() => of(draft(routeId)));
  TestBed.configureTestingModule({
    providers: [
      ProgramBuilderStore,
      { provide: ProgramService, useValue: { create, remove, get } },
      { provide: ProgramAssignmentService, useValue: {} },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: routeId }) } } },
      { provide: Router, useValue: { url: '/tabs/programs/program/' + routeId, navigate } },
      { provide: NavController, useValue: { navigateForward } },
      { provide: FeedbackService, useValue: {} },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const store = TestBed.inject(ProgramBuilderStore);
  const builder = TestBed.runInInjectionContext(() => new ProgramBuilder());
  return { builder, store, create, remove, navigate, navigateForward, get };
}

describe('ProgramBuilder, a new program', () => {
  it('keeps the draft it just made when the page reopens under its id', () => {
    const { builder, create, remove, navigateForward } = setup('new');
    builder.ionViewWillEnter();
    expect(create).toHaveBeenCalledOnce();
    // Its real address, without a second slide in.
    expect(navigateForward).toHaveBeenCalledWith(['/tabs/programs', 'program', 'p-new'], {
      replaceUrl: true,
      animated: false,
    });

    // Ionic closes the "new" page as the id's page opens.
    builder.ionViewWillLeave();
    expect(remove).not.toHaveBeenCalled();
  });

  it('still throws away an untouched draft when the coach backs out of it', () => {
    const { builder, store, remove } = setup('p-new');
    store.adopt(draft('p-new'));
    builder.ionViewWillEnter();
    store.adopt(draft('p-new'));
    builder.ionViewWillLeave();
    expect(remove).toHaveBeenCalledWith('p-new');
  });

  it('shows the handed draft on the page under its id, without loading it again', () => {
    const first = setup('new');
    first.builder.ionViewWillEnter();
    TestBed.resetTestingModule();

    const second = setup('p-new');
    second.builder.ionViewWillEnter();
    expect(second.get).not.toHaveBeenCalled();
    expect(second.store.program()?.id).toBe('p-new');
  });
});
