import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { ActiveSessionStore } from '../../../../workouts/_services/active-session.store';
import { ActiveBarPreview } from './active-bar-preview';

describe('ActiveBarPreview', () => {
  function build() {
    TestBed.overrideComponent(ActiveBarPreview, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(ActiveBarPreview);
    const session = {
      id: 'preview-log',
      name: 'Push day',
      startedAt: new Date(0).toISOString(),
      pausedAt: null,
      pausedSeconds: 0,
    };
    fixture.componentRef.setInput('session', session);
    fixture.detectChanges();
    return { fixture, session };
  }

  it('stands in for the store with the session and rest it is given', () => {
    const { fixture, session } = build();
    const store = fixture.debugElement.injector.get(ActiveSessionStore);
    expect(store.session()).toBe(session);
    expect(store.rest()).toBeNull();

    const rest = {
      logId: 'preview-log',
      exerciseId: 'e',
      setId: 's',
      startedAt: 0,
      endsAt: 90_000,
      planned: 90,
      next: '',
    };
    fixture.componentRef.setInput('rest', rest);
    expect(store.rest()).toBe(rest);
  });

  it('goes nowhere when the bar is tapped: the mock workout is no real log', async () => {
    const { fixture } = build();
    const router = fixture.debugElement.injector.get(Router);
    await expect(router.navigate(['/tabs/workouts/log', 'preview-log'])).resolves.toBe(false);
  });
});
