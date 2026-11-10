import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { SetMenuSheet } from './set-menu-sheet';

describe('SetMenuSheet', () => {
  // Copy set is the swipe right's copy: one tap adds it and the menu goes.
  it('asks for a copy of the set and closes', () => {
    TestBed.overrideComponent(SetMenuSheet, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(SetMenuSheet);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const menu = fixture.componentInstance;
    let copies = 0;
    menu.duplicate.subscribe(() => copies++);

    menu.copySet();

    expect(copies).toBe(1);
    expect(menu.open()).toBe(false);
  });
});
