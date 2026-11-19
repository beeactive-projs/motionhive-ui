import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExerciseCard } from './exercise-card';

// The template blanked (Ionic does not render in jsdom), once per test. The
// header's own behaviour is `mh-exercise-head`'s (exercise-head.spec.ts).
beforeEach(() => {
  TestBed.overrideComponent(ExerciseCard, { set: { template: '', imports: [] } });
});

function card(tag: string | null) {
  const fixture = TestBed.createComponent(ExerciseCard);
  fixture.componentRef.setInput('name', 'Back squat');
  fixture.componentRef.setInput('tag', tag);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ExerciseCard rail', () => {
  // `linked` draws the honey rail (exercise-card.scss).
  it('wears the rail as a superset member, with a tag', () => {
    expect(card('A1').classList.contains('linked')).toBe(true);
  });

  it('has no rail on its own', () => {
    expect(card(null).classList.contains('linked')).toBe(false);
    expect(card('').classList.contains('linked')).toBe(false);
  });
});
