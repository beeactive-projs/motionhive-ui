import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Program, ProgramService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { DayEditor } from './day-editor';

/** A day of A1 B1 C D E2 F2. */
function program(): Program {
  const row = (id: string, supersetGroupId: number | null, orderIndex: number) => ({
    id,
    supersetGroupId,
    orderIndex,
    sets: [],
  });
  return {
    id: 'p-1',
    workouts: [
      {
        id: 'pw-1',
        name: 'Day 1',
        notes: null,
        exercises: [row('a', 1, 0), row('b', 1, 1), row('c', null, 2), row('d', null, 3), row('e', 2, 4), row('f', 2, 5)],
      },
    ],
  } as unknown as Program;
}

describe('DayEditor, linking a superset', () => {
  it('saves every row the link moved in one request', () => {
    const setSupersets = vi.fn(() => of(undefined));
    const updateExercise = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: ProgramService, useValue: { get: () => of(program()), setSupersets, updateExercise } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p-1', workoutId: 'pw-1' }) } },
        },
        { provide: Router, useValue: { url: '/tabs/programs/program/p-1/day/pw-1' } },
        { provide: FeedbackService, useValue: {} },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const editor = TestBed.runInInjectionContext(() => new DayEditor());
    editor.ionViewWillEnter();

    // Link C with D: E and F are renumbered too.
    editor.toggleLink(2);

    expect(setSupersets).toHaveBeenCalledOnce();
    expect(setSupersets).toHaveBeenCalledWith('p-1', 'pw-1', [
      { id: 'c', supersetGroupId: 2 },
      { id: 'd', supersetGroupId: 2 },
      { id: 'e', supersetGroupId: 3 },
      { id: 'f', supersetGroupId: 3 },
    ]);
    expect(updateExercise).not.toHaveBeenCalled();
  });
});
