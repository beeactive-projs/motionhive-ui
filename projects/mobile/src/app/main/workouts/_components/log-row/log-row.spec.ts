import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { WorkoutLog } from 'core';

import { WorkoutPhotoStore } from '../../_services/workout-photo';
import { LogRow } from './log-row';

function row(log: Partial<WorkoutLog>, photoPreview: boolean) {
  const thumbUrl = vi.fn(() => of('blob:thumb-1'));
  TestBed.overrideComponent(LogRow, { set: { template: '', imports: [] } });
  TestBed.configureTestingModule({
    providers: [{ provide: WorkoutPhotoStore, useValue: { thumbUrl } }],
  });
  const fixture = TestBed.createComponent(LogRow);
  fixture.componentRef.setInput('log', {
    id: 'log-1',
    name: 'Push day',
    status: 'COMPLETED',
    startedAt: '2026-11-10T08:00:00Z',
    ...log,
  });
  fixture.componentRef.setInput('photoPreview', photoPreview);
  fixture.detectChanges();
  return { row: fixture.componentInstance, thumbUrl };
}

describe('LogRow, a workout with a photo', () => {
  it("shows the trainee's own photo as a small thumbnail", () => {
    const { row: logRow, thumbUrl } = row({ hasPhoto: true, photoVersion: 2 }, true);
    expect(logRow.showThumb()).toBe(true);
    expect(thumbUrl).toHaveBeenCalledWith('log-1', 2);
    expect(logRow.thumbUrl()).toBe('blob:thumb-1');
    // The placeholder glyph goes once the photo is there (the hexagon's icon
    // would win over its image).
    expect(logRow.thumbIcon()).toBeNull();
  });

  it("only hints at a photo on a coach's row, and loads nothing", () => {
    const { row: logRow, thumbUrl } = row({ hasPhoto: true }, false);
    expect(logRow.showPhotoGlyph()).toBe(true);
    expect(logRow.showThumb()).toBe(false);
    expect(thumbUrl).not.toHaveBeenCalled();
  });

  it('says nothing about a workout with no photo', () => {
    const { row: logRow, thumbUrl } = row({ hasPhoto: false }, true);
    expect(logRow.showThumb()).toBe(false);
    expect(logRow.showPhotoGlyph()).toBe(false);
    expect(thumbUrl).not.toHaveBeenCalled();
  });
});
