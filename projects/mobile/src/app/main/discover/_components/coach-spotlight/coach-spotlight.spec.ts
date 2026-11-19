import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstructorSearchResult } from 'core';

import { SPOTLIGHT_INTERVAL_MS } from '../../discover.config';
import { CoachSpotlight, RESUME_AFTER_MS } from './coach-spotlight';

function coach(id: string): InstructorSearchResult {
  return { id, user: { firstName: id, lastName: '' } } as unknown as InstructorSearchResult;
}

const THREE = [coach('a'), coach('b'), coach('c')];

/** Reduce Motion on or off, for the spotlight built after it. */
function reduceMotion(on: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: on && query.includes('reduce'), media: query }));
}

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  vi.useFakeTimers();
  reduceMotion(false);
  TestBed.overrideComponent(CoachSpotlight, { set: { template: '', imports: [] } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function spotlight(coaches = THREE) {
  const fixture = TestBed.createComponent(CoachSpotlight);
  fixture.componentRef.setInput('coaches', coaches);
  fixture.detectChanges();
  /** Time passes, then the effects run, as they would on the next frame. */
  const wait = (ms: number) => {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  };
  return { spotlight: fixture.componentInstance, wait };
}

describe('CoachSpotlight', () => {
  it('turns by itself, with nothing to press', () => {
    const { spotlight: card, wait } = spotlight();
    expect(card.rotating()).toBe(true);
    expect(card.index()).toBe(0);
    wait(SPOTLIGHT_INTERVAL_MS);
    expect(card.index()).toBe(1);
    wait(SPOTLIGHT_INTERVAL_MS);
    expect(card.index()).toBe(2);
    wait(SPOTLIGHT_INTERVAL_MS);
    expect(card.index()).toBe(0);
  });

  it('waits after the reader picks a coach, then goes on by itself', () => {
    const { spotlight: card, wait } = spotlight();
    card.show(2);
    expect(card.index()).toBe(2);
    expect(card.rotating()).toBe(false);
    wait(RESUME_AFTER_MS - 1);
    expect(card.index()).toBe(2);
    wait(1);
    expect(card.rotating()).toBe(true);
    wait(SPOTLIGHT_INTERVAL_MS);
    expect(card.index()).toBe(0);
  });

  it('holds while focus is inside, and goes on a rest after it leaves', () => {
    const { spotlight: card, wait } = spotlight();
    card.onFocusIn();
    wait(SPOTLIGHT_INTERVAL_MS * 3);
    expect(card.index()).toBe(0);
    card.onFocusOut(new FocusEvent('focusout', { relatedTarget: null }));
    expect(card.rotating()).toBe(false);
    wait(RESUME_AFTER_MS);
    expect(card.rotating()).toBe(true);
  });

  it('only rests after a tap that focused a button, never holds', () => {
    const { spotlight: card, wait } = spotlight();
    // A button a tap focused: it does not match :focus-visible.
    const tapped = document.createElement('button');
    vi.spyOn(tapped, 'matches').mockReturnValue(false);
    const event = { target: tapped } as unknown as FocusEvent;
    card.onFocusIn(event);
    wait(RESUME_AFTER_MS);
    expect(card.rotating()).toBe(true);
  });

  it('stays still under Reduce Motion, and the dots still move it', () => {
    reduceMotion(true);
    const { spotlight: card, wait } = spotlight();
    expect(card.rotating()).toBe(false);
    wait(SPOTLIGHT_INTERVAL_MS * 2);
    expect(card.index()).toBe(0);
    card.show(1);
    expect(card.index()).toBe(1);
    wait(RESUME_AFTER_MS + SPOTLIGHT_INTERVAL_MS);
    expect(card.index()).toBe(1);
  });

  it('does not turn with a single coach', () => {
    const { spotlight: card } = spotlight([coach('a')]);
    expect(card.rotating()).toBe(false);
  });
});
