import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Program, ProgramSource, ProgramStatus } from 'core';

import { ClockService } from '../../../../_shared/services/clock.service';
import { ProgramRow } from './program-row';

const NOW = new Date(2026, 10, 20, 9, 0).getTime();

function program(over: Record<string, unknown> = {}): Program {
  return {
    id: 'p-1',
    name: 'Strength base',
    status: ProgramStatus.Published,
    source: ProgramSource.Instructor,
    isSingleWorkout: false,
    durationDays: 56,
    updatedAt: new Date(2026, 10, 19, 18, 0).toISOString(),
    ...over,
  } as unknown as Program;
}

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [{ provide: ClockService, useValue: { now: signal(NOW) } }],
  });
  TestBed.overrideComponent(ProgramRow, { set: { template: '', imports: [] } });
});

function row(value: Program): ProgramRow {
  const fixture = TestBed.createComponent(ProgramRow);
  fixture.componentRef.setInput('program', value);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('ProgramRow', () => {
  // The count was an input nobody passed, so every row fell back to a date.
  it('says how many clients follow a published program, from the row itself', () => {
    const published = row(program({ clientCount: 3, daysPerWeek: 3 }));
    expect(published.trailing()).toBe('3 clients');
    expect(published.meta()).toBe('8 weeks · 3 days/week');
  });

  it('says when a draft was last edited instead', () => {
    const draft = row(program({ status: ProgramStatus.Draft, clientCount: 0 }));
    expect(draft.isDraft()).toBe(true);
    expect(draft.trailing()).toBe('Edited yesterday');
  });

  it('counts a routine in exercises', () => {
    const routine = row(program({ isSingleWorkout: true, exerciseCount: 6, clientCount: 1 }));
    expect(routine.meta()).toBe('Routine · 6 exercises');
    expect(routine.trailing()).toBe('1 client');
  });

  it('badges a MotionHive starter', () => {
    expect(row(program({ source: ProgramSource.System })).isStarter()).toBe(true);
    expect(row(program()).isStarter()).toBe(false);
  });
});
