import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { PlanNoteSheet } from './plan-note-sheet';

function sheet(note: string | null) {
  const fixture = TestBed.createComponent(PlanNoteSheet);
  fixture.componentRef.setInput('note', note);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  const saved: (string | null)[] = [];
  fixture.componentInstance.save.subscribe((value) => saved.push(value));
  return { instance: fixture.componentInstance, saved };
}

describe('PlanNoteSheet', () => {
  beforeEach(() => {
    TestBed.overrideComponent(PlanNoteSheet, { set: { template: '', imports: [] } });
  });

  it('opens on the note as it is', () => {
    expect(sheet('Pause at the bottom').instance.draft()).toBe('Pause at the bottom');
  });

  it('saves a changed note trimmed, and an emptied one as no note', () => {
    const first = sheet('Old');
    first.instance.draft.set('  Pause at the bottom  ');
    first.instance.submit();
    expect(first.saved).toEqual(['Pause at the bottom']);

    const second = sheet('Old');
    second.instance.draft.set('   ');
    second.instance.submit();
    expect(second.saved).toEqual([null]);
  });

  it('just closes when nothing changed', () => {
    const { instance, saved } = sheet('Same');
    instance.draft.set('Same ');
    instance.submit();
    expect(saved).toEqual([]);
    expect(instance.open()).toBe(false);
  });
});
