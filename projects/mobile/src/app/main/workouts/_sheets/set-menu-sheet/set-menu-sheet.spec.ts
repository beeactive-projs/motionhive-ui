import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExerciseSetType } from 'core';

import { SetMenuSheet } from './set-menu-sheet';

beforeEach(() => {
  TestBed.overrideComponent(SetMenuSheet, { set: { template: '', imports: [] } });
});

function sheet(inputs: Record<string, unknown> = {}): SetMenuSheet {
  const fixture = TestBed.createComponent(SetMenuSheet);
  fixture.componentRef.setInput('open', true);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('SetMenuSheet', () => {
  // Copy set is the swipe right's copy: one tap adds it and the menu goes.
  it('asks for a copy of the set and closes', () => {
    const menu = sheet();
    let copies = 0;
    menu.duplicate.subscribe(() => copies++);

    menu.copySet();

    expect(copies).toBe(1);
    expect(menu.open()).toBe(false);
  });

  // A superset round has no menu of its own: its one verb is here (2026-11-18).
  it('offers to remove the whole round only for a set in a superset round', () => {
    expect(sheet().round()).toBeNull();

    const menu = sheet({ round: 2 });
    let removed = 0;
    menu.removeRound.subscribe(() => removed++);
    menu.removeRoundSets();

    expect(menu.round()).toBe(2);
    expect(removed).toBe(1);
    expect(menu.open()).toBe(false);
  });

  // The routine builder's sets have a type and no note.
  it('reads a planned set, which has a type and no note', () => {
    const menu = sheet({ set: { setType: ExerciseSetType.Warmup }, noteable: false });

    expect(menu.current()).toBe(ExerciseSetType.Warmup);
    expect(menu.hasNote()).toBe(false);
    expect(menu.noteable()).toBe(false);
  });

  it('changes a planned set’s type and closes', () => {
    const menu = sheet({ set: { setType: ExerciseSetType.Normal }, noteable: false });
    const picked: ExerciseSetType[] = [];
    menu.typeChange.subscribe((type) => picked.push(type));

    menu.pick(ExerciseSetType.Dropset);

    expect(picked).toEqual([ExerciseSetType.Dropset]);
    expect(menu.open()).toBe(false);
  });
});
