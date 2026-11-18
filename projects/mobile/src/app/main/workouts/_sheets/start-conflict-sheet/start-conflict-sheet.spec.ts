import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ActiveWorkoutService,
  StartConflictChoice,
  StartConflictChoices,
} from '../../_services/active-workout.service';
import { StartConflictSheet } from './start-conflict-sheet';

const conflict = signal<{ open: { name: string } } | null>(null);
const choose = vi.fn<(choice: StartConflictChoice | null) => void>();

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  conflict.set(null);
  choose.mockReset();
  TestBed.overrideComponent(StartConflictSheet, { set: { template: '', imports: [] } });
  TestBed.configureTestingModule({
    providers: [
      { provide: ActiveWorkoutService, useValue: { conflict, choose } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
});

/** The sheet beside the tab bar, with a start that ran into an open workout. */
function conflicted(): { sheet: StartConflictSheet; settle: () => void } {
  const fixture = TestBed.createComponent(StartConflictSheet);
  fixture.detectChanges();
  conflict.set({ open: { name: 'Push day' } });
  fixture.detectChanges();
  return { sheet: fixture.componentInstance, settle: () => fixture.detectChanges() };
}

describe('StartConflictSheet', () => {
  it('opens when a start runs into an open workout', () => {
    expect(conflicted().sheet.open()).toBe(true);
  });

  it('reports the choice at the tap and closes, without calling the start off', async () => {
    const { sheet, settle } = conflicted();

    sheet.onChosen(StartConflictChoices.FinishAndStart);
    settle();
    await Promise.resolve();

    expect(sheet.open()).toBe(false);
    expect(choose.mock.calls).toEqual([[StartConflictChoices.FinishAndStart]]);
  });

  it('calls the start off when the sheet is closed without a choice', async () => {
    const { sheet, settle } = conflicted();

    sheet.open.set(false);
    settle();
    await Promise.resolve();

    expect(choose.mock.calls).toEqual([[null]]);
  });

  // Tiles by concept (lists.md): done is green, and the one verb that loses
  // work is red, in its own card.
  it('offers resume, finish and discard, discard alone destructive', () => {
    const { sheet } = conflicted();

    expect(sheet.actions.map((action) => action.id)).toEqual([
      StartConflictChoices.Resume,
      StartConflictChoices.FinishAndStart,
      StartConflictChoices.DiscardAndStart,
    ]);
    expect(sheet.actions.filter((action) => action.destructive).map((action) => action.id)).toEqual([
      StartConflictChoices.DiscardAndStart,
    ]);
    expect(sheet.actions.find((a) => a.id === StartConflictChoices.FinishAndStart)?.color).toBe(
      'success',
    );
  });
});
