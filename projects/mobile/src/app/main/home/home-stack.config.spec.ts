import { describe, expect, it } from 'vitest';

import {
  agendaLinks,
  bookingsLinks,
  HOME_STACK,
  HomePages,
  homeOr,
  inHomeStack,
  workoutLinks,
  WORKOUTS_STACK,
} from './home-stack.config';

describe('inHomeStack', () => {
  it('is true for Home and every page pushed onto it', () => {
    expect(inHomeStack('/tabs/home')).toBe(true);
    expect(inHomeStack('/tabs/home/sessions')).toBe(true);
    expect(inHomeStack('/tabs/home/preview/a1?workout=w1')).toBe(true);
  });

  it('is false for the other tabs, and for a word that only starts the same', () => {
    expect(inHomeStack('/tabs/coach/sessions')).toBe(false);
    expect(inHomeStack('/tabs/workouts/preview/a1')).toBe(false);
    expect(inHomeStack('/tabs/homework')).toBe(false);
  });
});

describe('homeOr', () => {
  it('goes back to Home from its stack and to the given page elsewhere', () => {
    expect(homeOr('/tabs/home/invite', '/tabs/clients')).toBe(HOME_STACK);
    expect(homeOr('/tabs/clients/invite', '/tabs/clients')).toBe('/tabs/clients');
  });
});

describe('HomePages', () => {
  it('mounts every page under Home', () => {
    for (const path of Object.values(HomePages)) {
      expect(inHomeStack(path)).toBe(true);
    }
  });
});

describe('agendaLinks', () => {
  it('keeps a session in Home when the agenda is there', () => {
    const links = agendaLinks(HomePages.Agenda);
    expect(links.back).toBe(HOME_STACK);
    expect(links.session('s1')).toEqual([HOME_STACK, 'session', 's1']);
  });

  it('keeps its own area otherwise, back to the Menu', () => {
    const links = agendaLinks('/tabs/coach/sessions');
    expect(links.back).toBe('/tabs/more');
    expect(links.session('s1')).toEqual(['/tabs/coach/sessions', 's1']);
  });
});

describe('bookingsLinks', () => {
  it('keeps a booking and the cancelled ones in Home when the list is there', () => {
    const links = bookingsLinks(HomePages.Bookings);
    expect(links.back).toBe(HOME_STACK);
    expect(links.booking('i1')).toEqual([HOME_STACK, 'booking', 'i1']);
    expect(links.cancelled).toEqual([HomePages.Bookings, 'cancelled']);
  });

  it('keeps its own area otherwise, back to the Menu', () => {
    const links = bookingsLinks('/tabs/user/sessions');
    expect(links.back).toBe('/tabs/more');
    expect(links.booking('i1')).toEqual(['/tabs/user/sessions', 'i1']);
    expect(links.cancelled).toEqual(['/tabs/user/sessions', 'cancelled']);
  });
});

describe('workoutLinks', () => {
  it('keeps a preview, a summary and an exercise in Home when opened there', () => {
    const links = workoutLinks('/tabs/home/progress/e1');
    expect(links.root).toBe(HOME_STACK);
    expect(links.preview('a1')).toEqual([HOME_STACK, 'preview', 'a1']);
    expect(links.finish('l1')).toEqual([HOME_STACK, 'finish', 'l1']);
    expect(links.exercise('e1')).toEqual([HOME_STACK, 'exercise', 'e1']);
    expect(links.progressBack).toBe(HOME_STACK);
  });

  it('keeps the Workouts tab otherwise, back to its Progress', () => {
    const links = workoutLinks('/tabs/workouts/progress/e1');
    expect(links.root).toBe(WORKOUTS_STACK);
    expect(links.finish('l1')).toEqual([WORKOUTS_STACK, 'finish', 'l1']);
    expect(links.exercise('e1')).toEqual([WORKOUTS_STACK, 'exercise', 'e1']);
    expect(links.progressBack).toBe(`${WORKOUTS_STACK}/progress`);
  });
});
